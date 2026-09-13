---
name: fuentes-con-url
description: Al afirmar cómo funciona Claude Code o Antigravity, citar la documentación oficial con URL (Anthropic y Google)
metadata:
  type: feedback
---

Toda afirmación sobre el formato o el comportamiento de agentes, skills, hooks o reglas va con su fuente: URL de
code.claude.com/docs (Anthropic) o antigravity.google/docs (Google), verificada en la sesión, no de memoria.

**Why:** el dueño lo pidió explícito (2026-09-12) al diseñar la fuente única Claude+Gemini. Al verificar aparecieron
errores reales: la URL docs/custom-agents que citaba forja-gemini da 404, `tools` por defecto es `[]` en Antigravity
(en Claude hereda todo), y `subagent`/`mainAgent` valen `true` por defecto.

**How to apply:** antes de recomendar, traé la página con WebFetch; si la doc web no lo dice, decilo y distinguí
"verificado" de "sólo en un ejemplo" o "sin documentar". Para la versión instalada de agy, la skill incluida en
`~/.gemini/antigravity-cli/builtin/skills/agy-customizations/` también cuenta como fuente. Ver [[fuente-unica-agentes]].
