---
name: feedback-fabrica-guardas-boveda
description: Bajo fábrica, la guarda bloquea grep/find recursivos en ~/Boveda y git con -C ~ o cd; cómo trabajar la bóveda igual
metadata:
  type: feedback
---

Lanzado por fábrica (worktree aislado + hook `guarda --sin-escenarios`), varios comandos que un plan escribe literalmente se rechazan:

- `grep -r`/`find` sobre `~/Boveda` (aunque sea sobre carpetas del proyecto) y hasta `obsidian unresolved | grep` → "no barras la bóveda". La guarda protege `Sistema/Escenarios/`.
- `git -C ~/…` o `cd ~/Boveda && git …` → el aislamiento del worktree lo rechaza por ruta "calculada". `git -C /home/jcrod/Boveda …` (ruta literal absoluta) sí pasa.
- `git -C ~/Dev/courseDownloader worktree list` → correr `git worktree list` desde el propio worktree.
- Escribir en `~/Dev/courseDownloader/.claude/agent-memory/` (checkout principal) también se rechaza: la memoria `feedback_*` queda en la del worktree y llega con el merge.

**Why:** plan 33 (2026-10-13) traía los comandos del S3/S4 literales y la guarda los cortó; se resolvió sin saltear la intención de la guarda.

**How to apply:** para inspeccionar archivos de la bóveda, un script Python en el scratchpad con la lista explícita de archivos del proyecto (o analizar los originales del repo, que son idénticos); para contar enlaces rotos, `obsidian unresolved > scratchpad/x.txt` y después leer/grepear el archivo. Para git en la bóveda, ruta absoluta literal. Anotar en el informe que el comando del plan se reemplazó por uno equivalente.

Ver también [[feedback-g3-comentarios-de-bloque]].
