# Re-arquitectura a núcleo + adaptadores — diseño de ejecución

Diseño concreto de la re-arquitectura de puertos-y-adaptadores + migración a TypeScript.
La **decisión** y su justificación viven en `docs/adr/0008-arquitectura-nucleo-adaptadores.md`
(que supersede a ADR-0001); **este documento es el "cómo"**: estructura de carpetas
objetivo, interfaces de los puertos, elección de bundler y orden de migración. Es el
equivalente de `docs/preact-migration.md` pero para el corte núcleo/adaptadores.

> **Estado (2026-08-04)**: **fases 0 a 6c completas**. Las tres capas existen y están pobladas:
> `core/` (puertos, cola, motor HLS, conexión, estado, backend, historial, utilidades),
> `sitio/ramonnet/` y `plataforma/chrome/` + la raíz de composición. Quedan la **Fase 7**
> (entrypoints como composición) y la **Fase 8** (borrado del vanilla que no pasó por un
> puerto: hoy `popup.js`, `renderers.js` y lo que queda de `background.js`). Ver la tabla de
> avance al final y §Cómo retomar esto en una sesión nueva.
>
> *(El párrafo de estado anterior, del 2026-08-02, decía que seguía "todo en JS vanilla y sin
> bundler". Se conserva la observación como recordatorio de la velocidad a la que este doc
> envejece: es el mismo motivo por el que el §UI de la Fase 6c describía un código que ya no
> existía.)*

## Objetivo en una línea

Que re-clonar la extensión a **otro sitio** = escribir un adaptador de Capa 2, y a **otro
navegador** = un adaptador de Capa 3, **sin tocar el núcleo**. Hoy los tres tipos de código
(genérico / de sitio / de navegador) están entrelazados en los mismos archivos.

## Estructura de carpetas objetivo

```
./                         # la RAÍZ del repo, no src/ — ver la corrección abajo
  core/                    # Capa 1 — genérico, cero chrome.*, cero Ramón Net
    hls/                   #   motor: pool de workers, parseo M3U8, AES-CBC
    cola/                  #   FIFO + máquina de estados de descarga
    conexion/              #   lógica del daemon (sondeo, clasificación de fallas)
    backend/               #   BunClient (contrato /api/*)
    puertos/               #   TODAS las interfaces (ver abajo)
  sitio/
    ramonnet/              # Capa 2 — implementa PuertoSitio     ✅ YA EXISTE (en .js)
      scraper.ts           #   selectores DOM
      parserTitulos.ts     #   formatTitleStructured / clasificarCatedraYCarpeta / parseSmartDate
      resolverManifiesto.ts#   iframe Bunny + CDN + fallbacks regex
      config.ts            #   urlSondeoInternet, CDN, faceta (cátedras A-D) + las puertas
      rules.json           #   reglas declarativeNetRequest
  plataforma/
    chrome/                # Capa 3 — implementa los puertos de navegador (99 usos chrome.*)
  ui/                      # islas Preact + features (consumen core vía puertos)
  entrypoints/             # popup, service worker, offscreen (composición: inyectan adaptadores)
```

El catálogo exacto de qué archivo/función de hoy migra a cada capa está en **ADR-0008**
(no se repite acá — regla DRY, ADR-0007).

> **Corrección del plan (Fase 3, 2026-08-02): no hay `src/`.** Este diseño colgaba todo de una
> carpeta `src/` nueva, con la idea de que el código vanilla de la raíz coexistiera al lado
> mientras se construía. Al ejecutar la Fase 3 se eligió lo contrario: `wxt.config.ts` fija
> `srcDir: '.'` y **los fuentes se quedaron en la raíz** — `core/`, `sitio/`, `plataforma/`,
> `shared/`, `styles/` cuelgan de ahí, y sólo los *entrypoints* siguen la convención de WXT
> (`entrypoints/`). Motivo: mover ~30 archivos a `src/` en el mismo corte que cambiaba el
> mecanismo de carga habría mezclado dos riesgos en una sola rama, y la coexistencia terminó
> resolviéndose por archivo (migrar el módulo en su lugar) en vez de por carpeta. Las capas del
> dibujo valen tal cual; lo que no existe es el prefijo. Donde el resto de este doc diga
> `src/`, leer "la raíz".

## Puertos propuestos (interfaces TypeScript)

Los puertos son el corazón del diseño y el mayor payoff de fusionar TypeScript: que un
adaptador cumpla su interfaz lo **verifica el compilador**, no una revisión manual. Cada
invariante operativo de hoy pasa a ser parte de una firma.

```ts
// core/puertos/sitio.ts — lo que un sitio DEBE proveer para ser descargable
export type Catedra = "A" | "B" | "C" | "D" | "COMUN";      // ver caveat abajo
export interface PuertoSitio {
  escanearListado(doc: Document): ClaseScrapeada[];
  parsearTitulo(crudo: string): TituloEstructurado;         // nombre canónico + fecha
  clasificarCarpeta(t: TituloEstructurado): { catedra: Catedra; carpeta: string };
  resolverManifiesto(htmlPagina: string): Promise<string>;  // URL .m3u8
  urlSondeoInternet: string;
  reglasRed?: RuleSet;                                      // dNR opcional
}

// core/puertos/almacenamiento.ts — hoy chrome.storage.local/.session/.onChanged
// local y sesión son métodos SEPARADOS a propósito: no son dos backends
// intercambiables sino los dos lados del split de ownership (AppState en local,
// SessionState en session — ver docs/data-model.md). Un `get(claves, ambito)`
// con un flag invitaría a leer el ámbito equivocado; separarlos lo hace explícito
// en el call-site y deja que el compilador distinga los tipos de cada store.
export interface PuertoAlmacenamiento {
  obtenerLocal<T>(claves: string[]): Promise<Partial<T>>;
  guardarLocal(valores: Record<string, unknown>): Promise<void>;   // atómico multi-clave (invariante del SW)
  obtenerSesion<T>(claves: string[]): Promise<Partial<T>>;
  guardarSesion(valores: Record<string, unknown>): Promise<void>;
  onCambio(cb: (cambios: CambiosStorage) => void): () => void;
}

// core/puertos/mensajeria.ts — hoy chrome.runtime.sendMessage/onMessage
// La unión discriminada REEMPLAZA los strings sueltos de `action`: el compilador
// verifica cada handler y cada emisor (hoy un typo en "clase_con_error" compila igual,
// y de hecho existe un handler que nadie emite — ver TECHNICAL_DEBT bug 400).
export type MensajeIPC =
  | { action: "iniciar_descarga_cola" }
  | { action: "inyectar_items_en_cola_activa"; items: ClaseCola[] }
  | { action: "obtener_estados_en_progreso" }
  | { action: "clase_guardada_ok"; titulo: string; suaveFrenado: boolean }
  | { action: "clase_con_error"; titulo: string; motivo: string }
  | { action: "cola_pausada_por_error"; tipo: TipoFalla };
  /* ...catálogo completo al ejecutar */
export interface PuertoMensajeria {
  enviar<R>(m: MensajeIPC): Promise<R>;
  onMensaje(cb: (m: MensajeIPC, responder: (r: unknown) => void) => boolean): void;
}

// core/puertos/programador.ts — hoy chrome.alarms (autoheal)
export interface PuertoProgramador {
  programar(nombre: string, opciones: { periodoMin: number }): Promise<void>;
  cancelar(nombre: string): Promise<void>;
  onDisparo(cb: (nombre: string) => void): void;
}

// + PuertoTabs (query/onUpdated), PuertoInyeccion (executeScript),
//   PuertoDescargas (download/search — solo path legacy no-Turbo)
```

