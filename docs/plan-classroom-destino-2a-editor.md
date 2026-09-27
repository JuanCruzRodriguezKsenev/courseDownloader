# Plan — Corte 2a, editor web de los TSV de adopción

**Rama**: `classroom-destino-adopcion` (HEAD `1f374e4` + el commit de este plan). **Fecha**: 2026-09-27.
**Plan del corte**: `docs/plan-classroom-destino-2a-adopcion.md`. **Spec**: `docs/specs/classroom-destino/spec.md`.

## Por qué

A-1 dio los números esperados (366 / ya-esta 55 / dup 4 / omit 8 / copiar 299 / 2 choques). En A-2 el dueño
abrió los TSV y no se pueden editar a mano: 9 columnas, claves en base64 y md5 en cada fila. Decisión (tanda,
delegada por el dueño): **una página local servida por Bun que edita los tres TSV**. No toca la extensión ni
`aplicar.js`/`generar.js`, y se usa una sola vez, igual que la adopción. La pantalla de verdad, dentro de la
extensión, sigue siendo el corte 2c.

## Qué hacen hoy las piezas que se reusan (no cambian)

- `generar.js` escribe `cursos.tsv`, `temas.tsv` y `archivos.tsv` en `--salida` (default
  `~/Descargas/adopcion-classroom`). Cada archivo arranca con líneas `#` de comentario y una cabecera, y
  **pisa los TSV sin avisar** si se lo corre de nuevo (líneas 178, 201, 229, 308).
  - `cursos.tsv`: `clave_curso nombre carpeta materia docente items`
  - `temas.tsv`: `clave_curso tema destino regla items`
  - `archivos.tsv`: `clave clave_curso tema accion carpeta nombre original origen md5`
- `aplicar.js` lee los TSV con `parsearTsv` (líneas 31-58): descarta las líneas vacías y las `#`, y hace
  **trim** de cada valor. En ensayo (sin `--escribir`) no escribe nada. Los errores de validación los manda
  por **stderr** y sale con `process.exit(1)`; el resumen va por stdout. Por eso el editor lo corre como
  **subproceso**: llamarlo en el mismo proceso lo mataría.
- `core/destino/carpetas.ts`: `DESTINOS` (`.`, `Teorias`, `Practicas`, `Laboratorios`, `Parciales`,
  `Finales`, `Bibliografia`) y `resolverCarpeta(destino, docente)`, que da `Teorias/<docente>` si hay
  docente y `destino` si no. Bun importa `.ts` directo (ya lo hace `aplicar.js`).
- `backend/utils.js`: `sanitizarNombreArchivo(nombre)`. `aplicar` rechaza un `nombre` de fila `copiar` que
  no sea igual a su sanitizado (línea ~300).
- Semántica de edición (comentarios de los TSV + Paso 2 de `plan-classroom-destino-2a-correcciones.md`):
  - En cursos se editan `materia` y `docente`; en temas, `destino` (uno de `DESTINOS` o `-`).
  - En archivos se editan `nombre` y `accion`, esta última sólo `copiar`↔`omitir`.
  - `ya-esta` y `duplicado` no se tocan: el `duplicado` hereda nombre, acción y ruta de la primera fila con
    su md5.
  - `carpeta` es informativa.

## Paso 1 — `backend/adopcion/editor.js` (servidor)

```
bun backend/adopcion/editor.js [--salida <dir>] [--raiz <dir>] [--puerto <n>]
```

Defaults: `--salida` y `--raiz` iguales a los de `aplicar.js` (`~/Descargas/adopcion-classroom`,
`~/U.N.L.P`), `--puerto 3002`. `~` se expande igual que en `aplicar.js` (línea 20). `Bun.serve` con
`hostname: "127.0.0.1"`, **nunca** `0.0.0.0`: los TSV llevan nombres de docentes y el origen de las
descargas. Al arrancar imprime la URL y la advertencia
`No corras generar.js mientras editás: pisa los TSV.`

Lectura y escritura de los TSV: funciones propias `leerTsvCrudo(ruta)` y `escribirTsvCrudo(ruta, datos)`
en `editor.js`. **No** reusar `parsearTsv` de `aplicar.js`: no se exporta y descarta los comentarios.
- `leerTsvCrudo` devuelve `{ comentarios: string[], cabecera: string[], filas: object[] }`. `comentarios`
  son las líneas `#` en su orden (en los tres archivos están todas antes de la cabecera). Los valores se
  guardan **sin** trim, tal cual.
