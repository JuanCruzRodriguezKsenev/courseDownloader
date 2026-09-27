# Plan — Loader con progreso, vuelta a la portada y Estado primero en filtros

**Spec**: [`docs/specs/loader-con-progreso/spec.md`](./specs/loader-con-progreso/spec.md) (RN-1..23, AC-1..11).
**Rama**: `classroom-escanear-todas`. Árbol limpio al empezar. **Fecha**: 2026-09-27.
**Estado previo**: correcciones del recorrido verificadas en Brave (B-2, B-3, B-6 ✅ en
`docs/ramas-en-revision.md`). B-3 midió **~124 s para 7 cursos (≈18 s/curso)**: ése es el número
contra el que se mide AC-11.

## Lo que hay que saber antes de tocar nada

- **Hoy el escaneo de un curso no emite nada** hasta que termina: es un `executeScript` sin `args`
  (`popup.js:1620-1623`) y el resultado vuelve en el callback. El recorrido sí emite, por
  `chrome.runtime.sendMessage` con `action: "recorrido_evento"` (ADR-0016), que el SW reduce en
  `storage.local.recorridoTodos` (`background.js:272-283`) y el popup lee con
  `recorridoTodos.suscribir` (`popup.js:529-545`).
- **El SW hace leer-modificar-escribir del storage por cada evento** (`background.js:273-281`).
  Hoy no hay carrera porque `avisar` (`scraper.js`, cuerpo de `escanearListado`, modo todos)
  hace `await` de cada `sendMessage` y el SW responde **después** de guardar. Un evento de
  progreso enviado sin `await` en paralelo con un `curso` **pisa el resultado del curso**: los
  dos leen el mismo `prev` y el último que escribe gana. Por eso el Paso 3 serializa todos los
  mensajes del recorrido en una cola.
- **`chrome.runtime.sendMessage` desde la pestaña llega también al popup**: el popup escucha con
  `mensajeria.onMensaje` (`plataforma/chrome/mensajeria.ts:74-87`, que hace `addListener`; se
  pueden registrar varios). El SW devuelve `false` para una `action` sin manejador
  (`background.js:506-510`), así que un mensaje sólo para el popup no lo molesta. Eso es el
  canal del escaneo de un curso (RN-8: efímero, no pasa por storage).
- **El loader**: `#ui-loader` con `#ui-loader-txt` (`entrypoints/popup/index.html:10-20`), sólo
  se toca por `mostrarLoader(texto)` / `ocultarLoader()` (`popup.js:465-475`), que pasan por
  `pisoLoader` (`popup/features/pisoVisible.js`: `transitorio` pinta y arranca un piso de 500 ms;
  `libre` espera el piso; **una sola escritura pendiente, la última gana**). El banco de
  verificación observa `#ui-loader-txt` (`verificacion/modoVerificacion.js:746`): **no se
  renombra ni se mueve**. El título sigue ahí; el detalle va en un nodo nuevo.
- **Islas Preact**: patrón de `popup/features/bannerConexion.preact.js` (store con
  `suscribir/get/mostrar/ocultar`, hook `useX`, `montar(root)`, `__resetStore()` para tests,
  `export default _store`).
- **Funciones inyectadas**: todo lo nuevo del scraper va **dentro** de `escanearListado`
  (`sitio/inyeccion.test.js` la serializa; regla de `AGENTS.md`).

## Radio de impacto

| Archivo | Qué cambia | Paso |
|---|---|---|
| `popup/features/filters.js` (+ test) | Estado antes de Materia | 1 |
| `core/estado/recorridoTodos.ts` (+ test) | Campos `lanzadoEn`, `actual`, `duracionMs`; evento `progreso` | 2 |
| `core/estado/progresoEscaneo.ts` (nuevo, + test) | Textos y vistas del loader, puros | 2 |
| `sitio/google-classroom/scraper.js` (+ test) | Reportador, fases, duración, vuelta a `/h` | 3 |
| `popup/features/loaderDetalle.preact.js` (nuevo, + test) | Isla del detalle del loader | 4 |
| `entrypoints/popup/index.html`, `styles/components/loader.css` | Nodo y estilos del detalle | 4 |
| `popup.js` | Recorrido al loader, progreso de un curso, `args` del escaneo, texto de oferta | 5 |
| Docs | `data-model.md`, ADR-0016, `testing.md`, `ramas-en-revision.md`, spec | 6 |

