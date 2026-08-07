# Modelo de datos

Esta extensión no tiene base de datos — el equivalente es el esquema de `chrome.storage`. **Ningún módulo lo toca directo desde la Fase 5b**: todo el acceso pasa por el `PuertoAlmacenamiento` y su adaptador (`plataforma/chrome/almacenamiento.ts`). Los nombres de clave y ámbitos de esta tabla son igualmente la fuente de verdad — describen lo que el adaptador escribe. Este documento es la fuente de verdad de qué claves existen, en qué storage viven, su forma, y quién las escribe/lee. Si agregás o cambiás una clave, actualizá esta tabla en el mismo cambio.

## `chrome.storage.local` — persistente entre reinicios del navegador

Escrito principalmente por `AppState.respaldar()` (`core/estado/appState.ts`) desde el popup, y por varios handlers IPC en `background.js`.

| Clave | Forma | Escrita por | Descripción |
|---|---|---|---|
| `listaPersistente` | `Clase[]` (ver abajo) | popup (`AppState.respaldar`), SW (varios handlers IPC) | Lista completa de clases scrapeadas de la última sesión, con su estado actual. |
| `colaDescargas` | `ColaItem[]` (ver abajo) | popup, SW | Cola de descarga desacoplada — separada de `listaPersistente` para poder sobrevivir a cambios de materia/pestaña sin perder el progreso. **El array ES el orden de descarga** desde el corte 6d (ADR-0011): lo escribe el popup y el SW lo obedece. |
| `faseDiscoOk` | `boolean` | popup | Si ya se corrió una sincronización con el disco (vía `escanear_carpeta_local`) en esta sesión. |
| `facetasElegidas` | `Record<sitioId, string \| null>` | popup | El valor de faceta que el usuario eligió **en cada portal** (en Ramón Net: la cátedra A–D). No se lee directo: `AppState.facetaElegidaDe(sitioId)` / `.fijarFacetaElegida(...)`. **Era un valor único (`facetaElegida`) hasta el 2026-08-06** y eso vaciaba el listado al cambiar de portal — ver ADR-0012 y la nota de migración abajo. Antes todavía se llamó `catedraElegida` (hasta el 2026-08-03). |
| `ocultarAdvExplorar` | `boolean` | popup | Preferencia: no volver a mostrar el aviso al explorar carpeta. |
| `ocultarAdvAula` | `boolean` | popup | Preferencia: no volver a mostrar el aviso al cambiar de aula. |
| `ordenAscendente` | `boolean \| null` | popup | **Sentido del orden de la pestaña Disponibles**: `true`=ascendente, cualquier otra cosa=descendente — sí, `null` cae en descendente, porque ahí sólo se mira su verdad/falsedad. Hasta el corte 6b servía **también** a la Cola con otra semántica (`null`=FIFO, `true`/`false`=nombre ↑/↓); esa mitad se mudó a `criterioOrdenCola`/`ordenColaAscendente` y ésta quedó como estaba. Que un solo campo significara dos cosas distintas según quién lo leyera es la razón por la que la migración **no** lo tocó: derivarlo hacia `true` habría dado vuelta Disponibles en toda instalación existente, sin que nada lo dijera. |
| `criterioOrdenCola` | `"llegada" \| "nombre" \| "faceta" \| "portal"` | popup | **Sólo pestaña Cola** (corte 6b). Por qué eje se ordena. `faceta` y `portal` se resuelven contra el descriptor de **cada ítem** vía su `sitioId`, no contra un sitio fijo — la cola puede mezclar portales (ADR-0010). `portal` ordena por portal y, dentro de cada uno, por llegada. Un valor desconocido en storage cae a `"llegada"`. **Migración**: si la clave no existe, se deriva del `ordenAscendente` viejo (`null`→`"llegada"`, si no `"nombre"`). |
| `ordenColaAscendente` | `boolean` | popup | **Sólo pestaña Cola** (corte 6b). Sentido del criterio de arriba; invertirlo es lo que convierte "llegada" en LIFO, que por eso dejó de ser un criterio propio. **Migración**: si no existe, sale del `ordenAscendente` viejo (`null`→`true`, si no su valor). |
| `criterioOrdenDisponibles` | `"nombre" \| "faceta" \| "estado"` | popup | **Sólo pestaña Disponibles** (corte 6b). Sus ejes son otros que los de la Cola: no hay `llegada` —ese listado no se encoló, se escaneó— ni `portal`, porque sale del scrapeo de **una** pestaña. La faceta se lee con `faceta.leer` (campo ya parseado), no con `leerDeCola` (que re-deriva del título). **Sin migración**: el default `"nombre"` reproduce exactamente el orden por título que había antes, y el sentido lo sigue dando `ordenAscendente`. |
| `tutorialCompletado` | `boolean` | popup | Si el onboarding ya se completó/saltó. |
| `SW_ESTADOS_PROGRESO` | `Record<string, EstadoClase>` | SW (`persistirEstadoFondo`) | Mapa **`<sitioId>\|<titulo>` → estado** de progreso, espejo liviano para que el popup pueda reconciliar sin pedir el detalle completo. La clave era el título solo hasta el 2026-08-06 — ver §La identidad de una clase. Las claves viejas se migran **al leer**, prefijándolas con el portal legado. |
| `credencialesPortal` | `Record<sitioId, Record<string, string>>` | popup (al escanear, vía `credencialesPortal.guardar`) | **Credenciales que un portal expone sólo dentro de su pestaña** y que su `resolverManifiesto` necesita después, desde el SW (corte 7: el `id_token` de la API de Hotmart Club). No se lee directo: `core/estado/credencialesPortal.ts` — el mismo módulo lo escribe el popup y lo lee el SW. **No viaja con la clase ni con el ítem de la cola**: es de la sesión del usuario en el portal, no de un video, así que se guarda una vez por portal y re-escanear renueva el token de toda la cola de ese portal. El contenido es **opaco** para el núcleo: qué claves lleva lo decide cada adaptador. **Sin migración**: la clave ausente se lee como `{}`, y un portal que no la use (Ramón Net) nunca la escribe. |
| `historialFallos` | `HistorialFallo[]` (ver abajo) | SW (`registrarFallo` → `HistorialFallos.registrar`), popup (marcar leídas / limpiar) | Historial acotado (últimos 50, más-reciente-primero) de fallos terminales de descarga (rechazo 4xx / sesión / servidor / internet). Fuente de la campanita del popup; la escribe el SW aun con el popup cerrado. |