- `escribirTsvCrudo` escribe `comentarios`, la cabecera, cada fila con sus valores unidos por `\t` en el
  orden de la cabecera, todo unido por `\n` y con un `\n` final: el mismo formato que `generar.js`.
  Escribe a `<archivo>.tmp` y renombra.
- **Invariante**: leer y escribir sin cambios deja los tres archivos idénticos byte a byte.

Endpoints:

| Método y ruta | Qué hace |
|---|---|
| `GET /` | Sirve `editor.html` (mismo directorio), `content-type: text/html; charset=utf-8`. |
| `GET /api/datos` | `{ cursos, temas, archivos, destinos, materias, docentes }`. `cursos`, `temas` y `archivos` son las `filas` de cada TSV. `destinos` = `DESTINOS`. `materias` = las carpetas a profundidad 2 bajo `--raiz` (`<facultad>/<materia>`, p. ej. `Ingenieria/Fisica 1`), sin las que empiezan con `.`, ordenadas. `docentes` = `{ [materia]: string[] }` con las subcarpetas de `<raiz>/<materia>/Teorias` si existe. |
| `POST /api/guardar` | Cuerpo `{ cursos, temas, archivos }` con las filas completas. Valida (abajo) y, si no hay errores, reescribe los tres TSV. Responde `{ ok: true }` o `{ ok: false, errores: string[] }`; con errores **no escribe ninguno**. |
| `POST /api/ensayo` | Corre `bun <dir de editor.js>/aplicar.js --raiz <raiz> --salida <salida>` con `Bun.spawn` (ruta absoluta de `process.execPath` para `bun`). Responde `{ codigo, salida }`, con stdout y stderr concatenados en ese orden. **Nunca** pasa `--escribir`: la escritura es A-3 y la corre tanda. |

Cualquier otra ruta → 404.

Validación de `/api/guardar`. Parte de las filas **releídas del disco en ese momento**, las empareja por
clave con las del cuerpo y copia **sólo** los campos editables; cualquier otro campo que venga en el cuerpo
se ignora:

- **Claves.**
  - Cursos por `clave_curso`, temas por `clave_curso`+`tema`, archivos por `clave`.
  - Si falta una fila del disco en el cuerpo, o viene una clave que no existe → error. No se agregan ni se
    quitan filas.
