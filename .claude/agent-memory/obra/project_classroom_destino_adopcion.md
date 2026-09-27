---
name: classroom-destino-adopcion
description: Adopción de descargas de Classroom en ~/U.N.L.P mediante TSV editable, cálculo md5, control de choques e índice .course-downloader.json
metadata:
  type: project
---

# Classroom: Adopción de descargas en ~/U.N.L.P (Corte 2a)

## Puntos clave de la ejecución
- **Alcance**: Corte 2a de `docs/specs/classroom-destino/spec.md` (plan `docs/plan-classroom-destino-2a-adopcion.md`). La extensión no se toca. Se agregaron funciones puras en `core/destino/` y scripts en `backend/adopcion/`.
- **Módulos puros en `core/destino/`**:
  - `indice.ts`: constantes, tipos canónicos según §Datos, `claveCurso` / `claveArchivo` (`<sitioId>:<id>`), `parsearIndice` y `serializarIndice` con claves ordenadas y `\n` final.
  - `carpetas.ts`: destinos canónicos (`DESTINOS`), `sugerirDestino` con 9 reglas ordenadas y anclajes `^` para `Parciales` y `Finales` (evita falsos positivos como derivadas parciales), y `resolverCarpeta` (subcarpeta de docente sólo para `Teorias`).
  - `nombres.ts`: `proponerNombre` en 9 pasos (extensión, extensiones internas .mp4/.pdf, docente, copias, año, orden `NN`, slug saneado, módulo `modN` desde el tema y ensamble).
  - `choques.ts`: `buscarChoques` agrupando por `ruta + "/" + nombre` en minúsculas con md5 distinto.
- **Herramientas Bun en `backend/adopcion/`**:
  - `leerStorage.js`: lector nativo de registros de LevelDB (`.log`) sin dependencias, extrayendo JSON mediante balanceo de delimitadores (`[` y `{`).
  - `generar.js`: extrae `recorridoTodos` y `listaPersistente` de Brave, valida consistencia, indexa md5 del árbol local y genera `cursos.tsv`, `temas.tsv` y `archivos.tsv` con cabeceras de comentarios `#` explicativas.
  - `aplicar.js`: modo ensayo por omisión (`--escribir` para ejecutar). Valida que el índice no exista, existencia de materias (RN-1), destinos válidos, inmutabilidad de `ya-esta` y `duplicado`, sanitización de nombres, seguridad de rutas y ausencia de choques. Copia con `COPYFILE_EXCL` sin xattr y escribe el índice atómicamente vía archivo temporal `.tmp`.
- **Verificación A**:
  - Control negativo en `carpetas.ts`: al remover `^` en Parciales, el test de "derivadas parciales" falló con `{ destino: "Parciales", regla: true }` y se restauró.
  - Ensayo real de `generar.js`: abortó con `"Error: la última lista es de un solo curso: corré 'Escanear todos los cursos'"` tal como predecía la medición del storage tras N-1.
  - ADR-0017 creado y documentado en `docs/adr/`.
  - Baseline en `docs/testing.md` actualizado a 50 archivos y 837 tests.
- **Batería de verificación**: delegada a `verificador`, 50 archivos / 837 tests en verde, 0 errores/warnings en lint, typecheck limpio y build exitoso.
- **Correcciones tras revisión (`docs/plan-classroom-destino-2a-correcciones.md`)**:
  - Reintento tras corte en `aplicar.js`: pre-construcción de `destinosPropios` a partir de las filas `copiar` y filtrado en `enMateria` para no confundir con `ya-esta` los archivos recién copiados antes de la validación. El control negativo (sin este filtro) dio 302 errores de `No se puede modificar`.
  - Duplicados en `aplicar.js`: `vistosMd5` guarda el `itemProcesado` de la primera fila. Los duplicados heredan `accion` (pasa a `omitir` si la primera fue omitida, `duplicado` si fue copiada o ya-esta), `carpeta`, `nombre` y `rutaDestinoRel`, salteando validación de nombres propios en TSV y evitando chequear choques.
  - TSV `archivos.tsv` en `generar.js`: comentario actualizado explicitando que duplicados acompañan a la primera fila con su md5.
  - Checklist A-1/A-2 actualizada en `docs/ramas-en-revision.md`.
  - Verificación A: ensayo tsv-ok (copiar 299, ya-esta 55, dup 4, omit 8), tsv-dup (idéntico), tsv-omit (copiar 298, dup 0, omit 13), escritura real simulación corte y reintento exitosos (1 copiado, ya-esta 353, dup 4, omit 8).
- **Editor web de adopción (`docs/plan-classroom-destino-2a-editor.md`)**:
  - `backend/adopcion/editor.js`: servidor Bun (`127.0.0.1:3002`) con lectura/escritura cruda preservando comentarios `#`, orden y `\n` final byte a byte (invariante validado con control negativo eliminando `\n` que falló con diferencia EOF).
  - Endpoints: `GET /` (sirve `editor.html`), `GET /api/datos` (filas TSV, `DESTINOS`, materias bajo raíz y docentes de Teorias), `POST /api/guardar` (valida claves, inmutabilidad de ya-esta/duplicado, nombres sanitizados con formato exacto `Archivo '...': nombre '...' no coincide con su sanitizado. Quedaría '...'` y escribe atómico vía `.tmp`), `POST /api/ensayo` (subproceso Bun corriendo `aplicar.js` sin `--escribir`).
  - `backend/adopcion/editor.html`: UI pura sin dependencias, temas claro/oscuro vía CSS vars, barra sticky con contadores en vivo (`copiar`, `ya-esta`, `duplicado`, `omitir`, `choques`), detección de choques en vivo agrupando por `(ruta/nombre).toLowerCase()` con md5s distintos, duplicados siguiendo dinámicamente el nombre y destino de su primera fila, y advertencia `beforeunload`.
  - Verificación A: 14 pruebas completas ((a) a (n)), control negativo exitoso y delegación a `verificador` con 50 archivos / 837 tests, 0 warnings/errores lint, typecheck limpio y build OK.
