/**
 * CLON DOWNLOADHELPER - SERVICE WORKER DE ORQUESTACIÓN (V6.2.0)
 * ==========================================================================
 * CHANGELOG v6.2.0:
 * - [FASE 5C] El IPC del SW pasa entero al PuertoMensajeria, las DOS puntas: el receptor
 *   (`chrome.runtime.onMessage` → `Mensajeria.onMensaje`, conservando el contrato del
 *   `true`/`false` que mantiene abierto el canal) y los 9 emisores. Los 7 avisos al popup
 *   —progreso, clase guardada/con error, cola vacía, cola pausada— van por `notificar()`,
 *   que es fire-and-forget y hace explícito lo que antes decía un `.catch(() => {})`
 *   colgado de cada envío. Los 2 del camino legacy offscreen (crear/revocar blob URL) van
 *   por `enviar()`, porque sí esperan respuesta. Con esto el SW no toca `chrome.runtime`
 *   salvo `onInstalled`, `getURL` y el `lastError` de notifications.
 * - [FASE 5C] Efecto secundario atajado en el adaptador: `notificar()` logueaba un warning
 *   por envío sin receptor, y "sin receptor" es el estado NORMAL acá (el popup está cerrado
 *   la mayor parte del tiempo). Una descarga habría generado cientos de warnings, uno por
 *   fragmento. El adaptador ahora avisa una sola vez por acción. Ver mensajeria.ts.
 * CHANGELOG v6.1.0:
 * - [FASE 5C] Los 8 call-sites de chrome.alarms (la alarma de auto-sanación) pasan al
 *   PuertoProgramador, que llega como global `Programador` desde composicion.ts. El nombre
 *   y el período dejan de estar hardcodeados en 8 lugares y son constantes de módulo
 *   (ALARMA_AUTOHEAL / PERIODO_AUTOHEAL_MIN). El período sigue en minutos decimales
 *   —0.2 = 12s— porque es la unidad del puerto; cambiarla acá habría sido un cambio de
 *   comportamiento disfrazado de mejora de API. Sin cambios de comportamiento: los tests
 *   del auto-heal pasaron sin tocar una aserción de lógica, sólo la forma de disparar.
 *   Lo que sigue en chrome.* directo acá: runtime (IPC, las dos puntas), notifications,
 *   tabs/windows y el camino legacy downloads/offscreen.
 * CHANGELOG v6.0.0:
 * - [FASE 5B] Los 14 call-sites de chrome.storage (local + session) pasan al
 *   PuertoAlmacenamiento, que llega como global `Almacenamiento` publicado por
 *   plataforma/composicion.ts. El SW ya no toca chrome.storage: SessionState, la cola
 *   persistente y SW_ESTADOS_PROGRESO van todos por el puerto. Único ajuste de forma:
 *   SessionState.get normaliza la clave a lista, porque el puerto pide siempre string[]
 *   (chrome.storage aceptaba string/array/undefined); el camino sin clave leía justo las
 *   de defaults, así que es equivalente. Sin cambios de comportamiento: los 17 tests de
 *   background.test.js —incluidos los 12 de caracterización del bucle y el auto-heal
 *   escritos ANTES de esta migración— pasan sin tocar una sola aserción.
 *   Lo que sigue en chrome.* acá: runtime (IPC), alarms, notifications, tabs, windows,
 *   downloads y offscreen, cada uno esperando su puerto. Ver docs/rearquitectura-diseno.md.
 * CHANGELOG v5.11.0:
 * - [CAPA 2] El SW ahora carga el adaptador de sitio primero (importScripts de
 *   sitio/ramonnet/config.js + resolverManifiesto.js) y la resolución del .m3u8 se
 *   pide a `SitioActivo.resolverManifiesto(...)` en vez de a HlsEngine, que quedó
 *   genérico (v1.1.0). Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * CHANGELOG v5.10.1:
 * - [FIX] El aviso de fallos (v5.10.0) frenaba la cola y no mostraba notificaciones si
 *   chrome.notifications no estaba disponible (permiso no aplicado hasta recargar la
 *   extensión desde la tarjeta). Causa: la maquinaria de descarga dependía sin protección
 *   de la API de notificaciones. Ahora: registrarFallo es a prueba de balas (try/catch en
 *   historial + notificación, nunca propaga); dispararNotificacionFallo guarda la
 *   existencia de chrome.notifications, usa iconUrl absoluta (chrome.runtime.getURL) y
 *   loguea lastError; en la rama "rechazo" el aviso corre DESPUÉS del sendMessage+setTimeout
 *   (la cola sigue aun si el aviso falla); el listener onClicked se registra con guarda para
 *   no romper la carga del SW. Ver docs/notificaciones-fallos-diseno.md.
 * - [FIX] La clase rechazada por el 4xx vuelve a 'pending' (antes 'error'): el estado
 *   'error' no lo reconocía el resto del popup (filtros de selección/encolado piden
 *   'pending', y no hay CSS .badge.error) → la clase quedaba con render roto y sin poder
 *   re-encolarse. Ahora se ve como pendiente normal y es re-encolable; el fallo se
 *   comunica por la campanita + notificación. Espejo en popup.js v5.15.0.
 * CHANGELOG v5.10.0:
 * - [NUEVO] Aviso de fallos: registrarFallo(tipo, titulo, motivo) es el choke point
 *   único que (a) persiste el fallo en el historial (shared/historialFallos.js →
 *   chrome.storage.local, fuente de la campanita del popup) y (b) dispara una
 *   notificación nativa del SO. Se llama desde 2 lugares que cubren los 4 tipos:
 *   la rama del rechazo 4xx (tipo "rechazo", clase saltada) y
 *   pausarColaPorErrorDeConexion (tipos "sesion"/"servidor"/"internet"). Nuevo
 *   listener chrome.notifications.onClicked: enfoca (o abre) la pestaña de Ramón Net.
 *   Requiere el permiso "notifications" (manifest v5.2.0). Ver
 *   docs/notificaciones-fallos-diseno.md, docs/patterns.md §Circuit breaker.
 * CHANGELOG v5.9.0:
 * - [FIX bug 400] Rama nueva en el catch de procesarSiguienteElementoDeLaCola para el
 *   rechazo aplicativo 4xx del backend (errDescarga.tipoBackend==="rechazo", propagado
 *   tras el reintento N=3 del worker — hlsEngine v1.0.6 / bunClient v1.4.0). Antes, un
 *   400 a un fragmento se malclasificaba: /api/health respondía 200 (server vivo) → el
 *   daemon daba tipoFalla=null → la heurística por mensaje veía "Bun" → "servidor" →
 *   pausa+autoheal → el autoheal reanudaba → mismo 400 → LOOP INFINITO que congelaba
 *   toda la cola. Ahora, como un 4xx es determinístico, se clasifica ANTES del daemon
 *   (igual que "sesion"): se marca la clase 'error', se la saca de la cola con un .set()
 *   atómico de las 3 claves (patrón del path de éxito), se emite "clase_con_error" con
 *   título+motivo y se sigue con la próxima. Sin pausa, sin alarma. El 5xx/red conserva
 *   el flujo pausa+autoheal. Ver docs/TECHNICAL_DEBT.md y docs/patterns.md §Circuit breaker.
 * CHANGELOG v5.8.0:
 * - [FIX] Nuevo tipo de falla "sesion": cuando se intenta descargar sin sesión
 *   iniciada en Ramón Net, HlsEngine detecta el redirect al login y lanza un error
 *   tipado (err.tipoConexion="sesion"). El catch de procesarSiguienteElementoDeLaCola
 *   lo clasifica ANTES de consultar al daemon (que vería internet=true y lo
 *   malclasificaría como "internet"), loguea limpio y pausa con tipo "sesion".
 *   pausarColaPorErrorDeConexion NO crea la alarma de autoheal para "sesion" (el
 *   daemon no puede detectar el login → reintentaría en loop); el handler de
 *   alarma_autoheal además la limpia defensivamente si el estado es "sesion". El
 *   usuario reintenta a mano tras iniciar sesión. Ver hlsEngine.js v1.0.5,
 *   docs/data-model.md, docs/patterns.md.
 * CHANGELOG v5.7.0:
 * - [DEBT] El listener IPC (chrome.runtime.onMessage) pasó de una cadena de 8
 *   `if (request.action === ...)` a un diccionario `manejadoresIPC {accion: handler}`
 *   despachado por lookup. Cada handler es async (request, sendResponse); el
 *   listener los envuelve en el mismo IIFE async + try/catch global y devuelve
 *   `true` síncrono. Comportamiento idéntico (los handlers siguen mutando
 *   loopActivo/controladorGraficoActivo por closure). Ver docs/TECHNICAL_DEBT.md
 *   y docs/patterns.md §IPC.
 * CHANGELOG v5.6.5:
 * - [LOG] Una cancelación del usuario ya no se loguea como error fatal. El catch
 *   del bucle de descarga chequea state.abortadoPorUsuario ANTES de loguear: si
 *   fue el usuario, sale con un console.log limpio (🛑 … de forma limpia) y NO
 *   dispara el console.error "[BUCLE-ERROR] Falló". El console.error queda sólo
 *   para fallos reales. (Complementa el des-ruido de hlsEngine.js v1.0.3.)
 * CHANGELOG v5.6.4:
 * - [LIMPIEZA] Eliminada la función muerta marcarClaseComoPendiente (la destapó
 *   ESLint no-unused-vars). Su lógica de "sacar de la cola + volver a 'pending'"
 *   ya vive inline en el handler remover_item_de_cola; la función quedó sin
 *   call-sites desde el commit inicial del repo. Ver docs/TECHNICAL_DEBT.md.
 *   (La escritura atómica que v5.6.3 aplicó sobre ella era, por tanto, sobre
 *   código sin uso — los otros 2 puntos de v5.6.3 siguen vigentes.)
 * CHANGELOG v5.6.3:
 * - [DEBT] Escrituras atómicas a chrome.storage.local en los 3 puntos donde un
 *   cambio lógico toca listaPersistente + colaDescargas + SW_ESTADOS_PROGRESO
 *   (clase descargada, marcarClaseComoPendiente, abortar_rafaga_inmediata). Antes
 *   cada uno hacía persistirEstadoFondo() en un .set() y las otras dos claves en
 *   otro .set() separado → si el SW se suspendía en el medio, quedaban
 *   desincronizadas (ej. ítem 'process' en progreso pero ya fuera de la cola).
 *   Ahora un único .set() por operación, siguiendo el patrón del handler
 *   inyectar_items_en_cola_activa. Ver docs/TECHNICAL_DEBT.md, ROADMAP Fase 3.
 * CHANGELOG v5.6.2:
 * - [DEBT] Los catch(e){} silenciosos ahora dejan rastro con console.warn: el
 *   cierre del documento offscreen y el abort() de limpieza del controlador de
 *   gráfico activo (ver docs/TECHNICAL_DEBT.md, sección Menores/de proceso).
 * CHANGELOG v5.6.1:
 * - [FIX] La clasificación de fin de descarga ya no confunde una caída de conexión
 *   con una cancelación del usuario. Antes usaba controladorGraficoActivo.signal.
 *   aborted / errDescarga.name==='AbortError', pero el motor HLS aborta ese
 *   controlador a propósito para frenar a los otros workers cuando un fragmento
 *   falla (server caído) → se tomaba como cancelación y NO se pausaba la cola, así
 *   que el popup nunca recibía "cola_pausada_por_error" y el banner no aparecía.
 *   Ahora sólo el flag explícito state.abortadoPorUsuario marca cancelación real.
 * CHANGELOG v5.6.0:
 * - [REFACTOR] Estado de conexión unificado vía el daemon shared/conexion.js
 *   (fuente única de verdad, compartida con el popup por chrome.storage.session):
 *   la clasificación de error de descarga y la alarma alarma_autoheal ahora usan
 *   Conexion.verificarAhora()/get() en vez de chequeos propios (string-match del
 *   mensaje + dos ramas HEAD/health separadas).
 * CHANGELOG v5.5.0:
 * - [FIX CRÍTICO] extraerEnlaceMaestroM3u8Clasico: corregida la extracción de
 *   M3u8. Ahora utiliza expresiones regulares con bandera global y extrae el
 *   ÚLTIMO match (el reproductor principal de la clase) en lugar del primero,
 *   lo que soluciona el problema de descargar el mismo video para todas las clases.
 * - [FIX CRÍTICO] SessionState: migrado el estado volátil del Service Worker a
 *   chrome.storage.session. Evita que la cola se detenga al suspenderse el SW.
 * - [FIX CRÍTICO] Offscreen Document: implementada la integración con offscreen.html
 *   para sortear la ausencia de URL.createObjectURL en Service Workers.
 * - [REFACTOR] Conversión integral a patrones async/await de Manifest V3.
 * ==========================================================================
 */

