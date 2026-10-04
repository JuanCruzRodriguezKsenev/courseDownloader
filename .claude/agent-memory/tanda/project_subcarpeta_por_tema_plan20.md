---
name: project-subcarpeta-por-tema-plan20
description: Plan 20 (subcarpeta por tema bajo la carpeta destino): spec aprobada, decisión clave de no tocar el índice ni el descargador, y el defecto previo de overrides
metadata:
  type: project
---

Spec `docs/specs/subcarpeta-por-tema/` (2026-10-04) y plan `~/Boveda/Proyectos/courseDownloader/Planes/20 - Subcarpeta por tema en la carpeta destino.md`, en la rama `subcarpeta-tema` (desde `main`). Todavía sin ejecutar por `obra`.

**Why:** el dueño veía cientos de archivos en la raíz de `Teorias/`. Pidió `Teorias/<docente>/Series/…`.

**How to apply:**
- El estado de la subcarpeta se **deriva** de la carpeta guardada en `cursos.<clave>.temas.<tema>` (`invertirCarpeta`), sin campo nuevo en el índice: `core/destino/propuesta.ts:133` lee esa cadena ya resuelta, así que el descargador no cambia. Cambió el supuesto 15 del listado aceptado por el dueño; está dicho en `assumptions.md`.
- Defecto previo medido con una sonda: `filasEditorAIndice` guarda como override la `carpeta` vieja de un archivo `copiar` sin `destinoPropio` cuando el tema cambia en la sesión. El plan lo corrige en el paso 2.4; sin eso la función no surte efecto.
- `editor.html` tiene una copia a mano de `resolverCarpeta` que nada verifica; el plan agrega un test de paridad (AC-14) en el humo jsdom.
- Pendiente aparte: la verificación en navegador del plan 19 (B-1..B-5) la dio el dueño por buena el 2026-10-04 ("todo parece funcionar perfecto").
- `main` se mergeó y pusheó el 2026-10-04 (`c1f8a57`, planes 16, 17, 19). Quedan sin mergear `classroom-videollamadas`, `loader-tarjetas`, `prueba-combinada`, `marca-resaltador`.
