# Testing

**Estado actual: suite real y en crecimiento — 12 archivos de test, ~113 tests.** Existe `package.json` con Vitest + jsdom como devDependencies. Cubierto hoy: la lógica pura (`shared/utils.js`), el daemon de conexión (`shared/conexion.js`), el cliente del backend (`shared/bunClient.js`), las features/islas del popup ya extraídas (`popup/features/serverConnection.js`, `queue.js`, y las islas Preact `conexionHeader`/`onboarding`/`rutaDisco`/`bannerConexion`/`listaClases`), las funciones puras de `background/hlsEngine.js` (parseo/resolución M3U8) y los handlers IPC de `background.js` (vía un harness que mockea `chrome.*`). El resto de este documento describe la estrategia y lo que todavía falta cubrir (el motor de descarga concurrente `compilarTranscodificacionStream` y el núcleo de `popup.js` aún sin extraer).

## Cómo correr los tests

```
npm install      # una sola vez (instala Vitest + jsdom en node_modules/, gitignorado)
npm test         # corre todo una vez (vitest run)
npm run test:watch  # modo watch durante desarrollo
```

La extensión en sí sigue sin bundler ni dependencias de runtime: `package.json` existe sólo para las herramientas de test (ver `docs/adr/0001-no-bundler-or-typescript-yet.md`).

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

- **`hlsEngine.js`** (`background/hlsEngine.test.js`): cubiertas las dos funciones puras `extraerEnlaceMaestroM3u8Clasico` (HTML → URL `.m3u8`, iframe + 3 fallbacks) y `descargarYAnalizarIndexM3u8` (parseo del manifiesto + `#EXT-X-KEY` + absolutización de fragmentos), mockeando sólo la global `Utils.fetchConReintentos`. Requirió agregarle la rama `module.exports` (sólo Node, no existe en el SW). Falta `compilarTranscodificacionStream` (pool de workers + AES + `BunClient` + `crypto.subtle` — caro de aislar).
- **`background.js`** (`background.test.js`): cubiertos los handlers IPC del dict `manejadoresIPC` (encolar/remover/estados en progreso) con un **harness manual** (`crearArea` + un `chrome` mock con store en memoria) que importa el SW sin modificar código de producción: `importScripts` se neutraliza, `chrome.*` se mockea, y el listener de `onMessage` se captura al registrarse. **No** se usa `sinon-chrome` (añade dep de runtime, contra ADR-0001). Falta el bucle de descarga (`procesarSiguienteElementoDeLaCola`) y la máquina de auto-heal.

### 4. `popup.js` — parcial: lo ya extraído está cubierto, el núcleo sigue bloqueado

El `popup.js` original era un único closure `DOMContentLoaded` con ~50 funciones anidadas no exportables — no testeable así. A medida que la Fase 2 extrae lógica a `popup/features/*` (y a islas Preact), esos módulos **sí** se testean de forma aislada: ya hay tests para `serverConnection`, `queue` y las cinco islas Preact. Lo que queda sin cubrir es el núcleo de `popup.js` todavía no extraído (init + wiring + funciones aún en el closure) — ver `docs/ROADMAP.md` Fase 2 y `docs/adr/0005-feature-driven-popup-split.md`.

## Qué NO testear (por ahora)

- El render de la lista de clases se migró a la isla Preact `popup/features/listaClases.preact.js`, que **sí** está cubierta con jsdom (`listaClases.preact.test.js`). Lo que queda de `renderers.js` (`pintarTelemetria`, más los ports `construirFilaClaseDOM`/`renderizarTarjetaEstado` que quedaron como referencia muerta hasta la Etapa 2 de la migración) y `popup/scraper.js` (scraping de un DOM de terceros) siguen de menor prioridad que la lógica de negocio pura. Si se testean, usar jsdom para simular el DOM.
- No hay necesidad de tests end-to-end automatizados (ej. Playwright) contra el backend Bun real — el golden path manual descrito en `docs/contributing.md` cumple ese rol mientras el proyecto sea de este tamaño.

## Convención de archivos de test

Co-locar el test junto al archivo que testea: `shared/utils.test.js` al lado de `shared/utils.js` (no una carpeta `__tests__/` separada) — sigue el patrón `*.test.ts` mencionado como referencia en proyectos hermanos, adaptado a `.js`.
