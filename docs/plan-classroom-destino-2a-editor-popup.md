# Plan — Corte 2a, abrir el editor de adopción desde el popup

**Rama**: `classroom-destino-adopcion` (sobre `fbfc2ee` + el commit de este plan). **Fecha**: 2026-09-27.
**Plan anterior**: `docs/plan-classroom-destino-2a-editor.md` (el editor, ya implementado en `9b6e550`).
**Spec**: `docs/specs/classroom-destino/spec.md`. Este plan no implementa ningún `RN-n` ni `AC-n`: es
herramienta de la adopción (corte 2a), igual que el editor. La pantalla de verdad dentro de la extensión sigue
siendo el corte 2c.

## Por qué

Decisión del dueño (2026-09-27): el editor se abre **desde la extensión** y no levantando a mano otro proceso
en el 3002. Opción elegida entre tres:

- **Elegida**: el editor pasa a colgar del servidor Bun del **3001**, el mismo que el dueño ya levanta para
  descargar, bajo `/adopcion/`. El popup suma un enlace 🗂️ en el encabezado que abre esa página en una pestaña.
- Descartadas: un enlace al 3002, que da una página de error si no está levantado, y adelantar el corte 2c.

El modo suelto (`bun backend/adopcion/editor.js --salida … --puerto 3002`) **se conserva sin cambios de
comportamiento**, porque la Verificación A del plan anterior lo usa sobre una copia de los TSV.

## Qué hacen hoy las piezas que se tocan

- `backend/adopcion/editor.js` (378 líneas):
  - `parseArgs()` arma `opts = { raiz: ~/U.N.L.P, salida: ~/Descargas/adopcion-classroom, puerto: 3002 }` y
    lo pisa con `--raiz`, `--salida` y `--puerto`.
  - `iniciarServidor(opts)` hace `Bun.serve` en `127.0.0.1:opts.puerto` con un único `fetch(req)`. Ese
    `fetch` atiende `GET /` (lee `editor.html` con `import.meta.dir`), `GET /api/datos`, `POST /api/guardar`
    y `POST /api/ensayo`, y al final devuelve `404 "No encontrado"`.
  - Al final del archivo, `if (import.meta.main) iniciarServidor();`: importarlo desde otro módulo **no**
    levanta nada.
  - Importa `DESTINOS` de `../../core/destino/carpetas.ts`. Bun importa `.ts` directo.
- `backend/adopcion/editor.html`: usa **rutas absolutas** en sus tres `fetch`: `"/api/datos"` (línea 512),
  `"/api/guardar"` (1107) y `"/api/ensayo"` (1153). No tiene ningún otro `href` ni ruta absoluta.
- `backend/server.js`: `Bun.serve` en `HOST:PORT` (`127.0.0.1:3001`, `backend/config.js:5-6`). El `fetch`
  responde el preflight `OPTIONS`, después un router de `if (url.pathname === … && method === …)` para las
  seis rutas `/api/*`, y al final `404 "Not Found"` con `corsHeaders`.
  - **`CARPETA_RAIZ_VIDEOS` no sirve como raíz del editor.** Es la raíz de descargas por portal
    (`raíz/<portal>/<materia>`), y hoy `backend/config_usuario.json` apunta a
    `/home/jcrod/Descargas/verificacion-b`. El editor necesita `~/U.N.L.P` (`facultad/materia`), que es su
    default. **No la uses.**
- `entrypoints/popup/index.html:36-44`: `.header-right` tiene, en este orden, `#ui-btn-help` (❓, clase
  `btn-help-icon`), la isla `#preact-campanita` y la isla `#preact-status-dot`.
- `styles/components/help-button.css`: `.btn-help-icon` no define `text-decoration`, porque hasta hoy sólo lo
  usaban `<button>`.
