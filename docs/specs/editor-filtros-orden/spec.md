# Spec: filtros y orden en el editor de adopción

- **Estado**: aprobada (el dueño aceptó los 21 supuestos sin cambios, «aprobado sin leer», 2026-10-05).
- **Fecha**: 2026-10-05.
- **Traza**: [`assumptions.md`](assumptions.md).
- **Spec hermana**: [`../editor-ignorar-y-raiz/spec.md`](../editor-ignorar-y-raiz/spec.md) (videollamadas y «sin destino»; esta spec **usa** su definición de tema sin destino y su detección de videollamadas).

## Historia

Como dueño que revisa cursos en el editor web de adopción, quiero **filtrar y ordenar** lo que veo (cursos, temas y archivos), para encontrar rápido lo que tengo que revisar sin recorrer todo a ojo.

## Contexto y problema

Medido en `backend/adopcion/editor.html` el 2026-10-05 (rama `editor-videollamadas-raiz`):

1. **Ya hay filtros, pero sólo de tema entero**: seis chips de estado (`data-filter` all/ready/review/unassigned/omitted/clash), «⚠ Solo problemas» y una búsqueda (`#filtro-texto-archivos`, hoy por tema y por nombre original o editado). Un tema pasa o no pasa completo: dentro de un tema se ven siempre todas sus filas.
2. **No hay ningún orden**: temas, archivos y cursos salen en el orden en que llegan.
3. **No se puede ver «sólo las videollamadas», «sólo lo que se va a copiar» ni «sólo los PDF»** de un curso.

## Alcance

**Incluye**
- Filtros de **fila de archivo**: por acción, videollamadas y tipo (extensión).
- Orden de temas, de archivos dentro de cada tema y de cursos en la barra lateral.
- Botón «Limpiar filtros».
- La búsqueda también encuentra por carpeta destino.

**No incluye**
- Cambios en el servidor, en el índice o en el orden de descarga.
- Vista cruzada de varios cursos.
- Persistir filtros u orden entre sesiones.
- Orden por columna clicable en la tabla de archivos.
- Cambiar qué hace cada chip existente.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Elegir filtros y orden; limpiarlos. |
| Editor web | Aplicarlos sólo a lo que dibuja. |

## Reglas de negocio

