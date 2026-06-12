/**
 * CLON DOWNLOADHELPER - SERVICE WORKER DE ORQUESTACIÓN (V5.5.0)
 * ==========================================================================
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

importScripts('shared/utils.js', 'shared/bunClient.js', 'background/hlsEngine.js');

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
    const data = await chrome.storage.session.get(key);
    if (typeof key === 'string') {
      return data[key] ?? this.defaults[key];
    }
    const result = {};
    const keys = key || Object.keys(this.defaults);
    keys.forEach(k => {
      result[k] = data[k] ?? this.defaults[k];
    });
    return result;
  },

  async set(updates) {
    await chrome.storage.session.set(updates);
  },

  async clear() {
    await chrome.storage.session.remove(Object.keys(this.defaults));
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

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("🔌 [SW] Extensión instalada/actualizada/recargada. Restableciendo estados de descarga...");
  await SessionState.set({
    rafagaCorriendo: false,
    videoActualTitulo: "",
    videoActualSessionId: ""
  });
  await persistirEstadoFondo({});
});

async function persistirEstadoFondo(estados) {
  await chrome.storage.local.set({ SW_ESTADOS_PROGRESO: estados });
}

async function recuperarEstadoFondo() {
  const data = await chrome.storage.local.get(['SW_ESTADOS_PROGRESO']);
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

  const response = await chrome.runtime.sendMessage({
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
    await chrome.runtime.sendMessage({
      action: "revocar_blob_url",
      blobUrl: blobUrl
    });
  } catch (e) {
    console.error("Error al revocar Object URL en Offscreen:", e);
  }
  
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {}
}

// Listener principal síncrono para mantener canal IPC
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const accionesSoportadas = [
    "escanear_carpeta_local",
    "obtener_estados_en_progreso",
    "inyectar_items_en_cola_activa",
    "remover_item_de_cola",
    "iniciar_descarga_cola",
    "activar_frenado_suave",
    "abortar_rafaga_inmediata",
    "limpiar_estados_progreso"
  ];

  if (!request || !accionesSoportadas.includes(request.action)) {
    return false;
  }
  
  (async () => {
    try {
      // ─── ESCANEO DE CARPETA LOCAL OPTIMIZADO NATIVO ────────────────────────
      if (request.action === "escanear_carpeta_local") {
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
        } catch (e) {
          sendResponse({ archivos: [] });
        }
        return; 
      }


      // ─── ESTADO EN PROGRESO ───────────────────────────────────────────────────
      if (request.action === "obtener_estados_en_progreso") {
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
      }

      // ─── INYECCIÓN EN COLA ATÓMICA ──────────────────────────────────────────
      if (request.action === "inyectar_items_en_cola_activa") {
        const data = await chrome.storage.local.get(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
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

        await chrome.storage.local.set({ 
          listaPersistente: listaCompleta, 
          colaDescargas: colaDescargas, 
          SW_ESTADOS_PROGRESO: estados 
        });
        return sendResponse({ status: "encolados_ok" });
      }

      // ─── REMOCIÓN SILENCIOSA EN COLA ──────────────────────────────────────────
      if (request.action === "remover_item_de_cola") {
        const data = await chrome.storage.local.get(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
        const listaCompleta = data.listaPersistente || [];
        let colaDescargas = data.colaDescargas || [];
        const estados = data.SW_ESTADOS_PROGRESO || {};

        colaDescargas = colaDescargas.filter(c => c.titulo !== request.titulo);
        delete estados[request.titulo];

        const match = listaCompleta.find(c => c.titulo === request.titulo);
        if (match) {
          match.estado = 'pending';
        }

        await chrome.storage.local.set({ 
          listaPersistente: listaCompleta, 
          colaDescargas: colaDescargas, 
          SW_ESTADOS_PROGRESO: estados 
        });
        return sendResponse({ status: "removido_ok" });
      }

      // ─── INICIO DE COLA ────────────────────────────────────────────────────────
      if (request.action === "iniciar_descarga_cola") {
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

          chrome.alarms.clear("alarma_autoheal");

          if (!loopActivo) {
            loopActivo = true;
            procesarSiguienteElementoDeLaCola();
          }
        }
        return sendResponse({ status: "rafaga_iniciada" });
      }

      // ─── FRENADO SUAVE ────────────────────────────────────────────────────────
      if (request.action === "activar_frenado_suave") {
        await SessionState.set({ frenadoSuaveSolicitado: true });
        return sendResponse({ status: "freno_suave_recibido" });
      }

      // ─── ABORT INMEDIATO ──────────────────────────────────────────────────────
      if (request.action === "abortar_rafaga_inmediata") {
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
        chrome.alarms.clear("alarma_autoheal");

        if (controladorGraficoActivo) {
          try { controladorGraficoActivo.abort(); } catch (e) {}
          controladorGraficoActivo = null;
        }

        if (titulo) {
          await BunClient.cancelarDescarga(titulo, sessionId);
        }

        await persistirEstadoFondo({});

        // También resetear las clases en la cola a pending
        const data = await chrome.storage.local.get(['listaPersistente', 'colaDescargas']);
        const listaCompleta = data.listaPersistente || [];
        const colaDescargas = data.colaDescargas || [];

        colaDescargas.forEach(item => {
          const match = listaCompleta.find(c => c.titulo === item.titulo);
          if (match) match.estado = 'pending';
        });

        await chrome.storage.local.set({ listaPersistente: listaCompleta, colaDescargas: colaDescargas });

        return sendResponse({ status: "abortado_ok" });
      }

      // ─── LIMPIEZA DE ESTADOS ──────────────────────────────────────────────────
      if (request.action === "limpiar_estados_progreso") {
        await SessionState.set({
          rafagaCorriendo: false,
          frenadoSuaveSolicitado: false,
          videoActualTitulo: "",
          colaPausadaPorError: false,
          tipoDeErrorConexion: ""
        });
        loopActivo = false;
        chrome.alarms.clear("alarma_autoheal");
        await persistirEstadoFondo({});
        await chrome.storage.local.set({ colaDescargas: [] });
        return sendResponse({ status: "limpio_ok" });
      }

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
    const data = await chrome.storage.local.get(['listaPersistente', 'colaDescargas']);
    const listaCompleta = data.listaPersistente || [];
    const colaDescargas = data.colaDescargas || [];

    // Ordenamiento estricto FIFO por fecha de encolado
    colaDescargas.sort((a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0));

    if (colaDescargas.length === 0) {
      await SessionState.set({ rafagaCorriendo: false });
      loopActivo = false;
      await persistirEstadoFondo({});
      chrome.runtime.sendMessage({ action: "cola_completamente_vacia" }).catch(() => {});
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
      const urlM3u8Descubierta = await HlsEngine.extraerEnlaceMaestroM3u8Clasico(elementoActual.urlInterna, controladorGraficoActivo.signal);
      
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

            chrome.runtime.sendMessage({
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
            }).catch(() => {});
          }
        }
      );

      const postDownloadState = await SessionState.get();
      if (!postDownloadState.rafagaCorriendo) return;

      // ─── [ENTRAMADO DUAL] FASE DE VOLCADO O CIERRE FINAL ───────────────────
      if (!postDownloadState.modoTurboBunActivo) {
        chrome.runtime.sendMessage({
          action: "update_progress_bar",
          percentage: 100,
          titulo: tituloInmutableVideo,
          compiling: true
        }).catch(() => {});

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

      const dataUpdate = await chrome.storage.local.get(['colaDescargas']);
      let colaActual = dataUpdate.colaDescargas || [];
      colaActual = colaActual.filter(c => c.titulo !== tituloInmutableVideo);

      const objPersistente = listaCompleta.find(c => c.titulo === tituloInmutableVideo);
      if (objPersistente) objPersistente.estado = 'downloaded';
      
      const estadosUpdate = await recuperarEstadoFondo();
      delete estadosUpdate[tituloInmutableVideo];
      await persistirEstadoFondo(estadosUpdate);

      await chrome.storage.local.set({ listaPersistente: listaCompleta, colaDescargas: colaActual });

      chrome.runtime.sendMessage({
        action: "clase_guardada_ok",
        titulo: tituloInmutableVideo,
        suaveFrenado: postWriteState.frenadoSuaveSolicitado,
      }).catch(() => {});

      setTimeout(procesarSiguienteElementoDeLaCola, 60);

    } catch (errDescarga) {
      console.error(`⚠️ [BUCLE-ERROR] Falló la descarga de "${tituloInmutableVideo}":`, errDescarga);
      
      const state = await SessionState.get();
      const wasAborted = (controladorGraficoActivo && controladorGraficoActivo.signal.aborted) || errDescarga?.name === 'AbortError';
      const esAbortoUsuario = state.abortadoPorUsuario || wasAborted;
      
      if (esAbortoUsuario) {
        console.log("🛑 [SW] Bucle de descarga abortado por el usuario de forma limpia.");
        return;
      } else {
        let tipoError = "internet";
        const msg = errDescarga?.message || "";
        if (msg.includes("Bun") || msg.includes("localhost") || msg.includes("127.0.0.1") || msg.includes("backend")) {
          tipoError = "servidor";
        }
        await pausarColaPorErrorDeConexion(tipoError, tituloInmutableVideo);
      }
    }

  } catch (errStorage) {
    console.error("❌ [CRÍTICO-STORAGE] No se pudo leer el storage local de la cola:", errStorage);
    await SessionState.set({ rafagaCorriendo: false });
    loopActivo = false;
  }
}

async function marcarClaseComoPendiente(listaCompleta, elementoActual) {
  const checkAbort = await SessionState.get();
  if (checkAbort.abortadoPorUsuario) {
    console.log("🛑 [SW] Aborto confirmado por el usuario. Cancelando marcado de pendientes redundante.");
    return;
  }

  const titulo = elementoActual.titulo;
  const objPersistente = listaCompleta.find(c => c.titulo === titulo);
  if (objPersistente) objPersistente.estado = 'pending';
  
  const estados = await recuperarEstadoFondo();
  estados[titulo] = 'pending';
  
  await persistirEstadoFondo(estados);

  const data = await chrome.storage.local.get(['colaDescargas']);
  let cola = data.colaDescargas || [];
  cola = cola.filter(c => c.titulo !== titulo);

  await chrome.storage.local.set({ listaPersistente: listaCompleta, colaDescargas: cola });
  
  const sessionId = checkAbort.videoActualSessionId || "";
  await BunClient.cancelarDescarga(titulo, sessionId);

  const state = await SessionState.get();
  if (state.rafagaCorriendo) {
    chrome.runtime.sendMessage({ action: "clase_con_error", titulo: titulo }).catch(() => {});
    setTimeout(procesarSiguienteElementoDeLaCola, 100);
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
  chrome.runtime.sendMessage({ action: "cola_completamente_vacia", suaveFrenado: true }).catch(() => {});
}

async function pausarColaPorErrorDeConexion(tipoError, titulo) {
  await SessionState.set({
    colaPausadaPorError: true,
    tipoDeErrorConexion: tipoError,
    rafagaCorriendo: false
  });
  loopActivo = false;

  // Creamos alarma para auto-verificación cada 12 segundos (periodInMinutes acepta decimales)
  chrome.alarms.create("alarma_autoheal", { periodInMinutes: 0.2 });

  chrome.runtime.sendMessage({
    action: "cola_pausada_por_error",
    errorType: tipoError,
    titulo: titulo
  }).catch(() => {});
}

async function reanudarColaDesdeBackground() {
  chrome.alarms.clear("alarma_autoheal");

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
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "alarma_autoheal") {
    const state = await SessionState.get();
    if (state.colaPausadaPorError) {
      try {
        if (state.tipoDeErrorConexion === "servidor") {
          await BunClient.obtenerRutaServidor();
          console.log("🔌 [ALARM-AUTOHEAL] Servidor Bun recuperado. Reanudando...");
          await reanudarColaDesdeBackground();
        } else {
          // Intenta validar la conexión a internet con Ramón Net
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          try {
            await fetch("https://plataforma.ramonnet.com.ar", { 
              method: "HEAD", 
              mode: "no-cors",
              cache: "no-store",
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            console.log("🌐 [ALARM-AUTOHEAL] Conexión a Internet recuperada. Reanudando...");
            await reanudarColaDesdeBackground();
          } catch (err) {
            clearTimeout(timeoutId);
            throw err; // Propagar al catch externo de la alarma
          }
        }
      } catch (e) {
        // Sigue sin conexión/servidor
      }
    } else {
      chrome.alarms.clear("alarma_autoheal");
    }
  }
});