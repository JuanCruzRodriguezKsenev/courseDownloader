---
name: scrapers-inyectables-autocontenidos-plan15
description: Plan 15 scrapers inyectables autocontenidos en Sites Mate C y Moodle Asignaturas, wildcard en wxt.config.ts y tests en node:vm (78 archivos, 1129 tests)
metadata:
  type: project
---

# Scrapers Inyectables Autocontenidos (Plan 15)

## Puntos clave de la ejecución
- **Causa raíz atendida**: `chrome.scripting.executeScript({ func: portal.escanearListado })` serializa la función vía `toString()`. En `sitio/sites-matec/scraper.js` (`SUBPAGINAS_MATEC`, `buscarTituloElemento`, `extraerItemsDeDocumento`) y en `sitio/moodle-asignaturas/scraper.js` (`mapearConConcurrencia`) existían helpers y constantes en el ámbito del módulo, provocando `ReferenceError` en el navegador real.
- **Paso 1 (`sitio/sites-matec/scraper.js`)**:
  - `SUBPAGINAS`, `buscarTitulo` y `extraerItems` mudados adentro de `escanearListado`, asegurando aislamiento estricto serializable.
  - A nivel de módulo se mantuvieron las funciones/constantes para no romper compatibilidad con `sitio/sites-matec/scraper.test.js` (6/6 tests verdes).
- **Paso 2 (`sitio/moodle-asignaturas/scraper.js`)**:
  - `mapearConConcurrencia` mudada al interior de `escanearListado`.
  - 9/9 tests verdes en `sitio/moodle-asignaturas/scraper.test.js`.
- **Paso 3 (`wxt.config.ts`)**:
  - `host_permissions` ampliado de `'https://sites.google.com/ing.unlp.edu.ar/matec/*'` a `'https://sites.google.com/*'` unificando el patrón con el resto de los portales y cubriendo URLs base sin slash final.
  - Build limpio regenerando `.output/chrome-mv3/manifest.json`.
- **Paso 4 (`sitio/inyeccion.test.js`)**:
  - Ceguera de la suite cerrada: agregada prueba en sandbox limpio de `node:vm` evaluando e invocando la función inyectada para los 6 portales.
  - Control negativo verificando `err.name === 'ReferenceError'` ante variables libres fuera del sandbox.
  - 14/14 tests verdes.
- **Paso 5 / Baseline**:
  - Batería completa verificada por `verificador`: 78 archivos, 1129 tests (+7 tests en inyeccion.test.js), lint 0/0, tsc limpio, build ok.
  - `docs/testing.md` y `docs/ramas-en-revision.md` actualizados.