### Migración: `sitioId` en `Clase` y `ColaItem` (2026-08-04)

**Por qué**: con multi-sitio el portal deja de ser una propiedad de la build y pasa a ser un dato
de cada ítem (ADR-0010). El service worker lo necesita porque la cola está **desacoplada de la
pestaña** a propósito: cuando toma un ítem no hay ninguna URL que consultar para deducir de qué
portal era.

**Regla**: un ítem persistido **sin** `sitioId` se lee como `"ramonnet"`. Es correcto por
construcción —hasta esta migración no existía otro portal— y no toca los datos en disco: la
normalización pasa **al cargar**, en `inicializarSincronizacionStorage()`, igual que la
migración de la faceta de abajo.

**Ojo con el valor por defecto**: `SITIO_LEGADO` (`core/estado/appState.ts`) **describe el
pasado, no el presente**. Si algún día cambia cuál es el portal principal, esa constante no
cambia — lo guardado antes del multi-sitio sigue habiendo venido de Ramón Net.

Cubierto por 3 tests en `core/estado/appState.test.ts` (ítem legado, ítem que ya trae su sitio,
y lista vacía / entradas nulas).

### Migración: `facetaElegida` → `facetasElegidas`, un mapa por portal (2026-08-06)

**ADR-0012.** La elección de faceta era **un solo casillero**, y con dos portales eso rompe en
la peor forma: elegís "Cátedra A" en uno, pasás al otro, `"A"` no matchea ninguno de *sus*
valores y el filtro esconde todo — **el listado se ve vacío**, sin error ni explicación.

La clave pasa a ser un mapa `{ [sitioId]: valor }`. El valor único de una instalación existente
entra como el del **portal legado**: correcto por construcción, porque no había otro portal del
cual pudiera venir. Misma mecánica que la migración de abajo, incluido el borrado de la clave
vieja; si conviven mapa y valor único, gana el mapa.

En el mismo cambio **`PuertoSitio.faceta.claveEstado` dejó de existir**: nombraba *una*
propiedad de `AppState`, y con un mapa la clave es el `sitioId`.

### Migración: `catedraElegida` → `facetaElegida` (2026-08-03)

Fue la **primera migración de datos del proyecto** y sirvió de plantilla para la de `sitioId`,
justo arriba.
El renombre no fue cosmético: mientras la clave y el campo en memoria se llamaran `catedra*`,
`AppState` cargaba vocabulario de Ramón Net y no podía ser Capa 1 (hoy vive en
`core/estado/appState.ts`).

Cómo se hizo, en `inicializarSincronizacionStorage()`:

1. Se leen **las dos** claves. La nueva gana si existe; si sólo está la vieja, se adopta su
   valor.
