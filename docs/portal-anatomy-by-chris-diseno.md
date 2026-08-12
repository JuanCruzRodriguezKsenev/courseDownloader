# Portal nuevo: Anatomy by Chris (Hotmart Club) — diseño de ejecución

**Estado al 2026-08-07: CONSTRUIDO Y VERIFICADO EN NAVEGADOR — el corte 7 está cerrado.** El
adaptador entero está escrito y con tests (`sitio/anatomy-by-chris/`), el portal está registrado,
el manifest tiene sus cinco orígenes y su ruleset, y las cuatro verificaciones dan verde. Las
cuatro casillas de abajo pasaron: escaneo, descarga de punta a punta (tras cuatro arreglos),
`patronPestañas` y las dos colas mezcladas.

> **Que esté verificado no quiere decir que el portal esté terminado.** El escaneo por DOM sólo ve
> el módulo abierto y la identidad `(portal, título)` pierde descargas dentro de este portal — los
> dos frentes viven en `escaneo-api-anatomy-diseno.md`, y el corte 1 de ahí **rehace lo que la
> casilla 4 probó**.

Es **el corte 7** de `multisitio-diseno.md` — el último que quedaba de aquel frente.

> ## ⚠️ El escaneo de este portal tiene un frente abierto (2026-08-07)
>
> Usarlo destapó que **el escaneo por DOM no sirve para este portal**: hay que entrar a una clase
> para que aparezca algo, sólo se ve el módulo abierto, y a veces no se ve ni ése. Los tres
> síntomas tienen causa medida y la solución también: **una sola llamada a `/v1/navigation`
> devuelve los 11 módulos y las 114 clases**, con el tipo video/texto como dato.
>
> **Y destapó un defecto activo hoy**: 7 títulos existen en dos módulos a la vez
> (`Miologia 1..6`, `Irrigación`), y la identidad `(portal, título)` los trata como uno solo — con
> lo cual completar una descarga **saca de la cola a su homónima**, que nunca se baja. No hace
> falta escanear por API para que pase: alcanza con encolar las dos escaneando cada módulo por
> separado.
>
> **Diagnóstico, medición y plan de cortes: `escaneo-api-anatomy-diseno.md`.** La deuda de la
> identidad está además en `TECHNICAL_DEBT.md` §🔴 Abierto, porque es independiente de que ese
> frente se construya.

> **Este doc no reemplaza a `multisitio-diseno.md` §Cómo escribir un portal nuevo**: son los
> cinco pasos de allá, con los valores y los hallazgos de ESTE portal, más lo que aquel paso a
> paso no cubría y acá apareció.

## Verificación en navegador: qué pasó y qué falta

Los 7 puntos de `rearquitectura-diseno.md` §Verificación en navegador, más lo específico de este
portal:

### ✅ 1. El escaneo (2026-08-07)

Escaneado un módulo en Chrome: **aparecieron ~14 clases**. Con eso queda contestado **lo único
que ningún test de este proyecto puede ver: que `escanearListado` sobrevive a ser serializada**
por `chrome.scripting`. Era el riesgo más grande del corte.

> **CERRADO el 2026-08-07 con dato, no con conteo.** La medición de `/v1/navigation`
> (ver `escaneo-api-anatomy-diseno.md` §La medición) dice que *Miembro Superior* tiene
> **14 clases, 12 con video y 2 de Texto**. O sea que lo esperable eran 12 y las ~14 que
> aparecieron significan que **se colaron las dos de Texto**: la heurística del thumbnail no las
> descartó. No es grave ni silencioso —al bajarlas, `resolverManifiesto` corta con "no trae ningún
> media" y el bucle las saltea—, pero es una de las razones por las que el escaneo pasa a la API,
> donde el tipo viene como dato (`hasPlayerMedia`) en vez de adivinarse.

**Lo que ese conteo NO confirmaba**, y quedó contestado arriba: no se registró **qué módulo** era,
así que el número no se pudo cruzar contra el portal. Los tres chequeos de 30 segundos:

- Que **ningún título** diga "Ícono de un curso del tipo Texto" ni "Tocando ahora", ni termine con
  un espacio o con una duración (`02:55`) → trampas 1 y 2.
- Que el campo de **materia** sea el nombre del **módulo** (`miembro_superior`), no el título de
  la clase que estaba abierta → si dice el título, el scraper está leyendo el `<h1>`.
- Que la cantidad coincida con las filas **con miniatura** del sidebar. Ojo con el conteo de
  *Miembro Superior*: la medición anotó **14 filas** en el módulo pero **12 con `mediaCode`**, así
  que ahí lo esperable son 12, no 14. Si aparecieron 14, o el conteo viejo contaba otra cosa o se
  colaron dos clases de Texto — que no es grave ni silencioso: al bajarlas, `resolverManifiesto`
  corta con "no trae ningún media" y el bucle las saltea.

### ✅ 2. Bajar una clase entera — *funciona (2026-08-07), después de CUATRO arreglos*

Que el archivo caiga en `raíz/anatomy-by-chris/<módulo>/`. Acá se contesta **si la regla dNR del
`Referer` funciona de verdad** (*pendiente 1f*): si no, el paso 2 de `resolverManifiesto` corta
con un 401 y el mensaje lo dice. También se ve si la variante elegida es la correcta — un archivo
de unos KB en vez del video sería el master colándose.

> **Corrido el 2026-08-07. Resultado: los pasos 1 y 2 pasan, el 3 da `HTTP 403`.**
>
> Lo que quedó **confirmado** de paso, y no es poco: las credenciales por portal funcionan (la API
> de lecciones contestó 200 con el `id_token` cosechado por el scraper) y **la regla dNR del
> `Referer` funciona desde el service worker** — el embed no dio 401, que era el *pendiente 1f*. De
> yapa quedó probado que `resourceTypes: ["xmlhttprequest"]` matchea un `fetch` del SW, dato que
> vale para cualquier regla futura.
>
> **El 403 del master.** El mensaje de error que lo reportaba decía que el `hdnts` se había
> resuelto tarde (vive 500 s), y **eso era imposible**: el master sale del `__NEXT_DATA__` del
> embed y se pide en el `await` siguiente, milisegundos después. La hipótesis en pie es hotlink
> protection del CDN — la regla dNR ponía el `Referer` sólo para `cf-embed.play.hotmart.com`, y el
> master vive en **otro host** (`vod-akm.play.hotmart.com`), donde el fetch del SW sale sin
> `Referer` ni `Origin`. Es la misma trampa del paso 2, un host más adelante, y la medición
> original no la vio porque se hizo **desde una pestaña**, donde el navegador manda el `Referer`
> solo. Arreglo aplicado: una segunda regla en `rules.json` para `vod-akm.play.hotmart.com` y
> `contentplayer.hotmart.com` —los dos, porque por ahí viajan también la clave AES y los
> fragmentos, y arreglar sólo el master haría que cortara en la clave—. **Falta confirmarlo en el
> navegador**; si el 403 sigue, la causa es otra y el mensaje de error nuevo ya no manda al lugar
> equivocado.
>
> **Segunda corrida, con la regla puesta: el master pasa y ahora fallan los FRAGMENTOS**, también
> con 403 — pero por otra causa, y ésta tampoco es del portal. Las URLs que armaba el motor salían
> con **dos `?`**:
>
> ```
> …-video=297419.m3u8?hdntl=exp=1786229269~acl=/  +  …-1.ts?hdntl=exp=1786229269~acl=/*~hmac=…
> ```
>
> `core/hls/hlsEngine.ts` resolvía las referencias relativas cortando la base por el **último `/`
> de la cadena entera**, y Akamai firma con `~acl=/*` **en el query**: ese `/` es el último, así
> que el corte caía adentro del query. Ramón Net nunca lo destapó porque su playlist no lleva
> query. Se pasó a `new URL(ref, base)`, que es la resolución del estándar — y de paso arregla las
> rutas absolutas y las protocol-relative, que la concatenación armaba mal en silencio. **Es un bug
> del motor, no de este portal**: cualquier CDN que firme así lo dispara, así que vive en Capa 1 y
> tiene sus tests con la URL real.
>
> Ojo con el costo que tenía: el motor reintenta **4 veces por fragmento con backoff**, así que
> cada clase tardaba ~15 s en fallar por esto, con 6 workers gritando en la consola.
>
> **Tercera corrida: baja entera pero la MISMA clase se vuelve a bajar, en loop infinito.** Y acá
> el service worker no tenía nada que ver — hacía todo bien. El aviso `clase_guardada_ok` viajaba
> con `titulo` y **sin `sitioId`**, así que el popup comparaba `"anatomy-by-chris|Osteologia"`
> contra `"ramonnet|Osteologia"` (la migración manda el id ausente al portal legado), no
> reconocía la clase, no la sacaba de su copia de la cola, y su `respaldar()` reescribía esa copia
> **encima de la cola que el SW acababa de vaciar**. En Ramón Net no se veía porque su id *es* el
> legado. La regla que salió de acá vive en `docs/patterns.md` §IPC. De paso apareció un
> `c.titulo === req.titulo` sobreviviente en el mismo handler, que marcaba como descargada a la
> homónima del **otro** portal.
>
> **Cómo se encontró, que es lo que conviene copiar**: instrumentando el bucle. Tiene cinco
> `return` que no loguean nada, así que "no hizo nada" y "salió por acá" se ven igual desde
> afuera. Con una traza en cada salida y en el arranque, dos líneas de consola alcanzaron —
> `cola 1 → 0` seguido de `la cola tiene 1`— para saber que el problema estaba **después** de la
> escritura y no en ella. Las trazas se sacaron una vez encontrado el bug.
>
> **Y destapó un bug que no era de este portal**: el 403 se le mostró al usuario como *"se perdió
> la conexión a internet"*, con el daemon midiendo `internet=true` una línea antes, y con el
> auto-heal reintentando cada 12 s para siempre. Era el `else` de la heurística de
> `procesadorCola.ts`, que afirmaba "internet" cuando no reconocía el mensaje. Estaba bien mientras
> hubo dos orígenes de fallo (backend local y red); el portal es un tercero. El fix agregó dos
> ramas (`tipoPortal: "rechazo"` / `"bloqueo"`) y cambió ese `else` por `"desconocido"`. Detalle en
> el header de `core/cola/procesadorCola.ts` y en `docs/data-model.md`.

### ⬜ 3. Que `patronPestañas` matchee

(`https://hotmart.com/*/club/anatomy-by-chris/*`, con el `/*/` del segmento de idioma.) Se ve al
clickear la notificación de un fallo de este portal: si no matchea, abre una pestaña nueva en vez
de enfocar la abierta. *(Era el pendiente 5.)*

