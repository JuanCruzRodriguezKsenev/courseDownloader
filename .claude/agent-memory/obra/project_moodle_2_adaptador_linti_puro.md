---
name: moodle-2-adaptador-linti-puro
description: Plan 10 Moodle-2 ejecutado en Modo Puro (sitio/moodle-linti/ completo con scraper, descargarAdjunto, parserTitulos y config, 4 archivos de test y 21 tests pasando)
metadata:
  type: project
---

# Moodle: Plan 10 (Moodle-2: el adaptador de sitio/moodle-linti en Modo Puro)

## Puntos clave de la ejecución
- **Alcance**: Adaptador `sitio/moodle-linti/` en modo puro (Plan 14): únicamente archivos dentro de `sitio/moodle-linti/`. Sin tocar `registro.ts`, `entrypoints`, `wxt.config.ts`, `eslint.config.js` ni `docs/testing.md`.
- **H-1 (Precondición y fixtures)**:
  - Verificados los 5 fixtures en `sitio/moodle-linti/__fixtures__/`: `curso.html`, `carpeta.html`, `url-intermedia.html`, `login.html`, `medicion.md`.
  - NFR-2 cumplido: `git grep -niE "sesskey|MoodleSession|@[a-z0-9.-]+\.(com|edu|ar)" -- sitio/moodle-linti/__fixtures__` limpio (código 1).
  - Leído `medicion.md`: confirmado comportamiento con Moodle 4.5, tema Boost, actividades `resource`, `folder` y `url`.
- **H-2 (`sitio/moodle-linti/scraper.js` + `scraper.test.js`)**:
  - Implementado `ScraperMoodleLinti.escanearListado` inyectable y autocontenido.
  - Extracción de secciones de la región principal (`#region-main li.course-section[data-for='section']`) evitando duplicados del índice lateral (`courseindex`).
  - Mapeo de actividades `resource`, `folder` y `url` con concurrencia limitada ≤ 4 (NFR-3). Descarte de actividades `forum|quiz|page|choice` (AC-5).
  - Detección de login en `location.pathname`, `body.path-login` o `#page-login-index` emitiendo aviso de sesión (AC-6).
  - Desduplicado puro RN-7 por `(tema, texto normalizado)` agregando ` - <actividad>` y ` - <subcarpeta>` ante choques.
  - Decodificación URI en nombres de archivo (AC-9) y fallback a URL de Moodle en `url` opacos (AC-4).
  - Control negativo ejecutado y capturado: alterando la detección de login se observó fallo rojo exacto en Vitest (`expected 'sin-material' to be 'sesion'`); restaurado a verde (9 tests).
- **H-3 (`sitio/moodle-linti/descargarAdjunto.js` + `descargarAdjunto.test.js`)**:
  - Implementado `DescargarAdjuntoMoodleLinti.resolver(idArchivo, signal, credenciales)` para ejecución en Service Worker sin `DOMParser`.
  - Soporte de tres esquemas de `idArchivo`: `acceso:` (delega en `accesoADataUri` sin red), `<cmid>/<ruta>` (folder con regex sobre HTML y `forcedownload=1`), y `<cmid>` (resource con detección de página intermedia).
  - Manejo de sesión vencida: redirección a `/login/` lanza error con `tipoConexion: "sesion"` (D-5) diferenciado de `tipoPortal: "rechazo"`.
  - 404 lanza error con `httpStatus: 404` y `tipoPortal: "rechazo"` (AC-11).
  - 6 tests verdes.
- **H-4 (`sitio/moodle-linti/parserTitulos.js` + `parserTitulos.test.js`)**:
  - Implementado `ParserTitulosMoodleLinti.clasificarCarpeta` extrayendo el curso saneado con `Utils.sanearNombreCarpeta` y `catedra: "COMUN"`.
  - 2 tests verdes.
- **H-5 (`sitio/moodle-linti/config.ts` + `config.test.ts`)**:
  - Implementado descriptor `SitioMoodleLinti` satisfaciendo contrato `PuertoSitio`: `id: "moodle-linti"`, `credencialesAdjunto: "include"`, `destinoPorIndice: true`, `urlSondeoInternet: "https://catedras.linti.unlp.edu.ar/favicon.ico"`, `topeEscaneoMs: 60000`.
  - 4 tests verdes.
- **Validación local**:
  - `pnpm exec vitest run sitio/moodle-linti/`: 4 archivos pasados, 21 tests pasados.
  - `pnpm exec eslint sitio/moodle-linti/`: 0 errores, 0 warnings.
  - `pnpm exec tsc --noEmit`: 0 errores de tipos.
