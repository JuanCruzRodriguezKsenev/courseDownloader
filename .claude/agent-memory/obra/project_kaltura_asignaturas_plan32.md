---
name: project-kaltura-asignaturas-plan32
description: Plan 32, label con Kaltura como acceso .md en Moodle Asignaturas; dónde el plan se quedó corto
metadata:
  type: project
---

Plan 32 ejecutado (2026-10-13): rama `kaltura` en `escanearCurso` de `sitio/moodle-asignaturas/scraper.js` (detección de label con `entry_id` + `<script src>` embedIframeJs, desduplicado por entryId, ítem acceso sin fetch). +4 tests, 87 archivos / 1334.

**Where the plan fell short:** (1) el plan listaba test 2 y 3 a actualizar, pero también rompían `scraper.test.js` test 7 (fallback de url: buscaba el primer `acceso:`, que ahora es el video) y `sitio/inyeccion.test.js:246` (`toBe(110)`). (2) El worktree de fábrica se ramificó de `a6b2abd`, anterior a la spec RN-15..18 en `main` (`e9d9536`); hubo que `git rebase main` para tener la spec.

**How to apply:** al planificar un ítem más sobre un fixture, grepear `toBe(<N>)` y `.find(... "acceso:")` en todo `sitio/`, no sólo en el test del scraper. Verificar que la base del worktree contenga los commits que el plan cita.
