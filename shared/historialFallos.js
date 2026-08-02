/**
 * CLON DOWNLOADHELPER - HISTORIAL DE FALLOS DE COLA (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [NUEVO] Módulo fuente de verdad del historial de fallos terminales de la
 *   cola de descarga (rechazo 4xx / sesión / servidor / internet). Respaldo en
 *   chrome.storage.local (clave `historialFallos`), acotado a los últimos 50,
 *   más-reciente-primero. Lo escribe el SW vía background.js `registrarFallo`
 *   (que además dispara la notificación nativa) y lo lee/muta el popup desde la
 *   isla Preact de la campanita (marcar leídas / limpiar). Ver
 *   docs/notificaciones-fallos-diseno.md, docs/data-model.md.
 * ==========================================================================
 * Se carga tanto en el popup (window, vía <script>) como en el SW (self, vía
 * importScripts). No depende de ningún otro global del proyecto.
 *
 * A diferencia del daemon `Conexion`, NO mantiene un espejo del estado en
 * memoria: el storage es la única fuente. `suscribir(cb)` sólo avisa "algo
 * cambió"; el suscriptor vuelve a pedir `obtener()`. El listener de
 * chrome.storage.onChanged se engancha lazy, en el primer `suscribir()`, para
 * que el SW —que sólo escribe— no registre un oyente muerto.
 *
 * Nota de concurrencia (aceptada): `registrar` (SW) y `marcarTodosLeidos`/
 * `limpiar` (popup) hacen read-modify-write sobre la misma clave desde
 * contextos distintos; una colisión exacta podría perder una escritura. Es el
 * mismo trade-off que el resto de chrome.storage.local (sin transacciones); la
 * ventana es de ms y el dato es un historial informativo. Ver data-model.md.
 * ==========================================================================
 */

const HistorialFallos = {
  CLAVE_STORAGE: "historialFallos",
  LIMITE: 50,

  _subs: new Set(),
  _oyenteEnganchado: false,

  // -------- Lectura --------
  async obtener() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return [];
    const data = await chrome.storage.local.get([this.CLAVE_STORAGE]);
    return data[this.CLAVE_STORAGE] || [];
  },

  async contarNoLeidos() {
    return (await this.obtener()).filter(f => !f.leido).length;
  },

  // -------- Escritura --------
  async registrar(tipo, titulo, motivo) {
    const entrada = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tipo,
      titulo: titulo || "",
      motivo: motivo || "",
      ts: Date.now(),
      leido: false
    };
    const lista = await this.obtener();
    // Más reciente primero, acotado a LIMITE (los más viejos se descartan).
    const nueva = [entrada, ...lista].slice(0, this.LIMITE);
    await this._guardar(nueva);
    return entrada;
  },

  async marcarTodosLeidos() {
    const lista = await this.obtener();
    await this._guardar(lista.map(f => ({ ...f, leido: true })));
  },

  async limpiar() {
    await this._guardar([]);
  },

  async _guardar(lista) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    await chrome.storage.local.set({ [this.CLAVE_STORAGE]: lista });
  },

  // -------- Suscripción (push, vía storage.onChanged) --------
  // El suscriptor recibe una señal sin payload y vuelve a pedir obtener().
  suscribir(cb) {
    this._engancharOyente();
    this._subs.add(cb);
    return () => this._subs.delete(cb);
  },

  _engancharOyente() {
    if (this._oyenteEnganchado) return;
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((cambios, area) => {
      if (area !== "local") return;
      if (!cambios[this.CLAVE_STORAGE]) return;
      this._notificar();
    });
    this._oyenteEnganchado = true;
  },

  _notificar() {
    this._subs.forEach(cb => {
      try { cb(); } catch (e) { console.warn("[HistorialFallos] Error en suscriptor:", e); }
    });
  }
};

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.HistorialFallos = HistorialFallos;
export default HistorialFallos;
