---
name: classroom-destino-2c5-ajustes-ergonomicos
description: Sub-corte 2c-5, ajustes ergonómicos del editor web (table-layout fixed, widths legibles, computeLivePath sin duplicación de materia en ya-esta, sticky scroll escalonado en stats-strip/toolbar/topic-header, carpetas personalizadas en indice.ts/propuesta.ts/vistas.ts/editor.js/editor.html con opción + Nueva carpeta... interactiva, compuerta en 64 archivos / 1034 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2c-5 (Ajustes ergonómicos del editor web)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08d - 2c-5 Ajustes ergonomicos del editor web (layout, carpetas y sticky).md` en rama `classroom-destino-2c`.
- **Modelo y persistencia de carpetas individuales y personalizadas (S-1)**:
  - `core/destino/indice.ts`: agregado `carpetas?: Record<string, string>` en `CursoIndice`.
  - `core/destino/propuesta.ts`: `proponerParaCurso` comprueba `curso.carpetas?.[clave]` antes de calcular `carpetaPropuesta` desde los temas.
  - `core/destino/vistas.ts`:
    - `FilaArchivoEditor` extendida con `destinoPropio?: string`.
    - `esDestinoSeguro(destino)` valida nombres de carpetas seguros (sin `..`, sin caracteres de control ni barras que escapen la materia) reemplazando la restricción fija a `DESTINOS`.
    - `filasEditorAIndice` persiste en `nuevoCurso.carpetas[clave]` las carpetas personalizadas cuando difieren del tema (excluyendo archivos omitidos y ya descargados, y eliminando la propiedad si no hay personalizaciones).
    - `indiceAFilasEditor` propaga `cursoIndice.carpetas?.[clave]` a `arch.carpeta` y `arch.destinoPropio` (vía `invertirCarpeta`).
- **Detección de carpetas en disco en backend (S-2)**:
  - `backend/adopcion/editor.js`: implementadas `obtenerCarpetasDeMateria` y `obtenerCarpetasExistentes`.
  - `GET /api/datos`: fusiona las carpetas reales del disco en `destinos` e incluye `carpetasPorMateria` en la respuesta JSON.
- **Layout fijo y corrección de duplicación de rutas (S-3)**:
  - `backend/adopcion/editor.html`:
    - `.files-table`: `table-layout: fixed; width: 100%;`.
    - `.file-orig`: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;`.
    - `.file-rename-input`: `width: 100%; box-sizing: border-box; font-family: var(--font-mono); font-size: 12px; padding: 5px 8px;`.
    - Columnas del `thead`: Checkbox 40px, Archivo original 26%, Nombre en destino 36%, Carpeta 18%, Ruta calculada 20%.
    - `computeLivePath`: sanitizado para ítems `ya-esta` verificando si `cNorm` ya empieza con `materia/` antes de anteponerla.
- **Sticky scroll en dos niveles (S-4)**:
  - `.stats-strip`: `position: sticky; top: 0; z-index: 20;`.
  - `.toolbar`: `position: sticky; top: 41px; z-index: 20;`.
  - `.topic-card`: quitado `overflow: hidden` para permitir contexto sticky de descendientes.
  - `.topic-header`: `position: sticky; top: 86px; z-index: 10;`, permaneciendo fija mientras scrollean las clases de su tema.
- **Creación de nueva carpeta interactiva (S-5)**:
  - Selectores `.topic-dest-select` y `.file-dest-select` incluyen `<option value="__nueva__">+ Nueva carpeta...</option>`.
  - En listeners `change`: si `sel.value === "__nueva__"`, pide nombre vía `prompt`, sanitiza barras, agrega a `DATOS.destinos`, crea dinámicamente un `<option>` en el DOM antes de asignar el valor para evitar que el select de HTML resetee a vacío, y re-renderiza con `renderAll()`.
- **Humo jsdom**:
  - `bun backend/adopcion/humo-editor.js` → `errores: 0`.
  - `bun backend/adopcion/humo-editor-indice.js` → `errores: 0` (incluyendo prueba interactiva de creación de carpeta `Talleres` y comprobación en el índice final).
- **Batería y veredicto (S-6)**:
  - Delegado a subagente `verificador`: 64 archivos pasados (64), 1034 tests pasados (1034), 0 fallos, 0 errores/warnings en ESLint, typecheck limpio, build WXT exitoso (287.34 kB), y ambos humos en errores: 0.
