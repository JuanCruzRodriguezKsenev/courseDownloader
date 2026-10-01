# Traza de supuestos — Moodle de Asignaturas

Ronda 2026-10-01. Hereda de `docs/specs/moodle-linti/assumptions.md` y adapta las decisiones específicas a `asignaturas.info.unlp.edu.ar` a partir de la medición en vivo sobre el curso `id=82` (Programación 2).

**Autor**: tanda (Antigravity, Gemini 3.8 Flash High)
**Firmado**: tanda agy 3.8 flash high

| # | Supuesto | Estado | Decisión y porqué |
|---|---|---|---|
| 1 | `id` del portal = `moodle-asignaturas` | resuelto | Prefijo en el índice `moodle-asignaturas:<cmid>` y clave `moodle-asignaturas:82`. Distingue de `moodle-linti`. → RN-1 |
| 2 | Sólo `resource` y `folder` como adjuntos | resuelto | → RN-2 |
| 3 | `url` → acceso `.md`; intermedia con `.urlworkaround a` | resuelto | Se midió en Google Forms. → RN-9 |
| 4 | `forum`, `quiz`, `choicegroup`, `assign` y `label` se ignoran como descargas binarias | resuelto | Tareas y foros se descartan; videos en labels no bajan como binario (política transversal). → RN-2 |
| 5 | Se escanea el curso de la pestaña | resuelto | → RN-3 |
| 6 | Sólo `asignaturas.info.unlp.edu.ar` | resuelto | Host específico del portal. → Alcance |
| 7 | Clave del `resource` = `cmid` | resuelto | → RN-5 |
| 8 | Clave de un archivo de `folder` = `<cmid>/<ruta interna>` | resuelto | ADR-0014. → RN-5 |
| 9 | Tema = sección; la primera sin nombre («General») → `Sin tema` | resuelto | → RN-4 |
| 10 | Desduplicación por `cmid` obligatoria en el scraper | resuelto | Moodle 4 anida secciones en el DOM (Sec 4 y 5 idénticas). Sin Set duplicaría 132 ítems. → RN-4a |
| 11 | `resource` resuelve mediante regex de `pluginfile.php` sobre el HTML | resuelto | Moodle incrusta el visor HTML; no hay 302 directo. La URL viaja en el DOM/HTML. → RN-6, RN-10 |
| 12 | Nombre sale de la URL final decodificada | resuelto | → RN-6 |
| 13 | Sondeo de conectividad contra la raíz `/` | resuelto | `/favicon.ico` da 404; `/` responde 200 OK sin CORP. → PA-1 |
| 14 | Mapeo al árbol de la Bóveda en `~/Boveda/Areas/Facultad/Informatica/Programacion 2` | resuelto | Ya existen archivos y subcarpetas (`1. imperativo`, `2. objetos`, `3. concurrente`). → RN-13 |

Firmado: tanda agy 3.8 flash high
