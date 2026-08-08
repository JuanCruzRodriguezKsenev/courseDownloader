# Distribución / "deployment"

Esta extensión no tiene un pipeline de CI/CD ni un entorno de "producción" en el sentido tradicional — se distribuye como carga manual sin empaquetar (modo desarrollador), y depende de un proceso local (el backend Bun) corriendo en la máquina del usuario final. Este documento cubre ambas piezas.

## La extensión (Chrome/Brave)

**Estado actual**: distribución manual vía "Cargar descomprimida" (`chrome://extensions/`) apuntando a `.output/chrome-mv3/` — ver el paso a paso en el `README.md` raíz.

No hay publicación en la Store, empaquetado `.crx` versionado ni firma. Sí hay build:
desde la Fase 3 la extensión se compila con WXT y lo que se carga es `.output/chrome-mv3/`
(`npm run build`), no la raíz del repo. `npm run zip` produce un `.zip` si alguna vez hace falta.

**No se publica en la Chrome Web Store — y no está planeado hacerlo.** Es una extensión de uso **personal**: se carga descomprimida, para un solo usuario. Esto no es un "todavía no", es una restricción de diseño confirmada (2026-08-02), y **cambia el signo de varias decisiones técnicas**: no se ponderan la review de la Store, la optics de pedir permisos amplios ante usuarios desconocidos, ni el empaquetado/firma. El primer caso concreto fue la selección de sitio de la re-arquitectura multi-portal: descartar "una build por portal" a favor del registro en runtime (ver `docs/adr/0009-registro-de-sitios-en-runtime.md`). Lo que **sí** sigue valiendo con todo el peso: la seguridad real frente a contenido scrapeado (`docs/security.md`) y que la extensión se usa a diario y no puede quedar rota.

## El backend Bun (`ramonnet-bun-backend`)

Repositorio separado, no incluido en este monorepo. Requisitos documentados en el `README.md` raíz:

- Tener la carpeta del backend en la máquina del usuario.
- Tener [Bun](https://bun.sh/) instalado, o usar el ejecutable empaquetado.
- Arrancar con `iniciar.bat`, que expone el servidor en `http://localhost:3001`.

La extensión depende de que este servidor esté corriendo para cualquier operación de descarga real (Turbo Mode, ver `docs/tech-stack.md`) — sin él, `BunClient` falla en el primer `fetch` y la cola se pausa automáticamente vía el circuit breaker ad-hoc (`docs/patterns.md`).

**Fuera de alcance de este documento**: el deployment/build del backend Bun en sí vive en su propio repo — este documento solo cubre el contrato de integración desde el lado de la extensión (puerto, endpoints esperados, ver `core/backend/bunClient.ts` y `docs/architecture.md`).

### Contrato de endpoints (lado extensión)

Lo que la extensión **espera** del backend, derivado de `core/backend/bunClient.ts` (esa es la fuente de verdad ejecutable: si cambia, esta tabla se actualiza en el mismo PR). El host base es `http://localhost:3001` por defecto, sobreescribible sin editar código vía `globalThis.BUN_BASE_URL` o `BunClient.configurarBaseUrl(url)`. (El nombre anterior, `RAMONNET_BUN_BASE_URL`, **se sigue leyendo como alias**: nombraba al portal dentro de Capa 1, que ADR-0008 prohíbe, pero está documentado desde 2026-07-17 y puede estar seteado en el repo del backend, que es aparte.)

| Método + ruta | Entrada | Respuesta que consume la extensión |
|---|---|---|
| `GET /api/health` | — | JSON con `ruta` (la carpeta raíz configurada). Doble función: liveness probe del daemon `Conexion` **y** lectura de la ruta. Timeout duro de 4000 ms. |
| `GET /api/escanear-disco?carpeta=<sub>&sitio=<id>` | query `carpeta` y `sitio` (URL-encoded) | JSON `{ archivos: string[] }` — nombres ya guardados, para pintar clases como descargadas. **`sitio` es opcional**: sin él se mira el layout viejo de un solo nivel. |
| `POST /api/bypass-stream` | headers `x-video-title` (URL-encoded), `x-chunk-index`, `x-total-chunks`, `x-target-folder`, **`x-site-folder`**, `x-session-id`; body = fragmento binario descifrado | Sólo importa el status. Timeout 30 s. |
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

⚠️ **Lo único de esa cadena que no está medido, y el backend es otro repo**: cómo nombra el
archivo resultante. El `x-video-title` de un adjunto ya trae su extensión (`Yokochi 6ta ED.pdf`);
si el backend le agrega `.mp4` como a los videos, el archivo queda `… .pdf.mp4`. Es lo primero a
mirar al verificar ese corte en el navegador.

**Idempotencia por `x-session-id`**: cada intento de descarga genera un id nuevo, y el backend clavetea su archivo `.part` por ese id. Es lo que evita que los bytes de un intento abortado se mezclen con los del reintento.

## Versionado

La versión (actualmente `5.2.0`) vive en `wxt.config.ts` y de ahí la toma el manifest generado; no está atada a ningún proceso automático de release — se bumpea a mano. No hay changelog centralizado a nivel de release; el historial de cambios vive disperso en los banners de versión por archivo (ver `docs/coding-standards.md`) y en `git log`.
