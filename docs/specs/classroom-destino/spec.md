# Destino de Google Classroom en el árbol del dueño

**Estado**: `draft` — depende de **M-2** (§Mediciones pendientes), que no bloquea ninguna descarga.
**Cortes**: se construye en tres (§Cortes de construcción, decididos por el dueño el 2026-09-27).
**Fecha**: 2026-09-16
**Raíz**: desde el 2026-09-28 es `~/Boveda/Areas/Facultad` (ADR-0018). `~/U.N.L.P` quedó retirado el 2026-09-26 y se conserva como respaldo. Las menciones a `~/U.N.L.P` en §Medición de respaldo y en las preguntas son históricas.
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Diseño del portal**: [`../../portal-google-classroom-diseno.md`](../../portal-google-classroom-diseno.md) (D1–D13)

---

## Historia

> Como estudiante, quiero que lo que la extensión baja de Google Classroom caiga en mi árbol
> `~/U.N.L.P` con el formato de carpetas y de nombres de archivo que yo uso, para no reordenar
> ni renombrar nada a mano.

## Contexto y problema

El corte 1 baja los adjuntos de Classroom a `raíz/google-classroom/<curso>/`, plano y con el nombre
crudo que da Classroom. El árbol del dueño está organizado por materia y tipo de material
(`Ingenieria/Fisica 2/Teorias/Palacio/05_capacitores.pdf`), y ese formato ya se aplicó a las cuatro
materias de Ingeniería el 2026-09-13.

Hoy, entonces, cada descarga deja al dueño con trabajo manual: mover y renombrar. Esta spec define
cómo la extensión pone cada archivo en su lugar con el nombre correcto, y cómo sabe qué ya tiene.

Lo que **no** se puede resolver solo, y esta spec asume: el nombre final requiere criterio humano.
Medido sobre 26 nombres elegidos por el dueño, la regla mecánica reproduce **15**, y encuentra un
número de orden en **37 de 291** archivos. El dueño acorta los temas
(`P10.- Circuitos de CC en estado transitorio` → `10_circuitos_transitorios`), y eso no es una
transformación de texto.

## Alcance

**Incluye**
- Google Classroom, los 8 cursos del dueño, todos de Ingeniería.
- Elegir carpeta destino por curso y por tema.
- Proponer el nombre final, dejarlo editar y recordarlo.
- Saber si un archivo ya está, aunque tenga otro nombre o esté en otra carpeta.
- El índice `~/Boveda/Areas/Facultad/.course-downloader.json` y su ciclo de vida.

**No incluye**
- Anatomy y RamonNet: su layout no cambia.
- Reordenar o renombrar lo que ya está en la raíz (salvo la corrección de ruta de RN-19,
  que sólo escribe en el índice, nunca en el disco).
- Las notas de la bóveda (las conversiones `.md`, `Wiki/`, `Mis notas/`, `Clases/`): la extensión no las toca.
- El escaneo: es del corte 1. Ver §Dependencias.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Asociar un curso a una materia, fijar el docente, asignar temas a carpetas, editar nombres, bajar |
| Extensión | Proponer carpeta y nombre, consultar el índice, decidir si ya está, pedir la descarga |
| Backend | Escribir archivos y el índice dentro de la raíz, calcular md5 |

---

## Reglas de negocio

### Asociación de un curso

- **RN-1** — La raíz es `~/Boveda/Areas/Facultad`. Cada curso se asocia una vez a una carpeta de materia que **ya
  existe**, elegida con 📂.
- **RN-2** — Un curso sin asociar se escanea y se lista, pero no se descarga.
- **RN-3** — Los destinos posibles de una materia son `raíz`, `Teorias/`, `Practicas/`,
  `Laboratorios/`, `Parciales/`, `Finales/`, `Bibliografia/` y `Notas/`, con esa capitalización. Si falta
  alguno, se crea al usarlo.
- **RN-3a** — Las planillas de notas van a `Notas/`, en la materia y **fuera de `Parciales/`**,
  porque la skill `apuntes` saca de `Parciales/` las preguntas para repasar. El tema que empieza
  con "Notas" o "Resultados" sugiere `Notas/`. Una planilla que llega por Novedades cae en la
  raíz (RN-8) y la mueve el dueño. *(Dueño, 2026-09-28)*.
- **RN-4** — Al asociar, el dueño puede escribir un apellido de docente. Si lo escribe, las teorías
  de ese curso van a `Teorias/<Apellido>/`; si lo deja vacío, van a `Teorias/` plana.
- **RN-5** — Si `Teorias/` ya tiene archivos sueltos y se asocia un curso con docente, **lo que ya
  estaba no se mueve**: sólo el material nuevo va a `Teorias/<Apellido>/`.
- **RN-6** — El destino se decide **por tema**: todos los adjuntos de un tema van a la misma carpeta.
- **RN-7** — Al asociar, la extensión precarga una sugerencia de carpeta para cada tema y el dueño la
  confirma o corrige, una vez por curso.
  - **RN-7a** (dueño, 2026-09-27) — La sugerencia sale primero del **nombre del tema**. Si el nombre no
    dice nada, sale de los **títulos de las publicaciones** del tema: gana el destino que suman más de
    la mitad de sus adjuntos. Caso que lo motivó: en MC2 los temas se llaman "Complejos" o "Sistemas
    lineales", pero sus 14 publicaciones dicen "Ejercicios para practicar: …" o "Ejercicios resueltos".
  - **RN-7b** (dueño, 2026-09-27) — Un tema que se llama "Links" es de videos y simulaciones, y va a
    `Teorias/`, igual que "Videos de experiencias y simulaciones". Caso: Física I, "Links-Módulo I/II".
