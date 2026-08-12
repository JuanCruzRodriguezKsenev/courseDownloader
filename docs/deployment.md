# Distribución / "deployment"

Esta extensión no tiene un pipeline de CI/CD ni un entorno de "producción" en el sentido tradicional — se distribuye como carga manual sin empaquetar (modo desarrollador), y depende de un proceso local (el backend Bun) corriendo en la máquina del usuario final. Este documento cubre ambas piezas.

## La extensión (Chrome/Brave)

**Estado actual**: distribución manual vía "Cargar descomprimida" (`chrome://extensions/`) apuntando a `.output/chrome-mv3/` — ver el paso a paso en el `README.md` raíz.

No hay publicación en la Store, empaquetado `.crx` versionado ni firma. Sí hay build:
desde la Fase 3 la extensión se compila con WXT y lo que se carga es `.output/chrome-mv3/`
(`npm run build`), no la raíz del repo. `npm run zip` produce un `.zip` si alguna vez hace falta.

**No se publica en la Chrome Web Store — y no está planeado hacerlo.** Es una extensión de uso **personal**: se carga descomprimida, para un solo usuario. Esto no es un "todavía no", es una restricción de diseño confirmada (2026-08-02), y **cambia el signo de varias decisiones técnicas**: no se ponderan la review de la Store, la optics de pedir permisos amplios ante usuarios desconocidos, ni el empaquetado/firma. El primer caso concreto fue la selección de sitio de la re-arquitectura multi-portal: descartar "una build por portal" a favor del registro en runtime (ver `docs/adr/0009-registro-de-sitios-en-runtime.md`). Lo que **sí** sigue valiendo con todo el peso: la seguridad real frente a contenido scrapeado (`docs/security.md`) y que la extensión se usa a diario y no puede quedar rota.

## El backend Bun (`backend/`)

**Vive en este mismo repo desde el 2026-08-12** (ADR-0015; el cómo, en `docs/fusion-monorepo-diseno.md`). Antes era un repo aparte llamado `ramonnet-bun-backend`, y separarlos tenía un costo concreto: un cambio de contrato quedaba partido en dos commits sin vínculo, y una extensión nueva contra un backend viejo **no falla — guarda `Atlas.pdf.mp4`**. Ahora ese cambio es un solo commit.

