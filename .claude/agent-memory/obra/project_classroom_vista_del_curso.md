---
name: classroom-vista-del-curso
description: Descarte de vistas transitorias o de otro curso en cambios de vista de Classroom
metadata:
  type: project
---

# Classroom: La vista que se lee tiene que ser la del curso

## Puntos clave de la ejecución
- **Causa del defecto (L-2 del dueño)**: al cambiar de vista en Classroom, la SPA expone ~100-200 ms la vista del curso anterior o ninguna (`obtenerVistaActiva` cae a `body`, que engloba todas las vistas del DOM). Las esperas de navegación y de asentado aceptaban de inmediato la vista anterior; en el recorrido multi-curso (G22 → MC6), MC6 leía las publicaciones de G22 y cortaba con `motivoCorte: "navegacion"` al toparse con enlaces `/c/G22/m/`.
- **Criterio de discriminación (`nombraOtroCurso`)**:
  - Enlaces de vista nombran a su curso y a ningún otro (39/39 muestras).
  - Patrones: `/^(?:https:\/\/classroom\.google\.com)?(?:\/u\/\d+)?\/(?:c|w)\/([^/?#]+)/` y `/^(?:https:\/\/classroom\.google\.com)?(?:\/u\/\d+)?\/a\/[^/?#]+\/([^/?#]+)(?:[?#]|$)/` (anclado al final para no confundir `/details`).
  - `nombraOtroCurso(raiz)` devuelve true si encuentra un enlace a un curso distinto de `idCurso`.
- **Aplicación en `sitio/google-classroom/scraper.js`**:
  - Espera de navegación a Trabajo: descarta vistas con `nombraOtroCurso(va)`.
  - `trabajoAsentado`: descarta vistas con `nombraOtroCurso(va)` y resetea `desdeCuandoVacio = null`.
  - Captura de vista asentada: se guarda la referencia `va` evaluada en el predicado (`vistaAsentada`, `vistaNovedadesLista`) en lugar de volver a consultar `obtenerVistaActiva()`.
  - Espera de navegación a Novedades: descarta vistas con `nombraOtroCurso(va)`.
  - Convivencia con `avisoCursoCambiado`: si `pintadoOk` agota el tiempo y la vista contiene `/c/<otroId>/m/`, devuelve `avisoCursoCambiado` en lugar de timeout genérico, manteniendo verde el Test 17 y la señalización correcta si el usuario cambió de curso.
- **Control negativo verificado**:
  - Con `git stash` de `scraper.js`, los tests 37 y 38 fallaron con `AssertionError: expected 'curso-cambiado' to be undefined`.
- **Suite**: 46 archivos / 798 tests en verde (+2 tests: 37 y 38 en `scraper.test.js`).
