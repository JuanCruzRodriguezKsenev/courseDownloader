# Deuda técnica — RamonNet Video Downloader

Inventario vivo de problemas conocidos en el código actual, ordenados por severidad. Cada ítem indica ubicación exacta, impacto y la solución propuesta. Este documento se actualiza a medida que se resuelven o aparecen nuevos hallazgos — no es un snapshot histórico (para eso está el changelog de cada archivo y el historial de git).

Última auditoría: 2026-07-19.

---

## 🔴 Seguridad

### XSS por interpolación sin escapar de título scrapeado

- **Dónde**: `popup.js:1012` y `popup.js:1019`, dentro de `renderizarListadoInterfaz()`.
- **Qué pasa**: `AppState.videoFalladoParaReintento` (que proviene de `SW_ESTADOS_PROGRESO.videoActual` en el service worker, que a su vez proviene del scraping del DOM de Ramón Net vía `sitio/ramonnet/scraper.js`) se interpola sin escapar dentro de un template string HTML:
  ```js
  descripcion: `...<strong>Pausado en:</strong> ${titulo}`
  ```
  Ese string se pasa a `Renderers.renderizarTarjetaEstado`, que lo asigna con `card.innerHTML = ...`.
- **Impacto**: si el título de una clase (contenido de un tercero, no controlado por esta extensión) contuviera markup malicioso (ej. `<img src=x onerror=...>`), se ejecutaría en el contexto del popup, que tiene permisos `downloads`, `scripting` y `storage`.
- **Por qué es inconsistente**: el resto del código ya resuelve esto correctamente — `renderers.js:74` y `renderers.js:124` usan `.innerText` para pintar `clase.titulo`. Este es el único punto donde se rompió el patrón.
- **Fix propuesto**: reemplazar la interpolación directa por nodos DOM con `.textContent`, o por una función de escape HTML aplicada al título antes de interpolarlo.
- **Estado**: ✅ resuelto (2026-07-16). Se agregó `Utils.escaparHtml` (`shared/utils.js`) y se aplica al título en `popup.js:renderizarListadoInterfaz` antes de interpolarlo. La descripción mantiene su HTML intencional (`<br>`/`<strong>`); solo el título de terceros va escapado. Ver sección Resuelto.

---

## 🟠 Mantenibilidad

### `popup.js` como "god file" (1710 líneas, un solo closure)

- **Dónde**: `popup.js`, completo.
- **Qué pasa**: prácticamente toda la lógica de UI vive dentro de un único listener `DOMContentLoaded`, con ~50 funciones anidadas que comparten variables de clausura (`nodos`, `filtrosActivos`, y flags sueltos como `verificandoConexionBoton` (`popup.js:171`) y `reintentandoColaActivo` (`popup.js:172`)).
- **Impacto concreto**:
  - No se puede testear ninguna función de forma aislada sin montar el DOM completo y disparar `DOMContentLoaded`.
  - Acoplamiento oculto: una variable de clausura mutada en una función puede afectar el comportamiento de otra función a 800+ líneas de distancia, sin que quede evidencia en el diff de un cambio puntual.
- **Fix propuesto**: ver `docs/ROADMAP.md` — reorganización feature-driven en módulos (`popup/features/*`), cargados como `<script>` adicionales en `popup.html`.
- **Estado**: ✅ resuelto al estado final (2026-07-19). Extraídos `popup/features/serverConnection.js` (apoyado en el daemon `shared/conexion.js`, que absorbió los flags de monitoreo `intervalReconexion`/`comprobacionEnProgreso` que antes vivían sueltos acá), `popup/features/queue.js` (ciclo de vida completo de la cola: mutaciones `encolarItemsEnCaliente`/`quitarItemsDeColaEnLote`, cancelación `solicitarFrenadoSuave`/`abortarRafagaInmediata`, arranque `iniciarDescargaCola` y reintento `ejecutarReintentoDeCola`, con tests), `popup/features/filters.js` (búsqueda + filtros por estado/materia/cátedra + popover; `filtrosActivos` se pasa POR REFERENCIA en `ctx`; unificó el predicado de filtrado de la Cola —antes triplicado— en `coincideConFiltrosCola`; con tests) y `popup/features/catedra.js` (badge + asistente/modal multicátedra + listener del badge; unificó el `detectarCatedras()` antes triplicado; con tests). Además, varias regiones de UI pasaron a **islas Preact** (onboarding, header de conexión, banner de caída, ruta de disco y la lista de clases — ver `docs/preact-migration.md`). Con `catedra.js` (el último cluster de bajo acoplamiento) cierra la **Fase 2**: lo que queda en `popup.js` (init + wiring + orquestación de render/worker IPC/scraping) es el estado final que ADR-0005 define como núcleo no-extraíble — `scraping` NO se extrae por decisión (alimenta ADR-0008). Ver sección Resuelto.

