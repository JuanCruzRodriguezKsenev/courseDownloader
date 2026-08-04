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
| **Offscreen Document** | `public/offscreen/offscreen.js` | Existe solo para el path legacy no-Turbo (`URL.createObjectURL` no está disponible en service workers). No se ejercita mientras Turbo Mode esté forzado a `true`. |
| **Compartido** | `shared/*.js` (lo que aún no se migró), `core/**`, `sitio/**`, `plataforma/**` | Código cargado por más de una zona. No es una zona de ejecución: es la librería común, hoy en plena re-arquitectura por capas (ver abajo). `core/conexion/conexion.ts` es el **daemon de estado de conexión** (fuente única, ver Modelo de estado). |

Hay un quinto contexto que la tabla no lista porque no es código *de* la extensión corriendo
en la extensión: **la pestaña del portal**, donde el popup inyecta `Scraper.escanearAulaVirtual`
vía `chrome.scripting.executeScript`. Corre en el mundo aislado de la página y no comparte nada
con las zonas de arriba — ni siquiera el módulo del que salió. La regla que impone está abajo,
en §Capa 2 — `sitio/<portal>/`, y es de las pocas del proyecto que ninguna de las cuatro
verificaciones detecta si se rompe.

Ver `docs/patterns.md` para el detalle de cómo se comunican estas zonas y qué patrones sostienen esa comunicación.

## Las capas (re-arquitectura en curso)

Ortogonal a las zonas de ejecución, el código se está reorganizando en capas (ADR-0008).
**Convive con la estructura vieja**: lo migrado está en su capa, lo que falta sigue en
`shared/`, `popup.js` y `background.js`. El avance por fases vive en
`docs/rearquitectura-diseno.md` §Estado de avance — ése es el doc a leer para saber qué
sigue.

| Capa | Carpeta | Regla | Estado |
|---|---|---|---|
| 1 — Núcleo genérico | `core/` | Cero `chrome.*`, cero Ramón Net. Todo TypeScript. Depende sólo de puertos (`core/puertos/`). | Parcial: `backend/bunClient.ts`, `historial/historialFallos.ts`, `puertos/` (`almacenamiento.ts`, `mensajeria.ts`, `sitio.ts`) |
| 2 — Adaptador de sitio | `sitio/ramonnet/` | Todo lo específico del portal: scraper, parser de títulos, resolución del `.m3u8`, constantes, faceta, reglas dNR. Cumple `PuertoSitio`. | ✅ Completa (en TS desde 2026-08-03: `config.ts`; los otros 3 archivos siguen en `.js`) |
| 3 — Adaptador de plataforma | `plataforma/chrome/` | Único lugar que toca la API del navegador. Implementa los puertos. | Parcial: `almacenamiento.ts`, `mensajeria.ts` |
| Composición | `plataforma/composicion.ts` | Único lugar donde se eligen adaptadores concretos y se inyectan al núcleo. | Activa |
| Entrypoints | `entrypoints/` | Puntos de entrada de WXT: importan en orden y no contienen lógica. | ✅ |

**El `PuertoAlmacenamiento` ya no tiene consumidores pendientes**: con `background.js`
migrado (Fase 5b, 2026-08-03) no queda ni un `chrome.storage` en el proyecto.

Lo que **todavía** habla `chrome.*` directo, por API y no por archivo:

| API | Dónde | Puerto que espera |
|---|---|---|
| `runtime` (IPC) | `background.js` (lado receptor) | `PuertoMensajeria` ✅ existe — falta migrar el receptor |
| `alarms` | `background.js` (auto-heal) | `PuertoProgramador` (diseñado, sin construir) |
| `notifications` | `background.js` | sin diseñar |
| `tabs` / `windows` | `background.js`, `popup.js` | `PuertoTabs` (diseñado, sin construir) |
| `scripting` | `popup.js` | `PuertoInyeccion` (diseñado, sin construir) |
| `downloads` / `offscreen` | `background.js` | sólo el camino legacy no-Turbo (hoy inalcanzable) |