- **RN-1** — Filtros y orden son **sólo de vista**: no modifican `DATOS`, no activan «Cambios sin guardar», no alteran lo que se guarda ni el orden de descarga. *(A1, A2)*
- **RN-2** — Los seis chips y «Solo problemas» funcionan **igual que hoy**, a nivel de tema entero. *(A5)*
- **RN-3** — Filtro **«Mostrar»**, un solo valor a la vez, por defecto «Todas»: `Todas` · `A copiar` (acción `copiar`) · `Omitidas` (la fila se dibuja como omitida: acción `omitir` o tema omitido `-`, y no `ya-esta`) · `Ya en disco` (acción `ya-esta`) · `📹 Videollamadas` (la fila es videollamada, `esFilaVideollamada` de la spec hermana). Una fila con acción `duplicado` sólo aparece en `Todas`. *(A6, A7, A9)*
- **RN-4** — Filtro **«Tipo»**, un solo valor a la vez, por defecto «Todos». Las opciones salen de las extensiones de los `original` de los archivos del curso activo (minúsculas, sin el punto), ordenadas A→Z, y al final «(sin extensión)» si hay alguna fila así. Si el valor elegido deja de existir, vuelve a «Todos». *(A7, A9)*
- **RN-5** — Con «Mostrar» o «Tipo» distinto de su valor por defecto, cada tema muestra **sólo las filas que cumplen ambos** (Y), y el tema que queda sin ninguna fila se oculta. Se combina con Y con el chip activo, «Solo problemas» y la búsqueda. *(A6, A8)*
- **RN-6** — La búsqueda mantiene su forma actual (el tema pasa si su nombre o alguna de sus filas coincide; no recorta filas) y suma un criterio: coincide también con la **carpeta destino** del tema o de alguna fila (el destino efectivo; se ignoran `.` y `-`). *(A10)*
- **RN-7** — Los contadores de los chips (`#cntAll`, `#cntReady`, `#cntReview`, `#cntUnassigned`, `#cntOmitted`, `#cntClash`) siguen contando **el curso entero** y no cambian con filtros, búsqueda ni orden. *(A11)*
- **RN-8** — **Orden de temas** (selector «Temas»), por defecto «Como vienen»: `Como vienen` · `A→Z` · `Z→A` · `Más archivos primero` (cantidad total de filas del tema, sin filtrar) · `Problemas primero` (primero los temas sin destino o con choque). El tema huérfano «Novedades / Sin tema asignado» se ordena como cualquier otro. *(A12)*
- **RN-9** — **Orden de archivos** (selector «Archivos»), por defecto «Como vienen»: `Como vienen` · `Nombre original A→Z` · `Tipo` (extensión y, a igual extensión, nombre original). Se aplica a todos los temas a la vez. **Nunca** se ordena por el nombre editable ni por la carpeta destino, para que editar una fila no la mueva. *(A13, A14)*
- **RN-10** — Todo orden es **estable** y compara texto con `localeCompare("es", { numeric: true, sensitivity: "base" })`: «Clase 2» antes de «Clase 10», sin distinguir mayúsculas ni acentos. Los empates conservan «Como vienen». *(A12, A13)*
- **RN-11** — **Orden de cursos** en la barra lateral (selector sobre la búsqueda de cursos), por defecto «Como vienen»: `Como vienen` · `A→Z` (por nombre) · `Más para revisar primero` (temas sin destino + archivos en choque del curso, de mayor a menor). Es independiente del curso activo y **no se reinicia** al cambiar de curso. *(A15)*
- **RN-12** — Los controles de la vista del curso van en la barra de herramientas, junto a la búsqueda: selectores «Mostrar», «Tipo», «Temas» y «Archivos». *(A16, A17)*
- **RN-13** — «Limpiar filtros» aparece sólo si hay algo activo en la vista del curso (chip distinto de «Todos», «Solo problemas», búsqueda no vacía, «Mostrar», «Tipo», o cualquiera de los dos órdenes) y lo devuelve **todo** a su valor por defecto. No toca la búsqueda ni el orden de la barra de cursos. *(A18)*
- **RN-14** — Al **cambiar de curso**, la vista del curso vuelve a su valor por defecto (lo mismo que «Limpiar filtros»). *(A19)*
- **RN-15** — Nada se persiste: un F5 devuelve todo al valor por defecto. *(A20)*
- **RN-16** — Al empezar a buscar o al activar «Mostrar» o «Tipo», los temas que quedan visibles **se expanden**; el dueño puede colapsarlos a mano después. *(A21)*
- **RN-17** — *(derivada, D-1)* Las acciones a nivel de tema (casilla del tema, «heredar carpeta», subcarpeta) siguen actuando sobre **todas** las filas del tema, aunque el filtro oculte algunas. Cuando el filtro oculta filas, el tema lo dice: «mostrando X de Y archivos».
- **RN-18** — *(derivada, D-2)* Un filtro de fila se evalúa en cada dibujo: si el dueño cambia la acción de una fila (por ejemplo la destilda con «A copiar» activo), la fila sale de la vista en el siguiente dibujo. Es el comportamiento esperado de un filtro.

## Flujos

**Camino feliz — ver sólo las videollamadas de un curso.** El dueño abre el editor, elige el curso, pone «Mostrar» en «📹 Videollamadas»: cada tema muestra sólo sus videollamadas, los temas sin ninguna desaparecen y los que quedan se expanden.

| Alt. | Situación | Resultado |
|---|---|---|
| A1 | El filtro no deja ningún tema | Mensaje «No hay carpetas ni archivos que coincidan con los filtros.» (el de hoy) y el botón «Limpiar filtros» visible. |
| A2 | Cambia de curso con filtros activos | Se limpian (RN-14). |
| A3 | Tipo elegido que el curso ya no tiene | Vuelve a «Todos» (RN-4). |
| A4 | Edita una fila con orden «Nombre original» | La fila no se mueve (RN-9). |
| A5 | Resuelve un tema con orden «Problemas primero» | El tema pasa abajo en el siguiente dibujo (D-3). |