### `background.js` — listener IPC monolítico

- **Dónde**: `background.js:143-356`, `chrome.runtime.onMessage.addListener`.
- **Qué pasa**: mismo patrón que `popup.js` pero a menor escala — un único listener con un bloque `if (request.action === "...")` por cada una de las 8 acciones soportadas.
- **Impacto**: menor que en `popup.js` porque cada bloque es relativamente autocontenido, pero sigue siendo difícil de testear sin mockear `chrome.runtime.onMessage`.
- **Fix propuesto**: si se toca este archivo para otra tarea, extraer cada acción a una función nombrada en un dict `{accion: handler}` y despachar por lookup en vez de cadena de `if`.
- **Estado**: ✅ resuelto (2026-07-17). Las 8 acciones pasaron a métodos `async accion(request, sendResponse)` del objeto `manejadoresIPC`; el listener despacha por lookup (`manejadoresIPC[request.action]`), conservando el IIFE async + try/catch global + `return true`. Comportamiento idéntico. `background.js` → v5.7.0. Ver `docs/patterns.md` §IPC y sección Resuelto.

### Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`

- **Dónde**: `popup.js:1372-1374`.
- **Qué pasa**: define una función local que solo llama a `Utils.clasificarCatedraYCarpeta`. Los 5 call-sites reales (`popup.js:561`, `:831`, `:932`, `:1250`, `:1630`) llaman directo a `Utils.clasificarCatedraYCarpeta`, ignorando el wrapper.
- **Fix propuesto**: borrar `popup.js:1372-1374`.
- **Estado**: ✅ resuelto (2026-07-16). Wrapper eliminado; los 5 call-sites ya llamaban directo a `Utils.clasificarCatedraYCarpeta`. `popup.js` → v5.5.4. Ver sección Resuelto.

### Función muerta (¿o call-site faltante?): `marcarClaseComoPendiente`

- **Dónde**: `background.js:606`, `async function marcarClaseComoPendiente(listaCompleta, elementoActual)`.
- **Qué pasa**: la detectó el `no-unused-vars` de ESLint (2026-07-17). La función marca una clase como `'pending'` (en `listaPersistente`, `SW_ESTADOS_PROGRESO`) y la saca de `colaDescargas`, pero **no la llama nadie** — el único otro match textual es un comentario de changelog.
- **Impacto / ambigüedad**: hay que decidir cuál de dos es el caso real antes de tocar:
  - (a) **Código muerto** → borrarla.
  - (b) **Call-site faltante (bug latente)** → por el nombre y la firma (`elementoActual`), parece pensada para cuando una descarga falla a mitad de ráfaga y la clase debería volver a `'pending'` en vez de quedar en `'process'`. Si ese caso hoy no resetea la clase, hay un hueco funcional, no sólo código muerto.
- **Nota**: la consolidación de escritura atómica de v5.6.3 tocó esta función; el cambio sigue siendo correcto, pero resultó estar sobre código sin uso.
- **Estado**: ✅ resuelto (2026-07-17) — confirmado caso (a): la lógica de "remover de la cola + volver a 'pending'" ya vive inline en el handler `remover_item_de_cola` (`background.js`), y `git log -S` mostró que la función no tenía call-sites desde el commit inicial del repo (importado en v13, ya desconectada). Función eliminada. `background.js` → v5.6.4. Ver sección Resuelto.

### `styles/components.css` (1261 líneas en un solo archivo)

- **Dónde**: `styles/components.css`.
- **Impacto**: bajo — no es un problema funcional, solo dificulta ubicar reglas específicas a medida que crece.
- **Fix propuesto**: dividir por componente (`components/onboarding.css`, `components/queue.css`, etc.) si el archivo sigue creciendo. No urgente.
- **Estado**: ✅ resuelto (2026-07-17). `styles/components.css` se partió en 13 archivos `styles/components/*.css` (header, path-bar, tabs, filters, turbo-switch, footer, actions, loader, multicatedra, downloads-active, advertencia, onboarding, help-button). El `@import` de `popup/globals.css` replica el orden original para no alterar la cascada; `popup.html` no cambió. Verificado con paridad de bloques `{` (165 = 165). Ver sección Resuelto.

