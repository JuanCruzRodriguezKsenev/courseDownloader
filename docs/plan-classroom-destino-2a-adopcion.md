# Plan — Corte 2a: adoptar lo ya bajado de Classroom en `~/U.N.L.P`

**Rama**: `classroom-destino-adopcion` (desde `main` = `0442598`). **Fecha**: 2026-09-27.
**Spec**: `docs/specs/classroom-destino/spec.md` — este plan es el corte **2a** de su §Cortes de
construcción. Formas decididas por el dueño el 2026-09-27: adopción primero, **TSV editable** (PA-3),
índice **genérico** `~/U.N.L.P/.course-downloader.json` con claves `<portal>:<id>` (§Datos). PA-2
decidido siguiendo la recomendación de la spec.

**La extensión no se toca.** Se agregan funciones puras en `core/destino/` (que 2b va a reusar) y dos
scripts de Bun de una sola corrida en `backend/adopcion/`. `backend/server.js` y `handlers.js` no
cambian: no hace falta reiniciar Bun.

## Qué hay hoy (medido 2026-09-27, tanda)

- Storage de Brave (`…/Local Extension Settings/daameiendaidaagnimcbpmdjkpccfemh/*.log`):
  - Hay un `listaPersistente` de **366 ítems** en 5 carpetas: `fisica_i_grupo_g_ing_2024` 130,
    `fisica_ii_g25_2026` 99, `fisica_ii_g22_2026_2do_cuatrimestre_facultad_de_ingenieria_unlp` 88,
    `mc2_2025` 25 y `mb5_2024` 24. Es del recorrido N-2 de las 17:34.
  - **El ÚLTIMO `listaPersistente` del `.log` es el de N-1 (99 ítems, sólo G25)**, porque un
    escaneo de un curso pisa la lista. Por eso el Paso 3 exige un recorrido de todos justo antes.
  - Campos de cada ítem: `carpeta`, `idArchivo`, `modulo` (`"<curso> › <tema>"`), `titulo`,
    `sitioId`, `tipo` (siempre `"adjunto"`), `estado`, etc. **No lleva el id del curso.**
  - Los accesos se reconocen por `idArchivo` que empieza con `acceso:`. Son 63, con `titulo` del tipo
    `10 Experimentos de Electrostática.mp4.md`.
  - `recorridoTodos.cursos[]` = `{ id, nombre, resultado, duracionMs }` para los 7 cursos. La carpeta
    de un ítem es `sanearNombreCarpeta(nombre)` (`core/util/texto.ts:97`). Comprobado con Bun para G22.
- `~/Descargas/verificacion-b/google-classroom/<carpeta>/`: 368 archivos. **366 de 366 ítems** están
  ahí con el nombre `sanitizarNombreArchivo(titulo)` (`backend/utils.js:7`: `path.basename` y
  reemplaza con `_` lo que no esté en `[a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]`). Los 2 archivos sobrantes no
  están en la lista y se ignoran.
- `~/U.N.L.P/Ingenieria`: 132 archivos. **55 ítems ya están por md5**, los 55 dentro de la materia de
  su curso. Árbol limpio (`git status --porcelain` vacío).
- Duplicados por md5 dentro de la lista: **2 grupos, 7 ítems** → 5 filas `duplicado` (PA-2).
- `~/U.N.L.P/.gitignore` ya es **UTF-8 con LF** desde `f3ea8bc` (la spec decía UTF-16; ya se
  corrigió en §Dependencias). `core.ignorecase=false`.

## Paso 1 — `core/destino/` (TS puro, testeado)

Carpeta nueva. Ya la cubren `tsconfig.json` (`core/**/*`) y vitest. Sólo puede importar de
`core/util/texto.ts`. Cero `chrome.*` y cero `node:*`: 2b la va a cargar en la extensión.

### 1.a `core/destino/indice.ts` — RN-23, RN-25, §Datos

