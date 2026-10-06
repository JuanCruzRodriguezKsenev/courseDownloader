# Moodle de Asignaturas: el quinto portal, con destino en el árbol del dueño

**Estado**: `draft`
**Fecha**: 2026-10-01
**Autor**: tanda (Antigravity, Gemini 3.8 Flash High)
**Firmado**: tanda agy 3.8 flash high
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Medición del portal**: `~/Boveda/Proyectos/courseDownloader/Diseños/Moodle de Asignaturas - medición del portal.md` (2026-10-01, curso `id=82`, Programación 2)
**Hereda de**: [`../moodle-linti/spec.md`](../moodle-linti/spec.md) y [`../classroom-destino/spec.md`](../classroom-destino/spec.md). Sus reglas se citan como `destino:RN-n` y `linti:RN-n`; las de esta spec, como `RN-n`.

---

## Historia

> Como estudiante de Informática, quiero que lo que la extensión baje del Moodle de Asignaturas (`asignaturas.info.unlp.edu.ar`)
> caiga en mi árbol `~/Boveda/Areas/Facultad/Informatica` con las mismas carpetas, nombres y reconocimiento de lo ya
> descargado que ya tengo con Classroom y Moodle LINTI, para no mover ni renombrar nada a mano.

## Contexto y problema

La extensión sirve portales universitarios que escriben en el árbol del dueño mediante el índice `.course-downloader.json`. `asignaturas.info.unlp.edu.ar` es la plataforma Moodle principal de la Facultad de Informática UNLP.

Comparte la base tecnológica de Moodle 4 con LINTI, pero presenta dos particularidades críticas detectadas en la medición en vivo:
1. **Recursos incrustados en HTML**: `mod/resource/view.php` devuelve una página HTML con el recurso incrustado en lugar de una redirección 302 directa a `pluginfile.php`.
2. **Duplicación de secciones en el DOM**: Moodle 4 con editor reactivo renderiza vistas espejadas/anidadas de las secciones (ej. Sec 4 y 5 duplican 45 ítems cada una).
3. **Videos en etiquetas**: las clases grabadas están incrustadas como reproductores Kaltura en actividades `label`.

Esta spec define las reglas específicas para este portal.

## Alcance

**Incluye**
- Moodle de `asignaturas.info.unlp.edu.ar`, curso por curso (el de la pestaña abierta).
- Actividades `resource` y `folder` como adjuntos binarios.
- Actividades `url` como accesos directos `.md`.
- Desduplicación estricta por `module-<cmid>` durante el escaneo.
- Destino por índice versionado (`moodle-asignaturas`).

**No incluye**
- Otros Moodle de la UNLP (cada uno es un portal independiente).
- `forum`, `quiz`, `assign`, `choicegroup` ni contenido binario de `label`. (Un `label` con un video Kaltura incrustado **sí** genera un acceso `.md`, RN-15.)
- Descarga de video binario de Kaltura (política transversal: sólo accesos `.md`; el acceso sí entra, ver RN-15 a RN-18).
- Escaneo de todos los cursos desde la portada (lo cubre [`../moodle-asignaturas-multicurso/spec.md`](../moodle-asignaturas-multicurso/spec.md), `draft`).

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir el curso en `asignaturas.info.unlp.edu.ar`, escanear, asociar el curso a una materia, editar nombres, bajar |
| Extensión | Leer el curso de la pestaña, desduplicar secciones, resolver enlaces a `pluginfile.php` desde el HTML, bajar y enviar al backend |
| Backend | Escribir bajo la raíz `~/Boveda/Areas/Facultad`, calcular md5, mantener el índice `.course-downloader.json` |

---

## Reglas de negocio

### Identidad y alcance

- **RN-1** — El `id` del portal es `moodle-asignaturas`: nombre de carpeta, prefijo de `cursos.<clave>` y de `archivos.<clave>` en el índice. La clave de curso es `moodle-asignaturas:<id>`, con `<id>` el parámetro de `course/view.php?id=<id>`.
- **RN-2** — Se bajan los `resource` y los `folder` como adjuntos binarios. Los `url` se guardan como accesos directos `.md`. Actividades `forum`, `quiz`, `assign`, `choicegroup` y `label` no se bajan en binario.
- **RN-3** — Se escanea el curso de la pestaña abierta (`asignaturas.info.unlp.edu.ar/course/view.php?id=...`).
- **RN-4** — El *tema* de un ítem es el nombre de su sección del curso. La sección sin nombre propio («General») usa el tema `Sin tema` (`destino:RN-8`).
- **RN-4a** — **Desduplicación por `cmid` en escaneo**: el scraper mantiene un registro de los `cmid` procesados; si una sección posterior o anidada vuelve a listar un `module-<cmid>`, se ignora.

### Qué se lista y cómo se llama

- **RN-5** — La clave de archivo de un `resource` es el `cmid` de la actividad (`moodle-asignaturas:<cmid>`). La de un archivo dentro de un `folder` es `<cmid>/<ruta interna>`. La de un `url` es `acceso:<url>:<título>`.
- **RN-6** — El nombre original de un archivo sale de la **URL de `pluginfile.php` decodificada** en su último segmento, nunca del header `Content-Disposition`.
- **RN-7** — Las subcarpetas de un `folder` se aplanan: el destino lo decide el tema. Colisiones resuelven con ` - <actividad>` y ` - <subcarpeta>`.
- **RN-8** — Cada ítem lleva `publicacion` = nombre de la actividad que lo contiene para alimentar la sugerencia de carpeta de `destino:RN-7a`.

### Los `url`

