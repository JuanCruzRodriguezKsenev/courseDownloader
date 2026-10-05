# Plan — Classroom: escanear todos los cursos desde la portada

**Spec**: [`docs/specs/classroom-escanear-todas/spec.md`](./specs/classroom-escanear-todas/spec.md)
(`draft`; M-2 y M-3 cerrados, M-1 se mide en la Verificación B). Cada paso cita las `RN-n` y
`AC-n` que implementa.
**Rama**: `classroom-escanear-todas` (ya existe, con la spec). Árbol limpio al empezar.
**Fecha**: 2026-09-25.

## Lo que hay que saber antes de tocar nada

- **El recorrido corre entero dentro de la pestaña**, en UNA sola inyección: M-2 midió que
  portada → archivadas → curso → portada navega por la SPA sin recargar (una marca en `window`
  sobrevive), y el scraper ya navega así con `click()` sobre links de `nav`
  (`sitio/google-classroom/scraper.js:298`, `:501`, `:577`).
- **Por qué no lo orquesta el service worker**: tendría que esperar un `executeScript` de hasta
  180 s por curso, y MV3 puede suspender el SW en medio. Y **por qué no el popup**: se cierra, y
  cerrarlo descarta el resultado (deuda ⚪ en `TECHNICAL_DEBT.md`). La pestaña es el único
  contexto que vive todo el recorrido.
- **Cómo sobrevive al popup (RN-15)**: el script inyectado le **manda un mensaje al SW por cada
  curso** (`chrome.runtime.sendMessage`, disponible en el mundo ISOLATED en el que inyecta
  `executeScript` por defecto). El SW lo guarda en `chrome.storage.local` bajo la clave nueva
  `recorridoTodos`. El popup la lee al abrir y se suscribe a sus cambios. **Es la primera vez que un
  script inyectado habla con el SW** → ADR-0016 (Paso 9).
- **La lista la sigue armando el popup**, con el mismo código de hoy. El SW sólo guarda los
  `enlaces` crudos por curso. Al ver el recorrido terminado, el popup lo "materializa": arma la
  lista con la misma función que usa el escaneo de un curso (Paso 6).
- **Lo que YA funciona para varios cursos y no hay que tocar**: cada enlace trae
  `modulo: "<curso> › <tema>"` (`scraper.js:674`), y `ParserTitulosClassroom.clasificarCarpeta`
  saca la carpeta de la parte de antes de `›` (`sitio/google-classroom/parserTitulos.js`). O sea que
  la identidad (ADR-0014, RN-11) y la carpeta por curso (RN-13, AC-10) salen solas si se concatenan
  los `enlaces` de todos los cursos. El filtro de materia de `popup/features/filters.js:380-386` ya
  aparece solo cuando hay más de una carpeta.

## Radio de impacto

| Archivo | Qué cambia | Paso |
|---|---|---|
| `sitio/google-classroom/scraper.js` | Modo `todos`, cancelación, `motivoAviso` | 1 |
| `sitio/google-classroom/scraper.test.js` | Tests del recorrido | 1 |
| `sitio/google-classroom/__fixtures__/` | `portada.html` y `archivadas.html` nuevos | 1 |
| `sitio/google-classroom/config.ts` | `esPaginaDelSitio`, `claveDeListado`, `esPortada`, copy | 2 |
| `core/puertos/sitio.ts` | Miembro opcional `esPortada?` (13 → 14) | 2 |
| `sitio/registro.test.ts` | `:60-61` y `:181` se invierten | 2 |
| `core/estado/recorridoTodos.ts` (+ test) | **Nuevo**: tipos, reductor, vigencia, resumen, lector con suscripción | 3 |
| `plataforma/composicion.ts`, `entrypoints/popup/main.js` | Instanciar el lector e inyectarlo al popup | 3, 6 |
| `background.js`, `entrypoints/background.js` | Manejador IPC `recorrido_evento`; inyectar el módulo | 4 |
| `core/estado/origenListado.ts` (+ test) | `decidirAlAbrir` con las 5 filas de la spec | 5 |
| `core/estado/appState.ts` | `recorridoTodos` en `CLAVES_DE_SESION` | 5 |
| `popup.js` | Lanzar, progreso, materializar, guardas | 6 |
| `popup/features/listaClases.preact.js` (+ test) | Encabezados por curso, nota multilínea | 7 |
| `styles/list.css` | `.grupo-curso`, `white-space` de `.lista-nota` | 7 |
| Docs (ver Paso 9) | data-model, patterns, architecture, multisitio, ADR-0016, AGENTS, diseño | 9 |

**Quién más lee lo que se toca**, para que no se rompa en silencio:
- `esPaginaDelSitio`: `sitio/registro.ts:76` (`resolverPorUrl`), y a través de él
  `entrypoints/popup/main.js:110`, `popup.js:549` (`adoptarPortalDePestaña`), `popup.js:1163` y
  `verificacion/modoVerificacion.js:647`. Que la portada pase a ser "página del sitio" hace que el
  popup **adopte Classroom en la portada**. Eso es lo buscado, pero entonces los disparadores
  automáticos (`popup.js:789-812`) llegan a `escanearOUsarGuardada()` en la portada, y ahí la
  fila 3 de la tabla de decisión tiene que ganarle a "escanear" (Paso 5). **Si no, abrir el popup
  en la portada lanza un escaneo de un curso que aborta con "Abrí un curso…" (`scraper.js:92`).**