- `export const NOMBRE_INDICE = ".course-downloader.json";`
- Tipos: `Indice { version: 1; cursos: Record<string, CursoIndice>; archivos: Record<string, ArchivoIndice> }`,
  `CursoIndice { nombre; materia; docente: string; temas: Record<string, string> }`,
  `ArchivoIndice { curso; nombre; ruta; md5; original }`. Son **exactamente** los campos de §Datos:
  contrastar contra `spec.md` §Datos (el bloque JSON y la tabla de abajo) antes de escribirlos.
- `claveCurso(sitioId, idCurso)` → `` `${sitioId}:${idCurso}` ``. `claveArchivo(sitioId, idArchivo)`
  hace lo mismo. Un `idArchivo` de acceso ya trae `acceso:` adentro y queda
  `google-classroom:acceso:…`. **No** se escapa nada: el `:` se separa por la primera aparición.
- `parsearIndice(texto)` → `{ ok: true, indice } | { ok: false, error: string }`:
  - Si `JSON.parse` tira, `error` lleva el mensaje del parser (RN-25, wireframe "Índice ilegible").
  - `version !== 1`, o `cursos`/`archivos` que no sean objetos → `ok: false` con el motivo.
  - **No valida** cada entrada: gana lo que dice el índice (RN-26).
- `serializarIndice(indice)` → `JSON.stringify` con las claves de `cursos` y `archivos` **ordenadas**,
  indentado a 2 y con `\n` al final. El orden estable deja que el dueño lo compare a ojo entre corridas.

### 1.b `core/destino/carpetas.ts` — RN-3, RN-4, RN-7, RN-8

- `export const DESTINOS = [".", "Teorias", "Practicas", "Laboratorios", "Parciales", "Finales", "Bibliografia"] as const;`
  Tienen la capitalización de RN-3, que es la del árbol (`find ~/U.N.L.P/Ingenieria -type d`).
- `sugerirDestino(tema): { destino, regla: boolean }`. Se prueban las reglas **en este orden**, sin
  distinguir mayúsculas, y gana la primera:

  | Regex sobre el tema | Destino |
  |---|---|
  | `^(novedades\|sin tema)$` | `.` (RN-8) |
  | `cronograma` | `.` (RN-10: el cronograma va a la raíz) |
  | `bibliograf\|libro` | `Bibliografia` |
  | `laborator` | `Laboratorios` |
  | `^(parcial\|notas de evaluaci\|examen\|recuperatorio)` | `Parciales` |
  | `^final` | `Finales` |
  | `te[oó]ric\|teor[ií]a` | `Teorias` |
  | `video\|simulaci` | `Teorias` |
  | `gu[ií]a\|\btp\b\|pr[aá]ctic\|ejercici\|problema` | `Practicas` |
  | (ninguna) | `.` con `regla: false` |

  **Los anclajes `^` de Parciales y Finales no son estética.** Sin ellos, el tema de MC2 "Series de
  fourier y ecuaciones en derivadas **parciales**" cae en Parciales (medido sobre los 42 temas reales).
- `resolverCarpeta(destino, docente)`: si `destino === "Teorias"` y `docente.trim()` no está vacío,
  devuelve `` `Teorias/${docente.trim()}` ``. Si no, devuelve `destino` tal cual (RN-4 y RN-5: sin
  docente, `Teorias/` queda plana).

### 1.c `core/destino/nombres.ts` — RN-11, RN-12, RN-15, RN-17

`proponerNombre({ original, tema, docente })` sigue estos pasos en orden:

1. **Extensión.** Si `original` termina en `/\.([A-Za-z0-9]{1,5})$/`, se separa y se pasa a
   minúsculas. Si no, queda sin extensión (`P10.- Circuitos de CC en estado transitorio`).
2. **Extensiones internas.** Del resto se borra
   `/\.(pdf|docx?|pptx?|xlsx?|mp4|mov|jpe?g|png)(?=$|[^a-z0-9])/gi`. Así
   `…Electrostática.mp4.md` queda `…Electrostática` + `.md` (RN-17), y
   `Documento_completo.pdf-PDFA` queda `Documento_completo-PDFA`.