**Quién más lee lo que se toca** (revisar, no necesariamente cambiar):
- `esRecorridoTodos` (`recorridoTodos.ts:229-242`): los campos nuevos son **opcionales**; el
  validador no los exige, así un estado guardado por la versión anterior sigue siendo válido.
- `background.js:272-283` y `background.test.js`: el manejador es genérico (aplica cualquier
  evento con `aplicarEvento`), **no cambia**. Correr su test igual.
- `resumen`/`textoResumen` (`recorridoTodos.ts`): no cambian; el resumen final queda igual (spec §No incluye).
- `materializarRecorrido` (`popup.js:~1270-1310`) y `enlacesDe`: no leen los campos nuevos.
- Escáneres de Ramón Net y Anatomy: reciben `args: [{ idEscaneo }]` y **los ignoran** (sus
  funciones no toman parámetros). No se tocan.
- `verificacion/modoVerificacion.js:746`: sigue observando `#ui-loader-txt`.

---

## Paso 1 — Estado primero en el popover de filtros (RN-23; AC-10)

`popup/features/filters.js`, v2.6.0 + CHANGELOG. En `renderizarFiltrosMenuPopover`
(`:366`), rama Disponibles: mover el bloque `// --- Sección Estado ---` (`:407-434`) **antes**
del bloque `// --- Sección Materia` (`:372-405`). Nada más cambia; la rama Cola no se toca.
Actualizar el comentario de `:365` ("Disponibles => Estado + …") si queda desordenado.

Test en `filters.test.js`, junto al de `:549` (el que arma dos materias, ABDOMEN y TORAX):
`titulos[0] === 'Estado'`. **Control negativo**: con el bloque en su lugar viejo, el test falla.

## Paso 2 — Núcleo puro: estado del recorrido y textos del loader (RN-1, RN-11..13, RN-16, RN-18; AC-2, AC-3, AC-5)

### 2a. `core/estado/recorridoTodos.ts` v1.1.0 + CHANGELOG

- `RecorridoTodos` gana, **opcionales**: `lanzadoEn?: number` y
  `actual?: { indice: number; fase: FaseEscaneo; verMas: number; publicaciones: number; archivos: number }`.
- `CursoRecorrido` gana `duracionMs?: number`.
- `EventoRecorrido`:
  - `inicio` gana `lanzadoEn?: number` → se copia al estado.
  - `curso` gana `duracionMs?: number` → se guarda en el curso.
  - **nuevo** `{ tipo: "progreso"; idRecorrido; indice; fase; verMas; publicaciones; archivos }`.
- `aplicarEvento`:
  - `progreso`: se ignora (devuelve `prev`) si `prev.estado !== "escaneando"` o
    `ev.indice !== prev.indice`. Si no, `actual = { indice, fase, verMas, publicaciones, archivos }`
    y `ultimaSenal = ahora` (cuenta como señal de vida).
  - `latido` y `curso`: además de lo de hoy, **borran `actual`**.
  - Sumar `"progreso"` a la lista del chequeo de estado terminal (Paso 5 de las correcciones).
- `FaseEscaneo = "trabajo" | "ver-mas" | "novedades"`, exportado.

Tests nuevos: progreso con índice correcto se guarda; con índice viejo se ignora; después de
`fin` se ignora; `latido` y `curso` limpian `actual`; `inicio` con `lanzadoEn` lo guarda; `curso`
con `duracionMs` lo guarda; un estado sin campos nuevos sigue pasando `esRecorridoTodos`.

### 2b. `core/estado/progresoEscaneo.ts` (nuevo) + test

Funciones puras, sin DOM:

- `formatoReloj(ms)`: `m:ss` con segundos a dos cifras (`0:07`, `1:23`, `12:05`); negativos → `0:00`.
- `textoFase({ fase, verMas, publicaciones, archivos })`:
  - `trabajo` → `Trabajo en clase · N publicaciones`
  - `ver-mas` → `Cargando más publicaciones (verMas) · N publicaciones`
  - `novedades` → `Novedades · N archivos hasta ahora`
  - singular con 1 (`1 publicación`, `1 archivo`).
