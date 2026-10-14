---
name: project-carpeta-tema-repetida-plan37
description: Plan 37, la subcarpeta de tema no se crea si repite el destino; helper subcarpetaAplica, copia del editor y dónde el plan se quedó corto
metadata:
  type: project
---

`subcarpetaAplica(destino, tema)` en `core/destino/carpetas.ts` decide si hay subcarpeta (RN-21); lo usan `resolverCarpeta`, los flags de `vistas.ts` y `generar.js`. Rama `carpeta-tema-repetida` (`db1dcf4`), compuerta en 87 archivos / 1341 tests.

**Why:** el tema «Teorías» bajo el destino `Teorias` daba `Teorias/Teorias` (descubierto verificando IDEAS).

**How to apply:** donde el plan se quedó corto: (1) `backend/adopcion/editor.html` tiene una copia propia de `resolverCarpeta` que hay que cambiar a mano (paridad AC-14 en `humo-editor-indice.js`); (2) un test existente (`editor.test.js:149`) fijaba el caso repetido; (3) la casilla de subcarpeta del editor (~2173, 2571, 2830, 2869) sigue decidiendo por nombre y quedó como hallazgo. Plan sin bloqueos; el nivel de detalle alcanzó.
