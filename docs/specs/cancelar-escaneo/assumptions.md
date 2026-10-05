# Supuestos — Cancelar el escaneo

Historia: "debería haber algún botón para cancelar el escaneo" (dueño, 2026-09-27).
Enmienda el "No incluye" de [`../loader-con-progreso/spec.md`](../loader-con-progreso/spec.md).

Contexto leído: el recorrido ya tiene estado terminal `cortado` con `motivoCorte`
(`core/estado/recorridoTodos.ts:24,46`); el scraper de Classroom ya sabe frenar un curso a mitad
con `idCancelacion` (`sitio/google-classroom/scraper.js:89-93,1154`), hoy sólo para el tope por curso.
Botones de cancelar existentes: `.btn-cancel` (`styles/components/actions.css:102`).

| # | Supuesto | Estado |
|---|---|---|
| 1 | El botón está en el recorrido de todos los cursos | resuelto (aceptado sin leer, 2026-09-27) |
| 2 | El botón está también en el escaneo de un curso de Classroom | resuelto (aceptado sin leer, 2026-09-27) |
| 3 | En Ramón Net y Anatomy no hay botón (su escaneo dura segundos) | resuelto (aceptado sin leer, 2026-09-27) |
| 4 | El loader sin detalle (conectando, sincronizando) no tiene botón | resuelto (aceptado sin leer, 2026-09-27) |
| 5 | Cancelar el recorrido conserva los cursos ya terminados y muestra el resumen parcial, como un corte (RN-17) | resuelto (aceptado sin leer, 2026-09-27) |
| 6 | El curso que se estaba escaneando al cancelar se descarta: no cuenta ni como listo ni como fallido | resuelto (aceptado sin leer, 2026-09-27) |
| 7 | Cancelar un curso descarta lo encontrado; la lista queda como estaba antes de escanear | resuelto (aceptado sin leer, 2026-09-27) |
| 8 | Cancelar no pide confirmación | resuelto (aceptado sin leer, 2026-09-27) |
| 9 | Cancelar deja la pestaña donde está, no vuelve a la portada (como RN-21) | resuelto (aceptado sin leer, 2026-09-27) |
| 10 | El resumen parcial dice "Cancelaste el recorrido", distinto del aviso de corte por visibilidad | resuelto (aceptado sin leer, 2026-09-27) |
| 11 | Tras cancelar, se puede volver a lanzar el recorrido igual que tras un corte | resuelto (aceptado sin leer, 2026-09-27) |
| 12 | Se puede cancelar desde el popup reabierto a mitad del recorrido (RN-16) | resuelto (aceptado sin leer, 2026-09-27) |
| 13 | El botón dice "Cancelar" y va en la fila "Escaneando…", a la derecha | resuelto (aceptado sin leer, 2026-09-27) |
| 14 | El botón usa el estilo secundario de `.btn-cancel` (borde, sin relleno de color) | resuelto (aceptado sin leer, 2026-09-27) |
| 15 | Al tocarlo pasa a "Cancelando…" deshabilitado hasta que el escaneo se frena | resuelto (aceptado sin leer, 2026-09-27) |
| 16 | Esc no cancela | resuelto (aceptado sin leer, 2026-09-27) |
| 17 | El escaneo se frena en ≤ 1 s desde el clic | resuelto (aceptado sin leer, 2026-09-27) |
| 18 | Si la pestaña no confirma en 3 s, el popup apaga el loader igual y da el escaneo por cancelado | resuelto (aceptado sin leer, 2026-09-27) |
