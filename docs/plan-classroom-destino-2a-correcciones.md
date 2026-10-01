# Plan — Corte 2a, correcciones de `aplicar.js` tras la revisión

**Rama**: `classroom-destino-adopcion` (HEAD `f348ff6` + el commit de este plan). **Fecha**: 2026-09-27.
**Plan original**: `docs/plan-classroom-destino-2a-adopcion.md` (Paso 4). **Spec**: `docs/specs/classroom-destino/spec.md`.

## Qué encontró la revisión (tanda, 2026-09-27)

La compuerta está en verde (50/837, lint 0/0, tsc limpio, build OK) y el control negativo del `^`
de Parciales muerde. Se corrió `generar.js` + `aplicar.js` contra los **datos reales** en una copia
de scratch (lista de 366 del recorrido N-2, copia de `~/U.N.L.P/Ingenieria`). Los números cierran:
7 cursos, 366 ítems, `ya-esta` 55, `duplicado` 4, `omitir` 8, `copiar` 299, 2 choques reales; la
escritura copió 299, el índice parsea con 6 cursos y 358 archivos, `getfattr` vacío. Hay dos defectos:

1. 🔴 **Un reintento después de un corte falla** (el plan original, Paso 4.1, exigía lo contrario).
   Tras escribir, borrar el índice y correr de nuevo el ensayo con los mismos TSV da **303 errores**
   `es 'ya-esta' pero en archivos.tsv tiene accion='copiar'`. Causa: `aplicar.js:206-212` busca el md5
   en el árbol **antes** que nada, y el árbol ya contiene lo que copió la corrida cortada; la
   conversión "destino existe con el mismo md5 → `ya-esta`" (`aplicar.js:302-313`) nunca llega.
2. 🟡 **Renombrar la primera fila de un grupo `duplicado` bloquea la adopción.** Cambiar el `nombre`
   de la fila `copiar` del grupo de 5 de Física I da 4 errores `es 'duplicado' pero su nombre … difiere
   del esperado`, y el TSV dice que `duplicado` no se toca. Causa: `aplicar.js:228-247` compara la
   fila `duplicado` contra el TSV en vez de hacerla seguir a su primera fila. Además
   `aplicar.js:292-294` arma la ruta del `duplicado` con la materia **de su propio curso**: si la
   primera fila es de otro curso con otra materia, la ruta del índice queda mal (latente: hoy los dos
   grupos son de un solo curso).

## Paso 1 — Reintento: ignorar en el árbol lo que la propia adopción puso ahí

Archivo: `backend/adopcion/aplicar.js`.

- **Antes** del `for (const fila of datosArchivos.filas)` (línea 180), armar
  `const destinosPropios = new Set()` recorriendo `datosArchivos.filas` una vez: para cada fila con
  `accion === "copiar"`, cuyo curso (`mapCursos`) tenga `materia` no vacía y cuyo
  `mapTemas.get(`${clave_curso}\t${tema}`)` exista y no sea `"-"`, agregar
  `path.join(curso.materia, resolverCarpeta(destinoTema, curso.docente), fila.nombre)`.
  `path.join` normaliza el `"."` de la raíz, igual que `path.relative(opts.raiz, arch)` con el que se
  llena `mapMd5Arbol` (línea ~168): las dos formas son comparables tal cual.
- En `enMateria` (línea 206) agregar el filtro `.filter((r) => !destinosPropios.has(r))`.
- Nada más cambia: una fila `copiar` ya copiada sigue siendo `copiar`, llega a la conversión de la
  línea 302 y pasa a `ya-esta` con el mensaje `Información:` que ya existe. Un `duplicado` cuya
  primera fila ya se copió sigue siendo `duplicado` (su md5 ya no matchea en el árbol filtrado y sí
  en `vistosMd5`).
- Un archivo **ajeno** que casualmente esté en un destino `copiar` con el mismo md5 no rompe nada:
  generar lo habría marcado `ya-esta`; si el dueño movió el destino hasta ahí, cae en la misma
  conversión de la línea 302.

## Paso 2 — `duplicado` sigue a su primera fila

Archivo: `backend/adopcion/aplicar.js`. Decisión (tanda): un `duplicado` **hereda todo** de la
primera fila de su md5 tal como quedó procesada — `accion` final, `carpeta`, `nombre` y
`rutaDestinoRel`. Si la primera terminó `omitir`, el duplicado también es `omitir` (no entra al
índice, 2b lo ofrece de nuevo, RN-10). Si terminó `copiar` o `ya-esta`, el duplicado entra al índice
como `duplicado` apuntando al mismo archivo (PA-2).

- `vistosMd5` (línea 178, `set` en la 318) pasa a guardar **el `itemProcesado` de la primera fila**,
  no `{ carpeta, nombre }`. Mover el `set` a después de construir `itemProcesado` (línea 321).
- En el bloque de validación (línea 228): para `accionEsperada === "ya-esta"` queda igual. Para
  `accionEsperada === "duplicado"` sólo se valida `fila.accion === "duplicado"`; **no** se comparan
  `carpeta` ni `nombre`.
