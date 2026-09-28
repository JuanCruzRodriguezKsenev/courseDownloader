# Portal nuevo: Google Classroom — medición y diseño (fase 0)

**Estado al 2026-09-12: 🔬 en medición. No hay nada construido.** M0, C1 y M1 ✅ —
resultados en §8; D1 y D8 confirmadas. El dueño decidió D9 (destino con mapeo) y D10 (los videos
no se bajan). **M2 ✅ en los 8 cursos**, que dejó dos decisiones más (D11, D12). **M3 ✅**:
Classroom pagina cada tema de a 10, y la regla para cargarlo entero quedó medida (D13). **La
medición está completa**; lo que sigue es el plan del corte 1. Este doc es el *cómo*; cuando
exista un corte, su estado vive en `docs/ramas-en-revision.md` y el backlog en
`docs/TECHNICAL_DEBT.md`, como con cualquier otro trabajo (ADR-0007).

Es el tercer portal y el primero que **no entra por el paso a paso** de
`docs/multisitio-diseno.md` §Cómo escribir un portal nuevo: ese paso a paso asume que el portal
sirve video HLS. Leé §2 antes de creer que esto son "cinco pasos que no tocan `core/`".

---

> **El *qué* del corte 2 vive en otro lado.** El destino de los archivos en `~/U.N.L.P` —a qué
> carpeta va cada tema, con qué nombre, y cómo se sabe si un archivo ya está— está especificado en
> [`specs/classroom-destino/spec.md`](./specs/classroom-destino/spec.md) (estado `draft`), con la
> traza de decisiones en [`specs/classroom-destino/assumptions.md`](./specs/classroom-destino/assumptions.md).
> Este documento conserva las decisiones D1–D13 del portal; la spec no las repite, las linkea.
>
> **Escanear todos los cursos desde la portada** (antes del corte 2, por orden del dueño) →
> [`specs/classroom-escanear-todas/spec.md`](./specs/classroom-escanear-todas/spec.md) (estado `draft`).
>
> **Loader con progreso, vuelta a la portada al terminar el recorrido y Estado primero en filtros** →
> [`specs/loader-con-progreso/spec.md`](./specs/loader-con-progreso/spec.md) (estado `draft`).

## 1. Lo que se pidió (2026-09-12)

- **Contenido**: los cuatro tipos — videos de Drive (incluidas grabaciones de Meet), PDF y
  archivos de Drive, Docs/Slides/Sheets de Google, y videos de YouTube enlazados. **Corregido el
  mismo día por D10**: los videos no se bajan, se guarda un acceso con su link.
- **Cuenta**: `@gmail` personal. No hay administrador de Workspace de por medio, pero **el docente
  sí puede deshabilitar la descarga** de un archivo suyo (§7).
- **Portal siguiente**: Moodle / campus virtual. Pesa en D1 y en el orden de cortes.
- **Medición**: por capturas que guarda el dueño, no manejando su navegador. Por eso existe la
  sonda de §4 M0: lo único que ninguna captura puede contestar.

---

## 2. Por qué este portal no entra por el paso a paso

`PuertoSitio` tiene dos caminos de descarga (`core/puertos/sitio.ts`), y la bifurcación del bucle
está en `core/cola/procesadorCola.ts:795`:

- **video** → `resolverManifiesto` devuelve un `.m3u8` → `hlsEngine` (fragmentos + AES).
- **adjunto** → `resolverAdjunto` devuelve una URL directa → un `fetch` → bloques de 5 MB a
  `/api/bypass-stream` (`procesadorCola.ts:420`, `:467`, `:485`).

Classroom es un listado de **materiales**, y lo que un material trae son referencias (campos
`driveFile`, `youtubeVideo`, `link`, `form` del objeto `Material` de la API de Classroom). Ninguno
es HLS:

| Material | Rama que le toca | Qué le falta a esa rama hoy |
|---|---|---|
| PDF / archivo de Drive | adjunto | El `fetch` sale con `credentials: "omit"` (`procesadorCola.ts:467`) — Hotmart firma la URL, **Drive pide la cookie**. |
| Doc / Slides / Sheet | adjunto (URL de exportación) | Lo mismo, más elegir formato y extensión (`x-file-name`, `docs/deployment.md`). |
| Video de Drive | adjunto — **es el archivo original, no HLS** | `respuesta.arrayBuffer()` (`procesadorCola.ts:485`) carga el archivo **entero** en la memoria del service worker. Con un PDF anda; con una grabación de Meet de 1–2 GB, no. |
| Video de YouTube | **ninguna** | No hay URL descargable estable. Ver D3. |
| Link / formulario | ninguna | No son archivos. No se bajan. |

**El backend no cambia para nada de lo anterior**: `/api/bypass-stream` no sabe qué es un video,
recibe N bloques (`docs/deployment.md` §Contrato de endpoints, último párrafo).

---

## 3. Decisiones tomadas

Cada una con la línea contra la que se contrastó. **No reabrir sin un motivo medido.**

### D1 — Autenticación por cookie de sesión. Sin OAuth y sin la API de Classroom

- **Por qué no OAuth + API**, aunque sea la vía "oficial":
  - Exige un proyecto de Google Cloud y el scope `drive.readonly`, que es **restringido**: la app
    queda sin verificar y, en modo *Testing*, el refresh token **vence a los 7 días**.
  - `chrome.identity.getAuthToken` **no funciona en Brave**, y el proyecto es para Chrome/Brave
    (`AGENTS.md` §Project Overview). La alternativa, `launchWebAuthFlow`, obliga a llevar a mano
    el intercambio y la renovación del token.
  - `files.export` de la API de Drive **corta en 10 MB**. Un Slides con imágenes lo pasa.
- **Por qué cookie**: es el patrón que ya existe (`sitio/ramonnet/resolverManifiesto.js:40`,
  `credentials: "include"`), no guarda ninguna credencial nueva (a diferencia de ADR-0013 y
  `docs/security.md` §El `id_token`), y **Moodle también se autentica por cookie de sesión**, así
  que lo que se construya acá lo reusa el portal siguiente.
- **Condición para revertirla**: si M0 muestra que el service worker **no** manda las cookies de
  Google, D1 se reabre con OAuth vía `launchWebAuthFlow`. Es la única decisión de este doc que
  depende de una medición todavía no hecha, y por eso M0 va primero.
- ✅ **Confirmada por M0 el 2026-09-12**, con una condición que no estaba: `authuser` es
  obligatorio (§8).

### D2 — Todo lo de Drive entra por la rama del adjunto, nunca por `hlsEngine`

- Contraste: `procesadorCola.ts:789-806` (la rama ya existe y el motor "no se enteró") y
  `resolverAdjunto?` opcional en `core/puertos/sitio.ts`.
- **Lo que esto obliga a tocar en Capa 1**, y por eso no son cinco pasos: la política de
  `credentials` de `:467` pasa a depender del portal (Hotmart **necesita** `omit`, medido — ver
  el comentario de `:430`), y el `arrayBuffer()` de `:485` pasa a lectura por bloques desde
  `respuesta.body`.
- **Lo que queda para el plan del corte 3, con la medición C4 en la mano**: si un video de Drive
  se registra con `tipo: "adjunto"` o nace un tercer valor de `TipoContenido`
  (`core/cola/identidadClase.ts:60`). Es parte de la clave de identidad (ADR-0014), así que se
  decide con su radio de impacto medido, no ahora.

### D3 — YouTube queda fuera de la extensión

- No hay una URL de archivo estable: el reproductor firma y descifra las URLs, y seguir eso desde
  un adaptador es perseguir cambios de YouTube para siempre.
- Si se hace, es **el último corte**, del lado del backend delegando en `yt-dlp`, **con ADR
  propia**: le suma al backend su primera dependencia externa, y hoy no tiene ninguna
  (`AGENTS.md` §Development Workflow, bullet del backend).
- Hasta ese corte se tratan como cualquier video (D10): se enumeran y se guarda un acceso con el
  link.

### D4 — Una pestaña es un curso; el tema es el módulo; la faceta es inerte

- `materia` = nombre del curso. `modulo` = el **tema** de "Trabajo en clase"; los materiales sin
  tema van a un módulo `Sin tema`.
- Classroom no tiene un eje tipo cátedra/comisión: faceta inerte con `valorComun`, que
  `docs/multisitio-diseno.md` §1 permite y Anatomy ya hizo (`docs/portal-anatomy-by-chris-diseno.md`
  §La faceta inerte).
- Cómo aparecen los temas en el DOM **lo dice C1**; esta decisión es sobre el modelo, no sobre
  los selectores.

### D5 — `id` del portal: `google-classroom`

- Es el nombre de carpeta en disco y la mitad de la identidad (`docs/multisitio-diseno.md` §1,
  bullet de `id`). Se fija ahora porque cambiarlo después obliga a migrar storage y mover archivos.

### D6 — `esPaginaDelSitio` matchea host **y** ruta de curso

- `classroom.google.com` es sólo de Classroom, así que el match por host no tiene la trampa de
  Hotmart (`docs/multisitio-diseno.md` §1, bullet de `esPaginaDelSitio`).
- Pero hay que exigir una ruta de curso (`/c/<id>` o `/w/<id>`, con o sin el prefijo `/u/<n>/` de
  multicuenta): la home lista cursos y no se puede escanear. Las rutas exactas **las confirma C1**.

### D7 — La evidencia vive en `docs/muestras/google-classroom/`

- Gitignorada **y** fuera del lint (`.gitignore` y `eslint.config.js`, que no respeta el
  `.gitignore`). No en `sitio/`: la nota de higiene de `docs/portal-anatomy-by-chris-diseno.md`
  §Lo que se midió ya pidió no volver a meter evidencia en la capa de sitios.

### D8 — El escaneo lee el DOM y abre cada ítem desde la pestaña; `batchexecute` sólo si eso falla

Tomada el 2026-09-12 sobre C1 (§8). ✅ **Confirmada por M1** el mismo día: se abrieron 21 de
21 ítems con `click()`, sin navegar (§8).

- **Por qué el DOM**: se ancla en atributos semánticos medidos (`data-stream-item-id`,
  `data-attachment-id`, `role="button"` + `aria-expanded`), no en clases ofuscadas. El listado
  llega por `…/_/ClassroomUi/data/batchexecute`, un RPC interno sin contrato publicado, cuyo
  formato **no se midió acá**.
- **Por qué no es lo que hizo Anatomy**, que fue del DOM a la API
  (`docs/escaneo-api-anatomy-diseno.md`): allá la API tenía campos con nombre y el DOM no traía el
  dato. Acá el DOM **sí** lo trae, una vez abierto el ítem.
- **Lo que cuesta**: el escaneo abre N ítems, así que `topeEscaneoMs` se dimensiona con los ms
  por ítem que mida M1, no con los ~6 s de Ramón Net.
- **Contraste**: `escanearListado` puede devolver una promesa (`core/puertos/sitio.ts`,
  `() => ResultadoEscaneo | Promise<ResultadoEscaneo>`), y se inyecta **serializada**: la trampa
  de `docs/multisitio-diseno.md` §La trampa que más fácil se rompe vale entera.
- **Reversión**: si M1 muestra que abrir el ítem no carga los adjuntos, o que navega fuera de la
  vista, se mide `batchexecute` con un HAR sanitizado (C3).

### D9 — Destino: el árbol del dueño, con mapeo por curso y por tema

Decidida por el dueño el 2026-09-12, después de mirar `~/U.N.L.P`.

- **Qué**: la primera vez que se escanea un curso se elige su carpeta (p. ej.
  `Ingenieria/Fisica 2`) y, para cada tema, su subcarpeta ("Presentaciones teóricas" →
  `Teorias/Bianchi`). Los archivos conservan el nombre original, y lo que ya está en el árbol se
  reconoce y no se vuelve a bajar.
- **Por qué**:
  - El dueño ya había bajado a mano **28 de los 71** adjuntos del curso medido, a
    `Fisica 2/Teorias/Bianchi/` y `Fisica 2/Practicas/`.
  - Los nombres de tema de Classroom no son los de sus carpetas.
  - **Dos Classroom distintos —de docentes y cuatrimestres distintos (Bianchi, Palacio)— son la
    misma materia.** Por eso el mapeo es por **curso** y no por materia, y dos cursos pueden
    colgar de la misma carpeta de materia.
