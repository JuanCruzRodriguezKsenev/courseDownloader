# Seguridad

Postura de seguridad actual del proyecto y por qué se tomó cada decisión de permisos. Para el tracking de issues abiertos, ver `docs/TECHNICAL_DEBT.md` (sección Seguridad) — este documento describe el estado deseado/la política, no la lista de pendientes.

## Regla: contenido scrapeado nunca va a `.innerHTML`

Todo texto que provenga del scraper de **cualquier** portal (`sitio/<portal>/scraper.js`: títulos de clase, nombre de materia/módulo detectado, cualquier dato leído del DOM del portal) debe tratarse como **no confiable**, aunque la plataforma sea de un tercero de buena fe — el contenido de esa página puede ser modificado por cualquiera con permisos de subir clases, o por un ataque de la propia plataforma.

- ✅ Correcto: `label.innerText = clase.titulo` (patrón usado en `renderers.js:74`, `:124`).
- ✅ Correcto cuando el string HTML es inevitable (mezcla markup fijo + dato de terceros): escapar el dato con `Utils.escaparHtml` antes de interpolarlo — patrón aplicado en `popup.js:renderizarListadoInterfaz` al pasar el título a la tarjeta de estado (que pinta vía `.innerHTML`). Desde la isla Preact #4, la lista en vivo se pinta con los componentes `<TarjetaEstado>`/`<FilaClase>` de `popup/features/listaClases.preact.js` (las versiones de `renderers.js` quedaron como referencia muerta), así que la misma obligación de escapar aplica en el límite del view-model `window.ListaClases` que alimenta esos componentes.
- ❌ Incorrecto: `` card.innerHTML = `<p>${clase.titulo}</p>` `` (patrón que causó el XSS ya corregido; ver `docs/TECHNICAL_DEBT.md`, sección Resuelto).

Esta es la **fuente canónica** de la regla. `docs/coding-standards.md` la referencia con una versión de una línea (para verla al escribir código), pero el detalle y el rationale viven acá.

## Permisos declarados (`manifest.json`) y por qué

| Permiso | Para qué se usa |
|---|---|
| `declarativeNetRequest` | Dos rulesets, uno por portal (viven en `public/sitio/<portal>/rules.json` para que WXT los copie a la ruta exacta que referencia el manifest generado). **Ramón Net**: bloquear requests de imagen/xhr/other a `bunnyinfra.net` — bloqueo intencional de contenido no esencial del CDN, no relacionado con el flujo de descarga. **Anatomy by Chris**: poner `Referer: https://hotmart.com/` en el request al embed del player, que sin él contesta 401. `Referer` es un header prohibido para `fetch`, así que dNR es la única forma de ponerlo desde el service worker; la regla está acotada por `urlFilter` a `cf-embed.play.hotmart.com/embed/` y al tipo `xmlhttprequest`, o sea que no toca la navegación del usuario. |
| `downloads` | Path legacy no-Turbo (`chrome.downloads.download`), inactivo en la práctica hoy — ver `docs/tech-stack.md`. |
| `storage` | `chrome.storage.local`/`.session` — ver `docs/data-model.md`. |
| `scripting` | Inyectar el scraper del portal en su pestaña activa (`Scraper.escanearAulaVirtual` en Ramón Net, `ScraperAnatomy.escanearListadoDelModulo` en Anatomy by Chris). Cuál se inyecta lo decide `sitio/registro.ts` según la URL de la pestaña. |
| `tabs` | Detectar la pestaña activa del portal y escuchar sus cambios de URL/carga; además, enfocar (o abrir) esa pestaña al clickear la notificación nativa de fallo (`chrome.notifications.onClicked` en `background.js`). |
| `offscreen` | Documento offscreen para generar Object URLs fuera del contexto del service worker (path legacy no-Turbo). |
| `alarms` | Alarma de auto-sanación (`alarma_autoheal`) — ver `docs/patterns.md`. |
| `notifications` | Notificación nativa del SO ante un fallo terminal de la cola (clase saltada / cola pausada), disparada por `registrarFallo` en `background.js` — ver `docs/patterns.md` §Circuit breaker. El título de la clase (contenido scrapeado) viaja como **texto plano**; la API `chrome.notifications` no renderiza HTML, así que no introduce un vector de XSS. |
| `unlimitedStorage` | Evita el límite por defecto de `chrome.storage.local` (5MB), relevante si `listaPersistente`/`colaDescargas` crecen con muchas clases. |

### `host_permissions`

**Portal 1 — Ramón Net:**

- `https://plataforma.ramonnet.com.ar/*`, `http://.../*` — necesario para el scraping y el fetch del HTML de cada clase con `credentials: "include"` (para reusar la sesión autenticada del usuario en el navegador).
- `https://*.bunnyinfra.net/*`, `https://*.b-cdn.net/*` — CDN que sirve los manifiestos `.m3u8` y los fragmentos `.ts`.

