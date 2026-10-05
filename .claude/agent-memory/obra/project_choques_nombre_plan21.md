---
name: Choques de nombre en cursos sin asociar y al guardar (Plan 21)
description: Resolución de choques en cursos sin asociar agrupando por tema en propuesta.ts (RN-16/16a), descarte de nombres que chocan al guardar en vistas.ts (RN-14) y discriminante md5 || clave en editor.html
metadata:
  type: project
---

# Choques de nombre en cursos sin asociar y al guardar (Plan 21)

- **Propuesta en cursos sin asociar (`core/destino/propuesta.ts`)**:
  - `filasNovedades` y `filasParaChoques`: se quitó el filtro `r.carpeta !== null` usando `ruta = r.carpeta ?? `(sin asociar)/${r.tema}`` para que los archivos de un curso sin asociar se distingan por tema antes de asociar.
  - RN-16a propone nombres basados en la primera frase del anuncio para ítems de Novedades sin esperar a la asociación del curso.
  - 4 tests unitarios en `core/destino/propuesta.test.ts` (curso `null` con 5 ítems de MC2, residuo `_1` para mismo anuncio, no tocar temas distintos, y verificación de `carpeta === null`).
- **Guardado en índice (`core/destino/vistas.ts`)**:
  - `normalizarCarpetaOcupacion(carpeta, materia)`: normaliza eliminando prefijo de materia y barras finales.
  - `filasEditorAIndice`: mapa de ocupación con todas las filas del curso no omitidas (`accion !== "omitir"`). Si una fila no `ya-esta` difiere de la propuesta base pero su nombre choca con otra fila en la misma carpeta normalizada, no se persiste en `cursos.<clave>.nombres` (`delete nombresFinales[a.clave]`).
  - 4 tests unitarios en `core/destino/vistas.test.ts` (nombres repetidos no escriben en `nombres`, edición legítima persiste, fila `ya-esta` protegida, y carpeta con prefijo vs sin prefijo).
- **Editor web (`backend/adopcion/editor.html`)**:
  - `recalcularChoques`: discriminante actualizado a `(f.md5 || f.clave).toLowerCase()` en lugar de sólo `md5`, permitiendo alertar choques de nombre en archivos escaneados que no traen `md5`.
  - 2 casos de prueba agregados al script de humo jsdom `backend/adopcion/humo-editor-indice.js` (errores: 0).
- **Baseline de compuerta**:
  - 79 archivos / 1173 tests (+8 tests respecto a la baseline 1165 de Plan 20).