- **RN-8** — Los adjuntos de Novedades y los de "Sin tema" van a la raíz de la materia.
- **RN-9** — Un tema que aparece después de asociar el curso va a la raíz de la materia y queda
  marcado como sin asignar hasta que el dueño le fije carpeta.
- **RN-10** — Del tema de cronogramas se baja sólo el del cuatrimestre en curso, a la raíz de la
  materia, como `cronograma_AAAA_Nc.<ext>`. Los semanales no se bajan. *(2b implementa sólo lo ya decidido: ver RN-31 y PA-5)*.

### Nombres

- **RN-11** — El nombre propuesto sigue el formato del árbol: minúsculas, sin tildes, `_` como
  separador, `NN_` si hay número de orden, `modN_` si hay módulo, extensión en minúscula.
- **RN-12** — `modN_` sale del **nombre del tema** (`Clases teóricas - Módulo I` → `mod1_`), nunca
  del nombre del archivo.
- **RN-13** — El dueño puede editar el nombre propuesto en la lista, antes de bajar.
- **RN-14** — El nombre editado se guarda en el índice **por id de Drive** y se reusa en todos los
  escaneos siguientes. Un archivo se nombra una sola vez.
- **RN-15** — En Parciales la extensión no infiere la fecha: propone `modN_<nombre>` y el dueño la
  escribe.
- **RN-16** — Si dos archivos distintos quedan con el mismo nombre en la misma carpeta, **todos los
  del grupo** llevan `_<título del material>` antes de la extensión (D12), y se aplica después de
  simplificar el nombre.
- **RN-16a** — En Novedades el encabezado del post es "Publicación de <autor>", así que el título del
  material es la **primera frase del anuncio** (sin saludo, muletilla ni artículo, hasta 8 palabras).
  En la adopción, un archivo de Novedades que choca **se nombra** con esa frase en vez de agregarla
  (excepción a RN-16, que agrega `_<título del material>`). Si dos del mismo anuncio siguen chocando, el
  que tiene "(N)" lleva `_N`. Lo que choque después queda para el dueño. *(Dueño, 2026-09-27)*.
- **RN-17** — Los videos, los de YouTube y los vínculos se guardan como acceso `.md` (D10) con el
  nombre sencillo del recurso. El `.md` nace con el frontmatter de la bóveda: `tipo: acceso` y `revisado: <fecha de descarga>`. *(Dueño, 2026-09-28)*.

### Qué ya está descargado

- **RN-18** — Antes de bajar, la extensión consulta el índice por **id de archivo** (id de Drive
  para los adjuntos, `acceso:<url>:<título>` para los accesos — RN-29). Si el id figura y
  el archivo está en la ruta anotada, está descargado y no se baja.
- **RN-19** — Si el id figura pero el archivo no está en la ruta anotada, y **su md5 aparece en otro
  lugar de la raíz** (la raíz entera, salvo las carpetas `Wiki/`, `Mis notas/` y `Clases/` en cualquier nivel), la
  ruta del índice se corrige sola y no se baja. Mover o renombrar un archivo a mano, **también a otra
  materia**, es una orden, no un error. *(Dueño, 2026-09-27: antes decía "de la misma materia", y un
  archivo movido a otra materia se volvía a bajar duplicado. Las carpetas excluidas son de notas, no guardan adjuntos (D-6 de `docs/plan-classroom-destino-2a-boveda.md`).)*
- **RN-20** — Si el id no figura en el índice, se baja, se calcula su md5 y **si ya existe un archivo
  de contenido idéntico en la carpeta destino, se descarta sin escribir** y se anota en el índice
  como descargado. Esto es lo que reconoce lo que el dueño puso a mano.
- **RN-21** — Nunca se compara por nombre. El saneo del backend (`#`→`_`, `º`→`_`) y los renombres
  del dueño hacen que el nombre no sea identidad.
- **RN-22** — Si el id figura y su md5 no está en ningún lado de la raíz (con las exclusiones de
  RN-19), se vuelve a bajar con el nombre que dice el índice.

### El índice

- **RN-23** — El índice es un único archivo, `~/Boveda/Areas/Facultad/.course-downloader.json`, y es la **fuente de
  verdad** de los nombres y las asociaciones. El storage de la extensión no guarda nada de esto.
- **RN-24** — El índice **se versiona** con la bóveda, que es un repo privado. Ningún código lo agrega a `.gitignore`. *(Dueño, 2026-09-28; ADR-0018 supera el punto 2 de ADR-0017.)*
- **RN-25** — Si el índice no parsea, la extensión **avisa y no baja nada**. No lo pisa ni lo
  regenera.
- **RN-26** — Si el dueño edita el índice a mano, gana lo que dice el índice.
- **RN-27** — Si un curso asociado deja de aparecer en Classroom, su entrada y sus archivos se
  conservan intactos, y nada se marca como huérfano ni se ofrece borrar.
