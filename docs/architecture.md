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
| **Service Worker** | `background.js` — hoy sobre todo cableado: el bucle, el estado de sesión y el motor viven en `core/` | Único lugar donde ocurren las descargas reales. Dueño de la cola FIFO persistente y de la máquina de estados de auto-sanación ante cortes de red. Sigue 100% vanilla (no tiene DOM). |
| **Offscreen Document** | `public/offscreen/offscreen.js` | Existe solo para el path legacy no-Turbo (`URL.createObjectURL` no está disponible en service workers). No se ejercita mientras Turbo Mode esté forzado a `true`. |
| **Compartido** | `core/**`, `sitio/**`, `plataforma/**` | Código cargado por más de una zona. No es una zona de ejecución: es la librería común, hoy en plena re-arquitectura por capas (ver abajo). `core/conexion/conexion.ts` es el **daemon de estado de conexión** (fuente única, ver Modelo de estado). |

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
`popup.js`, `renderers.js` y `background.js` (`shared/` se vació en la Fase 6a y ya no
existe). El avance por fases vive en
`docs/rearquitectura-diseno.md` §Estado de avance — ése es el doc a leer para saber qué
sigue.

| Capa | Carpeta | Regla | Estado |
|---|---|---|---|
| 1 — Núcleo genérico | `core/` | Cero `chrome.*`, cero Ramón Net. Todo TypeScript. Depende sólo de puertos (`core/puertos/`). | ✅ **Completa** (2026-08-04): `puertos/` (4 interfaces + 3 dobles en memoria), `cola/` (bucle + estado de sesión + espejo de progreso), `hls/`, `conexion/`, `estado/`, `backend/`, `historial/`, `util/` |
| 2 — Adaptador de sitio | `sitio/ramonnet/` | Todo lo específico del portal: scraper, parser de títulos, resolución del `.m3u8`, constantes, faceta, reglas dNR. Cumple `PuertoSitio`. | ✅ Completa (en TS desde 2026-08-03: `config.ts`; los otros 3 archivos siguen en `.js`) |
| 3 — Adaptador de plataforma | `plataforma/chrome/` | Único lugar que toca la API del navegador. Implementa los puertos. | `almacenamiento.ts`, `mensajeria.ts`, `programador.ts`, `notificaciones.ts`, `descargas.ts`, `volcadoLegacy.ts`. Falta lo de la tabla de abajo |
| Composición | `plataforma/composicion.ts` | Único lugar donde se eligen adaptadores concretos y se inyectan al núcleo. | Activa |
| Entrypoints | `entrypoints/` | Puntos de entrada de WXT: resuelven dependencias y las inyectan; no contienen lógica. ✅ los dos inyectan: `background.js` (7a) y `popup/main.js` (7b/7c, que además **monta** las 3 islas con dependencias). Desde la 8a los módulos hermanos entran por `import`: en `globalThis` quedan 5 nombres, todos de Capa 2 |

**Los dos entrypoints ya no funcionan igual, y la diferencia importa al agregar un módulo.**
El del service worker le **pasa** sus 8 dependencias a `iniciarServiceWorker(deps)`: agregarle
una es sumar un parámetro, y si falta, es un `undefined` en la llamada. El del popup hace las
dos cosas: inyecta (`iniciarPopup`) **y monta** las 3 islas que dependen de un servicio
(`conexionHeader`, `onboarding`, `campanita`), que por eso dejaron de auto-montarse.

Su lista de imports **sigue siendo load-bearing**, pero ya no por los servicios sino por los
**módulos**: las otras 3 islas se auto-montan y publican sus puentes, las factories de features
se publican solas, y los `.js` del adaptador de sitio leen `Utils`. Agregar un módulo ahí es
insertar el import en la posición correcta, y equivocarse rompe en runtime sin que el bundler
avise.

**El `PuertoAlmacenamiento` ya no tiene consumidores pendientes**: con `background.js`
migrado (Fase 5b, 2026-08-03) no queda ni un `chrome.storage` en el proyecto.

Lo que **todavía** habla `chrome.*` directo, por API y no por archivo:

| API | Dónde | Puerto que espera |
|---|---|---|
| ~~`runtime` (IPC)~~ | ~~`background.js`, las dos puntas~~ | ✅ Migrado (2026-08-03). **No queda IPC crudo en el proyecto.** En `background.js` sobreviven `onInstalled`, `getURL` y el `lastError` de notifications, que no son IPC |
| ~~`alarms`~~ | ~~`background.js` (auto-heal)~~ | ✅ Migrado (2026-08-03): `PuertoProgramador` + `plataforma/chrome/programador.ts` |
| `notifications` | `background.js` (sólo el listener `onClicked`; el disparo ya está en `plataforma/chrome/notificaciones.ts`) | sin diseñar |
| `tabs` / `windows` | `background.js`, `popup.js` | `PuertoTabs` (diseñado, sin construir) |
| `scripting` | `popup.js` | `PuertoInyeccion` (diseñado, sin construir) |
| `downloads` / `offscreen` | `plataforma/chrome/volcadoLegacy.ts` + `descargas.ts` (y un `downloads.search` en `background.js`) | ya en Capa 3; es el camino legacy no-Turbo, hoy inalcanzable |

