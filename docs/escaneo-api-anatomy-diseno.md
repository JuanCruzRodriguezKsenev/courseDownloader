# El escaneo de Anatomy by Chris pasa de DOM a API — diseño de ejecución

> ## ✅ Estado al 2026-08-07: los CINCO cortes están construidos Y VERIFICADOS EN NAVEGADOR
>
> Rama `escaneo-api-anatomy`, sin mergear. **La verificación en navegador pasó** — que es la
> condición para mergear, y no una formalidad: tres de los riesgos del §Registro **sólo los
> detecta el navegador**, y los tres se cerraron ahí (R1/R2 la inyección `async`, R9 el nombre
> del archivo).
>
> | corte | qué entró | estado |
> |---|---|---|
> | 1 | identidad `(portal, módulo, tipo, título)` → **ADR-0014**; escaneo por `/v1/navigation`; carpeta por módulo | ✅ funciona |
> | 2 | el override del input, con chip por fila y destino en el botón | ✅ funciona |
> | 3 | tests, docs y el ADR | ✅ |
> | 4 | tope de calidad **720p**, por rango y no por igualdad | ✅ funciona |
> | 5 | los adjuntos (PDF) entran a la cola | ✅ funciona, **tras tocar el backend** |
>
> ### Lo que costó bajar el primer PDF: cuatro arreglos, ninguno visible desde los tests
>
> Los cuatro salieron de usar la extensión, y **tres de los cuatro son la misma asimetría**: la
> medición original se hizo **desde una pestaña**, donde el navegador manda `Origin`, `Referer` y
> cookies solo, y el service worker no manda ninguno. Es la tercera vez que este portal la cobra
> (antes fueron el embed y el master).
>
> 1. **403** — los dos hosts de la cadena de adjuntos no estaban en `host_permissions`
>    (`api-club-hot-club-api…` es **otro** host que el de las lecciones) y el paso 2 salía sin
>    `x-product-id` ni `Referer`.
> 2. **"la respuesta no trae una URL reconocible"** — el campo es **`directDownloadUrl`**, que no
>    era adivinable; se habían probado cuatro nombres plausibles y erraron los cuatro. Lo que
>    salvó el diagnóstico fue que el error **volcara el cuerpo recibido**.
> 3. **`Atlas.pdf.mp4`** (riesgo R9, el único punto que no se podía cerrar desde este repo) — el
>    backend le pegaba `.mp4` a todo. Se resolvió con un header nuevo, `x-file-name`, y **tres
>    líneas en el backend** (entonces un repo aparte, `ramonnet-bun-backend`; hoy `backend/`, ver
>    ADR-0015 — este corte fue justamente el caso que la motivó); el contrato está en
>    `docs/deployment.md`.
> 4. **La clase en curso se marcaba descargada a mitad de la descarga** — regresión del propio
>    arreglo anterior: al abrir el escaneo de disco del backend para que entraran los PDF,
>    volvieron a entrar los `.part`. `endsWith(".mp4")` estaba filtrando **dos** cosas —el tipo de
>    archivo y los temporales— y se aflojaron las dos.
>
> **Qué quedó registrado de la verificación, y qué no**: el dueño confirmó que **funciona** —
> escaneo, videos, PDF y las métricas de progreso en el popup y en la consola del backend—. No se
> anotó un desglose punto por punto de los 6 chequeos del corte 1 ni de los 5 del corte 5, así que
> **esta verificación es del mismo tipo que la de la casilla 4 del corte 7: resultado global, no
> medición**. Se anota así a propósito, que es lo que la hace distinta de un ✅ inventado.
>
> ### Lo que construirlo enseñó y el plan no decía
>
> Arreglar la clave de identidad **no alcanzaba**. Aparecieron **cinco lugares** que armaban un
> objeto-identidad a mano con dos campos —incluido el propio bucle de descarga, que anulaba el
> arreglo entero— y **dos defectos del corte 1** que sólo se vieron al construir el 5: `esteItem`
> sin módulo, y el filtro de materia comparando contra el input, que deja la lista entera
> invisible en un portal de dos niveles. Ninguno de los siete lo detecta el compilador.
>
> Y una decisión de UX que duró horas: el filtro por tipo arrancaba en **"sólo video"** y se
> revirtió al abrir el popup. El criterio no estaba mal; **un filtro activo que el usuario no
> prendió es invisible**, y la lista venía recortada sin que hubiera cómo notarlo.

