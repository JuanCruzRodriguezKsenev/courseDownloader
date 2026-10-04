# Moodle del LINTI: el cuarto portal, con destino en el árbol del dueño

**Estado**: `draft` — dependen de **M-1..M-4** (§Mediciones pendientes) las reglas que las nombran; ninguna bloquea el plan 09.
**Fecha**: 2026-10-01
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Medición del portal**: `~/Boveda/Proyectos/courseDownloader/Diseños/Moodle del LINTI - medición del portal.md` (2026-09-30, curso `id=1352`, ISO-CSO)
**Hereda de**: [`../classroom-destino/spec.md`](../classroom-destino/spec.md). Sus reglas se citan como `destino:RN-n`; las de esta spec, como `RN-n`.

---

## Historia

> Como estudiante, quiero que lo que la extensión baja del Moodle de la cátedra (`catedras.linti.unlp.edu.ar`)
> caiga en mi árbol `~/Boveda/Areas/Facultad` con las mismas carpetas, nombres y reconocimiento de lo ya
> descargado que ya tengo con Classroom, para no mover ni renombrar nada a mano.

## Contexto y problema

La extensión sirve tres portales y sólo uno (Classroom) escribe en el árbol del dueño por el índice
`.course-downloader.json`. El Moodle del LINTI es un portal barato (HTML renderizado en el servidor, sin
SPA, sin API de contenido) que se autentica con la cookie del navegador, igual que Ramón Net. No tiene
video: son archivos (`resource`, `folder`) y vínculos (`url`).

Casi todo lo difícil ya está resuelto por el destino de Classroom: elegir carpeta, proponer nombre,
reconocer por md5, accesos `.md`. Esta spec define **sólo lo que es propio de Moodle**: qué actividades
entran, cómo se identifica cada archivo, cómo se lee el curso y cómo se baja.

## Alcance

**Incluye**
- Moodle de `catedras.linti.unlp.edu.ar`, curso por curso (el de la pestaña abierta).
- Actividades `resource`, `folder` y `url`.
- Destino por índice desde el primer día (portal `moodle-linti`).

**No incluye**
- Otros Moodle de la UNLP (serían otro portal, con otro `id`).
- `forum`, `quiz`, `page`, `choice` y cualquier otro tipo de actividad.
- Escanear todos los cursos desde una portada.
- El layout viejo `raíz/<portal>/<curso>/`: este portal no lo tiene.
- Detectar que un docente reemplazó un archivo (RN-14).

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir el curso en Moodle, escanear, asociar el curso a una materia (editor del 2c), editar nombres, bajar |
| Extensión | Leer el curso desde su pestaña, resolver cada archivo con la sesión del navegador, bajarlo y mandarlo al backend |
| Backend | Igual que en `destino:` (escribir bajo la raíz, calcular md5, mantener el índice) |

---

## Reglas de negocio

### Identidad y alcance

- **RN-1** — El `id` del portal es `moodle-linti`: nombre de carpeta, prefijo de `cursos.<clave>` y de `archivos.<clave>` en el índice. La clave de curso es `moodle-linti:<id>`, con `<id>` el parámetro `id` de `course/view.php?id=<id>`.
- **RN-2** — Se bajan los `resource` y los `folder` como adjuntos. Los `url` se guardan como acceso `.md` (RN-9). Cualquier otro tipo de actividad no se lista, no se cuenta y no genera aviso.
- **RN-3** — Se escanea **el curso de la pestaña abierta**. No hay escaneo de todos los cursos.
- **RN-4** — El *tema* de un ítem es el nombre de su sección del curso. La sección sin nombre propio (la primera, «General») usa el tema `Sin tema`, que ya va a la raíz de la materia sin quedar marcado como sin asignar (`destino:RN-8`).

### Qué se lista y cómo se llama

