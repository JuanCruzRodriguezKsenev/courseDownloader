# Plan — Corte 2a: el editor de adopción, un curso a la vez

**Rama**: `classroom-destino-adopcion` (sobre `0774054` + el commit de este plan). **Fecha**: 2026-09-27.
**Spec**: `docs/specs/classroom-destino/spec.md`, corte 2a (PA-3, forma de la adopción). No hay RN ni AC nuevos:
es la forma de la pantalla del plan `docs/plan-classroom-destino-2a-editor.md`. Los cambios de comportamiento
están en §Qué ve el dueño; la verificación los cubre uno por uno.

## Por qué

En A-2 el dueño revisa curso por curso, y hoy la página lo obliga a saltar entre tres listas: cursos arriba,
temas en el medio (agrupados por curso) y archivos abajo (agrupados por curso › tema). Para decidir un tema tiene
que buscar sus archivos 300 filas más abajo. Decidido por el dueño hoy: **un curso a la vez** (una barra con los
cursos) y **los archivos debajo de su tema**.

## Alcance

**Un solo archivo de producto**: `backend/adopcion/editor.html`. Más un archivo nuevo de verificación,
`backend/adopcion/humo-editor.js` (Paso 3).

**No se toca**: `backend/adopcion/editor.js` (sirve el HTML y la API), `backend/server.js`, la API
(`api/datos`, `api/guardar`, `api/ensayo`), `ejecutarGuardar`, el botón Probar, el panel de resultados,
`marcarCambio`, `resolverCarpeta` ni el criterio de choques de `recalcularChoques`.

**Radio de impacto**: `editor.html` lo lee sólo `editor.js:150-154` (`fs.readFileSync`, lo sirve igual en modo
suelto `/` y montado en el 3001 bajo `/adopcion/`). Guardar y Probar trabajan sobre `DATOS`, no sobre el DOM
(`editor.html:1103-1180`): no dependen de qué curso está a la vista. **Ningún test** carga `editor.html`: por eso
el Paso 3.

## Qué hace la página hoy (`backend/adopcion/editor.html`)

- `:400-411` encabezado fijo con los contadores globales (`cnt-copiar`, `cnt-ya-esta`, `cnt-duplicado`,
  `cnt-omitir`, `cnt-choques`), el aviso de cambios, Guardar y Probar. **Queda igual.**
- `:425-466` tres `<section>`: `#sec-cursos` (tabla con `#tbody-cursos`), `#sec-temas` (filtro
  `#filtro-sin-regla`, `#lista-temas`) y `#sec-archivos` (filtros `#filtro-texto-archivos`,
  `#filtro-solo-choques`, `#filtro-solo-copiar`, `#lista-archivos`).
- `:528-611` `recalcularChoques()`: arma `GRUPOS_CHOQUE` y `FILAS_CON_CHOQUE` (Set de `clave` de archivo) sobre
  **todos** los archivos, y actualiza los contadores. Un choque puede juntar archivos de dos cursos de la misma
  materia (hoy los 7 son de MC2).
- `:613-618` `renderizarTodo()` = choques + las tres secciones.
- `:620-717` `renderizarCursos()`: por curso, `select` de materia (con `(sin materia)` y `DATOS.materias`),
  `input` de docente con un `datalist` propio por curso (`DATOS.docentes[materia]`) y la línea
  `.ruta-teorias-info` ("Teorías va a …"). Sus `change`/`input` hacen `marcarCambio(); recalcularChoques();
  actualizarDestinosEnVivo();`.
- `:719-823` `renderizarTemas()`: un `<details>` por curso con una tabla Tema / Ítems / Destino (`select` con
  `DATOS.destinos` + `-` "no bajar este tema") / Regla (badge "sin regla — revisá" si `tema.regla === "no"`).
- `:825-1004` `renderizarArchivos()`: un `<details>` por par curso›tema (cerrados), tabla Original / Acción /
  Nombre / Destino en vivo. Cada fila: `tr#fila-arch-<clave>`; `ya-esta` → badge; `duplicado` → badge
  `#dup-badge-<clave>` "igual a <nombre de la primera fila con ese md5>"; `copiar`/`omitir` → `select#sel-acc-<clave>`
  e `input#inp-nom-<clave>` con los mismos tres llamados en sus eventos.