- Precedente de enlace sin JS en el popup: `popup/features/onboarding.preact.js:135` usa
  `<a href=… target="_blank">`, que abre una pestaña nueva y cierra el popup. **No hace falta `chrome.tabs` ni
  un permiso**: navegar a `http://127.0.0.1:3001` desde un enlace no pasa por `host_permissions`.

## Paso 1 — `backend/adopcion/editor.js`: el manejador se separa del servidor

1. Extraé los defaults a `export function opcionesPorDefecto()`, que devuelve el mismo objeto que hoy arma
   `parseArgs` (`raiz`, `salida`, `puerto`). `parseArgs()` arranca de ahí y aplica los flags igual que ahora.
2. Mové todo el cuerpo del `fetch` actual a
   `export function crearManejadorEditor(opts, prefijo = "")`. Devuelve `async (req, url) => Response | null`.
   - Cada ruta pasa a compararse contra `` `${prefijo}/` ``, `` `${prefijo}/api/datos` ``,
     `` `${prefijo}/api/guardar` `` y `` `${prefijo}/api/ensayo` ``. Con `prefijo = ""` quedan exactamente las
     rutas de hoy.
   - Si `prefijo !== ""`, `GET` exacto a `prefijo` (sin barra final) devuelve
     `new Response(null, { status: 301, headers: { location: prefijo + "/" } })`. Sin eso, los `fetch`
     relativos del Paso 2 resolverían contra `/` y pegarían en las rutas `/api/*` de la extensión.
   - **Guardia de host**, lo primero para cualquier ruta del editor: si `url.hostname` no es `127.0.0.1` ni
     `localhost`, devolver `403` con `{ ok: false, errores: ["host no permitido"] }`. Esto bloquea un DNS
     rebinding contra el 3001.
   - **Guardia de origen** en `POST …/api/guardar` y `POST …/api/ensayo`, **antes** de leer el cuerpo o
     tocar disco. Si `req.headers.get("origin")` existe y es distinto de `url.origin`, devolver `403` con
     `{ ok: false, errores: ["origen no permitido"] }`. Si no existe, como en `curl`, pasa.
     - **Por qué**: el 3001 corre siempre que el dueño descarga, y un POST "simple" desde cualquier página
       web lo alcanza sin preflight. Hoy `guardar` escribiría los TSV reales.
   - La ruta que no es del editor devuelve **`null`**, no 404.
3. `iniciarServidor(opts = parseArgs())` queda así:
   `const manejar = crearManejadorEditor(opts, "")`. Su `fetch` hace
   `return (await manejar(req, new URL(req.url))) ?? new Response("No encontrado", { status: 404 })`. Los dos
   `console.log` finales no cambian.

**Radio de impacto**: `editor.js` lo importan sólo `server.js`, desde el Paso 3, y la línea de comando.
`aplicar.js` y `generar.js` no lo importan; confirmalo con `grep -rn "adopcion/editor" backend core`. Las
funciones `leerTsvCrudo`, `escribirTsvCrudo`, `obtenerMaterias` y `obtenerDocentes` no cambian.

## Paso 2 — `backend/adopcion/editor.html`: `fetch` relativos

Cambiá los tres `fetch` a rutas relativas: `"api/datos"`, `"api/guardar"` y `"api/ensayo"`, sin barra
inicial. En modo suelto la página vive en `/`, así que resuelven igual que hoy. Colgada de `/adopcion/`,
resuelven a `/adopcion/api/…`. No toques nada más del HTML.

Contraste: `grep -n 'fetch("/' backend/adopcion/editor.html` tiene que dar **0 líneas** después del cambio.

## Paso 3 — `backend/server.js`: montar el editor en `/adopcion/`

1. Importá `crearManejadorEditor` y `opcionesPorDefecto` de `./adopcion/editor.js`, y a nivel de módulo
   creá `const manejarAdopcion = crearManejadorEditor(opcionesPorDefecto(), "/adopcion");`.
