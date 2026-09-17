# Supuestos — Destino de Classroom en el árbol del dueño

Traza de la skill `spec`. Historia: *"Como estudiante, quiero que lo que la extensión baja de
Google Classroom caiga en mi árbol `~/U.N.L.P` con el formato de carpetas y de nombres de archivo
que yo uso, para no reordenar ni renombrar nada a mano."*

Contexto ya decidido (no son supuestos): `docs/portal-google-classroom-diseno.md` D9 (destino con
mapeo por curso y tema), D10 (videos = acceso `.md`), D11 (Novedades se escanea), D12 (repetidos en
una carpeta). Reglas dadas por el dueño el 2026-09-13: sin docente en el nombre del archivo; carpeta
por docente sólo en Teorias; carpetas Laboratorios y Bibliografía; videos en Teorias o Practicas
según qué sean; cronograma sólo el actual, en la raíz; nombres y carpetas según el formato.

Estados: `asumido` · `rechazado` · `resuelto` · `a medir (M-n)`.

## Relevamiento de `~/U.N.L.P` (2026-09-13, pedido del dueño antes de corregir la ronda 1)

Leídas las 11 materias (2 de Ingeniería de Física, 2 de Matemática, 7 de Informática), los MOC de
`ObsidianUNLP_Vault` y los textos con reglas (`Taller de Lenguajes 1/GEMINI.md`,
`Programacion 3/Practicas/Reglas.md`: son reglas de código, no de archivos). **No hay convención
de carpetas ni de nombres escrita.**

| Patrón | Dónde aparece | Contra |
|---|---|---|
| `Teorias/`, `Practicas/`, `Parciales/` con mayúscula | CAC, CBD, CSO, P3, TL1, TL2, F2, MC | minúscula en P1, F1, MB |
| `Practicas/Practica N/` (+ `Adicional/`) | CAC, CBD, P3, TL1, TL2 (Adicional: CBD, TL1) | P1 `practicas/N`, F2 plano, CSO plano |
| `Teorias/` plana | CAC, CSO, P1, P3, F1, F2 | CBD `Clase N/`, TL1 `N. Tema/` |
| Teorías por docente | F2 `Teorias/Bianchi`, `Teorias/Palacio`; F1 `teorias pedro 2023` | — |
| `Parciales/Modulo N/<fecha>/` | CAC `2025_10_03`, F1 `mod 1/2022-09-29`, MB `modulo 2/2022_8_3`, TL1 `2025 1er semestre`, MC `Modulo 1/` | P3 `Parciales/<Tema>/2026-06-16` |
| Fecha ISO con guiones | F1 (2 carpetas, 4 archivos), P3 (4 carpetas) | `_` en CAC y MB, `24-04-22` en MC |
| Cronograma en la raíz de la materia | TL1 `Cronograma-2026---1S.pdf`, F2, CAC `Fechas Importantes AC2025.pdf`, P2 | — |
| Laboratorios | F1 `laboratorios/` (plano) **y** `labs/` | — |
| Videos junto a la teoría | P1 `teorias/Clase 10 - ….mp4`, TL1 `Teorias/11. …/Compilador GCC….mp4` | — |
| Nombre de archivo = el de la cátedra | **todas** las teorías y prácticas; 0 renombradas por el dueño | lo propio sí lo nombra él: fotos de parciales (`foto1.jpeg`, `consigna 1.jpg`), fechas |
| MOC con rutas de Windows (`Practicas\Practica 1`) | los 10 MOC | el espejo lo generó una herramienta de la era Windows; no se sabe cuál |

Propuesta de formato derivada (F1–F10) en la respuesta del 2026-09-13; los supuestos 5, 13 y 22 de
la ronda 1 quedan **pendientes** hasta que el dueño la acepte o la corrija.

## Cursos → materia → docente (2026-09-13)

