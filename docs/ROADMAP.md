# Roadmap técnico

Plan de trabajo para pagar la deuda técnica documentada en `docs/TECHNICAL_DEBT.md`, en el orden recomendado. Cada fase está pensada para que la siguiente dependa de que la anterior esté hecha (no son intercambiables libremente — ver la nota de secuencia en cada una).

Este documento cubre **trabajo técnico interno**, no features de producto nuevas para el usuario final.

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
- [ ] Extraer `popup/features/filters.js` (búsqueda, filtros por estado/materia/cátedra, popover de filtros).
- [x] Extraer `popup/features/queue.js` (cola de descarga, `encolarItemsEnCaliente`, cancelación, reintentos). ✅ 2026-07-17. `QueueFeature.crear(ctx)` con 11 tests (`queue.test.js`) contiene: mutaciones de la cola (`encolarItemsEnCaliente` + `quitarItemsDeColaEnLote`), cancelación de descarga (`solicitarFrenadoSuave` + `abortarRafagaInmediata`), arranque (`iniciarDescargaCola`) y reanudación tras caída (`ejecutarReintentoDeCola`, + el helper `verificarRedAntesDeDescargar`). Los flags de UI `verificandoConexionBoton`/`reintentandoColaActivo` siguen en `popup.js` (los lee `actualizarContadoresBoton`) y la feature los togglea por ctx. Hecho en 3 cortes verificados en runtime. `popup.js` → v5.8.2, `queue.js` → v1.2.0.
- [ ] Dejar en `popup.js` solo: inicialización de `nodos`, wiring de listeners de alto nivel, y orquestación entre features.
- [x] Sumar cada archivo nuevo como `<script>` en `popup/popup.html`, respetando el orden de dependencia existente (después de `shared/*.js`, antes de `popup.js`). ✅ (hecho para las features ya extraídas; repetir para `filters.js`/`queue.js`).

**Nota de secuencia**: depende de Fase 1 — sin tests de `shared/utils.js`, no hay forma de verificar que mover código no cambió comportamiento sutilmente. Las features ya extraídas suman además sus propios tests (`serverConnection.test.js`, `conexion.test.js`, y `onboarding.preact.test.js` — el onboarding pasó de feature vanilla a isla Preact, ver `docs/preact-migration.md`).

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

## Fase 5 (diferida) — Chequeo de tipos

Ver `docs/adr/0001-no-bundler-or-typescript-yet.md`.

- [ ] Evaluar adoptar `// @ts-check` + JSDoc + `@types/chrome` una vez completadas las Fases 1-3.
- [ ] Migración completa a TypeScript con bundler: **no planificada**, solo se reconsideraría ante crecimiento significativo del proyecto (más código, más de un contribuyente).

---

## Explícitamente fuera de alcance

Decisiones ya evaluadas y descartadas — no forman parte de este roadmap salvo que cambien las condiciones descritas en su ADR correspondiente (`docs/adr/`):

- Astro u otro framework de sitios de contenido (`docs/adr/0002-reject-astro.md`).
- Circuit Breaker formal / Idempotency Service centralizado (`docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`).
- Result Pattern (`Result<T,E>`) (`docs/adr/0004-defer-result-pattern.md`).
- App Shell Pattern, Repository Pattern, Unit of Work, Transactional Outbox, Barrel Files — no aplican a un proyecto sin backend/DB propios (ninguno tiene ADR propio porque se descartaron sin ambigüedad en la primera evaluación — ver `docs/tech-stack.md`).