**Por qué así:** el `guardarLocal()` atómico multi-clave (hoy convención en comentarios — ver
`docs/patterns.md` §State ownership y las escrituras consolidadas de `background.js`) pasa a
ser la **firma** del puerto; un adaptador de sitio nuevo no compila si le falta
`resolverManifiesto`; y el catálogo IPC tipado cierra la clase de bugs "handler que nadie
emite".

> **Caveat al tipar `Catedra`:** hoy `ParserTitulos.clasificarCatedraYCarpeta` devuelve
> `matchExplicit[1].toUpperCase()` — la letra **que capturó la regex**, sin validar que caiga
> en A-D; sólo el `"COMUN"` del fallback es un literal garantizado (`shared/utils.js`). Tipar
> el retorno como unión no es gratis: obliga a **validar el rango en el adaptador de sitio** y
> a decidir qué hacer con una letra fuera de A-D (¿`"COMUN"`? ¿error?). Es una mejora real
> —hoy una cátedra "E" se filtraría silenciosa hasta el nombre de carpeta— pero es un cambio
> de comportamiento, no un refactor puro: hay que cubrirlo con un test antes de migrar.

## UI: componentes genéricos vs. de sitio, y CSS por componente

El corte núcleo/sitio no aplica sólo a la lógica: la UI se parte con el **mismo criterio**,
porque hoy las islas Preact mezclan ambas cosas. Dos categorías:

- **Genéricos** (`ui/comunes/`): no conocen el listado de Ramón Net ni el concepto de
  cátedra; se alimentan sólo de stores del núcleo (`Conexion`, cola). Candidatos directos:
  `conexionHeader` (StatusDot), `bannerConexion`, `rutaDisco`, `onboarding`.
- **De sitio** (`sitio/ramonnet/ui/`): reciben datos ya formateados por el adaptador de Capa 2
  y muestran conceptos propios del portal. Candidato principal: `<FilaClase>` (badge de
  cátedra A-D).

> **Ya ejecutado (2026-08-02)**: el modal multicátedra + el badge resultaron ser el caso más
> fácil de los dos, porque el mecanismo (preguntar una vez por el eje de clasificación,
> autoseleccionar, filtrar) es genérico y sólo el vocabulario era del sitio. En vez de partir
> el componente en dos se parametrizó: `popup/features/faceta.js` es genérico y
> `sitio/ramonnet/config.js` aporta el descriptor. **Es el patrón a preferir cuando lo
> específico del sitio son datos y no estructura** — parametrizar sale más barato que duplicar
> el componente, y se verifica con un test que corre la misma feature con otro descriptor.

**Forma del descriptor de faceta** (vive en `sitio/ramonnet/config.ts`, dentro de
`PuertoSitio`; es lo que consumen `popup/features/faceta.js` y `filters.js` vía `ctx.sitio`,
que por eso no nombran ni una vez a la cátedra):

| Campo | Qué es |
|---|---|
| etiquetas | Los valores del eje (acá, cátedras A–D) tal como se muestran. |
| `COMUN` / `TODAS` | Los dos centinelas: "no aplica a ninguna en particular" y "todas". |
| `claveEstado` | La clave de `AppState` donde se guarda la elección (acá, `catedraSeleccionada`). |
| `leer(item)` | Cómo sacar el valor de un ítem **escrapeado**. |
| `leerDeCola(item)` | Cómo sacarlo de un ítem **de la cola**, que no lo trae: lo re-deriva con el parser de títulos. |
| copy del modal | Los textos del asistente de autoselección. |

Quien agregue un portal implementa estos campos y no toca la feature. `faceta.test.js` lo
verifica corriéndola con un descriptor falso, que es la prueba de que sigue genérica.

El corte se ve mejor en `listaClases.preact.js`, que hoy contiene las dos mitades: la
estructura de lista/selección/tabs es genérica, y `<FilaClase>` + el badge de cátedra son de
sitio. Migrar esa isla = partirla en dos, no moverla de carpeta.

> **Corregido al ejecutar (2026-08-04): esto ya no era cierto.** `<FilaClase>` no tiene
> vocabulario de sitio — los badges que este párrafo leyó como "badge de cátedra" son de
> *estado de descarga*, y la cátedra salió de la lista en la Fase 1. No hubo nada que partir.
> Ver §Fase 6c más abajo.

**CSS**: el objetivo es co-locar cada hoja con su componente (`FilaClase.preact.tsx` +
`FilaClase.css`, importado por el componente y agrupado por el bundler) en vez del `styles/`
paralelo de hoy. Ojo: hoy el CSS **ya está partido por componente** (`styles/components/*.css`,
un archivo por región) y los tokens **ya viven en un solo lugar** (`styles/variables.css`, con
su bloque `prefers-color-scheme: dark`) — lo que falta no es "extraer el CSS de un monolito"
sino (a) mover cada `styles/components/X.css` junto a su componente y (b) hacer que el
scoping deje de depender de que las clases no colisionen. Para eso, convención propuesta:
**BEM con namespace de componente** (`.c-fila-clase`, `.c-fila-clase__titulo`,
`.c-fila-clase--process`), sin que ninguna hoja local toque selectores de elemento
(`div`, `span`, `input`) ni clases que no cuelguen de su raíz.

`styles/variables.css` se muda **tal cual** a `ui/estilos/variables.css`: es el design system
vigente y re-derivar la paleta sería una regresión visual gratuita. La ganancia de tenerlo
como capa aparte es la misma que en el resto del diseño — re-brandear la extensión para otro
portal = tocar ese archivo, no los CSS de los componentes.

## Tests bajo la nueva arquitectura

El payoff de testing es concreto y conviene planificarlo, porque cambia *qué* hay que mockear:

- **Adaptadores en memoria** en vez de mocks de `chrome.*`: un `AlmacenamientoEnMemoria` y un
  `MensajeriaEnMemoria` que cumplan los puertos permiten testear la cola y el circuit breaker
  como lógica pura. Hoy eso no se testea (`procesarSiguienteElementoDeLaCola` + auto-heal
  están fuera de cobertura por diseño — ver `docs/testing.md`); con puertos deja de necesitar
  un navegador y pasa a ser el hueco de cobertura más barato de cerrar.
- **Tests de caracterización que se heredan**: los tests de parsing de títulos/cátedra ya
  existentes (`shared/utils.test.js`) se mueven junto al código a `sitio/ramonnet/` y son la
  red contra regresiones del componente más frágil del proyecto. Mismo criterio para los del
  pool de `hlsEngine` y los de `bunClient`.
- **Componentes**: los tests de islas de hoy montan con `render()` de Preact + jsdom y esperan
  varios ciclos de rAF para flushear efectos (receta en `docs/preact-migration.md`). Al haber
  build, `@testing-library/preact` pasa a ser viable y evita ese `await` manual — pero es una
  dependencia nueva, así que se evalúa al migrar la primera isla, no antes.

## Bundler: recomendación WXT (sobre Vite + CRXJS)

| | WXT | Vite + CRXJS |
|---|---|---|
| Manifest MV3 | Generado desde `entrypoints/` | A mano |
| Multi-navegador | `wxt build -b firefox` de fábrica | Manual |
| HMR popup + SW | Sí | Parcial |
| Mantenimiento | Activo, dedicado a extensiones | Históricamente irregular |

