# Patrones de código

Explicación de los patrones que sostienen el código actual — qué problema resuelve cada uno y dónde verlo. Para decisiones sobre patrones *evaluados pero no adoptados*, ver `docs/adr/`.

## IPC por acción con diccionario de handlers

**Dónde**: `background.js` (`chrome.runtime.onMessage.addListener` + el objeto `manejadoresIPC`), llamado desde `popup.js` con `chrome.runtime.sendMessage({ action: "...", ...payload })`.

**Qué hace**: todo el contrato entre popup y service worker pasa por un único canal de mensajes, despachado por el campo `action` (string). Acciones soportadas hoy: `escanear_carpeta_local`, `obtener_estados_en_progreso`, `inyectar_items_en_cola_activa`, `remover_item_de_cola`, `iniciar_descarga_cola`, `activar_frenado_suave`, `abortar_rafaga_inmediata`, `limpiar_estados_progreso`.

**Por qué así**: es el único mecanismo de comunicación entre contextos de ejecución aislados que ofrece la plataforma de extensiones — no hay alternativa (no se pueden compartir referencias de memoria entre popup y service worker).

**Convención a seguir**: cada acción se define como un método `async accion(request, sendResponse)` dentro del diccionario `manejadoresIPC`. El listener despacha por lookup (`manejadoresIPC[request.action]`), retorna `false` si no existe, y si existe lo envuelve en un IIFE async + `try/catch` global, retornando `true` de forma síncrona para mantener el canal abierto a una respuesta async. Cada handler termina en `sendResponse(...)`.

## State ownership split (AppState / SessionState)

**Dónde**: `shared/state.js` (`AppState`, vive en el popup) vs. el objeto `SessionState` definido inline en `background.js` (vive en el service worker).

**Qué hace**: en vez de un estado global compartido, cada zona de ejecución es dueña de una porción distinta del estado, y se reconcilian explícitamente vía IPC (`obtener_estados_en_progreso`) en vez de compartir memoria.

**Por qué así**: popup y service worker son procesos/contextos separados por diseño de la plataforma — no hay forma de que compartan un objeto en memoria. Separar por *ownership* (quién es la fuente de verdad de qué) en vez de duplicar todo el estado en ambos lados reduce la superficie de inconsistencia.

**Detalle completo del esquema**: ver `docs/data-model.md`.

## Daemon de estado de conexión (fuente única, push/subscribe)

**Dónde**: `shared/conexion.js` (`Conexion`), cargado tanto en el popup como en el SW.

**Qué hace**: centraliza TODA la detección de conexión (servidor Bun + internet) en un único poller. El resto del código no chequea conexión por su cuenta: sólo lee (`Conexion.get()` → `{servidor, internet, completa, tipoFalla}`) o se suscribe a los cambios (`Conexion.suscribir(cb)`, edge-triggered: notifica sólo en transición). El estado se espeja entre popup y SW vía `chrome.storage.session`, así ambos contextos convergen. En el popup el poller corre con `setInterval`; en el SW, que no sobrevive la suspensión, se dispara desde el handler de `chrome.alarms`.

**Por qué así**: antes había chequeos de conexión duplicados y con lógicas distintas (string-match de mensajes de error, HEADs sueltos, `navigator.onLine`) repartidos por popup y SW, que se contradecían. Una fuente única elimina esa clase de bugs. **Regla**: no agregar chequeos de conexión ad-hoc en otro lado — extender o consumir el daemon.

**Nota (fallas que NO son de conexión)**: algunos fallos se parecen a una caída pero no lo son, y el daemon los malclasificaría (vería conectividad OK). Esos casos se detectan por un error tipado y se clasifican ANTES de consultar al daemon: `"sesion"` (login expirado) y `"rechazo"` (4xx aplicativo del backend). Ver §Circuit breaker.

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

**Dónde**: `Utils.fetchConReintentos` en `shared/utils.js`.

**Qué hace**: envuelve `fetch` con hasta 4 reintentos y delay `delayInicial * 2^(intento-1)` entre cada uno. Respeta `AbortSignal` — si el usuario cancela (`opciones.signal`), no reintenta. Para no "quemar" la escalera completa (~15 s) ante una caída sostenida, corta temprano en dos casos, sin sacrificar la tolerancia a micro-cortes:

- **`navigator.onLine === false`** (sólo la forma NEGATIVA, confiable): si el browser ya reporta la interfaz local caída (ej. wifi apagado), falla al instante (v5.8.0).
- **Daemon `Conexion`**: ante cada fallo, si `navigator.onLine` sigue en `true` (no confiable en Windows ante un corte **aguas arriba** — WAN caída con la NIC local "conectada"), consulta `Conexion.verificarAhora()` (HEAD real, ~4 s — ver §Daemon de estado de conexión) y corta si `internet` está caído. Un micro-corte se tolera igual: si el HEAD pasa, sigue reintentando (v5.9.0).

Cada intento tiene además un **timeout propio de 10 s** (`AbortController` compuesto con el `signal` del caller vía `AbortSignal.any`) para acotar un socket colgado que nunca rechaza. Al vencer, el error se reescribe a un `Error` normal — **no** `AbortError`, que aguas arriba se confunde con cancelación/abort externo (mismo criterio que `BunClient.enviarFragmentoStream`, ver `bunClient.js` v1.2.0) (v5.9.1).

