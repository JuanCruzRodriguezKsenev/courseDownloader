---
name: fuente-unica-agentes
description: 2026-09-12 — construido: agentes y skills propias en ~/Dev/agentes, generados hacia Claude y Gemini, con hook de bloqueo
metadata:
  type: project
---

Decidido por el dueño (2026-09-12): una sola fuente en `~/Dev/agentes` (repo git) con cuerpos comunes + marcadores y
frontmatter por plataforma; un script `generar` escribe `~/.claude/agents/` y `~/.gemini/config/agents/` y enlaza las
skills propias (hoy `spec`); `--check` detecta copias editadas a mano; hook PreToolUse en `~/.claude/settings.json`
bloquea Edit/Write sobre `~/.claude/agents/`.

**Why:** las copias de Gemini (`~/.gemini/config/agents/`) se adaptaron a mano y ya divergían: subagent:true en
agentes interactivos, memoria perdida, rutas de ejemplo inventadas, forja reescrita sin §4–§8. Un symlink no alcanza:
el frontmatter es incompatible (en Claude `tools` con nombres ajenos = el agente no arranca).

**How to apply:** no editar las copias generadas; editar la fuente y correr `~/Dev/agentes/generar`. En Claude Code
lo corre solo `hooks/regenerar` (PostToolUse Edit|Write en ~/.claude/settings.json, probado en vivo 2026-09-12); en agy, a mano.
Remoto: github.com/JuanCruzRodriguezKsenev/agentes (privado); push desde acá por HTTPS con el token de gh, SSH no anda. Construido el
2026-09-12: copias de Claude verificadas idénticas; las de Gemini corregidas (subagent:false en tanda/obra/forja,
memoria compartida en `.claude/agent-memory/<nombre>/` indicada en el cuerpo, verificador flash sin acceptEdits).
Sin verificar en agy: `skills: - skills/spec`, symlinks en ~/.gemini/config/skills, permissionMode, ask_question en
subagentes (lista en ~/Dev/agentes/README.md). Hallazgo no tocado: el cuerpo de tanda/obra en Claude dice que
`AGENTS.md` de la raíz "se autocarga", y la memoria de tanda en este repo dice que no aparece autocargado. Ver [[spec-integrada-en-tanda]], [[fuentes-con-url]].
