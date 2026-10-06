# Traza de supuestos — Moodle Asignaturas multicurso

Los 14 supuestos se aprobaron **en bloque y sin leer** (el dueño, 2026-10-05). Ninguno fue rechazado.

| # | Supuesto | Estado |
|---|---|---|
| 1 | Corte propio de `moodle-asignaturas`, spec nueva que hereda de Ingeniería y `asig:` | asumido |
| 2 | Incluye «Escanear todos» desde `/my/`; no descarga solo; el escaneo de un curso no cambia | asumido |
| 3 | Con un solo curso, el botón se ofrece igual (Curso 1 de 1) | asumido |
| 4 | Entran los cursos de «Mis cursos», desduplicados, con los de años anteriores | asumido |
| 5 | Cada curso se escanea con la regla de hoy; RN-4a (desduplicar por `cmid`) sigue activa | asumido |
| 6 | La resolución del `resource` incrustado no cambia | asumido |
| 7 | Los `label` con Kaltura siguen sin listarse | asumido |
| 8 | Tope de 60 s por curso; el tiempo de resolver `url`/`resource` queda como M-1 | asumido |
| 9 | Sesión vencida pausa con aviso; otras fallas saltean el curso con motivo | asumido |
| 10 | Sin entidades nuevas; reusa `recorridoTodos` y la lista guardada (se reemplaza) | asumido |
| 11 | La clave del ítem lleva su curso (ADR-0014) | asumido |
| 12 | Botón y loader de Classroom/Ingeniería; aviso de duración sale de M-1 | asumido |
| 13 | En `/my/` abrir el popup no escanea; en un curso escanea ese curso | asumido |
| 14 | `esPortada` para `/my/` (`core/puertos/sitio.ts:300`) | asumido |

**Mediciones:** M-2 de Ingeniería queda resuelto acá (`/my/` = «Todos» = 1 curso). M-1 y M-3 pendientes.
