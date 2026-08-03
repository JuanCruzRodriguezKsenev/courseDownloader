# Testing

**Estado actual: suite real y en crecimiento** (los números exactos, en la tabla de baseline de abajo). Existe `package.json` con Vitest + jsdom como devDependencies. Cubierto hoy: la lógica pura (`shared/utils.js`), el daemon de conexión (`shared/conexion.ts` — desde la Fase 5b sin mocks de `chrome.*`: dos instancias reales sobre `AlmacenamientoEnMemoria` ejercitan el espejado popup↔SW de verdad), el cliente del backend (`core/backend/bunClient.ts`, primer test en TypeScript), el historial de fallos (`core/historial/historialFallos.ts`, ya sin mocks de `chrome.*`: usa el adaptador en memoria del puerto), la maquinaria de estado del popup (`shared/state.ts` — **estrenó cobertura en la Fase 5b**: antes tenía cero, porque los tests del popup mockean `globalThis.AppState` entero y nunca la ejercitaban; hoy corre contra `AlmacenamientoEnMemoria`, salvo `sincronizarConBackground` que sigue stubeando `chrome.runtime` por ser IPC), las features/islas del popup ya extraídas (`popup/features/serverConnection.js`, `queue.js`, `filters.js`, `faceta.js`, y las islas Preact `conexionHeader`/`onboarding`/`rutaDisco`/`bannerConexion`/`listaClases`/`campanita`), y de `background/hlsEngine.js` tanto las funciones puras (parseo/resolución M3U8) como el **pool de 6 workers** `compilarTranscodificacionStream` (concurrencia, AES, streaming turbo/blob, aborts en cascada, y el path de reintento 4xx del bug 400), más los handlers IPC de `background.js` (vía un harness que mockea `chrome.*`). Lo que todavía falta cubrir es el núcleo de `popup.js` aún sin extraer (init + wiring + orquestación de scraping/render) y el bucle de descarga `procesarSiguienteElementoDeLaCola` + la máquina de auto-heal del SW — por diseño quedan a la verificación manual/e2e (ver `docs/contributing.md`).

## Baseline de las verificaciones

**Este doc es el hogar canónico de estos números** (convención DRY, ver `docs/adr/0007-dry-docs-canonical-homes.md`): `CLAUDE.md` y el resto apuntan acá en vez de repetirlos. Si agregás tests o un archivo nuevo, el número se actualiza **acá**, en el mismo cambio.

| Verificación | Baseline esperado |
|---|---|
| `npm test` | 21 archivos, 213 tests, todo en verde |
| `npm run lint` | **0 errores**, 6 warnings |
| `npx tsc --noEmit` | sin salida (limpio) |
| `npm run build` | compila a `.output/chrome-mv3/` |

Un error de lint es una regresión; los 6 warnings son deuda conocida (ver `docs/TECHNICAL_DEBT.md`).

## Cómo correr los tests

```
npm install      # una sola vez (instala las devDependencies en node_modules/, gitignorado)
npm test         # corre todo una vez (vitest run)
npm run test:watch  # modo watch durante desarrollo
```

La extensión **sí** se empaqueta desde la Fase 3 de la re-arquitectura (WXT + Vite → `.output/chrome-mv3/`) y el núcleo se está migrando a TypeScript: ADR-0008 reemplazó a `docs/adr/0001-no-bundler-or-typescript-yet.md`. Lo que sigue siendo cierto es que la extensión no tiene dependencias de **runtime** — todo `package.json` es tooling (Vitest, ESLint, `tsc`, WXT).

## Stack elegido

**Vitest + jsdom.** Ver justificación en `docs/tech-stack.md`. No usar Jest — Vitest no requiere configuración de Babel/TS aparte y arranca más rápido, y no hay ninguna razón específica del proyecto para preferir Jest.

Nota sobre el import: `shared/utils.js` no era un módulo ESM/CJS. Se le agregó un guard de exportación al final (`module.exports = Utils` bajo `typeof module !== "undefined"`, además de los branches `window`/`self` para el browser/SW). Por eso `package.json` **no** declara `"type": "module"`: así Node/Vitest resuelven el archivo como CommonJS y `module.exports` funciona.

## Qué testear primero, y por qué

### 1. `shared/utils.js` — prioridad máxima ✅ cubierto (inicial)

Es la única capa de lógica de negocio que ya está desacoplada del DOM y de `chrome.*` — se puede testear sin ningún mock. Ya cubierto en `shared/utils.test.js` (más `escaparHtml`, agregado con el fix de XSS). El *mecanismo* de parsing/clasificación vive en `docs/patterns.md` §Sanitización; acá sólo el *por qué* de la prioridad de test. En orden de criticidad:

1. **`formatTitleStructured`** — la función más compleja del proyecto (múltiples regex aplicados en secuencia, donde el orden importa). Un bug acá corrompe el nombre de archivo de la clase descargada.
2. **`clasificarCatedraYCarpeta`** — determina a qué carpeta/cátedra se asigna cada clase. Un bug acá mueve archivos al lugar equivocado silenciosamente.
3. **`parseSmartDate`** — heurística de desambiguación día/mes (la regla exacta, en `docs/patterns.md` §Sanitización). Fácil de romper con un cambio aparentemente inocuo.
4. **`sanitizarTexto`** — nombres de archivo inválidos rompen la escritura a disco del backend Bun.

