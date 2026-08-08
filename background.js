/**
 * CLON DOWNLOADHELPER - SERVICE WORKER DE ORQUESTACIÓN (V7.1.0)
 * ==========================================================================
 * CHANGELOG v7.1.0:
 * - [MULTISITIO CORTE 8] El click en la notificación de fallo enfocaba la pestaña del portal
 *   ASUMIDO. Con la cola mezclada eso abre el portal equivocado — el mismo defecto que el
 *   corte 4 arregló en el filtro, pero acá le llega al usuario. Ahora el portal sale del
 *   `notificationId`, que lo lleva adentro desde que se creó el aviso.
 * - [MULTISITIO CORTE 8] `deps.sitio` se reemplaza por `deps.resolverSitioDeNotificacion`:
 *   **el SW dejó de tener UN portal**. Era el último lector de `sitioAsumido`, el andamio que
 *   dejó el corte 2. Si el resolvedor devuelve `undefined` (portal huérfano) el click NO abre
 *   ninguna pestaña: no sabemos a dónde llevar al usuario y adivinar es el bug.
 * CHANGELOG v7.0.0:
 * - [FASE 7A] El SW deja de leer globals: exporta `iniciarServiceWorker(deps)` y recibe sus
 *   8 colaboradores por parámetro. Los llamaba por `globalThis` en 33 lugares; ahora entran
 *   una vez y el resto del archivo los usa por closure, así que el diff es de cableado y no
 *   de lógica. Con esto `plataforma/composicion.ts` deja de publicar SEIS globals
 *   (`Almacenamiento`, `Programador`, `SessionState`, `EstadosProgreso`, `Cola`, `HlsEngine`):
 *   la medición mostró que `background.js` era su ÚNICO consumidor de producción.
 * - [FASE 7A] `HlsEngine` ya estaba muerto como global desde la Fase 6b —el motor entra al
 *   procesador de cola por inyección— pero la composición lo seguía publicando con un
 *   comentario que decía que el SW lo consumía. Nadie lo leía.
 * - [FASE 7A] **El momento de registro de los listeners no cambia.** `iniciarServiceWorker`
 *   se llama desde el top-level de `entrypoints/background.js`, igual que antes se evaluaba
 *   este archivo: MV3 exige que `onInstalled`/`onClicked`/`onMensaje` se registren
 *   sincrónicamente al arrancar el worker, y meterlos en el callback de `defineBackground`
 *   —o detrás de un `await`— los perdería en el primer arranque en frío.
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

// El nombre de la alarma de auto-sanación. Es constante de módulo (no del closure) porque no
// depende de ninguna dependencia inyectada y el procesador de cola usa el mismo literal.
const ALARMA_AUTOHEAL = "alarma_autoheal";

/**
 * Arranca el service worker con sus dependencias ya resueltas.
 *
 * **Esto es la Fase 7 desde el lado del SW**: el archivo no busca más nada en `globalThis`.
 * Quien elige los adaptadores concretos es `plataforma/composicion.ts`, y quien los enchufa
 * acá es `entrypoints/background.js` — que llama a esta función en su top-level, no dentro de
 * un callback ni detrás de un `await`, porque MV3 exige que los listeners queden registrados
 * en el arranque sincrónico del worker.
 *
 * Lo que queda adentro es deliberadamente **cableado con `chrome.*`**: los handlers IPC, los
 * listeners que todavía no tienen puerto (`onInstalled`, `notifications.onClicked`,
 * `tabs`/`windows`) y el rearme al despertar. La lógica de descarga no vive acá desde la
 * Fase 6b (`core/cola/procesadorCola.ts`).
 *
 * @param {object} deps
 * @param {object} deps.almacenamiento  PuertoAlmacenamiento (local + sesión).
 * @param {object} deps.mensajeria      PuertoMensajeria: el receptor IPC del SW.
 * @param {object} deps.programador     PuertoProgramador: la alarma de auto-sanación.
 * @param {object} deps.sesion          `SessionState` — estado de la ráfaga activa.
 * @param {object} deps.estadosProgreso Espejo de SW_ESTADOS_PROGRESO.
 * @param {object} deps.identidad       [MULTIPORTAL D] Cómo se decide si dos ítems son la
 *                                      misma clase: por (portal, título). Es el MISMO que
 *                                      usa el bucle — si divergieran, un ítem sería dos en
 *                                      un lado y uno en el otro.
 * @param {object} deps.cola            Procesador de la cola (`core/cola/procesadorCola.ts`).
 * @param {object} deps.backend         Cliente del backend Bun (para cancelar la descarga).
 * @param {function} deps.resolverSitioDeNotificacion  De un `notificationId` al portal cuya
 *   pestaña enfocar. Devuelve `undefined` si el portal es huérfano. Reemplazó a `deps.sitio`
 *   en el corte 8: el SW ya no tiene UN sitio, tiene el del ítem que falló.
 */
