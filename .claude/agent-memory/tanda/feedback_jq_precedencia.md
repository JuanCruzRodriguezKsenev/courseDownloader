---
name: jq-precedencia-en-verificaciones
description: En los bloques de verificación de los planes, cada término jq con pipe dentro de un array/lista va entre paréntesis
metadata:
  type: feedback
---

En jq, `|` tiene la precedencia MÁS BAJA (menor que `,`). `[.a|length, .b|length]` se parsea como
`.a | ((length, .b) | length)` y revienta ("Cannot index number with string").
Escribir siempre `[(.a|length), (.b|length)]`.

**Why:** el paso (c) de docs/plan-classroom-destino-2a-editor.md salió así y obra lo reportó como
hallazgo (2026-09-27). Un comando de verificación roto hace que el reporte no pueda pegar salida literal.
**How to apply:** antes de entregar un plan, probar cada `jq` del bloque contra un JSON de juguete en el scratchpad.