---

## 🟡 Testing

### Cobertura de tests: parcial

- **Qué pasa**: ya hay `package.json` + Vitest/jsdom, con 18 archivos de test (177 tests). Cubiertos: `shared/utils.js` (funciones puras), `shared/conexion.js` (daemon de conexión), `shared/bunClient.js` (cliente del backend), las features/islas del popup extraídas — `popup/features/serverConnection.js`, `queue.js`, `filters.js`, `faceta.js`, y las islas Preact `conexionHeader`/`onboarding`/`rutaDisco`/`bannerConexion`/`listaClases` —, `background/hlsEngine.js` tanto sus funciones puras (parseo/resolución M3U8) como el **pool de 6 workers** `compilarTranscodificacionStream` (concurrencia/AES/turbo-blob/aborts en cascada + el path 4xx del bug 400) y los handlers IPC de `background.js` (harness con `chrome.*` mockeado). Sigue sin cobertura unitaria: el núcleo de `popup.js` que por diseño queda en el closure y el bucle `procesarSiguienteElementoDeLaCola` + auto-heal del SW.
- **Impacto**: la lógica pura, el daemon, el cliente del backend, las features/islas, el parseo M3U8, el pool de descarga y los handlers IPC tienen red de regresión; sólo la orquestación restante de UI y el bucle/auto-heal del SW dependen de pruebas manuales.
- **Fix propuesto**: ver `docs/ROADMAP.md`. El núcleo de `popup.js` (init + wiring + scraping/render) queda como orquestación no-extraíble por ADR-0005 → verificación manual/e2e; el bucle del SW se cubriría al re-arquitecturar el motor sobre puertos (ADR-0008/Fase 6).
- **Estado**: 🟢 cubierto lo abordable en JS (2026-07-19) — utils, conexión, bunClient, serverConnection, queue, filters, catedra, las 5 islas Preact, hlsEngine (funciones puras + pool `compilarTranscodificacionStream`) y los handlers IPC de background. Lo pendiente (núcleo de `popup.js`, bucle/auto-heal del SW) es manual/e2e por diseño hasta la re-arquitectura de Fase 6.

---

## 🔴 Robustez del flujo de datos

### Loop infinito pausa/autoheal ante rechazo 4xx del backend

- **Dónde**: cadena entre `shared/bunClient.js:117-119`, `background/hlsEngine.js:225`/`:255` y `background.js:632-642`.
- **Qué pasa** (detectado en logs reales, 2026-07-18): cuando el backend Bun responde HTTP **4xx** a un fragmento (`POST /api/bypass-stream` → 400, rechazo aplicativo con el server **vivo**), el sistema lo confunde con una caída de servidor y entra en loop. Cadena causal:
  1. `bunClient.js:117-119` lanza un `Error` cuyo status **solo vive en el string del mensaje** (`El backend de Bun rechazó el fragmento con código: ${res.status}`) — nadie aguas arriba puede distinguir un 400 determinístico de un 503 transitorio sin parsear texto.
  2. El worker (`hlsEngine.js:255`) lo trata como fallo de fragmento y aborta el `controladorGraficoActivo` → la clase entera falla.
  3. El catch de `background.js:632-642` clasifica con el daemon: `Conexion.verificarAhora()` sondea `/api/health` → **200** (server vivo) → `tipoFalla=null` → cae a la heurística por mensaje, que como el string contiene "Bun" clasifica **"servidor"** → `pausarColaPorErrorDeConexion` crea `alarma_autoheal`.
  4. El autoheal despierta, ve `/api/health` 200, reanuda la cola → el mismo fragmento vuelve a dar 400 → **loop infinito**. El usuario no puede avanzar salvo cancelar a mano.