- `:1006-1100` `actualizarDestinosEnVivo()`: recorre **todos** `DATOS.archivos`, busca su `tr` por id y si no
  está en el DOM **lo saltea** (`if (!tr) continue`). Las búsquedas dentro de la fila usan
  `CSS.escape` (`:1031-1033`) porque la `clave` lleva `:`. **No se toca.**
- Los datos de texto que se meten con `innerHTML` sin escapar: `curso.nombre` (`:633`), el nombre del curso en los
  summaries (`:742`, `:888`), el tema (`:888`), la cantidad de choques (`:890`) y `nombrePrimera` junto con el id
  `dup-badge-<clave>` (`:955`, ⚪ ya anotado). Son las 5 líneas que hoy encuentra el grep (a).

Datos reales (copia de `~/Descargas/adopcion-classroom`, medido hoy): **7 cursos, 45 temas, 366 archivos**. Por
curso, en el orden de `cursos.tsv`:

| Curso | Archivos | Temas | Sin regla | Filas en choque |
|---|---|---|---|---|
| Física II G22 … | 88 | 13 | 0 | 0 |
| 2026 - 2C - MC6 :: Mate C | 0 | 0 | 0 | 0 |
| MC2 2025 | 25 | 10 | 0 | 7 (5 `mc2_2025_2do_cuatrimestre_mc2.pdf` + 2 `mc3.pdf`, tema Novedades) |
| Física I-Grupo G-Ing 2024 | 130 | 12 | 1 (`Cuestiones administrativas`) | 0 |
| Q5 Primer Cuatrimestre 2023 | 0 | 0 | 0 | 0 |
| Fisica_II_G25_2026 | 99 | 8 | 0 | 0 |
| MB5 2024 | 24 | 2 | 0 | 0 |

## Qué ve el dueño

- **E-a.** Arriba, igual que hoy: contadores globales, Guardar, Probar.
- **E-b.** Debajo, una **barra de cursos**: un botón por curso, en el orden de `cursos.tsv`. Cada uno muestra el
  nombre, la cantidad de archivos y dos insignias: **sin regla** (temas del curso con `regla === "no"`) y
  **choques** (archivos del curso que están en `FILAS_CON_CHOQUE`). Una insignia en 0 no se ve. Un curso con 0
  archivos se ve atenuado (clase `curso-vacio`, la que ya existe) pero se puede elegir.
- **E-c.** Al cargar, el curso activo es el **primero de la barra con choques o sin regla**; si no hay ninguno,
  el primero con archivos. Con los datos de hoy: **MC2 2025**.
- **E-d.** Debajo de la barra, **sólo el curso activo**:
  1. Su cabecera: nombre, `select` de materia, `input` de docente con su `datalist` y la línea "Teorías va a …".
     Mismo comportamiento que hoy (`:620-717`).
  2. Los filtros, que ahora actúan **sobre el curso activo**: texto (original o nombre), sólo sin regla, sólo
     choques, sólo a copiar. Se conservan al cambiar de curso.
  3. Sus temas, en el orden de `temas.tsv`. Cada tema es una **cabecera** con: botón para desplegar (▸/▾) y el
     nombre del tema, ítems, `select` de destino (mismas opciones que hoy), la marca de regla (badge "sin regla —
     revisá" o "automática", igual que hoy) y una insignia de choques si tiene. Debajo, **plegada o desplegada**,
     la tabla de sus archivos con las mismas cuatro columnas y el mismo comportamiento por fila que hoy.
  4. Archivos del curso cuyo `tema` no figura en `temas.tsv`: un bloque final "(tema que no figura en
     temas.tsv)", sin `select` de destino. Hoy no hay ninguno; `aplicar` los rechaza igual.
  5. Curso con 0 archivos: la cabecera del curso y el texto "Este curso no tiene archivos." (`#curso-sin-archivos`).
