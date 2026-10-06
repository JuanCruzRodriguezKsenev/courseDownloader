# IDEAS (LIDI): el quinto portal, multicurso y con destino en el árbol del dueño

**Estado**: `draft` — dependen de **M-1..M-5** (§Mediciones pendientes) RN-7, RN-9, RN-11 y RN-13.
**Fecha**: 2026-10-05
**Autor**: tanda (Claude Sonnet 5.5)
**Firmado**: tanda claude sonnet 5.5
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Hereda de**: [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (`destino:RN-n`), [`../moodle-linti/spec.md`](../moodle-linti/spec.md) (`linti:RN-n`) y [`../classroom-escanear-todas/spec.md`](../classroom-escanear-todas/spec.md) (`todas:RN-n`). Las reglas de esta spec se citan como `RN-n`.

---

## Historia

> Como estudiante de Informática, quiero que lo que la extensión baja de IDEAS
> (`ideas.info.unlp.edu.ar`, el entorno virtual del LIDI) caiga en mi árbol `~/Boveda/Areas/Facultad` con las
> mismas carpetas y nombres que ya tengo con Classroom, y poder escanear todos mis cursos desde `/home`,
> para no bajar ni mover nada a mano.

## Contexto y problema

IDEAS **no es Moodle**: HTML del servidor con jQuery y cookie de sesión HttpOnly. No tiene video ni API de
contenido. Se midió el 2026-10-05 con el curso `conceptos-de-bases-de-datos-1` (hoy el único en `/home`):

- Rutas `/<slug>/{Start,Contents,Resources,Evaluation,Communication,Collaboration}`, con GUID por ítem.
- **Material**: `/<slug>/Contents/Material/View/Show?courseTool` trae 9 secciones (`a[onclick*="toggleContent"]`, GUID en el `onclick`); cada `.../Show/<guid>` trae sus `a.contentToView`. Sin anidado.
  Archivos por sección: Información de cátedra 0 (texto), Metodología de cursada y Cronograma 1, Bibliografía 1, Promoción 0 (texto), Notas Evaluación Teórica 1, Notas Eval. Teórica Rec. 1, Notas Examen Práctico 3, Teorías 9, Material de práctica 16. **32 archivos**: 31 PDF y 1 zip.
- **Descarga**: `.../Contents/Material/View/Access/<guid>` responde 200 directo con `content-disposition: inline; filename="X.pdf"`. **El nombre real sólo está en el header**: el texto del enlace dice «Clase 1» y el archivo es `INNOVACION-2026.pdf`. Cuesta una petición por archivo (~0,7 s).
- **Medioteca**: `/<slug>/Resources/MediaLibrary/View/Show?courseTool`, tabla con 1 fila («Dev Pascal», 2016, `.rar` de 8 MB), enlace `.../AccessResource/<guid>` → 200 directo con filename en el header.
- Tiempos: listar una sección 0,6–1,4 s (Material de práctica 11,8 s); todo el material 28 s.

## Alcance

**Incluye**
- Portal `ideas-info` en `ideas.info.unlp.edu.ar`: escanear un curso, escanear todos desde `/home`, bajar.
- Archivos de Material y de la Medioteca; el texto de las secciones sin archivos como `.md`.
- Destino por índice desde el primer día.

**No incluye**
- Otras herramientas del curso (Evaluación, Comunicación, Colaboración).
- Video (no hay).
- Detectar que un docente reemplazó un archivo.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir `/home` o un curso, escanear, asociar el curso a una materia (editor), editar nombres, bajar |
| Extensión | Leer las páginas con la sesión del navegador, resolver el nombre de cada archivo, bajar y mandar al backend |
| Backend | Igual que en `destino:` |

---

## Reglas de negocio

### Identidad y alcance

- **RN-1** — El `id` del portal es `ideas-info`. La clave de curso es `ideas-info:<slug>`, con `<slug>` el primer segmento de la ruta del curso (`conceptos-de-bases-de-datos-1`).
- **RN-2** — De un curso entran todas las secciones de Material y la Medioteca. Las **tres secciones «Notas…» se bajan como cualquier otra** (decisión del dueño).
- **RN-3** — El *tema* de un ítem es el nombre de su sección. Los de la Medioteca llevan el tema «Medioteca».
- **RN-4** — Un popup abierto dentro de un curso escanea ese curso. Abierto en `/home` ofrece «Escanear todos los cursos» (también con un solo curso) y no escanea solo (`ing:RN-14`).

### Qué se lista y cómo se llama

- **RN-5** — La clave de archivo es el GUID del ítem (el último segmento de `.../Access/<guid>` o `.../AccessResource/<guid>`). La clave de un texto es `texto:<guid de la sección>`.
- **RN-6** — El nombre original de un archivo sale del **header `content-disposition`** de su URL de acceso, nunca del texto del enlace. Se lee **al escanear**, y la lista ya muestra el nombre real. Los nombres que chocan en un mismo tema siguen `linti:RN-7`.
- **RN-7** — Una sección sin archivos pero con texto (Información de cátedra, Promoción) genera **un ítem `.md` con ese texto**, con el frontmatter de `destino:RN-17`. Cómo se lee ese texto es **M-3**.
- **RN-8** — Cada ítem lleva `publicacion` = nombre de su sección (alimenta `destino:RN-7a`, como `linti:RN-8`).

### Escanear

- **RN-9** — Un curso se escanea pidiendo con `fetch` same-origin con credenciales la página de Material, luego cada sección, luego el header de cada archivo, y por último la Medioteca. La concurrencia dentro de un curso es ≤ 4. Que el `fetch` del service worker reciba la cookie HttpOnly es **M-1**.
- **RN-10** — El tope por curso es **120 s** (`topeEscaneoMs`); sólo leer los nombres de 32 archivos son ~22 s. El tiempo real es **M-2**.
- **RN-11** — Sesión vencida (la URL final no es la pedida o va al login): la cola o el recorrido **pausan con aviso de sesión** (`linti:RN-10`). Cómo se distingue el login en IDEAS es **M-1**.
- **RN-12** — Un 404 o 410 sobre un archivo lo saltea y sigue (`linti:RN-11`).

### Todos los cursos

- **RN-13** — En `/home` entran los slugs de los cursos de la página, desduplicados y en orden de aparición. Cómo se ve `/home` con 2 o más cursos es **M-5**.
- **RN-14** — Los cursos se recorren **en serie** desde la pestaña de `/home`, nunca en paralelo ni en pestañas de fondo (`ing:RN-16`). De cada curso se hace lo mismo que el escaneo de un curso.
- **RN-15** — Valen `todas:RN-8`, `RN-9`, `RN-14`, `RN-15`, `RN-16`, `RN-17` y `RN-18` sobre este portal: curso fallido se saltea con motivo, navegar fuera corta el recorrido, curso sin material cuenta como vacío, progreso persistente, resumen final y la lista reemplaza a la guardada. El recorrido no descarga.
- **RN-16** — La clave de cada ítem lleva su curso (ADR-0014): el mismo PDF en dos cursos aparece dos veces.

### Bajar

- **RN-17** — Un archivo se baja con la cookie del navegador. Una respuesta que es una página y no un archivo no se escribe (`linti:RN-11`).
- **RN-18** — El `.zip` y el `.rar` se bajan como cualquier archivo; no se descomprimen. De qué sección sale el `.zip` es **M-4**.

### Lo heredado

- **RN-19** — Valen sin cambio `destino:RN-1` a `RN-9`, `RN-11` a `RN-30` salvo `RN-10` y `RN-16a` (no hay cronogramas ni Novedades). Un curso sin asociar se lista pero no se baja. El curso se asocia con el mismo editor.
- **RN-20** — `esPaginaDelSitio` reclama `/home` y las rutas de un curso; `esPortada` es verdadera para `/home` y sus subrutas; `claveDeListado` devuelve `"todos"` en `/home` y el `slug` en un curso (`sitio/google-classroom/config.ts:71-81`).
- **RN-21** — Nombre en el popup «IDEAS (UNLP)», con color propio distinto al de los otros portales.

## Flujos

**Camino feliz**
1. El dueño abre `/home`; el popup ofrece «Escanear todos los cursos».
2. Lo aprieta; la tarjeta muestra «Curso 1 de 1: Conceptos de Bases de Datos 1».
3. Termina: resumen y lista con los archivos de las 9 secciones (31 PDF + 1 zip), los 2 `.md` de texto y el `.rar` de la Medioteca, todos con su nombre real.
4. Asocia el curso a una materia con el editor y baja.

**Alternativos**

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | Un curso supera 120 s o falla | Se saltea con motivo (`todas:RN-8`) |
| A2 | Un curso sin material | No aparece; vacío en el resumen |
| A3 | Sesión vencida | Pausa con aviso (RN-11) |
| A4 | Navega fuera de `/home` a mitad | Se corta; se conservan los completos |
| A5 | Un archivo da 404 o 410 | Se saltea y sigue (RN-12) |
| A6 | El header no trae `content-disposition` | El ítem usa el texto del enlace y queda marcado (RN-6; ver PA-1) |
| A7 | Una sección tiene archivos y también texto | Sólo se listan los archivos (RN-7 aplica a secciones sin archivos) |

## Datos

- **Entidades nuevas:** el tipo de ítem `.md` con texto de sección (RN-7). Los demás reusan `Clase`/`ColaItem` con `sitioId: "ideas-info"`.
- **Ítem emitido por el escaneo:** `texto` (nombre del header), `href` (URL de acceso), `modulo` = `<curso> › <sección>`, `tipo` = `adjunto`, `idArchivo` (GUID), `cursoId` (slug), `tema`, `publicacion`.
- El índice no cambia de formato: suma entradas con prefijo `ideas-info:`.

## Criterios de aceptación

```gherkin
AC-1 — Botón en /home
  Dado el popup abierto en ideas.info.unlp.edu.ar/home con 1 curso
  Cuando el popup termina de abrir
  Entonces ofrece "Escanear todos los cursos" y no escanea solo

AC-2 — Escanear un curso
  Dado el curso conceptos-de-bases-de-datos-1 con 32 archivos, 2 secciones de texto y la Medioteca
  Cuando se escanea
  Entonces la lista tiene 31 PDF, 1 zip, 1 rar y 2 .md de texto
    y cada archivo muestra el nombre del header, no el texto del enlace

AC-3 — Nombre del header
  Dado un enlace con texto "Clase 1" cuyo header trae filename="INNOVACION-2026.pdf"
  Cuando se escanea
  Entonces el ítem se llama "INNOVACION-2026.pdf"

AC-4 — Notas incluidas
  Dado las secciones "Notas Evaluación Teórica", "Notas Eval. Teórica Rec." y "Notas Examen Práctico"
  Cuando se escanea
  Entonces sus 5 PDF aparecen en la lista con el tema de cada sección

AC-5 — Texto como .md
  Dado la sección "Promoción" sin archivos y con texto
  Cuando se escanea
  Entonces aparece un .md con ese texto y el frontmatter de acceso

AC-6 — Medioteca
  Dado la Medioteca con la fila "Dev Pascal" (.rar)
  Cuando se escanea
  Entonces el .rar aparece con el tema "Medioteca"

AC-7 — Curso sin asociar
  Dado un curso sin materia asociada
  Cuando se escanea
  Entonces la lista se ve y no se baja nada

AC-8 — Sesión vencida
  Dado un recorrido donde el curso 2 pierde la sesión
  Cuando se procesa
  Entonces el recorrido se pausa con aviso de sesión
    y el curso 2 no figura como fallido ni como vacío

AC-9 — Un curso falla
  Dado un recorrido donde el curso 2 supera los 120 s
  Cuando continúa
  Entonces el curso 2 figura como fallido con su motivo y el 3 se escanea igual

AC-10 — Nombres que chocan
  Dado dos archivos del mismo tema con el mismo nombre de header
  Cuando se escanea
  Entonces ambos suman " - <sección>" (linti:RN-7)

AC-11 — Mismo archivo en dos cursos
  Dado un PDF con el mismo nombre en dos cursos
  Cuando se escanea todo
  Entonces aparece dos veces, con claves distintas

AC-12 — Escanear un curso no ofrece "todos"
  Dado el popup abierto en /conceptos-de-bases-de-datos-1/Contents
  Cuando se abre
  Entonces escanea ese curso y no ofrece "Escanear todos los cursos"
```

## Requisitos no funcionales

- **NFR-1** — Fixtures sanitizados (sin cookies, GUIDs reales de usuario ni nombres de alumnos).
- **NFR-2** — Concurrencia ≤ 4 dentro de un curso; entre cursos, en serie.
- **NFR-3** — No altera la baseline de tests de los otros portales.

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
|---|---|---|
| Secciones «Notas…» | Se bajan | Decisión del dueño |
| Nombre del archivo | El del header, al escanear | Decisión del dueño; es el nombre real |
| Secciones de texto | `.md` con su texto | Decisión del dueño |
| Medioteca | Se incluye | Decisión del dueño |
| Portal, clave, tope 120 s, zip, sesión | ver `assumptions.md` #5–#12 | Asumidos por mí |

## Preguntas abiertas

- **PA-1** — Si el header no trae `content-disposition` (A6): hoy usa el texto del enlace. No se midió que pase.

## Las decisiones con más filo

- **RN-2** — Las «Notas…» se bajan, contra mi recomendación. Los PDF de resultados pueden traer nombres, legajos y notas de otros alumnos y quedan en tu Bóveda, que es un repo git. Si la Bóveda se publica o se sincroniza, hay que releerlo.
- **RN-6** — Leer el nombre al escanear suma ~22 s por curso. Con varios cursos, el recorrido tarda minutos.
- **RN-7** — Es un tipo de ítem que ningún portal tiene: el texto se lee por una vía no medida (M-3).

## Mediciones pendientes

| M | Qué medir y cómo | Decide |
|---|---|---|
| M-1 | Con la extensión armada, pedir `Access/<guid>` desde el service worker y ver si la cookie HttpOnly llega; ver a dónde manda IDEAS con la sesión vencida | RN-9, RN-11 |
| M-2 | Escaneo real de un curso con lectura de los 32 headers | RN-10: si 120 s alcanza; el aviso de duración |
| M-3 | Abrir `Show/<guid>` de «Información de cátedra» y «Promoción» y pegar el HTML | RN-7: de dónde sale el texto |
| M-4 | De qué sección es el `.zip` y cómo se llama | RN-18, AC-2 |
| M-5 | Con 2 o más cursos en `/home`, ver cómo se listan y si hay paginación | RN-13 |

## Dependencias

- Reusa el recorrido genérico `recorridoTodos` y `esPortada` de los portales Moodle. El plan de IDEAS va **después** del plan del recorrido genérico.

**Secciones condicionales descartadas:** tabla de decisión (no se cruzan condiciones nuevas); wireframes (reusa popup, tarjeta y editor); contrato de interfaz (no hay API propia); diagrama de estados (lo cubre `recorridoTodos`); glosario (sin términos nuevos).

---

Firmado: tanda claude sonnet 5.5
