---
name: flota-antigravity
description: los agentes salen de una fuente única (~/Dev/agentes) hacia Claude y Antigravity; qué revisar si un informe cita rutas ajenas
metadata:
  type: reference
---

La flota (tanda, obra, forja, verificador) y la skill `spec` se **generan** desde `~/Dev/agentes` (repo git,
pusheado) hacia `~/.claude/agents/` y `~/.gemini/config/agents/`. El usuario ejecuta a veces con Antigravity
(`agy --agent obra`). Detalle del diseño en la memoria de forja: `.claude/agent-memory/forja/project_fuente_unica_agentes.md`.

- Chequeo de divergencia: `~/Dev/agentes/generar --check` (exit 0 = copias idénticas a la fuente).
- Hook PreToolUse bloquea Edit/Write sobre las copias; en agy no hay hook, sólo `--check`.
- Transcripts de agy: `~/.gemini/antigravity-cli/brain/<id>/.system_generated/logs/transcript.jsonl`.

Revisado el 2026-09-12: sin restos de finanzas, sin nombres de herramientas cruzados, generar rechaza fuente rota.
Quedó derivado a forja: la versión Claude de tanda/obra afirma que `AGENTS.md` de la raíz "se autocarga" (en Claude
Code no: sólo entra `CLAUDE.md`), y `verificador` busca `## Verificación` que este repo no tiene.

**Why:** un hallazgo de obra ("el protocolo nombra docs/trabajo-en-vuelo.md") salía de una copia vieja de Gemini, no
del repo ni de `~/.claude`; buscar sólo en `~/.claude` hizo perder la causa.

**How to apply:** si un informe de obra cita reglas/rutas que el repo no tiene, correr `generar --check` y mirar
`~/Dev/agentes/agentes/<nombre>.md`. Cambios de agentes van a `forja`, que edita la fuente, nunca las copias.
