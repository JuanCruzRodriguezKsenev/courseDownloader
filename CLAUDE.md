# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RamonNet Video Downloader (Turbo Edition) is a Manifest V3 Chrome/Brave browser extension that bulk-downloads HLS-streamed recorded classes from the "Ramón Net" learning platform (`plataforma.ramonnet.com.ar`). It scrapes the class listing DOM, resolves each class's HLS `.m3u8` manifest, downloads and decrypts (AES-128-CBC) the `.ts` fragments concurrently, and streams the decrypted fragments to a companion local Bun backend server (`ramonnet-bun-backend`, a separate repo/folder not included here) running on `http://localhost:3001`, which assembles them on disk. The extension itself has no bundler and no runtime dependencies — it's plain vanilla JS/HTML/CSS loaded directly by the browser via `manifest.json`. The only `package.json` is dev-only (Vitest + jsdom for the test suite); it is never shipped and adds no build step (see `docs/adr/0001-no-bundler-or-typescript-yet.md`).

## Documentation as Code

This project treats `docs/` as the technical source of truth, maintained with the same discipline as source code — a PR that changes storage shape, IPC contracts, or business logic updates the relevant doc in the same PR (see `docs/contributing.md` for the checklist). `README.md` remains the accurate end-user install guide and is not superseded by `docs/` — they serve different audiences.