## Wireframes

Estado base de la barra de herramientas (sólo cambia esta región):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⌕ Buscar carpeta o archivo…   [⚠ Solo problemas]                                             │
│ Mostrar [Todas ▾]  Tipo [Todos ▾]  Temas [Como vienen ▾]  Archivos [Como vienen ▾]            │
│                                       [Expandir todos] [Colapsar todos] [📁 …] [Aplicar …]    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Con algo activo (se suma el botón):

```
│ Mostrar [📹 Videollamadas ▾]  Tipo [Todos ▾]  Temas [A→Z ▾]  Archivos [Como vienen ▾]  [✕ Limpiar filtros] │
```

Barra lateral (se suma el selector sobre la búsqueda):

```
┌──────────────────────────┐
│ Orden [Como vienen ▾]    │
│ [Buscar curso...        ]│
└──────────────────────────┘
```

Encabezado de un tema con filtro de fila activo: `1 de 5 archivos marcados para descargar · mostrando 1 de 5 archivos`.

## Criterios de aceptación

```gherkin
AC-1 — Filtrar sólo videollamadas (RN-3, RN-5, RN-16)
  Dado un curso con 3 videollamadas en «Teoría», 2 archivos normales en «Teoría» y un tema «Anuncios» sin videollamadas
  Cuando el dueño elige «📹 Videollamadas» en «Mostrar»
  Entonces «Teoría» muestra sólo sus 3 filas de videollamada, queda expandido
    y «Anuncios» no aparece

AC-2 — Filtrar por acción (RN-3)
  Dado un curso con filas en copiar, omitir y ya-esta
  Cuando el dueño elige «A copiar», luego «Omitidas», luego «Ya en disco»
  Entonces cada vez se ven sólo las filas de esa acción
    y las de un tema omitido cuentan como «Omitidas»

AC-3 — Filtrar por tipo (RN-4, RN-5)
  Dado un curso con archivos «a.pdf», «b.PDF», «c.docx» y «sala» sin extensión
  Entonces «Tipo» ofrece «Todos», «docx», «pdf», «(sin extensión)» en ese orden
  Cuando el dueño elige «pdf»
  Entonces se ven «a.pdf» y «b.PDF» y ninguna otra fila

AC-4 — Filtros que se combinan (RN-5)
  Dado «Mostrar» en «A copiar», «Tipo» en «pdf» y un chip «Revisar» activo
  Entonces una fila se ve sólo si es copiar y pdf y su tema pasa el chip

AC-5 — Los contadores no se mueven (RN-7)
  Dado los seis contadores con sus valores iniciales
  Cuando el dueño activa cualquier filtro, búsqueda u orden
  Entonces los seis contadores conservan el mismo valor

AC-6 — La búsqueda encuentra por carpeta destino (RN-6)
  Dado un tema «Teoría» con destino «Teorias/Palacio»
  Cuando el dueño busca «palacio»
  Entonces «Teoría» se ve, aunque ningún nombre de archivo contenga «palacio»

AC-7 — Orden de temas (RN-8, RN-10)
  Dado los temas «Clase 10», «clase 2», «Anuncios» y «Parciales» en ese orden de llegada
  Cuando el dueño elige «A→Z»
  Entonces se ven «Anuncios», «clase 2», «Clase 10», «Parciales»
  Cuando elige «Z→A» se ven al revés
  Cuando elige «Como vienen» vuelve el orden de llegada

AC-8 — Temas por cantidad y por problemas (RN-8)
  Dado un tema con 5 archivos, otro con 2 y otro sin destino con 1
  Cuando elige «Más archivos primero» el de 5 va primero y los empates conservan su orden
  Cuando elige «Problemas primero» el tema sin destino y los temas con choque van antes que el resto

AC-9 — Orden de archivos (RN-9, RN-10)
  Dado en un tema las filas «b.pdf», «A.docx», «a10.pdf», «a2.pdf»
  Cuando el dueño elige «Nombre original A→Z»
  Entonces se ven «A.docx», «a2.pdf», «a10.pdf», «b.pdf»
  Cuando elige «Tipo» se ven «A.docx» y después los pdf por nombre

AC-10 — Editar no reordena (RN-9)
  Dado «Nombre original A→Z» activo
  Cuando el dueño cambia el nombre en destino o la carpeta destino de una fila
  Entonces la fila queda en el mismo lugar

AC-11 — Orden de cursos (RN-11)
  Dado tres cursos con 0, 2 y 1 temas sin destino
  Cuando el dueño elige «Más para revisar primero» en la barra lateral
  Entonces van primero el de 2, después el de 1 y después el de 0
  Y al cambiar de curso el orden elegido se mantiene

AC-12 — Limpiar filtros (RN-13)
  Dado la vista sin nada activo
  Entonces no se ve «Limpiar filtros»
  Cuando el dueño activa «Solo problemas», una búsqueda y «Tipo»
  Entonces «Limpiar filtros» aparece
  Cuando lo toca
  Entonces todo vuelve al valor por defecto y el botón desaparece

AC-13 — Cambiar de curso reinicia la vista (RN-14)
  Dado filtros, búsqueda y órdenes activos en el curso A
  Cuando el dueño pasa al curso B
  Entonces la vista de B arranca con todo por defecto

AC-14 — Sólo de vista (RN-1)
  Dado cualquier filtro u orden activo
  Entonces «Cambios sin guardar» no aparece por eso
    y al guardar, el índice queda igual que si no se hubiera usado

AC-15 — Acciones de tema con filas ocultas (RN-17)
  Dado «📹 Videollamadas» activo en un tema con 3 videollamadas y 2 archivos
  Entonces el encabezado dice «mostrando 3 de 5 archivos»
  Cuando el dueño destilda la casilla del tema
  Entonces las 5 filas del tema quedan omitidas

AC-16 — Sin resultados (A1)
  Dado un filtro que ningún tema cumple
  Entonces se ve «No hay carpetas ni archivos que coincidan con los filtros.» y «Limpiar filtros»
```

