---
name: spec-integrada-en-tanda
description: 2026-09-12 — spec sigue como skill; tanda la invoca antes de planificar. Specs de este repo en docs/specs/<slug>/
metadata:
  type: project
---

Decisión (2026-09-12, con el dueño): la skill `spec` **no** se fusionó en `tanda` ni se volvió agente.
Queda como skill de usuario (`~/.claude/skills/spec`, también enlazada en `~/.agents/skills/`), y `tanda`
tiene tres líneas: invocarla si la ronda trae decisiones de producto abiertas (§1), trazar RN/AC en el
plan (§2), y el traspaso spec → plan (§5). A `spec` se le sumó: leer AGENTS.md/CLAUDE.md para el destino
y lo ya decidido, separar decisión vs hecho (los hechos se leen o van a `M-n` "a medir"), y el estado `a medir`.

**Why:** spec dejó de usarse cuando llegó tanda (últimas specs en app-unlp: 2026-09-06; tanda.md del
2026-09-07) porque su description se dispara con "armá una spec", y con tanda el pedido entra como "ronda".
Fusionar inflaba tanda y perdía el uso cruzado por ~/.agents; agente propio no: necesita AskUserQuestion
(no subagente) y no reemplaza el rol. En este repo muchos supuestos se resuelven midiendo (Classroom D11/D13),
por eso la rama "a medir".

**How to apply:** en courseDownloader las specs van en `docs/specs/<slug>/` (declarado en AGENTS.md y en
docs/contributing.md §Regla DRY); separadas del `docs/<tema>-diseno.md` por ser qué vs cómo. Respaldo
de las versiones previas de tanda.md y SKILL.md sólo quedó en el scratchpad de esa sesión. Si vuelve a
no usarse, revisar primero si el disparador de §1 de tanda está llegando, antes de proponer otra forma.
