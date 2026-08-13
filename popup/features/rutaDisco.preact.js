/**
 * ISLA PREACT #1b — el texto de la ruta del disco (📁 PC:) (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - El texto va envuelto en `<bdi dir="ltr">` para que la hoja pueda recortar la ruta por la
 *   izquierda sin que se invierta el orden de los caracteres. Motivo y las tres reglas que lo
 *   sostienen: `styles/components/path-bar.css` (.pc-path-text).
 * ==========================================================================
 * Isla de la migración incremental del popup a Preact (ver ADR-0006,
 * docs/preact-migration.md). Es DUEÑA exclusiva del texto de la ruta física
 * (#preact-pc-path, la fila "📁 PC:" de la .path-bar) y lo deriva de un store.
 *
 * A diferencia de las islas #1/#3 (que derivan del daemon Conexion), la ruta del
 * disco NO vive en Conexion: la resuelve BunClient (obtenerRutaServidor /
 * seleccionarCarpeta). Por eso esta isla tiene su propio store-puente `RutaDisco`
 * (window.RutaDisco): los ~7 lugares que antes escribían nodos.pcPath.textContent
 * ahora llaman RutaDisco.mostrar(...) / .cargando(...), y la isla se suscribe.
 *
 * Fuera de esta isla (siguen vanilla): el botón "Explorar" y el input de materia
 * (interactivos) y el toggle de la clase .path-bar.offline (vive en el <section>
 * ancestro, que contiene esos interactivos — no se puede migrar sin ellos).
 *
 * Estados del texto:
 *   - mostrar(texto, titulo): valor final (ruta resuelta, "Desconectado", etc.).
 *   - cargando(texto): estado transitorio con spinner (clase .loading-text),
 *     ej. "Abriendo explorador..."; conserva el título previo.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

const TEXTO_INICIAL = 'Buscando servidor...';

const _store = {
  estado: { texto: TEXTO_INICIAL, titulo: TEXTO_INICIAL, cargando: false },
  _subs: new Set(),
  _emit() { this._subs.forEach((cb) => cb()); },
  suscribir(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  get() { return this.estado; },
  mostrar(texto, titulo = texto) {
    this.estado = { texto, titulo, cargando: false };
    this._emit();
  },
  cargando(texto) {
    this.estado = { texto, titulo: this.estado.titulo, cargando: true };
    this._emit();
  },
};

// Hook puente al store (mismo patrón que useConexion, pero para RutaDisco).
function useRutaDisco() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store.get();
}

export function PcPath() {
  const { texto, titulo, cargando } = useRutaDisco();
  // El `<bdi dir="ltr">` no es decorativo: la hoja recorta la ruta por la IZQUIERDA (para que
  // se vea la carpeta de destino y no `C:\Users\...`), y eso se consigue poniendo el
  // contenedor en `direction: rtl`. Sin volver a fijar `ltr` acá adentro, el algoritmo bidi
  // reordena los separadores y la ruta se lee al revés. Ver `styles/components/path-bar.css`.
  // `textContent` lo atraviesa, así que los tests de la isla no cambian.
  return html`<span class="pc-path-text ${cargando ? 'loading-text' : ''}" title=${titulo}
    ><bdi dir="ltr">${texto}</bdi></span>`;
}

export function montar(root) {
  if (root) render(html`<${PcPath} />`, root);
}

// Sólo para tests: reinicia el store (estado + suscriptores) entre casos.
export function __resetStore() {
  _store.estado = { texto: TEXTO_INICIAL, titulo: TEXTO_INICIAL, cargando: false };
  _store._subs.clear();
}

// El store es global para que el código vanilla (popup.js / serverConnection.js,
// clásicos) lo empuje. Los módulos ES corren deferred, antes de DOMContentLoaded,
// así que window.RutaDisco existe cuando esos call-sites se ejecutan (todos corren
// en el flujo de init o en respuesta a eventos, nunca durante el parse).
// FASE 8: el puente se exporta en vez de publicarse como global.
export default _store;

// Auto-montaje en el popup real (no corre en los tests, que importan los componentes).
if (typeof document !== 'undefined') {
  montar(document.getElementById('preact-pc-path'));
}
