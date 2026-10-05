---
name: classroom-destino-2c7-desactivacion-limpia-carpetas
description: Sub-corte 2c-7, desactivación limpia de carpetas vía checkbox maestro (tema.destino = "-" y omitir archivos), eliminación de opción redundante "-" en selector de tema con estado disabled, soporte Novedades/huérfanos, compuerta en 64 archivos / 1034 tests
metadata:
  type: project
---

# Classroom: Sub-corte 2c-7 (Desactivación limpia de carpetas y eliminación de opción redundante en selector)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08g - 2c-7 Desactivacion limpia de carpetas y eliminacion de opcion redundante en selector.md` en rama `classroom-destino-2c`.
- **Eliminación de opción redundante en selector de tema (P-1, D-1, D-3)**:
  - `backend/adopcion/editor.html`:
    - Eliminada la opción `<option value="-">- (no bajar este tema)</option>` de `.topic-dest-select`. El selector define únicamente a dónde van los archivos (`.` o subcarpetas).
    - `isTopicOmitted` calculado como `tema.destino === "-"`.
    - Cuando `isTopicOmitted` es true, `.topic-dest-select` se renderiza con el atributo `disabled` mostrando la carpeta previa (`tema._destinoPrevio || tema.destino || "."`) de forma atenuada.
    - Cabecera del tema muestra `<span class="badge neutral">Omitido</span>` si `isTopicOmitted`.
- **Checkbox maestro como interruptor único de la carpeta (P-2, D-2, D-4)**:
  - `backend/adopcion/editor.html`:
    - `isChecked` del `.topic-check` calculado como `!isTopicOmitted && (activeFiles.length > 0 || archivosTema.length === 0)`.
    - Al desmarcar (`chk.checked === false`): guarda `tema._destinoPrevio = tema.destino || "."`, asigna `tema.destino = "-"`, y marca todos los archivos asociados (`arch.accion !== "ya-esta"`) con `accion = "omitir"`.
    - Al marcar (`chk.checked === true`): restaura `tema.destino = tema._destinoPrevio || "."` y reactiva los archivos con `accion = "copiar"`.
    - Búsqueda de archivos en el listener incluye temas huérfanos / Novedades considerando `!nombresTemasSet.has(a.tema)`.
- **Humo jsdom**:
  - `bun backend/adopcion/humo-editor.js` → `errores: 0`.
  - `bun backend/adopcion/humo-editor-indice.js` → `errores: 0`.
- **Batería y veredicto (P-3)**:
  - Delegado a subagente `verificador`: 64 archivos pasados (64), 1034 tests pasados (1034), 0 fallos, 0 errores/warnings en ESLint, typecheck limpio, build WXT exitoso (287.34 kB), y ambos humos en errores: 0.