- **E-e.** Desplegado por defecto: los temas **sin regla** o **con choques**. Si hay un filtro de texto, de choques
  o de copiar activo, se despliegan los temas con alguna fila que pasa el filtro y **se ocultan** los temas sin
  ninguna. El filtro "sólo sin regla" oculta los temas con regla. El estado desplegado/plegado que el dueño elige a
  mano se recuerda por `clave_curso + "\t" + tema` mientras la página esté abierta (un `Set` en memoria; nada en
  `localStorage`).
- **E-f.** Editar (materia, docente, destino de tema, acción, nombre) **no redibuja**: hace lo mismo que hoy
  (`marcarCambio(); recalcularChoques(); actualizarDestinosEnVivo();`), así no se pierde el foco del `input`. Las
  insignias de la barra y de los temas se actualizan en vivo (Paso 1.5).
- **E-g.** Cambiar de curso redibuja sólo la zona del curso. Lo editado no se pierde: vive en `DATOS`.

## Paso 1 — `backend/adopcion/editor.html`

### 1.1 Markup (`:423-466`)

Reemplazá las tres `<section>` por:

```html
<nav id="barra-cursos" role="tablist"></nav>
<section class="seccion" id="sec-curso">
  <div id="cabecera-curso"></div>
  <div class="seccion-header">
    <div class="filtros">
      <input type="text" id="filtro-texto-archivos" placeholder="Buscar por original o nombre...">
      <label><input type="checkbox" id="filtro-sin-regla"> Sólo sin regla</label>
      <label><input type="checkbox" id="filtro-solo-choques"> Sólo choques</label>
      <label><input type="checkbox" id="filtro-solo-copiar"> Sólo a copiar</label>
    </div>
  </div>
  <div id="temas-curso"></div>
</section>
```

Los cuatro ids de filtro **se conservan** (son los mismos de hoy).

### 1.2 Contrato del DOM (lo usa el Paso 3; no lo cambies)

- Botón de curso: `button.pestana-curso[data-curso="<clave_curso>"][role="tab"]`, con
  `aria-selected="true"` sólo en el activo. Dentro: `.pestana-nombre` (el nombre; `title` con el nombre entero),
  `.pestana-items` (archivos), `span.insignia-sin-regla` y `span.insignia-choques`, cada una con **sólo el
  número** como texto y el atributo `hidden` cuando es 0.
- Tema: `div.tema[data-tema="<tema>"]` con `div.tema-cabecera` (adentro `button.tema-toggle`, `.tema-nombre`,
  `.tema-items`, `select.tema-destino`, la marca de regla y `span.insignia-choques` con la misma regla de `hidden`)
  y `div.tema-archivos` con `hidden` cuando está plegado. **Plegado no es "sin dibujar"**: las filas de un tema
  plegado están en el DOM (las necesita `actualizarDestinosEnVivo`, y el humo las cuenta). **El `select` no va dentro de un `<summary>`**: en un
  `<details>` el click en el `select` pliega el bloque. Por eso es un `div` con botón.
- Filas de archivo: **mismos ids que hoy** (`fila-arch-`, `sel-acc-`, `inp-nom-`, `dup-badge-` + `clave`).
  `actualizarDestinosEnVivo` los busca así, con `CSS.escape`.
- `#curso-sin-archivos` para el curso vacío.

### 1.3 Estado nuevo (junto a `:473-477`)

`let CURSO_ACTIVO = null;` (una `clave_curso`) y `const TEMAS_ABIERTOS = new Map();` (clave `clave_curso\ttema`
→ `true`/`false`, sólo lo que el dueño tocó a mano; lo que no está usa la regla por defecto de E-e).

### 1.4 Funciones

- `renderizarTodo()` pasa a: `recalcularChoques(); elegirCursoInicial(); renderizarBarra(); renderizarCurso();`.
  `elegirCursoInicial` sólo actúa si `CURSO_ACTIVO` es `null` o ya no está en `DATOS.cursos` (regla E-c).
- `renderizarBarra()`: arma los botones (E-b). Click → `CURSO_ACTIVO = clave; renderizarBarra();
  renderizarCurso();`.