3. **Docente.** Si `docente` no está vacío, se borra el prefijo `^\s*<docente>\s*[-–:]\s*` sin
   distinguir mayúsculas. El docente se escapa para usarlo en la regex.
4. Se borra una copia al final: `/\s*\(\d+\)\s*$/`.
5. Se borra un año al final: `/[\s_\-.]*(19|20)\d{2}\s*$/`.
6. **Número de orden.**
   `/^\s*(?:clase|pr[aá]ctica|tp|p|c)?\s*(\d{1,2})(?!\d)[\s.\-–:)]*/i` → `NN` con dos dígitos. El resto
   de la cadena sigue al paso 7. `2023_Fisica1…` no matchea, por el `(?!\d)`.
7. `slug = sanearNombreCarpeta(resto)`. Si queda vacío, se usa `sanearNombreCarpeta` del original sin
   la extensión.
8. **Módulo, sólo desde el tema (RN-12).** Con `/m[oó]dulo\s+([IVX]+|\d+)\b/i` se pasan los romanos
   I–X a número y se arma `modN`. `Módulos I y II` **no** matchea (por la `s`) y queda sin prefijo.
9. Resultado: `[modN, NN, slug]`, sin los vacíos, unidos con `_`, más `.ext` si había.

RN-15 (Parciales) no necesita un caso aparte: la regla no infiere fechas.

### 1.d `core/destino/choques.ts` — RN-16 en su forma de adopción

- `buscarChoques(filas: { clave, ruta, nombre, md5 }[])` devuelve los grupos con igual
  `ruta + "/" + nombre` (comparados en minúsculas) y **más de un md5 distinto**.
- El mismo md5 no es choque: es PA-2.
- La adopción **no** resuelve choques sola, porque no tiene el título del material. Los informa y se
  niega a escribir (Paso 4).

### 1.e Tests — `core/destino/*.test.ts`

- **indice**: ida y vuelta `serializar → parsear` sin cambios. JSON roto → `ok:false` con el mensaje.
  `version: 2` → `ok:false`. Las claves salen ordenadas. `claveArchivo("google-classroom", "acceso:https://x:T")`
  da `"google-classroom:acceso:https://x:T"`.
- **carpetas**: una fila por regla de la tabla, con temas **reales** de la medición.
  - `Clases Teóricas Módulo I` → Teorias; `Guía de TP Nº 3 - Ejercicios resueltos y consultas.` → Practicas.
  - `Laboratorios`, `Bibliografía de la Cátedra`, `Libro de cátedra`, `Parciales-Módulo II`,
    `Cronogramas y planificación semanal` → `.`, `Videos de experiencias y simulaciones` → Teorias,
    `Novedades` → `.`.
  - **`Series de fourier y ecuaciones en derivadas parciales` → `.` con `regla:false`**.
  - `Links-Módulo I` → `.` con `regla:false`.
  - `resolverCarpeta("Teorias","Palacio")` → `Teorias/Palacio`; `("Teorias","  ")` → `Teorias`;
    `("Practicas","Palacio")` → `Practicas`.
- **nombres**: los 4 ejemplos de **AC-11** (columna "propuesto"), más:
  - `Teoria Grupo G-MAS.pdf` con tema `Clases teóricas - Módulo I` → `mod1_teoria_grupo_g_mas.pdf`.
    AC-11 fila 4 se prueba con un tema **sin** módulo (`Clases teóricas`), que es la única forma en
    que da su "propuesto". Anotarlo en el test.
  - `Palacio - Clase 5 - Capacitores.pdf`, docente `Palacio` → `05_capacitores.pdf` (AC-1).
  - `10 Experimentos de Electrostática.mp4.md` → `10_experimentos_de_electrostatica.md` (RN-17).
  - `Apunte (1).PDF` → `apunte.pdf`. `2023_Fisica1_Clase01.pdf` no lleva `NN_` al principio.
  - Tema `Prácticas - Módulos I y II` → sin `modN_`.
