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
- **La idea grande del dueño (descargar todo a una carpeta bruta, verificar, «aprender») se achicó** a «lo que está en disco manda»: ver [[project-disco-manda-plan22]]. Ya no hay carpeta bruta ni aprendizaje.
- El plan 21 va primero porque el 22 toca los mismos archivos (`vistas.ts`, `propuesta.ts`).

**Estado 2026-10-04 noche:** `obra` terminó (rama `choques-nombre`, `bdf955d`). M-1 (11 nombres distintos), M-2 (aviso de choque en ambas filas), M-3 (`nombres` null) y M-4 (25/25 en disco, 0 «ya existe») verificados con el dueño. Falta sólo decidir el merge a `main`; luego plan 22.
- Para M-2 hay que sacar 2 archivos del índice **y** del disco: los que están en disco salen bloqueados («en disco») y no se renombran en el editor.
- El dueño preguntó por una carpeta «Autoevaluaciones» que el escaneo de MC2 no trae (los multiple choice están en «Novedades»); sin respuesta aún si es el escáner o un tema a crear a mano.
