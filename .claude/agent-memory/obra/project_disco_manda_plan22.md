---
name: Lo que está en disco manda (Plan 22)
description: Búsqueda previa en raíz por MD5 y tamaño en backend (escritura y estado), deduplicación entre cursos y materias, badge y chip movido en popup y editor, y compuerta en 81 archivos / 1239 tests.
metadata:
  type: project
---

# Lo que está en disco manda (Plan 22)

- **Backend - Hash MD5 y recorrido (`backend/destino/md5.js`, `backend/destino/recorrido.js`)**:
  - `md5.js`: memoización de promesas concurrentes con limpieza inmediata en caso de fallo/rechazo, evitando recalcular hashes idénticos y timeouts concurrentes entre popup y editor.
  - `recorrido.js`: desempate determinista de archivos con idéntico MD5 eligiendo el `mtime` más reciente (orden alfabético estable ante empate temporal). Prefiltro opcional `opciones.tamano` para descartar hashes de archivos con distinto tamaño.
- **Backend - Estado y escritura (`backend/destino/estado.js`, `backend/destino/escritura.js`, `core/destino/decidir.ts`)**:
  - `estado.js`: unificación de `resolverContraDisco` entre cursos asociados y no asociados. Si el archivo existe en otra ruta de la raíz con mismo MD5, actualiza la ruta del archivo en el índice y marca `movido: true` efímero en la respuesta. Maneja raíz inaccesible retornando `raizInaccesible: true`.
  - `escritura.js`: búsqueda previa en toda la raíz excluyendo archivos `.part` antes de decidir la ruta final (AC-4 / AC-10).
  - `decidir.ts`: nuevo campo `md5ExisteEnRaiz` y evaluación de descarte antes de rechazo ante choques con archivos existentes.
- **Popup y Editor (`core/backend/bunClient.ts`, `popup/features/destino.js`, `popup/features/listaClases.preact.js`, `backend/adopcion/editor.js`, `core/destino/vistas.ts`, `backend/adopcion/editor.html`)**:
  - `bunClient.ts`: tipos `movido?: boolean` en `ItemEstadoDestino` y `raizInaccesible?: boolean` en `RespuestaEstadoDestino`.
  - `destino.js`: propagación de `c.movido = Boolean(itRes && itRes.movido)` en los ítems de clase.
  - `listaClases.preact.js` y `list.css`: renderizado del chip `.chip-movido` e indicación en el `title` con sufijo ` (movido a: <ruta>)`.
  - `editor.js`: en `GET ?modo=indice`, ejecuta `calcularEstado` para sincronizar rutas movidas en el índice, recolecta `movidos` y relee el índice antes de pasarlo a `indiceAFilasEditor`.
  - `vistas.ts`: soporte de `movidos?: Set<string>` en `indiceAFilasEditor` para marcar filas descargadas que fueron movidas; `filasEditorAIndice` no persiste `movido` en disco.
  - `editor.html`: indicador `.file-badge-movido` monocromo junto al candado 🔒.
- **Baseline de compuerta**:
  - 81 archivos / 1239 tests (+19 tests respecto a la baseline 1220 de Plan 25).
  - 4 pruebas de humo de adopción (`humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js`) en 0 errores.