2. En el `fetch`, **después** del preflight `OPTIONS` y **antes** del `return 404` final:
   ```js
   if (url.pathname === "/adopcion" || url.pathname.startsWith("/adopcion/")) {
     const respuesta = await manejarAdopcion(request, url);
     if (respuesta) return respuesta;
   }
   ```
3. Agregá un `console.log` de arranque junto a los otros:
   `📝 [BUN-CORE] Editor de adopción: http://${HOST}:${PORT}/adopcion/`.

No toques las seis rutas `/api/*`, los `corsHeaders`, el limpiador por inactividad ni `cerrarServidor`. El
editor no lleva CORS: su página es del mismo origen.

**Radio de impacto**: `server.js` lo arrancan `backend/iniciar.bat` y `bun backend/server.js`. El backend no
tiene tests (AGENTS.md §Development Workflow): sólo lo cubren el lint y la verificación de abajo.

## Paso 4 — Popup: el enlace 🗂️

1. En `entrypoints/popup/index.html`, dentro de `.header-right` y **antes** de `#ui-btn-help`:
   ```html
   <a id="ui-link-adopcion" class="btn-help-icon" href="http://127.0.0.1:3001/adopcion/"
      target="_blank" rel="noopener"
      title="Editor de adopción de Classroom (necesita el servidor Bun)">🗂️</a>
   ```
   - `127.0.0.1` y no `localhost`, porque el servidor escucha sólo en IPv4 (`config.js:6`).
   - **No es un feature ni lleva JS**. La regla "un concern de UI nuevo es un feature" (AGENTS.md
     §Execution contexts) apunta a lógica con dependencias, y esto es un enlace estático con precedente en
     `onboarding.preact.js:135`. Se va con el corte 2c.
   - Queda **siempre visible y habilitado**. Si el servidor está apagado, la pestaña muestra el error de
     conexión del navegador, y el puntito de estado del popup ya lo dice en rojo.
2. En `styles/components/help-button.css`, agregá `text-decoration: none;` a `.btn-help-icon`. En un
   `<button>` no cambia nada. No hace falta tocar `popup/globals.css`, porque el archivo ya está importado.

**Radio de impacto**: `verificacion/modoVerificacion.js:508` y `:730` insertan el 🧪 antes de `#ui-btn-help`
y lo buscan por id. Siguen funcionando, con el 🧪 entre 🗂️ y ❓. Ningún test busca hijos de `.header-right`.
Confirmalo con `grep -rn "header-right" --include='*.test.*' popup verificacion core entrypoints`, que tiene que dar vacío.

## Paso 5 — Docs

- `docs/deployment.md`: debajo de la tabla de §Contrato de endpoints (línea ~40) agregá un párrafo corto.
  **Contrastalo antes** con el título de la tabla, "lado extensión": estas rutas no las consume la extensión
  por `BunClient`, así que **no van en la tabla**. El párrafo dice que `/adopcion/` sirve el editor de los
  TSV de adopción de Classroom (`backend/adopcion/editor.js`); que es temporal, del corte 2a; que lee
  `~/Descargas/adopcion-classroom` y `~/U.N.L.P` fijos, no `config_usuario.json`; y que sus POST rechazan
  otro `Origin`.
- `docs/ramas-en-revision.md`, ítem **A-2**: reemplazá "Tanda levanta `bun backend/adopcion/editor.js` y el
  dueño abre `http://127.0.0.1:3002`" por "Con el servidor Bun del 3001 levantado, el dueño abre el editor
  con 🗂️ en el encabezado del popup (`http://127.0.0.1:3001/adopcion/`)". El resto de A-2 no cambia.

## Verificación A (obra)

**Si el puerto 3001 está ocupado** (`ss -ltn | grep ':3001'` da algo), parate y reportalo: es el servidor
del dueño. No lo mates.