- **RN-5** — La clave de archivo de un `resource` es el `cmid` de la actividad. La de un archivo dentro de un `folder` es `<cmid>/<ruta interna>` (`123/Tema 1/clase1.pdf`). La de un `url` es `acceso:<url>:<título>` (`destino:RN-29`).
- **RN-6** — El nombre original de un archivo sale de la **URL de descarga decodificada**, nunca del `Content-Disposition`, que llega con la codificación rota.
- **RN-7** — Las subcarpetas de un `folder` se aplanan: el destino lo decide el tema. Si dos archivos del mismo tema comparten nombre, **todos los del grupo** suman ` - <actividad>` y, si siguen chocando, ` - <subcarpeta>` al nombre original. Es `destino:RN-16` aplicada en el escaneo, porque la identidad `(portal, módulo, tipo, título)` no admite dos ítems iguales (ADR-0014).
- **RN-8** — Cada ítem lleva `publicacion` = nombre de la actividad que lo contiene. Eso alimenta la sugerencia de carpeta de `destino:RN-7a` (primero el nombre del tema; si no dice nada, la mayoría de las actividades).

### Los `url`

- **RN-9** — Un `url` nace como acceso `.md` con el frontmatter de `destino:RN-17`. El destino se lee de la página intermedia de Moodle. Si Moodle redirige directo a un dominio externo (caso WhatsApp) y el destino no se puede leer, el acceso guarda la URL de Moodle `mod/url/view.php?id=<cmid>`, que redirige con la sesión (**M-4**).

### Bajar

- **RN-10** — Un archivo se baja con la cookie del navegador. Si Moodle redirige a su pantalla de login (la sesión venció), es un fallo **sistémico**: la cola se pausa con aviso, no se saltea ítem por ítem.
- **RN-11** — Un 404 o 410 sobre un archivo lo saltea y la cola sigue (por ítem). Una respuesta que es una página web y no un archivo se trata igual y **no** se escribe (ya lo hace la cola para todo portal).
- **RN-12** — Un archivo que el docente reemplaza conservando la actividad (mismo `cmid`, otro contenido) **no** se vuelve a bajar: el índice lo da por descargado (`destino:RN-18`).

### Lo heredado

- **RN-13** — Valen sin cambio `destino:RN-1` a `RN-9` y `RN-11` a `RN-15` (con la nota de abajo), `destino:RN-16`, `RN-18` a `RN-30` y la tabla de decisión. Un curso sin asociar se lista pero no se baja (`destino:RN-2`).
  - No aplican: `destino:RN-7a` por *publicación de Classroom* (aquí es RN-8), `destino:RN-10` (no hay cronogramas), `destino:RN-16a` (no hay Novedades).
- **RN-14** — El dueño asocia el curso con el editor del plan 2c, el mismo que usa para Classroom. Esta spec no define pantalla nueva.

---

## Flujos

### Camino feliz

1. El dueño abre `course/view.php?id=1352` en Moodle y el popup escanea.
2. La extensión lee las secciones y las actividades del DOM y resuelve cada `folder` y cada `url` con la sesión.
3. El popup lista los archivos y accesos, con ruta destino y nombre propuesto. El curso no está asociado: la lista se ve y no se baja.
4. El dueño asocia el curso a una materia con el editor (🗂️), asigna temas y edita nombres.
5. Reabre el popup; la lista se recalcula y cada ítem pasa por la tabla de decisión de `destino:`.
6. Baja. Cada archivo cae en su carpeta, con su nombre, y el índice lo anota.

### Alternativos

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | La sesión venció (redirige al login) | Pausa la cola con aviso; no saltea (RN-10) |
| A2 | Un archivo da 404 o 410 | Se saltea ese archivo y la cola sigue (RN-11) |
| A3 | Un `url` redirige directo a un dominio que no se puede leer | Acceso con la URL de Moodle (RN-9) |
| A4 | Un `folder` está vacío | No genera ítems y no avisa |
| A5 | El curso no tiene ningún `resource`/`folder`/`url` | Aviso «Este curso no tiene archivos» y la lista anterior no se pisa |
| A6 | Dos archivos del mismo tema se llaman igual | Los dos llevan ` - <actividad>` (RN-7) |
| A7 | Una actividad está oculta o restringida para el usuario | Moodle no la manda en el HTML: no aparece, sin aviso |
| A8 | Se abre una página de Moodle que no es un curso | El popup no reconoce el portal (sólo `course/view.php`) |

