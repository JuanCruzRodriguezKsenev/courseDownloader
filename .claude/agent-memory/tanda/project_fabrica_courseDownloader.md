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

**Primera corrida (2026-10-13), plan 32 → espera-juan en ~10 min, 87/1334 en verde, 2 PASS.** Trampas medidas:
- El worktree de `isolation: worktree` sale de **origin/main**, no del main local: si main tiene commits sin pushear, obra
  construye sobre base vieja (esta vez hizo rebase solo). Antes de correr fábrica: pedirle a Juan que pushee, o avisar en la nota.
- El verificador dijo «sin escenarios ocultos» aunque existían → correrlos yo en `espera-juan` hasta que forja lo arregle.
- Informe a forja: `~/Boveda/Sistema/Informes/Informe para forja - primera corrida de fábrica en courseDownloader 2026-10-13.md`.
- Para el checklist en Chrome: copiar `.output/chrome-mv3` del worktree a la del checkout principal (la que carga `pw.json`) y
  **reabrir** `-s=verif` (con `chrome.runtime.reload()` se pierde el SW). El login de Asignaturas viene autocompletado: clic en `#loginbtn`.
  Servidor de prueba: `HOME=~/.local/share/courseDownloader/home-prueba bun backend/server.js`.
