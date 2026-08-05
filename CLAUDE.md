# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> ## ⚠️ Trabajo en curso — leer esto primero
>
> Hay una **re-arquitectura activa** (puertos y adaptadores + TypeScript + WXT), ya en su
> tramo final: **fases 0 a 8a completas** (al 2026-08-04); la 8b queda como *decisión abierta*,
> no como pendiente. Del `globalThis` quedan **5 nombres, todos de Capa 2** (`Utils`,
> `SitioRamonNet`, `ParserTitulos`, `Scraper`, `ResolverManifiesto`), y ahí el global es **una
> decisión, no inercia** — ver la 8b antes de "limpiarlo".
>
> **Y hay un segundo frente activo desde el 2026-08-04: el multi-sitio** (que la misma extensión
> maneje N portales). **Son 8 cortes**: el que sigue es el 5 (el popup resolviendo por
> pestaña), que es el de más riesgo porque no hay tests sobre el núcleo de `popup.js`, y el 7
> es el que recién entrega la feature —el manifest y el primer adaptador real del segundo
> portal, sin más red que la verificación en navegador—. **Cuáles están hechos se lee en
> `docs/multisitio-diseno.md` §Orden de cortes, no acá** (esa tabla es la fuente viva); la
> decisión de fondo, en ADR-0010. Dato de arquitectura que ya cambió y conviene tener: **el
> service worker no tiene UN portal** — el bucle resuelve el del ítem (corte 3) y la
> notificación el suyo por el `notificationId` (corte 8), así que `sitioAsumido` sólo sigue
> vivo del lado del popup. Antes de tocar código:
>
> **Leé `docs/rearquitectura-diseno.md` §Cómo retomar esto en una sesión nueva.** Ahí está el
> orden de lectura, el estado por fase, qué sigue y con qué riesgo, y las 4 verificaciones a
> correr antes de empezar (`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` —
> las cuatro tienen que quedar en verde; los números esperados de cada una viven en
> `docs/testing.md`, no acá).
>
> **Todo lo mergeado está verificado en navegador.** La regla es **una rama por corte y no se
> mergea sin que el dueño lo pruebe en Chrome**, y no es ceremonia: los tres únicos defectos
> que llegaron a `main` en toda la re-arquitectura los encontró usar la extensión, no la suite
> — un warning que describía mal una condición del navegador, la barra de progreso del backend
> que un refactor se comió (nada la afirmaba), y el empaquetado de la Fase 3. **Lo que la
> suite no puede ver: el empaquetado, el orden de carga de los globals, el núcleo de
> `popup.js` y cualquier efecto cuyo destino sea una ventana que no es el popup.**
>
> El checklist concreto de esa verificación —7 puntos, no "probá que ande"— es
> `docs/rearquitectura-diseno.md` §Verificación en navegador. Su disparador declarado es
> *"cada fase que toque empaquetado, entrypoints o el adaptador de sitio"*. Las fases que lo
> disparaban ya se mergearon; **hoy quien lo dispara son los cortes del multi-sitio que
> quedan** — el 5 toca el popup y el 7 toca manifest y adaptador de sitio, o sea de lleno.
> Corré esos 7 puntos antes de pedir el merge, no una prueba improvisada.

## Project Overview

RamonNet Video Downloader (Turbo Edition) is a Manifest V3 Chrome/Brave browser extension that bulk-downloads HLS-streamed recorded classes from the "Ramón Net" learning platform (`plataforma.ramonnet.com.ar`). It scrapes the class listing DOM, resolves each class's HLS `.m3u8` manifest, downloads and decrypts (AES-128-CBC) the `.ts` fragments concurrently, and streams the decrypted fragments to a companion local Bun backend server (`ramonnet-bun-backend`, a separate repo/folder not included here) running on `http://localhost:3001`, which assembles them on disk. **The extension is compiled** (since 2026-08-02, Phase 3 of the re-architecture): WXT + Vite bundle it into `.output/chrome-mv3/`, which is the folder loaded in the browser — *not* the repo root. `manifest.json` is no longer hand-written; it is generated from `wxt.config.ts`. ADR-0001 (no bundler) is superseded by ADR-0008. **The core is now TypeScript and lives in `core/`** — ports, download queue, HLS engine, connection daemon, popup state, backend client, failure history and pure utilities; `plataforma/` holds the Chrome side of every port, and `sitio/ramonnet/` everything about the portal. `chrome.*` does still appear outside `plataforma/`, deliberately — the inventory (by API, not by file) is in `docs/architecture.md` §Las capas, and you want it before touching Phase 7 or 8. What is still vanilla JS — **and the list matters, because `allowJs` is `false` and it's exactly which files are `.js` that sizes every migration slice**: `popup.js` (the orchestrator), `renderers.js`, `background.js` (now mostly wiring), the site adapter's three sibling modules, the **ten `popup/features/*.js`**, and the **two entrypoints** (`entrypoints/background.js` + `entrypoints/popup/main.js` — that last pair is why `tsc` skips the whole import graph; see the `allowJs` section below).

