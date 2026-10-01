---
name: leer-doc-antes-de-preguntar
description: No preguntarle al dueño lo que la doc del repo ya responde; leer el "cómo" y el portal análogo antes de opinar
metadata:
  type: feedback
---

Al evaluar un portal nuevo le pregunté al dueño cómo se maneja la sesión y cómo se resuelven las carpetas. Respuesta: la sesión
es la del navegador "como en todas" y las carpetas se resuelven como en Classroom; "denota que no leíste cómo añadir un portal
de la doc del proyecto".

**Why:** `docs/multisitio-diseno.md` §«Cómo escribir un portal nuevo» ya lo contesta (caso 1 de auth = cookie del navegador) y
`sitio/google-classroom/scraper.js` es el modelo de lo que hace "clicks".

**How to apply:** antes de preguntar o de estimar algo de un portal nuevo, leer ese paso a paso y el adaptador análogo; preguntar
sólo decisiones de producto. Y al medir, contar el DOM sin duplicados (el índice lateral de Moodle repite cada actividad).
