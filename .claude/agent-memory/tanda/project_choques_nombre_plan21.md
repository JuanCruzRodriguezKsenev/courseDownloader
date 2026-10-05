---
name: project-choques-nombre-plan21
description: Plan 21 (nombres que chocan) escrito 2026-10-04, causa en tres eslabones; y la dirección siguiente del dueño: descargar todo, verificar archivo a archivo, ordenar con ayuda y registrar detectado vs final
metadata:
  type: project
---

Plan `~/Boveda/Proyectos/courseDownloader/Planes/21 - Nombres que chocan en cursos sin asociar y al guardar.md`, rama `choques-nombre` desde `main` (`e546cef`). Sin ejecutar. Lo ejecuta `obra`.

**Why:** al descargar MC2 se saltearon 5 archivos de «Novedades». Causa medida: (1) `propuesta.ts` no mete las filas de un curso sin asociar en la resolución de choques (`carpeta === null`); (2) `filasEditorAIndice` guarda como «editado» el nombre repetido al comparar contra la propuesta ya asociada; (3) `recalcularChoques` del editor exige `md5` distintos y el scan no los trae, mostró 0 choques.

**How to apply:**
- Los `nombres` repetidos no existen en la Bóveda real (medido); sólo en la copia `~/Descargas/facultad-prueba`. Por eso el plan no limpia datos viejos.
- **Dirección siguiente (el dueño, 2026-10-04):** descargar todo a una carpeta nueva, verificación archivo por archivo, orden asistido por mí leyendo los archivos, y que la extensión guarde lo **detectado** contra lo que él **nombró/movió** para «aprender». Es una **spec** (skill `spec`), después del plan 21. Abiertas: «aprender» = sólo registrar o proponer solo; dónde vive el registro; cambia el rol del editor (de decidir antes a revisar después).
- La descarga masiva haría peor el defecto de los choques: por eso el plan 21 va primero.
