---
name: classroom-destino-2b6-cierre
description: Sub-corte 2b-6, cierre del corte 2b (migración de omitidos al índice real, spec al día con RN-31/PA-5 y md5 de 32 hex, checklist V-0..V-9 y baseline en 62 archivos / 987 tests)
metadata:
  type: project
---

# Classroom: Sub-corte 2b-6 (Cierre del corte 2b)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/06 - 2b-6 Cierre del corte 2b.md`.
- **Compuerta de partida (K-1)**:
  - 61 archivos, 981 tests pasados en rama `classroom-destino-2b`.
- **Script de migración y tests (K-2, D-1, D-2)**:
  - `backend/adopcion/migrar-omitidos.js`:
    - CLI con `--tsv <dir>`, `--indice <ruta>`, `--escribir` / `--ensayo`.
    - Agrega temas con destino `-` si no existen (nunca pisa carpetas existentes).
    - Agrega archivos omitidos a `cursos[clave_curso].omitidos` si su tema no está ya en `-`.
    - Valida que todas las claves de curso referenciadas en los TSV existan en el índice; aborta sin escribir ante curso desconocido.
    - Idempotente: 0 cambios en segunda corrida y archivo byte-idéntico.
    - Tabla formateada `curso | tema | agrega | ya estaba` con totales.
  - `backend/adopcion/migrar-omitidos.test.js`:
    - 6 tests (+6 tests, +1 archivo nuevo).
- **Migración del índice real (K-3)**:
  - Respaldo creado en `~/Descargas/indice-respaldo-*.json`.
  - Corrida de ensayo: 1 tema "-" (Física I › Cuestiones administrativas) y 8 omitidos (7 de G22, 1 de G25).
  - Corrida con `--escribir`: aplicada sobre `~/Boveda/Areas/Facultad/.course-downloader.json`.
  - Idempotencia comprobada: segunda corrida dio 0 cambios (1 tema "-", 8 omitidos ya existentes).
  - `git diff --stat` en `~/Boveda`: 1 archivo modificado, 16 inserciones, 3 líneas con coma añadida. Nada commiteado en la bóveda.
- **Spec al día (K-4)**:
  - `docs/specs/classroom-destino/spec.md`:
    - §Cortes de construcción: corte 2b marcado ✅ 2026-10-01 con puntero a planes 01 a 06.
    - §Datos: ejemplo corregido con md5 de 32 hex; tabla de campos documentando `omitidos` y tema con `"-"`.
    - RN-10: aclarada vigencia acotada a lo ya decidido, apuntando a RN-31 y PA-5.
    - RN-31 añadida: tratamiento de temas con `-` y archivos en `omitidos`.
    - PA-5 añadida: partición de RN-10 con la medición real (1 cronograma, 3 temas).
- **Docs de estado (K-5)**:
  - `docs/ramas-en-revision.md`: 2b como finalizado con planes 01-06; checklist V-0..V-9 copiada como pendiente (⬜); corte 2a marcado como mergeado.
  - `docs/TECHNICAL_DEBT.md`: conteo recalculado a 23 (3 🔴, 3 🟠, 17 ⚪); `/api/seleccionar-carpeta` construido sin verificar; MC4 y D12 cubiertos por tests sin verificar; items 22 y 23 agregados (PA-5 y generar.js vs propuesta.ts).
  - `docs/data-model.md`: documentado `.course-downloader.json` con `omitidos` y `temas["-"]`.
  - `docs/testing.md`: baseline actualizado a 62 archivos / 987 tests con desglose del +6.
- **Controles negativos (K-6)**:
  - Rompimiento de idempotencia: assertion error (expected 0, received 1).
  - Rompimiento de validación de curso desconocido: error de acceso en objeto no definido.
- **Batería y compuerta final**:
  - Subagente `verificador`: 62 archivos / 987 tests en verde, lint limpio, typecheck limpio, build exitoso.
