# Deuda técnica — RamonNet Video Downloader

Inventario vivo de problemas conocidos en el código actual, ordenados por severidad. Cada ítem indica ubicación exacta, impacto y la solución propuesta. Este documento se actualiza a medida que se resuelven o aparecen nuevos hallazgos — no es un snapshot histórico (para eso está el changelog de cada archivo y el historial de git).

Última auditoría: 2026-07-16.

---

## 🔴 Seguridad

### XSS por interpolación sin escapar de título scrapeado

- **Dónde**: `popup.js:1012` y `popup.js:1019`, dentro de `renderizarListadoInterfaz()`.
- **Qué pasa**: `AppState.videoFalladoParaReintento` (que proviene de `SW_ESTADOS_PROGRESO.videoActual` en el service worker, que a su vez proviene del scraping del DOM de Ramón Net vía `popup/scraper.js`) se interpola sin escapar dentro de un template string HTML:
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
- **Estado**: 🟡 parcial. Ya extraídos `popup/features/onboarding.js` y `popup/features/serverConnection.js` (este último apoyado en el nuevo daemon `shared/conexion.js`, que absorbió los flags de monitoreo `intervalReconexion`/`comprobacionEnProgreso` que antes vivían sueltos acá). Pendientes: `filters.js` y `queue.js`, más adelgazar `popup.js` a init + wiring. Fue lo que bajó el archivo de 1910 → 1710 líneas.

### `background.js` — listener IPC monolítico

- **Dónde**: `background.js:143-356`, `chrome.runtime.onMessage.addListener`.
- **Qué pasa**: mismo patrón que `popup.js` pero a menor escala — un único listener con un bloque `if (request.action === "...")` por cada una de las 8 acciones soportadas.
- **Impacto**: menor que en `popup.js` porque cada bloque es relativamente autocontenido, pero sigue siendo difícil de testear sin mockear `chrome.runtime.onMessage`.
- **Fix propuesto**: si se toca este archivo para otra tarea, extraer cada acción a una función nombrada en un dict `{accion: handler}` y despachar por lookup en vez de cadena de `if`.
- **Estado**: 🔲 pendiente, prioridad baja.

### Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`

- **Dónde**: `popup.js:1372-1374`.
- **Qué pasa**: define una función local que solo llama a `Utils.clasificarCatedraYCarpeta`. Los 5 call-sites reales (`popup.js:561`, `:831`, `:932`, `:1250`, `:1630`) llaman directo a `Utils.clasificarCatedraYCarpeta`, ignorando el wrapper.
- **Fix propuesto**: borrar `popup.js:1372-1374`.
- **Estado**: ✅ resuelto (2026-07-16). Wrapper eliminado; los 5 call-sites ya llamaban directo a `Utils.clasificarCatedraYCarpeta`. `popup.js` → v5.5.4. Ver sección Resuelto.

### `styles/components.css` (1261 líneas en un solo archivo)

- **Dónde**: `styles/components.css`.
- **Impacto**: bajo — no es un problema funcional, solo dificulta ubicar reglas específicas a medida que crece.
- **Fix propuesto**: dividir por componente (`components/onboarding.css`, `components/queue.css`, etc.) si el archivo sigue creciendo. No urgente.
- **Estado**: 🔲 pendiente, prioridad muy baja.

---

## 🟡 Testing

### Cobertura de tests: parcial

- **Qué pasa**: ya hay `package.json` + Vitest/jsdom. Cubiertos: `shared/utils.js` (funciones puras), `shared/conexion.js` (daemon de conexión), y las features extraídas `popup/features/onboarding.js` y `popup/features/serverConnection.js`. Sigue sin cobertura: `background.js`, `background/hlsEngine.js` (requieren mocks de `chrome.*`) y el resto de `popup.js` (bloqueado por el split de Fase 2).
- **Impacto**: la lógica pura de utils, el daemon de conexión y las features ya extraídas tienen red de regresión; el motor HLS y la orquestación restante de UI siguen dependiendo de pruebas manuales.
- **Fix propuesto**: ver `docs/ROADMAP.md` — continuar con `hlsEngine.js`/`background.js` (mocks de `chrome.*`) y el resto de `popup.js` post-split.
- **Estado**: 🟡 parcial — `shared/utils.js`, `shared/conexion.js`, `onboarding.js` y `serverConnection.js` cubiertos; `background.js`/`hlsEngine.js` y el resto de `popup.js` pendientes.

