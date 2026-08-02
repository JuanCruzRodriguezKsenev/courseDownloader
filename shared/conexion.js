/**
 * CLON DOWNLOADHELPER - DAEMON DE ESTADO DE CONEXIÓN (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [CAPA 2] URL_SONDEO_INTERNET pasó de constante hardcodeada a getter que lee
 *   `SitioActivo.urlSondeoInternet` (sitio/ramonnet/config.js), con fallback al valor
 *   de siempre para los tests que cargan este módulo aislado. El daemon queda genérico:
 *   a qué portal sondear lo decide el adaptador de sitio. Ver ADR-0008.
 * CHANGELOG v1.0.2:
 * - [OBS] Log en cada transición de estado de conexión (edge-triggered, bajo ruido)
 *   para depurar caídas/recuperaciones tanto en el popup como en el SW.
 * CHANGELOG v1.0.1:
 * - [FIX] _chequearServidor pasa un timeout (2500ms < INTERVALO_SONDEO_MS) a
 *   BunClient.obtenerRutaServidor. Antes, con el server colgado (no apagado
 *   limpio), el chequeo sin timeout congelaba verificarAhora() y el estado
 *   quedaba pegado en "conectado". Ver bunClient.js v1.1.0.
 * ==========================================================================
 * Fuente ÚNICA de verdad del estado de conexión de la extensión. Modelo push,
 * no pull: un solo subproceso (poller) mantiene una variable de estado siempre
 * fresca; el resto del código sólo la LEE (Conexion.get()) o se SUSCRIBE a sus
 * cambios (Conexion.suscribir(cb)). Nadie más dispara chequeos de conexión.
 *
 * Dos conexiones independientes se rastrean por separado:
 *   - servidor: el backend Bun local (http://localhost:3001) — vía /api/health.
 *   - internet: salida a plataforma.ramonnet.com.ar — navigator.onLine (señal
 *     push del browser vía eventos online/offline) confirmada con un HEAD real
 *     (navigator.onLine da falsos positivos en LAN sin salida a internet).
 *
 * Manifest V3 no tiene un proceso eterno: este daemon corre mientras su contexto
 * (popup o service worker) está vivo. El estado se espeja en chrome.storage.session
 * y cada contexto escucha chrome.storage.onChanged, así popup y SW convergen en un
 * único valor y, al despertar, arrancan desde el último estado conocido.
 *
 * Se carga tanto en el popup (window) como en el SW (self, vía importScripts).
 * Depende del global BunClient (shared/bunClient.js).
 * ==========================================================================
 */