- **Impacto**: una sola clase con un fragmento que el backend rechaza congela **toda** la cola indefinidamente. Rompe el caso de uso principal (descarga masiva).
- **Fix propuesto** (acordado): un 4xx es determinístico — reintentar el mismo fragmento no lo cura y no es una caída de conexión. Reintentar N=3 con backoff corto y, si persiste, **saltar solo esa clase avisando cuál falló**, siguiendo con la próxima (sin pausar, sin autoheal). El 5xx mantiene el comportamiento actual (pausa+autoheal: puede ser hipo transitorio del server). Implementación:
  - `bunClient.js`: tipar el error 4xx (`err.tipoBackend="rechazo"` + `err.httpStatus`), como ya se hace con `err.tipoConexion="sesion"`.
  - Reintento N en el worker (`hlsEngine.js:225`, envolviendo `enviarFragmentoStream`); agotado, propagar el error tipado.
  - `background.js` (catch `:598-644`): rama **antes** del daemon (como el caso `"sesion"` en `:623`) → marcar la clase `'error'`, sacarla de la cola con un `.set()` atómico (patrón del path de éxito `:584-588`), emitir `clase_con_error` con `titulo`+motivo, y `procesarSiguienteElementoDeLaCola()`.
  - Popup: el handler `clase_con_error` (`popup.js:1170-1178`) **ya existe pero nadie lo emite** y muestra texto genérico sin nombrar la clase — mejorarlo para nombrar `req.titulo`+motivo y limpiar la cola local (espejando `clase_guardada_ok` `:1156-1167`).
- **Estado**: ✅ resuelto (2026-07-19). Implementado el fix acordado en 4 puntos: (1) `bunClient.js` v1.4.0 tipa el rechazo 4xx (`err.tipoBackend="rechazo"` + `err.httpStatus`; el 5xx NO se tipa → conserva pausa+autoheal); (2) `hlsEngine.js` v1.0.6 envuelve el envío del fragmento en un reintento N=3 con backoff corto SÓLO para ese error tipado y, agotado, propaga el error intacto; (3) `background.js` v5.9.0 clasifica el rechazo ANTES del daemon (igual que `"sesion"`): marca la clase `'error'`, la saca de la cola con un `.set()` atómico de las 3 claves, emite `clase_con_error` {titulo, motivo} y sigue con la próxima (sin pausa, sin alarma); (4) `popup.js` v5.13.0 mejora el handler `clase_con_error` (antes muerto y genérico) para nombrar la clase saltada + motivo (título vía `textContent`, regla anti-XSS) y limpiar la cola local, espejando `clase_guardada_ok`. Cobertura nueva: `shared/bunClient.test.js` (4xx tipa / 5xx no) y `background/hlsEngine.test.js` (worker reintenta 3× ante 4xx y propaga tipado; un no-rechazo no se reintenta). **Refinamiento posterior** (`background.js` v5.10.1 / `popup.js` v5.15.0): la clase saltada vuelve a `'pending'` en vez de a un estado `'error'` — ese estado no lo reconocía el resto del popup (rompía el render del badge y bloqueaba el re-encolado), y el fallo ahora se comunica por la campanita + notificación nativa (ver `docs/notificaciones-fallos-diseno.md`). Ver sección Resuelto y `docs/patterns.md` §Circuit breaker.

---

## 🟡 Robustez del flujo de datos

### Optimistic update sin rollback en `encolarItemsEnCaliente`

- **Dónde**: `encolarItemsEnCaliente` en `popup.js:785` (el `sendMessage` sin verificar, en `popup.js:815`).
- **Qué pasa**: la función actualiza `AppState.colaDescargas` y el DOM de inmediato (patrón optimistic update), y recién después dispara `chrome.runtime.sendMessage({ action: "inyectar_items_en_cola_activa", ... })` sin `.then`/`.catch` ni verificar la respuesta.
- **Impacto**: si el mensaje falla (SW dormido, error de storage), la UI queda mostrando ítems como "en cola" que en realidad nunca se persistieron en `background.js`, generando un estado inconsistente entre popup y service worker hasta el próximo `sincronizarConBackground()`.
- **Fix propuesto**: verificar la respuesta de `sendMessage` (usar el patrón callback/promise con manejo de `chrome.runtime.lastError` que ya usan en otras partes del código, ej. `state.js:66-68`) y revertir `AppState.colaDescargas` + re-render si falla.
- **Estado**: ✅ resuelto (2026-07-17). `encolarItemsEnCaliente` ahora pasa un callback al `sendMessage`; ante `chrome.runtime.lastError` o `status != "encolados_ok"` revierte la cola (filtrando por `id`, robusto ante encolados intermedios), restaura `estado`/`seleccionado` de los ítems y re-renderiza. El handler del SW ya respondía `{ status: "encolados_ok" }` en éxito y su `catch` global solo loguea (cierra el canal → `lastError`), por lo que ambos modos de fallo caen en el rollback. `popup.js` → v5.7.1. Ver sección Resuelto.

