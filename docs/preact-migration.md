# Migración del popup a Preact (islas, sin build)

Estado vivo de la migración incremental de la UI del popup a Preact. La *decisión* y su
justificación están en `docs/adr/0006-adopt-preact-islands-in-popup.md`; este documento es
el **mapa de avance**: qué isla está hecha, cuál sigue, y cómo agregar una nueva.

> **Regla de oro**: Preact es sólo para la UI del **popup**. El service worker
> (`background.js`, `hlsEngine.js`) no tiene DOM y queda vanilla. La fuente de verdad
> sigue siendo el daemon `Conexion` / `AppState` / `SessionState`; las islas se
> **suscriben**, no reemplazan el estado.

## Cómo funciona (sin bundler)

- Preact + hooks + htm están vendorizados en **un** archivo: `popup/vendor/htm-preact-standalone.module.js` (build oficial `htm/preact/standalone`, ~13KB). **No** se instala por npm; se actualiza bajándolo de `https://unpkg.com/htm/preact/standalone.module.js`.
- Cada isla es un `popup/features/<nombre>.preact.js` cargado en `popup/popup.html` con `<script type="module">`, **después** de los scripts clásicos (así `window.Conexion`, `window.AppState`, etc. ya existen).
- `htm` da sintaxis tipo-JSX vía tagged template literals (`` html`<${Comp}/>` ``) que se parsea en runtime → **sin transpilación, sin build**.
- Puente al estado: el hook `useConexion()` (en `conexionHeader.preact.js`) se suscribe al daemon y re-renderiza en cada cambio. Es el patrón a reusar para futuras islas (equivalente a `useSyncExternalStore`).

## Estado de las islas

| # | Isla | Región DOM | Estado | Archivo |
|---|---|---|---|---|
| 1 | **StatusDot** (puntito de conexión) | `#preact-status-dot` en el header | ✅ Hecha | `popup/features/conexionHeader.preact.js` (+ `.test.js`) |
| 1b | **Texto de la ruta** (`pcPath`) | `#preact-pc-path` (fila `📁 PC:`) | ✅ Hecha | `popup/features/rutaDisco.preact.js` (+ `.test.js`) |
| 2 | **Banner de conexión caída** | `#preact-banner` (hermano de `#ui-list`) | ✅ Hecha | `popup/features/bannerConexion.preact.js` (+ `.test.js`) |
| 3 | **Onboarding** (overlay del tour) | `#preact-onboarding` (antes `#ui-onboarding`) | ✅ Hecha | `popup/features/onboarding.preact.js` (+ `.test.js`) |
| 4 | **Tabs / filtros / cola / lista** | cuerpo del popup (`#ui-list`) | 🟡 Etapa 0 hecha (prep vanilla); Preact pendiente | `popup.js` (render state-driven) |