**El `PuertoMensajeria` tampoco tiene consumidores pendientes** desde el 2026-08-03: `popup.js`,
`popup/features/queue.js`, `core/estado/appState.ts` y `background.js` (las dos puntas) pasaron todos
en la Fase 5c. No queda un `sendMessage`/`onMessage` crudo en el proyecto.

Fuera de esa tabla quedan dos lugares que no son `background.js` ni `popup.js` y conviene no
olvidar: **`sitio/ramonnet/scraper.js`**, que corre inyectado en la pestaña del portal (regla
propia, más abajo en §Capa 2), y **`public/offscreen/offscreen.js`**, que se copia tal cual y
no se empaqueta — por eso no puede usar imports ES y habla `chrome.runtime` directo.

> Cuidado al contar, dos veces:
>
> 1. Los `chrome.runtime.lastError` que quedan en `popup.js` son de los callbacks de
>    `tabs`/`scripting`, no de mensajería. `lastError` es el mecanismo de error de **toda** la
>    API de callbacks de `chrome.*`, no sólo del IPC.
> 2. **Un grep de `chrome.` en `core/`, en `sitio/*.ts` o en `popup/features/` devuelve sólo
>    comentarios.** Esas capas no tienen una sola llamada; lo que aparece es prosa que nombra
>    la API que el puerto abstrae. Contar por archivo —o por grep crudo— infla el residuo y ya
>    hizo aparecer trabajo que no existía.
>
> Y el residuo que sí existe **no es deuda**: los puertos que faltan (`notifications`,
> `tabs`/`windows`, `scripting`) están conscientemente sin construir y no bloquean nada
> (`docs/rearquitectura-diseno.md` §El próximo paso).

`core/estado/appState.ts` fue el primero de la Fase 5b: ya no toca `chrome.storage` (recibe el puerto
por inyección). El `sendMessage` de `sincronizarConBackground()` —que es **IPC y no
persistencia**, y por eso caía fuera de este puerto— pasó al de mensajería el 2026-08-03, así
que el archivo ya no tiene ningún `chrome.*`.

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

- **El CSS: una sola cadena de `@import`.** Hay exactamente **un** `<link rel="stylesheet">` en
  toda la extensión — `entrypoints/popup/index.html` → `popup/globals.css`, que no tiene reglas
  propias: es una cadena ordenada de `@import` que Vite empaqueta en un único
  `assets/popup-*.css`. Las reglas viven en `styles/`, en la raíz del repo: `variables.css`
  (tokens de diseño) y `base.css` primero, después un archivo por componente en
  `styles/components/`, y `list.css` al final.

  | Regla | Por qué |
  |---|---|
  | Una región de UI nueva necesita `styles/components/<nombre>.css` **y** su línea de `@import` en `popup/globals.css` | Sin el segundo paso el archivo **nunca se empaqueta**. No falla nada: la UI simplemente sale sin estilos. |
  | El orden de los `@import` importa | Es cascada, no globals — pero se rompe igual de callado que el orden de imports del entrypoint. |
  | Las islas Preact dejan inline **sólo** lo *computado* (`style=${...}` para un transform, un cursor, un highlight por fila) | Su apariencia estática va a `styles/components/`, o el estilo del componente queda partido en dos lugares. |

  El split genérico-vs-sitio que la Fase 6c había diseñado para estos archivos se **evaluó y se
  descartó** — rationale en `docs/rearquitectura-diseno.md` §Registro de la Fase 6c.

### Service worker

- **`background.js`** — sigue siendo el único lugar donde las descargas ocurren de verdad, pero
  desde la Fase 6b es sobre todo **cableado** (958 → 451 líneas). Lo que queda: los handlers
  IPC (`manejadoresIPC`), los listeners de `chrome.*` que no tienen puerto todavía
  (`onInstalled`, el click en la notificación, `tabs`/`windows`), y el arranque que reanuda la
  cola cuando el SW despierta con una descarga pendiente.