- `textoRestante(r)`: `null` si hay menos de 2 cursos con `resultado` **y** `duracionMs`. Si no,
  promedio de `duracionMs` de esos cursos × pendientes (`cursos.length` − cursos con `resultado`),
  en minutos redondeado hacia arriba; `≤ 1` → `≈ 1 min restante`, si no `≈ N min restantes`.
- `vistaLoaderRecorrido(r, nombrePortal)` → `{ titulo, lineas, cursos, pie, desde }`:
  - `titulo`: `Escaneando todos los cursos`.
  - sin cursos: `lineas = ["Buscando tus cursos…"]`, `cursos = []`.
  - con cursos: `lineas` = `Curso i+1 de N: <nombre>`, `textoFase(r.actual)` si `r.actual` existe,
    `Listos: a · Vacíos: b · Fallidos: c` (de `resumen(r)`), y `textoRestante(r)` si no es `null`.
  - `cursos`: `{ nombre, marca, actual }` por curso, marca `✓` ok, `○` vacío, `✗` fallido,
    `▸` el de `r.indice` sin resultado, `·` el resto.
  - `pie`: `[`Dejá ${nombrePortal} al frente.`, "Podés cerrar este popup."]`.
  - `desde`: `r.lanzadoEn ?? r.idRecorrido` (el popup crea `idRecorrido` con `Date.now()` al lanzar, `popup.js:~1343`).
- `vistaLoaderCurso(progreso, nombrePortal)` → `{ lineas: [textoFase(progreso)], cursos: [], pie: [`Dejá ${nombrePortal} al frente.`] }`.
  **No** incluye "Podés cerrar este popup" (RN-8).

Los textos van escapados **en el componente** (Preact escapa por defecto; no usar
`dangerouslySetInnerHTML`). El nombre del portal sale del registro (`portal.nombre`), nunca
escrito a mano (`docs/copy-generico-diseno.md`).

Tests: AC-2 (7 cursos, 1 ok, 1 vacío, en el 3º → líneas y marcas `✓ ○ ▸ · · · ·`), la tabla de
AC-3 entera (1 terminado → sin estimación; 2 a 40 s → `≈ 4 min restantes`; 6 a 30 s →
`≈ 1 min restante`), `formatoReloj` con los tres ejemplos, `textoFase` con las tres fases y singular.

## Paso 3 — Scraper de Classroom: reportar progreso y volver a la portada (RN-2, RN-4, RN-6, RN-11, RN-20..22; AC-4, AC-6, AC-7, AC-11)

`sitio/google-classroom/scraper.js` v1.5.0 + CHANGELOG. Todo dentro de `escanearListado`.

### 3a. Cola de mensajes del recorrido (corrige la carrera de "Lo que hay que saber")

- Reemplazar `avisar` por una **cola**: `let colaAvisos = Promise.resolve()`. Cada envío se
  encadena (`colaAvisos = colaAvisos.then(() => chrome.runtime.sendMessage(...)).catch(() => {})`),
  así el SW recibe los mensajes de a uno y en orden.
- `avisar(evento)` (latido, curso, inicio, fin) encadena y **espera** su propio envío, como hoy.
  Antes de encadenar, **descarta** el progreso pendiente que no salió (ver 3b): un progreso
  viejo no puede llegar después del `curso` que lo cierra.
- El progreso se encadena **sin** esperar (RN-4).

### 3b. Reportador con tope de frecuencia

- `reportar({ fase, verMas, publicaciones, archivos, nombre })`:
  - Guarda el último valor. Si pasaron ≥ 500 ms desde el último envío → envía ya; si no, deja
    **uno** pendiente con un `setTimeout` al vencer los 500 ms (el último gana). Nunca más de
    uno cada 500 ms (RN-2).
  - **Modo todos**: envía `{ tipo: "progreso", indice: <índice del curso actual>, fase, verMas, publicaciones, archivos }` por la cola de 3a.
  - **Modo un curso**: sólo si `opciones?.idEscaneo` está definido, envía
    `chrome.runtime.sendMessage({ action: "escaneo_progreso", idEscaneo, fase, verMas, publicaciones, archivos, nombre })`
    sin esperar, con `.catch(() => {})` (si el popup se cerró no hay receptor; RN-8).