## Documentation as Code

This project treats `docs/` as the technical source of truth, maintained with the same discipline as source code — a PR that changes storage shape, IPC contracts, or business logic updates the relevant doc in the same PR (see `docs/contributing.md` for the checklist). Docs also follow a **DRY / single-source-of-truth convention**: each concept has one canonical doc; everything else summarizes + links rather than re-explaining (rationale in `docs/adr/0007-dry-docs-canonical-homes.md`, the actionable rule + canonical-homes map in `docs/contributing.md`). When adding docs, don't paste an explanation that already lives elsewhere — link it. `README.md` remains the accurate end-user install guide and is not superseded by `docs/` — they serve different audiences.

Start at **`docs/architecture.md`**. Full map:
- `docs/architecture.md` — system overview, execution zones, the layer map, end-to-end download flow, and **§Qué hace cada archivo, y qué regla respeta: the canonical, per-file detail of what every module contains** (§Execution contexts below is only the digest of rules, and points here).
- `docs/tech-stack.md` — why each technology was chosen, alternatives rejected.
- `docs/data-model.md` — `chrome.storage.local`/`.session` schema (this project's equivalent of a DB schema).
- `docs/patterns.md` — the patterns actually implemented in code (IPC dispatch, state ownership split, worker pool, ad-hoc circuit breaker, etc.).
- `docs/coding-standards.md` — naming conventions, file version-header convention, module-export pattern.
- `docs/contributing.md` — local dev setup, debugging, PR checklist.
- `docs/testing.md` — testing strategy, coverage narrative, and the **baseline of the 4 verifications**. Canonical home for every one of those numbers; nothing else repeats them.
- `docs/security.md` — permission rationale and the untrusted-scraped-content rule.
- `docs/deployment.md` — extension distribution + the companion Bun backend contract.
- `docs/adr/` — immutable Architectural Decision Records. Never edit an existing ADR; a changed decision gets a new ADR that marks the old one superseded (see `docs/adr/README.md`).
- `docs/TECHNICAL_DEBT.md` — the backlog. **§🔴 Abierto is the whole of it**; everything below is a dated ✅ record, so don't read the rest as a to-do list (the doc's own header explains the convention). Never copy the open items into this file.
- `docs/ROADMAP.md` — phased plan to pay down the backlog, in dependency order.
- `docs/preact-migration.md` — live status of the incremental Preact-islands migration of the popup (which islands are done/next, the DOM-boundary rule, and a recipe for adding one). See also ADR-0006.
- `docs/rearquitectura-diseno.md` — execution design (the "how") for the ports-and-adapters + TypeScript re-architecture: target folder layout, port interfaces, the generic-vs-site UI/CSS split, testing strategy under the new layers, bundler choice, migration order + execution rules (coexistence with the vanilla root, per-phase verification, rollback). The *decision* lives in ADR-0008 (supersedes ADR-0001); this is its counterpart design/status doc, like `preact-migration.md`. **The live per-phase status lives there, not here** (§Estado de avance) — read its §Cómo retomar esto en una sesión nueva first, and see the banner at the top of this file for the one-line summary. Note the doc's original `src/` layout was dropped in execution: `wxt.config.ts` sets `srcDir: '.'`, so sources stayed at the repo root.
- `docs/multisitio-diseno.md` — execution design for making **one installed extension serve N portals** (the goal ADR-0009 chose and never built). Read it before touching the site layer: it holds the measured consumer map, the five real coupling points, and the cut order. Note what the fifth one teaches: the original measurement swept the download loop and the UI but **not the service worker's loose listeners**, and missed a user-visible wrong-portal bug for a day — when you measure the site coupling, sweep the listeners too. Its decision counterpart is ADR-0010 (**the site is a property of the item, not of the build**) — that one exists because "resolve by URL" works for the popup and *not* for the service worker, whose queue is deliberately detached from any tab.
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