---

## Datos

### Lo que emite el escaneo, por ítem

```json
{
  "texto": "Régimen de cursada.pdf",
  "href": "https://catedras.linti.unlp.edu.ar/mod/resource/view.php?id=40881",
  "modulo": "ISO-CSO (2026) › Clases teóricas",
  "tipo": "adjunto",
  "idArchivo": "40881",
  "cursoId": "1352",
  "cursoNombre": "ISO-CSO (2026)",
  "tema": "Clases teóricas",
  "publicacion": "Régimen de cursada"
}
```

| Campo | Regla |
|---|---|
| `idArchivo` | RN-5 |
| `modulo` | `<curso> › <sección>`: es el **origen**, nunca el destino (ADR-0014) |
| `tema` | RN-4 |
| `publicacion` | RN-8 |
| `texto` | RN-6 y RN-7 |

El índice no cambia de formato: sólo suma entradas con prefijo `moodle-linti:`.

---

## Criterios de aceptación

```gherkin
AC-1 — Un resource nuevo va a su carpeta con el nombre propuesto
  Dado el curso "ISO-CSO" asociado a "Ingenieria/Sistemas Operativos"
    y el tema "Clases teóricas" asignado a "Teorias"
  Cuando se baja el resource "Régimen de cursada.pdf"
  Entonces el archivo queda en "Ingenieria/Sistemas Operativos/Teorias/"
    y el índice anota "moodle-linti:40881" con esa ruta y su md5
```

```gherkin
AC-2 — Un folder con subcarpetas se aplana y los choques se desambiguan
  Dado un folder "Material y Transparencias" con "Tema 1/intro.pdf" y "Tema 2/intro.pdf"
    y el tema de ese folder asignado a "Teorias"
  Cuando se escanea y se baja
  Entonces los dos archivos caen en "Teorias/"
    y sus nombres difieren por " - Tema 1" y " - Tema 2"
    y el índice anota "moodle-linti:<cmid>/Tema 1/intro.pdf" y "moodle-linti:<cmid>/Tema 2/intro.pdf"
```

```gherkin
AC-3 — Un url con destino legible se guarda como acceso
  Dado un url a "https://t.me/isocso" con página intermedia legible
  Cuando se baja
  Entonces se crea un .md con frontmatter "tipo: acceso" y "revisado: <fecha>"
    y su cuerpo contiene "https://t.me/isocso"
```

```gherkin
AC-4 — Un url que redirige directo conserva la URL de Moodle
  Dado un url cuyo destino externo no se puede leer
  Cuando se baja
  Entonces el .md contiene "https://catedras.linti.unlp.edu.ar/mod/url/view.php?id=<cmid>"
```

```gherkin
AC-5 — Las actividades fuera de alcance no aparecen
  Dado un curso con 2 foros, 2 cuestionarios, 1 página y 1 encuesta
  Cuando se escanea
  Entonces ninguno aparece en la lista ni en sus conteos
```

```gherkin
AC-6 — La sesión vencida pausa la cola
  Dado una cola de 5 archivos de Moodle y la sesión vencida
  Cuando se intenta bajar el primero y Moodle redirige al login
  Entonces la cola se pausa con aviso de sesión
    y ningún archivo se descarta ni se escribe
```

```gherkin
AC-7 — Un curso sin asociar se lista y no se baja
  Dado un curso de Moodle no asociado en el índice
  Cuando se escanea
  Entonces la lista se muestra con "sin asociar"
    y no se puede seleccionar ningún ítem para bajar
```

```gherkin
AC-8 — La sección sin nombre va a la raíz de la materia
  Dado un resource en la primera sección, sin nombre propio
  Cuando se baja con el curso asociado
  Entonces el archivo queda en la raíz de la materia
    y no aparece marcado como "sin asignar"
```

```gherkin
AC-9 — El nombre sale de la URL
  Dado un resource cuyo Content-Disposition llega como "RÃ©gimen.pdf"
    y cuya URL termina en "R%C3%A9gimen.pdf"
  Cuando se lista
  Entonces el texto del ítem es "Régimen.pdf"
```