*Lo que sigue es el doc tal como se escribió **antes** de construir, y se conserva así a propósito:
es el plan contra el que se puede leer lo que efectivamente pasó (el banner de arriba). Cuando una
sección quedó vieja, lo dice en su lugar en vez de reescribirse — mismo criterio que los cortes 4 y
5, que están escritos como reversiones de este mismo doc.*

**Estado en el momento de escribirlo: DIAGNOSTICADO Y MEDIDO, NADA CONSTRUIDO.** Los tres síntomas
tienen causa con línea de código, la API que los resuelve está probada contra el portal real, y
apareció un **defecto activo ese día** que había que arreglar sí o sí (§El bloqueante; lo cerró el
corte 1 → ADR-0014).

**Son cinco cortes, no tres.** Los dos últimos entraron el 2026-08-07 revirtiendo decisiones de este
mismo doc, y las dos reversiones salieron de medir, no de cambiar de opinión: **§Corte 4** topea la
calidad de Anatomy en 720p (no existía escalón 480, y hoy baja 1080), y **§Corte 5** mete los PDF
adentro (descubrirlos cuesta 7,1 s, no un frente aparte, y el `uuid` que faltaba estaba en el listado
todo el tiempo). Cada uno arranca con la medición que lo dio vuelta.

> **Si venís en frío**: leé §Los tres síntomas y §La medición, y después saltá a §Orden de cortes.
> El detalle del portal (selectores, contrato de la API, las cuatro trampas del DOM) vive en
> `portal-anatomy-by-chris-diseno.md`, que es su hogar canónico; acá está sólo lo del escaneo.

---

## Los tres síntomas, con su causa

El dueño los reportó como uno solo ("el scanner no anda bien"). Son tres, y ninguno es un bug del
scraper: son supuestos de Ramón Net aplicados a un portal de dos niveles.

### 1. "Hay que entrar a una clase para que aparezcan videos"

`sitio/anatomy-by-chris/scraper.js` se ancla en
`button[aria-expanded="true"][aria-controls^="sectionId_"]` — el módulo expandido, que **sólo existe
dentro de la página de una clase**. En la home del producto no hay ninguno y el escaneo devuelve
`{ materia: "", enlaces: [] }`.

Y `urlListado` del descriptor apunta **justo a esa home**, que es a donde el onboarding manda al
usuario: lo estamos mandando a la única página donde el escaneo no puede funcionar.

### 2. "Sólo aparece el módulo abierto, y los anteriores se pierden"

Dos cosas que se suman:

- **En el DOM sólo existe el módulo expandido.** Medido sobre las páginas guardadas: `div[data-hash]`
  en **toda la página** da exactamente las filas del módulo activo. Un módulo colapsado **no tiene su
  `<section>` renderizada** — no es que el scraper la ignore, es que no está.
- **Cada escaneo reemplaza el listado.** `popup.js:849` preserva sólo lo que ya está en la cola
  (`estado === 'process'`) y `:940` reconstruye `listadoClasesGlobal` con eso más lo nuevo. Lo
  escaneado y no encolado se descarta.

Con Ramón Net **un escaneo = el aula entera**, así que reemplazar era correcto. Con dos niveles cada
escaneo es un subconjunto distinto y la regla se vuelve destructiva.

### 3. "A veces no muestra ni los de la clase actual"

El sidebar se puebla por XHR — en la captura de recursos del dueño, la navegación del club llega a
los **~4,0 s** (`/v1/navigation`). El escaneo es una inyección **one-shot**: `executeScript` y listo,
sin espera ni reintento (el `safetyTimeout` de 6 s sólo apaga el loader). Si el popup se abre antes,
no hay `sectionId_` ni `div[data-hash]` y vuelve vacío.

**Y el vacío no es inocuo**, que es la parte fea:

