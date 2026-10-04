---
name: project-borrador-editor-plan19
description: Plan 19 (2026-10-04) cambia el beforeunload del editor de adopción por borrador en localStorage; causa del cuelgue sin confirmar
metadata:
  type: project
---

El editor `backend/adopcion/editor.html` se tildaba al cerrar con cambios sin guardar y sin diálogo visible. Causa probable (no reproducida): su `beforeunload` con `returnValue` espera un diálogo que el navegador a veces no dibuja. `alert` en `beforeunload` está bloqueado por el navegador.

**Why:** el dueño eligió borrador local (banner Restaurar/Descartar; borrador con base distinta se descarta con toast) en vez de sacar el aviso sin más.

**How to apply:** plan en `~/Boveda/Proyectos/courseDownloader/Planes/19 - Borrador local del editor en lugar del aviso al cerrar.md`. Si vuelve el cuelgue tras ejecutarlo, la hipótesis del `beforeunload` era falsa: buscar otra causa (p. ej. `marcarCambio` serializando todo en cada tecla). El borrador no repuebla `destinosPrevios` (limitación aceptada).