- Para una fila con `accionEsperada === "duplicado"`, saltear el recálculo de carpeta, la validación
  de nombre, el chequeo "destino ya existe" y el cálculo de `rutaDestinoRel` de las líneas 250-314, y
  construir el `itemProcesado` así:
  `{ ...fila, accion: primera.accion === "omitir" ? "omitir" : "duplicado", carpeta: primera.carpeta, nombre: primera.nombre, rutaDestinoRel: primera.rutaDestinoRel }`.
  Si queda más cómodo, un `continue` temprano tras hacer el `push` a `filasProcesadas`. No entra a
  `filasParaChoques` (no entraba antes).
- La rama `// ya-esta o duplicado` de la línea 292 queda sólo para `ya-esta`.
- **Radio de impacto**: el armado del índice (líneas ~432-444) lee `f.nombre` y `f.rutaDestinoRel` de
  `filasProcesadas`: con este paso el `duplicado` escribe el nombre y la ruta de su primera fila, que
  es lo que pide PA-2. Las estadísticas (líneas ~345-350) cuentan por `f.accion`: un duplicado de
  una fila omitida se cuenta en `omitidos`.
- `generar.js` no cambia de lógica. Sí cambia el comentario de `archivos.tsv` (línea 235):
  `# - 'ya-esta' no se modifica. 'duplicado' sigue a la primera fila con su md5: si a esa le cambiás nombre o acción, el duplicado la acompaña.`

## Paso 3 — Docs

- `docs/ramas-en-revision.md`, checklist **A-1**: los números esperados pasan a
  `366 ítems en 5 carpetas; ya-esta 55; duplicado 4; omitir 8; copiar 299; 7 cursos; 2 choques (MC2, Novedades: 7 filas con copias "(N)" de distinto md5)`.
  El `duplicado 5` del plan original contaba dos filas que en realidad son `ya-esta` (mismo archivo
  ya en `Teorias/Bianchi`); el orden `ya-esta` antes que `duplicado` es el del plan y es correcto.
- Agregar a **A-2**: `Renombrar las 7 filas de los 2 choques (si no, aplicar se niega).`
- `docs/testing.md`: sin cambios (este plan no agrega tests; `backend/adopcion/` no tiene suite).

## Verificación A (obra; pegar la salida literal)

Fixtures ya preparados por tanda en `~/Descargas/adopcion-sim/` (fuera del repo, llevan nombres
personales): `tsv-ok` (los TSV reales con los choques renombrados), `tsv-dup` (además, la primera
fila del grupo de 5 renombrada a `lab3_template.docx`) y `tsv-omit` (esa misma fila pasada a
`omitir`). Sus `origen` apuntan a `~/Descargas/verificacion-b`, que existe.

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build
SB=~/Descargas/adopcion-sim/raiz
rm -rf "$SB" && mkdir -p "$SB" && cp -a ~/U.N.L.P/Ingenieria ~/U.N.L.P/.gitignore "$SB"/
T=~/Descargas/adopcion-sim
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-ok   | tail -7   # (a) copiar 299, ya-esta 55, dup 4, omit 8
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-dup  | tail -7   # (b) igual que (a), sin errores
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-omit | tail -7   # (c) copiar 298, ya-esta 55, dup 0, omit 13
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-dup --escribir | tail -7   # (d) 299 copiados
bun -e 'import {parsearIndice} from "./core/destino/indice.ts"; const r=parsearIndice(await Bun.file(process.env.HOME+"/Descargas/adopcion-sim/raiz/.course-downloader.json").text()); const a=Object.values(r.indice.archivos); console.log(r.ok, a.length, a.filter(x=>x.nombre==="lab3_template.docx").length)'   # (e) true 358 5
rm "$SB/.course-downloader.json"
P=$(awk -F'\t' '$4=="copiar"{print $2"\t"$5"\t"$6; exit}' $T/tsv-dup/archivos.tsv)   # curso, carpeta, nombre de la 1ª fila copiar
M=$(grep -P "^$(cut -f1 <<<"$P")\t" $T/tsv-dup/cursos.tsv | cut -f4)   # materia de ese curso
rm "$SB/$M/$(cut -f2 <<<"$P")/$(cut -f3 <<<"$P")"   # simula el corte: falta un archivo
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-dup | tail -7   # (f) copiar 1, ya-esta 353, dup 4, omit 8, sin errores
bun backend/adopcion/aplicar.js --raiz "$SB" --salida $T/tsv-dup --escribir | tail -7   # (g) 1 copiado, índice escrito
grep -c '^\.course-downloader\.json$' "$SB/.gitignore"   # (h) 1 (no se duplicó la línea)
rm -rf "$SB"
```

`(f)` imprime además 298 líneas `Información: … pasa a 'ya-esta'`: filtrarlas con `grep -c Información`
y pegar el número, no las líneas.

**Control negativo obligatorio**: comentar el `.filter((r) => !destinosPropios.has(r))` del Paso 1,
repetir desde `rm "$SB/.course-downloader.json"` hasta `(f)` sobre una raíz recién escrita: **tiene
que** dar errores `es 'ya-esta' pero … accion='copiar'`. Pegar el conteo (`grep -c "No se puede"`).
Revertir. Si no falla, reportarlo y no seguir.

obra **no** toca `~/U.N.L.P` ni corre nada con `--escribir` fuera de `~/Descargas/adopcion-sim/raiz`.

## Verificación B

Sin cambios: A-1..A-4 de `docs/ramas-en-revision.md` con los números del Paso 3.
