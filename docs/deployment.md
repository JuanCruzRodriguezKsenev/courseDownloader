# Distribución / "deployment"

Esta extensión no tiene un pipeline de CI/CD ni un entorno de "producción" en el sentido tradicional — se distribuye como carga manual sin empaquetar (modo desarrollador), y depende de un proceso local (el backend Bun) corriendo en la máquina del usuario final. Este documento cubre ambas piezas.

## La extensión (Chrome/Brave)

**Estado actual**: distribución manual vía "Cargar descomprimida" (`chrome://extensions/`) — ver el paso a paso en el `README.md` raíz (esa sección sí sigue siendo la guía correcta para usuarios finales no técnicos).

No hay:
- Publicación en Chrome Web Store (no evaluado todavía).
- Empaquetado `.crx`/`.zip` versionado automáticamente.
- Firma de extensión.

**Si en el futuro se evalúa publicar en Chrome Web Store**: revisar `manifest.json` contra los requisitos de la Chrome Web Store (política de permisos, descripción, iconos en los tamaños requeridos — ya están presentes en `icons/`), y considerar en ese momento si conviene introducir un bundler (ver `docs/adr/0001-no-bundler-or-typescript-yet.md`) para minificar antes de subir el paquete. No es parte del roadmap actual (`docs/ROADMAP.md`).

## El backend Bun (`ramonnet-bun-backend`)

Repositorio separado, no incluido en este monorepo. Requisitos documentados en el `README.md` raíz:

- Tener la carpeta del backend en la máquina del usuario.
- Tener [Bun](https://bun.sh/) instalado, o usar el ejecutable empaquetado.
- Arrancar con `iniciar.bat`, que expone el servidor en `http://localhost:3001`.

La extensión depende de que este servidor esté corriendo para cualquier operación de descarga real (Turbo Mode, ver `docs/tech-stack.md`) — sin él, `BunClient` falla en el primer `fetch` y la cola se pausa automáticamente vía el circuit breaker ad-hoc (`docs/patterns.md`).

**Fuera de alcance de este documento**: el deployment/build del backend Bun en sí vive en su propio repo — este documento solo cubre el contrato de integración desde el lado de la extensión (puerto, endpoints esperados, ver `shared/bunClient.js` y `docs/architecture.md`).

### Contrato de endpoints (lado extensión)

Lo que la extensión **espera** del backend, derivado de `shared/bunClient.js` (esa es la fuente de verdad ejecutable: si cambia, esta tabla se actualiza en el mismo PR). El host base es `http://localhost:3001` por defecto, sobreescribible sin editar código vía `globalThis.RAMONNET_BUN_BASE_URL` o `BunClient.configurarBaseUrl(url)`.

| Método + ruta | Entrada | Respuesta que consume la extensión |
|---|---|---|
| `GET /api/health` | — | JSON con `ruta` (la carpeta raíz configurada). Doble función: liveness probe del daemon `Conexion` **y** lectura de la ruta. Timeout duro de 4000 ms. |
| `GET /api/escanear-disco?carpeta=<sub>` | query `carpeta` (URL-encoded) | JSON `{ archivos: string[] }` — nombres ya guardados, para pintar clases como descargadas. |
| `POST /api/bypass-stream` | headers `x-video-title` (URL-encoded), `x-chunk-index`, `x-total-chunks`, `x-target-folder`, `x-session-id`; body = fragmento binario descifrado | Sólo importa el status. Timeout 30 s. |
| `GET /api/seleccionar-carpeta` | — | JSON `{ success: boolean, ruta: string }` — abre el diálogo nativo de carpeta. |
| `GET /api/cancelar-descarga?titulo=&sessionId=` | query | Sólo el status; los fallos se tragan (best-effort). |
| `POST /api/actualizar-consola` | JSON `{ titulo, porcentaje, terminados, totales, velocidad }` | Sólo el status; los fallos se tragan (telemetría a la consola gráfica del server). |

**El status de `/api/bypass-stream` es contrato, no detalle**: un **4xx** se interpreta como rechazo aplicativo con el server vivo → se reintenta N=3 y se **salta esa clase** sin pausar la cola; un **5xx** o un timeout se interpretan como caída → **pausa + auto-heal**. Un backend que devuelva 4xx ante una condición transitoria hace que la extensión descarte clases recuperables (es exactamente el bug 400 — ver `docs/TECHNICAL_DEBT.md` y `docs/patterns.md` §Circuit breaker).

**Idempotencia por `x-session-id`**: cada intento de descarga genera un id nuevo, y el backend clavetea su archivo `.part` por ese id. Es lo que evita que los bytes de un intento abortado se mezclen con los del reintento.

## Versionado

`manifest.json` tiene un campo `version` (actualmente `5.2.0`) que no está atado a ningún proceso automático de release — se bumpea manualmente. No hay changelog centralizado a nivel de release; el historial de cambios vive disperso en los banners de versión por archivo (ver `docs/coding-standards.md`) y en `git log`.
