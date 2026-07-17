# 0006 — Adoptar Preact (islas) en el popup, sin build

**Fecha**: 2026-07-16
**Estado**: Aceptada

> Complementa a [0001](0001-no-bundler-or-typescript-yet.md) (no lo supera): esta
> decisión **respeta** el "sin bundler" de 0001 — se eligió deliberadamente el camino
> sin transpilación (htm) para no reabrir esa decisión.

## Contexto

El popup es la superficie más UI-pesada del proyecto (tabs, filtros, onboarding, cola,
progreso, banners de conexión). Casi todos los bugs recientes fueron de **sincronización
estado↔DOM**: el estado cambiaba pero había que acordarse de re-renderizar a mano en cada
camino. Ejemplos de esta sesión:

- El puntito de estado se pintaba imperativamente desde 6 lugares distintos.
- El banner "descarga interrumpida" no se iba al reconectar porque un camino limpiaba
  `fallaConexionActiva` sin re-renderizar (popup.js v5.5.6).

El `popup.js` es un closure de ~1700 líneas sin reactividad. El desarrollador principal
es nativo de React, lo que amplifica el costo del modelo imperativo.

## Opciones consideradas

1. **React + Vite (con build).** Máxima DX conocida (JSX, HMR, `@crxjs/vite-plugin`),
   pero introduce bundler y un ciclo build→reload — reabre 0001.
2. **Preact + htm, sin build.** Preact (~4KB) con la API de React (`useState`,
   `useEffect`, componentes) + htm (sintaxis tipo-JSX vía tagged template literals que
   se parsean en runtime → sin transpilación). Se carga como ES module local.
3. **Capa reactiva casera** (store + subscribe + un `render()` manual). Cero deps, pero
   reinventa mal lo que Preact ya resuelve, y el dev no gana ergonomía conocida.
4. **Seguir vanilla disciplinado.** Sin deps, pero los bugs de desync siguen latentes.

## Decisión

Se adopta la **opción 2**: Preact + htm vendorizados como un único ES module local
(`popup/vendor/htm-preact-standalone.module.js`, build oficial `htm/preact/standalone`,
~13KB), cargado con `<script type="module">`. La migración es **incremental por islas**:
regiones de DOM acotadas pasan a Preact de a una, conviviendo con el resto vanilla.

Restricciones de alcance:

- **Sólo el popup.** El service worker y `hlsEngine` no tienen DOM; quedan vanilla.
- **El daemon `Conexion` y `AppState` siguen siendo la fuente de verdad**; las islas se
  suscriben a ellos (hook `useConexion` ≈ `useSyncExternalStore`), no los reemplazan.
- **Primera isla**: el puntito de estado del header (`features/conexionHeader.preact.js`),
  derivado puro de `Conexion`. Saca las 6 pinturas imperativas del statusDot.

Por qué no la opción 1: el ciclo build→reload es fricción real en una extensión, y
reabriría 0001 sin necesidad — htm da ~90% de la ergonomía sin transpilar.

## Consecuencias

- **Elimina la clase de bugs de desync** en las regiones migradas: la UI es `f(estado)`.
- **Conviven dos paradigmas** (islas Preact + vanilla) durante la migración. El límite de
  cada isla debe ser DOM que el vanilla NO referencie por `nodos.*` (para no dejar refs
  colgadas). Por eso se migran indicadores puros antes que controles interactivos.
- **CSP de MV3 respetado**: nada de CDN en runtime; el vendor es un archivo local.
- **Sin build**: se sigue cargando la carpeta y andando. Aparece **una** dependencia de
  runtime (antes: cero), vendorizada y acotada a la UI del popup.
- **Testeable**: los componentes se prueban aislados con Vitest + jsdom
  (`conexionHeader.preact.test.js`), incluida la reactividad.
- El `package.json` sigue siendo dev-only; Preact/htm NO se instalan por npm (van
  vendorizados), así que no hay toolchain nueva.

## Revisar cuando

- Las islas crezcan lo suficiente como para que el parsing de htm en runtime pese, o se
  necesite JSX real / type-checking sobre los componentes. Recién ahí evaluar un build
  (Vite + `@crxjs`), lo que **sí** reabriría [0001](0001-no-bundler-or-typescript-yet.md).
- Si la migración se estanca a mitad (muchas islas + mucho vanilla conviviendo sin avanzar),
  reconsiderar si conviene completar o revertir.