- **RN-28** — La extensión no escribe metadata de ningún tipo dentro de los archivos ni en sus
  atributos extendidos.

### Los accesos `.md`

- **RN-29** — Los accesos de RN-17 entran al índice como cualquier otro archivo, con la clave
  `acceso:<url>:<título>` que ya arma el escaneo (`sitio/google-classroom/scraper.js:506`). El
  título forma parte de la clave a propósito: el mismo recurso publicado dos veces con títulos
  distintos son **dos** accesos, y el título es la única información que los distingue. Si el
  docente edita el título en Classroom, aparece un acceso nuevo y el viejo se conserva (RN-27).
- **RN-30** — Un archivo `.md` que ya existe en la ruta destino **no se sobrescribe nunca**. Si
  existe y no está en el índice, se anota y no se escribe, cualquiera sea su md5. Es el único tipo
  que el dueño puede editar sin renombrar, y el árbol tiene un vault de Obsidian: comparar por
  contenido (RN-20) no alcanza, porque una nota agregada a mano cambia el md5.
- **RN-29a** — Un acceso cuyo id ya figura en el índice está descargado **siempre**: no se
  vuelve a crear aunque no esté en la ruta anotada ni su md5 aparezca en la raíz. Editarlo,
  moverlo o borrarlo es decisión del dueño. Para que vuelva a crearse, se borra su entrada del
  índice. *(Dueño, 2026-09-28; cierra PA-4.)*

### Omisiones

- **RN-31** — Lo que el dueño marcó para no bajar (un tema con `-` o un archivo en `omitidos`) no se ofrece; la extensión lo lista marcado como omitido. *(Dueño, A-2, 2026-09-28; guardado en el índice por el corte 2b.)*

### Enlaces de videollamada

- **RN-32** — **Enlaces de videollamada**: los enlaces a salas sincrónicas (`meet.google.com`, `zoom.us` y subdominios, `teams.microsoft.com` y `teams.live.com`, `webex.com` y subdominios, `meet.jit.si` y `*.jitsi.net`) no se descartan en el escaneo; se clasifican como accesos directos (`tipo: "acceso"` con `esVideollamada: true`).
  - **Ubicación**: en el listado del popup, dentro de cada curso, las videollamadas se listan fijadas arriba de todo (primeras filas del curso).
  - **Indicador visual**: se renderizan con un chip distintivo "Videollamada" (o icono 📹) que advierte su naturaleza sincrónica/potencialmente inactiva.
  - **Selección**: vienen marcadas por defecto para descarga (igual que el resto de los elementos).
  - **Gestor de adopción**: en el editor web de adopción (`backend/adopcion/editor.html`), se listan entre los archivos del curso y pueden marcarse con acción `omitir` para no descargarlas, guardándose en `cursos.<clave>.omitidos` (RN-31).
  *(Dueño, 2026-10-01; firmado: tanda agy 3.8 flash high).*

---

## Tabla de decisión — ¿hay que bajar este adjunto?

Se evalúa en este orden; la primera fila que coincide, decide.

| # | ¿id en el índice? | ¿está en la ruta anotada? | ¿md5 en la raíz? (filas 2–3, RN-19) / ¿en la carpeta destino? (fila 5) | Acción |
|---|---|---|---|---|
| 0 | — | sí, y el destino es un `.md` | — | **No escribir.** Anotar en el índice si falta (RN-30). |
| 0b | sí, y es un acceso (`acceso:…`) | — | — | **No escribir** (RN-29a). |
| 1 | sí | sí | — | No bajar. Marcar descargado. |
| 2 | sí | no | sí | No bajar. **Corregir la ruta en el índice.** |
| 3 | sí | no | no | Bajar con el nombre del índice. |
| 4 | no | — | — | Bajar, calcular md5 → fila 5 o 6. |
| 5 | no | — | sí, en la carpeta destino | **Descartar sin escribir.** Anotar en el índice. |
| 6 | no | — | no | Escribir con el nombre propuesto. Anotar en el índice. |

La fila 5 es la que reconoce los 4 archivos de `Fisica 2/Laboratorios/` que el dueño puso a mano
(md5 idéntico, nombre con `#` en vez de `_`) y las 9 teorías de Física 1 que el dueño renombró.

La fila 0 va **antes** que todas porque un `.md` editado a mano tiene md5 propio: sin ella caería
en la fila 6 y se pisaría (RN-30).

La fila 0b va antes que la 2 y la 3 porque un acceso editado tiene otro md5: sin ella, un acceso movido caería en la 3 y se crearía de nuevo.

---

## Flujos

### Camino feliz — asociar un curso y bajar

1. El dueño abre el popup en un curso de Classroom. La extensión escanea y lista.
2. El curso no está asociado: la lista se muestra pero el botón de bajar está deshabilitado (RN-2).
3. El dueño abre la pantalla de asociación, elige la materia con 📂, escribe el apellido del docente
   si corresponde, y revisa la tabla de tema → carpeta precargada (RN-7).
4. Confirma. La extensión escribe la asociación en el índice.
5. La lista vuelve a mostrarse, ahora con la ruta destino y el nombre propuesto de cada ítem.
6. El dueño corrige los nombres que no le gustan (RN-13).
7. Baja. Cada ítem pasa por la tabla de decisión.
8. Al terminar, el índice tiene el nombre, la ruta y el md5 de cada archivo.