Docentes sacados de "Publicación de …" en Novedades (`docs/muestras/google-classroom/recorrido-3/`).
Quien publica no es necesariamente el titular.

| Classroom | Materia | Docente (carpeta) | Estado |
|---|---|---|---|
| Física II G22 2026 2do cuatrimestre | `Ingenieria/Fisica 2` | Palacio | resuelto (dueño, 2026-09-12) |
| Fisica_II_G25_2026 (archivado) | `Ingenieria/Fisica 2` | Bianchi | resuelto (dueño, 2026-09-12) |
| MC6 :: Mate C (2026 2C, vacío) | `Ingenieria/Matematica C` | Bava | resuelto (dueño: "MC separa por Bava y Rey Grange") |
| MC4 1S 2026 | `Ingenieria/Matematica C` | Rey Grange | resuelto (ídem) |
| MC2 2025 | `Ingenieria/Matematica C` | Rey Grange | asumido: publica sobre todo Keiko Fushimi (24) y Rey Grange 1 vez |
| MB5 2024 (archivado) | `Ingenieria/Matematica B` | — | materia resuelta (dueño) |
| Física I-Grupo G-Ing 2024 | `Ingenieria/Fisica 1` | Lucila (dueño; la cuenta publica como "Lucila Física", sin apellido) | resuelto el nombre; apellido abierto |
| Q5 Primer Cuatrimestre 2023 (vacío) | Química para Ingeniería (dueño); no hay carpeta en `U.N.L.P` | Sonia (dueño) | apellido **no está** en Classroom: Personas lista sólo la cuenta "Comision Q5" y los posts firman "Saludos Sonia" |

### Física 1: de quién son las teorías que ya están en disco