El objetivo de la Capa 3 (apuntar a otro navegador) coincide con el target multi-browser
nativo de WXT, así que es el **default propuesto**. Decisión final al arrancar la ejecución.
Esto acepta el paso de build que ADR-0001 evitaba — a cambio de reutilización + tipos
(justificación completa en ADR-0008).

**Cómo se vería, si se confirma WXT** (para dimensionar el costo del setup, no como
configuración final):

- `wxt.config.ts` en la raíz con `srcDir` y el bloque `manifest` (al ejecutarse quedó
  `srcDir: '.'`, no `'src'` — ver la corrección de §Estructura de carpetas objetivo; permisos y
  `host_permissions` se **generan** desde ahí; `manifest.json` a mano desaparece). El manifest
  actual es la fuente a portar — incluidos `declarativeNetRequest` + `rule_resources`, que son
  los que más fácil se pierden al regenerar, y `offscreen`/`downloads` si el path legacy
  no-Turbo sigue vivo.
- Scripts: `dev` (`wxt`, con HMR de popup y SW), `build` (`wxt build`), `zip` (`wxt zip`), y
  las variantes `-b firefox`. `test`/`lint` no cambian de comando, sí de alcance. Ojo con
  `tsc`, que sí cambia: su alcance lo fija el `include` de `tsconfig.json` a mano, no el
  `srcDir` — ver `docs/testing.md` §Baseline.
- Salidas: `.wxt/` (types generados, va a `.gitignore`) y `.output/chrome-mv3/` — que pasa a
  ser **la carpeta que se carga en `chrome://extensions/`**, en vez de la raíz del repo. Es el
  cambio de flujo diario más visible para quien desarrolla, y hay que reflejarlo en
  `docs/contributing.md` y en el `README.md` el día que se ejecute.
- Verificación del paso de setup: `npx wxt prepare` genera `.wxt/` sin errores, y un `build`
  produce un SW cargable — antes de mover una sola línea de lógica.

## Orden de migración (incremental — nunca big-bang)

**Fase 1 — Capa 2 completa, sin bundler. ✅ HECHA (2026-08-02).** Todo lo de Ramón Net vive
en `sitio/ramonnet/` (`config.js` con el descriptor de faceta + constantes + las puertas,
`parserTitulos.js`, `resolverManifiesto.js`, `scraper.js`, `rules.json`). `Utils`, `HlsEngine`
y el daemon `Conexion` quedaron genéricos. Se hizo **en JS vanilla a propósito**: prueba el
corte núcleo/sitio sin pagar todavía el paso de build, y no se re-toca al migrar a TS.

**Fase 2 — Decisión de selección de sitio. ✅ RESUELTA (2026-08-02, ADR-0009).** Se eligió
**registro en runtime**: una sola extensión que resuelve el adaptador a partir de la URL. La
recomendación previa de este doc ("una build por portal") se apoyaba sobre todo en la review
de la Chrome Web Store, criterio que **no aplica** — la extensión es personal y no se publica
(ver `docs/deployment.md`). Ya no bloquea nada.

**Fase 3 — WXT + TypeScript, andamiaje vacío.** Instalar, configurar, y compilar **el código
actual tal cual** a `.output/chrome-mv3/`, sin mover lógica. Termina cuando esa carpeta se
carga en Chrome y hace el golden path. Es el punto de no retorno del flujo de desarrollo
(cambia qué carpeta se carga), así que va en su propia rama y no se mergea sin verificar.

**Fase 4 — `core/`: BunClient. ✅ HECHA (2026-08-02).** Movido a `core/backend/bunClient.ts`,
en TypeScript, con sus 11 tests. Es el corte más barato para estrenar el pipeline de TS: cero
`chrome.*`, cero Ramón Net, fetch puro.

> **Corrección del plan**: esta fase decía "BunClient **+ daemon de conexión**" asumiendo que
> ambos eran puros. El daemon **no lo es**: `shared/conexion.js` espeja su estado en
> `chrome.storage.session` y escucha `chrome.storage.onChanged` (3 call-sites). Meterlo en
> `core/` hoy violaría el invariante de la capa, y partirlo en store puro + daemon acoplado
> sin tener el puerto de almacenamiento significa tocarlo dos veces. **Se mueve en la Fase 5**,
> junto con el puerto.
>
> **Epílogo (5b, 2026-08-02)**: el desacople del daemon ya se hizo — `shared/conexion.ts` no
> tiene `chrome.*`. Pero la mudanza a `core/` **sigue pendiente**, y por un motivo distinto al
> previsto: no es el storage sino la URL de sondeo, que lee del global `SitioActivo` (Capa 2).
> Inyectarla desde la composición choca con `allowJs: false` — `composicion.ts` no puede
> importar `config.js`. Se destraba cuando el adaptador de sitio pase a TypeScript.
>
> **Epílogo 2 (5c, 2026-08-03)**: el adaptador ya pasó a TypeScript (`config.ts`), así que el
> tapón no existe más. La mudanza a `core/conexion/` es el corte siguiente y ya no depende de
> nada.
>
> **Epílogo 3 (2026-08-03)**: hecha. El daemon vive en `core/conexion/conexion.ts` y recibe la
> URL de sondeo por parámetro. Con eso, lo que esta Fase 4 pedía originalmente —"BunClient **+
> daemon de conexión** en `core/`"— queda cumplido, con dos correcciones de plan de por medio
> (el storage primero, la URL de sitio después). Registro del corte más abajo.

**Fase 5 — Puertos de plataforma + adaptador Chrome (el corte grande).** `PuertoAlmacenamiento`
y `PuertoMensajeria` con su adaptador, convirtiendo las globales `window.X`/`self.X` a módulos
ES **y** a TS en la misma pasada por archivo (por eso TS va fusionado y no aparte). Es donde
está el payoff de cobertura: con adaptadores en memoria, la cola y el auto-heal —hoy sin tests
por diseño— pasan a ser testeables sin navegador.

**Fase 6 — Motor HLS → `core/hls/`** consumiendo puertos (llega con el pool ya testeado).

**Fase 7 — `background.js` y `popup.js`** quedan como composición en `entrypoints/` (inyectan
los adaptadores concretos en el núcleo).

**Fase 8 — Sustitución y borrado del código vanilla de la raíz** — recién cuando los módulos
nuevos (`core/`, `plataforma/`, `sitio/`) tengan **paridad de tests** con lo que reemplazan. Es
un paso propio, no el efecto colateral de la Fase 7. Sin `src/`, "el vanilla de la raíz" ya no
se distingue por la carpeta: son los archivos que todavía no pasaron por un puerto — hoy
`popup.js`, `renderers.js`, `shared/utils.js` y lo que quede de `background.js`.

### Cómo se elige el sitio activo — resuelto

`SitioActivo` deja de ser una constante y pasa a resolverse por URL contra un registro de
adaptadores (`SITIOS.find(s => s.esPaginaDelSitio(url))`). El popup resuelve con la URL de la
pestaña activa; el service worker resuelve **por ítem de la cola** (`urlInterna`), no una vez
global — la cola es persistente y puede mezclar portales, y resolver una sola vez descargaría
un ítem con el parser y el CDN equivocados.

Sigue siendo estático y hay que editarlo a mano al sumar un portal: los `host_permissions` del
manifest y su ruleset `declarativeNetRequest`. El detalle completo, las alternativas y el
riesgo asumido están en **ADR-0009** (no se repiten acá — regla DRY, ADR-0007).

**Reglas de ejecución** (aplican a cualquier orden):

