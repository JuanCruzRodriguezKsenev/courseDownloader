# Roadmap técnico

Plan de trabajo para pagar la deuda técnica documentada en `docs/TECHNICAL_DEBT.md`, en el orden recomendado. Cada fase está pensada para que la siguiente dependa de que la anterior esté hecha (no son intercambiables libremente — ver la nota de secuencia en cada una).

Este documento cubre **trabajo técnico interno**, no features de producto nuevas para el usuario final.

---

> **Re-arquitectura núcleo/adaptadores (Track B)**: su plan por fases vive en
> `docs/rearquitectura-diseno.md` §Orden de migración, no acá (regla DRY, ADR-0007).
> Estado al 2026-08-02: Capa 2 completa en vanilla; lo que sigue está bloqueado por una
> decisión de empaquetado (una build por portal vs. registro en runtime).

## Estado (2026-07-19) — tanda de saldado de deuda (Track A: bug 400 + Fase 2 + tests del pool)

Tanda de 3 ítems (un commit atómico por ítem, `npm test` + `npm run lint` en verde antes de cada uno), siguiendo el plan `~/.claude/plans/lazy-spinning-popcorn.md`:

| Ítem | Qué | Doc de detalle | Commit |
|---|---|---|---|
| A2 | Fix del **bug 400** (loop pausa/autoheal ante rechazo 4xx del backend): reintento N=3 + saltar SÓLO la clase avisando, sin pausar la cola | TECHNICAL_DEBT §Resuelto, patterns §Circuit breaker | `a53dae3` |
| A1 | Extraer `popup/features/catedra.js` (`CatedraFeature`) — **cierra la Fase 2** del split feature-driven | ADR-0005, Fase 2 abajo | `16ecfb4` |
| A3 | Tests del **pool de 6 workers** (`compilarTranscodificacionStream`): concurrencia, AES, turbo/blob, aborts en cascada, path 4xx | testing.md §3 | `96a2389` |

Suite: 135 → **155 tests** (14 archivos). Lint: **0 errores / 10 warnings**. Con A1, la **Fase 2 queda cerrada**: el resto de `popup.js` es orquestación (init + wiring + scraping/render) que ADR-0005 define como estado final (`scraping` NO se extrae — decisión que alimenta ADR-0008/Fase 6). Pendiente en JS: nada de la deuda abierta de Track A; sigue el Track B (Fase 6, diferido, sólo diseño). Verificación e2e manual del bug 400 a cargo del usuario (backend Bun corriendo).

## Estado (2026-07-18) — split de `popup.js` (Fase 2)

Extraída `popup/features/filters.js` (`FilterFeature`) — el penúltimo corte del
god-file. Queda **1** ítem estructural de Fase 2 (adelgazar `popup.js` a init +
wiring / extraer clusters `catedra.js`/`scraping.js` si es seguro) más la cobertura
de tests pendiente. Suite: 116 → **135 tests** (13 archivos; incluye la robustez de conexión sumada en paralelo). Lint: **0 errores / 10 warnings**.

## Estado (2026-07-17) — sesión de saldado de deuda

Se hizo una tanda para cerrar la deuda abierta (un commit atómico por ítem,
`npm test` + `npm run lint` en verde antes de cada uno). Avanzó **5 de 7** ítems
planificados; los 2 restantes (Fase 2) quedan pendientes.

**Cerrado en esta sesión:**

| Ítem | Doc de detalle | Commit |
|---|---|---|
| Split de `styles/components.css` → 13 archivos `styles/components/*.css` | TECHNICAL_DEBT §Resuelto | `462f81d` |
| Borrar muerto en `renderers.js` (`construirFilaClaseDOM`/`renderizarTarjetaEstado`) | — | `84f7fe3` |
| Listener IPC de `background.js` → dict `manejadoresIPC` | patterns §IPC, TECHNICAL_DEBT | `44ccf02` |
| Tests del SW: `hlsEngine` (funciones puras) + handlers IPC (harness `chrome.*`) | testing.md §3 | `2987e57` |
| Isla Preact #4 **Etapa 2** (host de `#ui-list`: selection-mode/opacity/oculta) | preact-migration §4 | `ec0d93e` |

Suite: 101 → **116 tests** (12 archivos). Lint: **0 errores / 10 warnings**.

**Pendiente (deuda abierta):**