- **Escaneo zombi**: `escanearCursoActual` guarda `const miToken = idCancelacion` al empezar y
  sólo reporta si `miToken === idCancelacion` (tras el tope, el zombi no puede pintar progreso
  sobre el curso siguiente).

### 3c. Dónde reporta `escanearCursoActual`

| Momento | `fase` | Números |
|---|---|---|
| Después de `pintadoOk` con `resultadoAsentado === "con-items"` | `trabajo` | `publicaciones` = `li[data-stream-item-id]` de la vista |
| Cada "Ver más" que **creció** (`crecio === true`, bucle de `:426-438`) | `ver-mas` | `verMas` + 1, `publicaciones` recontadas |
| Al asignar `nombreCurso = identidad.nombre` (`:497`) | la fase vigente | + `nombre` (sólo modo un curso lo usa) |
| Al entrar al paso 9 (Novedades) | `novedades` | `archivos` = `itemsLeidosTrabajo.length` |
| Después de leer Novedades | `novedades` | `archivos` = `itemsLeidosTrabajo.length + itemsLeidosNovedades.length` |

Con Trabajo en clase vacío (`resultadoAsentado === "vacio"`) no se reporta `trabajo`: el
primero es el de Novedades.

### 3d. Duración y lanzamiento

- `inicio` lleva `lanzadoEn: opciones.lanzadoEn` (lo pasa el popup, Paso 5).
- Al mandar el `latido` de un curso, `inicioCurso = Date.now()`; **todos** los `curso` de ese
  índice (ok, vacío, fallido, "no abrió", tope) llevan `duracionMs: Date.now() - inicioCurso`.

### 3e. Vuelta a la portada (RN-20..22)

Después del `for` y **antes** de `avisar({ tipo: "fin", estado: "terminado" })`:
- si `location.pathname` no cumple `/\/h\/?$/`, click en `document.querySelector('nav a[href$="/h"]')`
  (el mismo selector que ya usa la enumeración) y `esperarCondicion(() => /\/h\/?$/.test(location.pathname || ""), tiempos.navegacion)`.
- **Ojo**: no usar `esRutaPortada` para esta espera: su regex acepta `/h/archived`.
- Falte el link o no llegue, **igual** se manda `fin terminado` (RN-22).
- Va antes del `fin` a propósito: mientras el estado es `escaneando`, un `tabs.onUpdated` del
  popup cae en la fila "mostrar-recorrido" y no dispara nada; si fuera después, la navegación
  competiría con la materialización.
- Los caminos de corte (`visibilidad`, `navegacion`) **no** navegan (RN-21).

### Tests (`scraper.test.js`, desde el 29)

- 29 — **Serialización**: `sendMessage` simulado que tarda 20 ms y cuenta envíos en vuelo;
  recorrido de 3 cursos con progreso → en vuelo **nunca > 1** y el orden recibido respeta
  latido → progreso… → curso. **Control negativo**: con el progreso enviado fuera de la cola,
  falla. Pegar las dos salidas.
- 30 — En modo todos llegan eventos `progreso` con `fase` `trabajo` y `novedades` para un curso
  con material, y ninguno llega después del `curso` de su índice.
- 31 — Modo un curso con `{ idEscaneo: 7 }`: llegan `escaneo_progreso` con `idEscaneo: 7`, fases
  en orden y `nombre` del curso. Sin `idEscaneo`: **cero** `escaneo_progreso`.
- 32 — Frecuencia: con 10 "Ver más" que crecen seguidos (tiempos de test chicos), los progresos
  enviados están separados ≥ 500 ms entre sí (usar fake timers o medir `Date.now()` en el mock).
- 33 — Vuelta: al terminar el recorrido de test 19, `location.pathname` termina en `/h` y el
  último mensaje es `fin terminado`. **Control negativo**: sin 3e, la ruta queda en el último curso.