// El adaptador de sitio (Capa 2) va primero: el daemon de conexión y el loop de descarga
// leen de él la URL de sondeo y la resolución del manifiesto. Ver ADR-0008.
// Las dependencias del SW las carga `entrypoints/background.js` como módulos ES antes
// de este archivo (el bundler arma el grafo). Acá no queda nada que importar: el
// `importScripts(...)` que había existía para el SW clásico que se cargaba desde la raíz
// del repo, camino que desapareció al empaquetar con WXT (Fase 3).

// Auto-sanación: la tarea diferida que revisa si volvió la conexión con la cola pausada.
// Va por `PuertoProgramador` y no por `chrome.alarms` directo (Fase 5c). El período sigue
// expresado en minutos decimales porque es la unidad del puerto — 0.2 min = 12 s, el valor
// que este archivo usaba hardcodeado en el `create`.
const ALARMA_AUTOHEAL = "alarma_autoheal";
const PERIODO_AUTOHEAL_MIN = 0.2;

// Helper para encapsular el estado en almacenamiento de sesión (persistente al SW, volátil al navegador)
const SessionState = {
  defaults: {
    rafagaCorriendo: false,
    frenadoSuaveSolicitado: false,
    modoTurboBunActivo: true,
    videoActualTitulo: "",
    bytesProcesadosEnVideoActual: 0,
    fragmentosTerminadosEnVideoActual: 0,
    totalFragmentosEnVideoActual: 0,
    tiempoInicioVideoActual: 0,
    velocidadMbsActual: 0,
    colaPausadaPorError: false,
    tipoDeErrorConexion: "",
    abortadoPorUsuario: false,
    videoActualSessionId: ""
  },

  async get(key) {
    // El puerto pide siempre una lista de claves (chrome.storage aceptaba string, array o
    // undefined). La normalización es equivalente: el camino sin `key` sólo leía las claves
    // que están en defaults, que es justo lo que se pide acá.
    const claves = typeof key === 'string' ? [key] : (key || Object.keys(this.defaults));
    const data = await Almacenamiento.obtenerSesion(claves);
    if (typeof key === 'string') {
      return data[key] ?? this.defaults[key];
    }
    const result = {};
    claves.forEach(k => {
      result[k] = data[k] ?? this.defaults[k];
    });
    return result;
  },

  async set(updates) {
    await Almacenamiento.guardarSesion(updates);
  },

  async clear() {
    await Almacenamiento.borrarSesion(Object.keys(this.defaults));
  }
};

