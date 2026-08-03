# Arquitectura

Punto de partida recomendado para entender el sistema. Para el detalle de *por qué* se eligió cada pieza, ver `docs/tech-stack.md` y `docs/adr/`.

## Vista general

RamonNet Video Downloader es una extensión Manifest V3 para Chrome/Brave que automatiza la descarga masiva de clases grabadas (streaming HLS) de la plataforma Ramón Net. No es una app aislada: depende de un **backend local complementario en Bun** (`ramonnet-bun-backend`, repo separado) que corre en `http://localhost:3001` y es quien efectivamente escribe los archivos de video en disco.

```
┌─────────────────────┐        chrome.scripting          ┌──────────────────────┐
│  Pestaña del usuario │ ◄──────── inyecta Scraper ─────── │      popup.js         │
│  (plataforma.ramonnet│                                    │  (ventana del popup)  │
│   .com.ar)           │                                    └──────────┬───────────┘
└─────────────────────┘                                               │
                                                          chrome.runtime.sendMessage
                                                          chrome.storage.local (polling)
                                                                        │
                                                                        ▼
                                                          ┌──────────────────────┐
                                                          │     background.js     │
                                                          │  (service worker MV3) │
                                                          │  + hlsEngine.js        │
                                                          └──────────┬───────────┘
                                                                     │
                                                     fetch + AES-CBC decrypt (WebCrypto)
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  Backend Bun local     │
                                                          │  localhost:3001        │
                                                          │  (repo separado)       │
                                                          └──────────┬───────────┘
                                                                     │
                                                                     ▼
                                                              Disco del usuario
```

## Las 4 zonas de ejecución

La extensión está partida en contextos de ejecución de JS aislados que **solo** se comunican entre sí vía `chrome.runtime.sendMessage`/`onMessage` (IPC) y `chrome.storage` (nunca comparten memoria directamente):

| Zona | Archivo(s) | Responsabilidad |
|---|---|---|
| **Popup** | `popup.js`, `renderers.js`, `popup/features/*` (+ el adaptador `sitio/ramonnet/*`) | Toda la UI: tabs, filtros, onboarding, selección de clases. Inyecta el scraper en la pestaña activa de Ramón Net vía `chrome.scripting.executeScript`. Partes de la UI se están migrando a **islas Preact** (sin build, ES modules locales — ver `docs/adr/0006` y `docs/preact-migration.md`). |
| **Service Worker** | `background.js`, `background/hlsEngine.js` | Único lugar donde ocurren las descargas reales. Dueño de la cola FIFO persistente y de la máquina de estados de auto-sanación ante cortes de red. Sigue 100% vanilla (no tiene DOM). |
| **Offscreen Document** | `offscreen/offscreen.js` | Existe solo para el path legacy no-Turbo (`URL.createObjectURL` no está disponible en service workers). No se ejercita mientras Turbo Mode esté forzado a `true`. |
| **Compartido** | `shared/*.js` (lo que aún no se migró), `core/**`, `sitio/**`, `plataforma/**` | Código cargado por más de una zona. No es una zona de ejecución: es la librería común, hoy en plena re-arquitectura por capas (ver abajo). `shared/conexion.js` es el **daemon de estado de conexión** (fuente única, ver Modelo de estado). |

Ver `docs/patterns.md` para el detalle de cómo se comunican estas zonas y qué patrones sostienen esa comunicación.

## Las capas (re-arquitectura en curso)

Ortogonal a las zonas de ejecución, el código se está reorganizando en capas (ADR-0008).
**Convive con la estructura vieja**: lo migrado está en su capa, lo que falta sigue en
`shared/`, `popup.js` y `background.js`. El avance por fases vive en
`docs/rearquitectura-diseno.md` §Estado de avance — ése es el doc a leer para saber qué
sigue.

| Capa | Carpeta | Regla | Estado |
|---|---|---|---|
| 1 — Núcleo genérico | `core/` | Cero `chrome.*`, cero Ramón Net. Todo TypeScript. Depende sólo de puertos (`core/puertos/`). | Parcial: `backend/bunClient.ts`, `historial/historialFallos.ts`, `puertos/almacenamiento.ts` |
| 2 — Adaptador de sitio | `sitio/ramonnet/` | Todo lo específico del portal: scraper, parser de títulos, resolución del `.m3u8`, constantes, faceta, reglas dNR. | ✅ Completa |
| 3 — Adaptador de plataforma | `plataforma/chrome/` | Único lugar que toca la API del navegador. Implementa los puertos. | Parcial: `almacenamiento.ts` |
| Composición | `plataforma/composicion.ts` | Único lugar donde se eligen adaptadores concretos y se inyectan al núcleo. | Activa |
| Entrypoints | `entrypoints/` | Puntos de entrada de WXT: importan en orden y no contienen lógica. | ✅ |

