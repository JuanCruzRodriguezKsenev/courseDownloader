## Qué cambia y por qué

<!-- Descripción breve del cambio y la motivación -->

## Checklist de documentación

Este proyecto trata la documentación con la misma disciplina que el código (`docs/contributing.md`) — un doc que miente es peor que no tener doc. Completar antes de mergear:

- [ ] Si cambié una clave de `chrome.storage` o la forma de un objeto persistido → actualicé `docs/data-model.md`.
- [ ] Si cambié cómo se comunican popup/SW/offscreen, o agregué una acción IPC nueva → actualicé `docs/architecture.md` y/o `docs/patterns.md`.
- [ ] Si tomé una decisión de arquitectura significativa → agregué un ADR nuevo en `docs/adr/` (nunca edito uno existente).
- [ ] Si mi cambio toca manejo de contenido scrapeado o de terceros → revisé `docs/security.md`.
- [ ] Si resolví un ítem de `docs/TECHNICAL_DEBT.md` → lo marqué como resuelto ahí.

## Cómo se probó

<!-- Golden path manual (ver docs/contributing.md), tests agregados, o ambos -->
