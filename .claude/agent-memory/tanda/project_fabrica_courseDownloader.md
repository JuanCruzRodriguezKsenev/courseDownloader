---
name: fabrica-en-courseDownloader
description: Desde 2026-10-13 los planes de este repo van por la cola de fábrica (participativo); cómo se cargan y trampas medidas
metadata:
  type: project
---

Juan decidió (2026-10-13) delegarle la ejecución a `fábrica`. Primer trabajo: plan 32, nota
`~/Boveda/Proyectos/courseDownloader/Cola/Plan 32 - Kaltura en Moodle Asignaturas.md` (`estado: construyendo`, `plan:`).
Orden decidido: 32 → 33 (migración docs) → IDEAS (después del 33).

**Why:** quiere que yo prepare y él sólo corra `~/Dev/agentes/fabrica/correr courseDownloader` y mergee.

**How to apply:**
- Un plan para fábrica no nombra rama ni worktree: `obra` corre en `isolation: worktree` desde `main` (`.claude/worktrees/agent-*`).
  Todo lo que el plan necesite (spec, fixtures) tiene que estar **en main** antes de cargarlo.
- Un trabajo a la vez entre construyendo y aprobando; `espera-juan` sale del tramo → no cargar el siguiente como `construyendo`
  hasta que el anterior esté mergeado si depende de él (el 33 depende del 32).
- `merge-gate` corre la batería en un worktree temporal sin node_modules: primero `pnpm install --frozen-lockfile`.
- `pnpm test`/`eslint .` en el checkout principal agarran `.claude/worktrees/**` (vitest sin config de exclude): pasar `--exclude`.
- El checklist en Chrome lo corro yo con Playwright en `espera-juan`, antes del `merge-gate --juan`. Escenarios ocultos en `~/Boveda/Sistema/Escenarios/courseDownloader/`.
- Plan 33 hay que revisarlo para fábrica (rama `migracion-docs`, mover notas en la bóveda desde un worktree con las guardas) antes de cargarlo.
