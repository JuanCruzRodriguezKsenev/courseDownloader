/**
 * CLON DOWNLOADHELPER - MAQUINARIA DE ESTADO CENTRAL (V5.2.1)
 * CENTRALIZA MUTACIONES, PERSISTENCIA EN STORAGE E IPC DE FORMA DESACOPLADA
 * ==============================================================================================
 * CHANGELOG v5.2.1:
 * - [FIX] inicializarSincronizacionStorage normaliza un estado 'error' heredado de storage
 *   viejo (fix bug 400 previo, ya revertido) a 'pending' al cargar, para que esas clases
 *   sean re-encolables y se rendericen bien. Ver background.js v5.10.1, docs/notificaciones-fallos-diseno.md.
 * CHANGELOG v5.2.0:
 * - [FIX] limpiarSesionLocal: ahora resetea listadoClasesGlobal y ráfagaEnCurso en memoria.
 *   Antes solo limpiaba el storage, dejando el estado en memoria inconsistente si el popup
 *   permanecía abierto tras cancelar una descarga.
 * ==============================================================================================
 */

const AppState = {
  listadoClasesGlobal: [],
  colaDescargas: [], // 🚀 Cola desacoplada
  ráfagaEnCurso: false,
  banderaFrenadoSolicitado: false,
  pestañaActiva: "disponibles",
  sincronizacionDiscoCompletada: false,
  catedraSeleccionada: null,
  videoActualEnTransmisiónSW: "",
  modoTurboBun: true, // Forzado a true (Modo Turbo único activo)
  ocultarAdvertenciaExplorar: false,
  ocultarAdvertenciaAula: false,
  ordenAscendente: true,
  tutorialCompletado: false,

  async inicializarSincronizacionStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'listaPersistente', 
        'colaDescargas', 
        'faseDiscoOk', 
        'catedraElegida', 
        'ocultarAdvExplorar', 
        'ocultarAdvAula',
        'ordenAscendente',
        'tutorialCompletado'
      ], (data) => {
        // Normalización defensiva: un estado 'error' heredado de storage viejo (el fix del
        // bug 400 lo usó al principio, ya revertido a 'pending') no lo reconoce el resto del
        // popup — se lo trata como 'pending' para que sea re-encolable y se renderice bien.
        // Ver docs/notificaciones-fallos-diseno.md.
        this.listadoClasesGlobal = (data.listaPersistente || []).map(
          c => (c && c.estado === 'error') ? { ...c, estado: 'pending' } : c
        );
        this.colaDescargas = data.colaDescargas || [];
        this.sincronizacionDiscoCompletada = data.faseDiscoOk || false;
        this.catedraSeleccionada = data.catedraElegida || null;
        this.ocultarAdvertenciaExplorar = data.ocultarAdvExplorar || false;
        this.ocultarAdvertenciaAula = data.ocultarAdvAula || false;
        this.ordenAscendente = data.ordenAscendente !== undefined ? data.ordenAscendente : true;
        this.tutorialCompletado = data.tutorialCompletado || false;
        this.modoTurboBun = true;
        resolve();
      });
    });
  },

  respaldar() {
    chrome.storage.local.set(
      { 
        listaPersistente: this.listadoClasesGlobal, 
        colaDescargas: this.colaDescargas,
        faseDiscoOk: this.sincronizacionDiscoCompletada,
        catedraElegida: this.catedraSeleccionada,
        ocultarAdvExplorar: this.ocultarAdvertenciaExplorar,
        ocultarAdvAula: this.ocultarAdvertenciaAula,
        ordenAscendente: this.ordenAscendente,
        tutorialCompletado: this.tutorialCompletado
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('[AppState] Error al persistir estado:', chrome.runtime.lastError.message);
        }
      }
    );
  },

  async sincronizarConBackground() {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.warn('[AppState] SW no respondió (Timeout de rescate).');
        resolve({ estados: {}, porcentaje: 0, telemetry: null });
      }, 3000);

      chrome.runtime.sendMessage({ action: "obtener_estados_en_progreso" }, (respuestaFondo) => {
        clearTimeout(timer);

        if (chrome.runtime.lastError || !respuestaFondo) {
          console.warn('[AppState] Canal IPC inactivo o SW dormido.');
          resolve({ estados: {}, porcentaje: 0, telemetry: null });
          return;
        }

        try {
          const estadosEnFondo = respuestaFondo.estados || {};
          this.ráfagaEnCurso = Object.values(estadosEnFondo).some(est => est === 'process');
          this.banderaFrenadoSolicitado = respuestaFondo.suaveFrenado || false;
          this.videoActualEnTransmisiónSW = respuestaFondo.videoActual || "";

          // ⚡ [SANEAMIENTO ANTI-CONGELAMIENTO]: Bucle de alta velocidad optimizado.
          // En lugar de iteraciones pesadas acopladas, validamos la existencia del array de forma atómica.
          if (Array.isArray(this.listadoClasesGlobal) && this.listadoClasesGlobal.length > 0) {
            const total = this.listadoClasesGlobal.length;
            for (let i = 0; i < total; i++) {
              const clase = this.listadoClasesGlobal[i];
              if (clase && clase.titulo && estadosEnFondo[clase.titulo] !== undefined) {
                clase.estado = estadosEnFondo[clase.titulo];
              }
            }
          }
        } catch (err) {
          console.error("[AppState] Error procesando respuesta de fondo:", err);
        }

        resolve(respuestaFondo);
      });
    });
  },

  conmutarSeleccionMasiva(marcarTodos, clasesVisibles) {
    clasesVisibles.forEach(clase => {
      if (clase.estado === 'pending') {
        clase.seleccionado = marcarTodos;
      }
    });
    this.respaldar();
  },

  establecerModoTurbo(activado) {
    this.modoTurboBun = true;
  },

  limpiarSesionLocal() {
    this.listadoClasesGlobal = [];
    this.colaDescargas = [];
    this.ráfagaEnCurso = false;
    this.banderaFrenadoSolicitado = false;
    this.sincronizacionDiscoCompletada = false;
    // Conservamos la cátedra seleccionada para evitar que la UI la vuelva a solicitar al re-escanear tras terminar
    this.videoActualEnTransmisiónSW = "";
    this.modoTurboBun = true;
    chrome.storage.local.remove(['listaPersistente', 'colaDescargas', 'faseDiscoOk'], () => {
      if (chrome.runtime.lastError) {
        console.warn('[AppState] Error al limpiar storage:', chrome.runtime.lastError.message);
      }
    });
  },
};

window.AppState = AppState;