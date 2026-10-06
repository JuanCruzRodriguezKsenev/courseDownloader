---
name: Marca Resaltador, interfaz (Plan 27)
description: Interfaz de marca Resaltador (resaltado de filas selected/bajando con --bg-row-highlight, grilla de 5 columnas fijas, Re-escanear en el footer como botón secundario y chips compactos de videollamada 📹 y movido ↪).
metadata:
  type: project
---

# Marca «Resaltador»: interfaz (Plan 27)

- **Filas resaltadas (`styles/variables.css`, `styles/list.css`)**:
  - Token nuevo `--bg-row-highlight`: `rgba(var(--accent-brand-rgb), 0.2)` (claro) / `rgba(var(--accent-brand-rgb), 0.08)` (oscuro).
  - Aplicado en `.video-item.selected` y `.video-item.bajando` junto a `border-left-color: var(--accent-brand-line)`.
- **Grilla de columnas fijas y chips (`styles/list.css`, `popup/features/listaClases.preact.js`)**:
  - `.video-item` pasa de flex a CSS Grid de 5 columnas fijas: `14px 14px minmax(0, 1fr) 68px 80px`.
  - Celdas 4 (materia) y 5 (estado) con `min-width: 0; overflow: hidden`; `.chip-materia` con `max-width: 100%; justify-self: start`.
  - Celda 2: videollamada unificada en `.chip-tipo` con ícono `📹` y tooltip explicativo. Eliminado `.chip-videollamada`.
  - Celda 3: `.celda-titulo` con `.video-label` y marca `↪` (`.marca-movido`) cuando `clase.movido` es true. Eliminado `.chip-movido`.
  - Celda 4: `.chip-materia` o `<span></span>` vacío para garantizar exactamente 5 hijos por fila. Con `bloqueo: 'omitido'`, preserva el destino/materia.
  - Celda 5: `.badge.omitido` en la columna de estado cuando `clase.bloqueo === 'omitido'`.
- **Botonera inferior y botón Re-escanear (`entrypoints/popup/index.html`, `styles/components/footer.css`, `styles/components/actions.css`, `popup.js`)**:
  - `#ui-btn-rescan` trasladado de la barra de filtros al footer antes de `#ui-btn-action` como `.btn-secundario`.
  - `.footer-panel` pasa a grilla `auto minmax(0, 1fr)` con `#ui-btn-action` expandiéndose a toda la fila cuando rescan está oculto.
  - Tamaño de fuente de ambos botones en el footer reducido a `var(--text-base)` (12 px).
  - Centralizada la visibilidad reactiva en `sincronizarBtnRescan()` en `popup.js`, respetando pestaña `disponibles` y evitando duplicación en modos de re-escaneo/recorrido.
- **Compuerta y verificación**:
  - Baseline actualizada a 82 archivos / 1248 tests (+6 tests de grilla fija en `listaClases.preact.test.js`).
  - Verificador reporta suite limpia: 82 archivos / 1248 tests en verde, 0 lint warnings/errors, tsc limpio y build ok.