El IPC del popup ya está migrado: `popup.js` y `popup/features/queue.js` pasaron al
`PuertoMensajeria` en la Fase 5c.

> Cuidado al contar: los `chrome.runtime.lastError` que quedan en `popup.js` son de los
> callbacks de `tabs`/`scripting`, no de mensajería. `lastError` es el mecanismo de error de
> **toda** la API de callbacks de `chrome.*`, no sólo del IPC.

`shared/state.ts` fue el primero de la Fase 5b: ya no toca `chrome.storage` (recibe el puerto
por inyección). Le queda un solo uso de `chrome.*`, el `sendMessage` de
`sincronizarConBackground()`, que es **IPC y no persistencia** — cae fuera de este puerto y
espera uno de mensajería.

## Qué hace cada archivo, y qué regla respeta

Las dos secciones de arriba dicen *dónde* vive cada cosa (zonas y capas). Ésta dice **qué
contiene cada archivo y qué hay que respetar al tocarlo** — es el detalle operativo que antes
vivía duplicado en `CLAUDE.md`, que ahora conserva sólo el resumen de reglas y apunta acá. La
historia de qué se migró en qué fase no está acá: vive en `docs/rearquitectura-diseno.md`.

### Popup

- **`popup.js`** (+ `renderers.js`, `popup/features/*`; el scraper que inyecta vive en
  `sitio/ramonnet/scraper.js`). Orquesta el estado de UI, el cambio de tabs
  (Disponibles/Cola), filtros y búsqueda, y dispara el scraping inyectando
  `Scraper.escanearAulaVirtual` en la pestaña activa. Habla con el service worker por acciones
  IPC (`iniciar_descarga_cola`, `inyectar_items_en_cola_activa`,
  `obtener_estados_en_progreso`) **a través del `PuertoMensajeria`, no de `chrome.runtime`**.
  Detalle de forma: el oyente del worker se guarda como **función de desuscripción**
  (`desengancharOyenteWorker`), no como referencia al listener para devolvérsela a
  `removeListener`.
  Lo que queda adentro es **deliberado**: init + wiring + orquestación de
  render/scraping/IPC es el estado final que define ADR-0005, y `scraping` en particular
  **no** se extrae (alimenta ADR-0008).
- **`popup/features/` — el split feature-driven** (ADR-0005, Fase 2 cerrada). Cada módulo
  exporta una factory `Feature.crear(ctx)` que recibe sus dependencias (nodos del DOM,
  callbacks hacia `popup.js`, `ctx.mensajeria`, `ctx.sitio`) por el objeto `ctx` en vez de
  meter la mano en el closure del popup. **Las preocupaciones nuevas de UI se agregan con esta
  forma, no como más funciones sueltas en `popup.js`.**

  | Feature | Qué es | Lo que hay que saber |
  |---|---|---|
  | `serverConnection.js` | UI de conexión + auto-heal | Consume el daemon `Conexion`, no sondea por su cuenta. |
  | `queue.js` (`QueueFeature`) | Ciclo de vida completo de la cola: encolar/quitar, cancelar, arrancar, reanudar tras caída | Sin `chrome.*`: el puerto le llega como `ctx.mensajeria`. |
  | `filters.js` (`FilterFeature`) | Búsqueda + filtros por estado/materia/faceta + popover | Dueña del predicado unificado `coincideConFiltrosCola`. **Trampa**: su objeto `filtrosActivos` viaja **por referencia** en `ctx`, porque algunos call-sites de `popup.js` todavía lo mutan. |
  | `faceta.js` (`FacetaFeature`) | Badge + asistente/modal de autoselección del eje de clasificación del sitio | **Genérica**: el vocabulario lo pone el descriptor del sitio (ver §UI de `rearquitectura-diseno.md`). |