- **Coexistencia**: mientras el núcleo nuevo se construye, el código vanilla que sigue sin
  migrar es lo que el navegador carga. La extensión se usa a diario; ninguna fase puede dejarla
  sin descargar clases. El corte se paga una sola vez, en la **Fase 8** (el "paso 6" que decía
  esta regla era la numeración de un borrador anterior del plan). Sin `src/`, la coexistencia
  no es entre dos carpetas sino entre dos generaciones de archivos en la misma.
- **Verificación por fase**: cada fase termina con `npm test` en verde + `npm run lint` sin
  errores nuevos, y las que tocan el flujo de descarga, con el golden path manual
  (`docs/contributing.md`). Una fase que no se puede verificar está mal cortada.
- **Rollback**: una rama por fase (`feat/rearq-<fase>`), sin mergear a `main` hasta verificar.
  Mientras el SW vanilla de la raíz siga siendo el activo, abortar = descartar la rama.

## Cómo retomar esto en una sesión nueva

Orden de lectura para llegar al frente de trabajo sin reconstruir contexto:

1. **Esta tabla de avance** (abajo) — qué fase está hecha y cuál sigue.
2. **`docs/adr/0008`** (las capas y por qué) y **`docs/adr/0009`** (cómo se elige el sitio).
3. `docs/architecture.md` §Las capas — la foto de qué carpeta es qué y qué falta migrar.

**Antes de escribir código**, correr las cuatro verificaciones que tienen que estar en
verde y que son la red de todo lo demás:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build     # genera .output/chrome-mv3/
```

Los números esperados de cada una (cantidad de tests, warnings tolerados) están en
`docs/testing.md` §Baseline de las verificaciones, que es su hogar canónico — acá no se
repiten para que no puedan quedar desfasados.

**Verificación en navegador: al día.** Cada corte de esta sesión se verificó antes de mergear, y esa disciplina encontró los dos únicos defectos que la suite no podía ver (un warning que describía mal una condición del navegador y la barra de progreso del backend que un refactor se comió). Registro histórico de cómo se llegó a la regla: Durante un tiempo las Fases 1 a 5a
estuvieron en `main` sin que nadie hubiera abierto la extensión compilada en Chrome (decisión
explícita del dueño del repo, con la recomendación contraria sobre la mesa). El checklist de
§Verificación pendiente ya se corrió sobre `.output/chrome-mv3/` y pasó, así que **5b arranca
sobre una base verificada** — la condición que faltaba. Si aun así aparece algo roto en el
navegador, el sospechoso número uno sigue siendo el empaquetado (Fase 3): es donde se cambió
el mecanismo de carga.

### Registro de la Fase 5b (cerrada el 2026-08-03)

Consumidores del puerto de almacenamiento, en el orden en que se migraron:

| Archivo | Usos de `chrome.*` | Nota |
|---|---|---|
| ~~`shared/state.js`~~ → `shared/state.ts` | 9 → 1 | ✅ Hecho (2026-08-02). Pasó a TS + factory `crearAppState(puerto)`, instanciada en `composicion.ts`. El uso que queda es el `sendMessage` de `sincronizarConBackground()`: IPC, no storage. **Corrección al plan**: acá decía "con tests indirectos" y era falso — los tests del popup mockean `globalThis.AppState` entero, así que no tenía **ninguna** cobertura real. Se le escribieron 13 tests propios contra `AlmacenamientoEnMemoria` como parte del corte. |
| `popup/features/queue.js` | 9, **todos IPC** | ⚠️ **No era 5b.** Sus 9 usos son `chrome.runtime`, no `chrome.storage`: el puerto de almacenamiento no le aplica. Migrado en la **Fase 5c** (2026-08-03) sobre `PuertoMensajeria`. Lo mismo vale para `popup.js` (9 IPC + scripting/tabs, 0 storage). Esta tabla contaba `chrome.*` en total, y eso los hacía parecer consumidores del puerto de storage. **El único que queda para 5b es `background.js`** (22 de sus usos son storage). |
| ~~`shared/conexion.js`~~ → `shared/conexion.ts` | 7 → 0 | ✅ Hecho (2026-08-02). TS + factory `crearConexion(puerto)`; el espejado cross-contexto va por el ámbito de sesión del puerto. `BunClient` pasó de global sniffeada a import (los dos son módulos del núcleo). Sus tests dejaron de mockear `chrome.*`: ahora levantan **dos daemons sobre el mismo `AlmacenamientoEnMemoria`**, que es el espejado popup↔SW ejercitado de verdad y no simulado (14 → 16 tests). **No se mudó a `core/`** aunque ya no le quede `chrome.*`: todavía lee el global `SitioActivo` para la URL de sondeo, y `composicion.ts` no puede inyectársela porque `config.js` es `.js` (`allowJs: false`). Se muda cuando ese archivo pase a TS. **→ Se mudó el 2026-08-03** a `core/conexion/conexion.ts`, ya con `config.ts` en TypeScript; ver el registro de ese corte. |
| ~~`background.js`~~ | 22 de storage → 0 | ✅ Hecho (2026-08-03), en dos commits separados a propósito. **Primero los tests**: 12 de caracterización del bucle de descarga y el auto-heal (lo que este doc pedía), que fijaron el comportamiento actual. **Después la migración**, con esos tests como criterio de no-regresión: pasaron sin tocar una sola aserción. Quedó en JS —lo carga el entrypoint, no lo importa `composicion.ts`, así que recibe el puerto como global y no lo alcanza la regla de `allowJs`. Detalle de forma: `SessionState.get` normaliza la clave a lista porque el puerto pide siempre `string[]`. |

El patrón a repetir es el de la Fase 5a, que existe justamente como plantilla: el módulo
pasa a ser una factory que recibe el puerto, la instancia se arma en
`plataforma/composicion.ts`, y el test cambia sus mocks de `chrome.*` por
`AlmacenamientoEnMemoria`.

### Registro del corte `config.js` → TypeScript (2026-08-03)

El adaptador de sitio era **el tapón**: con `allowJs: false`, `composicion.ts` (que es `.ts`)
no podía importar un `.js`, y sin poder importarlo no se le puede inyectar nada. Lo que salió
del corte, además de la conversión:

- **Nació `PuertoSitio`** (`core/puertos/sitio.ts`). Hasta ahora el contrato del adaptador de
  un portal era una convención en prosa, y lo que verificaba que estuviera completo era
  leerlo. Ahora `config.ts` se declara como implementación y **lo verifica el compilador** —
  el payoff de fusionar TypeScript que este doc pedía, aplicado a la Capa 2.
- **Criterio de qué entra al puerto**: sólo lo que consume alguien de afuera de `sitio/`. Por
  eso `host`, `marcaRutaClase` y el bloque `cdn` **no** están en `PuertoSitio` sino en un
  `SitioRamonNetDescriptor` que lo extiende: los lee únicamente `resolverManifiesto.js`, que
  es un archivo hermano. Un dato del portal que no cruza la frontera no es parte del contrato.
- **Los módulos hermanos siguen en `.js` y siguen entrando como globals**, ahora vía
  `declare const`. No se importan a propósito: las puertas (`resolverManifiesto`,
  `escanearListado`, `parsearTitulo`, `clasificarCarpeta`) tienen que seguir siendo perezosas
  para no atarse al orden de carga del entrypoint. La regla de `allowJs` no obligó a
  convertirlos porque `config.ts` no los importa — los declara.
- **Trampa que cobró**: `sitio/` no estaba en el `include` de `tsconfig.json`, así que el
  archivo recién convertido habría quedado sin typechequear en silencio (el mismo agujero que
  se cerró ese día para `shared/` y `plataforma/`). Se agregó en el mismo corte: 18 → 20
  archivos. **Al convertir un archivo a `.ts`, mirar primero si su carpeta está en `include`.**

Sin cambios de comportamiento: mismos valores, mismas puertas, mismos dos globals. Los 4
chequeos quedaron igual que antes (225 tests, 0 errores de lint, `tsc` limpio, build OK); no
hicieron falta tests nuevos porque el descriptor es dato y ya lo ejercitan `faceta.test.js`,
`filters.test.js`, `onboarding.preact.test.js` y `resolverManifiesto.test.js`, que lo importan
de verdad.

### Registro del corte `conexion` → `core/conexion/` (2026-08-03)

El daemon era el único módulo del proyecto **sin `chrome.*` y aun así fuera de `core/`**. Lo
que lo retenía no era plataforma sino sitio: leía el global `SitioActivo` para saber a qué host
mandarle el HEAD de "hay internet". Qué salió del corte:

- **La dependencia se invirtió, no se movió.** `crearConexion(puerto, { urlSondeoInternet })`:
  la URL entra por parámetro desde `composicion.ts`, que la toma de
  `PuertoSitio.urlSondeoInternet`. **Es el primer import de `sitio/` desde la composición**, y
  sólo fue posible porque `config.ts` ya es TypeScript (el corte anterior).
- **Se borró el fallback `URL_SONDEO_FALLBACK`**, que era el host del portal hardcodeado. En
  `shared/` era tolerable; en Capa 1 viola el invariante de la capa. La opción cómoda era
  mudarlo tal cual con el fallback puesto: eso habría dejado el nombre del portal adentro de
  `core/` y el corte habría sido cosmético. El parámetro quedó **obligatorio** y los tests pasan
  una URL de fantasía (`https://portal.de-prueba.test`), que además es lo que verifica el test
  nuevo: que el HEAD le pegue a la URL inyectada y no a una propia (16 → 17 tests).