> **✅ CERRADA el 2026-08-07.** El fallo se forzó **apagando el backend Bun** con una clase de
> Anatomy encolada: eso cae en la rama (6) de `procesadorCola.ts`, el daemon la tipa `"servidor"` y
> la notificación sale con el `sitioId` adentro del `notificationId` (corte 8 del multisitio).
> Clickeada, **enfocó la pestaña de Anatomy ya abierta**. O sea que matchean las dos cosas que este
> punto prueba: el `/*/` del idioma en el patrón y el `sitioId` viajando en el id de la
> notificación.
>
> **Por qué apagar el Bun sirve para forzarlo**, y conviene saberlo para repetir la prueba: el
> arranque de la cola no lo bloquea, porque `verificarRedAntesDeDescargar` (`queue.js`) mira
> **sólo `.internet`**, no el backend. Con el backend caído la ráfaga arranca igual y falla al
> streamear, que es justo lo que hace falta.

### ✅ 4. Con las dos colas mezcladas (2026-08-07)

Una clase de cada portal encolada a la vez: la sección Portal del filtro, el criterio de orden
`portal`, que la faceta elegida en Ramón Net no afecte a éste, y que completar una clase no saque
de la cola a su homónima del otro portal. Todo eso tenía tests, pero **con dobles** — es la lista
del final de `multisitio-diseno.md` §Cómo escribir un portal nuevo.

> **Verificada por el dueño el 2026-08-07**, usando los dos portales a la vez. **Lo que quedó
> registrado es el resultado global —"funciona"—, no un desglose punto por punto**, y se anota así
> a propósito: es más débil que las tres casillas de arriba, que sí tienen medición.
>
> **Y tiene fecha de vencimiento corta**: el corte 1 de `escaneo-api-anatomy-diseno.md` reescribe
> `identidadClase` de `portal|titulo` a `portal|modulo|tipo|titulo`, que es exactamente el cuarto
> punto de esta casilla. **Hay que volver a correrla después de ese corte**, y ahí conviene el
> desglose: encolar `Miologia 1` de los dos módulos y ver que las dos sobreviven.

---

## Los tipos de contenido, y los PDF

Medido el 2026-08-07 sobre los **cuatro** HTML guardados. **Hay dos tipos de clase, y ningún PDF
como clase** — pero sí, y esto se midió después, **PDF como *materiales* de una clase**. Ver
§Los materiales, más abajo.

| Tipo | Cómo se reconoce en el DOM | Qué hace el adaptador |
|---|---|---|
| **Video** | La fila trae `[data-test="content-background-thumbnail"]` / `img[src*="/thumbnail/"]`, de donde sale el `mediaCode` | Es lo único que devuelve `escanearListado` |
| **Texto** | Ícono `data-icon="file-lines"` + `<title>` "Ícono de un curso del tipo Texto", **sin** thumbnail | **Se descarta en el escaneo**: no llega a la lista ni se puede encolar |

**Consecuencia**: escanear *Libros y Herramientas de Estudio* devuelve **cero** clases, y eso es
lo correcto, no un fallo.

### Los materiales: sí existen, sí los sirve Hotmart, y **entran** (revertido más abajo)

*Medido el 2026-08-07 sobre `pagina 4.html`.* **Esta sección corrigió a la anterior**: hasta esa
medición el doc afirmaba *"los PDF existen, pero no los sirve Hotmart"* y daba el material por
distribuido sólo vía Google Drive. **Es falso.** Hotmart sirve adjuntos propios; lo que pasaba es
que ninguna de las tres primeras muestras los mostraba.

**La pestaña "Materiales" y su contenido los inyecta JavaScript al clickearla** — la misma trampa
que el iframe del player, y se prueba igual, comparando dos capturas de **la misma clase**:

| | `pagina 2.html` | `pagina 4.html` |
|---|---|---|
| `[data-test="materials-tab"]` | **no existe en el DOM** | 5 hijos |
| `[data-test="material-item-name"]` | 0 | 5 |
| el trigger de la pestaña | — | dice `Materiales` **5** |

Las dos son *Libros y Herramientas* (`K4kk5ZoE4Y`, `sectionId_1`). *(En `pagina 3.html` el
contenedor existe pero está vacío: puede ser que esa clase no tenga materiales o que no se haya
abierto la pestaña — con esa muestra no se distingue, y ya no importa.)*

Los cinco de esa clase son **PDF nativos del portal**, no links a Drive: `HUMAN ANATOMY ATLAS.pdf`
(640,92 KB), `Yokochi 6ta ED.pdf` (49,75 MB), `Para colorear 2ED_compressed.pdf` (64,97 MB),
`Atlas_Fotografico_Anatomia.pdf` (19,91 MB) y `Atlas fotográfico de Anatomia Humana -
(Atualizado).pdf` (59,01 MB). ~194 MB.

Los links de **Google Drive** siguen existiendo y son **otra cosa**: viven en el **cuerpo de texto**
de la clase (un `<a>` a `drive.google.com` junto a la mención de `"HUMAN ANATOMY ATLAS.PDF"`), no en
la pestaña de materiales. No confundirlos: el mismo archivo aparece por los dos caminos.

### 🔄 REVERTIDO el 2026-08-07 (misma fecha, más tarde): los materiales ENTRAN

**La decisión de dejarlos afuera duró unas horas y la dieron vuelta dos mediciones.** Se deja el
razonamiento viejo abajo, tachado en su sentido pero no borrado, porque el registro de *por qué una
decisión bien argumentada resultó estar mal* vale más que la decisión.

| motivo de exclusión | qué lo tumbó |
|---|---|
| **1. "No se pueden scrapear: el uuid no está en el DOM"** | Cierto sobre el DOM, irrelevante: el escaneo dejó de leer DOM. `GET /v1/pages/<hash>/complementary-content` devuelve el uuid en **`fileMembershipId`**, con `fileName` y `fileSize` al lado. Era el **único** hueco del §Apéndice B, y era esto |
| **2. "El motor no los puede llevar"** | Sigue siendo cierto y sigue costando: es una rama en `procesadorCola` que saltea `hlsEngine`. Lo que cambió es el denominador — dejó de ser "un frente entero para cinco archivos" |
| **3. "Cuelgan de una lección, no de un módulo, y enumerarlos exigiría abrir cada clase"** | **Falso a partir del escaneo por API.** No hay que abrir nada: **7,1 segundos** las 114 lecciones con 6 en paralelo, cero errores. Y no son cinco archivos de una clase: son **15 lecciones con adjuntos** en todo el curso |

Y la premisa de fondo —"valor bajo, son un botón que ya funciona"— también se cayó al medir el
alcance real: no es una clase con materiales, es **el 13 % del curso**, repartido en módulos que el
escaneo hoy ni siquiera muestra.

**Estado actual: ✅ CONSTRUIDO Y FUNCIONANDO** (corte 5 de `escaneo-api-anatomy-diseno.md`,
verificado en navegador el 2026-08-07). Los PDF se escanean, se encolan y se bajan a la carpeta de
su módulo con su nombre y su extensión.

**Lo que seguía sin medirse ya se midió, y no salió gratis**: el backend Bun le pegaba `.mp4` a
todo, así que un adjunto salía `Atlas.pdf.mp4`. Se resolvió con un header nuevo (`x-file-name`) y
**tres cambios en el otro repo** — el nombre, el escaneo de disco que sólo miraba `.mp4`, y los
`.part` que ese mismo arreglo dejó entrar. Contrato y detalle en `docs/deployment.md`. La cadena de descarga está en §Apéndice B —ya **sin huecos**— y el
diseño con sus cuatro trampas en §Apéndice C, del que una ya se resolvió: la identidad lleva `tipo`
desde el corte 1.

---

## Historia de la medición (por qué el plan cambió dos veces)

*Esta sección quedó como registro: los tres bloques de abajo son el orden en que se destrabó el
portal. Nada de acá está pendiente.*

**Punto de partida (2026-08-06): las dos páginas guardadas no contenían un solo video.** No fue un
descuido de la medición: el módulo del que salió la muestra resultó ser el único de los once cuyas
clases son de tipo **Texto**. Con eso, `resolverManifiesto` —la pieza más frágil de un adaptador,
la que degrada en silencio resolviendo el video de otra clase— no se podía escribir sin suponer, y
suponer ahí es justo lo que este repo prohíbe. La decisión de aquel día fue escribir el adaptador
**completo salvo esa pieza**, dejándola tirar un "no implementado".

**Quedó sin efecto el 2026-08-07**: la medición en navegador completó la cadena, así que la pieza
se escribió entera. Lo que sigue son los tres hallazgos que la destrabaron.

### ✅ La pregunta que podía invalidar el portal ya está contestada: NO hay DRM

Medido en el navegador el **2026-08-07**. El reproductor es un `<iframe>` a
`cf-embed.play.hotmart.com/embed/<mediaCode>` con un **JWT en el query string**, cuyo payload dice:

```json
{ "mediaCode": "5Z1odEbEqX", "playDrm": false, "exp": 1786158607, "iat": 1786072207 }
```

- **`playDrm: false`** ⇒ no hay Widevine, así que `core/hls/hlsEngine.ts` puede con esto y el
  portal **es viable**. Era la pregunta que decidía si el resto del trabajo tenía sentido.
- El iframe carga **video.js 7.15.7**, que reproduce HLS vía VHS. Es indicio fuerte del `.m3u8`,
  **no prueba** — el manifiesto todavía no se vio.
- **El token dura 24 h exactas** (`exp - iat = 86400`). No se puede resolver una vez y guardarlo
  junto al ítem de la cola: hay que resolverlo por descarga.

### 🔴 Y destapó un problema de arquitectura que no estaba en la medición

**El iframe del player lo inyecta JavaScript; no está en el HTML que devuelve el servidor.** Eso
rompe el mecanismo de `resolverManifiesto` tal como funciona en Ramón Net —`fetch(urlClase)` +
regex sobre el HTML crudo—, porque **`resolverManifiesto` corre en el service worker**, que no
ejecuta el JS de la página y por lo tanto nunca va a ver ese iframe.

No es opinable: se ve comparando las dos muestras de la misma clase. `pagina 2.html` (guardada
antes de que el player montara) **no tiene ningún iframe de player**; `pagina 3.html` (guardada con
el video andando) **sí**.

### ✅ Y se resolvió por API — el contrato, medido el 2026-08-07

```
GET https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons/<hash>
  Authorization: Bearer <id_token>
  x-product-id: <productId>
```

```jsonc
{ "hash": "M7qypD3n7x", "name": "Artrologia", "type": "CONTENT",
  "module": { "id": "YOm6q5b64d", "name": "Miembro Superior" },
  "hasMedia": true, "locked": false,
  "medias": [{ "code": "WLagKxokRk", "type": "VIDEO",
               "name": "Articulacion de MMSS.mp4", "size": 1913076288, "duration": 3879,
               "url": "https://cf-embed.play.hotmart.com/embed/WLagKxokRk?…&jwtToken=<fresco>" }] }
```

