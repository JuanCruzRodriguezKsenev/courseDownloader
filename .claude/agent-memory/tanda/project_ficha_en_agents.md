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

Estado al 2026-09-21: `classroom-corte-1` EN revisión (32 commits sobre `main`, que sigue en `733ec91` del 2026-08-28).
Baseline: **43 archivos / 719 tests**. Todos los planes del corte 1 ejecutados y con compuerta verde; falta la
**Verificación B en Brave** (checklist de 14 pasos en `docs/ramas-en-revision.md`) y después el merge. Abiertos: popovers sin
tests, loader sin dueño, footer `#ui-msg-status` con `display:none` (`entrypoints/popup/index.html:132`), banco no alcanza al SW.
