---
name: moodle-asignaturas
description: Medición en vivo, diseño y spec del portal Moodle de Asignaturas (asignaturas.info.unlp.edu.ar, curso id=82) realizada el 2026-10-01
metadata:
  type: project
---

# Moodle de Asignaturas (`asignaturas.info.unlp.edu.ar`)

Firmado: tanda agy 3.8 flash high

- **Medición y diseño en Bóveda**: `~/Boveda/Proyectos/courseDownloader/Diseños/Moodle de Asignaturas - medición del portal.md`.
- **Spec**: `docs/specs/moodle-asignaturas/spec.md` y `assumptions.md`.
- **Fixtures**: descargados y sanitizados en `~/Descargas/` (`curso.html`, `carpeta.html`, `url-intermedia.html`, `login.html`), validados bajo NFR-2 (sin sesskey, sin emails ni nombres personales). Listos para mover a la rama del adaptador cuando se planifique.
- **Hallazgos clave frente a LINTI**:
  - `resource` responde `text/html` incrustado; resolver extrae `pluginfile.php` con regex sobre el cuerpo (D-3).
  - DOM duplica secciones en Moodle 4 (Sec 4 y 5 idénticas); scraper desduplica por `module-<cmid>`.
  - Sondeo: `/` responde 200 OK y `corp: null` (`/favicon.ico` da 404).
  - Videos: Kaltura en labels tratados como accesos directos `.md` (sin descarga binaria).
- **Mapeo a Bóveda**: materia Programación 2 en `~/Boveda/Areas/Facultad/Informatica/Programacion 2/` (`1. imperativo`, `2. objetos`, `3. concurrente`).
