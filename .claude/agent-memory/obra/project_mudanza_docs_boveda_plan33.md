---
name: project-mudanza-docs-boveda-plan33
description: Plan 33 (2026-10-13) mudó a la bóveda deuda, ramas, specs, diseños y planes viejos de docs/; qué quedó en el repo y dónde el plan se quedó corto
metadata:
  type: project
---

Desde el plan 33, en `docs/` quedan sólo la referencia del código, el how-to vigente (`multisitio-diseno`, `medicion-de-portales`, `preact-migration`, `marca-diseno` y `marca/`) y los ADR (hasta el 0020). Deuda → `~/Boveda/Proyectos/courseDownloader/Deuda.md`; ramas en revisión → `Ramas en revisión.md`; specs → `Specs/<tema>/`; diseños de ejecución → `Diseños/`; planes `plan-*` → `~/Boveda/Archivo/courseDownloader/Planes/`. Tabla de rutas viejas: `Diseños/Mudanza de docs 2026-10-13.md`. Índice en el repo: `## Mapa de docs` de `AGENTS.md`.

**Why:** las rutas `docs/...` de estas memorias (y de los ADR) son anteriores a la mudanza; se resuelven con esa tabla, no se reescriben.

**How to apply:** si una memoria cita `docs/TECHNICAL_DEBT.md`, `docs/specs/…` o un `docs/*-diseno.md` mudado, buscarlo en la bóveda.

Dónde el plan se quedó corto (para tanda):
- P-0 pedía "sólo tu worktree" y había otro de un lanzamiento abortado de fábrica (sin commits, proceso muerto): se siguió y se informó.
- Los comandos literales de S3/S4 con `grep -r` sobre la bóveda y `git -C ~/Boveda` los rechaza la guarda de fábrica → [[feedback-fabrica-guardas-boveda]].
- G3 da 3 falsos positivos (continuaciones de comentario) → [[feedback-g3-comentarios-de-bloque]].
- §5.3 contaba también menciones sin `docs/` (p. ej. `alertas-y-bloqueo-diseno.md` en `popup.js`, `bloqueo.test.js`, `filters.css`), aunque G1/G2 sólo buscan con prefijo `docs/`: se reescribieron las dos formas.
- Reescribir enlaces en la bóveda pide un script con casos que el plan no enumeraba: links markdown dentro de code spans, acentos graves escapados, alias con `\|` dentro de tablas, y `[[Deuda]]` ambiguo (se usó la ruta).
