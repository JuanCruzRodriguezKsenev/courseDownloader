---
name: asignaturas-kaltura-plan32
description: Plan 32 (video Kaltura de un label como acceso .md en Moodle Asignaturas) escrito 2026-10-06; rama asignaturas-kaltura en worktree
metadata:
  type: project
---

Plan 32 en la Bóveda, rama `asignaturas-kaltura` (desde main 73aadcb, spec 1abc331) en el worktree `.worktrees/asignaturas-kaltura`. obra se abre parado en esa carpeta; es independiente del plan 31.

**Decidido por el dueño (2026-10-06):** el video Kaltura entra como enlace `.md`.

**Medido:** el `entry_id` está en el texto del `<script>` inline `kWidget.embed(...)` del label (el iframe lo crea el JS). URL que abre: `https://<host>/p/<pid>/sp/<pid>00/embedIframeJs/uiconf_id/<uiconf>/partner_id/<pid>?iframeembed=true&entry_id=<id>`; `/id/<entry>` y `/media/t/<entry>` NO sirven. El reproductor dice «No source video was found» (se guarda igual). El fixture `curso.html` de Asignaturas ya trae ese label real.

**How to apply:** el test 2 de `scraper.test.js` cuenta 110 ítems / 28 `acceso:`; con el video pasan a 111 / 29. No tocar el bloque `<recorrido-moodle>` (paridad entre 3 scrapers).