- **choques**: dos claves con igual ruta+nombre y md5 distinto → un grupo. Con md5 igual → ninguno.
  `Foo.pdf` vs `foo.pdf` en la misma ruta → choque.

## Paso 2 — `backend/adopcion/leerStorage.js`

Es el lector del `.log` de LevelDB que tanda usó en las mediciones, pasado a JS. Sin librerías.

- `leerRegistros(archivoLog)`: bloques de 32768 bytes. Cabecera de 7 bytes: crc (4), largo (u16 LE)
  y tipo (1). Tipos: 1 = FULL, 2 = FIRST, 3 = MIDDLE, 4 = LAST, que se reensamblan. Si quedan menos de
  7 bytes en el bloque, se salta al siguiente. Si aparece un tipo 0 u otro desconocido, se corta.
- `leerUltimoValor(dirStorage, clave, predicado)`:
  - Toma el `*.log` de nombre mayor.
  - En cada registro busca **todas** las apariciones de `clave`. Desde cada una, parsea el primer `[`
    o `{`, **el que aparezca antes**, con un decodificador JSON que ignora lo que sigue. Así lo hace
    `raw_decode`: en JS, recorrer hasta balancear corchetes respetando strings, o probar `JSON.parse`
    sobre cortes crecientes. Preferir lo primero.
  - Devuelve el **último** valor que cumple `predicado`, o `null`.
  - **Trampa ya pagada**: tomar el primer `[` sin comparar con el `{` devuelve el array `cursos` de
    adentro de `recorridoTodos` en vez del objeto.
- Si el `.log` no tiene el valor (LevelDB lo compactó a un `.ldb`, comprimido con snappy), devuelve
  `null`. El que llama dice: *"volvé a correr 'Escanear todos los cursos' y repetí"*. No se lee `.ldb`.

## Paso 3 — `backend/adopcion/generar.js` (no escribe en `~/U.N.L.P`)

```
bun backend/adopcion/generar.js [--storage <dir>] [--origen <dir>] [--raiz <dir>] [--salida <dir>]
```

Valores por omisión:
- `--storage`: el dir de Brave de arriba.
- `--origen`: `~/Descargas/verificacion-b/google-classroom`.
- `--raiz`: `~/U.N.L.P`.
- `--salida`: `~/Descargas/adopcion-classroom`, **fuera del repo**, porque lleva nombres personales.

1. `recorridoTodos` = el último con `cursos.length > 0`. `lista` = el último `listaPersistente` que
   sea array. Si falta alguno, se aborta con el mensaje del Paso 2.
2. Se exige que **cada** `item.carpeta` sea `sanearNombreCarpeta(c.nombre)` de algún curso del
   recorrido. Si no, se aborta listando las carpetas huérfanas. Si la lista tiene **una sola**
   carpeta y el recorrido más de un curso con `resultado: "ok"`, se aborta: *"la última lista es de
   un solo curso: corré 'Escanear todos los cursos'"*. Es el caso medido hoy.
3. Por cada ítem:
   - `origen = <origen>/<carpeta>/<sanitizarNombreArchivo(titulo)>`. Importar la función de
     `backend/utils.js`, **no** copiarla. Si no existe el archivo, se aborta con la lista.
   - Se calcula su md5 con `node:crypto`.
4. Índice md5 del árbol: se recorre `<raiz>/<materia>` de cada materia de la constante `SEMILLA`
   (ver abajo) y se arma un `Map md5 → [rutas relativas a raíz]`.