- `renderizarCurso()`: vacía `#cabecera-curso` y `#temas-curso` y dibuja el curso activo (E-d). **Mové** la
  lógica de cabecera de `renderizarCursos` (materia, docente, datalist, `actualizarDatalistYInfo`) a una función
  `renderizarCabeceraCurso(curso)`, sin cambiar sus eventos. **Extraé** el armado de una fila de archivo de
  `renderizarArchivos` (`:896-996`) a `crearFilaArchivo(arch, primeraFilaPorMd5)` que devuelve el `tr`, sin
  cambiar lo que hace salvo el escape de 1.6. Al final llama `actualizarDestinosEnVivo()` (hoy lo hace
  `renderizarArchivos`, `:1003`).
- Borrá `renderizarCursos`, `renderizarTemas` y `renderizarArchivos` una vez movido su contenido.
- Los cuatro filtros llaman `renderizarCurso` (hoy llaman `renderizarTemas` o `renderizarArchivos`,
  `:822` y `:1101-1103`).
- El `select.tema-destino` hace lo mismo que el `select` de destino de hoy (`:783-788`) y además
  `actualizarInsignias()`.

### 1.5 `actualizarInsignias()`

Recalcula, desde `DATOS` y `FILAS_CON_CHOQUE`, las insignias de **todos** los botones de la barra y de los temas
del curso activo que estén en el DOM (texto + `hidden`). Se llama **al final de `recalcularChoques()`** con un
guard `if (!document.getElementById("barra-cursos").children.length) return;` para la primera corrida (antes de
que exista la barra). `recalcularChoques` ya se llama en todos los eventos de edición: con eso E-f se cumple
sin tocar cada handler.

### 1.6 Escape

**Ningún dato va por `innerHTML`**. Curso, tema y `nombrePrimera` van por `textContent` (o `createElement` +
`textContent`). Los `innerHTML` que quedan sólo pueden tener texto fijo, sin `${…}`. Cierra el ⚪ de
`editor.html:955`.

### 1.7 Estilo

Reusá las variables de `:root` (y su bloque oscuro) y las clases de badge que ya existen (`badge-sin-regla`,
`badge-choque`). La barra: `display: flex; flex-wrap: wrap; gap`, botones con `var(--surface)` y borde
`var(--border)`, el activo con `var(--primary)`. La insignia de choques con `var(--danger)` y la de sin regla
con `var(--warning)`. El nombre del curso en la barra se corta con `text-overflow: ellipsis` a unos 220 px
(el de G22 tiene 63 caracteres). La cabecera de tema, una fila `display: flex` alineada con la tabla de abajo.

## Paso 2 — `docs/ramas-en-revision.md`

En el ítem **A-2**, agregá una línea: el editor muestra un curso a la vez con los archivos bajo su tema (plan
`docs/plan-classroom-destino-2a-editor-por-curso.md`), y antes de A-2 tanda verifica E-1..E-7 de ese plan con
Claude in Chrome.

## Paso 3 — `backend/adopcion/humo-editor.js` (nuevo)

Un script que **ejecuta el JS de la página** en `jsdom` (ya es devDependency, `package.json:20`) con los datos de
un JSON guardado de `api/datos`, y le pasa la ventana a un módulo de comprobaciones. Tanda lo probó hoy contra la
página actual (366 filas, 2 choques, 0 errores) y contra la de `cb01ab9` (**detecta** el 🔴 del `querySelector`:
`alert: Error al cargar datos: unknown pseudo-class selector …`). Copialo tal cual, con un comentario arriba que
diga para qué es:

