---
name: project-editor-videollamadas-raiz-plan23
description: Spec y plan 23 (omitir videollamadas en bloque y raíz decidida en el editor); rama editor-videollamadas-raiz; va antes del plan 22
metadata:
  type: project
---

Spec `docs/specs/editor-ignorar-y-raiz/` (aprobada 2026-10-04) y plan `~/Boveda/Proyectos/courseDownloader/Planes/23 - Omitir videollamadas en bloque y raiz decidida en el editor.md`, rama `editor-videollamadas-raiz` desde `main` (`1f17049`). Sin ejecutar; lo ejecuta `obra`.

**Why:** el dueño no podía decir «ignorá las videollamadas» (sólo una por una) ni sacar de revisión un tema que va a la raíz. Causa medida: `editor.html` equipara `destino === "."` con «sin asignar» sin mirar `regla` en 7 sitios, y un tema nuevo llega en `.` ya seleccionado, así que el selector no dispara `change`.

**How to apply:**
- El dueño eligió la opción «— elegir carpeta —» al tope del selector (no botón ni casilla). Guardar sin tocar un tema sin destino lo deja `.` y reabre «Asignado» (RN-14): avisar al dueño en la verificación.
- «Aplicar reglas automáticas» pisaba toda raíz: se arregla con `temaSinDestino` (RN-13). Lo hallé al planificar, no estaba en los supuestos.
- Va **antes** del plan 22 (disco manda): los dos tocan `editor.html`. El 22 rebasa sobre `main` cuando éste se mergee. Ver [[project-disco-manda-plan22]].
- Dominios de videollamada: copia canónica nueva en `core/destino/videollamada.ts`; el scraper conserva la suya (va inyectado) y un test de deriva las compara.