**Portal 2 — Anatomy by Chris (Hotmart Club):** son cinco porque su cadena de video pasa por cinco hosts distintos, todos medidos (ver `docs/portal-anatomy-by-chris-diseno.md` §La cadena de video). Olvidar el del CDN no se ve como un error de permisos sino como descargas que fallan en el primer fragmento.

- `https://hotmart.com/*` — el club: scraping del listado.
- `https://api-club-course-consumption-gateway-ga.cb.hotmart.com/*` — API de lecciones (paso 1 de `resolverManifiesto`).
- `https://cf-embed.play.hotmart.com/*` — el embed del player, de donde sale la URL del master.
- `https://vod-akm.play.hotmart.com/*` — Akamai: master, variante y fragmentos `.ts`.
- `https://contentplayer.hotmart.com/*` — la clave AES-128.

**Backend local:**

- `http://localhost:3001/*` — backend Bun local.

**Principio general**: los `host_permissions` están acotados a los dominios estrictamente necesarios para el flujo de la extensión — no se pide `<all_urls>` ni permisos más amplios de los que cada feature requiere.

## `credentials: "include"` en fetches a Ramón Net

`ResolverManifiesto.resolver` (`sitio/ramonnet/resolverManifiesto.js`) hace `fetch(..., { credentials: "include" })` contra `plataforma.ramonnet.com.ar` para reusar la cookie de sesión del usuario logueado en esa pestaña. Esto es intencional y necesario (sin la sesión, la plataforma no serviría el HTML de la clase) — no es un descuido de CSRF, porque el request es same-site respecto al dominio autenticado y está acotado por `host_permissions`.

## El `id_token` guardado en `chrome.storage.local` (corte 7)

**Desde el segundo portal la extensión SÍ guarda una credencial**, y hasta acá no guardaba ninguna: el `id_token` (un JWT) que la API del club de Hotmart pide como `Authorization: Bearer`. Vive en la clave `credencialesPortal` (ver `docs/data-model.md`), bajo el id del portal.

**Por qué se guarda y no se pide cada vez**: el token nace en el `localStorage` de la pestaña del portal, y quien lo necesita es el **service worker**, que resuelve el manifiesto de cada clase al bajarla y por diseño no tiene pestaña (ADR-0010: la cola sobrevive a que el usuario cierre el portal). El popup lo cosecha al escanear y lo deja disponible; re-escanear lo renueva.

Lo que hay que saber, y las reglas que salen de eso:

- **No es un secreto nuevo que la extensión crea**: es el mismo token que el portal ya tiene en el `localStorage` de su propia pestaña, con la misma vida (~12 días, medido). La extensión no lo extiende ni lo replica fuera del navegador.
- **`chrome.storage.local` no es un almacén cifrado.** Es legible por la propia extensión y por quien tenga acceso al perfil del navegador en la máquina. Es la misma superficie que el `localStorage` del portal, así que no agrega exposición — pero tampoco hay que tratarlo como si fuera una bóveda.
- **Nunca loguearlo.** No va a `console.log`, ni a un mensaje de error, ni al historial de fallos, ni al backend. Los mensajes de `resolverManifiesto` nombran el paso que falló ("credenciales", "API de lecciones", "embed"), nunca el valor.
- **Nunca sale de la máquina salvo hacia el propio portal.** El único destino legítimo es el header `Authorization` del fetch a `*.hotmart.com`, acotado por `host_permissions`. Al backend Bun viajan fragmentos y nombres de archivo, no credenciales.
- **Es opaco para el núcleo.** `core/estado/credencialesPortal.ts` guarda un `Record<string,string>` sin interpretarlo: qué claves lleva lo decide cada adaptador. Eso es lo que evita que el vocabulario de un portal (`idToken`) se filtre a Capa 1.
- **Borrarlo es seguro**: sin credenciales, la resolución falla con un mensaje explícito que pide re-escanear el portal. No corrompe la cola ni el listado.

## Cifrado de fragmentos HLS

Los fragmentos `.ts` vienen cifrados con AES-128-CBC según el estándar HLS (`#EXT-X-KEY` en el manifiesto). Se descifran con `crypto.subtle.decrypt` (WebCrypto nativo) en `Utils.descifrarFragmento` — no hay claves ni lógica criptográfica propia del proyecto, solo consumo de la clave que expone el propio manifiesto de la plataforma.

## Qué NO es un problema de seguridad (aclaración deliberada)

- El backend Bun corre solo en `localhost:3001` sin autenticación — no es un problema porque no está expuesto a la red, solo al propio usuario que corre `iniciar.bat` en su máquina.
- Los `console.log`/`console.warn`/`console.error` extensivos en el código son diagnóstico de progreso de descarga y estado de conexión, y no filtran secretos. **Ojo: hasta el corte 7 esto era cierto porque no había ningún secreto que loguear; ahora es una regla que hay que sostener** — desde que existe `credencialesPortal` (ver arriba), un `console.log` del objeto de credenciales sí filtraría un JWT a la consola del SW.
