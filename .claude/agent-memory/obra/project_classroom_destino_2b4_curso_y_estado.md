---
name: classroom-destino-2b4-curso-y-estado
description: Sub-corte 2b-4, cada adjunto sabe de qué curso es y el popup pide el estado al backend (EnlaceListado con cursoId/tema, BunClient estadoDestino/indiceDestino, feature destino.js, bloqueo D-4 y cableado en popup.js)
metadata:
  type: project
---

# Classroom: Sub-corte 2b-4 (El curso viaja con cada adjunto y el popup pide el estado al backend)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/04 - 2b-4 El curso viaja con cada adjunto y el popup pide el estado al backend.md`.
- **Compuerta de partida (P-1)**:
  - 60 archivos, 945 tests pasados en rama `classroom-destino-2b`.
- **Escaneo con identidad de curso (P-2, D-1)**:
  - `sitio/google-classroom/scraper.js`: los enlaces mapeados conservan `cursoId: idCurso`, `cursoNombre: nombreCurso` y `tema: item.tema`. `modulo` queda idéntico (`<curso> › <tema>`).
  - `core/puertos/sitio.ts`: `EnlaceListado` agrega campos opcionales `cursoId?: string`, `cursoNombre?: string`, `tema?: string`.
- **Mapeo en UI y persistencia (P-3)**:
  - `popup.js`: al procesar enlaces escaneados en `aplicarEnlacesEscaneados`, se propagan `cursoId`, `cursoNombre`, `tema`, `destino`, `bloqueo` y `sinAsignar`.
- **BunClient (P-4)**:
  - `BunClient.prototype.estadoDestino(payload)`: `POST /api/destino/estado` con timeout de 15 s. Errores de red/timeout se lanzan; `{ ok: false, indiceIlegible: true, error }` se devuelve.
  - `BunClient.prototype.indiceDestino(portal)`: `GET /api/destino/indice?portal=` con timeout de 4 s.
  - `BunClient.prototype.seleccionarCarpeta({ portal })`: query param opcional `?portal=`, compatible hacia atrás sin argumentos.
- **Módulo desacoplado de destino (P-5, D-2, D-3, D-5)**:
  - `popup/features/destino.js`:
    - `aplicarEstadoDestino({ backend, sitio, clases })`: agrupa clases por `cursoId`, consulta en paralelo `POST /api/destino/estado` (D-6).
    - Asigna `estado`: `'downloaded'` o `'pending'` (sin pisar clases en `'process'`).
    - Asigna `destino = { ruta, nombre, claveCurso, original }` si el curso está asociado; `undefined` si no.
    - Asigna `sinAsignar`, `bloqueo = "sin-asociar"` si no está asociado, `bloqueo = "omitido"` si backend lo marca omitido.
    - Si el índice está ilegible, marca todas las clases del portal con `bloqueo = "indice-ilegible"`, deselecciona y devuelve `{ indiceIlegible: error }` sin alterar `estado`.
    - Clases huérfanas sin `cursoId` quedan bloqueadas como `"sin-asociar"`.
    - `bloquearSeleccion(clases)`: deselecciona clases con bloqueo (D-4).
    - `puedeBajar(clase)`: devuelve `!clase?.bloqueo` (D-4).
- **Cableado en popup y cola (P-6)**:
  - `cerrarSincronizacionDeDisco`: extrae la finalización común de `resolverMapeoEnUI` (desbanear filtros, badges, botones, filtros cruzados, contadores).
  - `ejecutarPaso2SincronizarDiscoVeloz`: particiona clases por `sitio.destinoPorIndice`. Las de Classroom van a `aplicarEstadoDestino`; las demás siguen por `escanearDisco`.
  - Embudo de contadores: `calcularContadoresBoton` llama a `bloquearSeleccion` al inicio.
  - `popup/features/queue.js`: `encolarItemsEnCaliente` filtra con `puedeBajar`. Si todos están bloqueados, no encola ni altera estados.
  - Selector 📂 (`popup.js`): pasa `{ portal: sitioActivo.id }` cuando el sitio tiene `destinoPorIndice`.
- **Documentación y baseline (P-7)**:
  - Actualizados `docs/data-model.md`, `docs/architecture.md`, `docs/testing.md` (61 archivos, 968 tests, +23 tests y +1 archivo nuevo) y `docs/ramas-en-revision.md`.
- **Control negativo (P-8)**:
  - P-2: anulación temporal de `cursoId` en `scraper.js` produjo fallo en test 5d (`expected undefined to be 'CURSO123'`).
  - P-5: anulación de `bloqueo = "sin-asociar"` produjo fallo en test de curso sin asociar (`expected undefined to be 'sin-asociar'`).
  - P-5: anulación de `bloqueo = "indice-ilegible"` produjo fallo en test de índice ilegible (`expected undefined to be 'indice-ilegible'`).
  - P-5: anulación de `puedeBajar` (`return true`) produjo fallo en test (`expected true to be false`).
  - Todos los cambios temporales fueron revertidos limpiamente.
- **Batería y compuerta final**:
  - Delegada a subagente `verificador`: 61 archivos / 968 tests pasados, 0 lint warnings/errors, tsc limpio, build exitoso.