- **No lee un solo global desde la Fase 7a**: exporta `iniciarServiceWorker(deps)` y recibe sus
  8 colaboradores (los 3 puertos, `SessionState`, `EstadosProgreso`, la cola, el cliente del
  backend y —desde el corte 8 del multi-sitio— `resolverSitioDeNotificacion`, que reemplazó al
  adaptador de sitio fijo: **el SW ya no tiene UN portal**, resuelve el del ítem que falló a
  partir del `notificationId`) desde `entrypoints/background.js`. **Regla al tocarlo**: la
  llamada va en el **top-level** del entrypoint, nunca dentro del callback de
  `defineBackground` ni detrás de un `await` — MV3 exige que los listeners queden registrados
  en el arranque sincrónico del worker, y perderlos no lo detecta ninguna de las cuatro
  verificaciones (se ve como "la extensión no responde" tras un arranque en frío).
- **La cola y el motor ya no viven en esta zona**: son Capa 1 desde las Fases 6b y 6
  (`core/cola/procesadorCola.ts`, `core/hls/hlsEngine.ts`, abajo). El SW no los construye —
  los recibe armados de la composición— y los maneja por su API.
- **`public/offscreen/offscreen.js`** — documento offscreen del camino legacy no-Turbo (los
  service workers no tienen `URL.createObjectURL`). Vive en `public/`, se copia tal cual y no
  se bundlea. No se ejercita mientras Turbo esté forzado.

### Capa 1 — `core/`

`core/puertos/` tiene las **interfaces de los puertos**: `almacenamiento.ts` (persistencia),
`mensajeria.ts` (IPC), `programador.ts` (tareas diferidas) y `sitio.ts` (`PuertoSitio`, el
contrato que un adaptador de portal debe cumplir). Los tres primeros vienen con implementación
en memoria (`almacenamientoEnMemoria.ts`, `mensajeriaEnMemoria.ts`, `programadorEnMemoria.ts`)
que permite testear lógica sin mockear `chrome.*` a mano, incluida una conversación popup↔SW
completa in-process. Los tres dobles tienen tests propios: si el doble miente, todo lo que se
apoye en él pasa verificando algo que en el navegador no ocurre.

**`PuertoMensajeria` parte en dos lo que `chrome.runtime.sendMessage` mezclaba**: `enviar()`
espera respuesta y rechaza si el canal falla; `notificar()` es fire-and-forget y no rechaza
nunca. Elegir uno es explícito en cada call-site — contrato completo en `docs/patterns.md`.
Detalle operativo que salió de leer la consola del SW tras una descarga real: **un `notificar()`
que no recibe respuesta no es un fallo, es su definición**. Chrome reporta por `lastError` dos
condiciones —"port closed before a response" (hubo receptor y no contestó) y "could not
establish connection" (no había nadie)— y en esta extensión **las dos son normales**, porque el
SW avisa progreso con el popup cerrado casi siempre. El adaptador las consume para que Chrome no
las marque como error no manejado, y deja sólo una traza en `debug` por acción. Antes eran un
`console.warn` que además las etiquetaba mal, como "sin receptor".

**`core/hls/hlsEngine.ts` es el motor de descarga**: parsea el manifiesto M3U8 (fragmentos +
`#EXT-X-KEY`) y corre el pool de 6 workers (`CONCURRENCIA_MAXIMA`) que descarga, descifra con
AES-128 y —en modo Turbo— streamea cada fragmento al backend Bun. Factory
`crearHlsEngine({ fetchConReintentos, descifrarFragmento, generarVideoFinalBlob, backend })`.

Llegó a la Capa 1 el **2026-08-03**, y su medición previa había subestimado el corte: parecía
trivial porque no tiene un solo `chrome.*`, pero **leía dos cosas del service worker que no
aparecían como `X.metodo()`** sino como identificadores pelados —`SessionState.get([...])` y
`controladorGraficoActivo.abort()`—, así que un grep por dependencias no las mostraba. Las dos
se cortaron y son hoy parámetros:

- **`contexto`** (`{ modoTurbo, titulo, sessionId, abortarHermanos }`) reemplaza la lectura de
  `SessionState`. El motor no puede leer el estado de la cola: no es suyo.
- **`abortarHermanos()`** reemplaza el `abort()` sobre el controlador del SW. El motor sabe
  *cuándo* hay que frenar la ráfaga ante un fallo real de fragmento; **quién** es el dueño del
  `AbortController` es del caller. Esa distinción es lo que lo vuelve testeable sin el SW.

**`core/cola/procesadorCola.ts` es el bucle de descarga**: el FIFO, la clasificación de fallos,
la pausa, el freno suave y la auto-sanación. Salió de `background.js` en la Fase 6b y es el
bloque de lógica más grande del proyecto — el SW pasó de 958 a 451 líneas.

Su verdadero contenido no es el FIFO sino **la clasificación de fallos, que tiene cuatro
caminos y cada uno existe por un bug real**: (1) cancelación del usuario, que no es un fallo;
(2) `tipoConexion: "sesion"`, que pausa SIN alarma porque el daemon vería la red OK y el
auto-heal reintentaría contra el login; (3) `tipoBackend: "rechazo"` (4xx), que **saltea sólo
esa clase** — es el fix del bug 400; y (4) cualquier otro, que pausa CON alarma. **El orden
importa**: los tres primeros se clasifican antes de consultar al daemon.

