---
name: classroom-destino-2b2-backend-escritura
description: Sub-corte 2b-2, backend escribe a destino y decide al guardar (preservarDestino, alFinalizar, modo destino y smoke test E-7)
metadata:
  type: project
---

# Classroom: Sub-corte 2b-2 (Backend escritura a destino y decisión al guardar)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/02 - 2b-2 Backend escritura a destino y decisión al guardar.md`.
- **Compuerta de partida (E-1)**:
  - 57 archivos, 910 tests pasados en rama `classroom-destino-2b`.
- **Accumulator con opciones y gancho (E-2)**:
  - `backend/accumulator.js`: `alimentarSlidingWindow` añade 8.º parámetro `opciones` con `preservarDestino` (omite `unlink` inicial) y `alFinalizar`.
  - `flushVideoADisco`: cierra stream, delega en `alFinalizar(sesion)` guardando en `sesion.resultado`, y garantiza borrado del acumulador en `finally` incluso si el gancho lanza.
  - `abortarDescargaYLimpiar`: verificado que solo borra el temporal `.part` y nunca el `targetFile` final.
- **Módulo de escritura y decisión de destino (E-3)**:
  - `backend/destino/escritura.js`: módulo puro Node sin `Bun.`, sin `import.meta.dir` y sin `toLowerCase`.
  - `validarDestino`: valida rechazo de segmentos `..`, vacíos o `.`, pertenencia estricta bajo raíz y existencia de carpeta de materia en disco (D-2, D-3, RN-1).
  - `finalizarEnDestino`: calcula MD5 del `.part`, evalúa `decidirDespues` (filas 0, 5, 6 y D-7), conserva nombres previos del índice (RN-14, AC-6), protege archivos con `DESTINO_OCUPADO` (409) y filtra hashes por coincidencia de tamaño (D-8).
- **Handler Bypass en modo destino (E-4)**:
  - `backend/handlers.js`: activa modo destino ante `x-destino-ruta`. En chunk 0 lee índice (D-5), extrae materia y valida con `validarDestino`.
  - Saltea bloque de conflicto de cátedras y asegura creación recursiva de la subcarpeta destino antes de abrir el stream del `.part`.
  - Si un portal de destino por índice (`google-classroom`) llega sin `x-destino-ruta`, responde 400 `DESTINO_REQUERIDO` (D-9).
  - Retorna `resultado` en respuesta del último fragmento.
- **Cancelación segura (E-5)**:
  - `handleCancelarDescarga` elimina `.part` de la descarga activa y mantiene intacto el archivo final preexistente.
- **Documentación y ADR (E-6)**:
  - Actualizados `docs/deployment.md` (headers y contratos de error/resultado), `docs/testing.md` (60 archivos, 931 tests), `docs/architecture.md`, `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md` (D-6, D-7) y `docs/ramas-en-revision.md`.
- **Humo contra raíz temporal (E-7)**:
  - Curl 1: archivo nuevo -> 200, `resultado: "escrito"`, archivo y MD5 en índice.
  - Curl 2: mismo contenido -> 200, `resultado: "descartado"`, sin segundo archivo.
  - Curl 3 (control negativo): contenido distinto -> 409 `DESTINO_OCUPADO`, archivo original intacto.
- **Batería y compuerta final**:
  - Delegada a subagente `verificador`: 60 archivos / 931 tests pasados, 0 lint warnings/errors, tsc limpio, build exitoso.