// Variables en memoria del Service Worker (volátiles)
let controladorGraficoActivo = null;
let loopActivo = false;

// Sincronizar bandera de motor y reanudar si es necesario al despertar/cargar el SW
(async () => {
  await SessionState.set({ modoTurboBunActivo: true });
  
  const state = await SessionState.get();
  if (state.rafagaCorriendo && !loopActivo) {
    console.log("🔄 [SW-ENGINE] Service Worker despertó con descarga pendiente. Reanudando...");
    loopActivo = true;
    procesarSiguienteElementoDeLaCola();
  }
})();

chrome.runtime.onInstalled.addListener(async (_details) => {
  console.log("🔌 [SW] Extensión instalada/actualizada/recargada. Restableciendo estados de descarga...");
  await SessionState.set({
    rafagaCorriendo: false,
    videoActualTitulo: "",
    videoActualSessionId: ""
  });
  await persistirEstadoFondo({});
});

async function persistirEstadoFondo(estados) {
  await Almacenamiento.guardarLocal({ SW_ESTADOS_PROGRESO: estados });
}

async function recuperarEstadoFondo() {
  const data = await Almacenamiento.obtenerLocal(['SW_ESTADOS_PROGRESO']);
  return data.SW_ESTADOS_PROGRESO || {};
}

// Helper para abrir documento offscreen y generar Object URL de forma segura en MV3
async function obtenerBlobUrlDeOffscreen(blob) {
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_PARSING'],
      justification: 'Generar URL de objeto para descarga de video HLS'
    });
  } catch (err) {
    if (!err.message.includes("Only one offscreen document")) {
      throw err;
    }
  }

  const response = await Mensajeria.enviar({
    action: "crear_blob_url",
    blob: blob
  });

  if (response.error) {
    throw new Error(response.error);
  }

  return response.blobUrl;
}