- **`URL_SONDEO_INTERNET` dejó de ser un getter perezoso** y pasa a fijarse al construir. Es
  seguro porque los dos entrypoints importan `config.ts` antes que `composicion.ts` — y esa es
  exactamente la clase de suposición que el bundler no verifica, así que se confirmó leyendo el
  orden en el chunk compilado.
- **Sin cambios de comportamiento**: el valor efectivo en runtime es el mismo que ya venía de
  `SitioActivo.urlSondeoInternet`.

Qué NO cambió y conviene no confundir: `shared/` sigue existiendo con `state.ts` y `utils.js`.
`state.ts` no puede seguir a `conexion.ts` todavía — le falta lo de la clave de faceta, que es
la fila de abajo.

### Registro del corte `PuertoProgramador` (2026-08-03)

El puerto más chico de los tres del SW, y el único que se pudo hacer sin tocar el bucle de
descarga. Lo que dejó, además del código:

- **La interfaz esbozada en §Puertos no sobrevivió tal cual, y está bien**: se cayó el
  `Promise<void>` de `programar`/`cancelar` (nadie espera nada: `chrome.alarms.create` no es
  una operación que se aguarde) y `onDisparo` pasó a devolver la función de desuscripción,
  como los otros dos puertos. El período quedó en **minutos decimales** en vez de milisegundos
  a propósito: es la unidad de `chrome.alarms`, y cambiarla obligaba a convertir en el
  adaptador y a releer los call-sites para ver cuál quedó en la unidad vieja.
- **El doble en memoria no usa relojes**: los disparos los provoca el test
  (`dispararAhora` / `dispararYEsperar`). Un test que espera 12 segundos reales no es un test,
  y uno con timers falsos termina verificando el reloj de Vitest.
- **`dispararYEsperar` nació de un problema concreto**: el handler del auto-heal es `async`
  (consulta storage y el daemon), y el puerto —como `chrome.alarms`— ignora lo que devuelva.
  Sin una forma de esperarlo, el test tenía que dormir un rato arbitrario: flakiness
  disfrazada de test. El doble sí puede juntar las promesas, así que las junta.
- **El doble es más estricto que el mock que reemplazó, y eso destapó una siembra floja**: sólo
  notifica si la alarma está **programada**, igual que el navegador. Los 4 tests de auto-heal
  simulaban el disparo sin que ninguna alarma existiera; ahora programan primero, que es lo que
  de verdad pasa cuando la cola se pausa.
- **Guarda de regresión**: `chrome.alarms` se sumó a `chrome.storage` como getter que tira en
  el harness. Si alguien vuelve a usar la API directa, el test explota en vez de pasar.

Sin cambios de comportamiento: los tests del auto-heal pasaron sin tocar una sola aserción de
lógica — sólo cambió la forma de disparar y de afirmar sobre la alarma.

### Registro del corte IPC del SW — cierra la 5c (2026-08-03)

- **Las dos puntas, no una.** El receptor (`onMensaje`) conservó el contrato del `true`/`false`
  tal cual: es lo que mantiene abierto el canal, y rediseñar el despacho en el mismo corte que
  el cambio de mecanismo habría mezclado dos riesgos. Los 9 emisores se partieron según lo que
  de verdad hacen: **7 `notificar()`** (los avisos al popup, que antes se expresaban como un
  `.catch(() => {})` colgado de cada envío) y **2 `enviar()`** (el camino legacy offscreen, que
  sí espera respuesta y la usa).
- **Un efecto secundario que casi entra sin que nadie lo mire**: `notificar()` logueaba un
  warning por cada envío sin receptor, y en esta extensión "sin receptor" es el estado normal
  —el popup está cerrado casi siempre y `update_progress_bar` sale por fragmento—. Tal cual
  estaba, una descarga habría dejado cientos de warnings en la consola del SW. El adaptador
  ahora avisa **una vez por acción**: alcanza para descubrir un mensaje que nadie escucha
  nunca, sin volverse ruido de fondo.
- **Una trampa de herramienta que vale documentar**: los 9 emisores se migraron con un regex
  sobre el archivo, y un `.*?` con `DOTALL` matcheó desde el primer `sendMessage` hasta el
  `.catch` de otro 280 líneas más abajo. El texto intermedio quedó intacto —por eso los tests
  seguían pasando— pero renombró la punta equivocada y dejó un `sendMessage` sin su `.catch`.
  Lo agarró revisar el diff, no la suite. **Un reemplazo masivo sobre código se lee entero
  antes de commitear**, aunque los cuatro chequeos estén en verde.
- **El harness dejó de mockear `chrome.runtime.onMessage`/`sendMessage`**: ahora son getters que
  tiran, como storage y alarms. Y `MensajeriaEnMemoria` estrenó `notificados`, separado de
  `enviados`: un test que afirma "el SW avisó X" no tiene por qué ver los mensajes que mandó el
  propio test para invocarlo. El array único del mock viejo no distinguía.
- **Ojo con el timeout del doble**: los handlers del SW responden tras varios `await`, así que
  el harness construye `new MensajeriaEnMemoria(5000)`. Con el 0ms por defecto el puerto
  rechazaría antes de la respuesta y los tests fallarían por el reloj, no por la lógica.

### Registro del corte de la clave de faceta + `AppState` → `core/` (2026-08-03)

El patrón que ya había mostrado el daemon de conexión, repetido: **primero se le saca el dato
de sitio, después el archivo se muda**. Acá el dato no era una URL sino un nombre —
`catedraSeleccionada` / `catedraElegida`—, y alcanzaba para que `AppState` no pudiera ser
Capa 1. El resto del popup ya era genérico: `faceta.js` y `filters.js` leen por
`faceta.claveEstado`, del descriptor del sitio, así que el renombre no los tocó.

