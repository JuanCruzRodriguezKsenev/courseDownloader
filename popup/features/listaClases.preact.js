/**
 * ISLA PREACT #4 (Etapa 2) — la lista de clases de #ui-list (V1.1.1)
 * ==========================================================================
 * CHANGELOG v1.1.1:
 * - [FIX] badgeCls cae a 'pending' para cualquier estado que no sea downloaded/process
 *   (sólo esos tres tienen CSS). Antes, una clase con estado 'error' heredado de storage
 *   viejo pintaba un `badge error` sin regla → render roto. Ahora es tolerante y alineado
 *   con el texto del badge. El estado 'error' ya no se genera (ver background.js v5.10.1).
 * ==========================================================================
 * Isla de la migración incremental del popup a Preact (ver ADR-0006,
 * docs/preact-migration.md). Es DUEÑA de #ui-list: sus HIJOS (filas de clases y
 * tarjetas de estado) Y sus ATRIBUTOS de host (clase .selection-mode, opacidad de
 * atenuado, y visibilidad display) — nadie más los toca (Etapa 2, V1.1.0).
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
 * Atributos del host (fuera del vm, con sus propios setters porque los empujan
 * call-sites distintos): window.ListaClases
 *   - setSelectionMode(bool) → clase .selection-mode en #ui-list (antes popup.js
 *     actualizarModoSeleccion mutaba nodos.lista.classList).
 *   - setAtenuada(bool) → opacity 0.5/'' (antes popup.js atenuaba durante la
 *     sincronización de disco con nodos.lista.style.opacity).
 *   - setOculta(bool) → display none/'' (antes serverConnection.js ocultaba +
 *     vaciaba #ui-list con innerHTML/display mientras el banner ocupa su lugar;
 *     ahora la isla devuelve null, así Preact quita los hijos sin desincronizar su
 *     vdom contra un DOM borrado por fuera).
 * Un useEffect refleja esos flags sobre el host real (no se cambia el CSS, que
 * sigue keyeando sobre #ui-list.list-wrapper).
 *
 * Seguridad: `descripcion` de la card va por dangerouslySetInnerHTML (lleva
 * <br>/<strong> intencionales). El título scrapeado que se interpola en esa
 * descripción se escapa con Utils.escaparHtml EN popup.js, antes de armar el vm.
 * ==========================================================================
 */
import { html, render, useState, useEffect } from '../vendor/htm-preact-standalone.module.js';

const VM_INICIAL = { modo: 'card', card: null };
const HOST_INICIAL = { selectionMode: false, atenuada: false, oculta: false };

let _host = null; // el nodo #ui-list donde monta la isla (para reflejar atributos de host)

const _store = {
  vm: VM_INICIAL,
  host: HOST_INICIAL,
  _subs: new Set(),
  _emit() { this._subs.forEach((cb) => cb()); },
  suscribir(cb) { this._subs.add(cb); return () => this._subs.delete(cb); },
  get() { return { vm: this.vm, host: this.host }; },
  render(vm) {
    this.vm = vm || VM_INICIAL;
    this._emit();
  },
  setSelectionMode(v) { this.host = { ...this.host, selectionMode: !!v }; this._emit(); },
  setAtenuada(v) { this.host = { ...this.host, atenuada: !!v }; this._emit(); },
  setOculta(v) { this.host = { ...this.host, oculta: !!v }; this._emit(); },
};

function useListaClases() {
  const [, forzar] = useState(0);
  useEffect(() => _store.suscribir(() => forzar((n) => n + 1)), []);
  return _store.get();
}

// Port 1:1 del antiguo renderers.js renderizarTarjetaEstado.
export function TarjetaEstado({ tipo, titulo, descripcion, icono }) {
  return html`
    <div class="info-card ${tipo}">
      <div class="info-card-icon">${icono}</div>
      <h5>${titulo}</h5>
      <p dangerouslySetInnerHTML=${{ __html: descripcion }}></p>
    </div>`;
}

// Port 1:1 del antiguo renderers.js construirFilaClaseDOM (ramas disponibles/cola).
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
    // Sólo hay CSS para pending/process/downloaded: cualquier otro estado (ej. un 'error'
    // heredado de storage viejo) cae a 'pending', alineado con el texto del badge de abajo.
    const badgeCls = (!sincronizado || (clase.estado !== 'downloaded' && clase.estado !== 'process'))
      ? 'pending'
      : clase.estado;
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
  const { vm, host } = useListaClases();

  // Reflejar los atributos de host sobre el nodo real #ui-list (sin tocar el CSS,
  // que sigue keyeando sobre .list-wrapper.selection-mode). Se ejecuta aunque el
  // render devuelva null (el componente sigue montado).
  useEffect(() => {
    if (!_host) return;
    _host.classList.toggle('selection-mode', host.selectionMode);
    _host.style.opacity = host.atenuada ? '0.5' : '';
    _host.style.display = host.oculta ? 'none' : '';
  }, [host.selectionMode, host.atenuada, host.oculta]);

  // Oculta (banner de conexión ocupando el lugar de la lista): sin hijos. Preact
  // los quita él mismo → nadie borra el DOM por fuera (evita el desync de vdom).
  if (host.oculta) return null;

  if (!vm || vm.modo === 'card') {
    return vm && vm.card ? html`<${TarjetaEstado} ...${vm.card} />` : null;
  }
  const { items, ctx } = vm;
  return items.map((clase) => html`<${FilaClase} key=${clase.id} clase=${clase} ctx=${ctx} />`);
}

export function montar(root) {
  if (root) {
    _host = root;
    render(html`<${ListaClases} />`, root);
  }
}

// Sólo para tests: reinicia el store (estado + suscriptores) entre casos.
export function __resetStore() {
  _store.vm = VM_INICIAL;
  _store.host = HOST_INICIAL;
  _store._subs.clear();
}

// Store global para que el vanilla (popup.js / serverConnection.js) empuje datos.
if (typeof window !== 'undefined') window.ListaClases = _store;

// Auto-montaje en el popup real (los tests importan los componentes, no montan acá).
if (typeof document !== 'undefined') {
  montar(document.getElementById('ui-list'));
}