`loopActivo` y el `AbortController` de la ráfaga eran variables de módulo compartidas entre el
bucle y los handlers IPC; ahora son **estado privado** y se tocan por la API
(`arrancarSiNoCorre` / `detener` / `abortarRafaga`). Esa guarda es lo que impide dos ráfagas
simultáneas — que duplican descargas y se pisan el progreso — y hasta la 6b no tenía ni un test.

El progreso tiene **dos destinos**, y es fácil pensar que sólo uno: el IPC al popup y
`actualizarConsolaBackend`, la barra de la ventana del servidor Bun — que es lo único que el
usuario ve con el popup cerrado. Perder el segundo no rompe ninguna descarga, así que no se
nota salvo usando la extensión (pasó en la Fase 6b; hoy tiene test).

Recibe **doce colaboradores y ninguno es `chrome.*`**: los tres que tocan el navegador (la
notificación nativa, el volcado legacy a disco y el adaptador de sitio) entran ya envueltos
desde Capa 3 o Capa 2. Por eso el bucle entero se puede correr en un test sin navegador.

**`core/cola/estadoSesion.ts` (`SessionState`) es el estado de la ráfaga activa**, la mitad
"service worker" del split de ownership. Salió de `background.js` el 2026-08-04, primer tramo
de la Fase 6b. Existe como envoltura y no como llamadas sueltas al puerto **por los defaults**:
`chrome.storage.session` arranca vacío en cada despertar del SW y el bucle lee estas claves
esperando valores, no `undefined`. El relleno usa `!= null` y no un chequeo por falsy, que es
la diferencia entre "no hay dato" y "el dato es `false`" — con `modoTurboBunActivo`, cuyo
default es `true`, confundirlas dejaría al SW creyendo que sigue en turbo.

De paso perdió una polimorfia muerta: `get()` aceptaba una clave suelta o una lista, pero el
único call-site que las usaba era el motor HLS, que desde la Fase 6 recibe su contexto por
parámetro. Los 11 restantes llamaban sin argumentos.

**`core/estado/appState.ts` (`AppState`) es la máquina de estados del popup**: espeja/persiste
la lista scrapeada + la selección de UI y reconcilia periódicamente contra el progreso
autoritativo del SW vía `sincronizarConBackground()`. Factory
`crearAppState(almacenamiento, mensajeria)` sobre los dos puertos; el `globalThis.AppState` que
leen ~280 call-sites lo publica `composicion.ts`, no este archivo. Llegó a la Capa 1 el
**2026-08-03**, en tres pasos que valen como plantilla: primero los puertos (storage en la 5b,
IPC en la 5c) y **después sacarle el dato de sitio** — mientras el campo se llamó
`catedraSeleccionada`, este archivo no podía ser genérico por una sola palabra. Qué faceta se
filtra lo decide el adaptador; `AppState` no sabe que existen las cátedras. Hasta el 2026-08-06
esa indirección era `PuertoSitio.faceta.claveEstado`, que **nombraba** el campo de acá — se fue
con ADR-0012, porque la elección pasó a ser **por portal** (`facetaElegidaDe(sitioId)`) y la
clave es ahora el `sitioId`. El archivo acumula las tres migraciones de datos del proyecto
(`catedraElegida` → `facetaElegida` → `facetasElegidas`) → `docs/data-model.md`.

**`core/estado/credencialesPortal.ts` guarda lo que un portal expone SÓLO dentro de su pestaña**
y su `resolverManifiesto` necesita después, desde el service worker (corte 7). Factory
`crearCredencialesPortal(almacenamiento)` sobre el puerto de storage, clave
`credencialesPortal: { [sitioId]: {...} }`. **No está en `AppState` a propósito**: `AppState` es
del popup y acá el lector es el SW, así que es un export compartido de `composicion.ts` — el
mismo motivo por el que lo son `sitios` e `identidadClase`. El contenido es **opaco**: qué claves
lleva lo decide cada adaptador, y por eso Capa 1 no nombra ningún token. Decisión y alternativas
→ ADR-0013; la parte de seguridad (es la primera credencial que la extensión guarda) →
`docs/security.md`.

Detalle de forma en `sincronizarConBackground()`: usa `enviar()` (es una consulta) **y además**
conserva su timeout de rescate de 3s, porque el puerto sólo promete rechazar cuando no hay
receptor — no cubre al receptor que acepta, promete responder async y nunca responde.

