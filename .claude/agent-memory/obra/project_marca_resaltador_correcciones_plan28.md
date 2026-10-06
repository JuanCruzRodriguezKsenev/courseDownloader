---
name: Marca Resaltador, correcciones de la revisión (Plan 28)
description: Corrección de anchos de columna en grilla (84px para materia), box-sizing border-box y centrado en badges/botones, y desacople de ráfagaEnCurso desde rafagaCorriendo del service worker.
metadata:
  type: project
---

# Marca «Resaltador»: correcciones de la revisión (Plan 28)

- **Alineación y anchos de columnas (`styles/list.css`)**:
  - `box-sizing: border-box` agregado puntualmente a `.chip-materia`, `.badge` y `.btn-row-action` para evitar desbordes y colisiones con el gap.
  - `.badge`: `text-align: center`, `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`.
  - `.btn-row-action`: `white-space: nowrap`, `padding: 2px var(--space-xs)`, `text-align: center`. «REMOVER ❌» entra en una sola línea dentro de los 80 px.
  - Grilla de `.video-item` redistribuida: `14px 14px minmax(0, 1fr) 84px 80px; column-gap: 6px; padding: var(--space-sm) 8px`. La columna de materia gana 16 px sin reducir el espacio útil del título.
- **Detección real de ráfaga activa (`background.js`, `core/estado/appState.ts`)**:
  - `obtener_estados_en_progreso` en `background.js` incluye `rafagaCorriendo: state.rafagaCorriendo`.
  - `AppState.sincronizarConBackground` ahora calcula `app.ráfagaEnCurso = respuestaFondo.rafagaCorriendo === true`, evitando el falso positivo cuando hay clases en fila (`process`) pero ninguna descarga corriendo.
- **Compuerta y verificación**:
  - Baseline actualizada a 82 archivos / 1250 tests (+2 tests en `core/estado/appState.test.ts`).
  - Verificador reporta batería limpia: 82 archivos / 1250 tests en verde, 0 lint warnings/errors, tsc limpio y build ok.