5. Se escriben **tres TSV** con cabecera, UTF-8, `\t` y `\n`:
   - **`cursos.tsv`** — `clave_curso  nombre  carpeta  materia  docente  items`. Una fila por curso del
     recorrido (7). `materia` y `docente` se precargan desde la tabla "Cursos → materia → docente" de
     `docs/specs/classroom-destino/assumptions.md` (§2026-09-13).
     - **Contrastar cada fila contra esa tabla antes de escribir la constante.**
     - Van como una constante `SEMILLA` en el script, con clave `carpeta`: G22 → `Ingenieria/Fisica 2`
       + `Palacio`; G25 → `Ingenieria/Fisica 2` + `Bianchi`; MC6 → `Ingenieria/Matematica C` + `Bava`;
       MC2 → `Ingenieria/Matematica C` + `Rey Grange`; MB5 → `Ingenieria/Matematica B` + vacío;
       Física I → `Ingenieria/Fisica 1` + vacío (el apellido de Lucila está abierto y lo escribe el
       dueño); Q5 → materia vacía (no hay carpeta, RN-2).
     - La clave de la constante es el `sanearNombreCarpeta` del nombre del recorrido: sacarla de la
       salida del Paso 3.2, no inventarla.
   - **`temas.tsv`** — `clave_curso  tema  destino  regla  items`. Una fila por par (curso, tema).
     `tema` es lo que sigue a `" › "` en `modulo`. `destino = sugerirDestino(tema).destino`.
     `regla` = `si`/`no`. Si `destino` es `-`, el tema entero se omite.
   - **`archivos.tsv`** — `clave  clave_curso  tema  accion  carpeta  nombre  original  origen  md5`.
     `clave` = `claveArchivo(sitioId, idArchivo)`. Las filas van en el orden de la lista. `accion` es,
     en este orden:
     1. **`ya-esta`**: el md5 está en el árbol **dentro de la materia del curso**. `carpeta` y `nombre`
        son los del archivo que ya está (PA-1: gana el nombre viejo). Si hay más de uno, el primero en
        orden alfabético.
     2. **`duplicado`**: el md5 ya salió en una fila anterior. `carpeta` y `nombre` son los de esa
        fila (PA-2).
     3. **`omitir`**: el tema contiene `cronograma` (RN-10: el dueño elige cuál pasa a `copiar` y le
        pone `cronograma_AAAA_Nc.<ext>`).
     4. **`copiar`**: todo lo demás. `carpeta = resolverCarpeta(destino, docente)`.
        `nombre = proponerNombre({ original: titulo, tema, docente })`.
6. Por consola va un resumen con números, no con nombres: ítems por curso, por `accion`, temas con
   `regla=no`, y **choques** (`buscarChoques` sobre las filas `copiar` + `ya-esta`).

**Semántica de la edición, que va escrita también al principio de cada TSV como comentario `#`:**
- `aplicar` **recalcula** `carpeta` desde `cursos.tsv` (docente) y `temas.tsv` (destino). La columna
  `carpeta` de `archivos.tsv` es sólo para leer.
  - Cambiar el docente o el destino de un tema se hace **una vez** en su tabla.
  - Para `ya-esta` y `duplicado` no se recalcula: apuntan a lo que ya existe o a su primera fila.
- En `archivos.tsv` se editan `nombre` y `accion` (`copiar` ↔ `omitir`). `ya-esta` y `duplicado` no
  se pueden cambiar: `aplicar` rechaza la edición.

## Paso 4 — `backend/adopcion/aplicar.js`

```
bun backend/adopcion/aplicar.js [--raiz <dir>] [--salida <dir>] [--escribir]
```

**Sin `--escribir` es un ensayo**: valida, imprime lo que haría y no toca nada.

