---
name: moodle-asignaturas-multicurso-spec
description: Spec draft del multicurso de Informática (2026-10-05); /my/ del dueño tiene 1 solo curso; falta M-1/M-3 y plan; va separado del de Ingeniería
metadata:
  type: project
---

Spec `docs/specs/moodle-asignaturas-multicurso/spec.md` (+ `assumptions.md`), `draft`, 14 supuestos "aprobado sin leer".
Hereda de `moodle-ingenieria` y `asig:`. El dueño pidió **cada sitio por separado; luego se analiza juntarlos**.

**Medición:** `/my/` y `/my/courses.php` (Todos) = 1 solo curso (`id=82`, 158 actividades, sin duplicados en el HTML por
fetch, 385–508 ms). Los duplicados de la medición del 01-10 eran del DOM reactivo de la pestaña. Resuelve M-2.

**Why:** el dueño quiso "multi curso" de Informática; con 1 curso el valor hoy es nulo (el dueño decidió igual: multicurso en todos, porque van a ir apareciendo).

**How to apply:** próximo paso = plan (rama desde `main`). Decidir antes si el recorrido Moodle se implementa genérico
(Ingeniería también sin plan ni código) o por portal. Browser tools: el dueño rechazó que usara Chrome para medir; pedirle los scripts.