**Esto desarma el problema entero**, porque `medias[].url` trae un `jwtToken` **recién emitido en
cada llamada**: el service worker pide la lección al bajar y no le importa que el token dure 24 h.

Las dos credenciales, medidas (importa la distinción, costó un rato):

| dato | de dónde sale | forma | vida |
|---|---|---|---|
| `Authorization` | `localStorage["token"]` = el `id_token` de `oidc.user:…` | **JWT** (1864 chars) | `expires_at` daba **~12 días** |
| `x-product-id` | la URL del portal (`/products/**6083220**`) | número | — |

- **El `access_token` de OIDC (opaco, 42 chars) NO sirve** para esta API; el que va es el `id_token`.
  Pero ojo: con *ninguno* de los dos anda si falta `x-product-id` — el fallo es un
  `400 Validation error: Required header 'x-product-id' is not present`, que **no parece de auth** y
  hace perder tiempo. Que el cuerpo del 400 nombre el header es lo que lo destrabó.
- **Que el token dure ~12 días es lo que salva el diseño**: el popup lo lee de la pestaña al
  escanear y el SW lo usa durante días, sin pestaña. Si hubiera durado una hora, la cola habría
  quedado atada a que el portal estuviera abierto — justo lo que ADR-0010 evita.

**⚠️ El costo: esto sí tocó Capa 1.** El token nace en la pestaña y lo necesita el service worker,
y `ResultadoEscaneo` era `{ materia, enlaces[] }`. Este portal **rompió la promesa de "un portal
nuevo no toca `core/`"** del corte 7.

**Resuelto el 2026-08-07, después de medir el slice (pendiente 1d)** — la medición está abajo, en
§El slice de credenciales. La decisión y sus alternativas quedaron en
[ADR-0013](adr/0013-credenciales-por-portal.md): las credenciales son del par (usuario, portal),
no de la clase, y viven en `core/estado/credencialesPortal.ts`. Ramón Net no cambió una línea.

*(La alternativa que quedó descartada pero anotada, por si la API cambia: cosechar el `mediaCode`
del thumbnail en el escaneo —ver §La regla de anclaje— y guardar el `medias[].url` ya resuelto al
encolar. Evita el token en el SW, pero obliga a que la descarga arranque dentro de las 24 h del
`jwtToken`, que es justo lo que la cola desacoplada existe para no exigir.)*

### El slice de credenciales, medido (pendiente 1d)

Rastreado el 2026-08-07, sin tocar código y sin navegador. **El camino del resultado del escaneo
hasta el service worker, completo:**

| # | Dónde | Qué le pasa al resultado |
|---|---|---|
| 1 | `popup.js` (`chrome.scripting.executeScript`) | **Único consumidor** de `escanearListado` |
| 2 | `popup.js` | `materia` → el input de carpeta; cada enlace → una `Clase` de 9 campos, **mapeados a mano** |
| 3 | `AppState.respaldar()` | `listaPersistente` en `storage.local` |
| 4 | `popup/features/queue.js` | `encolarItemsEnCaliente` arma el `ColaItem` con **7 campos elegidos explícitamente** — acá se descarta todo lo demás |
| 5 | storage → SW | El service worker lee `colaDescargas` **por su cuenta**, sin pasar por la normalización de `AppState` |
| 6 | `core/cola/procesadorCola.ts` | `sitios.obtener(item.sitioId).resolverManifiesto(item.urlInterna, signal)` |

**Lo que decidió el diseño**: los pasos 2 y 4 son re-mapeos campo por campo, así que meter la
credencial en ese tren costaba tocar los cuatro saltos, sumaba un campo al esquema de **dos**
colecciones persistidas y **duplicaba el token en cada ítem**. Y no compraba nada: dos clases del
mismo portal nunca tendrían credenciales distintas. De ahí que la credencial no viaje con el ítem
sino una vez por portal.

**Lo que se tocó al final** (todo aditivo y opcional, Ramón Net intacto):

- `core/puertos/sitio.ts` — `ResultadoEscaneo.credenciales?` + tercer parámetro de `resolverManifiesto`.
- `core/estado/credencialesPortal.ts` — **nuevo**, con su test.
- `core/cola/procesadorCola.ts` — un colaborador más; lo lee **por ítem**, no por ráfaga.
- `plataforma/composicion.ts` + los dos entrypoints + `popup.js` (una línea, al escanear).

**Ojo con lo que NO se puede medir desde el frame de arriba**: el player vive en un iframe
cross-origin, así que un hook de `fetch`/`XHR` o un `performance.getEntriesByType('resource')`
puestos en la página del club **no ven una sola request de adentro** — eso ya pasó, y el "no
aparece ningún m3u8" fue un falso negativo. Para verlo hay que abrir la URL del embed **en su
propia pestaña** (ahí el player pasa a ser el top frame) o mirar el Network de DevTools, que sí
incluye los iframes. *(Y `api-player.play.hotmart.com` no existe: tira `ERR_NAME_NOT_RESOLVED`.)*

---

## Las decisiones ya tomadas (no volver a abrirlas sin motivo)

| Decisión | Valor | Por qué |
|---|---|---|
| **`id` del portal** | `anatomy-by-chris` | Es el nombre de la carpeta en disco (`raíz/anatomy-by-chris/<módulo>/`) y la mitad de la identidad de cada clase (`anatomy-by-chris\|<titulo>`). Se eligió el **curso** y no la plataforma (`hotmart`) para que otro curso de Hotmart no comparta carpeta ni pueda colisionar por módulos homónimos. El costo aceptado: otro curso de Hotmart es otra entrada en el registro |
| **`resolverManifiesto`** | Implementado: tres fetch, devuelve la **variante** | Se destrabó el 2026-08-07 al medir la cadena entera. Ver §El algoritmo |
| **La faceta** | Inerte | Hotmart no tiene un eje tipo cátedra/comisión |
| **Los materiales (PDF)** | **Fuera de alcance** | No se pueden scrapear (el botón no trae URL) y el motor es HLS, no descarga de archivos sueltos. Ver §Los materiales |

**El `id` es un dato, no una etiqueta.** Cambiarlo después obliga a migrar storage y a mover
archivos en disco. Ya está decidido: `anatomy-by-chris`.

---

## Lo que se midió, y con qué

Las muestras están en **`sitio/nuevo sitio/`**, guardadas desde el navegador con sesión iniciada.
Son el **DOM ya renderizado**, no el HTML que devuelve el servidor — y esa diferencia es justo lo
que destapó el problema de arquitectura de arriba:

| archivo | qué es | fecha |
|---|---|---|
| `pagina 1.html` (1,3 MB) | Home del producto: la galería de 11 módulos | 2026-08-06 |
| `pagina 2.html` (1,5 MB) | Clase del módulo *Libros y Herramientas*, **sin** el player montado | 2026-08-06 |
| `pagina 3.html` (1,5 MB) | Clase **de video** (*Generalidades de Anatomia*), **con** el player montado | 2026-08-07 |
| `pagina 4.html` (1,6 MB) | **La misma clase que la 2**, con la pestaña **Materiales abierta** | 2026-08-07 |

**La 2 y la 3 juntas valen más que cada una**: son clases distintas pero muestran el mismo portal
con y sin el iframe del reproductor, que es la prueba de que ese iframe lo pone el JS y no el
servidor. **La 2 y la 4 son el mismo par de evidencia para los materiales**, y encima sobre la
*misma* clase: sin la pestaña abierta, `materials-tab` **no existe en el DOM**. Lo que **ninguna** de las tres tiene —ni va a tener— es el `.m3u8`: vive dentro del
iframe cross-origin, y "guardar página" no lo captura.

Se parsearon con **jsdom** (ya es devDependency), no con grep — los archivos son DOM serializado y
a ojo se leen mal. jsdom escupe `Error: Could not parse CSS stylesheet` sobre estas páginas: es
ruido de CSS moderno que su parser no entiende, **no afecta el DOM**; se descarta con `2>/dev/null`.

> **Nota de higiene**: `sitio/nuevo sitio/` es una carpeta con espacio en el nombre, dentro de la
> capa de sitios, que no es un portal. Conviene moverla (a `docs/muestras/` o fuera del repo)
> antes de crear `sitio/anatomy-by-chris/`, para que la capa de sitios no tenga un habitante que
> no es un adaptador. **No se movió ni se borró: son archivos del dueño.**

### `pagina 1.html` — la home del producto

URL: `https://hotmart.com/es/club/anatomy-by-chris/products/6083220`

**No es un listado de clases.** Es una galería de **11 módulos**, cada uno con nombre, cantidad de
clases y un enlace a `/content/<hash>`:

| hash | módulo | clases |
|---|---|---|
| `1469AANAOd` | Generalidades de Anatomia | 1 (gratis) |
| `K4kk5ZoE4Y` | Libros y Herramientas de Estudio | 2 |
| `x7W0LEV5O2` | Miembro Superior | 14 |
| `Z72j0r5J7N` | Miembro Inferior | 20 |
| `kOXKDzYp7W` | Cuello | 6 |
| `1469yRGPOd` | Tórax | 10 |
| `o4EBQbwqez` | Abdomen | 6 |
| `146qnWkKOd` | Pelvis | 2 |
| `z7rwg53NOj` | Cabeza | 21 |
| `a4R2x9ya4n` | Intensivos y Pinches | 22 |
| `3eapwpNw4g` | Intensivo Tórax, Cabeza y Cuello | 10 |

Total: **114 clases**. El `<h1>` de esta página es `Curso de Anatomia - Anatomy by Chris`.

### `pagina 2.html` — la página de una clase

URL: `.../products/6083220/content/K4kk5ZoE4Y` — módulo *Libros y Herramientas de Estudio*.

- `<h1>` = **`Libros y Herramientas`** — es el título de la **clase activa**, NO el del módulo. *(Este
  doc afirmó lo contrario hasta el 2026-08-07: con las dos primeras muestras no se distinguía,
  porque en ambas el módulo y su clase activa se llamaban casi igual. Ver §El nombre del módulo.)*
- El `<aside>` trae la lista de clases **de ese módulo** (2, en este caso).
- Las dos son **tipo Texto**. No hay video.

### Lo que NO hay en ninguna de las dos

Buscado explícitamente y ausente: `.m3u8`, `<video>`, `<source>` de video, iframe de reproductor,
y cualquier host de CDN de video. El único `<iframe>` es el pixel de Google Tag Manager. Los únicos
CDN que aparecen son `static-media.hotmart.com` (imágenes), `cdn.hp.hotmart.com` (assets) y
`cdn.optimizely.com`.

### `__NEXT_DATA__` (idéntico en las dos páginas)

Es una app **Next.js**. Lo aprovechable:

```
membership.id     68a21266fb64b74833948a48
slug              anatomy-by-chris
ownerId           20989689
productId         6083220        (query.contentConsumePage[0])
page              /[lang]/club/[membership]/products/[...contentConsumePage]
assetPrefix       https://app-club-distribution.cp.hotmart.com/bundle/1.32.2
roles             ["VIEWER"]
```

**No trae el listado de clases ni nada de video** — sólo metadatos de la membresía (1,5 KB). O sea
que **no sirve como atajo** para evitar el scraping del DOM: el contenido llega por XHR después.

---

## El mapeo a `PuertoSitio`

`core/puertos/sitio.ts` es el hogar canónico del contrato (**12 miembros** desde el 2026-08-12, cuando
el corte 2 del copy genérico sumó `instruccionEscaneo`; eran 11 al escribirse esto + `DescriptorFaceta` de 11).
Acá va sólo qué pone este portal en cada uno.

### El desajuste estructural, y cómo se resuelve

`ResultadoEscaneo` es `{ materia, enlaces[] }`: **una página → una materia → N clases**. Ramón Net
encaja porque su aula virtual es de un nivel. **Hotmart es de dos**: producto → 11 módulos → clases.

**Resolución propuesta: un escaneo por módulo.** El usuario entra a un módulo y escanea; `materia`
= nombre del módulo, `enlaces` = las clases del `<aside>`. Encaja en el contrato sin tocarlo y sin
tocar `core/`, que es la condición del corte 7. El costo: para bajar el curso entero hay que
escanear 11 veces. **Es aceptable y es lo que se recomienda**; agrandar el contrato para soportar
dos niveles sería tocar Capa 1 y la UI, o sea otro frente entero.

### El nombre del módulo: el dato que falta para `materia`

`materia` es el nombre de la carpeta en disco (`raíz/anatomy-by-chris/<materia>/`), así que usar el
`<h1>` —que es el título de la **clase activa**— mandaría cada clase a una carpeta propia.

**El nombre del módulo SÍ está en la página de la clase**, y encima está el árbol entero. Leyendo
el texto visible de una clase de *Miembro Superior* se ve:

- un **`Volver` + `Miembro Superior`** arriba del título de la clase, y
- el sidebar con **los 11 módulos numerados** (1 *Libros y Herramientas de Estudio* … 11 *Intensivo
  Tórax, Cabeza y Cuello*), en el mismo orden que la galería de la home, con el activo expandido
  mostrando sus clases.

O sea que **no hace falta leer la home ni llamar a la API** para resolver `materia`: sale del DOM
que `escanearListado` ya tiene delante.

> **Cómo casi se documenta lo contrario.** Una sonda que barría `<h1>`–`<h4>`, `document.title`,
> breadcrumbs y `document.querySelector('aside')` dio "el nombre del módulo no está en la página",
> y estuvo a punto de quedar escrito acá como un hecho. El error: **`querySelector('aside')` agarra
> el PRIMER `<aside>`, que es el panel de Perfil**, no el de navegación — la página tiene varios.
> Lo desmintió mirar el texto visible de la página, que es la medición más barata de todas. Vale
> como advertencia general: en este portal, barrer por selector genérico da falsos negativos.

**Cuál de los once es el módulo activo**: el que tiene `aria-expanded="true"` en su `<button>`
cabecera, cuyo `aria-controls` apunta al `<section>` con sus clases. Medido sobre los 11 a la vez.

*(Corrección del 2026-08-07: este doc dijo que `sectionId_N` era "un contador de render". No lo es
— es el **ordinal del módulo dentro del producto** (1 = Libros y Herramientas, 3 = Miembro Superior,
11 = Intensivo Tórax…), consistente con la numeración del sidebar y con las tres muestras. No hay
que hardcodearlo, pero `aria-controls` lo usa legítimamente.)*

**El ancla que NO hay que usar es `aside` a secas**, por lo del recuadro de arriba.

*(Dato aparte, por si sirve: lo que la home llama "el módulo" es en realidad **su primera clase** —
el link de* Miembro Superior *es `/content/x7W0LEV5O2`, y la primera fila de la lista de ese módulo
es justamente `x7W0LEV5O2`. No hace falta para `materia`, pero explica la estructura.)*

### Miembro por miembro

| Miembro | Valor / origen | Confianza |
|---|---|---|
| `id` | `"anatomy-by-chris"` | Decidido |
| `nombre` | `"Anatomy by Chris"` | Alta |
| `urlSondeoInternet` | `"https://hotmart.com"` | Alta |
| `esPaginaDelSitio(url)` | que incluya `hotmart.com/` **y** `club/anatomy-by-chris` | Alta — ver la trampa de abajo |
| `patronPestañas` | `"https://hotmart.com/*/club/anatomy-by-chris/*"` | **Verificar el match de `chrome.tabs.query`**: el `/*/` es por el segmento de idioma (`/es/`) |
| `urlListado` | `"https://hotmart.com/es/club/anatomy-by-chris/products/6083220"` (la home del producto) | Alta |
| `escanearListado` | Los selectores de la sección siguiente, + cosecha del `id_token` | **Alta** para el DOM (tests contra el HTML real); lo que falta ver es la **serialización**, que sólo se detecta en el navegador |
| `resolverManifiesto` | Tres fetch (lección → embed → master → **variante**), con `credenciales` | Alta — medido de punta a punta |
| `parsearTitulo` | Ver §El parser | Media — los títulos medidos están cubiertos; puede aparecer una forma sucia nueva |
| `clasificarCarpeta` | `{ catedra: valorComun, carpeta: <materia saneada> }` | Alta |
| `faceta` | Inerte | Alta — verificado leyendo el consumidor |

**La trampa de `esPaginaDelSitio`**: Ramón Net puede hacer `url.includes(this.host)` porque es
dueño de todo su dominio. Acá **no**: `hotmart.com` hospeda miles de cursos ajenos, y un
`esPaginaDelSitio` que mire sólo el host haría que este adaptador reclame la pestaña de cualquier
otro producto de Hotmart. Con la lista de `registro.ts` recorriéndose en orden, eso es
"gana el primero que dice que sí" — o sea, el bug silencioso de descargar con el adaptador
equivocado que ADR-0010 previene. **Tiene que matchear el slug del curso**, no el host.

### La faceta inerte — verificado, no supuesto

Hotmart no tiene eje de clasificación. El paso a paso dice que igual hay que implementar
`DescriptorFaceta`, con un `valorComun` constante, y que "la UI queda inerte sola". **Se verificó
leyendo el consumidor** (`popup/features/faceta.js`), y es cierto, por esta cadena:

- `valoresPresentes()` (línea 86) filtra **fuera** todo lo que sea igual a `valorComun` → devuelve
  `[]` siempre.
- `verificarYMostrarAsistente()` (142) exige `detectados.length > 1` para el modal → **no hay modal**.
- `actualizarBadge()` (106) exige lo mismo → **el badge queda oculto**.
- `perteneceASeleccion()` (98) devuelve `true` cuando no hay elección → **no filtra nada**.

O sea: alcanza con que `leer()` y `leerDeCola()` devuelvan siempre `valorComun`. El resto
(`etiquetar`, `ordenar`, `modal`) hay que escribirlo porque el compilador lo exige, pero **no se
ejecuta nunca**; conviene que su contenido lo diga en vez de inventar copy verosímil.

---

## El scraper: los selectores medidos

Fuente: el `<aside>` de `pagina 2.html`. **Todo esto sale de markup real**, no de suposiciones.

Una fila de clase se ve así (recortada):

```html
<div data-hash="K4kk5ZoE4Y" data-test="K4kk5ZoE4Y" data-active="true" class="mb-1 p-3 …">
  <a aria-current="page" class="flex flex-1 …"
     href="/es/club/anatomy-by-chris/products/6083220/content/K4kk5ZoE4Y?source=CLASS_MODULES_LIST">
    <div class="mr-2 flex items-center">
      <div data-test="content-item-background" …>
        <svg data-prefix="fal" data-icon="file-lines" …>
          <title>Ícono de un curso del tipo Texto</title>   <!-- ⚠️ -->
        </svg>
        <div class="absolute …">
          <svg data-icon="play"><title>La clase {{index}} se está reproduciendo</title></svg>
          <p class="…">Tocando ahora</p>                     <!-- ⚠️ -->
        </div>
      </div>
    </div>
    <div class="grow text-left mr-3">
      <span class="line-clamp-2 …" title="Libros y Herramientas">Libros y Herramientas</span>
    </div>
  </a>
  <div class="shrink-0"><button type="button" data-active="true" …></div>
</div>
```

### Anclas estables vs. inestables

Las clases CSS son **Tailwind generado** (`mb-1 p-3 w-full …`) y algunas son hashes de CSS-modules
(`.UQ5bpo1TruwFand7YiL3`): **no anclar en ninguna de las dos**, cambian con cada build de Hotmart.
Lo estable:

| Qué | Ancla | Nota |
|---|---|---|
| La fila | `div[data-hash]` | También tiene `data-test` con el mismo valor, y `data-active` |
| El enlace | `a[href*="/content/"]` | **Filtrar por `?source=CLASS_MODULES_LIST`** — ver la trampa |
| El título | `span[title]` → **el atributo `title`** | **No `innerText`** — ver la trampa. Hay que hacer `trim` y colapsar espacios |
| La materia | **no está en la página** | Ver §El nombre del módulo — el `<h1>` es el título de la clase activa |
| Tipo de clase | **`<img>` del thumbnail: hay ⇒ video** | El `data-icon` NO sirve: la fila activa suma `play` aunque sea de texto |
| El `mediaCode` | `img[src*="thumbnail/"]` → el segmento tras `/thumbnail/` | Presente también en las filas **inactivas** (verificado sobre 14) |
| El contenedor | `aside`, y adentro `section[id^="sectionId_"]` | Por si hay que acotar el barrido |

### La regla de anclaje, y la receta completa del escaneo

**Anclar SIEMPRE en `data-test` / `aria-*` / `data-hash`, NUNCA en `class`.** Las clases son
Tailwind generado (`mb-1 p-3 w-full …`) y hashes de CSS-modules (`sc-kOPcWz`,
`.UQ5bpo1TruwFand7YiL3`): cambian con cada build de Hotmart. La familia semántica que el portal
expone —y que hace a este scraper mucho más firme que el de Ramón Net— es:

| dato | ancla |
|---|---|
| módulo activo | `button[aria-expanded="true"][aria-controls^="sectionId_"]` |
| nombre del módulo (`materia`) | dentro de ese botón, `[data-test="module-item-name"]` → attr `title` |
| sus clases | `document.getElementById(aria-controls)` → `div[data-hash]` |
| enlace de la clase | `a[href*="/content/"]` (sin el `?source=…`) |
| título | `span[title]` → attr `title` (**trim** y colapsar espacios) |
| ¿es video? | tiene `[data-test="content-background-thumbnail"]` |
| `mediaCode` | ese `src`: `…/thumbnail/**<mediaCode>**/dimension?w=120&h=67` |
| duración | `[data-test="content-item-tag"]` (`01:12:32`) — sólo en videos |