- 34 — Sin link `/h` en el `nav`: el recorrido igual manda `fin terminado`.
- 35 — Corte por visibilidad (test 20 existente): afirmar además que **no** hubo navegación a `/h` después del corte.
- 36 — `curso` lleva `duracionMs` numérico ≥ 0 en ok, vacío y fallido; `inicio` lleva `lanzadoEn`.
- Los tests 1-28 siguen pasando sin tocarlos, salvo lo mínimo para que el mock de
  `sendMessage` devuelva una promesa (si alguno lo mockea sincrónico).

## Paso 4 — Isla del detalle del loader (RN-1, RN-3, RN-5, RN-13; NFR-3)

- `entrypoints/popup/index.html`: dentro de `#ui-loader`, **después** de `#ui-loader-txt`,
  `<div id="ui-loader-detalle"></div>`. `#ui-loader-txt` no cambia.
- `popup/features/loaderDetalle.preact.js` con el patrón de `bannerConexion.preact.js`:
  - store `{ lineas: [], cursos: [], pie: [], desde: null }` con `mostrar(vista)` (reemplaza
    todo) y `limpiar()` (vuelve al vacío); `__resetStore()` y `export default _store`.
  - componente: líneas; si `desde` no es `null`, el reloj `formatoReloj(Date.now() - desde)`
    refrescado con un `setInterval` de 1000 ms que se limpia al desmontar o al quedar `desde = null`;
    si `cursos.length > 0`, una lista `<ul>` con `marca nombre`, el `actual` con clase
    `actual` y `scrollIntoView({ block: "nearest" })` cuando cambia; y el pie.
  - vacío (`limpiar`) → no pinta nada.
  - `montar(root)`; se monta desde `popup.js` al iniciar (Paso 5).
- `styles/components/loader.css`: dentro de `.loader-overlay`, `.loader-detalle` con
  `max-width: 90%`, texto a la izquierda, tokens de `variables.css` (nada de colores sueltos);
  la lista con `max-height: 40vh; overflow-y: auto`, nombres en una línea con
  `text-overflow: ellipsis` (el de G22 tiene 62 caracteres, NFR-3); `.actual` en negrita.
- **El piso no toca el detalle** (RN-3): el store se escribe directo, sin `pisoLoader`.
- Test `loaderDetalle.preact.test.js`: pinta líneas y pie; lista con marcas y `actual`; reloj
  avanza de `0:00` a `0:02` con fake timers; `limpiar` deja el root vacío.

## Paso 5 — Popup (RN-6..10, RN-14..19; AC-1, AC-4, AC-5, AC-7, AC-8, AC-9)

`popup.js` v5.29.0 + CHANGELOG. Montar `loaderDetalle` sobre `#ui-loader-detalle` al iniciar,
junto a las otras islas.

### 5a. `ocultarLoader` limpia el detalle

Dentro de la escritura que pasa `pisoLoader.libre` (`:473-475`), además de `display = 'none'`:
`loaderDetalle.limpiar()` y `loaderEsDelRecorrido = false` (5b). Con eso **todas** las salidas
del escaneo que ya apagan el loader limpian el detalle sin tocarlas una por una.

### 5b. El recorrido va al loader

- Variable del cierre `loaderEsDelRecorrido = false`.
- Función `sincronizarLoaderRecorrido()`:
  - `debe` = `recorrido && recorrido.estado === "escaneando" && recorrido.tabId === pestañaActivaId && esVigente(recorrido, Date.now(), sitioActivo?.topeEscaneoMs || 60000)`
    (la condición de la tarjeta de hoy, `:2053-2058`, **sin** mirar `pestañaActiva`: el loader
    tapa las pestañas, así que no se puede estar en Cola mientras dura).
  - `debe` y `!loaderEsDelRecorrido` → `mostrarLoader("Escaneando todos los cursos")`,
    `loaderEsDelRecorrido = true`.
  - `debe` → `loaderDetalle.mostrar(vistaLoaderRecorrido(recorrido, sitioActivo.nombre))`.
  - `!debe` y `loaderEsDelRecorrido` → `ocultarLoader()`.
  - Devuelve `debe`.
