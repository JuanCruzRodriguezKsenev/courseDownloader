# Plan — Google Classroom, corte 1: escanear un curso y bajar sus archivos

**Rama**: `classroom-corte-1`, creada desde `main`. Su primer commit es este plan y la ronda de
medición.
**Diseño y evidencia**: `docs/portal-google-classroom-diseno.md` (decisiones D1 a D13, mediciones
en §8). Lo que este plan necesita de ese doc está resumido acá: **para ejecutar alcanza con este
archivo**.
**Escrito el 2026-09-12.** El dueño eligió partir el trabajo en dos cortes; éste es el primero.

---

## 0. Qué entra y qué no

**Entra:**

- El adaptador `sitio/google-classroom/`: cuatro archivos más sus tests. Escanea un curso entero
  ("Trabajo en clase" **y** "Novedades") en **una** inyección, y baja cada archivo de Drive con la
  sesión de Google del navegador.
- Los videos de Drive, los de YouTube y los vínculos **no se bajan**: se guarda un `.md` con el
  link (D10).
- El destino es el de cualquier portal hoy: `raíz/google-classroom/<curso>/`
  (`backend/handlers.js:30`). **Sin mapeo.**
- Cuatro cambios chicos fuera del adaptador:
  1. el permiso de cookies de la descarga de un adjunto pasa a depender del portal;
  2. una página HTML donde se esperaba un archivo es un rechazo;
  3. el "ya descargado" de un adjunto compara por nombre exacto;
  4. el escaneo puede cortarse con un aviso visible.

**No entra** (queda para el corte 2, con su propio plan):

- el mapeo a la carpeta `U.N.L.P` del dueño, la raíz por portal, el cambio del contrato de disco
  del backend y la ADR-0016;
- bajar videos;
- tocar `sanitizarTexto` (ver Paso 3);
- tocar cualquier archivo de `backend/`.

---

## 1. Lo medido que este plan da por hecho

Todo viene del §8 del diseño. No hace falta volver a medirlo; si algo no coincide en el
navegador, **se reporta**, no se ajusta el plan en el momento.

**La descarga (M0).**

- Desde el service worker, Drive responde con los bytes del archivo **sólo** si el pedido lleva
  `authuser=<N>`, donde N es el número de `/u/N/` en la URL de Classroom.
  - Con `authuser`: **206** y bytes.
  - Sin `authuser`: **403** y una página HTML.
  - Sin cookies: **401**.
- La URL es
  `https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t&authuser=<N>`.
  Se midió con 5 archivos y ninguno redirigió a otro host.

**El DOM de Classroom (C1, M1, M3, M4).**

| Qué | Selector / señal medida |
|---|---|
| Vista activa | `body > c-wiz` **sin** `aria-hidden="true"`. Las vistas ya visitadas quedan apiladas y ocultas, y traen adjuntos que no son de la vista actual. |
| Tema | `div[role="region"][aria-label]`. El `aria-label` es `"Tema <nombre>"`, o `"Elementos de trabajo en clase sin tema"` para lo que no tiene tema. |
| Ítem de "Trabajo en clase" | `li[data-stream-item-id]`, que además lleva `data-expandable-row-id`. |
| Abrir un ítem | `div[role="button"][aria-expanded]` dentro del `li`. Su `aria-label` es el título del material. |
| Adjunto | `div[data-attachment-id]` > `a[aria-label][href]`. **Hay dos `<a>` por adjunto.** |
| Más ítems en un tema | `button[aria-label="Ver más publicaciones"]` en la región, fuera de los `li`. Classroom muestra de a 10. |
| Curso sin nada en "Trabajo en clase" | `[data-no-topic-items]` en la vista activa, sin ningún `li`. |
| Ir a Novedades / volver | `nav a[href]` con pathname `(/u/N)?/c/<idCurso>` / `(/u/N)?/w/<idCurso>/t/all`. No recarga la página: el script inyectado sobrevive, y la vista nueva pinta en 350–412 ms. |
| Ítem de Novedades | El `[data-stream-item-id]` más externo de la vista. Su título es `"Publicación de <docente>"`. Carga con scroll y no tiene "Ver más". |

**El `aria-label` de un adjunto (C1, M2).**

- Archivo: `"Archivo adjunto: <Tipo>: <nombre>"`. Los `<Tipo>` medidos son PDF, Video, Imagen,
  Microsoft Word, Microsoft Excel y Microsoft PowerPoint.
- YouTube: `"Archivo adjunto: video de YouTube: <título>"`.
- Vínculo: `"Archivo adjunto: Vínculo a <url>"`, **sin** segundo `": "`. Los formularios llegan
  así, como vínculos a `forms.gle`.
- El `href` de Drive y el de YouTube ya traen `authuser`.

**La pestaña (recorrido 2).** Con la pestaña en segundo plano, Classroom no pinta.

---

## 2. Paso a paso

**Orden de commits**: uno por paso cuando compila solo. Los pasos 1 a 3 pueden ir juntos (núcleo
y sus tests); después el 4 y el 5, luego el 6 y el 7, y por último el 8. Cada archivo que tenga
cabecera de versión se sube de versión y suma una línea al CHANGELOG (`AGENTS.md` §File-level
version headers).

### Paso 1 — Núcleo: la política de cookies de la descarga de adjuntos

**Qué hace hoy.** `core/cola/procesadorCola.ts:467` baja el adjunto con
`fetch(urlFirmada, { signal, credentials: "omit" })`, siempre. Anatomy lo **necesita** así (está
medido, ver el comentario de `:430`). Drive necesita las cookies.

