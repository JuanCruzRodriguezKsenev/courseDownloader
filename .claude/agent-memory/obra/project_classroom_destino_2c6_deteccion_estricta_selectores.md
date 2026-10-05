---
name: classroom-destino-2c6-deteccion-estricta-selectores
description: Sub-corte 2c-6, detección estricta de carpetas por materia en editor web, creación en ambos selectores (#selectMateria y destinos), tilde verde circular en descargados, eliminación de badge redundante ya está en disco, checkboxes con acento verde y sin reflow brusco, compuerta en 64 archivos / 1034 tests
metadata:
  type: project
---

# Classroom: Sub-corte 2c-6 (Detección estricta de carpetas y mejoras en selectores)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08f - 2c-6 Deteccion estricta de carpetas por materia y creacion en ambos selectores.md` en rama `classroom-destino-2c`.
- **Limpieza de destinos global (P-1, D-1)**:
  - `backend/adopcion/editor.js`: en `GET /api/datos` modo índice, `destinos` se inicializa estrictamente con `DESTINOS` estándar (`['.', 'Teorias', 'Practicas', 'Laboratorios', 'Parciales', 'Finales', 'Bibliografia', 'Notas']`), eliminando la contaminación cruzada entre materias.
- **Detección por materia y creación en `#selectMateria` (P-2, D-2)**:
  - `backend/adopcion/editor.html`:
    - Función `obtenerDestinosParaCurso(curso)` que combina dinámicamente destinos estándar, subcarpetas de la materia activa (`DATOS.carpetasPorMateria[curso.materia]`) y carpetas asignadas en temas y archivos de dicho curso.
    - `#selectMateria` incluye `<option value="__nueva__">+ Nueva materia...</option>`.
    - Listener `change` de `#selectMateria` detecta `__nueva__`, pide nombre con `prompt`, sanitiza, antepone prefijo `Ingenieria/` si falta, registra en `DATOS.materias` y `DATOS.carpetasPorMateria`, y actualiza vista con `renderTopics()`.
- **Selectores de destino por tema y archivo (P-3, D-3)**:
  - `.topic-dest-select` y `.file-dest-select` iteran sobre `destinosDisponibles` (derivado de `obtenerDestinosParaCurso(curso)`).
  - Al crear una carpeta con `__nueva__`, además de agregarse a `DATOS.destinos`, se registra en `DATOS.carpetasPorMateria[curso.materia]`.
- **Tilde verde para descargados y checkboxes responsivos (P-4, D-5, D-6)**:
  - Filas con `arch.accion === "ya-esta"` muestran `<span class="file-check-done" title="Ya descargado en disco">✓</span>` con acento verde y fondo suave en vez del checkbox deshabilitado.
  - Eliminado el badge `<span class="badge neutral">ya está en disco</span>` de la columna de nombre.
  - El selector oculto `.sel-acc-sync` se conserva para sincronización y compatibilidad con tests.
  - Checkboxes `.topic-check, .file-check` estilizados con `accent-color: var(--accent-success)` (referenciando `--accent-green`) y `.file-check-wrapper` con padding cómodo.
  - Listener `.file-check` actualiza la fila, la tarjeta de tema y las métricas in-place sin invocar `renderAll()`, eliminando reflows y parpadeos molestos al clickear.
- **Actualización de tests unitarios**:
  - `backend/adopcion/editor.test.js`: actualizado para esperar `not.toContain("Talleres")` en `json.destinos`, afirmando el aislamiento estricto de subcarpetas por materia.
- **Humo jsdom**:
  - `bun backend/adopcion/humo-editor.js` → `errores: 0`.
  - `bun backend/adopcion/humo-editor-indice.js` → `errores: 0`.
- **Batería y veredicto (P-5)**:
  - Delegado a subagente `verificador`: 64 archivos pasados (64), 1034 tests pasados (1034), 0 fallos, 0 errores/warnings en ESLint, typecheck limpio, build WXT exitoso (287.34 kB), y ambos humos en errores: 0.
