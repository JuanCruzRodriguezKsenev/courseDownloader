---
name: scripts-medicion-portales
description: Dónde están los scripts de consola A–E para medir un portal nuevo, y el flujo con el dueño para sumar un sitio
metadata:
  type: reference
---

Scripts en `docs/medicion-de-portales.md` (A estructura, B red, C curso Moodle, D `/my/` Moodle, E folder Moodle). No los
reescribas: pasale al dueño el que corresponda copiándolo de ahí.

**Flujo que funcionó (Moodle de Ingeniería, 2026-10-05):**
1. Pedir URL + Script A en la lista y dentro de un curso con material + B tras abrir un recurso o video.
2. Si es Moodle: C dentro de un curso, D en `/my/`, E si hay `folder`.
3. Sin decisiones de producto abiertas → spec corta que hereda de `docs/specs/moodle-asignaturas/` y `moodle-linti/`.

**Trampas:** `copy()` no existe tras `await` (C/D/E ya usan `navigator.clipboard`). Medir desde pestaña no vale por el service
worker: va como `M-n`. Los títulos de D salen cortados a 50 caracteres: identificar el curso por `id`, no por título.
Un host con `www.` y otro sin él son portales distintos (Ingeniería `www.asignaturas.ing.unlp.edu.ar`, Informática
`asignaturas.info.unlp.edu.ar`).

Estado del sexto portal: [[moodle-ingenieria-spec]].
