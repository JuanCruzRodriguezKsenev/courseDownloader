# Traza de supuestos — Moodle del LINTI

Ronda única, 2026-10-01. El dueño respondió **«aprobado sin leer»** a los 23 supuestos: quedan `resuelto` por aprobación en bloque. Lo que sigue lo leyó tanda contra el código; sólo el 14 cambió.

| # | Supuesto | Estado | Decisión y porqué |
|---|---|---|---|
| 1 | `id` del portal = `moodle-linti` | resuelto | Carpeta y prefijo del índice; decisión de datos (AGENTS.md §id). → RN-1 |
| 2 | Sólo `resource` y `folder` como adjuntos | resuelto | → RN-2 |
| 3 | `url` → acceso `.md`; sin intermedia → URL de Moodle | resuelto | `destino:RN-17`. → RN-9, M-4 |
| 4 | `forum`, `quiz`, `page`, `choice` se ignoran | resuelto | → RN-2 |
| 5 | Se escanea el curso de la pestaña | resuelto | → RN-3 |
| 6 | Sólo `catedras.linti.unlp.edu.ar` | resuelto | → Alcance |
| 7 | Clave del `resource` = `cmid` | resuelto | → RN-5 |
| 8 | Clave de un archivo de `folder` = `<cmid>/<ruta interna>` | resuelto | ADR-0014: dos archivos del mismo `folder` no comparten clave. → RN-5 |
| 9 | Tema = sección; la primera sin nombre → raíz | resuelto | Reusa `Sin tema` (`core/destino/propuesta.ts:135`, `carpetas.ts:16`), sin cambio de core. → RN-4 |
| 10 | Subcarpetas del `folder` se aplanan; nombre sólo si hay choque | resuelto | → RN-7 |
| 11 | Nombre sale de la URL | resuelto | `Content-Disposition` llega roto (medición). → RN-6 |
| 12 | Un archivo reemplazado no se re-baja | resuelto | → RN-12 |
| 13 | Heredan las reglas del destino | resuelto | → RN-13 |
| 14 | Sugerencia de carpeta sólo por nombre de sección | **cambiado** | `sugerirDestino` (`carpetas.ts:31`) ya cae a las `publicacion` si el tema no dice nada. Desactivarlo sería código nuevo. → RN-8 |
| 15 | Cada cuatrimestre es un curso nuevo (asociación nueva) | resuelto | → RN-13 (`destino:RN-1`) |
| 16 | Login = sesión vencida: pausa sistémica | resuelto | Regla «por ítem vs sistémico» del procesador. → RN-10 |
| 17 | 404 saltea el archivo | resuelto | → RN-11 |
| 18 | Página HTML en vez de archivo → rechazo | resuelto | Ya lo hace `procesadorCola.ts:548`. → RN-11 |
| 19 | Asociación por el editor del 2c | resuelto | → RN-14 |
| 20 | Lista igual a la de Classroom | resuelto | → RN-14 |
| 21 | Sólo modo destino | resuelto | → Alcance |
| 22 | Moodle se ejecuta después del 2b y 2c | resuelto | → Dependencias |
| 23 | Fixture sin datos personales; medir un segundo curso y un folder anidado | resuelto | → NFR-2, M-1, M-2 |

## Derivados

- M-3: el resolver debe correr desde el service worker (la cola baja desde ahí); medir desde la pestaña miente (AGENTS.md patrón 2).
- M-4: la intermedia de `url` sólo se midió en dos de los tres casos del curso.
- PA-1: URL de sondeo de internet.
