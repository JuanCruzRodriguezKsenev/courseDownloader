/**
 * ISLA PREACT #6 — detalle del loader con progreso (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - Store y componente para el detalle del loader durante el escaneo.
 * - Soporta líneas informativas, lista de cursos con scroll automático sobre
 *   el curso actual, reloj con formatoReloj refrescado cada segundo y pie.
 * ==========================================================================
 */
import { html, render, useState, useEffect, useRef } from '../vendor/htm-preact-standalone.module.js';
import { formatoReloj } from '../../core/estado/progresoEscaneo.ts';

const _store = {
  estado: { lineas: [], cursos: [], pie: [], desde: null },
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
      lineas: vista && Array.isArray(vista.lineas) ? vista.lineas : [],
      cursos: vista && Array.isArray(vista.cursos) ? vista.cursos : [],
      pie: vista && Array.isArray(vista.pie) ? vista.pie : [],
      desde: vista && typeof vista.desde === 'number' ? vista.desde : null,
    };
    this._emit();
  },
  limpiar() {
    if (
      this.estado.lineas.length === 0 &&
      this.estado.cursos.length === 0 &&
      this.estado.pie.length === 0 &&
      this.estado.desde === null
    ) {
      return;
    }
    this.estado = { lineas: [], cursos: [], pie: [], desde: null };
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

  return html`
    <li
      ref=${elRef}
      class=${`loader-detalle-curso${curso.actual ? ' actual' : ''}`}
    >
      <span class="loader-detalle-curso-marca">${curso.marca}</span>
      ${' '}
      <span class="loader-detalle-curso-nombre" title=${curso.nombre}>${curso.nombre}</span>
    </li>
  `;
}

export function LoaderDetalle() {
  const { lineas, cursos, pie, desde } = useLoaderDetalle();

  const estaVacio =
    lineas.length === 0 && cursos.length === 0 && pie.length === 0 && desde === null;

  if (estaVacio) return null;

  return html`
    <div class="loader-detalle">
      ${lineas.map(
        (linea, idx) => html`<div key=${`lin-${idx}`} class="loader-detalle-linea">${linea}</div>`
      )}
      ${desde !== null && html`<<${RelojLoader} desde=${desde} />`}
      ${cursos.length > 0 &&
      html`
        <ul class="loader-detalle-cursos">
          ${cursos.map(
            (c, idx) => html`<<${ItemCurso} key=${`cur-${idx}-${c.nombre}`} curso=${c} />`
          )}
        </ul>
      `}
      ${pie.map(
        (p, idx) => html`<div key=${`pie-${idx}`} class="loader-detalle-pie">${p}</div>`
      )}
    </div>
  `;
}

export function montar(root) {
  if (root) render(html`<${LoaderDetalle} />`, root);
}

export function __resetStore() {
  _store.estado = { lineas: [], cursos: [], pie: [], desde: null };
  _store._subs.clear();
}

export default _store;