- **Cursos** (`materia`, `docente`).
  - `materia` es `""` o una de `materias`.
  - `docente` no tiene `/` ni `\`.
- **Temas** (`destino`): uno de `DESTINOS` o `-`.
- **Archivos** (`nombre`, `accion`), sólo si la fila del disco es `copiar` u `omitir`.
  - `accion` ∈ {`copiar`, `omitir`}.
  - `nombre` no vacío, sin `/` ni `\`, e igual a `sanitizarNombreArchivo(nombre)`. Si no, el error dice
    `quedaría '<sanitizado>'`, con el mismo texto que `aplicar.js`.
  - En filas `ya-esta` o `duplicado`, un `nombre` o `accion` distinto del disco → error
    `la fila <clave> es '<accion>' y no se edita`.
- **Todos los valores**: sin `\t`, `\r` ni `\n`, que romperían el TSV.

Cada error nombra la fila de manera legible: curso por `nombre`, tema por nombre de curso + tema, archivo
por `original`. **No** por la clave base64.

## Paso 2 — `backend/adopcion/editor.html` (página)

HTML + CSS + JS en un solo archivo, sin librerías ni CDN (el backend no tiene dependencias). Colores como
variables en `:root`, con `@media (prefers-color-scheme: dark)`. Todo en español. Al cargar hace
`GET /api/datos`.

**Barra fija arriba**:
- Contadores en vivo: a copiar / ya están / duplicados / omitidos / **choques**. Los choques en rojo si hay
  más de 0.
- Indicador "cambios sin guardar".
- Botones **Guardar** y **Probar**. Probar guarda y, si guardó bien, llama a `/api/ensayo`.
- Un panel desplegable con los `errores` de guardar o la `salida` del ensayo (`<pre>`).
- `beforeunload` avisa si hay cambios sin guardar.

**Sección 1 — Cursos.** Una fila por curso:
- `nombre`, `items`.
- `materia`: `<select>` con `materias` + "(sin materia)".
- `docente`: `<input>` con `<datalist>` de `docentes[materia]`.
- Los cursos con `items` = 0 se ven atenuados.
- Debajo de docente, una línea gris: `Teorías va a <materia>/Teorias/<docente>`, o `Teorías va a
  <materia>/Teorias` si el docente está vacío.

**Sección 2 — Temas.** Agrupados por curso, en `<details>` abiertos:
- Una fila por tema: `tema`, `items` y `destino` (`<select>` con `DESTINOS` + `-` rotulado "no bajar este
  tema").
- Los temas con `regla=no` llevan una marca visible "sin regla — revisá", y hay un filtro "sólo sin regla".

**Sección 3 — Archivos.** Agrupados curso → tema, en `<details>` cerrados. Cada grupo muestra en su
`<summary>` cuántos archivos tiene y cuántos choques. Filtros: texto (busca en `original` y `nombre`),
"sólo choques", "sólo a copiar". Cada fila:
- `original`, de sólo lectura.
- **Destino en vivo**: `materia/resolverCarpeta(destinoDelTema, docente)/nombre`. La lógica de
  `resolverCarpeta` se replica en el JS de la página: son tres líneas, con un comentario que apunte a
  `core/destino/carpetas.ts`.
- Si la fila es `copiar`/`omitir`: `nombre` editable (`<input>`) y un interruptor copiar/omitir.
- Si el tema tiene destino `-`: la fila muestra "no se baja (tema)" y sus controles quedan deshabilitados.
- `ya-esta`: insignia "ya está en <materia>/<carpeta>", sin controles.
- `duplicado`: insignia "igual a <nombre de la primera fila con el mismo md5>", sin controles. Su destino
  en vivo es el de esa primera fila.

**Choques** (cálculo en la página, mismo criterio que `buscarChoques` de `core/destino/choques.ts`):
- Entran las filas `copiar` cuyo tema no sea `-`, con destino en vivo, y las `ya-esta` con
  `materia/carpeta/nombre`.
- Se agrupan por ruta final (carpeta + nombre).
- Un grupo con más de un md5 distinto es choque: sus filas se marcan en rojo con la leyenda "mismo destino
  que otro archivo distinto: cambiá el nombre".
- Se recalcula en cada cambio.

**Guardar** manda las filas completas (las recibidas, con los cambios aplicados) y muestra los `errores`
tal cual. **Probar** muestra la `salida` del ensayo. Si `codigo` es 0, además resalta la línea `A copiar: N`.

## Paso 3 — Docs

- `docs/ramas-en-revision.md`, checklist **A-2**: reemplazar "editar los tres TSV" por:
  - tanda levanta `bun backend/adopcion/editor.js` y el dueño abre `http://127.0.0.1:3002`;
  - en la página decide lo mismo que dice hoy la lista (docente de Física I, destinos `regla=no`, nombres,
    cronogramas, los 7 choques), hasta que Probar dé `codigo` 0.
  - Agregar debajo: `No correr generar.js después de editar: pisa los TSV.`
- `docs/testing.md`: sin cambios. `backend/` no tiene suite (AGENTS.md §The gate).

## Radio de impacto

- **Archivos nuevos**: `backend/adopcion/editor.js` y `backend/adopcion/editor.html`.
- **Sin cambios**: `aplicar.js`, `generar.js`, `leerStorage.js`, `core/`, la extensión y el server del
  puerto 3001.
- **Lint**: `eslint .` alcanza `editor.js` (bloque de backend con globals Node+Bun). El `.html` no se
  lintea.
- **Puerto**: 3002 no choca con el backend (3001, `backend/config.js:5`).

## Verificación A (obra; pegar la salida literal)