- **Islas Preact** (`popup/vendor/htm-preact-standalone.module.js`, importadas al final de
  `entrypoints/popup/main.js`; el service worker sigue vanilla). Seis: `conexionHeader`,
  `rutaDisco`, `bannerConexion`, `onboarding`, `listaClases` (la más grande — dueña de los
  hijos de `#ui-list` y de los atributos del host) y `campanita`. El mapa por isla (frontera
  de DOM, puente de store, estado) y la receta para agregar una están en
  `docs/preact-migration.md`. Dos reglas que cobran caro: la frontera de DOM tiene que ser una
  región de la que el código vanilla **no** guarde referencias `nodos.*` (refs colgadas), y un
  puente de store respaldado por storage (`campanita` ← `core/historial/historialFallos.ts`)
  no se comporta como un `window.X` efímero: lo escribe el SW.

### Service worker

- **`background.js`** — el único lugar donde las descargas ocurren de verdad. Dueño de la cola
  FIFO persistente, procesa un ítem por vez (`procesarSiguienteElementoDeLaCola`) y sobrevive
  a la suspensión del SW guardando lo volátil-pero-durable en el ámbito de sesión
  (`SessionState`) y la cola/progreso de vida larga en el local. **El storage va por
  `PuertoAlmacenamiento`** (el global `Almacenamiento` que publica
  `plataforma/composicion.ts`). Registra la alarma `alarma_autoheal` que reanuda la cola
  cuando la conexión caída vuelve; tanto ese chequeo de recuperación como la clasificación de
  errores de descarga pasan por el daemon `Conexion`, no por sondas propias. Lo que todavía
  habla `chrome.*` directo está en la tabla de §Las capas.
- **`background/hlsEngine.js`** (`HlsEngine`) — **genérico**: la resolución página de clase →
  `.m3u8` es del adaptador de sitio, así que el motor recibe la URL ya resuelta. Parsea el
  manifiesto M3U8 (fragmentos + `#EXT-X-KEY`) y corre el pool de 6 workers concurrentes
  (`CONCURRENCIA_MAXIMA`) que descarga, descifra con AES y —en modo Turbo— streamea cada
  fragmento al backend Bun vía `BunClient.enviarFragmentoStream`.
- **`public/offscreen/offscreen.js`** — documento offscreen del camino legacy no-Turbo (los
  service workers no tienen `URL.createObjectURL`). Vive en `public/`, se copia tal cual y no
  se bundlea. No se ejercita mientras Turbo esté forzado.

### Capa 1 — `core/`

`core/puertos/` tiene las **interfaces de los puertos**: `almacenamiento.ts` (persistencia),
`mensajeria.ts` (IPC) y `sitio.ts` (`PuertoSitio`, el contrato que un adaptador de portal debe
cumplir). Los dos primeros vienen con implementación en memoria
(`almacenamientoEnMemoria.ts`, `mensajeriaEnMemoria.ts`) que permite testear lógica sin
mockear `chrome.*` a mano, incluida una conversación popup↔SW completa in-process.

**`PuertoMensajeria` parte en dos lo que `chrome.runtime.sendMessage` mezclaba**: `enviar()`
espera respuesta y rechaza si el canal falla; `notificar()` es fire-and-forget y no rechaza
nunca. Elegir uno es explícito en cada call-site — contrato completo en `docs/patterns.md`.

**`core/conexion/conexion.ts` (`Conexion`) es la fuente única de verdad del estado de
conexión** (servidor + internet), corriendo en popup y en SW; se lee con `Conexion.get()` o se
escucha con `Conexion.suscribir(cb)`. **Regla operativa: no agregar sondas `/api/health` ni
HEAD de internet ad-hoc en ningún otro lado — consumir el daemon.** Modelo push, espejado y
contrato completo → `docs/patterns.md` §Daemon de estado de conexión. Misma forma que los
demás módulos del núcleo: factory `crearConexion(puerto, opciones)`, instancia publicada por
`composicion.ts`, espejado cross-contexto por el ámbito de sesión del puerto.

