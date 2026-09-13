# Plan — Classroom corte 1: lista guardada del mismo curso, 🔄 visible y Explorar en Linux

Rama: `classroom-corte-1`. Sale de la verificación B (2026-09-13), con Física II G22 = 57 enlaces ✅.
Todo lo que sigue está **decidido por el dueño**; no hay opciones abiertas.

## 0. Lo medido que este plan da por hecho

- **El popup re-escanea siempre, en los tres portales.** Los disparadores automáticos llaman a
  `ejecutarPaso1EscaneoRamonAutomatico()`: al abrir (`popup.js:841`, en `conectarYArrancar`), al
  recargar o navegar la pestaña del portal (`popup.js:778`, `tabs.onUpdated`), al enfocarla
  (`popup.js:793`, `tabs.onActivated`) y al reconectar el servidor (`popup.js:676`,
  `onReescanearAula`, que dispara `popup/features/serverConnection.js:273`). En Anatomy son ~11 s y
  no molesta; en Classroom son minutos, con la pestaña al frente y yendo a Novedades.
- **La lista ya se guarda** (`listaPersistente`, `core/estado/appState.ts:357`) **pero no dice de
  qué curso salió**, así que hoy no hay forma de saber si sirve para la pestaña abierta.
- **"Re-escanear" no está a la vista con una lista en pantalla.** El botón del footer sólo ofrece
  `re-escanear` con un escaneo muerto (`popup.js:2296`); con lista, ofrece descargar/sincronizar.
  Si el popup deja de escanear al abrir, hace falta un control propio.
- **El escaneo por `batchexecute` no es viable (medición C3, HAR en
  `docs/muestras/google-classroom/c3/g22.har`, gitignorado).** El listado de "Trabajo en clase"
  viaja en `dpT4Vd` (`hrcw.qr`), un pedido por tema y de a 10 ítems: trae títulos, descripciones,
  ids y fechas, y **ningún id de Drive** (13 respuestas, ~48 KB, 3 menciones de `drive.google` y 6
  de `docs.google` contra 57 enlaces). `sLc6hf` (×49) son comentarios (`hrq.cmt`). El HTML inicial
  no trae el listado. El pedido lleva una máscara de campos enorme y `bl=boq_apps-edu-classroom-ui_20260907…`,
  que cambia con cada versión de la app. **Se sigue leyendo el DOM** (D8 del diseño); esto sólo se documenta.
- **Explorar llama a PowerShell** (`backend/handlers.js:325-327`): en Linux no puede andar.
  En la máquina del dueño (Hyprland, Wayland) **no hay zenity ni kdialog**, pero
  `xdg-desktop-portal` está activo con el backend `gtk` para `FileChooser`
  (`/usr/share/xdg-desktop-portal/hyprland-portals.conf`: `default=hyprland;gtk`), y `python3` con
  `gi` (PyGObject 3.56) está instalado. **Validado el 2026-09-13**: el script del Paso 6 abrió el
  diálogo nativo; el dueño lo cerró y el portal respondió `code 2`. El camino "eligió carpeta"
  (`code 0` + `uris`) se verifica en la B.
- **El registro devuelve los descriptores crudos** (`sitio/registro.ts:76`, `SITIOS.find(...)`), así
  que un miembro nuevo del puerto llega al popup sin tocar `plataforma/composicion.ts`.

## 1. Radio de impacto