---

## 🟡 Robustez del flujo de datos

### Optimistic update sin rollback en `encolarItemsEnCaliente`

- **Dónde**: `encolarItemsEnCaliente` en `popup.js:785` (el `sendMessage` sin verificar, en `popup.js:815`).
- **Qué pasa**: la función actualiza `AppState.colaDescargas` y el DOM de inmediato (patrón optimistic update), y recién después dispara `chrome.runtime.sendMessage({ action: "inyectar_items_en_cola_activa", ... })` sin `.then`/`.catch` ni verificar la respuesta.
- **Impacto**: si el mensaje falla (SW dormido, error de storage), la UI queda mostrando ítems como "en cola" que en realidad nunca se persistieron en `background.js`, generando un estado inconsistente entre popup y service worker hasta el próximo `sincronizarConBackground()`.
- **Fix propuesto**: verificar la respuesta de `sendMessage` (usar el patrón callback/promise con manejo de `chrome.runtime.lastError` que ya usan en otras partes del código, ej. `state.js:66-68`) y revertir `AppState.colaDescargas` + re-render si falla.
- **Estado**: 🔲 pendiente.

### Escrituras no-atómicas a `chrome.storage.local`

- **Dónde**: varios puntos de `background.js` que leen y escriben `listaPersistente`, `colaDescargas` y `SW_ESTADOS_PROGRESO` como operaciones `.get()`/`.set()` separadas para el mismo cambio lógico.
- **Qué pasa**: `chrome.storage.local` no ofrece transacciones — si el service worker se suspende o falla entre un `.set()` y el siguiente, esas claves relacionadas pueden quedar desincronizadas entre sí.
- **Impacto**: riesgo de estado inconsistente (ej. un ítem marcado `process` en `SW_ESTADOS_PROGRESO` pero ya removido de `colaDescargas`). Bajo en la práctica porque el SW suele completar estas operaciones síncronamente dentro del mismo tick, pero no está garantizado.
- **Fix propuesto**: auditar y consolidar en un único `.set({...})` por operación lógica cuando se tocan varias claves relacionadas. El patrón correcto ya existe en `background.js:216-239` (`inyectar_items_en_cola_activa`: un `.get()` de las tres claves seguido de un único `.set({...})`) — usarlo como referencia para homogeneizar el resto.
- **Estado**: 🔲 pendiente, prioridad media.

---

## 🟢 Menores / de proceso

| Ítem | Ubicación | Impacto | Estado |
|---|---|---|---|
| Sin linter (ESLint) configurado | proyecto completo | No se detectan variables no usadas, `==` vs `===`, código muerto adicional | 🔲 pendiente |
| `catch (e) {}` silenciosos (3 casos) | `background.js:147`, `background.js:325` y `background/hlsEngine.js:219` (los dos últimos, `abort()` del controlador de gráfico activo) | Dificulta debug si falla el abort/limpieza de recursos | ✅ resuelto (2026-07-17) — ahora `console.warn` con contexto |
| URL de backend hardcodeada | `shared/bunClient.js:8` (`baseUrl = "http://localhost:3001"`) | No se puede apuntar a otro host/puerto sin editar código; relevante si se agregan tests de integración contra el backend real | 🔲 pendiente, bajo impacto |

---

## Resuelto