```js
nodos.folder.value = resultado.materia || "biologia";   // popup.js:893 ← fallback de Ramón Net
if (!enlaces || enlaces.length === 0) {
  appState.listadoClasesGlobal = itemsEnCola;           // popup.js:896 ← borra lo que veías
```

O sea que un escaneo prematuro **vacía la lista** y deja el input de carpeta en `biologia`. Si
encolás sin mirar, los archivos van a `raíz/anatomy-by-chris/biologia/`. Ese `"biologia"` es el
fallback absoluto del scraper de Ramón Net filtrado a la capa genérica.

*(De yapa: el cartel de "sin clases" dice "Asegurate de estar dentro de una clase de **Ramón Net**",
hardcodeado, en el portal equivocado.)*

---

## La medición: `/v1/navigation` devuelve el curso entero

*2026-08-07. Crudo en `descargas/medicion-navigation.json` (no versionado).*

Una sola llamada, con el **mismo host y las mismas credenciales que `resolverManifiesto` ya usa**
(`Bearer <id_token>` + `x-product-id`, o sea lo que ADR-0013 ya guarda por portal):

```
GET api-club-course-consumption-gateway-ga.cb.hotmart.com/v1/navigation
→ { modules: [ { id, code, name, type, thumbnailUrl, locked, extra, pages: [...] } ], tags: [] }
```

**11 módulos, 114 clases.** Cada clase:

```json
{ "name": "Artrologia", "hash": "M7qypD3n7x", "type": "CONTENT",
  "locked": false, "completed": false, "hasPlayerMedia": true, "liberationStart": … }
```

| módulo | clases | video | texto |
|---|---:|---:|---:|
| Libros y Herramientas de Estudio | 2 | 0 | 2 |
| Generalidades de Anatomia | 1 | 1 | 0 |
| Miembro Superior | 14 | **12** | 2 |
| Miembro Inferior | 20 | 19 | 1 |
| Cuello | 6 | 4 | 2 |
| Tórax | 10 | 8 | 2 |
| Abdomen | 6 | 6 | 0 |
| Pelvis | 2 | 2 | 0 |
| Cabeza | 21 | 20 | 1 |
| Intensivos y Pinches | 22 | 21 | 1 |
| Intensivo Tórax, Cabeza y Cuello | 10 | 10 | 0 |
| **TOTAL** | **114** | **103** | **11** |

Tres cosas que esto habilita:

- **`hash` arma la URL de la clase** (`…/products/<id>/content/<hash>`), que es exactamente lo que
  `resolverManifiesto` parsea hoy (`RE_HASH_LECCION` + `RE_PRODUCT_ID`). **Encaja sin tocarlo.**
- **`hasPlayerMedia` es el discriminador video/texto como DATO.** Muere la trampa del thumbnail —la
  heurística que hoy deja clases afuera cuando el sidebar no terminó de pintar—.
- **Cruce que valida la medición vieja**: *Miembro Superior* da **14 clases / 12 con video**, que es
  exactamente lo que `portal-anatomy-by-chris-diseno.md` tenía anotado como cabo suelto sin resolver.
  Queda cerrado con dato.

Y el total de 114 coincide con la galería de 11 módulos de la home, medida en su momento por
separado.

### Por qué el `fetch` del SW no servía, y este sí

Es la misma asimetría del corte 7, vista desde el otro lado:

| | Ramón Net | Anatomy |
|---|---|---|
| El listado | está en el HTML del servidor | lo pinta **JS**, por XHR |
| Un `fetch` desde el SW | lo ve | **no ve nada** |

Por eso Ramón Net puede resolver con `fetch` + regex desde el service worker, y Anatomy no. Lo que
cambia ahora es que **el escaneo corre inyectado en la pestaña**, donde el origen `hotmart.com` ya
puede llamar a esa API —la llama el club mismo— y el `id_token` está en `localStorage`. **No hace
falta tocar el manifest.**

---

## El bloqueante: 7 colisiones de identidad, y ya están rotas hoy

Al medir los 114 títulos aparecieron **7 nombres que existen en dos módulos a la vez**:

```
Miologia 1 · 2 · 3 · 4 · 5 · 6   → Miembro Superior  Y  Miembro Inferior
Irrigación                        → Miembro Superior  Y  Miembro Inferior
```

