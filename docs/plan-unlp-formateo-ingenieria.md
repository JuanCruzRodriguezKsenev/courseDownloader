# Plan — Formatear `~/U.N.L.P/Ingenieria` antes de descargar de Classroom

Fecha: 2026-09-13. **Repositorio donde se ejecuta: `~/U.N.L.P`** (git propio del dueño, rama `main`),
no `courseDownloader`. De este repo sólo se leen este plan y su tabla.

Contexto y decisiones: `docs/specs/classroom-destino/assumptions.md` (relevamiento, cursos → materia →
docente, decisiones del 2026-09-13). Este plan **no** toca la extensión: prepara el árbol para que el
corte 2 descargue sobre un formato ya fijo.

## 0. El formato (decidido por el dueño el 2026-09-13)

- **Alcance**: `Ingenieria/Fisica 1`, `Fisica 2`, `Matematica B`, `Matematica C`. Informática y
  `ObsidianUNLP_Vault/` **no se tocan** (tampoco `Ingenieria/generar_comprobante*.pdf`).
- **Carpetas** (mayúscula inicial, sin tilde): `Teorias/`, `Practicas/`, `Laboratorios/`,
  `Parciales/`, `Finales/`, `Bibliografia/`. `Teorias/<Apellido>/` sólo cuando la materia tiene
  más de un docente conocido. **Sin subcarpetas por práctica, por laboratorio ni por fecha.**
- **Raíz de la materia**: lo que escribe el dueño (resúmenes, scripts) y el cronograma actual.
- **Nombres de archivo**: minúsculas, sin tildes, palabras con `_`.
  - Con número: `NN_tema` con 2 dígitos (`01_coulomb.pdf`).
  - Sin número: sólo el tema (`interferencia.pdf`).
  - Si la materia tiene módulos, delante va `modN_` (`mod2_05_dinamica_de_fluidos.pdf`).
  - Parciales: `modN_AAAA-MM-DD_detalle.ext` (`mod1_2022-09-29_enunciado.pdf`).
- **Cronograma viejo**: se borra (queda en el historial de git).

## 1. Qué cambia, en una tabla

**`docs/plan-unlp-formateo-ingenieria.tsv`** es la fuente única: 116 filas `origen<TAB>destino`,
rutas relativas a `~/U.N.L.P/Ingenieria`. `destino = BORRAR` en 2 filas. Nada que no esté en la
tabla se mueve.

Resumen por materia (121 archivos hoy → 119 después):

| Materia | Archivos hoy | Filas | Sin cambio | Borrados | Salen / entran | Después |
|---|---|---|---|---|---|---|
| Física 1 | 69 | 65 | 4 (`Finales/` ×3, `resumen.txt`) | `parciales/mod 1.zip` (copia exacta de `parciales/mod 1/`, 11 de 11 md5 iguales) | salen 2 fotos → Matemática C | 66 |
| Física 2 | 36 | 35 | 1 (`Teorias/Bianchi/04_potencial.pdf`) | `Física II Cronograma 2026 1er semestre.xls` | — | 35 |
| Matemática B | 5 | 5 | 0 | — | — | 5 |
| Matemática C | 11 | 11 | 0 | — | entran 2 fotos de Física 1 | 13 |

De dónde salen las decisiones de la tabla que no son mecánicas (verificadas leyendo cada archivo):

- **Física 1 `teorias/C1..C9`** → `Teorias/` **sin docente**: coinciden por tema con "Clases
  teóricas - Módulo I" del Classroom de Lucila, pero sin comprobar contenido (M-1, §4).
  `fisica mod1.pdf` (156 páginas, empieza igual que C1) → `Teorias/mod1_teorias_completo.pdf`, mismo motivo.
- **Física 1 `teorias pedro 2023/`** → `Teorias/Mendoza/`. Firmado "Prof.: Dr. Pedro Mendoza Zélis".
  El número sale de **la primera página, no del nombre viejo**: `M2_clase4_2022.pdf` dice "Clase 5
  Módulo 2" pero es Elasticidad y estática de fluidos, y `M2_clase5_2022.pdf` es Dinámica de
  fluidos → 04 y 05; `M2_Clase4_2023.pdf` es la Clase 3; `M2_Clase7_2023.pdf` es la Clase 6;
  `modulo2_clase11.pdf` es la Clase 10. Las dos guías de TP (`Guía Mod 1 1S2024.pdf`,
  `Guía MII 2S2023.pdf`) van a `Practicas/`.
