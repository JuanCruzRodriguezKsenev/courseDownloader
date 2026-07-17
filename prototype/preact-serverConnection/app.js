/**
 * FEATURE "serverConnection" EN PREACT (demo, sin build) — el contraste directo
 * con popup/features/serverConnection.js (vanilla).
 * ==========================================================================
 * Fijate la diferencia de fondo: acá NO hay una sola llamada a .innerHTML,
 * .textContent, .style ni .className. Cada componente DESCRIBE cómo se ve para
 * un estado dado, y Preact toca el DOM por vos. El banner es literalmente
 * `s.fallaConexion ? <Banner/> : null`: cuando la falla vuelve a null, Preact
 * lo quita del DOM solo. Es imposible el bug de "cambié el estado pero la
 * pantalla quedó vieja".
 * ==========================================================================
 */
import { html, render, useState, useEffect } from './vendor/htm-preact-standalone.module.js';
import * as store from './store.js';

// --- Hook puente: suscribe el componente al store y lo re-renderiza en cada cambio.
// En la extensión real, este hook envolvería Conexion.suscribir() y/o
// chrome.storage.onChanged — el resto del código no se enteraría.
function useStore() {
  const [, forzar] = useState(0);
  useEffect(() => store.subscribe(() => forzar(n => n + 1)), []);
  return store.get();
}

const TARJETAS = {
  servidor: {
    icono: '🔌', titulo: 'Servidor Desconectado',
    cuerpo: 'Iniciá el servidor con iniciar.bat. Se sincroniza solo al encender.',
    pulso: 'Esperando conexión en puerto 3001...',
  },
  internet: {
    icono: '🌐', titulo: 'Sin conexión a internet',
    cuerpo: 'Revisá tu red. Se reconecta y sincroniza solo al volver internet.',
    pulso: 'Esperando conexión a internet...',
  },
};

// --- Puntito de estado: derivado puro de la conexión. Refleja SIEMPRE la realidad. ---
function StatusDot() {
  useStore();
  const ok = store.sel.completa();
  return html`<span
    class="dot ${ok ? 'online' : 'offline'}"
    title=${ok ? 'Conectado' : (!store.get().servidor ? 'Servidor desconectado' : 'Sin internet')}
  ></span>`;
}

// --- Header real: logo + marca + ayuda + puntito. Réplica de <header class="header"> ---
function Header() {
  return html`
    <header class="header">
      <div class="header-left">
        <img src="./icon48.png" alt="Logo" width="20" height="20" />
        <h4>RamonNet Downloader</h4>
      </div>
      <div class="header-right">
        <button class="btn-help" title="Ver guía de uso y ayuda">❓</button>
        <${StatusDot} />
      </div>
    </header>`;
}

// --- Barra de ruta: el path del disco. Reactivo: si cae el server, muestra "Desconectado". ---
function PathBar() {
  const s = useStore();
  const conectado = s.servidor;
  return html`
    <section class="path-bar ${conectado ? '' : 'offline'}">
      <div class="meta-row">
        <span class="meta-label">📁 PC:</span>
        <span class="pc-path" title=${conectado ? s.rutaDisco : 'Servidor desconectado'}>
          ${conectado ? s.rutaDisco : 'Desconectado'}
        </span>
        <button class="btn-explore" disabled=${!conectado}>📂 Explorar</button>
      </div>
    </section>`;
}

// --- Banner: EXISTE sólo si hay falla. null => Preact no lo pinta (y lo quita al limpiar). ---
function ConnectionBanner() {
  const s = useStore();
  if (!s.fallaConexion) return null;         // ← la línea que en vanilla era "acordate de re-renderizar"
  const info = TARJETAS[s.fallaConexion];
  return html`
    <div class="error-card" data-tipo=${s.fallaConexion}>
      <div class="error-icon">${info.icono}</div>
      <h5>${info.titulo}</h5>
      <p>${info.cuerpo}</p>
      <div class="error-pulse"><span class="pulse-dot"></span><span>${info.pulso}</span></div>
    </div>`;
}

// --- Panel de descarga: sólo visible si hay ráfaga y NO hay falla. ---
function DownloadPanel() {
  const s = useStore();
  return html`
    <div class="dl-panel">
      <div class="dl-title">Descargando:<br/><b>${s.videoActual}</b></div>
      <div class="dl-bar"><div class="dl-fill" style=${`width:${s.progreso}%`}></div></div>
      <div class="dl-pct">${s.progreso}%</div>
    </div>`;
}

// --- Controles del demo (no forman parte de la feature; sólo para reproducir escenarios). ---
function DevControls() {
  const s = useStore();
  return html`
    <div class="dev">
      <div class="dev-title">Simulador (probá el escenario del bug)</div>
      <div class="dev-row">
        <button onClick=${store.iniciarDescarga} disabled=${s.rafagaEnCurso}>▶ Iniciar descarga</button>
        <button onClick=${store.reset}>↺ Reset</button>
      </div>
      <div class="dev-row">
        <button onClick=${store.caeServidor} disabled=${!s.servidor}>🔌 Cae servidor</button>
        <button onClick=${store.vuelveServidor} disabled=${s.servidor}>✅ Vuelve servidor</button>
      </div>
      <div class="dev-row">
        <button onClick=${store.caeInternet} disabled=${!s.internet}>🌐 Cae internet</button>
        <button onClick=${store.vuelveInternet} disabled=${s.internet}>✅ Vuelve internet</button>
      </div>
      <pre class="dev-state">${JSON.stringify({ servidor: s.servidor, internet: s.internet, rafagaEnCurso: s.rafagaEnCurso, fallaConexion: s.fallaConexion, progreso: s.progreso }, null, 2)}</pre>
    </div>`;
}

function App() {
  const s = useStore();
  return html`
    <div class="popup">
      <${Header} />
      <${PathBar} />

      <${ConnectionBanner} />

      ${s.rafagaEnCurso && !s.fallaConexion ? html`<${DownloadPanel} />` : null}

      ${!s.rafagaEnCurso && !s.fallaConexion
        ? html`<div class="idle">Lista de clases (idle). Iniciá una descarga y hacé caer el servidor.</div>`
        : null}

      <${DevControls} />
    </div>`;
}

render(html`<${App} />`, document.getElementById('root'));
