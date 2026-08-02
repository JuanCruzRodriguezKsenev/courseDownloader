# Modelo de datos

Esta extensión no tiene base de datos — el equivalente es el esquema de `chrome.storage`. Este documento es la fuente de verdad de qué claves existen, en qué storage viven, su forma, y quién las escribe/lee. Si agregás o cambiás una clave, actualizá esta tabla en el mismo cambio.

## `chrome.storage.local` — persistente entre reinicios del navegador

Escrito principalmente por `AppState.respaldar()` (`shared/state.js`) desde el popup, y por varios handlers IPC en `background.js`.

| Clave | Forma | Escrita por | Descripción |
|---|---|---|---|
| `listaPersistente` | `Clase[]` (ver abajo) | popup (`AppState.respaldar`), SW (varios handlers IPC) | Lista completa de clases scrapeadas de la última sesión, con su estado actual. |
| `colaDescargas` | `ColaItem[]` (ver abajo) | popup, SW | Cola FIFO desacoplada de descarga — separada de `listaPersistente` para poder sobrevivir a cambios de materia/pestaña sin perder el progreso. |
| `faseDiscoOk` | `boolean` | popup | Si ya se corrió una sincronización con el disco (vía `escanear_carpeta_local`) en esta sesión. |
| `catedraElegida` | `string \| null` | popup | Cátedra (A–D) seleccionada por el usuario cuando hay multi-cátedra detectada. |
| `ocultarAdvExplorar` | `boolean` | popup | Preferencia: no volver a mostrar el aviso al explorar carpeta. |
| `ocultarAdvAula` | `boolean` | popup | Preferencia: no volver a mostrar el aviso al cambiar de aula. |
| `ordenAscendente` | `boolean \| null` | popup | Orden de la lista: `true`=ascendente, `false`=descendente, `null`=FIFO natural (solo aplica en la pestaña Cola). |
| `tutorialCompletado` | `boolean` | popup | Si el onboarding ya se completó/saltó. |
| `SW_ESTADOS_PROGRESO` | `Record<string, EstadoClase>` | SW (`persistirEstadoFondo`) | Mapa `titulo → estado` de progreso, espejo liviano para que el popup pueda reconciliar sin pedir el detalle completo. |
| `historialFallos` | `HistorialFallo[]` (ver abajo) | SW (`registrarFallo` → `HistorialFallos.registrar`), popup (marcar leídas / limpiar) | Historial acotado (últimos 50, más-reciente-primero) de fallos terminales de descarga (rechazo 4xx / sesión / servidor / internet). Fuente de la campanita del popup; la escribe el SW aun con el popup cerrado. |

### `Clase` (elemento de `listaPersistente`)

```ts
{
  id: string,
  numeroOriginal: number,       // orden en que apareció en el scraping
  titulo: string,                 // título canónico ya formateado (ver Utils.formatTitleStructured)
  urlInterna: string,             // URL de la página de la clase en Ramón Net
  carpeta: string,                // subcarpeta de destino (materia, lowercase)
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
  fechaEncolado: number,          // Date.now() al momento de encolar — define el orden FIFO
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

`HistorialFallos.registrar()` (`shared/historialFallos.js`) es el único escritor que
antepone y recorta la lista a 50 (los más viejos se descartan). Concurrencia aceptada: el
SW (que registra) y el popup (que marca leídas / limpia) hacen read-modify-write sobre la
misma clave desde contextos distintos; una colisión exacta podría perder una escritura —
mismo trade-off sin transacciones que el resto de las claves, y el dato es informativo.

## `chrome.storage.session` — volátil, sobrevive a la suspensión del Service Worker pero no a un reinicio del navegador

Encapsulado por el helper `SessionState` definido inline en `background.js`. Es la fuente de verdad del **progreso de la descarga activa** — nunca se lee/escribe desde el popup directamente, solo vía el mensaje IPC `obtener_estados_en_progreso`.

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

## Invariantes que hay que preservar

- **`AppState` (popup) y `SessionState` (SW) no comparten memoria** — solo se reconcilian vía el mensaje `obtener_estados_en_progreso`. Ningún código del popup debe asumir que `AppState.listadoClasesGlobal[i].estado` refleja el estado real sin haber pasado por esa reconciliación primero.
- **`colaDescargas` es la fuente de verdad del orden de descarga**, ordenada por `fechaEncolado`. `listaPersistente[i].estado` se deriva de si el título está presente en `colaDescargas`, no al revés.
- Las escrituras que tocan más de una de estas claves relacionadas dentro de una misma operación lógica (ej. mover un ítem de `pending` a `process`, que toca `listaPersistente` + `colaDescargas` + `SW_ESTADOS_PROGRESO`) deben hacerse en un único `chrome.storage.local.set({...})` — ver el ítem "Escrituras no-atómicas" en `docs/TECHNICAL_DEBT.md` para los lugares donde esto todavía no se respeta.
