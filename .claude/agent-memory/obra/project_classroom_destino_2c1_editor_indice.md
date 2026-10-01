---
name: classroom-destino-2c1-editor-indice
description: Sub-corte 2c-1, editor web sobre el índice real (modo ?modo=indice en backend/adopcion, POST /api/destino/curso-visto en memoria, nombres personalizados en índice, inversión simétrica de carpetas, humo jsdom y compuerta en 64 archivos / 1010 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2c-1 (Editor web sobre el índice real)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/07 - 2c-1 Editor web sobre el índice real.md` en rama `classroom-destino-2c`.
- **Compuerta de partida (H-1)**:
  - 62 archivos, 988 tests pasados en rama `classroom-destino-2c`.
- **`nombres` en el índice y en la propuesta (H-2, D-3)**:
  - `core/destino/indice.ts`: `CursoIndice.nombres?: Record<string, string>`. Encabezado subido a V1.1.0.
  - `core/destino/propuesta.ts`: `proponerParaCurso` prefiere `curso.nombres?.[clave]` si no está en `archivos` y fija el nombre evitando renombres por choques.
  - `core/destino/propuesta.test.ts`: 3 tests nuevos (+3 tests; 8 → 11 tests).
- **Transformación bidireccional pura: `core/destino/vistas.ts` (H-3, D-4, D-6)**:
  - `invertirCarpeta`: pura y simétrica con `resolverCarpeta`. Clasifica si es editable (o carpeta manual con `editable: false`).
  - `indiceAFilasEditor`: transforma `Indice` + cursos vistos en 3 tablas para el editor (`cursos`, `temas`, `archivos`).
  - `filasEditorAIndice`: transforma tablas editadas al índice.
    - Rechaza cambio de materia de un curso ya asociado (D-4).
    - Preserva carpetas manuales no editables.
    - Maneja omitidos (`omitir` / `copiar`).
    - Nombres editados se guardan en `curso.nombres` sólo si difieren de la propuesta base.
  - `core/destino/vistas.test.ts`: 11 tests nuevos (+11 tests, +1 archivo nuevo).
- **Backend: `curso-visto` y `?modo=indice` (H-4, D-2, D-8)**:
  - `backend/destino/vistos.js`: almacén en memoria para escaneos vistos (`guardarVisto`, `leerVistos`, `limpiarVistos`).
  - `backend/handlers.js` y `backend/server.js`: expone `POST /api/destino/curso-visto`.
  - `backend/adopcion/editor.js`:
    - `GET api/datos?modo=indice`: sirve filas desde `indiceAFilasEditor`. Si no hay vistos, responde `{ vacio: true }`.
    - `POST api/guardar?modo=indice`: aplica `filasEditorAIndice` y `modificarIndice` atómico. 409 si índice ilegible.
    - `POST api/ensayo?modo=indice`: responde texto explicativo fijo D-8.
    - Mantiene compatibilidad total con modo TSV sin `?modo=indice`.
  - `backend/adopcion/editor.test.js`: 8 tests nuevos (+8 tests, +1 archivo nuevo).
- **Interfaz `editor.html` en modo índice (H-5)**:
  - Propaga `location.search` en las llamadas a `api/datos`, `api/guardar`, `api/ensayo`.
  - Si `datos.vacio === true`, oculta formulario y muestra mensaje explicativo para escanear en la extensión.
  - Bloquea `selectMateria.disabled = true` si el curso ya tiene materia asignada (D-4).
  - Cero `animation` o `transition` añadidas (control estricto de estilos).
- **Humo interactivo en jsdom (H-6)**:
  - `backend/adopcion/humo-editor.js` adaptado y en verde (`errores: 0`).
  - `backend/adopcion/humo-editor-indice.js` creado y en verde (`errores: 0`).
- **Docs y baseline (H-7)**:
  - `docs/specs/classroom-destino/spec.md`: notas 2c en RN-13/RN-14, campo `nombres` en §Datos y nota de implementación en wireframe.
  - `docs/data-model.md`: `nombres?: Record<string, string>` en `CursoIndice`.
  - `docs/deployment.md`: endpoint `POST /api/destino/curso-visto` y documentación de `?modo=indice`.
  - `docs/architecture.md`: documentados `core/destino/vistas.ts` y `backend/destino/vistos.js`.
  - `docs/ramas-en-revision.md`: anotado estado de `classroom-destino-2c`.
  - `docs/testing.md`: baseline actualizado a 64 archivos / 1010 tests.
- **Controles negativos (H-8)**:
  - Rechazo de cambio de materia: omisión temporal de la guarda provoca fallo en test unitario con assertion error; restauración verificada en verde.
  - Ida y vuelta byte-idéntica: alteración temporal de campo en serialización provoca fallo de igualdad con diff claro; restauración verificada en verde.
- **Batería y compuerta final**:
  - Subagente `verificador`: 64 archivos / 1010 tests en verde, lint limpio (0 errores, 0 advertencias), typecheck limpio, build exitoso (283.68 kB).
