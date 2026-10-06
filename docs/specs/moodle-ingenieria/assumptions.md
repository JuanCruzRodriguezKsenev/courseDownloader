# Moodle de Ingeniería — traza de supuestos

**Fecha**: 2026-10-05
**Firmado**: tanda claude sonnet 5.5

> El dueño aprobó los 25 supuestos **en bloque y sin leerlos** (2026-10-05: *"aprobado sin leer"*).
> Ninguno fue discutido. Todos quedan `asumido`, salvo los marcados `a medir`.

| # | Supuesto | Estado | Nota |
|---|---|---|---|
| 1 | Portal nuevo `moodle-ingenieria`, adaptador propio, host `www.asignaturas.ing.unlp.edu.ar` | asumido | La spec de Informática excluye otros Moodle: cada uno es portal independiente |
| 2 | Clave de curso `moodle-ingenieria:<id>` | asumido | |
| 3 | Entran `resource`, `folder` (adjuntos) y `url` (`.md`); no `forum`, `quiz`, `assign`, `label`, `page` | asumido | Medido: Física II trae 27 `quiz` |
| 4 | Escaneo por curso = pestaña abierta en `course/view.php?id=N` | asumido | Igual que `asignaturas:RN-3` |
| 5 | Botón «Escanear todos los cursos» en `/my/`; abrir el popup no escanea solo | asumido | Hereda `escanear-todas:RN-1` |
| 6 | Reusa `recorridoTodos` y `esPortada` del núcleo | asumido | Verificado en `core/estado/recorridoTodos.ts` y `core/puertos/sitio.ts:300` |
| 7 | Entran todos los cursos de «Mis cursos», incluidos los de 2023 | asumido | Medido: 9 cursos en `/my/` |
| 8 | Cursos sin material: vacíos en el resumen, fuera de la lista | asumido | Medido: 3 de los 9 casi vacíos |
| 9 | El recorrido pide cada `course/view.php?id=N` con `fetch` desde `/my/`, en serie, sin pestañas | asumido | Medido desde pestaña: 180–850 ms por curso, HTML trae las actividades. **M-1** cubre el service worker |
| 10 | Tope de 60 s por curso | asumido | `topeEscaneoMs` de `moodle-asignaturas` |
| 11 | Un curso que falla se saltea; motivo en el resumen | asumido | Hereda `escanear-todas:RN-8` |
| 12 | Cerrar el popup no corta el recorrido | asumido | Hereda `escanear-todas:RN-15` |
| 13 | Navegar fuera de `/my/` corta el recorrido; se conservan los completos | asumido | Hereda `escanear-todas:RN-9` |
| 14 | El recorrido termina en la lista; no encola ni baja | asumido | Hereda `escanear-todas:RN-4` |
| 15 | Claves: `resource` = `cmid`; `folder` = `<cmid>/<ruta>`; `url` = `acceso:<url>:<título>` | asumido | Igual a `asignaturas:RN-5` |
| 16 | Nombre original = último segmento decodificado de `pluginfile.php`, sin query | asumido | Medido: los del `folder` traen `?forcedownload` |
| 17 | Subcarpetas de un `folder` se aplanan | asumido | `asignaturas:RN-7` |
| 18 | Tema = nombre de la sección; sección 0 con nombre propio se usa tal cual | asumido | Medido: sección 0 = «Anuncios Parroquiales» |
| 19 | Resolver `resource` = seguir el 302; respaldo regex si responde HTML | asumido | Medido: 302 a `pluginfile.php`, `application/pdf` |
| 20 | Destino por índice (`destinoPorIndice: true`), asociación en el editor, valen `destino:RN-1..30` | asumido | |
| 21 | Nombre «Moodle Ingeniería (UNLP)», color propio | asumido | |
| 22 | Lista multicurso agrupada por curso, reemplaza a la guardada | asumido | Hereda `escanear-todas:RN-18` |
| 23 | Aviso previo con duración estimada, sin pedir la pestaña al frente | a medir | Depende de **M-1** (duración) y **M-3** (si pinta en segundo plano) |
| 24 | Concurrencia ≤ 4 dentro de un curso | asumido | `asignaturas:NFR-3`; el scraper de Informática ya lo hace (`scraper.js:99`) |
| 25 | Fixtures sanitizados; baseline de tests intacta | asumido | |

## Mediciones pendientes

| M | Qué | Supuestos |
|---|---|---|
| M-1 | Duración real del recorrido de los 9 cursos desde el service worker, con la resolución de `url` y `folder` | 9, 23 |
| M-2 | Que los ids de `/my/` sean todos los cursos del dueño (hay un filtro «en progreso» y paginación) | 7 |
| M-3 | Que la pestaña `/my/` en segundo plano siga corriendo el `fetch` | 23 |

Firmado: tanda claude sonnet 5.5