// Helper para cerrar el documento offscreen y liberar memoria
async function cerrarOffscreenYRevocar(blobUrl) {
  try {
    await Mensajeria.enviar({
      action: "revocar_blob_url",
      blobUrl: blobUrl
    });
  } catch (e) {
    console.error("Error al revocar Object URL en Offscreen:", e);
  }
  
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {
    // Puede fallar si no había documento offscreen abierto (esperado en ese caso);
    // un warn de bajo nivel deja rastro si el cierre falla por otra razón.
    console.warn("⚠️ No se pudo cerrar el documento offscreen:", e?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers IPC despachados por acción (dict {accion: handler} en vez de una
// cadena de if — ver docs/patterns.md §IPC). Cada handler es async (request,
// sendResponse); el listener los envuelve en un IIFE async + try/catch global y
// devuelve true síncrono para mantener el canal abierto a una respuesta async.
// Los handlers mutan estado de módulo (loopActivo, controladorGraficoActivo) por
// closure, igual que antes. El objeto se exporta (module.exports) para tests.
// ─────────────────────────────────────────────────────────────────────────────
const manejadoresIPC = {
  // ─── ESCANEO DE CARPETA LOCAL OPTIMIZADO NATIVO ────────────────────────
  async escanear_carpeta_local(request, sendResponse) {
    const materiaObjetivo = request.carpeta ? request.carpeta.trim().toLowerCase() : "";
    const limiteHorizonte = new Date();
    limiteHorizonte.setDate(limiteHorizonte.getDate() - 30);

    try {
      const items = await chrome.downloads.search({
        state: "complete",
        startedAfter: limiteHorizonte.toISOString()
      });

      const nombresProcesados = (items || [])
        .filter(item => item && item.filename)
        .filter(item => {
          const rutaFisicaNormalizada = item.filename.toLowerCase().replace(/\\/g, '/');
          if (!materiaObjetivo) return true;
          return rutaFisicaNormalizada.includes(`/${materiaObjetivo}/`);
        })
        .map(item => {
          const nombreArchivoConExt = item.filename.split(/[\\/]/).pop();
          return nombreArchivoConExt.replace(/\.[^/.]+$/, "").toLowerCase().trim();
        })
        .filter(nombre => nombre.length > 0);

      sendResponse({ archivos: nombresProcesados });
    } catch {
      sendResponse({ archivos: [] });
    }
  },

  // ─── ESTADO EN PROGRESO ───────────────────────────────────────────────────
  async obtener_estados_en_progreso(request, sendResponse) {
    const estados = await recuperarEstadoFondo();
    const state = await SessionState.get();
    return sendResponse({
      estados: estados,
      suaveFrenado: state.frenadoSuaveSolicitado,
      videoActual: state.videoActualTitulo,
      colaPausadaPorError: state.colaPausadaPorError,
      tipoDeErrorConexion: state.tipoDeErrorConexion,
      enColaTamano: state.totalFragmentosEnVideoActual > 0 ? 1 : 0,
      porcentaje: state.totalFragmentosEnVideoActual > 0 ? Math.floor((state.fragmentosTerminadosEnVideoActual / state.totalFragmentosEnVideoActual) * 100) : 0,
      telemetry: {
        bytesProcesados: state.bytesProcesadosEnVideoActual,
        fragsTerminados: state.fragmentosTerminadosEnVideoActual,
        totalFrags:      state.totalFragmentosEnVideoActual,
        velocidadMbs:    state.velocidadMbsActual,
      }
    });
  },

  // ─── INYECCIÓN EN COLA ATÓMICA ──────────────────────────────────────────
  async inyectar_items_en_cola_activa(request, sendResponse) {
    const data = await Almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
    const listaCompleta = data.listaPersistente || [];
    const colaDescargas = data.colaDescargas || [];
    const estados = data.SW_ESTADOS_PROGRESO || {};

    request.items.forEach(item => {
      estados[item.titulo] = 'process';

      // Asegurar inserción en el array desacoplado
      if (!colaDescargas.some(c => c.titulo === item.titulo)) {
        colaDescargas.push(item);
      }

      // También actualizar estado en la lista persistente local
      const claseMatch = listaCompleta.find(c => c.titulo === item.titulo);
      if (claseMatch) {
        claseMatch.estado = 'process';
        claseMatch.carpeta = item.carpeta;
      }
    });

    await Almacenamiento.guardarLocal({
      listaPersistente: listaCompleta,
      colaDescargas: colaDescargas,
      SW_ESTADOS_PROGRESO: estados
    });
    return sendResponse({ status: "encolados_ok" });
  },

  // ─── REMOCIÓN SILENCIOSA EN COLA ──────────────────────────────────────────
  async remover_item_de_cola(request, sendResponse) {
    const data = await Almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
    const listaCompleta = data.listaPersistente || [];
    let colaDescargas = data.colaDescargas || [];
    const estados = data.SW_ESTADOS_PROGRESO || {};

    colaDescargas = colaDescargas.filter(c => c.titulo !== request.titulo);
    delete estados[request.titulo];

    const match = listaCompleta.find(c => c.titulo === request.titulo);
    if (match) {
      match.estado = 'pending';
    }

    await Almacenamiento.guardarLocal({
      listaPersistente: listaCompleta,
      colaDescargas: colaDescargas,
      SW_ESTADOS_PROGRESO: estados
    });
    return sendResponse({ status: "removido_ok" });
  },

  // ─── INICIO DE COLA ────────────────────────────────────────────────────────
  async iniciar_descarga_cola(request, sendResponse) {
    const state = await SessionState.get();
    if (!state.rafagaCorriendo) {
      await SessionState.set({
        rafagaCorriendo: true,
        frenadoSuaveSolicitado: false,
        modoTurboBunActivo: true,
        colaPausadaPorError: false,
        tipoDeErrorConexion: "",
        abortadoPorUsuario: false
      });

      Programador.cancelar(ALARMA_AUTOHEAL);

      if (!loopActivo) {
        loopActivo = true;
        procesarSiguienteElementoDeLaCola();
      }
    }
    return sendResponse({ status: "rafaga_iniciada" });
  },

  // ─── FRENADO SUAVE ────────────────────────────────────────────────────────
  async activar_frenado_suave(request, sendResponse) {
    await SessionState.set({ frenadoSuaveSolicitado: true });
    return sendResponse({ status: "freno_suave_recibido" });
  },

  // ─── ABORT INMEDIATO ──────────────────────────────────────────────────────
  async abortar_rafaga_inmediata(request, sendResponse) {
    const state = await SessionState.get();
    const titulo = state.videoActualTitulo;
    const sessionId = state.videoActualSessionId || "";

    await SessionState.set({
      rafagaCorriendo: false,
      frenadoSuaveSolicitado: false,
      videoActualTitulo: "",
      videoActualSessionId: "",
      colaPausadaPorError: false,
      tipoDeErrorConexion: "",
      abortadoPorUsuario: true
    });
    loopActivo = false;
    Programador.cancelar(ALARMA_AUTOHEAL);

    if (controladorGraficoActivo) {
      try { controladorGraficoActivo.abort(); }
      catch (e) { console.warn("⚠️ Falló el abort del controlador de gráfico activo (limpieza de fin de ráfaga):", e?.message); }
      controladorGraficoActivo = null;
    }

    if (titulo) {
      await BunClient.cancelarDescarga(titulo, sessionId);
    }

    // También resetear las clases en la cola a pending
    const data = await Almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas']);
    const listaCompleta = data.listaPersistente || [];
    const colaDescargas = data.colaDescargas || [];

    colaDescargas.forEach(item => {
      const match = listaCompleta.find(c => c.titulo === item.titulo);
      if (match) match.estado = 'pending';
    });

    // Escritura atómica: el abort limpia el progreso (SW_ESTADOS_PROGRESO: {}) y
    // resetea las clases de la cola a 'pending' en un solo .set(), sin ventana
    // intermedia donde el progreso ya esté vacío pero la lista aún no reseteada.
    await Almacenamiento.guardarLocal({
      listaPersistente: listaCompleta,
      colaDescargas: colaDescargas,
      SW_ESTADOS_PROGRESO: {}
    });

    return sendResponse({ status: "abortado_ok" });
  },

  // ─── LIMPIEZA DE ESTADOS ──────────────────────────────────────────────────
  async limpiar_estados_progreso(request, sendResponse) {
    await SessionState.set({
      rafagaCorriendo: false,
      frenadoSuaveSolicitado: false,
      videoActualTitulo: "",
      colaPausadaPorError: false,
      tipoDeErrorConexion: ""
    });
    loopActivo = false;
    Programador.cancelar(ALARMA_AUTOHEAL);
    await persistirEstadoFondo({});
    await Almacenamiento.guardarLocal({ colaDescargas: [] });
    return sendResponse({ status: "limpio_ok" });
  }
};

// Listener principal síncrono para mantener canal IPC.
// Va por el PuertoMensajeria (Fase 5c). La forma se conserva tal cual, incluido el contrato
// del `true`/`false` de retorno: el puerto lo respeta a propósito porque es lo que mantiene
// abierto el canal para una respuesta asíncrona, y cambiarlo acá habría sido rediseñar el
// despacho en el mismo corte que la migración.
Mensajeria.onMensaje((request, responder) => {
  const manejador = request && manejadoresIPC[request.action];
  if (!manejador) {
    return false;
  }

  (async () => {
    try {
      await manejador(request, responder);
    } catch (errGlobal) {
      console.error("❌ [IPC-SW-ERROR] Falló procesamiento de mensaje interno:", errGlobal);
    }
  })();

  return true;
});

// =============================================================================
// PROCESADOR DE COLA PERSISTENTE CRIPTOGRÁFICO ASYNC PURO
// =============================================================================
async function procesarSiguienteElementoDeLaCola() {
  const state = await SessionState.get();

  if (state.frenadoSuaveSolicitado) {
    await notificarFrenoSuaveExitoso();
    return;
  }
  if (!state.rafagaCorriendo) {
    loopActivo = false;
    return;
  }

  try {
    const data = await Almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas']);
    const listaCompleta = data.listaPersistente || [];
    const colaDescargas = data.colaDescargas || [];

    // Ordenamiento estricto FIFO por fecha de encolado
    colaDescargas.sort((a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0));

    if (colaDescargas.length === 0) {
      await SessionState.set({ rafagaCorriendo: false });
      loopActivo = false;
      await persistirEstadoFondo({});
      Mensajeria.notificar({ action: "cola_completamente_vacia" });
      return;
    }

    const elementoActual = colaDescargas[0];
    const tituloInmutableVideo = elementoActual.titulo;
    const sessionId = Date.now().toString();
    
    await SessionState.set({
      videoActualTitulo: tituloInmutableVideo,
      videoActualSessionId: sessionId,
      bytesProcesadosEnVideoActual: 0,
      fragmentosTerminadosEnVideoActual: 0,
      totalFragmentosEnVideoActual: 0,
      tiempoInicioVideoActual: performance.now(),
      velocidadMbsActual: 0,
      abortadoPorUsuario: false
    });

    const estados = await recuperarEstadoFondo();
    estados[tituloInmutableVideo] = 'process';
    await persistirEstadoFondo(estados);

    controladorGraficoActivo = new AbortController();

    try {
      // La resolución del .m3u8 es específica del portal (iframe del reproductor, CDN):
      // vive en el adaptador de sitio, no en el motor HLS, que ya es genérico.
      const urlM3u8Descubierta = await SitioActivo.resolverManifiesto(elementoActual.urlInterna, controladorGraficoActivo.signal);
      
      const currentState = await SessionState.get();
      if (!currentState.rafagaCorriendo) return;

      const listaFragmentos = await HlsEngine.descargarYAnalizarIndexM3u8(urlM3u8Descubierta, controladorGraficoActivo.signal);
      await SessionState.set({ totalFragmentosEnVideoActual: listaFragmentos.urls.length });

      const subcarpetaFinal = elementoActual.carpeta ? elementoActual.carpeta.trim().toLowerCase() : "biologia";

      const resultadoBloquesBlob = await HlsEngine.compilarTranscodificacionStream(
        listaFragmentos,
        controladorGraficoActivo.signal,
        subcarpetaFinal,
        tituloInmutableVideo,
        {
          onFragmentoCompletado: async (pesoBytesChunk, totalUrls, bytesAcumulados, fragmentosTerminados) => {
            const current = await SessionState.get();
            if (!current.rafagaCorriendo) return;
            
            const progreso = Utils.calcularMétricasProgreso(
              bytesAcumulados,
              fragmentosTerminados,
              totalUrls,
              current.tiempoInicioVideoActual
            );

            const velocidadMbs = parseFloat(progreso.telemetry.velocidadTexto);

            await SessionState.set({
              bytesProcesadosEnVideoActual: bytesAcumulados,
              fragmentosTerminadosEnVideoActual: fragmentosTerminados,
              velocidadMbsActual: velocidadMbs
            });
            
            if (current.modoTurboBunActivo) {
              BunClient.actualizarConsola({
                titulo: tituloInmutableVideo,
                porcentaje: progreso.porcentaje,
                terminados: fragmentosTerminados,
                totales: totalUrls,
                velocidad: velocidadMbs
              });
            }

            Mensajeria.notificar({
              action: "update_progress_bar",
              percentage: progreso.porcentaje,
              titulo: tituloInmutableVideo,
              compiling: false,
              telemetry: {
                bytesProcesados: bytesAcumulados,
                fragsTerminados: fragmentosTerminados,
                totalFrags: totalUrls,
                velocidadMbs: velocidadMbs,
              }
            });
          }
        }
      );

      const postDownloadState = await SessionState.get();
      if (!postDownloadState.rafagaCorriendo) return;

      // ─── [ENTRAMADO DUAL] FASE DE VOLCADO O CIERRE FINAL ───────────────────
      if (!postDownloadState.modoTurboBunActivo) {
        Mensajeria.notificar({
          action: "update_progress_bar",
          percentage: 100,
          titulo: tituloInmutableVideo,
          compiling: true
        });

        const subRutaArchivo = `${subcarpetaFinal}/${tituloInmutableVideo}.mp4`;
        
        // Obtenemos una Object URL válida delegando la tarea en el documento Offscreen
        const blobUrl = await obtenerBlobUrlDeOffscreen(resultadoBloquesBlob);
        
        try {
          await Utils.inyectarArchivoEnDiscoChrome(blobUrl, subRutaArchivo);
        } finally {
          await cerrarOffscreenYRevocar(blobUrl);
        }
      } else {
        console.log(`✨ [SW-ENGINE] Modo Turbo Bun completado con éxito para: "${tituloInmutableVideo}"`);
      }

      const postWriteState = await SessionState.get();
      if (!postWriteState.rafagaCorriendo) return;

      const dataUpdate = await Almacenamiento.obtenerLocal(['colaDescargas']);
      let colaActual = dataUpdate.colaDescargas || [];
      colaActual = colaActual.filter(c => c.titulo !== tituloInmutableVideo);

      const objPersistente = listaCompleta.find(c => c.titulo === tituloInmutableVideo);
      if (objPersistente) objPersistente.estado = 'downloaded';
      
      const estadosUpdate = await recuperarEstadoFondo();
      delete estadosUpdate[tituloInmutableVideo];

      // Escritura atómica: las tres claves describen el estado de la misma clase
      // (descargada → fuera de la cola, marcada 'downloaded', sin entrada de progreso).
      // Consolidadas en un solo .set() para que una suspensión del SW no las desincronice.
      await Almacenamiento.guardarLocal({
        listaPersistente: listaCompleta,
        colaDescargas: colaActual,
        SW_ESTADOS_PROGRESO: estadosUpdate
      });

      Mensajeria.notificar({
        action: "clase_guardada_ok",
        titulo: tituloInmutableVideo,
        suaveFrenado: postWriteState.frenadoSuaveSolicitado,
      });

      setTimeout(procesarSiguienteElementoDeLaCola, 60);

    } catch (errDescarga) {
      const state = await SessionState.get();
      // SÓLO el flag explícito marca una cancelación del usuario. NO usar
      // controladorGraficoActivo.signal.aborted ni errDescarga.name==='AbortError':
      // el motor HLS aborta ese controlador A PROPÓSITO para frenar a los otros
      // workers cuando UN fragmento falla (ej. server caído), y ese abort hace que
      // los fetches hermanos rechacen con AbortError. Confiar en eso hacía que una
      // caída de conexión se confundiera con cancelación → la cola no se pausaba y
      // el popup nunca recibía "cola_pausada_por_error" (banner que no se disparaba).
      if (state.abortadoPorUsuario) {
        // Cancelación deliberada del usuario: NO es un fallo. Se loguea limpio (sin el
        // console.error de [BUCLE-ERROR]) y ANTES de clasificar nada: los AbortError de
        // los fragmentos que llegaron hasta acá son la consecuencia esperada del abort,
        // no un crash.
        console.log(`🛑 [SW] Descarga de "${tituloInmutableVideo}" abortada por el usuario de forma limpia.`);
        return;
      }

      // Sesión no iniciada/expirada: HlsEngine detectó que la página de la clase
      // redirigió al login. NO es un fallo de red (la conectividad está OK) ni un crash;
      // es accionable por el usuario. Se loguea limpio y se pausa como tipo "sesion"
      // ANTES de consultar al daemon (que reportaría internet=true y malclasificaría).
      // pausarColaPorErrorDeConexion NO crea la alarma de autoheal para este tipo: el
      // daemon no puede detectar el login, reintentaría en loop. El usuario reintenta
      // manualmente tras iniciar sesión.
      if (errDescarga?.tipoConexion === "sesion") {
        console.warn(`🔑 [SW] Descarga de "${tituloInmutableVideo}" pausada: no hay sesión activa en Ramón Net.`);
        await pausarColaPorErrorDeConexion("sesion", tituloInmutableVideo);
        return;
      }

      // Rechazo aplicativo del backend (4xx persistente a un fragmento, tras el reintento
      // N=3 del worker — hlsEngine v1.0.6 / bunClient v1.4.0). El server está VIVO:
      // /api/health daría 200 y el daemon lo malclasificaría como "servidor", generando el
      // loop pausa→autoheal→mismo 400. Un 4xx es determinístico: se salta SOLO esta clase
      // y la cola sigue con la próxima. Sin pausa, sin alarma. Se clasifica ANTES del
      // daemon, igual que el caso "sesion". La clase vuelve a 'pending' (no queda un estado
      // 'error' que el resto del popup no reconoce): se ve como una pendiente normal y es
      // re-encolable. El fallo se comunica por la campanita + la notificación nativa.
      if (errDescarga?.tipoBackend === "rechazo") {
        console.warn(`⛔ [SW] El backend rechazó fragmentos de "${tituloInmutableVideo}" (HTTP ${errDescarga.httpStatus}). Se salta la clase y la cola continúa.`);
        // Cola fresca (pudo cambiar durante la descarga); listaCompleta y estados en memoria.
        const dataUpdate = await Almacenamiento.obtenerLocal(['colaDescargas']);
        const colaFiltrada = (dataUpdate.colaDescargas || []).filter(c => c.titulo !== tituloInmutableVideo);
        const objPersistente = listaCompleta.find(c => c.titulo === tituloInmutableVideo);
        if (objPersistente) objPersistente.estado = 'pending';
        const estadosUpdate = await recuperarEstadoFondo();
        delete estadosUpdate[tituloInmutableVideo];
        // Escritura atómica de las 3 claves (mismo patrón que el path de éxito): clase de
        // vuelta a 'pending', fuera de la cola, sin entrada de progreso.
        await Almacenamiento.guardarLocal({
          listaPersistente: listaCompleta,
          colaDescargas: colaFiltrada,
          SW_ESTADOS_PROGRESO: estadosUpdate
        });
        const motivoRechazo = `el backend rechazó sus fragmentos (HTTP ${errDescarga.httpStatus})`;
        Mensajeria.notificar({
          action: "clase_con_error",
          titulo: tituloInmutableVideo,
          motivo: motivoRechazo
        });
        setTimeout(procesarSiguienteElementoDeLaCola, 60); // seguir con la próxima
        // Aviso persistente + notificación nativa (best-effort, DESPUÉS de garantizar la
        // continuación de la cola; registrarFallo no propaga). El popup abierto ya
        // reaccionó al IPC de arriba; el historial cubre el caso cerrado.
        registrarFallo("rechazo", tituloInmutableVideo, motivoRechazo);
        return;
      }

      // A partir de acá es un fallo REAL (no iniciado por el usuario): ahora sí, error.
      console.error(`⚠️ [BUCLE-ERROR] Falló la descarga de "${tituloInmutableVideo}":`, errDescarga);

      // Clasificar el tipo de fallo con el daemon de conexión (fuente única de verdad).
      // Si la conectividad está OK (el fallo no fue de red), caer a la heurística por
      // mensaje como antes para no clasificar mal un error no relacionado.
      await Conexion.verificarAhora();
      let tipoError = Conexion.get().tipoFalla;
      if (!tipoError) {
        const msg = errDescarga?.message || "";
        tipoError = (msg.includes("Bun") || msg.includes("localhost") || msg.includes("127.0.0.1") || msg.includes("backend"))
          ? "servidor"
          : "internet";
      }
      await pausarColaPorErrorDeConexion(tipoError, tituloInmutableVideo);
    }

  } catch (errStorage) {
    console.error("❌ [CRÍTICO-STORAGE] No se pudo leer el storage local de la cola:", errStorage);
    await SessionState.set({ rafagaCorriendo: false });
    loopActivo = false;
  }
}
async function notificarFrenoSuaveExitoso() {
  await SessionState.set({
    rafagaCorriendo: false,
    frenadoSuaveSolicitado: false,
    videoActualTitulo: ""
  });
  loopActivo = false;
  await persistirEstadoFondo({});
  Mensajeria.notificar({ action: "cola_completamente_vacia", suaveFrenado: true });
}

// Choke point único de aviso de fallos: persiste el fallo en el historial (para la
// campanita del popup, aun con el popup cerrado) y dispara una notificación nativa.
// Copy por tipo — cada tipo debe tener un título distinto para que la notificación
// sea escaneable de un vistazo.
const TITULOS_NOTIF_FALLO = {
  rechazo: "Clase saltada",
  sesion: "Sesión expirada",
  servidor: "Servidor desconectado",
  internet: "Sin conexión a internet"
};
const MOTIVOS_PAUSA = {
  sesion: "no hay sesión activa en Ramón Net",
  servidor: "se perdió la conexión con el servidor local",
  internet: "se perdió la conexión a internet"
};

// A prueba de balas: ni el historial ni la notificación pueden propagar una excepción.
// El aviso es un efecto secundario best-effort — la salud de la cola NUNCA debe depender
// de que funcione (regresión v5.10.0: un chrome.notifications ausente frenaba la cola).
async function registrarFallo(tipo, titulo, motivo) {
  try {
    await HistorialFallos.registrar(tipo, titulo, motivo);
  } catch (e) {
    console.warn("[SW] No se pudo registrar el fallo en el historial:", e);
  }
  dispararNotificacionFallo(tipo, titulo, motivo);
}

function dispararNotificacionFallo(tipo, titulo, motivo) {
  try {
    if (typeof chrome === "undefined" || !chrome.notifications || !chrome.notifications.create) {
      console.warn("[SW] chrome.notifications no disponible (¿falta recargar la extensión desde la tarjeta tras sumar el permiso 'notifications'?).");
      return;
    }
    // notificationId "" (auto-generado): cada fallo es un evento distinto y debe apilarse.
    chrome.notifications.create("", {
      type: "basic",
      // URL absoluta vía getURL: la ruta relativa "icons/..." puede no resolver en el SW
      // (falla silenciosa "Unable to download all specified images").
      iconUrl: chrome.runtime.getURL("icons/icon128.png"),
      title: TITULOS_NOTIF_FALLO[tipo] || "Fallo en la descarga",
      message: titulo ? `"${titulo}": ${motivo}` : motivo,
      priority: 2
    }, () => {
      // La API reporta el motivo real por lastError (no por throw): queda logueado para
      // diagnóstico si la notificación no se muestra pese a recargar bien la extensión.
      if (chrome.runtime.lastError) {
        console.warn("[SW] La notificación no se pudo mostrar:", chrome.runtime.lastError.message);
      }
    });
  } catch (e) {
    console.warn("[SW] Error creando la notificación de fallo:", e);
  }
}

async function pausarColaPorErrorDeConexion(tipoError, titulo) {
  await SessionState.set({
    colaPausadaPorError: true,
    tipoDeErrorConexion: tipoError,
    rafagaCorriendo: false
  });
  loopActivo = false;

  // Aviso (historial + notificación nativa) tras persistir la pausa: que quede el
  // estado es lo crítico; el aviso es secundario y no debe abortar la pausa si falla.
  registrarFallo(tipoError, titulo, MOTIVOS_PAUSA[tipoError] || "error de conexión").catch(() => {});

  // Autoheal sólo para fallas que el daemon PUEDE detectar recuperadas (servidor/internet).
  // El caso "sesion" no se auto-reanuda: el daemon ve la red OK, así que la alarma
  // reintentaría en loop contra el login. El usuario reintenta a mano tras iniciar sesión.
  if (tipoError !== "sesion") {
    // Creamos alarma para auto-verificación cada 12 segundos (periodInMinutes acepta decimales)
    Programador.programar(ALARMA_AUTOHEAL, { periodoMin: PERIODO_AUTOHEAL_MIN });
  }

  Mensajeria.notificar({
    action: "cola_pausada_por_error",
    errorType: tipoError,
    titulo: titulo
  });
}

async function reanudarColaDesdeBackground() {
  Programador.cancelar(ALARMA_AUTOHEAL);

  await SessionState.set({
    colaPausadaPorError: false,
    tipoDeErrorConexion: "",
    rafagaCorriendo: true
  });

  if (!loopActivo) {
    loopActivo = true;
    procesarSiguienteElementoDeLaCola();
  }
}

// Escuchador de Alarma para Auto-Sanación en segundo plano (funciona incluso si el SW se suspende)
Programador.onDisparo(async (nombre) => {
  if (nombre === ALARMA_AUTOHEAL) {
    const state = await SessionState.get();
    if (state.colaPausadaPorError) {
      // Guarda defensiva: el caso "sesion" no debe auto-reanudarse (el daemon no puede
      // detectar el login). No se crea alarma para él, pero si quedó una de un estado
      // previo, se limpia acá. El usuario reanuda a mano tras iniciar sesión.
      if (state.tipoDeErrorConexion === "sesion") {
        Programador.cancelar(ALARMA_AUTOHEAL);
        return;
      }
      try {
        // Un solo chequeo vía el daemon (fuente única de verdad) en vez de dos ramas
        // con lógicas distintas. Reanuda apenas vuelve la conexión que faltaba, según
        // el tipo de error que pausó la cola. verificarAhora() también espeja el estado
        // en chrome.storage.session, así el popup (si está abierto) lo ve.
        await Conexion.verificarAhora();
        const est = Conexion.get();
        const recuperado = state.tipoDeErrorConexion === "servidor" ? est.servidor : est.internet;
        if (recuperado) {
          console.log(`✅ [ALARM-AUTOHEAL] Conexión (${state.tipoDeErrorConexion}) recuperada. Reanudando...`);
          await reanudarColaDesdeBackground();
        }
      } catch {
        // Sigue sin conexión/servidor
      }
    } else {
      Programador.cancelar(ALARMA_AUTOHEAL);
    }
  }
});

// Click en la notificación nativa de fallo → enfocar la pestaña de Ramón Net (o abrirla
// si no hay ninguna). Da un follow-up accionable: el usuario revisa/reintenta la clase.
// La guarda evita que un chrome.notifications ausente tire durante la evaluación del SW
// (rompería la carga entera del service worker).
if (typeof chrome !== "undefined" && chrome.notifications && chrome.notifications.onClicked) {
  chrome.notifications.onClicked.addListener(async (notificationId) => {
    chrome.notifications.clear(notificationId);
    try {
      const [tab] = await chrome.tabs.query({ url: SitioActivo.patronPestañas });
      if (tab) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: SitioActivo.urlSondeoInternet });
      }
    } catch (e) {
      console.warn("[SW] No se pudo enfocar/abrir la pestaña de Ramón Net:", e);
    }
  });
}