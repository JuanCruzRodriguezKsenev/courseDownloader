---
name: feedback-herramientas-shell
description: Trampas de shell/herramientas en este equipo (fish, ugrep, puerto 3001 ocupado, worktree para ramas desde main)
metadata:
  type: feedback
---

- El shell es fish: nada de `for h in a b; do ...` con `=`/`$(...)` estilo bash sin cuidado; las asignaciones `X=y cmd` en una línea con `;` fallan. Usá bucles `for x in ...; ...; end`, o cada comando aparte.
- `grep -E` es ugrep: no soporta backreferences (`\1`); medir patrones repetidos con `python3 -I`.
- Si el plan pide rama desde `main` y el checkout está en otra rama con árbol sucio, `git worktree add -b <rama> .worktrees/<rama> main` + `pnpm install --frozen-lockfile`; no cambiás de rama.
- El puerto 3001 suele estar ocupado por el backend real: el verificador usa una copia en 3002 con `HOME=…/home-prueba`.

**Why:** costaron reintentos en la ejecución del plan 37.
**How to apply:** al arrancar cualquier plan de este repo.
