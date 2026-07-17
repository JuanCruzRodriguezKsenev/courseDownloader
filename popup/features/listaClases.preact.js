/**
 * ISLA PREACT #4 (Etapa 1) — la lista de clases de #ui-list (V1.0.0)
 * ==========================================================================
 * Isla de la migración incremental del popup a Preact (ver ADR-0006,
 * docs/preact-migration.md). Es DUEÑA de los HIJOS de #ui-list: las filas de
 * clases (pestañas Disponibles/Cola) y las tarjetas de estado (vacío/error/escaneo).
 *
 * Patrón store-puente (como bannerConexion/rutaDisco): AppState sigue siendo la
 * fuente de verdad; el vanilla (popup.js renderizarListadoInterfaz) calcula un
 * view-model y lo empuja a window.ListaClases.render(vm). La isla es VISTA PURA.
 *
 * View-model (vm) discriminado:
 *   - { modo:'card', card:{ tipo, titulo, descripcion, icono } } → una tarjeta de estado.
 *   - { modo:'lista', items:[...clases], ctx:{ pestaña, sincronizado, enCurso,
 *       videoActivo, selectionMode, onCheckChange(clase,checked), onRemoverClick(clase) } }
 *
 * Etapa 1 NO toca los ATRIBUTOS del contenedor #ui-list (.style.opacity, clase
 * .selection-mode, toggle display): Preact gestiona los hijos, no el host; esos
 * atributos siguen vanilla y se migran en la Etapa 2. Port 1:1 de renderers.js
 * (construirFilaClaseDOM / renderizarTarjetaEstado), que quedan como referencia.
 *
 * Seguridad: `descripcion` de la card va por dangerouslySetInnerHTML (lleva
 * <br>/<strong> intencionales). El título scrapeado que se interpola en esa
 * descripción se escapa con Utils.escaparHtml EN popup.js, antes de armar el vm.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

const VM_INICIAL = { modo: 'card', card: null };

const _store = {
  estado: VM_INICIAL,
  _subs: new Set(),
  _emit() { this._subs.forEach((cb) => cb()); },
  suscribir(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  get() { return this.estado; },
  render(vm) {
    this.estado = vm || VM_INICIAL;
    this._emit();
  },
};

function useListaClases() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store.get();
}

// Port 1:1 de renderers.js renderizarTarjetaEstado.
export function TarjetaEstado({ tipo, titulo, descripcion, icono }) {
  return html`
    <div class="info-card ${tipo}">
      <div class="info-card-icon">${icono}</div>
      <h5>${titulo}</h5>
      <p dangerouslySetInnerHTML=${{ __html: descripcion }}></p>
    </div>`;
}

// Port 1:1 de renderers.js construirFilaClaseDOM (ramas disponibles/cola).
export function FilaClase({ clase, ctx }) {
  const { pestaña, sincronizado, enCurso, videoActivo, selectionMode, onCheckChange, onRemoverClick } = ctx;
  const sel = !!clase.seleccionado;

  const disponibles = pestaña === 'disponibles';
  const esActivo = clase.titulo === videoActivo && enCurso;
  // En Disponibles no hay checkbox si no está sincronizado o ya está descargado/en fila.
  const sinCheckbox = disponibles
    ? (!sincronizado || clase.estado === 'downloaded' || clase.estado === 'process')
    : esActivo;
  const tieneCheckbox = !sinCheckbox;

  // Toda la fila alterna la selección, sólo en modo selección y sólo si hay checkbox.
  const onRowClick = (e) => {
    if (!tieneCheckbox) return;
    if (e.target && e.target.matches && e.target.matches('input[type="checkbox"]')) return;
    if (!selectionMode) return;
    onCheckChange(clase, !clase.seleccionado);
  };

  const checkboxId = disponibles ? `chk-${clase.id}` : `chk-cola-${clase.id}`;
  const checkbox = tieneCheckbox
    ? html`<input type="checkbox" id=${checkboxId} checked=${sel}
             onChange=${(e) => onCheckChange(clase, e.target.checked)} />`
    : html`<div class="checkbox-placeholder"></div>`;

  if (disponibles) {
    const badgeCls = !sincronizado ? 'pending' : clase.estado;
    const badgeTxt = !sincronizado
      ? 'Sin verificar'
      : (clase.estado === 'downloaded' ? 'Descargado' : (clase.estado === 'process' ? 'En Fila' : 'Pendiente'));
    // Sin sincronizar: fila atenuada (equivale al viejo fila.style.opacity=0.65 de popup.js).
    const estilo = !sincronizado ? 'opacity:0.65' : '';
    return html`
      <div class="video-item ${sel ? 'selected' : ''}" title=${clase.titulo} style=${estilo} onClick=${onRowClick}>
        ${checkbox}
        <span class="video-label">${clase.titulo}</span>
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>`;
  }

  // Vista Cola
  return html`
    <div class="video-item ${sel ? 'selected' : ''}" title=${clase.titulo} onClick=${onRowClick}>
      ${checkbox}
      <span class="video-label" style=${`cursor:${tieneCheckbox ? 'pointer' : 'default'}`}>${clase.titulo}</span>
      ${esActivo
        ? html`<span class="badge process">Bajando</span>`
        : html`<button class="btn-row-action remove-action"
                 onClick=${(e) => { e.stopPropagation(); onRemoverClick(clase); }}>Remover ❌</button>`}
    </div>`;
}

export function ListaClases() {
  const vm = useListaClases();
  if (!vm || vm.modo === 'card') {
    return vm && vm.card ? html`<${TarjetaEstado} ...${vm.card} />` : null;
  }
  const { items, ctx } = vm;
  return items.map((clase) => html`<${FilaClase} key=${clase.id} clase=${clase} ctx=${ctx} />`);
}

export function montar(root) {
  if (root) render(html`<${ListaClases} />`, root);
}

// Sólo para tests: reinicia el store (estado + suscriptores) entre casos.
export function __resetStore() {
  _store.estado = VM_INICIAL;
  _store._subs.clear();
}

// Store global para que el vanilla (popup.js) empuje el view-model.
if (typeof window !== 'undefined') window.ListaClases = _store;

// Auto-montaje en el popup real (los tests importan los componentes, no montan acá).
// Se monta DENTRO de #ui-list: Preact gestiona sus hijos; el vanilla sigue tocando
// sólo los atributos del contenedor (opacity/clase/display) hasta la Etapa 2.
if (typeof document !== 'undefined') {
  montar(document.getElementById('ui-list'));
}