Recorte del escaneo, ya con las cuatro trampas contempladas:

```js
const cab     = document.querySelector('button[aria-expanded="true"][aria-controls^="sectionId_"]');
const materia = cab.querySelector('[data-test="module-item-name"]').getAttribute('title').trim();
const filas   = document.getElementById(cab.getAttribute('aria-controls')).querySelectorAll('div[data-hash]');
// por fila: href sin query · span[title] trimeado · thumbnail → mediaCode
// sin thumbnail ⇒ clase de TEXTO ⇒ se saltea
```

Usar `aria-controls` y no "todas las `[data-hash]` de la página" **no es cosmético**: el contenedor
`[data-test="lesson-module-list"]` es común a los once módulos, así que un barrido suelto mezcla
módulos en cuanto haya más de uno expandido.

### `resolverManifiesto` de punta a punta — el algoritmo, todo medido

```
1. GET  api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons/<hash>
        Authorization: Bearer <id_token>   ·   x-product-id: <productId>
        → medias[0].url   (embed con jwtToken FRESCO en cada llamada)

2. GET  <esa url del embed>                ·   Referer: https://hotmart.com/  (vía dNR)
        → recortar <script id="__NEXT_DATA__"> y JSON.parse
        → props.pageProps.applicationData.mediaAssets[0].url   (el MASTER, hdnts vive 500 s)

3. GET  <master>
        → elegir variante  ← el motor NO sabe hacerlo (ver abajo)

4. devolver la URL de la VARIANTE. De ahí en adelante el motor hace lo de siempre:
   playlist → #EXT-X-KEY (AES-128) → fragmentos .ts, todo con el hdntl de 24 h
```

**Los pasos 1 y 2 hay que hacerlos al bajar, no al encolar**: el `hdnts` del master dura 500 s.
Recién el `hdntl` que sale del master aguanta 24 h.

### ✅ La cadena de video, medida el 2026-08-07

**El motor de este proyecto sirve tal cual**: es HLS con AES-128 y fragmentos `.ts`, lo mismo que
Ramón Net. El CDN es **Akamai** (`vdn: "AKAMAI"`) y los tokens son sus `hdnts`/`hdntl`.

```
1. master      https://vod-akm.play.hotmart.com/video/<media>/hls/master-pkg-t-<pkgTs>.m3u8
                 ?hdnts=st=<ahora>~exp=<+500s>~hmac=…&app=<applicationCode>
2. variante    …/hls/<media>-<pkgTs>-audio=82530-video=297419.m3u8
                 ?hdntl=exp=<+24h>~acl=/*~data=hdntl~hmac=…&app=…
3. clave AES   https://contentplayer.hotmart.com/video/<media>/mp4/key/<media>-<pkgTs>.key?hdntl=…
4. fragmentos  …/hls/<media>-<pkgTs>-audio=82530-video=297419-<N>.ts?hdntl=…&app=…
```

**Los dos tokens tienen vidas muy distintas, y eso ordena el diseño:**

| token | dónde | vida | consecuencia |
|---|---|---|---|
| `hdnts` | sólo el **master** | **500 s** (medido: `st` → `exp`) | hay que resolver **justo antes** de bajar; no se puede encolar resuelto |
| `hdntl` | variante + clave + fragmentos | **24 h**, con `acl=/*` | una vez leído el master, la descarga entera tiene 24 h |

**El `<pkgTs>`** (`1755460336000`) aparece en el master, la variante, la clave y cada fragmento, y
**no se deriva de nada** — sale del master. O sea que el master no es opcional ni construible: hay
que pedirlo.

**Origenes para `host_permissions`** (paso 3 del paso a paso):

```
https://hotmart.com/*
https://api-club-course-consumption-gateway-ga.cb.hotmart.com/*
https://cf-embed.play.hotmart.com/*
https://vod-akm.play.hotmart.com/*
https://contentplayer.hotmart.com/*
```

#### Lo que falta confirmar de esta cadena

1. ~~De dónde sale la URL del master~~ → **del HTML del embed, verificado el 2026-08-07.** Viene
   renderizada del lado del servidor en el `<script id="__NEXT_DATA__" type="application/json">`:

   ```
   props.pageProps.applicationData.mediaAssets[].url   → …/hls/master-pkg-t-<pkgTs>.m3u8?hdnts=…
   props.pageProps.applicationData.isDrmEnabled: false → tercera confirmación de que no hay DRM
   props.pageProps.applicationData.cdnProvider: "AKAMAI"
   ```

   **Se parsea como JSON, no con regex.** Es un `<script type="application/json">`: se recorta por
   sus etiquetas y se hace `JSON.parse`. Eso deja a este `resolverManifiesto` **estricto** —falla
   fuerte o acierta—, al revés del de Ramón Net, cuyos fallbacks por regex degradan en silencio y
   pueden resolver el video de otra clase (ver `architecture.md` §Capa 2). **No copiarle los
   fallbacks.**

   > **⚠️ Trampa de `mediaAssets`:** son **cinco entradas con la MISMA `url`**. Difieren sólo en
   > `height` (1080/540/720/360/240) y las cinco dicen `qualityLabel: "auto"`. El `height` invita a
   > creer que hay una URL por calidad, y **no la hay**: elegir calidad es elegir variante *dentro*
   > del master. Tomar `mediaAssets[0].url` y seguir.
2. **El embed está protegido por `Referer`**: abierto suelto da `401` (el JWT estaba vigente, no era
   expiración). `Referer` es un header prohibido para `fetch`, así que **el service worker lo va a
   necesitar vía `declarativeNetRequest`** — y ahí este portal sí necesita su `rules.json`, que
   este doc antes daba por innecesario.
3. ~~¿El motor sabe leer un master multi-variante?~~ → **NO, y falla en silencio. Medido en el
   código el 2026-08-07.** `descargarYAnalizarIndexM3u8` (`core/hls/hlsEngine.ts:132-142`) toma
   **toda línea que no empiece con `#`** como un fragmento. Ante un master, esas líneas son las
   **variantes**, así que no salta el `throw` de "no contiene fragmentos válidos" —hay líneas— y el
   motor **se descarga el `.m3u8` de la variante creyéndolo un `.ts`**, lo desencripta y lo manda al
   backend: un archivo de unos KB en lugar del video, sin un solo error en ningún lado.

   **Regla que sale de esto: `resolverManifiesto` de este portal devuelve la URL de la VARIANTE, no
   la del master.** El adaptador pide el master, elige variante y devuelve esa URL; `hlsEngine` no
   se toca. (Ramón Net nunca lo destapó porque su plantilla apunta directo a una playlist de
   medios: `…/480p/video.m3u8`.)
4. ~~Qué variantes ofrece el master, y cuál elige el código~~ → **medido el 2026-08-07**, abriendo el
   master de *Osteologia* desde el propio iframe del player:

   | RESOLUTION | alto | BANDWIDTH | ≈ MB/hora |
   |---|---:|---:|---:|
   | 400×240 | 240 | 136 kbps | 58 |
   | 600×360 | 360 | 170 kbps | 73 |
   | 900×540 | 540 | 222 kbps | 95 |
   | 1200×720 | 720 | 277 kbps | 119 |
   | 1800×1080 | 1080 | 403 kbps | 173 |

   **No hay escalón 480**, y **hoy `elegirVariante` toma 1080** (`video=297419`, la misma URI que
   este doc ya citaba sin saber a qué calidad correspondía). El `height` de `mediaAssets` resultó
   ser exactamente esta escalera: sirve de catálogo, nunca de origen de URL — la trampa del punto 1
   sigue en pie.

   **Decisión: se topea en 720p** (`escaneo-api-anatomy-diseno.md` §Corte 4), con la regla *"el más
   alto que no pase del tope; si ninguno, el más chico"* — no una búsqueda exacta, que se rompería
   en silencio el día que Hotmart mueva la escalera.

   > **Dónde medirlo, porque cuesta más de lo que parece**: desde la consola del club **no se
   > puede** — `cf-embed` no manda CORS para `hotmart.com` y el `fetch` muere con `Failed to fetch`.
   > La extensión sí (tiene `host_permissions`), pero la consola del SW es otra ventana y es fácil
   > terminar pegando en la de la página. Lo que funcionó: sacar la URL del embed del
   > `performance.getEntriesByType('resource')` de la clase y **abrirla en una pestaña propia con un
   > `<a target="_blank">`** — así el player pasa a ser `top` (sin pelear con el selector de frames,
   > que además se resetea en cada navegación) y el navegador manda el `Referer` que el embed exige.

### ⚠️ Trampa 1: `innerText` viene envenenado

El scraper de Ramón Net hace `l.innerText` (`sitio/ramonnet/scraper.js:31`). **Acá eso devuelve:**

```
Ícono de un curso del tipo TextoLa clase {{index}} se está reproduciendoTocando ahoraLibros y Herramientas
```

Porque los íconos son **FontAwesome inline con `<title>` accesible adentro del `<a>`**, y el
overlay de "Tocando ahora" suma su propio texto **sólo en la clase activa** — o sea que la basura
**no es la misma en todas las filas**, lo que hace muy fácil no darse cuenta.

**El título limpio está en el atributo `title` del `<span>`**: `"Libros y Herramientas"`. Usar eso,
con `textContent` del span como respaldo.

Esta es la clase de defecto que el proyecto documenta como invisible para la suite: copiar el
scraper de Ramón Net compila, lintea, typechequea y pasa los tests — y produce nombres de archivo
con "Ícono de un curso del tipo Texto" adentro.

### ⚠️ Trampa 2: hay `<a href*="/content/">` que no son clases

En la página de clase hay **3** enlaces a `/content/`, y **uno no es una clase**: es la flecha de
navegación "Próxima", que se distingue por su query:

- `?source=CLASS_MODULES_LIST` → fila de la lista ✅
- `?source=CLASS_TOP_ARROW` → flecha de navegación ❌

Un `querySelectorAll('a[href*="/content/"]')` pelado mete la flecha en el listado como si fuera
una clase (y encima duplicada respecto de la fila real). **Filtrar por `source`, o —mejor— salir de
`div[data-hash]` y bajar al `<a>` de adentro**, que es estructural en vez de depender del query
string.

Se recomienda **guardar el `href` sin el query** (`?source=…` es de telemetría de Hotmart, no
identifica la clase) para que la URL de la clase sea estable entre orígenes de navegación.

### La fila de una clase de VIDEO, y el `mediaCode` que trae adentro

De `pagina 3.html`, que es la misma clase que la 2 pero guardada con el video andando. La
diferencia con una fila de texto es el **thumbnail**:

