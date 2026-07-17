/**
 * ISLA PREACT #2 — el banner de conexión caída (V1.0.0)
 * ==========================================================================
 * Isla de la migración incremental del popup a Preact (ver ADR-0006,
 * docs/preact-migration.md). Es DUEÑA exclusiva del banner de "conexión caída"
 * (la .server-error-card), que se muestra cuando el servidor Bun o internet se
 * caen de forma pasiva (sin una descarga en curso que ya maneje su propio aviso).
 *
 * Caso delicado de la migración: el banner ANTES se renderizaba DENTRO de #ui-list,
 * el mismo nodo que la lista de clases (dos dueños pisándose por innerHTML). La
 * regla de oro prohíbe compartir DOM, así que el banner tiene su propio root
 * hermano (#preact-banner) y la lista (#ui-list) se OCULTA desde el vanilla mientras
 * el banner está visible (serverConnection togglea su display). La lista completa se
 * migrará después (isla #4); hasta entonces convive como nodo vanilla contiguo.
 *
 * Estado de visibilidad = lógica de negocio (ráfaga en curso, cola pausada, tipo de
 * caída), decidida por serverConnection.reaccionarAConexion. Por eso la isla NO
 * deriva de Conexion directamente: usa un store-puente window.BannerConexion
 * (mostrar(tipo) / ocultar() / get()), como el onboarding. El `tipo` ("servidor" |
 * "internet") elige el contenido del mapa TARJETAS_OFFLINE (dueño acá).
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

// Contenido de la tarjeta según el tipo de conexión caída. Sólo lo que se pinta en
// la card; el texto de estado del footer y el botón siguen en serverConnection.js.
const TARJETAS_OFFLINE = {
  servidor: {
    icono: '🔌',
    titulo: 'Servidor Desconectado',
    cuerpo: 'Por favor, iniciá el servidor ejecutando <strong>iniciar.bat</strong> en tu PC.<br>La extensión se sincronizará sola apenas esté encendido.',
    pulso: 'Esperando conexión en puerto 3001...',
  },
  internet: {
    icono: '🌐',
    titulo: 'Sin conexión a internet',
    cuerpo: 'Revisá tu conexión a la red.<br>La extensión se reconectará y sincronizará sola apenas vuelva internet.',
    pulso: 'Esperando conexión a internet...',
  },
};

const _store = {
  estado: { visible: false, tipo: null },
  _subs: new Set(),
  _emit() { this._subs.forEach((cb) => cb()); },
  suscribir(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  get() { return this.estado; },
  mostrar(tipo = 'servidor') {
    this.estado = { visible: true, tipo };
    this._emit();
  },
  ocultar() {
    if (!this.estado.visible) return;
    this.estado = { visible: false, tipo: null };
    this._emit();
  },
};

function useBanner() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store.get();
}

export function BannerConexion() {
  const { visible, tipo } = useBanner();
  if (!visible) return null;
  const info = TARJETAS_OFFLINE[tipo] || TARJETAS_OFFLINE.servidor;
  return html`
    <div class="server-error-card" data-tipo=${tipo}>
      <div class="server-error-icon">${info.icono}</div>
      <h5>${info.titulo}</h5>
      <p dangerouslySetInnerHTML=${{ __html: info.cuerpo }}></p>
      <div class="server-error-pulse">
        <span class="pulse-dot"></span>
        <span>${info.pulso}</span>
      </div>
    </div>`;
}

export function montar(root) {
  if (root) render(html`<${BannerConexion} />`, root);
}

// Sólo para tests: reinicia el store (estado + suscriptores) entre casos.
export function __resetStore() {
  _store.estado = { visible: false, tipo: null };
  _store._subs.clear();
}

// Store global para que el vanilla (serverConnection.js) lo empuje.
if (typeof window !== 'undefined') window.BannerConexion = _store;

// Auto-montaje en el popup real (no corre en los tests, que importan los componentes).
if (typeof document !== 'undefined') {
  montar(document.getElementById('preact-banner'));
}