**On a fresh clone, `npm install` comes first — and not only for `node_modules`.** `tsconfig.json` extends `./.wxt/tsconfig.json`, and `.wxt/` is a gitignored build artifact generated by the `postinstall` hook (`wxt prepare`). Skip the install and `npx tsc --noEmit` fails on the missing base config, which reads like a broken repo rather than a missing step.

- **Run tests**: `npm test` (single run) or `npm run test:watch`. To run one file/test: `npx vitest run core/util/texto.test.ts` or `npx vitest run -t "<test name>"`. **There is no `vitest.config.*` in the repo** — the suite runs on Vitest's defaults, which means the `node` environment: a test that touches the DOM (a `popup/features/` feature, any Preact island) needs `// @vitest-environment jsdom` as its own docblock at the top of the file, or it dies with `document is not defined` (about half the suite carries one — copy it from any sibling test). Modules are ES modules that also publish their object as a global side-effect (`globalThis.X = X; export default X`) — the export feeds the bundler and the tests, the global keeps ~200 existing call-sites working untouched. See `docs/coding-standards.md`. Tests sit next to what they cover, so `git ls-files '*.test.*'` is the inventory — don't look for a list here. **What the suite covers and what it deliberately doesn't → `docs/testing.md`, the canonical home for both the counts and the coverage narrative.**
- **Lint**: `npm run lint` (ESLint 9 flat config, rules `no-undef`/`no-unused-vars`/`eqeqeq`; `.ts` goes through typescript-eslint). When you add a new cross-file global (a `globalThis.X` consumed elsewhere), add it to `globalesDelProyecto` in `eslint.config.js` or `no-undef` will false-positive. **A new *warning* is a regression here, not just an error** — the baseline is clean on both, and that's the part worth knowing before you shrug one off. The numbers themselves → `docs/testing.md`.
- **Typecheck**: `npx tsc --noEmit` (must stay clean). TypeScript is pinned to 5.x on purpose — typescript-eslint does not support TS 7 yet, and losing lint on the migrating core is worse than the compiler's speed gain. **`tsconfig.json`'s `include` list is what it actually covers, and that is not automatic**: `allowJs` is `false` and both entrypoints are `.js`, so `tsc` skips them and with them the whole import graph — **a folder of `.ts` that isn't listed passes the gate green with nobody looking at it**, which has already happened for months at a time. **Don't read `entrypoints/**/*` in the list as coverage**: it's there and contributes nothing; that line is the trap, not the escape from it. So: when a migration puts `.ts` under a new root, add it to `include` in the same change and confirm with `npx tsc --noEmit --listFiles`. Which folders are covered today, and the measured file count → `docs/testing.md`.
- **Load/reload the extension**: `npm run build`, then `chrome://extensions/` → "Developer mode" → "Load unpacked" → select **`.output/chrome-mv3/`** (loading the repo root no longer works). Re-run the build and click reload after each change, or use `npm run dev` for WXT's watch mode with HMR.
- **Debug the popup**: right-click the extension icon → "Inspect popup" (or open it and press F12). Note the whole popup graph is bundled into one chunk (`.output/chrome-mv3/chunks/popup-*.js`) and **`wxt build` emits no sourcemaps** — for anything beyond a stack trace, use `npm run dev`, which serves readable sources with HMR.
- **Debug the service worker**: on `chrome://extensions/`, click "service worker" (or "Inspect views: service worker") under this extension to get DevTools for `background.js` and the engine it drives (`core/hls/hlsEngine.ts`).
- **Companion backend required for actual downloads**: Turbo Mode (`modoTurboBun`) is hardcoded to `true` throughout the codebase, meaning fragments are always streamed to the local Bun backend rather than assembled in-browser. Without the Bun server running on port 3001, downloads will fail at the streaming step — start it separately per the backend's own instructions before testing end-to-end downloads.
- **Not shipped, don't edit as if it were live code**: `wxt.config.ts` is the authority on the manifest, and `.output/` on what the browser loads (both `.output/` and `.wxt/` are gitignored build artifacts — never edit them). `prototype/preact-serverConnection/` is a standalone, throwaway demo (its own vendored Preact copy) that proved out ADR-0006 — it duplicates connection-feature logic and is intentionally *not* kept in sync with `popup/features/serverConnection.js`. `.agents/skills/` + `skills-lock.json` are vendored agent skills (`chrome-extensions` from `googlechrome/modern-web-guidance`, `frontend-design` from `anthropics/skills`); consult `.agents/skills/chrome-extensions/references/` for MV3 API questions (service worker lifecycle, `declarativeNetRequest`, storage, popup UI) instead of guessing.
- **Opening a PR**: `.github/PULL_REQUEST_TEMPLATE.md` encodes the docs-as-code checklist (storage shape → `data-model.md`; new IPC action → `architecture.md`/`patterns.md`; architectural decision → new ADR; scraped-content handling → `security.md`; debt resolved → mark it in `TECHNICAL_DEBT.md`). Fill it rather than replacing the body.
- The test/lint baselines are hand-maintained and live in **one place: `docs/testing.md`** (§Baseline de las verificaciones). When you add tests or a new file, update them there in the same change — the same rule the docs get. Don't re-state a count in this file; the whole point of the single home is that it can't drift against a copy.
- A legacy non-Turbo code path (in-browser blob assembly via the `offscreen` document + `chrome.downloads`) still exists in `background.js`/`plataforma/chrome/descargas.ts` but is currently unreachable (`establecerModoTurbo` forces `true`). Why the two paths exist → `docs/tech-stack.md` §Por qué Bun.

