---
name: classroom-destino-2c8-atenuacion-indicador-en-disco
description: Sub-corte 2c-8, atenuación visual e indicador inmutable para archivos en disco en editor web (.row-descargado, badge 🔒 en disco, cursor not-allowed, tooltips explicativos), compuerta en 64 archivos / 1034 tests
metadata:
  type: project
---

# Classroom: Sub-corte 2c-8 (Atenuación visual e indicador inmutable para archivos en disco)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08h - 2c-8 Atenuacion e indicador inmutable para archivos en disco.md` en rama `classroom-destino-2c`.
- **Clase `.row-descargado` y atenuación neta (D-1, D-2)**:
  - `backend/adopcion/editor.html`:
    - Filas con `arch.accion === "ya-esta"` reciben la clase `.row-descargado`.
    - CSS: `.files-table tr.row-descargado` estilizado con `opacity: 0.55;` y fondo sutil diferenciado `rgba(255, 255, 255, 0.015)`.
    - Inputs de renombre (`.file-rename-input`), selectores de destino (`.file-dest-select`) y celdas reciben `cursor: not-allowed; color: var(--text-muted);`.
- **Insignia semántica `.file-badge-en-disco` (D-3)**:
  - Se reemplaza el `✓` plano por un badge verde compacto `<span class="file-badge-en-disco" title="Ya descargado en disco físico: inmutable desde este editor (para renombrarlo o moverlo hacelo en tus carpetas)">🔒 en disco</span>`.
  - CSS: fondo verde tenue `rgba(46, 160, 67, 0.15)`, texto `#3fb950`, borde tenue, borde redondeado y `cursor: help`.
- **Tooltips explicativos de inmutabilidad en controles (D-4)**:
  - Input `#inp-nom-...` y select `.file-dest-select` de archivos descargados incorporan `title="Inmutable desde este editor: el archivo ya fue descargado en disco físico (renombralo o movelo desde tus carpetas si lo deseás)"`.
- **Inmutabilidad y no-tachado ante desactivación de carpeta (D-5)**:
  - `isOmitted` ajustado a `(arch.accion === "omitir" || tema.destino === "-") && !isDownloaded`.
  - Archivos ya en disco conservan su ruta en vivo real y no se tachan ni se marcan `(omitido)`.
  - `topic-check` no altera `arch.accion` para archivos con `accion === "ya-esta"`.
- **Humo jsdom**:
  - `bun backend/adopcion/humo-editor.js` → `errores: 0`.
  - `bun backend/adopcion/humo-editor-indice.js` → `errores: 0`.
- **Batería y veredicto**:
  - Delegado a subagente `verificador`: 64 archivos pasados (64), 1034 tests pasados (1034), 0 fallos, 0 errores/warnings en ESLint, typecheck limpio, build WXT exitoso (287.34 kB).
