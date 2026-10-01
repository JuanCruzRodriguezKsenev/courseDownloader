---
name: classroom-destino-2b3-cola-extension
description: Sub-corte 2b-3, cola de la extensión baja a destino (ItemCola.destino, cabeceras x-destino-*, resultadoDestino, errores D-3 y frontmatter D-5)
metadata:
  type: project
---

# Classroom: Sub-corte 2b-3 (Cola de la extensión baja a destino del índice)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/03 - 2b-3 Cola de la extensión baja a destino.md`.
- **Compuerta de partida (T-1)**:
  - 60 archivos, 931 tests pasados en rama `classroom-destino-2b`.
- **Tipos y contratos (T-2)**:
  - `ItemCola.destino`: `{ portal, ruta, nombre, claveCurso, original }` opcional. No entra en `identidadClase.ts` (ADR-0014, D-1).
  - `PuertoSitio.destinoPorIndice?: boolean`: Classroom lo declara `true`, otros `undefined` (D-2).
- **BunClient (T-3)**:
  - `HeadersFragmento` incluye `destino`. Si está presente, envía `x-destino-portal`, `x-destino-ruta`, `x-clave-archivo`, `x-clave-curso`, `x-original` (codificados con `encodeURIComponent`). Sin destino, ninguno se envía.
  - Ante respuestas `!res.ok`, intenta parsear JSON `{ error, codigo }`: asigna `codigoBackend = codigo` y reemplaza el mensaje por `error`.
- **Composición y puerto (T-4)**:
  - `plataforma/composicion.ts`: `enviarBloqueAdjunto` resuelve con `{ resultado?: string }` del cuerpo parseado.
  - `DependenciasCola.enviarBloqueAdjunto` tipado como `Promise<{ resultado?: string } | void>`.
- **Procesador de cola con destino y manejo de errores (T-5)**:
  - Guarda temprana: si `sitio.destinoPorIndice` y no hay `destino`, saltea el ítem con rechazo D-2 sin invocar `resolverAdjunto` ni backend.
  - Con `destino`: `fileName = destino.nombre`, se envían cabeceras de destino y al finalizar se persiste `resultadoDestino` en `ClasePersistida` y se emite en `clase_guardada_ok` (D-4).
  - Mapa `textoDeCodigo` (D-3): `INDICE_ILEGIBLE` clasificado como bloqueo (`tipoPortal = "bloqueo"`, sin alarma de autoheal); `DESTINO_OCUPADO`, `MATERIA_INEXISTENTE`, `RUTA_INSEGURA`, `DESTINO_REQUERIDO` clasificados como rechazo (saltean ítem con mensaje específico).
- **Propagación en UI (T-6)**:
  - `popup/features/queue.js`: propaga `destino: c.destino` en `nuevosEncolados`.
  - `popup.js`: declara `destino: item.destino` al mapear ítems escaneados.
- **Accesos Markdown con frontmatter (T-7)**:
  - `sitio/google-classroom/descargarAdjunto.js`: `data:` URI inicia con frontmatter `tipo: acceso` y `revisado: AAAA-MM-DD` usando fecha local (`getFullYear`, `getMonth + 1`, `getDate`; nunca `toISOString()`, D-5).
- **Documentación y baseline (T-8)**:
  - Actualizados `docs/data-model.md`, `docs/architecture.md`, `docs/testing.md` (60 archivos, 945 tests) y `docs/ramas-en-revision.md`.
- **Control negativo (T-9)**:
  - Stash temporal de `procesadorCola.ts` ejecutado: 5 tests fallaron exactamente por la ausencia del código de T-5 ((a), (b), (c), (d), (e)), mientras que (f) (no regresión) pasó. Restaurado limpiamente.
- **Batería y compuerta final**:
  - Delegada al subagente `verificador`: 60 archivos / 945 tests pasados, 0 lint warnings/errors, tsc limpio, build exitoso.
