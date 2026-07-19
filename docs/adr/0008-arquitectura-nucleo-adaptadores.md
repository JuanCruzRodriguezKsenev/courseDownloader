# 0008 — Arquitectura de núcleo genérico + adaptadores (puertos y adaptadores) y migración a TypeScript

**Fecha**: 2026-07-19
**Estado**: Aceptada (diseño — ejecución diferida a fases del `docs/ROADMAP.md`)
**Supersede a**: [ADR-0001](0001-no-bundler-or-typescript-yet.md) (que difería bundler + TypeScript)

## Contexto

Hoy la extensión mezcla en los mismos archivos tres tipos de código con vidas
distintas:

- **Genérico y reutilizable**: el motor de descarga HLS (pool de workers + AES),
  la cola FIFO, el daemon de conexión, la máquina de estado, la UI/islas y
  `BunClient`.
- **Específico del sitio Ramón Net**: selectores del DOM, parseo de títulos y
  cátedra, resolución del `.m3u8` de Bunny/mediadelivery con CDN hardcodeado, la
  URL de sondeo de internet, las reglas `declarativeNetRequest` y el concepto de
  cátedra A-D.
- **Específico del navegador (Chrome/MV3)**: ~99 usos de `chrome.*` repartidos en
  12 archivos (storage, runtime/IPC, alarms, tabs, scripting, downloads,
  offscreen, declarativeNetRequest).

Esta mezcla hace que **re-clonar la extensión para otro sitio o para otro
navegador/runtime** obligue a tocar código genérico, con riesgo de regresión. El
objetivo es convertir la extensión en un **template reutilizable**: cambiar de
sitio o de navegador debería tocar solo un adaptador, no el núcleo.

En paralelo, ADR-0001 difirió TypeScript porque su mayor costo era la conversión
transversal de globales `window.X`/`self.X` a módulos ES. Esa misma conversión es
un requisito de esta re-arquitectura, así que ambos esfuerzos comparten el trabajo
pesado y conviene hacerlos **una sola vez** (ver "Fusión con TypeScript" abajo).

## Decisión

Adoptar **arquitectura de puertos y adaptadores (hexagonal)** con **tres capas**,
y **fusionar la migración a TypeScript + bundler dentro de esta misma
re-arquitectura**. Es una decisión de **diseño**: define la estructura objetivo y
la dirección; la ejecución se difiere a fases del `docs/ROADMAP.md`, en orden de
aislamiento (lo más desacoplado primero).

### Capa 1 — Núcleo genérico (reutilizable)

Motor de descarga HLS (pool de workers, AES), cola FIFO, daemon de conexión
(lógica), máquina de estado, lógica de UI/islas, `BunClient`.

**Invariante**: el núcleo **no llama `chrome.*` ni conoce Ramón Net** — depende
solo de interfaces (puertos) que los adaptadores cumplen.

### Capa 2 — Adaptador de sitio (`sitio/`)

Todo lo específico de Ramón Net, hoy desparramado, se concentra detrás de un
puerto de sitio. Catálogo de lo que migra:

- `popup/scraper.js` — selectores del DOM.
- `shared/utils.js` — parseo de títulos/cátedra (`formatTitleStructured`,
  `clasificarCatedraYCarpeta`, `parseSmartDate`).
- `background/hlsEngine.js` — resolución M3U8 Bunny/mediadelivery + CDN hardcodeado
  (`extraerEnlaceMaestroM3u8Clasico`, `vz-c3e7bda8-f29.b-cdn.net`).
- `shared/conexion.js` — `URL_SONDEO_INTERNET` (`plataforma.ramonnet.com.ar`).
- `rules_1.json` — reglas dNR (`bunnyinfra.net`).
- `popup/features/catedra.js` — el concepto de cátedra A-D.

### Capa 3 — Adaptador de navegador/plataforma (Chrome/MV3)

Abstraer los **99 usos de `chrome.*` (en 12 archivos)** detrás de puertos, para
poder apuntar a otro browser/runtime. Superficie a envolver:

- **Persistencia** — `chrome.storage.local`/`.session`/`.onChanged`.
- **IPC/mensajería** — `chrome.runtime.onMessage`/`sendMessage`/`onInstalled`/`lastError`.
- **Scheduling** — `chrome.alarms.create/clear/onAlarm`.
- **Tabs** — `chrome.tabs.query/get/onUpdated/onActivated`.
- **Inyección** — `chrome.scripting.executeScript`.
- **Descargas** — `chrome.downloads.download/search` (solo path legacy no-Turbo).
- **Offscreen** — `chrome.offscreen.createDocument/closeDocument` (legacy).
- **Red declarativa** — `declarativeNetRequest` (`rules_1.json`, manifest).

Concentración por archivo: `background.js` (41), `popup.js` (14), `state.js` (9),
`queue.js` (9), `conexion.js` (7), `utils.js` (4).

### Fusión con TypeScript (por qué se hace junto)

Se decide **TypeScript completo + bundler** (Vite + CRXJS o WXT) como parte de la
**misma** conversión transversal a módulos ES (globales `window.X`/`self.X` →
imports), no como esfuerzo aparte — así se toca cada archivo una sola vez. El mayor
payoff:

- **Puertos tipados**: que un adaptador cumpla la interfaz de su puerto lo verifica
  el compilador, no una revisión manual.
- `@types/chrome` sobre los 99 usos de `chrome.*`.
- **Unión discriminada** para los mensajes de IPC (hoy strings sueltos).

## Por qué supersede a ADR-0001

ADR-0001 difirió TypeScript priorizando cerrar deuda técnica y agregar tests
primero, y observó que el costo dominante era la conversión de globales a módulos.
Cumplidas las Fases 1-4 del roadmap (tests + split + ESLint), y con la
re-arquitectura obligando de todos modos a esa conversión de módulos, el balance
cambió: TS deja de ser un esfuerzo aislado de bajo retorno y pasa a ser el
mecanismo que da los **puertos tipados** de esta arquitectura. Por eso esta
decisión reemplaza a ADR-0001 en lugar de simplemente actualizarla.

## Consecuencias

- La estructura de carpetas objetivo separa `núcleo` / `sitio/` / `plataforma/` (o
  nombres equivalentes que el trabajo de ejecución fije).
- Aparece un paso de build (bundler MV3) — se acepta el costo que ADR-0001 evitaba,
  a cambio de reutilización + tipos. `manifest.json` pasará a apuntar a artefactos
  compilados.
- Migrar a otro sitio = escribir un nuevo adaptador de Capa 2; migrar a otro
  navegador = un nuevo adaptador de Capa 3. El núcleo queda intacto en ambos casos.
- El trabajo es grande y transversal: se ejecuta en fases incrementales (ver
  `docs/ROADMAP.md`), empezando por lo más aislado, no en un big-bang.

## Alcance de este ADR

Este ADR fija la **dirección y las capas**. El **diseño de ejecución concreto**
—estructura de carpetas objetivo, interfaces TypeScript de cada puerto, elección de
bundler (WXT vs Vite+CRXJS) y orden de migración por archivo— vive en
**`docs/rearquitectura-diseno.md`** (el "cómo", separado de esta "decisión" por la
regla DRY de ADR-0007). **No se ejecuta como parte de la tanda de saldado de deuda
técnica** (esa queda en JS — ver `docs/ROADMAP.md`, Fase 2 y el fix del bug 400 en
`docs/TECHNICAL_DEBT.md`).