**Por qué así**: tolera micro-cortes de internet sin abortar la descarga completa (uno de los objetivos centrales del proyecto, ver README — "Auto-Heal"), pero una caída sostenida se detecta en ~4-5 s en vez de ~16 s. La clasificación del fallo una vez propagado vive en §Circuit breaker.

## Circuit breaker ad-hoc (2 estados)

**Dónde**: `pausarColaPorErrorDeConexion()` + la alarma `alarma_autoheal` (`chrome.alarms`) en `background.js:594-663`.

**Qué hace**: cuando falla una descarga por conectividad, la cola se marca `colaPausadaPorError = true` y se registra una alarma que sondea cada ~12s si el recurso caído (internet o backend Bun) volvió, reanudando la cola automáticamente si es así.

**Clasificación del tipo de falla** (en el catch de `procesarSiguienteElementoDeLaCola`): primero el flag explícito `abortadoPorUsuario` (cancelación limpia, no es fallo); luego el caso `"sesion"` (ver abajo); luego el caso `"rechazo"` 4xx (ver abajo); luego el daemon `Conexion` (`tipoFalla` = `servidor`/`internet`); y si la red está OK, una heurística por mensaje (`"Bun"/"backend"` → `servidor`, si no `internet`).

**Caso `"rechazo"` 4xx (excepción al autoheal — bug 400)**: un HTTP **4xx** del backend Bun a un fragmento (`POST /api/bypass-stream` → 400) es un rechazo **aplicativo determinístico** con el server VIVO — reintentar el mismo fragmento no lo cura, y `/api/health` daría 200, así que el daemon lo malclasificaría como `"servidor"` generando un loop pausa→autoheal→mismo 400 que congelaba toda la cola. `BunClient.enviarFragmentoStream` tipa el error (`err.tipoBackend = "rechazo"` + `err.httpStatus`; el **5xx NO se tipa** → conserva el flujo pausa+autoheal, puede ser transitorio); el worker de `HlsEngine` reintenta el envío N=3 con backoff corto SÓLO ante ese tipo y, agotado, propaga el error intacto; el catch lo clasifica ANTES de consultar al daemon (como `"sesion"`) y **salta SOLO esa clase**: la deja en `'pending'` (re-encolable — el estado `'error'` que se usó al principio no lo reconocía el resto del popup: rompía render y encolado), la saca de la cola con un `.set()` atómico de las 3 claves, emite `clase_con_error` {titulo, motivo} y sigue con la próxima con `procesarSiguienteElementoDeLaCola()` — **sin pausar la cola y sin crear alarma**. El fallo se comunica por la campanita + la notificación nativa (`registrarFallo`, ver §Aviso de fallos abajo). Ver `bunClient.js` v1.4.0, `hlsEngine.js` v1.0.6, `background.js` v5.10.1, `popup.js` v5.15.0, y el ítem resuelto en `docs/TECHNICAL_DEBT.md`.

**Caso `"sesion"` (excepción al autoheal)**: descargar sin sesión iniciada en Ramón Net NO es un fallo de red — la plataforma redirige la página de la clase al login y el daemon `Conexion` ve la conectividad OK (lo malclasificaría como `internet`). `ResolverManifiesto.resolver` (`sitio/ramonnet/`) lo detecta porque la URL final perdió el segmento `/clases-grabadas/` y lanza un error tipado (`err.tipoConexion = "sesion"`); el catch lo clasifica ANTES de consultar al daemon. `pausarColaPorErrorDeConexion` **no crea la alarma** para este tipo (el daemon no puede detectar el login → reintentaría en loop) y el handler de `alarma_autoheal` la limpia defensivamente si el estado quedó en `"sesion"`. El popup muestra una card "Sesión no iniciada" 🔑 y el usuario reanuda a mano tras loguearse. Ver `resolverManifiesto.js` v1.0.0 (antes `hlsEngine.js` v1.0.5), `background.js` v5.8.0, `popup.js` v5.12.0.

**Aviso de fallos (historial + notificación nativa)**: los dos paths terminales —la rama `"rechazo"` (clase saltada) y `pausarColaPorErrorDeConexion` (tipos `sesion`/`servidor`/`internet`)— pasan por un choke point único, `registrarFallo(tipo, titulo, motivo)` en `background.js`, que (a) persiste el fallo en el historial acotado (`shared/historialFallos.js` → `chrome.storage.local`, clave `historialFallos`, fuente de la campanita del popup) y (b) dispara una notificación nativa del SO (`chrome.notifications.create`). Se llama una sola vez por fallo terminal (después de agotar los reintentos / en la transición de pausa), no por reintento. Clickear la notificación enfoca la pestaña de Ramón Net (`chrome.notifications.onClicked`). Ver `background.js` v5.10.0, `docs/notificaciones-fallos-diseno.md`, `docs/data-model.md`.

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

**Detalle de las heurísticas** (fuente canónica):
- **Fecha** (`parseSmartDate`): ante ambigüedad día/mes, si un número es >12 y el otro no, el >12 es el día.
- **Cátedra + carpeta** (`clasificarCatedraYCarpeta`): se intenta en orden — mención explícita "CATEDRA X" → mención "MATERIA X" → match difuso genérico "SIGLA X" contra la materia base → default `"COMUN"`.

**Nota de fragilidad**: es la lógica más sensible a regresiones del proyecto — cualquier cambio en el orden de los regex puede alterar la clasificación de forma sutil. Es la prioridad #1 de cobertura de tests (ver `docs/testing.md`).