- **Física 1 laboratorios**: `laboratorios/` son informes del dueño; `labs/` son correcciones de otro
  grupo ("Alvarez Santiago"). El número es el de Classroom Grupo G 2024 (1 Roce, 2 Resorte, 3
  Momento de inercia). Los dos "Resorte" son el mismo informe (121 palabras de diferencia): el más
  nuevo (`N°1`, 19/09/2024) es `02_resorte.pdf` y el anterior (`N°2`, 12/09) `02_resorte_borrador.pdf`.
  `Libro1JC.xlsx` tiene columnas X, F, ΔX, ΔF → `02_resorte_datos.xlsx`.
- **Física 1 parciales**: `parciales fisica.pdf` es "Física I – Módulo 1 – 1° fecha 28-4-22"
  (escaneo); `parcial 2.pdf` dice "Mód2 1er Parc. 1ra fecha 28-06-18"; `sin fecha.pdf` dice
  "Módulo I – Segunda Fecha"; la foto `WhatsApp … 2025-11-16` es el enunciado de "Física I, MII,
  2da fecha 11-07-2024".
- **Las dos fotos `WhatsApp Image 2026-04-14 …` de `Fisica 1/parciales/`** son un ejercicio de
  Serie de Taylor a mano → `Matematica C/Parciales/mod1_2026-04-14_taylor_{1,2}.jpeg` (MC4 1S 2026
  tiene "ParcialitoTaylor" en abril 2026). Es inferencia: ver §4.
- **Matemática C fechas**: `25-05-06 Tema1.jpg` tiene mtime 2025-05-06 → el formato viejo es
  `AA-MM-DD`, así que `24-04-22` es 2024-04-22.