- **La migración de datos es lo único delicado del corte.** La extensión está instalada y en
  uso: la clave vieja ya existe con un valor real. Se lee, se adopta si la nueva no está, y se
  borra apenas se adoptó. Perder ese valor no rompe nada técnicamente —el campo vuelve a
  `null`— pero al usuario le reaparece el modal multicátedra de la nada; es el tipo de
  regresión que ninguna suite marca en rojo, así que se cubrió con 3 tests explícitos.
- **`shared/` quedó con un solo archivo** (`utils.js`). Lo que era "la carpeta de lo que
  todavía no se repartió" está casi vacía.
- **La Fase 4 original queda cumplida del todo**: pedía `core/` con BunClient *y* el daemon; hoy
  `core/` tiene además el historial, los puertos con sus tres dobles, y el estado del popup.

### Registro de la Fase 6 — el motor a `core/hls/` (2026-08-03)

- **La medición previa —la que destapó la 6a— subestimó el corte, y vale entender por qué.** Decía "241
  líneas, cero `chrome.*`, sólo depende de `Utils` y `BunClient`". Cierto pero incompleto: el
  grep que lo midió buscaba usos con punto (`Utils.`, `BunClient.`) y el motor tenía **dos
  dependencias más con el service worker escritas como identificadores pelados** —
  `SessionState.get([...])` y `controladorGraficoActivo.abort()`. **Al medir acoplamiento, un
  grep por `Modulo.` no ve los globals que se usan como variables.**
- **Las dos se cortaron en parámetros**, y el criterio es el mismo en ambos casos: el motor
  sabe *qué* necesita y *cuándo* pasa algo, pero no es dueño de nada del SW. `contexto`
  (`modoTurbo`/`titulo`/`sessionId`) reemplaza la lectura de `SessionState`, y
  `abortarHermanos()` reemplaza el abort sobre el controlador del caller.
- **Se fue una rama polimórfica muerta**: `tituloInmutable` aceptaba string *o* el objeto de
  callbacks, resto de una firma vieja. Ningún call-site la usaba —ni el SW ni los tests—, y el
  tipado obligaba a modelarla. Se verificó antes de sacarla.
- **El cambio de firma lo agarró un test de caracterización del SW**, no el compilador:
  `background.js` sigue en JS, así que `tsc` no lo mira. El test del bug 400 stubeaba el motor
  con la firma vieja y empezó a fallar porque el título ya no era el 4º argumento. Es
  exactamente para lo que se escribieron esos tests antes de migrar el SW.
- **Se agregó un test del contrato nuevo** (que el SW pase `modoTurbo`, `titulo`, `sessionId` y
  un `abortarHermanos` invocable). Sin él, romper ese contrato deja al motor descargando con el
  título equivocado, o sin poder frenar a los hermanos, y nada lo detecta.
- Los 15 tests del motor **no cambiaron ni una aserción**: sólo su cableado (de stubear 5
  globals a construir la factory con dobles).

### Registro de la Fase 6b — la cola a `core/cola/` (2026-08-04)

El corte más grande del plan, hecho en **dos tramos** porque en uno solo era irrevisable.

**Tramo 1 — `SessionState`.** Mecánico, y se llevaba 16 de las dependencias del bucle. Dejó
escrito por qué esa envoltura existe (los defaults: `storage.session` arranca vacío en cada
despertar del SW) y por qué el relleno usa `!= null` y no un chequeo por falsy.

**Tramo 2 — el bucle.** Lo que salió, además del movimiento:

- **Se fueron con él `loopActivo` y el `AbortController`**, que eran variables de módulo
  compartidas entre el bucle y los handlers IPC. Hoy son estado privado y se tocan por la API
  (`arrancarSiNoCorre` / `detener` / `abortarRafaga`). La guarda contra **dos ráfagas
  simultáneas** —que duplican descargas y se pisan el progreso— era un `if (!loopActivo)`
  repetido en tres call-sites y **sin un solo test**; ahora está en un lugar y tiene el suyo.
- **Tres extracciones más chicas cayeron de arrastre, y estaban bien escondidas**:
  `SW_ESTADOS_PROGRESO` (→ `core/cola/estadosProgreso.ts`), la notificación nativa
  (→ `plataforma/chrome/notificaciones.ts`) y el volcado legacy con offscreen + `downloads`
  (→ `plataforma/chrome/volcadoLegacy.ts`). Sin sacarlas, la composición no podía armar la
  cola: `composicion.ts` es `.ts` y no puede importar `background.js`.
- **El procesador recibe once colaboradores y ninguno es `chrome.*`.** Los tres que tocan el
  navegador entran ya envueltos desde Capa 3 o Capa 2. Es lo que permite correr el bucle
  entero en un test sin navegador — y lo que hace el harness ahora.
- **El harness dejó de stubear el bucle y pasó a construirlo.** `background.test.js` arma el
  procesador real con dobles; los 18 tests pasaron **sin cambiar una aserción**, sólo el
  cableado. Esos tests de caracterización, escritos antes de la 5b, ya se pagaron tres veces.
- **`background.js`: 958 → 451 líneas**, y lo que queda es casi todo cableado con `chrome.*`
  (notificaciones, tabs/windows, onInstalled) más los handlers IPC.

### Registro de la Fase 6c — el split de UI que no hizo falta (2026-08-04)

**El diseño de esta fase no sobrevivió a medirla, y por una buena razón: se escribió el
2026-07-19 y lo fueron vaciando las fases posteriores.** Decía tres cosas y las tres cambiaron:

1. **"`listaClases.preact.js` contiene las dos mitades; migrarla = partirla en dos."** Falso
   hoy: `<FilaClase>` **no tiene una sola línea de vocabulario del sitio**. Los badges que el
   diseño leyó como "badge de cátedra" son de *estado de descarga*
   (`pending`/`process`/`downloaded`). La cátedra salió de ahí en la Fase 1, cuando la faceta
   se generalizó. No había nada que partir.
2. **"Genéricos a `ui/comunes/`, de sitio a `sitio/ramonnet/ui/`."** Al medirlo, el split es
   **100% / 0%**: la única parte de la UI que nombraba al portal era el copy del onboarding
   (4 strings + la URL del listado). Se parametrizó con `PuertoSitio.nombre` —el mismo patrón
   que el plan ya recomendaba para la faceta: *parametrizar sale más barato que duplicar*— y
   con eso `sitio/ramonnet/ui/` queda **vacía por definición**. Mover `popup/features/` a
   `ui/comunes/` sería renombrar ~20 archivos y todas sus referencias en los docs para
   distinguirlos de una carpeta que no existe. **No se hizo, y no debería hacerse** hasta que
   haya un segundo portal que aporte UI propia.
3. **CSS: co-locación + BEM con namespace.** También descartado por ahora. El propio diseño
   admite que el CSS ya está partido por componente y los tokens ya viven en un solo lugar, o
   sea que lo que quedaba era **mover archivos y renombrar selectores**: churn con riesgo de
   regresión visual real y cero ganancia funcional, en una extensión de un solo usuario. Lo
   que sí se hizo es lo que era una inconsistencia de verdad: el keyframe `fadeIn-catedra`
   —vocabulario de sitio dentro del CSS genérico, compartido por tres componentes— pasó a
   `fadeIn-modal`, y los comentarios que decían "multicátedra" ahora dicen "faceta".

