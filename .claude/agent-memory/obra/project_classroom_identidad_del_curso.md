---
name: classroom-identidad-del-curso
description: Validación de identidad del curso por sidebar y DOM antes de listar y cinturones contra cambio de curso
metadata:
  type: project
---

# Classroom corte 1: Identidad del curso y prevención de contaminación de carpetas

## Puntos clave de la ejecución
- **Causa del defecto**: `document.title` se desfasa respecto de la URL y el DOM en la SPA de Classroom. El escaneo disparado en `tabs.onUpdated` con `status === 'complete'` estampaba el título desfasado en `modulo: `${nombreCurso} › ${item.tema}``, causando que archivos de un curso se guardaran en la carpeta de otro (81 archivos de G22 en carpeta de MC6).
- **Resolución de identidad en `sitio/google-classroom/scraper.js`**:
  - Cursos activos: se extrae del `aria-label` de `a[aria-current="page"][href*="/c/<idCurso>"]` en el sidebar (12/12 idéntico al título real en mediciones, manteniendo intacta la identidad de ítems previos).
  - Cursos archivados: sin sidebar, se deriva de `nombreSegunTitulo()` pero sólo si alguna ancla a `/c/<idCurso>` en el DOM lo confirma (normalizado NFKD sin espacios ni acentos). Se excluyen los links de vista ("Novedades", "Trabajo en clase").
  - Si no se confirma tras reintentar con `tiempos.identidadCurso` (8 s default / 200 ms test), aborta con `ResultadoEscaneo.aviso` sin mostrar listado inválido.
- **Cinturones de seguridad**:
  - Aborta si un ítem en Trabajo en clase o Novedades contiene ancla a otro curso (`/c/<otroId>/m/`).
  - Aborta antes de retornar si la URL de la pestaña cambió de curso durante el escaneo.
- **Trampas de tests y fixtures**:
  - En `curso.html`, el ancla de sidebar debe ir después de los links de vista en `<nav>` para que `buscarLinkNav(regexNovedades)` no seleccione la sidebar antes que el link de navegación a Novedades.
  - Al inyectar elementos de prueba para items de otro curso, seleccionar `#vista-trabajo div[role="region"]` y no el primer `div[role="region"]` del documento, que corresponde a `#vista-oculta`.
  - Control negativo verificado: el test 14 falló contra el scraper viejo (`29d7919`) con `AssertionError: expected false to be true` en `expect(e.modulo.startsWith("Física II › ")).toBe(true)`.
- **Suite**: 43 archivos, 723 tests en verde (+4 tests: 14 a 17 en `scraper.test.js`).
