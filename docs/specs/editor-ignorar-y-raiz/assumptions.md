# Traza de supuestos — editor-ignorar-y-raiz

Historia (dueño, 2026-10-04): «en la página de la extensión no hay una forma de decir "estas videollamadas ignoralas", al igual que tampoco se puede sacar de revisión una carpeta que va a la raíz».

Todos los supuestos se **resolvieron** por aprobación íntegra del dueño («aprobado sin leer») el 2026-10-04.

| # | Supuesto | Estado |
|---|---|---|
| A1 | Sólo cambia el editor web; el popup no recibe controles nuevos | resuelto |
| A2 | El índice no cambia, sin campos nuevos ni migración | resuelto |
| A3 | Botón por curso «Omitir N videollamadas» que marca `omitir` en todas | resuelto |
| A4 | Acción puntual, no regla: una videollamada nueva llega sin omitir | resuelto |
| A5 | Botón inverso «Volver a ofrecerlas» | resuelto |
| A6 | El botón sólo aparece si hay videollamadas, con el conteo | resuelto |
| A7 | Se reconoce por el dominio de la URL en la clave `acceso:<url>:<título>` | resuelto |
| A8 | Una videollamada `ya-esta` nunca pasa a `omitir` | resuelto |
| A9 | Las filas de videollamada llevan la chip del popup | resuelto |
| A10 | `.` es un destino válido (raíz de la materia), no un faltante | resuelto |
| A11 | Tema con `.` y `regla: si` se ve «✓ Asignado» (incluye Novedades, Cronograma y guardados) | resuelto |
| A12 | Un tema nuevo con `regla: no` y destino `.` sigue «Sin destino» hasta que el dueño elija | resuelto |
| A13 | Elegir `.` en el selector cuenta como decisión de inmediato | resuelto |
| A14 | Una sola definición de «sin destino» para badge de curso, badge de tema, filtro y contador | resuelto |
| A15 | El selector rotula `.` como «Raíz de la materia» | resuelto |
| A16 | «Solo problemas» deja de incluir los temas a raíz decididos | resuelto |
| A18 | Un tema sin destino arranca su selector en «— elegir carpeta —» y `.` es elegible (el dueño eligió esta de cuatro opciones, 2026-10-04) | resuelto |
| A17 | El humo `humo-editor-indice.js` cubre las dos funciones | resuelto |

## Hechos hallados al leer el código (no eran supuestos)

- `vistas.ts` L246-251 ya da `regla: "si"` a un tema guardado con `.`.
- `editor.html` tiene **cuatro** copias de «`.` = sin asignar»: L1493, L1692, L1727 y L1640-1645.
- `core/destino/carpetas.ts` L16-17 manda Novedades y Cronograma a `.` con `regla: si`, y hoy el editor igual los marca.
- La lista de dominios de videollamada vive dentro de `esEnlaceVideollamada` en `sitio/google-classroom/scraper.js` (~L520), código inyectado que el editor no puede importar.
- El selector hoy rotula `.` como «. (raíz del curso)» (L1788) y «. (raíz)» por archivo (L1861), aunque `.` es la raíz de la materia.

## Hallazgos al planificar (2026-10-04)

- El handler del selector (`editor.html` L2150-2155) **ya** pone `regla = "si"`; lo que faltaba era poder disparar el evento con `.`. Ajustó A13 y dio origen a A18.
- `editor.html` tiene más copias de «`.` = sin asignar» que las cuatro de la spec: L1426 (temas a expandir), L1460 (curso inicial), L1493, L1640-1645, L1692, L1727 y el pseudo-tema huérfano L1681 (`regla: "no"`).
- «Aplicar reglas automáticas» (L2372) pisa todo tema en `.`: dio origen a RN-13 y AC-13.
- Guardar un tema sin destino sin tocarlo lo deja en `.` y al reabrir sale Asignado (RN-14).
