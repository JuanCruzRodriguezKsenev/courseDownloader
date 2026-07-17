# Prototipo: `serverConnection` en Preact + htm (sin build)

Demo **aislado** (no toca la extensión) que reimplementa la feature de conexión del popup
—puntito de estado, banner offline y panel de descarga— con **Preact + htm cargados como
ES module local**, sin bundler ni transpilación. Sirve para ver, en código y en vivo, el
contraste con el enfoque vanilla actual y por qué el bug del banner no puede pasar acá.

## Cómo correrlo

Los ES modules no cargan por `file://` (CORS), así que servilo por HTTP:

```bash
# desde la raíz del repo, cualquiera de estas:
npx serve prototype/preact-serverConnection
# o
python -m http.server 8080 --directory prototype/preact-serverConnection
```

Abrí la URL que imprime (ej. http://localhost:3000 / :8080).

## Qué probar (reproduce el escenario del bug real)

1. **▶ Iniciar descarga** → aparece el panel de progreso.
2. **🔌 Cae servidor** → a los ~1.2s (simula el timeout del streaming del SW) salta el **banner**.
   Fijate que el **puntito se pone rojo al instante** (deriva de la conexión), y el banner
   aparece cuando se marca la falla.
3. **✅ Vuelve servidor** → el **banner desaparece solo** y la descarga se reanuda.

Ese paso 3 es exactamente lo que en la extensión vanilla fallaba ("el banner no se iba hasta
refrescar"). Acá es imposible: el banner es `s.fallaConexion ? <Banner/> : null`, y al poner
`fallaConexion = null` Preact lo saca del DOM por vos.

## El contraste, archivo por archivo

| Concepto | Vanilla (extensión real) | Este demo (Preact) |
|---|---|---|
| Header + barra de ruta | `<header class="header">` + `<section class="path-bar">` en `popup.html` (estáticos) | componentes `Header` / `PathBar` en `app.js` (la ruta y el estado offline se derivan del store) |
| Fuente de verdad | `AppState` + daemon `shared/conexion.js` | `store.js` (`estado` + `subscribe/set`) |
| "Componente" | `ServerConnectionFeature.crear(ctx)` en `popup/features/serverConnection.js` | funciones `StatusDot` / `ConnectionBanner` / `DownloadPanel` en `app.js` |
| Dependencias inyectadas | `ctx` (nodos + callbacks) | `props` + el hook `useStore()` |
| Pintar el puntito | `pintarStatusDot()` → `nodos.statusDot.className = …` (imperativo) | `return html\`<span class="dot ${ok?'online':'offline'}">\`` (declarativo) |
| Mostrar/ocultar banner | `activarEstadoOfflineUI()` arma `innerHTML` y `renderizarListadoInterfaz()` lo borra… si te acordás | `if (!s.fallaConexion) return null;` — automático |
| Limpiar banner al reconectar | había que restaurar panel + `renderizarListadoInterfaz()` a mano (era el bug, `popup.js` v5.5.6) | poner `fallaConexion=null` y listo |

## Lo que este prototipo NO resuelve (a propósito)

- **El service worker sigue siendo vanilla.** Preact es sólo para la UI del popup; el motor
  (`background.js` / `hlsEngine.js`) no tiene DOM y no gana nada. Acá el "SW" está *simulado*
  dentro de `store.js` (los `setTimeout` que imitan el timeout del streaming y el autoheal).
- **El puente con `chrome.storage` / IPC** está mockeado por el store. En la versión real,
  `useStore()` envolvería `Conexion.suscribir()` y `chrome.storage.onChanged`; el resto del
  código de componentes quedaría igual.

## Dependencia

`vendor/htm-preact-standalone.module.js` (~13KB) = Preact + hooks + htm en un solo archivo ESM
(build oficial `htm/preact/standalone`). Vendorizado local para cumplir el CSP de MV3
(nada de CDN en runtime). Cero build, cero bundler: se carga con `<script type="module">`.
