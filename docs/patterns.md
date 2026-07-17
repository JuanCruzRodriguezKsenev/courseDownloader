# Patrones de código

Explicación de los patrones que sostienen el código actual — qué problema resuelve cada uno y dónde verlo. Para decisiones sobre patrones *evaluados pero no adoptados*, ver `docs/adr/`.

## IPC por acción con switch de strings

**Dónde**: `background.js:137-358` (`chrome.runtime.onMessage.addListener`), llamado desde `popup.js` con `chrome.runtime.sendMessage({ action: "...", ...payload })`.

**Qué hace**: todo el contrato entre popup y service worker pasa por un único canal de mensajes, despachado por el campo `action` (string). Acciones soportadas hoy: `escanear_carpeta_local`, `obtener_estados_en_progreso`, `inyectar_items_en_cola_activa`, `remover_item_de_cola`, `iniciar_descarga_cola`, `activar_frenado_suave`, `abortar_rafaga_inmediata`, `limpiar_estados_progreso`.

**Por qué así**: es el único mecanismo de comunicación entre contextos de ejecución aislados que ofrece la plataforma de extensiones — no hay alternativa (no se pueden compartir referencias de memoria entre popup y service worker).

**Convención a seguir**: cada acción nueva se agrega como un bloque `if (request.action === "...")` que termina en `return sendResponse(...)`, dentro del IIFE async que envuelve el body del listener. El listener siempre retorna `true` de forma síncrona para mantener el canal abierto a una respuesta async.

## State ownership split (AppState / SessionState)

**Dónde**: `shared/state.js` (`AppState`, vive en el popup) vs. el objeto `SessionState` definido inline en `background.js` (vive en el service worker).

**Qué hace**: en vez de un estado global compartido, cada zona de ejecución es dueña de una porción distinta del estado, y se reconcilian explícitamente vía IPC (`obtener_estados_en_progreso`) en vez de compartir memoria.

**Por qué así**: popup y service worker son procesos/contextos separados por diseño de la plataforma — no hay forma de que compartan un objeto en memoria. Separar por *ownership* (quién es la fuente de verdad de qué) en vez de duplicar todo el estado en ambos lados reduce la superficie de inconsistencia.

**Detalle completo del esquema**: ver `docs/data-model.md`.

## Daemon de estado de conexión (fuente única, push/subscribe)

**Dónde**: `shared/conexion.js` (`Conexion`), cargado tanto en el popup como en el SW.

**Qué hace**: centraliza TODA la detección de conexión (servidor Bun + internet) en un único poller. El resto del código no chequea conexión por su cuenta: sólo lee (`Conexion.get()` → `{servidor, internet, completa, tipoFalla}`) o se suscribe a los cambios (`Conexion.suscribir(cb)`, edge-triggered: notifica sólo en transición). El estado se espeja entre popup y SW vía `chrome.storage.session`, así ambos contextos convergen. En el popup el poller corre con `setInterval`; en el SW, que no sobrevive la suspensión, se dispara desde el handler de `chrome.alarms`.

**Por qué así**: antes había chequeos de conexión duplicados y con lógicas distintas (string-match de mensajes de error, HEADs sueltos, `navigator.onLine`) repartidos por popup y SW, que se contradecían. Una fuente única elimina esa clase de bugs. **Regla**: no agregar chequeos de conexión ad-hoc en otro lado — extender o consumir el daemon.

## Islas Preact (migración incremental de la UI, sin build)

**Dónde**: `popup/features/*.preact.js` + `popup/vendor/htm-preact-standalone.module.js`. Ver `docs/adr/0006` y el estado en `docs/preact-migration.md`.

**Qué hace**: regiones acotadas de la UI del popup se migran de manipulación imperativa del DOM a componentes Preact (`UI = f(estado)`), conviviendo con el resto vanilla. Preact + htm se cargan vendorizados como un ES module local (sin bundler, sin transpilación), vía `<script type="module">`. Un hook puente (`useConexion` ≈ `useSyncExternalStore`) suscribe la isla a la fuente de verdad (el daemon `Conexion`, o `AppState`).

**Por qué así**: casi todos los bugs de UI recientes fueron de sincronización estado↔DOM ("cambié el estado pero olvidé re-renderizar"). Con Preact la UI se re-deriva sola. **Regla de límite**: el DOM de una isla debe ser una región que el vanilla NO referencie por `nodos.*` (para no dejar referencias colgadas al re-renderizar) — por eso se migran indicadores puros (statusDot) antes que controles interactivos (inputs, botones).

## Cola FIFO persistente con reanudación automática

**Dónde**: `colaDescargas` en `chrome.storage.local`, procesada por `procesarSiguienteElementoDeLaCola()` en `background.js`.

**Qué hace**: la cola vive en storage persistente (no en memoria del service worker), ordenada por `fechaEncolado`. Al arrancar, el service worker chequea si `rafagaCorriendo` estaba en `true` y, de ser así, retoma el procesamiento — esto es lo que permite sobrevivir a que Chrome suspenda el service worker en medio de una descarga larga.