- **RN-9** — Un `url` se guarda como archivo `.md` con frontmatter (`tipo: acceso`, `revisado: <hoy>`). El destino se extrae de la página intermedia con `.urlworkaround a, #region-main a[href^="http"]`. Si no hay intermedia legible, se guarda la URL de Moodle `mod/url/view.php?id=<cmid>`.

### Los videos Kaltura (en `label`)

*Decidido por el dueño el 2026-10-06: el video entra como enlace `.md`.* Medido en el curso 82 (`module-5411`, «Cierre de cursada»): el HTML crudo del `label` trae `<script src="https://videos.unlp.edu.ar/p/117/sp/11700/embedIframeJs/uiconf_id/23448245/partner_id/117">` y un `<script>` inline `kWidget.embed({ "targetId": "kaltura_player_…", "wid": "_117", "uiconf_id": 23448245, "entry_id": "0_p4y3czcv", … })`. El `<iframe>` **no existe** en el HTML inicial: lo crea el script. Los otros 37 `label` del curso son sólo texto.

- **RN-15** — Un `label` cuyo HTML contiene un `kWidget.embed({ … "entry_id": "<id>" … })` genera **un** ítem acceso `.md` (como un `url`, RN-9). El `entry_id` se lee del **texto del `<script>` inline** con una expresión regular; no se espera a que el script cree el `<iframe>` ni se lo ejecuta.
- **RN-16** — La URL del acceso se arma con el host y los ids del `<script src>` `…/p/<pid>/sp/<pid>00/embedIframeJs/uiconf_id/<uiconf>/partner_id/<pid>` del **mismo** `label`: `https://<host>/p/<pid>/sp/<pid>00/embedIframeJs/uiconf_id/<uiconf>/partner_id/<pid>?iframeembed=true&entry_id=<entry_id>`. Si ese `<script src>` falta, el `label` **no** genera ítem (no se inventa el host).
- **RN-17** — El título es el nombre de la actividad (`data-activityname` del `label`); si falta, `Video <entry_id>`. La clave es `acceso:<url>:<título>` (RN-5) y se desduplica por `entry_id` dentro del curso. El tema y la `publicacion` son los de cualquier ítem (RN-4, RN-8).
- **RN-18** — No se baja video ni se valida que se reproduzca. Medido: ese enlace abre la página del reproductor con el título del video («Cierre de Programación II-20241204 1224-1»), pero el reproductor dice «No source video was found»: el enlace sirve como registro, no como reproducción garantizada.

### Bajar y resolver

- **RN-10** — Resolución de `resource`: el service worker realiza petición con credenciales a `mod/resource/view.php?id=<cmid>`. Si no hay 302 a `pluginfile.php` y responde HTML, extrae la URL final mediante regex sobre el cuerpo buscando `pluginfile.php/...mod_resource/content/`.
- **RN-11** — Sesión vencida: si la URL final redirige a `/login/`, la cola se pausa con aviso sistémico (`tipoConexion: "sesion"`).
- **RN-12** — 404 o 410 saltea sólo ese ítem.

### Lo heredado

- **RN-13** — Valen sin cambio las reglas de destino por índice (`destino:RN-1` a `destino:RN-30`).
- **RN-14** — Asociación mediante el editor web del 2c.

---

## Criterios de aceptación

```gherkin
AC-1 — Escaneo desduplica secciones DOM
  Dado un curso de Moodle 4 con secciones anidadas que contienen los mismos module-<cmid>
  Cuando la extensión escanea el listado
  Entonces cada actividad se lista exactamente una vez
    y el conteo total no contiene duplicados

AC-2 — Resolución de recurso incrustado en HTML
  Dado un resource cuyo mod/resource/view.php devuelve HTML con enlace a pluginfile.php
  Cuando se procesa para descarga
  Entonces el resolver extrae la URL directa del pluginfile
    y el archivo se descarga correctamente

AC-3 — Nombre de archivo desde URL codificada
  Dado un pluginfile con nombre codificado en la URL (ej. "Presentacion%20Programacion2.pdf")
  Cuando se descarga
  Entonces el archivo se guarda en disco con el nombre decodificado ("Presentacion Programacion2.pdf")

AC-4 — Carpeta con subcarpetas
  Dado un folder con estructura interna "1. imperativo/practica1.pdf"
  Cuando se descarga en modo destino
  Entonces el archivo se guarda con su idArchivo compuesto "<cmid>/1. imperativo/practica1.pdf"

AC-5 — Video Kaltura en un label
  Dado el label «Cierre de cursada» con kWidget.embed y entry_id "0_p4y3czcv" y su script embedIframeJs de partner 117
  Cuando se escanea el curso
  Entonces la lista tiene un ítem "Cierre de cursada.md" de tipo acceso
    y su url es https://videos.unlp.edu.ar/p/117/sp/11700/embedIframeJs/uiconf_id/23448245/partner_id/117?iframeembed=true&entry_id=0_p4y3czcv

AC-6 — Un label sin video no genera ítem
  Dado los otros 37 label del curso, que sólo tienen texto
  Cuando se escanea el curso
  Entonces ninguno aparece en la lista

AC-7 — Label con kWidget pero sin script embedIframeJs
  Dado un label con kWidget.embed y entry_id pero sin el script embedIframeJs
  Cuando se escanea el curso
  Entonces no genera ítem
```

---

## Requisitos no funcionales

- **NFR-1** — La incorporación del adaptador no altera la baseline de tests existentes.
- **NFR-2** — Los fixtures en `sitio/moodle-asignaturas/__fixtures__/` no contienen datos personales (sin sesskey real, sin emails ni nombres personales).
- **NFR-3** — Concurrencia de escaneo ≤ 4 peticiones en paralelo.

---

Firmado: tanda agy 3.8 flash high