```gherkin
AC-10 — Lo que ya está en el árbol no se duplica
  Dado "Teorias/01_intro.pdf" con el mismo contenido que un resource del curso
    y el id del resource no figura en el índice
  Cuando se baja
  Entonces no se escribe ningún archivo nuevo y el índice anota el id contra el archivo que ya estaba
```

```gherkin
AC-11 — Un 404 saltea sólo ese archivo
  Dado una cola de 3 archivos y el segundo da 404
  Cuando se baja la cola
  Entonces el primero y el tercero se escriben y el segundo se reporta como fallo del ítem
```

---

## Requisitos no funcionales

- **NFR-1** — Ramón Net, Anatomy y Classroom no cambian de comportamiento: la compuerta completa sigue en la baseline más los tests nuevos.
- **NFR-2** — Los fixtures del repo no contienen datos personales: ni `sesskey`, ni cookies, ni nombre o correo del usuario, ni tokens en URLs.
- **NFR-3** — El escaneo hace a lo sumo 4 pedidos en paralelo al portal y entra en `topeEscaneoMs` (60 s) para un curso como el medido (22 actividades).
- **NFR-4** — Ningún log, aviso ni mensaje IPC incluye cookies ni `sesskey`. El texto del portal se escapa antes de llegar a `innerHTML` (`docs/security.md`).

## Supuestos resueltos

Ver [`assumptions.md`](./assumptions.md). El único que cambió al escribir la spec es el 14 (la sugerencia de carpeta usa también las actividades: RN-8), porque el código de `destino:RN-7a` ya lo hace y desactivarlo sería código nuevo.

## Preguntas abiertas

- **PA-1** — `urlSondeoInternet` del descriptor: una URL de `catedras.linti.unlp.edu.ar` que no responda con CORP al `fetch` de la extensión. Candidata: `/favicon.ico`. La decide **M-3**.

## Glosario

| Término | Qué es |
|---|---|
| `cmid` | Id de una actividad (`module-<id>` en el DOM, `?id=` en `mod/<tipo>/view.php`) |
| Sección | Bloque de actividades del curso (formato `topics`): `data-for="section"` |
| `resource` | Actividad de un solo archivo. `mod/resource/view.php?id=<cmid>` redirige al archivo |
| `folder` | Actividad con varios archivos y subcarpetas, listados en `mod/folder/view.php?id=<cmid>` |
| `url` | Vínculo externo con página intermedia |
| `pluginfile` | Ruta del servidor que entrega el archivo: `pluginfile.php/<ctx>/mod_<tipo>/content/<n>/<ruta>` |

## Dependencias

- Corte 2b (destino por índice en la cola, estado pedido al backend) y 2c (editor sobre el índice real, 🗂️ desde el popup) **mergeados**: sin ellos el portal no tiene raíz propia ni cómo asociarse.
- Plan 09: lo genérico del destino que hoy dice «Classroom».

## Mediciones pendientes

| # | Qué medir | Cómo | Qué decide |
|---|---|---|---|
| **M-1** | ¿Otro curso del mismo Moodle tiene el mismo marcado (`li[data-for="cmitem"]`, `modtype_*`, `data-activityname`, sección con nombre)? | Capturar HTML de un segundo curso | Si difiere, los selectores del plan 10 H-2 cambian (RN-2, RN-4) |
| **M-2** | ¿Hay `folder` con subcarpetas a más de un nivel? | Abrir las carpetas de los cursos del dueño | Si hay, RN-7 sumaría la ruta completa y no sólo la subcarpeta |
| **M-3** | ¿El `fetch` de la extensión (service worker) con cookies llega al archivo y sigue el redirect? ¿Qué `Content-Type` y qué `response.url` devuelve? ¿La URL de sondeo responde sin CORP? | Botón de prueba en la consola del service worker, no desde la pestaña | RN-10, RN-11, PA-1; si falla por `SameSite`, el resolver debe correr desde la pestaña |
| **M-4** | ¿Cómo se lee el destino de un `url` en la página intermedia? ¿Y cuándo no hay página? | Capturar la intermedia de los 5 `url` del curso | RN-9 (selector del destino y la regla del caso sin página) |