### Alternativos

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | El índice no parsea | Se avisa y no se baja nada de ninguna materia (RN-25) |
| A2 | Aparece un tema nuevo después de asociar | Sus adjuntos van a la raíz de la materia, marcados como sin asignar (RN-9) |
| A3 | El archivo ya está en disco con otro nombre | Se descarta sin escribir y se anota como descargado (RN-20) |
| A4 | El dueño movió o renombró un archivo a mano, aun a otra materia | La ruta del índice se corrige sola (RN-19) |
| A5 | El dueño borró un archivo | Se vuelve a bajar con el nombre del índice (RN-22) |
| A6 | Dos archivos distintos chocan de nombre | Todos los del grupo llevan `_<material>` (RN-16; en Novedades, RN-16a) |
| A7 | Dos adjuntos del mismo curso son el mismo archivo | El segundo se descarta por md5 (RN-20). Ver **PA-2** |
| A8 | El curso desapareció de Classroom | Lo bajado se conserva, nada se marca huérfano (RN-27) |
| A9 | La materia no tiene la carpeta destino | Se crea al usarla (RN-3) |

---

## Datos

### `~/Boveda/Areas/Facultad/.course-downloader.json`

```json
{
  "version": 1,
  "cursos": {
    "google-classroom:ODc0ODk1NDcwNTMw": {
      "nombre": "Física II G22 2026 2do cuatrimestre",
      "materia": "Ingenieria/Fisica 2",
      "docente": "Palacio",
      "temas": {
        "Clases Teóricas Módulo I": "Teorias/Palacio",
        "Guía de TP Nº 3": "Practicas",
        "Laboratorios": "Laboratorios",
        "Bibliografía": "Bibliografia",
        "Cronogramas": ".",
        "Cuestiones administrativas": "-"
      },
      "omitidos": [
        "google-classroom:1WxLl0KPy7o4OxC_yV9nV6-GF0MUazG5c"
      ]
    }
  },
  "archivos": {
    "google-classroom:1a2b3c4d5e6f": {
      "curso": "google-classroom:ODc0ODk1NDcwNTMw",
      "nombre": "05_capacitores.pdf",
      "ruta": "Ingenieria/Fisica 2/Teorias/Palacio",
      "md5": "3f2a9c1b8e4d7a6f3f2a9c1b8e4d7a6f",
      "original": "Palacio - Clase 5 - Capacitores.pdf"
    },
    "google-classroom:acceso:https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DAbC:Campo%20el%C3%A9ctrico": {
      "curso": "google-classroom:ODc0ODk1NDcwNTMw",
      "nombre": "campo_electrico.md",
      "ruta": "Ingenieria/Fisica 2/Teorias/Palacio",
      "md5": "9b1c3d5e7f0a2b4c9b1c3d5e7f0a2b4c",
      "original": "Campo eléctrico"
    }
  }
}
```

| Campo | Regla |
|---|---|
| `version` | Entero. Permite migrar el formato sin adivinar. |
| `cursos.<portal>:<id>` | El id del portal (`google-classroom`) y el id de curso de su URL. El prefijo existe porque la raíz es de la UNLP, no de Classroom: los Moodle de la UNLP van a escribir en el mismo índice (dueño, 2026-09-27). |
| `cursos.<clave>.materia` | Ruta relativa a la raíz. Tiene que existir (RN-1). |
| `cursos.<clave>.temas.<tema>` | Ruta relativa a la materia. `"."` es la raíz de la materia. `"-"` indica tema omitido que no se ofrece para descargar (RN-31). |
| `cursos.<clave>.omitidos` | Array de claves de archivo (`<portal>:<id>`). Archivos que el dueño omitió; la extensión los lista marcados como omitidos y deshabilitados (RN-31). |
| `archivos.<portal>:<id>` | El portal, `:`, y el id de archivo: id de Drive para los adjuntos, `acceso:<url>:<título>` para los accesos (RN-29). Es la identidad estable, y la misma que viaja por el pipeline — no se inventa un eje nuevo (ADR-0014). |
| `archivos.<clave>.nombre` | El nombre final, editado o propuesto. |
| `archivos.<clave>.ruta` | Ruta relativa a la raíz. La corrige RN-19. |
| `archivos.<clave>.md5` | Se calcula una vez al bajar y no se recalcula (32 caracteres hexadecimales). En un `.md` es informativo: no decide nada, porque manda RN-30. |
| `archivos.<clave>.original` | El nombre de Classroom. Sólo para que el dueño se ubique. |

**Retención**: nada se borra automáticamente. Un curso que desaparece de Classroom conserva su
entrada (RN-27).

**Escritura**: la hace el backend, dentro de la raíz, validando con `esRutaSegura`
(`backend/utils.js:21`), que hoy comprueba que la ruta resuelta caiga bajo la raíz configurada.

---

## Wireframes

### Pantalla de asociación — estado base

