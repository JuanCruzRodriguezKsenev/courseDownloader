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
