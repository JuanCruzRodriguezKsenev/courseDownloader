/**
 * ISLA PREACT #1 — el puntito de estado del header (V1.0.0)
 * ==========================================================================
 * Primera "isla" de la migración incremental del popup a Preact (ver
 * docs/adr/0006-adopt-preact-islands-in-popup.md). Preact convive con el resto
 * vanilla: esta isla es DUEÑA exclusiva del indicador de conexión (#preact-status-dot)
 * y lo deriva del daemon Conexion (shared/conexion.js). Ya nadie lo pinta a mano.
 *
 * Antes, el statusDot se pintaba imperativamente desde 6 lugares (popup.js x2,
 * serverConnection.js x4). Con esto es un derivado puro del estado: cambia la
 * conexión → el puntito se re-deriva solo. Imposible desincronizar.
 *
 * Se carga como <script type="module"> DESPUÉS de los scripts clásicos, así que
 * window.Conexion (shared/conexion.js) ya existe. El daemon lo arranca popup.js
 * (iniciarDetectorEstado); esta isla sólo se SUSCRIBE y renderiza.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

// Hook puente: re-renderiza cuando el daemon Conexion notifica un cambio.
// (El equivalente de useSyncExternalStore para nuestra fuente de verdad.)
export function useConexion() {
  const [, forzar] = useState(0);
  useEffect(() => window.Conexion.suscribir(() => forzar(n => n + 1)), []);
  return window.Conexion.get();
}

export function StatusDot() {
  const c = useConexion();
  const ok = c.completa;
  return html`<div
    class="status-dot ${ok ? 'online' : 'offline'}"
    title=${ok ? 'Conectado' : (!c.servidor ? 'Servidor desconectado' : 'Sin conexión a internet')}
  ></div>`;
}

export function montar(root) {
  if (root && typeof window !== 'undefined' && window.Conexion) {
    render(html`<${StatusDot} />`, root);
  }
}

// Auto-montaje en el popup real (no corre en los tests, que importan los componentes).
if (typeof document !== 'undefined') {
  montar(document.getElementById('preact-status-dot'));
}
