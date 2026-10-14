---
name: project-choques-sufijo-n-plan40
description: Plan 40, RN-16b (_N en la propuesta) y RN-16c (renombrar en vez de rechazar al escribir); dónde el plan se quedó corto
metadata:
  type: project
---

Plan 40 ejecutado el 2026-10-14 en la rama `choques-sufijo-n` (`a28ee24` código, `563c730` docs + ADR-0021). Compuerta 91 archivos / 1397 tests.

**Where the plan fell short (para tanda):**
- Los números de línea del plan estaban corridos unas 6 líneas en `propuesta.ts` (el bucle RN-16 terminaba en :235, no :228). No costó nada: el plan nombraba el bloque además de la línea.
- El test «ítem fijo conserva y el nuevo toma _2» no se puede armar con un solo ítem nuevo: el nuevo sólo llega al nombre sufijado si choca con OTRO nuevo en el nombre base. Hizo falta un tercer ítem (fijo + dos nuevos → `_2` y `_3`).
- El plan decía «lanza el mismo error de hoy» para el caso de 999 sin decir que el rechazo de hoy borraba el `.part`; lo conservé (corrección de dos líneas).
- `escritura.js` y `propuesta.ts` no tienen banner de versión: el §3.4 «si tiene» no aplicó.

**Why:** tanda usa esto para saber cuánto detalle poner. **How to apply:** en el área `core/destino` + `backend/destino`, citar el bloque por nombre además de la línea, y en tests de choque pensar cuántos ítems hacen falta para que el sufijo de RN-16 se dispare.

Relacionado: [[project-choques-nombre-plan21]], [[project-classroom-destino-anuncio]].