obra trabaja sobre una **copia** de los TSV reales. No toca `~/Descargas/adopcion-classroom` ni escribe en
`~/U.N.L.P`: el ensayo sólo lee.

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build   # 50/837, lint 0/0
T=~/Descargas/adopcion-sim/editor; rm -rf $T && mkdir -p $T && cp -a ~/Descargas/adopcion-classroom $T/tsv && cp -a $T/tsv $T/orig
bun backend/adopcion/editor.js --salida $T/tsv --puerto 3002 & PID=$!; sleep 1
ss -ltn | grep ':3002'                                                    # (a) sólo 127.0.0.1:3002
curl -s localhost:3002/ | head -c 60; echo                                # (b) empieza con <!doctype html>
curl -s localhost:3002/api/datos > $T/d.json
jq '[(.cursos|length), (.temas|length), (.archivos|length), (.materias|index("Ingenieria/Fisica 1")!=null)]' -c $T/d.json   # (c) [7,<temas>,366,true]
jq '{cursos,temas,archivos}' $T/d.json | curl -s -XPOST -d @- localhost:3002/api/guardar; echo   # (d) {"ok":true}
for f in cursos temas archivos; do cmp $T/tsv/$f.tsv $T/orig/$f.tsv && echo "$f idéntico"; done   # (e) los tres idénticos
jq '{cursos,temas,archivos} | .temas |= map(if .tema=="Complejos" then .destino="Practicas" else . end)' $T/d.json | curl -s -XPOST -d @- localhost:3002/api/guardar; echo   # (f) {"ok":true}
diff $T/orig/temas.tsv $T/tsv/temas.tsv | grep -c '^[<>]'                # (g) 2 (una línea sale, una entra)
cp $T/orig/temas.tsv $T/tsv/temas.tsv
jq '{cursos,temas,archivos} | .archivos |= map(if .accion=="copiar" and .original=="MC3_2023.pdf" then .nombre="a/b.pdf" else . end)' $T/d.json | curl -s -XPOST -d @- localhost:3002/api/guardar; echo   # (h) ok:false, error nombra MC3_2023.pdf
jq '{cursos,temas,archivos} | .archivos |= map(if .accion=="ya-esta" then .accion="omitir" else . end)' $T/d.json | curl -s -XPOST -d @- localhost:3002/api/guardar | jq '.ok, (.errores|length)'   # (i) false 55
jq '{cursos,temas,archivos} | .temas |= map(if .tema=="Complejos" then .destino="Teoria" else . end)' $T/d.json | curl -s -XPOST -d @- localhost:3002/api/guardar | jq -c '[.ok, (.errores|length)]'   # (j) [false,1]
for f in cursos temas archivos; do cmp $T/tsv/$f.tsv $T/orig/$f.tsv && echo "$f idéntico"; done   # (k) los tres idénticos tras (h)-(j)
curl -s -XPOST localhost:3002/api/ensayo | jq -r '.codigo, .salida' | grep -c 'Choque detectado'   # (l) 2
curl -s -XPOST localhost:3002/api/ensayo | jq '.codigo'                  # (m) 1
curl -s localhost:3002/nada -o /dev/null -w '%{http_code}\n'              # (n) 404
kill $PID
```

**Control negativo obligatorio del (e)**: en `escribirTsvCrudo`, sacar el `\n` final, repetir (d)-(e) y
pegar el `cmp`. **Tiene que** decir que difieren. Revertir. Si da idéntico, reportarlo y no seguir.

Si (c) da otro número de temas, pegarlo: tanda lo contrasta. No hay un valor esperado fijo, porque es
`grep -vc '^#' temas.tsv` − 1.

## Verificación B (tanda, con Claude in Chrome sobre `http://127.0.0.1:3002`)

- **E-1.** Se ven las tres secciones y los contadores dicen 299 / 55 / 4 / 8 / **2 choques**
  (cuentan grupos: MC2 y MC3).
- **E-2.** "Sólo choques" muestra las 7 filas. Renombrar una de MC3 baja los choques a 1 sin guardar.
- **E-3.** Cambiar el docente de Física I cambia el destino en vivo de sus filas Teorias a `Teorias/<docente>`.
- **E-4.** Poner `-` en un tema deshabilita sus filas. Los duplicados muestran el nombre de su primera fila
  y lo siguen al renombrarla.
- **E-5.** Guardar y Probar muestran la salida del ensayo. Recargar la página conserva lo guardado.
- **E-6.** Oscuro y claro legibles. Con la ventana a 400 px de ancho no hay scroll horizontal de página
  (las tablas pueden scrollear dentro de su caja).