const Conexion = {
  CLAVE_STORAGE: "estadoConexion",
  // La sonda de internet apunta al portal objetivo, no a un host genérico: lo que
  // importa no es tener red sino poder llegar AL SITIO. Por eso la URL la declara el
  // adaptador de sitio (Capa 2, ADR-0008) y no este daemon, que es genérico. El
  // fallback existe sólo para los tests, que cargan este módulo aislado.
  get URL_SONDEO_INTERNET() {
    return (typeof SitioActivo !== "undefined" && SitioActivo.urlSondeoInternet)
      || "https://plataforma.ramonnet.com.ar";
  },
  INTERVALO_SONDEO_MS: 3000,
  TIMEOUT_HEAD_MS: 4000,

  // Estado interno (la "variable global" siempre fresca). `listo` es false hasta
  // el primer sondeo, para que los consumidores no traten "desconocido" como offline.
  _estado: { servidor: false, internet: false, listo: false },
  _subs: new Set(),
  _timer: null,
  _oyentesRed: null,

  // -------- Lectura pura (sin I/O) --------
  get() {
    const { servidor, internet, listo } = this._estado;
    return {
      servidor,
      internet,
      listo,
      completa: servidor && internet,
      // Prioridad: el servidor caído bloquea toda descarga (los fragmentos se
      // vuelcan al Bun), así que gana sobre internet cuando ambos están mal.
      tipoFalla: !servidor ? "servidor" : (!internet ? "internet" : null)
    };
  },
  hayServidor() { return this._estado.servidor; },
  hayInternet() { return this._estado.internet; },
  hayConexionCompleta() { return this._estado.servidor && this._estado.internet; },

  // -------- Suscripción (push / "websocket") --------
  suscribir(cb) {
    this._subs.add(cb);
    return () => this._subs.delete(cb);
  },
  _notificar() {
    const snap = this.get();
    this._subs.forEach(cb => {
      try { cb(snap); } catch (e) { console.warn("[Conexion] Error en suscriptor:", e); }
    });
  },

  // -------- Primitivos de chequeo (los ÚNICOS del proyecto) --------
  async _chequearServidor() {
    // Timeout < INTERVALO_SONDEO_MS para que cada sondeo cierre antes del siguiente
    // (si el server está colgado, el abort corta y marcamos servidor=false sin apilar).
    try { return !!(await BunClient.obtenerRutaServidor({ timeoutMs: 2500 })); }
    catch (e) { return false; }
  },
  async _chequearInternet() {
    // El browser ya sabe que no hay red: cortamos sin pegarle a la red.
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_HEAD_MS);
    try {
      await fetch(this.URL_SONDEO_INTERNET, {
        method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      clearTimeout(timeoutId);
      return false;
    }
  },

  // -------- Ciclo de verificación (el "latido" del subproceso) --------
  async verificarAhora() {
    const [servidor, internet] = await Promise.all([
      this._chequearServidor(),
      this._chequearInternet()
    ]);
    this._aplicar({ servidor, internet, listo: true }, true);
    return this.get();
  },

  // Aplica un estado nuevo; sólo notifica/espeja si algo cambió (edge-triggered).
  _aplicar(nuevo, espejar) {
    const cambio =
      nuevo.servidor !== this._estado.servidor ||
      nuevo.internet !== this._estado.internet ||
      nuevo.listo !== this._estado.listo;
    this._estado = { ...this._estado, ...nuevo };
    if (cambio) {
      console.log(`🔌 [Conexion] estado → servidor=${this._estado.servidor} internet=${this._estado.internet} (espejar=${!!espejar})`);
      this._notificar();
      if (espejar) this._escribirEnStorage();
    }
  },

  // -------- Espejado cross-contexto (popup <-> SW) --------
  _escribirEnStorage() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.session) return;
      chrome.storage.session.set({
        [this.CLAVE_STORAGE]: {
          servidor: this._estado.servidor,
          internet: this._estado.internet,
          ts: Date.now()
        }
      });
    } catch (e) { /* storage.session no disponible en este contexto */ }
  },
  _escucharStorage() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((cambios, area) => {
      if (area !== "session") return;
      const c = cambios[this.CLAVE_STORAGE];
      if (!c || !c.newValue) return;
      // Aplicar SIN re-espejar para no generar un loop de escrituras entre contextos.
      this._aplicar(
        { servidor: c.newValue.servidor, internet: c.newValue.internet, listo: true },
        false
      );
    });
  },

  // Reacción instantánea a los eventos push del browser (sin esperar al poller).
  _engancharEventosDeRed() {
    if (this._oyentesRed) return;
    const alCambiar = () => { this.verificarAhora(); };
    const objetivo = (typeof self !== "undefined") ? self : (typeof window !== "undefined" ? window : null);
    if (!objetivo || !objetivo.addEventListener) return;
    objetivo.addEventListener("online", alCambiar);
    objetivo.addEventListener("offline", alCambiar);
    this._oyentesRed = { objetivo, alCambiar };
  },

  // -------- Arranque / parada del subproceso --------
  // Para el popup: poller con setInterval. Para el SW, ver verificarAhora() desde
  // el handler de chrome.alarms (setInterval no sobrevive la suspensión del SW).
  iniciar({ intervaloMs = this.INTERVALO_SONDEO_MS } = {}) {
    this._escucharStorage();
    this._engancharEventosDeRed();
    this.verificarAhora();
    if (!this._timer) {
      this._timer = setInterval(() => this.verificarAhora(), intervaloMs);
    }
  },
  detener() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._oyentesRed) {
      const { objetivo, alCambiar } = this._oyentesRed;
      objetivo.removeEventListener("online", alCambiar);
      objetivo.removeEventListener("offline", alCambiar);
      this._oyentesRed = null;
    }
  }
};

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.Conexion = Conexion;
export default Conexion;