**`core/conexion/conexion.ts` (`Conexion`) es la fuente única de verdad del estado de
conexión** (servidor + internet), corriendo en popup y en SW; se lee con `Conexion.get()` o se
escucha con `Conexion.suscribir(cb)`. **Regla operativa: no agregar sondas `/api/health` ni
HEAD de internet ad-hoc en ningún otro lado — consumir el daemon.** Modelo push, espejado y
contrato completo → `docs/patterns.md` §Daemon de estado de conexión. Misma forma que los
demás módulos del núcleo: factory `crearConexion(puerto, opciones)`, instancia publicada por
`composicion.ts`, espejado cross-contexto por el ámbito de sesión del puerto.

Llegó a la Capa 1 el **2026-08-03**, y vale como ejemplo de qué frena una mudanza: `chrome.*`
no le quedaba desde la Fase 5b, pero seguía leyendo el global del sitio activo para saber a qué
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

**`PuertoProgramador` no es "un timer con otra cara"** (`core/puertos/programador.ts`, 2026-08-03).
Su razón de existir es que en MV3 el service worker se suspende y con él muere cualquier
`setInterval`: la alarma sobrevive y **despierta al worker**. Por eso el único cliente es la
auto-sanación. Dos detalles de contrato que el código de auto-heal ya asumía y ahora están
escritos: `programar()` es **idempotente por nombre** (reprogramar reemplaza, no acumula), y el
período va en **minutos decimales** —la unidad de `chrome.alarms`— para no tener que convertir
en el adaptador ni releer call-sites buscando cuál quedó en la unidad vieja.

**`ErrorBackend` convierte en tipo lo que era una convención en comentarios**:
`tipoBackend: "rechazo"` marca **sólo** 4xx (saltear la clase), nunca 5xx (pausar +
auto-heal). De esa distinción depende el fix del bug 400.

### Capa 3 — `plataforma/`

`plataforma/chrome/almacenamiento.ts` implementa `PuertoAlmacenamiento` sobre
`chrome.storage`; `plataforma/chrome/programador.ts` implementa `PuertoProgramador` sobre
`chrome.alarms` (adaptador fino: la API ya es idempotente por nombre y ya sobrevive a la
suspensión, así que sólo traduce nombres y degrada a no-op donde no existe — el popup);
`plataforma/chrome/mensajeria.ts` implementa `PuertoMensajeria` sobre
`chrome.runtime`, y usa a propósito la forma **callback**, porque es la única que expone
`chrome.runtime.lastError`: el adaptador siempre lo lee y lo convierte en rechazo o en
warning.

**`plataforma/composicion.ts` es la raíz de composición** — el único lugar donde los
adaptadores concretos se inyectan en los módulos del núcleo y se publican como globals. Vive
fuera de `entrypoints/` porque WXT trata cada archivo suelto de ahí como un entrypoint.
**Un módulo que se desacopla de `chrome.*` se instancia acá.**

### Capa 2 — `sitio/<portal>/`

**Hay dos portales desde el 2026-08-07** (corte 7): `sitio/ramonnet/` y
`sitio/anatomy-by-chris/` (Hotmart Club). Cada uno son cuatro archivos —`config.ts` + tres
hermanos `.js`— y su `rules.json` en `public/sitio/<portal>/`.

`sitio/<portal>/config.ts` exporta **su descriptor y nada más**: se declara implementación de
`PuertoSitio`, así que a un adaptador de portal al que le falte una pieza lo caza el compilador
y no la lectura.

**⚠️ Los globals de los tres hermanos llevan nombre por portal.** Los de Ramón Net son los que
quedaron sin calificar por haber sido el primero (`Scraper`, `ParserTitulos`,
`ResolverManifiesto`); los del segundo son `ScraperAnatomy`, `ParserTitulosAnatomy`,
`ResolverManifiestoAnatomy`. Compartir un nombre hace que **el último entrypoint evaluado le pise
los tres al otro portal**, y el síntoma sería un portal escaneando o resolviendo con el adaptador
ajeno — en silencio, y sin que lo vea el bundler, el lint, `tsc` ni la suite. Cada nombre nuevo va
también a `globalesDelProyecto` en `eslint.config.js`.

**Cómo se autentica el portal decide si el corte toca Capa 1.** Ramón Net resuelve con la cookie
de sesión (`credentials: "include"`) y no necesita nada más. Anatomy by Chris necesita un
`id_token` que sólo existe en el `localStorage` de su pestaña, y el service worker no tiene
pestaña: por eso su scraper lo devuelve en `ResultadoEscaneo.credenciales`, se guarda **por
portal** en `core/estado/credencialesPortal.ts` y le vuelve como tercer parámetro de
`resolverManifiesto`. La decisión y sus alternativas → ADR-0013.

**Qué portal está activo NO lo decide este archivo**, y es un cambio del 2026-08-04 (corte 2 de
`docs/multisitio-diseno.md`): acá vivía `const SitioActivo = SitioRamonNet`, o sea un portal
declarándose a sí mismo el activo. Ahora la lista y la resolución son de **`sitio/registro.ts`**,
que es Capa 2 pero genérico:

