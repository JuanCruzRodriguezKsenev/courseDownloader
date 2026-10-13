---
name: criterio-build-tamano
description: Al escribir el AC «la compuerta da los mismos números», excluir el tamaño del build si el plan toca comentarios o texto que llega al bundle
metadata:
  type: feedback
---

«La compuerta da los mismos números» vale para tests, lint y tsc. El tamaño del build cambia si el plan toca un comentario
de un `.html` (por ejemplo `entrypoints/popup/index.html`): el comentario llega a `popup.html`.

**Why:** H-9 del informe del plan 33 (2026-10-13): build 410.98 → 411.02 kB y el AC quedó literalmente incumplido.

**How to apply:** en planes de docs o de comentarios, escribir «mismos tests/lint/tsc; build ok, el tamaño puede variar
en `popup.html`».