| Qué cambia | Quién más lo construye o lo lee |
|---|---|
| `PuertoSitio` gana `claveDeListado?` (opcional) | Implementan el puerto: `sitio/ramonnet/config.ts`, `sitio/anatomy-by-chris/config.ts` (no la declaran: **no se tocan**), `sitio/google-classroom/config.ts` (la declara). Lo lee sólo `popup.js`. |
| `AppState` gana `origenListado` (clave de storage nueva) | `CLAVES_PERSISTIDAS` (`appState.ts:89`), `CLAVES_DE_SESION` (`:167`), `DatosPersistidos` (`:173`), la carga (`:246`), `respaldar` (`:355`), `limpiarSesionLocal` (`:450`). El test que enumera las claves de `respaldar` (`core/estado/appState.test.ts:180-200`) **falla si no se actualiza**. `docs/data-model.md` es su hogar. El SW escribe `listaPersistente` (`background.js:348`, `:385`, `:457`) pero **no** esta clave: no se toca. |
| 4 disparadores automáticos del escaneo pasan por una compuerta | `popup.js:676`, `:778`, `:793`, `:841`. **No cambian**: el botón del footer (`popup.js:1645`) y el fin de cola con limpieza (`popup.js:2213`, que antes llama a `limpiarSesionLocal` y deja la lista vacía). `serverConnection.test.js:108,245` mockea `onReescanearAula` y sigue valiendo. |
| Botón 🔄 en la toolbar | `entrypoints/popup/index.html:88-96` (markup), `nodos` (`popup.js`, `const nodos = {`), `bloquearToolbar` (`popup.js`, elementos de `Bloqueo.aplicar`), `desbanearFiltros` (`popup/features/filters.js`, que re-habilita la toolbar: **si no lo habilita ahí queda deshabilitado para siempre**), `conmutarPestañaA` (`popup.js`, visibilidad por pestaña). |
| `/api/seleccionar-carpeta` en Linux | Lo llama `core/backend/bunClient.ts:257` (timeout 3 min, `!res.ok` → throw) desde `lanzarSeleccionCarpetaFisica` (`popup.js:889`). Contrato en `docs/deployment.md:38`. El backend **no tiene tests** y `tsc` no lo cubre: sólo lint y el navegador. |

## 2. Paso a paso

### Paso 1 — Decisión pura: `core/estado/origenListado.ts` (nuevo) + test

Archivo nuevo, con banner de versión `V1.0.0` como el resto de `core/estado/`:

```ts
/** De qué listado salió la lista guardada: el portal y la clave que devolvió su descriptor. */
export interface OrigenListado {
  sitioId: string;
  clave: string;
}

export type DecisionAlAbrir = "usar-guardada" | "escanear";

/**
 * ¿Hace falta escanear, o la lista guardada ya es la de esta pestaña?
 * Sin clave (el portal no declara `claveDeListado`, o la URL no es de un listado) SIEMPRE se
 * escanea: es el comportamiento de antes y el de Ramón Net y Anatomy.
 */
export function decidirAlAbrir(p: {
  origen: OrigenListado | null;
  sitioId: string;
  clave: string | undefined;
  hayItemsDelPortal: boolean;
}): DecisionAlAbrir {
  if (!p.clave || !p.origen || !p.hayItemsDelPortal) return "escanear";
  return p.origen.sitioId === p.sitioId && p.origen.clave === p.clave ? "usar-guardada" : "escanear";
}

/** Valida lo leído de storage: cualquier otra forma se trata como "sin origen". */
export function esOrigenListado(v: unknown): v is OrigenListado {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.sitioId === "string" && o.sitioId !== "" && typeof o.clave === "string" && o.clave !== "";
}
```

`core/estado/origenListado.test.ts` (nuevo), **exactamente 7 tests**:

1. sin clave → `"escanear"` (aunque origen y portal coincidan).
2. sin origen → `"escanear"`.
3. misma clave pero otro `sitioId` → `"escanear"`.
4. mismo portal, clave distinta → `"escanear"`.
5. mismo portal y clave, **sin** ítems del portal → `"escanear"`.
6. mismo portal y clave, con ítems → `"usar-guardada"`.
7. `esOrigenListado`: rechaza `null`, `"x"`, `{ sitioId: 1, clave: "a" }`, `{ sitioId: "a" }`, `{ sitioId: "a", clave: "" }`; acepta `{ sitioId: "google-classroom", clave: "ODc0ODk1NDcwNTMw" }`.

### Paso 2 — El puerto y el descriptor de Classroom

`core/puertos/sitio.ts`: bump `V1.4.0` → `V1.5.0` con su CHANGELOG, y agregar **debajo de
`urlListado`**:

```ts
  /**
   * [CLASSROOM CORTE 1 — LISTA GUARDADA] Qué listado muestra esta URL, como una clave estable
   * (en Classroom, el id del curso). El popup la guarda al escanear y, al abrirse en una pestaña
   * con la MISMA clave, muestra la lista guardada en vez de escanear de nuevo.
   *
   * - Opcional: un portal que no la declara escanea siempre al abrir (Ramón Net y Anatomy,
   *   cuyos escaneos duran segundos).
   * - Corre en el POPUP, no en la pestaña: no va dentro de `escanearListado`.
   * - Devuelve `undefined` si la URL no es de un listado.
   */
  claveDeListado?(url: string | undefined): string | undefined;
```

`sitio/google-classroom/config.ts`: bump `V1.1.0` → `V1.2.0` con CHANGELOG, y agregar **debajo de
`esPaginaDelSitio`** (misma forma de URL que esa función y que el `idCursoMatch` del scraper,
`scraper.js:55`):

```ts
  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    const m = /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?(?:c|w)\/([^/?#]+)/.exec(url);
    return m ? m[1] : undefined;
  },
```

`sitio/registro.test.ts`: **+1 test** (`it`), "claveDeListado: Classroom devuelve el id del curso y
los otros portales no la declaran":

- `SitioGoogleClassroom.claveDeListado!("https://classroom.google.com/u/2/w/ODc0ODk1NDcwNTMw/t/all")` → `"ODc0ODk1NDcwNTMw"`
- `…("https://classroom.google.com/u/2/c/ODc0ODk1NDcwNTMw")` → `"ODc0ODk1NDcwNTMw"`
- `…("https://classroom.google.com/u/2/h")` → `undefined`; `…(undefined)` → `undefined`
- `SitioRamonNet.claveDeListado` y `SitioAnatomyByChris.claveDeListado` → `undefined`

### Paso 3 — `AppState.origenListado`

`core/estado/appState.ts` (bump de versión con CHANGELOG). Importar `OrigenListado` y
`esOrigenListado` desde `./origenListado` con la misma forma de import que ya usa el archivo.

1. `"origenListado"` en `CLAVES_PERSISTIDAS` (`:89`) **y** en `CLAVES_DE_SESION` (`:167`): la clave
   describe a `listaPersistente` y se borra con ella.
2. `DatosPersistidos`: `origenListado?: OrigenListado | null;`
3. En el objeto `app`, al lado de `listadoClasesGlobal`: `origenListado: null as OrigenListado | null,`
   con un comentario de una línea que diga de qué es.
4. En `inicializarSincronizacionStorage`, junto a la carga de `listaPersistente` (`:246`):
   `app.origenListado = esOrigenListado(data.origenListado) ? data.origenListado : null;`
5. En `respaldar` (`:355`): `origenListado: app.origenListado,` dentro de la **misma** llamada
   `guardarLocal` (regla de una sola escritura, `docs/data-model.md` §invariantes).
6. En `limpiarSesionLocal` (`:450`): `app.origenListado = null;`

`core/estado/appState.test.ts`:

- Agregar `"origenListado"` a la lista de claves esperadas de `respaldar` (`:185-200`).
- **+1 test**: con el almacenamiento falso del archivo, `origenListado = { sitioId: "google-classroom", clave: "X" }`
  → `respaldar()` lo escribe; un `AppState` nuevo sobre ese storage lo relee igual; con
  `origenListado: { sitioId: 5 }` en storage carga `null`; `limpiarSesionLocal()` lo deja en `null`
  y borra la clave. Usar los helpers que ya usa el archivo (`dejarCorrer`, `_volcar`).

### Paso 4 — La compuerta en `popup.js`

Bump del banner de `popup.js` con CHANGELOG.

**4a.** Import al tope, junto a los demás: `import { decidirAlAbrir } from './core/estado/origenListado.ts';`
(misma forma que `popup/features/queue.js:78`).

**4b.** Función nueva, **inmediatamente arriba** de `function ejecutarPaso1EscaneoRamonAutomatico()`:

