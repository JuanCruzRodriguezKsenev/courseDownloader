---
name: moodle-ingenieria-spec
description: Sexto portal (Moodle de Ingeniería, host con www): spec escrita 2026-10-05, mediciones del dueño, qué falta; segundo sitio nuevo sin dar
metadata:
  type: project
---

Spec `docs/specs/moodle-ingenieria/spec.md` (+ `assumptions.md`), estado `draft`, escrita 2026-10-05. 25 supuestos aprobados
"sin leer". Por curso + recorrido de todos desde `/my/` reusando `core/estado/recorridoTodos.ts` y `esPortada`.

**Mediciones del dueño (consola de su Chrome, scripts A/B/C/D/E):** resource = 302 directo a `pluginfile.php` (no incrusta);
sin duplicados; el HTML de `course/view.php` trae las actividades (180–850 ms); 9 cursos en `/my/`; folder se lee de
`mod/folder/view.php` (links con `?forcedownload`). Física II tiene 27 quiz.

**Why:** el dueño pidió "2 sitios nuevos"; sólo dio el de Ingeniería. El segundo sigue sin identificarse.

**How to apply:** próxima ronda = M-1..M-3 y plan 29 (rama desde `main`, no desde `marca-resaltador`); un plan por portal.
Los scripts de consola que sirvieron: `copy()` NO existe tras un `await` → `navigator.clipboard` y fallback a imprimir.
Firma: el feedback dice "agy 3.8 flash high" pero es del modelo anterior; firmé "tanda claude sonnet 5.5" (el dueño no objetó).
