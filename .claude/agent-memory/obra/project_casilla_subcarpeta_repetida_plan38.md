---
name: project-casilla-subcarpeta-repetida-plan38
description: Plan 38, la casilla de subcarpeta del editor respeta subcarpetaAplica; plan sin bloqueos, trampas del humo
metadata:
  type: project
---

Casilla `.topic-subfolder-check` de `backend/adopcion/editor.html` deshabilitada y destildada si el tema repite el destino. Rama `casilla-subcarpeta-repetida` (`fe71910`), 87 archivos / 1341 tests (sin cambio de conteo: el humo no cuenta).

**Why:** cierra el hallazgo del [[project-carpeta-tema-repetida-plan37]].

**How to apply:** el plan alcanzó, sin bloqueos. Trampas: la rama nombrada ya existía (mismo commit que main, se reusa); en el humo, el tema «Teoría» tiene sub «Teoria» ≠ destino «Teorias», así que para simular el repetido hay que poner `destino = "Teoria"` por eval y el flag en `no` antes de cambiar de destino (el handler sólo apaga, nunca enciende). El home-prueba no tiene «Teorías»: verificador arma una raíz aparte y lanza el editor con `crearManejadorEditor` porque el 3001 puede estar ocupado.