Llegó a la Capa 1 el **2026-08-03**, y vale como ejemplo de qué frena una mudanza: `chrome.*`
no le quedaba desde la Fase 5b, pero seguía leyendo el global `SitioActivo` para saber a qué
host mandarle el HEAD de "hay internet". Esa URL ahora **se inyecta** —desde `composicion.ts`,
que la toma de `PuertoSitio.urlSondeoInternet`— y con ella se fue el fallback hardcodeado al
host de Ramón Net: en esta capa no puede existir, así que el parámetro es obligatorio y los
tests pasan una URL de fantasía.

También viven acá `core/backend/bunClient.ts` (wrapper fino de todos los endpoints del backend
Bun: `/api/escanear-disco`, `/api/bypass-stream`, `/api/actualizar-consola`,
`/api/seleccionar-carpeta`, `/api/health`, `/api/cancelar-descarga`) y
`core/historial/historialFallos.ts` (factory `crearHistorialFallos(puerto)`, no singleton:
historial acotado —últimos 50, más nuevo primero— de fallos terminales de la cola bajo la
clave local `historialFallos`, que respalda la campanita; lo escribe el SW en `registrarFallo`
y lo lee/muta el popup. Schema → `docs/data-model.md`; diseño →
`docs/notificaciones-fallos-diseno.md`).

**`ErrorBackend` convierte en tipo lo que era una convención en comentarios**:
`tipoBackend: "rechazo"` marca **sólo** 4xx (saltear la clase), nunca 5xx (pausar +
auto-heal). De esa distinción depende el fix del bug 400.

### Capa 3 — `plataforma/`

`plataforma/chrome/almacenamiento.ts` implementa `PuertoAlmacenamiento` sobre
`chrome.storage`; `plataforma/chrome/mensajeria.ts` implementa `PuertoMensajeria` sobre
`chrome.runtime`, y usa a propósito la forma **callback**, porque es la única que expone
`chrome.runtime.lastError`: el adaptador siempre lo lee y lo convierte en rechazo o en
warning.

**`plataforma/composicion.ts` es la raíz de composición** — el único lugar donde los
adaptadores concretos se inyectan en los módulos del núcleo y se publican como globals. Vive
fuera de `entrypoints/` porque WXT trata cada archivo suelto de ahí como un entrypoint.
**Un módulo que se desacopla de `chrome.*` se instancia acá.**

### Capa 2 — `sitio/<portal>/`

`sitio/ramonnet/config.ts` exporta `SitioRamonNet` + `SitioActivo` (el sitio al que apunta
este build) y **se declara implementación de `PuertoSitio`**, así que a un adaptador de portal
al que le falte una pieza lo caza el compilador y no la lectura. Dos reglas al agregarle algo:

- **Una constante entra a `PuertoSitio` sólo si la lee alguien de afuera de `sitio/`.** `host`,
  `marcaRutaClase` y el bloque `cdn` (hosts de iframe + la `plantillaM3u8` de Bunny) los
  consumen únicamente archivos hermanos, así que viven en el `SitioRamonNetDescriptor` propio
  del sitio. `urlSondeoInternet` sí cruza la frontera: lo lee el daemon `Conexion`, porque la
  sonda de internet apunta al portal a propósito y no a un host genérico.
- **Las constantes nuevas del sitio van acá, no inline en una feature ni en el motor.** El
  config se importa primero en los dos entrypoints porque todo lo demás consume sus globals.

Los módulos hermanos siguen en `.js` y entran como globals (`declare const`) **a propósito**:
es lo que mantiene perezosas las puertas en vez de atarlas al orden de carga del entrypoint.
Son `resolverManifiesto.js` (HTML de la clase → `.m3u8`), `parserTitulos.js` (parser de
títulos/cátedra) y `scraper.js` (scraper del DOM), alcanzados vía
`SitioActivo.resolverManifiesto` / `.parsearTitulo` / `.clasificarCarpeta` / `.escanearListado`.

