---
name: classroom-identidad-en-archivados
description: Confirmación de identidad en cursos archivados de Classroom vía ancla del curso en h1
metadata:
  type: project
---

# Classroom corte 1: Identidad en cursos archivados

## Puntos clave de la ejecución
- **Causa del defecto en archivados**: en cursos archivados sin sidebar (`G25`, `MB5`), el plan previo intentaba descartar los links de vista ("Novedades", "Trabajo en clase") buscando con `buscarLinkNav`. Pero `buscarLinkNav` retorna la primera `nav a[href]` coincidente y en el DOM real ésa es el encabezado del curso dentro del `<h1>`. El filtro descartaba la única ancla que podía confirmar el título, provocando que el escaneo abortara tras 8 s con tarjeta de aviso sin listar nada.
- **Arreglo implementado (`sitio/google-classroom/scraper.js` v1.3.1)**:
  - Se eliminó el filtro por regex/textos de vista y se pasó a confirmar exclusivamente iterando `h1 a[href]` con `hrefDelCurso(a)`.
  - El ancla dentro de `<h1>` es única, existe en 40/41 muestras de curso, confirma en 40/40 y excluye las pestañas de vista por no estar dentro de un `<h1>`.
- **Fixture y tests (`curso.html`, `scraper.test.js`)**:
  - `curso.html`: se colocó el encabezado `<h1><a href="/u/2/c/CURSO123">Física<span> II</span></a></h1>` como primer elemento del `<nav>` reflejando el DOM real.
  - Test 15: se removió el ancla artificial inyectada en el test; ahora valida contra el `<h1>` del fixture.
  - Test 18 (+1 test): verifica que un ancla del curso suelta fuera de `<h1>` no valida el title, devolviendo aviso.
- **Baseline**: 43 archivos, 724 tests en verde.