**Cambio.**

1. En `core/puertos/sitio.ts`, agregar a `PuertoSitio` el miembro **opcional**
   `readonly credencialesAdjunto?: "omit" | "include";`. El JSDoc tiene que decir:
   - que el default es `"omit"`;
   - por qué es opcional: un portal sin adjuntos no lo necesita, y Anatomy queda en el valor
     medido sin declararlo;
   - que Classroom lo declara `"include"` (diseño D1 y M0).
2. En `core/cola/procesadorCola.ts`:
   - sumar el mismo miembro opcional a `SitioDeDescarga` (`:115-150`);
   - en `:467`, usar `credentials: sitio.credencialesAdjunto ?? "omit"`;
   - corregir el punto 2 del comentario de `:430`, que dice que el último salto va siempre sin
     credenciales.

**Radio de impacto.** `SitioDeDescarga` lo arman el descriptor de cada portal, vía
`sitios.obtener`, y los dobles de `core/cola/procesadorCola.test.ts` (`montarConAdjuntos`, `:695`).
No tiene otros lectores.

**Tests** en `procesadorCola.test.ts`, dentro de `describe("la rama del adjunto")`:

- sin `credencialesAdjunto`, el `fetch` sale con `credentials: "omit"` (fija el caso Anatomy);
- con `credencialesAdjunto: "include"`, sale con `"include"`.

`montarConAdjuntos(bytes, over)` ya acepta `over`. El doble del sitio es el objeto que devuelve
`sitios.obtener` adentro de esa función: sumarle el campo por parámetro.

### Paso 2 — Núcleo: una página HTML no es el archivo

**Qué hace hoy.** `procesadorCola.ts:468-486` sólo mira `respuesta.ok` y después toma los bytes.
Una página de login, o el aviso de Drive "no se puede analizar en busca de virus", llegaría con
200 y `text/html`, y se guardaría como si fuera el archivo, **sin error** (diseño §7).

**Cambio.** Justo después del bloque `if (!respuesta.ok)`, agregar esta regla:

- Si el `content-type` de la respuesta empieza con `text/html` **y** el título del ítem no termina
  en `.html` ni `.htm` (sin distinguir mayúsculas), tirar un error tipado con
  `tipoPortal = "rechazo"`.
- Mensaje:
  `` `[${sitio.id}] el archivo "${titulo}" llegó como una página web y no como el archivo` ``.
- No se manda nada al backend.

Es un rechazo **tipado en el origen**, no un `msg.includes()` en el clasificador del bucle
(`AGENTS.md` §Execution contexts).

**⚠️ El doble de `fetch` de los tests contesta lo mismo para cualquier header**
(`headers: { get: () => String(bytes) }`, `procesadorCola.test.ts:701`). Cambiarlo para que
distinga `content-length` de `content-type`, por ejemplo
`get: (h) => (h.toLowerCase() === "content-type" ? tipo : String(bytes))`, con `tipo` por
parámetro y `"application/pdf"` por defecto. **Ningún test existente cambia lo que afirma.**

**Tests:**

- respuesta HTML con título `.pdf` → rechazo, y `enviarBloqueAdjunto` no se llama;
- respuesta HTML con título `.html` → se baja normal.

### Paso 3 — Núcleo: el nombre que va a quedar en disco

**Qué hace hoy.**

- El backend escribe el archivo con el nombre que devuelve `sanitizarNombreArchivo(x-file-name)`
  (`backend/utils.js:8`, usado en `handlers.js:278`). Esa función hace tres cosas:
  1. `path.basename(nombre)`;
  2. reemplaza por `_` todo carácter fuera de `[a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]`;
  3. `trim()`; si queda vacío, devuelve `"video_sin_nombre"`.
- `sanitizarTexto` (`core/util/texto.ts:40-46`) usa la misma lista de caracteres, **pero además
  colapsa espacios** (`:44`). Por eso `"MC4 2026  - Copia de P2F2.pdf"`, un nombre real con doble
  espacio, termina en disco con un nombre distinto del que la extensión cree.

**Cambio.** En `core/util/texto.ts`, exportar `nombreEnDisco(nombre?: string | null): string`, que
replica **exactamente** la función del backend:

