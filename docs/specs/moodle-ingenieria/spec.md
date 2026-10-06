# Moodle de Ingeniería: el sexto portal, por curso y de todos los cursos

**Estado**: `draft` — dependen de **M-1..M-3** (§Mediciones pendientes) RN-14, RN-18 y RN-19.
**Fecha**: 2026-10-05
**Autor**: tanda (Claude Sonnet 5.5)
**Firmado**: tanda claude sonnet 5.5
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Hereda de**: [`../moodle-asignaturas/spec.md`](../moodle-asignaturas/spec.md) (`asig:RN-n`), [`../classroom-escanear-todas/spec.md`](../classroom-escanear-todas/spec.md) (`todas:RN-n`) y [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (`destino:RN-n`).

> ⚠️ **Los 25 supuestos se aprobaron en bloque y sin leerlos** (el dueño, 2026-10-05: *"aprobado sin
> leer"*). Ninguna regla fue discutida. Las tres con más filo están en §Las decisiones con más filo.

---

## Historia

> Como estudiante de Ingeniería, quiero que la extensión escanee el Moodle de mis asignaturas
> (`www.asignaturas.ing.unlp.edu.ar`) un curso por vez o todos mis cursos de una, y que lo que baje caiga
> en mi árbol `~/Boveda/Areas/Facultad/Ingenieria` como ya pasa con Classroom y los otros Moodle, para no
> entrar curso por curso ni mover nada a mano.

## Contexto y problema

La extensión sirve cinco portales; dos son Moodle (`moodle-asignaturas`, de Informática, y `moodle-linti`).
El Moodle de Ingeniería es el mismo software con el tema de UNLP, pero **otro portal**: otro host y otra
instalación (`asig:` Alcance excluye explícitamente otros Moodle).

Lo medido el 2026-10-05 (cuenta del dueño, 9 cursos), que mueve las reglas:
- `mod/resource/view.php` **redirige** (302) a `pluginfile.php/.../archivo.pdf` con `application/pdf`. No incrusta
  el recurso como Informática.
- Sin actividades duplicadas en el DOM: `actividades` = `unicas` en los 9 cursos.
- El HTML de `course/view.php?id=N`, pedido con `fetch`, **trae las actividades** (no hace falta ejecutar JS).
  Tarda entre 180 y 850 ms.
- Tipos: `resource`, `url`, `folder`, `forum`, `quiz` (27 en Física II), `label`, `assign`. Sin video.
- Un `folder` se lee de `mod/folder/view.php?id=<cmid>`: lista los archivos como
  `pluginfile.php/<ctx>/mod_folder/content/0/<nombre>?forcedownload`.

Hoy `/my/` no hace nada. Por curso se escanea con la pestaña dentro del curso; multicurso no existe para Moodle.

## Alcance

**Incluye**
- Portal `moodle-ingenieria`: `resource` y `folder` como adjuntos, `url` como acceso `.md`.
- Escaneo del curso de la pestaña, y **«Escanear todos los cursos»** desde `/my/`.
- Destino por índice desde el primer día (`destino:RN-1..30`).

**No incluye**
- Otros Moodle de la UNLP.
- `forum`, `quiz`, `assign`, `label`, `page`; video (no hay).
- Descargar solo: el recorrido termina en la lista.
- Otro recorrido para `moodle-asignaturas` o `moodle-linti` (cada uno sería su propio corte).
- Detectar que un docente reemplazó un archivo.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir un curso o `/my/`, escanear, asociar el curso a una materia (editor), editar nombres, bajar |
| Extensión | Leer el curso con la sesión del navegador, recorrer los cursos de `/my/`, resolver y bajar |
| Backend | Escribir bajo la raíz, calcular md5, mantener `.course-downloader.json` |

---

## Reglas de negocio

### Identidad y alcance

- **RN-1** — El `id` del portal es `moodle-ingenieria`: carpeta, prefijo de `cursos.<clave>` y de `archivos.<clave>`. Clave de curso: `moodle-ingenieria:<id>`, con `<id>` el `id` de `course/view.php?id=<id>`.
- **RN-2** — Se bajan `resource` y `folder` como adjuntos; `url` como acceso `.md` (RN-9). `forum`, `quiz`, `assign`, `label` y `page` no se listan, no se cuentan y no generan aviso.
- **RN-3** — Por curso: se escanea el curso de la pestaña abierta (`www.asignaturas.ing.unlp.edu.ar/course/view.php?id=N`).
- **RN-4** — El *tema* de un ítem es el nombre de su sección. Una sección con nombre propio, la 0 incluida («Anuncios Parroquiales»), se usa tal cual; sin nombre, `Sin tema` (`destino:RN-8`).

### Qué se lista y cómo se llama

- **RN-5** — Clave de archivo: `resource` = `cmid`; archivo de un `folder` = `<cmid>/<ruta interna>`; `url` = `acceso:<url>:<título>`.
- **RN-6** — El nombre original sale del último segmento **decodificado** de la URL de `pluginfile.php`, **sin la query** (`?forcedownload` no entra al nombre), nunca de `Content-Disposition`.
- **RN-7** — Las subcarpetas de un `folder` se aplanan; el destino lo decide el tema. Las colisiones resuelven con ` - <actividad>` y ` - <subcarpeta>`.
- **RN-8** — Cada ítem lleva `publicacion` = la actividad que lo contiene (`destino:RN-7a`).
- **RN-9** — Un `url` se guarda como `.md` (`tipo: acceso`, `revisado: <hoy>`). El destino sale de la página intermedia (`.urlworkaround a, #region-main a[href^="http"]`); si no se lee, se guarda `mod/url/view.php?id=<cmid>`.

### Bajar y resolver

- **RN-10** — Un `resource` se resuelve pidiendo `mod/resource/view.php?id=<cmid>` con credenciales y siguiendo el 302 a `pluginfile.php`. Si responde HTML, se extrae la URL por regex sobre el cuerpo (`asig:RN-10`).
- **RN-11** — Sesión vencida (la URL final va a `/login/`): la cola se pausa con aviso de sesión.
- **RN-12** — 404 o 410 saltea sólo ese ítem.
- **RN-13** — Dentro de un curso, la concurrencia es ≤ 4 peticiones (resolver `folder` y `url`).

### Escanear todos los cursos

- **RN-14** — En `/my/` el popup ofrece **«Escanear todos los cursos»**; abrir el popup ahí no escanea solo. Antes de arrancar avisa la duración estimada (M-1) sin pedir la pestaña al frente (M-3).
- **RN-15** — Entran los cursos de «Mis cursos»: los ids de `course/view.php?id=` de la página, **desduplicados** y en el orden en que aparecen. Entran los de años anteriores. (M-2 verifica que son todos.)
- **RN-16** — Los cursos se recorren **en serie** desde la pestaña `/my/` con `fetch` same-origin con credenciales. Nunca en paralelo ni en pestañas de fondo.
- **RN-17** — De cada curso se hace **lo mismo que el escaneo de un curso** (RN-3 a RN-13); ese escaneo no cambia. Cada curso conserva su tope de 60 s.
- **RN-18** — Si un curso falla (sesión, tope, HTML sin actividades donde se esperan), se saltea y el recorrido sigue, con el motivo en el resumen (`todas:RN-8`).
- **RN-19** — Si el dueño navega fuera de `/my/`, o cierra la pestaña, el recorrido se corta: se conservan los cursos completos y se descarta el que estaba a medias (`todas:RN-9`).
- **RN-20** — Un curso sin material no aparece en la lista; cuenta como vacío en el resumen (`todas:RN-14`).
- **RN-21** — El progreso y el resultado se guardan a medida que avanza: cerrar el popup no corta el recorrido y al reabrirlo se ve el progreso o el resultado (`todas:RN-15`, `todas:RN-16`).
- **RN-22** — El recorrido termina en la lista: no encola ni descarga nada. La lista agrupa por curso y **reemplaza** a la guardada; abrir el popup dentro de un curso sin recorrido en curso escanea ese curso y la reemplaza (`todas:RN-18`).
- **RN-23** — Al terminar o cortarse hay un resumen: cursos con material, vacíos, fallidos con su motivo (`todas:RN-17`).
- **RN-24** — La clave de cada ítem lleva su curso, así dos cursos nunca comparten clave (ADR-0014): un mismo PDF subido a dos cursos aparece dos veces.

### Lo heredado

- **RN-25** — Valen sin cambio `destino:RN-1` a `destino:RN-30` y la asociación del curso a una materia en el editor.
- **RN-26** — Nombre en el popup «Moodle Ingeniería (UNLP)», con color propio distinto al de los otros portales. Sin faceta: la faceta es inerte.

## Flujos

**Camino feliz — un curso**
1. El dueño abre `course/view.php?id=4091` y el popup.
2. Escanea: ve 8 PDF y 85 accesos agrupados por tema.
3. Lo asocia a una materia en el editor y baja.

**Camino feliz — todos**
1. El dueño abre `/my/` y el popup ofrece «Escanear todos los cursos» con el aviso.
2. Lo aprieta; la tarjeta muestra «Curso 3 de 9: …».
3. Termina: resumen y lista agrupada por curso; baja como hoy.

**Alternativos**

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | Un curso falla o supera 60 s | Se saltea; fallido con su motivo (RN-18) |
| A2 | Un curso sin material | No aparece en la lista; vacío en el resumen (RN-20) |
| A3 | Navega fuera de `/my/` a mitad | Se corta, se conservan los completos (RN-19) |
| A4 | Cierra el popup a mitad | El recorrido sigue (RN-21) |
| A5 | Reabre el popup a mitad en `/my/` | Ve el progreso; no se dispara otro escaneo (RN-21) |
| A6 | Sesión vencida | Pausa con aviso de sesión (RN-11) |
| A7 | Un `folder` no se puede leer | Se saltea ese `folder`; el curso sigue |
| A8 | Todos los cursos fallan o están vacíos | No hay lista; sólo el resumen |
| A9 | Backend caído | El recorrido funciona igual (escanear no lo usa); bajar queda deshabilitado |

## Datos

- **Entidades nuevas:** ninguna. El portal reusa `Clase`/`ColaItem` con `sitioId: "moodle-ingenieria"` y los mismos `cursos.<clave>`, `archivos.<clave>` del índice.
- **Validaciones:** la clave de curso exige `id` numérico; la clave de archivo no admite query.
- **Retención:** la lista guardada y `recorridoTodos` son como las de Classroom (una sola, se reemplaza).

## Criterios de aceptación

```gherkin
AC-1 — Resolución de resource por redirección
  Dado un resource cuyo mod/resource/view.php responde 302 a pluginfile.php/293695/mod_resource/content/1/Repaso%20de%20Mate%20A.pdf
  Cuando se procesa para descarga
  Entonces el archivo se baja desde esa URL final
    y se guarda como "Repaso de Mate A.pdf"

AC-2 — Nombre sin query
  Dado un archivo de folder en pluginfile.php/384155/mod_folder/content/0/Pautas%20para%20elaborar%20el%20informe%20de%20laboratorio.pdf?forcedownload
  Cuando se lista
  Entonces su nombre original es "Pautas para elaborar el informe de laboratorio.pdf"
    y no contiene "forcedownload"

AC-3 — Tipos que no entran
  Dado un curso con 158 actividades, 27 de ellas quiz y 2 forum
  Cuando se escanea
  Entonces la lista tiene sólo los resource, folder y url
    y no hay avisos por los quiz ni los forum

AC-4 — Curso con material
  Dado el curso "Matemática B3 (2023)" con 8 resource y 85 url en 10 secciones
  Cuando se escanea
  Entonces la lista tiene 93 ítems agrupados por el nombre de su sección
    y los 85 url salen como accesos .md

AC-5 — Botón del multicurso
  Dado el popup abierto en www.asignaturas.ing.unlp.edu.ar/my/
  Cuando el popup termina de abrir
  Entonces ofrece "Escanear todos los cursos" con el aviso de duración
    y no escanea ningún curso

AC-6 — Recorrido de los 9 cursos
  Dado /my/ con 9 cursos, 3 de ellos casi vacíos
  Cuando el dueño aprieta "Escanear todos los cursos"
  Entonces el resumen cuenta 9 cursos, 6 con material y 3 vacíos
    y la lista agrupa por curso sin mostrar los vacíos

AC-7 — Un curso falla
  Dado un recorrido donde el curso 5 supera los 60 s
  Cuando el recorrido continúa
  Entonces el curso 5 figura como fallido con su motivo
    y los cursos 6 a 9 se escanean igual

AC-8 — Cerrar el popup
  Dado un recorrido en el curso 4 de 9
  Cuando el dueño cierra y reabre el popup
  Entonces ve "Curso 5 de 9" o el resultado final
    y no se lanzó un escaneo nuevo

AC-9 — Navegar a mitad
  Dado un recorrido con 4 cursos completos y el quinto en curso
  Cuando el dueño navega a otro sitio fuera de /my/
  Entonces el recorrido queda cortado
    y la lista conserva los 4 completos sin el quinto

AC-10 — Mismo PDF en dos cursos
  Dado un PDF con el mismo nombre en dos cursos distintos
  Cuando se escanea todo
  Entonces aparece dos veces, una por curso, con claves distintas

AC-11 — Sesión vencida
  Dado un resource cuya URL final redirige a /login/
  Cuando se procesa
  Entonces la cola se pausa con aviso de sesión
    y no se marca como bajado
```

## Requisitos no funcionales

- **NFR-1** — La incorporación no altera la baseline de tests existentes.
- **NFR-2** — Los fixtures de `sitio/moodle-ingenieria/__fixtures__/` no contienen datos personales (sin `sesskey`, emails ni nombres).
- **NFR-3** — Concurrencia ≤ 4 dentro de un curso; el recorrido entre cursos es en serie.
- **NFR-4** — El recorrido de los 9 cursos no supera el tope que fije M-1 (hoy, 9 × 60 s en el peor caso).

## Las decisiones con más filo

- **RN-15** — Entran los cursos de 2023, incluso los que sólo tienen un foro. Si el dueño no los quiere, la lista se llena de ruido; se resuelve con un filtro, no con una regla.
- **RN-16** — En serie y desde `/my/`, **sin pestañas**. Funciona porque el HTML trae las actividades; si M-1 mostrara que el service worker no recibe lo mismo, esto se rehace.
- **RN-17 + RN-9** — El escaneo de cada curso resuelve los `url` pidiendo una página por enlace: Matemática B3 son 85 y Física II 76. El recorrido de los 9 puede tardar bastante más que los 4 s medidos para el HTML. Es M-1.

## Mediciones pendientes

| M | Qué medir y cómo | Decide |
|---|---|---|
| M-1 | Con la extensión armada, lanzar el recorrido de los 9 cursos y anotar el tiempo total y por curso (con la resolución de `url` y `folder`) | El aviso de RN-14; si NFR-4 se cumple; si el tope de 60 s alcanza para Física II (158 actividades) |
| M-2 | Con el dueño: comparar los ids de `/my/` con los de «Mis cursos → Todos» y con la lista de la barra lateral | RN-15: si faltan cursos (filtro «en progreso», paginación), hay que leer otra fuente |
| M-3 | Con `/my/` en segundo plano 60 s, correr el recorrido y mirar si el `fetch` avanza | RN-14: si no avanza, el aviso tiene que pedir la pestaña al frente, como Classroom |

## Dependencias

- `PuertoSitio.esPortada` y `core/estado/recorridoTodos.ts` ya están en `main`; el recorrido de Classroom es el modelo (`sitio/google-classroom/scraper.js`).
- Un portal nuevo se escribe con `docs/multisitio-diseno.md` §«Cómo escribir un portal nuevo».

**Secciones condicionales descartadas:** tabla de decisión (la del popup al abrirse es la de Classroom, `todas:` §Tabla de decisión, y no se cruza con nada nuevo); wireframes (la UI reusa el botón y el loader de Classroom, sin pantalla nueva); contrato de interfaz (no hay API propia); diagrama de estados (lo cubre `recorridoTodos`); glosario (no hay términos nuevos).

---

Firmado: tanda claude sonnet 5.5
