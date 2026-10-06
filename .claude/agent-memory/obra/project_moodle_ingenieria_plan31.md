---
name: Moodle Ingeniería, el sexto portal (Plan 31)
description: Sexto portal Moodle Ingeniería por curso y multicurso desde /my/, sección 0 con nombre propio (RN-4), H-1 en backend y paridad tripartita de recorrido
metadata:
  type: project
---

### Resumen del plan
- Implementación del sexto portal `moodle-ingenieria` (`www.asignaturas.ing.unlp.edu.ar` y sin `www`).
- H-1 resuelto en `backend/destino/portales.js` (`moodle-asignaturas`, `sites-matec` y `moodle-ingenieria` sumados a `PORTALES_CON_DESTINO_INDICE` y `PORTALES_VALIDOS`).
- Fixtures sintéticos (NFR-2) para curso, carpeta, url, login y mis-cursos.
- Módulos `parserTitulos.js` y `descargarAdjunto.js` (redirección 302, carpetas `mod_folder`, detección de corte por login y rechazo 404).
- `scraper.js` con soporte individual y multicurso desde `/my/`, sección 0 con nombre propio (RN-4), y bloque `<recorrido-moodle>` intacto.
- Descriptor `config.ts`, registro en `sitio/registro.ts`, cableado en background, popup, permisos en `wxt.config.ts` y ESLint.
- Evaluación JSDOM en `node:vm` probada en `sitio/inyeccion.test.js`.
- Paridad byte a byte tripartita en `sitio/moodle-recorrido-paridad.test.js`.
- Baseline de tests: 87 archivos, 1313 tests (+4 archivos, +40 tests).

### Hallazgos y puntos a recordar
1. **Regex `esPortada`**: Moodle Ingeniería es una versión previa de Moodle sin `/my/courses.php` (da 404). La regex de `esPortada` debe validar `/my/` y query params pero no subrutas: `^https:\/\/(?:www\.)?asignaturas\.ing\.unlp.edu.ar\/my\/?(?:\?.*)?$`.
2. **Sección 0 con título propio (RN-4)**: En Ingeniería la sección 0 puede llamarse «Presentación» u otro nombre de materia. Si tiene nombre propio se conserva; si no tiene o dice «General», cae en «Sin tema».
3. **H-1 resuelto**: `moodle-asignaturas` y `sites-matec` faltaban en `PORTALES_CON_DESTINO_INDICE` en el backend; se incorporaron junto con `moodle-ingenieria`.
4. **Paridad de tres vías**: `sitio/moodle-recorrido-paridad.test.js` ahora compara LINTI, Asignaturas e Ingeniería asegurando paridad byte a byte del bloque `<recorrido-moodle>`.