2. Adoptado el valor, la clave vieja se **borra** ahí mismo (fire-and-forget): la migración se
   paga una sola vez y no queda basura en el storage.

**Por qué no alcanzaba con renombrar y listo**: la extensión está instalada y en uso, así que
la clave vieja ya existe con un valor real. Perderlo no rompe nada a nivel técnico —el campo
vuelve a `null`— pero al usuario le reaparece el modal multicátedra sin ninguna razón visible,
y tiene que volver a elegir. Es el tipo de regresión que ninguna suite marca en rojo.

La red son tres tests en `core/estado/appState.test.ts` §migración de la clave de faceta:
adopta la vieja, la borra al adoptarla, y con las dos presentes gana la nueva.

### `Clase` (elemento de `listaPersistente`)

```ts
{
  id: string,
  numeroOriginal: number,       // orden en que apareció en el scraping
  titulo: string,                 // título canónico ya formateado (ver ParserTitulos.formatTitleStructured)
  urlInterna: string,             // URL de la página de la clase en el portal
  carpeta: string,                // subcarpeta de destino (materia, lowercase)
  sitioId: string,                // de qué portal salió (ADR-0010). Lo estampa el popup al escanear
  catedra?: "A"|"B"|"C"|"D"|"COMUN",
  estado: "pending" | "process" | "downloaded",
  seleccionado: boolean,          // checkbox en la UI
  visible: boolean                // resultado del filtro activo (computado, no persistente en la práctica)
}
```

### `ColaItem` (elemento de `colaDescargas`)

```ts
{
  id: string,
  numeroOriginal: number,
  titulo: string,
  urlInterna: string,
  carpeta: string,
  sitioId: string,                // hereda el de la clase (ADR-0010), NO el del sitio activo
  fechaEncolado: number,          // Date.now() al encolar. Desde ADR-0011 NO es la fuente del
                                  // orden: es el dato del criterio "de llegada" y el que
                                  // normaliza las colas anteriores al corte 6d.
  seleccionado?: boolean          // usado solo en modo selección múltiple de la pestaña Cola
}
```

### `EstadoClase`

```ts
"pending" | "process" | "downloaded"
```

### `HistorialFallo` (elemento de `historialFallos`)

```ts
{
  id: string,        // `${Date.now()}-${random}` — no hay clave natural
  tipo: "rechazo" | "sesion" | "servidor" | "internet",
  titulo: string,    // título de la clase en curso al fallar
  motivo: string,    // texto humano del fallo (plano, se muestra tal cual)
  ts: number,        // Date.now() del fallo
  leido: boolean     // false al insertar; el popup lo pone true al "marcar leídas"
}
```

`HistorialFallos.registrar()` (`core/historial/historialFallos.ts`) es el único escritor que
antepone y recorta la lista a 50 (los más viejos se descartan). Concurrencia aceptada: el
SW (que registra) y el popup (que marca leídas / limpia) hacen read-modify-write sobre la
misma clave desde contextos distintos; una colisión exacta podría perder una escritura —
mismo trade-off sin transacciones que el resto de las claves, y el dato es informativo.

## `chrome.storage.session` — volátil, sobrevive a la suspensión del Service Worker pero no a un reinicio del navegador

Encapsulado por `SessionState` (`core/cola/estadoSesion.ts`, tipado y con sus defaults; estuvo inline en `background.js` hasta la Fase 6b). Es la fuente de verdad del **progreso de la descarga activa** — nunca se lee/escribe desde el popup directamente, solo vía el mensaje IPC `obtener_estados_en_progreso`.

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `rafagaCorriendo` | `boolean` | `false` | Si la cola está procesando activamente. |
| `frenadoSuaveSolicitado` | `boolean` | `false` | Flag de "pausar después del ítem actual" (frenado suave, no aborta lo que está en curso). |
| `modoTurboBunActivo` | `boolean` | `true` | Siempre `true` en la práctica — ver `docs/tech-stack.md`. |
| `videoActualTitulo` | `string` | `""` | Título de la clase que se está descargando ahora mismo. |
| `bytesProcesadosEnVideoActual` | `number` | `0` | Bytes acumulados del video actual. |
| `fragmentosTerminadosEnVideoActual` | `number` | `0` | Fragmentos `.ts` completados del video actual. |
| `totalFragmentosEnVideoActual` | `number` | `0` | Total de fragmentos del manifiesto HLS actual. |
| `tiempoInicioVideoActual` | `number` | `0` | `performance.now()` al iniciar el video actual (para calcular velocidad). |
| `velocidadMbsActual` | `number` | `0` | Velocidad de descarga calculada, en MB/s. |
| `colaPausadaPorError` | `boolean` | `false` | Si la cola está pausada por un error de conexión (a Ramón Net o al backend Bun). |
| `tipoDeErrorConexion` | `"internet" \| "servidor" \| "sesion" \| ""` | `""` | Qué recurso falló, usado por `chrome.alarms.onAlarm` para saber qué sondear. `"sesion"` (no hay sesión iniciada en Ramón Net) es un caso especial: NO lo detecta el daemon `Conexion` (la red está OK) sino `HlsEngine` por el redirect al login, y NO entra al autoheal (no se crea la alarma) — el usuario reintenta a mano tras iniciar sesión. |
| `abortadoPorUsuario` | `boolean` | `false` | Distingue un abort explícito del usuario de un fallo real, para no reintentar tras un abort. |
| `videoActualSessionId` | `string` | `""` | Token único (`Date.now().toString()`) por descarga, usado para vincular fragmentos al backend Bun y evitar colisiones ante cancelaciones. |

