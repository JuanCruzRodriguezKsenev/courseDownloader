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
| 2 | **Alerta de conexión caída** (store + vista, **sin root propio**) | dentro de `#ui-list`, la pinta la #4 | ✅ Hecha | `popup/features/bannerConexion.preact.js` (+ `.test.js`) |
| 3 | **Onboarding** (overlay del tour) | `#preact-onboarding` (antes `#ui-onboarding`) | ✅ Hecha | `popup/features/onboarding.preact.js` (+ `.test.js`) |
| 4 | **Lista de clases** (filas + cards de estado + host) | `#ui-list` (hijos y atributos) | ✅ Hecha (Etapas 0–2) | `popup/features/listaClases.preact.js` (+ `.test.js`) |
| 5 | **Campanita de fallos** (botón + badge + panel de historial) | `#preact-campanita` en el header | ✅ Hecha | `popup/features/campanita.preact.js` (+ `.test.js`) |
| — | **Capa flotante** (superficie + cierre; *no es una isla*: es un componente que las islas usan) | ninguna propia — la pinta quien la usa | ✅ Hecha (4 de 4 consumidores migrados) | `popup/features/capa.preact.js` (+ `.test.js`) |

**Notas de secuencia / riesgo:**
- **⚠️ 2 (alerta) — el root hermano se revirtió el 2026-08-12, y ésa es la lección de esta tabla.** La nota de abajo describe la solución de la migración: darle a la alerta su **propio root** (`#preact-banner`) y **apagar `#ui-list` desde el vanilla** (`setOculta`) mientras se muestra. Funcionaba, pero dejaba **dos dueños de la misma región de pantalla coordinados a mano**, y el acoplamiento se cobró exactamente lo que se esperaría: cualquiera que tocara el host —una sincronización de disco (`setAtenuada`), un cambio de pestaña (`setSelectionMode`), la reconexión— devolvía la lista **debajo** del banner. Ahora la alerta la pinta la isla #4 dentro de `#ui-list`: **un dueño del DOM, dos fuentes de estado** (su store y el de la alerta, al que la #4 se suscribe). De la #2 sobreviven su store y su vista; lo que murió es su lugar en el DOM, y con él `setOculta` como mecanismo de coordinación. La regla que queda: **si dos cosas ocupan la misma región, no se reparten el DOM — comparten contenedor y un `if` decide.** 3 tests en `listaClases.preact.test.js` lo fijan.
- **2 (banner) — ✅ hecha.** Era el caso delicado: el banner se renderizaba DENTRO de `#ui-list`, el mismo nodo que la lista de clases. Se resolvió dándole a la isla su **propio root hermano** (`#preact-banner`, `display:contents` para que la `.server-error-card` con `flex:1` siga ocupando el área como la lista) y **ocultando `#ui-list` desde el vanilla** (`display:none` + vaciado) mientras el banner está visible; al reconectar, `serverConnection` restaura la lista y la repuebla. Store-puente `window.BannerConexion` (`mostrar(tipo)` / `ocultar()` / `get()`): la visibilidad es lógica de negocio (ráfaga en curso, cola pausada, tipo de caída) que decide `reaccionarAConexion`, así que la isla NO deriva de `Conexion` directo. Los 3 usos de `querySelector('.server-error-card')` como flag pasaron a `BannerConexion.get()`. El contenido de la card (`TARJETAS_OFFLINE`) se movió a la isla; en `serverConnection` quedó `ESTADO_OFFLINE` (texto del footer + botón). La lista completa se migra en la #4; hasta entonces convive como nodo vanilla contiguo.
- **1b (texto de la ruta) — ✅ hecha.** Primera isla que NO deriva de `Conexion`: la ruta del disco la resuelve `BunClient`, así que la isla tiene su propio **store-puente** `window.RutaDisco` (`mostrar(texto,titulo)` / `cargando(texto)` para el spinner transitorio / `get()`). Los ~7 lugares que escribían `nodos.pcPath.textContent`/`.title`/`.classList` (en `popup.js` y `serverConnection.js`) ahora empujan a ese store; se quitó `nodos.pcPath`. **Límite acotado a propósito:** la isla posee sólo el **texto** (`#preact-pc-path`), no la `.path-bar` entera — el `<section>` contiene el botón "Explorar" y el input de materia (interactivos, vanilla) y el toggle de la clase `.path-bar.offline`, que por eso **sigue vanilla** (3 call-sites). Migrar el toggle exigiría migrar también esos interactivos.
- **3 (onboarding) — ✅ hecha.** Era la feature más aislada (overlay propio, sin compartir DOM) y ya tenía tests, así que fue el candidato de bajo riesgo. Puente vanilla↔isla vía `window.OnboardingFeature.crear({ btnHelp, onExplore, onComplete })` (misma firma que la feature vanilla que reemplazó): un store local guarda apertura/carrusel/callbacks y `popup.js` sólo dispara `mostrarOnboarding()`. El **estado del servidor** del slide de la carpeta ya no se empuja imperativamente — la isla lo **deriva** de `Conexion` con `useConexion()` (reusado de la isla #1), por lo que desapareció el sink `actualizarEstadoServidorOnboarding` que `serverConnection.js` empujaba en cada transición (se borró también su tracking `previoServidor`). El botón de ayuda vive en el header (fuera de la isla) → lo cablea el puente. **Desde la Fase 6c su copy es genérico**: el nombre del portal y su eje de clasificación salen de `PuertoSitio` (`nombre`, `faceta.etiqueta`), no hardcodeados — era la última isla que nombraba a Ramón Net.
- **4 (lista/tabs/filtros) — la más grande, se hace por etapas.** Ahora que el banner ya no comparte `#ui-list`, la lista de clases es dueña única de ese nodo. Es la isla más grande (render de tarjetas, selección múltiple, filtros, cola).
  - **Etapa 0 — hecha (vanilla, `popup.js` v5.8.3).** Prep que de-riesga la migración: el render de la lista pasó a ser *función pura del estado*, sin refs imperativas al DOM de las filas. El handler de `masterCheck` ya no sincroniza cada checkbox por `getElementById('chk-...')` + `classList.toggle('selected')`; muta sólo el estado (`seleccionado`/`conmutarSeleccionMasiva`) y re-renderiza. `onRemoverClick` reemplazó `div.remove()` por `renderizarListadoInterfaz()`. `onCheckChange` sigue con su `div` local (se reemplaza por reactividad Preact en la Etapa 1).
  - **Etapa 1 — hecha (`listaClases.preact.js` v1.0.0, `popup.js` v5.9.0).** Isla `<ListaClases>` + store `window.ListaClases`: `renderizarListadoInterfaz` ya no construye DOM — mantiene la lógica (sincronizar cola, filtrar, ordenar) y empuja un view-model discriminado (`{modo:'card',card}` / `{modo:'lista',items,ctx}`). `construirFilaClaseDOM`→`<FilaClase>` y `renderizarTarjetaEstado`→`<TarjetaEstado>` (port 1:1). `onCheckChange` pasó a `(clase,checked)` y re-empuja el vm; el post-proceso por fila (atenuar/deshabilitar sin sincronizar) y `selectionMode` viajan en el vm. La card de escaneo "sin enlaces" también empuja al store. AppState sigue siendo la fuente de verdad. `renderers.js` `construirFilaClaseDOM`/`renderizarTarjetaEstado` quedaron como **referencia muerta** (ya eliminados, `renderers.js` v5.2.0); `pintarTelemetria` sigue vivo. 7 tests en `listaClases.preact.test.js`.
  - **Etapa 2 — hecha (`listaClases.preact.js` v1.1.0, `popup.js` v5.10.0, `serverConnection.js` v1.10.0).** La isla es dueña también de los **atributos del host** `#ui-list`, con setters propios en el store (`window.ListaClases`): `setSelectionMode(bool)` (antes `actualizarModoSeleccion` mutaba `nodos.lista.classList`), `setAtenuada(bool)` (opacidad durante la sincronización de disco, antes `nodos.lista.style.opacity`), y `setOculta(bool)` (visibilidad mientras el banner ocupa el lugar de la lista). Un `useEffect` refleja esos flags sobre el nodo real sin tocar el CSS (sigue keyeando sobre `#ui-list.list-wrapper`). El punto delicado —`serverConnection` hacía `innerHTML="" + display:none` sobre `#ui-list`, borrando el DOM que Preact gestiona— se resolvió con `setOculta`: la isla devuelve `null`, así **Preact** quita los hijos y su vdom no se desincroniza. Se quitó `nodos.lista`. **Excepción:** la card de fallo de conexión que pinta `renderizarListadoInterfaz` NO se eliminó — resultó **viva**, no muerta: para el caso "descarga interrumpida" (`AppState.fallaConexionActiva`), `reaccionarAConexion` retorna temprano SIN ocultar `#ui-list`, así que esa card es el indicador visible. +3 tests de host en `listaClases.preact.test.js` (10 total); `serverConnection.test.js` actualizado (asserts de `ListaClases.setOculta`). El adelgazamiento restante de `popup.js` (extraer `filters.js`, etc.) va aparte, en la Fase 2 del ROADMAP.
- **5 (campanita de fallos) — ✅ hecha.** Primera isla cuyo store-puente NO es un `window.X` efímero del popup, sino un **módulo compartido con el SW**: `core/historial/historialFallos.ts`, respaldado en `chrome.storage.local` (clave `historialFallos`) y espejado vía `storage.onChanged`. El motivo es que el **escritor principal es el service worker** (`background.js` `registrarFallo`), típicamente con el popup CERRADO, así que la fuente de verdad debe vivir fuera del popup (a diferencia de `BannerConexion`/`RutaDisco`, estado efímero que sólo existe mientras el popup está abierto). El hook `useHistorialFallos()` se suscribe y vuelve a pedir `obtener()` en cada señal (sin espejo en memoria; el storage es la única verdad). La isla es aditiva: no reemplaza los handlers IPC `clase_con_error`/`cola_pausada_por_error` de `popup.js` (que siguen pintando la UI inline cuando el popup está abierto), sólo suma el canal persistente. Título/motivo (texto scrapeado) se interpolan como **texto plano** (regla anti-XSS). 8 tests en `campanita.preact.test.js`. Ver `docs/notificaciones-fallos-diseno.md`.

### La capa flotante compartida (`capa.preact.js`) — 2026-08-13

**No es una isla**, y la distinción importa: no posee ninguna región del DOM ni deriva de ningún
store. Es un **componente** que las islas usan adentro de su propio root, así que no le aplica la
regla del límite de DOM que gobierna la tabla de arriba.

Nació de medir la duplicación: `.adv-overlay` y `.faceta-overlay` son **idénticos línea por
línea** (inset 0, `--bg-overlay`, `blur(8px)`, flex centrado, `z-index: 9999999`,
`fadeIn-modal 0.25s`); `.onboarding-overlay` es el mismo con otro blur; y las cards sólo difieren
en padding, `max-width` y el tamaño del `h4`. En JS, `mostrarModalAdvertencia` (`popup.js`) y
`mostrarModal` (`faceta.js`) repiten la misma secuencia con distinto nombre.

**Dos variantes, porque son dos cosas distintas:**

- `modal` — tapa y centra. Para lo que **pide algo**: elegí una cátedra, Entendido/Cancelar, el tour.
- `anclado` — la misma superficie, junto a quien la abrió, sin tapar. Para lo que **sólo
  informa**. El historial de fallos quedó acá a propósito: lo que hacés después de leer un fallo
  es buscar esa clase en la lista, y un modal te la esconde.

**Lo que ganaron los cuatro, y ninguno tenía: cierre con Escape y con clic afuera**, más
`role="dialog"`/`aria-modal`. No había un solo `keydown` para esto en el proyecto.

**Reparto de responsabilidades**: el componente pone la superficie y el cierre; **dónde se apoya
y cuánto mide lo pone el consumidor** en su hoja. Si las medidas vivieran en `capa.css`, ese
archivo tendría que conocer a cada uno — justo lo que se está deshaciendo.

**El `contenedorRef` no es opcional en la variante anclada**, y es el caso que más costó: el
disparador vive FUERA de la card, así que sin el ref un clic en él cuenta como "afuera", se
cierra por ahí y el `onClick` del botón lo reabre. El panel no se cierra nunca y parece que el
botón está roto. Hay un test para eso.

**Los cuatro consumidores están migrados** (2026-08-13): campanita (`anclado`), onboarding,
asistente de faceta y modal de advertencia (`modal`).

Los dos últimos son DOM vanilla armado a mano, así que entran por **`abrirCapa`**, el puente
imperativo del mismo módulo: monta su propio root, lo saca al cerrar, y le pasa `cerrar` al
contenido para que los botones de adentro no tengan que guardarse la referencia. Sin ese puente
había que migrar `popup.js` y `faceta.js` enteros a Preact en el mismo corte — cambiarle el
mundo a un módulo es mucho más grande que compartirle la superficie.

**Lo que se llevó puesto de paso**: el modal de advertencia interpolaba en un
`card.innerHTML = \`<h4>${titulo}</h4>…\``. Hoy los dos valores son literales del archivo, así
que no había un XSS real — pero era la línea que se vuelve uno el día que alguien le pase un
título de clase. Con htm van escapados y no puede volver por ahí.

**El foco queda atrapado en la variante `modal`** (2026-08-13): al abrir entra al primer control,
el Tab cicla en los dos extremos y al cerrar vuelve a quien lo tenía. Sin eso, con el modal en
pantalla el Tab seguía recorriendo el buscador y los filtros de abajo — invisibles y muertos —, y
el foco desaparecía de la vista sin ninguna señal. **La variante `anclado` NO atrapa a propósito**:
no tapa nada, así que salir de ella con Tab es legítimo; encerrar el foco en algo que no bloquea
es encerrar al usuario sin motivo.

> **Y eso destapó algo del tour**: sus 6 slides existen todas a la vez (el carrusel las desplaza
> con `translateX` y el wrapper recorta con `overflow: hidden`), así que las que no ves siguen
> siendo enfocables — hay un `<a>` en la 2 y un `<button>` en la 5. Ahora las inactivas llevan
> **`inert`**, que saca el subárbol entero del foco, del clic y del árbol de accesibilidad; con
> `tabindex="-1"` habría que acordarse de cada control nuevo que entre a una slide. Ojo con el
> `|| undefined` en el atributo: `inert={false}` lo dejaría puesto igual.

**Y una diferencia de conducta que hay que conocer**: ahora Escape y el clic al fondo **cierran**
la advertencia, y eso equivale a **Cancelar** — el modal distingue "lo cerró un botón" de "lo
descartaron", porque si no, salir por Escape dejaría al llamador esperando una respuesta que
nunca llega. El onboarding, en cambio, lleva `cerrarPorFondo={false}`: se muestra una sola vez y
un clic al fondo lo cerraría para siempre.

## Cómo agregar una isla nueva (receta)

1. **Elegí un límite de DOM** que el vanilla NO referencie por `nodos.*` (si `popup.js`/una feature hace `nodos.X` sobre ese nodo, migrá también esa lógica o elegí otro límite — si no, quedan refs colgadas al re-renderizar).
2. En `popup.html`: reemplazá el markup estático por un punto de montaje (`<span id="preact-<algo>" style="display:contents"></span>` si no debe afectar el layout).
3. Creá `popup/features/<algo>.preact.js`: importá `{ html, render, useState, useEffect }` de `../vendor/htm-preact-standalone.module.js`, escribí el/los componente(s), y montá con guarda (`if (root && window.<fuente>) render(...)`). Exportá los componentes para poder testearlos.
4. En `popup.html`: sumá `<script type="module" src="features/<algo>.preact.js"></script>` al final.
5. **Sacá la manipulación imperativa** de ese DOM del código vanilla (borrá las escrituras a `nodos.*`, y la entrada en el mapa `nodos` si el nodo ya no existe). Bumpeá la versión de los archivos tocados.
6. **Tests** (`<algo>.preact.test.js`, `@vitest-environment jsdom`): render según estado + reactividad. Para flushear los `useEffect` de Preact (que se agendan vía rAF), esperá varios ciclos: `for (i<6) await new Promise(r=>setTimeout(r,16))`.
7. Actualizá la tabla de arriba y, si aplica, `docs/architecture.md` / `docs/patterns.md`.

## `useEffect` vs `useLayoutEffect`: la regla es la GEOMETRÍA

**Un efecto que cambia el tamaño, el marco o el `display` de una región va en `useLayoutEffect`.
Nunca en `useEffect`.** Los que sólo se suscriben a un store o disparan trabajo asíncrono se
quedan en `useEffect`.

En Preact `useEffect` se agenda por `requestAnimationFrame`, o sea que corre **después del
paint**. Si el efecto es el que le pone la clase al nodo host —como hace `listaClases` con
`sin-marco`, la opacidad y el `display` sobre `#ui-list`— el navegador pinta un frame con el
contenido nuevo adentro del marco viejo.

**Cómo se vio cuando pasó** (2026-08-12): al reemplazar la lista por una tarjeta, ese frame
intermedio mostraba la card ya puesta pero `#ui-list` con la geometría de la lista —su padding,
su borde y **la barra de scroll de la lista larga**—. Se leyó como "la barra tarda en
desaparecer", y mandó a buscar el problema al CSS del scroll, que no tenía nada que ver.

`useLayoutEffect` corre en el commit, antes de pintar: el contenido y el marco de su región
entran juntos.

**Y el corolario para los tests**: el paso 6 de la receta dice que hay que flushear los
`useEffect` esperando varios ciclos de rAF. Los `useLayoutEffect` **no** necesitan eso —ya
corrieron cuando `render()` volvió—, así que un test que sólo mira atributos del host puede
afirmar sincrónicamente.

## Referencias

- Decisión y trade-offs: `docs/adr/0006-adopt-preact-islands-in-popup.md`.
- Prueba de concepto aislada (la feature de conexión entera en Preact): `prototype/preact-serverConnection/` (branch `feat/migracion-popup-preact`).
- Patrón resumido: `docs/patterns.md` → "Islas Preact".
- Futuro de estas islas bajo la re-arquitectura (partición en componentes genéricos vs. de sitio, CSS co-locado por componente, `@testing-library/preact`): `docs/rearquitectura-diseno.md` §UI. No cambia nada de lo de arriba mientras esa migración no arranque.
