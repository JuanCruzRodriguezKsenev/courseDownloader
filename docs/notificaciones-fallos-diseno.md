# Notificaciones de fallos (nativa + campanita) — diseño de ejecución

Diseño concreto de la feature de avisos de fallos de cola: **notificación nativa del SO**
en el momento del fallo + **campanita persistente** en el header del popup (badge de
no-leídos + panel con historial). Cubre los 4 tipos de fallo terminal: `rechazo` (4xx del
backend, clase saltada), `sesion`, `servidor` e `internet` (cola pausada). Mismo formato
que `docs/rearquitectura-diseno.md`: este documento es el "cómo"; se elimina o se absorbe
en los docs canónicos (`data-model.md`, `patterns.md`, `preact-migration.md`) cuando la
feature esté implementada.

> **Estado**: ✅ **implementada** (2026-07-20, `background.js` v5.10.0, `manifest.json`
> v5.2.0, `shared/historialFallos.js` v1.0.0, `popup/features/campanita.preact.js`
> v1.0.0). El detalle canónico ya vive en los docs de siempre (`data-model.md`,
> `security.md`, `patterns.md` §Circuit breaker, `preact-migration.md` isla #5); este
> documento queda como registro del "cómo" / rationale de ejecución.
>
> Decisiones tomadas: la campanita es una **isla Preact** (no feature vanilla), y
> clickear la notificación nativa **enfoca/abre la pestaña de Ramón Net**.
>
> **Fix v5.10.1** (`background.js`): el aviso (historial + notificación) es un efecto
> secundario **best-effort** que NO puede frenar la cola — `registrarFallo` no propaga
> excepciones y el registro de `onClicked` va con guarda. El permiso `notifications`
> requiere **recargar la extensión desde la tarjeta** de `chrome://extensions` (no solo
> el link del service worker) para tomar efecto; hasta entonces `chrome.notifications`
> no existe en el SW y la notificación se saltea con un warn en consola.

## Contexto

Hoy, cuando la cola falla, el único aviso es un `console.warn`/`console.error` en la
consola del SW y un IPC (`clase_con_error` / `cola_pausada_por_error`) que el popup
consume para pintar UI **solo si está abierto en ese momento**. Con el popup cerrado, el
usuario no se entera de que la cola se frenó o que se saltó una clase hasta que vuelve a
abrirlo — y ni siquiera ahí queda historial, solo el estado actual.

## 1. `shared/historialFallos.js` (nuevo, dual-export)

Mismo patrón que `shared/conexion.js`/`core/backend/bunClient.ts` (cargado por `<script>`
clásico en el popup y por `importScripts` en el SW; exporta a `module.exports` /
`window` / `self`). Fuente de verdad en `chrome.storage.local` bajo la clave
`historialFallos` (NO `.session`: debe sobrevivir reinicios, igual que
`listaPersistente`).

Forma de cada entrada (`HistorialFallo`):

```ts
{
  id: string,        // `${Date.now()}-${Math.random().toString(36).slice(2,8)}` — no hay clave natural
  tipo: "rechazo" | "sesion" | "servidor" | "internet",
  titulo: string,    // título de la clase en curso al fallar (siempre poblado en los 2 call sites)
  motivo: string,    // copy humano, texto plano
  ts: number,        // Date.now()
  leido: boolean     // false al insertar
}
```

API:

- `CLAVE_STORAGE = "historialFallos"`, `LIMITE = 50`.
- `async registrar(tipo, titulo, motivo)` — lee, `unshift` de la nueva entrada
  (`leido:false`), recorta a `LIMITE` (`.slice(0, LIMITE)`), escribe, devuelve la
  entrada creada (el SW usa su `id` para `chrome.notifications.create`).
- `async obtener()` — devuelve el array (`[]` si no existe la clave).
- `async contarNoLeidos()` — conveniencia, `(await obtener()).filter(f => !f.leido).length`.
- `async marcarTodosLeidos()` — un solo `.set` con todos los `leido:true`.
- `async limpiar()` — `.set({ historialFallos: [] })`.
- `suscribir(cb)` — escucha `chrome.storage.onChanged` filtrando `area === "local"` y
  `cambios.historialFallos`; a diferencia de `Conexion`, **no** mantiene espejo en
  memoria (no hay `.get()` síncrono) — llama `cb()` sin payload y el suscriptor vuelve
  a pedir `obtener()`. Devuelve función de desuscripción. El listener de `onChanged`
  se registra **lazy, en el primer `suscribir()`** (no al cargar el módulo): así el SW
  —que solo escribe, nunca se suscribe— no registra un listener muerto, y los tests de
  CRUD puro no necesitan mockear `onChanged`.

Nota de concurrencia (aceptada, no bloquea): `registrar` (SW) y
`marcarTodosLeidos`/`limpiar` (popup) hacen read-modify-write sobre la misma clave desde
contextos distintos; una colisión exacta podría perder una escritura. Es el mismo
trade-off ya asumido por las demás claves de `chrome.storage.local` del proyecto (no hay
transacciones); la ventana es de milisegundos y el dato es un historial informativo — se
documenta en `data-model.md` y no se mitiga.

Cableado: agregar `shared/historialFallos.js` al `importScripts(...)` de
`background.js:88` (junto a `shared/conexion.js`) y a `popup/popup.html` como `<script>`
clásico junto a `../shared/conexion.js`. Agregar `HistorialFallos: "readonly"` a los
globals de `eslint.config.js` (junto a `Conexion`/`BunClient`, línea ~12).

## 2. `background.js` — choke point único

Nuevo wrapper cerca de `pausarColaPorErrorDeConexion` (línea ~706):

```js
const MOTIVOS_PAUSA = {
  sesion: "no hay sesión activa en Ramón Net",
  servidor: "se perdió la conexión con el servidor local",
  internet: "se perdió la conexión a internet",
};
const TITULOS_NOTIF = {
  rechazo: "Clase saltada",
  sesion: "Sesión expirada",
  servidor: "Servidor desconectado",
  internet: "Sin conexión a internet",
};

async function registrarFallo(tipo, titulo, motivo) {
  const entrada = await HistorialFallos.registrar(tipo, titulo, motivo);
  chrome.notifications.create(entrada.id, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: TITULOS_NOTIF[tipo] || "Fallo en la descarga",
    message: titulo ? `"${titulo}": ${motivo}` : motivo,
    priority: 1,
  });
}
```

Dos call sites (cubren los 4 tipos sin duplicar):

- **Rama `rechazo`** (`background.js:647-667`): justo antes del
  `chrome.runtime.sendMessage({action:"clase_con_error", ...})` ya existente, reusando
  el `motivo` ya construido ahí:
  `await registrarFallo("rechazo", tituloInmutableVideo, \`el backend rechazó sus fragmentos (HTTP ${errDescarga.httpStatus})\`);`
- **Dentro de `pausarColaPorErrorDeConexion(tipoError, titulo)`** (`background.js:706`),
  cubre `sesion`/`servidor`/`internet` desde sus 2 únicos call sites (líneas 637 y 686)
  sin tocarlos. Insertar **después** del `SessionState.set` (que persista la pausa es lo
  crítico; la notificación es secundaria) y sin dejar que un fallo de
  storage/notificación aborte la pausa:
  `registrarFallo(tipoError, titulo, MOTIVOS_PAUSA[tipoError] || "error de conexión").catch(() => {});`
  (mismo criterio fire-and-forget que el `.catch(() => {})` del `sendMessage` de esa
  función). En la rama `rechazo` sí puede ir con `await` — ahí no hay estado crítico
  posterior que proteger.

**Sin riesgo de spam**: ambos puntos se alcanzan solo tras agotar reintentos (rechazo,
N=3 ya resuelto aguas arriba en `hlsEngine.js`) o una única transición de pausa
(`pausarColaPorErrorDeConexion` no está en un loop de reintento; la alarma de autoheal
llama a `reanudarColaDesdeBackground()`, un path distinto que no invoca esto).

**Listener de click**, registrado junto a los demás listeners top-level (después del
bloque `chrome.alarms.onAlarm.addListener`, `background.js:745-774`):

```js
chrome.notifications.onClicked.addListener(async (notificationId) => {
  chrome.notifications.clear(notificationId);
  const [tab] = await chrome.tabs.query({ url: "https://plataforma.ramonnet.com.ar/*" });
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: "https://plataforma.ramonnet.com.ar/" });
  }
});
```

`"tabs"` + el host permission ya presente cubren `tabs.query/update` y
`windows.update`; no hace falta el permiso `"windows"`.

**⚠️ `background.test.js` DEBE actualizarse en el mismo paso o el suite entero se
rompe**: ese test importa `background.js` con un mock de `chrome` que hoy NO tiene
`notifications` (solo `runtime`/`storage`/`alarms`/`downloads`, líneas 49-62). El nuevo
`chrome.notifications.onClicked.addListener(...)` top-level lanzaría un TypeError al
cargar. Cambios obligatorios en el harness (`beforeAll`):

- agregar `notifications: { onClicked: noopEvent, create: () => {}, clear: () => {} }`
  al mock de `chrome`;
- agregar `globalThis.HistorialFallos = {}` junto a los demás stubs de `importScripts`
  (`Utils`/`BunClient`/`Conexion`/`HlsEngine`, líneas 43-46), por consistencia defensiva.

No hace falta mockear `chrome.tabs`/`chrome.windows`: solo se usan **dentro** del
callback de `onClicked`, que los tests nunca invocan.

Más allá de eso, el harness solo captura `manejadoresIPC` (`chrome.runtime.onMessage`)
vía `invocar()` — `procesarSiguienteElementoDeLaCola` y `pausarColaPorErrorDeConexion`
no son alcanzables ahí. Igual que el resto del loop de descarga, `registrarFallo` y el
listener `onClicked` quedan **sin test automatizado por diseño** (excepción ya
documentada en `docs/testing.md`) — se verifican manualmente (ver Verificación).

## 3. `manifest.json`

Agregar `"notifications"` al array `permissions` (después de `"alarms"`, línea ~12). No
hace falta tocar `host_permissions` (ya cubre `plataforma.ramonnet.com.ar`). No hay
convención establecida de bump de `version` por feature (historia de un solo commit) —
se deja sin tocar salvo preferencia en contrario.

## 4. `popup/popup.html`

- Nuevo mount point en `.header-right` (líneas 23-34), junto a `#preact-status-dot`:
  `<span id="preact-campanita" style="display:contents"></span>`.
- Nuevo `<script src="../shared/historialFallos.js"></script>` junto a
  `<script src="../shared/conexion.js"></script>`.
- Nuevo `<script type="module" src="features/campanita.preact.js"></script>` al final
  del bloque de islas (después de `listaClases.preact.js`, línea ~141).

## 5. `popup/features/campanita.preact.js` (isla nueva)

Sigue el patrón de `bannerConexion.preact.js` (estado local propio: panel
abierto/cerrado) pero la *fuente de datos* es `shared/historialFallos.js` (storage
compartido con el SW), no una store ad-hoc.

- `useHistorialFallos()` — hook puente: `useState([])` para la lista + `useEffect` que
  llama `HistorialFallos.obtener().then(setLista)` al montar y cada vez que
  `HistorialFallos.suscribir(cb)` emite (patrón `useConexion()` pero con refetch async
  en vez de valor síncrono).
- `CampanitaBoton({ count, onClick })` — 🔔 + badge numérico si `count > 0`.
- `PanelFallos({ lista, onMarcarLeidos, onLimpiar })` — una fila por entrada (ya viene
  más-reciente-primero), estado vacío "Sin fallos". **`titulo`/`motivo` se interpolan
  como texto plano `${...}` dentro del template `html`** (nunca
  `dangerouslySetInnerHTML` — regla anti-XSS de `docs/security.md`, mismo patrón que
  `FilaClase`/`TarjetaEstado.titulo` en `listaClases.preact.js`), ya que son texto
  scrapeado/potencialmente hostil. Timestamp simple vía
  `new Date(fallo.ts).toLocaleTimeString()`. Botones "Marcar leídas"
  (→ `HistorialFallos.marcarTodosLeidos()`) y "Limpiar" (→ `HistorialFallos.limpiar()`)
  — acciones explícitas, sin auto-marcar al abrir (más predecible y testeable).
- `Campanita()` (exportado, es lo que se monta) — `useState(false)` para
  abierto/cerrado, compone botón + panel condicional. Conteo de no-leídos derivado
  inline de `lista` (sin round-trip async extra a `contarNoLeidos()`).
- Montaje: `montar(root)` guardado (`root && window.HistorialFallos`), auto-mount al
  final del archivo con guard `typeof document !== 'undefined'`, igual que las demás
  islas.

**CSS**: nuevo archivo `styles/components/campanita.css` (mismo patrón que
`header.css`/`help-button.css`; usa `styles/variables.css`), importado desde
`popup/globals.css` junto a `help-button.css`. Estilos para `.campanita-btn` (mismo
tratamiento que `.btn-help-icon`: `background:none`, `color: var(--text-muted)`, hover
→ `var(--accent-orange)`), `.campanita-badge` (círculo pequeño, `var(--accent-error)`,
posicionado absoluto sobre el ícono) y el panel desplegable (`position: absolute`,
fondo/borde acorde a `variables.css`).

## 6. Tests nuevos

**`shared/historialFallos.test.js`** (Vitest, sin jsdom — lógica de storage pura,
mockeando `chrome.storage.local`/`onChanged` al estilo `crearArea` de
`background.test.js`):

1. `registrar()` sobre storage vacío crea 1 entrada con la forma correcta.
2. Llamadas repetidas anteponen (orden más-reciente-primero).
3. Recorte acotado: 55 registros → longitud final exactamente 50, se conservan los 50
   más recientes.
4. `obtener()` sobre clave no seteada devuelve `[]`.
5. `marcarTodosLeidos()` pone `leido:true` en todas, en una sola escritura.
6. `limpiar()` vacía la lista.
7. `contarNoLeidos()` con mezcla leído/no-leído.
8. `suscribir(cb)` se dispara solo con `area==="local"` + cambio en `historialFallos`;
   no con otra clave o `area==="session"`.
9. La función de desuscripción corta los callbacks futuros.

**`popup/features/campanita.preact.test.js`** (`@vitest-environment jsdom`, plantilla
de `conexionHeader.preact.test.js`: fake `window.HistorialFallos` con
`obtener()`/`suscribir()`/`_emit()`/mutadores espía, `flush()` de 6×16ms):

1. Badge = cantidad de no-leídos; oculto si es 0.
2. Click en la campanita abre/cierra el panel.
3. El panel lista las entradas en el orden recibido.
4. `titulo`/`motivo` se renderizan como texto (`.textContent`), no como HTML — probar
   con un string tipo `<b>x</b>` y verificar que aparece literal, sin crear elementos
   hijos (mismo idioma de test que `listaClases.preact.test.js` usa para scraped
   titles — revisar ese archivo antes de escribir la aserción exacta).
5. "Marcar leídas" llama al mock y el badge baja a 0 tras `flush()`.
6. "Limpiar" llama al mock y el panel muestra el estado vacío tras `flush()`.
7. Re-render ante `_emit()` externo (fallo nuevo llegado con el popup abierto).

## 7. Docs a actualizar (mismo PR, por checklist de `contributing.md`)

- **`docs/data-model.md`**: fila nueva en la tabla de `chrome.storage.local` (después
  de `SW_ESTADOS_PROGRESO`, línea 19) + bloque de interfaz `HistorialFallo` (después
  de `EstadoClase`), notando el límite de 50 y la nota de concurrencia aceptada (§1).
- **`docs/security.md`** (fuente canónica de la tabla de permisos, líneas 15-26): fila
  nueva para `notifications`; extender la descripción de `tabs` con el uso nuevo
  (enfocar/abrir la pestaña al clickear la notificación); nota de que el título
  scrapeado viaja a la notificación como texto plano (la API no renderiza HTML —
  consistente con la regla anti-XSS, sin riesgo nuevo).
- **`docs/patterns.md`** §Circuit breaker (línea 72+): una línea agregando que ambos
  paths terminales ahora registran en `historialFallos` + disparan la notificación
  nativa vía `registrarFallo` (el choke point).
- **`docs/testing.md`**: sumar los 2 archivos de test nuevos; en §3 (`background.js` —
  parcial), anotar que `registrarFallo`/`onClicked` quedan bajo la misma excepción
  manual/e2e que el bucle de descarga, y que el harness ahora mockea
  `chrome.notifications`.
- **`docs/preact-migration.md`**: fila **#5 Campanita** en la tabla de islas (región
  `#preact-campanita` en el header) + párrafo en «Notas de secuencia»: primera isla
  cuyo store-puente es un **módulo compartido con el SW** (`shared/historialFallos.js`,
  respaldado en `chrome.storage.local` + `onChanged`) en vez de un `window.X` efímero
  como `BannerConexion` — porque el escritor principal es el SW con el popup cerrado.
