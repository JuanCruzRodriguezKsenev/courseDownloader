# Plan — Corte 2a: en Novedades, los archivos que chocan se nombran con la primera frase del anuncio

**Rama**: `classroom-destino-adopcion` (sobre `4244f50` + el commit de este plan). **Fecha**: 2026-09-27.
**Spec**: `docs/specs/classroom-destino/spec.md`, **RN-11**, **RN-12**, **RN-16** y **RN-16a** (nuevo, lo agrega
el Paso 6). Ningún `AC-n` cubre esto; la verificación está abajo.

## Por qué

En A-2 el dueño no entendía los 2 choques de MC2 → Novedades. Son 7 archivos:

- 5 PDF "MC2- 2025- 2do cuatrimestre - MC2.pdf", "… (1)", … "(4)". `proponerNombre` les saca el "(N)" y los 5
  quedan como `mc2_2025_2do_cuatrimestre_mc2.pdf`.
- "MC3_2023.pdf" y "MC3_2023 (1).pdf": quedan los dos como `mc3.pdf`.

Tienen md5 distintos. Lo que los distingue está en el **texto del anuncio**, y el scraper no lo guarda. En
Novedades, `material` y `publicacion` valen "Publicación de <autor>" en los **45 de 45** ítems del storage
actual de Brave. Eso pasa porque `scraper.js:789-790` lee el primer `h2`/`[role="heading"]` del post, y en
Novedades ese encabezado es el de accesibilidad, no un título.

**Decisión del dueño (2026-09-27):** sólo los archivos de Novedades que **chocan** cambian de nombre, y el nombre
nuevo sale de la **primera frase del anuncio**, que **reemplaza** al nombre (no se le agrega). Los que no chocan
quedan como hoy: en 37 de los 45 el nombre del archivo ya es bueno (`resumen_guia12.pdf`, `resultado_flotante.pdf`).

**Decidido por tanda** (con evidencia):

- **El texto va en un campo nuevo, `anuncio`, y no pisa `publicacion` ni `material`.** Hay tres motivos.
  `material` arma los títulos de los accesos `.md` (`scraper.js:458`) y los nombres repetidos (D12,
  `:890-903`), y `generar.js:132` busca cada archivo en disco por `sanitizarNombreArchivo(item.titulo)`: si
  cambia el título, `generar` no encuentra el archivo ya bajado. Además, una lista vieja, sin el campo,
  tiene que dar **byte a byte** los TSV de hoy (Verificación A (c)).
- **Dónde está el texto** (medido en las 8 muestras `docs/muestras/google-classroom/recorrido-3/*-novedades.html`,
  36 de 36 posts con adjuntos): en el **hermano anterior** (`previousElementSibling`) del elemento
  `[data-include-stream-item-materials="true"]` del post. Es un atributo de datos y no una clase ofuscada, como
  pide D7 (`docs/portal-google-classroom-diseno.md:147-148`). El texto viene en `span` con `<br>`, `ul`/`li` y `b`.
- **Qué es la "primera frase".** La primera línea del anuncio es muchas veces un saludo ("Buenos días,",
  "Estimados/as,", "Hola!!"), seguido de una muletilla ("les dejamos", "adjunto a este mensaje"). Por eso se
  sacan el saludo, la muletilla y el artículo inicial, se corta en el primer salto de línea o fin de oración, y
  se toman hasta 8 palabras. Los resultados esperados de la tabla del Paso 1 salen de un modelo de la regla
  corrido sobre los textos reales.
- **Si dos archivos del mismo anuncio siguen chocando** (MC3: un anuncio con los dos adjuntos), el que tiene
  "(N)" en el título original lleva `_N`. Lo que choque después de eso queda como choque para el dueño.
- **Sólo filas de Novedades con acción `copiar`.** En Trabajo hoy no hay choques; RN-16 para Trabajo sigue sin
  implementar en `generar` (se reporta, como hoy).

## Qué hacen hoy las piezas que se tocan

- `core/destino/nombres.ts:34-104`, `proponerNombre({ original, tema, docente })`: saca la extensión, las
  extensiones internas, el prefijo `<docente> -`, la copia `(N)` final (paso 4, `:53`) y el año final. Después
  toma el número de orden `NN`, arma el slug con `sanearNombreCarpeta` (`core/util/texto.ts:97-105`:
  minúsculas, sin tildes, todo lo que no es `[a-z0-9]` → `_`), le agrega `modN` si viene del tema y devuelve
  `[modN, NN, slug].join("_") + ext`.