```js
    // [CLASSROOM CORTE 1 — LISTA GUARDADA] Los disparadores AUTOMÁTICOS pasan por acá; los que
    // pidió el usuario (footer "Re-escanear", 🔄) llaman directo a ejecutarPaso1. Devuelve `true`
    // = el loader es mío, con el mismo contrato que ejecutarPaso1 (lo lee conectarYArrancar).
    function escanearOUsarGuardada() {
      if (escaneoEnCurso) return false;
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        // Otro disparador pudo arrancar un escaneo mientras esperábamos: ése es dueño del loader.
        if (escaneoEnCurso) return;
        const portal = !chrome.runtime.lastError && tab ? sitios.resolverPorUrl(tab.url) : undefined;
        const decision = portal
          ? decidirAlAbrir({
              origen: appState.origenListado,
              sitioId: portal.id,
              clave: portal.claveDeListado?.(tab.url),
              hayItemsDelPortal: appState.listadoClasesGlobal.some(c => c && c.sitioId === portal.id),
            })
          : 'escanear';
        if (decision === 'usar-guardada') {
          adoptarPortalDePestaña(tab.url);
          mostrarListaGuardada();
          return;
        }
        ejecutarPaso1EscaneoRamonAutomatico();
      });
      return true;
    }

    // Lo mismo que hace el final feliz del escaneo (la rama `else` que arma `nuevasClases`),
    // menos armar la lista: ya está en appState desde inicializarSincronizacionStorage.
    function mostrarListaGuardada() {
      escaneoMuerto = null;
      const hayModulos = appState.listadoClasesGlobal.some(c => c && c.sitioId === sitioActivo.id && c.modulo);
      nodos.folder.placeholder = hayModulos ? "cada clase va a su módulo" : "carpeta de destino";
      appState.sincronizacionDiscoCompletada = false;
      sincronizarBloqueosDeAlerta();
      actualizarBadgeFaceta();
      desbanearFiltros();
      nodos.masterCheck.checked = false;
      renderizarListadoInterfaz();
      verificarYMostrarAsistenteFaceta();
      ocultarLoader();
      ejecutarPaso2SincronizarDiscoVeloz();
    }
```

**4c.** Reemplazar la llamada en los **cuatro** disparadores automáticos, y en ningún otro lado:

| Línea (hoy) | Antes | Después |
|---|---|---|
| `popup.js:676` | `onReescanearAula: () => ejecutarPaso1EscaneoRamonAutomatico(),` | `onReescanearAula: () => escanearOUsarGuardada(),` |
| `popup.js:778` (`tabs.onUpdated`) | `ejecutarPaso1EscaneoRamonAutomatico();` | `escanearOUsarGuardada();` |
| `popup.js:793` (`tabs.onActivated`) | `ejecutarPaso1EscaneoRamonAutomatico();` | `escanearOUsarGuardada();` |
| `popup.js:841` (`conectarYArrancar`) | `elEscaneoTomoElLoader = ejecutarPaso1EscaneoRamonAutomatico();` | `elEscaneoTomoElLoader = escanearOUsarGuardada();` |

Actualizar los comentarios de esas líneas si nombran "re-escaneo" como algo incondicional.

**4d.** Guardar el origen al terminar bien. En la rama `else` del resultado (la que arma
`nuevasClases`), **entre** `appState.sincronizacionDiscoCompletada = false;` y
`appState.respaldar();` (hoy `popup.js:1448-1449`):

```js
              // [CLASSROOM CORTE 1 — LISTA GUARDADA] `tab` es la pestaña sobre la que se inyectó
              // (el callback de chrome.tabs.query de arriba). Sin clave, sin origen: ese portal
              // vuelve a escanear siempre.
              const claveOrigen = portal.claveDeListado?.(tab.url);
              appState.origenListado = claveOrigen ? { sitioId: portal.id, clave: claveOrigen } : null;
```

Las ramas de aviso, lista vacía, error de inyección y timeout **no** tocan `origenListado`.

### Paso 5 — El botón 🔄

1. `entrypoints/popup/index.html`: entre el `</div>` de `ui-sort-dropdown-container` y
   `ui-btn-toggle-select`:
   ```html
      <button id="ui-btn-rescan" class="btn-sort" title="Volver a escanear esta pestaña" aria-label="Volver a escanear esta pestaña" disabled>🔄</button>
   ```
   Sin CSS nuevo: reusa `.btn-sort` (`styles/components/filters.css:324`).
