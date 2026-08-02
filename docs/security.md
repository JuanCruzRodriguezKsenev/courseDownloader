# Seguridad

Postura de seguridad actual del proyecto y por qué se tomó cada decisión de permisos. Para el tracking de issues abiertos, ver `docs/TECHNICAL_DEBT.md` (sección Seguridad) — este documento describe el estado deseado/la política, no la lista de pendientes.

## Regla: contenido scrapeado nunca va a `.innerHTML`

Todo texto que provenga de `popup/scraper.js` (títulos de clase, nombre de materia detectado, cualquier dato leído del DOM de `plataforma.ramonnet.com.ar`) debe tratarse como **no confiable**, aunque la plataforma sea de un tercero de buena fe — el contenido de esa página puede ser modificado por cualquiera con permisos de subir clases, o por un ataque de la propia plataforma.

- ✅ Correcto: `label.innerText = clase.titulo` (patrón usado en `renderers.js:74`, `:124`).
- ✅ Correcto cuando el string HTML es inevitable (mezcla markup fijo + dato de terceros): escapar el dato con `Utils.escaparHtml` antes de interpolarlo — patrón aplicado en `popup.js:renderizarListadoInterfaz` al pasar el título a la tarjeta de estado (que pinta vía `.innerHTML`). Desde la isla Preact #4, la lista en vivo se pinta con los componentes `<TarjetaEstado>`/`<FilaClase>` de `popup/features/listaClases.preact.js` (las versiones de `renderers.js` quedaron como referencia muerta), así que la misma obligación de escapar aplica en el límite del view-model `window.ListaClases` que alimenta esos componentes.
- ❌ Incorrecto: `` card.innerHTML = `<p>${clase.titulo}</p>` `` (patrón que causó el XSS ya corregido; ver `docs/TECHNICAL_DEBT.md`, sección Resuelto).

Esta es la **fuente canónica** de la regla. `docs/coding-standards.md` la referencia con una versión de una línea (para verla al escribir código), pero el detalle y el rationale viven acá.

## Permisos declarados (`manifest.json`) y por qué

| Permiso | Para qué se usa |
|---|---|
| `declarativeNetRequest` | Bloquear requests de imagen/xhr/other a `bunnyinfra.net` (ver `rules_1.json`) — bloqueo intencional de contenido no esencial del CDN, no relacionado con el flujo de descarga. |
| `downloads` | Path legacy no-Turbo (`chrome.downloads.download`), inactivo en la práctica hoy — ver `docs/tech-stack.md`. |
| `storage` | `chrome.storage.local`/`.session` — ver `docs/data-model.md`. |
| `scripting` | Inyectar `Scraper.escanearAulaVirtual` en la pestaña activa de Ramón Net. |
| `tabs` | Detectar la pestaña activa de Ramón Net y escuchar sus cambios de URL/carga; además, enfocar (o abrir) esa pestaña al clickear la notificación nativa de fallo (`chrome.notifications.onClicked` en `background.js`). |
| `offscreen` | Documento offscreen para generar Object URLs fuera del contexto del service worker (path legacy no-Turbo). |
| `alarms` | Alarma de auto-sanación (`alarma_autoheal`) — ver `docs/patterns.md`. |
| `notifications` | Notificación nativa del SO ante un fallo terminal de la cola (clase saltada / cola pausada), disparada por `registrarFallo` en `background.js` — ver `docs/patterns.md` §Circuit breaker. El título de la clase (contenido scrapeado) viaja como **texto plano**; la API `chrome.notifications` no renderiza HTML, así que no introduce un vector de XSS. |
| `unlimitedStorage` | Evita el límite por defecto de `chrome.storage.local` (5MB), relevante si `listaPersistente`/`colaDescargas` crecen con muchas clases. |

### `host_permissions`

- `https://plataforma.ramonnet.com.ar/*`, `http://.../*` — necesario para el scraping y el fetch del HTML de cada clase con `credentials: "include"` (para reusar la sesión autenticada del usuario en el navegador).
- `https://*.bunnyinfra.net/*`, `https://*.b-cdn.net/*` — CDN que sirve los manifiestos `.m3u8` y los fragmentos `.ts`.
- `http://localhost:3001/*` — backend Bun local.

**Principio general**: los `host_permissions` están acotados a los dominios estrictamente necesarios para el flujo de la extensión — no se pide `<all_urls>` ni permisos más amplios de los que cada feature requiere.

## `credentials: "include"` en fetches a Ramón Net

`HlsEngine.extraerEnlaceMaestroM3u8Clasico` hace `fetch(..., { credentials: "include" })` contra `plataforma.ramonnet.com.ar` para reusar la cookie de sesión del usuario logueado en esa pestaña. Esto es intencional y necesario (sin la sesión, la plataforma no serviría el HTML de la clase) — no es un descuido de CSRF, porque el request es same-site respecto al dominio autenticado y está acotado por `host_permissions`.

## Cifrado de fragmentos HLS

Los fragmentos `.ts` vienen cifrados con AES-128-CBC según el estándar HLS (`#EXT-X-KEY` en el manifiesto). Se descifran con `crypto.subtle.decrypt` (WebCrypto nativo) en `Utils.descifrarFragmento` — no hay claves ni lógica criptográfica propia del proyecto, solo consumo de la clave que expone el propio manifiesto de la plataforma.

## Qué NO es un problema de seguridad (aclaración deliberada)

- El backend Bun corre solo en `localhost:3001` sin autenticación — no es un problema porque no está expuesto a la red, solo al propio usuario que corre `iniciar.bat` en su máquina.
- Los `console.log`/`console.warn`/`console.error` extensivos en el código no filtran secretos (no hay tokens ni credenciales que loguear) — son diagnóstico de progreso de descarga y estado de conexión.