`core/cola/identidadClase.ts` define la identidad como **(portal, título)**. Con dos clases
homónimas del mismo portal en la misma lista, el modo de fallar es exactamente el que ese módulo
documenta para dos portales — sólo que **intra-portal**:

- `popup.js:938` descarta la segunda al de-duplicar contra la cola;
- `procesadorCola.ts:352` y `:519`: al terminar una descarga, **sacan de la cola a su homónima**, que
  nunca se baja y desaparece sin un error;
- el espejo de progreso (`estados[identidad.clave(item)]`) pinta el avance de una en la fila de otra.

**Esto no lo introduce el escaneo por API: ya pasa hoy.** Alcanza con escanear *Miembro Superior*,
encolar `Miologia 1`, escanear *Miembro Inferior* y encolar `Miologia 1`. Traer los 11 módulos de una
lo vuelve **seguro** en vez de posible. Por eso está anotado como deuda abierta en
`TECHNICAL_DEBT.md`, independiente de que este frente se construya.

### La regla nueva

La identidad pasa a ser **(portal, módulo, tipo, título)**, donde `módulo` es el **origen** de la
clase, **no su carpeta de destino**. Es deliberado: la identidad tiene que decir *qué clase es*, no
*dónde decidiste guardarla* — si usara la carpeta destino, editarla rompería el match contra la cola.

**Por qué `tipo` entra ya, aunque el corte 1 sólo traiga videos.** Desde que los materiales están en
alcance (§Alcance), un PDF y el video del que cuelga comparten portal, módulo y —si el ítem hereda el
nombre de la lección— también título. Meter el campo ahora, con `"video"` por omisión, cuesta una
línea; agregarlo después obliga a volver a tocar `identidadClase` y sus tests con la cola ya en uso.
Es el mismo error que este frente está pagando: el par `(portal, título)` alcanzaba **hasta que
apareció un portal de dos niveles**.

Ramón Net no manda módulo ni tipo ⇒ su clave queda `ramonnet||video|Título`, semánticamente idéntica
a hoy. **No hay migración de datos**: la clave se calcula, no se persiste. El único lugar donde se
guarda es el espejo `EstadosProgreso`, que vive en `storage.session` y muere con la sesión del
navegador.

---

## Orden de cortes

Una rama por corte, y ninguno se mergea sin probarlo en Chrome (`rearquitectura-diseno.md`
§Verificación en navegador). Este frente toca **adaptador de sitio y Capa 1**: dos de los tres
disparadores declarados.

### Corte 1 — El escaneo por API, la carpeta por módulo y la identidad

Van **juntos a propósito**: la identidad sin módulos no es verificable, y el escaneo multi-módulo sin
identidad corrompe datos.

**Sin override todavía**: el input de carpeta se **ignora** para las clases que traen módulo; todo va
a la carpeta de su módulo. Eso lo hace seguro de probar.

| archivo | cambio |
|---|---|
| `core/cola/identidadClase.ts` | `ItemIdentificable` gana `modulo?` y `tipo?`; `clave()` → `portal\|modulo\|tipo\|titulo`, con `tipo` en `"video"` por omisión |
| `core/puertos/sitio.ts` | dos cambios **aditivos**: `escanearListado` puede devolver promesa; `EnlaceListado.modulo?` |
| `sitio/anatomy-by-chris/scraper.js` | reescrito: `async`, una llamada a `/v1/navigation`, filtra `hasPlayerMedia && !locked`, arma el `href` con el `hash`, cada enlace lleva su `modulo`. Sigue cosechando `credenciales` igual |
| `popup.js:854` | `await` del resultado — es el **único** call-site de `escanearListado` |
| `popup.js:893` | sacar el fallback `\|\| "biologia"` |
| `popup.js:896` | **no destruir la lista si el escaneo vuelve vacío** |
| `popup.js:912` | `materiaBase = item.modulo \|\| nodos.folder.value` → `clasificarCarpeta` ya devuelve la carpeta por clase, sin tocar el parser |
| `popup.js:749` | el listener del input **no toca `c.carpeta` de una clase que tiene módulo** |
| `popup.js:1052` | el match de disco deja de aplanar: cada clase contra los archivos **de su propio par (portal, carpeta)** |
| `sitio/ramonnet/**` | **cero** |