- **Lo que rompe del contrato actual, línea por línea.** Pide **ADR nueva**: es un cambio del
  contrato de disco, justo el tipo de cambio cuyo desfase fue el motivo de ADR-0015.
  - `backend/handlers.js:30` (`rutaDeDestino`) arma `raíz/<portal>/<una carpeta>`. Acá no va
    carpeta de portal, y va más de un nivel.
  - `:26` y `:75` pasan la carpeta a minúsculas: con un `Teorias/` existente crearía `teorias/`
    al lado, porque Linux distingue mayúsculas.
  - `:180`: `x-target-folder` pasa por `sanitizarNombreArchivo`, que empieza por `path.basename()`
    (`backend/utils.js:8`). Una ruta con `/` se colapsa al último segmento **sin avisar**: el mismo
    modo de falla que `docs/deployment.md` §El layout en disco lleva el portal documenta para la
    carpeta de portal. Cada segmento se sanea por separado, y se valida con `esRutaSegura`
    (`utils.js:21`).
  - `/api/escanear-disco` lee **una** carpeta (`handlers.js:88-108`); el "ya descargado" de un
    tema mapeado tiene que mirar la suya.
  - `popup.js:1508-1519` compara el título crudo con el disco usando `includes`. Tiene que ser
    igualdad exacta contra el nombre ya saneado (§8, M1).
  - El mapeo es estado persistido: va a `docs/data-model.md`, por `PuertoAlmacenamiento`.

### D10 — Los videos no se bajan: se guarda un acceso con su link

Decidida por el dueño el 2026-09-12. Si se descargan, se decide más adelante.

- **Qué**: cada video (de Drive y, cuando llegue, de YouTube) se enumera como cualquier adjunto,
  pero en lugar del archivo se guarda un `.md` con su link, en la carpeta que le toca por D9.
- **Por qué `.md`**: el árbol destino es un vault de Obsidian, y el archivo abre igual en Linux y
  en Windows. Pesa bytes, así que no infla el repo git donde vive ese árbol.
- **Qué saca del camino**: el corte 3. El adjunto más grande medido pesa 2,4 MB, así que
  `arrayBuffer()` (`procesadorCola.ts:485`) alcanza.
- **Contraste**:
  - el acceso viaja como un archivo más por `/api/bypass-stream`, con `x-file-name`
    (`docs/deployment.md`): para esto el backend no cambia;
  - el `href` del adjunto ya trae `authuser` (§8, M0), así que el link abre con la cuenta
    correcta;
  - qué `tipo` lleva en la identidad (`core/cola/identidadClase.ts:60`) lo decide el plan del
    corte, con su radio de impacto (ADR-0014).
- **Cubre también todo lo que no es archivo** (M2): los videos de YouTube y los vínculos, incluidos
  los formularios (`forms.gle`), se guardan como acceso. Se reconocen porque su `aria-label` no
  tiene el segundo `": "` de los archivos (`"Archivo adjunto: Vínculo a <url>"`) o porque dice
  `video de YouTube`.

### D11 — El escaneo lee "Trabajo en clase" **y** "Novedades"

Tomada el 2026-09-12 sobre M2 (§8).

- **Por qué**: 19 adjuntos de 3 cursos están **sólo** en Novedades (7 en MC4, 11 en MC2, 1 en
  Física I). Un escaneo que lee sólo "Trabajo en clase" los pierde **sin error**.
- **Qué implica**:
  - En Novedades el ítem se llama "Publicación de <docente>" y no hay tema: el `h2` que queda
    arriba es el widget "Próximas". Novedades es un **destino propio por curso** dentro del mapeo
    de D9, no un tema más.
  - No hay botón "Ver más publicaciones": Novedades carga con el scroll, y la espera por
    estabilidad de M1b alcanza (§8).
  - Un adjunto que aparece en las dos vistas se baja una vez, deduplicado por id de Drive. En M2
    no hubo ninguno.
- **Contraste**:
  - `ResultadoEscaneo.enlaces` (`core/puertos/sitio.ts`) es **una** lista con `modulo` por
    enlace, así que alcanza con que el módulo de estos adjuntos sea "Novedades", sin puerto nuevo;
  - la clave de identidad incluye el módulo (`core/cola/identidadClase.ts`, ADR-0014), así que un
    mismo nombre en Novedades y en un tema no choca en la identidad. **Sí** choca en disco si los
    dos destinos del mapeo apuntan a la misma carpeta: eso lo resuelve D12.

### D12 — Nombres repetidos en una misma carpeta destino

Tomada el 2026-09-12 sobre M1 y M2 (§8): en 2 de 6 cursos hay adjuntos **distintos** (distinto
id de Drive) con el mismo nombre. Son `interferencia2025.pdf` ×2 y
`informe de laboratorio fisica i 2024 (template).docx` ×5.

- **Regla**:
  - El nombre en disco es el original, pasado por el sanitizador.
  - Si dentro de **una misma carpeta destino** dos o más adjuntos con distinto id de Drive
    quedan con el mismo nombre (sin distinguir mayúsculas), **todos los del grupo** llevan el
    título del material antes de la extensión: `informe … (template) - Laboratorio 1 Fuerza de
    Roce.docx`.
  - Si además se repite el título del material (`clase 13` / `Clase 13`), se agrega el id del
    adjunto.
  - Mismo id de Drive en dos lugares = un solo archivo.
- **Por qué no prefijar siempre**: el dueño guarda con el nombre original y ya tiene al menos 40
  archivos así (28 del curso de Bianchi y 12 de los activos). Prefijar siempre haría que ninguno
  se reconociera como ya descargado.
- **Costo conocido, aceptado**: si el grupo se forma **después** de haber bajado el primero, ese
  primero se vuelve a bajar con el nombre nuevo y el viejo queda en disco. Medido: 2 grupos en 6
  cursos.
- **Contraste**:
  - el sanitizador (`backend/utils.js:8`) y el del núcleo (`core/util/texto.ts:43`) usan la misma
    lista, así que la agrupación se calcula con esa función en la extensión;
  - el "ya descargado" pasa a igualdad exacta (`popup.js:1508-1519`, §8 M1).

### D13 — El escaneo carga cada tema entero, y corre con la pestaña visible

Tomada el 2026-09-12 sobre M3 y el recorrido 2 (§8).

- **Regla para cargar un tema** en "Trabajo en clase":
  - Mientras el `button[aria-label="Ver más publicaciones"]` de la región del tema esté
    **visible y habilitado**: apretarlo, esperar a que crezca la cantidad de
    `li[data-stream-item-id]` de esa región (mientras carga, el botón queda `disabled`) y volver
    a mirar.
  - Termina cuando el botón está oculto, o cuando está deshabilitado y la cuenta no crece.
- **Por qué esa señal y no otra**:
  - **La presencia no sirve**: el botón está en los 38 temas medidos.
  - **`disabled` sola no sirve**: al apretar significa "cargando" (0 ms), y al final significa
    "no hay más" ("Links-Módulo I", 13 ítems).
  - **La visibilidad sí**: el botón estuvo visible en exactamente los 2 temas con más de 10
    ítems. En los otros 36 estaba oculto, y apretarlo no sumó nada.
  - **Pagina de a 10**: con un click, "Presentaciones teóricas" pasó de 10 a 20 y el botón se
    volvió a habilitar. El ítem 21 ("Clase 8") necesita el segundo click.
- **La pestaña tiene que estar visible.** En segundo plano Classroom no pinta: en el recorrido 2
  hubo 17 de 18 vistas vacías.
  - El escaneo se lanza desde el popup abierto sobre esa pestaña, así que empieza visible.
  - Si el usuario cambia de pestaña en medio del escaneo, el listado sale incompleto **sin
    error**. El escaneo tiene que detectarlo (`document.visibilityState`) y cortar con aviso, en
    lugar de devolver lo que llegó a leer.
- **Curso vacío**: MC6 y Q5 agotaron los 20 s de espera "a que haya ítems". El escaneo tiene que
  reconocer el estado vacío. Su selector no se midió: lo mide el plan, en su verificación.
- **Contraste**:
  - `topeEscaneoMs` (`core/puertos/sitio.ts`, requerido por portal) tiene que cubrir la carga de
    los temas y la apertura de los ítems. Física I tiene 83 ítems × ~560 ms de mediana ≈ 47 s
    sólo para abrirlos, más una página extra por tema paginado.
  - Ramón Net usa 6 s y Anatomy 30 s, con pisos fijados en `sitio/registro.test.ts`. Classroom
    necesita su propio valor, medido.
  - El watchdog de `popup.js` lo lee del descriptor.

---

## 4. Lo que falta medir, en orden

### M0 — La sonda del service worker (bloqueante: decide D1)

Es la trampa n.º 2 de `AGENTS.md`: **medir desde una pestaña miente sobre el service worker**.
Una captura muestra lo que el navegador manda solo; esto pregunta qué manda un service worker MV3.

La sonda es una extensión descartable de dos archivos, **aparte** de Course Downloader:
`docs/muestras/google-classroom/sonda-sw/`.

**El camino corto (desde v0.0.2)**: cargarla una vez y hacer **un click en su ícono** parado en
"Trabajo en clase" (y otro en un material). Captura la página, arma los ids y la `cuenta` sola,
corre M0 desde su service worker y deja `c1-*`, `c2-*` y `m0-*.json` en
`<descargas de Chrome>/medicion-classroom/`. Badge `OK` / `ERR`; el motivo del error está en el
tooltip del ícono. Los pasos de abajo son el camino manual, para probar ids a mano.

1. `chrome://extensions` → "Cargar descomprimida" → esa carpeta.
2. En la tarjeta "Sonda Google Drive (descartable)" → click en **"service worker"** → consola.
3. Conseguir ids: el id es el tramo entre `/d/` y `/view` (o `/edit`) de la URL de cada archivo
   abierto **desde Classroom**. Tienen que ser archivos **del curso, no públicos**: si no, las dos
   filas dan 200 y la prueba no prueba nada.
4. Correr (dejá afuera las claves que no tengas):

   ```js
   await sondear({ cuenta: 2, archivo: "<id de un PDF>", doc: "<id de un Doc>", slides: "<id de un Slides>", video: "<id de un video>" })
   ```

   `cuenta` es el N de `/u/N/` en la URL del curso. Con ella, cada id se prueba **tres** veces:
   `include` con `authuser`, `include` sin él y `omit`. Así se distingue "el SW no manda
   cookies" de "manda las de otra cuenta". `docs/muestras/google-classroom/captura.js` imprime
   esta línea ya armada.

5. Pegar la tabla. Repetir en **Brave** si lo usás: `getAuthToken` ya mostró que ahí las cosas de
   Google se comportan distinto.

Cómo se lee: para cada id sale una fila con `include` y otra con `omit`.

- `include` → 200/206 con `esHtml: false`, y `omit` → 401/403 o `esHtml: true`: **el SW manda las
  cookies**. D1 se confirma.