**Por qué así**: los service workers de Manifest V3 pueden ser terminados por el navegador en cualquier momento por inactividad; cualquier estado que solo viva en variables de JS del SW (como `loopActivo`, `controladorGraficoActivo`) se pierde. Por eso el *progreso* vive en `chrome.storage.session` (sobrevive a la suspensión) y la *cola* en `chrome.storage.local` (sobrevive también a un reinicio del navegador).

## Worker pool con concurrencia fija

**Dónde**: `HlsEngine.compilarTranscodificacionStream` en `background/hlsEngine.js:126-236`.

**Qué hace**: en vez de lanzar un `fetch` por fragmento con `Promise.all` sin límite (lo cual saturaría la red/memoria en manifiestos con cientos de fragmentos), se arranca un pool fijo de `CONCURRENCIA_MAXIMA = 6` "workers" async que comparten un índice (`nextTaskIndex`) sobre el array de URLs de fragmentos, cada uno procesando uno a la vez hasta agotar la cola.

**Por qué así**: acota el uso de memoria/conexiones concurrentes de forma predecible, manteniendo buen throughput sin necesidad de una librería externa de control de concurrencia.

## Retry con backoff exponencial

**Dónde**: `Utils.fetchConReintentos` en `shared/utils.js:369-392`.

**Qué hace**: envuelve `fetch` con hasta 4 reintentos, con delay `delayInicial * 2^(intento-1)` entre cada uno. Respeta `AbortSignal` — si el usuario cancela, no reintenta.

**Por qué así**: tolera micro-cortes de internet sin abortar la descarga completa (uno de los objetivos centrales del proyecto, ver README — "Auto-Heal").

## Circuit breaker ad-hoc (2 estados)

**Dónde**: `pausarColaPorErrorDeConexion()` + la alarma `alarma_autoheal` (`chrome.alarms`) en `background.js:594-663`.

**Qué hace**: cuando falla una descarga por conectividad, la cola se marca `colaPausadaPorError = true` y se registra una alarma que sondea cada ~12s si el recurso caído (internet o backend Bun) volvió, reanudando la cola automáticamente si es así.

**Relación con el patrón formal**: es funcionalmente un circuit breaker de 2 estados (pausado/activo) en vez de 3 (CLOSED/OPEN/HALF_OPEN). Ver `docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md` para por qué no se formalizó más.

## Sesiones únicas de descarga (idempotencia ad-hoc)

**Dónde**: `videoActualSessionId` en `SessionState`, enviado como header `x-session-id` en `BunClient.enviarFragmentoStream` (`shared/bunClient.js`).

**Qué hace**: cada intento de descarga de una clase genera un `sessionId` único (`Date.now().toString()`). El backend Bun lo usa para distinguir fragmentos de intentos distintos y evitar que una cancelación seguida de un reintento mezcle fragmentos huérfanos de la sesión anterior con la nueva.

**Relación con el patrón formal**: cumple el rol de un servicio de idempotencia sin ser uno centralizado. Ver `docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`.

## Optimistic UI update (con rollback)

**Dónde**: `encolarItemsEnCaliente()` en `popup/features/queue.js` (`QueueFeature`; `popup.js` la consume vía un alias local).

**Qué hace**: al agregar clases a la cola, `AppState.colaDescargas` y el DOM se actualizan de inmediato, sin esperar confirmación del service worker. La notificación IPC (`inyectar_items_en_cola_activa`) se dispara después con un callback: si el SW no confirma (`chrome.runtime.lastError` o `status != "encolados_ok"`), revierte la cola por `id`, restaura `estado`/`seleccionado` de los ítems y re-renderiza.

**Estado**: el rollback se implementó (`queue.js`, `popup.js` v5.7.1) — ver el ítem en la sección Resuelto de `docs/TECHNICAL_DEBT.md`.

## Sanitización de nombres de archivo y parsing de títulos

**Dónde**: `Utils.sanitizarTexto`, `Utils.formatTitleStructured`, `Utils.clasificarCatedraYCarpeta` en `shared/utils.js`.

**Qué hace**: normaliza títulos de clases scrapeados (texto libre, con acentos, fechas en formatos variables, mención de cátedra en distintas posiciones) a un nombre de archivo canónico `SEM mm-dd - MATERIA CATEDRA - CLASE n - PARTE m - DETALLE`, y separa esa clasificación en pasos (fecha → cátedra → materia → clase/parte → resto) que se van "consumiendo" del texto original para no volver a matchear lo mismo dos veces.

**Nota de fragilidad**: es la lógica más sensible a regresiones del proyecto — cualquier cambio en el orden de los regex puede alterar la clasificación de forma sutil. Es la prioridad #1 de cobertura de tests (ver `docs/testing.md`).