- **Adelgazar `popup.js` / cerrar god-file** — Fase 2, abajo. Extraer clusters de bajo acoplamiento
  (`catedra.js`, `scraping.js`) si es seguro; el motor de render/worker queda como orquestación en
  `popup.js` (extraerlo es la cirugía más riesgosa y de menor retorno).
- **Cobertura de tests** — falta `compilarTranscodificacionStream` (pool de workers + AES + `crypto.subtle`)
  y el núcleo de `popup.js` post-split (ver `docs/testing.md`, `docs/TECHNICAL_DEBT.md` §Testing).
- **Verificación manual** — probar en el navegador el flujo banner/reconexión de la Etapa 2 (no cubrible
  headless).
- **Fuera de alcance por decisión**: Fase 5 (`@ts-check`/TypeScript, diferida por ADR-0001) y los ítems
  de §"Explícitamente fuera de alcance".

---

## Fase 0 — Seguridad (sin dependencias)

- [x] Corregir XSS en `popup.js:1012`/`:1019` (ver `docs/TECHNICAL_DEBT.md`, sección Seguridad). ✅ 2026-07-16

No depende de nada de lo que sigue. Se puede hacer en cualquier momento, independiente del resto del roadmap.

---

## Fase 1 — Infraestructura de testing

**Objetivo**: tener una red de seguridad antes de refactorizar código existente.

- [x] Agregar `package.json` mínimo al repo. ✅ 2026-07-16
- [x] Instalar Vitest + jsdom como devDependencies. ✅ 2026-07-16
- [x] Escribir tests para `shared/utils.js` (`shared/utils.test.js`, 23 tests de caracterización): ✅ 2026-07-16
  1. [x] `formatTitleStructured` — la lógica de parseo de títulos es la más compleja (múltiples regex, orden de aplicación importa) y la más usada en cascada por el resto del sistema.
  2. [x] `clasificarCatedraYCarpeta` — determina a qué carpeta/cátedra se asigna cada clase; un bug acá mueve archivos al lugar equivocado.
  3. [x] `parseSmartDate` — heurística de desambiguación día/mes, fácil de romper con un cambio aparentemente inocuo.
  4. [x] `sanitizarTexto` — nombres de archivo inválidos rompen la escritura a disco del backend Bun. (+ `escaparHtml`, del fix de XSS.)
- [ ] (Opcional, si hay tiempo) tests de humo para `calcularMétricasProgreso` y `fetchConReintentos` (con mocks de `fetch`).

**Nota de secuencia**: `background.js`/`hlsEngine.js` (que dependen de `chrome.*` APIs) quedan fuera de esta fase — requieren mocks de `chrome.storage`/`chrome.alarms`/etc. (ej. `sinon-chrome`), que es un costo de setup mayor. Se abordan en una fase posterior si el proyecto lo justifica.

---

## Fase 2 — Split de `popup.js`

**Objetivo**: eliminar el "god file" (ver `docs/adr/0005-feature-driven-popup-split.md` para el criterio de división).