**Lo que NO hay que hacer** — verificado en el código, contra lo que parecía a simple vista:

- **La iteración de disco por carpeta ya existe.** `popup.js:1027-1052` arma pares únicos
  `(portal, carpeta)` y hace un `escanearDisco` por cada uno, en paralelo. Se construyó en el corte
  multiportal E. Lo único que falta es que el **match** deje de ser global.
- **La acumulación entre escaneos no hace falta**: un escaneo trae todo, así que no hay nada que
  acumular. El síntoma 2 se cae solo, sin tocar la regla que Ramón Net da por sentada.
- **El manifest no se toca** (ver §Por qué el fetch del SW no servía).
- **`parserTitulos.js` no se toca**: `formatearTitulo` ignora `materiaBase`, y los nombres de la API
  ya vienen sin la duración pegada —era un artefacto del DOM—. Los espacios al final y el portugués
  (`estúdios`) que sí traen, ya los cubre.

**Verificación en navegador**

1. **La inyección `async` resuelve.** Es lo único que ningún test puede ver: `executeScript` con una
   función `async` que hace `fetch`. Escanear desde una clase → **103 clases, 11 módulos**.
2. **Desde la home del producto también escanea.** (síntoma 1)
3. **Al instante de cargar la página también escanea**, sin esperar los ~4 s. (síntoma 3)
4. **La prueba de las colisiones**: encolar `Miologia 1` de *Miembro Superior* **y** de *Miembro
   Inferior*. Las dos sobreviven en la cola, las dos bajan, y caen en
   `raíz/anatomy-by-chris/miembro_superior/` y `…/miembro_inferior/`.
5. **El "ya descargado" no cruza módulos**: con una `Miologia 1` bajada, la otra sigue pendiente.
6. **Ramón Net intacto**: escanear, encolar y bajar una clase.

### Corte 2 — El override del input y su feedback

El input vuelve a mandar, pero **no destructivo y visible**. *(Opción elegida por el dueño el
2026-08-07 sobre la alternativa de dejarlo informativo.)*

**La regla**: `carpeta del ítem = override del input || carpeta de su módulo`, estampada **al
encolar** (como hoy). El override **no muta `c.carpeta`**: vive sólo en el input.

| archivo | cambio |
|---|---|
| `popup/features/queue.js:118` | `carpeta = override \|\| c.carpeta`, saneando el override igual que el scraper (NFD, `[^a-z0-9] → _`) |
| `popup.js` | placeholder del input (*"cada clase va a su módulo"*) cuando el escaneo trajo módulos |
| `popup/features/listaClases.preact.js` | chip de destino en `FilaClase`: el módulo, o `→ <override>` con override activo |
| `popup.js` | el botón de encolar dice el destino (`… → por módulo` / `… → /repaso_final/`) |

**Por qué el feedback no es adorno**: si el input puede pisar 103 destinos, tenés que ver el efecto
**antes** de encolar. Con el chip, escribir algo cambia las 103 filas a la vez y es imposible no
verlo.

**Consecuencia aceptada**: lo que bajes con override **no vuelve a aparecer como "ya descargado"**,
porque la marca se calcula mirando la carpeta del módulo. El override es una decisión *futura* y el
disco es *pasado*. Reconciliarlo exigiría persistir la carpeta con la que se bajó y consultarla
aparte — anotado, no construido.

**Verificación**: (1) sin tocar el input, cada fila muestra su módulo y encola ahí; (2) escribiendo
`repaso_final`, las 103 filas cambian el chip a la vez; (3) borrando el input vuelven a su módulo —
**no quedan en `""`**; (4) encolar con override → borrar → encolar otras: las primeras conservan su
carpeta.

### Corte 3 — Tests y documentación

**Tests**

- `sitio/anatomy-by-chris/scraper.test.js` se reescribe: el fixture HTML deja de ser la fuente y pasa
  a ser un doble de la respuesta de `/v1/navigation`, recortado del JSON real. **Es una pérdida y va
  escrita**: hoy ese test es "la única observación real hasta el navegador". Se gana que el escaneo
  ya no dependa del DOM, que es de donde salen los tres síntomas.
