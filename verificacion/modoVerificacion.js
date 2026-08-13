/**
 * MODO VERIFICACIÓN — banco de pruebas de la UI (V3.1.0)
 * ==========================================================================
 * **Se activa con UNA línea**: `BANCO_DE_PRUEBAS = true` al final de
 * `entrypoints/popup/main.js`, y `pnpm run build`.
 *
 * **Apagado no cuesta nada, y está medido de nuevo en cada versión de este archivo** (si no, el
 * número envejece y el argumento deja de valer): la bandera es una `const` literal, así que el
 * `if` queda como código muerto y Vite se lleva este módulo entero. Última medición, del
 * 2026-08-13 sobre `main`, ya con la tanda del toolbar mergeada: con `false`, **231,33 kB** y
 * **cero** ocurrencias de `mv-panel` en el bundle; con `true`, **249,64 kB**.
 *
 * **Medí los dos seguidos, sobre el mismo commit.** La primera vez que se anotó este par salió
 * mal por no hacerlo: los dos números eran de builds separados por unos commits de docs, y el de
 * `false` quedó 0,14 kB corrido. Parece nada, pero el par existe para que se le pueda restar, y
 * dos mediciones de commits distintos no se restan. **El build no minifica**, así que hasta un
 * comentario que crece mueve el total — que es justamente lo que pasó ahí.
 *
 * **Y lo que hay que mirar de esos números no es el número, es la RESTA** — que es la lección de
 * esta última re-medición. Los dos subieron ~3,3 kB sin que el banco cambiara de versión: lo que
 * creció fue el popup (el piso visible y el filtro de materia), no esto. Leyendo sólo la columna
 * de `true` parecería que el banco engordó. La diferencia se quedó donde estaba: **18,31 kB**
 * ahora, 18,30 en la medición anterior (227,87 / 246,17, misma v3.1.0), 17,50 en v3.0.0
 * (225,71 / 243,21). Ese delta es el costo del banco, y es lo único que este párrafo afirma.
 *
 * ── LAS 12 TARJETAS QUE PUEDE MOSTRAR EL POPUP, Y CÓMO SE LLEGA A CADA UNA ────────────────
 *
 * El objetivo declarado del banco es forzar el 100%. Este es el estado, y se actualiza cuando
 * se agrega una tarjeta — una que no figure acá es una que nadie va a poder mirar.
 *
 *   ✅ Sin clases detectadas ......... "sin lista previa" + resultado `vacío`  ← v3.1.0
 *   ✅ No estás en un portal ......... pestaña forzada, una marcada `[—]`
 *   ✅ El escaneo tardó demasiado .... resultado `colgado`
 *   ✅ No pudimos leer la pestaña .... "error de inyección" + demora 0
 *   ✅ Servidor Desconectado ......... "servidor caído"
 *   ✅ Conexión a Internet Caída ..... "internet caído"
 *   ✅ Sesión no iniciada ............ cola pausada, tipo `sesion`
 *   ✅ El portal rechazó la descarga . cola pausada, tipo `rechazo`
 *   ✅ La descarga falló ............. cola pausada, tipo `desconocido`
 *   ➖ No hay clases (filtro) ........ a mano: buscar algo inexistente
 *   ➖ Ninguna coincide (fila) ....... a mano: filtrar la fila a cero
 *   ➖ Fila de descarga vacía ........ a mano: fila vacía + pestaña Fila
 *
 * (➖ = no necesita el banco, se alcanza con la UI en dos clics.)
 *
 * **Lo que sigue SIN poder forzarse, y es el próximo corte si se quiere el 100% de verdad**:
 * una descarga en curso — la barra de progreso, la telemetría, el frenado suave y la caja de
 * cancelar sólo aparecen con el service worker bajando de verdad, y el banco sólo envuelve
 * APIs del popup. Y el historial de fallos (la campanita) no se puede sembrar.
 *
 * CHANGELOG v3.1.0:
 * - [SIN LISTA PREVIA] Un switch que vacía `listadoClasesGlobal` justo antes de escanear. Era
 *   la única tarjeta a la que no se llegaba: con lista cargada, un escaneo vacío cae en la rama
 *   que la CONSERVA (y avisa por la línea de estado del footer, que está oculta), así que "Sin
 *   clases detectadas" no aparecía nunca. Vacía sólo en memoria y **no toca la cola**: la rama
 *   deriva su `itemsEnCola` de los `estado === 'process'` de esa misma lista.
 *
 * CHANGELOG v3.0.0 — deja de ser un andamio:
 * - **Ya no vive en una rama descartable.** Vivió en una (`copy-generico-verificacion`) y se
 *   perdió dos veces: primero quedó con un build viejo mientras `main` avanzaba —cargarla
 *   verificaba una versión anterior sin que nada avisara— y después hubo que rearmarla con
 *   siete cherry-picks. Una herramienta que hay que reconstruir cada vez que se usa es una
 *   herramienta que no se usa. Ahora se mantiene sola con el resto del código.
 * - Por qué el import es estático y no un `import()` dinámico —que sería el reflejo obvio para
 *   no cargarlo—: este módulo **envuelve `fetch`, `chrome.tabs.query` y
 *   `chrome.runtime.sendMessage`**, y tiene que hacerlo antes del init del popup. Un dinámico
 *   puede resolver después de `DOMContentLoaded` y dejar los envoltorios puestos tarde, con lo
 *   cual el banco mentiría en silencio. El estático da la misma eliminación en frío **y** la
 *   garantía de orden. Detalle en el bloque de `main.js`.
 * - [PANTALLA COMPLETA] Ocupa el cuerpo entero del popup menos la cabecera, que es donde vive
 *   su botón. Un solo scroll (el del panel, con la barra nativa como el resto del popup) y
 *   sin scroll horizontal.
 *
 * CHANGELOG v2.1.0 — dos bugs del propio banco:
 * - [EL GRANDE] Ocultaba la lista con `#ui-list.style.display = 'none'`, y **la isla Preact es
 *   dueña de ese atributo**: su `useEffect` reescribe `display` en cada cambio de host
 *   (`setAtenuada` durante una sincronización, `setOculta`, `setSelectionMode` al conmutar).
 *   O sea que la lista volvía a aparecer sola encima del panel apenas pasaba cualquier cosa.
 *   Es exactamente la trampa que `serverConnection.js` documenta desde la isla #4 —"NO un
 *   innerHTML='' + display:none externo que desincronizaría su vdom"— y que el banco repitió.
 *   Ahora usa el puente `ListaClases.setOculta()`, y **guarda y restaura el valor anterior**:
 *   con el banner de conexión puesto la lista YA estaba oculta, así que restaurar a `false`
 *   la habría destapado abajo del banner.
 * - `chrome.runtime.sendMessage(msg, undefined)` no es lo mismo que `sendMessage(msg)`: pasar
 *   el callback explícitamente en `undefined` puede no matchear ninguna firma del binding y
 *   romper el IPC. Ahora se reenvía con la aridad que vino.
 *
 * CHANGELOG v2.0.0:
 * - [BANNERS] Sección nueva, y es la que justifica esta versión: se pueden forzar los tres
 *   estados de banner sin romper nada de verdad —sin apagar el Bun ni desenchufar el wifi—.
 *   Dos mecanismos, los dos sobre el camino real:
 *     · CAÍDAS: se envuelve `fetch` y se rechaza el origen elegido (localhost:3001 = servidor,
 *       el resto = internet). El daemon Conexion lo detecta solo en su próximo sondeo y el
 *       banner aparece por donde aparece siempre. Destildar reproduce la RECONEXIÓN completa.
 *     · COLA PAUSADA: se envuelve `chrome.runtime.sendMessage` y se le contesta al
 *       `obtener_estados_en_progreso` del arranque con `colaPausadaPorError`, que es
 *       exactamente lo que manda el SW cuando pausa. Dispara `mostrarAlertDeConexionCaida`
 *       de verdad, con su tipo. Necesita recargar (el sync corre una sola vez, al iniciar).
 * - [ESTILO] El panel usa los tokens del popup (`styles/variables.css`) en vez de un tema
 *   oscuro propio: el popup es claro y el banco parecía de otra aplicación.
 *
 * CHANGELOG v1.1.0:
 * - El panel dejó de ser una barra fija encima del popup: ahora es una TERCERA PESTAÑA del
 *   tablist (🧪) y ocupa el lugar de la lista. La conmutación vive entera acá; el
 *   `conmutarPestañaA` de popup.js no se toca, que es justamente uno de los archivos que se
 *   está verificando.
 * ==========================================================================
 * PARA QUÉ EXISTE
 * Los estados de esta UI o duran milisegundos o exigen romper algo real. El banco hace cuatro
 * cosas, ninguna de las cuales toca el código que se verifica:
 *
 *   1. GRABA todo texto que pasa por el loader, el estado y el botón principal, con hora.
 *   2. DEMORA el escaneo (0/1/3/6 s) para que los carteles intermedios se lean.
 *   3. FUERZA lo que a mano no se alcanza: escaneo vacío, escaneo colgado, pestaña objetivo,
 *      caída de servidor/internet y cola pausada por cada uno de sus cinco tipos.
 *   4. RE-MONTA el onboarding con el descriptor de cada portal.
 *
 * LO QUE NO PUEDE HACER, Y HAY QUE SABERLO ANTES DE CONFIAR EN ÉL
 *   - Con demora > 0, `chrome.runtime.lastError` ya no es legible cuando corre el callback
 *     (sólo vale durante su turno sincrónico). Para la rama de "error de inyección": demora 0.
 *   - El cartel al CAMBIAR de portal mide temporización real; forzar la pestaña objetivo la
 *     altera. Ese punto se mira sin el panel, y por eso arranca en "la pestaña activa".
 *   - Las caídas simuladas sólo afectan al POPUP. El service worker tiene su propio contexto
 *     y su propio `fetch`: una descarga en curso sigue bajando aunque el banco diga "caído".
 * ==========================================================================
 */

