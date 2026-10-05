---
name: project-videollamadas-omitidas-plan25
description: Plan 25 (videollamadas omitidas por defecto + popup se refresca al volver del editor); rama apilada sobre editor-filtros-orden
metadata:
  type: project
---

Plan `~/Boveda/Proyectos/courseDownloader/Planes/25 - Videollamadas omitidas por defecto y popup al dia con el editor.md` (2026-10-05). Sin ejecutar; lo ejecuta `obra` en la rama `videollamadas-omitidas-defecto` (apilada sobre `editor-filtros-orden`).

**Why:** el dueño veía las videollamadas omitidas en el editor pero seleccionables en el popup hasta re-escanear. Causa medida: el popup sólo consulta el índice en `ejecutarPaso2SincronizarDiscoVeloz` (popup.js), no al volver de la pestaña del editor. Además pidió omitidas por defecto, re-ofrecer permanente (campo nuevo `cursos.<clave>.videollamadasPermitidas`), refresco automático.

**How to apply:** revierte RN-5 de la spec editor-ignorar-y-raiz. Trampa: `vistas.ts` ~L455/518 usa `clave.split(":")[1]` que con accesos da "acceso"; comparar siempre por clave completa. `ejecutarPaso2` resetea `seleccionado`: refrescar sólo con bandera «volví del editor». El plan quedó sólo en la Bóveda sin commitear (hay cambios ajenos ahí).