- `claveDeListado`: `popup.js:1168` y `:1516`.
- `escanearListado` de Classroom: `sitio/inyeccion.test.js` lo serializa. Tiene que seguir
  compilando como expresión (Paso 1 no agrega nada fuera de la función).

---

## Paso 1 — El scraper aprende a recorrer (RN-2, RN-3, RN-5..RN-9, RN-14; AC-2, AC-6, AC-7, AC-8)

`sitio/google-classroom/scraper.js`, versión **v1.4.0**, con su entrada de CHANGELOG.

**1a. Partir la función sin sacar nada de ella.** Hoy todo el cuerpo de `escanearListado` escanea
el curso de la URL. Moverlo **tal cual** a una función interna `async function escanearCursoActual()`,
declarada **dentro** de `escanearListado` (la regla de `AGENTS.md`: autocontenida y serializable,
sin nada a nivel de módulo). `escanearListado(opciones)` queda así:
- sin `opciones.modo`, o con cualquier valor distinto de `"todos"` → `return escanearCursoActual()`.
  **Comportamiento idéntico al de hoy** (RN-19, AC-13): los 18 tests existentes pasan sin tocarlos.
- con `opciones.modo === "todos"` → el recorrido (1c).

`tiempos`, `dormir`, `esperarCondicion`, `visible` y los avisos quedan donde están, arriba, y los
comparten los dos caminos.

**1b. Cancelación y motivo de aviso.**
- Una variable del cierre, `let cancelado = false`. `dormir(ms)` pasa a tirar
  `new Error("cancelado")` si `cancelado` es `true`, al despertar. `esperarCondicion` duerme por
  `dormir`, así que hereda el corte. En modo curso nadie lo pone en `true`.