```html
<div data-hash="1469AANAOd" data-active="true" …>
  <a href="/es/club/anatomy-by-chris/products/6083220/content/1469AANAOd?source=CLASS_MODULES_LIST">
    <img src="https://api-player-thumbnail.hotmart.com/rest/v1/thumbnail/5Z1odEbEqX/">
    …
    <span title="Generalidades de Anatomia ">…</span>   <!-- ojo: espacio al final -->
```

**Ese `5Z1odEbEqX` es exactamente el `mediaCode` del JWT.** O sea que el listado ya trae, por
clase, el identificador del video — sin abrir la clase. Es lo que habilita el camino 2 de arriba.

| | clase de **texto** | clase de **video** |
|---|---|---|
| thumbnail | **no hay `<img>`** | `<img src=".../thumbnail/<mediaCode>/">` |
| ícono base | `svg[data-icon="file-lines"]`, `<title>Ícono de un curso del tipo Texto</title>` | (tapado por el thumbnail) |

**Lo que este dato NO autoriza a afirmar**: el módulo de la muestra tiene **una sola clase** y está
activa. **No se puede saber si una fila de video INACTIVA también trae el thumbnail** — muy posible
que sí, pero hay que verlo en un módulo con varias (*Miembro Superior*, 14). Si no lo trajera, el
camino 2 se cae y queda sólo la API.

**Y `data-icon` no sirve para clasificar**: la fila activa suma un overlay `svg[data-icon="play"]`
en los dos casos (en `pagina 2.html` la fila activa era de **texto** y también tenía `play`). El
discriminador es el `<img>`, no el ícono.

El **iframe del player** tiene ancla estable, por si hiciera falta leerlo desde la pestaña:
`iframe#hotmart-player-embed`, con `title` = el nombre del archivo del video
(`"Generalidades de Anatomia Anato by Chris.mp4"` — viene con el `.mp4` adentro, dato para
`parsearTitulo`). Su `allow="encrypted-media"` **no implica DRM**: es el valor por defecto del
embed y el JWT dice `playDrm: false`.

### ⚠️ Trampa 3: no se sabe si la lista es virtualizada

El módulo medido tiene **2** clases. Los hay de **22**. Si el `<aside>` renderiza por scroll
(virtualización) o colapsa secciones, un escaneo devolvería sólo lo visible — **exactamente el
modo de fallar que el scraper de Ramón Net ya trata** filtrando por elementos visibles
(`offsetWidth || offsetHeight || getClientRects().length`).

**No se puede afirmar nada con esta muestra.** Verificar en el navegador contra un módulo grande
(*Intensivos y Pinches*, 22, o *Cabeza*, 21) es obligatorio antes de dar el scraper por bueno.

### ⚠️ Trampa 4 (la del proyecto): la función se inyecta serializada

`escanearListado` se inyecta con `chrome.scripting` en la pestaña del portal: **no puede
referenciar ninguna global de la extensión ni una constante de su propio archivo.** No lo detecta
el bundler, ni el lint, ni `tsc`, ni la suite. Es la regla que `CLAUDE.md` marca como la que más
fácil se rompe, y acá aplica igual que en Ramón Net.

---

## ⚠️ El hallazgo que el paso a paso NO cubre: los globals chocan

**Esto no está en `multisitio-diseno.md` §Cómo escribir un portal nuevo, y va a romper el portal
existente si se copia el patrón tal cual.**

Los tres hermanos `.js` de Ramón Net se publican con nombres **sin calificar**:

```js
globalThis.ParserTitulos      = ParserTitulos;       // sitio/ramonnet/parserTitulos.js:213
globalThis.ResolverManifiesto = ResolverManifiesto;  // sitio/ramonnet/resolverManifiesto.js:121
globalThis.Scraper            = Scraper;             // sitio/ramonnet/scraper.js:175
```

y `sitio/ramonnet/config.ts` los consume por `declare const` con esos mismos nombres (líneas
49-58), a propósito: `allowJs` es `false`, así que el `.ts` no puede importarlos.

**Con un segundo adaptador que copie el patrón, el último entrypoint que se evalúe gana y le pisa
los tres globals al otro portal.** El síntoma sería que un portal escanea/parsea con el adaptador
del otro — silencioso, y del tipo que ADR-0010 previene en los datos pero que acá entra por el
espacio de nombres.

**Los nombres del portal nuevo tienen que ser propios.** Propuesta:

```js
globalThis.ParserTitulosAnatomy      = …
globalThis.ResolverManifiestoAnatomy = …
globalThis.ScraperAnatomy            = …
```

y los tres declarados en `globalesDelProyecto` de `eslint.config.js` (si no, `no-undef` los marca).

**Esto merece volver a `multisitio-diseno.md` como corrección del paso a paso**, no sólo quedar
acá: es una trampa de todo portal nuevo, no de éste.

---

## Lo construido (2026-08-07)

Los cinco pasos de `multisitio-diseno.md`, instanciados y hechos. La promesa de que "ninguno toca
`core/`" **se cumplió salvo por las credenciales** (ADR-0013), que es el único costo del corte.

### Paso 1 — `sitio/anatomy-by-chris/`, cuatro archivos ✅

| Archivo | Qué quedó |
|---|---|
| `config.ts` | El descriptor. `esPaginaDelSitio` matchea el **slug del curso**, no el host — ver la trampa más abajo. Faceta inerte |
| `scraper.js` | Los selectores medidos, con las cuatro trampas contempladas. Cosecha además el `id_token` |
| `parserTitulos.js` | Chico a propósito: sanear + duración al final + diacríticos. Nada del aparato de Ramón Net, que acá sólo podría equivocarse |
| `resolverManifiesto.js` | **Completo**: los tres fetch, y devuelve la **variante** |

**Un hallazgo del parser que no estaba medido, y lo encontró su test**: `Utils.quitarAcentos` —el
que usa Ramón Net— es una **tabla estática que cubre el español y no el portugués**, así que
`"Articulação"` terminaba como `"Articula__o"`. Este portal mezcla los dos idiomas, así que su
parser normaliza con NFD y no usa esa función. Sí usa `Utils.sanitizarTexto`, cuya lista de
caracteres está sincronizada con el backend Bun y por eso no se copia localmente. Consecuencia
asumida: acá `ñ` → `n`, distinto de Ramón Net, que la conserva.

### Paso 2 — registrar en `sitio/registro.ts` ✅

Sumado al array `SITIOS` (el tipo es una tupla no vacía, así que el segundo elemento no lo rompe).
`sitio/registro.test.ts` dejó de afirmar contra N=1: ahora verifica que los dos `esPaginaDelSitio`
sean **disjuntos** y —lo que más importa— que **otro curso de Hotmart no lo reclame nadie**.

### Paso 3 — `wxt.config.ts` (nunca `manifest.json`, que es generado) ✅

- `host_permissions`: los **cinco** orígenes de la cadena medida (club, API de lecciones, embed,
  Akamai y la clave AES). Olvidar el del CDN se ve como descargas que fallan en el primer
  fragmento, no como un error de permisos.
- `declarative_net_request`: **sí hace falta**, y este doc antes decía que probablemente no. El
  embed contesta 401 sin `Referer`, y `Referer` es un header prohibido para `fetch`. La regla vive
  en `public/sitio/anatomy-by-chris/rules.json` con su `id` propio (`ruleset_anatomy`), acotada por
  `urlFilter` al host del embed y al tipo `xmlhttprequest`: no toca la navegación del usuario.

### Paso 4 — los dos entrypoints, y **primero** ✅

- `entrypoints/popup/main.js`: `config.ts`, `parserTitulos.js`, `scraper.js`
- `entrypoints/background.js`: `config.ts`, `parserTitulos.js`, `resolverManifiesto.js`

Van **antes** de todo lo que los consume (arriba de `plataforma/composicion.ts`), porque publican
globals que el resto lee perezosamente. Equivocarse rompe en runtime y el bundler no avisa.

Las dos listas no son iguales a propósito: el popup necesita el scraper (lo inyecta en la pestaña)
y no el resolvedor; el service worker, al revés.

### Paso 5 — tests ✅

47 tests nuevos en la carpeta del portal, más los del núcleo. Los dos que valen especialmente:

1. **`scraper.test.js` contra el HTML real** (`// @vitest-environment jsdom`). El fixture
   (`__fixtures__/listado-modulo.html`, **11 KB**) se armó recortando de las páginas guardadas la
   cabecera del módulo activo, su sección, las filas tal cual vinieron —una de VIDEO y dos de
   TEXTO—, la flecha de navegación y el `<aside>` de Perfil; se vaciaron los `d=` de los `<path>`
   de los íconos, que eran casi todo el peso. **Es la única observación real hasta el navegador**,
   y es lo que atrapa las cuatro trampas — que un doble escrito por quien escribió el scraper no
   atraparía nunca.
2. **`registro.test.ts`**: que ningún portal reclame la URL del otro. Con dos portales por fin se
   afirma de verdad; era la mitad que sólo tenía dobles.

**Lo que el fixture NO puede ver, y por eso el navegador sigue siendo obligatorio**: que
`escanearListado` sea **serializable y autocontenida**. Acá corre importada, con su módulo entero
disponible; en producción la serializa `chrome.scripting.executeScript`.

**Un dato del fixture que salió midiendo y no estaba escrito**: un módulo **colapsado no tiene su
`<section>` en el DOM** — se renderiza recién al expandirlo. Por eso en las tres páginas guardadas
`div[data-hash]` devuelve sólo las filas del módulo activo.

### Paso 6 — verificar ⚠️ a medias

Las 4 de siempre, **en verde el 2026-08-07**: 33 archivos / 464 tests, lint 0/0, `tsc` limpio,
build OK. Los números viven en `docs/testing.md` y se actualizan **ahí**.

**Falta el navegador**, que acá no es confirmación sino la única detección que existe. Checklist:
los 7 puntos de `rearquitectura-diseno.md` §Verificación en navegador más los cuatro del principio
de este doc — sumar un portal toca manifest y adaptador de sitio, o sea su disparador declarado de
lleno.

### Paso 7 — docs, en el mismo PR ✅

- `docs/testing.md` — baseline nuevo (33/464) y qué cubre el fixture del scraper.
- `docs/data-model.md` — la clave `credencialesPortal`.
- `docs/security.md` — la extensión pasa a guardar una credencial, y antes no guardaba ninguna.
- `docs/adr/0013-credenciales-por-portal.md` — **nueva**: la decisión de Capa 1.
- `docs/multisitio-diseno.md` — la fila del corte 7 y la advertencia de que un portal con auth por
  token **sí** toca `core/`.
- `CLAUDE.md` — que ya hay dos portales, y qué queda.
- Este doc — de "medido" a "construido", con lo que la medición erró.

---

## Lo que queda abierto