```
┌────────────────────────────────────────────────────────┐
│  Asociar curso                                    ✕    │
├────────────────────────────────────────────────────────┤
│  Física II G22 2026 2do cuatrimestre                   │
│                                                        │
│  Materia    [ Ingenieria/Fisica 2            ]  📂     │
│  Docente    [ Palacio                        ]         │
│             Vacío = las teorías van a Teorias/ plana   │
│                                                        │
│  Tema                          Carpeta                 │
│  ─────────────────────────────────────────────────     │
│  Clases Teóricas Módulo I    [ Teorias/Palacio    ▾]   │
│  Guía de TP Nº 1             [ Practicas          ▾]   │
│  Guía de TP Nº 2             [ Practicas          ▾]   │
│  Laboratorios                [ Laboratorios       ▾]   │
│  Bibliografía                [ Bibliografia       ▾]   │
│  Cronogramas                 [ (raíz)             ▾]   │
│  Videos                      [ Teorias/Palacio    ▾]   │
│  Pruebas diagnósticas        [ Parciales          ▾]   │
│                                            12 temas    │
│                                                        │
│                          [ Cancelar ]  [ Confirmar ]   │
└────────────────────────────────────────────────────────┘
```

### Lista de descarga — nombre editable y ruta destino

```
┌────────────────────────────────────────────────────────┐
│  ☑  Teorias/Palacio/                                   │
│     [ 05_capacitores.pdf                        ] ✎    │
│     Palacio - Clase 5 - Capacitores.pdf                │
├────────────────────────────────────────────────────────┤
│  ☑  Practicas/                                         │
│     [ 03_ley_de_gauss.pdf                       ] ✎    │
│     Pract.3-Prob.P1.pdf                                │
├────────────────────────────────────────────────────────┤
│  ✓  Laboratorios/                          ya lo tenés │
│     G22-2026-Pautas para realizar el informe…          │
└────────────────────────────────────────────────────────┘
```

### Sólo la región que cambia — estados

**Tema sin asignar (A2)**

```
│  ⚠  (raíz de la materia)              tema sin asignar │
│     [ guia_de_tp_n_13.pdf                       ] ✎    │
│     Guía de TP Nº 13                  [ Asignar… ]     │
```

**Índice ilegible (A1)** — reemplaza la lista entera

```
┌────────────────────────────────────────────────────────┐
│  ⛔  No se pudo leer .course-downloader.json                    │
│                                                        │
│  Línea 47: falta una coma.                             │
│  No se va a bajar nada hasta que se arregle. El        │
│  archivo no se tocó.                                   │
│                                        [ Reintentar ]  │
└────────────────────────────────────────────────────────┘
```

**Descartado por contenido (A3)** — al terminar la descarga

```
│  ✓  Laboratorios/                                      │
│     Ya lo tenías como                                  │
│     F2-G22-…-Lab#1-Grupos de trabajo.pdf               │
│     No se escribió nada.                               │
```

---

## Criterios de aceptación

```gherkin
AC-1 — Un archivo nuevo va a su carpeta con el nombre propuesto
  Dado el curso "Física II G22" asociado a "Ingenieria/Fisica 2" con docente "Palacio"
    y el tema "Clases Teóricas Módulo I" asignado a "Teorias/Palacio"
  Cuando se baja el adjunto "Palacio - Clase 5 - Capacitores.pdf"
  Entonces el archivo queda en "Ingenieria/Fisica 2/Teorias/Palacio/"
    y el índice anota su id de Drive con esa ruta y su md5
```

```gherkin
AC-2 — Un archivo que el dueño ya tenía con otro nombre no se duplica
  Dado que "Ingenieria/Fisica 2/Laboratorios/F2-G22-…-Lab#1-Grupos de trabajo.pdf" ya existe
    y su id de Drive no figura en el índice
  Cuando se baja el adjunto cuyo nombre saneado sería "…-Lab_1-Grupos de trabajo.pdf"
  Entonces no se escribe ningún archivo nuevo
    y el adjunto queda marcado como descargado
    y el índice anota el id apuntando al archivo que ya estaba
```

```gherkin
AC-3 — Un archivo renombrado por el dueño se reconoce por contenido
  Dado que "Ingenieria/Fisica 1/Teorias/mod1_06_trabajo_y_energia.pdf" ya existe
    y su origen fue "Teoria Grupo G-Trabajo_energia cinetica y potencia.pdf"
  Cuando se baja ese adjunto del Classroom de Física I
  Entonces no se escribe ningún archivo nuevo
    y se marca como descargado
```

```gherkin
AC-4 — El nombre editado se recuerda
  Dado que el dueño editó el nombre propuesto a "10_circuitos_transitorios.pdf"
  Cuando se vuelve a escanear el mismo curso más tarde
  Entonces ese adjunto aparece con el nombre "10_circuitos_transitorios.pdf"
    y no se le vuelve a pedir al dueño que lo edite
```

```gherkin
AC-5 — Mover un archivo a mano corrige el índice
  Dado que el índice anota un archivo en "Ingenieria/Fisica 2/Practicas"
    y el dueño lo movió a "Ingenieria/Fisica 2/Teorias/Palacio"
  Cuando se escanea el curso
  Entonces el índice pasa a anotar la ruta nueva
    y el archivo no se vuelve a bajar
    y nada se mueve en el disco
```

```gherkin
AC-5b — Mover un archivo a otra materia también corrige el índice (RN-19, dueño 2026-09-27)
  Dado que el índice anota un archivo en "Ingenieria/Fisica 2/Practicas"
    y el dueño lo movió y renombró a "Ingenieria/Fisica 1/Practicas/otro_nombre.pdf"
  Cuando se escanea el curso de Física 2
  Entonces el índice pasa a anotar la ruta y el nombre nuevos
    y el archivo no se vuelve a bajar
    y una copia idéntica que sólo esté fuera de la raíz (por ejemplo en "~/Boveda/Archivo/") no cuenta como encontrada
```