## Datos

Sin datos nuevos. El estado de vista vive en variables de la página (junto a `activeFilter`, `searchTerm`, `onlyProblems`) y se pierde al recargar. El tipo de un archivo se deduce de `original`; no se guarda.

## Requisitos no funcionales

- **NFR-1** — Sin dependencias nuevas ni archivos nuevos en el servidor; todo en `backend/adopcion/editor.html`.
- **NFR-2** — Los humos existentes (`humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`) siguen en `errores: 0`; el modo TSV usa el mismo HTML.
- **NFR-3** — Cambiar un filtro u orden redibuja sólo lo necesario (`renderTopics` o `renderSidebar`), sin recargar datos.

## Supuestos resueltos

Los 21 supuestos se aprobaron sin cambios; el detalle está en [`assumptions.md`](assumptions.md). Lo que esta spec agregó para cerrar huecos que los supuestos no nombraban:

| Hueco | Decisión | Por qué |
|---|---|---|
| D-1: acciones de tema con filas ocultas | Actúan sobre todas las filas; el encabezado avisa «mostrando X de Y» | Evita que la casilla de un tema omita archivos que el dueño no ve; el aviso evita la sorpresa |
| D-2: fila que deja de cumplir el filtro al editarla | Sale en el siguiente dibujo | Un filtro que no se reevalúa miente |
| D-3: tema que se resuelve con orden «Problemas primero» | Se reubica en el siguiente dibujo | Es lo que significa el orden; los órdenes de archivo sí son estables (A14) |
| D-4: A16 y A17 dicen «dos selectores» | Son cuatro: «Mostrar», «Tipo», «Temas», «Archivos» | Con un solo valor por familia (A9), acción y tipo no caben en un selector |

## Preguntas abiertas

Ninguna.

## Dependencias

- **Plan 23 mergeado a `main`** (rama `editor-videollamadas-raiz`): este trabajo usa `esFilaVideollamada` y `temaSinDestino`, y toca el mismo `editor.html`.

## Secciones condicionales

Incluida: wireframes (toca interfaz). Descartadas: tabla de decisión (los filtros se combinan con Y, sin orden de evaluación que importe), contrato de interfaz (no hay API), diagrama de estados (no hay máquina de estados), glosario (menos de cinco términos nuevos), mediciones pendientes (ninguna).