**Notas de secuencia / riesgo:**
- **2 (banner) — ✅ hecha.** Era el caso delicado: el banner se renderizaba DENTRO de `#ui-list`, el mismo nodo que la lista de clases. Se resolvió dándole a la isla su **propio root hermano** (`#preact-banner`, `display:contents` para que la `.server-error-card` con `flex:1` siga ocupando el área como la lista) y **ocultando `#ui-list` desde el vanilla** (`display:none` + vaciado) mientras el banner está visible; al reconectar, `serverConnection` restaura la lista y la repuebla. Store-puente `window.BannerConexion` (`mostrar(tipo)` / `ocultar()` / `get()`): la visibilidad es lógica de negocio (ráfaga en curso, cola pausada, tipo de caída) que decide `reaccionarAConexion`, así que la isla NO deriva de `Conexion` directo. Los 3 usos de `querySelector('.server-error-card')` como flag pasaron a `BannerConexion.get()`. El contenido de la card (`TARJETAS_OFFLINE`) se movió a la isla; en `serverConnection` quedó `ESTADO_OFFLINE` (texto del footer + botón). La lista completa se migra en la #4; hasta entonces convive como nodo vanilla contiguo.
- **1b (texto de la ruta) — ✅ hecha.** Primera isla que NO deriva de `Conexion`: la ruta del disco la resuelve `BunClient`, así que la isla tiene su propio **store-puente** `window.RutaDisco` (`mostrar(texto,titulo)` / `cargando(texto)` para el spinner transitorio / `get()`). Los ~7 lugares que escribían `nodos.pcPath.textContent`/`.title`/`.classList` (en `popup.js` y `serverConnection.js`) ahora empujan a ese store; se quitó `nodos.pcPath`. **Límite acotado a propósito:** la isla posee sólo el **texto** (`#preact-pc-path`), no la `.path-bar` entera — el `<section>` contiene el botón "Explorar" y el input de materia (interactivos, vanilla) y el toggle de la clase `.path-bar.offline`, que por eso **sigue vanilla** (3 call-sites). Migrar el toggle exigiría migrar también esos interactivos.
- **3 (onboarding) — ✅ hecha.** Era la feature más aislada (overlay propio, sin compartir DOM) y ya tenía tests, así que fue el candidato de bajo riesgo. Puente vanilla↔isla vía `window.OnboardingFeature.crear({ btnHelp, onExplore, onComplete })` (misma firma que la feature vanilla que reemplazó): un store local guarda apertura/carrusel/callbacks y `popup.js` sólo dispara `mostrarOnboarding()`. El **estado del servidor** del slide de la carpeta ya no se empuja imperativamente — la isla lo **deriva** de `Conexion` con `useConexion()` (reusado de la isla #1), por lo que desapareció el sink `actualizarEstadoServidorOnboarding` que `serverConnection.js` empujaba en cada transición (se borró también su tracking `previoServidor`). El botón de ayuda vive en el header (fuera de la isla) → lo cablea el puente.
- **4 (lista/tabs/filtros) — la más grande, se hace por etapas.** Ahora que el banner ya no comparte `#ui-list`, la lista de clases es dueña única de ese nodo. Es la isla más grande (render de tarjetas, selección múltiple, filtros, cola).
  - **Etapa 0 — hecha (vanilla, `popup.js` v5.8.3).** Prep que de-riesga la migración: el render de la lista pasó a ser *función pura del estado*, sin refs imperativas al DOM de las filas. El handler de `masterCheck` ya no sincroniza cada checkbox por `getElementById('chk-...')` + `classList.toggle('selected')`; muta sólo el estado (`seleccionado`/`conmutarSeleccionMasiva`) y re-renderiza. `onRemoverClick` reemplazó `div.remove()` por `renderizarListadoInterfaz()`. `onCheckChange` sigue con su `div` local (se reemplaza por reactividad Preact en la Etapa 1).
  - **Etapa 1 — pendiente.** Isla `<ListaClases>` + store `window.ListaClases`: `renderizarListadoInterfaz` calcula un view-model y lo empuja al store; `construirFilaClaseDOM`/`renderizarTarjetaEstado` (`renderers.js`) pasan a componentes Preact. Callbacks `onCheckChange`/`onRemoverClick` por el store.
  - **Etapa 2 — pendiente.** Mover `.selection-mode` y `.style.opacity` a props de la isla; reconciliar el toggle `display` de `#ui-list` que hace `serverConnection` (banner) con que la lista sea isla; verificar/eliminar la card de fallo de conexión que aún pinta `renderizarListadoInterfaz` (probablemente muerta: la isla #2 ya la muestra en su root y `serverConnection` oculta `#ui-list`); quitar `nodos.lista`; adelgazar `popup.js`.

## Cómo agregar una isla nueva (receta)

1. **Elegí un límite de DOM** que el vanilla NO referencie por `nodos.*` (si `popup.js`/una feature hace `nodos.X` sobre ese nodo, migrá también esa lógica o elegí otro límite — si no, quedan refs colgadas al re-renderizar).
2. En `popup.html`: reemplazá el markup estático por un punto de montaje (`<span id="preact-<algo>" style="display:contents"></span>` si no debe afectar el layout).
3. Creá `popup/features/<algo>.preact.js`: importá `{ html, render, useState, useEffect }` de `../vendor/htm-preact-standalone.module.js`, escribí el/los componente(s), y montá con guarda (`if (root && window.<fuente>) render(...)`). Exportá los componentes para poder testearlos.
4. En `popup.html`: sumá `<script type="module" src="features/<algo>.preact.js"></script>` al final.
5. **Sacá la manipulación imperativa** de ese DOM del código vanilla (borrá las escrituras a `nodos.*`, y la entrada en el mapa `nodos` si el nodo ya no existe). Bumpeá la versión de los archivos tocados.
6. **Tests** (`<algo>.preact.test.js`, `@vitest-environment jsdom`): render según estado + reactividad. Para flushear los `useEffect` de Preact (que se agendan vía rAF), esperá varios ciclos: `for (i<6) await new Promise(r=>setTimeout(r,16))`.
7. Actualizá la tabla de arriba y, si aplica, `docs/architecture.md` / `docs/patterns.md`.

## Referencias

- Decisión y trade-offs: `docs/adr/0006-adopt-preact-islands-in-popup.md`.
- Prueba de concepto aislada (la feature de conexión entera en Preact): `prototype/preact-serverConnection/` (branch `feat/migracion-popup-preact`).
- Patrón resumido: `docs/patterns.md` → "Islas Preact".