| Cómo se llega a un portal | Cuándo |
|---|---|
| `Sitios.resolverPorUrl(url)` | Al escanear: el portal sale de la **pestaña activa** |
| `Sitios.obtener(sitioId)` | Después: el portal sale del **ítem** (ADR-0010), porque la cola está desacoplada de la pestaña |
| `sitios.obtener(...)` (el export de `composicion.ts`) | Lo que consume el código: es el registro **con la migración aplicada**, y hay uno solo para que el SW y el popup no puedan divergir |

**Ojo con la diferencia entre "sin sitio" y "sitio desconocido"**, que se parecen y significan lo
contrario: un `sitioId` ausente es un dato de antes del multi-sitio y **resuelve** al portal
legado; uno presente pero no registrado es un **huérfano** y no resuelve. El detalle y por qué
esa regla vive en la composición → `docs/multisitio-diseno.md` §La trampa del corte 3.

Dos reglas al agregarle algo:

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
`sitio.resolverManifiesto` / `.parsearTitulo` / `.clasificarCarpeta` / `.escanearListado`, donde `sitio` es el descriptor que el consumidor recibió inyectado.

**La fila de la lista dice cuatro cosas, y una entró al puerto por eso** (ajuste de UI del
2026-08-07, después de usar el frente): ícono de tipo (🎬/📄) en **las dos pestañas**, título, y una
**pastilla de materia pintada con el color del portal** (`PuertoSitio.color`). El color entra al
puerto porque lo lee alguien de afuera de `sitio/`. Tres decisiones que no son obvias:

- **El ícono va siempre, no sólo en los adjuntos.** Mostrarlo únicamente cuando hay un PDF obliga a
  leer la *ausencia* de un ícono como información, y eso no se lee.
- **Materia y portal comparten un solo elemento.** En la Cola —que mezcla portales a propósito— la
  fila no tenía cómo decir de dónde salía ni a qué carpeta iba; dos pastillas por fila en una lista
  de 28 px de alto es peor que resolverlo con el color de la que ya hacía falta. El nombre del
  portal viaja en el `title`, que no ocupa lugar.
- **El naranja del acento no puede ser un color de portal**: ya significa "seleccionada" y
  "bajando" en esa misma fila, y lo reusa el estado de override de la pastilla, que es una
  advertencia y no una identidad.

El peso de un adjunto **se sacó**: no cambiaba ninguna decisión (los PDF se bajan o no por lo que
son, no por lo que pesan) y sumaba ruido. El campo `bytes` sigue en el ítem porque el bucle lo usa
como respaldo del `Content-Length`.

**Anatomy by Chris tiene un cuarto hermano** desde el corte 5 del escaneo por API:
`descargarAdjunto.js` (`DescargarAdjuntoAnatomy`), alcanzado vía `sitio.resolverAdjunto` — un
método **opcional** del puerto, que un portal sin materiales simplemente no implementa. Convierte
el id de un adjunto en una URL descargable, y **nada más**: los bytes los baja el bucle, que es
genérico. Se importa **sólo en el entrypoint del service worker** y no en el del popup, porque la
URL que devuelve vive **una hora**: pedirla al escanear la vencería antes de usarla.

**Y el scraper de ese portal ya no lee el DOM**: le pide el árbol a `/v1/navigation` (11 módulos,
114 clases en una llamada) y después un `complementary-content` por lección con pool de 6. Por eso
`escanearListado` puede ser `async` — `executeScript` espera la promesa—, y por eso el `fetch` va
**inyectado en la pestaña** y no en el SW: desde la pestaña sale con el origen de `hotmart.com` y
el `id_token` de su `localStorage`, que el service worker no puede replicar. Ramón Net sigue
devolviendo sincrónicamente y no se enteró.

**Cómo resuelve `ResolverManifiesto.resolver`, y por qué es el primer sospechoso cuando una
descarga trae el video equivocado.** El camino principal **no** parsea el manifiesto: extrae el
`<iframe>` activo que apunta a `b-cdn.net`/`mediadelivery.net`, le saca el hash UUID y
**construye la URL** con la `plantillaM3u8` del descriptor (`vz-c3e7bda8-f29.b-cdn.net/{hash}/480p/video.m3u8`).
Sólo si el match del iframe falla cae a **tres barridos de regex progresivamente más laxos**
sobre el HTML crudo. Las consecuencias de ese diseño:

- **Es frágil ante cambios de markup del portal**, por construcción — depende de la forma del
  iframe, no de un contrato. Si las descargas empiezan a resolver el video de otra clase, se
  mira acá antes que en el motor: el motor ya recibe la URL resuelta y no tiene cómo equivocarse.