Casos de borde a cubrir explícitamente para `formatTitleStructured`/`clasificarCatedraYCarpeta`: títulos sin fecha, títulos con cátedra explícita ("CATEDRA B") vs. implícita ("ANATO B"), títulos con acentos, títulos con múltiples números que podrían confundirse con clase/parte/fecha.

### 2. `shared/utils.js` — funciones de soporte (prioridad media)

- `calcularMétricasProgreso` / `formatearMB` / `calcularProyeccionMB` — cálculos de telemetría, bajo riesgo pero baratos de testear.
- `fetchConReintentos` — requiere mockear `fetch` global (`vi.stubGlobal` o similar) y un `AbortController` real para el caso de cancelación.

### 3. `background.js` / `background/hlsEngine.js` — parcial

- **`hlsEngine.js`** (`background/hlsEngine.test.js`): cubierta la función pura `descargarYAnalizarIndexM3u8` (parseo del manifiesto + `#EXT-X-KEY` + absolutización de fragmentos), mockeando sólo la global `Utils.fetchConReintentos`. Requirió agregarle la rama `module.exports` (sólo Node, no existe en el SW). También cubierto el **pool de 6 workers** `compilarTranscodificacionStream`: se stubean los globals que el SW inyecta (`SessionState`/`BunClient`/`Utils`/`crypto.subtle`/`controladorGraficoActivo`) y se verifica el reparto de índices sin duplicar/saltear con tope de concurrencia 6, turbo vs blob, descifrado AES por fragmento, el abort en cascada ante un fallo real (los hermanos rechazan `AbortError` callado y gana el error real), el `signal` ya abortado y el throttling del progreso — más el path del reintento 4xx (bug 400: 3 intentos → propaga el error tipado; un no-rechazo no se reintenta).
- **`background.js`** (`background.test.js`): cubiertos los handlers IPC del dict `manejadoresIPC` (encolar/remover/estados en progreso) con un **harness manual** (`crearArea` + un `chrome` mock con store en memoria) que importa el SW sin modificar código de producción: `importScripts` se neutraliza, `chrome.*` se mockea (incluido `chrome.notifications`, cuyo `onClicked` se registra al cargar el SW), y el listener de `onMessage` se captura al registrarse. **No** se usa `sinon-chrome` (añade dep de runtime, contra ADR-0001). Falta el bucle de descarga (`procesarSiguienteElementoDeLaCola`) y la máquina de auto-heal — dentro de ese bucle, `registrarFallo` (historial + notificación nativa) y el listener `chrome.notifications.onClicked` quedan bajo la misma excepción manual/e2e (no alcanzables desde el harness IPC). La lógica de storage del historial en sí **sí** está cubierta, aislada, en `core/historial/historialFallos.test.ts` (con el adaptador en memoria del puerto, sin mocks de `chrome.*`).

### 4. `popup.js` — parcial: lo ya extraído está cubierto, el núcleo sigue bloqueado

El `popup.js` original era un único closure `DOMContentLoaded` con ~50 funciones anidadas no exportables — no testeable así. La Fase 2 (cerrada) extrajo la lógica cohesiva a `popup/features/*` (y a islas Preact), y esos módulos **sí** se testean de forma aislada: hay tests para `serverConnection`, `queue`, `filters`, `catedra` y las cinco islas Preact. Lo que queda sin cubrir es el núcleo de `popup.js` que por diseño permanece en el closure (init + wiring + orquestación de scraping/render, que ADR-0005 define como estado final) — ver `docs/ROADMAP.md` Fase 2 y `docs/adr/0005-feature-driven-popup-split.md`.

## Qué NO testear (por ahora)

- El render de la lista de clases se migró a la isla Preact `popup/features/listaClases.preact.js`, que **sí** está cubierta con jsdom (`listaClases.preact.test.js`). Lo que queda de `renderers.js` (`pintarTelemetria`, más los ports `construirFilaClaseDOM`/`renderizarTarjetaEstado` que quedaron como referencia muerta hasta la Etapa 2 de la migración) y `sitio/ramonnet/scraper.js` (scraping de un DOM de terceros) siguen de menor prioridad que la lógica de negocio pura. Si se testean, usar jsdom para simular el DOM.
- No hay necesidad de tests end-to-end automatizados (ej. Playwright) contra el backend Bun real — el golden path manual descrito en `docs/contributing.md` cumple ese rol mientras el proyecto sea de este tamaño.

## Convención de archivos de test

Co-locar el test junto al archivo que testea: `shared/utils.test.js` al lado de `shared/utils.js` (no una carpeta `__tests__/` separada) — sigue el patrón `*.test.ts` mencionado como referencia en proyectos hermanos, adaptado a `.js`.