- Llamarla: al **principio** de `renderizarListadoInterfaz`, y en la rama Disponibles donde hoy
  está la tarjeta de progreso (`:2053-2078`): **borrar la tarjeta** y hacer `return` si `debe`.
- `recorridoTodos.suscribir` (`:529`): con `escaneando`, llamar `sincronizarLoaderRecorrido()`
  en vez de `renderizarListadoInterfaz()` (llega hasta 2 veces por segundo; no hace falta
  repintar la lista tapada). Las otras ramas del suscriptor no cambian.
- Rama `mostrar-recorrido` de `escanearOUsarGuardada` (`:1455-1459`): **sacar** `ocultarLoader()`
  (la toma `sincronizarLoaderRecorrido` en el render). Lo mismo en la guarda de recorrido de
  `ejecutarPaso1EscaneoRamonAutomatico` (`:1558-1570`) y en la guarda de fila 1 de
  `lanzarRecorridoTodos` (`:1331-1341`): ahí no se apaga, se renderiza.
- `lanzarRecorridoTodos`: el objeto local `recorrido` (`:~1343`) gana `lanzadoEn: idRecorrido`,
  y los `args` de la inyección (`:1364-1370`) ganan `lanzadoEn: idRecorrido`.
- `materializarRecorrido` y el camino de error de inyección (`:1378`) ya llaman `ocultarLoader`:
  con 5a alcanza.

### 5c. Progreso del escaneo de un curso

- `ejecutarPaso1EscaneoRamonAutomatico`, justo después de `mostrarLoader("Escaneando la pestaña...")`
  (`:1515`): `loaderDetalle.mostrar({ lineas: [], cursos: [], pie: [], desde: Date.now() })` y
  guardar ese `desde` en `desdeEscaneoActual`. Vale para los tres portales (RN-7, AC-8).
- La inyección (`:1620-1623`) gana `args: [{ idEscaneo: miGeneracion }]`.
- Un oyente **propio**, registrado una vez en `iniciarPopup` (no dentro de
  `conectarEscuchadoresDelWorker`, que no corre al arrancar): `mensajeria.onMensaje((req) => { … return false; })`
  que, si `req.action === "escaneo_progreso"`, `escaneoEnCurso` y `req.idEscaneo === generacionEscaneo`:
  - si `req.nombre` y es distinto del último → `mostrarLoader(req.nombre)` (título, con piso);
  - `loaderDetalle.mostrar({ ...vistaLoaderCurso(req, sitioActivo.nombre), desde: desdeEscaneoActual })`.
  - Cualquier otro mensaje: `return false` sin hacer nada.
- Los avisos del escaneo (visibilidad, curso cambiado, sin material, tope) ya apagan el loader
  por sus caminos; 5a limpia el detalle (RN-9, AC-9).

### 5d. Texto de la tarjeta de oferta

`:2086` "Tarda unos 45 s por curso" → "Tarda unos 20 s por curso" (B-3: 124 s / 7 cursos). Es
la corrección que el plan anterior dejó para "después de B-3 con el número medido".

Sin tests nuevos en `popup.js` (no hay banco para esto; deuda 🔴 de popovers y loader). Lo
cubren los tests de los Pasos 2 y 4 y la checklist B.

## Paso 6 — Documentación

- `docs/data-model.md:15` (fila `recorridoTodos`): los campos nuevos y el evento `progreso`.
  Sumar el mensaje `escaneo_progreso` donde el doc liste mensajes IPC, si los lista
  (contrastar antes de escribir).
- `docs/adr/0016-escaneo-inyectado-avisa-al-sw.md`: una sección "Ampliación 2026-09-27": evento
  `progreso`, **cola de mensajes** (y por qué: leer-modificar-escribir del SW), y
  `escaneo_progreso` directo al popup para el escaneo de un curso. No reescribir la decisión.
- `docs/specs/loader-con-progreso/spec.md`: en §No incluye, tachar la línea del texto de
  "45 s por curso" con una nota "entró en el plan: B-3 ya midió".
