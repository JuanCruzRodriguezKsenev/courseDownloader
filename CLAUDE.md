# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RamonNet Video Downloader (Turbo Edition) is a Manifest V3 Chrome/Brave browser extension that bulk-downloads HLS-streamed recorded classes from the "Ramón Net" learning platform (`plataforma.ramonnet.com.ar`). It scrapes the class listing DOM, resolves each class's HLS `.m3u8` manifest, downloads and decrypts (AES-128-CBC) the `.ts` fragments concurrently, and streams the decrypted fragments to a companion local Bun backend server (`ramonnet-bun-backend`, a separate repo/folder not included here) running on `http://localhost:3001`, which assembles them on disk. The extension itself has no bundler and no runtime dependencies — it's plain vanilla JS/HTML/CSS loaded directly by the browser via `manifest.json`. The only `package.json` is dev-only (Vitest + jsdom for the test suite, ESLint for linting); it is never shipped and adds no build step (see `docs/adr/0001-no-bundler-or-typescript-yet.md`).

## Documentation as Code

This project treats `docs/` as the technical source of truth, maintained with the same discipline as source code — a PR that changes storage shape, IPC contracts, or business logic updates the relevant doc in the same PR (see `docs/contributing.md` for the checklist). Docs also follow a **DRY / single-source-of-truth convention**: each concept has one canonical doc; everything else summarizes + links rather than re-explaining (rationale in `docs/adr/0007-dry-docs-canonical-homes.md`, the actionable rule + canonical-homes map in `docs/contributing.md`). When adding docs, don't paste an explanation that already lives elsewhere — link it. `README.md` remains the accurate end-user install guide and is not superseded by `docs/` — they serve different audiences.