- `core/destino/choques.ts:14-41`, `buscarChoques(filas)`: agrupa por `ruta/nombre` (en minúsculas) y devuelve
  los grupos con **más de un md5**. Las filas del grupo son **las mismas referencias** que entraron.
- `sitio/google-classroom/scraper.js`:
  - `:776-779` toma los posts externos de Novedades (`[data-stream-item-id]` sin ancestro con ese atributo;
    el bloque de materiales **también** lleva `data-stream-item-id` y queda afuera por eso).
  - `:789-790` `material` = texto del heading, o `"Novedad"`.
  - `:807-814` empuja cada adjunto de Novedades con `{ ...clasif, tema, material, vista: "novedades" }`.
  - `:926-936` arma `enlaces`: `texto`, `href`, `modulo`, `publicacion: item.material`, `tipo`, `idArchivo`.
- `core/puertos/sitio.ts:112-116`: `publicacion?: string` en `EnlaceListado`, con su comentario.
- `popup.js:1268-1306`, `aplicarEnlacesEscaneados`: arma el ítem de la lista con una **lista fija de campos**
  (`:1300-1301` `bytes` y `publicacion`). Un campo nuevo del enlace **no llega** a `listaPersistente` si no se
  agrega acá.
- `backend/adopcion/generar.js`:
  - `:252-316` una sola vuelta por ítem que decide `accion`/`carpeta`/`nombre`, **escribe la línea** de
    `archivos.tsv` en el momento (`:302-304`) y junta `filasParaChoques` (sólo `copiar` y `ya-esta`, con
    `ruta = materia/carpeta`).
  - `:278-283` un `duplicado` copia `carpeta` y `nombre` de la primera fila con su md5 (`vistosMd5`, que
    guarda `{ carpeta, nombre }` **por valor**).
  - `:319-345` resumen; los choques se calculan sobre los nombres ya escritos.
- `sitio/google-classroom/__fixtures__/curso.html`, `#vista-novedades`: el post `post-nov-1` tiene
  `<h2>Aviso de Parcial</h2>` y dos `div[data-attachment-id]` sueltos (`Cronograma.pdf` y el duplicado de
  `Introduccion.pdf`). **No tiene la forma del DOM real**: no hay bloque de materiales ni cuerpo.

## Paso 1 — `primeraFrase` en `core/destino/nombres.ts` (RN-16a)

Exportá `primeraFrase(texto?: string | null): string`, arriba de `proponerNombre`, con un comentario que cite
RN-16a. Devuelve la frase **sin slug** (el slug lo hace `proponerNombre`). En orden:

1. `t = (texto || "").trim()`.
2. Sacá los saludos del principio, repetidos, con esta regex (flags `iu`):
   `/^(?:(?:hola+|buen(?:os|as)?\s+(?:d[ií]as?|tardes|noches)|buenas|buen\s+d[ií]a|estimad[oa]s?(?:\/[oa]s)?|querid[oa]s?(?:\/[oa]s)?)(?:\s+a\s+todos(?:\/as)?)?[\s,;:!¡.]*)+/iu`
3. Sacá **una** muletilla del principio (flags `iu`):
   `/^(?:les\s+(?:dejamos|dejo|compartimos|comparto|adjunto|adjuntamos)\s+|adjunto\s+(?:a\s+este\s+mensaje\s+)?|en\s+el\s+archivo\s+adjunto,?\s+(?:encontrar[aá]n\s+)?)/iu`
4. Sacá **un** artículo del principio: `/^(?:las|los|la|el|un|una|unos|unas)\s+/iu`.
5. Cortá en el primer `\n` o en el primer `.`, `!` o `?` seguido de espacio o fin: `t.search(/\n|[.!?](?=\s|$)/)`.
6. Devolvé las primeras 8 palabras: `t.trim().split(/\s+/).filter(Boolean).slice(0, 8).join(" ")`.

**Tests**, en `core/destino/nombres.test.ts`, un `describe("primeraFrase (RN-16a)")` con un `it.each` de estos
10 casos. Los textos son de los anuncios reales (`recorrido-3/04-MC2 2025-novedades.html` y otros); el `\n` es
un salto de línea:

