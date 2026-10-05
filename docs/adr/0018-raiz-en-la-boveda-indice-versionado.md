# 0018 — La raíz es la bóveda y el índice se versiona

**Fecha**: 2026-09-28
**Estado**: Aceptada
**Supera a**: [ADR-0017](0017-indice-de-destino-en-la-raiz.md), puntos 1 (sólo la ubicación `~/U.N.L.P`) y 2 (no se versiona).
**Contexto previo**: [ADR-0007](0007-dry-docs-canonical-homes.md) (documentación DRY), [ADR-0017](0017-indice-de-destino-en-la-raiz.md) (índice de destino en la raíz).
**Diseño de ejecución**: `docs/specs/classroom-destino/spec.md`, `docs/plan-classroom-destino-2a-boveda.md`.

## Contexto

El 2026-09-26, el repositorio `~/U.N.L.P` se incorporó mediante `git subtree` a `~/Boveda/Areas/Facultad` (commit `e55edae` de la bóveda). Desde entonces la bóveda es el único hogar de la facultad y `~/U.N.L.P` quedó retirado (conservándose como respaldo). La bóveda es un repositorio privado, a diferencia de `~/U.N.L.P` que era público.

La adopción del corte 2a ya fue aplicada en la bóveda en el commit `32136ca`: 295 archivos más el índice `Areas/Facultad/.course-downloader.json`, el cual quedó versionado en git.

## Decisión

1. **La raíz es `~/Boveda/Areas/Facultad`.**
   La raíz por defecto del árbol de la facultad pasa a ser `~/Boveda/Areas/Facultad`, centralizada en la constante `RAIZ_FACULTAD` en `backend/adopcion/raiz.js`.
2. **El índice se versiona.**
   Al ser la bóveda un repositorio privado, el índice `.course-downloader.json` **se versiona en git**. Ningún código de la extensión ni del backend lo agrega a `.gitignore`.
3. **Vigencia del resto de ADR-0017.**
   Todos los demás puntos de ADR-0017 siguen vigentes: claves compuestas `<portal>:<id>`, detección de "ya descargado" por md5 (nunca por nombre) y copia segura que nunca sobrescribe en disco (`COPYFILE_EXCL`).

## Consecuencias

- **A favor**: El índice queda respaldado con el historial de versiones de la bóveda y la deduplicación de descargas es reproducible al clonar el repositorio en otra máquina.
- **En contra**: Un `obsidian move` deja desactualizada la propiedad `ruta` del índice hasta que el corte 2b la corrija automáticamente por md5 (RN-19); mientras tanto, quien mueve un archivo debe actualizar el índice a mano si necesita mantenerlo sincronizado antes de dicho corte.
