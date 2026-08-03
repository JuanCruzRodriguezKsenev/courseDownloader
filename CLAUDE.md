# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ## ⚠️ Trabajo en curso — leer esto primero
>
> Hay una **re-arquitectura activa** (puertos y adaptadores + TypeScript + WXT), a mitad de
> camino: **fases 0-5b completas, 5c a medias, 6-8 sin arrancar** (al 2026-08-03). Antes de
> tocar código:
>
> **Leé `docs/rearquitectura-diseno.md` §Cómo retomar esto en una sesión nueva.** Ahí está el
> orden de lectura, el estado por fase, qué sigue y con qué riesgo, y las 4 verificaciones a
> correr antes de empezar (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` —
> las cuatro tienen que quedar en verde; los números esperados de cada una viven en
> `docs/testing.md`, no acá).
>
> **Todo lo mergeado está verificado en navegador** (2026-08-02 y 2026-08-03). Hubo un tiempo
> en que las fases 1-5a estaban en `main` sin que nadie hubiera abierto la extensión compilada
> en Chrome; esa deuda se cerró, y desde entonces **la regla es una rama por corte y no se
> mergea sin que el dueño lo pruebe en el navegador** — la suite no cubre el empaquetado ni el
> núcleo de `popup.js`. Si aun así aparece algo roto en el navegador, el sospechoso número uno
> sigue siendo el empaquetado de la Fase 3 (es donde cambió el mecanismo de carga), no la
> lógica.

## Project Overview

RamonNet Video Downloader (Turbo Edition) is a Manifest V3 Chrome/Brave browser extension that bulk-downloads HLS-streamed recorded classes from the "Ramón Net" learning platform (`plataforma.ramonnet.com.ar`). It scrapes the class listing DOM, resolves each class's HLS `.m3u8` manifest, downloads and decrypts (AES-128-CBC) the `.ts` fragments concurrently, and streams the decrypted fragments to a companion local Bun backend server (`ramonnet-bun-backend`, a separate repo/folder not included here) running on `http://localhost:3001`, which assembles them on disk. **The extension is compiled** (since 2026-08-02, Phase 3 of the re-architecture): WXT + Vite bundle it into `.output/chrome-mv3/`, which is the folder loaded in the browser — *not* the repo root. `manifest.json` is no longer hand-written; it is generated from `wxt.config.ts`. Source is still vanilla JS + Preact islands, with the core being migrated to TypeScript incrementally (`core/`). ADR-0001 (no bundler) is superseded by ADR-0008.

## Documentation as Code

This project treats `docs/` as the technical source of truth, maintained with the same discipline as source code — a PR that changes storage shape, IPC contracts, or business logic updates the relevant doc in the same PR (see `docs/contributing.md` for the checklist). Docs also follow a **DRY / single-source-of-truth convention**: each concept has one canonical doc; everything else summarizes + links rather than re-explaining (rationale in `docs/adr/0007-dry-docs-canonical-homes.md`, the actionable rule + canonical-homes map in `docs/contributing.md`). When adding docs, don't paste an explanation that already lives elsewhere — link it. `README.md` remains the accurate end-user install guide and is not superseded by `docs/` — they serve different audiences.

Start at **`docs/architecture.md`**. Full map:
- `docs/architecture.md` — system overview, execution zones, the layer map, end-to-end download flow, and **§Qué hace cada archivo, y qué regla respeta: the canonical, per-file detail of what every module contains** (§Execution contexts below is only the digest of rules, and points here).
- `docs/tech-stack.md` — why each technology was chosen, alternatives rejected.
- `docs/data-model.md` — `chrome.storage.local`/`.session` schema (this project's equivalent of a DB schema).
- `docs/patterns.md` — the patterns actually implemented in code (IPC dispatch, state ownership split, worker pool, ad-hoc circuit breaker, etc.).
- `docs/coding-standards.md` — naming conventions, file version-header convention, module-export pattern.
- `docs/contributing.md` — local dev setup, debugging, PR checklist.
- `docs/testing.md` — testing strategy and current coverage (a Vitest suite now exists — see the test-file list under Development Workflow. The SW download loop + auto-heal **are covered since 2026-08-03**, characterized before migrating the SW to ports; only the un-extracted core of `popup.js` stays manual/e2e by design).
- `docs/security.md` — permission rationale and the untrusted-scraped-content rule.
- `docs/deployment.md` — extension distribution + the companion Bun backend contract.
- `docs/adr/` — immutable Architectural Decision Records. Never edit an existing ADR; a changed decision gets a new ADR that marks the old one superseded (see `docs/adr/README.md`).
- `docs/TECHNICAL_DEBT.md` — open issues backlog, with exact file/line locations. **Start at §🔴 Abierto: that section is the whole backlog.** Everything below it is ✅ resolved and kept as a dated record — useful for *why* the code looks like it does, not a to-do list, and its file paths describe the date they were written (they are deliberately not retro-corrected when something moves). Don't list the open items here — read them there, so there's only one copy to keep true.
- `docs/ROADMAP.md` — phased plan to pay down the backlog, in dependency order.
- `docs/preact-migration.md` — live status of the incremental Preact-islands migration of the popup (which islands are done/next, the DOM-boundary rule, and a recipe for adding one). See also ADR-0006.
- `docs/rearquitectura-diseno.md` — execution design (the "how") for the ports-and-adapters + TypeScript re-architecture: target folder layout, port interfaces, the generic-vs-site UI/CSS split, testing strategy under the new layers, bundler choice, migration order + execution rules (coexistence with the vanilla root, per-phase verification, rollback). The *decision* lives in ADR-0008 (supersedes ADR-0001); this is its counterpart design/status doc, like `preact-migration.md`. **Live status: phases 1–5a done, 5b onward pending** — read its §Cómo retomar esto en una sesión nueva first (see the banner at the top of this file). Note the doc's original `src/` layout was dropped in execution: `wxt.config.ts` sets `srcDir: '.'`, so sources stayed at the repo root.
- `docs/notificaciones-fallos-diseno.md` — execution design/record for the failure-notifications feature (native OS notification + persistent bell Preact island `campanita`, backed by the `historialFallos` storage key + the `core/historial/historialFallos.ts` module). Implemented (2026-07-20); the canonical detail lives in `data-model.md`/`security.md`/`patterns.md`/`preact-migration.md`, this is the "how"/rationale record.

Security rule (operational summary — full policy and rationale in `docs/security.md`): scraped/third-party text must never be interpolated into `.innerHTML` unescaped. Since Preact island #4 the live list renders through `<TarjetaEstado>`/`<FilaClase>` (`listaClases.preact.js`), so escape at the `window.ListaClases` view-model boundary that feeds them. The original `popup.js` XSS is fixed (2026-07-16).

**This is a personal extension — it is never going to be published to the Chrome Web Store.** It's loaded unpacked, for a single user. Treat that as a design constraint, not a "not yet": **do not weigh Web Store review, permission optics toward unknown users, or packaging/signing** when evaluating trade-offs. (It already flipped one decision — see ADR-0009, where "one build per portal" was dropped in favour of a runtime site registry.) What *does* still carry full weight: real security around scraped content (`docs/security.md`), and that the extension is used daily and must not be left broken.

## Development Workflow

The extension is built with WXT (`npm run build` → `.output/chrome-mv3/`). Vitest + ESLint + `tsc` cover the source:

```bash
npm test                              # Vitest, single run (the suite)
npx vitest run popup/features/queue.test.js   # one file
npx vitest run -t "<test name>"       # one test
npm run lint                          # ESLint 9 flat config
npx tsc --noEmit                      # typecheck
npm run build                         # → .output/chrome-mv3/  (what you load in Chrome)
npm run dev                           # WXT watch mode + HMR, readable sources
```

The first four are the gate to run before starting work (see the banner at the top of this file); the bullets below are the *why* behind each.

- **Run tests**: `npm test` (single run) or `npm run test:watch`. To run one file/test: `npx vitest run shared/utils.test.js` or `npx vitest run -t "<test name>"`. **There is no `vitest.config.*` in the repo** — the suite runs on Vitest's defaults, which means the `node` environment: a test that touches the DOM (a `popup/features/` feature, any Preact island) needs `// @vitest-environment jsdom` as its own docblock at the top of the file, or it dies with `document is not defined`. 12 of the 21 files carry one. Modules are ES modules that also publish their object as a global side-effect (`globalThis.X = X; export default X`) — the export feeds the bundler and the tests, the global keeps ~200 existing call-sites working untouched. See `docs/coding-standards.md`. **`docs/testing.md` is the canonical home for the suite's size and coverage narrative — read the count there, don't re-state it here.** The test files, for orientation: `shared/utils.test.js`, `shared/conexion.test.ts`, `shared/state.test.ts`, `core/backend/bunClient.test.ts`, `core/puertos/almacenamientoEnMemoria.test.ts`, `core/puertos/mensajeriaEnMemoria.test.ts`, `core/historial/historialFallos.test.ts`, `popup/features/serverConnection.test.js`, `popup/features/queue.test.js`, `popup/features/filters.test.js`, `popup/features/faceta.test.js`, `popup/features/conexionHeader.preact.test.js`, `popup/features/onboarding.preact.test.js`, `popup/features/rutaDisco.preact.test.js`, `popup/features/bannerConexion.preact.test.js`, `popup/features/listaClases.preact.test.js`, `popup/features/campanita.preact.test.js`, `sitio/ramonnet/parserTitulos.test.js`, `sitio/ramonnet/resolverManifiesto.test.js`, `background/hlsEngine.test.js` (includes the 6-worker pool + the 4xx-retry path), `background.test.js`.
- **Lint**: `npm run lint` (ESLint 9 flat config, rules `no-undef`/`no-unused-vars`/`eqeqeq`; `.ts` goes through typescript-eslint). When you add a new cross-file global (a `globalThis.X` consumed elsewhere), add it to `globalesDelProyecto` in `eslint.config.js` or `no-undef` will false-positive. The baseline is **0 errors** and a small, non-zero number of warnings — treat any error as a regression, and check the current warning count in `docs/testing.md` before assuming you introduced one.
- **Typecheck**: `npx tsc --noEmit` (must stay clean). TypeScript is pinned to 5.x on purpose — typescript-eslint does not support TS 7 yet, and losing lint on the migrating core is worse than the compiler's speed gain. **`tsconfig.json`'s `include` list is what it actually covers, and that is not automatic**: `allowJs` is `false` and both entrypoints are `.js`, so `tsc` skips them and with them the whole import graph — a folder of `.ts` that isn't listed is silently unchecked (`shared/` and `plataforma/` were, from Phase 5b until 2026-08-03). The source folders actually covered are `core/`, `shared/`, `plataforma/` and `sitio/`. **Don't read `entrypoints/**/*` in the list as coverage** — it's there, but both entrypoints are `.js`, so they're skipped along with everything they import; that line is exactly the trap, not the escape from it. When a migration puts `.ts` under a new root, add it to `include` in the same change and confirm with `npx tsc --noEmit --listFiles`.
- **Load/reload the extension**: `npm run build`, then `chrome://extensions/` → "Developer mode" → "Load unpacked" → select **`.output/chrome-mv3/`** (loading the repo root no longer works). Re-run the build and click reload after each change, or use `npm run dev` for WXT's watch mode with HMR.
- **Debug the popup**: right-click the extension icon → "Inspect popup" (or open it and press F12). Note the whole popup graph is bundled into one chunk (`.output/chrome-mv3/chunks/popup-*.js`) and **`wxt build` emits no sourcemaps** — for anything beyond a stack trace, use `npm run dev`, which serves readable sources with HMR.
- **Debug the service worker**: on `chrome://extensions/`, click "service worker" (or "Inspect views: service worker") under this extension to get DevTools for `background.js` and `background/hlsEngine.js`.
- **Companion backend required for actual downloads**: Turbo Mode (`modoTurboBun`) is hardcoded to `true` throughout the codebase, meaning fragments are always streamed to the local Bun backend rather than assembled in-browser. Without the Bun server running on port 3001, downloads will fail at the streaming step — start it separately per the backend's own instructions before testing end-to-end downloads.
- **Not shipped, don't edit as if it were live code**: `wxt.config.ts` is the authority on the manifest, and `.output/` on what the browser loads (both `.output/` and `.wxt/` are gitignored build artifacts — never edit them). `prototype/preact-serverConnection/` is a standalone, throwaway demo (its own vendored Preact copy) that proved out ADR-0006 — it duplicates connection-feature logic and is intentionally *not* kept in sync with `popup/features/serverConnection.js`. `.agents/skills/` + `skills-lock.json` are vendored agent skills (`chrome-extensions` from `googlechrome/modern-web-guidance`, `frontend-design` from `anthropics/skills`); consult `.agents/skills/chrome-extensions/references/` for MV3 API questions (service worker lifecycle, `declarativeNetRequest`, storage, popup UI) instead of guessing.
- **Opening a PR**: `.github/PULL_REQUEST_TEMPLATE.md` encodes the docs-as-code checklist (storage shape → `data-model.md`; new IPC action → `architecture.md`/`patterns.md`; architectural decision → new ADR; scraped-content handling → `security.md`; debt resolved → mark it in `TECHNICAL_DEBT.md`). Fill it rather than replacing the body.
- The test/lint baselines are hand-maintained and live in **one place: `docs/testing.md`** (§Baseline de las verificaciones). When you add tests or a new file, update them there in the same change — the same rule the docs get. Don't re-state a count in this file; the whole point of the single home is that it can't drift against a copy.
- A legacy non-Turbo code path (in-browser blob assembly via the `offscreen` document + `chrome.downloads`) still exists in `background.js`/`shared/utils.js` but is currently unreachable (`establecerModoTurbo` forces `true`). Why the two paths exist → `docs/tech-stack.md` §Por qué Bun.

## Architecture

### Where files live after the WXT migration (Phase 3)

Sources stayed at the repo root (`srcDir: '.'`); only **entrypoints** and **verbatim-copied assets** moved. The things that used to be at the root and are now gone (or moved) are the usual source of confusion:

- **`manifest.json`** → generated from `wxt.config.ts`. Edit the config, never the output.
- **`popup.html`** → `entrypoints/popup/index.html` (asset paths in it are relative, hence the `../../` prefixes).
- **The `<script>`/`importScripts` load order** → replaced by the *import order* in the two entrypoints: `entrypoints/popup/main.js` and `entrypoints/background.js`. **That order is load-bearing and not incidental**: modules publish themselves as globals when evaluated (`globalThis.X = X`) and later ones consume those globals without importing them. Site adapter first, `popup.js`/`background.js` last, Preact islands after that. Adding a module means inserting its import at the right position in the entrypoint — the bundler will not catch a wrong order, but the popup will break at runtime.
- **`public/`** is copied verbatim into the output: `public/offscreen/` (the legacy offscreen document) and `public/sitio/ramonnet/rules.json` (the dNR ruleset, referenced by that path from `wxt.config.ts`). Files there are *not* bundled — they can't use ES imports and must stay self-contained.

### Where the CSS lives

There is exactly one stylesheet link in the whole extension: `entrypoints/popup/index.html` → `popup/globals.css`, which is nothing but an ordered `@import` chain that Vite bundles into a single `assets/popup-*.css`. The actual CSS is at the repo root in **`styles/`**: `variables.css` (design tokens) and `base.css` first, then one file per component under `styles/components/` (`header.css`, `campanita.css`, `faceta.css`, …), then `list.css` last. Islands keep only *computed* styling inline (`style=${...}` for a transform, a cursor, a per-row highlight); their static appearance belongs in `styles/components/`. A new UI region therefore needs a new `styles/components/<nombre>.css` **plus** its `@import` line in `popup/globals.css` — miss the second step and the file is simply never bundled. Import order matters the same way the entrypoint's JS order does (cascade, not globals). The generic-vs-site split of these files is designed but not executed — see `docs/rearquitectura-diseno.md`.

### When a migration forces a file into TypeScript (the `allowJs` rule)

`allowJs` is `false`, so **a `.ts` file cannot import a `.js` file**. That single constraint decides how big each migration slice has to be, and the rule is about *who instantiates the module*, not about what the module does:

- **If `plataforma/composicion.ts` has to import it** → moving it onto a port forces converting it to TypeScript **in the same slice** (this is what happened to `state.ts` and `conexion.ts` in Phase 5b).
- **If the port reaches it another way, it can stay JavaScript** — through `ctx` for popup features instantiated by `popup.js` (`queue.js`, Phase 5c), or as a global for what an entrypoint loads (`background.js`, Phase 5b). Those slices stay much smaller.

Two corollaries worth knowing before you cut: a module that stops publishing its own global and lets `composicion.ts` publish it makes that global appear **later** in the load chain — check nobody consumes it in the gap, because the bundler won't tell you. And `sitio/ramonnet/config.js` — the file that was blocking everything, since `composicion.ts` couldn't import it — **is `config.ts` since Phase 5c**, which unblocks injecting the probe URL and moving `conexion.ts` into `core/`.

### Execution contexts — the rules that bite

The extension runs in isolated JS contexts (popup / service worker / offscreen) that share no memory and talk only through two ports: `PuertoMensajeria` (IPC, over `chrome.runtime`) and `PuertoAlmacenamiento` (over `chrome.storage`, local + session). **What each file contains and why → `docs/architecture.md` §Qué hace cada archivo, y qué regla respeta**; the zone and layer tables are in the same doc, and the migration history in `docs/rearquitectura-diseno.md`. What follows is only what you can get wrong without reading them:

- **IPC goes through `PuertoMensajeria`, never `chrome.runtime` directly.** `enviar()` awaits a reply and rejects on channel failure; `notificar()` is fire-and-forget and never rejects — pick one per call-site, deliberately. The `chrome.runtime.lastError` reads still in `popup.js` belong to its `tabs`/`scripting` callbacks; that's how every callback-style `chrome.*` API reports errors, not an IPC leak.
- **Storage goes through `PuertoAlmacenamiento`.** There is no `chrome.storage` in the project outside `plataforma/chrome/almacenamiento.ts`, and it should stay that way. Downloads only ever happen in `background.js`, which keeps the active download in the session scope (`SessionState`) and the queue/progress in the local one.
- **Connection state has one owner: the `Conexion` daemon.** Never add an ad-hoc `/api/health` call or internet-HEAD probe anywhere else — read `Conexion.get()` or subscribe.
- **A new UI concern is a feature, not a free function in `popup.js`** — `Feature.crear(ctx)`, dependencies through `ctx` (`nodos`, callbacks, `ctx.mensajeria`, `ctx.sitio`). What's left in `popup.js` (init + wiring + render/scraping/IPC orchestration) is the end state ADR-0005 defines, and `scraping` is explicitly **not** to be extracted. Gotcha if you touch filters: `filtrosActivos` travels **by reference** in `ctx`, because `popup.js` still mutates it.
- **A new Preact island's DOM boundary must be a region the vanilla code holds no `nodos.*` references to** (stale refs) — read `docs/preact-migration.md` before adding one.
- **Site-specific constants go in `sitio/<portal>/config.ts`**, never inline in a feature or in the engine; one enters `PuertoSitio` only if something *outside* `sitio/` reads it. The flip side: don't re-add portal vocabulary to `Utils`, `HlsEngine` or `Conexion`, which are generic now.
- **`ErrorBackend.tipoBackend: "rechazo"` means 4xx only** (skip the class), never 5xx (pause + auto-heal). That distinction is the bug-400 fix; it's a type now, not a comment.
- **A module that gets decoupled from `chrome.*` is instantiated in `plataforma/composicion.ts`**, the composition root — which is also what publishes its global, with the load-order consequence spelled out in the corollary above.

### State ownership split

State is intentionally split, not shared: **`AppState`** (popup, `chrome.storage.local`) owns the scraped class list + UI selection/filters; **`SessionState`** (service worker, `chrome.storage.session`) owns the active download's runtime state. They reconcile only via the `obtener_estados_en_progreso` IPC round-trip — the popup must never assume its cached per-class `estado` is current without it. Full schema + invariants → `docs/data-model.md`; the ownership pattern and its rationale → `docs/patterns.md` §State ownership split.

### Naming conventions

Identifiers, comments, and log messages throughout the codebase are written in Spanish (matching the target platform's locale — e.g. `ráfaga` = "burst"/download run, `cola` = queue, `cátedra` = course section A–D, `frenado suave` = graceful pause, `rafaga` = active download burst). Match this convention when adding new code rather than switching to English.

### File-level version headers

Most files carry a version-numbered docstring banner at the top (e.g. `V5.6.0`) with a changelog of recent fixes. When making a non-trivial fix or behavior change to one of these files, follow the existing pattern: bump the version and add a `CHANGELOG` bullet describing the fix, rather than leaving the change undocumented.

### Key domain-specific behavior to preserve

- **Title parsing** (`sitio/ramonnet/parserTitulos.js` — `formatTitleStructured` / `clasificarCatedraYCarpeta`, reached via `SitioActivo.parsearTitulo` / `.clasificarCarpeta`; was in `shared/utils.js` until v6.0.0): derives the canonical filename + cátedra/folder from messy scraped titles. It's the most regression-sensitive logic in the project (regex order matters) — if a change silently mis-files or mis-names classes, look here. Mechanism, the `>12` date heuristic, and the classification order → `docs/patterns.md` §Sanitización y parsing.
- **M3U8 resolution** (`ResolverManifiesto.resolver`, `sitio/ramonnet/resolverManifiesto.js` — was `HlsEngine.extraerEnlaceMaestroM3u8Clasico` until 2026-08-02): primarily extracts the active `<iframe>` pointing at `b-cdn.net`/`mediadelivery.net`, pulls the UUID hash, and constructs `https://vz-c3e7bda8-f29.b-cdn.net/{hash}/480p/video.m3u8` directly — falls back to three progressively looser regex scans of the raw HTML only if the iframe match fails. This is fragile against upstream markup changes; if downloads start resolving the wrong class's video, check this function first.
- **`declarativeNetRequest`** (`public/sitio/ramonnet/rules.json`) blocks `bunnyinfra.net` image/xhr/other requests — intentional, not a bug (rationale → `docs/security.md` permisos).
