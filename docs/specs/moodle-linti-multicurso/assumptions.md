# Traza de supuestos — Moodle del LINTI multicurso

Los 16 supuestos se mostraron en lista y el dueño respondió **«Ninguno»** (2026-10-05): quedan aprobados tal cual, sin ronda de preguntas.

| # | Supuesto | Estado |
|---|---|---|
| 1 | «Escanear todos» en `/my/` y `/my/courses.php` (y subrutas de `/my/`) | resuelto |
| 2 | Se ofrece también con un solo curso; abrir el popup ahí no escanea solo | resuelto |
| 3 | Levanta la exclusión de `linti:RN-3`; el escaneo de un curso suelto no cambia | resuelto |
| 4 | Termina en la lista agrupada por curso, que reemplaza a la guardada; no descarga | resuelto |
| 5 | Entran todos los ids de `course/view.php?id=` de la página, desduplicados, con años anteriores | resuelto (M-2 verifica) |
| 6 | Recorrido en serie con `fetch` desde la pestaña, sin paralelo ni pestañas de fondo | resuelto |
| 7 | Cada curso se escanea como hoy (`linti:RN-1..13`); otros tipos no se listan | resuelto |
| 8 | La clave del ítem lleva su curso (ADR-0014) | resuelto |
| 9 | Curso sin material: no aparece, cuenta como vacío | resuelto |
| 10 | Tope de 60 s por curso; otra falla saltea con motivo | resuelto |
| 11 | Sesión vencida pausa con aviso de sesión | resuelto |
| 12 | Navegar fuera de `/my/` o cerrar la pestaña corta el recorrido; se conservan los completos | resuelto |
| 13 | Cerrar el popup no corta; al reabrir se ve progreso o resultado | resuelto |
| 14 | Resumen final: con material, vacíos, fallidos con motivo | resuelto |
| 15 | Páginas de Moodle que no son curso ni portada siguen sin reconocerse | resuelto |
| 16 | Fixtures sanitizados; concurrencia ≤ 4 dentro de un curso, serie entre cursos | resuelto |

**Hechos medidos (2026-10-05, Script D en `/my/courses.php`):** 3 cursos (`1331`, `1352`, `1371`), 26/22/27 actividades, sin duplicados, 320–645 ms por curso por `fetch`, todos 200 sin ir a login.

**A medir:** M-1 (tiempo del recorrido armado), M-2 (que «Todos» liste los 3 y sin paginación), M-3 (el `fetch` avanza con la pestaña en segundo plano).
