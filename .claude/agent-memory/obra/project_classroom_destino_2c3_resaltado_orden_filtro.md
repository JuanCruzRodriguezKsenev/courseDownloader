---
name: classroom-destino-2c3-resaltado-orden-filtro
description: Sub-corte 2c-3, visibilidad, orden y filtro de temas sin asignar (clase .sin-asignar en FilaClase, estilos CSS, compararPrioridadDestino en destino.js y popup.js, filtro sin-asignar y activarFiltroSinAsignar en filters.js, click en nota y compuerta en 64 archivos / 1029 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2c-3 (Resaltado, orden y filtro de temas sin asignar)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08b - 2c-3 Resaltado, orden y filtro de temas sin asignar.md` en rama `classroom-destino-2c`.
- **Partida (K-1)**:
  - Verificada compuerta de partida en verde: 64 archivos / 1022 tests.
- **Resaltado en la fila y estilos CSS (K-2)**:
  - `popup/features/listaClases.preact.js`: agregada clase `sin-asignar` al contenedor `.video-item` en `FilaClase` cuando `clase.sinAsignar` es `true` (D-1). En `ListaClases`, agregado soporte para `clickable` y `onClick=${ctx.onNotaClick}` en `.lista-nota` (D-4). Cuidado con el formateo de clases para no introducir dobles espacios cuando `sinAsignar` es falso (el test de render idéntico compara HTML exacto).
  - `styles/list.css`: agregada regla `.video-item.sin-asignar` con `border-left-color: var(--accent-warning-visible)` y `background-color: rgba(245, 158, 11, 0.06)` (D-1). Agregada regla `.lista-nota.clickable` con `cursor: pointer` y hover sutil (D-4).
  - `popup/features/listaClases.preact.test.js`: test verificado en suite de `FilaClase` confirmando que ítem con `sinAsignar: true` contiene la clase `.sin-asignar`, y nuevo test confirmando que `ctx.onNotaClick` asigna clase `clickable` y llama al callback (+1 test; 45 → 46 tests).
- **Orden prioritario dentro de su curso (K-3)**:
  - `popup/features/destino.js`: expuesta función pura `compararPrioridadDestino(a, b)` que coloca ítems con `sinAsignar === true` antes que los demás (D-2).
  - `popup.js`: importado `compararPrioridadDestino`. Aplicado en el comparador de Disponibles (línea 2387) y en el desempate por curso en multi-curso (`idxA === idxB`, línea 2402) anteponiendo ítems `sinAsignar` en su bloque (D-2).
  - `popup/features/destino.test.js`: +3 tests unitarios verificando `compararPrioridadDestino` (antepone `sinAsignar`, orden en array, desempate dentro de curso; 28 → 31 tests).
- **Filtro «Sin asignar» y click en la nota (K-4)**:
  - `popup/features/filters.js`:
    - En `estadosDisponibles`: agregada opción `{ key: "sin-asignar", label: "Sin asignar" }` (D-3).
    - En `coincideEstado`: incluida condición `(filtrosActivos.estados.has("sin-asignar") && Boolean(clase.sinAsignar))` en unión OR con otros estados (D-3).
    - Agregada y expuesta función `activarFiltroSinAsignar()` que limpia estados anteriores, activa `"sin-asignar"`, actualiza UI de pills y ejecuta `aplicarFiltrosCruzados()` (D-4).
  - `popup.js`: extraído `activarFiltroSinAsignar` de `_filters` y pasado `onNotaClick` en `ctx` cuando la lista contiene ítems con `sinAsignar: true` (D-4).
  - `popup/features/filters.test.js`: actualizado test de popover para esperar 'Sin asignar' y agregados +3 tests para filtro `sin-asignar`, unión OR y `activarFiltroSinAsignar()` (56 → 59 tests).
- **Docs y baseline (K-5)**:
  - `docs/alertas-y-bloqueo-diseno.md`: actualizada fila «Tema sin asignar» de la tabla §5.3 con los nuevos comportamientos (clase `.sin-asignar`, flotado arriba en su curso, filtro en Estado y click en nota).
  - `docs/testing.md`: baseline actualizado a 64 archivos / 1029 tests (+7 tests).
  - `docs/ramas-en-revision.md`: estado actualizado a Plan 08b ejecutado.
- **Batería y veredicto**:
  - `verificador` ejecutó la suite completa: 64 archivos pasados, 1029 tests pasados (0 fallos), lint 0 errores / 0 warnings, typecheck limpio, build exitoso (.output/chrome-mv3/, 287.34 kB), y scripts de humo Bun `humo-editor.js` y `humo-editor-indice.js` en errores: 0.
