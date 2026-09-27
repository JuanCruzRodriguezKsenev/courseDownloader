# Supuestos — Loader con progreso (un curso y recorrido) + Estado primero en filtros

Traza del refinamiento. Estados: `asumido` · `rechazado` · `resuelto` · `a medir`.
Última actualización: 2026-09-27. **El dueño aprobó 1–22 sin leerlos**; 23–25 son derivados de su pedido de volver a la portada, escritos por la tanda y no vistos por él.

| # | Categoría | Supuesto | Estado |
|---|---|---|---|
| 1 | Alcance | El progreso del recorrido deja la tarjeta de la lista y pasa entero al loader, que tapa la lista | resuelto (aprobado sin leer) |
| 2 | Alcance | Progreso detallado sólo en Classroom; Ramón Net y Anatomy suman sólo tiempo transcurrido | resuelto (aprobado sin leer) |
| 3 | Alcance | El resumen final del recorrido (nota + tarjeta "no trajo material") queda fuera del loader, igual que hoy | resuelto (aprobado sin leer) |
| 4 | Alcance | Sin botón Cancelar en este corte | resuelto (aprobado sin leer) |
| 5 | Alcance | Filtros: Estado primero siempre en Disponibles; la Cola no cambia | resuelto (aprobado sin leer) |
| 6 | Reglas | Un curso de Classroom: nombre, fase, ítems encontrados, tiempo transcurrido | resuelto (aprobado sin leer) |
| 7 | Reglas | Recorrido: "Curso i de N: nombre", Listos/Vacíos/Fallidos, fase e ítems del actual, tiempo total | resuelto (aprobado sin leer) |
| 8 | Reglas | Recorrido: "≈ N min restantes" por promedio de cursos terminados, desde el 2º | resuelto (aprobado sin leer) |
| 9 | Reglas | Recorrido: lista de todos los cursos con estado (✓ ○ ✗ ▸ ·) en el loader | resuelto (aprobado sin leer) |
| 10 | Reglas | Motivo de fallidos sólo en el resumen final | resuelto (aprobado sin leer) |
| 11 | Reglas | "Dejá Classroom al frente" en los dos; "Podés cerrar este popup" sólo en recorrido | resuelto (aprobado sin leer) |
| 12 | Datos | Progreso de un curso vive sólo con el popup abierto | resuelto (aprobado sin leer) |
| 13 | Datos | Progreso del recorrido sobrevive a cerrar/reabrir el popup | resuelto (aprobado sin leer) |
| 14 | Errores | Aviso de un curso: loader se apaga, aviso en tarjeta como hoy | resuelto (aprobado sin leer) |
| 15 | Errores | Recorrido cortado: loader se apaga, resumen parcial | resuelto (aprobado sin leer) |
| 16 | UX | Spinner, título, detalle; lista del recorrido debajo con scroll propio | resuelto (aprobado sin leer) |
| 17 | UX | Tiempo en formato `1:23` | resuelto (aprobado sin leer) |
| 18 | UX | Actualizaciones de progreso no esperan el piso de 500 ms; el piso sigue para títulos | resuelto (aprobado sin leer) |
| 19 | NFR | Detalle refrescado como mucho cada 500 ms | resuelto (aprobado sin leer) |
| 20 | NFR | Reportar progreso no agrega esperas al escaneo | resuelto (aprobado sin leer) |
| 21 | Integración | Un curso de Classroom reporta por el canal del recorrido (ADR-0016) | resuelto (aprobado sin leer) |
| 22 | Integración | El loader pasa a isla Preact propia y cierra la parte "sin dueño" de la deuda 🔴 | resuelto (aprobado sin leer) |
| 23 | Reglas (derivado) | Al terminar, el recorrido vuelve a la portada de activos `/h` por SPA | asumido (no visto) |
| 24 | Reglas (derivado) | Si el recorrido se corta, la pestaña no se mueve | asumido (no visto) |
| 25 | Errores (derivado) | Si la vuelta falla, el recorrido sigue `terminado` | asumido (no visto) |
