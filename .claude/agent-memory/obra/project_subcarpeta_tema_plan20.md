---
name: Subcarpeta por tema en carpeta destino (Plan 20)
description: Subcarpeta opcional y configurable por tema en destino (Teorias/<docente>/<Tema>), reactividad en editor web, casilla e interruptor masivo, soporte en CLI generar/aplicar y sin cambios de esquema
metadata:
  type: project
---

# Subcarpeta por tema en carpeta destino (Plan 20)

- **Núcleo (`core/destino/carpetas.ts`)**:
  - `nombreSubcarpetaTema(tema)`: extrae el último segmento de temas jerárquicos (` › `), sanea caracteres y reserva temas no elegibles («Novedades», «General», «Sin tema», «Material general», «Varios», etc.).
  - `resolverCarpeta(destino, docente?, subcarpetaTema?)`: tercer parámetro opcional. Si hay `subcarpetaTema` y `destino !== "."`, anexa el segmento saneado.
  - Tests unitarios en `carpetas.test.ts` (15 nuevos para AC-1..5 y RN-9).
- **Vistas del editor (`core/destino/vistas.ts`)**:
  - `invertirCarpeta(carpeta, docente?, tema?)`: devuelve `{ destino, editable, subcarpeta: boolean }`. Primero evalúa destino plano (subcarpeta `false`), luego con subcarpeta (subcarpeta `true`).
  - `FilaTemaEditor.subcarpeta?: "si" | "no"`: derivado en `indiceAFilasEditor` de la carpeta guardada o `"si"` por omisión para temas elegibles nuevos.
  - `filasEditorAIndice`: invierte temas pasando `t.tema` preservando editabilidad; resuelve destinos con subcarpeta.
  - Corrección del defecto previo (RN-12, AC-9): filas sin `destinoPropio` (o `""`) no dejan entrada en `curso.carpetas` al cambiar destino de tema.
  - Tests unitarios en `vistas.test.ts` (7 nuevos para AC-6..10, sonda de defecto previo y A7).
- **Editor web (`backend/adopcion/editor.html`)**:
  - Réplica idéntica de `nombreSubcarpetaTema` y `resolverCarpeta` con tercer parámetro (AC-14).
  - `computeLivePath`: calcula ruta viva con subcarpeta para temas con `subcarpeta === "si"` y sin `destinoPropio` de archivo (RN-13, RN-19, AC-15).
  - Casilla «📁 Subcarpeta del tema» por tarjeta de tema (`.topic-right`) con listeners reactivos, toast y estilos CSS. Deshabilitada en omitidos, destino `.` y huérfanos/Novedades.
  - Interruptor masivo «📁 Subcarpetas del curso» en la toolbar para conmutar temas elegibles (RN-18, AC-12).
  - Botón «↺ Que hereden» y overrides de archivo adaptados a `resolverCarpeta` con subcarpeta (RN-14, AC-11).
  - Persistencia y restauración de subcarpeta al omitir/des-omitir (RN-20, AC-13).
- **CLI adopción (`backend/adopcion/generar.js` y `aplicar.js`)**:
  - `generar.js`: columna `subcarpeta` (`si`/`no`) en cabecera y filas de `temas.tsv`, y `resolverCarpeta` con tema cuando es `si`.
  - `aplicar.js`: lectura opcional con `mapSubcarpetas` retrocompatible (ausente = `no`) en destinos propios, carpetas recalculadas y armado de `indice.cursos[claveCurso].temas` (AC-16).
  - Tests de integración en `backend/adopcion/aplicar.test.js` (3 tests para AC-16).
- **Humo jsdom (`backend/adopcion/humo-editor-indice.js`)**:
  - Cobertura jsdom para AC-8, 11, 12, 13, 14 (paridad de evaluación con `carpetas.ts`) y 15. Salida en `errores: 0`.
- **Baseline de compuerta**:
  - 79 archivos / 1165 tests (+25 tests y +1 archivo respecto a baseline 1140).
