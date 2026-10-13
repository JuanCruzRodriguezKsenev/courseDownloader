---
name: feedback-g3-comentarios-de-bloque
description: El chequeo "sólo comentarios" por prefijo de línea da falsos positivos en líneas de continuación de comentarios de bloque (HTML, CSS)
metadata:
  type: feedback
---

El grep tipo G3 (`grep -vE '^[+-]\s*(//|\*|/\*|#|<!--|-->)'`) marca como "no comentario" cualquier línea del medio de un comentario de bloque que no empiece con `*`: pasa en `entrypoints/popup/index.html` (comentario `<!-- … -->` de varias líneas) y en `styles/components/*.css` (bloques `/* … */` sin asterisco por línea).

**Why:** en el plan 33 dio 3 líneas así; las tres estaban dentro de comentarios y la compuerta dio idéntica.

**How to apply:** cuando un plan pida que G3 dé vacío, mirar el contexto de cada línea marcada (`sed -n` alrededor) y anotar en el informe que son continuaciones de comentario, con archivo:línea. No reformatear comentarios para que el heurístico pase. La prueba de fondo es la compuerta idéntica.