- [x] Borrar código muerto (wrapper `clasificarCatedraYCarpeta`). ✅ 2026-07-16
- [x] Extraer `popup/features/onboarding.js` (tour de bienvenida — es la feature más autocontenida, buen punto de partida de bajo riesgo). ✅
- [x] Extraer `popup/features/serverConnection.js` (detección de estado del servidor Bun + UI offline + auto-healing). ✅ En vez de mantener el polling propio original, se introdujo el daemon `shared/conexion.js` como fuente única de verdad del estado de conexión (servidor + internet, modelo push, espejado popup↔SW por `chrome.storage.session`); la feature ahora se suscribe a él y reacciona. `background.js` también migró a consumirlo (clasificación de error + `alarma_autoheal`).
- [x] Extraer `popup/features/filters.js` (búsqueda, filtros por estado/materia/cátedra, popover de filtros). ✅ `FilterFeature.crear(ctx)` con `filtrosActivos` pasado POR REFERENCIA en `ctx` (objeto compartido, como `queue.js` recibe `nodos`), 10 tests (`filters.test.js`). Movió `aplicarFiltrosCruzados`, `desbanearFiltros`, `renderizarFiltrosMenuPopover` + `crearPopoverOptionDOM` (privada) y `actualizarPillsUIState`; unificó el predicado de filtrado de la pestaña Cola —antes duplicado en `masterCheck`, `renderizarListadoInterfaz` y `actualizarMasterCheckState`— en `coincideConFiltrosCola(clase, busqueda)`. `popup.js` → v5.11.0, `filters.js` → v1.0.0.
- [x] Extraer `popup/features/queue.js` (cola de descarga, `encolarItemsEnCaliente`, cancelación, reintentos). ✅ 2026-07-17. `QueueFeature.crear(ctx)` con 11 tests (`queue.test.js`) contiene: mutaciones de la cola (`encolarItemsEnCaliente` + `quitarItemsDeColaEnLote`), cancelación de descarga (`solicitarFrenadoSuave` + `abortarRafagaInmediata`), arranque (`iniciarDescargaCola`) y reanudación tras caída (`ejecutarReintentoDeCola`, + el helper `verificarRedAntesDeDescargar`). Los flags de UI `verificandoConexionBoton`/`reintentandoColaActivo` siguen en `popup.js` (los lee `actualizarContadoresBoton`) y la feature los togglea por ctx. Hecho en 3 cortes verificados en runtime. `popup.js` → v5.8.2, `queue.js` → v1.2.0.
- [x] Extraer `popup/features/catedra.js` (badge de cátedra + asistente/modal multicátedra + listener del badge). ✅ 2026-07-19. *(Renombrado a `popup/features/faceta.js` el 2026-08-02 al generalizarlo — ver `docs/rearquitectura-diseno.md` §UI.)* `CatedraFeature.crear(ctx)` con 9 tests (`catedra.test.js`); unificó el `detectarCatedras()` antes triplicado. `popup.js` → v5.14.0, `catedra.js` → v1.0.0. **Último cluster de bajo acoplamiento extraíble** — con esto cierra la fase.
- [x] Dejar en `popup.js` solo: inicialización de `nodos`, wiring de listeners de alto nivel, y orquestación entre features. ✅ Estado final: lo que queda (render, worker IPC, scraping) ES la orquestación que ADR-0005 define como núcleo no-extraíble. `scraping` NO se extrae por decisión (alimenta ADR-0008/Fase 6).
- [x] Sumar cada archivo nuevo como `<script>` en `popup/popup.html`, respetando el orden de dependencia existente (después de `shared/*.js`, antes de `popup.js`). ✅

**Fase 2 completa** ✅ (2026-07-19): extraídas `serverConnection`, `queue`, `filters` y `catedra` (+ las islas Preact); el resto de `popup.js` es orquestación por diseño.

**Nota de secuencia**: dependió de Fase 1 — sin tests de `shared/utils.js`, no había forma de verificar que mover código no cambió comportamiento sutilmente. Las features extraídas suman además sus propios tests (`serverConnection.test.js`, `queue.test.js`, `filters.test.js`, `catedra.test.js`, `conexion.test.js`, y las islas Preact — el onboarding pasó de feature vanilla a isla, ver `docs/preact-migration.md`).

---

## Fase 3 — Robustez del flujo de datos

- [x] Cerrar el gap de rollback en `encolarItemsEnCaliente`. ✅ 2026-07-17 — callback en el `sendMessage` que revierte cola + estado de ítems + re-render ante `lastError`/status inesperado. `popup.js` → v5.7.1.
- [x] Auditar y consolidar escrituras a `chrome.storage.local` en `background.js` que tocan múltiples claves relacionadas (`listaPersistente`, `colaDescargas`, `SW_ESTADOS_PROGRESO`) en operaciones separadas. ✅ 2026-07-17 — 3 puntos consolidados a un único `.set()`. `background.js` → v5.6.3.

**Nota de secuencia**: técnicamente independiente de las Fases 1-2, pero tiene más sentido hacerla junto con o después del split de `popup.js`, para no tocar el mismo código dos veces.

**Fase 3 completa** ✅ (2026-07-17): ambos ítems resueltos.

---

## Fase 4 — Calidad de proceso