- **`CLAUDE.md`**: (a) lista "Islands done" + `campanita (failure history bell)`;
  (b) conteos de tests («14 files, 155 tests» → 16 archivos, recontar); (c) una línea
  en la sección `shared/` describiendo `historialFallos.js`.
- **`README.md`** (guía de usuario final, no superseded por `docs/`): (a) bullet nuevo
  en «⚡ Características Principales» (línea ~7-11, junto a Auto-Heal): notificación
  nativa ante fallos + campanita con historial en el popup; (b) línea 61: sumar
  `notifications` a la lista de permisos que menciona para `manifest.json`;
  (c) línea 65: la descripción de `features/` menciona las islas Preact — sumar la
  campanita.
- **`docs/contributing.md`** y **`docs/architecture.md`**: sin cambios (no hay acción
  IPC nueva ni zona de ejecución nueva).
- **Auditados sin cambios necesarios**: `docs/ROADMAP.md` y `docs/TECHNICAL_DEBT.md`
  (esto es una feature nueva, no deuda ni parte de las fases del roadmap),
  `docs/deployment.md` (su nota de permisos aplica solo a una futura publicación en
  Web Store), `docs/tech-stack.md`, `docs/coding-standards.md` (la convención
  dual-export ya se sigue), y `docs/adr/*` (inmutables; no hay decisión arquitectónica
  nueva — la isla cae bajo ADR-0006 y el módulo compartido bajo los patrones
  existentes, no hace falta ADR).