2. `popup.js`, `nodos`: `btnRescan: document.getElementById('ui-btn-rescan'),`
3. `popup.js`, al lado del listener de `nodos.btnAction`:
   `nodos.btnRescan?.addEventListener('click', () => ejecutarPaso1EscaneoRamonAutomatico());`
   (la guarda de reentrada de `ejecutarPaso1` ya ignora un click con escaneo en curso).
4. `popup.js`, `bloquearToolbar`: sumar `nodos.btnRescan` a `elementos`.
5. `popup/features/filters.js`, `desbanearFiltros`: junto a `nodos.search.disabled = false;`,
   `if (nodos.btnRescan) nodos.btnRescan.disabled = false;` — **sin condición**, como el buscador:
   re-escanear es una salida, no actúa sobre el resultado. Bump del banner de `filters.js`.
6. `popup.js`, `conmutarPestañaA`: en la rama `id === "disponibles"`,
   `if (nodos.btnRescan) nodos.btnRescan.style.display = '';` y en la otra `'none'`.

### Paso 6 — Explorar en Linux

**6a.** `backend/elegirCarpetaLinux.py` (nuevo). Es el script validado, con dos ajustes: cancelar o
cerrar sale con 1 y cualquier error con 3.

```python
"""Selector nativo de carpeta en Linux vía xdg-desktop-portal (FileChooser).

Lo lanza `handleSeleccionarCarpeta` (backend/handlers.js). Contrato de salida:
  0 → imprime la ruta elegida en stdout
  1 → el usuario canceló o cerró el diálogo
  3 → error (sin PyGObject, sin portal, D-Bus caído); el detalle va a stderr
"""
import os
import sys
from urllib.parse import unquote, urlparse

try:
    import gi

    gi.require_version("Gio", "2.0")
    from gi.repository import Gio, GLib

    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    remitente = bus.get_unique_name()[1:].replace(".", "_")
    token = "coursedownloader%d" % os.getpid()
    ruta_request = f"/org/freedesktop/portal/desktop/request/{remitente}/{token}"
    loop = GLib.MainLoop()
    resultado = {"code": 2, "uris": []}

    def al_responder(_conn, _snd, _obj, _iface, _sig, params, *_):
        code, resultados = params.unpack()
        resultado["code"] = code
        resultado["uris"] = resultados.get("uris", [])
        loop.quit()

    # Suscribirse ANTES de llamar: la respuesta puede llegar apenas vuelve OpenFile.
    bus.signal_subscribe(
        "org.freedesktop.portal.Desktop",
        "org.freedesktop.portal.Request",
        "Response",
        ruta_request,
        None,
        Gio.DBusSignalFlags.NONE,
        al_responder,
    )
    opciones = {
        "handle_token": GLib.Variant("s", token),
        "directory": GLib.Variant("b", True),
        "modal": GLib.Variant("b", True),
    }
    bus.call_sync(
        "org.freedesktop.portal.Desktop",
        "/org/freedesktop/portal/desktop",
        "org.freedesktop.portal.FileChooser",
        "OpenFile",
        GLib.Variant("(ssa{sv})", ("", "Elegí la carpeta raíz de descargas", opciones)),
        GLib.VariantType("(o)"),
        Gio.DBusCallFlags.NONE,
        -1,
        None,
    )
    loop.run()
except Exception as e:  # noqa: BLE001 — cualquier falla es "no hay selector"
    print(f"{type(e).__name__}: {e}", file=sys.stderr)
    sys.exit(3)

if resultado["code"] == 0 and resultado["uris"]:
    print(unquote(urlparse(resultado["uris"][0]).path))
    sys.exit(0)
sys.exit(1)
```