**Lo que queda como aprendizaje**: un plan escrito antes de ejecutar describe el código de ese
día. Esta fase estuvo cinco fases sin tocarse y en el medio se le fue el 90% del contenido sin
que nadie actualizara su descripción. **Medir antes de ejecutar** encontró lo mismo acá, en la
6 (los globals del SW que un grep con punto no veía) y en la 6a (el prerrequisito de `Utils`).

### Registro de la Fase 7a — el service worker como composición (2026-08-04)

**La medición partió la fase antes de escribir una línea**, y por una asimetría enorme: los
globals que lee cada orquestador son 33 en `background.js` (8 globals distintos) contra 168 en
`popup.js`, de los cuales **150 son `AppState`**. Son dos cortes con perfiles de riesgo
opuestos, así que se numeran 7a y 7b como se hizo con 5a/5b/5c y 6a/6b/6c.

- **`background.js` exporta `iniciarServiceWorker(deps)`** y recibe sus 8 colaboradores por
  parámetro. El diff es de cableado: los identificadores cambian de nombre y el cuerpo entra
  en un closure, pero ninguna rama de lógica se tocó.
- **La composición dejó de publicar SEIS globals** —`Almacenamiento`, `Programador`,
  `SessionState`, `EstadosProgreso`, `Cola`, `HlsEngine`—. La medición mostró que
  `background.js` era el **único consumidor de producción de los seis**: ni el popup, ni las
  features, ni las islas leían uno solo. Verificado en el bundle: ya no aparecen como
  `globalThis.X=` en `.output/chrome-mv3/background.js`.
- **`HlsEngine` ya estaba muerto desde la Fase 6b** y nadie lo notó. La composición lo
  publicaba con un comentario que afirmaba que el SW lo consumía; dejó de ser cierto cuando el
  motor pasó a entrar por inyección al procesador de cola. Es el mismo modo de falla que la
  tabla de fases: **un comentario que explica por qué algo existe no se revisa cuando el
  motivo desaparece.**
- **Lo que NO cambió, a propósito: el momento de registro de los listeners.**
  `iniciarServiceWorker` se llama desde el top-level de `entrypoints/background.js`, que es
  exactamente donde antes se evaluaba `background.js` por su efecto secundario. MV3 exige que
  `onInstalled`, `notifications.onClicked` y el receptor IPC queden registrados en el arranque
  sincrónico del worker: meterlos en el callback de `defineBackground` o detrás de un `await`
  los perdería en el primer arranque en frío, y **nada de eso lo ve la suite**.
- **`allowJs` no forzó nada**: `background.js` sigue en `.js`. La regla se dispara cuando
  `composicion.ts` tiene que importar al módulo, y acá es al revés — lo importa el entrypoint,
  que también es `.js`.
- **Los 18 tests de `background.test.js` pasan sin tocar una aserción.** El harness cambió sólo
  en cómo entrega las dependencias (de sembrar `globalThis` a pasarlas en la llamada); los
  `globalThis.X` que quedan son los que consumen el procesador de cola real y los dobles entre
  sí, y se dejaron a propósito: cambiar el código bajo prueba y la forma de sembrar el estado
  en el mismo corte es justo lo que anula un test de caracterización.

Efecto de borde que conviene mirar en la 7b: `plataforma/chrome/almacenamiento.ts` y
`mensajeria.ts` **se publican a sí mismos** como `globalThis.AlmacenamientoChrome` /
`MensajeriaChrome` al evaluarse. No lo consume nadie; quedó de antes de que existiera la
composición.

### El próximo paso (al 2026-08-04)

Los cortes 5c, 6, 6a, 6b, 6c y 7a están cerrados; el detalle de cada uno vive en su §Registro
más arriba, no en esta tabla. Lo que queda:

| Qué | Estado / riesgo |
|---|---|
| **Fase 7b — el popup como composición** | El trabajo real, y el de más riesgo que queda. `popup.js` son 1460 líneas y **168 lecturas de globals, 150 de ellas `AppState`**; ADR-0005 define que su núcleo —init, wiring, orquestación de scraping/render— **no se extrae**: la 7b no es vaciarlo, es que reciba sus dependencias en vez de leer globals. El agravante es la cobertura: el núcleo de `popup.js` no tiene tests unitarios **por diseño**, así que acá no hay red de caracterización como la que tuvo el SW. Medir antes, y considerar caracterizar primero lo que se vaya a tocar. |
| **Fase 8 — borrado del vanilla que no pasó por un puerto** | Sólo con paridad de tests. Hoy son `popup.js`, `renderers.js`, lo que quede de `background.js` y los tres módulos hermanos del adaptador de sitio (`scraper.js`, `parserTitulos.js`, `resolverManifiesto.js`), que siguen en `.js` **a propósito**: entran como globals para que las puertas del sitio no dependan del orden de carga. |
| **Puertos sin construir**, sin urgencia | `notifications` (queda el listener `onClicked`), `tabs`/`windows`, `scripting`. Ninguno bloquea nada. |

**Antes de empezar cualquiera de las dos: medir.** Es lo que más rindió en toda la
re-arquitectura, y falló en la dirección contraria las cuatro veces —el corte resultó más
grande (Fase 6: dos globals del SW que un grep por `Modulo.` no ve; 6b: tres extracciones
escondidas) o mucho más chico (6c: el 90% de lo diseñado ya no existía)—. **Un plan escrito
antes de ejecutar describe el código del día en que se escribió.**

**Regla de proceso que se consolidó ejecutando 5b/5c y conviene mantener**: una rama por corte,
los 4 chequeos en verde, **el dueño verifica en Chrome**, y recién ahí el merge. La suite no
cubre el empaquetado ni el núcleo de `popup.js`. Para `background.js` se agregó un paso más que
vale la pena repetir en cualquier archivo sin cobertura: **escribir primero los tests de
caracterización, migrar después**, y exigir que pasen sin tocar ninguna aserción.

**Restricción que descubrió `state.js`**: `allowJs` está en `false`, así que un `.ts` **no
puede importar un `.js`**. Cuando el patrón exige que `composicion.ts` (que es `.ts`) importe
al módulo, migrarlo al puerto obliga a convertirlo a TypeScript **en el mismo corte**.

**Pero sólo aplica a los módulos que instancia la composición.** Lo aclaró `queue.js` en la
Fase 5c: a esa feature la instancia `popup.js` (`QueueFeature.crear(ctx)`), no
`composicion.ts`, así que el puerto le entra por `ctx` y el archivo pudo quedarse en JS. La
regla real es: **si `composicion.ts` tiene que importarlo, va a TS; si lo recibe por `ctx`, no
hace falta**. Eso deja los cortes de las features del popup mucho más chicos.

**Y una advertencia sobre el orden de carga**: cuando un módulo deja de publicar su propio
global al evaluarse y pasa a que lo publique `composicion.ts`, su import del entrypoint se
borra y el global aparece **más tarde** en la cadena. Hay que confirmar que nadie lo consuma
en el tramo intermedio (en `state.js` no pasaba: `conexion.js` y `bunClient.ts` no tocan
`AppState`). El bundler no avisa de esto.

## Estado de avance