| # | Entrada | Esperado |
|---|---|---|
| 1 | `"Hola, les comparto las notas del Primer Parcial MOD I.\nLos que estan con verde y tienen nota es porque el mod1 ya lo aprobaron."` | `"notas del Primer Parcial MOD I"` |
| 2 | `"Hola, les compartimos las notas del recuperatorio del Primer módulo.\nComo les comente hoy en clase, varies tienen dudoso."` | `"notas del recuperatorio del Primer módulo"` |
| 3 | `"Hola, les compartimos las notas del parcial y lo que les queda del módulo 1 aún"` | `"notas del parcial y lo que les queda"` |
| 4 | `"Hola, les compartimos las notas del recuperatorio y para les que ya aprobaron la materia las notas finales.\nIMPORTANTE:"` | `"notas del recuperatorio y para les que ya"` |
| 5 | `"Buenos días,\nles dejamos las notas finales de la materia. Cualquier cosa me escriben."` | `"notas finales de la materia"` |
| 6 | `"Múltiple choice para practicar"` | `"Múltiple choice para practicar"` |
| 7 | `"Buenas tardes a todos/as,\nLes compartimos los ejercicios resueltos P11 y P13 de la guía 4."` | `"ejercicios resueltos P11 y P13 de la guía"` |
| 8 | `"Buenos días,\nAdjunto a este mensaje los resultados del Flotante. Mostraremos los parciales mañana."` | `"resultados del Flotante"` |
| 9 | `"Buenos días,"` | `""` |
| 10 | `""` | `""` |

**Radio de impacto**: función nueva; `proponerNombre` no cambia. La consumen sólo el Paso 2 y sus tests.

## Paso 2 — `renombrarChoquesNovedades` en `core/destino/choques.ts` (RN-16a)

Agregá, sin tocar `buscarChoques` ni sus tipos:

```ts
export interface FilaNovedad extends FilaChoque {
  renombrable: boolean; // accion === "copiar" && tema === "Novedades"
  original: string;     // título crudo del ítem (item.titulo)
  anuncio?: string;
  tema?: string;
  docente?: string;
}
export function renombrarChoquesNovedades(filas: FilaNovedad[]): Map<string, string> // clave → nombre nuevo
```

1. `grupos = buscarChoques(filas)`. En cada grupo, a cada fila con `renombrable` y
   `frase = primeraFrase(anuncio)` no vacía: `ext` = la extensión de `fila.nombre`
   (`/\.[a-z0-9]{1,5}$/i`, o `""`), y
   `nuevo = proponerNombre({ original: frase + ext, tema, docente })`. Guardalo en el `Map` por `clave`. Las filas
   que no son renombrables, o que tienen la frase vacía, no entran al `Map`.
2. **Residuo:** armá la lista de filas con `nombre = map.get(clave) ?? nombre` y volvé a llamar `buscarChoques`.
   En cada grupo que siga chocando, a cada fila **que esté en el `Map`** y cuyo `original` termine en `(N)`
   (`/\((\d+)\)\s*(?:\.[A-Za-z0-9]{1,5})?$/`), cambiale el nombre del `Map` por el mismo con `_N` antes de la
   extensión.
3. Devolvé el `Map`. **No** resuelvas lo que siga chocando: lo reporta `buscarChoques` en `generar` y lo ve el
   dueño en el editor.

Comentario de dos líneas arriba que cite RN-16a y el caso de MC2/MC3.

**Tests**, en `core/destino/choques.test.ts`, un `describe("renombrarChoquesNovedades (RN-16a)")`. Ruta
`"Ingenieria/Matematica C"`, tema `"Novedades"`, docente `"Rey Grange"`, `renombrable: true` salvo donde se diga:

- **C1. MC2.** 5 filas con `nombre: "mc2_2025_2do_cuatrimestre_mc2.pdf"`, md5 distintos, `original`
  `"MC2- 2025- 2do cuatrimestre - MC2.pdf"`, `"… - MC2 (1).pdf"` … `"… - MC2 (4).pdf"`, y como `anuncio` las
  entradas 1–5 de la tabla del Paso 1, en ese orden. Esperado, por clave: `notas_del_primer_parcial_mod_i.pdf`,
  `notas_del_recuperatorio_del_primer_modulo.pdf`, `notas_del_parcial_y_lo_que_les_queda.pdf`,
  `notas_del_recuperatorio_y_para_les_que_ya.pdf`, `notas_finales_de_la_materia.pdf`. El `Map` tiene 5 entradas.