### Escrituras no-atómicas a `chrome.storage.local`

- **Dónde**: varios puntos de `background.js` que leen y escriben `listaPersistente`, `colaDescargas` y `SW_ESTADOS_PROGRESO` como operaciones `.get()`/`.set()` separadas para el mismo cambio lógico.
- **Qué pasa**: `chrome.storage.local` no ofrece transacciones — si el service worker se suspende o falla entre un `.set()` y el siguiente, esas claves relacionadas pueden quedar desincronizadas entre sí.
- **Impacto**: riesgo de estado inconsistente (ej. un ítem marcado `process` en `SW_ESTADOS_PROGRESO` pero ya removido de `colaDescargas`). Bajo en la práctica porque el SW suele completar estas operaciones síncronamente dentro del mismo tick, pero no está garantizado.
- **Fix propuesto**: auditar y consolidar en un único `.set({...})` por operación lógica cuando se tocan varias claves relacionadas. El patrón correcto ya existe en `background.js:216-239` (`inyectar_items_en_cola_activa`: un `.get()` de las tres claves seguido de un único `.set({...})`) — usarlo como referencia para homogeneizar el resto.
- **Estado**: ✅ resuelto (2026-07-17). Auditados los 13 `.get()/.set()` de `background.js`; los 3 puntos que escribían las tres claves relacionadas en dos `.set()` separados (`persistirEstadoFondo()` + un `.set()` de `listaPersistente`/`colaDescargas`) se consolidaron en un único `.set({...})` de las tres: fin de descarga exitosa (`clase_guardada_ok`), `marcarClaseComoPendiente`, y `abortar_rafaga_inmediata`. Los `persistirEstadoFondo()` que escriben SÓLO `SW_ESTADOS_PROGRESO` (marcar 'process' al arrancar, reset a `{}` en cola vacía) se dejaron como están — no son multi-clave. `background.js` → v5.6.3. Ver sección Resuelto.

---

## 🟢 Menores / de proceso

| Ítem | Ubicación | Impacto | Estado |
|---|---|---|---|
| Sin linter (ESLint) configurado | proyecto completo | No se detectan variables no usadas, `==` vs `===`, código muerto adicional | ✅ resuelto (2026-07-17) — `eslint.config.js` + `npm run lint`; 0 errores, 11 warnings iniciales |
| `catch (e) {}` silenciosos (3 casos) | `background.js:147`, `background.js:325` y `background/hlsEngine.js:219` (los dos últimos, `abort()` del controlador de gráfico activo) | Dificulta debug si falla el abort/limpieza de recursos | ✅ resuelto (2026-07-17) — ahora `console.warn` con contexto |
| URL de backend hardcodeada | `shared/bunClient.js` (`baseUrl`) | No se puede apuntar a otro host/puerto sin editar código; relevante si se agregan tests de integración contra el backend real | ✅ resuelto (2026-07-17) — hook liviano: `configurarBaseUrl(url)` + global `RAMONNET_BUN_BASE_URL`; default intacto. `bunClient.js` → v1.3.0 |

---

## Resuelto

