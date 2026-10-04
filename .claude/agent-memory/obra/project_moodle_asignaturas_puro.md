---
name: moodle-asignaturas-puro
description: Plan 13 en MODO PURO (Plan 14) para asignaturas.info.unlp.edu.ar (adaptador completo en sitio/moodle-asignaturas/ con 25 tests en verde y 1074 totales)
metadata:
  type: project
---

# Moodle Asignaturas: Plan 13 en MODO PURO (Plan 14)

## Puntos clave de la ejecución
- **Alcance**: Adaptador aislado en `sitio/moodle-asignaturas/` sin tocar `registro.ts`, `entrypoints`, `wxt.config.ts`, `eslint.config.js` ni `docs/testing.md` (respetando restricción estricta de MODO PURO / Plan 14).
- **H-1 (Partida y fixtures)**:
  - Verificados fixtures sanitizados: `curso.html`, `carpeta.html`, `url-intermedia.html`, `login.html`.
  - NFR-2 verificado: `git grep -niE "sesskey|MoodleSession|@[a-z0-9.-]+\.(com|edu|ar)" -- sitio/moodle-asignaturas/__fixtures__` limpio.
- **H-2 (`scraper.js` + `scraper.test.js`)**:
  - Implementado `ScraperMoodleAsignaturas.escanearListado` serializable y autocontenido.
  - Desduplicación estricta por `module-<cmid>` con `Set`: en el DOM sin filtrar existen 160 `.modtype_resource` y 56 `.modtype_url` por anidamiento de `.section` en Moodle 4; desduplicado produce exactamente 80 resources, 28 urls y 1 folder (expandido a 2 archivos), total 110 enlaces (AC-1, RN-4a).
  - Sección 0 o «General» mapeada a `tema: "Sin tema"` (RN-4).
  - Resolución asíncrona de carpetas y URLs intermedias con concurrencia controlada ≤ 4 (NFR-3).
  - 9/9 tests en verde.
- **H-3 (`descargarAdjunto.js` + `descargarAdjunto.test.js`)**:
  - Implementado `DescargarAdjuntoMoodleAsignaturas.resolver(idArchivo, signal, credenciales)`.
  - Delegación de `acceso:` a `accesoADataUri` (RN-9) sin llamar a red.
  - Resolución de recursos directos (302 a `pluginfile.php`) e incrustados en HTML mediante regex sobre el cuerpo (RN-10, AC-2).
  - Resolución de archivos de carpetas `<cmid>/<ruta>` mapeando al enlace interno con `forcedownload=1` (RN-5, RN-7, AC-4).
  - Detección de sesión vencida hacia login con `tipoConexion: "sesion"` (RN-11).
  - Clasificación de 404/410 con `tipoPortal: "rechazo"` (RN-12).
  - 7/7 tests en verde.
- **H-4 (`parserTitulos.js` + `parserTitulos.test.js`)**:
  - Implementado `ParserTitulosMoodleAsignaturas.clasificarCarpeta(_crudo, materiaBase)` devolviendo `catedra: "COMUN"` y carpeta saneada a partir del curso (RN-1, RN-13).
  - 3/3 tests en verde.
- **H-5 (`config.ts` + `config.test.ts`)**:
  - Implementado `SitioMoodleAsignaturas: PuertoSitio` con 14 miembros: `id: "moodle-asignaturas"`, `destinoPorIndice: true`, `credencialesAdjunto: "include"`, `topeEscaneoMs: 60000`, sondeo a la raíz (D-3) y reconocimiento de `course/view.php?id=\d+` (D-2).
  - 6/6 tests en verde.
- **Compuerta y validación**:
  - Validación local de MODO PURO: `pnpm exec vitest run sitio/moodle-asignaturas/ && pnpm exec eslint sitio/moodle-asignaturas/ && pnpm exec tsc --noEmit` exitosa (25 tests en verde, 0 errores, 0 warnings de ESLint, typecheck limpio).
  - Suite completa: 70 archivos pasados (70), 1074 tests pasados (1074).