## La identidad de una clase es (portal, título)

**Desde el 2026-08-06 (corte multiportal D).** Antes la identidad era **el título**: la cola se
filtraba por título, `listaPersistente` se buscaba por título y el espejo de progreso era un
mapa `titulo → estado`. Con un solo portal alcanzaba, porque dos clases distintas no compartían
nombre.

Con dos portales sí pueden, y el modo de fallar es silencioso y destructivo: **completar la
descarga de una clase sacaba de la cola a su homónima del otro portal**, que nunca se bajaba y
desaparecía sin ningún error.

La regla vive en **un solo lugar**, `core/cola/identidadClase.ts`, y entra por inyección al
bucle de descarga, a los handlers IPC del service worker y al popup — si cada uno la
implementara podrían divergir, que es la misma forma de bug que cerró el corte 4.

El portal sale del **descriptor**, no del campo crudo, porque los tres casos de `sitioId`
significan cosas distintas (la distinción del corte 3):

| `sitioId` | Significa | Cómo se compara |
|---|---|---|
| **ausente** | dato anterior al multi-sitio | resuelve al portal legado: un ítem sin `sitioId` y uno con `"ramonnet"` **son la misma clase** |
| **presente y registrado** | su portal | por el `id` del descriptor |
| **presente y desconocido** | huérfano | por el id **crudo**, así dos huérfanos del mismo portal muerto siguen siendo comparables entre sí |

**Ojo con los handlers del service worker**: leen `SW_ESTADOS_PROGRESO` de storage por su
cuenta, así que tienen que pasar por la lectura que migra las claves viejas. Es la misma trampa
que el corte 3 encontró en la cola — el SW no pasa por la normalización de `AppState`, que es
del popup.

**Y el disco acompaña**: desde el mismo día la ruta es `raíz/<sitioId>/<materia>/`, así que dos
clases homónimas de portales distintos tampoco comparten archivo. El contrato con el backend
está en `docs/deployment.md` §El layout en disco lleva el portal.

## Invariantes que hay que preservar

- **`AppState` (popup) y `SessionState` (SW) no comparten memoria** — solo se reconcilian vía el mensaje `obtener_estados_en_progreso`. Ningún código del popup debe asumir que `AppState.listadoClasesGlobal[i].estado` refleja el estado real sin haber pasado por esa reconciliación primero.
- **`colaDescargas` es la fuente de verdad del orden de descarga, y lo es como *secuencia*** (ADR-0011, corte 6d): el service worker baja `[0]` y ya no ordena por `fechaEncolado`. El popup es el **único escritor** de ese orden — si escribiera una secuencia inconsistente, el SW ya no tiene una red que lo corrija. Una cola guardada antes del corte 6d se normaliza una vez por `fechaEncolado` al cargarla (`core/estado/appState.ts`). `listaPersistente[i].estado` se deriva de si el título está presente en `colaDescargas`, no al revés.
- Las escrituras que tocan más de una de estas claves relacionadas dentro de una misma operación lógica (ej. mover un ítem de `pending` a `process`, que toca `listaPersistente` + `colaDescargas` + `SW_ESTADOS_PROGRESO`) deben hacerse en **una sola llamada** a `guardarLocal({...})`. Desde la Fase 5b eso dejó de ser una convención escrita en comentarios: es la firma del `PuertoAlmacenamiento` (`core/puertos/almacenamiento.ts`), que documenta el invariante en el contrato. Los 3 puntos que lo violaban se consolidaron en 2026-07-17 (ver "Escrituras no-atómicas" en `docs/TECHNICAL_DEBT.md`, ya resuelto).
