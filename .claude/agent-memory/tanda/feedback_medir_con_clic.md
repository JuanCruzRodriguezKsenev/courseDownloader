---
name: medir-con-clic
description: Medir portales con clic real en los menús, no sólo fetch/HTML inicial; y no cambiar de rama en el árbol donde trabaja obra
metadata:
  type: feedback
---

Al medir un portal, abrir los menús/secciones **con un clic real** (Chrome) y mirar el DOM y la red; un `fetch` de la URL que cree que usa el botón puede no ver lo que el menú carga o muestra al abrirse.

**Why:** el dueño (2026-10-06) objetó que los scripts de medición no hacen clic en los dropdowns «de casi ningún sitio» y que lo que no está volcado en el HTML inicial no se ve. En IDEAS la objeción no cambió el resultado (las secciones «Información de cátedra» y «Promoción» están vacías también con clic), pero el método estaba incompleto.

**How to apply:** en toda medición nueva (y al planificar cualquier portal), incluir el clic en los menús desplegables y comparar DOM antes/después. Si el contenido aparece sólo tras el clic, es una medición `M-n` que necesita el service worker/extensión. Revisar si portales ya hechos (Moodle: secciones colapsadas, Classroom) dependen de algo así.

Aparte: cuando `obra` trabaja en el repo, **no hacer `git checkout`**: usar `git worktree add .worktrees/<rama> -b <rama> main` (ignorado por git y excluido de los tests) para escribir docs en otra rama.
