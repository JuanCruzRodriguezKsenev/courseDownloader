# 0020 — El trabajo vive en la bóveda; en el repo, la referencia del código

**Fecha**: 2026-10-13
**Estado**: Aceptada
**Supera a**: [ADR-0007](0007-dry-docs-canonical-homes.md), sólo en cuanto a **dónde** está cada hogar canónico. El principio (un hogar por concepto) sigue vigente.
**Contexto previo**: [ADR-0007](0007-dry-docs-canonical-homes.md) (documentación DRY).
**Diseño de ejecución**: plan 33, `~/Boveda/Proyectos/courseDownloader/Planes/33 - Cierre de la migracion de docs a la boveda.md`.

## Contexto

ADR-0007 fijó en `docs/` un hogar canónico para cada concepto, incluidos los que no son referencia del código: el estado, la deuda, las specs, los planes y los diseños de ejecución. Desde el 2026-09-30 esos conceptos viven en la bóveda de Obsidian (`~/Boveda/Proyectos/courseDownloader/`), que es donde los leen y escriben los agentes, y el repo seguía apuntando a `docs/` para buscarlos. El 2026-10-13 se mudó a la bóveda lo que quedaba en `docs/` y era trabajo (68 archivos).

## Decisión

1. **Estado, deuda, specs, planes, informes y diseños viven en la bóveda**, bajo `~/Boveda/Proyectos/courseDownloader/` (los planes ejecutados y anteriores al 2026-09-30, en `~/Boveda/Archivo/courseDownloader/Planes/`).
2. **En el repo quedan** `README.md`, `AGENTS.md` (con `CLAUDE.md` como puntero), la referencia del código (`docs/architecture.md`, `data-model.md`, `patterns.md`, `coding-standards.md`, `contributing.md`, `deployment.md`, `security.md`, `testing.md`, `tech-stack.md`), el how-to vigente, los ADR, los RFC y las fixtures.
3. **ADR-0007 sigue vigente como principio**: un hogar canónico por concepto. Sólo cambia dónde está cada hogar.

## Consecuencias

- El índice de dónde está cada cosa es la sección `## Mapa de docs` de `AGENTS.md`.
- Los ADR existentes son inmutables y siguen citando rutas viejas de `docs/` (`docs/plan-*`, `docs/specs/…`, `docs/TECHNICAL_DEBT.md`, `docs/*-diseno.md`). Las resuelve la tabla de equivalencias `~/Boveda/Proyectos/courseDownloader/Diseños/Mudanza de docs 2026-10-13.md`; lo mismo vale para las notas de `.claude/agent-memory/`.
- **En contra**: un clon del repo sin la bóveda no trae ni la deuda ni las specs. Es aceptable porque el proyecto tiene un solo usuario y la bóveda es su repositorio privado.
