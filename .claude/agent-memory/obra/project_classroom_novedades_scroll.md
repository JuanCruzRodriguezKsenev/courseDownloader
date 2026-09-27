---
name: classroom-novedades-scroll
description: Exigencia de scroll real en buscarContenedorScroll para permitir la paginación del documento en Novedades de Classroom
metadata:
  type: project
---

# Classroom: Scroll de Novedades y paginación del documento

## Puntos clave de la ejecución
- **Causa del defecto (deuda 🟠 #13, medido 2026-09-27)**: Novedades en Classroom pagina cargando 10 posts por scroll del documento (`document.scrollingElement`). En `sitio/google-classroom/scraper.js`, `buscarContenedorScroll()` seleccionaba el elemento con `overflowY: auto|scroll` de mayor `scrollHeight` sin verificar si de verdad scrolleaba. En el DOM real de Classroom la barra lateral `<nav>` tiene `overflow-y: auto`, pero `scrollHeight === clientHeight` (806 px, no scrollea). `esperarQuietud()` le hacía scroll a la `<nav>`, el documento no se movía y sólo se leía la primera página (10-20 publicaciones / 3-4 adjuntos).
- **Solución implementada**:
  - `sitio/google-classroom/scraper.js`: en `buscarContenedorScroll()`, se añadió la condición `el.scrollHeight > el.clientHeight + 1` además de `overflowY === "auto" || overflowY === "scroll"`. Si ningún contenedor scrollea de verdad, cae en el fallback (`document.scrollingElement || document.documentElement || document.body`), que es el que efectivamente pagina. Cabecera actualizada a `V1.5.1`.
  - `sitio/google-classroom/scraper.test.js`: se agregaron helper `simularNovedadesPaginadas()` y tests 39 (paginación del documento ignorando `<nav>` con `overflowY: auto`) y 40 (preferencia de contenedor con scroll real sobre el documento).
- **Control negativo verificado**:
  - Remoción temporal de `el.scrollHeight > el.clientHeight + 1 && ` en `buscarContenedorScroll()`.
  - Fallo confirmado en test 39: `AssertionError: expected [ 'drive-sin-tema', …(18) ] to include 'drive-pag-1-1'`.
- **Docs actualizados**:
  - `docs/TECHNICAL_DEBT.md`: la deuda 🟠 #13 pasó a ✅ resuelta; re-contadas las abiertas a 20 (3 🔴, 3 🟠, 14 ⚪).
  - `docs/portal-google-classroom-diseno.md`: hallazgo 🟡 de Novedades en §9 referenciado al plan.
  - `docs/ramas-en-revision.md`: sección 🚧 En revisión actualizada con la rama y checklist N-1/N-2 para Brave.
  - `docs/testing.md`: baseline actualizado a 46 archivos / 801 tests.
- **Batería de verificación**: 46 archivos / 801 tests, lint limpio, typecheck limpio, build exitoso a `.output/chrome-mv3/`.