1. quedarse con lo que sigue a la última `/` o `\`;
2. reemplazar con la misma clase de caracteres;
3. `trim()`, y `"video_sin_nombre"` si queda vacío.

Exportar también la clase de caracteres como constante de texto (por ejemplo
`CARACTERES_VALIDOS_EN_DISCO`), para que el test de paridad la compare con la del backend.

El JSDoc de `nombreEnDisco` tiene que decir por qué existe al lado de `sanitizarTexto` y por qué
**no se unifican**: cambiar `sanitizarTexto` cambiaría el nombre de videos que ya están bajados.
`sanitizarTexto` no se toca.

**Cómo llega al popup.** Llega sola: `Utils` es `{ ...texto, ... }` (`plataforma/composicion.ts:157`)
y `popup.js` lo recibe como `utils`.

**Tests** en `core/util/texto.test.ts`, en un `describe("nombreEnDisco")` nuevo:

- `"MC4 2026  - Copia de P2F2.pdf"` → **igual**, conserva el doble espacio;
- `"27 abr 2026 a la(s) 5:36 p.m..jpg"` → `"27 abr 2026 a la(s) 5_36_p.m..jpg"` (medido,
  diseño §8 M1);
- `"a/b\\c.pdf"` → `"c.pdf"`;
- `""` → `"video_sin_nombre"`;
- **paridad con el backend**: leer `backend/utils.js` como texto
  (`readFileSync(new URL("../../backend/utils.js", import.meta.url), "utf8")`) y afirmar que
  contiene la clase de caracteres exportada. Si alguien cambia una lista y no la otra, el test
  falla.

### Paso 4 — Popup: "ya descargado" por nombre exacto en los adjuntos

**Qué hace hoy.** `popup.js:1508-1519` compara `clase.titulo.toLowerCase().trim()` con los nombres
que devuelve el disco (que el backend ya pasa a minúsculas, `backend/handlers.js:104-108`). Acepta
dos coincidencias: igualdad **o `includes`**. Con un adjunto eso falla dos veces:

- el título crudo no coincide con el nombre saneado en disco;
- `includes` da `a.pdf` por bajado si existe `tabla.pdf`.

**Cambio.** Si `clase.tipo === 'adjunto'`:

- `yaExiste = setArchivosNormalizados.has(utils.nombreEnDisco(clase.titulo).toLowerCase())`;
- **no** se entra al bucle de `includes`.

Los videos siguen igual. Dejar un comentario en el bloque que cite este plan.

**Radio de impacto.** Cambia también para los adjuntos de Anatomy, en la dirección correcta (ver
verificación B6).

**Test.** No hay forma de testearlo: el núcleo de `popup.js` no se testea (ADR-0005). Va a la
verificación en navegador.

### Paso 5 — Puerto y popup: el escaneo puede cortarse con un aviso

**Qué hace hoy.**

- Un escaneo que vuelve vacío deja su mensaje en `nodos.txtEstado`, el `<p>` del footer, que está
  oculto (`TECHNICAL_DEBT.md`, "La línea de estado del footer es invisible").
- Las muertes del escaneo que sí se ven son `escaneoMuerto`, con `motivo` en
  `timeout | inyeccion | sin-portal`. Sus textos viven en `const cards` (`popup.js:1727-1743`).
- `sincronizarBloqueosDeAlerta` (`:2444-2457`) no distingue motivos: sólo mira si hay
  `escaneoMuerto`.

**Cambio.**

1. En `core/puertos/sitio.ts`, a `ResultadoEscaneo`, agregar el campo opcional `aviso?: string`.
   JSDoc: "el escaneo se cortó por algo que el usuario puede arreglar; se muestra en lugar del
   listado y **no** reemplaza la lista anterior".
2. En `popup.js`, en el callback del escaneo, **inmediatamente** después de
   `const resultado = (await res?.result) || …` (`:1316`) y **antes** de guardar credenciales
   (`:1328`). Si `resultado.aviso` tiene texto, seguir el mismo camino que la rama `inyeccion`
   (`:1270-1300`):
   - `ocultarLoader()`;
   - `escaneoMuerto = { motivo: 'portal', portal: utils.escaparHtml(portal.nombre), detalle: utils.escaparHtml(resultado.aviso) }`;
   - `sincronizarBloqueosDeAlerta()`;
   - `configurarBotonesUX("re-escanear", "Re-escanear 🔄", false)`;
   - recuperar el listado anterior del storage, igual que esa rama;
   - `return`.

   No se guardan credenciales y no se toca `listadoClasesGlobal`.
3. En `cards` (`:1727`), agregar la entrada `portal`:
   `{ titulo: 'El escaneo no trajo clases', descripcion: \`${escaneoMuerto.detalle}<br>Probá <strong>Re-escanear</strong>.\`, icono: '👁️' }`.
   El `detalle` llega escapado, que es lo que corresponde: la descripción viaja por
   `dangerouslySetInnerHTML` (`docs/security.md`).

**Radio de impacto.** `ResultadoEscaneo` lo producen los tres scrapers. Los dos existentes no
usan `aviso` y no cambian.

### Paso 6 — El adaptador `sitio/google-classroom/`

**Receta**: `docs/multisitio-diseno.md` §Cómo escribir un portal nuevo (pasos 1 a 5).
**Molde**: `sitio/anatomy-by-chris/`, el portal de dos niveles que ya tiene adjuntos y faceta
inerte.
**Globals propios**: `SitioGoogleClassroom`, `ScraperClassroom`, `ParserTitulosClassroom` y
`DescargarAdjuntoClassroom`. Nunca los nombres de otro portal: el último entrypoint evaluado
los pisa, en silencio (`AGENTS.md` §Execution contexts).

#### 6a. `config.ts`, el descriptor

Misma estructura que `sitio/anatomy-by-chris/config.ts`: `declare const` de los hermanos `.js`,
faceta inerte y exportación dual. Con estos valores:

- **`id: "google-classroom"`** (D5). Es la carpeta en disco y la mitad de la identidad: no
  cambiarlo.
- `nombre: "Google Classroom"`, `color: "#1E8E3E"`.
- `urlSondeoInternet: "https://classroom.google.com"`.
- `esPaginaDelSitio(url)`: `^https://classroom\.google\.com/(u/\d+/)?(c|w)/[^/]+`, o sea, un
  curso, ya sea en Novedades o en Trabajo en clase. La página principal y "Clases archivadas"
  **no** lo son, porque desde ahí no se puede escanear (D6).
- `patronPestañas: "https://classroom.google.com/*"`, `urlListado: "https://classroom.google.com/"`.
- `instruccionEscaneo`: `"Escaneá desde un curso (Trabajo en clase o Novedades) y dejá esa pestaña al frente hasta que termine: puede tardar un par de minutos, y si cambiás de pestaña el escaneo se corta."`
- **`topeEscaneoMs: 180000`**. El curso más grande medido (Física I) suma unos 80 s por partes:
  - 83 ítems × ~560 ms de mediana para abrirlos ≈ 47 s;
  - la espera de estabilidad de Trabajo en clase ≈ 6 s;
  - la de Novedades, 15 vueltas × 1,5 s ≈ 22 s.

  180 s deja más del doble.
- `credencialesAdjunto: "include"` (Paso 1).
- `resolverAdjunto(idArchivo, signal, credenciales)` → `DescargarAdjuntoClassroom.resolver(idArchivo, signal, credenciales)`.
- **`resolverManifiesto`**: el puerto lo exige y este portal no tiene video HLS (D2). Devolver
  una promesa rechazada con un `Error` que lleve `tipoPortal = "rechazo"` y el mensaje
  `"[google-classroom] este portal no tiene videos HLS"`. Ningún ítem de Classroom sale con
  `tipo: "video"`, así que el bucle no debería llamarlo nunca; el rechazo es la red de seguridad.
- `escanearListado`: un getter que devuelve `ScraperClassroom.escanearListado`.
- `parsearTitulo: (crudo) => crudo`, porque los adjuntos no pasan por el parser
  (`popup.js:1380`).
- `clasificarCarpeta: (crudo, materiaBase) => ParserTitulosClassroom.clasificarCarpeta(crudo, materiaBase)`.
- `faceta`: la inerte de Anatomy, con los mismos textos.

#### 6b. `parserTitulos.js`

`ParserTitulosClassroom.clasificarCarpeta(crudo, materiaBase)` devuelve
`{ catedra: "COMUN", carpeta: Utils.sanearNombreCarpeta(curso) }`, donde `curso` es lo que hay en
`materiaBase` **antes** de `" › "`.

- **Qué hace hoy `Utils.sanearNombreCarpeta`** (`core/util/texto.ts:75-83`): pasa a minúsculas,
  saca acentos, reemplaza lo que no sea `[a-z0-9]` por `_`, junta los `_` repetidos y recorta los
  de las puntas. `"Fisica_II_G25_2026"` queda `"fisica_ii_g25_2026"`.
- **Por qué la carpeta es el curso y no el tema**: el popup llama
  `clasificarCarpeta(item.texto, item.modulo || input)` (`popup.js:1371-1384`), y en este corte
  cada curso va a **una** carpeta. Tres cursos tienen un tema "Laboratorios" (Palacio, Bianchi y
  Física I): con la carpeta por tema, sus archivos se mezclarían.

Este parser no necesita `formatearTitulo`.

#### 6c. `descargarAdjunto.js`

`DescargarAdjuntoClassroom.resolver(idArchivo, signal, credenciales)`:

1. **Sin `idArchivo`** → error con `tipoPortal: "rechazo"`, igual que Anatomy
   (`sitio/anatomy-by-chris/descargarAdjunto.js:84`).
2. **`idArchivo` empieza con `"acceso:"`** → es un acceso (D10).
   - El formato es `acceso:<encodeURIComponent(url)>:<encodeURIComponent(título)>`. El `:`
     queda codificado adentro de cada parte, así que sirve de separador.
   - Devolver `data:text/markdown;charset=utf-8;base64,<base64>`, donde el base64 es el UTF-8 de
     este texto:

     ```
     # <título>

     <url>
     ```

   - Para convertir UTF-8 a base64, usar `TextEncoder` y `btoa` por tramos: el service worker no
     tiene `Buffer`.
   - El bucle baja esa URL con `fetch`, igual que cualquier otra (`procesadorCola.ts:467`). Un
     `data:` funciona en el service worker y no manda cookies.
3. **Si no hay `credenciales?.authuser`** → error con `tipoConexion: "sesion"` y el mensaje
   `"no hay cuenta de Google guardada para Classroom. Abrí el curso y re-escaneá."`. Es el mismo
   criterio que Anatomy sin token (`sitio/anatomy-by-chris/descargarAdjunto.js:86-92`): la salida
   es re-escanear, no reintentar.
4. **Si hay** → devolver
   `https://drive.usercontent.google.com/download?id=<id>&export=download&confirm=t&authuser=<authuser>`,
   armada con `URL` y `searchParams`.

Nunca loguear credenciales (`docs/security.md` §El `id_token`).

Este resolver **no hace pedidos de red**. Los status HTTP los clasifica el bucle
(`procesadorCola.ts:468-476`): un 403 es `"bloqueo"`, que pausa la cola (es el caso medido sin
`authuser`, sistémico), y cualquier otro 4xx es un rechazo del ítem.

#### 6d. `scraper.js`: `ScraperClassroom.escanearListado(opciones)`

**Reglas que aplican al pie de la letra:**

- **Tiene que ser serializable y autocontenida.** Todo va adentro de la función, ni siquiera una
  constante del módulo (`sitio/anatomy-by-chris/scraper.js:33-46` explica por qué). Ninguna
  verificación automática detecta si se rompe.
- Es `async`: el popup la espera con `await` (`popup.js:1316`).
- Firma `async function (opciones)`. `executeScript` la llama sin argumentos; los tests pasan
  `opciones.tiempos` para acortar las esperas. Los valores por defecto son los de la sonda:

| Espera | Default | Medido en |
|---|---|---|
| `tiempos.pintado` | 20000 ms | M2 |
| `tiempos.vuelta` | 1500 ms | M2 |
| `tiempos.navegacion` | 15000 ms | M4 |
| `tiempos.verMas` | 8000 ms | M3 |
| `tiempos.abrir` | 8000 ms | M1 |
| `tiempos.sinAdjuntos` | 1500 ms | M1 |

**Algoritmo.** Cada paso cita la medición que lo sostiene.

1. **La pestaña tiene que estar visible.** Un helper `visible()` devuelve
   `document.visibilityState === "visible"`. Se chequea al empezar y después de cada fase
   (pasos 4, 6, 7, 9). Si en algún momento da falso, devolver
   `{ materia: "", enlaces: [], aviso: "Cambiaste de pestaña durante el escaneo y Classroom dejó de cargar la página. Dejá Classroom al frente y re-escaneá." }`.
   **Nunca** devolver lo leído a medias (D13).
2. **Curso y cuenta.**
   - `idCurso` sale de `location.pathname` con `/\/(?:c|w)\/([^/]+)/`.
   - `cuenta` sale de `/^\/u\/(\d+)\//`, con `"0"` si no está.
   - El nombre del curso es `document.title` sin el prefijo `"Trabajo en clase de "` y sin el
     sufijo `" - Classroom"`.
   - Sin `idCurso`, devolver `aviso`: `"Abrí un curso de Classroom (Trabajo en clase o Novedades) y re-escaneá."`
3. **Ir a "Trabajo en clase"**, si la URL no es `…/w/<idCurso>/t/all`.
   - Hacer `click()` en el `nav a[href]` cuyo pathname sea `(/u/N)?/w/<idCurso>/t/all`.
   - Esperar, hasta `tiempos.navegacion`, a que la vista activa **sea otro elemento** que antes
     del click y tenga contenido: algún `[data-stream-item-id]` o el marcador de vacío.
   - **No** anclarse en el valor de `jsrenderer`: es un identificador interno de Classroom, se usó
     sólo como evidencia en M4.
   - Si vence, devolver `aviso`: `"Classroom no terminó de abrir Trabajo en clase. Re-escaneá."`
4. **Esperar a que pinte.** Hasta `tiempos.pintado`, esperar a que la vista activa tenga algún
   `li[data-stream-item-id]` o el marcador `[data-no-topic-items]`.
   - Si aparece el marcador y no hay ningún `li`, "Trabajo en clase" está vacío: saltear los pasos
     5 a 8 (D13; así eran MC6 y Q5).
   - Si vence, devolver `aviso`: `"Classroom no terminó de cargar el curso. Re-escaneá."`
5. **Quietud.** Buscar **una vez por fase** el contenedor que scrollea: el elemento con
   `overflowY` `auto` o `scroll` y mayor `scrollHeight`, o `document.scrollingElement` si no hay.
   Cada `tiempos.vuelta`, llevarlo al fondo. Parar cuando alto, cantidad de
   `[data-stream-item-id]` y `aria-busy` de la vista activa no cambien en 3 vueltas seguidas, con
   un máximo de 40. Es la espera de las sondas v0.0.4 y posteriores, medida en 8 cursos.
6. **"Ver más" por tema** (D13, M3). Para cada región `div[role="region"][aria-label]` de la
   vista activa, tomar como `boton` su `button[aria-label="Ver más publicaciones"]` que no esté
   dentro de un `li`. Entonces:
   - mientras `boton` esté **visible** (`getClientRects().length > 0` y `getComputedStyle` sin
     `display:none` ni `visibility:hidden`) **y** no esté `disabled`:
     1. hacer `click()`;
     2. esperar, hasta `tiempos.verMas`, a que crezca la cantidad de `li[data-stream-item-id]` de
        esa región;
     3. si creció, esperar `tiempos.vuelta` y volver a evaluar el botón;
     4. si no creció, dejar esa región.
   - ⚠️ **`disabled` justo después del click significa "cargando"** (en M3 pasó en 0 ms), **no**
     "no hay más". Nunca cortar sólo porque está `disabled` sin haber esperado el crecimiento.
   - Si algún tema creció, repetir el paso 5.
7. **Abrir los ítems** (M1). Para cada `li[data-expandable-row-id]` que no tenga
   `[data-attachment-id]`:
   - hacer `click()` en su `div[role="button"][aria-expanded]`;
   - esperar, hasta `tiempos.abrir`, a que aparezca `[data-attachment-id]`;
   - o bien a que exista `[expanded-item-id]` y pasen `tiempos.sinAdjuntos` sin adjuntos: es un
     ítem sin adjuntos (4 de 149 en M2).

   Uno por vez: en M1 y M2 la mediana fue ~560 ms y el máximo 1,9 s.
8. **Leer "Trabajo en clase".**
   - Por región: el `tema` es el `aria-label` sin el prefijo `"Tema "`. La región
     `"Elementos de trabajo en clase sin tema"` es el tema `"Sin tema"`.
   - Por cada `li`: el `material` es el `aria-label` de su botón.
   - Por cada adjunto: deduplicar por `data-attachment-id`, porque hay dos `<a>` por adjunto (C1),
     y clasificarlo (paso 11).
9. **Ir a "Novedades".**
   - Hacer `click()` en el `nav a[href]` con pathname `(/u/N)?/c/<idCurso>` y esperar como en el
     paso 3. Si vence, devolver `aviso`: `"Classroom no terminó de abrir Novedades. Re-escaneá."`
     No se devuelve Trabajo en clase solo: faltaría material sin avisar.
   - Aplicar los pasos 1 y 5. Sin "Ver más": M2 y M3 lo midieron así.
   - Los ítems son los `[data-stream-item-id]` más externos (su padre no está dentro de otro
     `[data-stream-item-id]`).
   - El `material` es el texto del primer `h2` o `[role="heading"]` del post. El `tema` es
     `"Novedades"`.
10. **Volver a "Trabajo en clase"** con el mismo link del paso 3, para dejar la pestaña como
    estaba. Si falla, no es un error.
11. **Clasificar cada adjunto** según su `aria-label` y su `href` (C1, M2):
    - **`href` con `/file/d/<id>/` y label que cumple `^[^:]+: ([^:]+): ([\s\S]+)$`**:
      - si el tipo es `"Video"` → **acceso** (D10), con url = `href` y título = el nombre;
      - si no → **archivo**, con `idArchivo = <id>` y el nombre del label.
    - **Label con `": video de YouTube: "`** → acceso, con url = `href` y el título.
    - **Label con `"Vínculo a "`** → acceso, con url = lo que sigue a `"Vínculo a "` y título
      `"<material> - <host de la url>"`.
    - **`href` a `docs.google.com/document|presentation|spreadsheets`** → acceso. Exportar esos
      documentos es trabajo de otro corte, y ningún curso medido tiene uno.
    - **Cualquier otro caso** → acceso, con el label como título. **Nunca descartar un adjunto en
      silencio.**
    - Esos literales están en español porque así está la interfaz del dueño. Si Classroom cambia
      de idioma, todo cae en el último caso (acceso), que no pierde nada.
12. **Deduplicar entre vistas.** Un archivo de Drive (mismo id) o un acceso (misma url) que ya
    salió de "Trabajo en clase" no se repite desde "Novedades" (D11).
13. **Nombres repetidos** (D12).
    - El nombre final de un archivo es su nombre; el de un acceso es `<título>.md`.
    - Agrupar por nombre normalizado **en todo el curso**, porque en este corte el curso entero
      es una carpeta. Normalizar con la regla de `nombreEnDisco` (Paso 3), repetida acá adentro,
      más minúsculas. Dejar un comentario que apunte a `core/util/texto.ts` y a su test de
      paridad.
    - Si un grupo tiene más de un id distinto, a **todos** los del grupo se les inserta
      `" - <material>"` antes de la extensión.
    - Si todavía chocan, se agrega `" - <data-attachment-id>"`.
    - Medido: `interferencia2025.pdf` aparece 2 veces en Bianchi e
      `informe de laboratorio fisica i 2024 (template).docx` 5 veces en Física I.
14. **Resultado.**
    - Si no hay ningún enlace, devolver `aviso`:
      `"Este curso no tiene archivos en Trabajo en clase ni en Novedades."`
    - Si hay, devolver
      `{ materia: "", enlaces, credenciales: { authuser: cuenta } }`. Cada enlace es
      `{ texto: <nombre final>, href: <url del adjunto>, modulo: "<curso> › <tema>", tipo: "adjunto", idArchivo }`,
      con `idArchivo` = el id de Drive o `acceso:<url>:<título>`.
    - `materia` va vacía, como en Anatomy: en un portal de dos niveles la materia viaja con cada
      enlace (`popup.js:1334-1340`).
    - **El `modulo` lleva el curso a propósito.** Es parte de la identidad
      (`core/cola/identidadClase.ts`, ADR-0014) y los temas se repiten entre cursos: sin el curso,
      dos archivos con el mismo nombre en cursos distintos serían un solo ítem. En el filtro de
      módulos del popup se va a ver `"Física I-Grupo G-Ing 2024 › Laboratorios"`, y está bien.

#### 6e. Registro, manifest, entrypoints y lint

- `sitio/registro.ts`: importar `SitioGoogleClassroom` y sumarlo al final de `SITIOS` (`:52`).
  Actualizar el comentario sobre el orden, que dice "hay dos portales".
- `wxt.config.ts`, `host_permissions`: un bloque "Portal 3: Google Classroom" con:
  - `https://classroom.google.com/*`, para inyectar el escaneo;
  - `https://drive.usercontent.google.com/*`, para la descarga (en M0 no hubo redirección).

  Sin entrada en `declarative_net_request`: no hace falta tocar ningún header (M0).
- `entrypoints/popup/main.js`: después del bloque de Anatomy (`:25-27`), importar `config.ts`,
  `parserTitulos.js` y `scraper.js` de Classroom.
- `entrypoints/background.js`: después de Anatomy (`:37-42`), importar `config.ts`,
  `parserTitulos.js` y `descargarAdjunto.js` de Classroom.
- `eslint.config.js`, `globalesDelProyecto` (`:16-50`): sumar `SitioGoogleClassroom`,
  `ScraperClassroom`, `ParserTitulosClassroom` y `DescargarAdjuntoClassroom`, con un comentario
  "Portal 3".

### Paso 7 — Tests del adaptador

- **`sitio/registro.test.ts`:**
  - Classroom reclama `https://classroom.google.com/u/2/w/<id>/t/all` y
    `https://classroom.google.com/c/<id>`;
  - **no** reclama `https://classroom.google.com/u/2/h` ni
    `https://classroom.google.com/u/2/h/archived`;
  - extender el test de portales disjuntos (`:62`): ninguno de los otros dos reclama esas URLs, y
    Classroom no reclama las de ellos;
  - el `topeEscaneoMs` de Classroom es ≥ 120000 y mayor que el de Anatomy, con el mismo estilo que
    `:128-146`.
- **`sitio/google-classroom/parserTitulos.test.js`:** sembrar `globalThis.Utils` con el
  `sanearNombreCarpeta` real, como hace `sitio/anatomy-by-chris/parserTitulos.test.js:17`.
  - `clasificarCarpeta("x.pdf", "Fisica_II_G25_2026 › Presentaciones teóricas")` devuelve
    `{ catedra: "COMUN", carpeta: "fisica_ii_g25_2026" }`;
  - dos cursos con el mismo tema dan carpetas distintas.
- **`sitio/google-classroom/descargarAdjunto.test.js`:**
  - la URL de Drive lleva `authuser`;
  - sin `authuser` → error con `tipoConexion: "sesion"`;
  - un acceso da un `data:` que, decodificado, es `# título\n\nurl`, tildes incluidas;
  - `idArchivo` vacío → rechazo.
- **`sitio/google-classroom/scraper.test.js`** (`// @vitest-environment jsdom`), contra un
  **fixture sintético**: `sitio/google-classroom/__fixtures__/curso.html`, escrito a mano con la
  estructura medida del §1.
  - **No se usa una captura real**: las de `docs/muestras/` traen nombres, mails e ids de
    personas, y no se versionan.
  - **El fixture incluye:**
    - una vista oculta con un adjunto que no tiene que salir;
    - la región "sin tema" y dos temas;
    - un tema con 11 ítems y botón "Ver más": el test simula que el click agrega 1 `li` con
      retardo, y hace que `getClientRects` del botón tenga largo > 0 mientras queden ítems;
    - un ítem plegado cuyo click agrega su adjunto con retardo;
    - los cuatro tipos de label: archivo, `Video` de Drive, video de YouTube y "Vínculo a";
    - dos adjuntos distintos con el mismo nombre en materiales distintos;
    - el `nav` con los links a Novedades y a Trabajo en clase. El manejador de click del test
      intercambia `aria-hidden` entre las dos vistas y cambia la URL con `history.pushState`.
  - **Casos:**
    1. devuelve los adjuntos de Trabajo en clase y de Novedades, con `modulo`
       `"<curso> › <tema>"` y `"<curso> › Novedades"`, y `tipo: "adjunto"`;
    2. ignora la vista oculta;
    3. carga el tema paginado entero (11);
    4. abre el ítem plegado y trae su adjunto;
    5. el video de Drive, el de YouTube y el vínculo salen como acceso `.md`, con `idArchivo`
       `acceso:…`;
    6. el choque de nombres le agrega el material a los dos;
    7. `credenciales.authuser` sale de `/u/N/`;
    8. un curso con `[data-no-topic-items]` y sin posts devuelve `aviso` **sin** esperar el tope
       de pintado;
    9. con `document.visibilityState` en `"hidden"` (redefinido con `Object.defineProperty`)
       devuelve `aviso` y `enlaces` vacío;
    10. un mismo id de Drive en Trabajo en clase y en Novedades sale una sola vez.
  - Pasar `opciones.tiempos` con decenas de ms.
  - Esto **no** puede ver dos cosas: que la función sea serializable, ni que un `click()` real
    dispare a Classroom. Eso lo cubre la verificación B.

### Paso 8 — Docs

Contrastar cada edición con la línea citada antes de escribirla.

- **`docs/portal-google-classroom-diseno.md`**: nada que agregar, salvo lo que la verificación B
  mida distinto.
- **`docs/multisitio-diseno.md`:**
  - `:301` dice "12 miembros", un número desactualizado. El hogar canónico del contrato es
    `core/puertos/sitio.ts`: reemplazar el número por "ver `core/puertos/sitio.ts`" (ADR-0007),
    sin escribir otro número;
  - en la explicación de la autenticación (`:314-327`), sumar el tercer caso: cookie del
    navegador en la descarga de adjuntos, con `credencialesAdjunto: "include"`.
- **`docs/architecture.md`:**
  - `:376-379`: "Hay dos portales" pasa a tres, con `sitio/google-classroom/` (cuatro archivos:
    `config.ts` y tres `.js`, sin `rules.json`);
  - `:386`: quitar "(el puerto pasó a **12 miembros**)" y apuntar al puerto;
  - §Capa 2 (`:439-470`), donde se describen los hermanos `.js` de cada portal: sumar los tres de
    Classroom con el mismo formato que los de Anatomy.
- **`AGENTS.md`**, sólo para corregir datos, sin agregar reglas:
  - `:71`: "two learning portals", "there are two since 2026-08-07" y "seven files now" pasan a
    tres portales; los `.js` hermanos son diez (3 de Ramón Net, 4 de Anatomy y 3 de Classroom);
  - `:197`: "three per portal, four in Anatomy" suma a Classroom, con tres.
- **`docs/data-model.md`:**
  - en `credencialesPortal` (`:23`), agregar el caso de Classroom: `{ authuser }`;
  - en `Clase` y `ColaItem` (`:94-97`, `:117-118`), `idArchivo` suma el formato
    `acceso:<url>:<título>` de Classroom.
- **`docs/security.md`**, §El `id_token` (`:54-66`): un párrafo que diga tres cosas.
  - Classroom guarda `authuser`, que es un índice de cuenta y no un secreto, por el mismo
    mecanismo.
  - Las descargas de Drive salen con las cookies de Google del navegador, acotadas por
    `host_permissions` a `drive.usercontent.google.com`.
  - Los `.md` de acceso contienen sólo la URL y el título.
- **`docs/testing.md`**, §Baseline (`:33`): los números nuevos, con su "De dónde sale", como las
  entradas anteriores.
- **`docs/TECHNICAL_DEBT.md`**, §🔴 Abierto. Al terminar, **re-contar la sección** (lo pide el
  propio doc).
  - 🟠 `sanitizarTexto` no replica al backend porque colapsa espacios. Afecta títulos de video con
    espacios dobles; `nombreEnDisco` lo resuelve sólo para adjuntos.
  - 🟠 `/api/seleccionar-carpeta` sólo funciona en Windows (PowerShell, `backend/handlers.js:325`)
    y cambia la raíz de **todos** los portales (`:332`). Lo toma el corte 2.
  - ⚪ Un 403 **de un solo archivo** de Drive (descarga deshabilitada por el docente) pausa la
    cola entera (`procesadorCola.ts:474`). No está medido.
  - ⚪ `AGENTS.md:150` cita `.agents/skills/`, que no existe; sólo queda `skills-lock.json`.
  - ✅ Resuelto por este corte: el "ya descargado" de adjuntos por `includes`.
- **`docs/ramas-en-revision.md`**: completar la sección `classroom-corte-1` con la verificación B
  como checklist de "qué mirar".

### Paso 9 — Verificación

**A. Automática.** Pegar la salida, no describirla.

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm exec tsc --noEmit --listFiles | grep google-classroom
pnpm run build
```

Resultado esperado:

- todo en verde;
- lint con 0 errores y 0 warnings;
- `--listFiles` muestra `sitio/google-classroom/config.ts`;
- el build compila.

Baseline anterior: 38 archivos y 674 tests (`docs/testing.md:33`). El reporte da los números
nuevos.

**B. En el navegador.** Quien ejecuta no la puede correr sin el dueño: queda como checklist en
`docs/ramas-en-revision.md` y en el reporte.

**Antes de empezar:**

- levantar el backend: `cd backend && bun run server.js`;
- `pnpm run build` y recargar `.output/chrome-mv3/`;
- usar la cuenta del curso, en `/u/2/`;
- dejar la pestaña al frente durante cada escaneo.

1. **Arranque**: el service worker arranca sin excepción y el popup renderiza completo
   (`docs/rearquitectura-diseno.md` §Verificación en navegador, puntos 5 y 6).
2. **Escaneo, curso por curso.** Números del §8 del diseño; si alguno difiere, anotar cuánto y
   con qué ids, sin "arreglar" nada.

   | Curso | Enlaces esperados |
   |---|---|
   | Física II G22 (Palacio) | 57 |
   | Física I 2024 | 130 (129 de Trabajo en clase + 1 sólo en Novedades) |
   | Fisica_II_G25_2026 (Bianchi, archivado; se abre desde su URL de curso) | 71 de Trabajo en clase + hasta 28 de Novedades (ese 28 se midió contra una captura cortada) |
   | MB5 2024 | 24 |
   | MC4 1S 2026 | 13 |
   | MC2 2025 | 25 |
   | MC6 y Q5 | la tarjeta "El escaneo no trajo clases", en segundos, sin esperar el tope |
3. **Nombres repetidos**: en Física I, los 5 `informe de laboratorio fisica i 2024 (template)`
   aparecen con su material agregado; en Bianchi, los dos `interferencia2025` también.
4. **Pestaña oculta**: a mitad del escaneo de Física I, cambiar de pestaña. Tiene que aparecer la
   tarjeta con el aviso, y la lista anterior tiene que seguir ahí.
5. **Descarga.** Bajar estos seis ítems y después re-sincronizar el disco:
   - un PDF, que tiene que quedar en `raíz/google-classroom/<curso>/` con su nombre;
   - un video de Drive, uno de YouTube y un vínculo, que tienen que quedar como `.md` que abren
     con el link;
   - la imagen `27 abr 2026 a la(s) 5:36 p.m..jpg` de Bianchi;
   - `MC4 2026  - Copia de P2F2.pdf`, el del doble espacio.

   Después de re-sincronizar, los seis tienen que figurar como descargados.
6. **Anatomy sigue igual**: bajar un PDF (tiene que funcionar sin cookies) y comprobar que lo que
   ya estaba descargado sigue marcado como descargado.
7. **Aviso de fallo**: la notificación de un ítem de Classroom que falla abre una pestaña de
   Classroom (`background.js:534`).

---

## 3. Lo que no se toca

- **`backend/` entero.** El contrato de disco es el corte 2.
- **`hlsEngine`, `sanitizarTexto` y los `resolverManifiesto` de los otros portales.**
- **El orden de clasificación de fallos del bucle** (`procesadorCola.ts`; `AGENTS.md`
  §Execution contexts). El Paso 2 agrega un rechazo **en el origen**, adentro de la rama del
  adjunto; no toca ese orden.
- **`docs/muestras/`.** Es evidencia: no se versiona y no se lintea.

## 4. Qué tiene que traer el reporte

- La salida literal de la verificación A.
- La lista de archivos tocados, por paso.
- La verificación B como checklist pendiente (o su resultado, si el dueño la corrió).
- **Hallazgos**: lo que viste y no hiciste porque este plan no lo nombraba. No es deuda para
  ignorar: es la entrada de la próxima ronda.
