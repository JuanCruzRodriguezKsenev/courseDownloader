/**
 * ISLA PREACT #6 — detalle del loader con progreso (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - Presentación en tarjetas con íconos: lista, curso actual, contadores,
 *   tiempo, fila Escaneando…
 * CHANGELOG v1.0.0:
 * - Store y componente para el detalle del loader durante el escaneo.
 * - Soporta líneas informativas, lista de cursos con scroll automático sobre
 *   el curso actual, reloj con formatoReloj refrescado cada segundo y pie.
 * ==========================================================================
 */
import { html, render, useState, useEffect, useRef } from '../vendor/htm-preact-standalone.module.js';
import { formatoReloj } from '../../core/estado/progresoEscaneo.ts';

export const ICONOS = {
  lista: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/></svg>`,
  documento: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>`,
  reloj: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  listo: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor"/><path class="loader-icono-trazo" d="m7.5 12.5 3 3 6-6.5" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  vacio: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>`,
  fallido: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill="currentColor"/><path class="loader-icono-trazo" d="M9 9l6 6M15 9l-6 6" fill="none" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  actual: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>`,
  pendiente: html`<svg class="loader-icono" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`,
};

export const ESTADO_POR_MARCA = {
  '✓': 'listo',
  '○': 'vacio',
  '✗': 'fallido',
  '▸': 'actual',
  '·': 'pendiente',
};

const TEXTO_POR_ESTADO = {
  listo: 'listo',
  vacio: 'vacío',
  fallido: 'fallido',
  actual: 'actual',
  pendiente: 'pendiente',
};

function vacio() {
  return { actual: null, contadores: null, restante: null, cursos: [], pie: [], desde: null };
}

const _store = {
  estado: vacio(),
  _subs: new Set(),
  _emit() {
    this._subs.forEach((cb) => cb());
  },
  suscribir(cb) {
    this._subs.add(cb);
    return () => this._subs.delete(cb);
  },
  get() {
    return this.estado;
  },
  mostrar(vista) {
    this.estado = {
      actual:
        vista && typeof vista.actual === 'object' && vista.actual !== null ? vista.actual : null,
      contadores:
        vista && typeof vista.contadores === 'object' && vista.contadores !== null
          ? vista.contadores
          : null,
      restante:
        vista && typeof vista.restante === 'string' && vista.restante.trim().length > 0
          ? vista.restante
          : null,
      cursos: vista && Array.isArray(vista.cursos) ? vista.cursos : [],
      pie: vista && Array.isArray(vista.pie) ? vista.pie : [],
      desde: vista && typeof vista.desde === 'number' ? vista.desde : null,
    };
    this._emit();
  },
  limpiar() {
    if (
      this.estado.actual === null &&
      this.estado.contadores === null &&
      this.estado.restante === null &&
      this.estado.cursos.length === 0 &&
      this.estado.pie.length === 0 &&
      this.estado.desde === null
    ) {
      return;
    }
    this.estado = vacio();
    this._emit();
  },
};

function useLoaderDetalle() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store.get();
}

function RelojLoader({ desde }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (desde === null || typeof desde === 'undefined') return;
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [desde]);

  if (desde === null || typeof desde === 'undefined') return null;
  const texto = formatoReloj(Date.now() - desde);
  return html`<div class="loader-detalle-reloj">${texto}</div>`;
}

function ItemCurso({ curso }) {
  const elRef = useRef(null);

  useEffect(() => {
    if (curso.actual && elRef.current && typeof elRef.current.scrollIntoView === 'function') {
      elRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [curso.actual]);

  const estado = ESTADO_POR_MARCA[curso.marca] || 'pendiente';
  const icono = ICONOS[estado] || ICONOS.pendiente;
  const texto = TEXTO_POR_ESTADO[estado] || 'pendiente';

  return html`
    <li
      ref=${elRef}
      class=${`loader-curso${curso.actual ? ' actual' : ''}`}
    >
      <span class=${`loader-marca loader-marca-${estado}`} title=${texto}>${icono}</span>
      <span class="loader-curso-nombre" title=${curso.nombre}>${curso.nombre}</span>
    </li>
  `;
}

export function LoaderDetalle() {
  const { actual, contadores, restante, cursos, pie, desde } = useLoaderDetalle();

  const estaVacio =
    actual === null &&
    contadores === null &&
    restante === null &&
    cursos.length === 0 &&
    pie.length === 0 &&
    desde === null;

  if (estaVacio) return null;

  const tituloActual =
    actual && (actual.posicion || actual.nombre)
      ? [actual.posicion, actual.nombre].filter(Boolean).join(' · ')
      : null;

  return html`
    <div class="loader-detalle">
      ${cursos.length > 0 &&
      html`
        <section class="loader-tarjeta loader-cursos">
          <div class="loader-cursos-cabecera">
            ${ICONOS.lista}
            <span>Cursos</span>
          </div>
          <ul class="loader-cursos-lista">
            ${cursos.map(
              (c, idx) => html`<${ItemCurso} key=${`cur-${idx}-${c.nombre}`} curso=${c} />`
            )}
          </ul>
        </section>
      `}

      ${actual &&
      html`
        <section class="loader-tarjeta loader-actual">
          ${ICONOS.documento}
          <div>
            ${tituloActual && html`<div class="loader-actual-titulo">${tituloActual}</div>`}
            ${actual.detalle &&
            html`<div class="loader-actual-detalle">${actual.detalle}</div>`}
          </div>
        </section>
      `}

      ${contadores &&
      html`
        <section class="loader-tarjeta loader-contadores">
          <div class="loader-contador">
            <div class="loader-contador-etiqueta">Listos</div>
            <div class="loader-contador-valor">
              <span class="loader-marca loader-marca-listo" title="listo">${ICONOS.listo}</span>
              <span>${contadores.listos}</span>
            </div>
          </div>
          <div class="loader-contador">
            <div class="loader-contador-etiqueta">Vacíos</div>
            <div class="loader-contador-valor">
              <span class="loader-marca loader-marca-vacio" title="vacío">${ICONOS.vacio}</span>
              <span>${contadores.vacios}</span>
            </div>
          </div>
          <div class="loader-contador">
            <div class="loader-contador-etiqueta">Fallidos</div>
            <div class="loader-contador-valor">
              <span class="loader-marca loader-marca-fallido" title="fallido">${ICONOS.fallido}</span>
              <span>${contadores.fallidos}</span>
            </div>
          </div>
        </section>
      `}

      ${(restante || desde !== null) &&
      html`
        <div class="loader-tiempo">
          ${restante &&
          html`
            <div class="loader-tiempo-restante">
              ${ICONOS.reloj}
              <span>${restante}</span>
            </div>
          `}
          ${desde !== null && html`<${RelojLoader} desde=${desde} />`}
        </div>
      `}

      <div class="loader-escaneando">
        <div class="spinner"></div>
        <span>Escaneando…</span>
      </div>

      ${pie.length > 0 &&
      html`
        <div class="loader-pie">
          ${pie.map(
            (p, idx) => html`<div key=${`pie-${idx}`} class="loader-detalle-pie">${p}</div>`
          )}
        </div>
      `}
    </div>
  `;
}

export function montar(root) {
  if (root) render(html`<${LoaderDetalle} />`, root);
}

export function __resetStore() {
  _store.estado = vacio();
  _store._subs.clear();
}

export default _store;
