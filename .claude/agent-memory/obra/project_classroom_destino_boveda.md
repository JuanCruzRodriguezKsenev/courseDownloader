---
name: classroom-destino-boveda
description: La raíz del corte 2a pasa a la bóveda (~/Boveda/Areas/Facultad), índice versionado (ADR-0018), destino Notas/ y spec actualizada
metadata:
  type: project
---

# Classroom: Destino a la bóveda e índice versionado (Corte 2a)

## Puntos clave de la ejecución
- **Alcance**: `docs/plan-classroom-destino-2a-boveda.md`, `docs/specs/classroom-destino/spec.md`, ADR-0018.
- **Destino `Notas/` (D-3)**:
  - Agregado como 8º destino canónico al final de `DESTINOS` en `core/destino/carpetas.ts`.
  - Nueva regla inicial en `REGLAS_DESTINO`: `{ regex: /^(notas|resultados?)\b/i, destino: "Notas" }`.
  - Regla de `Parciales` actualizada a `/^(parcial|examen|recuperatorio)/i` (removido `|notas de evaluaci`).
  - Tests en `core/destino/carpetas.test.ts`: 8 destinos canónicos, temas reales para "Notas de evaluaciones" y "Resultados", títulos de publicaciones con mayoría de notas (+3 tests; total 862).
  - Comentario de `DESTINOS` en `backend/adopcion/generar.js` actualizado.
  - Control negativo obligatorio ejecutado y confirmado: fallaron exactamente 4 tests antes de actualizar `carpetas.ts`.
- **Raíz por defecto (D-1)**:
  - Creado `backend/adopcion/raiz.js` exportando `RAIZ_FACULTAD = path.join(os.homedir(), "Boveda", "Areas", "Facultad")`.
  - `aplicar.js`, `generar.js` y `editor.js` usan `RAIZ_FACULTAD` como raíz por defecto. Se mantiene `import os` para la expansión de `~`.
  - 0 menciones de `U.N.L.P` en código de `backend/` y `core/`.
- **Índice versionado (D-2)**:
  - `aplicar.js` deja de verificar UTF-16 en `.gitignore` y deja de añadir el índice a `.gitignore`. 0 referencias a `gitignore` en el archivo.
  - El índice se versiona con la bóveda privada.
- **Spec y documentación (D-1 a D-6)**:
  - `docs/specs/classroom-destino/spec.md` actualizada con encabezado, alcance, RN-1, RN-3, RN-3a, RN-17, RN-19 (exclusiones de `Wiki/`, `Mis notas/` y `Clases/`), RN-23, RN-24, RN-29a, fila 0b en tabla de decisión, NFR-2, dependencias, supuestos resueltos y PA-4 cerrado.
  - Creado ADR-0018 (`docs/adr/0018-raiz-en-la-boveda-indice-versionado.md`), actualizado ADR-0017 como superado en puntos 1 y 2, y actualizado `docs/adr/README.md`.
  - Actualizados `docs/deployment.md`, `docs/testing.md` (baseline 862 tests) y `docs/ramas-en-revision.md`.
- **Verificación literal**:
  - (a) Compuerta: 50 archivos, 862 tests, lint limpio, tsc=0, build exitoso.
  - (b) unlp_codigo=1, gitignore=1, 7 ocurrencias de RAIZ_FACULTAD en backend.
  - (c) rc=1 por índice preexistente en la bóveda, bóveda intacta (`$S0 = $S1`), sin `.tmp`.
  - (d) API del editor en puerto 3002 devuelve los 8 destinos incluyendo `Notas`.
  - (e) spec.md con reglas vivas actualizadas y 0 menciones a `ObsidianUNLP_Vault`.
- **Batería de verificación**:
  - Delegada al subagente `verificador`: 50 archivos pasados, 862 tests pasados, 0 errores/warnings en lint, typecheck limpio, build exitoso.