- `core/cola/identidadClase.test.ts`: las 7 colisiones reales, y que Ramón Net (sin módulo) conserva
  su semántica.
- `popup/features/queue.test.js`: el override y su ausencia. **Ojo**: hay un test que hoy afirma
  `carpeta === 'biologia'` "toma nodos.folder" y va a cambiar de significado.
- Un test del match de disco por par (que un archivo de una carpeta no marque la clase de otra).

**Documentación**: este doc, `portal-anatomy-by-chris-diseno.md`, `multisitio-diseno.md`,
`TECHNICAL_DEBT.md`, `docs/testing.md` (baseline) y un **ADR nuevo** por la identidad.

---

## Alcance

**Los cortes 4 y 5 entraron el 2026-08-07, revirtiendo dos decisiones de este mismo doc.** Las dos
salieron de medir; el registro de por qué la medición cambió la decisión está en cada corte. Lo que
sigue afuera:

- **Los `complementaryReadings`** (el otro array que devuelve el mismo endpoint, siempre vacío en las
  114 lecciones de este curso). No hay caso que probar.
- **Las clases de tipo Texto como contenido**: se siguen descartando por `hasPlayerMedia === false`.
  Sus adjuntos sí entran por el corte 5 — que es justamente por qué *Libros y Herramientas de
  Estudio* deja de devolver cero.
- **La duración de cada clase.** `/v1/navigation` **no la trae** (medido: sus campos son `name`,
  `hash`, `type`, `locked`, `completed`, `hasPlayerMedia`, `liberationStart`,
  `minimumScoreRequired`). Mostrarla costaría una llamada por clase. Anotado como límite conocido de
  la UI, no como pendiente.
- **Reconciliar el "ya descargado" con el override de carpeta** (§Corte 2).

---

## Corte 4 — La calidad: Anatomy se topea en 720p

### La medición que lo motivó (2026-08-07)

Hasta acá la resolución de Anatomy figuraba como *"no verificada"*: `elegirVariante` toma la de mayor
`BANDWIDTH`, pero **nunca se había abierto un master de ese portal**. Se abrió. La escalera real —
clase *Osteologia*, Miembro Superior:

| RESOLUTION | alto | BANDWIDTH | ≈ MB/hora | URI |
|---|---:|---:|---:|---|
| 400×240 | 240 | 136 kbps | 58 | `…video=44974.m3u8` |
| 600×360 | 360 | 170 kbps | 73 | `…video=77014.m3u8` |
| 900×540 | 540 | 222 kbps | 95 | `…video=126326.m3u8` |
| 1200×720 | 720 | 277 kbps | 119 | `…video=177920.m3u8` |
| 1800×1080 | 1080 | 403 kbps | 173 | `…video=297419.m3u8` |

Tres hallazgos, y ninguno se podía anticipar sin mirar:

1. **No existe escalón 480.** "Clavarlo en 480p" era irrealizable tal cual: hay que elegir vecino.
2. **Hoy baja 1080p** (`video=297419`, que es la URI que ya figuraba en el doc del portal sin que
   nadie supiera a qué escalón correspondía). El ítem "no verificado" queda cerrado.
3. **El `height` de `mediaAssets` no mentía.** Las cinco entradas comparten la **misma URL** —esa
   trampa sigue en pie— pero sus alturas (240/360/540/720/1080) son exactamente los escalones del
   master. Sirve como catálogo, nunca como origen de URL.

**Y el dato que dio vuelta la decisión: la referencia real del dueño.** Se midieron los 29 videos de
Ramón Net ya descargados (`Karla/ramonnet/anatomia`): **10,73 GB en 45,3 h → 243 MB/hora, 565 kbps,
alto 480**. O sea que **el 1080p de Anatomy (173 MB/h) ya pesa un 29 % menos por hora que el 480p que
se viene bajando todos los días**. Hotmart comprime mucho más, así que la escala mental traída de
Ramón Net no se traslada — y "bajar a 480 para ahorrar" resultaba ser un recorte mucho más grande de
lo que parecía.