| Fase de migración | Estado |
|---|---|
| Diseño (este doc + ADR-0008) | ✅ Redactado (2026-07-19) |
| 0 — Paleta a tokens (`styles/variables.css` como única fuente de color) | ✅ Hecha (2026-08-02) |
| 1 — **Capa 2 completa** (faceta, constantes, resolución M3U8, dNR, parser, scraper) | ✅ Hecha (2026-08-02) |
| 2 — Selección de sitio: registro en runtime (ADR-0009) | ✅ Decidida (2026-08-02) |
| 3 — WXT + TypeScript, andamiaje vacío (compilar lo actual) | ✅ Hecha (2026-08-02), mergeada y **verificada en navegador** (2026-08-02) |
| 4 — `core/`: BunClient en TypeScript (+ typescript-eslint y `tsc --noEmit` en verde) | ✅ Hecha (2026-08-02) |
| 5a — `PuertoAlmacenamiento` + adaptador Chrome + adaptador en memoria + 1er consumidor migrado (historial de fallos) | ✅ Hecha (2026-08-02) |
| 5b — `PuertoAlmacenamiento`: adaptadores + **todos** los consumidores | ✅ **Completa** (2026-08-03) — historial de fallos, `AppState`, daemon de conexión y `background.js`. No queda ni un `chrome.storage` en el proyecto. (`queue.js` figuraba acá por error: sus usos eran IPC → Fase 5c.) |
| 5c — `PuertoMensajeria` (IPC) + `PuertoProgramador` (alarmas) + sus adaptadores | ✅ **Completa** (2026-08-03) — `PuertoMensajeria` ✅ con sus dos adaptadores; migrados `queue.js` y `popup.js` (2026-08-03). Se sumó `PuertoSitio` + `sitio/ramonnet/config.ts` (2026-08-03), que destapó el tapón de `allowJs` y habilitó la mudanza del daemon de conexión a `core/conexion/` (2026-08-03). Migrado también el IPC de `shared/state.ts` (2026-08-03): fuera de `background.js` ya no queda un solo `sendMessage` crudo. `PuertoProgramador` ✅ con sus dos adaptadores, y los 8 `chrome.alarms` del SW migrados. Cierra con el IPC de `background.js` en sus dos puntas: **no queda `sendMessage`/`onMessage` crudo en el proyecto**. Lo que sigue en `chrome.*` no espera a esta fase: `notifications`, `tabs`/`windows`, `scripting` y el camino legacy `downloads`/`offscreen` |
| 6a — `Utils` repartido (`core/util/` + `plataforma/chrome/`), `shared/` deja de existir | ✅ **Hecha** (2026-08-03). No estaba en el plan: apareció midiendo la 6, como su prerrequisito — el motor no podía aterrizar en `core/` mientras dependiera de un `Utils` que era un `.js` global (la regla de `allowJs`). Con la carpeta vacía, `shared/` salió del `include` de `tsconfig.json`. |
| 6 — Motor HLS → `core/hls/` | ✅ **Hecha** (2026-08-03) — `core/hls/hlsEngine.ts`, con el pool de 6 workers y el reintento 4xx cubiertos. Las dos dependencias con el SW que la medición previa no vio (`SessionState`, `controladorGraficoActivo`) se cortaron en parámetros. Detalle en §Registro de la Fase 6. |
| 6b — Cola de descarga → `core/cola/` | ✅ **Hecha** (2026-08-04, en dos tramos: `SessionState` primero, el bucle después). `background.js` pasó de 958 a 451 líneas. Salieron con él `core/cola/estadosProgreso.ts`, `plataforma/chrome/notificaciones.ts` y `plataforma/chrome/volcadoLegacy.ts`. Nota original: Va **después** de la 6 (el bucle maneja al motor) y de que el SW tenga sus puertos (5c: IPC receptor + alarmas). Es el bloque de lógica más grande que queda sin migrar, y ya tiene red: los 12 tests de caracterización del bucle y el auto-heal de `background.test.js`. |
| 6c — UI: split genérico vs. de sitio | ✅ **Hecha** (2026-08-04), y resultó ser **mucho más chica de lo diseñado**: no hubo nada que partir. La UI ya era genérica salvo el copy del onboarding, que se parametrizó por `PuertoSitio.nombre`. El split de carpetas y el BEM/co-locación de CSS quedan **explícitamente descartados** — ver §Fase 6c. |
| 7a — Entrypoints como composición: **el service worker** | ✅ **Hecha** (2026-08-04). `background.js` exporta `iniciarServiceWorker(deps)` y recibe 8 colaboradores por parámetro; la composición dejó de publicar 6 globals cuyo único consumidor era él. Los 18 tests pasaron sin tocar una aserción. Detalle en §Registro de la Fase 7a. |
| 7b — Entrypoints como composición: **el popup** | ⏳ No iniciada. 168 lecturas de globals en `popup.js`, 150 de ellas `AppState`, y sin red de tests sobre su núcleo (ADR-0005). Es el corte de más riesgo que queda. |
| 8 — Borrado del vanilla de la raíz | ⏳ No iniciada |

**Por qué aparecieron 6b y 6c (2026-08-03)**: la estructura objetivo de arriba incluye
`core/cola/` y `ui/`, pero ninguna fila de esta tabla las reclamaba — la 8 ("borrado del
vanilla") las daba por implícitas. Se agregan como cortes propios para que el plan y la
estructura objetivo digan lo mismo. La numeración con sufijo sigue la de 5a/5b/5c y no
renumera nada.

**La 6a apareció distinto (2026-08-03)**: no la reclamaba la estructura objetivo sino la
medición de la 6, que la encontró como prerrequisito duro. Se ejecutó y cerró el mismo día,
pero su fila se agregó a esta tabla recién el **2026-08-04** — junto con la de la 6, que había
quedado en "⏳ No iniciada" estando hecha desde el 2026-08-03. Es la falla que esta tabla puede
tener y el resto del doc no: `CLAUDE.md` delega acá el estado por fase, así que una fila sin
actualizar es la única versión que ve una sesión nueva. **Al cerrar un corte, la fila se toca
en el mismo cambio que el §Registro.**

## Verificación en navegador — ✅ corrida y pasada (2026-08-02)

Esta lista nació como deuda: las fases se hicieron con la suite en verde en cada corte, pero
nada de esto se había probado en Chrome. **Se corrió el 2026-08-02 sobre `.output/chrome-mv3/`
y pasó**, junto con el fix del sondeo ad-hoc de `queue.js`. Se conserva como **checklist de
regresión**: es lo que hay que volver a mirar después de cada fase que toque empaquetado,
entrypoints o el adaptador de sitio. Los puntos, con la extensión recargada:

1. Una descarga real de punta a punta (ejercita `resolverManifiesto` + el parser de títulos +
   el nombre de archivo en disco).
2. Que el ruleset `declarativeNetRequest` carga desde `sitio/ramonnet/rules.json` (un error de
   ruta aparece en la tarjeta de la extensión en `chrome://extensions/`).
3. El escaneo del aula (ejercita `SitioActivo.escanearListado` inyectado con executeScript).
4. Un aula multicátedra: modal, badge y filtro por faceta con los estilos renombrados.

Y lo específico del build de la Fase 3 (`npm run build` → cargar `.output/chrome-mv3/`; la
rama `feat/rearq-fase3-wxt` ya está mergeada, esto es hoy el camino normal):

5. Que el **service worker arranque sin excepción** (`chrome://extensions/` → "service
   worker" → consola). Es lo más delicado del empaquetado: el SW compilado es clásico,
   así que `importScripts` existe igual y sólo la guarda por `typeof Utils` evita que
   intente cargar rutas que en `.output/` no están.
6. Que el **popup renderice completo** (islas Preact incluidas): pasó de ~15 `<script>`
   sueltos a un único módulo con imports; si el orden se rompiera, fallaría alguna global.
7. Que el **CSS se vea igual**. El minificador del build rechazó un `@keyframes` anidado
   dentro de una regla (inválido, Chrome lo toleraba) y hubo que sacarlo al nivel
   superior en `styles/components/filters.css`: verificar la animación del popover de
   filtros.
