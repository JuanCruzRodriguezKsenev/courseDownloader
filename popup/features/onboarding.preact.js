/**
 * ISLA PREACT #3 — el onboarding (welcome tour) (V1.2.0)
 * ==========================================================================
 * CHANGELOG v1.2.0:
 * - [COPY GENÉRICA — corte 2] La slide "Clases y Videos" dejó de hardcodear el flujo de
 *   Ramón Net: sale de `sitio.instruccionEscaneo` (PuertoSitio). Se perdió el <strong> del
 *   "👁️ mostrar" a propósito — el descriptor trae texto plano y esta isla lo escapa.
 *
 * CHANGELOG v1.1.0:
 * - [COPY GENÉRICA — corte 1] "Ir a Clases Grabadas 🌐" → "Ir al listado de clases 🌐":
 *   "Clases Grabadas" es el nombre de la sección EN RAMÓN NET. El destino ya sale del
 *   descriptor (`sitio.urlListado`), así que el label no tiene por qué nombrarla.
 * - [PENDIENTE, y es el corte 2] La frase del selector + "👁️ mostrar" describe un flujo
 *   que en Anatomy no existe. No se toca acá: necesita un miembro nuevo en PuertoSitio
 *   para que cada portal traiga su instrucción → docs/copy-generico-diseno.md §5.3.
 * ==========================================================================
 * Tercera "isla" de la migración incremental del popup a Preact (ver
 * docs/adr/0006-adopt-preact-islands-in-popup.md, docs/preact-migration.md).
 * Reemplaza la feature vanilla popup/features/onboarding.js: esta isla es DUEÑA
 * exclusiva del overlay del tutorial (#ui-onboarding) y de todo su DOM interno
 * (slides, dots, navegación, y el estado del servidor del slide de la carpeta).
 *
 * Dos fuentes de estado, ninguna imperativa:
 *   - Apertura/cierre + carrusel: store local `_store` (puente con el vanilla).
 *   - Estado del servidor del slide 5: DERIVADO del daemon Conexion vía useConexion()
 *     — igual que la isla #1 (StatusDot). Por eso desaparece el sink imperativo
 *     `actualizarEstadoServidorOnboarding` que antes empujaba serverConnection.js.
 *
 * Puente vanilla <-> isla: el módulo expone `window.OnboardingFeature.crear(ctx)`
 * (misma firma que la feature vieja) para que popup.js inyecte los callbacks
 * cruzados (onExplore, onComplete) y cablee el botón de ayuda (fuera de esta isla).
 * `crear` devuelve { mostrarOnboarding }. Timing: los módulos ES corren deferred,
 * después de los <script> clásicos y ANTES de DOMContentLoaded, así que
 * window.OnboardingFeature ya existe cuando el handler DCL de popup.js lo usa.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';
import { useConexion } from './conexionHeader.preact.js';

// --- Store externo: puente entre el vanilla (popup.js dispara/provee callbacks)
// y la isla (se suscribe y re-renderiza). Equivalente a useSyncExternalStore. ---
const _store = {
  visible: false,
  forzado: false,        // true = reabierto por el botón de ayuda (no dispara onComplete).
  onExplore: null,       // callback: "Seleccionar Carpeta" del slide 5.
  onComplete: null,      // callback: cierre del tour de la PRIMERA vez.
  _subs: new Set(),
  _emit() { this._subs.forEach((cb) => cb()); },
  suscribir(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  abrir(forzado = false) { this.forzado = forzado; this.visible = true; this._emit(); },
  cerrar() { this.visible = false; this._emit(); },
};

// Hook puente al store local (mismo patrón que useConexion, pero para _store).
function useStore() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store;
}

export function Onboarding({ conexion, appState, sitio: sitioInyectado }) {
  const store = useStore();
  const conx = useConexion(conexion);
  const [slide, setSlide] = useState(0);

  if (!store.visible) return null;

  const total = 6;
  const servidorOk = !!conx.servidor;

  function cerrar() {
    // Persistir que el tutorial ya se vio (misma semántica que la feature vieja).
    if (appState) {
      appState.tutorialCompletado = true;
      appState.respaldar();
    }
    const eraForzado = store.forzado;
    setSlide(0);           // deja el carrusel listo para la próxima apertura.
    store.cerrar();
    // Sólo tras el tour de la primera vez (no el reabierto por ayuda) avisamos al
    // orquestador para que conecte al servidor y arranque el escaneo del aula.
    if (!eraForzado && typeof store.onComplete === 'function') store.onComplete();
  }

  function siguiente() { slide < total - 1 ? setSlide(slide + 1) : cerrar(); }
  function atras() { if (slide > 0) setSlide(slide - 1); }

  // El único dato de sitio que le queda a la UI: el copy nombra al portal y a su eje de
  // clasificación. Viene del descriptor (`PuertoSitio`), no hardcodeado — es el mismo patrón
  // que ya se le aplicó a la faceta: parametrizar en vez de duplicar el componente. Los
  // fallbacks existen para que la isla se pueda montar en un test sin adaptador cargado.
  const sitio = sitioInyectado || {};
  const nombreSitio = sitio.nombre || 'la plataforma';

  const dots = [];
  for (let i = 0; i < total; i++) {
    dots.push(html`<span class="onboarding-dot ${i === slide ? 'active' : ''}"></span>`);
  }

  return html`
    <div class="onboarding-overlay" id="ui-onboarding">
      <div class="onboarding-card">
        <button class="onboarding-skip-btn" title="Saltar tutorial" onClick=${cerrar}>Saltar</button>
        <div class="onboarding-slides-wrapper">
          <div class="onboarding-slides" style=${`transform: translateX(-${slide * 100}%)`}>
            <div class="onboarding-slide">
              <div class="onboarding-icon">🚀</div>
              <h3>¡Bienvenido a ${nombreSitio} Turbo!</h3>
              <p>Descargá todas tus clases de ${nombreSitio} al instante, sin límites de tamaño y de forma organizada en tu PC.</p>
            </div>
            <div class="onboarding-slide">
              <div class="onboarding-icon">🌐</div>
              <h3>Página Correcta</h3>
              <p>Usá la extensión dentro del listado de clases de tu materia en ${nombreSitio} para detectar los videos: <a href=${sitio.urlListado || '#'} target="_blank" class="onboarding-link">Ir al listado de clases 🌐</a></p>
            </div>
            <div class="onboarding-slide">
              <div class="onboarding-icon">🔍</div>
              <h3>Clases y Videos</h3>
              <p>${sitio.instruccionEscaneo}</p>
            </div>
            <div class="onboarding-slide">
              <div class="onboarding-icon">🔌</div>
              <h3>Conectá tu Servidor</h3>
              <p>Ejecutá <strong>iniciar.bat</strong>. El servidor debe quedar abierto (podés minimizar la consola y no tenés que hacer nada más).</p>
            </div>
            <div class="onboarding-slide">
              <div class="onboarding-icon">📁</div>
              <h3>Carpeta de Descargas</h3>
              <p>Seleccioná tu carpeta raíz. La extensión creará y organizará las subcarpetas por materia y ${(sitio.faceta?.etiqueta || 'categoría').toLowerCase()} automáticamente de forma ordenada.</p>
              <div class="onboarding-server-msg ${servidorOk ? 'success' : 'error'}">
                ${servidorOk ? '🔌 Servidor conectado. ¡Ya podés elegir carpeta!' : '⚠️ Primero tenés que levantar el servidor'}
              </div>
              <button
                class="btn-adv-primary"
                style="margin-top: 10px; padding: 6px 14px; font-size: var(--text-sm);"
                disabled=${!servidorOk}
                title=${servidorOk ? 'Seleccionar carpeta principal de descargas' : 'Servidor desconectado. Ejecutá iniciar.bat primero.'}
                onClick=${() => { if (typeof _store.onExplore === 'function') _store.onExplore(); }}
              >📂 Seleccionar Carpeta</button>
            </div>
            <div class="onboarding-slide">
              <div class="onboarding-icon">⚡</div>
              <h3>Navegá sin Preocupaciones</h3>
              <p>Podés cambiar de materia, navegar otras páginas o cerrar la pestaña de ${nombreSitio}. ¡La descarga seguirá corriendo de fondo!</p>
            </div>
          </div>
        </div>
        <div class="onboarding-footer">
          <button class="btn-onboarding-nav" disabled=${slide === 0} onClick=${atras}>Atrás</button>
          <div class="onboarding-dots">${dots}</div>
          <button class="btn-onboarding-nav" onClick=${siguiente}>${slide === total - 1 ? 'Comenzar' : 'Siguiente'}</button>
        </div>
      </div>
    </div>`;
}

// FASE 7C: la monta el entrypoint del popup con sus dependencias, no este módulo al
// evaluarse. `sitio` deja de tener fallback a `window.SitioActivo`: ahora entra siempre.
export function montar(root, { conexion, appState, sitio } = {}) {
  if (root) render(html`<${Onboarding} conexion=${conexion} appState=${appState} sitio=${sitio} />`, root);
}

// Sólo para tests: reinicia el store (estado + suscriptores) entre casos, ya que el
// módulo se importa una vez y `_store` es singleton. Inocuo en producción.
export function __resetStore() {
  _store.visible = false;
  _store.forzado = false;
  _store.onExplore = null;
  _store.onComplete = null;
  _store._subs.clear();
}

// --- Puente para el vanilla (popup.js). Misma firma que la feature vieja. ---
const OnboardingFeature = {
  crear(ctx) {
    const { btnHelp, onExplore, onComplete } = ctx || {};
    _store.onExplore = onExplore;
    _store.onComplete = onComplete;
    // El botón de ayuda vive en el header, FUERA de la isla → lo cablea el puente.
    if (btnHelp) btnHelp.addEventListener('click', () => _store.abrir(true));
    return { mostrarOnboarding: (forzado = false) => _store.abrir(forzado) };
  },
};

// FASE 8: el puente se exporta en vez de publicarse como global.
export default OnboardingFeature;