// La isla #4 es DUEÑA de #ui-list (hijos y atributos del host). Se la importa para hablarle por
// su puente en vez de tocarle el DOM: el bundler resuelve el mismo módulo que consume popup.js,
// así que es el mismo store, no otra instancia.
import ListaClases from "../popup/features/listaClases.preact.js";
// El banner de conexión monta en su propio root (#preact-banner) y lo enciende
// `activarEstadoOfflineUI`, que además esconde la barra de pestañas entera. Los dos efectos le
// sacan la pantalla al banco justo cuando se lo está usando para provocar esas caídas, así que
// hay que saber cuándo cambia: el store se importa para SUSCRIBIRSE, no para pintarlo.
import BannerConexion from "../popup/features/bannerConexion.preact.js";

const CLAVE_PAUSA = "mv-pausa-forzada";

const CSS_PANEL = `
  /* [UN SOLO SCROLL] El panel es el ÚNICO que scrollea, y en un solo eje.
     Antes había dos barras gordas: una del panel y otra del <pre> del registro, que tenía su
     propio max-height. Dos scrollbars anidadas en un popup de 390px de ancho es una de más y
     ninguna de las dos con el estilo del proyecto.
     Ahora: el registro NO scrollea (crece), y lo que scrollea es el panel, con la barra
     NATIVA de Chrome — la misma que el listado de clases, porque ninguno de los dos la estila.
     overflow-x: hidden + el min-width: 0 de las secciones matan el scroll horizontal: sin
     eso, un ítem de flex/grid no baja del ancho de su contenido y un token largo del registro
     ensancha el panel entero.
     (Ojo: este bloque vive dentro de un template literal de JS, así que los comentarios NO
     pueden llevar backticks — terminan la cadena y el error sale como un parse error de CSS.) */
  #mv-panel {
    display: none; flex: 1; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    /* Mismo motivo que en .list-wrapper: el registro crece renglon a renglon mientras se usa
       el banco, y sin el canal reservado el panel se ensancha y se angosta 6px en el momento
       exacto en que el contenido pasa a necesitar barra. Grabando carteles que duran
       milisegundos, ese salto es ruido justo donde se esta mirando. */
    scrollbar-gutter: stable;
    flex-direction: column;
    padding: var(--space-sm); gap: var(--space-sm);
    background: var(--bg-main); color: var(--text-main);
    font-size: var(--text-base);
  }
  /* La última sección (la grabadora) se come el sobrante cuando el contenido no llena el
     panel, para que no quede un hueco muerto abajo. Cuando SÍ lo llena toma su alto natural y
     scrollea el panel. Acá vivía un grid-row: -2 / -1 que además de no hacer falta reordenó
     las secciones y mandó el registro arriba de todo. */
  #mv-panel .mv-seccion:last-child {
    flex: 1 1 auto;
    /* Sus dos hijos son el título y el <pre>: el título toma lo suyo y el registro se lleva el
       resto del alto que la sección ganó. */
    grid-template-rows: auto 1fr;
    min-height: 0;
  }
  #mv-panel .mv-seccion {
    min-width: 0;
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--space-sm);
    display: grid; gap: var(--space-sm);
  }
  #mv-panel .mv-titulo {
    font-size: var(--text-sm); font-weight: var(--font-bold);
    text-transform: uppercase; letter-spacing: .04em;
    color: var(--text-muted);
    display: flex; align-items: center; gap: var(--space-xs);
  }
  /* min-width: 0 en la fila y en el select: el popup mide 390px y un <select> con una opción
     larga no baja del ancho de esa opción, así que empujaba el ancho del panel. Con esto el
     texto se recorta con puntos suspensivos en vez de traer scroll horizontal. */
  #mv-panel .mv-fila {
    display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;
    min-width: 0; max-width: 100%;
  }
  #mv-panel .mv-fila > label:first-child { color: var(--text-muted); min-width: 74px; }
  #mv-panel select {
    flex: 1 1 120px; min-width: 0; max-width: 100%; text-overflow: ellipsis;
    padding: var(--space-xs) var(--space-sm);
    border: 1.5px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-surface); color: var(--text-main);
    font-size: var(--text-base); font-family: inherit;
  }
  #mv-panel button {
    padding: var(--space-xs) var(--space-sm);
    border: 1.5px solid var(--border-color); border-radius: var(--radius-sm);
    background: var(--bg-surface); color: var(--text-main);
    font-size: var(--text-base); font-weight: var(--font-semibold);
    font-family: inherit; cursor: pointer;
  }
  #mv-panel button:hover { border-color: var(--accent-orange); color: var(--accent-orange); }
  #mv-panel button.mv-primario {
    background: var(--accent-orange); border-color: var(--accent-orange); color: #fff;
  }
  #mv-panel button.mv-primario:hover { background: var(--accent-orange-hover); color: #fff; }
  #mv-panel .mv-switch {
    display: flex; align-items: center; gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    border: 1.5px solid var(--border-color); border-radius: var(--radius-full);
    cursor: pointer; user-select: none;
  }
  #mv-panel .mv-switch:has(input:checked) {
    border-color: var(--accent-error);
    background: rgba(var(--accent-error-rgb), 0.08);
    color: var(--accent-error-visible);
    font-weight: var(--font-semibold);
  }
  #mv-panel .mv-nota { color: var(--text-muted); font-size: var(--text-xs); line-height: 1.4; }
  #mv-panel .mv-alerta { color: var(--accent-error-visible); font-weight: var(--font-semibold); }
  #mv-panel #mv-registro {
    /* NO scrollea: crece, y scrollea el panel. Tenía max-height: 30vh + overflow: auto
       propios, y ésa era la segunda barra. Tampoco lleva alto fijo — lo estira la sección.
       overflow-wrap: anywhere además de word-break porque un id o una URL sin espacios
       (lo típico en un registro) no rompe con word-break: break-word solo, y ése es el
       token que empujaba el ancho y traía el scroll horizontal. */
    margin: 0; min-height: 6rem; overflow: visible;
    min-width: 0;
    background: var(--bg-main);
    border: 1px solid var(--border-color); border-radius: var(--radius-sm);
    padding: var(--space-sm);
    font-family: ui-monospace, Consolas, monospace;
    font-size: var(--text-xs); line-height: 1.6;
    white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
  }
  #btn-verificacion.mv-encendido { color: var(--accent-orange); transform: scale(1.15); }
`;

