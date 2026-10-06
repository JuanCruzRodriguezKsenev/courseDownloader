# Moodle del LINTI: escanear todos los cursos desde `/my/`

**Estado**: `draft` — dependen de **M-1**, **M-2** y **M-3** (§Mediciones pendientes) RN-2, RN-8 y RN-12; ninguna bloquea el plan.
**Fecha**: 2026-10-05
**Autor**: tanda (Claude Sonnet 5.5)
**Firmado**: tanda claude sonnet 5.5
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Hereda de**: [`../moodle-linti/spec.md`](../moodle-linti/spec.md) (`linti:RN-n`), [`../moodle-asignaturas-multicurso/spec.md`](../moodle-asignaturas-multicurso/spec.md) (`info:RN-n`, la regla hermana de Informática), [`../moodle-ingenieria/spec.md`](../moodle-ingenieria/spec.md) (`ing:RN-n`), [`../classroom-escanear-todas/spec.md`](../classroom-escanear-todas/spec.md) (`todas:RN-n`) y [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (`destino:RN-n`).

---

## Historia

> Como estudiante, quiero que la extensión escanee **todos mis cursos** del Moodle del LINTI
> (`catedras.linti.unlp.edu.ar`) desde `/my/` o `/my/courses.php` de una vez, en vez de abrir cada curso,
> para tener la lista completa sin entrar uno por uno.

## Contexto y problema

`moodle-linti` escanea **un curso por vez**, el de la pestaña (`linti:RN-3`), y su Alcance excluye el escaneo
desde una portada. Esta spec levanta esa exclusión. Hoy `esPaginaDelSitio` sólo reclama `course/view.php?id=`
(`sitio/moodle-linti/config.ts:41`), así que en `/my/` el popup no reconoce el portal.

Medido el 2026-10-05 (cuenta del dueño, Script D en `/my/courses.php`): **3 cursos** y sin duplicados.

| id | Título | Actividades | Tipos | ms |
|---|---|---|---|---|
| 1331 | 2026 - (I103) PROGRAMACION III | 26 | 8 resource, 10 folder, 3 url, 3 forum, 1 bigbluebuttonbn, 1 label | 645 |
| 1352 | ISO-CSO - Segundo Semestre 2026 | 22 | 9 resource, 3 folder, 5 url, 2 forum, 2 quiz, 1 page | 423 |
| 1371 | Taller de Lenguajes II - 2026 | 27 | 20 resource, 2 assign, 2 forum, 2 label, 1 attendance | 320 |

El HTML de cada curso por `fetch` trae todas las actividades, con 200 y sin ir a login. Los tipos
`bigbluebuttonbn`, `attendance`, `assign`, `page`, `quiz`, `label` y `forum` quedan fuera por `linti:RN-2`.

## Alcance

**Incluye**
- «Escanear todos los cursos» desde `/my/` y `/my/courses.php` de `catedras.linti.unlp.edu.ar`.
- El recorrido reusa el escaneo de un curso (`linti:RN-1..13`) sin cambiarlo.

**No incluye**
- Descargar solo: el recorrido termina en la lista.
- Otros portales Moodle (cada uno tiene su spec).
- Listar los tipos que `linti:RN-2` excluye (incluida la videollamada `bigbluebuttonbn`).
- Cambiar el escaneo de un curso suelto.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir `/my/`, escanear todos, ver resumen y lista, asociar cursos a materias, bajar como hoy |
| Extensión | Recorrer los cursos de la página con la sesión del navegador, en serie |
| Backend | Sin cambios; escanear no lo usa |

---

## Reglas de negocio

- **RN-1** — En `/my/` y `/my/courses.php` el popup ofrece **«Escanear todos los cursos»**, también con un solo curso; abrir el popup ahí no escanea solo (`ing:RN-14`). Dentro de un curso, abrir el popup escanea ese curso como hoy (`linti:RN-3`).
- **RN-2** — Entran los ids de `course/view.php?id=` de la página, **desduplicados** y en orden de aparición, incluidos los de años anteriores (`ing:RN-15`). Que «Todos» liste todo y no haya paginación es **M-2**.
- **RN-3** — Los cursos se recorren **en serie** desde la pestaña con `fetch` same-origin con credenciales. Nunca en paralelo ni en pestañas de fondo (`ing:RN-16`).
- **RN-4** — De cada curso se hace **lo mismo que el escaneo de un curso** (`linti:RN-1` a `RN-13`): `resource` y `folder` como adjuntos, `url` como acceso `.md`. Ese escaneo no cambia.
- **RN-5** — Los demás tipos de actividad no se listan ni generan aviso (`linti:RN-2`).
- **RN-6** — Cada curso conserva su tope de 60 s. Un curso que lo supera se saltea, con el motivo en el resumen.
- **RN-7** — Un curso que falla por una causa **distinta de sesión** (HTML sin actividades donde se esperan, tope, error de red) se saltea y el recorrido sigue, con el motivo en el resumen (`todas:RN-8`).
- **RN-8** — **Sesión vencida** (la URL final va a `/login/`): el recorrido **se corta con aviso de sesión (sin reanudación: se conservan los cursos completos y el curso en el que venció no figura como fallido ni como vacío)** (`linti:RN-10`, `ing:RN-11`). El aviso de duración antes de arrancar sale de **M-1**.
- **RN-9** — Si el dueño navega fuera de la portada, o cierra la pestaña, el recorrido se corta: se conservan los cursos completos y se descarta el que estaba a medias (`todas:RN-9`).
- **RN-10** — Un curso sin material no aparece en la lista; cuenta como vacío en el resumen (`todas:RN-14`).
- **RN-11** — El progreso y el resultado se guardan a medida que avanza: cerrar el popup no corta el recorrido y al reabrirlo se ve el progreso o el resultado (`todas:RN-15`, `todas:RN-16`).
- **RN-12** — El recorrido termina en la lista: no encola ni descarga nada. La lista agrupa por curso y **reemplaza** a la guardada (`todas:RN-18`). Que el `fetch` avance con la pestaña en segundo plano es **M-3**.
- **RN-13** — Al terminar o cortarse hay un resumen: cursos con material, vacíos y fallidos con su motivo (`todas:RN-17`).
- **RN-14** — La clave de cada ítem lleva su curso (`moodle-linti:<id>`), así dos cursos nunca comparten clave (ADR-0014): un mismo PDF en dos cursos aparece dos veces.
- **RN-15** — `moodle-linti` declara `esPaginaDelSitio` verdadera también para la portada, y `esPortada(url)` verdadera para `https://catedras.linti.unlp.edu.ar/my/` y sus subrutas (incluye `/my/courses.php`). `claveDeListado` devuelve `"todos"` ahí (`core/estado/origenListado.ts:75`; modelo: `sitio/google-classroom/config.ts:71-81`). `esPaginaDelSitio` sigue sin reclamar otras páginas de Moodle (`linti:A8`).
- **RN-16** — Valen sin cambio `destino:RN-1` a `destino:RN-30`, `linti:RN-13` y `RN-14`, la asociación del curso a una materia en el editor, y el nombre y color del portal.

## Flujos

**Camino feliz**
1. El dueño abre `/my/courses.php` y el popup ofrece «Escanear todos los cursos» con el aviso de duración.
2. Lo aprieta; la tarjeta muestra «Curso 1 de 3: PROGRAMACION III».
3. Termina: resumen (3 con material) y lista agrupada por curso. Los cursos sin asociar se listan y no se bajan (`linti:RN-13`); los asocia en el editor y baja como hoy.

**Alternativos**

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | Un curso falla o supera 60 s | Se saltea; fallido con su motivo (RN-6, RN-7) |
| A2 | Un curso sin material | No aparece en la lista; vacío en el resumen (RN-10) |
| A3 | Navega fuera de la portada a mitad | Se corta, se conservan los completos (RN-9) |
| A4 | Cierra el popup a mitad | El recorrido sigue (RN-11) |
| A5 | Sesión vencida | Se corta con aviso de sesión (RN-8) |
| A6 | Un solo curso en la página | Se ofrece y corre igual (RN-1) |
| A7 | Todos fallan o están vacíos | No hay lista; sólo el resumen |

## Datos

- **Entidades nuevas:** ninguna. Reusa `Clase`/`ColaItem` con `sitioId: "moodle-linti"` y `recorridoTodos`.
- **Retención:** la lista guardada y `recorridoTodos` son una sola y se reemplazan (RN-12).

## Criterios de aceptación

```gherkin
AC-1 — Botón en la portada
  Dado el popup abierto en catedras.linti.unlp.edu.ar/my/courses.php con 3 cursos
  Cuando el popup termina de abrir
  Entonces ofrece "Escanear todos los cursos" con el aviso de duración
    y no escanea ningún curso

AC-2 — Tres cursos
  Dado /my/courses.php con los cursos 1331, 1352 y 1371
  Cuando el dueño aprieta "Escanear todos los cursos"
  Entonces la tarjeta avanza de "Curso 1 de 3" a "Curso 3 de 3"
    y el resumen cuenta 3 con material, 0 vacíos y 0 fallidos
    y la lista agrupa por curso sólo resource, folder y url

AC-3 — Cursos sin material
  Dado /my/courses.php con 5 cursos, 2 sin ningún resource, folder ni url
  Cuando se escanea todo
  Entonces el resumen cuenta 5 cursos, 3 con material y 2 vacíos
    y la lista no muestra los vacíos

AC-4 — Un curso falla
  Dado un recorrido donde el curso 2 supera los 60 s
  Cuando el recorrido continúa
  Entonces el curso 2 figura como fallido con su motivo
    y el curso 3 se escanea igual

AC-5 — Sesión vencida
  Dado un recorrido donde el curso 2 redirige a /login/
  Cuando se procesa
  Entonces el recorrido se corta con aviso de sesión
    y el curso 2 no figura como fallido ni como vacío

AC-6 — Cerrar el popup
  Dado un recorrido en el curso 2 de 3
  Cuando el dueño cierra y reabre el popup
  Entonces ve "Curso 3 de 3" o el resultado final
    y no se lanzó un escaneo nuevo

AC-7 — Navegar a mitad
  Dado un recorrido con 2 cursos completos y el tercero en curso
  Cuando el dueño navega fuera de la portada
  Entonces el recorrido queda cortado
    y la lista conserva los 2 completos sin el tercero

AC-8 — Mismo PDF en dos cursos
  Dado un PDF con el mismo nombre en dos cursos distintos
  Cuando se escanea todo
  Entonces aparece dos veces, una por curso, con claves distintas

AC-9 — Escaneo de un curso intacto
  Dado el popup abierto en course/view.php?id=1352 sin recorrido en curso
  Cuando se abre
  Entonces escanea ese curso como hoy y reemplaza la lista guardada
    y no ofrece "Escanear todos los cursos"

AC-10 — Páginas que no son curso ni portada
  Dado el popup abierto en catedras.linti.unlp.edu.ar/calendar/view.php
  Cuando se abre
  Entonces no reconoce el portal

AC-11 — Tipos excluidos
  Dado el curso 1331 con 1 videollamada (bigbluebuttonbn), 3 foros y 1 label
  Cuando se escanea todo
  Entonces ninguno aparece en la lista ni genera aviso
```

## Requisitos no funcionales

- **NFR-1** — No altera la baseline de tests; el escaneo de un curso suelto no cambia.
- **NFR-2** — Los fixtures nuevos de `sitio/moodle-linti/__fixtures__/` no contienen datos personales (sin `sesskey`, emails ni nombres).
- **NFR-3** — Concurrencia ≤ 4 dentro de un curso; entre cursos, en serie.

## Supuestos resueltos

Los 16 supuestos se mostraron en lista y el dueño respondió «Ninguno» (2026-10-05). Traza en [`assumptions.md`](./assumptions.md).

## Preguntas abiertas

- Ninguna. La decisión de que el multicurso vale aunque haya pocos cursos ya está resuelta (dueño, 2026-10-05).

## Las decisiones con más filo

- **RN-8** — Sesión vencida: implementado como **corte** (decisión 3 del plan 29) en vez de pausa, porque no hay protocolo de reanudación y un Moodle con sesión vencida exige re-autenticar antes de poder seguir. Conserva los cursos ya terminados.
- **RN-2** — Entran los cursos de años anteriores. Hoy hay 3, todos 2026; con más años, ruido.
- **RN-15** — `esPaginaDelSitio` pasa a reclamar la portada; es lo único que toca el adaptador de un portal ya en producción.

## Mediciones pendientes

| M | Qué medir y cómo | Decide |
|---|---|---|
| M-1 | Con la extensión armada, lanzar el recorrido de los 3 cursos y anotar el tiempo por curso (con la resolución de `url` y `folder`: Programación III tiene 10 `folder` y 3 `url`) | El aviso de RN-8; si el tope de 60 s alcanza |
| M-2 | Con el dueño: comparar los ids de `/my/courses.php` («Todos») con los de `/my/` y con la barra lateral; ver si hay paginación | RN-2: si faltan cursos, hay que leer otra fuente |
| M-3 | Con la portada en segundo plano 60 s, correr el recorrido y mirar si el `fetch` avanza | RN-12: si no, el aviso pide la pestaña al frente, como Classroom |

## Dependencias

- El recorrido Moodle comparte `core/estado/recorridoTodos.ts` y el manejo de `esPortada` con Informática e Ingeniería, que **todavía no tienen código**. El plan debe implementar el recorrido **una sola vez, genérico**, y que los tres portales aporten su `esPortada`.

**Secciones condicionales descartadas:** tabla de decisión (el cruce portada/curso/recorrido es la de Classroom y no suma condiciones); wireframes (reusa el botón y el loader de Classroom); contrato de interfaz (no hay API propia); diagrama de estados (lo cubre `recorridoTodos`); glosario (sin términos nuevos).

---

Firmado: tanda claude sonnet 5.5