- Cada objeto de aviso gana un campo `motivoAviso`, sin cambiar el texto del `aviso`:
  - `avisoVisibilidad` (`:69`) → `"visibilidad"`;
  - `avisoCursoCambiado` (`:74`) → `"curso-cambiado"`;
  - el aviso de `enlaces.length === 0` **sin** adjuntos sin resolver (`:688`, "Este curso no tiene
    archivos en Trabajo en clase ni en Novedades.") → `"sin-material"`. Es **el mismo** aviso que
    devuelve el caso `[data-no-topic-items]` del test 8 (`scraper.test.js`, `expect(res.aviso)`), o
    sea MC6/Q5 (RN-14, AC-8). La rama con adjuntos sin resolver del mismo `return` queda **sin**
    `motivoAviso`: es un fallo, no un curso vacío;
  - todos los demás quedan **sin** `motivoAviso`, y el recorrido los trata como fallo.
  El popup no lee el campo en modo curso (sigue usando `resultado.aviso`), así que no cambia nada ahí.

**1c. El recorrido.** `opciones` trae `{ modo: "todos", idRecorrido: number, tabId: number,
sitioId: string, topeCursoMs: number }` (lo arma el popup, Paso 6). En orden:

1. `const avisar = async (evento) => { try { await chrome.runtime.sendMessage({ action:
   "recorrido_evento", idRecorrido, tabId, sitioId, ...evento }); } catch {} }`. Con
   `typeof chrome !== "undefined"` como guarda, para que jsdom no reviente. **Se espera cada envío**
   (`await`): serializa los eventos y el SW no tiene que ordenar nada.
2. Si `!visible()` → `avisar({ tipo: "fin", estado: "cortado", motivoCorte: "visibilidad" })` y
   devolver. (Un recorrido que arranca oculto no enumera nada.)
3. **Enumerar.** Si no estamos en la portada (`/h` o `/h/st`), `click()` en
   `nav a[href$="/h"]` y esperar. Leer los **activos**: los `a[href]` que matchean
   `/c/<id>` (fin de href) y **no** están dentro de `nav`, en orden de documento y sin repetir id
   (M-3: la portada trae los 6, sin "Ver más"). Nombre tentativo, sólo para el progreso: la primera
   línea no vacía del `textContent` del ancla, o `aria-label`. Después `click()` en
   `nav a[href$="/h/archived"]`, esperar a que cambie la URL, y leer los **archivados** igual
   (fuera de `nav`, excluyendo ids ya vistos). Lista final = activos + archivados (RN-6).
   Si la lista queda vacía → `fin` `cortado` con `motivoCorte: "sin-cursos"`.
4. `avisar({ tipo: "inicio", cursos: [{ id, nombre }] })`.
5. **Por cada curso `i`**:
   - Si `!visible()` → `fin` `cortado` `"visibilidad"` y devolver (RN-9).
   - `avisar({ tipo: "latido", indice: i })`.
   - Navegar: `click()` en `nav a[href$="/h/archived"]` (existe en toda página, medido en las
     muestras de curso de `recorrido-3`), esperar un `a[href$="/c/<id>"]` (del sidebar si es activo,
     de la tarjeta si es archivado), `click()`, y esperar `location.pathname` con `/c/<id>`
     (`tiempos.navegacion`). Si no llega → curso `fallido`, `motivo: "no abrió"`, siguiente.
   - Escanear con tope: `Promise.race` entre `escanearCursoActual()` y un temporizador de
     `topeCursoMs` que resuelve `{ vencido: true }`. Si vence: `cancelado = true`, esperar a que
     `escanearCursoActual` termine (tira `"cancelado"` en su próximo `dormir`; capturarlo),
     `cancelado = false`, y el curso queda `fallido` con `motivo: "superó <n> s"` (RN-7, RN-8).
   - Según el resultado:
     - `motivoAviso === "visibilidad"` → `fin` `cortado` `"visibilidad"`, devolver (RN-9, AC-6).
     - `motivoAviso === "curso-cambiado"` → `fin` `cortado` `"navegacion"`, devolver (AC-6).
     - `motivoAviso === "sin-material"` → curso `vacio` (RN-14, AC-8).
     - otro `aviso` → curso `fallido` con `motivo` = el texto del aviso (RN-8, AC-7).
     - excepción no prevista → curso `fallido`, `motivo: "error inesperado"`.
     - si no, curso `ok` con sus `enlaces` y su `adjuntosSinResolver`.
   - `avisar({ tipo: "curso", indice: i, resultado: "ok"|"vacio"|"fallido", motivo?, enlaces?,
     adjuntosSinResolver? })`.
6. `avisar({ tipo: "fin", estado: "terminado" })`. La pestaña queda donde esté (RN-10, PA-1).
7. Devolver `{ materia: "", enlaces: [], recorrido: true }`. El popup **no** usa este retorno
   (Paso 6): todo viaja por los eventos.

Credenciales: el recorrido **no** las manda. Classroom sólo expone `authuser`, y lo cosecha
cualquier escaneo de un curso. Anotarlo en el CHANGELOG del scraper.

**1d. Tests** (`sitio/google-classroom/scraper.test.js`, numerados a partir de 19):
- Fixtures nuevos: `__fixtures__/portada.html` (un `nav` con links `/u/2/h`, `/u/2/h/archived` y
  dos cursos activos en el sidebar, más dos tarjetas `/u/2/c/CURSO123` y `/u/2/c/CURSO456` fuera
  de `nav`) y `__fixtures__/archivadas.html` (el mismo `nav` más una tarjeta `/u/2/c/CURSO789`).
- La navegación se simula con un listener de `click` sobre `document` que mira el `href` del ancla,
  reemplaza `document.documentElement.innerHTML` por el fixture que corresponde (el de curso sale
  de `curso.html` con `CURSO123` reemplazado por el id) y actualiza `window.location`, con el mismo
  truco de `prepararDom` (`:23-27`). Stub global `chrome.runtime.sendMessage = vi.fn(async () => {})`.
- 19: recorre 3 cursos (2 activos + 1 archivado) en ese orden. Eventos, en orden: `inicio`
  (3 cursos) → 3×(`latido`, `curso` `ok`) → `fin` `terminado`. Cada `curso` trae los enlaces con
  su propio `modulo`.
- 20: `visibilityState` pasa a `hidden` durante el curso 2 → hay 1 `curso` `ok` y después `fin`
  `cortado` `"visibilidad"`. No hay `curso` para el 2 (AC-6).
- 21: un curso cuyo fixture no confirma identidad (reusar la variante del test 16) → `curso`
  `fallido` con el texto del aviso, y el recorrido **sigue** hasta `fin` `terminado` (AC-7).
- 22: un curso con `[data-no-topic-items]` y sin posts → `curso` `vacio` (AC-8).
- 23: tope por curso. `topeCursoMs: 50` con un curso que nunca pinta → `fallido` `"superó…"`, y el
  siguiente curso se escanea bien (**el escaneo cancelado no sigue corriendo**: el siguiente
  `curso` `ok` trae sólo sus propios enlaces).
- 24: sin `opciones` → idéntico a hoy. `sendMessage` **no** se llama nunca (RN-19).
- **Control negativo obligatorio**: correr 20 y 23 contra el scraper **sin** el arreglo del que
  dependen (sin el chequeo de `visible()` entre cursos, y sin `cancelado`) y confirmar que fallan.
  Pegar la salida en el informe.

## Paso 2 — El descriptor reclama la portada (RN-1; AC-1)

`sitio/google-classroom/config.ts` → **v1.3.0**:
- `esPaginaDelSitio`: además de `/c/` y `/w/`, reclama
  `^https://classroom\.google\.com/(?:u/\d+/)?h(?:/|$|\?)` (portada, `/h/st`, `/h/archived`).
- Miembro nuevo `esPortada(url)`: `true` sólo para ese patrón de `/h`.
- `claveDeListado(url)`: en la portada devuelve la constante `"todos"`. Con eso la fila 2 de la
  tabla de decisión sale de la lógica que ya existe (Paso 5).
- `instruccionEscaneo`: "Escaneá desde un curso, o desde «Todas mis clases» para escanear todos.
  Dejá esa pestaña al frente hasta que termine: puede tardar varios minutos, y si cambiás de
  pestaña el escaneo se corta."

`core/puertos/sitio.ts`: miembro **opcional** `esPortada?(url: string | undefined): boolean`, con un
docblock que diga que "portada" es la página desde la que el portal ofrece escanear todos sus
listados, y que corre en el popup. **No** tocar el tipo de `escanearListado` (el llamador es
`popup.js`, que es JS). Subir la cuenta del puerto en su cabecera (13 → 14) y agregar la entrada
de CHANGELOG.

`sitio/registro.test.ts`:
- `:60-61` pasan a `toBe(SitioGoogleClassroom)` (antes `toBeUndefined()`).
- `:181`: `claveDeListado("…/u/2/h")` → `"todos"`.
- Nuevo: `esPortada` es `true` para `/u/2/h`, `/u/2/h/st` y `/u/2/h/archived`, y `false` para
  `/u/2/c/<id>` y `/u/2/w/<id>/t/all`.
- El test de disjuntos sigue pasando: ningún otro portal reclama `classroom.google.com`.

## Paso 3 — El estado del recorrido, como módulo puro (RN-15, RN-17; AC-4)

**Nuevo** `core/estado/recorridoTodos.ts`, con su test al lado. **Sin `chrome.*` y sin storage.**

```ts
export type EstadoRecorrido = "escaneando" | "terminado" | "cortado";
export interface CursoRecorrido {
  id: string; nombre: string;
  resultado?: "ok" | "vacio" | "fallido"; motivo?: string;
  enlaces?: unknown[]; adjuntosSinResolver?: number;
}
export interface RecorridoTodos {
  idRecorrido: number; tabId: number; sitioId: string;
  estado: EstadoRecorrido; cursos: CursoRecorrido[]; indice: number;
  ultimaSenal: number;          // ms epoch del último evento
  motivoCorte?: "visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta";
  materializado: boolean;
}
export type EventoRecorrido = /* inicio | latido | curso | fin | materializado, como en el Paso 1 */;

export function aplicarEvento(prev: RecorridoTodos | null, ev: EventoRecorrido, ahora: number): RecorridoTodos | null;
export function esVigente(r: RecorridoTodos, ahora: number, topeCursoMs: number): boolean;
export function resumen(r: RecorridoTodos): { total: number; ok: number; vacios: number; fallidos: { nombre: string; motivo: string }[]; sinRecorrer: number };
export function textoResumen(r: RecorridoTodos): string;
export function enlacesDe(r: RecorridoTodos): { enlaces: unknown[]; adjuntosSinResolver: number };
export function esRecorridoTodos(v: unknown): v is RecorridoTodos;

// El popup NO recibe el puerto de almacenamiento (`iniciarPopup`, `popup.js:381`): quien escucha
// storage son módulos creados en `composicion.ts`. Copiar la forma de
// `crearHistorialFallos(almacenamiento)` (`core/historial/historialFallos.ts`: `obtener`,
// `suscribir`, `engancharOyente` con `ambito === "local"` y la clave).
export function crearLectorRecorrido(almacenamiento: PuertoAlmacenamiento): {
  leer(): Promise<RecorridoTodos | null>;            // valida con esRecorridoTodos
  suscribir(cb: (r: RecorridoTodos | null) => void): () => void;
};
```

`plataforma/composicion.ts`: `export const RecorridoTodos = crearLectorRecorrido(almacenamiento);`,
al lado de `HistorialFallos` (`:65`). **Export con nombre, sin `globalThis`**: la regla de
`AGENTS.md` (§Execution contexts, "publishes exactly one global").

Reglas del reductor:
- `inicio` crea el estado de cero (`escaneando`, `indice: 0`, `materializado: false`) **aunque
  `prev` sea de otro `idRecorrido`**: un recorrido nuevo pisa al anterior (RN-20).
- Cualquier otro evento con un `idRecorrido` distinto al de `prev` → devuelve `prev` sin cambios.
  Es un rezagado de un recorrido viejo.
- `latido` → `indice` y `ultimaSenal`. `curso` → llena `cursos[indice]`. `fin` → `estado`,
  `motivoCorte`. `materializado` → `materializado: true` y **borra los `enlaces` de cada curso**
  (ya viven en `listaPersistente`; así no hay dos copias en storage). Todos actualizan `ultimaSenal`.
- `esVigente`: `estado !== "escaneando"` o `ahora - ultimaSenal <= topeCursoMs + 30000`.
- `textoResumen`, con el formato de la spec (wireframe "Terminado"):
  `"7 cursos: 5 con material · 2 vacíos · 0 fallidos"`, más una línea `⚠ <nombre>: <motivo>` por
  fallido, más (si `cortado`) `"Se cortó en el curso <i+1> de <n>: <motivo legible>. Quedaron
  <k> sin recorrer."`. Motivos legibles: `visibilidad` → "Classroom quedó en segundo plano";
  `navegacion` → "navegaste fuera del recorrido"; `sin-respuesta` → "el recorrido dejó de
  responder"; `sin-cursos` → "no encontramos cursos en la portada". **Texto plano**, sin HTML.
- `enlacesDe`: concatena los `enlaces` de los cursos `ok`, **en el orden del recorrido**, y suma
  `adjuntosSinResolver`.

Tests: `crearLectorRecorrido` sobre `almacenamientoEnMemoria` (`leer` valida, `suscribir` avisa sólo por la clave `recorridoTodos` en `local`); una secuencia feliz completa; un rezagado de otro `idRecorrido` que se ignora; un `inicio`
que pisa a un recorrido terminado; `esVigente` justo en el borde (`topeCursoMs + 30000` vigente,
`+1` no); `textoResumen` de un recorrido terminado y de uno cortado con un fallido; `materializado`
que vacía los `enlaces`; `esRecorridoTodos` rechaza `null`, un objeto sin `cursos` y un `estado`
desconocido.

## Paso 4 — El SW guarda los eventos (RN-15; AC-4)

`background.js`, versión y CHANGELOG. Nuevo manejador en `manejadoresIPC`:

```js
recorrido_evento: async (request, sendResponse) => {
  const { recorridoTodos: prev } = await almacenamiento.obtenerLocal(["recorridoTodos"]);
  const sig = recorrido.aplicarEvento(recorrido.esRecorridoTodos(prev) ? prev : null, request, Date.now());
  if (sig !== prev) await almacenamiento.guardarLocal({ recorridoTodos: sig });
  sendResponse({ status: "ok" });
}
```

- `background.js` **no importa nada**: recibe todo por `iniciarServiceWorker({ … })`
  (`background.js:216`), y quien inyecta es `entrypoints/background.js:50-73`. Sumar ahí
  `import { aplicarEvento, esRecorridoTodos } from '../core/estado/recorridoTodos.ts'` y pasar
  `recorrido: { aplicarEvento, esRecorridoTodos }` en la llamada. Sumar `recorrido` a la
  desestructuración de `iniciarServiceWorker`. (El popup, en cambio, **sí** importa directo de
  `core/estado/`: `popup.js:347` ya lo hace con `origenListado.ts`. Hacer lo mismo en el Paso 6.)
- Leer y escribir es seguro sin candado porque el script inyectado **espera** cada `sendMessage`
  (Paso 1c.1), así que los eventos llegan de a uno.
- `sendMessage` desde la pestaña despierta al SW si estaba suspendido: no hace falta nada más.

## Paso 5 — Qué hace el popup al abrirse (RN-1, RN-16, RN-18; AC-1, AC-5, AC-11, AC-13)

`core/estado/origenListado.ts` → v1.1.0. `decidirAlAbrir` gana dos entradas y dos salidas:

```ts
export type DecisionAlAbrir =
  | "mostrar-recorrido" | "materializar-recorrido" | "usar-guardada" | "ofrecer-todos" | "escanear";

decidirAlAbrir(p: {
  origen; sitioId; clave; hayItemsDelPortal;          // como hoy
  esPortada: boolean;
  recorrido: { tabId: number; estado: EstadoRecorrido; vigente: boolean; materializado: boolean } | null;
  tabId: number | undefined;
})
```

Orden de evaluación. **Es la tabla de decisión de la spec**, más una fila para materializar:

1. `recorrido` con `estado === "escaneando"`, `vigente` y `recorrido.tabId === tabId` →
   `"mostrar-recorrido"` (fila 1, RN-16).
2. `recorrido` con `estado !== "escaneando"` y `!materializado` → `"materializar-recorrido"`.
   Vale **en cualquier página**: si el recorrido terminó con el popup cerrado, lo primero al
   reabrir es mostrarlo, aunque la pestaña haya quedado parada en un curso.
3. La regla de hoy (`clave`, `origen`, `hayItemsDelPortal`) da `"usar-guardada"` →
   `"usar-guardada"` (en la portada cubre la fila 2, porque la clave es `"todos"`).
4. `esPortada` → `"ofrecer-todos"` (fila 3).
5. `"escanear"` (filas 4 y 5, como hoy).

**El llamador calcula `vigente`**: un recorrido `escaneando` y **no** vigente se trata antes de
decidir. El popup manda `recorrido_evento { tipo: "fin", estado: "cortado", motivoCorte:
"sin-respuesta" }` y re-lee, y con eso cae en la fila 2.

Tests nuevos en `origenListado.test.ts`: uno por fila; que la fila 1 **no** aplique si el recorrido
es de **otra** pestaña; que la 2 aplique en una página de curso; y que las entradas de hoy, con
`esPortada: false` y `recorrido: null`, devuelvan exactamente lo mismo que antes (AC-13).

`core/estado/appState.ts`: sumar `"recorridoTodos"` a `CLAVES_DE_SESION` (`:472`), para que
`limpiarSesionLocal` lo borre junto con `listaPersistente` y `origenListado`. `AppState` **no**
guarda el recorrido en memoria: no es suyo, lo escribe el SW.

## Paso 6 — El popup: lanzar, mirar, materializar (RN-1, RN-4, RN-15..RN-21; AC-1, AC-4, AC-5, AC-11, AC-12, AC-14)

`popup.js`, versión y CHANGELOG. Seis piezas.

**6a. Estado local y suscripción.** `entrypoints/popup/main.js:46` importa `RecorridoTodos` de
`composicion.ts` y lo pasa a `iniciarPopup({ …, recorridoTodos: RecorridoTodos })`; sumarlo a la
desestructuración de `popup.js:381`. En el cierre de `iniciarPopup`: `let recorrido = null;`,
cargado con `await recorridoTodos.leer()` en el arranque, **antes** del primer
`escanearOUsarGuardada()`. Los eventos que manda **el popup** (`fin` por vigencia vencida en 6d,
`materializado` en 6f) van por `mensajeria.enviar({ action: "recorrido_evento", idRecorrido:
recorrido.idRecorrido, tipo: … })`, con el `idRecorrido` del recorrido que se está cerrando (el
reductor ignora los de otro). Y `recorridoTodos.suscribir((r) => …)`: actualizar la variable y:
- si sigue `escaneando` → `renderizarListadoInterfaz()` (la tarjeta de progreso);
- si pasó a `terminado`/`cortado` sin materializar y la pestaña activa es la del recorrido →
  `materializarRecorrido()`.

**6b. Extraer la rama feliz del escaneo.** El bloque `else` de `popup.js:1460-1525` (arma
`nuevasClases`, deduplica contra la cola, fija `origenListado`, respalda, renderiza y sincroniza el
disco) pasa a una función `aplicarEnlacesEscaneados(portal, url, enlaces)`. El callback del escaneo
de un curso la llama **en el mismo punto y con los mismos datos**: el diff ahí tiene que ser mover
código, sin cambiar ninguna línea. Guardarse `adjuntosSinResolverUltimoEscaneo` y el
`nodos.folder.value` como están hoy, antes de la llamada.

**6c. `lanzarRecorridoTodos()`.** Con guarda `escaneoEnCurso` (la misma que
`ejecutarPaso1EscaneoRamonAutomatico`, `popup.js:1204`).
`chrome.tabs.query` para la pestaña activa → `portal` con `esPortada?.(tab.url)`. Si no es
portada, no hace nada. Si es:
`idRecorrido = Date.now()`, y `chrome.scripting.executeScript({ target: { tabId: tab.id }, func:
portal.escanearListado, args: [{ modo: "todos", idRecorrido, tabId: tab.id, sitioId: portal.id,
topeCursoMs: portal.topeEscaneoMs }] }, cb)`.
- En el callback, **sólo** `chrome.runtime.lastError` importa: si lo hay, el mismo camino que la
  inyección fallida de hoy (`escaneoMuerto = { motivo: "inyeccion", … }`, `popup.js:1356`). El
  retorno se ignora: todo viaja por los eventos.
- **Sin watchdog del popup**: el tope es por curso y lo aplica el script (Paso 1). Si el script
  muere, lo detecta la vigencia (Paso 5).
- Mientras llega el evento `inicio`, la tarjeta de progreso dice "Buscando tus cursos…".
- `escaneoEnCurso` se suelta en el callback. El recorrido **no** lo retiene: lo que bloquea un
  segundo lanzamiento es la fila 1 de `decidirAlAbrir`, que vive en storage, y no una variable del
  popup que muere con él.

**6d. `escanearOUsarGuardada()` (`popup.js:1158`)**, con las decisiones nuevas:
- antes de decidir, si `recorrido` está `escaneando` y `!esVigente(…)` → mandar el evento
  `fin`/`cortado`/`"sin-respuesta"` (6a lo va a recibir) y seguir con el valor actualizado;
- `"mostrar-recorrido"` → `adoptarPortalDePestaña(tab.url)`, `renderizarListadoInterfaz()` y
  `return` (**no** escanea, RN-16);
- `"materializar-recorrido"` → `materializarRecorrido()`;
- `"ofrecer-todos"` → `adoptarPortalDePestaña`, `configurarBotonesUX("escanear-todos", "Escanear
  todos los cursos", false)` y `renderizarListadoInterfaz()` (la tarjeta de oferta, 6f);
- `"usar-guardada"` y `"escanear"`, como hoy.

**Y la misma guarda de la fila 1 en `ejecutarPaso1EscaneoRamonAutomatico()`**, al principio,
después de resolver la pestaña: si hay un recorrido vigente en **esa** pestaña, no escanea y
repinta. Cubre al footer "Re-escanear", al 🔄 (`nodos.btnRescan`, `popup.js:1728`) y a
`onReescanearAula` (`:691`), que la llaman directo.

**6e. El 🔄 y el botón de acción en la portada** (RN-20; AC-12). `nodos.btnRescan` y el modo
`re-escanear` del botón: si la pestaña activa es portada (`portal.esPortada?.(tab.url)`) →
`lanzarRecorridoTodos()`; si no → `ejecutarPaso1EscaneoRamonAutomatico()`. En el despacho de
`nodos.btnAction` (`popup.js:1712`) sumar el modo `"escanear-todos"` → `lanzarRecorridoTodos()`.
`:1061` y `:2443` cortan temprano con `modoActual === 're-escanear'`: sumarles `'escanear-todos'`,
**después de leer qué protegen** esos dos `return`, para no pisar el botón mientras se ofrece.

**6f. `materializarRecorrido()` y las tarjetas.**
- `materializarRecorrido()`: `const { enlaces, adjuntosSinResolver } = enlacesDe(recorrido)`.
  - Si hay enlaces → `adjuntosSinResolverUltimoEscaneo = adjuntosSinResolver`,
    `nodos.folder.value = ""`, y `aplicarEnlacesEscaneados(portal, <url de portada>, enlaces)`.
    El `origenListado` queda `{ sitioId, clave: "todos" }`: pasar como `url`
    `https://classroom.google.com/u/<n>/h`, con el `<n>` sacado de la URL de la pestaña del
    recorrido o, si no se puede, el `authuser` de `credencialesPortal`.
  - Si no hay (todos vacíos o fallidos, AC-14) → no toca la lista y fija un estado para la tarjeta
    de abajo.
  - En los dos casos, mandar el evento `materializado`.
- En `renderizarListadoInterfaz` (`popup.js:1822` en adelante), **antes** del bloque de
  `escaneoMuertoDominaLaPestaña()` y **después** de la alerta de conexión (la de conexión sigue
  ganando, `docs/alertas-y-bloqueo-diseno.md` §1), y sólo en la pestaña Disponibles:
  - **recorrido vigente en la pestaña activa** → `ListaClases.render({ modo: 'card', card: {
    tipo: 'info', icono: '🗂️', titulo: 'Escaneando todos los cursos', descripcion } })`, con
    `descripcion` = `Curso <i+1> de <n>: <nombre>` + `<br>Listos: a · Vacíos: b · Fallidos: c` +
    `<br>Dejá Classroom al frente. Podés cerrar este popup.` Sin `inicio` todavía: "Buscando tus
    cursos…". **El nombre del curso es scrapeado y la descripción va por
    `dangerouslySetInnerHTML`: `utils.escaparHtml`** (NFR-4, `docs/security.md`).
  - **oferta** (decisión `ofrecer-todos`, sin lista de todos) → tarjeta `info`, `icono: '📚'`,
    `titulo: 'Todas mis clases'`, `descripcion: 'Escaneamos todos tus cursos, activos y archivados,
    uno por uno. Tarda unos 45 s por curso.<br>Dejá esta pestaña al frente hasta que termine.
    Podés cerrar este popup.'` (RN-21: los 45 s son la estimación hasta M-1, ver la
    Verificación B). El botón de acción dice "Escanear todos los cursos": la tarjeta dice qué pasa
    y el botón qué hace (§3 del mismo doc).
  - **terminado o cortado sin enlaces** (AC-14) → tarjeta `info` con `titulo: 'El recorrido no
    trajo material'` y `descripcion` = `textoResumen` escapado, con `\n` → `<br>`.
- **Lista de todos con enlaces**: la `nota` del view-model (`popup.js:1993`) pasa a ser
  `textoResumen(recorrido)` si `appState.origenListado?.clave === "todos"` y hay recorrido
  materializado, **más**, en otra línea, la nota de adjuntos sin resolver si la hay. Texto plano:
  la isla la pinta como texto (Paso 7).

## Paso 7 — La lista agrupada por curso (RN-17; AC-2, AC-8)

`popup/features/listaClases.preact.js` → versión y CHANGELOG.

- **Agrupar lo decide `popup.js`, y la isla sólo pinta** (el mismo reparto que la fila anclada,
  `:262-274`). En `popup.js`, en la rama Disponibles (`filtrados.sort(_orden.comparador())`), si
  `appState.origenListado?.clave === "todos"` y los `filtrados` tienen **más de un curso**
  (curso = `clase.modulo.split(" › ")[0]`): reordenar de forma **estable** por el orden de
  aparición del curso en `appState.listadoClasesGlobal` (que es el del recorrido), dejando el orden
  del comparador adentro de cada curso, y pasar `ctx.grupos = [{ desde: <índice en filtrados>,
  titulo: <curso>, conteo: <filas de ese curso en filtrados> }]`.
- La isla, en `modo: 'lista'` y con `ctx.grupos` presente, inserta antes de la fila `desde` un
  `html\`<div class="grupo-curso" key=${'g-' + titulo}><span>${titulo}</span><span>${conteo}</span></div>\``.
  Es **texto**, sin `dangerouslySetInnerHTML`, así que Preact lo escapa solo. Con la fila anclada
  activa (pestaña Cola) no se agrupa: `ctx.grupos` sólo llega en Disponibles.
- `.lista-nota`: `white-space: pre-line` para que el `\n` del resumen salte de línea.
- `styles/list.css`: regla `.grupo-curso`, copiando la de `.cola-divisor` (mismo archivo) como
  base: una línea con el nombre a la izquierda y el conteo a la derecha. **No hace falta un `@import`
  nuevo**: `list.css` ya está en la cadena.
- Tests en `listaClases.preact.test.js`: con `ctx.grupos` de dos cursos se pintan dos
  `.grupo-curso` en las posiciones correctas con su conteo; sin `ctx.grupos`, el render es el de
  hoy; un título con `<b>` sale como texto literal.

## Paso 8 — Copy del onboarding

Si `entrypoints/popup/main.js:110` o el onboarding muestran `instruccionEscaneo`, verificar que el
texto nuevo del Paso 2 entra en su caja. Sólo mirar: el texto lo fija el Paso 2.

## Paso 9 — Documentación

**Contrastá cada línea contra lo que ya dice el doc antes de escribirla**:
- **ADR-0016** nuevo, `docs/adr/0016-escaneo-inyectado-avisa-al-sw.md`, con el formato de
  `docs/adr/README.md`: *un script inyectado en la pestaña puede mandar mensajes al SW con
  `chrome.runtime.sendMessage` cuando su trabajo dura más que el popup*. Contexto (el popup se
  cierra, el SW se suspende, la pestaña es el único contexto que dura), decisión, consecuencias
  (el IPC deja de ser sólo popup↔SW; el script sigue autocontenido; los tests lo stubean) y
  alternativas descartadas (orquestar desde el SW; el popup abierto). Sumarlo al índice del README.
  **Contrastar** con `AGENTS.md` §Execution contexts, bullet "IPC goes through
  `PuertoMensajeria`": el script inyectado no puede importar el puerto, igual que no puede importar
  `config.ts` (bullet de `Scraper.escanearAulaVirtual`, `AGENTS.md:201`).
- `AGENTS.md:201` (bullet de `Scraper.escanearAulaVirtual`): una oración con la excepción y el link
  a ADR-0016. **No** repetir el contenido del ADR.
- `docs/data-model.md`: fila nueva `recorridoTodos` en la tabla de `chrome.storage.local` (forma,
  **escrita por el SW**, leída por el popup, borrada por `limpiarSesionLocal`). **Contrastar** con
  la fila `origenListado` (`:14`): documentar ahí el valor `"todos"` de `clave`.
- `docs/patterns.md:9`: sumar `recorrido_evento` a la lista de acciones, aclarando que la **manda
  la pestaña**, no el popup.
- `docs/architecture.md`: donde lista las zonas de ejecución, una línea con que el script inyectado
  de Classroom habla con el SW (link a ADR-0016).
- `docs/multisitio-diseno.md`: el miembro opcional `esPortada?` del puerto, donde se enumeran los
  miembros. **Contrastar la cuenta del puerto** (13 → 14) con `AGENTS.md:197`, que dice "13 since
  2026-08-12": actualizarla ahí también.
- `docs/portal-google-classroom-diseno.md` §5: línea con el recorrido y el link a este plan.
- `docs/TECHNICAL_DEBT.md`, ⚪ "Cerrar el popup a mitad del escaneo descarta el resultado":
  agregar que el recorrido de todos ya no lo sufre (ADR-0016) y que el escaneo de un curso sí,
  a propósito (RN-19). **Sigue abierto.**
- `docs/testing.md` §Baseline: los números nuevos de la compuerta.
- `docs/ramas-en-revision.md`: la sección de `classroom-escanear-todas` ya existe (la dejó la ronda
  de planificación). Pasarla de "En preparación" a "🚧 En revisión", con la lista de Hecho por paso
  y la checklist de la Verificación B de abajo.

---

## Verificación A — compuerta (pegar la salida, no describirla)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm exec tsc --noEmit --listFiles | grep -c 'core/estado/recorridoTodos.ts'   # debe dar 1
pnpm run build
pnpm exec vitest run sitio/google-classroom/scraper.test.js core/estado/recorridoTodos.test.ts core/estado/origenListado.test.ts sitio/registro.test.ts popup/features/listaClases.preact.test.js sitio/inyeccion.test.js
git grep -n "chrome\.runtime\.sendMessage" -- sitio/ | grep -v test   # sólo scraper.js de Classroom
```

Más la salida del **control negativo** del Paso 1d (tests 20 y 23 contra el código sin el arreglo).

| AC | Dónde se cubre |
|---|---|
| AC-1 | `origenListado.test.ts` (fila `ofrecer-todos`) + checklist B-2 |
| AC-2 | `scraper.test.js` 19 + checklist B-3 |
| AC-3 | checklist B-6 |
| AC-4 | `recorridoTodos.test.ts` (secuencia) + checklist B-4 |
| AC-5 | `origenListado.test.ts` (fila `mostrar-recorrido`) + checklist B-5 |
| AC-6 | `scraper.test.js` 20 + checklist B-7 |
| AC-7 | `scraper.test.js` 21 |
| AC-8 | `scraper.test.js` 22 + checklist B-3 |
| AC-9 | checklist B-8 |
| AC-10 | checklist B-9 |
| AC-11 | `origenListado.test.ts` + checklist B-10 |
| AC-12 | checklist B-11 |
| AC-13 | `scraper.test.js` 24, los 18 tests viejos sin tocar, `origenListado.test.ts` + checklist B-12 |
| AC-14 | `recorridoTodos.test.ts` (`textoResumen` sin enlaces); no reproducible con los cursos reales |

## Verificación B — en Brave, la hace el dueño

**Antes**: `pnpm run build`, recargar la extensión desde `.output/chrome-mv3/`, cuenta `/u/2/`,
backend levantado (sólo para B-9).

1. [ ] **M-1**: con el escaneo de un curso (como en `main`), cronometrar cada curso por separado.
   Anotar los segundos. Si el promedio se aleja de 45 s, corregir el texto del Paso 6f y NFR-1.
2. [ ] **AC-1** Portada `/u/2/h`, abrir el popup: tarjeta "Todas mis clases", botón "Escanear
   todos los cursos", y la pestaña **no** se mueve.
3. [ ] **AC-2 / AC-8** Apretar el botón con la pestaña al frente, esperar sin tocar. Al final:
   resumen con los cursos de hoy (5 activos + 2 archivados = 7), G25 con 71 de Trabajo en clase y
   MB5 con 24, un encabezado por curso con material, y MC6 y Q5 sin grupo, contados como vacíos.
   **Cronometrar el total** (NFR-1: menos de 6 min).
4. [ ] **AC-4** Relanzar con 🔄. En el curso 2, cerrar el popup. A los 60 s, reabrirlo: progreso en
   un curso posterior. Al terminar, la lista está completa.
5. [ ] **AC-5** A mitad del recorrido, abrir el popup (la pestaña está dentro de un curso): se ve el
   progreso y **no** aparece "Escaneando la pestaña…".
6. [ ] **AC-3** Terminado el recorrido, entrar a MC2 y escanearla sola: mismos ítems y nombres que
   en su grupo.
7. [ ] **AC-6** Relanzar y, en el curso 4, cambiar de pestaña. Volver y abrir el popup: resumen
   "Se cortó en el curso 4 de 7: Classroom quedó en segundo plano", con los 3 completos en la
   lista. Repetir haciendo click en otro curso del sidebar: "navegaste fuera del recorrido".
8. [ ] **AC-9** Si algún archivo de Drive está en dos cursos, aparece en los dos grupos, y bajarlo
   desde uno no lo marca en el otro. (Si no hay ninguno en los cursos reales, anotarlo y seguir.)
9. [ ] **AC-10** Bajar un PDF de G22 y uno de MC2: cada uno en `raíz/google-classroom/<curso>/`.
10. [ ] **AC-11** Con la lista de todos, entrar a MC2 y abrir el popup: escanea MC2. Volver a la
    portada y abrir el popup: tarjeta "Todas mis clases", no la lista de todos.
11. [ ] **AC-12** En la portada con lista de todos, 🔄 arranca un recorrido nuevo desde el curso 1.
12. [ ] **AC-13** Dentro de G22, sin recorrido: el popup se comporta igual que en `main`.
13. [ ] **Consola del SW** (`chrome://extensions` → service worker): llegan los
    `recorrido_evento`, sin errores.

## Lo que no se toca

- El escaneo de un curso: su código sólo se **mueve** a `escanearCursoActual()` (Paso 1a) y gana
  `motivoAviso`. Nada más.
- `core/cola/`, `identidadClase`, la descarga, el backend.
- Anatomy y Ramón Net: el miembro nuevo del puerto es opcional y no lo implementan.
- La presentación final de la lista multi-curso: la decide el rediseño.