```js
// Humo del editor de adopción: ejecuta el JS de editor.html en jsdom con /api/datos leído de un JSON
// guardado. Uso: node backend/adopcion/humo-editor.js <editor.html> <datos.json> [<comprobaciones.mjs>]
// Existe porque la verificación por curl nunca ejecutó el JS de la página (así pasó el 🔴 de 69a55e4).
import { JSDOM, VirtualConsole } from "jsdom";
import fs from "node:fs";
const html = fs.readFileSync(process.argv[2], "utf8");
const datos = fs.readFileSync(process.argv[3], "utf8");
const errores = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => errores.push(String(e.message || e)));
vc.on("error", (e) => errores.push(String(e)));
const dom = new JSDOM(html, {
  url: "http://127.0.0.1:3002/", runScripts: "dangerously", virtualConsole: vc,
  beforeParse(w) {
    w.fetch = async () => ({ ok: true, status: 200, json: async () => JSON.parse(datos) });
    w.alert = (m) => errores.push("alert: " + m);
    w.CSS = w.CSS || {};
    w.CSS.escape = (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c);
  },
});
await new Promise((r) => setTimeout(r, 300));
if (process.argv[4]) (await import(process.argv[4])).default(dom.window, errores);
console.log("errores:", errores.length);
for (const e of errores) console.log("  ", e);
process.exitCode = errores.length ? 1 : 0;
```

Tiene que pasar `pnpm run lint` (cae en el bloque `backend/**/*.js` de `eslint.config.js:130`). Si el lint pide
algo, ajustalo sin cambiar lo que hace y decilo en el informe.

## Verificación A (obra; pegá la salida literal)

obra trabaja sobre una **copia** de los TSV reales: no escribe en `~/Descargas/adopcion-classroom`.

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build   # 50/843, lint 0/0 (no hay tests nuevos)
H=backend/adopcion/editor.html
grep -nE 'innerHTML\s*\+?=\s*`[^`]*\$\{' $H; echo "(a) rc=$?"            # (a) sin líneas, rc=1
grep -cE 'sec-cursos|sec-archivos|tbody-cursos|lista-archivos|renderizarArchivos|renderizarTemas' $H   # (b) 0
grep -c 'CSS.escape' $H                                                  # (c) ≥ 3
T=~/Descargas/adopcion-sim/por-curso; rm -rf $T && mkdir -p $T && cp -a ~/Descargas/adopcion-classroom $T/tsv
bun backend/adopcion/editor.js --salida $T/tsv --puerto 3002 & PID=$!; sleep 1
curl -s localhost:3002/api/datos > $T/d.json; curl -s localhost:3002/ | head -c 15; echo   # (d) <!doctype html>
kill $PID
jq -c '[(.cursos|length),(.temas|length),(.archivos|length)]' $T/d.json   # (e) [7,45,366]
```

Después escribí `$T/comprobar.mjs` **tal cual** y corré el humo:

```js
// Comprobaciones de E-b..E-g sobre los datos reales de hoy (tabla de §Qué hace la página hoy).
const MC2 = "google-classroom:Nzc5NzY3MDQ1Nzg4";
const FIS1 = "google-classroom:NjY2OTgzODM0Mzc3";
const MC6 = "google-classroom:ODcxODM5OTg2NTgw";
const filas = (d) => d.querySelectorAll('tr[id^="fila-arch-"]').length;
const tab = (d, c) => d.querySelector(`button.pestana-curso[data-curso="${c}"]`);
const ins = (el, cls) => { const s = el.querySelector(cls); return s.hidden ? "0" : s.textContent.trim(); };
export default (w) => {
  const d = w.document;
  const out = [];
  out.push(["f pestañas", d.querySelectorAll("button.pestana-curso").length]);
  out.push(["g activo", d.querySelector('button.pestana-curso[aria-selected="true"]').dataset.curso === MC2]);
  out.push(["h filas MC2", filas(d)]);
  out.push(["i insignias MC2 choques/sinregla", ins(tab(d, MC2), ".insignia-choques") + "/" + ins(tab(d, MC2), ".insignia-sin-regla")]);
  out.push(["j insignia Fís I sinregla", ins(tab(d, FIS1), ".insignia-sin-regla")]);
  const nov = d.querySelector('div.tema[data-tema="Novedades"]');
  out.push(["k Novedades desplegado", !nov.querySelector(".tema-archivos").hidden]);
  // Renombrar una de las dos mc3.pdf deshace ese choque: 2 grupos → 1, MC2 7 → 5 filas.
  const inp = [...d.querySelectorAll('input[id^="inp-nom-"]')].find((i) => i.value === "mc3.pdf");
  inp.value = "mc3_otra.pdf"; inp.dispatchEvent(new w.Event("input"));
  out.push(["l choques global / MC2", d.getElementById("cnt-choques").textContent + " / " + ins(tab(d, MC2), ".insignia-choques")]);
  tab(d, FIS1).click();
  out.push(["m filas Fís I", filas(d)]);
  const adm = d.querySelector('div.tema[data-tema="Cuestiones administrativas"]');
  out.push(["n Cuestiones adm desplegado / otro plegado", !adm.querySelector(".tema-archivos").hidden + " / " +
    d.querySelectorAll("div.tema .tema-archivos:not([hidden])").length]);
  tab(d, MC6).click();
  out.push(["o MC6 filas / aviso", filas(d) + " / " + !!d.getElementById("curso-sin-archivos")]);
  tab(d, MC2).click();
  out.push(["p el renombre sobrevive", [...d.querySelectorAll('input[id^="inp-nom-"]')].some((i) => i.value === "mc3_otra.pdf")]);
  d.getElementById("filtro-solo-choques").checked = true;
  d.getElementById("filtro-solo-choques").dispatchEvent(new w.Event("change"));
  out.push(["q sólo choques en MC2: filas / temas visibles", filas(d) + " / " + d.querySelectorAll("div.tema").length]);
  for (const [k, v] of out) console.log(k + ":", v);
};
```

```bash
node backend/adopcion/humo-editor.js backend/adopcion/editor.html $T/d.json $T/comprobar.mjs; echo rc=$?
```

Esperado, línea por línea:

```
f pestañas: 7
g activo: true
h filas MC2: 25
i insignias MC2 choques/sinregla: 7/0
j insignia Fís I sinregla: 1
k Novedades desplegado: true
l choques global / MC2: 1 / 5
m filas Fís I: 130
n Cuestiones adm desplegado / otro plegado: true / 1
o MC6 filas / aviso: 0 / true
p el renombre sobrevive: true
q sólo choques en MC2: filas / temas visibles: 5 / 1
errores: 0
rc=0
```

(q) cuenta los temas que quedan en el DOM o visibles: si los temas ocultos por el filtro quedan en el DOM con
`hidden` en vez de no dibujarse, cambiá la cuenta a `div.tema:not([hidden])` **y decilo**. Si cualquier otra
línea no coincide, pegala y no la "arregles" cambiando la comprobación: el contrato es la tabla de arriba.

**Controles negativos obligatorios** (pegá la salida del humo, y revertí):
1. En `actualizarInsignias`, poné un `return;` en la primera línea. **(l) tiene que** dar `1 / 7`.
2. En `actualizarDestinosEnVivo`, sacá el `CSS.escape` de la búsqueda de `sel-acc-` (hoy `:1031`):
   `` tr.querySelector(`#sel-acc-${arch.clave}`) ``. El humo **tiene que** dar `errores: ≥1` con
   `pseudo-class` y `rc=1`.
