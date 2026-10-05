---
name: classroom-fin-descarga-todos
description: Conservación de lista, origen y recorrido al vaciar la cola de un recorrido multi-curso
metadata:
  type: project
---

# Classroom: Al terminar la descarga, la lista de todos los cursos se conserva

## Puntos clave de la ejecución
- **Causa del defecto (reporte del dueño, 2026-09-27)**: con el popup abierto al terminar la descarga (`cola_completamente_vacia`), `restaurarPanelPorInterrupcion("🏁 ¡Procesamiento terminado!", true)` invocaba `appState.limpiarSesionLocal()`. Esto vaciaba en memoria `listadoClasesGlobal` y `origenListado`, y borraba del storage las claves de sesión (incluyendo `recorridoTodos` y `listaPersistente`). Luego intentaba un escaneo automático sobre la pestaña actual (`/h`), reportando "no hay nada" y perdiendo el recorrido multi-curso de ~2 minutos.
- **Solución implementada**:
  - `core/estado/appState.ts`: se incorporó `limpiarColaConservandoLista()`, que resetea la cola, ráfaga, frenado, video en transmisión y borra de storage sólo `["colaDescargas", "faseDiscoOk"]`. Preserva intactos `listadoClasesGlobal`, `origenListado`, `listaPersistente` y `recorridoTodos`. Cabecera actualizada a `V6.5.0`.
  - `popup.js`: en `restaurarPanelPorInterrupcion(txt, limpiarCola)`, se evalúa `conservarLista = limpiarCola && appState.origenListado?.clave === "todos"` antes de limpiar. Si es true, ejecuta `appState.limpiarColaConservandoLista()` y en lugar de re-escanear invoca `mostrarListaGuardada()`, re-renderizando la lista agrupada y sincronizando disco.
  - Para un curso individual u otros portales (`origenListado.clave !== "todos"`), el flujo de `limpiarSesionLocal()` y re-escaneo se mantiene intacto.
- **Control negativo verificado**:
  - Sabotaje reemplazando el cuerpo de `limpiarColaConservandoLista()` por `app.limpiarSesionLocal()`.
  - Fallo confirmado en `core/estado/appState.test.ts`: `AssertionError: expected [] to have a length of 1 but got +0`.
- **Suite**: 46 archivos / 799 tests, lint, `tsc` y build en verde (+1 test en `appState.test.ts`).