- **C2. MC3, mismo anuncio.** 2 filas con `nombre: "mc3.pdf"`, `original` `"MC3_2023 (1).pdf"` y `"MC3_2023.pdf"`,
  las dos con `anuncio: "Múltiple choice para practicar"`. Esperado: `multiple_choice_para_practicar_1.pdf` y
  `multiple_choice_para_practicar.pdf`.
- **C3. `ya-esta` no se toca.** Una fila `renombrable: false` y una `renombrable: true` con anuncio, mismo
  nombre y md5 distintos. El `Map` tiene **sólo** la segunda.
- **C4. Frase vacía.** 2 filas que chocan, una con `anuncio: "Buenos días,"` y otra sin `anuncio`. El `Map` está
  vacío.
- **C5. Sin choque no se renombra.** 2 filas con nombres distintos y anuncio. El `Map` está vacío.

**Radio de impacto**: `buscarChoques` no cambia. La nueva función la llama sólo `generar.js` (Paso 5).
`choques.ts` pasa a importar `./nombres`, que sólo importa `../util/texto`: no hay ciclo.

## Paso 3 — Scraper: el enlace de Novedades lleva `anuncio`

1. En `sitio/google-classroom/scraper.js`, en el mismo alcance que `clasificarAdjunto` (`:429`), agregá
   `textoDelAnuncio(post)`:
   - `materiales = post.querySelector('[data-include-stream-item-materials="true"]')`;
     `cuerpo = materiales ? materiales.previousElementSibling : null`. Sin `cuerpo`, devolvé `""`.
   - Recorré los nodos de `cuerpo`. Un nodo de texto suma su `nodeValue`. Un elemento `DIV`, `P`, `LI`, `UL`,
     `OL` o `BR` suma un `"\n"` antes y otro después de su contenido. **No uses `innerText`**: jsdom no lo
     implementa y el test daría `undefined`.
   - Partí por `"\n"`, colapsá los espacios de cada línea (`/\s+/g` → `" "`, que también cubre `&nbsp;`),
     `trim`, descartá las vacías, uní con `"\n"` y cortá a 500 caracteres.
   - Comentario de dos líneas: por qué no el heading (es "Publicación de <autor>") y dónde se midió.
2. En el bucle de Novedades (`:781`), calculá `const anuncio = textoDelAnuncio(post);` una vez por post, y
   agregá `anuncio` al objeto de `:809-814`. **No** cambies `material`.
3. En `enlaces` (`:926-936`), después de `publicacion`, agregá `anuncio: item.anuncio,`. Los ítems de Trabajo
   no lo tienen y queda `undefined`.
4. `core/puertos/sitio.ts`, en `EnlaceListado`, después de `publicacion`: `anuncio?: string;` con un comentario
   que diga que es el texto del anuncio de Novedades (Classroom), hasta 500 caracteres, y que nombra el archivo
   cuando choca (RN-16a).
5. **Fixture.** En `sitio/google-classroom/__fixtures__/curso.html`, dale a `post-nov-1` la forma del DOM
   real **sin cambiar sus adjuntos** (mismos `data-attachment-id`, mismas anclas, mismo `h2`):
   ```html
   <div data-stream-item-id="post-nov-1">
     <div><h2>Aviso de Parcial</h2></div>
     <div>
       <div><div><span>Buenos días,<br>les dejamos el cronograma del parcial.<br>Saludos</span></div></div>
       <div data-include-stream-item-materials="true" data-stream-item-id="post-nov-1">
         <!-- los dos div[data-attachment-id] de hoy, sin cambios, con su comentario -->
       </div>
     </div>
   </div>
   ```
6. **Test** `5c` en `sitio/google-classroom/scraper.test.js`, después del `5b` (`:170`): el enlace con
   `texto === "Cronograma.pdf"` trae
   `anuncio === "Buenos días,\nles dejamos el cronograma del parcial.\nSaludos"` y `publicacion === "Aviso de Parcial"`;
   el de `"TP1.pdf"` trae `anuncio === undefined`.

**Radio de impacto**:

- El bloque de materiales del fixture lleva `data-stream-item-id`, como el real. `:778` lo deja afuera de los
  posts. `:386` cuenta **todos** los `[data-stream-item-id]` para ver si la vista está estable: la cuenta sube
  en uno y queda fija, y eso no cambia la estabilidad. Los adjuntos del fixture no cambian: ningún conteo de
  enlaces de los tests se mueve.
