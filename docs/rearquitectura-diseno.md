# Re-arquitectura a núcleo + adaptadores — diseño de ejecución

Diseño concreto de la re-arquitectura de puertos-y-adaptadores + migración a TypeScript.
La **decisión** y su justificación viven en `docs/adr/0008-arquitectura-nucleo-adaptadores.md`
(que supersede a ADR-0001); **este documento es el "cómo"**: estructura de carpetas
objetivo, interfaces de los puertos, elección de bundler y orden de migración. Es el
equivalente de `docs/preact-migration.md` pero para el corte núcleo/adaptadores.

> **Estado**: diseño aceptado, **ejecución no iniciada**. No forma parte de la tanda de
> saldado de deuda técnica (esa queda en JS — ver `docs/ROADMAP.md` Fase 2 y el bug 400 en
> `docs/TECHNICAL_DEBT.md`). Se ejecuta después, incremental, en fases (abajo).

## Objetivo en una línea

Que re-clonar la extensión a **otro sitio** = escribir un adaptador de Capa 2, y a **otro
navegador** = un adaptador de Capa 3, **sin tocar el núcleo**. Hoy los tres tipos de código
(genérico / de sitio / de navegador) están entrelazados en los mismos archivos.

## Estructura de carpetas objetivo

```
src/
  core/                    # Capa 1 — genérico, cero chrome.*, cero Ramón Net
    hls/                   #   motor: pool de workers, parseo M3U8, AES-CBC
    cola/                  #   FIFO + máquina de estados de descarga
    conexion/              #   lógica del daemon (sondeo, clasificación de fallas)
    backend/               #   BunClient (contrato /api/*)
    puertos/               #   TODAS las interfaces (ver abajo)
  sitio/
    ramonnet/              # Capa 2 — implementa PuertoSitio
      scraper.ts           #   selectores DOM            (hoy popup/scraper.js)
      parserTitulos.ts     #   formatTitleStructured / clasificarCatedraYCarpeta / parseSmartDate
      resolverManifiesto.ts#   iframe Bunny + CDN + fallbacks regex (hoy hlsEngine)
      config.ts            #   URL_SONDEO_INTERNET, reglas dNR, cátedras A-D
  plataforma/
    chrome/                # Capa 3 — implementa los puertos de navegador (99 usos chrome.*)
  ui/                      # islas Preact + features (consumen core vía puertos)
  entrypoints/             # popup, service worker, offscreen (composición: inyectan adaptadores)
```

El catálogo exacto de qué archivo/función de hoy migra a cada capa está en **ADR-0008**
(no se repite acá — regla DRY, ADR-0007).

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

> **Caveat al tipar `Catedra`:** hoy `Utils.clasificarCatedraYCarpeta` devuelve
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

El corte se ve mejor en `listaClases.preact.js`, que hoy contiene las dos mitades: la
estructura de lista/selección/tabs es genérica, y `<FilaClase>` + el badge de cátedra son de
sitio. Migrar esa isla = partirla en dos, no moverla de carpeta.

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

- `wxt.config.ts` en la raíz con `srcDir: 'src'` y el bloque `manifest` (permisos y
  `host_permissions` se **generan** desde ahí; `manifest.json` a mano desaparece). El manifest
  actual es la fuente a portar — incluidos `declarativeNetRequest` + `rule_resources`, que son
  los que más fácil se pierden al regenerar, y `offscreen`/`downloads` si el path legacy
  no-Turbo sigue vivo.
- Scripts: `dev` (`wxt`, con HMR de popup y SW), `build` (`wxt build`), `zip` (`wxt zip`), y
  las variantes `-b firefox`. `test`/`lint` no cambian de comando, sí de alcance (`src/`).
- Salidas: `.wxt/` (types generados, va a `.gitignore`) y `.output/chrome-mv3/` — que pasa a
  ser **la carpeta que se carga en `chrome://extensions/`**, en vez de la raíz del repo. Es el
  cambio de flujo diario más visible para quien desarrolla, y hay que reflejarlo en
  `docs/contributing.md` y en el `README.md` el día que se ejecute.
- Verificación del paso de setup: `npx wxt prepare` genera `.wxt/` sin errores, y un `build`
  produce un SW cargable — antes de mover una sola línea de lógica.

## Orden de migración (incremental — nunca big-bang)

1. **Parsers puros → `sitio/ramonnet/`** (`parserTitulos`, `resolverManifiesto`): sin
   `chrome.*`, con los 39 tests de caracterización ya existentes como red.
2. **`BunClient` + lógica del daemon → `core/`**: fetch puro, ya testeados.
3. **`PuertoAlmacenamiento` + `PuertoMensajeria`** + adaptador Chrome: el corte transversal
   grande — conversión de globales `window.X`/`self.X` a módulos ES + TS de cada archivo al
   tocarlo, **una sola pasada por archivo** (por eso TS va fusionado, no aparte).
4. **Motor HLS → `core/hls/`** consumiendo puertos (llega con el pool ya testeado, si se
   ejecutó A3 del roadmap antes).
5. **`background.js` y `popup.js`** quedan como composición en `entrypoints/` (inyectan los
   adaptadores concretos en el núcleo).
6. **Sustitución y borrado del código vanilla de la raíz** — recién cuando los módulos de
   `src/` tengan **paridad de tests** con lo que reemplazan. Es un paso propio, no el efecto
   colateral del paso 5.

**Por qué este orden y no "bundler + UI primero":** arrancar por los parsers puros deja la
extensión funcionando y testeada en cada corte, y no toca el manifest hasta el final. El orden
inverso (montar WXT + migrar islas a `.tsx` antes que la lógica) llega antes a algo vistoso,
pero pone el paso de build y la regeneración del manifest en la posición donde un fallo
bloquea el uso diario de la extensión. Si igual se prefiere ese orden, la condición es hacerlo
en una rama larga y no mergear hasta que el `.output/` cargue y descargue una clase de punta a
punta.

**Reglas de ejecución** (aplican a cualquier orden):

- **Coexistencia**: mientras `src/` se construye, el código vanilla de la raíz sigue siendo lo
  que el navegador carga. La extensión se usa a diario; ninguna fase puede dejarla sin
  descargar clases. El corte se paga una sola vez, en el paso 6.
- **Verificación por fase**: cada fase termina con `npm test` en verde + `npm run lint` sin
  errores nuevos, y las que tocan el flujo de descarga, con el golden path manual
  (`docs/contributing.md`). Una fase que no se puede verificar está mal cortada.
- **Rollback**: una rama por fase (`feat/rearq-<fase>`), sin mergear a `main` hasta verificar.
  Mientras el SW vanilla de la raíz siga siendo el activo, abortar = descartar la rama.

## Estado de avance

| Fase de migración | Estado |
|---|---|
| Diseño (este doc + ADR-0008) | ✅ Redactado (2026-07-19) |
| 0 — Paleta a tokens (`styles/variables.css` como única fuente de color) | ✅ Hecha (2026-08-02) |
| 0b — Primer archivo de Capa 2: `sitio/ramonnet/config.js` (descriptor de faceta) | ✅ Hecha (2026-08-02) |
| 1 — Parsers puros → `sitio/` | ⏳ No iniciada |
| 2 — BunClient + daemon → `core/` | ⏳ No iniciada |
| 3 — Puertos storage/IPC + adaptador Chrome + TS transversal | ⏳ No iniciada |
| 4 — Motor HLS → `core/hls/` | ⏳ No iniciada |
| 5 — Entrypoints (composición) | ⏳ No iniciada |