> **Nota de método**: esos `.mp4` **son MPEG-TS**, no MP4 — primer byte `0x47`, el backend concatena
> los `.ts` crudos y sólo cambia el nombre. Por eso Windows no muestra duración ni resolución. Las
> cifras salieron de leer el PCR (reloj de 90 kHz) y el SPS H.264 del propio stream. Si alguien
> vuelve a medir esta carpeta, que no empiece por las propiedades del Explorador.

### La decisión

**Anatomy se topea en 720p** (elegido por el dueño con la tabla de arriba a la vista). Queda a ~119
MB/hora: la mitad que su normal de Ramón Net, y con más definición que él.

**La regla no es un número pelado**, y eso importa más que el número:

> el escalón **más alto cuyo `RESOLUTION` no pase del tope**; si ninguno baja de ahí, **el más
> chico** disponible.

Así degrada sola si Hotmart cambia la escalera. Un `elegirVariante` que buscara "720 exacto" se
rompería en silencio el día que ese escalón no esté — y el modo de fallar sería el peor de todos:
volver a traer el master o la variante equivocada, que `hlsEngine` no distingue (ver la regla del
master multi-variante en `CLAUDE.md`).

| archivo | cambio |
|---|---|
| `sitio/anatomy-by-chris/config.ts` | constante nueva `alturaMaxima: 720` |
| `sitio/anatomy-by-chris/resolverManifiesto.js:176` | `elegirVariante` deja de ordenar por `BANDWIDTH`: parsea `RESOLUTION=<w>x<h>` y aplica la regla. Fallback a `BANDWIDTH` **sólo** si ninguna variante declara `RESOLUTION` |
| `sitio/anatomy-by-chris/resolverManifiesto.test.js` | la escalera real de cinco como fixture: que elija 720; que con tope 480 elija 360; que sin `RESOLUTION` en ninguna caiga al criterio viejo; que con una sola variante la tome |

**Ramón Net no se toca.** Su 480p vive en la plantilla de URL (`plantillaM3u8`), no en un master, así
que no hay escalera que recorrer. Revisarlo —¿el CDN sirve 720p?— sigue siendo otro frente.

**Verificación en navegador**: bajar una clase y mirar el peso. A 720p una clase de ~40 min tiene que
pesar ~80 MB. Si pesa ~115 MB es 1080 (la regla no se aplicó); si pesa KB, se coló el master.

---

## Corte 5 — Los materiales (PDF) entran

### La medición que lo motivó (2026-08-07)

La decisión anterior —materiales afuera— se apoyaba en dos supuestos, y **los dos resultaron falsos
al medirlos**:

| supuesto | medido |
|---|---|
| "descubrir cuáles tienen material cuesta 114 llamadas, o sea un frente aparte" | **7,1 segundos** las 114 con 6 en paralelo, **cero errores**. Entra en el escaneo normal |
| "falta saber de dónde sale el `uuid` del adjunto" (el único hueco del Apéndice B) | Sale del listado mismo: **`fileMembershipId`** |

La forma real de `GET /v1/pages/<hash>/complementary-content`:

```json
{ "complementaryReadings": [],
  "attachments": [ { "fileOrder": 4,
                     "fileMembershipId": "641db8a0-b918-4460-b007-a001b9f79bb5",
                     "fileName": "PDF DIAPOSITIVAS MMSS_watermark (1).pdf",
                     "fileSize": 83952102 } ] }
```

- **15 de las 114 lecciones** tienen adjuntos. Las otras 99 devuelven **exactamente 45 bytes**
  (`{"complementaryReadings":[],"attachments":[]}`), así que se descartan por largo sin interpretar.
- **`fileSize` viene en el listado**, y hace falta mostrarlo: en la lección más cargada conviven un
  PDF de **83,9 MB** con guías de 90 KB.
- Los adjuntos **no cuelgan sólo de clases con video**: la lección más cargada es *Intensivo Miembro
  Superior 2*, y varias de las 15 están en *Libros y Herramientas de Estudio* — el módulo que hoy el
  escaneo devuelve vacío, correctamente, porque no tiene videos. Con este corte deja de ser cero.

### Lo que hay que construir