- Está en `backend/`, no hay nada que clonar aparte.
- Tener [Bun](https://bun.sh/) instalado, o usar el ejecutable empaquetado.
- Arrancar con `backend/iniciar.bat`, que expone el servidor en `http://localhost:3001`.

La extensión depende de que este servidor esté corriendo para cualquier operación de descarga real (Turbo Mode, ver `docs/tech-stack.md`) — sin él, `BunClient` falla en el primer `fetch` y la cola se pausa automáticamente vía el circuit breaker ad-hoc (`docs/patterns.md`).

**Sigue siendo otro runtime, y eso no cambió con la fusión**: corre en Bun como proceso aparte, no comparte una línea de código con la extensión y el único acoplamiento es el contrato de acá abajo. Tiene su propio `backend/package.json` (`"type": "module"`) porque el de la raíz no declara `type` y el backend es ESM. Lo que sí ganó al entrar es el lint del repo — `eslint.config.js` tiene un bloque para `backend/**` con globals de Node + Bun.

⚠️ **La ruta raíz de descargas vive del lado del backend**, en `backend/config_usuario.json` (gitignoreado, se escribe al elegir carpeta). La extensión la **lee**, no la manda. Si movés o reinstalás el backend, ese archivo no viaja y el servidor cae a su default (`Downloads/RamonNet_Turbo`): las descargas van a otra carpeta **y** el escaneo de "ya descargado" mira la raíz nueva y te da todo por no bajado. Copialo, o volvé a elegir la carpeta desde el popup.

### Contrato de endpoints (lado extensión)

Lo que la extensión **espera** del backend, derivado de `core/backend/bunClient.ts` (esa es la fuente de verdad ejecutable: si cambia, esta tabla se actualiza en el mismo PR). El host base es `http://localhost:3001` por defecto, sobreescribible sin editar código vía `globalThis.BUN_BASE_URL` o `BunClient.configurarBaseUrl(url)`. (El nombre anterior, `RAMONNET_BUN_BASE_URL`, **se sigue leyendo como alias**: nombraba al portal dentro de Capa 1, que ADR-0008 prohíbe, pero está documentado desde 2026-07-17 y puede estar seteado en el repo del backend, que es aparte.)

| Método + ruta | Entrada | Respuesta que consume la extensión |
|---|---|---|
| `GET /api/health` | — | JSON con `ruta` (la carpeta raíz configurada). Doble función: liveness probe del daemon `Conexion` **y** lectura de la ruta. Timeout duro de 4000 ms. |
| `GET /api/escanear-disco?carpeta=<sub>&sitio=<id>` | query `carpeta` y `sitio` (URL-encoded) | JSON `{ archivos: string[] }` — nombres ya guardados, para pintar clases como descargadas. **`sitio` es opcional**: sin él se mira el layout viejo de un solo nivel. |
| `POST /api/bypass-stream` | headers `x-video-title` (URL-encoded), `x-chunk-index`, `x-total-chunks`, `x-target-folder`, **`x-site-folder`**, `x-session-id`, **`x-file-name`** (URL-encoded, sólo en adjuntos — ver abajo); body = fragmento binario descifrado | Sólo importa el status. Timeout 30 s. |
| `GET /api/seleccionar-carpeta` | — | JSON `{ success: boolean, ruta: string }` — abre el diálogo nativo de carpeta. |
| `GET /api/cancelar-descarga?titulo=&sessionId=&sitio=` | query | Sólo el status; los fallos se tragan (best-effort). **`sitio` importa**: sin él el backend podría borrar el `.part` de la clase homónima de otro portal. |
| `POST /api/actualizar-consola` | JSON `{ titulo, porcentaje, terminados, totales, velocidad }` | Sólo el status; los fallos se tragan (telemetría a la consola gráfica del server). |

### El layout en disco lleva el portal

**Desde el 2026-08-06 (corte multiportal E).** La ruta pasó de `raíz/<materia>/` a
**`raíz/<portal>/<materia>/`**, con el `sitioId` como nombre de carpeta. Sin esa dimensión, dos
clases homónimas de la misma materia en portales distintos escribían el mismo archivo.

Cómo viaja el dato, y por qué así:

- En su **propio** header (`x-site-folder`) y su **propio** query (`sitio`), nunca concatenado a
  la materia. El backend sanitiza cada segmento con `path.basename()`, así que un
  `"portal/materia"` se colapsaría a `"materia"` y la carpeta de portal desaparecería **sin que
  nada avise**.
- **Todo opcional**: sin esos datos el backend se comporta como antes (un solo nivel). Eso
  permite que una extensión vieja hable con un backend nuevo, y viceversa.
- El acumulador en memoria del backend también pasó a estar tecleado por `<portal>|<titulo>`:
  antes, dos descargas homónimas compartían sesión, stream y archivo temporal `.part`.

**Migración de lo ya descargado: es manual y a propósito.** Los videos viejos viven en
`raíz/<materia>/` y ningún código los mueve — la extensión los daría por no descargados hasta
que el dueño los reacomode dentro de `raíz/<portal>/`. Se decidió así porque mover archivos del
usuario es irreversible y el backend no tenía historial (ahora sí: se versionó en el mismo
cambio).

**El status de `/api/bypass-stream` es contrato, no detalle**: un **4xx** se interpreta como rechazo aplicativo con el server vivo → se reintenta N=3 y se **salta esa clase** sin pausar la cola; un **5xx** o un timeout se interpretan como caída → **pausa + auto-heal**. Un backend que devuelva 4xx ante una condición transitoria hace que la extensión descarte clases recuperables (es exactamente el bug 400 — ver `docs/TECHNICAL_DEBT.md` y `docs/patterns.md` §Circuit breaker).

**Un archivo suelto (un PDF adjunto) viaja por el MISMO endpoint**, desde el corte 5 del escaneo
por API: `/api/bypass-stream` no sabe qué es un video —recibe bytes con `x-chunk-index` /
`x-total-chunks`—, así que un adjunto es *el chunk 0 de N*, cortado en bloques de 5 MB para que
haya progreso real. Con eso el backend **probablemente no cambia**.

### ✅ `x-file-name`: el nombre de archivo lo pide la extensión

**Construido y verificado el 2026-08-07 en los dos repos.** Era el riesgo R9: el backend le pegaba
`.mp4` a todo lo que recibía —correcto mientras lo único que recibía eran videos— y un adjunto salía
`Atlas_Fotografico_Anatomia.pdf.mp4`: un PDF válido con un nombre que ningún visor abre.

**No se podía arreglar desde la extensión**: el nombre lo escribe el backend. Lo que la extensión
manda es el dato que hace falta:

| header | valor | cuándo |
|---|---|---|
| `x-file-name` | el nombre final **con su extensión**, URL-encodeado (`Yokochi%206ta%20ED.pdf`) | sólo en adjuntos; **vacío** en videos |

**El contrato es "si viene, mandá; si no, hacé lo de siempre"** — un `if`, y los videos no cambian:

```js
// donde hoy arma el nombre del archivo final
const nombrePedido = decodeURIComponent(req.headers.get("x-file-name") || "");
const nombreFinal = nombrePedido
  ? path.basename(nombrePedido)          // basename, por lo mismo que el resto: sanitiza el segmento
  : `${tituloSanitizado}.mp4`;           // el camino de siempre
```

Dos cosas que conviene no hacer, y que se descartaron acá:

- **Sacarle el `.pdf` al título** para que quede `Atlas.mp4`. Es peor: pierde el dato en vez de
  duplicarlo, y deja un archivo que tampoco abre pero que además ya no dice qué era.
- **Un endpoint nuevo para adjuntos.** El de fragmentos ya sirve —un archivo suelto es el chunk 0
  de N— y sumar un segundo camino de escritura duplicaría el `.part`, la idempotencia por
  `x-session-id` y el acumulador.

**Ya está del lado del backend** (commits `8797ec6` + `79726a9`, hoy en `backend/` — fueron dos
commits en otro repo, y es **el caso que motivó ADR-0015**), y con él
vinieron otros dos cambios que el mismo corte destapó:

- **`escanear-disco` dejó de filtrar sólo `.mp4`.** Era un fallo silencioso: un PDF ya bajado nunca
  se reportaba, así que la extensión lo mostraba pendiente para siempre y lo volvía a bajar en cada
  ráfaga. La forma del fix tiene una asimetría **deliberada** — al video se le saca la extensión y
  al adjunto no—, porque la extensión compara estos nombres contra el título de la clase y el
  título de un adjunto **es** su nombre de archivo.
- **Los `.part` volvieron a quedar afuera**, y esto fue una regresión del cambio anterior:
  `endsWith(".mp4")` estaba filtrando **dos** cosas —el tipo de archivo y los temporales— y al
  aflojarlo entraron los dos. El efecto pegaba justo durante una descarga: la extensión cruzaba
  `Clase 1.mp4.part` con su `includes` de respaldo y marcaba **como descargada la clase que se
  estaba bajando**.

**La lección, para la próxima vez que se toque ese filtro**: un predicado que filtra por extensión
suele estar filtrando más de una cosa a la vez. Antes de aflojarlo, enumerá qué deja afuera hoy.

⚠️ **Una extensión nueva contra un backend viejo sigue funcionando**: el header se ignora y los PDF
salen `.pdf.mp4`. El archivo es correcto — renombrarlo sacándole `.mp4` lo deja usable.

**Idempotencia por `x-session-id`**: cada intento de descarga genera un id nuevo, y el backend clavetea su archivo `.part` por ese id. Es lo que evita que los bytes de un intento abortado se mezclen con los del reintento.

## Versionado

La versión (actualmente `5.2.0`) vive en `wxt.config.ts` y de ahí la toma el manifest generado; no está atada a ningún proceso automático de release — se bumpea a mano. No hay changelog centralizado a nivel de release; el historial de cambios vive disperso en los banners de versión por archivo (ver `docs/coding-standards.md`) y en `git log`.
