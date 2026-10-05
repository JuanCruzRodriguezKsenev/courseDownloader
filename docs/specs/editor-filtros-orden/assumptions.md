# Traza de supuestos — editor-filtros-orden

Historia (dueño, 2026-10-05): «a la página le falta un filtro, un ordenar, etc etc».

Los 21 supuestos se **resolvieron** por aprobación íntegra del dueño («aprobado sin leer arma el plan») el 2026-10-05. Hallazgo previo de la exploración: el editor ya tenía chips, «Solo problemas» y búsqueda; lo que faltaba era todo el orden y los filtros de fila.

| # | Supuesto | Estado |
|---|---|---|
| A1 | Filtros y orden son sólo de vista; no cambian lo guardado ni el orden de descarga | resuelto |
| A2 | Todo en el editor; sin cambios en servidor ni índice | resuelto |
| A3 | Alcance: temas del curso, filas de archivos y lista de cursos | resuelto |
| A4 | Sin vista cruzada de varios cursos | resuelto |
| A5 | Los seis chips siguen filtrando temas enteros | resuelto |
| A6 | Filtro de fila: dentro de cada tema sólo las filas que cumplen; temas sin ninguna se ocultan | resuelto |
| A7 | Filtros nuevos: acción, videollamadas, tipo (extensión) | resuelto |
| A8 | Los filtros nuevos se combinan con Y con chip y búsqueda | resuelto |
| A9 | Un solo valor por familia | resuelto |
| A10 | La búsqueda también encuentra por carpeta destino | resuelto |
| A11 | Los contadores de chips cuentan el curso entero | resuelto |
| A12 | Orden de temas: como vienen, A→Z, Z→A, más archivos, problemas primero | resuelto |
| A13 | Orden de archivos: como vienen, nombre original, tipo | resuelto |
| A14 | El orden de archivos nunca usa el nombre editable ni el destino | resuelto |
| A15 | Orden de cursos: como vienen, A→Z, más para revisar primero | resuelto |
| A16 | Selectores «Mostrar» y «Ordenar» en la barra de herramientas junto a la búsqueda | resuelto (ver D-4) |
| A17 | Orden de temas y de archivos en selectores separados | resuelto (ver D-4) |
| A18 | Botón «Limpiar filtros» cuando hay algo activo | resuelto |
| A19 | Al cambiar de curso se reinicia la vista | resuelto |
| A20 | Nada se persiste (sin `localStorage`) | resuelto |
| A21 | Al buscar o filtrar, los temas con coincidencias se expanden solos | resuelto |

## Derivados al escribir la spec (cierran huecos, no son preguntas)

| # | Hueco | Decisión |
|---|---|---|
| D-1 | Acciones de tema con filas ocultas | Actúan sobre todas; el encabezado dice «mostrando X de Y» |
| D-2 | Fila que deja de cumplir el filtro al editarla | Sale en el siguiente dibujo |
| D-3 | Tema que se resuelve con «Problemas primero» | Se reubica en el siguiente dibujo |
| D-4 | A16/A17 hablaban de dos selectores | Son cuatro: Mostrar, Tipo, Temas, Archivos |
