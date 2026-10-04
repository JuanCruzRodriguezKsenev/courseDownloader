---
name: classroom-destino-2b5-vista-lista
description: Sub-corte 2b-5, lo que ve el dueño en la lista (FilaClase con destino.nombre/dosUltimosSegmentos, chip-sin-asignar, bloqueo visual con checkbox disabled, notasDeDestino en ctx.nota, cardIndiceIlegible con botón Reintentar y raíz por portal en 📂)
metadata:
  type: project
---

# Classroom: Sub-corte 2b-5 (Lo que ve el dueño en la lista)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/05 - 2b-5 Lo que ve el dueño en la lista.md`.
- **Compuerta de partida (U-1)**:
  - 61 archivos, 968 tests pasados en rama `classroom-destino-2b`.
- **Fila con destino (U-2, D-1, D-2, D-3, D-6)**:
  - `popup/features/listaClases.preact.js`:
    - `FilaClase`: si la clase tiene `destino`, la etiqueta muestra `destino.nombre`; tooltip (`title`) muestra el original si difiere y la ruta de destino completa.
    - Pastilla secundaria muestra `dosUltimosSegmentos(destino.ruta)` con estilo atenuado.
    - D-2: si `clase.sinAsignar` es true, la etiqueta de módulo se prefija con `⚠ `, añade clase `chip-sin-asignar` y tooltip explicativo.
    - D-3: si `clase.bloqueo` está presente (`"omitido"`, `"sin-asociar"`, `"indice-ilegible"`), checkbox con `disabled`, fila con clase `.bloqueado`, tooltip con motivo, `onRowClick` no conmuta selección, y pastilla con estado legible.
    - D-6: si `resultadoDestino` es `'descartado'` o `'existente'`, tooltip `title` indica «Ya lo tenías: no se escribió nada».
  - `styles/list.css`: clases `.chip-sin-asignar` y `.bloqueado` usando variables CSS existentes (`--warning`, `--text-muted`, etc.), sin colores manuales ni transiciones/animaciones (cumpliendo `docs/alertas-y-bloqueo-diseno.md`).
- **Notas de destino (U-3, D-4)**:
  - `popup/features/destino.js`:
    - `notasDeDestino(clases)`: cuenta clases con `bloqueo === 'sin-asociar'`, `bloqueo === 'omitido'`, `sinAsignar === true`, y devuelve frases en plural/singular unidas con ` · `.
  - `popup.js`: asigna `ctx.nota = notasDeDestino(clases)` antes de llamar a `window.ListaClases.actualizar`.
- **Card de índice ilegible y reintento (U-4, D-5)**:
  - `popup/features/destino.js`:
    - `cardIndiceIlegible(error)`: genera HTML de error seguro con `escapeHtml` y botón de reintento.
  - `popup.js`:
    - Guarda `errorIndiceIlegible` y reemplaza el listado si está presente.
    - `calcularContadoresBoton`: activa botón de pie «Reintentar 🔄» en modo `reintentar-indice`.
    - Listener de `btnAction`: reintenta sincronizar con disco sin volver a scrapear el portal.
- **Raíz del 📂 por portal (U-5, D-7)**:
  - `popup/features/destino.js`: `aplicarEstadoDestino` extrae y expone `raiz` en el resultado.
  - `popup.js`: consulta `backend.indiceDestino(sitioActivo.id)` en arranque y tras sincronizar, actualizando `RutaDisco.setRuta` y el tooltip de `btnExplore`.
- **Documentación y baseline (U-6)**:
  - Actualizados `docs/alertas-y-bloqueo-diseno.md` (§5.3 tabla de qué mirar en navegador), `docs/preact-migration.md` (contrato de `FilaClase`), `docs/testing.md` (baseline 61 archivos, 981 tests, +13 tests) y `docs/ramas-en-revision.md`.
- **Control negativo (U-7)**:
  - Caso 1: alteración de prefijo en `dosUltimosSegmentos` causó 3 fallos en `listaClases.preact.test.js`.
  - Caso 2: `disabled=${false}` para clases bloqueadas causó fallo en test de checkbox inactivo.
  - Ambos revertidos y confirmados verdes.
- **Batería y compuerta final**:
  - Delegada al subagente `verificador`: 61 archivos / 981 tests pasados, 0 lint warnings/errors, tsc limpio, build exitoso.