Start at **`docs/architecture.md`**. Full map:
- `docs/architecture.md` — system overview, execution zones, end-to-end download flow.
- `docs/tech-stack.md` — why each technology was chosen, alternatives rejected.
- `docs/data-model.md` — `chrome.storage.local`/`.session` schema (this project's equivalent of a DB schema).
- `docs/patterns.md` — the patterns actually implemented in code (IPC dispatch, state ownership split, worker pool, ad-hoc circuit breaker, etc.).
- `docs/coding-standards.md` — naming conventions, file version-header convention, module-export pattern.
- `docs/contributing.md` — local dev setup, debugging, PR checklist.
- `docs/testing.md` — testing strategy and current coverage (a Vitest suite now exists — see the test-file list under Development Workflow — though many contexts, e.g. the service worker, remain untested).
- `docs/security.md` — permission rationale and the untrusted-scraped-content rule.
- `docs/deployment.md` — extension distribution + the companion Bun backend contract.
- `docs/adr/` — immutable Architectural Decision Records. Never edit an existing ADR; a changed decision gets a new ADR that marks the old one superseded (see `docs/adr/README.md`).
- `docs/TECHNICAL_DEBT.md` — open issues backlog, with exact file/line locations.
- `docs/ROADMAP.md` — phased plan to pay down the backlog, in dependency order.
- `docs/preact-migration.md` — live status of the incremental Preact-islands migration of the popup (which islands are done/next, the DOM-boundary rule, and a recipe for adding one). See also ADR-0006.

Security rule (operational summary — full policy and rationale in `docs/security.md`): scraped/third-party text must never be interpolated into `.innerHTML` unescaped. Since Preact island #4 the live list renders through `<TarjetaEstado>`/`<FilaClase>` (`listaClases.preact.js`), so escape at the `window.ListaClases` view-model boundary that feeds them. The original `popup.js` XSS is fixed (2026-07-16).

## Development Workflow

The shipped extension is unpacked, hand-written JS loaded directly by the browser — no build tool. A dev-only Vitest suite plus a dev-only ESLint (both never shipped, no build step) exist for the source:

- **Run tests**: `npm test` (single run) or `npm run test:watch`. To run one file/test: `npx vitest run shared/utils.test.js` or `npx vitest run -t "<test name>"`. Modules are made testable via the dual-export footer (`module.exports` for Node/Vitest, `window`/`self` for the browser) — see `docs/coding-standards.md`. Current tests: `shared/utils.test.js`, `shared/conexion.test.js`, `shared/bunClient.test.js`, `popup/features/serverConnection.test.js`, `popup/features/queue.test.js`, `popup/features/conexionHeader.preact.test.js`, `popup/features/onboarding.preact.test.js`, `popup/features/rutaDisco.preact.test.js`, `popup/features/bannerConexion.preact.test.js`, `popup/features/listaClases.preact.test.js`, `background/hlsEngine.test.js`, `background.test.js`.
- **Lint**: `npm run lint` (ESLint 9 flat config in `eslint.config.js`, rules `no-undef`/`no-unused-vars`/`eqeqeq`). Config-only, no autofix wired. Globals are declared per execution context (SW+`importScripts`, popup+`<script>`, dual-export CommonJS, Preact-island ESM, test files) — when you add a new cross-file global (a `window.X`/`self.X` export consumed elsewhere) or a new island, add it to the matching block or `no-undef` will false-positive. Baseline is 0 errors / 10 warnings; keep new code from adding errors.
- **Load/reload the extension**: `chrome://extensions/` → enable "Developer mode" → "Load unpacked" → select this repo's root folder. After any code change, click the reload icon on the extension card (service worker and popup do not hot-reload).
- **Debug the popup**: right-click the extension icon → "Inspect popup" (or open it and press F12) to get DevTools for `popup.js`/`popup/scraper.js`.
- **Debug the service worker**: on `chrome://extensions/`, click "service worker" (or "Inspect views: service worker") under this extension to get DevTools for `background.js` and `background/hlsEngine.js`.
- **Companion backend required for actual downloads**: Turbo Mode (`modoTurboBun`) is hardcoded to `true` throughout the codebase, meaning fragments are always streamed to the local Bun backend rather than assembled in-browser. Without the Bun server running on port 3001, downloads will fail at the streaming step — start it separately per the backend's own instructions before testing end-to-end downloads.
- A legacy non-Turbo code path (in-browser blob assembly via the `offscreen` document + `chrome.downloads`) still exists in `background.js`/`shared/utils.js` but is currently unreachable (`establecerModoTurbo` forces `true`). Why the two paths exist → `docs/tech-stack.md` §Por qué Bun.

## Architecture

### Execution contexts and message passing

The extension is split across isolated JS execution contexts that only communicate via `chrome.runtime.sendMessage` / `onMessage` (fire-and-forget or async-response IPC) and `chrome.storage` (local + session):

- **`popup.js`** (+ `popup/scraper.js`, `renderers.js`, `popup/features/*`) — runs in the popup window. Orchestrates all UI state, tab switching (Disponibles/Cola), filtering/search, and drives DOM scraping by injecting `Scraper.escanearAulaVirtual` into the active Ramón Net tab via `chrome.scripting.executeScript`. Talks to the service worker over IPC actions like `iniciar_descarga_cola`, `inyectar_items_en_cola_activa`, `obtener_estados_en_progreso`. Cohesive slices of popup behavior are being extracted into **`popup/features/`** self-contained modules (feature-driven split — see `docs/adr/0005-feature-driven-popup-split.md`, `docs/ROADMAP.md` Fase 2): each exports a factory `Feature.crear(ctx)` that receives its dependencies (DOM `nodos`, callbacks into `popup.js`) via a `ctx` object rather than reaching into the popup's closure. Extracted so far: `serverConnection.js` (connection UI + auto-heal) and `queue.js` (`QueueFeature` — full queue lifecycle: enqueue/dequeue, cancellation, start, resume-after-drop). Add new UI concerns as features in this shape, not as more free functions in `popup.js`. **Preact islands (in-progress, no build):** cohesive UI regions are also being migrated to Preact (vendored build-less, loaded via `<script type="module">`; the service worker stays vanilla). Islands done: `conexionHeader` (status dot), `rutaDisco` (disk-path text), `bannerConexion` (connection-down banner), `onboarding` (welcome tour), `listaClases` (the class list — largest; owns `#ui-list` children and host attributes). **The full per-island map (DOM boundary, store-bridge, status, stage detail) and the recipe for adding one live in `docs/preact-migration.md` — read it before touching an island.** Operational rule when adding one: its DOM boundary must be a region the vanilla code does not hold `nodos.*` references to (avoid stale refs).
- **`background.js`** (service worker, MV3) — the only place downloads actually happen. Owns the persistent FIFO download queue, processes one item at a time (`procesarSiguienteElementoDeLaCola`), and survives SW suspension by keeping volatile-but-durable state in `chrome.storage.session` (`SessionState`) and long-lived queue/progress data in `chrome.storage.local`. Registers the `alarma_autoheal` alarm that resumes the queue once a dropped connection recovers (both this recovery check and download-error classification go through the `Conexion` daemon, not their own probes). The auto-heal / circuit-breaker mechanics → `docs/patterns.md` §Circuit breaker.
- **`background/hlsEngine.js`** (`HlsEngine`, imported via `importScripts` into the SW) — resolves the class page HTML to a Bunny/mediadelivery `.m3u8` URL (iframe hash extraction with several regex fallbacks), parses the M3U8 manifest for fragment URLs + `#EXT-X-KEY`, and runs a 6-worker concurrent pool (`CONCURRENCIA_MAXIMA`) that fetches, AES-decrypts, and (in Turbo mode) streams each fragment to the Bun backend via `BunClient.enviarFragmentoStream`.
- **`offscreen/offscreen.js`** — an MV3 offscreen document used only for the legacy non-Turbo path, because service workers lack `URL.createObjectURL`. Not exercised while Turbo mode is forced on.
- **`shared/`** — code shared across contexts (loaded by both `popup.html` via `<script>` tags and `background.js` via `importScripts`):
  - `state.js` (`AppState`) — the popup-side state machine; mirrors/persists to `chrome.storage.local` and periodically reconciles with the SW's authoritative progress via `sincronizarConBackground()`.
  - `bunClient.js` (`BunClient`) — thin fetch wrapper for every Bun backend endpoint (`/api/escanear-disco`, `/api/bypass-stream`, `/api/actualizar-consola`, `/api/seleccionar-carpeta`, `/api/health`, `/api/cancelar-descarga`). Exports to `window` or `self` depending on context.
  - `conexion.js` (`Conexion`) — the **single source of truth for connection state** (server + internet), loaded in both popup and SW; read via `Conexion.get()` or subscribe with `Conexion.suscribir(cb)`. **Operational rule: never add ad-hoc `/api/health` or internet-HEAD probes elsewhere — consume this daemon.** Push model, mirroring, and the full contract → `docs/patterns.md` §Daemon de estado de conexión.
  - `utils.js` (`Utils`) — title/filename sanitization and the class-title parser (`formatTitleStructured`, `clasificarCatedraYCarpeta`); AES decrypt helper; retry-with-backoff fetch (`fetchConReintentos`); progress/telemetry math. The parser's naming scheme and fragility → `docs/patterns.md` §Sanitización y parsing.

### State ownership split

State is intentionally split, not shared: **`AppState`** (popup, `chrome.storage.local`) owns the scraped class list + UI selection/filters; **`SessionState`** (service worker, `chrome.storage.session`) owns the active download's runtime state. They reconcile only via the `obtener_estados_en_progreso` IPC round-trip — the popup must never assume its cached per-class `estado` is current without it. Full schema + invariants → `docs/data-model.md`; the ownership pattern and its rationale → `docs/patterns.md` §State ownership split.

### Naming conventions

Identifiers, comments, and log messages throughout the codebase are written in Spanish (matching the target platform's locale — e.g. `ráfaga` = "burst"/download run, `cola` = queue, `cátedra` = course section A–D, `frenado suave` = graceful pause, `rafaga` = active download burst). Match this convention when adding new code rather than switching to English.

### File-level version headers

Most files carry a version-numbered docstring banner at the top (e.g. `V5.6.0`) with a changelog of recent fixes. When making a non-trivial fix or behavior change to one of these files, follow the existing pattern: bump the version and add a `CHANGELOG` bullet describing the fix, rather than leaving the change undocumented.

### Key domain-specific behavior to preserve

- **Title parsing** (`Utils.formatTitleStructured` / `clasificarCatedraYCarpeta`): derives the canonical filename + cátedra/folder from messy scraped titles. It's the most regression-sensitive logic in the project (regex order matters) — if a change silently mis-files or mis-names classes, look here. Mechanism, the `>12` date heuristic, and the classification order → `docs/patterns.md` §Sanitización y parsing.
- **M3U8 resolution** (`HlsEngine.extraerEnlaceMaestroM3u8Clasico`): primarily extracts the active `<iframe>` pointing at `b-cdn.net`/`mediadelivery.net`, pulls the UUID hash, and constructs `https://vz-c3e7bda8-f29.b-cdn.net/{hash}/480p/video.m3u8` directly — falls back to three progressively looser regex scans of the raw HTML only if the iframe match fails. This is fragile against upstream markup changes; if downloads start resolving the wrong class's video, check this function first.
- **`declarativeNetRequest`** (`rules_1.json`) blocks `bunnyinfra.net` image/xhr/other requests — intentional, not a bug (rationale → `docs/security.md` permisos).