| # | Pendiente | Cómo se contesta |
|---|---|---|
| 1f | **El `Referer` para el embed** (da 401 sin él) | Construido: `public/sitio/anatomy-by-chris/rules.json`. **Que la regla dNR funcione de verdad se ve bajando una clase**, no hay test que lo afirme |
| 5 | Si `patronPestañas` con `/*/` matchea bien en `chrome.tabs.query` | Se ve al clickear la notificación de un fallo de este portal (corte 8) |

**Todo lo demás está cerrado.** Lo que se contestó midiendo, para no volver a preguntarlo:

| # | Pregunta | Respuesta |
|---|---|---|
| ~~1~~ | ¿HLS o DRM? | **No hay DRM** (`playDrm: false`, y `isDrmEnabled: false` en el embed). El portal es viable |
| ~~1b~~ | La URL del `.m3u8` | HLS + AES-128 + `.ts` sobre Akamai. Ver §La cadena de video |
| ~~1c~~ | ¿Qué devuelve `…/v2/web/lessons/<hash>`? | Contrato completo, con auth y `x-product-id`. Ver §Y se resolvió por API |
| ~~1d~~ | El slice de las credenciales | **Medido el 2026-08-07** (§El slice de credenciales) y ejecutado: ADR-0013 |
| ~~1e~~ | ¿El master viene en el HTML del embed? | Sí, en `__NEXT_DATA__`. Tres fetch: lección → embed → master → variante |
| ~~1g~~ | ¿`hlsEngine` lee un master? | **NO, y falla en silencio.** Por eso se devuelve la **variante** |
| ~~2~~ | Cómo se ve una fila de video | La distingue el `<img>` del thumbnail, que además trae el `mediaCode` |
| ~~2b~~ | ¿La fila inactiva trae thumbnail? | Sí: 12 de 14 filas inactivas lo traen sin abrir la clase |
| ~~3~~ | ¿Virtualización? | No: las 14 filas salen sin scrollear |
| ~~4~~ | ¿Cómo son los títulos? | Simples, sin semanas/fechas/cátedra. Sucios sí — ver §El parser |
| ~~4b~~ | ¿De dónde sale `materia`? | `button[aria-expanded="true"]` → `[data-test="module-item-name"]` |
| ~~6~~ | ¿El `materials-tab` vacío es "no tiene" o "lo inyecta JS"? | **Lo inyecta JS**, probado con `pagina 2` vs `pagina 4`. Y sí hay adjuntos propios de Hotmart: 5 PDF en esa clase. **Quedan fuera de alcance** — §Los materiales |

---

## Apéndice A: cómo re-medir sin volver a empezar

Los HTML se parsean con jsdom desde un script suelto, resolviendo el paquete por ruta absoluta
(un script fuera del repo no resuelve `node_modules` por nombre):

```js
import { readFileSync } from 'node:fs';
import { JSDOM } from 'file:///C:/Users/jcrod/Dev/videoDownloader/node_modules/jsdom/lib/api.js';

const dom = new JSDOM(readFileSync('sitio/nuevo sitio/pagina 2.html', 'utf8'));
const d = dom.window.document;

// Las filas de clase, con su título limpio (NO innerText — ver Trampa 1)
[...d.querySelectorAll('div[data-hash]')].forEach((fila) => {
  const a = fila.querySelector('a[href*="/content/"]');
  const span = fila.querySelector('span[title]');
  console.log(fila.dataset.hash, '|', span?.getAttribute('title'), '|', a?.getAttribute('href'));
});
```

Correr con `2>/dev/null` para tapar el `Could not parse CSS stylesheet` de jsdom, que es ruido y no
afecta al DOM.

---

## Apéndice B: la cadena de los materiales, medida (2026-08-07)

**No hace falta re-medir: la cadena está completa.** Se midió el mismo día que se tomó la decisión
de dejarlos afuera, justamente para que la decisión no dependiera de un "no se puede" sin verificar.
**Son tres llamadas**, y la tercera ni siquiera necesita credenciales:

```
1. GET api-club-course-consumption-gateway-ga.cb.hotmart.com/v1/pages/<hash>/complementary-content
      Authorization: Bearer <id_token>   ·   x-product-id: <productId>
      → el listado de adjuntos, de donde sale el <uuid> de cada uno
      (mismo host y misma auth que resolverManifiesto — o sea, credenciales que la extensión YA guarda)

2. GET api-club-hot-club-api.cb.hotmart.com/rest/v3/attachment/<uuid>/download
      → devuelve la URL firmada del paso 3

3. GET hotmart-club-files.cb.hotmart.com/membership_area/<uuid>/<nombre>.pdf
      ?response-content-disposition=attachment&Expires=…&Signature=…&Key-Pair-Id=…
      → el archivo
```

**Lo que decide el diseño, si algún día se construye:**

| dato | medido |
|---|---|
| Vida de la URL firmada | **exactamente 1 hora** (3601 s: emitida 17:15:09Z, `Expires` 18:15:10Z). Es CloudFront |
| ¿Anda sin pestaña? | **Sí.** `curl` pelado, sin cookies ni token ni `Referer`: `200 · application/pdf · 656307 bytes`, idéntico al archivo bajado a mano. El SW la puede bajar y **no hace falta regla dNR** |
| ¿Cuándo se pide el listado? | **Al cargar la página**, no al clickear la pestaña (a los ~4,6 s de los 172 recursos de la carga). Por eso un hook de `fetch` pegado en la consola no lo ve: para entonces ya pasó |
| ¿El uuid está en el DOM? | **No**, en ningún momento — buscado en el `innerHTML` entero de la página: `false` |

**✅ El hueco del paso 1 quedó cerrado el 2026-08-07** (era lo único sin verificar de toda la cadena:
se tenía la request, no la respuesta). El cuerpo, medido contra las 114 lecciones del curso:

```json
{ "complementaryReadings": [],
  "attachments": [ { "fileOrder": 4,
                     "fileMembershipId": "641db8a0-b918-4460-b007-a001b9f79bb5",
                     "fileName": "PDF DIAPOSITIVAS MMSS_watermark (1).pdf",
                     "fileSize": 83952102 } ] }
```

| dato | medido |
|---|---|
| El `<uuid>` del paso 2 | es **`fileMembershipId`** |
| Nombre y peso | vienen en el mismo listado (`fileName`, `fileSize`) — no hace falta una llamada extra para mostrarlos |
| Cuántas lecciones tienen adjuntos | **15 de 114** |
| Las otras 99 | devuelven **exactamente 45 bytes** (`{"complementaryReadings":[],"attachments":[]}`) — se descartan por largo, sin interpretar |
| Costo de barrer el curso entero | **7,1 s** con pool de 6, cero errores |
| `complementaryReadings` | **siempre vacío** en este curso; no hay caso que probar |

⚠️ **La trampa que casi lo tapa**: probar claves plausibles (`items`, `content`,
`complementaryContent`) y dar por vacío lo que no matchea. Las 114 respondieron **200** y el conteo
dio **cero adjuntos** — un resultado limpio, coherente y falso. Lo que lo destapó fue dejar de
interpretar: medir el **largo** de cada respuesta y volcar entero el cuerpo de la más grande. Si un
endpoint devuelve 200 y tu parser dice "no hay nada", sospechá del parser.

**Y una corrección al método, que vale más que el resultado**: la sonda hookeaba `fetch` y clickeaba
la pestaña, y **nunca iba a funcionar** porque la llamada ocurre en la carga. Lo que la encontró fue
volcar `performance.getEntriesByType('resource')` de una página recién cargada, **sin filtrar por
palabra clave** — el filtro "inteligente" de los intentos anteriores la descartaba. Con timing de
recursos no hace falta instrumentar nada ni adivinar cuándo pasa la request.

### Apéndice B.1 — el recorrido, para reconstruirlo si hace falta

*Estos son los pasos que se corrieron; quedan como registro del método, no como pendientes.*

Todo corre en la **consola de la pestaña del portal**, con sesión iniciada y **una clase que tenga
materiales** (p. ej. *Libros y Herramientas*, `K4kk5ZoE4Y`, que tiene 5).

> **Ojo con el hook de `fetch`**: §El slice de credenciales avisa que hookearlo en la página no ve
> las requests del player, porque ése vive en un **iframe cross-origin**. Los materiales sí están en
> el top frame, así que el hook los vería —pero **no sirve igual**, por lo del timing de arriba.

**El listado de adjuntos NO viene en la API de lección.** Fue lo primero que se probó, por ser la
llamada que `resolverManifiesto` ya hace:

```js
// Consola de la pestaña del portal, en una clase con materiales.
const hash = location.pathname.split('/content/')[1]?.split('?')[0];
const productId = location.pathname.match(/\/products\/(\d+)/)[1];
const token = localStorage.getItem('token');            // el id_token, NO el access_token

const r = await fetch(
  `https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons/${hash}`,
  { headers: { Authorization: `Bearer ${token}`, 'x-product-id': productId } },
);
const j = await r.json();
console.log('status', r.status, '| claves:', Object.keys(j));
console.log('¿menciona pdf/attach/material?', /\.pdf|attach|material/i.test(JSON.stringify(j)));
console.dir(j, { depth: null });
```

**Resultado**: `200`, y **ninguna** de sus 11 claves (`id`, `hash`, `name`, `type`, `content`,
`module`, `progress`, `liberationStartDate`, `locked`, `hasMedia`, `rating`) son los adjuntos. Ojo
con el falso positivo: un `/attach|material|\.pdf/` sobre el JSON entero **da `true`**, porque el
campo `content` es el HTML del cuerpo de la clase y ahí se nombran los PDF en texto. Hay que mirar
las claves, no hacer un grep. *(Y ojo con el `400 Validation error: Required header 'x-product-id'
is not present` — no parece de auth y hace perder tiempo.)*

### La que sí lo encontró: resource timing sobre la página recién cargada

Sin hooks y sin clickear nada. **Ctrl+Shift+R** y después:

```js
const ruido = /tracking|pixel|survicate|newrelic|optimizely|googletag|observability|sentry|static-media|nr-data/i;
console.table(
  performance.getEntriesByType('resource')
    .filter((e) => !ruido.test(e.name))
    .map((e) => ({ ms: Math.round(e.startTime), tipo: e.initiatorType, url: e.name.slice(0, 200) })),
);
// ¿el identificador del archivo está en el DOM?
console.log('uuid en el html:', document.documentElement.innerHTML.includes('<uuid>'));
```

Salieron **172 recursos**, y el listado apareció a los 4,6 s. **El filtro por palabra clave es lo que
hay que resistir**: los intentos anteriores filtraban por `attach|material|file` y descartaban
justo `/v1/pages/<hash>/complementary-content`, que no contiene ninguna de las tres.

### El paso 2 y la vida de la firma

El `<uuid>` sale del listado; con él, `GET .../rest/v3/attachment/<uuid>/download` devuelve la URL
firmada.

