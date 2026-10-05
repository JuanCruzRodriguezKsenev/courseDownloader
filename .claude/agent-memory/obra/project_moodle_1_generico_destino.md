---
name: moodle-1-generico-destino
description: Plan 09 Moodle-1 (G-1 a G-7 ejecutados con portales.js, accesoMd.ts, soporte de ítems Moodle en núcleo y compuerta en 66 archivos / 1049 tests)
metadata:
  type: project
---

# Moodle: Plan 09 (Moodle-1: lo genérico del destino por índice)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/09 - Moodle-1 Lo genérico del destino que hoy dice Classroom.md` en rama `moodle-linti`.
- **G-1**: Verificación de partida limpia: 64 archivos, 1034 tests, lint 0/0, tsc limpio, build exitoso.
- **G-2 (`backend/destino/portales.js` + `portales.test.js`)**:
  - Creado módulo puro node-free con `PORTALES_VALIDOS` (4 portales), `PORTALES_CON_DESTINO_INDICE` (`google-classroom`, `moodle-linti`) y `resolverRaizDeDestino`.
  - `backend/config.js:raizDeDestino` delega en `resolverRaizDeDestino`.
  - Re-exportado `PORTALES_CON_DESTINO_INDICE` en `backend/destino/escritura.js` y `PORTALES_VALIDOS` en `backend/handlers.js`.
  - Control negativo ejecutado y capturado: quitando `moodle-linti` de `PORTALES_CON_DESTINO_INDICE` fallan exactamente 2 tests; restaurado y verde (6 tests).
- **G-3 (`core/destino/accesoMd.ts` + `accesoMd.test.ts`)**:
  - Extraída función isomórfica pura `accesoADataUri(idArchivo, fecha)` compatible con browser y Node (TextEncoder + btoa por tramos).
  - `sitio/google-classroom/descargarAdjunto.js` subió a v1.2.0 delegando en `accesoADataUri` y eliminando `bytesABase64` local.
  - `sitio/google-classroom/descargarAdjunto.test.js` quedó intacto y verde.
- **G-4 (Formas de ítem de Moodle y destrabe por tanda)**:
  - Hallazgos iniciales: `propuesta.ts:138` requirió contemplar `!temaStr` para ítems sin tema, y `estado.test.js:336` ajustó su aserción a `idArchivo` dado que `calcularEstado` no retorna `clave` en `itemsRes`.
  - Con el destrabe de tanda: tests de Moodle en `core/destino/propuesta.test.ts` (16 tests) y `backend/destino/estado.test.js` (8 tests) verdes.
- **G-5 (Llamadores con portal explícito)**:
  - Confirmado vía `git grep`: todas las llamadas a `calcularEstado` y `proponerParaCurso` pasan `sitio`/`sitioId` explícito.
- **G-6 (Comentarios en `core/puertos/sitio.ts`)**:
  - Actualizados comentarios de `cursoId`, `cursoNombre`, `tema`, `publicacion` y `anuncio` para indicar «portales con destino por índice (Classroom, Moodle del LINTI)».
- **G-7 (Documentación de arquitectura, deployment y testing)**:
  - `docs/deployment.md`: portales válidos (4) y `DESTINO_REQUERIDO` para portales con destino por índice.
  - `docs/architecture.md`: documentados `backend/destino/portales.js` y `core/destino/accesoMd.ts`.
  - `docs/testing.md`: baseline actualizada a 66 archivos / 1049 tests con desglose exacto (+15 tests).
  - `docs/ramas-en-revision.md`: documentado corte Moodle 1 en curso en rama `moodle-linti`.
- **Batería y veredicto**:
  - Delegado a subagente `verificador`: 66 archivos pasados (66), 1049 tests pasados (1049), 0 fallos, 0 errores/warnings en ESLint, typecheck limpio, build WXT exitoso (287.36 kB).