**`scraper.js` juega con una regla propia, y es la que más fácil se rompe sin querer.** Su
`escanearAulaVirtual` no se ejecuta acá: `popup.js` la inyecta con
`chrome.scripting.executeScript` y corre **dentro de la pestaña del portal**, en el mundo
aislado de la página. Tiene que ser **autocontenida y serializable**: no puede referenciar
ninguna global de la extensión (`Utils`, `SitioActivo`, `SitioRamonNet`) **ni siquiera una
constante a nivel de módulo de su propio archivo** — lo que necesite viaja por `args` de
`executeScript`. O sea que la regla de arriba ("las constantes nuevas del sitio van acá, no
inline") **no aplica a lo que vive adentro de esa función**: subir un selector suyo a
`config.ts` deja el escaneo devolviendo vacío en runtime. Y nada lo avisa — ni el bundler, ni
el lint, ni `tsc`, ni la suite (no hay `scraper.test.js`). Se verifica abriendo el popup con
una pestaña del aula virtual activa.

El ruleset dNR vive en **`public/sitio/ramonnet/rules.json`** (en `public/` para que WXT lo
copie tal cual a esa ruta exacta, que es la que referencia `wxt.config.ts`). El config lleva
además el **descriptor de faceta**, cuya forma campo por campo está en
`docs/rearquitectura-diseno.md` §UI.

### `shared/` — lo que todavía no se repartió

Código cargado por los dos entrypoints; es lo que la re-arquitectura va partiendo entre
`core/` (genérico) y `plataforma/` (atado al navegador).

- **`state.ts` (`AppState`)** — la máquina de estados del popup: espeja/persiste la lista
  scrapeada + selección de UI y reconcilia periódicamente contra el progreso autoritativo del
  SW vía `sincronizarConBackground()`. Factory `crearAppState(puerto)` sobre
  `PuertoAlmacenamiento`; el `globalThis.AppState` que leen ~280 call-sites lo publica
  `composicion.ts`, no este archivo. Sigue en `shared/` por dos motivos documentados en su
  cabecera: `sincronizarConBackground()` todavía es `chrome.runtime` crudo, y carga
  vocabulario de sitio (`catedraSeleccionada`) que la Capa 1 no puede aceptar.
- **`utils.js` (`Utils`)** — **genérico desde v6.0.0**: sanitización de nombres/acentos,
  escapado de HTML, helper de descifrado AES, fetch con reintentos y backoff
  (`fetchConReintentos`, que consulta al daemon `Conexion` para cortar los reintentos ante un
  corte real), helpers de blob y matemática de progreso/telemetría. El parser de títulos se
  mudó a `sitio/ramonnet/parserTitulos.js` — **no volver a meter vocabulario del sitio acá**.

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
- **`Conexion`** (daemon, `core/conexion/conexion.ts`) — la fuente **única** del *estado de conexión* (servidor + internet).

El schema exacto, las invariantes de reconciliación (`obtener_estados_en_progreso`) y por qué el split → `docs/data-model.md`. El patrón de ownership y el daemon `Conexion` (modelo push, "no chequeos ad-hoc") → `docs/patterns.md`.

## Auto-sanación ante fallas de red

Cuando la cola se pausa por un error de conexión, `background.js` sondea si el recurso caído volvió y reanuda sola — un circuit breaker ad-hoc de 2 estados. La mecánica (alarma `alarma_autoheal`, intervalo, sondeo vía `Conexion`) → `docs/patterns.md` §Circuit breaker; por qué no se formalizó a 3 estados → `docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`.

**Ojo con los timeouts** (aprendido a los golpes): en Windows, `localhost:3001` con el servidor apagado **cuelga** en vez de rechazar. Todo `fetch` al backend que alimente detección de estado o el loop de descarga lleva `AbortController`+timeout (`obtenerRutaServidor`, `enviarFragmentoStream`). Y el loop del SW **no** debe tratar cualquier `AbortError` como cancelación del usuario (el motor HLS aborta a propósito para frenar workers): sólo el flag `state.abortadoPorUsuario` marca cancelación real.