Lo que **todavía** habla `chrome.*` directo y falta migrar: `background.js` (63 usos),
`popup.js` (14), `popup/features/queue.js` (9), `shared/conexion.js` (7).

`shared/state.ts` fue el primero de la Fase 5b: ya no toca `chrome.storage` (recibe el puerto
por inyección). Le queda un solo uso de `chrome.*`, el `sendMessage` de
`sincronizarConBackground()`, que es **IPC y no persistencia** — cae fuera de este puerto y
espera uno de mensajería.

## Flujo de una descarga, de punta a punta

1. **Scraping**: el usuario abre el popup con la pestaña de Ramón Net activa. `popup.js` inyecta `Scraper.escanearAulaVirtual` (definida en `sitio/ramonnet/scraper.js`, Capa 2, y consumida vía `SitioActivo.escanearListado`) en esa pestaña, que lee el DOM y devuelve la lista de clases visibles + la materia detectada.
2. **Clasificación**: cada título crudo pasa por `SitioActivo.parsearTitulo`/`.clasificarCarpeta` (`sitio/ramonnet/parserTitulos.js`, Capa 2) para derivar nombre de archivo canónico, cátedra (A–D) y carpeta de destino.
3. **Encolado**: el usuario selecciona clases y las agrega a la cola. `popup.js` actualiza `AppState.colaDescargas` de inmediato (optimistic update) y notifica al service worker vía `inyectar_items_en_cola_activa`.
4. **Procesamiento** (`background.js`, `procesarSiguienteElementoDeLaCola`): toma el primer ítem FIFO de la cola persistida en `chrome.storage.local`, y:
   - `SitioActivo.resolverManifiesto` (`sitio/ramonnet/resolverManifiesto.js`, Capa 2) resuelve la URL del manifiesto `.m3u8` a partir del HTML de la página de la clase; el motor HLS ya sólo recibe la URL resuelta.
   - `HlsEngine.descargarYAnalizarIndexM3u8` parsea el manifiesto (fragmentos + clave de cifrado `#EXT-X-KEY`).
   - `HlsEngine.compilarTranscodificacionStream` descarga los fragmentos `.ts` con un pool de 6 workers concurrentes, los descifra con AES-128-CBC (WebCrypto nativo), y los envía en streaming al backend Bun (`BunClient.enviarFragmentoStream`).
5. **Persistencia en disco**: el backend Bun recibe cada fragmento vía `POST /api/bypass-stream` y los ensambla directamente en el filesystem del usuario — la extensión nunca mantiene el video completo en memoria.
6. **Reconciliación**: el popup sincroniza su vista del progreso contra el estado real del service worker (`obtener_estados_en_progreso`) en cada apertura y periódicamente mientras está abierto.

## Modelo de estado

El estado está deliberadamente **partido, no compartido**, entre popup y service worker. Cada zona es dueña de una porción; se reconcilian por IPC, no comparten memoria. En una línea cada uno:

- **`AppState`** (popup, `shared/state.ts`) — la *lista de clases scrapeadas* + selección/filtros de UI.
- **`SessionState`** (service worker, inline en `background.js`) — el *progreso de la descarga activa*.
- **`Conexion`** (daemon, `shared/conexion.js`) — la fuente **única** del *estado de conexión* (servidor + internet).

El schema exacto, las invariantes de reconciliación (`obtener_estados_en_progreso`) y por qué el split → `docs/data-model.md`. El patrón de ownership y el daemon `Conexion` (modelo push, "no chequeos ad-hoc") → `docs/patterns.md`.

## Auto-sanación ante fallas de red

Cuando la cola se pausa por un error de conexión, `background.js` sondea si el recurso caído volvió y reanuda sola — un circuit breaker ad-hoc de 2 estados. La mecánica (alarma `alarma_autoheal`, intervalo, sondeo vía `Conexion`) → `docs/patterns.md` §Circuit breaker; por qué no se formalizó a 3 estados → `docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`.

**Ojo con los timeouts** (aprendido a los golpes): en Windows, `localhost:3001` con el servidor apagado **cuelga** en vez de rechazar. Todo `fetch` al backend que alimente detección de estado o el loop de descarga lleva `AbortController`+timeout (`obtenerRutaServidor`, `enviarFragmentoStream`). Y el loop del SW **no** debe tratar cualquier `AbortError` como cancelación del usuario (el motor HLS aborta a propósito para frenar workers): sólo el flag `state.abortadoPorUsuario` marca cancelación real.
