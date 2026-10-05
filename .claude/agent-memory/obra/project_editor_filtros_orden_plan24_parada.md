---
name: Parada previa al Plan 24 (filtros y orden)
description: Detención al arrancar el plan 24 por precondición no cumplida (rama no creada, árbol sucio y plan 23 no mergeado)
metadata:
  type: project
---

# Parada previa al Plan 24 (filtros y orden)

- **Supuesto del plan vs realidad**:
  - El plan 24 (`~/Boveda/Proyectos/courseDownloader/Planes/24 - Filtros y orden en el editor de adopcion.md`) asumía rama `editor-filtros-orden` creada limpia desde `main` con el plan 23 mergeado.
  - La rama activa era `editor-videollamadas-raiz` (HEAD del plan 23, `6502055`), `editor-filtros-orden` no existía en el repositorio y `main` no contenía los cambios del plan 23.
  - El árbol de trabajo contenía archivos sin commitear: especificación `docs/specs/editor-filtros-orden/` y archivos de memoria de tanda y obra.
- **Acción tomada**:
  - Parada estricta sin modificar código ni cambiar de rama, cumpliendo §0 (árbol sucio) y §6 (nunca cambiar de rama ni mergear).
  - Consulta al usuario y generación de informe de traspaso hacia `tanda` para la preparación adecuada de ramas.
