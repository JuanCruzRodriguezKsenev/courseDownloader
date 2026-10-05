---
name: classroom-destino-2b1-backend
description: Sub-corte 2b-1, raíz por portal, servicio atómico del índice y propuesta de destino en backend/core
metadata:
  type: project
---

# Classroom: Sub-corte 2b-1 (Backend y propuesta de destino)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/01 - 2b-1 Backend raíz por portal y servicio del índice.md`.
- **Compuerta de partida (B-1)**:
  - 50 archivos, 862 tests pasados en rama `classroom-destino-2b`.
- **Rutas y raíz por portal (B-2, B-3, B-4)**:
  - `backend/destino/rutas.js`: `esRutaBajo` pura con inyección de `pathMod` (POSIX/Win32) y `validarRutaRelativaSegura`.
  - `backend/utils.js`: `esRutaSegura` delega en `esRutaBajo` manteniendo retrocompatibilidad.
  - `backend/config.js`: `raicesPorPortal` con fallback por portal (`RAIZ_FACULTAD` para Classroom, `CARPETA_RAIZ_VIDEOS` para otros) y `establecerRaizDePortal`.
  - `backend/handlers.js`: `handleSeleccionarCarpeta` acepta `?portal=`, valida contra portales soportados y actualiza la raíz de ese portal sin pisar la general.
- **Reglas puras de decisión (B-5)**:
  - `core/destino/indice.ts`: `omitidos?: string[]` opcional en `CursoIndice` (D-7).
  - `core/destino/decidir.ts`: `decidirAntes` (por índice: ya-esta/omitido/pendiente; por disco: ya-esta) y `decidirDespues` (md5 en índice -> duplicado/ya-esta).
- **Servicio de índice, md5 y recorrido (B-6)**:
  - `backend/destino/md5.js`: hash MD5 por streams con caché en memoria indexada por `ruta|tamaño|mtime` y función `limpiarCacheMd5`.
  - `backend/destino/recorrido.js`: `recorrerRaiz` excluyendo `.dotfiles`, `Wiki/`, `Mis notas/`, `Clases/` y symlinks; `buscarPorMd5`.
  - `backend/destino/indiceServicio.js`: `leerIndice` sin efectos colaterales si no existe; `modificarIndice` atómico con mutex por raíz.
- **Propuesta de destino (B-7)**:
  - `core/destino/propuesta.ts`: asignación a carpeta existente o tema nuevo, RN-8 novedades, RN-14 index preservation, RN-16/16a resolución de choques con sufijo `_N` y soporte D-7 (`omitidos`).
- **Estado y endpoints backend (B-8)**:
  - `backend/destino/estado.js`: `calcularEstado` integrando índice, propuesta y recorrido por disco.
  - `backend/server.js`: rutas registradas GET `/api/destino/indice` y POST `/api/destino/estado`.
- **Documentación y ADR (B-9)**:
  - Creado `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md` e indexado en `docs/adr/README.md`.
  - Actualizados `docs/deployment.md`, `docs/architecture.md`, `docs/testing.md` (57 archivos, 910 tests) y `docs/ramas-en-revision.md`.
- **Medición M-1 y Verificación (B-10)**:
  - Recorrido en frío de 1615 archivos en `~/Boveda/Areas/Facultad`: **4,292 s** (tope 10 s).
  - Smoke test en vivo: GET `/api/destino/indice` y POST `/api/destino/estado` responden según contrato sin modificar `.course-downloader.json` en disco.
  - Batería delegada a `verificador`: 57 archivos / 910 tests pasados, 0 lint warnings/errors, tsc limpio, build exitoso.
