# Testing

**Estado actual: infra montada, cobertura inicial sobre `shared/utils.js`.** Existe `package.json` con Vitest + jsdom como devDependencies y un suite en `shared/utils.test.js` (23 tests de caracterización de las funciones puras). El resto de este documento describe la estrategia y lo que todavía falta cubrir.

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

Es la única capa de lógica de negocio que ya está desacoplada del DOM y de `chrome.*` — se puede testear sin ningún mock. Ya cubierto en `shared/utils.test.js` (más `escaparHtml`, agregado con el fix de XSS). En orden de criticidad:

1. **`formatTitleStructured`** — la función más compleja del proyecto (múltiples regex aplicados en secuencia, donde el orden importa). Un bug acá corrompe el nombre de archivo de la clase descargada.
2. **`clasificarCatedraYCarpeta`** — determina a qué carpeta/cátedra se asigna cada clase. Un bug acá mueve archivos al lugar equivocado silenciosamente.
3. **`parseSmartDate`** — heurística de desambiguación día/mes (regla: si un número es >12 y el otro no, el >12 es el día). Fácil de romper con un cambio aparentemente inocuo.
4. **`sanitizarTexto`** — nombres de archivo inválidos rompen la escritura a disco del backend Bun.

Casos de borde a cubrir explícitamente para `formatTitleStructured`/`clasificarCatedraYCarpeta`: títulos sin fecha, títulos con cátedra explícita ("CATEDRA B") vs. implícita ("ANATO B"), títulos con acentos, títulos con múltiples números que podrían confundirse con clase/parte/fecha.

### 2. `shared/utils.js` — funciones de soporte (prioridad media)

- `calcularMétricasProgreso` / `formatearMB` / `calcularProyeccionMB` — cálculos de telemetría, bajo riesgo pero baratos de testear.
- `fetchConReintentos` — requiere mockear `fetch` global (`vi.stubGlobal` o similar) y un `AbortController` real para el caso de cancelación.

### 3. `background.js` / `background/hlsEngine.js` — diferido

Requieren mockear `chrome.storage`, `chrome.alarms`, `chrome.runtime`, `chrome.offscreen`, etc. El costo de setup es mayor (librería tipo `sinon-chrome`, o mocks manuales del namespace `chrome`). Se aborda en una fase posterior si el proyecto lo justifica — no es parte de la Fase 1.

### 4. `popup.js` — bloqueado hasta el split (Fase 2 del roadmap)

No es testeable en su forma actual: es un único closure `DOMContentLoaded` con ~50 funciones anidadas que comparten variables de clausura no exportadas. Antes de escribir tests acá, hay que extraer la lógica a módulos con funciones nombradas y exportables (`popup/features/*.js`, ver `docs/ROADMAP.md` Fase 2 y `docs/adr/0005-feature-driven-popup-split.md`).

## Qué NO testear (por ahora)

- `renderers.js` y `popup/scraper.js` son principalmente manipulación de DOM/scraping de un DOM de terceros — de menor prioridad que la lógica de negocio pura. Si se testean, usar jsdom para simular el DOM.
- No hay necesidad de tests end-to-end automatizados (ej. Playwright) contra el backend Bun real — el golden path manual descrito en `docs/contributing.md` cumple ese rol mientras el proyecto sea de este tamaño.

## Convención de archivos de test

Co-locar el test junto al archivo que testea: `shared/utils.test.js` al lado de `shared/utils.js` (no una carpeta `__tests__/` separada) — sigue el patrón `*.test.ts` mencionado como referencia en proyectos hermanos, adaptado a `.js`.