**6b.** `backend/handlers.js`, `handleSeleccionarCarpeta` (`:323`). El archivo **no** lleva banner
de versión (arranca con los imports): no se le agrega. Actualizar el docblock ("selector nativo: PowerShell en Windows,
xdg-desktop-portal en Linux"). Reemplazar las líneas que obtienen `rutaSeleccionada` (hoy `:325-329`)
por una rama por plataforma; **todo lo que sigue** (`if (rutaSeleccionada)`, `establecerRutaRaiz`,
escribir `CONFIG_USER_FILE`, las dos respuestas 200) **queda igual**:

```js
    let rutaSeleccionada = "";
    if (process.platform === "win32") {
      // (las dos líneas de hoy: comandoPowerShell + Bun.spawn(["powershell", ...]), sin cambios)
      rutaSeleccionada = output.trim();
    } else if (process.platform === "linux") {
      const proc = Bun.spawn(["python3", `${import.meta.dir}/elegirCarpetaLinux.py`], { stdout: "pipe", stderr: "pipe" });
      const [salida, errores, codigo] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      if (codigo === 0) rutaSeleccionada = salida.trim();
      else if (codigo !== 1) throw new Error(`El selector de carpetas de Linux falló (código ${codigo}): ${errores.trim()}`);
    } else {
      return new Response(JSON.stringify({ error: `Elegir carpeta no está soportado en ${process.platform}.` }), {
        status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
```

El `throw` cae en el `catch` existente (500 + `log("ERROR", "DISCO", …)`). Si `python3` no existe,
`Bun.spawn` tira y cae en el mismo `catch`.

### Paso 7 — Docs

1. `docs/data-model.md`, tabla de `chrome.storage.local`: fila nueva debajo de `faseDiscoOk`:
   `origenListado` | `{ sitioId: string, clave: string } \| null` | popup | De qué listado salió
   `listaPersistente` (en Classroom, el id del curso). Si coincide con la pestaña, el popup muestra
   la lista guardada en vez de escanear. Se borra con `listaPersistente` (`limpiarSesionLocal`). Sin migración: si falta, se escanea.
2. `docs/deployment.md:38`: la descripción de `GET /api/seleccionar-carpeta` agrega: Windows →
   PowerShell; Linux → `backend/elegirCarpetaLinux.py` (necesita `python3` + PyGObject y
   `xdg-desktop-portal` con un backend que implemente `FileChooser`); otro SO → 501.
3. `docs/architecture.md`, §Qué hace cada archivo: párrafo para `core/estado/origenListado.ts`
   al lado del de `credencialesPortal.ts` (`:309`). El backend no tiene detalle por archivo en ese
   doc (`grep -n "handlers.js" docs/architecture.md` no da nada): `elegirCarpetaLinux.py` se
   documenta sólo en `docs/deployment.md` (punto 2).
4. `docs/portal-google-classroom-diseno.md` §8, al final: `### C3 (2026-09-13) — batchexecute no
   trae los adjuntos`, con los datos del §0 de este plan (qué trae `dpT4Vd`, qué es `sLc6hf`, los
   conteos, el `bl` versionado y la conclusión: D8 sigue, sin reversión). Y
   `### Verificación B (2026-09-13) — re-escaneo al abrir y Explorar`, con los dos hallazgos y
   este plan como enlace.
5. `docs/TECHNICAL_DEBT.md`:
   - La entrada `### 🟠 /api/seleccionar-carpeta sólo funciona en Windows y cambia la raíz de todos
     los portales` pasa a `### 🟠 /api/seleccionar-carpeta cambia la raíz de todos los portales`:
     Linux resuelto (este plan), otro SO devuelve 501, y lo de la raíz global sigue para el corte 2.
   - Nueva `### ⚪ Cerrar el popup a mitad del escaneo descarta el resultado`: el callback de
     `chrome.scripting.executeScript` vive en el popup (`popup.js`, `func: portal.escanearListado`);
     si el popup se cierra, el escaneo sigue en la pestaña y nadie guarda lo que devuelve. Con
     Classroom (minutos) es fácil que pase. **No medido.** Estado ⚪ abierto (hallado el 2026-09-13).
6. `docs/testing.md` §Baseline: **43 archivos, 715 tests**, con el párrafo "De dónde sale el 715":
   706 + 7 (`core/estado/origenListado.test.ts`, archivo nuevo) + 1 (`appState.test.ts`) +
   1 (`sitio/registro.test.ts`).
7. `docs/ramas-en-revision.md`: en `classroom-corte-1`, un bullet **Hecho** con este plan y sus
   pasos, y sumar a la checklist de Verificación B los puntos 8 a 11 del §4.B de este plan.

## 3. Lo que no se toca

- `sitio/google-classroom/scraper.js`: el escaneo por DOM queda como está.
- `sitio/ramonnet/config.ts` y `sitio/anatomy-by-chris/config.ts`: no declaran `claveDeListado`.
- `ejecutarPaso1EscaneoRamonAutomatico` por dentro, salvo las líneas del 4d.
- `popup.js:1645` (footer "Re-escanear") y `popup.js:2213` (fin de cola): siguen llamando directo a `ejecutarPaso1`.
- `popup/features/serverConnection.js` y su test.
- `lanzarSeleccionCarpetaFisica` (`popup.js:889`) y `core/backend/bunClient.ts`.
- La rama de PowerShell de `handleSeleccionarCarpeta`, y el resto de `backend/`.
- `background.js`, `core/cola/`, `core/conexion/`, `plataforma/`.

## 4. Verificación

**A. Automática.** Pegar la salida, no describirla.

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm exec vitest run core/estado/origenListado.test.ts core/estado/appState.test.ts sitio/registro.test.ts popup/features/filters.test.js popup/features/serverConnection.test.js
python3 -m py_compile backend/elegirCarpetaLinux.py && echo py-ok
git grep -n 'escanearOUsarGuardada' -- popup.js
git grep -n 'ejecutarPaso1EscaneoRamonAutomatico()' -- popup.js
git grep -n 'claveDeListado' -- core sitio popup.js
grep -c 'ui-btn-rescan' .output/chrome-mv3/popup.html
```

Resultado esperado:

- `pnpm test`: **43 archivos, 715 tests**, todo en verde. lint 0/0, `tsc` sin salida, build compila.
- `py-ok`.
- `escanearOUsarGuardada`: la definición y **exactamente cuatro** llamadas (las del 4c).
- `ejecutarPaso1EscaneoRamonAutomatico()`: la definición, la llamada dentro de `escanearOUsarGuardada`,
  el footer (`modo === 're-escanear'`), el fin de cola (`restaurarPanelPorInterrupcion`) y el
  listener del 🔄. Ninguna otra.
- `claveDeListado`: el puerto, el descriptor de Classroom, su test, y los dos usos de `popup.js` (4b y 4d).
- `grep -c`: **1**.

**B. En el navegador (la corre el dueño).** Build nuevo, ↻ en la extensión, backend arriba
(`cd backend && bun run server.js`).

8. **Primera apertura en Física II G22**: escanea (todavía no hay origen guardado) y trae 57.
   Cerrar y reabrir el popup en la misma pestaña: la lista aparece **al instante**, sin
   "Escaneando la pestaña…", y la pestaña de Classroom **no se mueve** (no va a Novedades).
9. **Otro curso** (MC4 1S 2026): abrir el popup ahí escanea solo y trae 13. Volver a G22 y abrir:
   escanea de nuevo (se guarda una sola lista; es lo esperado).
10. **🔄**: visible en "Clases Disponibles" y oculto en "Fila de descarga"; en G22 con lista
    guardada fuerza el escaneo. Con el backend apagado (banner de conexión) queda deshabilitado.
    En Anatomy, abrir el popup **sigue escaneando** como antes.
11. **Explorar en Linux**: 📂 → aparece el diálogo nativo "Elegí la carpeta raíz de descargas".
    Cancelar → el popup vuelve a mostrar la ruta anterior. Elegir una carpeta → el popup la muestra
    y la consola del backend imprime `📂 [DISCO] Nueva carpeta raiz establecida`. **Ojo: cambia la
    raíz de los tres portales**; al terminar, volver a elegir la carpeta real.
12. Seguir la checklist de `docs/ramas-en-revision.md` desde su paso 2.

## 5. Qué tiene que traer el reporte

- La salida literal de la verificación A.
- Archivos tocados, por paso.
- **Hallazgos**: lo que viste y no hiciste porque este plan no lo nombraba.