La cadena de descarga ya está medida entera (`portal-anatomy-by-chris-diseno.md` §Apéndice B) y ahora
sin huecos: **listado → URL firmada (`rest/v3/attachment/<fileMembershipId>/download`) → CloudFront**,
donde el último salto va **sin credenciales** y la firma dura **1 hora**.

| archivo | cambio |
|---|---|
| `core/puertos/sitio.ts` | `EnlaceListado` gana `tipo?: "video" \| "adjunto"` y, para adjuntos, `idArchivo` + `bytes` |
| `sitio/anatomy-by-chris/scraper.js` | tras `/v1/navigation`, un `complementary-content` por lección con pool de 6; emite un enlace por adjunto |
| `sitio/anatomy-by-chris/descargarAdjunto.js` | **módulo nuevo**: los dos fetch finales. Cuarto hermano `.js` del adaptador ⇒ global propio (`DescargarAdjuntoAnatomy`) y entrada en `globalesDelProyecto` |
| `core/cola/procesadorCola.ts` | rama por `tipo`: `"adjunto"` no pasa por `hlsEngine` |
| `popup/features/listaClases.preact.js` | indicador de tipo y peso en la fila |
| `popup/features/filtros*` | filtro video / PDF |

**Las cuatro trampas** ya identificadas en el §Apéndice C de ese doc siguen valiendo, con una
resuelta: la identidad ya lleva `tipo` desde el corte 1 (§La regla nueva), así que este corte **no
vuelve a tocar `identidadClase`**.

⚠️ **Lo que este corte NO tiene medido**: cómo reacciona el backend Bun a un archivo que no viene por
fragmentos. `hlsEngine` no interviene, pero el destino en disco sigue siendo el mismo servidor, y es
**otro repo**. Medirlo es el primer paso del corte, antes de escribir la UI.

**Verificación en navegador**: (1) escanear y ver los 15 con su peso; (2) bajar el PDF de 90 KB y
abrirlo; (3) bajar el de 83,9 MB —el único que ejercita la firma de 1 hora contra una descarga
larga—; (4) el filtro deja sólo videos y sólo PDF; (5) *Libros y Herramientas de Estudio* ya no
devuelve cero.

---

## Registro de riesgos — lo que rompe en silencio

| # | Riesgo | Quién lo detecta |
|---|---|---|
| R1 | La función inyectada deja de ser **autocontenida** (tentación: sacar la URL de la API o un regex a una constante del archivo) | **Sólo el navegador.** Ni bundler, ni lint, ni `tsc`, ni la suite |
| R2 | La inyección `async` no resuelve y el escaneo vuelve vacío | Sólo el navegador (chequeo 1) |
| R3 | Queda una comparación por título sin pasar por `identidadClase` | Los tests de colisión + el chequeo 4 |
| R4 | El listener del input vuelve a escribir `c.carpeta` y al limpiarlo las deja en `""` | Chequeo 3 del corte 2 |
| R5 | El match de disco global marca descargada una clase de otro módulo | Chequeo 5 del corte 1 |
| R6 | `cancelarDescarga(titulo, sessionId, sitioId)` **no lleva carpeta**: dos `.part` homónimos en carpetas distintas del mismo portal podrían confundirse. El backend es **otro repo** | Cancelar una descarga de `Miologia 1` con la otra a medias. Riesgo bajo (la cola es secuencial), pero hay que mirarlo |
| R7 | `elegirVariante` busca el tope **exacto** en vez de "el más alto que no lo pase". El día que Hotmart saque el escalón 720 devuelve el master o nada, y `hlsEngine` **no distingue un master**: baja un `.m3u8` creyéndolo `.ts` y manda al backend un archivo de KB | El test de la escalera sin 720 + el peso del archivo. **En producción, nada** |
| R8 | La URL firmada del adjunto vence a la **hora**. Si se resuelve al escanear en vez de al descargar, una cola larga de PDF empieza a fallar a mitad de camino | Sólo bajando muchos PDF seguidos. Se previene resolviéndola **por ítem al bajar**, igual que las credenciales |
| R9 | El backend Bun recibe un archivo entero en vez de fragmentos y no está medido cómo reacciona (otro repo) | El primer PDF que se baje. **Medirlo antes de escribir la UI del corte 5** |