3. En `elegirCursoInicial`, elegí siempre el primer curso. **(g) tiene que** dar `false`.

Si alguno pasa igual, reportalo y no sigas.

## Verificación B (tanda, con Claude in Chrome, modo suelto 3002 sobre una copia)

- **E-1.** La barra muestra los 7 cursos; MC2 activo con insignia de choques 7; Física I con sin regla 1; MC6 y
  Q5 atenuados.
- **E-2.** Desplegar/plegar un tema con el botón; el click en el `select` de destino **no** lo pliega.
- **E-3.** Cambiar el destino de un tema: el "destino en vivo" de sus filas cambia al instante.
- **E-4.** Renombrar una fila en choque: el contador global y las insignias bajan en vivo; el foco sigue en el
  `input` mientras se escribe.
- **E-5.** Cambiar de curso y volver: lo editado sigue ahí; el aviso "Cambios sin guardar" sigue visible.
- **E-6.** Guardar sobre la copia → `cmp` de los TSV contra la copia original muestra sólo lo editado; Probar
  muestra la salida del ensayo.
- **E-7.** Oscuro y claro legibles; consola sin errores.

Después, el dueño retoma **A-2** en el 3001 (🗂️ del popup).

## Hallazgos

Anotá lo que veas y no esté nombrado arriba. No lo arregles.