- [x] Configurar ESLint básico (reglas mínimas: `no-unused-vars`, `eqeqeq`, `no-undef`). ✅ 2026-07-17 — `eslint.config.js` (flat config, ESLint 9) con globals por contexto (SW/importScripts, popup/`<script>`, dual-export, islas Preact ESM, tests). Script `npm run lint`. Estado inicial: 0 errores, 11 warnings (destapó código muerto `marcarClaseComoPendiente` — ver TECHNICAL_DEBT); baseline actual: 0 errores, 10 warnings.
- [x] Reemplazar los 3 `catch (e) {}` silenciosos identificados por al menos un `console.warn`. ✅ 2026-07-17
- [x] Hacer configurable la URL base del backend Bun en `shared/bunClient.js` (hoy hardcodeada a `localhost:3001`), si se llega a necesitar para tests de integración. ✅ 2026-07-17 — hook liviano (`configurarBaseUrl(url)` + global `RAMONNET_BUN_BASE_URL`), default de fábrica intacto, +4 tests. `bunClient.js` → v1.3.0.

---

## Fase 5 (fusionada en Fase 6) — Chequeo de tipos

La migración a TypeScript **dejó de ser un ítem suelto**: se fusionó dentro de la
re-arquitectura de Fase 6, porque ambas comparten la conversión transversal de
globales `window.X`/`self.X` a módulos ES y conviene tocar cada archivo una sola
vez. Ver **`docs/adr/0008-arquitectura-nucleo-adaptadores.md`** (que supersede a
ADR-0001) y la Fase 6 abajo. La opción intermedia de `// @ts-check` + JSDoc sin
bundler queda descartada por la misma razón: el destino es TS-completo con puertos
tipados.

---

## Fase 6 (diferida, diseño) — Re-arquitectura núcleo + adaptadores (+ TypeScript)

**Objetivo**: convertir la extensión en un **template reutilizable** vía
arquitectura de puertos y adaptadores (hexagonal), separando el código genérico del
específico de sitio y del específico de navegador — para re-clonar a otro
sitio/browser cambiando solo un adaptador. La **decisión** está en **ADR-0008**; el
**diseño de ejecución concreto** (estructura de carpetas, interfaces TS de los
puertos, bundler, orden de migración) en **`docs/rearquitectura-diseno.md`**. Lo que
sigue es el checklist de fases; el detalle de cada una está en ese doc.

Tres capas (detalle completo + catálogo de qué migra en cada una → ADR-0008):

- [ ] **Capa 1 — Núcleo genérico**: motor HLS (pool + AES), cola FIFO, daemon de
  conexión, máquina de estado, UI/islas, `BunClient`. Invariante: no llama
  `chrome.*` ni conoce Ramón Net.
- [ ] **Capa 2 — Adaptador de sitio (`sitio/`)**: concentrar lo específico de Ramón
  Net (scraper/selectores, parseo de títulos/cátedra, resolución M3U8/CDN, URL de
  sondeo, reglas dNR, cátedra A-D) detrás de un puerto de sitio.
- [ ] **Capa 3 — Adaptador de navegador (Chrome/MV3)**: abstraer los ~99 usos de
  `chrome.*` (storage, IPC, alarms, tabs, scripting, downloads, offscreen, dNR)
  detrás de puertos.
- [ ] **TypeScript + bundler (fusionado)**: TS-completo + bundler MV3 (Vite+CRXJS o
  WXT) como parte de la misma conversión a módulos ES. Payoff: puertos tipados +
  `@types/chrome` + IPC con unión discriminada. Reemplaza a ADR-0001.

**Nota de secuencia**: es la fase más grande y transversal del roadmap; se ejecuta
de forma incremental (lo más aislado primero), nunca big-bang. **No forma parte de
la tanda de saldado de deuda técnica** — esa queda en JS (Fase 2 + fix del bug 400).
Depende de tener las Fases 1-4 cerradas (red de tests + split + ESLint) como piso.

---

## Explícitamente fuera de alcance

Decisiones ya evaluadas y descartadas — no forman parte de este roadmap salvo que cambien las condiciones descritas en su ADR correspondiente (`docs/adr/`):

- Astro u otro framework de sitios de contenido (`docs/adr/0002-reject-astro.md`).
- Circuit Breaker formal / Idempotency Service centralizado (`docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`).
- Result Pattern (`Result<T,E>`) (`docs/adr/0004-defer-result-pattern.md`).
- App Shell Pattern, Repository Pattern, Unit of Work, Transactional Outbox, Barrel Files — no aplican a un proyecto sin backend/DB propios (ninguno tiene ADR propio porque se descartaron sin ambigüedad en la primera evaluación — ver `docs/tech-stack.md`).