> **✅ El cuerpo de ese paso quedó medido el 2026-08-07**, bajando el primer PDF de verdad:
>
> ```json
> { "directDownloadUrl": "https://hotmart-club-files.cb.hotmart.com/membership_area/<uuid>/<nombre>.pdf?…" }
> ```
>
> **El nombre del campo no era adivinable** —no es `url` ni `downloadUrl`— y la primera versión del
> módulo probó cuatro nombres plausibles y erró los cuatro. Lo que salvó el diagnóstico fue que el
> error **volcara el cuerpo recibido** en vez de decir "no se pudo resolver": con 120 caracteres
> alcanzó. Es la misma lección que el §Apéndice B ya había dejado escrita para el listado —*si un
> endpoint devuelve 200 y tu parser dice "no hay nada", sospechá del parser"*— y esta vez el
> mensaje de error ya estaba escrito para que se notara.
>
> **Y ese mismo PDF destapó dos cosas que la medición desde la pestaña no podía ver**: los dos
> hosts de esta cadena no estaban en `host_permissions`, y el paso 2 necesita `x-product-id` y
> `Referer` — que el navegador manda solo y el service worker no. Tercera vez que esta asimetría
> muerde en este portal (el embed, el master, y ahora la firma del adjunto).

Para medirla:

```js
const url = '<la firmada>';
const r = await fetch(url, { method: 'HEAD', credentials: 'omit' });   // lo que puede hacer el SW
console.log(r.status, r.headers.get('content-type'), r.headers.get('content-length'));
console.log('query:', [...new URL(url).searchParams].map(([k, v]) => `${k}=${v.slice(0, 40)}`));
```

Ya está medido y está en la tabla de arriba: **CloudFront, 1 hora, sin credenciales de ningún tipo**.
Que ande sin cookies es lo que decide que el service worker pueda bajarlo — el equivalente de la
pregunta que para el video se contestó con el `hdntl` de 24 h.

### Y con todo esto medido, la decisión no cambia

La cadena dice que el archivo es **alcanzable**, no que el proyecto lo pueda bajar. Los motivos 2 y 3
de §Los materiales siguen intactos: `hlsEngine` no descarga archivos sueltos —haría falta un tipo de
ítem nuevo en la cola, una rama en `procesadorCola` que lo saltee y probablemente un endpoint más en
el backend Bun— y `ResultadoEscaneo` es por módulo mientras los materiales cuelgan de una lección.
**Lo que la medición cambió es el argumento, no el veredicto**: se dejan afuera porque cuesta un
frente entero para cinco archivos que ya tienen un botón que funciona, no porque no se pueda.

El diseño de ese frente —por si el cálculo cambia— está en §Apéndice C.

---

## Apéndice C: el diseño, si algún día se construye

*Escrito el 2026-08-07 junto con la decisión de NO construirlo, para que la próxima discusión no
arranque de cero. **Nada de acá está implementado.** Lo que sigue es dónde entraría cada cosa y,
sobre todo, las cuatro trampas que ya se identificaron sin escribir una línea.*

### Cuándo dejaría de ser mala idea

El costo no es "es difícil": es que un tipo de ítem nuevo es un cambio de **modelo**, no una feature
—entra en Capa 1, en el esquema de **dos colecciones persistidas**, en la identidad de clase, en el
bucle, en los filtros y probablemente en el backend Bun, que es otro repo— y encima dispara la
verificación en navegador completa (toca manifest, adaptador de sitio y Capa 1: los tres disparadores
declarados). Todo eso por **cinco archivos estáticos que ya tienen un botón que funciona**.

**Daría vuelta el cálculo**: un portal que sea mayormente documentos (doscientos PDF, no cinco), o un
**tercer** portal que necesite lo mismo. Ahí el tipo por ítem deja de ser un caso especial y pasa a
ser el modelo, que es cuando conviene pagarlo.

### La versión barata, que es la que conviene primero

Un botón en el popup que resuelva los materiales de la clase y **abra las URLs firmadas en pestañas**,
dejando que Chrome las baje. **Cero cambios en `core/`, cero en la cola, cero tests nuevos.** Se pierde
la carpeta organizada y el dedupe —quedan en Descargas—, pero es el grueso del valor por una fracción
del costo. Antes de tocar la cola, esto.

### 1. El tipo viaja con el ÍTEM, no con el portal

Mismo razonamiento que ADR-0010: la cola sobrevive a la pestaña, así que "qué estoy bajando" tiene
que estar en el ítem.

```ts
tipo?: 'video' | 'archivo'   // ausente = 'video'
```

Opcional y con default por el mismo motivo que `sitioId`: lo ya persistido es de antes y es video.

> **⚠️ Trampa 1 — la identidad.** `core/cola/identidadClase.ts` es hoy `(portal, título)`. Un PDF
> llamado igual que una clase **del mismo portal** colisiona, y el síntoma es el conocido: terminar
> uno saca al otro de la cola en silencio, y el espejo de progreso pinta el avance de uno en la fila
> del otro. La identidad pasa a ser `(portal, tipo, título)`, y se cambia **en el módulo compartido**,
> no en cada consumidor.

### 2. El escaneo: por qué NO va en el scraper

Los materiales cuelgan de una **lección**; `escanearListado` es por **módulo**, y además es una
función serializada que corre en la pestaña y no puede ser `async` sin cambiar el puerto.

La salida limpia es un método **opcional** nuevo que corre en el **service worker**, después del
escaneo, con las credenciales que ya se guardan (ADR-0013):

```ts
escanearAdjuntos?(hashes: string[], credenciales?): Promise<EnlaceAdjunto[]>
```

Así `escanearListado` queda intacto —serializable y síncrono, la regla más frágil del proyecto— y lo
que necesita red y token vive donde ya vive el resto.

**El costo honesto**: son **N llamadas, una por lección** (hasta 22 en *Intensivos y Pinches*), así
que el escaneo pasa de instantáneo a segundos y necesita su propio indicador de progreso.

### 3. Filtro e indicador

El filtro va donde ya está la maquinaria: `filtrosActivos` es `{ estados, materias, valoresFaceta,
portales }`, todos `Set`. Se suma **`tipos: Set<'video'|'archivo'>`** y hereda popover, contadores y
render sin inventar nada.

> **⚠️ Trampa 2 — no va en la faceta.** La faceta es el eje **de un portal**, con su vocabulario
> propio (cátedra, comisión), elegido una vez y guardado **por portal** desde ADR-0012. El tipo es
> universal y ortogonal; meterlo ahí rompe esa semántica y reabre el bug que ADR-0012 cerró.

El indicador es una insignia por fila en `<FilaClase>` (🎬 / 📄) derivada del campo `tipo`: dato
calculado, no texto scrapeado, así que no toca la frontera de escapado de `security.md`.

**Decisión de UX que pesa más de lo que parece**: el **default del filtro**. Arrancar mostrando todo
contamina la lista de quien sólo quiere videos. Recomendado: por defecto **sólo video**, y los
materiales aparecen al pedirlos.

> **🔄 REVERTIDO al construirlo (2026-08-07).** Se implementó así y **duró lo que tardó el dueño en
> abrir el popup**. El criterio no estaba mal; lo que estaba mal era el mecanismo: **un filtro
> activo que el usuario no prendió es invisible**. La lista ya venía recortada y no había cómo
> notarlo salvo contando las filas. Un default que esconde datos tiene que anunciarse, y anunciarlo
> cuesta más UI que no filtrar.
>
> **El filtro por tipo arranca vacío, como los otros cuatro ejes.** Y con eso desapareció también
> su excepción en el badge —que descontaba el default para no arrancar en "Filtros (1)"—, que era
> exactamente la clase de regla que existe sólo para tapar una decisión discutible.

### 4. El bucle y el backend: la parte más barata

`enviarFragmentoStream` no sabe qué es un video — manda bytes con `x-chunk-index` / `x-total-chunks`.
**Un archivo suelto es el chunk 0 de N.** La rama en `procesadorCola` es corta y **no toca
`hlsEngine`**:

```
si item.tipo === 'archivo':
   url = await sitio.resolverArchivo(item, credenciales)   // los dos fetch del Apéndice B
   leer el body como stream, cortarlo en bloques de ~5 MB
   mandar cada bloque con el MISMO contrato de fragmento
```

Cortar el body en bloques no es adorno: da **barra de progreso real** (un PDF de 65 MB son 13 bloques)
en vez de un salto de 0 a 100, y reusa el contrato en lugar de inventar un endpoint. Con eso el
backend probablemente **no cambia**.

> **⚠️ Trampa 3 — la extensión del archivo.** Hay que verificar en el repo del backend si le agrega
> `.mp4` al `videoTitle`. Si lo hace, ése es el único cambio real del lado del servidor — y es la
> clase de cosa que no falla: entrega un `.mp4` que en realidad es un PDF.

Y ojo con dónde cae la rama: **el bucle tiene seis ramas de clasificación de fallo y su orden es
load-bearing** (cada una existe por un bug real; ver el header del módulo). Un séptimo camino se
agrega leyendo eso primero. *(Eran cuatro hasta el 2026-08-07: las dos del portal —`rechazo` y
`bloqueo`— entraron con el fix del cartel mentiroso, ver §El 403 del master más abajo.)*

### 5. Las carpetas en disco

Hoy es `raíz/<portal>/<materia>/`, con `<materia>` = el módulo. Los materiales son de una lección
*dentro* de ese módulo:

| | dónde queda | problema |
|---|---|---|
| **Mezclado** (recomendado) | `…/miembro-superior/Yokochi 6ta ED.pdf` | dos lecciones del módulo con un `Resumen.pdf` cada una se pisan |
| Subcarpeta | `…/miembro-superior/materiales/…` | tercer nivel para un puñado de archivos, y separa el material de su clase |

Recomendado: **mezclado, con el nombre de la clase como prefijo** (`Artrologia — Yokochi 6ta ED.pdf`).
Resuelve la colisión, deja el material al lado de su video y no agrega nivel.

> **⚠️ Trampa 4 — el dedupe.** `escanearDisco` es lo que evita re-bajar lo que ya está, y compara por
> nombre. Con dos extensiones en la misma carpeta esa comparación **tiene que incluir la extensión**:
> si no, un PDF llamado igual que una clase la marca como ya descargada y **el video no se baja
> nunca, sin un error en ningún lado**. Es exactamente la clase de defecto que este proyecto documenta
> como invisible para la suite.

### Qué de esto es genérico

Los puntos 1, 3, 4 y 5 no tienen nada de Hotmart: son "la extensión baja archivos que no son HLS".
Viven acá porque acá está la decisión y la medición que los motivaron (DRY: un solo hogar). **Si
alguna vez se construye, esa parte se muda a `multisitio-diseno.md` y este apéndice queda apuntando
allá** — igual que pasó con la trampa de los globals del adaptador.