1. **Validaciones.** Si falla alguna, se juntan **todas** en la salida y no se escribe nada:
   - El índice `<raiz>/.course-downloader.json` **ya existe** → abortar. La adopción es de una vez y
     nunca pisa un índice (RN-25, RN-26).
   - Cada `materia` no vacía existe como carpeta bajo la raíz (RN-1).
   - Cada `destino` de `temas.tsv` está en `DESTINOS` o es `-`.
   - Cada `nombre` de una fila `copiar` no está vacío, no tiene `/` ni `\` y es igual a su
     `sanitizarNombreArchivo`. Si no, se muestra cómo quedaría.
   - Las filas `ya-esta` y `duplicado` no cambiaron `accion`, `carpeta` ni `nombre` contra lo
     generado: se relee el md5 y se recalcula.
   - `buscarChoques` sobre las filas `copiar` + `ya-esta` da vacío.
   - **Una fila `copiar` cuyo destino ya existe en disco** es un error, salvo que tenga el mismo md5.
     En ese caso pasa a `ya-esta` y se informa. Un reintento después de un corte no falla.
2. **Escritura**, sólo con `--escribir`:
   - `mkdir -p` de cada carpeta destino (RN-3, A9).
   - `copyFile(origen, destino, fs.constants.COPYFILE_EXCL)`. **Nunca** sobrescribe, y eso cubre RN-30
     para los `.md`.
   - Después se relee el md5 del destino y se compara. Si difiere, se corta sin escribir el índice.
   - No se copian atributos extendidos ni se agrega metadata (RN-28). `copyFile` no copia xattr.
   - **Índice**: se arma con `serializarIndice`.
     - `cursos`: los que tienen materia. `temas` mapea cada tema a `resolverCarpeta(...)`, u omite el
       tema si es `-`.
     - `archivos`: filas `copiar`, `ya-esta` y `duplicado`. `ruta` es relativa a la raíz y sin la barra
       final. `original` es el `titulo`.
     - Las filas `omitir` **no** entran: 2b las va a ofrecer de nuevo (RN-10).
   - El índice se escribe en un `.tmp` y se renombra (`rename`) al nombre final.
   - **`.gitignore`**: si **no** tiene una línea exacta `.course-downloader.json`, se agrega al final
     con `\n`.
     - Antes se lee el primer par de bytes: si es `FF FE` o `FE FF` (UTF-16), se aborta **antes de
       copiar nada**, con el mensaje de que hay que hacerlo a mano.
     - Este chequeo va en las **validaciones** del 4.1, no acá.
3. Resumen final con números: copiados, `ya-esta`, `duplicado`, omitidos, carpetas creadas y ruta del
   índice.

**Radio de impacto**:
- `backend/utils.js` se **importa**, no se modifica. `sanitizarNombreArchivo` hace hoy
  `path.basename` más la lista blanca de arriba.
- `esRutaSegura` **no** sirve acá, porque valida contra `CARPETA_RAIZ_VIDEOS`, que es la raíz de
  `verificacion-b`. Se escribe un chequeo local: cada destino, pasado por `path.resolve`, tiene que
  empezar por `path.resolve(raiz) + path.sep`.
- Nada de `backend/server.js`, `handlers.js` ni `config.js` importa `backend/adopcion/`.
- ESLint ya cubre `backend/**/*.js` con globals de Node y `Bun` (`eslint.config.js:130-135`).
  `tsc` no mira `backend/`, y está bien así.

## Paso 5 — Docs

- **ADR nuevo `docs/adr/0017-indice-de-destino-en-la-raiz.md`.** D9 lo pedía: el contrato de disco
  cambia (`docs/portal-google-classroom-diseno.md`, buscar `D9`).
  - Qué decide: el índice vive en la raíz del árbol y no en el storage; es la fuente de verdad; no se
    versiona; claves `<portal>:<id>`; "ya descargado" por md5 y nunca por nombre; nunca se sobrescribe.
  - El formato **no** se copia: se enlaza a `spec.md` §Datos, que es su hogar canónico (ADR-0007).
  - **Contrastar** contra ADR-0014 (la identidad de un ítem es `(portal, módulo, tipo, título)`). No
    la reemplaza: el índice usa el id de Drive porque es estable, y la identidad de la cola sigue
    siendo la de ADR-0014. Escribir esa frase.
  - Sumar una línea al índice `docs/adr/README.md`.
- `docs/testing.md` §Baseline: `46 → N` archivos y `801 → M` tests, con su "De dónde sale".
- `docs/ramas-en-revision.md` §🚧 En revisión: esta rama, el plan y el checklist A-1..A-4 de abajo.
- **No** tocar `spec.md`: tanda ya la actualizó en esta rama (índice genérico, PA-2, PA-3, cortes).

## Verificación A (obra; pegar la salida)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
./node_modules/.bin/vitest run core/destino
git grep -n "COPYFILE_EXCL\|course-downloader.json" -- backend/adopcion core/destino
```