Start at **`docs/architecture.md`**. Full map:
- `docs/architecture.md` — system overview, execution zones, end-to-end download flow.
- `docs/tech-stack.md` — why each technology was chosen, alternatives rejected.
- `docs/data-model.md` — `chrome.storage.local`/`.session` schema (this project's equivalent of a DB schema).
- `docs/patterns.md` — the patterns actually implemented in code (IPC dispatch, state ownership split, worker pool, ad-hoc circuit breaker, etc.).
- `docs/coding-standards.md` — naming conventions, file version-header convention, module-export pattern.
- `docs/contributing.md` — local dev setup, debugging, PR checklist.
- `docs/testing.md` — testing strategy (currently 0% coverage; this describes the plan).
- `docs/security.md` — permission rationale and the untrusted-scraped-content rule.
- `docs/deployment.md` — extension distribution + the companion Bun backend contract.
- `docs/adr/` — immutable Architectural Decision Records. Never edit an existing ADR; a changed decision gets a new ADR that marks the old one superseded (see `docs/adr/README.md`).
- `docs/TECHNICAL_DEBT.md` — open issues backlog, with exact file/line locations.
- `docs/ROADMAP.md` — phased plan to pay down the backlog, in dependency order.
- `docs/preact-migration.md` — live status of the incremental Preact-islands migration of the popup (which islands are done/next, the DOM-boundary rule, and a recipe for adding one). See also ADR-0006.

Notably: **the XSS at `popup.js` `renderizarListadoInterfaz()` is fixed** (2026-07-16) by escaping the scraped title with `Utils.escaparHtml` before interpolating it into the `innerHTML` string of `Renderers.renderizarTarjetaEstado`. `renderizarTarjetaEstado` still assigns `descripcion`/`titulo`/`icono` via `innerHTML` (the description carries intentional `<br>`/`<strong>`), so any scraped/third-party value routed through it must be escaped at the call-site first — see `docs/security.md`.

## Development Workflow

The shipped extension is unpacked, hand-written JS loaded directly by the browser — no build tool or linter. A dev-only Vitest suite exists for the pure/testable modules:

- **Run tests**: `npm test` (single run) or `npm run test:watch`. To run one file/test: `npx vitest run shared/utils.test.js` or `npx vitest run -t "<test name>"`. Modules are made testable via the dual-export footer (`module.exports` for Node/Vitest, `window`/`self` for the browser) — see `docs/coding-standards.md`. Current tests: `shared/utils.test.js`, `shared/conexion.test.js`, `popup/features/onboarding.test.js`, `popup/features/serverConnection.test.js`.
- **Load/reload the extension**: `chrome://extensions/` → enable "Developer mode" → "Load unpacked" → select this repo's root folder. After any code change, click the reload icon on the extension card (service worker and popup do not hot-reload).
- **Debug the popup**: right-click the extension icon → "Inspect popup" (or open it and press F12) to get DevTools for `popup.js`/`popup/scraper.js`.
- **Debug the service worker**: on `chrome://extensions/`, click "service worker" (or "Inspect views: service worker") under this extension to get DevTools for `background.js` and `background/hlsEngine.js`.
- **Companion backend required for actual downloads**: Turbo Mode (`modoTurboBun`) is hardcoded to `true` throughout the codebase, meaning fragments are always streamed to the local Bun backend rather than assembled in-browser. Without the Bun server running on port 3001, downloads will fail at the streaming step — start it separately per the backend's own instructions before testing end-to-end downloads.
- There is a legacy non-Turbo code path (in-browser blob assembly via the `offscreen` document and `chrome.downloads`) still present in `background.js`/`shared/utils.js` for when `modoTurboBunActivo` is false, but it is currently unreachable since `establecerModoTurbo` always forces `true`.

## Architecture

### Execution contexts and message passing

The extension is split across isolated JS execution contexts that only communicate via `chrome.runtime.sendMessage` / `onMessage` (fire-and-forget or async-response IPC) and `chrome.storage` (local + session):

- **`popup.js`** (+ `popup/scraper.js`, `renderers.js`, `popup/features/*`) — runs in the popup window. Orchestrates all UI state, tab switching (Disponibles/Cola), filtering/search, and drives DOM scraping by injecting `Scraper.escanearAulaVirtual` into the active Ramón Net tab via `chrome.scripting.executeScript`. Talks to the service worker over IPC actions like `iniciar_descarga_cola`, `inyectar_items_en_cola_activa`, `obtener_estados_en_progreso`. Cohesive slices of popup behavior are being extracted into **`popup/features/`** self-contained modules (an ongoing feature-driven split — see `docs/adr/0005-feature-driven-popup-split.md`, `docs/ROADMAP.md` Fase 2): each exports a factory `Feature.crear(ctx)` that receives its dependencies (DOM `nodos`, callbacks into `popup.js`) via a `ctx` object rather than reaching into the popup's closure. Extracted so far: `onboarding.js` (the tour) and `serverConnection.js` (connection UI + auto-heal recovery). Add new UI concerns as features in this shape, not as more free functions in `popup.js`. **Preact islands (in-progress, no build):** cohesive UI regions are also being migrated to Preact — vendored build-less as `popup/vendor/htm-preact-standalone.module.js` and loaded via `<script type="module">` (coexists with the vanilla code; the service worker stays vanilla). See `docs/adr/0006-adopt-preact-islands-in-popup.md`. First island: `popup/features/conexionHeader.preact.js` owns the header status dot, derived from the `Conexion` daemon (a `useConexion()` hook subscribes to it) — so that dot is no longer painted imperatively anywhere. When adding a Preact island, its DOM boundary must be a region the vanilla code does not hold `nodos.*` references to (avoid stale refs).
- **`background.js`** (service worker, MV3) — the only place downloads actually happen. Owns the persistent FIFO download queue, processes one item at a time (`procesarSiguienteElementoDeLaCola`), and survives SW suspension by keeping volatile-but-durable state in `chrome.storage.session` (`SessionState`) and long-lived queue/progress data in `chrome.storage.local`. Registers a `chrome.alarms` listener (`alarma_autoheal`, fires every ~12s) that auto-detects when internet or the Bun backend comes back after a connection failure and resumes the queue — both this recovery check and the download-error classification now go through the `Conexion` daemon (`Conexion.verificarAhora()`/`get()`) rather than their own probes.
- **`background/hlsEngine.js`** (`HlsEngine`, imported via `importScripts` into the SW) — resolves the class page HTML to a Bunny/mediadelivery `.m3u8` URL (iframe hash extraction with several regex fallbacks), parses the M3U8 manifest for fragment URLs + `#EXT-X-KEY`, and runs a 6-worker concurrent pool (`CONCURRENCIA_MAXIMA`) that fetches, AES-decrypts, and (in Turbo mode) streams each fragment to the Bun backend via `BunClient.enviarFragmentoStream`.
- **`offscreen/offscreen.js`** — an MV3 offscreen document used only for the legacy non-Turbo path, because service workers lack `URL.createObjectURL`. Not exercised while Turbo mode is forced on.
- **`shared/`** — code shared across contexts (loaded by both `popup.html` via `<script>` tags and `background.js` via `importScripts`):
  - `state.js` (`AppState`) — the popup-side state machine; mirrors/persists to `chrome.storage.local` and periodically reconciles with the SW's authoritative progress via `sincronizarConBackground()`.
  - `bunClient.js` (`BunClient`) — thin fetch wrapper for every Bun backend endpoint (`/api/escanear-disco`, `/api/bypass-stream`, `/api/actualizar-consola`, `/api/seleccionar-carpeta`, `/api/health`, `/api/cancelar-descarga`). Exports to `window` or `self` depending on context.
  - `conexion.js` (`Conexion`) — the **single source of truth for connection state** (server + internet), loaded in both the popup and the SW. Push model, not pull: one poller (`iniciar()` in the popup; the SW drives it from the `alarma_autoheal` handler since `setInterval` doesn't survive suspension) keeps `_estado` fresh; everything else only reads `Conexion.get()` (returns `{servidor, internet, completa, tipoFalla, listo}`) or subscribes via `Conexion.suscribir(cb)` (edge-triggered — fires only on change). State is mirrored across popup↔SW through `chrome.storage.session`. **This is the only place connection checks should live** — do not add ad-hoc `/api/health` or internet-HEAD probes elsewhere; both `background.js` and `serverConnection.js` were refactored to consume this daemon instead of their own duplicated checks.
  - `utils.js` (`Utils`) — title/filename sanitization and the class-title parser (`formatTitleStructured`, `clasificarCatedraYCarpeta`) that derives `SEM mm-dd - MATERIA CATEDRA - CLASE n - PARTE m` naming and cátedra (A–D) / subject-folder classification from raw scraped titles; AES decrypt helper; retry-with-backoff fetch (`fetchConReintentos`); progress/telemetry math.

### State ownership split

State is intentionally split, not shared directly, between contexts:
- **`AppState` (popup)** is the source of truth for the *scraped class list* and UI selection/filter state, persisted under `listaPersistente` / `colaDescargas` etc. in `chrome.storage.local`.
- **`SessionState` (service worker)** is the source of truth for the *active download's* runtime state (current title, bytes/fragments/speed, abort/pause flags), kept in `chrome.storage.session` so it survives SW suspension but resets on browser restart.
- The two reconcile via the `obtener_estados_en_progreso` IPC round-trip; the popup should never assume its cached `estado` per class is current without this sync.

### Naming conventions

Identifiers, comments, and log messages throughout the codebase are written in Spanish (matching the target platform's locale — e.g. `ráfaga` = "burst"/download run, `cola` = queue, `cátedra` = course section A–D, `frenado suave` = graceful pause, `rafaga` = active download burst). Match this convention when adding new code rather than switching to English.

### File-level version headers

Most files carry a version-numbered docstring banner at the top (e.g. `V5.6.0`) with a changelog of recent fixes. When making a non-trivial fix or behavior change to one of these files, follow the existing pattern: bump the version and add a `CHANGELOG` bullet describing the fix, rather than leaving the change undocumented.

### Key domain-specific behavior to preserve

- **Title parsing** (`Utils.formatTitleStructured`): derives a canonical `SEM mm-dd - MATERIA CATEDRA - CLASE n - PARTE m - DETALLE` filename from messy scraped titles; date ambiguity (day/month order) is resolved by `parseSmartDate` using the >12 heuristic. Cátedra (section A–D) and subject-folder are inferred separately by `clasificarCatedraYCarpeta`, tried in order: explicit "CATEDRA X" mention → "MATERIA X" mention → generic "SIGLA X" fuzzy match against the base subject → default `"COMUN"`.
- **M3U8 resolution** (`HlsEngine.extraerEnlaceMaestroM3u8Clasico`): primarily extracts the active `<iframe>` pointing at `b-cdn.net`/`mediadelivery.net`, pulls the UUID hash, and constructs `https://vz-c3e7bda8-f29.b-cdn.net/{hash}/480p/video.m3u8` directly — falls back to three progressively looser regex scans of the raw HTML only if the iframe match fails. This is fragile against upstream markup changes; if downloads start resolving the wrong class's video, check this function first.
- **`declarativeNetRequest`** (`rules_1.json`) blocks `bunnyinfra.net` image/xhr/other requests — this is intentional (likely ad/analytics blocking on the CDN), not a bug.
