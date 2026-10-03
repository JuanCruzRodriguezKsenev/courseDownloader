---
name: sites-matec-puro
description: Adaptador puro de Google Sites Mate C en sitio/sites-matec/ (Plan 11 bajo protocolo Plan 14, 4 suites con 21 tests, fixtures sanitizados NFR-2 y triada local en verde)
metadata:
  type: project
---

# Google Sites Mate C: Adaptador puro (`sitio/sites-matec/`)

## Puntos clave de la ejecución
- **Alcance**: `~/Boveda/Proyectos/courseDownloader/Planes/11 - Sites-MateC El adaptador de la Videoteca y accesos.md` ejecutado bajo el protocolo de Plan 14 (modo puro).
- **Archivos creados (exclusivamente en `sitio/sites-matec/`)**:
  - `__fixtures__/series.html`: fixture representativo de `/inicio/series` con 8 videos YouTube, 2 videos Drive (.mp4/.MOV) y 8 PDFs Drive.
  - `__fixtures__/autoevaluaciones.html`: fixture con los 11 Google Forms.
  - `__fixtures__/resumen-medicion.json`: sanitizado eliminando `?authuser=0`.
  - `scraper.js`: `globalThis.ScraperSitesMatec = { escanearListado, extraerItemsDeDocumento, SUBPAGINAS_MATEC }`. Función autosuficiente inyectable en pestaña, fetch concurrente de las 9 subpáginas con `Promise.all` y `DOMParser`.
  - `scraper.test.js`: 6 tests unitarios en jsdom probando conteos exactos, tipos de adjunto, deduplicación y resiliencia ante errores de red.
  - `descargarAdjunto.js`: `globalThis.DescargarAdjuntoSitesMatec = { resolver }`. Resuelve `acceso:` a data URI Markdown usando `accesoADataUri` y `drive:` a URL de descarga directa `https://drive.google.com/uc?export=download&id=<id>`.
  - `descargarAdjunto.test.js`: 6 tests unitarios en node verificando formato, frontmatter, fecha local y rechazos.
  - `parserTitulos.js`: `globalThis.ParserTitulosSitesMatec = { clasificarCarpeta }`. Retorna `catedra: "COMUN"` y carpeta saneada del curso.
  - `parserTitulos.test.js`: 2 tests unitarios.
  - `config.ts`: descriptor `PuertoSitio` completo con `id: "sites-matec"`, `color: "#1a73e8"`, `urlSondeoInternet: "https://sites.google.com/favicon.ico"`, `destinoPorIndice: true`, `credencialesAdjunto: "include"`, `topeEscaneoMs: 10000`, `declare const` para evitar TS7016 sin violar `allowJs: false`.
  - `config.test.js`: 7 tests unitarios probando miembros del descriptor.
- **Sanitización NFR-2**:
  - `git grep -niE "@[a-z0-9.-]+\.(com|edu|ar)|authuser" -- sitio/sites-matec` completamente vacío (código 1).
- **Control negativo rojo de H-2**:
  - Modificación temporal de regex de YouTube en `scraper.js` produjo fallo exacto de 3 tests en `scraper.test.js`. Restaurado a verde.
- **Validación local (Plan 14)**:
  - `pnpm exec vitest run sitio/sites-matec/`: 4 archivos pasados (21 tests).
  - `pnpm exec eslint sitio/sites-matec/`: limpio, 0 errores, 0 warnings.
  - `pnpm exec tsc --noEmit`: limpio, 0 errores.
- **Aislamiento concurrente (Plan 14)**:
  - No se tocaron `registro.ts`, `entrypoints/`, `wxt.config.ts`, `eslint.config.js` ni `docs/testing.md`. El merge en la rama integradora queda 100% libre de conflictos.
