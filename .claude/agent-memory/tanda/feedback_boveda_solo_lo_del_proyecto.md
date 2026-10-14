---
name: boveda-solo-lo-del-proyecto
description: En la bóveda se commitea sólo lo de este proyecto, aunque el dueño pida "todos los commits"
metadata:
  type: feedback
---

En ~/Boveda commitear sólo `Proyectos/courseDownloader/…` (y lo que la ronda tocó); nunca `git add -A`.

**Why:** 2026-10-14 pedí "todos los commits" y commiteé ~44 rutas ajenas (facultad, .obsidian, memorias de otros agentes) y las pusheé; el dueño dijo que sólo debía tocar lo de este proyecto.

**How to apply:** `git -C ~/Boveda commit -- <rutas del proyecto>`; "todos" se entiende dentro del proyecto. Un hook rechaza cambios en conversiones verificadas: no saltearlo con `Reconversion: si`.