- **Matemática C `Apuntes/`** (apuntes de cátedra, "Facultad de Ingeniería – Matemática C – Módulo
  II") → `Bibliografia/`. `Resumen_series_numericas.pdf` ("MC-2do semestre 2025: Repaso de Series
  Numéricas", llegó por Novedades de MC2) → `Teorias/Rey Grange/`. Los dos "(Resumen)" sin
  autor quedan en la raíz como resúmenes del dueño.
- **Matemática B**: dos PDFs dicen "Comisión B3" y no hay docente conocido → `Teorias/` sin docente.
- **Física 2 `Documento_completo.pdf-PDFA.pdf`** es el "Libro de cátedra" de G25 → `Bibliografia/`.
  `ResumenClase1..4.docx` los generó el dueño (autor `python-docx juan cruz rodriguez`) y siguen al
  lado de su teoría.

## 2. Radio de impacto

| Qué se toca | Quién más lo lee | Qué pasa |
|---|---|---|
| Rutas y nombres de 116 archivos de `Ingenieria/` | `ObsidianUNLP_Vault/Ingenieria/**` (notas espejo + `00_MOC_*.md`) | **Nada**: el vault no se toca (decisión del dueño). Los wikilinks apuntan a las notas por nombre, no a los PDF, así que el vault no se rompe; sólo sigue desfasado, como ya lo estaba en Física 2. |
| Idem | `ObsidianUNLP_Vault/.neural_memory/` | No se toca. Su índice cita documentos por nombre de nota, no por ruta de PDF. |
| Idem | **Obsidian Sync** (`.obsidian/core-plugins.json`: `"sync": true`; la bóveda es `~/U.N.L.P` entero) | Los movimientos se propagan a los otros dispositivos. Obsidian **cerrado** durante la ejecución, para que no sincronice a mitad de camino. |
| Carpetas que sólo cambian mayúsculas (`teorias` → `Teorias`, `parciales` → `Parciales`, `laboratorios` → `Laboratorios`) | Un clon de `U.N.L.P` en Windows (el vault nació ahí: los MOC tienen rutas con `\`) | En un sistema que no distingue mayúsculas, un `git pull` puede dejar la carpeta vieja. Acá no pasa porque los archivos pasan a carpetas nuevas en el mismo commit; si hay un clon en Windows, verificarlo ahí después del pull. |
| `~/U.N.L.P` git | Los **515 cambios sin commitear de Informática** (`git status`, 2026-09-13) | No se tocan: todo `git add` va **por ruta**, limitado a las 4 materias. Nunca `git add -A` sin ruta, nunca `git stash`. |
| `courseDownloader` | Corte 2 de Classroom | Nada cambia en código. El corte 2 tiene que producir estos mismos nombres: lo toma la spec. |

## 3. Pasos

Todo en `~/U.N.L.P`. Variables de trabajo:

```bash
cd ~/U.N.L.P
PLAN=~/Dev/courseDownloader/docs/plan-unlp-formateo-ingenieria.tsv
MATERIAS=("Ingenieria/Fisica 1" "Ingenieria/Fisica 2" "Ingenieria/Matematica B" "Ingenieria/Matematica C")
SCRATCH=$(mktemp -d)
```

### Paso 1 — Precondiciones (si una falla, parar y reportar; no seguir)

```bash
pgrep -x obsidian                                           # sin salida: Obsidian cerrado (-x: nombre exacto; con -f se encuentra a sí mismo)
git branch --show-current                                   # main
git status --short -- "${MATERIAS[@]}" | grep -v '^??'      # sin salida: nada versionado modificado
test "$(find "${MATERIAS[@]}" -type f | wc -l)" = 121 && echo OK-121
test "$(tail -n +2 "$PLAN" | wc -l)" = 116 && echo OK-116
```

### Paso 2 — Chequeo en seco de la tabla

Cada origen existe, ningún destino existe ya y ningún destino se repite:

```bash
cd ~/U.N.L.P/Ingenieria
tail -n +2 "$PLAN" | while IFS=$'\t' read -r o d; do
  [ -e "$o" ] || echo "FALTA ORIGEN: $o"
  [ "$d" = BORRAR ] || [ ! -e "$d" ] || echo "YA EXISTE DESTINO: $d"
done
tail -n +2 "$PLAN" | cut -f2 | grep -v '^BORRAR$' | sort | uniq -d   # sin salida
cd ~/U.N.L.P
```

Salida esperada: **nada**. Cualquier línea → parar.

**Trampa medida (2026-09-13)**: `Matematica C/Proyección Ortogonal y Bases Ortogonales (Resumen).pdf`
está en disco en Unicode **NFD** (la tilde es un carácter aparte) y los demás nombres con tilde en
NFC. La fila de la tabla guarda los bytes exactos del disco. Si alguien edita la TSV (C-3, §4) con
un editor que normalice Unicode, esa fila deja de encontrar su origen: el Paso 2 lo detecta como
`FALTA ORIGEN`. Arreglo: copiar el nombre desde `ls`, no tipearlo.

### Paso 3 — Manifiesto de contenido y commit del estado previo

El manifiesto permite probar al final que no se perdió ni se duplicó ningún archivo. El commit deja
en git lo que hoy no está versionado (41 archivos: lo nuevo de Física 2 y `Fisica 1/Finales/`),
para que el borrado del cronograma y los renombres sean recuperables.

```bash
find "${MATERIAS[@]}" -type f -print0 | xargs -0 md5sum | cut -d' ' -f1 | sort > "$SCRATCH/antes.md5"
git add -- "${MATERIAS[@]}"
git commit -m "chore(ingenieria): estado previo al formateo de carpetas y nombres"
```

`parciales/mod 1.zip` no entra al commit (`*.zip` está en `.gitignore`); no importa, es copia exacta.

### Paso 4 — Aplicar la tabla

```bash
cd ~/U.N.L.P/Ingenieria
tail -n +2 "$PLAN" | while IFS=$'\t' read -r o d; do
  if [ "$d" = BORRAR ]; then rm -- "$o"
  else mkdir -p -- "$(dirname -- "$d")" && mv -n -- "$o" "$d"
  fi
done
find "Fisica 1" "Fisica 2" "Matematica B" "Matematica C" -depth -type d -empty -delete
cd ~/U.N.L.P
```

`mv -n` nunca pisa: si el Paso 2 dio limpio, no hay con qué chocar.

### Paso 5 — Commit

```bash
git add -A -- "${MATERIAS[@]}"
git status --short -- "${MATERIAS[@]}" | grep -v '^R' | head      # sólo el borrado del .xls (D) y ningún ??
git commit -m "refactor(ingenieria): formato de carpetas y nombres sencillos en Física 1, Física 2 y Matemática B y C"
```

**No hacer `git push`**: lo decide el dueño después de mirar el resultado.

### Paso 6 — Verificación (pegar la salida literal en el reporte)

```bash
cd ~/U.N.L.P
git log --oneline -3
# 1. Cantidades por materia: 66, 35, 5, 13 (total 119)
for m in "${MATERIAS[@]}"; do printf '%4s  %s\n' "$(find "$m" -type f | wc -l)" "$m"; done
# 2. Contenido: el de antes menos los 2 borrados, ni uno más ni uno menos
find "${MATERIAS[@]}" -type f -print0 | xargs -0 md5sum | cut -d' ' -f1 | sort > "$SCRATCH/despues.md5"
diff "$SCRATCH/antes.md5" "$SCRATCH/despues.md5"                  # exactamente 2 líneas "<", ninguna ">"
# 3. Carpetas: exactamente estas 23
find "${MATERIAS[@]}" -type d | sort
# 4. Ningún nombre de archivo con mayúscula, espacio o tilde
find "${MATERIAS[@]}" -type f -printf '%f\n' | grep -E '[A-ZÁÉÍÓÚÑáéíóúñ ]'   # sin salida
# 5. Nada fuera de las 4 materias entró a los commits
git show --name-only --format= HEAD~1 HEAD | grep . | grep -v '^Ingenieria/'  # sin salida
# 6. Informática sigue con sus cambios sin commitear
git status --short | wc -l
```

Carpetas esperadas en el punto 3:

```
Ingenieria/Fisica 1
Ingenieria/Fisica 1/Finales
Ingenieria/Fisica 1/Laboratorios
Ingenieria/Fisica 1/Parciales
Ingenieria/Fisica 1/Practicas
Ingenieria/Fisica 1/Teorias
Ingenieria/Fisica 1/Teorias/Mendoza
Ingenieria/Fisica 2
Ingenieria/Fisica 2/Bibliografia
Ingenieria/Fisica 2/Parciales
Ingenieria/Fisica 2/Practicas
Ingenieria/Fisica 2/Teorias
Ingenieria/Fisica 2/Teorias/Bianchi
Ingenieria/Fisica 2/Teorias/Palacio
Ingenieria/Matematica B
Ingenieria/Matematica B/Parciales
Ingenieria/Matematica B/Practicas
Ingenieria/Matematica B/Teorias
Ingenieria/Matematica C
Ingenieria/Matematica C/Bibliografia
Ingenieria/Matematica C/Parciales
Ingenieria/Matematica C/Teorias
Ingenieria/Matematica C/Teorias/Rey Grange
```

En el punto 6 el número es el de antes del plan (515 al 2026-09-13) menos 0: el plan no toca
Informática.

## 4. Lo que falta confirmar, y cómo se procede

Nada de esto bloquea los pasos 1 a 6. Cada ítem dice qué lo destraba y qué cambia.

| # | Qué falta | Cómo se confirma | Si da sí | Si da no |
|---|---|---|---|---|
| M-1 | ¿`Teorias/mod1_01..09_*` y `mod1_teorias_completo.pdf` de Física 1 son de Lucila? | Bajar los 12 adjuntos de "Clases teóricas - Módulo I" del Classroom de Física I (a mano o con el corte 2) a una carpeta aparte y comparar md5 con los 9 PDFs. | `git mv` de esos archivos a `Teorias/Lucila/`, conservando sus nombres nuevos. | Quedan en `Teorias/` con docente incierto, salvo que aparezcan firmados. |
| M-2 | Apellido de Sonia (Química para Ingeniería, Q5) | No está en Classroom (Personas lista sólo la cuenta "Comision Q5"). El dueño lo busca en SIU Guaraní o en el Moodle de la cátedra. | Cuando haya material: `Ingenieria/Quimica/Teorias/` (una sola docente → sin subcarpeta). | Igual: el curso está vacío, no hay nada que bajar. |
| M-3 | Apellido de Lucila (Física 1) | Classroom la muestra como "Lucila Física". El dueño lo confirma o se busca en los PDF de Módulo II que baje el corte 2. | La carpeta de M-1 es `Teorias/<Apellido>/`. | `Teorias/Lucila/`. |
| C-1 | Las fotos de Taylor (`Matematica C/Parciales/mod1_2026-04-14_taylor_*.jpeg`) | El dueño las mira: ¿son de Matemática C? ¿Parcialito o práctica? | Quedan. | `git mv` a donde diga el dueño. |
| C-2 | Docente de las teorías de Matemática B (Comisión B3 vs. el Classroom MB5) | El dueño. | `Teorias/<Apellido>/` si hay dos docentes. | Quedan en `Teorias/`. |
| C-3 | Temas elegidos en la tabla (por ejemplo `mod1_04_aceleracion`, `mod2_07_modelos_fisicos`) | El dueño revisa la TSV **antes** de ejecutar y la corrige a mano. | — | — |

**Después del plan**: la spec `docs/specs/classroom-destino/` se reescribe con este formato como
regla (reemplaza los supuestos 5, 13 y 22 de la ronda 1) y el corte 2 del plan de Classroom tiene
que producir exactamente estos nombres, con la tabla nombre de Classroom → nombre sencillo por curso.

## 5. Qué tiene que traer el reporte

- La salida literal de los pasos 1, 2 y 6.
- Los hashes de los 2 commits.
- **Hallazgos**: todo lo que se vio y no se hizo porque la tabla no lo nombraba (un archivo nuevo
  que apareció, un destino raro, una carpeta vacía que no se borró).