- **`catch (e) {}` silenciosos (3 casos)** (2026-07-17). Los tres catch vacíos ahora dejan rastro con `console.warn` + contexto: el cierre del documento offscreen (`background.js`, puede fallar de forma esperada si no había documento abierto) y los dos `abort()` de limpieza del controlador de gráfico activo (`background.js` en el fin de ráfaga, `hlsEngine.js` ante fallo de fragmento — un fallo del abort acá es inesperado y ahora es visible). `background.js` → v5.6.2, `hlsEngine.js` → v1.0.1. (Sin test unitario: ambos dependen de `chrome.*`/estado del SW, fuera del alcance de testing actual — ver Testing.)
- **El banner de "descarga interrumpida" no se iba al reconectar el servidor (hasta refrescar el popup)** (2026-07-16). Al volver el server, `reaccionarAConexion` → `onReintentarCola` → `ejecutarReintentoDeCola` ponía `AppState.fallaConexionActiva = null` sin re-renderizar. La única limpieza real del banner vive en el handler `update_progress_bar`, pero (a) su rama de limpieza está gateada a `if (AppState.fallaConexionActiva)` — ya en null — y (b) su re-render está gateado a que cambie el título, que no cambia porque se reanuda el mismo video. La descarga avanzaba en el SW pero el popup quedaba pegado en el banner. Fix: `ejecutarReintentoDeCola` restaura el panel de descarga (`cancelBox`/`progressCont`) y llama `renderizarListadoInterfaz()` al reanudar. `popup.js` → v5.5.6. Nota relacionada: `reanudarColaDesdeBackground` (autoheal del SW) reanuda sin avisar al popup — la limpieza del banner depende de la ruta del popup o del primer `update_progress_bar`.
- **El banner de "descarga interrumpida" no se disparaba al caer el servidor durante una descarga** (2026-07-16). La clasificación de fin de descarga en `background.js` (~línea 534) tomaba `controladorGraficoActivo.signal.aborted` y `errDescarga.name==='AbortError'` como señales de cancelación del usuario. Pero el motor HLS aborta ese controlador A PROPÓSITO para frenar a los otros workers cuando un fragmento falla (server caído), y ese abort hace que los fetches hermanos rechacen con `AbortError`. Resultado: la caída se confundía con cancelación, el SW retornaba sin pausar la cola, y nunca enviaba `cola_pausada_por_error` → el popup no mostraba el banner. Fix: la clasificación usa SÓLO el flag explícito `state.abortadoPorUsuario`. `background.js` → v5.6.1. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance de testing actual — ver Testing.)
- **Indicador verde para siempre si el servidor cae durante una descarga** (2026-07-16). Dos capas: (1) `enviarFragmentoStream` (`bunClient.js`) no tenía timeout, así que al morir el Bun a mitad de descarga el POST a `/api/bypass-stream` se colgaba, el loop del SW nunca fallaba y nunca pausaba la cola ni marcaba la caída; (2) aun detectándola, el popup ignora al daemon durante una ráfaga (`reaccionarAConexion` abortaba en la guarda `ráfagaEnCurso`), dejando el puntito verde. Fix: timeout de 30s en `enviarFragmentoStream` que lanza un Error de "backend" (NO `AbortError` — el SW lo trata como cancelación de usuario) para que la cola se pause; y `pintarStatusDot` se movió ANTES de la guarda para que el indicador refleje la conexión SIEMPRE (level-triggered), sin tocar el banner/lista durante la descarga. `bunClient.js` → v1.2.0, `serverConnection.js` → v1.5.0. Tests nuevos en `bunClient.test.js` (timeout ≠ AbortError; abort de usuario se propaga) y `serverConnection.test.js` (puntito refleja la caída durante ráfaga).
- **Falso positivo del daemon de conexión: "dice conectado estando apagado"** (2026-07-16). Con el servidor Bun apagado, `localhost:3001` no rechaza al instante (Windows deja la conexión colgada). `BunClient.obtenerRutaServidor` hacía un `fetch` a `/api/health` **sin timeout**, así que `Conexion.verificarAhora()` (que lo espera en un `Promise.all`) nunca resolvía y el estado quedaba congelado en el último valor conocido ("conectado"). Fix: `AbortController`+timeout + `cache:"no-store"` en `obtenerRutaServidor` (mismo patrón que el chequeo de internet), y el daemon lo llama con timeout 2500ms < intervalo de sondeo (3000ms) para que los polls no se apilen. Se agregó `module.exports` a `bunClient.js` y `shared/bunClient.test.js` (regresión: un fetch colgado aborta). `bunClient.js` → v1.1.0, `conexion.js` → v1.0.1.
- **Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`** (2026-07-16). Borrado el wrapper local que solo reenviaba a `Utils.clasificarCatedraYCarpeta`; los 5 call-sites reales ya usaban `Utils.*` directo. Sin cambios de comportamiento (62/62 tests en verde). `popup.js` → v5.5.4.
- **XSS por interpolación sin escapar de título scrapeado** (2026-07-16). Nuevo helper `Utils.escaparHtml` en `shared/utils.js`; aplicado en `popup.js:renderizarListadoInterfaz` a `videoFalladoParaReintento` antes de interpolarlo en la tarjeta de error. `utils.js` → v5.7.0, `popup.js` → v5.4.2.