- Los tests que reemplazan `#vista-novedades` entero (`:727-728`, `:1177-1178`) no dependen de `post-nov-1`.
- Si un test existente cae por el cambio de fixture, **no** lo "arregles": pegá la salida y parate.

## Paso 4 — `popup.js`: el ítem de la lista conserva `anuncio`

En `aplicarEnlacesEscaneados`, después de `publicacion: item.publicacion,` (`popup.js:1301`), agregá
`anuncio: item.anuncio,` con el comentario de una línea
`// [CORTE 2a] Texto del anuncio (Novedades de Classroom): nombra el archivo si choca, RN-16a.`

## Paso 5 — `backend/adopcion/generar.js`: renombrar los choques de Novedades

1. Importá `renombrarChoquesNovedades` desde `../../core/destino/choques.ts`, junto a `buscarChoques` (`:10`).
2. En la vuelta de `:252-316`, **no** escribas la línea en el momento: armá un objeto `fila` por ítem con
   `{ clave, cKey, tema, accion, carpeta, nombre, titulo: item.titulo, origen, md5, anuncio: item.anuncio,
   docente: sem.docente, rutaChoque, primera: null }`, donde `rutaChoque` es la de hoy (`:307`). Guardalo en un
   array `filas`.
   - `vistosMd5` pasa a guardar **la `fila`** (el objeto), no `{ carpeta, nombre }`.
   - Un `duplicado` toma `carpeta` de `vistosMd5.get(md5).carpeta` como hoy, y además guarda
     `fila.primera = vistosMd5.get(md5)`.
   - `conteoPorAccion` se sigue contando igual.
3. Después de la vuelta:
   - `renombres = renombrarChoquesNovedades(...)`, con las filas `copiar` y `ya-esta` mapeadas a
     `{ clave, ruta: rutaChoque, nombre, md5, renombrable: accion === "copiar" && tema === "Novedades",
     original: titulo, anuncio, tema, docente }`.
   - A cada fila con `renombres.has(clave)`, poné `nombre = renombres.get(clave)`.
   - A cada `duplicado`, poné `nombre = fila.primera.nombre`: si su primera fila se renombró, la acompaña (es la
     semántica de la cabecera de `archivos.tsv`, `:243`).
   - Escribí las líneas de `archivos.tsv` en el mismo orden y con el mismo formato que hoy (`:302-304`), y armá
     `filasParaChoques` con los nombres finales.
4. En el resumen, **antes** de `Choques detectados`, agregá:
   - `console.log("Renombrados por la frase del anuncio (RN-16a):", renombres.size)`
   - `console.log("Ítems de Novedades sin anuncio:", n)`, con `n` = ítems con tema `Novedades` y `anuncio`
     vacío o ausente.

**Radio de impacto**: `aplicar.js` y el editor leen `archivos.tsv` y no cambian: el formato es el mismo. Con
una lista vieja (sin `anuncio`), `renombres` queda vacío y los TSV salen **idénticos** a los de hoy
(Verificación A (c)).

## Paso 6 — Docs

- `docs/specs/classroom-destino/spec.md`, después de RN-16 (`:99-101`), agregá **RN-16a** (dueño, 2026-09-27):
  en Novedades el encabezado del post es "Publicación de <autor>", así que el título del material es la
  **primera frase del anuncio** (sin saludo, muletilla ni artículo, hasta 8 palabras). En la adopción, un
  archivo de Novedades que choca **se nombra** con esa frase en vez de agregarla. Si dos del mismo anuncio siguen
  chocando, el que tiene "(N)" lleva `_N`. Lo que choque después queda para el dueño.
  **Contrastalo** con RN-16 (`:99-101`), que dice "llevan `_<título del material>`": RN-16a es la excepción de
  Novedades y RN-16 no cambia. Contrastalo también con la fila A6 (`:196`) y agregale "(en Novedades, RN-16a)".
- `docs/ramas-en-revision.md`, en **A-2** (`:32-34`), antes del ítem del editor: agregá **A-1c**. El dueño hace
  build, recarga la extensión y corre "Escanear todos los cursos" desde la portada, sin escanear nada después.
  Después, tanda regenera los TSV y re-aplica los docentes. Los números esperados están en la Verificación B de
  este plan: citalo por ruta.
- `docs/testing.md` §Baseline: el nuevo total de tests, con un párrafo "De dónde sale" como el de `:38`
  (+10 de `primeraFrase`, +5 de `renombrarChoquesNovedades`, +1 del scraper).

