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
  `docs/plan-unlp-formateo-ingenieria.tsv` (116 filas).
- Hechos que ya no son supuesto: en `~/U.N.L.P`, `Ingenieria/` no tiene archivos versionados
  modificados (41 sin agregar, todos nuevos de Física 2 y `Fisica 1/Finales/`); los 515 cambios
  pendientes son de Informática, así que el plan commitea por ruta.

## Ronda 1 — 2026-09-13

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
