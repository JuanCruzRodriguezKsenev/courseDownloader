---
name: Editor - Filtros y orden (Plan 24)
description: Ejecución del plan 24 (filtros de fila por acción y tipo, orden de temas, archivos y cursos, y humo en jsdom)
metadata:
  type: project
---

# Editor: Filtros y orden (Plan 24)

- **Qué se implementó**:
  - Estado de vista puramente en memoria (`filtroMostrar`, `filtroTipo`, `ordenTemas`, `ordenArchivos`, `ordenCursos`).
  - Funciones puras de vista en `editor.html`: `extensionDe`, `comparar` (`localeCompare` con sensibilidad base y numérico), `ordenEstable`, `filaPasaFiltros`, `hayFiltroDeFila`, `tiposDelCurso`, `ordenarTemas`, `ordenarArchivos`, `cursosOrdenados`, `vistaActiva`, `limpiarVista`.
  - Extracción de `calcularTemasVisibles(curso)` para reuso en renderizado y auto-expansión.
  - Búsqueda por carpeta destino (`matchDestino` contemplando tanto `tema.destino` como la carpeta destino efectiva resuelta con docente/subcarpeta vía `resolverCarpeta`).
  - Controles UI: cuatro `<select>` en `.toolbar-left` (`#selMostrar`, `#selTipo`, `#selOrdenTemas`, `#selOrdenArchivos`), botón `#btnLimpiarVista` con reactividad en `renderTopics()`, y `#selOrdenCursos` en el encabezado de la barra lateral.
  - Reinicio automático de la vista del curso al cambiar de curso en la barra lateral sin reiniciar el orden de cursos (`#selOrdenCursos`).
  - Script de humo `backend/adopcion/humo-editor-filtros-orden.js` cubriendo los 16 criterios de aceptación (AC-1 a AC-16) en JSDOM.

- **Puntos de atención y aprendizajes**:
  - **Regex de `carpetas.ts` en temas sin regla**: para simular un tema sin regla automática en el fixture, su nombre no debe empezar con palabras clave como `Parcial` (`/^(parcial|examen|recuperatorio)/i`); se nombró `Material de parciales` para que `sugerirDestino` devuelva `regla: false`.
  - **Búsqueda por destino resuelto**: en modo índice con docente asignado, `invertirCarpeta` traduce `Teorias/Palacio` a `Teorias`; para que la búsqueda por `palacio` encuentre el tema por destino efectivo (RN-6, AC-6), `matchDestino` debe evaluar tanto `tema.destino` como la carpeta calculada con `resolverCarpeta`.
  - **`change` vs `input` en renombres de archivo**: el evento `input` en `.file-rename-input` solo actualiza memoria interna; el redibujado visual de la tabla ocurre en `change` (`renderAll()`).
  - **Filas `ya-esta` ante omisión masiva de tema**: el checkbox maestro del tema omite las filas que no sean `ya-esta` (las descargadas son inmutables); las aserciones de omisión total de tema deben contemplar que las filas descargadas conservan su estado en disco.

- **Compuerta final**:
  - Vitest: 80 archivos / 1203 tests (invariable, no agrega tests unitarios).
  - Lint: 0 errores / 0 advertencias.
  - Typecheck: limpio.
  - Build: `.output/chrome-mv3/` generado exitosamente.
  - Humos: los 4 scripts de humo en verde (`errores: 0`).