- `teorias pedro 2023/` → **Pedro Mendoza Zélis**: firmado en `2023_Fisica1_Clase01.pdf` ("Prof.: Dr.
  Pedro Mendoza Zélis — JTP: Dra. Sofía Gómez"). El dueño lo nombró "Pedro Mendoza".
- `teorias/C1..C9` → **sin firma** (Impress, primera página sin nombres). Coinciden 9 de 9 por tema
  con "Clases teóricas - Módulo I" del Classroom de Lucila: `C1 Variables cinemáticas` ↔ `Teoría
  Grupo G- Variables cinemáticas.pdf`, `C5 Cinemáticaf.pdf` ↔ `Cinemáticaf.pdf` (nombre idéntico),
  `C8 Movimiento armonico simple` ↔ `Teoria Grupo G-MAS.pdf`, etc. Es decir: **el dueño sí renombró
  estas teorías** (`CN Tema`), lo que corrige la F9 del relevamiento ("0 renombradas").
- `parciales/mod 1/2022-09-29`, `…/2023-09-28` y `parciales/mod 2/Parcial del …` → 8 archivos con
  el nombre exacto de "Parciales - Módulo I/II" del mismo Classroom.

### A medir

- **M-1** — ¿`teorias/C1..C9` son los PDF del Classroom de Lucila? *Cómo*: descargar "Clases
  teóricas - Módulo I" a una carpeta aparte y comparar md5 con los 9 de disco. *Decide*: iguales →
  `Teorias/<Lucila>/` y el nombre de disco es un renombre del dueño; distintos → `Teorias/` con
  docente incierto, salvo que aparezcan firmados.
- **M-2** — Apellido de Sonia (Química, Q5). Classroom no lo tiene. *Cómo*: fuera de Classroom
  (SIU Guaraní, Moodle de la cátedra o el dueño). *Decide*: el nombre de `Teorias/<Docente>/`; el
  curso está vacío, así que no bloquea ninguna descarga.

## Decisiones para el plan de formateo (2026-09-13)

- **Alcance**: `resuelto` — Ingeniería, 4 materias (Física 1, Física 2, Matemática B, Matemática C).
  Informática no se toca.
- **Vault de Obsidian**: `resuelto` — no se toca. Sólo se mueven y renombran los archivos.
- **Nombres de archivo**: `resuelto en principio` — "lo más sencillos posible", ejemplo del dueño:
  `01_coulomb`. Reemplaza a la F9 del relevamiento (nombre de la cátedra). Detalle de la regla
  (minúsculas, `_`, número de 2 dígitos, qué pasa sin número) pendiente de confirmar.
- **Subcarpetas por práctica**: `resuelto` — en Ingeniería **no**: `Practicas/` sin subcarpetas,
  porque ahí se resuelve en cuaderno y sólo se guardan los PDF. `Practica N/` es de Informática,
  donde se resuelve archivo por archivo (Taller de Lenguajes 1). Reemplaza la F4 del relevamiento
  para Ingeniería. Consecuencia: el número de práctica tiene que ir en el nombre del archivo.
- **Cronograma viejo de Física 2**: `resuelto` — se borra (queda en git).
- **Detalle de nombres**: `resuelto` — minúsculas, `_`, número de 2 dígitos; sin número, sólo el
  tema; con módulos, prefijo `modN_`; parciales aplanados `modN_AAAA-MM-DD_detalle.ext`.
- Plan de formateo del árbol existente: `docs/plan-unlp-formateo-ingenieria.md` + tabla
  `docs/plan-unlp-formateo-ingenieria.tsv` (116 filas). **Ejecutado y verificado el 2026-09-13**:
  commits `f028086` y `3b7c557` en `~/U.N.L.P`, sin push. El árbol de las 4 materias ya tiene el
  formato: los supuestos 5, 13 y 22 de la ronda 1 quedan reemplazados por él.
- Hechos que ya no son supuesto: en `~/U.N.L.P`, `Ingenieria/` no tenía archivos versionados
  modificados (39 sin agregar, todos nuevos de Física 2 y `Fisica 1/Finales/`; el plan decía 41);
  de los 515 cambios pendientes, 511 son de Informática y 4 de `Ingenieria/`, así que el plan
  commiteó por ruta. `parciales/mod 1.zip` estaba versionado (el plan decía ignorado).

## Ronda 2 — 2026-09-13 (sobre el formato ya aplicado)

Reemplaza la ronda 1, que el dueño nunca llegó a revisar: se cortó para hacer el relevamiento, y
después se decidió y aplicó el formato (`~/U.N.L.P` `3b7c557`). Los supuestos 5, 13 y 22 de la
ronda 1 quedan sustituidos por el 5, del 11 al 16 y el 19 de esta.

Mediciones que anclan esta ronda (2026-09-13, sobre `docs/muestras/google-classroom/recorrido-3/`,
316 adjuntos únicos por curso y 291 que son archivos):
- **Regla mecánica candidata** (número inicial `P`/`C`/`Clase N`, sin prefijo de docente, sin año
  al final, sin ` (N)`, pasado a minúsculas con `_`): **acierta 15 de 26** nombres que el dueño eligió
  para archivos de Física 2 bajados de Classroom. Falla cuando el dueño acortó el tema
  (`P10.- Circuitos de CC en estado transitorio` → `10_circuitos_transitorios`) o lo renombró
  (`Documento_completo.pdf-PDFA.pdf` → `libro_de_catedra.pdf`).
- La regla encuentra número en **37 de 291** archivos: el `NN_` casi nunca sale del nombre de Classroom.
- Quitar ` (N)` y el año genera **3 grupos de choque, con 12 archivos en total**: MC2 Próximas ×2 grupos, y el
  template de laboratorio de Física I ×3, que ya estaba en D12.

### Alcance
1. `asumido` — Cubre sólo Google Classroom; Anatomy y RamonNet no cambian de layout.
2. `asumido` — Vale para los 8 cursos: todos son de Ingeniería.
3. `asumido` — La extensión nunca renombra, mueve ni borra lo que ya está en `~/U.N.L.P`, ni toca el vault.

### Reglas de negocio — carpetas
4. `asumido` — La raíz es `~/U.N.L.P` y cada curso se asocia una vez a una carpeta de materia existente (📂).
5. `asumido` — Los destinos de una materia son exactamente `raíz`, `Teorias/`, `Practicas/`, `Laboratorios/`, `Parciales/`, `Finales/` y `Bibliografia/`, con esa capitalización; si falta alguno, se crea.
6. `asumido` — `Teorias/<Apellido>/` se usa si el dueño escribe un apellido al asociar el curso; si lo deja vacío, `Teorias/` queda plana.
7. `asumido` — El destino se decide por tema: todos los adjuntos de un tema van a la misma carpeta.
8. `asumido` — La extensión sugiere la carpeta de cada tema por palabra clave y el dueño la confirma una vez por curso.
9. `asumido` — Novedades ("Próximas") y "Sin tema" van a la raíz de la materia.
10. `asumido` — Un tema que aparece después de configurar el curso va a la raíz y queda marcado para asignar.

### Reglas de negocio — nombres
11. `asumido` — El nombre final lleva el formato del árbol: minúsculas, sin tildes, `_`, `NN_` si hay número, `modN_` si hay módulo y extensión en minúscula.
12. `asumido` — La extensión propone el nombre con la regla mecánica medida arriba y el dueño lo puede editar en el popup antes de bajar.
13. `asumido` — El nombre editado se guarda por id de Drive y se reusa en los escaneos siguientes.
14. `asumido` — `modN_` sale del nombre del tema ("Clases teóricas - Módulo I" → `mod1_`), nunca del nombre de archivo.
15. `asumido` — En Parciales la extensión no infiere la fecha: propone `modN_<nombre>` y el dueño la escribe a mano.
16. `asumido` — D12 se aplica después de simplificar: si dos archivos quedan con el mismo nombre en una carpeta, todos los del grupo llevan `_<título del material>` antes de la extensión.
17. `asumido` — Los videos y los vínculos son acceso `.md` (D10), con el nombre sencillo del video.

### Reglas de negocio — ya descargado
18. `asumido` — Un archivo está descargado si su nombre final existe exacto en su carpeta destino; no se compara contenido.
19. `asumido` — Los 11 archivos que ya están en disco y cuyo nombre la regla no reproduce aparecen como no descargados hasta que el dueño edita ese nombre una vez en el popup.
20. `asumido` — Si dos cursos de la misma materia mandan el mismo nombre final a la misma carpeta, se baja una sola vez.

### Reglas de negocio — cronograma
21. `asumido` — Del tema de cronogramas sólo se baja el del cuatrimestre en curso, a la raíz, como `cronograma_AAAA_Nc.<ext>`; los semanales no se bajan.

### Datos
22. `asumido` — La asociación (curso → materia, apellido, tema → carpeta) y los nombres editados se guardan en el almacenamiento de la extensión, no en el árbol.

### Flujos de error
23. `asumido` — Un curso sin asociar se escanea y se lista, pero no se descarga hasta asociarlo.

### UX
24. `asumido` — La asociación se hace en el popup, en una pantalla por curso: 📂 materia, apellido en texto, tabla tema → carpeta con la sugerencia precargada.
25. `asumido` — Cada ítem de la lista muestra su ruta destino con el nombre final (`Teorias/Palacio/05_capacitores.pdf`), editable ahí mismo.

### Pregunta del dueño en la selección: "¿qué pasa si mañana se agrega otra clase?"
Respondida recorriendo los supuestos. Deja a la vista dos huecos, pendientes de que el dueño los marque:
- **10**: G22 abre un tema nuevo por TP ("Guía de TP Nº N"), así que "tema nuevo → raíz" pasaría casi
  todas las semanas. Candidato: la sugerencia del 8 se aplica sola y el tema no se baja hasta confirmarlo.
- **12**: una teoría nueva de Física I ("Teoria Grupo G …", sin número) llega sin `NN_`, y hay que
  editarla siempre.

## Ronda 3 — 2026-09-16 (revisión del dueño, cerrada)

Mediciones nuevas de esta ronda, sobre lo descargado en la Verificación B
(`~/Descargas/verificacion-b/google-classroom/`, 318 archivos de 5 cursos):

- **El "ya descargado" por nombre exacto (supuesto 18) NO reconoce lo que ya está en el árbol.**
  4 archivos de `Fisica 2/Laboratorios/` tienen **md5 idéntico** al que baja la extensión hoy y
  **nombre distinto**, porque el backend sanea `#`→`_` y `º`→`_` y el dueño los guardó con el
  nombre crudo: `F2-G22-…-Lab#1-Grupos de trabajo.pdf` vs `…-Lab_1-….pdf` (ídem Valores medidos,
  Valores para cada grupo, y Pautas para realizar el informe). Con el supuesto 18 tal cual, se
  vuelven a bajar los cuatro.
- **`Fisica 2/Laboratorios/` está sin formatear**: 11 archivos con el nombre crudo de Classroom,
  mientras `Teorias/` y `Practicas/` de la misma materia sí siguen el formato. El supuesto 11 no
  distingue carpetas.
- **D12 deja copias idénticas dentro del mismo curso**: `Informe de laboratorio FISICA I 2024
  (Template).docx` ×5 con md5 `cb5dc8da…`, `interferencia2025.pdf` ×2 con `2653281d…`. El supuesto
  20 sólo cubre el choque entre dos cursos.
- **Formas de `Teorias/` que conviven hoy**: Física 1 = 10 sueltos + `Mendoza/`; Física 2 =
  `Bianchi/` + `Palacio/` sin sueltos; Matemática C = `Rey Grange/` sin sueltos; Matemática B =
  2 sueltos sin subcarpetas.
- **`MC4 1S 2026` desapareció de Classroom** entre el 2026-09-12 y el 2026-09-16 (no está en
  archivadas: fue baja o eliminación). Origen del supuesto 23.

### Resueltos en esta ronda

- **6 bis / docente que aparece después** — `resuelto` (dueño, 2026-09-16): si `Teorias/` ya tiene
  archivos sueltos y se asocia un curso con otro docente, **lo viejo no se toca** y sólo el nuevo
  va a `Teorias/<Apellido>/`. Es el patrón que el árbol ya tiene en Física 1 (sueltos + `Mendoza/`).
  **Por qué**: respeta el supuesto 3 (la extensión nunca mueve lo que ya está) y no rompe links del
  vault de Obsidian. **Costo aceptado**: el árbol queda asimétrico y con el tiempo no se sabe de
  quién son las teorías sueltas.
- **18 / cómo se sabe si ya está** — `resuelto` (dueño, 2026-09-16): **por contenido, no por nombre.**
  La extensión baja el archivo, calcula su md5 y si ya existe uno idéntico en la carpeta destino lo
  descarta sin escribir y lo marca como descargado. **Por qué**: es lo único que reconoce los 4 casos
  medidos (md5 igual, nombre distinto por el saneo `#`→`_`) y cualquier renombre del dueño, pasado o
  futuro. Un índice por id de Drive no sirve: no sabe nada de lo que el dueño puso a mano.
  **Costo aceptado**: se gasta la descarga igual; con 135 KB de mediana es barato.
  - Reemplaza al supuesto 18 y deja sin objeto al 20 (las 5 copias md5-idénticas del template y las 2
    de `interferencia2025` colapsan solas).
- **12 y 13 / cómo se resuelve el nombre** — `resuelto` (dueño, 2026-09-16): la extensión **propone**
  el nombre con la regla mecánica, el dueño lo **edita en la lista antes de bajar**, y lo editado se
  **guarda por id de Drive** y se reusa en los escaneos siguientes: cada archivo se corrige una sola vez.
  **Por qué**: la regla sola acierta 15 de 26 y el dueño acorta temas (`P10.- Circuitos de CC en estado
  transitorio` → `10_circuitos_transitorios`), que no es una transformación de texto sino criterio.
  **Costo aceptado**: el primer escaneo de un curso lleva ~15 ediciones sobre 57 archivos.

### M-1 — CERRADO el 2026-09-16 ✅

¿`Fisica 1/Teorias/` sueltas = los PDF del Classroom de Lucila? **Sí: 9 de 9 con md5 idéntico**,
comparando el árbol contra lo bajado en la Verificación B. Ejemplos: `Teoria Grupo G-Trabajo_energia
cinetica y potencia.pdf` = `mod1_06_trabajo_y_energia.pdf`; `Cinemáticaf.pdf` = `mod1_05_cinematica.pdf`.

Consecuencias: (a) las teorías sueltas de Física 1 **son de Lucila**, lo que tapa el hueco que el
supuesto 6 bis dejaba abierto ("no se sabe de quién son las sueltas"); (b) confirma que el dueño
renombra fuerte, lo que sostiene la decisión 12/13; (c) es el caso de prueba del supuesto 18 nuevo:
por nombre se re-bajarían los 9, por contenido se reconocen.
- **22 / dónde vive el mapeo** — `resuelto` (dueño, 2026-09-16): **un único `~/U.N.L.P/.classroom.json`,
  gitignoreado.** Reemplaza al storage de la extensión como fuente de verdad.
  - **Por qué no el storage**: el mapeo `id de Drive → nombre elegido` es el trabajo caro (~291 ediciones)
    y el storage muere al reinstalar la extensión, limpiar el navegador o cambiar de máquina.
  - **Por qué no metadata pegada al archivo** (xattr o metadata interna): (a) **medido el 2026-09-16**:
    los xattr funcionan en btrfs pero `git clone` los pierde y `cp` sin `-a` también, y el árbol tiene
    remoto (`github.com/jcrodriguezUNLP/U.N.L.P`), así que el trabajo no viajaría; (b) escribir metadata
    interna **cambia el md5** y se muerde la cola con el supuesto 18; (c) viola el supuesto 3; (d) son 7
    formatos distintos en el árbol.
  - **Por qué gitignoreado y no versionado**: **el repo es PÚBLICO** (`gh repo view` → `visibility: PUBLIC`).
    Versionarlo publicaría ids de curso, nombres de curso, apellidos de docentes e ids de Drive de cada
    archivo. El dueño pidió explícitamente que nada revele de dónde baja su material.
  - **Costo aceptado**: no viaja con el clon; si el dueño trabaja en otra máquina, copia el archivo a mano.
  - **Requisito de privacidad confirmado por medición**: los archivos descargados hoy **no llevan ningún
    xattr ni metadata agregada por la extensión**. Compartir uno por WhatsApp o subirlo a un Drive no
    revela nada. La decisión de no usar metadata pegada mantiene esa garantía.

  **⚠️ Trampa para quien lo implemente**: `~/U.N.L.P/.gitignore` está en **UTF-16 LE con CRLF**
  (`file .gitignore`). Agregarle `.classroom.json` con `echo >>` o un heredoc lo corrompe: hay que leerlo,
  decodificar, agregar la línea y reescribir en el mismo encoding. Hoy `git check-ignore` confirma que
  `.classroom.json` **no** está ignorado.

  **Reglas de comportamiento del archivo** (van a la spec):
  1. Si no parsea, la extensión **avisa y no baja nada**. No lo pisa ni lo regenera.
  2. Si el dueño lo edita a mano, **gana el archivo**: es la fuente de verdad, no una caché.
  3. Si un archivo del índice no está en disco, se vuelve a bajar con el nombre que el índice dice.
  4. Si un archivo del índice no está en su ruta anotada pero **su md5 aparece en otro lugar de la
     materia**, la ruta del índice **se corrige sola**: mover un archivo a mano es una orden, no un error.

  Con el índice, la extensión sabe **antes de bajar** qué tiene (por id de Drive), así que la lista marca
  "ya descargado" sin descargar. El md5 queda como red para lo que el dueño puso a mano y nunca bajó la
  extensión (los 4 de `Fisica 2/Laboratorios/`). Resuelve **D-1** y **D-4**.

### Derivados abiertos por la ronda 3 (van a la ronda siguiente, no a ésta)

- **D-1** — El md5 se compara ¿sólo contra la carpeta destino, o contra toda la materia? Un archivo que
  el dueño guardó en otra carpeta se volvería a bajar si la comparación es sólo local.
- **D-2** — Si el contenido ya está pero con otro nombre, ¿gana el nombre viejo (no se toca nada) o la
  extensión propone renombrar? El supuesto 3 dice no tocar, así que el default es el nombre viejo.
- **D-3** — Con las 5 copias del template colapsadas a una, ¿cuál nombre queda y en qué carpeta? Hoy el
  criterio sería "el primero que llega", que es arbitrario.
- **D-4** — ¿Se guarda un índice de md5 ya vistos para no recalcular en cada escaneo?

## Ronda 4 — 2026-09-17 (hueco de los accesos `.md`)

**Hueco detectado al releer la spec**: `archivos.<id>` estaba tipado por id de Drive, pero los
accesos de RN-17 (videos, YouTube, vínculos) no tienen id de Drive. Son **55 de los 318 archivos
bajados, el 17%**, y la spec no decía con qué clave entran al índice.

**Pregunta al dueño**: ¿entran al índice con su URL como clave, o quedan fuera y se re-escriben
siempre (son 2 KB y no tocan la red)?

**Recomendación dada, y lo que la cambió**: la primera intuición fue *URL sola*, más robusta ante un
cambio de título. La medición sobre los 55 accesos reales la descartó: **54 URLs únicas de 55**, y la
única repetida es legítima — la animación de `gasaneofisica.uns.edu.ar` publicada en Física I dos
veces, como "Resortes horizontales" y como "Simulador de resortes-Clase III". Con la URL sola se
pierde el segundo.

**Decidido (el dueño aceptó la recomendación)**:

- **A-1** `confirmado` — Los accesos entran al índice con `acceso:<url>:<título>`, la clave que ya arma
  `sitio/google-classroom/scraper.js:506`. No se inventa un eje de identidad nuevo (ADR-0014). → **RN-29**, **AC-12**
- **A-2** `confirmado` — Quedar fuera del índice se descartó porque el costo de escribir no es el punto:
  sin índice no se recuerda el nombre editado, se re-crea con el propuesto y queda duplicado —
  el modo de falla que esta spec existe para evitar.
- **A-3** `confirmado` — Un `.md` que ya existe no se sobrescribe nunca, cualquiera sea su md5. Es el
  único tipo que el dueño edita sin renombrar, y `ObsidianUNLP_Vault` vive en el mismo árbol. → **RN-30**, **AC-13**, fila 0 de la tabla de decisión
- **A-4** `descartado` — Extraer el id de Drive de las 29 URLs `drive.google.com` para unificar la clave:
  ese id puede coincidir con el de un adjunto bajado de verdad, y serían dos cosas distintas con
  la misma clave.

**Costo conocido y aceptado**: si el docente edita el título en Classroom cambia la clave, aparece
un acceso nuevo y el viejo queda (60 bytes; RN-27 ya dice que nada se marca huérfano).

## Ronda 1 — 2026-09-13 (reemplazada por la ronda 2, sin revisar)

### Alcance
1. `asumido` — Cubre sólo Google Classroom; Anatomy y RamonNet no cambian de layout.
2. `asumido` — Vale para los 8 cursos, no sólo Física 2.
3. `asumido` — La extensión nunca renombra, mueve ni borra lo que ya está en `~/U.N.L.P`, ni toca el vault de Obsidian (notas espejo y MOC).

### Reglas de negocio — carpetas
4. `asumido` — La raíz es `~/U.N.L.P` y cada curso se asocia una vez a una carpeta de materia existente (G22 y G25 → `Ingenieria/Fisica 2`).
5. `asumido` — Una materia tiene exactamente estos destinos: raíz, `Teorias/<Docente>/`, `Practicas/`, `Laboratorios/`, `Bibliografia/`, `Parciales/`.
6. `asumido` — El docente del curso lo escribe el dueño al asociarlo; Classroom no lo trae en un campo.
7. `asumido` — El destino se decide por tema: todos los adjuntos de un tema van a la misma carpeta.
8. `asumido` — La extensión sugiere el destino de cada tema por palabra clave (teóric → Teorias; TP/práctic → Practicas; laborator → Laboratorios; bibliograf/libro → Bibliografia; parcial/diagnóstic/evaluac → Parciales) y el dueño lo confirma una vez por curso.
9. `asumido` — Un tema sólo de videos ("Videos de experiencias y simulaciones") no tiene sugerencia: el dueño elige Teorias o Practicas.
10. `asumido` — "Sin tema" y los temas sin sugerencia van a la raíz de la materia.
11. `asumido` — Los adjuntos de Novedades van a la raíz de la materia; la subcarpeta `Novedades/` decidida antes se abandona porque no está en el formato.
12. `asumido` — Un tema que aparece después de configurar el curso va a la raíz y queda marcado para asignar.

### Reglas de negocio — nombres
13. `asumido` — El nombre final es el de Classroom sin el prefijo `<Docente> - ` (`Palacio - Clase 5 - Capacitores.pdf` → `Clase 5 - Capacitores.pdf`); nada más se toca (mayúsculas, `_`, ` (2)`).
14. `asumido` — Los videos siguen siendo acceso `.md` (D10) y el `.md` se llama como el video sin su extensión (`conductores-animacion.md`).
15. `asumido` — D12 sigue igual: repetidos en una misma carpeta llevan el título del material antes de la extensión.

### Reglas de negocio — cronograma
16. `asumido` — De "Cronogramas…" sólo se baja el cronograma del cuatrimestre en curso; los semanales (`G22-cronograma semana …`) no se bajan.
17. `asumido` — "En curso" = el del curso con año y cuatrimestre más recientes en su nombre (G22 2026 2do gana a G25 2026 1er).
18. `asumido` — El cronograma viejo que ya está en la raíz queda donde está: la extensión no lo reemplaza.

### Reglas de negocio — ya descargado
19. `asumido` — Un archivo está descargado si su nombre final existe exacto en su carpeta destino; no se compara tamaño ni contenido.
20. `asumido` — Si dos cursos de la misma materia mandan el mismo nombre final a la misma carpeta (prácticas iguales), se baja una sola vez.

### Datos
21. `asumido` — La asociación (curso → materia, docente, tema → carpeta) se guarda en la extensión, no en el árbol.
22. `asumido` — Las carpetas que ya existen se usan con su capitalización en disco (`laboratorios` en Física 1); las que faltan se crean con el nombre canónico (`Laboratorios`, `Bibliografia`).

### Flujos de error
23. `asumido` — Un curso sin asociar se escanea y se lista, pero no se descarga hasta asociarlo.

### UX
24. `asumido` — La asociación se hace en el popup, en una pantalla por curso: 📂 materia, docente en texto, tabla tema → carpeta con la sugerencia precargada.
25. `asumido` — Cada ítem de la lista muestra su ruta destino relativa a la materia (`Teorias/Palacio/Clase 5 - Capacitores.pdf`) antes de bajar.