- Las dos iguales y malas: el SW **no** las manda. D1 se revierte (ver su condición).
- `include` bien pero `esHtml: true`: llegó una página intermedia (login, o el aviso de "no se
  puede analizar en busca de virus" de archivos grandes). El `destino` dice cuál.
- `aceptaRangos` / `rango` presentes en `video`: se puede leer por bloques y reanudar. Pesa en el
  corte 3.

La sonda **no loguea cookies ni headers de auth**: sólo status, host+ruta final sin query, tipo,
largo y nombre de archivo. Si no querés pegar nombres de archivo, borrá esa columna.

### Las capturas

| # | Qué | Qué contesta |
|---|---|---|
| C1 | "Trabajo en clase" de un curso, **scrolleada hasta el final**, guardada con Ctrl+S → "Página web completa" | Selectores del listado, cómo aparecen temas y materiales, si la lista es perezosa, rutas de curso (D4, D6). |
| C2 | La página de detalle de **un material** que tenga adjuntos de varios tipos, mismo formato | Cómo se ve cada tipo, y dónde está el id de Drive en el DOM. |
| C3 | **HAR sanitizado** de recargar la página de C1 desde cero | Si el listado llega en un JSON interno (como pasó en Anatomy, `docs/escaneo-api-anatomy-diseno.md`) o sólo como DOM. |
| C4 | HAR sanitizado de abrir un **video** de Drive desde el material, darle play y tocar "Descargar" | Qué URL entrega el archivo original, cuánto pesa, si hay aviso intermedio. Insumo de D2 y del corte 3. |
| C5 | HAR sanitizado de "Archivo → Descargar → PDF" en un Doc y en un Slides | La URL de exportación real y sus redirecciones. |
| C6 | Tres números en texto: cuántos cursos, materiales por curso (aprox.) y el peso del video más grande | Dimensiona el tope de escaneo (`topeEscaneoMs`) y la memoria del corte 3. |

**Cómo guardar un HAR sin filtrar tu sesión**: DevTools → Network → tildá "Preserve log" → hacé
la acción → ícono ⬇ → **"Export HAR (sanitized)"**. Esa opción deja afuera cookies y headers de
autorización. **Nunca la variante "with sensitive data"**: esa lleva tu sesión de Google adentro.

Todo va a `docs/muestras/google-classroom/`, con el número de captura en el nombre (`c1-trabajo-en-clase.html`,
`c3-recarga.har`…). Esa carpeta no se commitea.

---

## 5. Cortes previstos

**Tentativos: se replanifican con la medición en la mano**, y cada uno lleva su plan escrito
aparte. Una rama por corte y nada se mergea sin probarlo en Chrome (`AGENTS.md`, §Lo que este
proyecto cobra caro).

1. **Escaneo + archivos de Drive** → **plan escrito el 2026-09-12: `docs/plan-classroom-corte-1.md`**. **Mergeado el 2026-09-25** (registro → §9).
   Destino `raíz/google-classroom/<curso>/`; el mapeo (D9) queda para el corte 2, por decisión
   del dueño. Por la rama del adjunto, con cookie. Toca Capa 1 (la política
   de `credentials`). Radio de impacto ya visto: `core/cola/procesadorCola.ts`,
   `core/cola/procesadorCola.test.ts`, `core/puertos/sitio.ts`, `sitio/anatomy-by-chris/descargarAdjunto.js`
   (el único que hoy implementa `resolverAdjunto`), `core/cola/identidadClase.test.ts`.
1b. **Escanear todos los cursos desde la portada** → **plan: `docs/plan-classroom-escanear-todas.md`** (spec: `docs/specs/classroom-escanear-todas/spec.md`). Recorrido multi-curso que navega por el DOM/sidebar desde `/h`, reporta eventos al Service Worker vía `chrome.runtime.sendMessage` ([ADR-0016](adr/0016-escaneo-inyectado-avisa-al-sw.md)), sobrevive al cierre del popup y agrupa la lista por curso.
2. **Docs / Slides / Sheets** exportados, con nombre y extensión elegidos.
3. ~~**Videos de Drive**: lectura por bloques desde `respuesta.body`.~~ **Fuera por D10**
   (2026-09-12): los videos se guardan como acceso. Vuelve si algún día se decide bajarlos.

**El corte 1 lleva además el destino con mapeo (D9)**, que sí toca el backend y pide ADR. Si
conviene partirlo en dos lo mide el plan.
4. **YouTube**: ADR propia, del lado del backend (D3).

**Moodle va después y reusa el 1 y el 3.** Ese es el motivo de hacerlos genéricos, y no
específicos de Google.

---

## 6. Lo que no se toca

- **El camino de Hotmart**: su adjunto **necesita** `credentials: "omit"` (medido,
  `procesadorCola.ts:430`). Si generalizar la política de `credentials` le cambia el valor a
  Anatomy, rompe una descarga que hoy anda.
- **`hlsEngine`**: ningún material de Classroom pasa por ahí (D2).
- **El contrato del backend** (`docs/deployment.md`): nada de los cortes 1–3 lo necesita.

---

## 7. Riesgos conocidos

- **Un 403 de Drive es por archivo, no sistémico.** Si el docente deshabilitó la descarga, ese
  archivo da 403 y los demás no. Hoy la rama del adjunto trata **todo** 403 como `"bloqueo"`
  (`procesadorCola.ts:474`, "la firma vencida"), que **pausa la cola entera**. Para Drive eso
  está mal: tiene que ser `"rechazo"` del ítem. Es la regla por-clase contra sistémica de
  `AGENTS.md` §Execution contexts (la clasificación de fallos del bucle), y es el tipo de defecto
  que ningún test ve si el plan no lo nombra.
- **El aviso de archivos grandes.** Arriba de cierto peso, Drive devuelve una página HTML ("no se
  puede analizar en busca de virus") en vez de bytes. Si no se detecta, al backend llega un
  archivo de KB **sin error en ningún lado**: el mismo modo de falla que el master HLS de
  `AGENTS.md` §Execution contexts. M0 lo detecta (`esHtml`).
- **Varias cuentas de Google en el mismo navegador — confirmado en C1 (2026-09-12)**: el curso
  del dueño vive en `/u/2/`. Las cookies son de todas; el prefijo `/u/<n>/` elige una, y del lado
  de Drive la elige `authuser=<n>`. El adaptador tiene que llevar esa cuenta desde la pestaña
  hasta el SW. Si el SW baja con la cuenta equivocada, el síntoma es un 403 que parece
  permiso denegado. C1 y M0 tienen que hacerse con la cuenta del curso **no** en `/u/0/`, si tenés
  más de una.
- **La lista puede ser perezosa** (SPA): C1 se guarda después de scrollear hasta el final, y
  conviene una segunda captura sin scrollear para comparar.

---

## 8. Resultados de la medición

Evidencia en `docs/muestras/google-classroom/click/` (gitignorada). Curso medido: 7 temas, 16
ítems, cuenta `/u/2/`.

### M0 ✅ (2026-09-12) — el service worker manda las cookies

Cinco archivos del curso (cuatro PDF y un JPG, de 22 KB a 2,4 MB), cada uno pedido tres veces:

| Pedido | Respuesta, idéntica en los cinco |
|---|---|
| `include` + `authuser=2` | **206**, bytes reales, `Content-Range: bytes 0-1023/<total>`, `Accept-Ranges: bytes`, `Content-Disposition: attachment; filename="…"` |
| `include` sin `authuser` | **403** + una página HTML de 1659 B: la cuenta 0, que no es la del curso |
| `omit` | **401** → `accounts.google.com/ServiceLogin` |

Lo que se sigue de esa tabla:

- **`authuser` es obligatorio.** Y el `href` de cada adjunto ya lo trae
  (`drive.google.com/file/d/<id>/view?usp=…&authuser=2`), así que el escaneo lo cosecha del
  propio enlace, sin interpretar la URL de la pestaña.
- **El 403 sin `authuser` es sistémico** (le pega a toda la cola), así que para *ese* caso el
  `"bloqueo"` de `procesadorCola.ts:474` es correcto. El 403 **por archivo** —descarga
  deshabilitada por el docente— sigue sin medir: ningún archivo del curso la tiene. §7 sigue
  abierto.
- **El tipo no sale del header**: los PDF llegan como `application/octet-stream`. El nombre sí:
  `Content-Disposition` coincide con lo que muestra el escaneo (`repaso-conceptual-2026.pdf` en
  los dos).
- **Hay rangos**: leer por bloques y reanudar es posible. Es el insumo del corte 3.
- **El aviso de archivos grandes no se midió**: el más grande pesa 2,4 MB.

### C1 ✅ (2026-09-12) — la página de "Trabajo en clase"

- **Las vistas se apilan.** El DOM guarda las que ya visitaste: hay tres `body > c-wiz`
  (Trabajo en clase, Novedades y el detalle de un material). Las ocultas llevan
  `aria-hidden="true"` y `display:none`; la activa, ninguno de los dos. Las ocultas suman **13
  enlaces `/file/d/` de más** (7 y 6) → el scraper se acota a
  `body > c-wiz:not([aria-hidden="true"])`.
- **Temas**: los `h2` de la vista activa. "Sin tema" es un `h2` real; no hay que inventarlo.
- **Ítems**: `li[data-stream-item-id][data-expandable-row-id]`, uno por material o tarea (16, ids
  únicos). El botón que lo abre es `div[role="button"][aria-expanded]`, y su `aria-label` es el
  título. La página de detalle es `a[href$="/details"]`.
- **Adjuntos**: `div[data-attachment-id]` > `a[aria-label][href*="/file/d/"]`. **Hay dos `<a>`
  por adjunto** → se deduplica por `data-attachment-id`, no por enlace.
- ⚠️ **Los adjuntos son perezosos.** 9 de los 16 ítems no tienen sus adjuntos en el DOM: sólo
  aparecen en los que se abrieron alguna vez, y quedan después de plegarlos. Un escaneo que no
  abre cada ítem pierde la mayoría, **sin error**. → D8, M1.
- ⚠️ **El `aria-label` está traducido**: `"Archivo adjunto: PDF: <nombre>"`,
  `"Archivo adjunto: Microsoft Word: <nombre>"`. No anclar a esas palabras: el nombre es lo que
  sigue al **segundo** `": "`.
- ⚠️ **Los títulos se repiten si no se distinguen mayúsculas**: "clase 13" y "Clase 13", en el
  mismo tema y con ids distintos. El título del material **no** es identidad (ADR-0014; patrón 1
  de `AGENTS.md`). M1 encontró además un choque en los nombres de **archivo**.
- **El listado es chico**: 4 vueltas de scroll.

### M1 ✅ (2026-09-12) — abrir cada ítem desde la pestaña

Sonda v0.0.3 (`click/c1-trabajo-en-clase-expandido.*`).

- **Funciona con `click()`**: se abrieron **21 de 21** ítems sin adjuntos. Ninguno necesitó
  `Enter` y ninguno navegó. Tardó entre 515 y 1560 ms por ítem (mediana 559; 14,6 s en total).
  → D8 confirmada. `topeEscaneoMs` se dimensiona con esos números en el plan.
- **El curso real tiene 27 ítems y 71 adjuntos**: 44 PDF, 16 videos, 9 imágenes, 1 Excel y 1
  Word. Todos son `drive.google.com/file/d/<id>/view` y todos llevan `authuser=2`. Este curso no
  tiene Docs nativos ni YouTube.
- ⚠️ **La lista se cortó sin avisar en C1.** Con el mismo scroll, C1 vio 16 ítems y M1 vio 27:
  faltaban 11 de "Presentaciones teóricas" (10 de 21).
  - No había botón "Ver más", y los temas estaban `aria-expanded="true"` en las dos capturas: la
    lista se seguía pintando, y "alto quieto 3 × 1,2 s" no alcanza para dar la carga por
    terminada.
  - Los ítems viven en `div[role="region"][data-topic-id]` > `ol`.
  - **Causa, medida en M3**: cada tema muestra 10 ítems y su botón "Ver más" carga el resto.
    Esperar a que la página se quede quieta no lo cubre. El M1 de 27 ítems se tomó después de que
    el dueño apretara ese botón.
- ⚠️ **Hay un choque de nombres real**: `interferencia2025.pdf` está en "clase 18" y en "Clases de
  óptica física", del mismo tema, y **son archivos de Drive distintos**. En una misma carpeta,
  uno pisaría al otro; además comparten la clave de ADR-0014. El dueño guardó una sola copia.
- ⚠️ **"Ya descargado" no reconoce un nombre saneado.**
  - `popup.js:1508` compara `clase.titulo` en minúsculas con los nombres del disco, pero el
    backend guarda el nombre que pasó por `sanitizarNombreArchivo` (`backend/utils.js:8`, vía
    `handlers.js:278`).
  - Ejemplo: `27 abr 2026 a la(s) 5:36 p.m..jpg` queda en disco como `…5_36_p.m..jpg`, porque se
    reemplazan el `:` y un espacio fino U+202F. Esa imagen se volvería a bajar en cada sesión (1
    de 71 en este curso).
  - Además, el `includes` de `popup.js:1512` da `a.pdf` por bajado si existe `tabla.pdf`.
  - **Esto ya puede morder a los adjuntos de Anatomy en `main`**: es hallazgo para
    `TECHNICAL_DEBT.md`.
- **Ningún archivo de Drive está en dos ítems a la vez** (0 de 71 ids).

### M2 ✅ en los activos (2026-09-12) — el recorrido de los cursos

Sonda v0.0.4, desde la página principal (`/u/2/h/st`).

- **Hay 8 cursos**: 6 activos y 2 archivados, `Fisica_II_G25_2026` (Bianchi) y `MB5 2024`, que
  viven en `/u/2/h/archived`. Palacio es "Física II G22 2026 2do cuatrimestre".

| Curso | Trabajo en clase: ítems / adjuntos | Novedades: posts / adjuntos sólo ahí | Ya en U.N.L.P |
|---|---|---|---|
| Física II G22 2026 2C (Palacio) | 49 / 57 | 62 / 0 | 2 de 57 |
| 2026 - 2C - MC6 :: Mate C | 0 / 0 | 2 / 0 | — |
| MC4 1S 2026 | 6 / 6 | 33 / 7 | 0 de 12 |
| MC2 2025 | 14 / 14 | 40 / 11 | 1 de 23, en `Matematica C/` |
| Física I-Grupo G-Ing 2024 | 80 / 127 | 123 / 1 | 9 de 107, en `Fisica 1/parciales/…` y `teorias/` |
| Q5 Primer Cuatrimestre 2023 | 0 / 0 | 21 / 0 | — |

- **Abrir los ítems funciona en todos los cursos**: 145 con adjuntos, 4 sin adjuntos y 0
  vencidos. Mediana ~555 ms por ítem, máximo 1910 ms.
- ❌ **M1b, retirada por M3.** Acá decía que la espera nueva alcanzaba, porque dos capturas de
  Física II G22 dieron lo mismo (49 ítems, 57 adjuntos, mismos ids). Pero ningún tema de ese curso
  pasa de 10 ítems, así que la repetición no probaba nada: el curso de Bianchi, recorrido con la
  misma espera, volvió a dar 10 de 21 en "Presentaciones teóricas".
- ⚠️ **Novedades trae material que no está en "Trabajo en clase"**: 19 adjuntos → D11.
- ⚠️ **Nombres repetidos otra vez**: el `template.docx` de Física I está en 5 materiales, con 5
  ids de Drive distintos → D12.
- **Lo que no es archivo**, todo en Física I: 8 videos de YouTube
  (`www.youtube.com/watch?v=…&authuser=2`) y 16 vínculos (simulaciones de PhET y GeoGebra, sitios
  de cátedra, `forms.gle`) → acceso, D10.
- ⚠️ **Un curso vacío hace esperar 20 s**: `esperaInicialMs` dio 20181 en MC6 y 20279 en Q5,
  porque la espera "hasta que haya ítems" no distingue un curso vacío de uno lento. El escaneo
  necesita reconocer el estado vacío.
- **Fuera de Bianchi, lo que ya está en U.N.L.P es poco, y está en carpetas que no salen del tema**
  (`Fisica 1/parciales/mod 1/2023-09-28/`, `Matematica C/`). El mapeo lo elige el dueño; no se
  adivina (D9).
- ⚠️ **La sonda v0.0.4 falla en "Clases archivadas"**: lista también los cursos del menú lateral y
  vuelve a recorrer los activos. Además, el recorrido se detuvo después del primer curso, por una
  causa que no se midió. → v0.0.5.

### Recorridos 2 y 3 (2026-09-12) — la pestaña oculta, los archivados y el "Ver más"

Sondas v0.0.6 y v0.0.7, que ya recorren los archivados en la misma corrida y guardan todo por el
servidor Bun sin interacción. Evidencia en `recorrido-2-pestana-oculta/` y en el recorrido 3.

- ⚠️ **Con la pestaña en segundo plano, Classroom no pinta.**
  - Recorrido 2, con el dueño usando otras pestañas: **17 de 18 vistas vacías**, con 0
    `data-stream-item-id` en el HTML, la espera de 20 s agotada y el título de la pestaña sin el
    nombre del curso.
  - Recorrido 3, con la pestaña al frente: todo pintado, y los 6 activos idénticos al recorrido 1.
  - **Qué implica para el escaneo**: tiene que correr con la pestaña del portal visible. Que el
    escaneo se lance desde el popup abierto sobre esa pestaña lo garantiza al empezar, no durante.
    El plan lo tiene que nombrar.
- **Los archivados**:

| Curso | Trabajo en clase: ítems / adjuntos | Novedades: posts / adjuntos sólo ahí | Ya en U.N.L.P |
|---|---|---|---|
| Fisica_II_G25_2026 (Bianchi) | 16 / 42 — **cortado**, M1 vio 27 / 71 | 66 / 28 (16 imágenes, 10 PDF, 2 vínculos: uno es un Meet) | 23 de 68: `Practicas/` 16, `Teorias/Bianchi/` 6, raíz 1 |
| MB5 2024 | 3 / 19 | 23 / 5 | 1 de 24, y es falso (está en `Informatica/Programacion 1/`) |

- ⚠️ **"Ver más" por tema.** Medido con jsdom sobre las capturas:
  - Cada región de tema (`div[role="region"][aria-label="Tema …"]`) tiene, **fuera de los
    ítems**, un `button[aria-label="Ver más publicaciones"]` que muestra el texto "Ver más".
  - **Está en todos los temas**, también en los de un ítem, así que su presencia no dice nada.
  - En M1, el de "Presentaciones teóricas" (21 ítems, todo cargado) tiene `disabled=""`. En el
    recorrido 3 (10 ítems) no lo tiene.
  - Los temas de un ítem tampoco lo tienen deshabilitado. Probablemente Classroom lo oculta por
    CSS, algo que jsdom no ve.
  - **Cursos en riesgo**: Física I tiene 3 temas con exactamente 10 ítems ("Clases
    teóricas-Módulo II", "Ejercicios resueltos - Módulo II", "Links-Módulo I"). En Palacio ningún
    tema pasa de 8.
- ⚠️ **El cruce por nombre "parecido" da falsos positivos**: uno en Palacio (en
  `Informatica/Programacion 2/`) y el de MB5. El "ya descargado" de D9 compara por igualdad
  exacta dentro de la carpeta mapeada, nunca buscando por todo el árbol.

### M3 ✅ (2026-09-12) — la señal del "Ver más"

Sonda v0.0.8, sólo "Trabajo en clase". La pestaña estuvo visible de principio a fin en los 8
cursos (`visibilidad: ["visible","visible"]`). Evidencia en `recorrido-4-vermas/`.

- **Botón visible = hay más ítems.** Estuvo visible en exactamente 2 de 38 temas: "Presentaciones
  teóricas" de Bianchi (10) y "Links-Módulo I" de Física I (10). En los otros 36 estaba oculto, y
  apretarlo no sumó ningún ítem en 3 s.
- **`disabled` = cargando.** Al apretarlo quedó `disabled` en 0 ms; la sonda, que cortaba ahí,
  midió 10 → 10. Los ítems llegaron después:
  - Bianchi pasó de 16 a 26 ítems (de 42 a 70 adjuntos);
  - Física I pasó de 80 a 83 (de 127 a 129).
- **Classroom pagina de a 10.**
  - Al final de la captura, "Presentaciones teóricas" tiene 20 ítems y su botón **se volvió a
    habilitar**. El que falta contra M1 es "Clase 8", el 21 y último.
  - "Links-Módulo I" terminó en 13 con el botón deshabilitado: ahí ya no hay más.
- **Totales completos**:
  - Bianchi: 27 ítems y 71 adjuntos (los de M1, con el segundo click hecho a mano);
  - Física I: 83 ítems y 129 adjuntos;
  - los otros 6 cursos no cambian.
- → D13.

### M4 ✅ (2026-09-12) — pasar de "Trabajo en clase" a "Novedades" no recarga la página

Sonda v0.0.9 (`m4-navegacion.json`), sobre Física II G22. Desde "Trabajo en clase", el script
inyectado clickeó el link del menú del curso (`nav a[href="/u/2/c/<id>"]`) y después volvió por
`nav a[href="/u/2/w/<id>/t/all"]`.

- **Es navegación interna de la aplicación**: una marca puesta en `window` sobrevivió a los dos
  pasos (`marcaSigue: true`), la inyección no murió, la URL cambió y siguió habiendo 3 vistas
  apiladas.
- **Es rápida**: la vista nueva quedó pintada en 350 ms al ir y en 412 ms al volver.
- **Cada vista se reconoce por su `jsrenderer`**: `BZWw5b` es "Trabajo en clase" y `BZn5fd` es
  "Novedades". Al llegar, Novedades mostraba 36 `data-stream-item-id`; el resto carga con el
  scroll, como ya había medido M2.
- → **El escaneo lee las dos vistas en UNA sola inyección.** El popup no tiene que orquestar dos,
  y su núcleo (`popup.js`, ADR-0005) no se toca para esto.

### Verificación B (2026-09-12) — la sonda de conexión choca con CORP

Medido en Brave con sesión activa en la cuenta `/u/2/`. El escaneo terminaba y guardaba los 57
enlaces de Física II G22 en storage, pero la lista no se mostraba en pantalla: la tarjeta
**"No se pudo contactar el sitio"** ocupaba la región por `internet=false`.

- **Hechos medidos en la consola del popup:**
  - En cada latido, `HEAD https://classroom.google.com/` fallaba con
    `net::ERR_BLOCKED_BY_RESPONSE.NotSameSite 200 (OK)` → `🔌 [Conexion] estado → servidor=true internet=false`.
  - **La causa es `Cross-Origin-Resource-Policy: same-site`.** Con sesión, la raíz de Classroom
    responde 200 con ese encabezado. La extensión (`chrome-extension://`), al tener permiso de
    host sobre el dominio, envía las cookies de sesión y recibe la respuesta autenticada con CORP;
    el navegador la bloquea por no ser same-site y el `fetch` rechaza. `core/conexion/conexion.ts`
    interpreta cualquier rechazo como pérdida de internet.
  - **`https://classroom.google.com/favicon.ico` responde sin CORP.** Devuelve 404 básico y sin
    encabezado CORP; el daemon de conexión no inspecciona el código de estado, sólo la
    alcanzabilidad de red.
  - **Medir desde una pestaña mentía:** un `HEAD no-cors` ejecutado desde una página regular
    resuelve en <1 s porque el navegador no envía cookies de terceros, obteniendo una respuesta
    anónima sin CORP.
- **Qué se hizo:**
  - `sitio/google-classroom/config.ts`: `urlSondeoInternet` se fijó en
    `https://classroom.google.com/favicon.ico`.
  - `background.js:539`: la notificación de fallo sin pestaña abierta pasó a abrir `urlListado`
    en lugar de `urlSondeoInternet` (que en Classroom sería un 404).
- **Lección:** un `fetch` medido desde una pestaña **no** representa al de la extensión, que
  manda cookies y recibe otra respuesta.

### C3 (2026-09-13) — batchexecute: listado por tema y adjuntos por ítem

Medición sobre Física II G22 con dos HAR (el último, con todos los ítems abiertos, en
`docs/muestras/google-classroom/c3/g22.har`, gitignorado). El escaneo por `batchexecute` ES viable
para "Trabajo en clase", pero este corte no lo construye: se sigue leyendo el DOM (D8) y el
cambio de escaneo se evalúa en un corte aparte (D8 en §3 sigue vigente).

- **El HTML inicial no trae el listado.**
- **`dpT4Vd` (`hrcw.qr`)**: un pedido por tema, de a 10 ítems. Trae títulos, descripciones, ids de
  ítem y fechas, **sin** ids de Drive (13 respuestas, ~48 KB).
- **`t51ITc`**: un pedido **por ítem** (`[[<idItem>,[<idCurso>]]]`), que se dispara al abrirlo.
  Los 49 ítems pedidos están todos en el listado de `dpT4Vd`, y la unión de sus respuestas da
  **57 ids de Drive distintos** (el DOM mostró 56 adjuntos en Trabajo en clase). Cada adjunto
  trae nombre de archivo, id, tipo MIME (`application/pdf`, `…presentationml.presentation`,
  `video/mp4`) y URL de Drive. El `t51ITc` que sólo nombra el curso vuelve vacío.
- **`sLc6hf` (×49)** son comentarios (`hrq.cmt`), vacíos.
- **Tokens**: los tokens que exige el pedido están en la página: `WIZ_global_data` con `SNlM0e`
  (`at`), `FdrFJe` (`f.sid`) y `cfb2h` (`bl`, que cambia con cada versión de la app,
  `boq_apps-edu-classroom-ui_20260907…`). La máscara de campos del `f.req` es larga y sin contrato.
- **Sin medir**: Novedades, materiales YouTube/vínculo/formulario (G22 no tiene) y la paginación
  de `dpT4Vd` más allá de los 10 primeros.
- **Conclusión**: viable para Trabajo en clase; D8 (DOM) sigue vigente en el corte 1 y el escaneo
  por pedidos se evalúa en un corte aparte.

### Verificación B (2026-09-13) — re-escaneo al abrir y Explorar

Física II G22 trajo 57 enlaces ✅ en navegador. Destapó dos defectos abordados en
`docs/plan-classroom-corte-1-lista-guardada-y-explorar.md`:
1. **Re-escaneo al abrir**: el popup re-escaneaba incondicionalmente en cada apertura. En Classroom
   tarda minutos, por lo que se implementó `origenListado` en `AppState`, la compuerta
   `escanearOUsarGuardada()` y el botón 🔄 en la toolbar.
2. **Explorar en Linux**: el backend invocaba PowerShell; se implementó el selector nativo vía
   `xdg-desktop-portal` (`backend/elegirCarpetaLinux.py`).

### M5 (2026-09-13) — abrir todos los ítems de una

Medición en consola de Brave sobre Física II G22 ("Trabajo en clase"): con la página recién cargada
y los "Ver más" agotados, `click()` a los 49 botones con `aria-expanded="false"` en el mismo tick y
esperar 3 s de quietud en la cuenta de `[data-attachment-id]`:
- **5529 ms, 57 adjuntos, 49 de 49 ítems abiertos** (contra 56 de a uno con 800 ms entre clics,
  que tardaba 30 a 70 s). Classroom no cierra un ítem al abrir otro.
- Al abrir cada ítem, Classroom pide su detalle por `batchexecute` `t51ITc` (medición C3); abrir
  todos dispara esos ~49 pedidos a la vez y no perdió ninguno.
- **Consecuencia**: el paso 7 del scraper (`sitio/google-classroom/scraper.js`) abre todos los
  ítems plegados en el mismo tick y espera una sola vez a que resuelvan todos (`tiempos.abrirTodos`).

### Hidratación de adjuntos y señal del href (2026-09-21)

Medición sobre el placeholder de adjuntos a medio hidratar (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`):

- **El bundle de Classroom**: los textos de placeholder provienen de defaults internos del cliente web
  (capturados en `docs/muestras/google-classroom/c3/g22.har`):
  ```js
  _.Zi(a,5) ? (h=_.Zi(a,5), this.description=_.wkd(h)) : (vkd(), this.description="Desconocido");
  this.name || (this.name = "Archivo de Drive");
  ```
  Al estar localizados, los literales no son estables entre idiomas; la señal confiable es el **href**
  (`/file/d/` resuelto vs `drive.google.com/open?id=` sin resolver).

- **Barrido contra las 62 muestras HTML del repo** (`docs/muestras/google-classroom/**`, 8 cursos, Trabajo en clase + Novedades + recorridos):

| Métrica | Valor |
|---|---|
| Adjuntos (ids distintos) | **1004** |
| Sin ningún `a[aria-label][href]` adentro | **0** |
| Con todas sus anclas en `open?id=` | **0** |

- **Consecuencia**: la espera del paso 7 y 7b/9 exige que cada id de adjunto tenga al menos un ancla resuelta (`!/drive\.google\.com\/open\?id=/.test(href)`). Los que vencen el tope se descartan y se informan en `ResultadoEscaneo.adjuntosSinResolver`.

### Identidad del curso y fuentes del nombre (2026-09-21)

Medición sobre las 62 muestras HTML del repo ante el defecto de título desfasado (`docs/plan-classroom-corte-1-identidad-del-curso.md`):

- **Las cuatro fuentes posibles del nombre:**

| Fuente | Exactitud | Cobertura |
|---|---|---|
| `document.title` | **se desfasa** (es el defecto) y a veces es genérico: `"Trabajo en clase"` / `"Novedades"` en 15 muestras | siempre presente |
| `a[aria-current="page"][href*="/c/<id>"]` → `aria-label` | **exacta**: en 12/12 muestras con ancla, idéntica carácter por carácter al nombre que hoy sale del title | falta en los 2 cursos **archivados** (G25, MB5) y con la pestaña oculta (3/18 en `recorrido-2`) |
| texto de un `a[href$="/c/<id>"]` dentro de `<h1>` (header) | el confirmante es el ancla dentro del `<h1>`: el nombre viene **partido en varios nodos**, así que `textContent` lo devuelve **sin espacios** (`"Física II G22 2026 2do cuatrimestreFacultad…"`) y sólo sirve normalizado | presente también en archivados |
| `span#UGb2Qe` | **abreviado** (`"Q5"` en vez de `"Q5 Primer Cuatrimestre 2023"`) | falta en 19 muestras |

- **Validación del title contra el DOM:**
  Comparando el title-derivado con el texto de las anclas a `/c/<idCurso>` normalizado (NFKD, sin espacios, minúsculas), sobre las 45 muestras de curso:
  - **37 validan**
  - **0 contradicen**
  - **15 sin ninguna fuente para validar** (exactamente las de title genérico como `"Trabajo en clase"` o `"Novedades"`, donde no se debe confiar en el title).
  - *Nota sobre los números*: el barrido del 2026-09-22 atribuye `idCurso` por el id más frecuente en hrefs `/c/<id>/m/` con `/w/<id>/t/all` de respaldo (41 muestras de curso en vez de 45; 40 validan, 0 contradicen, 1 sin curso que es la portada).
  - **Confirmación por ancla en `<h1>` (2026-09-22)**: la regla anterior descartaba textos coincidentes con links de vista obtenidos vía `buscarLinkNav`, pero `buscarLinkNav` devuelve la primera `nav a[href]` coincidente y en el DOM real ésa es justamente el encabezado del curso (`h1 a[href]`), eliminando la única fuente que podía confirmar (dejaba G25 y MB5 sin poder escanearse). En su lugar, el confirmante pasa a ser estrictamente el ancla al curso actual dentro del `<h1>`: en el barrido del 2026-09-22 existe en 40/41 muestras de curso, es única en todas, confirma en 40/40 y contradice en 0, excluyendo las pestañas de vista por no vivir en un `<h1>`.

- **Consecuencia**: en cursos activos el nombre sale del sidebar (`aria-label`) validado por idCurso (12/12 idéntico al title sin desfasar, conservando la identidad del ítem). En archivados, sale del title sólo si el DOM lo confirma (mediante el ancla dentro del `<h1>`). Si no se puede confirmar, se aborta con aviso para no mezclar archivos entre cursos.

---

## 9. Registro del corte 1 (rama `classroom-corte-1`, mergeada el 2026-09-25)

Mudado tal cual desde `docs/ramas-en-revision.md` al mergear. Describe el estado **de cada fecha**:
los números y líneas que cita no se corrigen hacia atrás. Qué se verificó en navegador al cerrar →
`docs/ramas-en-revision.md` §Lo último que se mergeó.

- **Qué trae**: el tercer portal, Google Classroom. Escanea un curso entero y baja sus archivos
  de Drive a `raíz/google-classroom/<curso>/`; los videos, YouTube y los vínculos quedan como
  `.md` con el link.
  - Plan: `docs/plan-classroom-corte-1.md`.
  - Diseño y mediciones: `docs/portal-google-classroom-diseno.md`.
- **Estado**: código completo (Pasos 1 a 8). Verificación A en verde **desde el 2026-09-12 a la
  noche**: el informe de ejecución la daba en verde con 33 tests en rojo, preexistentes en `main`.
  **Verificación B frenada** en el paso 2: el escaneo termina y guarda, pero la lista no se ve.
  - Arreglado ya (correcciones puntuales, sin plan):
    - `sitio/anatomy-by-chris/scraper.test.js`: Node >= 25 tapaba el `localStorage` de jsdom.
    - `sitio/google-classroom/scraper.js:19`: método abreviado → `async function`. `executeScript`
      no lo podía inyectar (`SyntaxError`); los tests no lo ven.
  - **Hecho** (`docs/plan-classroom-corte-1-verificacion-b.md`):
    - Paso 1: sonda de Classroom a `/favicon.ico` (`sitio/google-classroom/config.ts`).
    - Paso 2: notificación de fallo abre `urlListado` (`background.js:539`, `core/puertos/sitio.ts`).
    - Paso 3: test de serialización de escaneos inyectados (`sitio/inyeccion.test.js`, +4 tests).
    - Paso 4: docs actualizados; Verificación A en verde con 42 archivos, 706 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-lista-guardada-y-explorar.md`):
    - Paso 1: decisión pura al abrir (`core/estado/origenListado.ts`, +7 tests).
    - Paso 2: puerto y descriptor con `claveDeListado` (`core/puertos/sitio.ts`, `sitio/google-classroom/config.ts`, +1 test en `sitio/registro.test.ts`).
    - Paso 3: `AppState.origenListado` persistido y reseteado en sesión (`core/estado/appState.ts`, +1 test en `appState.test.ts`).
    - Paso 4: compuerta `escanearOUsarGuardada()` en 4 disparadores automáticos y guardado de origen en `popup.js`.
    - Paso 5: botón 🔄 en la toolbar de Disponibles (`entrypoints/popup/index.html`, `popup.js`, `popup/features/filters.js`).
    - Paso 6: selector nativo de carpetas en Linux vía `xdg-desktop-portal` (`backend/elegirCarpetaLinux.py`, `backend/handlers.js`).
    - Paso 7: docs actualizados; Verificación A en verde con 43 archivos, 715 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-abrir-todos.md`):
    - Paso 1: el paso 7 de `sitio/google-classroom/scraper.js` abre todos los ítems plegados en el mismo tick y espera una sola vez (`abrirTodos`).
    - Paso 2: test 11 en `sitio/google-classroom/scraper.test.js` con apertura paralela y contraste con código secuencial anterior (+1 test).
    - Paso 3: docs actualizados; Verificación A en verde con 43 archivos, 716 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`):
    - Paso 1: el escaneo espera adjuntos resueltos (`open?id=` vs `/file/d/`) en Trabajo en clase y Novedades, descarta los no resueltos y expone el conteo (`sitio/google-classroom/scraper.js`).
    - Paso 2: `ResultadoEscaneo.adjuntosSinResolver?` declarado en el puerto (`core/puertos/sitio.ts`).
    - Paso 3: `popup.js` captura `adjuntosSinResolverUltimoEscaneo` y alimenta `ctx.nota` en el view-model.
    - Paso 4: `listaClases.preact.js` renderiza `p.lista-nota` arriba de las filas dentro de `modo:'lista'`.
    - Paso 5: regla `.lista-nota` en `styles/list.css` con variables de acento naranja.
    - Paso 6: tests nuevos (+2 en `scraper.test.js`, +1 en `listaClases.preact.test.js`).
    - Paso 7: docs actualizados; Verificación A en verde con 43 archivos, 719 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-identidad-del-curso.md`):
    - Paso 1: `sitio/google-classroom/scraper.js` resuelve identidad por sidebar (`aria-label`) validado por idCurso en activos y por `<title>` confirmado por el DOM en archivados; cinturones de URL e ítems contra cambio de curso a mitad de escaneo.
    - Paso 2: fixture `sitio/google-classroom/__fixtures__/curso.html` incorpora el ancla del sidebar del curso activo.
    - Paso 3: tests 14–17 en `sitio/google-classroom/scraper.test.js` (+4 tests; control negativo del test 14 verificado contra `29d7919`).
    - Paso 4: docs actualizados; Verificación A en verde con 43 archivos, 723 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-identidad-en-archivados.md`):
    - Paso 1: `sitio/google-classroom/scraper.js` confirma identidad en archivados con el ancla al curso dentro del `<h1>` (v1.3.1), descartando el filtro por links de vista que eliminaba al propio encabezado.
    - Paso 2: fixture `sitio/google-classroom/__fixtures__/curso.html` refleja el DOM real con encabezado en `<h1>`.
    - Paso 3: test 15 prueba el mecanismo real y test 18 (+1 test) verifica que un ancla fuera del `<h1>` no confirma el title en `sitio/google-classroom/scraper.test.js`.
    - Paso 4: docs actualizados; Verificación A en verde con 43 archivos, 724 tests.
    - **Re-verificado de forma independiente (2026-09-22)**, no por el informe de ejecución:
      compuerta **43 archivos / 724 tests**, lint 0/0, `tsc` limpio, build OK, y
      `sitio/google-classroom/scraper.test.js` en **18 tests / 18 pasan**. Y re-simulando
      `resolverIdentidadCurso` v1.3.1 sobre las 62 muestras: las **11 muestras de curso archivado**
      (G25, MB5, `c1`, `click/`) que antes abortaban ahora resuelven por `titulo-validado`, y
      **ninguna** de las 55 muestras de curso resuelve con un nombre equivocado. El ancla al curso
      dentro del `<h1>` está en **40/55**, es **única** en las 40, vive dentro del `<nav>` en 40/40 y
      **contradice el title en 0**. Las 15 sin ancla son **todas** de `recorrido-2-pestana-oculta`,
      con title genérico (`Novedades` / `Trabajo en clase`): el cinturón de visibilidad las corta
      antes de llegar a la identidad (`scraper.js:421`), así que no son un camino alcanzable.
    - **`buscarLinkNav` no quedó muerta** tras el arreglo: la usan los tres pasos de navegación
      (`:289`, `:496`, `:576`). Medido, no asumido: en **40/40** muestras la primera `nav a[href]`
      que matchea `regexNovedades` es el ancla del `<h1>`, **nunca** la pestaña — pero su `href` es
      el mismo `/u/<n>/c/<idCurso>`, así que el paso 9 navega igual. `regexTrabajo` (`/w/…/t/all`)
      no matchea el encabezado, así que los pasos 3 y 10 toman la pestaña real.
    - **El fixture es fiel en lo que los selectores miran**: el DOM real es
      `nav > div > div > div > h1 > a` y el fixture `nav > h1 > a`; como `h1 a[href]` y
      `nav a[href]` son selectores de descendiente, los `div` intermedios no cambian nada.
- **Lo que no trae**: el mapeo a la carpeta del dueño (`U.N.L.P/`). Es el corte 2.

### Checklist de Verificación B (en navegador)

**Antes de empezar:**
- Levantar el backend: `cd backend && bun run server.js`
  - Si ya había uno corriendo, **reiniciarlo**: Bun no recarga `backend/`, y uno arrancado antes de `4623593` sigue lanzando `powershell` en Linux (Explorar no abre nada).
- `pnpm run build` y recargar la extensión desde `.output/chrome-mv3/`
- Usar la cuenta del curso de Google (`/u/2/`)
- Dejar la pestaña al frente durante cada escaneo

1. [ ] **Arranque**: el service worker arranca sin excepciones y el popup renderiza completo (`docs/rearquitectura-diseno.md` §Verificación en navegador, puntos 5 y 6).
   - **Si el primer escaneo de G22 tarda ~30 s, no es un cuelgue**: el paso 7 nuevo (`abrirTodos`, `38ddd5b`) espera también los `li` sin botón, que el paso 7 viejo salteaba. Anotá el tiempo igual: el plan de abrir-todos pide cronometrarlo.
2. [ ] **Escaneo curso por curso** (contrastar enlaces con los esperados del §8 del diseño):
   - [ ] Física II G22 (Palacio): 57 enlaces esperados
   - [ ] Física I 2024: 130 enlaces (129 Trabajo en clase + 1 sólo en Novedades)
   - [ ] Fisica_II_G25_2026 (Bianchi, archivado): 71 Trabajo en clase + hasta 28 en Novedades (si aparece la tarjeta «No pudimos confirmar de qué curso es esta lista», es el defecto del 2026-09-22 y el arreglo no está en el build)
   - [ ] MB5 2024: 24 enlaces (si aparece la tarjeta «No pudimos confirmar de qué curso es esta lista», es el defecto del 2026-09-22 y el arreglo no está en el build)
   - [ ] MC4 1S 2026: 13 enlaces
   - [ ] MC2 2025: 25 enlaces
   - [ ] MC6 y Q5: tarjeta "El escaneo no trajo clases" en segundos, sin esperar tope de 20 s
3. [ ] **Nombres repetidos**: en Física I, los 5 `informe de laboratorio fisica i 2024 (template)` aparecen con su material agregado; en Bianchi, los dos `interferencia2025` también.
4. [ ] **Pestaña oculta**: a mitad del escaneo de Física I, cambiar de pestaña. Aparece la tarjeta con aviso de visibilidad y la lista anterior se conserva en pantalla.
5. [ ] **Descarga** de 6 ítems y posterior re-sincronización de disco:
   - [ ] Un PDF en `raíz/google-classroom/<curso>/` con su nombre
   - [ ] Un video de Drive, uno de YouTube y un vínculo como `.md` funcionales
   - [ ] Imagen `27 abr 2026 a la(s) 5:36 p.m..jpg` de Bianchi
   - [ ] `MC4 2026  - Copia de P2F2.pdf` (conservando doble espacio)
   - [ ] Los 6 quedan marcados como descargados tras re-sincronizar
6. [ ] **Anatomy sigue igual**: bajar un PDF (funciona sin cookies) y comprobar que lo ya descargado sigue marcado como descargado.
7. [ ] **Aviso de fallo**: la notificación de un ítem de Classroom que falla enfoca la pestaña de Classroom, o si no hay ninguna abre `urlListado` (`background.js:539`, tras el plan de la verificación B).
8. [ ] **Primera apertura en Física II G22**: escanea (sin origen previo) y trae 57. Cerrar y reabrir el popup en la misma pestaña: la lista aparece al instante sin "Escaneando la pestaña…", y la pestaña de Classroom no se mueve a Novedades.
9. [ ] **Otro curso** (MC4 1S 2026): abrir el popup ahí escanea solo y trae 13. Volver a G22 y abrir: escanea de nuevo (se guarda una sola lista).
10. [ ] **🔄**: visible en "Clases Disponibles" y oculto en "Fila de descarga"; en G22 con lista guardada fuerza el escaneo. Con backend caído queda deshabilitado. En Anatomy, abrir el popup sigue escaneando como antes.
11. [ ] **Explorar en Linux**: 📂 → diálogo nativo "Elegí la carpeta raíz de descargas". Cancelar conserva la ruta; elegir cambia la ruta y la consola del server loguea `📂 [DISCO] Nueva carpeta raiz establecida`. (Restaurar la ruta real al terminar).
12. [ ] **Adjuntos hidratados** (plan de adjuntos sin resolver, 2026-09-21): G22 con la pestaña al frente, Re-escanear 🔄 → 57 adjuntos y **ningún** archivo cuyo nombre empiece con `Archivo adjunto`; la nota `⚠️ … quedó afuera` **no** aparece arriba de la lista.
13. [ ] **Consola de la pestaña de Classroom** (no la del popup): con todo bien no hay ninguna línea `[CLASSROOM] Adjuntos sin resolver`. Si aparece, anotar los ids: son los que se descartaron.
14. [ ] **G25** (el curso con Novedades larga): la cuenta no bajó respecto de la Verificación B del 2026-09-16 (71 Trabajo en clase + hasta 28 en Novedades).
15. [ ] **Cambio de curso a mitad de escaneo**: arrancar el escaneo en un curso y navegar a otro antes de que termine. Esperado: card de aviso de cambio de curso y no se lista nada del curso anterior.

### Hallazgos de la Verificación B (2026-09-16 y 2026-09-21)

Entran al corte 1 **antes del merge** (decisión del dueño). El 🔴 de los adjuntos a medio hidratar quedó resuelto (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`, en la lista de Hecho arriba), el 🔴 de identidad del curso quedó resuelto (`docs/plan-classroom-corte-1-identidad-del-curso.md`, en la lista de Hecho arriba), el 🔴 de identidad en **cursos archivados** quedó resuelto (`docs/plan-classroom-corte-1-identidad-en-archivados.md`, en la lista de Hecho arriba) y el 🟡 no entra a ninguno hasta que M-6c lo reproduzca.

- 🔴 **El listado se etiqueta con el curso equivocado y los archivos van a la carpeta de otro curso.**
  CONFIRMADO en disco el 2026-09-21. RESUELTO con `docs/plan-classroom-corte-1-identidad-del-curso.md`. `sitio/google-classroom/scraper.js:80-87` leía el nombre del curso de
  `document.title` una vez al arrancar y `:571` lo estampaba en el `modulo` de todos los ítems; en una SPA el
  título se sincroniza **después** de la URL y del contenido, y `popup.js:789` dispara el escaneo en
  `tabs.onUpdated` con `status === 'complete'`, que llega antes.
  - **Evidencia**: `~/Descargas/verificacion-b/google-classroom/2026_2c_mc6_mate_c/` (carpeta de MC6) tenía
    **81 archivos md5-idénticos** a 81 de los 82 de la carpeta de G22, y 0 propios. En el storage esos ítems
    quedaron con `modulo = "2026 - 2C - MC6 :: Mate C › <tema de G22>"`, mientras `origenListado.clave` era
    `ODc0ODk1NDcwNTMw`, el **idCurso de G22** (46 hrefs `/c/ODc0…/m/` en su muestra). O sea: URL, DOM y
    adjuntos de G22; sólo el título decía MC6. La carpeta se borró tras confirmar los 81 duplicados.
  - **La cola no tiene la culpa**: `ItemCola.carpeta` viaja con el ítem (`core/cola/procesadorCola.ts:172`,
    `:808`) y el destino se calcula al escanear (`popup.js:1466` → `parserTitulos.js:17-24`). Los 18 ítems
    que ya estaban bajando cuando el dueño cambió de curso fueron a la carpeta correcta.
  - **No lo introdujo** el plan de adjuntos sin resolver: el título se lee así desde `v1.0.0` del scraper.
    Lo que sí hizo ese plan es agrandar la ventana del escaneo (hasta ~50 s), que es el otro camino al
    mismo defecto (cambiar de curso a mitad de escaneo).
  - **Decisiones del dueño (2026-09-21)**: el nombre sale del sidebar validado por idCurso, el title sólo
    si el DOM lo confirma; si no se puede confirmar, esperar y reintentar y después **abortar con aviso**
    sin listar nada.
  - **Plan ejecutado**: `docs/plan-classroom-corte-1-identidad-del-curso.md` (2026-09-21), con
    las cuatro fuentes medidas y la validación contra las 62 muestras (37 validan, **0 contradicen**, 15 sin
    fuente y son justo las de title genérico). Verificación A en verde con 43 archivos, 723 tests.

- 🔴 **Los dos cursos archivados (G25 y MB5) no se pueden escanear: la identidad del curso nunca se
  confirma.** RESUELTO con `docs/plan-classroom-corte-1-identidad-en-archivados.md`. Rompía el escaneo
  en G25 y MB5 devolviendo tarjeta de aviso sin listar nada. Detectado el 2026-09-22 por barrido de las
  62 muestras simulando `resolverIdentidadCurso` (7/7 archivados abortaban porque `buscarLinkNav`
  descartaba el encabezado del curso) antes de tocar el navegador. Arreglado confirmando el title
  exclusivamente contra el ancla al curso dentro del `<h1>` (40/41 presencia, 40/40 valida, 0 contradice).
  - **Qué se ve**: en G25 y MB5 el escaneo espera 8 s (`tiempos.identidadCurso`) y devuelve la tarjeta
    "No pudimos confirmar de qué curso es esta lista, así que no se muestra nada". No lista nada. Son
    2 de los 8 cursos, y los únicos cuyos totales de la checklist siguen firmes (G25 = 71, MB5 = 24),
    así que el **paso 2 de la Verificación B** habría fallado en ellos.
  - **Causa**: `sitio/google-classroom/scraper.js:153-163` descarta el candidato del `<title>` si su
    texto coincide con el del ancla que devuelve `buscarLinkNav(regexNovedadesVista)`, y `buscarLinkNav`
    (`:113`) devuelve **la primera** `nav a[href]` que coincide — que en el DOM real **no** es la
    pestaña "Novedades" sino el **encabezado del curso** (el `<a>` dentro del `<h1>`), cuyo texto es el
    nombre del curso. El filtro eliminaba justo a la única fuente que podía confirmar.
  - **Evidencia** (barrido propio de las 62 muestras, simulando `resolverIdentidadCurso` con un
    `HTMLParser` con pila de ancestros): **7/7** muestras de curso archivado abortan (G25 ×5, MB5 ×2);
    en `recorrido-3/07-Fisica_II_G25_2026-trabajo.html` las anclas a `/u/2/c/Nzk0MDIyNDkyNDUx` son, en
    orden, la del `<h1>` con texto `Fisica_II_G25_2026`, la pestaña `Novedades` y la de Trabajo en clase.
  - **Los activos no se ven afectados**: resuelven por la rama (a), el sidebar (31/41 muestras lo
    tienen, con **0** `aria-label` que no sea el nombre del curso), y nunca llegan a la rama (b).
  - **Arreglo con evidencia**: el confirmante pasa a ser el ancla del curso dentro del `<h1>` — existe
    en 40 de las 41 muestras de curso, es **única** en todas, confirma el title en **40/40** y
    contradice en **0**; y excluye a las dos pestañas de vista sin mirarles el texto, que era todo lo
    que el filtro viejo buscaba. Medido: con el fixture fiel y **sin** el arreglo fallan exactamente
    los tests 15 y 18 (`Tests 2 failed | 16 passed (18)`); con el arreglo, `18 passed (18)`.

- 🟡 **Novedades: los adjuntos faltan en el disco, pero el escaneo NO falla. NO REPRODUCIDO — tercer
  diagnóstico, y los dos anteriores eran falsos.** No entra al plan hasta reproducirlo (M-6c).
  - **Lo que se creyó y es falso**: (1) "no pagina ni expande" — en Novedades no hay botón "Ver más
    publicaciones", la carga es por scroll; (2) "el stream no crece porque `buscarContenedorScroll()`
    elige mal el scroller" — M-6 lo niega.
  - **M-6 (2026-09-17, consola de Brave, G25 → Novedades)**: `buscarContenedorScroll()` (`scraper.js:102`)
    devuelve el `<html>`, que es exactamente `document.scrollingElement` y el **único** elemento que
    dispara `scroll`. Replicando el bucle de `esperarQuietud` tal cual (40 vueltas, 1500 ms, corte a 3
    estables): **40 → 237 posts en 6 vueltas, corta en la 9**, y con el scroller "real" da lo mismo.
    Reproduce clavada la sonda del 2026-09-12, cuyo registro es `76→237 en 6 vueltas` y cuyo HTML
    guardado tiene **237 `data-stream-item-id` y 28 `data-attachment-id`** — los mismos números.
  - **M-6b**: los 14 contenedores candidatos a "vista activa" (`[role="main"]`, `c-wiz`, `[jsname]`)
    ven **todos** el mismo stream que `document`. No hay vista vacía que corte el bucle antes.
  - **Los 26 adjuntos faltantes SÍ estaban en el DOM**: `Resumen_guia4.pdf` tiene
    `data-attachment-id="37014713914"` y su `<a aria-label="Archivo adjunto: PDF: …">`, que es
    literalmente lo que busca el selector de `scraper.js:387`.
  - **Tampoco se pierden en los filtros**: parseando el HTML de la sonda, los 28 adjuntos cuelgan de un
    `[data-stream-item-id]` externo (66 externos / 171 anidados), así que `itemsExternos` (línea 379) no
    descarta ninguno; y cruzando ids de Drive, Novedades y Trabajo en clase de G25 tienen **0 en común**,
    así que el dedup de la línea 418 tampoco.
  - **Evidencia del síntoma** (sigue siendo real): `Fisica_II_G25_2026` — 23 archivos del tema "Próximas"
    no están en el disco de la Verificación B: `Resumen_guia4/5/7/12.pdf`, `1parcial_2..6.jpg`,
    `Guia11_P4b/c/d.jpeg`, `Guia12_P4a/b.jpeg`, `Guia12_P9a/b/c.jpeg`, `P8a_guia5.jpeg`, `P9_guia4.pdf`,
    `P11_guia4.pdf`, `resultados-repaso-conceptual.pdf`, `Guia7_P6b/c.jpeg`. Son exactamente los 26 ids
    que sólo viven en Novedades, menos los 3 que sí bajaron.
  - **Ojo con la afirmación vieja "no llegan ni al storage"**: se escribió sin pegar la salida del storage.
    El storage actual (2026-09-17) no tiene esos nombres, pero corresponde a otro escaneo, así que **no
    prueba nada**. Tratarla como no verificada.
  - **M-6c — qué falta, y es lo único que decide**: re-escanear G25 con el build actual, con la pestaña al
    frente, y mirar el storage **inmediatamente después**. Si los 26 aparecen, el escaneo está bien y el
    defecto está aguas abajo (cola o descarga) o fue puntual de aquella corrida; si no aparecen, recién
    ahí hay un defecto de escaneo que perseguir, y habrá que instrumentar el paso 9 con logs.
    → Causa hallada el 2026-09-27: ver plan-classroom-novedades-scroll.md.

- ⚠️ **`MC4 1S 2026` desapareció de la portada del dueño** entre el 2026-09-12 y el 2026-09-16, así que no
  se bajó (esperaba 13). **No es un defecto de la extensión**: en `recorrido-3/00-partida.json` (2026-09-12)
  figura como curso activo, y en `00-archivadas.json` de ese día sólo estaban G25 y MB5. Candidato principal:
  el docente lo archivó al cerrar el 1er semestre → estaría en `/u/2/h/archived`. Si no está ahí, es baja o
  eliminación del curso.
  - **Toca el punto 9 de la checklist**, que usa MC4 como "otro curso" para probar que la lista guardada se
    invalida al cambiar de curso: si quedó archivado sirve igual, si no, reemplazarlo por MC2 o MB5.
  - **Toca la spec del corte 2**: no hay supuesto sobre qué hacer cuando un curso ya asociado deja de aparecer.
    El material bajado no debe tratarse como huérfano — es cuando la copia local pasa a ser la única.

- ⚪ **Los números esperados de la checklist vencieron para los cursos activos.** G22 ya no trae 57 sino ~63:
  entre el 2026-09-12 y el 2026-09-16 la cátedra publicó Clase 7, Clase 8 (×2), `Pract.6-Prob.P9`,
  `CC-Modelización de pilas y baterias` y el cronograma de la semana 14-9. Verificado contra `recorrido-3`.
  Los únicos totales que siguen firmes son los de los cursos **archivados**: G25 (71) y MB5 (24).

- ⚪ **D12 hace lo que dice, y por eso deja copias idénticas** (hallazgo para el corte 2, no defecto del 1).
  De 263 binarios hay 258 contenidos únicos: `Informe de laboratorio FISICA I 2024 (Template).docx` está
  **5 veces con md5 idéntico** (`cb5dc8da…`, el docente lo adjuntó en 5 ítems) e `interferencia2025.pdf`
  **2 veces** (`2653281d…`). El supuesto 20 de `docs/specs/classroom-destino/assumptions.md` cubre el choque
  entre dos cursos, pero no éste: mismo curso, mismo archivo, distinto material. Decidir en la spec si el
  desempate de D12 debe mirar el contenido antes de copiar.

- ✅ **Integridad de lo descargado** (verificada en disco, no por reporte): 53 PDF que son PDF de verdad,
  1 pptx real, 0 de tamaño nulo, ningún HTML de error disfrazado; el saneo `Nº`→`N_`, `#`→`_`, `,`→`_`
  se aplicó bien y los `.md` de acceso llevan el link correcto.

- ⚠️ **M-C — Marcador de "sin tema" prematuro en primera visita** (2026-09-27): en primera visita a Trabajo en clase, el marcador `[data-no-topic-items]` se renderiza antes de que lleguen los ítems reales; el escaneo espera a que se asiente (`asentadoVacio`, 2000 ms) sin ítems, progressbar ni "Ver más" para no dar por vacío un curso con material (detalle y tabla de mediciones en [`docs/plan-classroom-escanear-todas-correcciones.md`](./plan-classroom-escanear-todas-correcciones.md)).

## 10. Registro de escanear todos los cursos (rama `classroom-escanear-todas`, mergeada el 2026-09-27)

Mudado tal cual desde `docs/ramas-en-revision.md` al mergear. Describe el estado **de cada fecha**:
los números y líneas que cita no se corrigen hacia atrás. Qué se verificó en navegador al cerrar →
`docs/ramas-en-revision.md` §Lo último que se mergeó.

- **Qué trae**: escanear todos los cursos de Classroom desde la portada, en un solo recorrido
  que sobrevive a cerrar el popup.
  - Spec: `docs/specs/classroom-escanear-todas/spec.md`.
  - Plan: `docs/plan-classroom-escanear-todas.md`.
- **Hecho por paso**:
  - Paso 1: `ScraperClassroom` con `modo: "todos"`, cancelación entre cursos/latidos y emisión de eventos `recorrido_evento` vía `chrome.runtime.sendMessage`. 24 tests (el control negativo de 20 y 23 NO detecta: ver Revisión de tanda).
  - Paso 2: Contrato `PuertoSitio` v1.7.0 con `esPortada?`, config Classroom v1.3.0 (`claveDeListado: "todos"` en portada, instruccionEscaneo).
  - Paso 3: Módulo puro `core/estado/recorridoTodos.ts` (reductor, vigencia, resumen, enlacesDe) y lector `RecorridoTodos` exportado en `plataforma/composicion.ts`. 14 tests.
  - Paso 4: Manejador IPC `recorrido_evento` en `background.js` persistiendo en `storage.local.recorridoTodos`. 30 tests.
  - Paso 5: `decidirAlAbrir` v1.1.0 en `core/estado/origenListado.ts` con 5 filas y `"recorridoTodos"` en `CLAVES_DE_SESION`. 15 tests.
  - Paso 6: Orquestador `popup.js` v5.28.0 (lanzar, mirar, materializar recorrido multi-curso, cards de progreso/oferta/terminado-sin-material).
  - Paso 7: Lista agrupada por curso (`ctx.grupos`), estilos `.grupo-curso` y `.lista-nota: white-space: pre-line` en `styles/list.css`, isla `listaClases.preact.js` v1.4.0. 39 tests.
  - Paso 8: Revisión de copy en onboarding (slide 3).
  - Paso 9: Documentación (ADR-0016, README ADRs, `AGENTS.md`, `data-model.md`, `patterns.md`, `architecture.md`, `multisitio-diseno.md`, `portal-google-classroom-diseno.md`, `TECHNICAL_DEBT.md`, `testing.md`).
  - **Correcciones**: plan `plan-classroom-escanear-todas-correcciones.md` (2026-09-27): asentado de Trabajo en clase (Paso 1), espera de nav (Paso 2), espera de archivados y nombres limpios de anclas globales (Paso 3), cancelación por token idCancelacion y test 23 sensible a zombis (Paso 4), estado terminal en reductor (Paso 5), botón recorriendo oculto, desacople de oferta y guarda fila 1 (Paso 6). 44 archivos / 764 tests en verde.
  - **Loader con progreso**: plan `docs/plan-loader-con-progreso.md` (2026-09-27): Estado primero en el popover de filtros (Paso 1), núcleo puro de recorridoTodos y progresoEscaneo (Paso 2), scraper con eventos de progreso, duracionMs y vuelta a la portada con controles negativos verificados (Paso 3), isla del detalle del loader ui-loader-detalle con reloj, lista y pie (Paso 4), orquestador popup.js con sincronizarLoaderRecorrido, oyente escaneo_progreso y 20 s/curso (Paso 5), documentación y baseline actualizada (Paso 6). 46 archivos / 796 tests en verde.
- **Verificación B — en Brave, la hace el dueño**:
  - [x] 1. **M-1** — cerrado por tanda (2026-09-27) sin medir aparte: B-3 midió ~18 s/curso en el recorrido y el loader ya usa 20 s/curso; el 45 s quedó superado. Texto original: con el escaneo de un curso (como en `main`), cronometrar cada curso por separado. Si el promedio se aleja de 45 s, corregir texto en Paso 6f y NFR-1.
  - [x] 2. **AC-1** (dueño, 2026-09-27, tras las correcciones: "funciona perfecto"): Portada `/u/2/h`, abrir el popup: tarjeta "Todas mis clases", botón "Escanear todos los cursos", y la pestaña **no** se mueve.
  - [x] 3. **AC-2 / AC-8** (2026-09-27, leído del storage: `terminado`, 7 cursos, 5 ok + MC6/Q5 vacíos, 0 fallidos, G22 ok, nombres limpios; **~124 s en total ≈ 18 s/curso** — NFR-1 cumplido; la cantidad de ítems por curso no queda en storage, la confirmó el dueño a ojo): Apretar el botón con la pestaña al frente, esperar sin tocar. Al final: resumen con los cursos de hoy (5 activos + 2 archivados = 7), G25 con 71 de Trabajo en clase y MB5 con 24, un encabezado por curso con material, y MC6 y Q5 sin grupo, contados como vacíos. Cronometrar el total (NFR-1: menos de 6 min).
  - [x] 4. **AC-4**: Relanzar con 🔄. En el curso 2, cerrar el popup. A los 60 s, reabrirlo: progreso en un curso posterior. Al terminar, la lista está completa.
  - [x] 5. **AC-5**: A mitad del recorrido, abrir el popup (la pestaña está dentro de un curso): se ve el progreso y **no** aparece "Escaneando la pestaña…".
  - [x] 6. **AC-3** (dueño, 2026-09-27): Terminado el recorrido, entrar a MC2 y escanearla sola: mismos ítems y nombres que en su grupo.
  - [x] 7. **AC-6**: Relanzar y, en el curso 4, cambiar de pestaña. Volver y abrir el popup: resumen "Se cortó en el curso 4 de 7: Classroom quedó en segundo plano", con los 3 completos en la lista. Repetir haciendo click en otro curso del sidebar: "navegaste fuera del recorrido".
  - [ ] 8. **AC-9** (no verificable: 0 archivos en dos cursos → deuda ⚪): Si algún archivo de Drive está en dos cursos, aparece en los dos grupos, y bajarlo desde uno no lo marca en el otro.
  - [x] 9. **AC-10**: Bajar un PDF de G22 y uno de MC2: cada uno en `raíz/google-classroom/<curso>/`.
  - [x] 10. **AC-11**: Con la lista de todos, entrar a MC2 y abrir el popup: escanea MC2. Volver a la portada y abrir el popup: tarjeta "Todas mis clases", no la lista de todos.
  - [x] 11. **AC-12**: En la portada con lista de todos, 🔄 arranca un recorrido nuevo desde el curso 1.
  - [x] 12. **AC-13**: Dentro de G22, sin recorrido: el popup se comporta igual que en `main`.
  - [x] 13. **Consola del SW**: llegan los `recorrido_evento`, sin errores.
- **Verificación B del loader con progreso** (plan `plan-loader-con-progreso.md`; antes: `pnpm run build`
  y recargar la extensión, no hay cambios en `backend/`):
  - [x] L-1. **AC-1**: portada → "Escanear todos los cursos": el loader tapa todo con "Escaneando todos
    los cursos", el reloj corre y **no** hay tarjeta de progreso en la lista.
  - [x] L-2. **AC-2 / AC-6 / AC-11**: dejar correr sin tocar. Durante: "Curso i de 7: <nombre>", la fase
    con números que suben, contadores, lista con marcas y, desde el 2º curso, "≈ N min restantes". Al
    terminar: la pestaña queda en la portada de cursos y se ve la lista agrupada. **Cronometrar el
    total: ≤ 130 s** (124 s de B-3 + 5 %).
  - [x] L-3. **AC-5**: relanzar con 🔄; en el curso 3 cerrar el popup; esperar ~20 s y reabrirlo: loader
    con el curso actual, las marcas y el reloj contando desde el lanzamiento.
  - [x] L-4. **AC-4**: entrar a Física I (pestaña recién recargada) y abrir el popup: título con el nombre
    del curso, "Cargando más publicaciones (n)" con números que suben, "Dejá Google Classroom al
    frente." y **sin** "Podés cerrar este popup".
  - [x] L-5. **AC-7**: relanzar; en el curso 3 cambiar de pestaña. Volver: la pestaña de Classroom sigue
    en ese curso y el popup muestra el resumen parcial, sin loader.
  - [x] L-6. **AC-8**: en Ramón Net, escanear: "Escaneando la pestaña..." con reloj, sin fase.
  - [x] L-7. **AC-9**: en un curso de Classroom, a mitad del escaneo cambiar de pestaña y volver: loader
    apagado y la tarjeta del aviso, sin restos del detalle.
  - [x] L-8. **AC-10**: con la lista del recorrido, abrir Filtros: la primera sección es "Estado".
  - [x] L-9. **Hallazgo 🟡 de abajo**: relanzar; en el curso 2 **recargar** la pestaña (F5) y abrir el
    popup. Anotar si el loader queda tapando todo y cuánto tarda en soltarse.
  - [x] L-10. con la lista de todos los cursos en pantalla, elegir 2-3 archivos y bajarlos **con el popup abierto** hasta que termine la cola. Tiene que quedar la lista de los 7 cursos, con el resumen, lo bajado marcado como descargado y el 🔄 de la cabecera visible. **No** tiene que aparecer el loader "Escaneando la pestaña..." ni un "no hay nada".
- **Sesión única de cierre de la rama (tanda, 2026-09-27)** — los 12 ítems abiertos de arriba y L-1..L-10
  se solapan; esta es la lista deduplicada, en el orden que minimiza recorridos. Antes: recargar la
  extensión (build ya hecho, sin cambios en `backend/`), pestaña de Classroom **al frente**, consola del SW
  abierta (cubre el 13). Cada paso dice qué ítems marca.
  - [x] S-1. Portada → "Escanear todos los cursos", sin tocar, **cronometrar** → L-1, L-2, 13.
  - [x] S-2. Con la lista: abrir Filtros → L-8. Elegir los 3 PDF que faltan en disco (Física I G, G22,
    G25) y bajarlos con el popup abierto → L-10 y 9 (dónde cayeron lo miro yo en el disco). Cerrar y
    reabrir en la portada: misma lista, sin escanear.
  - [x] S-3. Entrar a MC2, abrir el popup: escanea MC2. Volver a la portada y abrir → 10.
  - [x] S-4. En la portada, 🔄 → recorrido desde el curso 1 (11). En el curso 3 cerrar el popup, ~20 s,
    reabrir: loader con el curso actual y el reloj desde el lanzamiento → L-3, 4, 5. Dejar terminar.
  - [x] S-5. Relanzar; en el curso 3 cambiar de pestaña y volver → L-5, 7 (primera mitad).
  - [x] S-6. Relanzar; en el curso 2 click en otro curso del sidebar → 7 (segunda mitad: "navegaste fuera").
  - [x] S-7. Relanzar; en el curso 2 **F5** y abrir el popup; anotar cuánto tarda en soltarse → L-9.
  - [x] S-8. Física I con la pestaña recién recargada → L-4. A mitad del escaneo cambiar de pestaña y
    volver → L-7. G22 sin recorrido: igual que en `main` → 12.
  - [x] S-9. Ramón Net: escanear → L-6.
  - El 8 (mismo archivo de Drive en dos cursos) no se prueba a mano: lo busco yo en el storage tras S-1.
- **Revisión de tanda del loader con progreso (2026-09-27)** — compuerta re-corrida por el
  verificador: 46 archivos / 796 tests, lint, `tsc` y build en verde. Controles negativos corridos
  por mí en un worktree de scratch (Paso 1 y test 33 fallan sin su arreglo). Hallazgos:
  - ✅ **El recorrido se corta en el 2º curso (L-2 del dueño, 2026-09-27)**: `nombraOtroCurso` descarta vistas intermedias o del curso anterior en espera de Trabajo, `trabajoAsentado` y espera de Novedades, capturando la vista asentada (y devolviendo `avisoCursoCambiado` si vence con `/c/<otro>/m/`). 46 archivos / 798 tests en verde.
    Re-verificado por tanda: compuerta 46/798 + lint + `tsc` + build en verde (verificador); control
    negativo corrido por mí en worktree de scratch: sin el Paso 1, el 37 y el 38 fallan con
    `curso-cambiado`; sin el fallback de `pintadoOk` que agregó obra (no estaba en el plan), falla el 17
    → el fallback hace falta. Falta L-2 del dueño en Brave (dos corridas, cronometradas).
  - ✅ **Al terminar la cola se tira la lista de todos los cursos (dueño, 2026-09-27)**: `limpiarColaConservandoLista()` vacía la cola y conserva lista, origen y `recorridoTodos` cuando `origenListado.clave === "todos"`; `restaurarPanelPorInterrupcion` en `popup.js` muestra la lista guardada y sincroniza disco en vez de re-escanear. 46 archivos / 799 tests en verde. Revisión de tanda: compuerta re-corrida por el verificador (46/799, lint, `tsc`, build en verde); control negativo corrido por mí en worktree de scratch (con el cuerpo cambiado por `limpiarSesionLocal()` falla 1/38). La rama del popup (`mostrarListaGuardada` al fin de cola) no tiene test: la cubre L-10.
  - 🟡 **NO REPRODUCIDO — el fallback de `pintadoOk` puede cortar el recorrido por un curso lento**: si
    `pintado` vence justo con ningún `c-wiz` visible, `obtenerVistaActiva()` da `body`, que tiene las
    vistas ocultas del curso anterior con `/c/<otro>/m/` → `curso-cambiado` → corta todo el recorrido
    en vez de marcar el curso como fallido y seguir. Arreglo de una línea (`va !== document.body`) si
    alguna vez aparece; hoy el estado intermedio dura ~100-200 ms contra un tope de segundos.
  - ✅ **CSS del detalle roto (L-1 del dueño)**: fondo opaco con `&:has(.loader-detalle)` (`--bg-main`), host estirado con margen lateral (`.loader-detalle-host`), detalle centrado y lista alineada a la izquierda.
  - ✅ **El test 29 no tenía poder de detección** (obra lo declaró verificado): con el progreso
    enviado **fuera** de la cola seguía verde, porque 20 ms de latencia simulada nunca solapaban dos
    envíos. Con 300 ms el sabotaje da `maxEnVuelo = 2` y el arreglo pasa (3 corridas, ~3,7 s el
    test). Corregido por tanda: latencia 300 ms y timeout explícito de 15 s.
  - 🟡 **NO REPRODUCIDO — el loader puede quedar tapando todo hasta 210 s** si el script del
    recorrido muere sin mandar `fin` (pestaña recargada o cerrada): no hay manejador en el SW que lo
    corte, `esVigente` sólo vence a `topeEscaneoMs + 30 s` = 210 s en Classroom, y
    `sincronizarLoaderRecorrido` sólo se re-evalúa cuando cambia el storage. Antes la tarjeta decía
    lo mismo pero dejaba usar la Cola; ahora la cortina bloquea todo el popup. Lo mide L-9.
  - ⚪ `sincronizarLoaderRecorrido` suma una segunda bandera (`loaderEsDelRecorrido`) junto a
    `elEscaneoTomoElLoader`: más dueños del loader coordinados a mano (ver la deuda 🔴 del loader).
  - ⚪ La memoria de obra dice que la vuelta a `/h` ocurre "al terminar o al detenerse"; el código
    hace lo correcto (sólo al terminar, RN-21, test 35): la nota está mal, no el código.
- **Revisión de tanda (2026-09-27)** — compuerta re-corrida por el verificador: 44 archivos / 764
  tests, lint, `tsc` y build en verde, árbol limpio. Hallazgos:
  - ✅ **El nombre del curso sale como id base64 en 7 de 8 cursos.** (Cerrado en Paso 3).
    `resolverNombreCurso(id)` busca anclas globales en sidebar y portada, resolviendo el nombre
    limpio sin inicial pegada y sin ids base64.
  - ✅ **El test 23 no tiene poder de detección**: (Cerrado en Paso 4).
    Test 23 afilado para que un escaneo zombi valide identidad, haga click en Novedades y rompa
    el curso siguiente; control negativo verificado fallando sin la cancelación. Cancelación
    implementada mediante token `idCancelacion`.
  - ✅ **AC-14 no se ve**: (Cerrado en Paso 6).
    `ofreciendoTodos` desacoplado del modo del botón; el botón adopta modo `"recorriendo"` con
    label `""` (oculto). La tarjeta de fin sin material deja de quedar tapada.
  - ✅ **`lanzarRecorridoTodos` no tiene la guarda de la fila 1.** (Cerrado en Paso 6).
    Agregada guarda de fila 1 con `esVigente` en `lanzarRecorridoTodos` ante `/h/archived`.
  - ✅ **El reductor no tiene estado terminal**: (Cerrado en Paso 5).
    `recorridoTodos.ts` ignora eventos `latido`, `curso` y `fin` si `prev.estado !== "escaneando"`.
  - ✅ **Loader "Conectando con el servidor…" infinito en la portada** (lo vio el dueño en B-2,
    2026-09-27). Corregido con `ocultarLoader()`.
  - **B-2/B-3 en Brave (dueño, 2026-09-27 12:24–12:26)**, tres recorridos leídos del storage de la
    extensión (`Local Extension Settings/<id>/000026.log`), no de capturas:
    - ✅ **Los archivados no entran**: (Cerrado en Paso 3).
      `esperaArchivadosMs = 5000` con `esperarCondicion` hasta que pinten anclas nuevas en archivados.
    - ✅ **El primer curso (G22) falla siempre** con "Classroom no terminó de abrir Trabajo en
      clase": (Cerrado en Paso 2).
      `navTrabajoOk` espera hasta que el nav pinte el enlace a `/w/${curso.id}/t/all`.
    - ✅ **Lo escaneado está incompleto**: (Cerrado en Paso 1).
      Asentado de Trabajo en clase (`asentadoVacio = 2000` ms) antes de darlo por vacío (M-C, M-D).
    - ✅ Nombres con inicial pegada: (Cerrado en Paso 3).
      Extrae `aria-label` del sidebar o anclas sin inicial pegada.
    - ✅ Botón durante el recorrido oculto: (Cerrado en Paso 6).
      Modo `"recorriendo"` con label vacía y botón oculto.
  - ⚪ **NO APARECIÓ en B-3 del 2026-09-27** (el recorrido terminó `terminado`, sin corte por navegación) — queda como riesgo, no como hallazgo: (a) si al llegar a un curso queda montada la vista de
    Trabajo en clase del anterior, el chequeo `/c/<otroId>/m/` devuelve `avisoCursoCambiado` y el
    recorrido entero se corta como "navegaste fuera del recorrido"; las muestras guardan una sola
    `c-wiz`, así que no lo pueden confirmar ni descartar. (b) Para los activos, el script hace
    click en `/h/archived` y, sin esperar, en el link del sidebar: carrera entre dos navegaciones.

---

## 11. Registro de cancelar el escaneo (rama `loader-tarjetas`)

- **Spec**: [`docs/specs/cancelar-escaneo/spec.md`](specs/cancelar-escaneo/spec.md)
- **Plan**: [`docs/plan-cancelar-escaneo.md`](plan-cancelar-escaneo.md)

### Decisiones de diseño implementadas:
1. **Canal popup → pestaña**: `chrome.tabs.sendMessage` con `{ action: "cancelar_escaneo", idRecorrido | idEscaneo }` atendido dentro de `escanearListado` inyectado.
2. **Confirmación**: el recorrido pasa a `estado !== "escaneando"` en storage y un curso recibe callback de `executeScript`, ambos con timeout de seguridad de 3 s.
3. **Descriptor de portal**: miembro opcional `PuertoSitio.escaneoCancelable?: boolean`, activado únicamente en `sitio/google-classroom/config.ts`.
4. **Motivo nuevo**: `MotivoCorte: "cancelado"` propagado en reductor, eventos y resúmenes.
5. **Fin sin previo**: `fin` con `tabId`/`sitioId` crea un recorrido cortado si no hay previo (o id mayor), e `inicio` con el mismo id sobre un terminal no revive el recorrido.
6. **Resumen con 0 cursos (PA-1)**: mensaje específico "Cancelaste el recorrido antes de encontrar los cursos." (o "Se cortó antes de encontrar los cursos: <motivo>.").
7. **Restauración en un curso**: con lista previa recupera los ítems vía `mostrarListaGuardada()`; con lista vacía muestra tarjeta informativa `cancelado` (`info`, ⏹️).
8. **Botón Cancelar**: clase `.btn-cancel` sin estilos ni colores inventados, con estado `cancelando` deshabilitado.

### Defecto latente cerrado:
- Antes, un evento `fin` emitido antes de `inicio` (`sin-cursos` en scraper o visibilidad previa) devolvía `null` en el reductor por falta de `prev`, perdiéndose en el storage y dejando al popup colgado hasta vencer `esVigente`. Ahora crea un recorrido `cortado` con `cursos: []`.
