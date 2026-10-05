---
name: project-editor-filtros-orden-plan24
description: Spec y plan 24 (filtros y orden en el editor de adopción); rama editor-filtros-orden se crea desde main con el plan 23 ya mergeado
metadata:
  type: project
---

Spec `docs/specs/editor-filtros-orden/` (aprobada 2026-10-05, 21 supuestos sin cambios) y plan `~/Boveda/Proyectos/courseDownloader/Planes/24 - Filtros y orden en el editor de adopcion.md`. Sin ejecutar; lo ejecuta `obra`.

**Why:** el dueño dijo «le falta un filtro, un ordenar, etc». Medido: el editor ya tenía chips, «Solo problemas» y búsqueda (todos a nivel de tema entero); faltaba TODO el orden y los filtros de fila (acción, videollamadas, tipo).

**How to apply:**
- Depende del plan 23 (usa `esFilaVideollamada` y `temaSinDestino`): la rama sale de `main` DESPUÉS de mergear el 23. Spec y plan quedaron sin commitear (el 23 sigue en su rama, pendiente de M-1..M-5 del dueño).
- Independiente del 22 (disco manda) pero los dos tocan `editor.html`: el segundo rebasa; conflicto esperable en `renderTopics`.
- Decisiones que cerré yo al escribir la spec (D-1..D-4): acciones de tema actúan sobre TODAS las filas aunque el filtro oculte algunas (encabezado «mostrando X de Y»); son 4 selectores, no 2; con «Problemas primero» el tema se reubica al resolverse.
- Sólo humo jsdom nuevo (`humo-editor-filtros-orden.js`), sin tests de vitest: el baseline no debería moverse.