```gherkin
AC-6 — Un archivo borrado se vuelve a bajar con su nombre
  Dado que el índice anota "05_capacitores.pdf" en "Teorias/Palacio"
    y ese archivo no está en ninguna carpeta de la materia
  Cuando se baja ese adjunto
  Entonces se escribe "Teorias/Palacio/05_capacitores.pdf"
    y no se le pide al dueño que lo vuelva a nombrar
```

```gherkin
AC-7 — Un índice ilegible frena todo
  Dado un ".course-downloader.json" con JSON inválido
  Cuando el dueño abre el popup en cualquier curso
  Entonces se muestra el aviso con el problema
    y el botón de bajar queda deshabilitado
    y el archivo queda igual que estaba
```

```gherkin
AC-8 — Un docente nuevo no mueve lo que ya estaba
  Dado que "Ingenieria/Fisica 1/Teorias/" tiene 10 archivos sueltos
  Cuando se asocia un curso de Física I con docente "Mendoza"
  Entonces los 10 archivos sueltos siguen donde estaban
    y el material nuevo va a "Teorias/Mendoza/"
```

```gherkin
AC-9 — Un tema nuevo no se baja a ciegas
  Dado el curso "Física II G22" ya asociado
    y un tema "Guía de TP Nº 13" que no estaba al asociarlo
  Cuando se escanea el curso
  Entonces sus adjuntos aparecen con destino la raíz de la materia
    y marcados como tema sin asignar
```

```gherkin
AC-10 — Un curso que desaparece no toca nada
  Dado el curso "MC4 1S 2026" asociado y con archivos bajados
  Cuando ese curso deja de aparecer en Classroom
  Entonces sus archivos siguen en el árbol
    y su entrada sigue en el índice
    y no se ofrece borrar nada
```

```gherkin
AC-12 — El mismo recurso publicado dos veces son dos accesos
  Dado el vínculo "gasaneofisica.uns.edu.ar/.../FuerzaElasticaComparativaCosSin.html"
    publicado en Física I como "Resortes horizontales"
    y el mismo vínculo publicado como "Simulador de resortes-Clase III"
  Cuando se escanea el curso
  Entonces se escriben dos accesos .md
    y el índice tiene dos entradas, una por título
```

```gherkin
AC-13 — Un acceso .md con notas del dueño no se pisa
  Dado el acceso "campo_electrico.md" ya escrito en la carpeta destino
    y que el dueño le agregó notas, así que su md5 cambió
  Cuando se vuelve a escanear el curso
  Entonces el archivo queda intacto, con las notas
    y el índice lo anota como descargado
```

```gherkin
Esquema del escenario: AC-11 — Nombres que la regla no acierta
  Dado el adjunto de Classroom "<original>"
  Cuando la extensión propone un nombre
  Entonces propone "<propuesto>"
    y el dueño puede dejarlo en "<final>"

  Ejemplos:
    | original                                      | propuesto                                  | final                        |
    | P3.- Ley de Gauss-2023.pdf                    | 03_ley_de_gauss.pdf                        | 03_ley_de_gauss.pdf          |
    | P10.- Circuitos de CC en estado transitorio   | 10_circuitos_de_cc_en_estado_transitorio   | 10_circuitos_transitorios    |
    | Documento_completo.pdf-PDFA.pdf               | documento_completo_pdfa.pdf                | libro_de_catedra.pdf         |
    | Teoria Grupo G-MAS.pdf                        | teoria_grupo_g_mas.pdf                     | mod1_08_mas.pdf              |
```gherkin
AC-14 — Enlaces de videollamada al tope, con chip y descartables en adopción (RN-32)
  Dado un curso con anuncios o materiales que contienen enlaces a salas de videollamada (Meet, Zoom, Teams, Webex o Jitsi)
  Cuando se escanea el curso
  Entonces se clasifican como tipo "acceso" con "esVideollamada: true"
    y en el popup se listan fijados arriba de todo dentro de su curso
    y se renderizan con un chip distintivo "Videollamada"
    y vienen seleccionados por defecto para descarga
    y en el gestor de adopción web figuran con opción de acción "omitir" para excluirlos de la bajada
```

---

## Requisitos no funcionales

- **NFR-1 — Privacidad.** Ningún archivo descargado lleva metadata agregada por la extensión, ni
  interna ni en atributos extendidos. Compartir un archivo no revela su origen. *(Verificado sobre
  los 318 archivos de la Verificación B: cero xattr.)*
- **NFR-2 — El índice viaja con la bóveda.** Se versiona en el repo privado de `~/Boveda` (RN-24). La extensión nunca escribe `.gitignore`.
- **NFR-3 — El md5 se calcula una vez por archivo** y se guarda en el índice. Un escaneo que no baja
  nada no recalcula nada.
- **NFR-4 — El árbol previo es inmutable.** Ninguna regla escribe, mueve o renombra un archivo que
  la extensión no bajó. RN-19 corrige el índice, no el disco.
- **NFR-5 — Compatibilidad de escritura.** El índice se escribe sólo bajo la raíz, validado con
  `esRutaSegura`.

---

## Dependencias

| Qué | Por qué |
|---|---|
| Corte 1 mergeado a `main` | ✅ Esta spec define el destino de lo que el corte 1 baja |
| Los dos defectos de escaneo arreglados | ✅ Novedades pagina desde `7b60e05` (G25: 28 adjuntos en vez de 4); el adjunto a medio hidratar lo cerró el corte 1 (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`) |
| Raíz en la bóveda | ✅ Adopción aplicada en `~/Boveda` `32136ca` (295 archivos + índice, 354 entradas) |

