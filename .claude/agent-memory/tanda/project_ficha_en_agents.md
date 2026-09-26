---
name: ficha-en-agents
description: Este repo no lleva ficha §3 en CLAUDE.md; AGENTS.md hace de ficha y los docs de estado son tres
metadata:
  type: project
---

No escribir la ficha (`## Comandos`, etc.) en `CLAUDE.md`: es un puntero y prohíbe agregar reglas (ADR-0007, DRY).
`AGENTS.md` (raíz, 219 líneas) cumple ese rol y NO aparece autocargado en contexto: leerlo una vez por ronda.

**Why:** una ficha en CLAUDE.md diverge de AGENTS.md sin que nada lo detecte — el modo de falla que ADR-0007 prohíbe.

**How to apply:** arranque = delta git + estos tres docs de estado:
- `docs/ramas-en-revision.md` (qué hay fuera de main sin verificar en Chrome)
- `docs/TECHNICAL_DEBT.md` §🔴 Abierto (backlog entero; el resumen de cabecera suele estar desactualizado — recontar los `###`)
- `docs/rearquitectura-diseno.md` §Estado de avance
Compuerta: `pnpm test`, `pnpm run lint`, `pnpm exec tsc --noEmit`, `pnpm run build`; números en `docs/testing.md`. Nada se mergea sin probar en Chrome.

Estado al 2026-09-25: `main` = `080f7aa` (Classroom corte 1 mergeado, sin push); `ramas-en-revision.md` dice
"nada en revisión". Rama de trabajo `classroom-escanear-todas` (sólo spec). Baseline 43 archivos / 724 tests.
Deuda: 16 abiertas (3 🔴, 4 🟠, 9 ⚪). Abiertos de fondo: popovers sin tests, loader sin dueño, footer
`#ui-msg-status` oculto, banco no alcanza al SW.