Sobre el 3001 **sólo** se hacen lecturas, el ensayo (que no escribe) y POST que la guardia rechaza antes de
tocar disco, porque ahí el editor apunta a los TSV **reales**. Todo lo que escribe se prueba en modo suelto
sobre la copia.

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build   # 50/837, lint 0/0
grep -n 'fetch("/' backend/adopcion/editor.html | wc -l                   # (p) 0
grep -rn "adopcion/editor" backend core | grep -v '^backend/adopcion/'    # (q) sólo backend/server.js
grep -c 'ui-link-adopcion' .output/chrome-mv3/popup.html                  # (r) 1
```

Después, el bloque **completo** de "Verificación A" de `docs/plan-classroom-destino-2a-editor.md`, del
`T=…` al `kill $PID` (pasos (a) a (n)), **sin cambios** y con la línea (c) ya corregida en `7db3d66`. Todos
los valores esperados siguen iguales: prueban que el modo suelto no cambió. Repetí también su control
negativo del (e).

Después, el montaje en el 3001:

```bash
S=~/Descargas/adopcion-sim/popup; mkdir -p $S; sha256sum ~/Descargas/adopcion-classroom/*.tsv > $S/antes.sha
bun backend/server.js > $S/server.log 2>&1 & PID=$!; sleep 1
grep -c 'adopcion/' $S/server.log                                          # (s) 1
curl -s localhost:3001/api/health | jq -c 'keys'                          # (t) incluye "ruta" (rutas viejas intactas)
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' 127.0.0.1:3001/adopcion   # (u) 301 http://127.0.0.1:3001/adopcion/
curl -s 127.0.0.1:3001/adopcion/ | head -c 15; echo                        # (v) <!doctype html>
curl -s 127.0.0.1:3001/adopcion/api/datos | jq -c '[(.cursos|length), (.temas|length), (.archivos|length), (.materias|index("Ingenieria/Fisica 1")!=null)]'   # (w) [7,45,366,true]
curl -s -XPOST 127.0.0.1:3001/adopcion/api/ensayo | jq '.codigo'           # (x) 1 (los 2 choques siguen)
curl -s -XPOST -H 'Origin: https://ejemplo.com' -H 'Content-Type: text/plain' -d '{}' 127.0.0.1:3001/adopcion/api/guardar -w ' %{http_code}\n'   # (y) {"ok":false,"errores":["origen no permitido"]} 403
curl -s -XPOST -H 'Origin: https://ejemplo.com' 127.0.0.1:3001/adopcion/api/ensayo -o /dev/null -w '%{http_code}\n'   # (z) 403
curl -s -H 'Host: ejemplo.com:3001' 127.0.0.1:3001/adopcion/api/datos -w ' %{http_code}\n'   # (aa) {"ok":false,"errores":["host no permitido"]} 403
curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:3001/adopcion/nada      # (ab) 404
kill $PID
sha256sum -c $S/antes.sha                                                  # (ac) los tres OK: nada escribió los TSV reales
```

Si (w) no da 45 temas (medido por el verificador el 2026-09-27 en modo suelto), pegalo.

## Verificación B (tanda, con Claude in Chrome en el Brave del dueño)

Con `pnpm run build`, la extensión recargada y el servidor del 3001 levantado:

- **P-1.** El encabezado del popup muestra 🗂️ antes de ❓, alineado con el resto, sin subrayado y con el
  mismo hover.
- **P-2.** Click en 🗂️: abre una pestaña en `http://127.0.0.1:3001/adopcion/` con el editor cargado. Se ven
  las tres secciones y los contadores 299 / 55 / 4 / 8 / 2 choques.
- **P-3.** En esa pestaña, "Probar" muestra la salida del ensayo (`codigo` 1 por los choques). **No se
  guarda nada**: el 3001 apunta a los TSV reales, y guardar es la tarea A-2 del dueño.
- **P-4.** Con el servidor apagado, 🗂️ sigue visible y la pestaña muestra el error de conexión del navegador.
- Los ítems E-1 a E-6 del plan anterior se corren en modo suelto (3002) sobre la copia, no acá.

## Hallazgos

Anotá lo que veas y no esté nombrado arriba. No lo arregles.