- `docs/testing.md` §Baseline: números nuevos.
- `docs/ramas-en-revision.md`: línea "Loader con progreso (plan `plan-loader-con-progreso.md`)"
  en el "Hecho por paso", y los ítems de la Verificación B de abajo como checklist nueva.
- `docs/TECHNICAL_DEBT.md` §"El loader del popup no tiene dueño": una línea con que el detalle
  vive en `loaderDetalle.preact.js` y que tokens y demora de aparición **siguen abiertos**. No
  cerrar el ítem.

---

## Verificación A — compuerta (pegar la salida, no describirla)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm exec vitest run sitio/google-classroom/scraper.test.js core/estado/recorridoTodos.test.ts core/estado/progresoEscaneo.test.ts popup/features/loaderDetalle.preact.test.js popup/features/filters.test.js sitio/inyeccion.test.js background.test.js
git grep -n "escaneo_progreso" -- popup.js sitio/google-classroom/scraper.js
git grep -n "Escaneando todos los cursos" -- popup.js core/   # sólo en progresoEscaneo.ts / su uso, ya no en una card
```

Más la salida de los **tres controles negativos** (Paso 1, test 29, test 33), cada uno fallando
contra el código sin su arreglo. Un control que no falla es un hallazgo del informe.

| AC | Dónde |
|---|---|
| AC-1 | Paso 5b + B-1 |
| AC-2 | test del Paso 2b + B-2 |
| AC-3 | test del Paso 2b (tabla entera) |
| AC-4 | tests 30, 31 + test del Paso 2b (`textoFase`) + B-4 |
| AC-5 | B-3 |
| AC-6 | tests 33, 34 + B-2 |
| AC-7 | test 35 + B-5 |
| AC-8 | Paso 5c + B-6 |
| AC-9 | Paso 5a + B-7 |
| AC-10 | test del Paso 1 + B-8 |
| AC-11 | tests 29, 32 (no hay esperas) + B-2 (cronómetro) |

## Verificación B — la corre el dueño en Brave

Antes: `pnpm run build` y recargar la extensión (no hay cambios en `backend/`).

1. **AC-1**: portada → "Escanear todos los cursos": el loader tapa todo con "Escaneando todos
   los cursos", el reloj corre y **no** hay tarjeta de progreso en la lista.
2. **AC-2 / AC-6 / AC-11**: dejar correr sin tocar. Durante: "Curso i de 7: <nombre>", la fase
   con números que suben, contadores, lista con marcas, y desde el 2º curso "≈ N min
   restantes". Al terminar: la pestaña queda en la portada de cursos y se ve la lista agrupada.
   **Cronometrar el total**: tiene que ser ≤ 130 s (124 s de B-3 + 5 %).
3. **AC-5**: relanzar con 🔄; en el curso 3, cerrar el popup; esperar ~20 s y reabrirlo: loader
   con el curso actual, las marcas y el reloj contando desde el lanzamiento.
4. **AC-4**: entrar a Física I (con la pestaña recién recargada) y abrir el popup: título con el
   nombre del curso, "Cargando más publicaciones (n)" con números que suben, "Dejá Google
   Classroom al frente." y **sin** "Podés cerrar este popup".
5. **AC-7**: relanzar; en el curso 3, cambiar de pestaña. Volver: la pestaña de Classroom sigue
   en ese curso y el popup muestra el resumen parcial, sin loader.
6. **AC-8**: en Ramón Net, escanear: "Escaneando la pestaña..." con reloj, sin fase.
7. **AC-9**: en un curso de Classroom, a mitad del escaneo cambiar de pestaña y volver: loader
   apagado y la tarjeta del aviso, sin restos del detalle.
8. **AC-10**: con la lista del recorrido, abrir Filtros: la primera sección es "Estado".

## Lo que no se toca

- `core/estado/origenListado.ts` (tabla de decisión), `background.js` (el manejador es genérico),
  `materializarRecorrido`, `resumen`/`textoResumen`.
- `#ui-loader-txt` y `pisoVisible.js`.
- Los escáneres de Ramón Net y Anatomy.
- Tokens y demora de aparición del loader (deuda 🔴, otro corte).