---

## Supuestos resueltos

| # | Decisión | Por qué |
|---|---|---|
| 6 bis | Docente nuevo: lo viejo no se mueve, subcarpeta sólo al nuevo | Es el patrón que el árbol ya tiene en Física 1; respeta el supuesto 3 y no rompe links del vault |
| 12-13 | La extensión propone, el dueño edita, se recuerda por id de Drive | La regla sola acierta 15 de 26; acortar un tema es criterio, no texto |
| 18 | "Ya descargado" por contenido, no por nombre | 4 archivos medidos con md5 idéntico y nombre distinto por el saneo `#`→`_`; y 9 teorías de Física 1 renombradas por el dueño |
| 20 | Sin objeto | Lo cubre el 18: las copias idénticas colapsan solas |
| 22 | Índice único en la raíz, versionado | El storage muere al reinstalar; los xattr no sobreviven a `git clone` ni a `cp`. Era gitignoreado mientras la raíz fue `~/U.N.L.P` (público); en la bóveda privada se versiona (ADR-0018). |

## Preguntas abiertas

- **PA-1** *(era D-2)* — Si el contenido ya está en disco con otro nombre, hoy gana el nombre viejo y
  no se toca nada (RN-20 + NFR-4). **Recomendación**: dejarlo así. Si el dueño quiere unificar, que
  sea una acción explícita suya, nunca un efecto de bajar.
- **PA-2 — ✅ DECIDIDO (tanda, 2026-09-27, siguiendo la recomendación)** — Cuando varios adjuntos del
  mismo curso son el mismo archivo (template de Física I ×5, `interferencia2025` ×2: 2 grupos, 7
  adjuntos, recontado el 2026-09-27), el primero en el orden del escaneo fija ruta y nombre, y los demás
  quedan en el índice apuntando a la misma ruta, nombre y md5, para que la lista los muestre como
  descargados. No cambia nada visible para el dueño salvo que no ve copias.

- **PA-3 — ✅ DECIDIDO por el dueño (2026-09-27): adopción desde `~/Descargas/verificacion-b`.** Un
  script de una sola corrida (no una función de la extensión) cruza el `listaPersistente` del storage de
  la extensión (hoy 337 ítems con `idArchivo`, `carpeta` y `titulo`) con los archivos de
  `verificacion-b` (365) por nombre en disco, y con `~/U.N.L.P` por md5. Los que ya están en el árbol
  conservan ruta y nombre; el resto se **copia** desde `verificacion-b`, con el nombre propuesto y
  editable. No se re-descarga nada. El requisito de exportar el mapa id→adjunto queda cubierto por esa
  lectura única del storage; una vía sostenida no hace falta. Texto original de la pregunta:
  **Cómo nace el índice sobre un árbol que ya está poblado.** `~/U.N.L.P/Ingenieria/` tiene
  **132 archivos**, de los cuales **55 son idénticos por md5** a adjuntos de Classroom (medido el
  2026-09-16, ver abajo). Con el índice vacío, RN-20 llega al resultado correcto por el camino caro:
  baja los 263 documentos (~370 MB) sólo para descubrir que 55 ya los tenía. **Recomendación**: un paso de **adopción**, que se corre una vez por materia y
  cruza tres cosas que hoy están alineadas por única vez — el id de Drive de cada adjunto (que la
  extensión conoce tras escanear), el md5, y la ruta y el nombre que el dueño ya eligió en el árbol.
  El índice nace poblado y no se baja nada. La semilla existe: los 318 archivos de la Verificación B
  en `~/Descargas/verificacion-b/google-classroom/`, que ya fueron cruzados a mano para los 9 de
  Física 1 y los 4 de `Fisica 2/Laboratorios/`.
  - **Requisito que esto impone**: la extensión tiene que poder **exportar el mapa id de Drive →
    adjunto** de un escaneo. Hoy eso vive sólo en `chrome.storage` (LevelDB comprimido), legible a la
    fuerza pero no por una vía sostenida.

- **PA-3, forma de la adopción — ✅ DECIDIDO por el dueño (2026-09-27)**: el script no copia de una. Genera
  tres tablas TSV (cursos, temas, archivos) con materia, docente, carpeta y nombre propuestos; el dueño
  las edita, y recién una segunda corrida copia y escribe el índice. Es el mismo método que el formateo
  del 2026-09-13 (`docs/plan-unlp-formateo-ingenieria.tsv`).

## Cortes de construcción

Decididos por el dueño el 2026-09-27. Cada uno es una rama y un plan.

