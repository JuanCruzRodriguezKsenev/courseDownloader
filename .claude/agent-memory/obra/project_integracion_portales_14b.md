---
name: integracion-portales-14b
description: Plan 14-B integrador central de adaptadores de Moodle LINTI, Sites Mate C y Moodle Asignaturas (78 archivos, 1122 tests consolidados en el árbol principal)
metadata:
  type: project
---

# Integración Central de Adaptadores (Plan 14-B)

## Puntos clave de la ejecución
- **Alcance**: Alta oficial de los 3 nuevos portales desarrollados concurrentemente en el Plan 14 (`moodle-linti`, `sites-matec`, `moodle-asignaturas`) en los 5 puntos centrales de registro.
- **I-1 (`sitio/registro.ts` + `sitio/registro.test.ts`)**:
  - `SITIOS` ampliado con `SitioMoodleLinti`, `SitioSitesMatec` y `SitioMoodleAsignaturas`.
  - Pruebas de `Sitios.obtener` para los 6 portales.
  - Validación de disyunción estricta de `esPaginaDelSitio` entre los 6 portales (`registro.test.ts` con 25/25 en verde).
- **I-2 (Entrypoints `popup/main.js` y `background.js`)**:
  - `entrypoints/popup/main.js`: imports de `config.ts`, `parserTitulos.js` y `scraper.js` de los 3 portales nuevos.
  - `entrypoints/background.js`: imports de `config.ts`, `parserTitulos.js` y `descargarAdjunto.js` de los 3 portales nuevos.
- **I-3 (`wxt.config.ts`)**:
  - `host_permissions` ampliado con `catedras.linti.unlp.edu.ar/*`, `sites.google.com/ing.unlp.edu.ar/matec/*` y `asignaturas.info.unlp.edu.ar/*`.
- **I-4 (`eslint.config.js`)**:
  - Agregados los 12 nuevos globals a `globalesDelProyecto` (4 por portal).
  - Incorporado `.worktrees/**` a `ignores` para evitar que `eslint .` escanee los árboles aislados sin cobertura de rutas específicas.
- **Hallazgo crítico — `sitio/inyeccion.test.js`**:
  - Al iterar dinámicamente sobre `Sitios.todos()`, requiere que los `scraper.js` de todos los portales registrados estén importados en el test para que el getter `escanearListado` resuelva el global respectivo. Se agregaron los 3 imports destrabando la suite a 7/7 tests verdes.
- **Hallazgo de concurrencia — `vitest` y `.worktrees/`**:
  - Vitest no excluye `.worktrees/` por defecto, por lo que mientras existan worktrees dentro de la raíz, `pnpm test` ejecuta los tests de cada árbol de trabajo multiplicando el conteo (288 archivos / 4336 tests). En el árbol principal consolidado la cuenta neta es de 78 archivos y 1122 tests.
- **Documentación y compuerta**:
  - `docs/testing.md` actualizado con la baseline de 78 archivos / 1122 tests (+73 tests, +12 archivos nuevos).
  - `docs/ramas-en-revision.md` actualizado con los Planes 09, 10, 11, 13 y 14-B.
  - Compuerta completa limpia delegada a `verificador`: test verde, lint 0/0, typecheck limpio, build ok.