/**
 * @param {object} deps
 * @param {{obtener: Function, resolverPorUrl: Function}} deps.sitios  Registro de portales.
 * @param {Function} deps.montarOnboarding  `montar` de la isla del onboarding.
 * @param {object} deps.conexion  Daemon, para re-montar la isla con sus dependencias reales.
 * @param {object} deps.appState
 */
export function activarModoVerificacion({ sitios, montarOnboarding, conexion, appState }) {
  // --- Estado del banco ---------------------------------------------------------------
  const cfg = {
    demoraMs: 3000,
    resultado: "real",          // "real" | "vacio" | "colgado"
    vaciarListaPrevia: false,   // vacía listadoClasesGlobal justo antes de escanear
    tabForzada: null,           // null = la pestaña activa de verdad
    caidas: { servidor: false, internet: false },
    // Se lee de localStorage porque hay que APLICARLO AL ARRANCAR: el popup consulta al SW
    // una sola vez, en el init, así que forzar la pausa exige sobrevivir a un reload.
    pausaForzada: (typeof localStorage !== "undefined" && localStorage.getItem(CLAVE_PAUSA)) || "",
  };

  const registro = [];
  let puedeFingirLastError = false;
  let fingirLastError = false;

  // --- La grabadora -------------------------------------------------------------------
  function anotar(fuente, texto) {
    const limpio = (texto || "").trim();
    if (!limpio) return;
    const previo = [...registro].reverse().find((r) => r.fuente === fuente);
    if (previo && previo.texto === limpio) return;
    const t = new Date();
    const dosDig = (n) => String(n).padStart(2, "0");
    const hora = `${dosDig(t.getHours())}:${dosDig(t.getMinutes())}:${dosDig(t.getSeconds())}.${String(t.getMilliseconds()).padStart(3, "0")}`;
    registro.push({ hora, fuente, texto: limpio });
    pintarRegistro();
  }

  function observar(id, fuente) {
    const nodo = document.getElementById(id);
    if (!nodo) return;
    anotar(fuente, nodo.textContent);
    new MutationObserver(() => anotar(fuente, nodo.textContent)).observe(nodo, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }

  // --- Los stubs ----------------------------------------------------------------------
  // Se envuelven, no se reemplazan: sin nada tildado, el comportamiento es el de producción.
  const queryReal = chrome.tabs.query.bind(chrome.tabs);
  const execReal = chrome.scripting.executeScript.bind(chrome.scripting);
  const sendReal = chrome.runtime.sendMessage.bind(chrome.runtime);
  const fetchReal = window.fetch.bind(window);

  chrome.tabs.query = function (consulta, cb) {
    const esLaActiva = consulta && consulta.active && consulta.currentWindow;
    if (cfg.tabForzada && esLaActiva) {
      anotar("banco", `pestaña forzada → ${cfg.tabForzada.url || "(sin url)"}`);
      if (cb) return cb([cfg.tabForzada]);
      return Promise.resolve([cfg.tabForzada]);
    }
    return cb ? queryReal(consulta, cb) : queryReal(consulta);
  };

  chrome.scripting.executeScript = function (inyeccion, cb) {
    if (cfg.resultado === "colgado") {
      anotar("banco", "escaneo COLGADO a propósito → debería saltar el timeout de 6 s");
      return;
    }
    if (cfg.resultado === "vacio") {
      anotar("banco", `escaneo forzado VACÍO (demora ${cfg.demoraMs} ms)`);
      setTimeout(() => cb([{ result: { materia: "", enlaces: [] } }]), cfg.demoraMs);
      return;
    }
    return execReal(inyeccion, (resultados) => {
      // lastError SÓLO es legible en este turno. Se lee ya, aunque el callback se demore.
      const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
      if (err && cfg.demoraMs > 0) {
        anotar("banco", `⚠️ lastError "${err}" se pierde con demora > 0 — repetí con demora 0`);
      }
      if (cfg.demoraMs > 0) setTimeout(() => cb(resultados), cfg.demoraMs);
      else cb(resultados);
    });
  };

  // Caídas simuladas: se corta por ORIGEN, que es como caen de verdad. El daemon Conexion
  // sondea con `fetch` y su próximo intento falla igual que si el proceso no estuviera.
  const esDelBackend = (url) => String(url).includes("localhost:3001") || String(url).includes("127.0.0.1:3001");
  window.fetch = function (recurso, opciones) {
    const url = typeof recurso === "string" ? recurso : (recurso && recurso.url) || "";
    if (cfg.caidas.servidor && esDelBackend(url)) {
      return Promise.reject(new TypeError("Failed to fetch — servidor caído (banco de pruebas)"));
    }
    if (cfg.caidas.internet && url && !esDelBackend(url)) {
      return Promise.reject(new TypeError("Failed to fetch — internet caído (banco de pruebas)"));
    }
    return fetchReal(recurso, opciones);
  };

  // Cola pausada: se le contesta al sync del arranque lo que contestaría el SW con la cola
  // pausada. Es el camino real de `mostrarAlertDeConexionCaida` (popup.js), con su tipo.
  chrome.runtime.sendMessage = function (mensaje, cb) {
    if (cfg.pausaForzada && mensaje && mensaje.action === "obtener_estados_en_progreso" && cb) {
      anotar("banco", `cola pausada FORZADA (${cfg.pausaForzada}) en la respuesta del SW`);
      setTimeout(() => cb({
        estados: {},
        porcentaje: 0,
        telemetry: null,
        colaPausadaPorError: true,
        tipoDeErrorConexion: cfg.pausaForzada,
        videoActual: "Clase de prueba — banco",
      }), 0);
      return;
    }
    // Con la aridad que vino: `sendMessage(msg, undefined)` puede no matchear ninguna firma
    // del binding y romper el IPC entero.
    return cb ? sendReal(mensaje, cb) : sendReal(mensaje);
  };

  // La rama de "error de inyección" depende de leer lastError. Se intenta hacerlo fingible;
  // si el binding no lo permite, se dice, en vez de simularlo por afuera.
  try {
    const propio = Object.getOwnPropertyDescriptor(chrome.runtime, "lastError");
    Object.defineProperty(chrome.runtime, "lastError", {
      configurable: true,
      get() {
        if (fingirLastError) return { message: "Cannot access contents of the page (forzado)" };
        return propio && propio.get ? propio.get.call(chrome.runtime) : propio && propio.value;
      },
    });
    puedeFingirLastError = true;
  } catch {
    puedeFingirLastError = false;
  }

  // --- El panel, como tercera pestaña -------------------------------------------------
  const hoja = document.createElement("style");
  hoja.textContent = CSS_PANEL;
  document.head.appendChild(hoja);

  const panel = document.createElement("section");
  panel.id = "mv-panel";
  panel.innerHTML = `
    <div class="mv-seccion">
      <div class="mv-titulo">🔎 Escaneo</div>
      <div class="mv-fila">
        <label for="mv-tab">Pestaña</label>
        <select id="mv-tab"><option value="">(la activa de verdad)</option></select>
        <button id="mv-recargar-tabs" title="Releer las pestañas abiertas">↻</button>
      </div>
      <div class="mv-fila">
        <label for="mv-demora">Demora</label>
        <select id="mv-demora">
          <option value="0">0 — necesaria para la rama de error de inyección</option>
          <option value="1000">1 s</option>
          <option value="3000" selected>3 s</option>
          <option value="6000">6 s — dispara también el timeout</option>
        </select>
      </div>
      <div class="mv-fila">
        <label for="mv-resultado">Resultado</label>
        <select id="mv-resultado">
          <option value="real">real</option>
          <option value="vacio">vacío → "no devolvió clases"</option>
          <option value="colgado">colgado → timeout de DOM</option>
        </select>
      </div>
      <div class="mv-fila">
        <label class="mv-switch"><input type="checkbox" id="mv-sin-lista"> sin lista previa</label>
      </div>
      <div class="mv-nota">
        Vacía <code>listadoClasesGlobal</code> justo antes de escanear. Es la única forma de
        llegar a <b>"Sin clases detectadas"</b>: con lista cargada, un escaneo vacío cae en la
        rama que la conserva. <b>No toca la cola</b>. Si el escaneo termina, el vacío se
        persiste — se recupera con un Re-escanear.
      </div>
      <div class="mv-fila">
        <label class="mv-switch"><input type="checkbox" id="mv-lasterror"> error de inyección</label>
        <button id="mv-escanear" class="mv-primario">▶ Escanear</button>
      </div>
      <div class="mv-nota" id="mv-nota-lasterror"></div>
    </div>

    <div class="mv-seccion">
      <div class="mv-titulo">🚨 Banners</div>
      <div class="mv-fila">
        <label class="mv-switch"><input type="checkbox" id="mv-caida-servidor"> servidor caído</label>
        <label class="mv-switch"><input type="checkbox" id="mv-caida-internet"> internet caído</label>
      </div>
      <div class="mv-nota">
        Corta el <code>fetch</code> por origen. El banner aparece en el próximo sondeo del daemon
        (unos segundos); destildar reproduce la reconexión entera, con re-escaneo incluido.
        <strong>Sólo afecta al popup</strong>: el service worker tiene su propio contexto.
        El banner no se pinta acá —se ve en Clases y en Fila, que es donde va—, y como con el
        banner puesto el popup esconde la barra de pestañas, se entra y sale del banco con
        <strong>F9</strong>.
      </div>
      <div class="mv-fila">
        <label for="mv-pausa">Cola pausada</label>
        <select id="mv-pausa">
          <option value="">(no forzar)</option>
          <option value="servidor">servidor — "Servidor Desconectado"</option>
          <option value="internet">internet — "Conexión a Internet Caída"</option>
          <option value="sesion">sesion — "Sesión no iniciada"</option>
          <option value="bloqueo">bloqueo — "El portal rechazó la descarga"</option>
          <option value="desconocido">desconocido — "La descarga falló"</option>
        </select>
        <button id="mv-recargar">🔄 Aplicar</button>
      </div>
      <div class="mv-nota">
        Se contesta el sync del arranque con <code>colaPausadaPorError</code>, así que
        <strong>hay que recargar</strong> para verlo (el sync corre una vez). Queda guardado hasta
        que lo pongas en "(no forzar)" y recargues de nuevo. Mirá que la <strong>toolbar
        desaparezca</strong> y que el botón diga sólo <strong>Reintentar 🔄</strong>.
      </div>
    </div>

    <div class="mv-seccion">
      <div class="mv-titulo">👋 Onboarding</div>
      <div class="mv-fila">
        <button id="mv-onb-legado">Portal legado</button>
        <button id="mv-onb-otro">El otro portal</button>
      </div>
      <div class="mv-nota">
        En el popup real la isla recibe SIEMPRE el portal legado
        (<code>entrypoints/popup/main.js</code>), así que hoy ésta es la única forma de leer la
        instrucción de escaneo del segundo.
      </div>
    </div>

    <div class="mv-seccion">
      <div class="mv-titulo">
        📝 Grabadora
        <button id="mv-copiar" style="margin-left:auto">📋</button>
        <button id="mv-limpiar">🗑</button>
      </div>
      <pre id="mv-registro"></pre>
    </div>
  `;

  const lista = document.getElementById("ui-list");
  const barraFiltros = document.getElementById("ui-filter-bar");
  const tablist = document.querySelector(".tabs-bar");
  if (lista && lista.parentNode) lista.parentNode.insertBefore(panel, lista.nextSibling);
  else document.body.appendChild(panel);

  // El acceso al banco vive en la CABECERA, al lado del ❓, y no en el tablist. Dos motivos, y
  // el segundo es el que manda: como pestaña le robaba ancho a las dos reales —cambiando la UI
  // que se está verificando— y, sobre todo, `activarEstadoOfflineUI` esconde `.tabs-bar` entera,
  // así que en el estado más interesante para probar (servidor caído) el acceso desaparecía.
  // La cabecera no se oculta nunca.
  const tab = document.createElement("button");
  tab.id = "btn-verificacion";
  tab.className = "btn-help-icon";
  tab.setAttribute("aria-controls", "mv-panel");
  tab.setAttribute("aria-pressed", "false");
  tab.textContent = "🧪";
  tab.title = "Banco de pruebas (andamio) — F9";
  const ayudaHeader = document.getElementById("ui-btn-help");
  if (ayudaHeader && ayudaHeader.parentNode) ayudaHeader.parentNode.insertBefore(tab, ayudaHeader);
  else if (tablist) tablist.appendChild(tab);

  // Lo que hay que devolver al salir. La LISTA no se toca por DOM: se le pide a su isla, que
  // es la dueña del host (`setOculta`). Y se guarda el valor PREVIO porque con el banner de
  // conexión puesto ya estaba oculta — restaurar a `false` la destaparía abajo del banner.
  // La toolbar sí es vanilla, pero su display lo escriben `conmutarPestañaA` y el banner, así
  // que también va guardado en vez de reseteado a "".
  let displayPrevio = null;
  let bancoActivo = false;

  const raizBanner = document.getElementById("preact-banner");

  // El banco es DUEÑO de la pantalla mientras está abierto, y hay que re-afirmarlo: mientras se
  // lo usa para provocar caídas, `activarEstadoOfflineUI` corre de verdad y hace tres cosas que
  // se lo comen — enciende el banner en #preact-banner (hermano del panel, así que se pinta al
  // lado), oculta `.tabs-bar` ENTERA (con eso desaparece la pestaña 🧪 y no hay cómo volver) y
  // re-muestra la lista al reconectar. Por eso esto se llama también desde las suscripciones a
  // los dos stores, y no una sola vez al entrar.
  //
  // El banner NO se cancela: sigue mostrándose en Clases Disponibles y en Fila de Descarga,
  // que es donde el usuario tiene que verlo. Acá sólo se lo esconde de la pestaña del banco.
  function afirmarLayoutDelBanco() {
    if (!bancoActivo) return;
    ListaClases.setOculta(true);
    if (barraFiltros) barraFiltros.style.display = "none";
    if (raizBanner) raizBanner.style.display = "none";
    // [PANTALLA COMPLETA] El banco ocupa TODO el cuerpo del popup menos la cabecera, que es
    // donde vive su propio botón (🧪) y el del tutorial: sin cabecera no habría cómo salir.
    //
    // Antes sólo escondía la lista, los filtros y el banner, así que el panel convivía con la
    // path-bar, las pestañas y el footer — tres regiones de una UI que en ese momento no se
    // está usando, comiéndose el alto de un popup de 600px fijos y dejando el registro del
    // banco en una franja. Como `.container` es flex column, alcanza con sacarlas del flujo
    // para que el `flex: 1` del panel se quede con todo.
    //
    // **Esconder `.tabs-bar` acá es seguro desde que el acceso salió del tablist**: mientras el
    // banco era una pestaña, ocultarla se llevaba puesto el 🧪 y no había cómo volver — el
    // defecto que documenta la cabecera de este archivo. Ahora el botón está en la cabecera,
    // que es justamente la región que no se toca.
    regionesQueElBancoTapa().forEach((n) => { if (n) n.style.display = "none"; });
    // `flex`, no `grid`: el panel es una columna de secciones donde la última se estira. Con
    // grid había que reordenar filas a mano y ahí se me fue el registro arriba de todo.
    panel.style.display = "flex";
  }

  /** Todo el cuerpo del popup salvo la cabecera. Ver `afirmarLayoutDelBanco`. */
  function regionesQueElBancoTapa() {
    return [
      document.querySelector(".path-bar"),
      document.querySelector(".tabs-bar"),
      document.querySelector(".footer-panel"),
    ];
  }

  function entrarAlBanco() {
    if (displayPrevio === null) {
      displayPrevio = {
        listaOculta: !!(ListaClases.get && ListaClases.get().host.oculta),
        filtros: barraFiltros ? barraFiltros.style.display : "",
        banner: raizBanner ? raizBanner.style.display : "",
        // Se guarda el display INLINE previo de cada una, no un valor fijo: la path-bar y las
        // pestañas las esconde y las muestra el popup por su cuenta según el estado (caída del
        // servidor, ráfaga en curso), y restaurar un "flex" a ciegas resucitaría una región que
        // el popup tenía escondida a propósito.
        cuerpo: regionesQueElBancoTapa().map((n) => (n ? n.style.display : "")),
      };
    }
    bancoActivo = true;
    afirmarLayoutDelBanco();
    tab.classList.add("mv-encendido");
    tab.setAttribute("aria-pressed", "true");
    // Las pestañas reales NO se tocan: el banco ya no es una de ellas, así que la que el popup
    // cree activa sigue marcada y al volver no hay que reconstruir nada.
  }

  function salirDelBanco() {
    bancoActivo = false;
    if (displayPrevio) {
      ListaClases.setOculta(displayPrevio.listaOculta);
      if (barraFiltros) barraFiltros.style.display = displayPrevio.filtros;
      // El banner y las pestañas vuelven al display que tenían: si mientras estabas en el banco
      // se cayó el servidor, lo que corresponde al salir es la pantalla de caída completa
      // (banner visible, pestañas ocultas), no la de antes de la caída.
      if (raizBanner) raizBanner.style.display = BannerConexion.get().visible ? "contents" : displayPrevio.banner;
      // [PANTALLA COMPLETA] Devolver cada región al display inline que tenía. Por el mismo
      // motivo que el banner de arriba: si mientras estabas adentro se cayó el servidor, lo que
      // corresponde al salir es la pantalla de caída, no la de antes de entrar. Como se guardó
      // el valor previo y no uno fijo, eso sale gratis — salvo por las pestañas, que las apaga
      // `activarEstadoOfflineUI` DESPUÉS de que guardamos: por eso el re-afirmado corre desde
      // las suscripciones y no una sola vez.
      regionesQueElBancoTapa().forEach((n, i) => {
        if (n) n.style.display = displayPrevio.cuerpo[i] ?? "";
      });
      displayPrevio = null;
    }
    panel.style.display = "none";
    tab.classList.remove("mv-encendido");
    tab.setAttribute("aria-pressed", "false");
  }

  // Es un botón de cabecera, no una pestaña: alterna.
  tab.addEventListener("click", () => (bancoActivo ? salirDelBanco() : entrarAlBanco()));
  ["tab-available", "tab-queue"].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener("click", salirDelBanco);
  });

  // F9 entra y sale del banco SIN depender de la barra de pestañas. Es lo que evita quedar
  // encerrado: con el banner de conexión puesto, `activarEstadoOfflineUI` esconde `.tabs-bar`
  // entera —y con ella la pestaña 🧪—, que es justo el estado en el que uno necesita volver al
  // banco para destildar la caída que acaba de forzar.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "F9") return;
    e.preventDefault();
    if (bancoActivo) salirDelBanco();
    else entrarAlBanco();
  });

  // --- Cableado -----------------------------------------------------------------------
  const $ = (sel) => panel.querySelector(sel);

  $("#mv-nota-lasterror").innerHTML = puedeFingirLastError
    ? 'El getter de <code>lastError</code> se pudo instalar: la rama de error de inyección es forzable (con demora 0).'
    : '<span class="mv-alerta">No se pudo instalar el getter de <code>lastError</code>: esa rama no se puede forzar en este build.</span>';

  function pintarRegistro() {
    const pre = panel.querySelector("#mv-registro");
    if (!pre) return;
    pre.textContent = registro.map((r) => `${r.hora}  ${r.fuente.padEnd(7)} ${r.texto}`).join("\n");
    pre.scrollTop = pre.scrollHeight;
  }

  async function cargarPestañas() {
    const sel = $("#mv-tab");
    const tabs = await queryReal({});
    sel.innerHTML = '<option value="">(la activa de verdad)</option>';
    tabs.forEach((t, i) => {
      const portal = t.url ? sitios.resolverPorUrl(t.url) : null;
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${portal ? `[${portal.id}]` : "[—]"} ${(t.title || t.url || "").slice(0, 60)}`;
      sel.appendChild(o);
    });
    sel.onchange = () => { cfg.tabForzada = sel.value === "" ? null : tabs[Number(sel.value)]; };
  }

  $("#mv-recargar-tabs").onclick = cargarPestañas;
  $("#mv-demora").onchange = (e) => { cfg.demoraMs = Number(e.target.value); };
  $("#mv-resultado").onchange = (e) => { cfg.resultado = e.target.value; };
  $("#mv-sin-lista").onchange = (e) => { cfg.vaciarListaPrevia = e.target.checked; };
  $("#mv-lasterror").onchange = (e) => {
    fingirLastError = e.target.checked;
    if (fingirLastError && !puedeFingirLastError) {
      anotar("banco", "✖ no se pudo instalar el getter de lastError: esta rama no se puede forzar");
    }
  };
  // ▶ Escanear dispara el escaneo por donde lo dispara el usuario: el click del botón
  // principal. Pero ese botón es MULTI-MODO y casi nunca está en "re-escanear" — después de un
  // escaneo normal queda en "descargar" y **deshabilitado** mientras no haya nada seleccionado
  // ("Seleccioná clases"), y `.click()` sobre un botón deshabilitado no dispara nada. Por eso
  // se lo pone en modo re-escanear y se lo habilita antes de clickear: lo que corre después es
  // el handler real de popup.js (`ejecutarPaso1EscaneoRamonAutomatico`), no una copia.
  $("#mv-escanear").onclick = () => {
    const btn = document.getElementById("ui-btn-action");
    if (!btn) { anotar("banco", "✖ no existe #ui-btn-action"); return; }
    const modoPrevio = btn.getAttribute("data-modo");
    if (modoPrevio !== "re-escanear" || btn.disabled) {
      anotar("banco", `botón en modo "${modoPrevio}"${btn.disabled ? " y deshabilitado" : ""} → se fuerza a "re-escanear"`);
      btn.setAttribute("data-modo", "re-escanear");
      btn.disabled = false;
      btn.style.display = "block";
    }
    // Vaciar la lista va ACÁ y no en el `onchange` del switch: tildarlo no tiene que borrarte
    // nada, sólo armar el próximo escaneo. Así el switch se puede poner y sacar sin efectos.
    //
    // Se muta en su lugar (`length = 0`) en vez de reasignar, por si algún call-site quedó con
    // la referencia vieja. Y NO se toca `colaDescargas`: la rama que importa deriva su
    // `itemsEnCola` de `listadoClasesGlobal` (los `estado === 'process'`), así que con vaciar
    // ésta alcanza — y la cola, que es lo que al usuario le duele perder, queda intacta.
    if (cfg.vaciarListaPrevia && appState && Array.isArray(appState.listadoClasesGlobal)) {
      const cuantas = appState.listadoClasesGlobal.length;
      appState.listadoClasesGlobal.length = 0;
      anotar("banco", `lista previa VACIADA (${cuantas} clases, sólo en memoria)`);
    }

    salirDelBanco();
    anotar("banco", "▶ escaneo disparado");
    btn.click();
  };

  $("#mv-caida-servidor").onchange = (e) => {
    cfg.caidas.servidor = e.target.checked;
    anotar("banco", `servidor ${e.target.checked ? "CAÍDO (simulado)" : "restablecido"}`);
  };
  $("#mv-caida-internet").onchange = (e) => {
    cfg.caidas.internet = e.target.checked;
    anotar("banco", `internet ${e.target.checked ? "CAÍDO (simulado)" : "restablecido"}`);
  };

  const selPausa = $("#mv-pausa");
  selPausa.value = cfg.pausaForzada;
  selPausa.onchange = (e) => {
    cfg.pausaForzada = e.target.value;
    if (cfg.pausaForzada) localStorage.setItem(CLAVE_PAUSA, cfg.pausaForzada);
    else localStorage.removeItem(CLAVE_PAUSA);
    anotar("banco", `cola pausada: "${cfg.pausaForzada || "(no forzar)"}" — recargá para aplicar`);
  };
  $("#mv-recargar").onclick = () => location.reload();

  $("#mv-copiar").onclick = () => navigator.clipboard.writeText($("#mv-registro").textContent);
  $("#mv-limpiar").onclick = () => { registro.length = 0; pintarRegistro(); };

  // El onboarding con CADA descriptor. Andamio, no arreglo: en el popup real la isla recibe
  // siempre `sitios.obtener(undefined)` (ver entrypoints/popup/main.js).
  function remontarOnboarding(sitio) {
    const root = document.getElementById("preact-onboarding");
    if (!root || !montarOnboarding) return;
    montarOnboarding(root, { conexion, appState, sitio });
    anotar("banco", `onboarding re-montado con "${sitio && sitio.nombre}"`);
    salirDelBanco();
    const ayuda = document.getElementById("ui-btn-help");
    if (ayuda) ayuda.click();
  }
  $("#mv-onb-legado").onclick = () => remontarOnboarding(sitios.obtener(undefined));
  $("#mv-onb-otro").onclick = () => remontarOnboarding(sitios.obtener("anatomy-by-chris"));

  // Re-afirmar el layout cuando el popup cambie el banner o el host de la lista. Sin esto, una
  // caída forzada desde el propio banco lo tapa con su banner o le devuelve la lista encima.
  if (BannerConexion.suscribir) BannerConexion.suscribir(afirmarLayoutDelBanco);
  if (ListaClases.suscribir) {
    ListaClases.suscribir(() => {
      // Guarda contra el bucle: `afirmarLayoutDelBanco` llama a setOculta, que emite de vuelta.
      if (bancoActivo && !ListaClases.get().host.oculta) afirmarLayoutDelBanco();
    });
  }

  observar("ui-loader-txt", "loader");
  observar("ui-msg-status", "estado");
  observar("ui-btn-action", "botón");
  cargarPestañas();
  anotar("banco", "modo verificación activo — este build NO se mergea");
  if (cfg.pausaForzada) anotar("banco", `⚠️ arrancando con la cola pausada forzada: ${cfg.pausaForzada}`);
}

export default activarModoVerificacion;