| Corte | Qué entrega | Reglas |
|---|---|---|
| **2a — Adopción** | Script de una sola corrida: lleva `verificacion-b` a la raíz (se aplicó en la bóveda, `32136ca`) con los nombres que el dueño eligió y hace nacer el índice. No toca la extensión. Plan: `docs/plan-classroom-destino-2a-adopcion.md` | RN-1, 3–8, 11, 12, 15–17, 20, 21, 23–26, 28, 30 (en su forma de adopción); PA-2, PA-3 |
| **2b — La extensión usa el índice** ✅ 2026-10-01 | Raíz por portal; "ya descargado" y descarga a la carpeta del tema según la tabla de decisión; tema nuevo sin asignar; índice ilegible; omisiones migradas. Planes: 01 a 06 en `~/Boveda/Proyectos/courseDownloader/Planes/` | RN-2, 3a, 9, 10, 17, 18–22, 25, 27, 29, 29a, 30, 31 |
| **2c — Pantallas** | Asociar un curso nuevo; editar el nombre en la lista y recordarlo | RN-1, 4, 7, 13, 14 |

## Medición de respaldo — cruce del árbol contra lo descargado (2026-09-16)

Cruce por md5 de `~/Descargas/verificacion-b/google-classroom/` (318 archivos de 5 cursos) contra
`~/U.N.L.P/Ingenieria/` (132 archivos). Hecho por el agente `agy`, que dejó el informe con los md5
de cada coincidencia en `~/.gemini/antigravity-cli/brain/5f8b9f11-5ab7-4689-89c2-35ef2dc52f71/informe_colisiones.md`
(fuera del repo, y por eso se cita acá lo que importa). **Verificado de forma independiente** el
2026-09-17 recontando los md5 de las dos puntas: los cinco resultados se reprodujeron exactos.

| Qué | Resultado | Qué regla respalda |
|---|---|---|
| Nombres que coinciden con **contenido distinto** | **0** de 7 coincidencias | Ninguna descarga pisa trabajo del dueño. Es la cota inferior de riesgo, y da cero. |
| Documentos de Classroom que el dueño **ya tenía** | **55** de 263 (20,9 %), en 54 rutas | RN-20: sin comparación por contenido, esos 55 se duplicarían |
| Duplicados por md5 **dentro del árbol** | **0** grupos | El árbol está curado; RN-20 lo preserva |
| Duplicados por md5 **dentro de Classroom** | **2** grupos (template ×5, `interferencia2025` ×2) | PA-2 |
| Material **nuevo** para el árbol | 208 documentos (204 únicos) + 55 accesos `.md` | Dimensiona el corte 2 |
| Control: `mb5_2024` vs `Matematica B` | 24 bajados, 5 en el árbol, **0** en común | Una materia entera sin cubrir |
| URLs distintas entre los 55 accesos `.md` | **54** de 55 | RN-29: la única URL repetida son dos materiales distintos, así que el título tiene que estar en la clave |

**Lo que esta medición NO cubre**: es un cruce nombre-contra-nombre sobre los nombres crudos. No
simula el destino final, porque los nombres que el dueño elegiría y el mapeo tema → carpeta son
justamente lo que esta spec define. Las colisiones entre dos archivos **nuevos** que al renombrarse
caigan en el mismo nombre y la misma carpeta las cubre RN-16, y sólo se pueden medir con el índice
ya poblado.

- **PA-4** *(abierta 2026-09-27, para el corte 2b)* — **✅ DECIDIDO (dueño, 2026-09-28): RN-29a.** **Un acceso `.md` editado y además movido.**
  Su md5 cambió al editarlo, así que RN-19 no lo encuentra y RN-22 lo vuelve a crear en la ruta vieja:
  quedan dos notas. RN-30 sólo lo protege si sigue en su lugar. **Recomendación** (tanda): para los
  `.md` de acceso, si el id está en el índice no se vuelve a crear nunca, esté donde esté. Costo: un
  acceso movido y después borrado no vuelve. El dueño todavía no la decidió.
- **PA-5** *(abierta 2026-10-01, para el corte 2b/2c)* — **RN-10 se parte en dos.** Se cumple para lo
  ya decidido (omisiones migradas en el corte 2b por RN-31). La regla mecánica para cronogramas
  **nuevos** queda abierta con la medición en su texto: un solo cronograma en todo el índice real
  y tres nombres de tema. No se puede derivar de los nombres; implementarla sería adivinar. El editor
  (plan 07) dejará marcar un archivo como omitido a mano.

## Mediciones pendientes

- **M-2 — Apellido de la docente de Química (Q5).** Classroom no lo tiene: Personas lista sólo la
  cuenta "Comision Q5" y los posts firman "Saludos Sonia". **Cómo**: fuera de Classroom (SIU Guaraní,
  Moodle de la cátedra, o el dueño). **Qué decide**: el nombre de `Teorias/<Docente>/` para esa
  materia. **No bloquea**: el curso está vacío y no hay carpeta de Química en `~/U.N.L.P`.

---

## Secciones descartadas

- **Diagrama de estados**: no hay máquina de estados; la decisión de bajar es una tabla, y está.
- **Contrato de API**: no hay endpoint nuevo hacia afuera. El formato del índice está en §Datos.
- **Glosario**: los términos de dominio (tema, material, adjunto, acceso, curso, materia) ya están
  definidos en `docs/portal-google-classroom-diseno.md`; repetirlos acá los haría divergir.
- **Feature files `.feature`**: el proyecto corre vitest y no tiene runner de BDD. Los escenarios
  viven en este documento.
