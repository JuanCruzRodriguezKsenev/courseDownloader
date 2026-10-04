---
name: Correcciones de planes 08b a 15 (Plan 16 Parte I)
description: Correcciones C-1 a C-8 de Sites Mate C (Drive usercontent, permisos mínimos, scraper autocontenido), inyección con DOM real, materias nuevas y editor accesible
metadata:
  type: project
---

# Correcciones de planes 08b a 15 (Plan 16 Parte I)

- **C-1 (Sites Mate C: resolver Drive)**: migrado a `https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t` con `authuser` condicional según credenciales. Coincide con Classroom y no requiere ampliar permisos a `drive.google.com`.
- **C-2 (Permisos mínimos Sites Mate C)**: `wxt.config.ts` redujo `https://sites.google.com/*` a dos patrones exactos (`.../matec` y `.../matec/*`). `patronPestañas` pasó a `.../matec*` para matchear sin barra. En `.output/chrome-mv3/manifest.json`, WXT minifica en una sola línea; `grep -c` cuenta líneas coincidentes (da 1) mientras que `grep -o ... | wc -l` cuenta ocurrencias reales (2).
- **C-3 (Scraper Sites Mate C autocontenido)**: se eliminaron las copias de módulo (`SUBPAGINAS_MATEC`, `buscarTituloElemento`, `extraerItemsDeDocumento`) en `sitio/sites-matec/scraper.js`. `scraper.test.js` se reescribió para ejercer `escanearListado()` directamente sobre jsdom con mocks de fetch (6/6 tests).
- **C-4 (Inyección sobre DOM real con fixtures)**: `sitio/inyeccion.test.js` sumó una suite evaluando `escanearListado.toString()` con `dom.getInternalVMContext()` de JSDOM en un contexto VM aislado para `sites-matec` y `moodle-asignaturas`. Los fallos por helpers externos no capturados por mocks vacíos ahora caen inmediatamente. Cerrada la deuda técnica #26.
- **C-5 (Materias nuevas sintácticamente seguras)**: `core/destino/vistas.ts` exporta `esMateriaSintacticamenteSegura` (2 niveles, sin caracteres de control ni `..`). `filasEditorAIndice` acepta materias que cumplan esta condición aunque no existan en disco, sin crear carpetas al guardar el índice (`escritura.js` hace `mkdir -p` al escribir el primer archivo). En `editor.html`, `#selectMateria` ya no antepone `Ingenieria/` y exige formato `Carrera/Materia`.
- **C-6 (`_destinoPrevio` fuera del modelo)**: en `backend/adopcion/editor.html`, el valor previo del tema omitido se guarda en un Map `destinosPrevios` (clave `${clave_curso}\t${tema}`), evitando que viaje en el payload o rompa la detección de cambios sin guardar al alternar checkboxes. Verificado en `humo-editor-indice.js`.
- **C-7 (Fila descargada legible)**: variable `--row-descargado-bg` añadida a `:root` (claro) y `@media (prefers-color-scheme: dark)`; `.row-descargado` usa `opacity: 0.55` y quita `color: var(--text-muted)` de las celdas manteniendo `cursor: not-allowed`.
- **C-8 (Baseline y documentación)**: baseline actualizada a 78 archivos / 1139 tests en `docs/testing.md` y `docs/ramas-en-revision.md`. `Estado.md` de la bóveda actualizado.
