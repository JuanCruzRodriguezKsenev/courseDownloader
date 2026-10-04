# Trazas — subcarpeta por tema

Estado: todos resueltos el 2026-10-04. El dueño aceptó los 21 supuestos («perfecto, armá el plan»).

| # | Supuesto | Estado |
|---|---|---|
| 1 | Aplica a todos los destinos con carpeta | resuelto (RN-1) |
| 2 | Destino `.` y `-` sin subcarpeta | resuelto (RN-2) |
| 3 | Novedades/Sin tema sin subcarpeta | resuelto (RN-3) |
| 4 | Cuatro portales, misma función | resuelto (RN-4) |
| 5 | docente antes que tema | resuelto (RN-5) |
| 6 | Mayúscula inicial, sin acentos, inválidos → `-` | resuelto (RN-6) |
| 7 | Espacios conservados | resuelto (RN-7) |
| 8 | Nombre vacío → sin subcarpeta | resuelto (RN-8) |
| 9 | Mismo nombre comparten carpeta | resuelto (RN-9) |
| 10 | Sin umbral | resuelto (RN-10) |
| 11 | `modN_` se conserva | resuelto (RN-11) |
| 12 | `ya-esta` no se mueve | resuelto (RN-12) |
| 13 | `destinoPropio` sin subcarpeta | resuelto (RN-13) |
| 14 | Heredar incluye la subcarpeta | resuelto (RN-14) |
| 15 | Flag `subcarpeta` en el índice | **resuelto con cambio**: estado derivado de la carpeta guardada, sin campo en el índice (RN-15). Motivo: `core/destino/propuesta.ts:133` |
| 16 | Reconocer carpeta existente por nombre | resuelto reducido: sólo nombre exacto, sin reconocer mayúsculas (PA-1) |
| 17 | Casilla por tema, encendida por defecto en nuevos | resuelto (RN-17) |
| 18 | Interruptor por curso | resuelto (RN-18) |
| 19 | Ruta en vivo con subcarpeta | resuelto (RN-19) |
| 20 | Se crean al usarlas | resuelto (RN-16) |
| 21 | Test de paridad editor/núcleo | resuelto (NFR-1, AC-14) |

Derivado nuevo: RN-20 (omitir/destino `.` y volver recuerda el estado), a partir del hallazgo de `destinosPrevios`.
