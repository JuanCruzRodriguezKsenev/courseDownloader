# Google Sites Mate C: Videoteca y material de cátedra

**Estado**: `draft`
**Fecha**: 2026-10-01
**Autor**: tanda (Antigravity, Gemini 3.8 Flash High)
**Firmado**: tanda agy 3.8 flash high
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Medición del portal**: `~/Descargas/matec-videoteca-completa.json` (medido el 2026-10-01: 28 PDFs, 8 videos Drive, 81 videos YouTube, 11 Forms)
**Hereda de**: [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (sus reglas se citan como `destino:RN-n`; las de esta spec, como `RN-n`).

---

## Historia

> Como estudiante de Ingeniería, quiero que la extensión baje los PDFs de ejercitación de la Videoteca de Matemática C (`sites.google.com/ing.unlp.edu.ar/matec`) y genere accesos directos para todos los videos (YouTube y Drive) y autoevaluaciones, organizados en las carpetas temáticas de `~/Boveda/Areas/Facultad/Ingenieria/Matematica C` mediante el índice `.course-downloader.json`, para tener todo el material centralizado sin copiar enlaces a mano.

## Contexto y problema

La cátedra de Matemática C publica su videoteca y ejercitación en Google Sites (`https://sites.google.com/ing.unlp.edu.ar/matec`), distribuida en 8 unidades temáticas y una sección de autoevaluaciones. El contenido combina:
1. **28 archivos PDF** de ejercicios resueltos y guías alojados en Google Drive.
2. **8 videos de clases** grabados en formato `.mp4` y `.MOV` alojados en Google Drive.
3. **81 videos teóricos y prácticos** embebidos desde YouTube.
4. **11 cuestionarios** en Google Forms.

Hoy el estudiante debe entrar tema por tema, abrir cada archivo y copiar o descargar a mano. Esta spec define cómo el adaptador de `courseDownloader` escanea la videoteca completa, baja los 28 PDFs de ejercitación a disco y genera accesos directos estructurados `.md` para los videos (YouTube y Drive) y las autoevaluaciones en el árbol de la Bóveda.

## Alcance

**Incluye**
- Google Site de Matemática C (`https://sites.google.com/ing.unlp.edu.ar/matec*`).
- Las 8 subpáginas de contenido temático (`series`, `sistemas`, `matrices`, `espacios`, `transformaciones`, `autovalores`, `diferenciales`, `fourier`) y la subpágina `autoevaluaciones`.
- Descarga directa binaria de los 28 PDFs de Google Drive vía sesión (`credencialesAdjunto: "include"`).
- Generación de accesos directos `.md` con frontmatter para los 81 videos de YouTube, los 8 videos de Google Drive y los 11 Forms.
- Destino por índice versionado (`.course-downloader.json`) en `~/Boveda/Areas/Facultad/Ingenieria/Matematica C`.

**No incluye**
- Descarga binaria de videos (ni de YouTube ni de Google Drive; ambos se registran como accesos `.md`).
- Otros sitios de Google Sites fuera de Mate C.
- Subida de respuestas a los formularios de autoevaluación.
- Layout plano viejo `raíz/<portal>/<curso>/` (este portal nace con destino por índice).

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir la videoteca en el navegador, escanear, asociar temas en el editor de destino y bajar |
| Extensión | Recorrer las 9 subpáginas temáticas, listar archivos Drive y vínculos YouTube/Forms, bajar mediante la sesión del navegador |
| Backend | Escribir archivos y accesos `.md` bajo la raíz de Facultad, calcular md5 y actualizar `.course-downloader.json` |

---

## Reglas de negocio

### Identidad y alcance

- **RN-1** — El `id` del portal es `sites-matec`: nombre del adaptador y prefijo de `cursos.<clave>` y `archivos.<clave>` en el índice. La clave de curso es `sites-matec:matec`.
- **RN-2** — Contenido descargable: únicamente los 28 PDFs de Google Drive se clasifican como `tipo: "adjunto"` y se descargan como archivo binario en disco.
- **RN-3** — Videos (YouTube y Drive): siguiendo la política de portales del proyecto (sólo Ramón Net y Anatomy descargan video binario; Classroom, Moodle y Google Sites guardan enlace), los 81 videos de YouTube y los 8 videos de Google Drive (.mp4/.MOV) **no se descargan como archivos de video**; se guardan como accesos directos `.md` con frontmatter (`tipo: acceso`, `revisado: <hoy>`), título y URL canónica (`destino:RN-17`).
- **RN-4** — Autoevaluaciones: los 11 formularios Google Forms se guardan como accesos directos `.md` (`tipo: acceso`) bajo el tema `Autoevaluaciones`.

### Escaneo y catálogo

- **RN-5** — Escaneo multi-página: parado en cualquier URL de la videoteca (`https://sites.google.com/ing.unlp.edu.ar/matec*`), el scraper fetchea en paralelo las 9 subpáginas temáticas (`series`, `sistemas`, `matrices`, `espacios`, `transformaciones`, `autovalores`, `diferenciales`, `fourier`, `autoevaluaciones`).
- **RN-6** — Tema del ítem: el `modulo` de cada ítem es el nombre normalizado de la subpágina (`Series`, `Sistemas`, `Matrices`, etc.).
- **RN-7** — Nombre propuesto: el nombre del archivo se toma del encabezado adyacente en el sitio. Si el archivo en Drive provee un nombre original limpio en `content-disposition` (ej. `Ej Series.pdf`), ese nombre tiene prioridad (`RN-6` de Moodle).
- **RN-8** — Clave de identidad del ítem:
  - Archivos de Drive: `drive:<fileId>`.
  - Videos de YouTube: `youtube:<videoId>`.
  - Forms: `form:<formId>`.

### Destino e índice

- **RN-9** — Destino por índice: el portal declara `destinoPorIndice: true`. Mapea contra el curso asociado en `.course-downloader.json` bajo `Ingenieria/Matematica C`.
- **RN-10** — Mapeo de temas:
  - `Series` → `Series` (o `Practicas/Series`)
  - `Sistemas` → `Sistemas`
  - `Matrices` → `Matrices`
  - `Espacios` → `Espacios`
  - `Transformaciones` → `Transformaciones`
  - `Autovalores` → `Autovalores`
  - `Diferenciales` → `Diferenciales`
  - `Fourier` → `Fourier`
  - `Autoevaluaciones` → `Autoevaluaciones`
- **RN-11** — Deduplicación por contenido: si un archivo PDF ya existe en la carpeta con el mismo hash md5, no se vuelve a bajar y el índice lo da por completado (`destino:RN-18`).

### Descarga y red

- **RN-12** — Descarga con sesión: los archivos de Drive se bajan con `credentials: "include"`. Archivos > 100 MB que activan el aviso de virus de Drive se siguen mediante el parámetro `confirm` (mismo mecanismo de Classroom).
- **RN-13** — Fallos puntuales: un 404 en Drive o un video eliminado de YouTube saltea sólo ese ítem (`tipoPortal: "rechazo"`) y la cola continúa.

---

## Flujos

### Camino feliz

1. El dueño abre `https://sites.google.com/ing.unlp.edu.ar/matec` en el navegador.
2. Abre el popup y presiona «Escanear».
3. La extensión fetchea las 9 subpáginas temáticas en paralelo (~2-3 s) y lista 117 ítems agrupados por tema.
4. El popup muestra los 28 PDFs de Drive como adjuntos, y los 89 videos (81 YouTube + 8 Drive) más los 11 Forms como accesos `.md`.
5. Si el curso no está asociado en `.course-downloader.json`, el popup muestra la card de asociación (🗂️).
6. El dueño asocia a `Ingenieria/Matematica C` y confirma.
7. Se encola la descarga: los PDFs se escriben en disco y los accesos `.md` se generan en sus carpetas temáticas.

---

## Criterios de aceptación

```gherkin
AC-1 — Escaneo consolidado de las 9 subpáginas
  Dado el usuario en la portada o en cualquier subpágina de Mate C
  Cuando presiona "Escanear" en el popup
  Entonces la lista muestra 117 ítems distribuidos en los 9 temas
    y el tiempo de escaneo no supera los 5 segundos
```

```gherkin
AC-2 — Descarga de PDF de ejercitación
  Dado un ítem de ejercitación "Ej Series.pdf" alojado en Google Drive
  Cuando se baja la cola
  Entonces el archivo se escribe como PDF binario en la carpeta correspondiente
    y su md5 queda registrado en el índice
```

```gherkin
AC-3 — Acceso directo para videos (YouTube y Drive)
  Dado un video de teoría de YouTube o un video grabado en Google Drive
  Cuando se procesa en la cola
  Entonces se genera un archivo Markdown con frontmatter "tipo: acceso"
    y el cuerpo contiene el link al video (en YouTube o Google Drive)
```

```gherkin
AC-4 — Acceso directo para Autoevaluación
  Dado un formulario de autoevaluación en la sección "Autoevaluaciones"
  Cuando se procesa en la cola
  Entonces se genera un archivo Markdown en "Autoevaluaciones/" con el link al formulario
```

```gherkin
AC-5 — Deduplicación de archivos existentes
  Dado un PDF de la cátedra que ya fue bajado previamente en la carpeta
  Cuando se vuelve a escanear y bajar
  Entonces el archivo no se reescribe y el popup lo marca como "Ya lo tenías"
```

---

## Requisitos no funcionales

- **NFR-1** — No regresión: los portales existentes (Ramón Net, Anatomy, Classroom y Moodle) no modifican su comportamiento ni sus tests.
- **NFR-2** — Sanitización: ningún log, fixture ni archivo `.md` generado almacena correos personales ni tokens de sesión.
- **NFR-3** — Rendimiento de escaneo: el barrido de las 9 subpáginas en paralelo no debe superar los 6.000 ms (`topeEscaneoMs = 10000`).

---

## Supuestos resueltos

| # | Supuesto | Estado | Decisión y porqué |
|---|---|---|---|
| 1 | `id` del portal = `sites-matec` | resuelto | Identificador estable y único para prefijo de claves en índice. → RN-1 |
| 2 | Videos de YouTube como `.md` | resuelto | La extensión no descarga streams de YouTube (decisión Classroom D10). → RN-3 |
| 3 | Forms como `.md` | resuelto | Son herramientas interactivas web; se conserva el acceso directo. → RN-4 |
| 4 | Videos de Drive como `.md` | resuelto | El dueño decidió explícitamente no bajarlos como video binario sino guardar su link como acceso `.md`. → RN-3 |
| 5 | Sólo PDFs de Drive como adjuntos | resuelto | Descarga directa binaria de ejercitación y apuntes con sesión de Google vía `/api/bypass-stream`. → RN-2 |
| 6 | Escaneo multi-página automático | resuelto | El usuario no debe navegar las 8 unidades manualmente. → RN-5 |
| 7 | Destino versionado por índice | resuelto | Mapea a `Ingenieria/Matematica C` en la Bóveda del usuario. → RN-9 |

---

## Dependencias

- Corte 2b y 2c de destino e índice operativos en `courseDownloader`.
- Registro de portal `sites-matec` en `sitio/registro.ts`.