## Architecture

### Where files live after the WXT migration (Phase 3)

Sources stayed at the repo root (`srcDir: '.'`); only **entrypoints** and **verbatim-copied assets** moved. The things that used to be at the root and are now gone (or moved) are the usual source of confusion:

- **`manifest.json`** → generated from `wxt.config.ts`. Edit the config, never the output.
- **`popup.html`** → `entrypoints/popup/index.html` (asset paths in it are relative, hence the `../../` prefixes).
- **The `<script>`/`importScripts` load order** → replaced by the *import order* in the two entrypoints. **The two no longer work the same way**, and that's the thing to get right when adding a module:
  - `entrypoints/popup/main.js` — **injects and mounts** (Phases 7b/7c): `iniciarPopup(deps)`, plus `montar(root, deps)` for the three islands that depend on a service. Since Phase 8a its import order is **no longer load-bearing for the popup's own modules** — features and island bridges travel by `import`, so the bundler's graph resolves them. **The one thing still order-dependent is the site adapter** (`sitio/ramonnet/*.js`), which must be imported first because its globals are read lazily by everything else. Get that wrong and the popup breaks at runtime with nothing to warn you.
  - `entrypoints/background.js` — **injects instead** (Phase 7a): it calls `iniciarServiceWorker(deps)` with named dependencies, so order stopped mattering and a missing piece is an `undefined` in the call, not a `ReferenceError` mid-download. **Keep that call in the entrypoint's top level** — never inside `defineBackground`'s callback or behind an `await`, or MV3 loses the listeners on a cold start.
- **`public/`** is copied verbatim into the output: `public/offscreen/` (the legacy offscreen document) and `public/sitio/ramonnet/rules.json` (the dNR ruleset, referenced by that path from `wxt.config.ts`). Files there are *not* bundled — they can't use ES imports and must stay self-contained.

### Where the CSS lives

One rule, because breaking it fails silently: a new UI region needs `styles/components/<nombre>.css` **plus** its `@import` line in `popup/globals.css` — miss the second and the file is never bundled, with no error anywhere. Layout, cascade order and the islands' inline-vs-stylesheet split → `docs/architecture.md` §Popup ("El CSS: una sola cadena de `@import`"). The generic-vs-site split Phase 6c designed here was evaluated and dropped → `docs/rearquitectura-diseno.md` §Registro de la Fase 6c.

### When a migration forces a file into TypeScript (the `allowJs` rule)

`allowJs` is `false`, so **a `.ts` file cannot import a `.js` file** — the constraint that sizes every migration slice. It turns on *who instantiates the module*, not on what the module does: if `plataforma/composicion.ts` has to import it, moving it onto a port forces TypeScript **in the same slice**; if the port reaches it through `ctx` (popup features) or as a global (what an entrypoint loads), it can stay JavaScript and the slice stays small. Two corollaries bite before you cut — a module that lets `composicion.ts` publish its global makes that global appear **later** in the load chain (nobody may consume it at module-evaluation time, and the bundler won't tell you), and the constraint runs both ways (`composicion.ts` can't import `background.js` either).

**Read `docs/rearquitectura-diseno.md` before cutting** — it's the canonical home for this rule, its corollaries and the worked cases (which slice each one forced, and what the measurement missed). What isn't optional there: **measure the slice before executing it.** All four times that got skipped the slice turned out to be a different size than the plan said.

### Execution contexts — the rules that bite

