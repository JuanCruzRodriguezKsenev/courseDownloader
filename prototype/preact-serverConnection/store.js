/**
 * STORE REACTIVO MÍNIMO (demo Preact) — ~40 líneas, cero dependencias.
 * ==========================================================================
 * Es el equivalente conceptual de lo que en la extensión real son DOS cosas:
 *   - el daemon de conexión  (shared/conexion.js)  → { servidor, internet }
 *   - la parte de descarga de AppState             → { rafagaEnCurso, fallaConexion... }
 *
 * La idea clave: acá hay UNA fuente de verdad (`estado`) y la UI se deriva de ella.
 * Nadie toca el DOM: cuando algo cambia, `set()` notifica y los componentes de
 * Preact se re-renderizan solos. Comparalo con popup.js, donde después de mutar
 * AppState tenías que acordarte de llamar renderizarListadoInterfaz() a mano (y
 * cuando te lo olvidabas → el bug del banner que no se iba).
 * ==========================================================================
 */

const estado = {
  // --- Conexión (fuente única, como Conexion._estado) ---
  servidor: true,
  internet: true,
  // --- Disco / carpeta raíz (como la ruta que devuelve /api/health) ---
  rutaDisco: 'D:/Clases/RamonNet',
  // --- Descarga (como AppState) ---
  rafagaEnCurso: false,
  fallaConexion: null,     // null | 'servidor' | 'internet'  (≈ AppState.fallaConexionActiva)
  videoActual: 'SEM 03-14 - ALGEBRA A - CLASE 2 - PARTE 1',
  progreso: 0,
};

const subs = new Set();

export function get() { return estado; }

export function set(parcial) {
  Object.assign(estado, parcial);
  subs.forEach(cb => cb());   // ← notifica: la UI se re-deriva sola (esto es lo que en vanilla te olvidabas)
}

export function subscribe(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

// --- Selectores (derivados) — como Conexion.get() { completa, tipoFalla } ---
export const sel = {
  completa: () => estado.servidor && estado.internet,
  statusDot: () => (estado.servidor && estado.internet) ? 'online' : 'offline',
};

/* ==========================================================================
 * ACCIONES que imitan el flujo real (SW + autoheal), sólo para el demo.
 * En la extensión real esta lógica vive repartida entre background.js
 * (pausarColaPorErrorDeConexion / reanudarColaDesdeBackground) y el popup.
 * ========================================================================== */

let timerPausa = null;
let timerProgreso = null;

export function iniciarDescarga() {
  set({ rafagaEnCurso: true, fallaConexion: null, progreso: 0 });
  clearInterval(timerProgreso);
  timerProgreso = setInterval(() => {
    const e = get();
    if (e.rafagaEnCurso && !e.fallaConexion && e.progreso < 100) set({ progreso: e.progreso + 4 });
    else if (e.progreso >= 100) { clearInterval(timerProgreso); set({ rafagaEnCurso: false }); }
  }, 300);
}

export function caeServidor() {
  set({ servidor: false });
  // Si hay descarga, el SW tarda en detectarlo (timeout del streaming) y recién ahí
  // pausa la cola. Simulamos ese delay antes de marcar la falla (que dispara el banner).
  if (get().rafagaEnCurso) {
    clearTimeout(timerPausa);
    timerPausa = setTimeout(() => set({ fallaConexion: 'servidor' }), 1200);
  }
}

export function vuelveServidor() {
  set({ servidor: true });
  clearTimeout(timerPausa);
  // Autoheal: si la cola estaba pausada por el servidor, reanuda y limpia la falla.
  // En Preact, poner fallaConexion=null hace que el banner desaparezca SOLO.
  if (get().fallaConexion === 'servidor') {
    set({ fallaConexion: null });
    if (get().progreso < 100) iniciarDescarga(); // reanuda
  }
}

export function caeInternet() {
  set({ internet: false });
  if (get().rafagaEnCurso) {
    clearTimeout(timerPausa);
    timerPausa = setTimeout(() => set({ fallaConexion: 'internet' }), 1200);
  }
}

export function vuelveInternet() {
  set({ internet: true });
  clearTimeout(timerPausa);
  if (get().fallaConexion === 'internet') {
    set({ fallaConexion: null });
    if (get().progreso < 100) iniciarDescarga();
  }
}

export function reset() {
  clearTimeout(timerPausa); clearInterval(timerProgreso);
  set({ servidor: true, internet: true, rafagaEnCurso: false, fallaConexion: null, progreso: 0 });
}