## Verificación A (obra; pegá la salida literal)

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build   # 50 archivos / 859 tests (843 + 16), lint 0/0
grep -c 'anuncio' sitio/google-classroom/scraper.js popup.js core/puertos/sitio.ts backend/adopcion/generar.js   # (a) ≥1 en cada uno
grep -n 'innerText' sitio/google-classroom/scraper.js; echo "(b) rc=$?"   # (b) sin líneas, rc=1
S=~/Descargas/adopcion-sim/anuncio; R=~/Descargas/adopcion-classroom; rm -rf $S; mkdir -p $S
bun backend/adopcion/generar.js --salida $S 2>&1 | tail -8   # (c1) Renombrados … 0; Ítems de Novedades sin anuncio: 45; Choques detectados: 2
cmp $S/archivos.tsv $R/archivos.tsv && cmp $S/temas.tsv $R/temas.tsv && echo "(c2) idénticos"   # (c2) idénticos
diff $S/cursos.tsv $R/cursos.tsv | grep -c '^>'                          # (c3) 2: sólo los docentes Lucila y benevetano
```

(c) corre sobre el storage **actual**, que no tiene `anuncio`: prueba que una lista vieja da los TSV de hoy. Los
reales difieren de los regenerados **sólo** en los dos docentes que guardó el dueño (medido por tanda el
2026-09-27 con el `generar.js` de `4244f50`).

Si 843 no es la base actual, pegá la cuenta de `main`/HEAD antes del cambio y la de después: la diferencia
tiene que ser 16. **No** escribas en `~/Descargas/adopcion-classroom`: tiene docentes que guardó el dueño.

**Controles negativos obligatorios** (pegá la salida del test que cae, y revertí):
1. En `primeraFrase`, sacá el paso 3 (muletilla). **El caso 5** de la tabla **tiene que** caer.
2. En `renombrarChoquesNovedades`, sacá el paso 2 (residuo). **C2 tiene que** caer.
3. En `textoDelAnuncio`, cambiá `previousElementSibling` por `nextElementSibling`. **El test 5c tiene que** caer.

Si alguno pasa igual, reportalo y no sigas.

## Verificación B (dueño + tanda)

- **B-1.** Dueño: `pnpm run build` → recargar la extensión en Brave → portada de Classroom al frente →
  "Escanear todos los cursos" (≈3 min) → no escanear nada más.
- **B-2.** Tanda, primero en scratch: `bun backend/adopcion/generar.js --salida <scratch>`. Esperado:
  - 366 ítems, 55/4/8/299 (o los números nuevos si Classroom cambió: se pegan y se contrastan).
  - `Renombrados por la frase del anuncio (RN-16a): 7`, `Choques detectados: 0`.
  - `Ítems de Novedades sin anuncio` cerca de 0; se pegan los que queden, con su curso.
  - En `archivos.tsv`, MC2 → Novedades: los 5 nombres de C1 y los 2 de C2, cada uno en la fila de su original.
  - `diff` contra `~/Descargas/adopcion-classroom/archivos.tsv`: sólo cambia la columna `nombre` de esas 7 filas.
- **B-3.** Tanda: copia de respaldo de los tres TSV reales → `generar.js` sobre `~/Descargas/adopcion-classroom`
  → re-aplicar `docente` desde el respaldo por `clave_curso` (hoy Física I = `Lucila`, MB5 = `benevetano`; son
  las únicas diferencias entre los TSV reales y los regenerados, medido 2026-09-27) → `diff` del respaldo
  contra el nuevo: sólo las 7 filas de B-2.
- **B-4.** Dueño: recargar el editor (🗂️). La insignia de choques de MC2 no aparece y el contador global dice 0.
  Sigue A-2.

## No entra

- Los accesos `.md` de Novedades se siguen llamando `publicacion_de_<autor>_<host>.md`, porque el título sale
  de `material` (`scraper.js:458`). Cambiarlo cambia `item.titulo`, y `generar.js:132` busca el archivo en
  disco por ese título. Queda como deuda.
- D12 del scraper (`:890-903`, nombres repetidos en la descarga) sigue usando `material`.
- RN-16 para Trabajo en `generar` (hoy 0 choques en Trabajo).

## Hallazgos

Anotá lo que veas y no esté nombrado arriba. No lo arregles.
