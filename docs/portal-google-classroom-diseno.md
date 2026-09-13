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

1. **Escaneo + archivos de Drive** → **plan escrito el 2026-09-12: `docs/plan-classroom-corte-1.md`**.
   Destino `raíz/google-classroom/<curso>/`; el mapeo (D9) queda para el corte 2, por decisión
   del dueño. Por la rama del adjunto, con cookie. Toca Capa 1 (la política
   de `credentials`). Radio de impacto ya visto: `core/cola/procesadorCola.ts`,
   `core/cola/procesadorCola.test.ts`, `core/puertos/sitio.ts`, `sitio/anatomy-by-chris/descargarAdjunto.js`
   (el único que hoy implementa `resolverAdjunto`), `core/cola/identidadClase.test.ts`.
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