- **Los fallbacks degradan en silencio**: son más laxos, así que pueden *acertar* con el video
  de otra clase de la misma página en vez de fallar. Un fallback que devuelve algo no es señal
  de que el camino principal siga sano.
- La calidad está **fijada en `480p`** dentro de la plantilla; no se negocia leyendo el
  manifiesto maestro.
- Hace `fetch(..., { credentials: "include" })` contra el portal a propósito (rationale y
  encuadre de CSRF → `docs/security.md`), y de ahí sale la detección de sesión caída:
  si la URL final perdió `/clases-grabadas/`, lanza `err.tipoConexion = "sesion"`
  (el caso `"sesion"` y por qué se clasifica antes de consultar al daemon →
  `docs/patterns.md` §Circuit breaker ad-hoc).

**`scraper.js` juega con una regla propia, y es la que más fácil se rompe sin querer.** Su
`escanearAulaVirtual` no se ejecuta acá: `popup.js` la inyecta con
`chrome.scripting.executeScript` y corre **dentro de la pestaña del portal**, en el mundo
aislado de la página. Tiene que ser **autocontenida y serializable**: no puede referenciar
ninguna global de la extensión (`Utils`, `SitioRamonNet`) **ni siquiera una
constante a nivel de módulo de su propio archivo** — lo que necesite viaja por `args` de
`executeScript`. O sea que la regla de arriba ("las constantes nuevas del sitio van acá, no
inline") **no aplica a lo que vive adentro de esa función**: subir un selector suyo a
`config.ts` deja el escaneo devolviendo vacío en runtime. Y nada lo avisa — ni el bundler, ni
el lint, ni `tsc`, ni la suite. Se verifica abriendo el popup con una pestaña del portal activa.

**Ojo con lo que un `scraper.test.js` sí y no puede afirmar.** Desde el corte 7 el scraper del
segundo portal tiene tests contra el HTML **real** del portal (fixture recortado de las páginas
guardadas), y eso cubre lo que el DOM le pueda hacer: títulos envenenados, enlaces que no son
clases, filas de otro tipo. **Lo que no cubre es la serialización**, que es justamente esta
regla: en el test la función corre importada, con su módulo entero disponible. Un test verde no
dice nada sobre si sobrevive a `executeScript`.

**`resolverManifiesto` tiene que devolver una playlist de MEDIOS, nunca un master
multi-variante.** `core/hls/hlsEngine.ts` no los distingue: toma toda línea sin `#` como
fragmento, así que ante un master se baja el `.m3u8` de la variante creyéndolo un `.ts`, lo
descifra y le manda al backend un archivo de unos KB — **sin un error en ningún lado**. Ramón Net
nunca lo destapó porque su plantilla apunta directo a una playlist de medios; el adaptador de
Hotmart pide el master, elige la variante de mayor `BANDWIDTH` y devuelve esa. Elegir variante es
trabajo del adaptador, no del motor.

Cada portal lleva su ruleset dNR en **`public/sitio/<portal>/rules.json`** (en `public/` para que
WXT lo copie tal cual a esa ruta exacta, que es la que referencia `wxt.config.ts`), con su `id`
propio en el manifest. Los dos existentes hacen cosas distintas: el de Ramón Net **bloquea**
requests a `bunnyinfra.net`; el de Anatomy by Chris **pone un header** (`Referer`) que `fetch` no
puede setear y sin el cual el embed contesta 401. El config lleva además el **descriptor de
faceta**, cuya forma campo por campo está en `docs/rearquitectura-diseno.md` §UI.

### `Utils` ya no es un archivo: es un ensamblado

`shared/` **dejó de existir el 2026-08-03** (Fase 6a). Su último habitante, `utils.js`, no era
una capa sino tres cosas mezcladas, y se repartió según lo que cada función realmente hacía:

| Dónde quedó | Qué | Por qué ahí |
|---|---|---|
| `core/util/texto.ts` | `sanitizarTexto`, `escaparHtml`, `quitarAcentos` | puras, sin `chrome.*` ni portal |
| `core/util/media.ts` | `descifrarFragmento`, `generarVideoFinalBlob` | `crypto.subtle` y `Blob` son APIs web, no de extensión |
| `core/util/progreso.ts` | `calcularMétricasProgreso`, `formatearMB`, `calcularProyeccionMB` | aritmética + formateo |
| `core/util/reintentos.ts` | `fetchConReintentos` | **factory**: recibe el daemon en vez de leer el global |
| `plataforma/chrome/descargas.ts` | `inyectarArchivoEnDiscoChrome` | usa `chrome.downloads` → Capa 3, nunca fue Capa 1 |

**El global `Utils` sigue existiendo**, pero ahora lo ensambla `plataforma/composicion.ts` a
partir de esas piezas. Es deliberado: ~200 call-sites del código vanilla lo consumen como
`Utils.loQueSea(...)`, y reescribirlos era un corte aparte y mucho más grande que el que
resolvía el problema de capas. **Consecuencia de orden de carga**: ese global aparece más tarde
que antes (lo publicaba `utils.js` al evaluarse). Es seguro porque ningún consumidor llama a
`Utils.*` en tiempo de evaluación —se verificó archivo por archivo—, pero es la clase de cosa
que el bundler no verifica: no llames a `Utils.*` en el top-level de un módulo.

**No volver a meter vocabulario del sitio acá**: el parser de títulos vive en
`sitio/ramonnet/parserTitulos.js` desde v6.0.0, y ésa es la frontera.

## Flujo de una descarga, de punta a punta

1. **Scraping**: el usuario abre el popup con la pestaña de Ramón Net activa. `popup.js` inyecta `Scraper.escanearAulaVirtual` (definida en `sitio/ramonnet/scraper.js`, Capa 2, y consumida vía `sitio.escanearListado`) en esa pestaña, que lee el DOM y devuelve la lista de clases visibles + la materia detectada.
2. **Clasificación**: cada título crudo pasa por `sitio.parsearTitulo`/`.clasificarCarpeta` (`sitio/ramonnet/parserTitulos.js`, Capa 2) para derivar nombre de archivo canónico, cátedra (A–D) y carpeta de destino.
3. **Encolado**: el usuario selecciona clases y las agrega a la cola. `popup.js` actualiza `AppState.colaDescargas` de inmediato (optimistic update) y notifica al service worker vía `inyectar_items_en_cola_activa`.
4. **Procesamiento** (`background.js`, `procesarSiguienteElementoDeLaCola`): toma el primer ítem FIFO de la cola persistida en `chrome.storage.local`, y:
   - `sitios.obtener(item.sitioId).resolverManifiesto` (`sitio/ramonnet/resolverManifiesto.js`, Capa 2) resuelve la URL del manifiesto `.m3u8` a partir del HTML de la página de la clase; el motor HLS ya sólo recibe la URL resuelta.
   - `HlsEngine.descargarYAnalizarIndexM3u8` parsea el manifiesto (fragmentos + clave de cifrado `#EXT-X-KEY`).
   - `HlsEngine.compilarTranscodificacionStream` descarga los fragmentos `.ts` con un pool de 6 workers concurrentes, los descifra con AES-128-CBC (WebCrypto nativo), y los envía en streaming al backend Bun (`BunClient.enviarFragmentoStream`).
5. **Persistencia en disco**: el backend Bun recibe cada fragmento vía `POST /api/bypass-stream` y los ensambla directamente en el filesystem del usuario — la extensión nunca mantiene el video completo en memoria.
6. **Reconciliación**: el popup sincroniza su vista del progreso contra el estado real del service worker (`obtener_estados_en_progreso`) en cada apertura y periódicamente mientras está abierto.

## Modelo de estado

El estado está deliberadamente **partido, no compartido**, entre popup y service worker. Cada zona es dueña de una porción; se reconcilian por IPC, no comparten memoria. En una línea cada uno:

- **`AppState`** (popup, `core/estado/appState.ts`) — la *lista de clases scrapeadas* + selección/filtros de UI.
- **`SessionState`** (service worker, `core/cola/estadoSesion.ts`) — el *progreso de la descarga activa*.
- **`Conexion`** (daemon, `core/conexion/conexion.ts`) — la fuente **única** del *estado de conexión* (servidor + internet).

El schema exacto, las invariantes de reconciliación (`obtener_estados_en_progreso`) y por qué el split → `docs/data-model.md`. El patrón de ownership y el daemon `Conexion` (modelo push, "no chequeos ad-hoc") → `docs/patterns.md`.

## Auto-sanación ante fallas de red

Cuando la cola se pausa por un error de conexión, `background.js` sondea si el recurso caído volvió y reanuda sola — un circuit breaker ad-hoc de 2 estados. La mecánica (alarma `alarma_autoheal`, intervalo, sondeo vía `Conexion`) → `docs/patterns.md` §Circuit breaker; por qué no se formalizó a 3 estados → `docs/adr/0003-defer-circuit-breaker-and-idempotency-service.md`.

**Ojo con los timeouts** (aprendido a los golpes): en Windows, `localhost:3001` con el servidor apagado **cuelga** en vez de rechazar. Todo `fetch` al backend que alimente detección de estado o el loop de descarga lleva `AbortController`+timeout (`obtenerRutaServidor`, `enviarFragmentoStream`). Y el loop del SW **no** debe tratar cualquier `AbortError` como cancelación del usuario (el motor HLS aborta a propósito para frenar workers): sólo el flag `state.abortadoPorUsuario` marca cancelación real.