The extension runs in isolated JS contexts (popup / service worker / offscreen — plus the portal's own tab, where the scraper is injected) that share no memory and talk only through ports: `PuertoMensajeria` (IPC, over `chrome.runtime`), `PuertoAlmacenamiento` (over `chrome.storage`, local + session) and `PuertoProgramador` (over `chrome.alarms`, the auto-heal tick). **What each file contains and why → `docs/architecture.md` §Qué hace cada archivo, y qué regla respeta**; the zone and layer tables are in the same doc, and the migration history in `docs/rearquitectura-diseno.md`. What follows is only what you can get wrong without reading them:

- **IPC goes through `PuertoMensajeria`, never `chrome.runtime` directly.** `enviar()` awaits a reply and rejects on channel failure; `notificar()` is fire-and-forget and never rejects — pick one per call-site, deliberately. The `chrome.runtime.lastError` reads still in `popup.js` belong to its `tabs`/`scripting` callbacks; that's how every callback-style `chrome.*` API reports errors, not an IPC leak.
- **Storage goes through `PuertoAlmacenamiento`.** There is no `chrome.storage` in the project outside `plataforma/chrome/almacenamiento.ts`, and it should stay that way. Downloads only ever happen in the service worker, whose queue (`core/cola/procesadorCola.ts`) keeps the active download in the session scope (`SessionState`) and the queue/progress in the local one.
- **Scheduling goes through `PuertoProgramador`, never `chrome.alarms`.** It is not "a timer with another face": in MV3 the service worker suspends and takes any `setInterval` with it, while an alarm survives and **wakes the worker**. That is the whole reason the auto-heal works.
- **`chrome.*` does still live outside `plataforma/`, and that residue is not a to-do.** The three ported APIs are gone everywhere else, but `notifications`/`tabs`/`windows`/`scripting` and the legacy `downloads`/`offscreen` path never got a port on purpose. **Count it by API and only after filtering comments** — every `chrome.` hit in `core/`, `sitio/*.ts` or `popup/features/` is prose, not a call, and counting by file has already invented work that didn't exist. The inventory (which API, which file, which port is pending) → `docs/architecture.md` §Las capas.
- **Connection state has one owner: the `Conexion` daemon.** Never add an ad-hoc `/api/health` call or internet-HEAD probe anywhere else — read `Conexion.get()` or subscribe.
- **A new UI concern is a feature, not a free function in `popup.js`** — `Feature.crear(ctx)`, dependencies through `ctx` (`nodos`, callbacks, `ctx.mensajeria`, `ctx.sitio`). What's left in `popup.js` (init + wiring + render/scraping/IPC orchestration) is the end state ADR-0005 defines, and `scraping` is explicitly **not** to be extracted. Gotcha if you touch filters: `filtrosActivos` travels **by reference** in `ctx`, because `popup.js` still mutates it.
- **A new Preact island's DOM boundary must be a region the vanilla code holds no `nodos.*` references to** (stale refs) — read `docs/preact-migration.md` before adding one.
- **The site is a property of the item, not of the build** (ADR-0010). `sitio/ramonnet/config.ts` describes *its* portal and nothing more; **which portal is active is `sitio/registro.ts`'s call** — `resolverPorUrl()` for the active tab, `obtener(sitioId)` for anything that outlives the tab. **Never re-add a `SitioActivo`-style alias inside a portal's config**: that was exactly the shape in which ADR-0009 sat "decided but not built" for two days. And know the distinction that bites: a **missing** `sitioId` is pre-multi-site data and resolves to the legacy portal; a **present but unregistered** one is an orphan and must not resolve — conflating them either skips a real user's whole queue or downloads with the wrong adapter, both silently. That rule lives in **one** place, the `sitios` export of `plataforma/composicion.ts`, shared by the SW and the popup so they cannot diverge (`docs/multisitio-diseno.md` §La trampa del corte 3).
- **Site-specific constants go in `sitio/<portal>/config.ts`**, never inline in a feature or in the engine; one enters `PuertoSitio` only if something *outside* `sitio/` reads it. The flip side: don't re-add portal vocabulary to `Utils`, `HlsEngine` or `Conexion`, which are generic now. **The one exception is the next bullet** — the injected scraper cannot reach `config.ts` at all.
- **`Scraper.escanearAulaVirtual` (`sitio/ramonnet/scraper.js`) runs in the portal's tab, not in the extension**, so it must stay **self-contained and serializable** — no extension global, not even a module-level constant of its own file; everything travels through `args`. Hoisting a selector out of it into `config.ts` — the move the previous bullet otherwise asks for — breaks scanning at runtime and **nothing catches it**: not the bundler, not lint, not `tsc`, not the suite. Verify in the browser. Full rule → `docs/architecture.md` §Capa 2.
- **`ErrorBackend.tipoBackend: "rechazo"` means 4xx only** (skip the class), never 5xx (pause + auto-heal). That distinction is the bug-400 fix; it's a type now, not a comment.
- **The download loop's failure classification has four branches and the order is load-bearing** (`core/cola/procesadorCola.ts`): user cancel → `"sesion"` → 4xx `"rechazo"` → anything else. The first three are classified **before** asking the connection daemon, because the daemon would mislabel every one of them. Each branch exists because of a real bug; read the module header before touching it.
- **Progress has two destinations, not one**: the IPC to the popup *and* `actualizarConsolaBackend`, the bar in the Bun server window — which is the only one the user sees with the popup closed. Losing the second breaks nothing, so nothing catches it (that happened in Phase 6b; it has a test now).
- **A module that gets decoupled from `chrome.*` is instantiated in `plataforma/composicion.ts`**, the composition root — and since Phase 7c it publishes **exactly one global**, `Utils`, kept only because the site adapter's `.js` siblings read it. A *sibling* module (a feature, an island bridge) is not injected at all: it travels by `import` (Phase 8a), because it isn't a swappable adapter. The exception is anything a test needs to double — the three island bridges `serverConnection.js` consumes go through `ctx` for exactly that reason. Everything else is a named export that an entrypoint injects. **Adding a `globalThis.X` there is walking the migration backwards**; if a new consumer needs something, it takes it as a parameter. Same for `globalesDelProyecto` in `eslint.config.js`: re-declaring a service there silently re-enables reading it off `globalThis`, and it was `no-undef` — not the measurement — that caught the last real reader.

### State ownership split

State is intentionally split, not shared: **`AppState`** (popup, `chrome.storage.local`) owns the scraped class list + UI selection/filters; **`SessionState`** (service worker, `chrome.storage.session`) owns the active download's runtime state. They reconcile only via the `obtener_estados_en_progreso` IPC round-trip — the popup must never assume its cached per-class `estado` is current without it. Full schema + invariants → `docs/data-model.md`; the ownership pattern and its rationale → `docs/patterns.md` §State ownership split.

### Naming conventions

Identifiers, comments, and log messages throughout the codebase are written in Spanish (matching the target platform's locale — e.g. `ráfaga` = "burst"/download run, `cola` = queue, `cátedra` = course section A–D, `frenado suave` = graceful pause, `rafaga` = active download burst). Match this convention when adding new code rather than switching to English.

### File-level version headers

Most files carry a version-numbered docstring banner at the top (e.g. `V5.6.0`) with a changelog of recent fixes. When making a non-trivial fix or behavior change to one of these files, follow the existing pattern: bump the version and add a `CHANGELOG` bullet describing the fix, rather than leaving the change undocumented.

### Key domain-specific behavior to preserve

- **Title parsing** (`sitio/ramonnet/parserTitulos.js` — `formatTitleStructured` / `clasificarCatedraYCarpeta`, reached via the injected descriptor's gates (`sitio.parsearTitulo` / `.clasificarCarpeta`); was in `shared/utils.js` until v6.0.0, a file that no longer exists): derives the canonical filename + cátedra/folder from messy scraped titles. It's the most regression-sensitive logic in the project (regex order matters) — if a change silently mis-files or mis-names classes, look here. Mechanism, the `>12` date heuristic, and the classification order → `docs/patterns.md` §Sanitización de nombres de archivo y parsing de títulos.
- **M3U8 resolution** (`ResolverManifiesto.resolver`, `sitio/ramonnet/resolverManifiesto.js` — was `HlsEngine.extraerEnlaceMaestroM3u8Clasico` until 2026-08-02): fragile against upstream markup changes by construction, and its regex fallbacks degrade *silently* (they can resolve another class's video instead of failing). **If downloads start bringing the wrong video, look here first, not at the engine** — the engine only ever receives the already-resolved URL. Mechanism and the four consequences → `docs/architecture.md` §Capa 2.
- **`declarativeNetRequest`** (`public/sitio/ramonnet/rules.json`) blocks `bunnyinfra.net` image/xhr/other requests — intentional, not a bug (rationale → `docs/security.md` permisos).