- **Loop infinito pausa/autoheal ante rechazo 4xx del backend** (2026-07-19). Un HTTP 4xx del backend Bun a un fragmento (`POST /api/bypass-stream` → 400) se confundía con una caída de servidor: el status vivía sólo en el string del mensaje, el daemon veía `/api/health` 200 (server vivo) → la heurística por mensaje clasificaba `"servidor"` → pausa+autoheal → el autoheal reanudaba → mismo 400 → loop que congelaba toda la cola. Fix en 4 puntos: `bunClient.js` v1.4.0 tipa el 4xx (`err.tipoBackend="rechazo"`+`httpStatus`; el 5xx no, conserva pausa+autoheal); el worker de `hlsEngine.js` v1.0.6 reintenta el envío N=3 sólo ante ese tipo y propaga el error intacto al agotarse; `background.js` v5.9.0 lo clasifica ANTES del daemon (como `"sesion"`) → marca la clase `'error'`, la saca de la cola con `.set()` atómico de las 3 claves, emite `clase_con_error` y sigue con la próxima (sin alarma); `popup.js` v5.13.0 mejora el handler `clase_con_error` (antes muerto/genérico) para nombrar la clase saltada + motivo (`textContent`, anti-XSS) y limpiar la cola local. Un 4xx es determinístico: saltar la clase avisando es lo correcto; el 5xx/red mantiene pausa+autoheal. Tests nuevos en `bunClient.test.js` y `hlsEngine.test.js` (135 → 139). Ver `docs/patterns.md` §Circuit breaker.
- **Listener IPC monolítico en `background.js`** (2026-07-17). La cadena de 8 `if (request.action === …)` pasó a un diccionario `manejadoresIPC {accion: async handler(request, sendResponse)}` despachado por lookup; el listener conserva el IIFE async + try/catch global + `return true` síncrono. Sin cambio de comportamiento (los handlers siguen mutando `loopActivo`/`controladorGraficoActivo` por closure). `background.js` → v5.7.0.
- **`styles/components.css` monolítico (1261 líneas)** (2026-07-17). Partido en 13 archivos por componente en `styles/components/*.css`; `popup/globals.css` los reimporta en el orden original (cascada intacta) y `popup.html` no se tocó (sólo linkea `globals.css`). Verificado: paridad de bloques `{` 165 = 165.
- **Función muerta `marcarClaseComoPendiente`** (2026-07-17). La destapó `no-unused-vars` de ESLint. Confirmado código muerto: su lógica ("sacar de la cola + volver la clase a 'pending'") ya está inline en el handler `remover_item_de_cola`, y `git log -S "marcarClaseComoPendiente("` mostró que no tenía call-sites desde el commit inicial del repo (importado en v13, ya desconectada de fábrica). Eliminada. `background.js` → v5.6.4. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance actual — ver Testing.)
- **Escrituras no-atómicas a `chrome.storage.local`** (2026-07-17). Los 3 puntos de `background.js` que tocaban `listaPersistente` + `colaDescargas` + `SW_ESTADOS_PROGRESO` para un mismo cambio lógico usaban dos `.set()` separados (uno vía `persistirEstadoFondo()`), dejando una ventana donde una suspensión del SW podía desincronizarlas. Consolidados en un único `.set({...})` de las tres claves (fin de descarga, `marcarClaseComoPendiente`, `abortar_rafaga_inmediata`), siguiendo el patrón de `inyectar_items_en_cola_activa`. `background.js` → v5.6.3. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance actual — ver Testing.)
- **Optimistic update sin rollback en `encolarItemsEnCaliente`** (2026-07-17). La función actualizaba `AppState.colaDescargas` + DOM + estado `'process'` y disparaba `inyectar_items_en_cola_activa` sin verificar la respuesta; si el SW no confirmaba (dormido, error de storage), la UI quedaba mostrando ítems "en cola" nunca persistidos en `background.js`. Fix: el `sendMessage` ahora tiene callback que, ante `chrome.runtime.lastError` o `status != "encolados_ok"`, revierte la cola (por `id`), restaura `estado`/`seleccionado` de los ítems y re-renderiza. `popup.js` → v5.7.1. (Sin test unitario: `popup.js` sigue bloqueado por el split de Fase 2 — ver Testing.)
- **`catch (e) {}` silenciosos (3 casos)** (2026-07-17). Los tres catch vacíos ahora dejan rastro con `console.warn` + contexto: el cierre del documento offscreen (`background.js`, puede fallar de forma esperada si no había documento abierto) y los dos `abort()` de limpieza del controlador de gráfico activo (`background.js` en el fin de ráfaga, `hlsEngine.js` ante fallo de fragmento — un fallo del abort acá es inesperado y ahora es visible). `background.js` → v5.6.2, `hlsEngine.js` → v1.0.1. (Sin test unitario: ambos dependen de `chrome.*`/estado del SW, fuera del alcance de testing actual — ver Testing.)
- **El banner de "descarga interrumpida" no se iba al reconectar el servidor (hasta refrescar el popup)** (2026-07-16). Al volver el server, `reaccionarAConexion` → `onReintentarCola` → `ejecutarReintentoDeCola` ponía `AppState.fallaConexionActiva = null` sin re-renderizar. La única limpieza real del banner vive en el handler `update_progress_bar`, pero (a) su rama de limpieza está gateada a `if (AppState.fallaConexionActiva)` — ya en null — y (b) su re-render está gateado a que cambie el título, que no cambia porque se reanuda el mismo video. La descarga avanzaba en el SW pero el popup quedaba pegado en el banner. Fix: `ejecutarReintentoDeCola` restaura el panel de descarga (`cancelBox`/`progressCont`) y llama `renderizarListadoInterfaz()` al reanudar. `popup.js` → v5.5.6. Nota relacionada: `reanudarColaDesdeBackground` (autoheal del SW) reanuda sin avisar al popup — la limpieza del banner depende de la ruta del popup o del primer `update_progress_bar`.
- **El banner de "descarga interrumpida" no se disparaba al caer el servidor durante una descarga** (2026-07-16). La clasificación de fin de descarga en `background.js` (~línea 534) tomaba `controladorGraficoActivo.signal.aborted` y `errDescarga.name==='AbortError'` como señales de cancelación del usuario. Pero el motor HLS aborta ese controlador A PROPÓSITO para frenar a los otros workers cuando un fragmento falla (server caído), y ese abort hace que los fetches hermanos rechacen con `AbortError`. Resultado: la caída se confundía con cancelación, el SW retornaba sin pausar la cola, y nunca enviaba `cola_pausada_por_error` → el popup no mostraba el banner. Fix: la clasificación usa SÓLO el flag explícito `state.abortadoPorUsuario`. `background.js` → v5.6.1. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance de testing actual — ver Testing.)
- **Indicador verde para siempre si el servidor cae durante una descarga** (2026-07-16). Dos capas: (1) `enviarFragmentoStream` (`bunClient.js`) no tenía timeout, así que al morir el Bun a mitad de descarga el POST a `/api/bypass-stream` se colgaba, el loop del SW nunca fallaba y nunca pausaba la cola ni marcaba la caída; (2) aun detectándola, el popup ignora al daemon durante una ráfaga (`reaccionarAConexion` abortaba en la guarda `ráfagaEnCurso`), dejando el puntito verde. Fix: timeout de 30s en `enviarFragmentoStream` que lanza un Error de "backend" (NO `AbortError` — el SW lo trata como cancelación de usuario) para que la cola se pause; y `pintarStatusDot` se movió ANTES de la guarda para que el indicador refleje la conexión SIEMPRE (level-triggered), sin tocar el banner/lista durante la descarga. `bunClient.js` → v1.2.0, `serverConnection.js` → v1.5.0. Tests nuevos en `bunClient.test.js` (timeout ≠ AbortError; abort de usuario se propaga) y `serverConnection.test.js` (puntito refleja la caída durante ráfaga).
- **Falso positivo del daemon de conexión: "dice conectado estando apagado"** (2026-07-16). Con el servidor Bun apagado, `localhost:3001` no rechaza al instante (Windows deja la conexión colgada). `BunClient.obtenerRutaServidor` hacía un `fetch` a `/api/health` **sin timeout**, así que `Conexion.verificarAhora()` (que lo espera en un `Promise.all`) nunca resolvía y el estado quedaba congelado en el último valor conocido ("conectado"). Fix: `AbortController`+timeout + `cache:"no-store"` en `obtenerRutaServidor` (mismo patrón que el chequeo de internet), y el daemon lo llama con timeout 2500ms < intervalo de sondeo (3000ms) para que los polls no se apilen. Se agregó `module.exports` a `bunClient.js` y `shared/bunClient.test.js` (regresión: un fetch colgado aborta). `bunClient.js` → v1.1.0, `conexion.js` → v1.0.1.
- **Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`** (2026-07-16). Borrado el wrapper local que solo reenviaba a `Utils.clasificarCatedraYCarpeta`; los 5 call-sites reales ya usaban `Utils.*` directo. Sin cambios de comportamiento (62/62 tests en verde). `popup.js` → v5.5.4.
- **XSS por interpolación sin escapar de título scrapeado** (2026-07-16). Nuevo helper `Utils.escaparHtml` en `shared/utils.js`; aplicado en `popup.js:renderizarListadoInterfaz` a `videoFalladoParaReintento` antes de interpolarlo en la tarjeta de error. `utils.js` → v5.7.0, `popup.js` → v5.4.2.
