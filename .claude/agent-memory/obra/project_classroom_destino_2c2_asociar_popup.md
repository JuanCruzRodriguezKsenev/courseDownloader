---
name: classroom-destino-2c2-asociar-popup
description: Sub-corte 2c-2, asociar desde el popup y cierre del 2c (cableado de #ui-link-adopcion, BunClient.registrarCursoVisto, armarVistos y cursoParaEditor, multi-curso en backend/handlers.js, notasDeDestino con Abrí 🗂️ y compuerta en 64 archivos / 1022 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2c-2 (Asociar desde el popup y cierre del 2c)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/08 - 2c-2 Asociar desde el popup y cierre del 2c.md` en rama `classroom-destino-2c`.
- **Partida (J-1)**:
  - Verificada compuerta en verde: 64 archivos / 1010 tests.
- **Backend multi-curso y BunClient.registrarCursoVisto (J-2)**:
  - `backend/handlers.js`: adaptado `handleDestinoCursoVisto` para recibir `cursos: [...]` (múltiples cursos) o `curso: {...}` (retrocompatibilidad unitaria) llamando a `guardarVisto` para cada uno.
  - `docs/deployment.md`: documentado contrato flexible de `POST /api/destino/curso-visto`.
  - `core/backend/bunClient.ts`: implementado `registrarCursoVisto(payload, { timeoutMs })`. Errores de red/timeout lanzan; `{ ok: false }` se devuelve sin lanzar.
  - `core/backend/bunClient.test.ts`: +3 tests (forma del pedido D-3, error aplicativo devuelto, fallo de red lanzado; 34 → 37 tests).
- **popup/features/destino.js (J-3)**:
  - `armarVistos(clases, sitio)`: agrupa cursos de la lista por `cursoId` con sus ítems (D-3). Omite huérfanas sin `cursoId` y las cuenta en `sinCurso`. Devuelve `null` si no hay `destinoPorIndice` (D-1).
  - `cursoParaEditor({ clases, claveListado, sitio })`: devuelve la clave (`sitio:id`) a abrir en el editor web (D-2). Si la clave de listado no es `todos`, abre ése; si es `todos`, el primer curso con bloqueo `sin-asociar`; si todos están asociados, el primero de la lista.
  - `popup/features/destino.test.js`: +9 tests cubriendo armarVistos y cursoParaEditor en todos sus casos (19 → 28 tests).
- **Cableado de 🗂️ y texto de notasDeDestino (J-4)**:
  - `popup.js`: listener de clic sobre `#ui-link-adopcion` (`nodos.linkAdopcion`). Si el portal tiene `destinoPorIndice` y hay clases cargadas, previene navegación, envía vistos con `registrarCursoVisto` y abre `.../adopcion/?modo=indice&curso=<clave>` con `window.open`. Si falla por red, activa estado offline con `activarEstadoOfflineUI()`. Si no hay `destinoPorIndice` o no hay clases, el evento no se toca (D-1).
  - `popup/features/destino.js`: actualizado texto de `notasDeDestino` a «Abrí 🗂️ para asociarlo(s)» y «Abrí 🗂️ para asignarle(s) carpeta» (D-5).
  - `popup/features/destino.test.js`: actualizadas aserciones manteniendo prueba de inyección `<b>` como texto literal.
- **Docs y baseline (J-5)**:
  - `docs/ramas-en-revision.md`: corte 2c como construcción finalizada con checklist W-0..W-7 (todas en ⬜).
  - `docs/specs/classroom-destino/spec.md`: corte 2c anotado como construido (sin verificar en navegador).
  - `docs/portal-google-classroom-diseno.md`: línea de referencia a la spec de destino.
  - `docs/TECHNICAL_DEBT.md`: recontadas 25 entradas abiertas (3 🔴, 3 🟠, 19 ⚪) incluyendo los 2 ítems del editor.
  - `docs/testing.md`: baseline actualizado a 64 archivos / 1022 tests con su desglose (+12 tests).
- **Controles negativos (J-6)**:
  - `armarVistos`: omitida temporalmente la guarda de `destinoPorIndice`; falló con `AssertionError: expected { Object (cursos, sinCurso) } to be null`; restaurado a verde.
  - `cursoParaEditor`: omitida temporalmente la preferencia de primer curso `sin-asociar`; falló con `AssertionError: expected 'google-classroom:c1' to be 'google-classroom:c2'`; restaurado a verde.
- **Batería y veredicto**:
  - `verificador` ejecutó la suite completa: 64 archivos pasados (64), 1022 tests pasados (1022), 0 fallos, lint 0 errores / 0 advertencias, typecheck 0 errores, build exitoso en 1.92 s (286.35 kB).