**Control negativo obligatorio, con la salida pegada.** En `carpetas.ts`, sacar temporalmente el `^`
del regex de Parciales y correr `./node_modules/.bin/vitest run core/destino`. **Tiene que fallar**
el caso de "derivadas parciales". Revertir. Si pasa igual, reportarlo y no seguir.

**Ensayo contra los datos reales, sin `--escribir`.** Hoy **tiene que fallar** en el Paso 3.2, porque
la última lista es la de N-1. Pegar ese mensaje y no seguir: la corrida real la hacen el dueño y tanda.

```bash
bun backend/adopcion/generar.js --salida <un dir de scratch>   # esperado hoy: aborta, lista de un solo curso
```

obra **no** corre nada con `--escribir` y **no** toca `~/U.N.L.P`.

## Verificación B (dueño + tanda)

- **A-1** — Dueño: `pnpm run build`, recargar, portada de Classroom al frente → "Escanear todos los
  cursos", sin escanear nada después. Tanda corre `generar.js` y compara los números: 366 ítems en 5
  carpetas; `ya-esta` 55; `duplicado` 5; 7 cursos; 0 choques o la lista de choques.
- **A-2** — Dueño: editar los tres TSV en `~/Descargas/adopcion-classroom/`:
  - Docente de Física I.
  - Destino de los temas con `regla=no`: los de MC2 y los `Links-Módulo`.
  - Los nombres que no le gusten.
  - Qué cronograma pasa a `copiar`.
- **A-3** — Tanda: `aplicar.js` sin `--escribir` y revisa la salida con el dueño. Después, `--escribir`.
- **A-4** — Tanda verifica en disco:
  - `git -C ~/U.N.L.P status --porcelain`: sólo ` M .gitignore` y `?? Ingenieria/…`. **Ninguna** ` M`
    ni ` D` dentro de `Ingenieria/` (NFR-4). El índice **no** aparece (RN-24, NFR-2).
  - Cada fila `copiar`: md5 en destino igual al de origen.
  - `getfattr -d -R` sobre lo copiado: vacío (RN-28, NFR-1).
  - `.course-downloader.json` parsea con `parsearIndice`. Las entradas de `archivos` son las filas
    menos las `omitir`.

## Trazabilidad

| Regla / AC | Dónde |
|---|---|
| RN-1 materia existe | 4.1 |
| RN-3, RN-4, RN-5, RN-7, RN-8 | 1.b, 3.5 (`temas.tsv`), 4.2 (`mkdir`) |
| RN-6 destino por tema | 3.5 (`aplicar` recalcula `carpeta` desde `temas.tsv`) |
| RN-10 cronograma | 1.b, 3.5 (`omitir`) |
| RN-11, RN-12, RN-15, RN-17 | 1.c |
| RN-16 choques | 1.d, 4.1 (en adopción se informan y bloquean; el sufijo del material es de 2b) |
| RN-20, RN-21 por md5 y no por nombre | 3.5 (`ya-esta`) |
| RN-23, RN-24, RN-25, RN-26 | 1.a, 4.1, 4.2 |
| RN-28, RN-30 | 4.2 (`COPYFILE_EXCL`, sin xattr) |
| PA-2 | 3.5 (`duplicado`) |
| AC-2, AC-3 ya lo tenía con otro nombre | `ya-esta` → A-1 (55) y A-4 (sin ` M`) |
| AC-8 docente nuevo no mueve lo viejo | `resolverCarpeta` + A-4 (Física 1: `Teorias/` sin ` M`/` D`) |
| AC-11 nombres | 1.e |
| AC-12 dos accesos con la misma URL | `claveArchivo` incluye el título → A-4: 2 entradas si el caso está en la lista |

Los AC-1, 4, 5, 6, 7, 9, 10 y 13 son de 2b y 2c: la adopción no escanea ni descarga.