export function iniciarServiceWorker({
  almacenamiento,
  mensajeria,
  programador,
  sesion,
  estadosProgreso,
  identidad,
  cola,
  backend,
  resolverSitioDeNotificacion,
}) {
  // Los helpers de progreso (SW_ESTADOS_PROGRESO) y el volcado legacy a disco (offscreen +
  // chrome.downloads) se fueron en la Fase 6b a `core/cola/estadosProgreso.ts` y
  // `plataforma/chrome/volcadoLegacy.ts`. Acá quedan estos dos alias por legibilidad.
  const persistirEstadoFondo = (estados) => estadosProgreso.persistir(estados);
  const recuperarEstadoFondo = () => estadosProgreso.recuperar();

  // Sincronizar bandera de motor y reanudar si es necesario al despertar/cargar el SW.
  // `arrancarSiNoCorre()` trae adentro la guarda que antes era `if (!loopActivo)`: es lo que
  // impide que despertar dos veces deje dos ráfagas corriendo en paralelo.
  (async () => {
    await sesion.set({ modoTurboBunActivo: true });

    const state = await sesion.get();
    if (state.rafagaCorriendo && !cola.estaActivo()) {
      console.log("🔄 [SW-ENGINE] Service Worker despertó con descarga pendiente. Reanudando...");
      cola.arrancarSiNoCorre();
    }
  })();

  chrome.runtime.onInstalled.addListener(async (_details) => {
    console.log("🔌 [SW] Extensión instalada/actualizada/recargada. Restableciendo estados de descarga...");
    await sesion.set({
      rafagaCorriendo: false,
      videoActualTitulo: "",
      videoActualSessionId: ""
    });
    await persistirEstadoFondo({});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Handlers IPC despachados por acción (dict {accion: handler} en vez de una
  // cadena de if — ver docs/patterns.md §IPC). Cada handler es async (request,
  // sendResponse); el listener los envuelve en un IIFE async + try/catch global y
  // devuelve true síncrono para mantener el canal abierto a una respuesta async.
  // El estado del bucle (`loopActivo`, el AbortController de la ráfaga) ya no vive acá: es
  // privado de `core/cola/procesadorCola.ts` y se toca por su API (`arrancarSiNoCorre`,
  // `detener`, `abortarRafaga`). El objeto se exporta para tests.
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
      const state = await sesion.get();
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
      const data = await almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
      const listaCompleta = data.listaPersistente || [];
      const colaDescargas = data.colaDescargas || [];
      // [MULTIPORTAL D] Por el espejo migrado y NO por `data.SW_ESTADOS_PROGRESO` crudo: las
      // claves anteriores a este corte son el título pelado, y compararlas contra una clave
      // (portal|título) no matchearía nunca. Es la misma trampa que el corte 3 encontró en la
      // cola — el service worker lee storage por su cuenta y se saltea la normalización.
      const estados = await recuperarEstadoFondo();

      request.items.forEach(item => {
        // [MULTIPORTAL D] La identidad es (portal, título): dos portales pueden tener una clase
        // homónima, y con el título solo encolar una habría marcado a las dos.
        estados[identidad.clave(item)] = 'process';

        // Asegurar inserción en el array desacoplado
        if (!colaDescargas.some(c => identidad.misma(c, item))) {
          colaDescargas.push(item);
        }

        // También actualizar estado en la lista persistente local
        const claseMatch = listaCompleta.find(c => identidad.misma(c, item));
        if (claseMatch) {
          claseMatch.estado = 'process';
          claseMatch.carpeta = item.carpeta;
        }
      });

      await almacenamiento.guardarLocal({
        listaPersistente: listaCompleta,
        colaDescargas: colaDescargas,
        SW_ESTADOS_PROGRESO: estados
      });
      return sendResponse({ status: "encolados_ok" });
    },

    // ─── REMOCIÓN SILENCIOSA EN COLA ──────────────────────────────────────────
    async remover_item_de_cola(request, sendResponse) {
      const data = await almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas', 'SW_ESTADOS_PROGRESO']);
      const listaCompleta = data.listaPersistente || [];
      let colaDescargas = data.colaDescargas || [];
      // [MULTIPORTAL D] Por el espejo migrado y NO por `data.SW_ESTADOS_PROGRESO` crudo: las
      // claves anteriores a este corte son el título pelado, y compararlas contra una clave
      // (portal|título) no matchearía nunca. Es la misma trampa que el corte 3 encontró en la
      // cola — el service worker lee storage por su cuenta y se saltea la normalización.
      const estados = await recuperarEstadoFondo();

      // [MULTIPORTAL D] El pedido trae el portal además del título; sin él, quitar una clase
      // de la cola se llevaría también a su homónima del otro portal.
      // [ESCANEO-API CORTE 1] Los cuatro campos. Con `{titulo, sitioId}` la clave sale sin
      // módulo, no matchea el ítem real, y la remoción no saca nada — sin error en ningún lado.
      const aQuitar = {
        titulo: request.titulo,
        sitioId: request.sitioId,
        modulo: request.modulo,
        tipo: request.tipo,
      };
      colaDescargas = colaDescargas.filter(c => !identidad.misma(c, aQuitar));
      delete estados[identidad.clave(aQuitar)];

      const match = listaCompleta.find(c => identidad.misma(c, aQuitar));
      if (match) {
        match.estado = 'pending';
      }

      await almacenamiento.guardarLocal({
        listaPersistente: listaCompleta,
        colaDescargas: colaDescargas,
        SW_ESTADOS_PROGRESO: estados
      });
      return sendResponse({ status: "removido_ok" });
    },

    // ─── INICIO DE COLA ────────────────────────────────────────────────────────
    async iniciar_descarga_cola(request, sendResponse) {
      const state = await sesion.get();
      if (!state.rafagaCorriendo) {
        await sesion.set({
          rafagaCorriendo: true,
          frenadoSuaveSolicitado: false,
          modoTurboBunActivo: true,
          colaPausadaPorError: false,
          tipoDeErrorConexion: "",
          abortadoPorUsuario: false
        });

        programador.cancelar(ALARMA_AUTOHEAL);
        cola.arrancarSiNoCorre();
      }
      return sendResponse({ status: "rafaga_iniciada" });
    },

    // ─── FRENADO SUAVE ────────────────────────────────────────────────────────
    async activar_frenado_suave(request, sendResponse) {
      await sesion.set({ frenadoSuaveSolicitado: true });
      return sendResponse({ status: "freno_suave_recibido" });
    },

    // ─── ABORT INMEDIATO ──────────────────────────────────────────────────────
    async abortar_rafaga_inmediata(request, sendResponse) {
      const state = await sesion.get();
      const titulo = state.videoActualTitulo;
      const sessionId = state.videoActualSessionId || "";
      const sitioId = state.videoActualSitioId || "";

      await sesion.set({
        rafagaCorriendo: false,
        frenadoSuaveSolicitado: false,
        videoActualTitulo: "",
        videoActualSessionId: "",
        videoActualSitioId: "",
        colaPausadaPorError: false,
        tipoDeErrorConexion: "",
        abortadoPorUsuario: true
      });
      cola.abortarRafaga();
      programador.cancelar(ALARMA_AUTOHEAL);

      if (titulo) {
        // [MULTIPORTAL E] Con el portal: sin él, el backend podría borrar el `.part` de la
        // clase homónima del otro portal, que quizás está a medio bajar.
        await backend.cancelarDescarga(titulo, sessionId, sitioId);
      }

      // También resetear las clases en la cola a pending
      const data = await almacenamiento.obtenerLocal(['listaPersistente', 'colaDescargas']);
      const listaCompleta = data.listaPersistente || [];
      const colaDescargas = data.colaDescargas || [];

      colaDescargas.forEach(item => {
        const match = listaCompleta.find(c => c.titulo === item.titulo);
        if (match) match.estado = 'pending';
      });

      // Escritura atómica: el abort limpia el progreso (SW_ESTADOS_PROGRESO: {}) y
      // resetea las clases de la cola a 'pending' en un solo .set(), sin ventana
      // intermedia donde el progreso ya esté vacío pero la lista aún no reseteada.
      await almacenamiento.guardarLocal({
        listaPersistente: listaCompleta,
        colaDescargas: colaDescargas,
        SW_ESTADOS_PROGRESO: {}
      });

      return sendResponse({ status: "abortado_ok" });
    },

    // ─── LIMPIEZA DE ESTADOS ──────────────────────────────────────────────────
    async limpiar_estados_progreso(request, sendResponse) {
      await sesion.set({
        rafagaCorriendo: false,
        frenadoSuaveSolicitado: false,
        videoActualTitulo: "",
        colaPausadaPorError: false,
        tipoDeErrorConexion: ""
      });
      cola.detener();
      programador.cancelar(ALARMA_AUTOHEAL);
      await persistirEstadoFondo({});
      await almacenamiento.guardarLocal({ colaDescargas: [] });
      return sendResponse({ status: "limpio_ok" });
    }
  };

  // Listener principal síncrono para mantener canal IPC.
  // Va por el PuertoMensajeria (Fase 5c). La forma se conserva tal cual, incluido el contrato
  // del `true`/`false` de retorno: el puerto lo respeta a propósito porque es lo que mantiene
  // abierto el canal para una respuesta asíncrona, y cambiarlo acá habría sido rediseñar el
  // despacho en el mismo corte que la migración.
  mensajeria.onMensaje((request, responder) => {
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

  // ============================================================================
  // El BUCLE DE DESCARGA vive en `core/cola/procesadorCola.ts` desde la Fase 6b: el FIFO, la
  // clasificación de los cuatro tipos de fallo, la pausa, el freno suave y la auto-sanación.
  // Con él se fueron `loopActivo` y `controladorGraficoActivo`, que eran variables de módulo
  // compartidas entre el bucle y los handlers IPC — ahora son estado privado del procesador y
  // se tocan por su API. Acá queda sólo el cableado con `chrome.*`.
  // ============================================================================

  // La alarma de auto-sanación despierta al SW; el procesador decide qué hacer con el disparo.
  programador.onDisparo(async (nombre) => {
    if (nombre === ALARMA_AUTOHEAL) {
      await cola.alDispararAutoheal();
    }
  });

  // Click en la notificación nativa de fallo → enfocar la pestaña DEL PORTAL QUE FALLÓ (o
  // abrirla si no hay ninguna). Da un follow-up accionable: el usuario revisa/reintenta la
  // clase. La guarda evita que un chrome.notifications ausente tire durante la evaluación del
  // SW (rompería la carga entera del service worker).
  //
  // [MULTISITIO CORTE 8] Cuál es ese portal sale del `notificationId`, que lo lleva adentro
  // desde que se creó la notificación. Antes salía del sitio asumido, y con la cola mezclada
  // eso abría el portal equivocado — el mismo defecto que el corte 4 arregló en el filtro.
  // El SW no tiene pestaña de la cual deducirlo: por eso el dato viaja con el aviso.
  if (typeof chrome !== "undefined" && chrome.notifications && chrome.notifications.onClicked) {
    chrome.notifications.onClicked.addListener(async (notificationId) => {
      chrome.notifications.clear(notificationId);
      try {
        const sitioDelFallo = resolverSitioDeNotificacion(notificationId);
        if (!sitioDelFallo) {
          // Huérfano: el portal del ítem ya no está registrado. No hay a dónde llevar al
          // usuario, y abrir cualquier otro sería justamente el bug. Se limpia y se avisa.
          console.warn(`[SW] Notificación de un portal no registrado (${notificationId}): no hay pestaña que enfocar.`);
          return;
        }
        const [tab] = await chrome.tabs.query({ url: sitioDelFallo.patronPestañas });
        if (tab) {
          await chrome.tabs.update(tab.id, { active: true });
          await chrome.windows.update(tab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: sitioDelFallo.urlSondeoInternet });
        }
      } catch (e) {
        console.warn(`[SW] No se pudo enfocar/abrir la pestaña del portal:`, e);
      }
    });
  }}