- **Version headers**: bump + `CHANGELOG` en `background.js`, `background.test.js` y
  `eslint.config.js` (si lleva header); `shared/historialFallos.js` y
  `popup/features/campanita.preact.js` nacen en `V1.0.0` con su banner. `popup.js` no
  se toca (la campanita es aditiva, no engancha los handlers IPC existentes) — sin
  bump ahí. `popup.html` no lleva header de versión.

## Secuencia sugerida

1. `shared/historialFallos.js` + su test (lógica aislada, feedback rápido).
2. `manifest.json` (permiso `notifications`).
3. `background.js` (wrapper, 2 call sites, listener `onClicked`, `importScripts`)
   **+ en el mismo paso** el harness de `background.test.js` (mock de
   `chrome.notifications` + stub `HistorialFallos`) — si se difiere, `npm test` rompe.
4. `popup/popup.html` (mount point + 2 `<script>`).
5. `popup/features/campanita.preact.js` + test + `styles/components/campanita.css`
   (+ import en `globals.css`).
6. Docs (§7) + version headers.
7. `npm test` y `npm run lint` (el lint atrapa el global `HistorialFallos` si se
   olvida en `eslint.config.js`).

## Verificación

- `npm test` — todo el suite en verde, incluyendo los 2 archivos nuevos.
- `npm run lint` — 0 errores nuevos.
- Manual end-to-end (sin cobertura automatizada posible para el SW): cargar la
  extensión sin empaquetar, usar el hook temporal de bug400 en `shared/bunClient.js`
  (marcado `TEMP TEST bug400`, se revierte al cerrar la feature) o forzar una caída
  del backend/sesión, y verificar:
  1. Aparece la notificación nativa del SO con el título/mensaje correcto según tipo.
  2. Clickearla enfoca (o abre) la pestaña de Ramón Net.
  3. Con el popup cerrado durante el fallo y luego abierto: la campanita muestra el
     badge de no-leídos correcto y el panel lista la entrada.
  4. "Marcar leídas" y "Limpiar" funcionan y persisten (reabrir el popup confirma).
  5. Repetir para los 4 tipos (rechazo/sesión/servidor/internet) si es viable.
