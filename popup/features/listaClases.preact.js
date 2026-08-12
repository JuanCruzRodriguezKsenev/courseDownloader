/**
 * ISLA PREACT #4 (Etapa 2) — la región #ui-list: listas y alerta (V1.2.0)
 * ==========================================================================
 * CHANGELOG v1.2.0:
 * - [ALERTA EN EL CONTENEDOR] Esta isla pasa a pintar también la ALERTA de conexión, que hasta
 *   ahora vivía en un root hermano (#preact-banner, isla #2). Los dos se repartían la misma
 *   región de pantalla coordinándose a mano —el vanilla apagaba la lista con `setOculta` al
 *   mostrar el banner— y alcanzaba con que algo tocara el host (una sincronización, un cambio
 *   de pestaña) para que la lista reapareciera DEBAJO del banner. Con un solo dueño eso no se
 *   puede dar: o hay alerta, o hay card de estado, o hay lista, y lo decide un `if`.
 * - De la isla #2 sobreviven su store (quién decide que hay alerta y de qué tipo) y su vista;
 *   lo que murió es su lugar en el DOM. Esta isla se suscribe a ese store además del propio:
 *   un dueño del DOM, dos fuentes de estado.
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
 *       videoActivo, anclaActiva, sinResultados, selectionMode,
 *       onCheckChange(clase,checked), onRemoverClick(clase) } }
 *
 * `anclaActiva` (corte 6a del multi-sitio): el primer ítem es la clase que se está bajando y
 * detrás va una línea divisoria. **Quién es esa clase y que vaya primera lo decide popup.js**
 * al armar el vm — la isla no reordena nada, sólo pinta el divisor. `sinResultados` dice que
 * el filtro dejó el resto vacío, que NO es lo mismo que la lista vacía: hay descarga en curso,
 * así que no corresponde la tarjeta de estado.
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
import { html, render, useState, useEffect, useLayoutEffect } from '../vendor/htm-preact-standalone.module.js';
// [ALERTA EN EL CONTENEDOR] La alerta de conexión es un COMPONENTE que se pinta dentro de esta
// región, no una isla hermana con root propio. De la #2 sobreviven su store (quién decide que
// hay alerta y de qué tipo) y su vista; lo que murió es su lugar en el DOM.
import BannerConexionStore, { BannerConexion } from './bannerConexion.preact.js';

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
  const { pestaña, sincronizado, enCurso, videoActivo, selectionMode, onCheckChange, onRemoverClick, overrideCarpeta, portalDe } = ctx;
  const sel = !!clase.seleccionado;

  const disponibles = pestaña === 'disponibles';

  // ── Ícono de TIPO ────────────────────────────────────────────────────────────────────────
  // Va SIEMPRE y en las dos pestañas, no sólo en los adjuntos. Mostrarlo únicamente cuando hay
  // un PDF obliga a leer la ausencia de un ícono como información, y eso no se lee: la fila sin
  // nada parecía una fila a la que le faltaba algo.
  const esAdjunto = clase.tipo === 'adjunto';
  const chipTipo = html`<span class="chip-tipo" title=${esAdjunto ? 'Material adjunto (PDF)' : 'Video'}
    >${esAdjunto ? '📄' : '🎬'}</span>`;

  // ── Pastilla de MATERIA, pintada con el color del PORTAL ──────────────────────────────────
  // Dos datos en un solo elemento, y a propósito: en la Cola —que mezcla portales— la fila no
  // tenía CÓMO decir de dónde salía ni a qué carpeta iba. Sumar dos pastillas por fila en una
  // lista de 28 px de alto es peor que resolverlo con el color de la que ya hacía falta.
  //
  // En Disponibles muestra el destino con el override aplicado (corte 2); en la Cola, la carpeta
  // ya estampada. `portalDe` lo resuelve popup.js: la isla no conoce el registro de sitios.
  const portal = portalDe ? portalDe(clase) : null;
  const materia = disponibles
    ? (overrideCarpeta || clase.modulo || clase.carpeta)
    : clase.carpeta;
  const conOverride = disponibles && !!overrideCarpeta && !!clase.modulo;
  const chipMateria = materia
    ? html`<span class="chip-materia ${conOverride ? 'override' : ''}"
             style=${portal && portal.color ? `--color-portal:${portal.color}` : ''}
             title=${`${portal ? portal.nombre + ' · ' : ''}${conOverride ? 'va a ' : ''}${materia}`}
           >${conOverride ? `→ ${materia}` : materia}</span>`
    : null;

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
        ${chipTipo}
        <span class="video-label">${clase.titulo}</span>
        ${chipMateria}
        <span class="badge ${badgeCls}">${badgeTxt}</span>
      </div>`;
  }

  // Vista Cola. `bajando` (corte 6a) es la fila anclada arriba de la divisoria: la marca con el
  // mismo acento naranja que la fila seleccionada, para no sumar vocabulario visual.
  return html`
    <div class="video-item ${sel ? 'selected' : ''} ${esActivo ? 'bajando' : ''}" title=${clase.titulo} onClick=${onRowClick}>
      ${checkbox}
      ${chipTipo}
      <span class="video-label" style=${`cursor:${tieneCheckbox ? 'pointer' : 'default'}`}>${clase.titulo}</span>
      ${chipMateria}
      ${esActivo
        ? html`<span class="badge process">Bajando</span>`
        : html`<button class="btn-row-action remove-action"
                 onClick=${(e) => { e.stopPropagation(); onRemoverClick(clase); }}>Remover ❌</button>`}
    </div>`;
}

export function ListaClases() {
  const { vm, host } = useListaClases();

  // [ALERTA EN EL CONTENEDOR] Ver el `if` de abajo. Se lee acá arriba porque el efecto de host
  // también lo necesita: una card ocupando la región cambia cómo se enmarca esa región.
  const alerta = BannerConexionStore.get();
  // Una CARD llena la región y trae su propia superficie (fondo, borde punteado, radio). El
  // marco del wrapper, entonces, es un segundo marco adentro del primero: la card queda
  // metida hacia adentro por el `padding` + `border` de `.list-wrapper` y sus laterales dejan
  // de alinear con la path-bar, las pestañas y la barra de filtros, que sí cuelgan del padding
  // del `.container`. No se veía antes porque la alerta vivía en un root hermano con
  // `display: contents`, o sea colgando del contenedor y no de la lista.
  const cardLlenaLaRegion = alerta.visible || !!(vm && vm.modo === 'card' && vm.card);

  // Reflejar los atributos de host sobre el nodo real #ui-list (sin tocar el CSS,
  // que sigue keyeando sobre .list-wrapper.selection-mode). Se ejecuta aunque el
  // render devuelva null (el componente sigue montado).
  //
  // **`useLayoutEffect` y NO `useEffect`, y no es intercambiable.** En Preact `useEffect` se
  // agenda por `requestAnimationFrame`, o sea DESPUÉS del paint. Con eso, al reemplazar la
  // lista por una card el navegador pintaba un frame intermedio: la card ya adentro, pero
  // `#ui-list` todavía con la geometría de la lista —su padding, su borde y **la barra de
  // scroll de la lista larga**— y recién al frame siguiente entraba `sin-marco`.
  //
  // Se veía como "la barra tarda en desaparecer" y "el banner parpadea", y llevó a buscarlo
  // como si fuera una animación del navegador: no lo era, y no hay ninguna que apagar. El
  // contenido y el marco de su región tienen que entrar en el MISMO frame, y eso es lo que
  // hace `useLayoutEffect`, que corre en el commit, antes de pintar.
  //
  // Regla que deja: cualquier efecto que cambie la GEOMETRÍA de una región va acá; los que
  // sólo se suscriben o disparan trabajo asíncrono se quedan en `useEffect` (ver el de
  // `useListaClases`, arriba, que no toca layout).
  useLayoutEffect(() => {
    if (!_host) return;
    _host.classList.toggle('selection-mode', host.selectionMode);
    _host.classList.toggle('sin-marco', cardLlenaLaRegion);
    _host.style.opacity = host.atenuada ? '0.5' : '';
    _host.style.display = host.oculta ? 'none' : '';
  }, [host.selectionMode, host.atenuada, host.oculta, cardLlenaLaRegion]);

  // [ALERTA EN EL CONTENEDOR] El banner de conexión se pinta ACÁ ADENTRO, no en un root
  // hermano. Antes vivía en #preact-banner y la lista se ocultaba con `setOculta` para hacerle
  // lugar: dos dueños de la misma región de pantalla, coordinados a mano, y cualquiera que
  // tocara el host —una sincronización, un cambio de pestaña— devolvía la lista debajo del
  // banner. Con un solo contenedor eso no se puede dar: o hay alerta o hay lista.
  //
  // Gana sobre TODO lo demás, incluidas las cards de cola pausada: es la condición más grave.
  if (alerta.visible) return html`<${BannerConexion} />`;

  // `oculta` sobrevive para lo que no es una alerta (hoy: nada lo usa desde que el banner se
  // mudó acá, pero es el mecanismo por el que el vanilla puede vaciar la región sin tocar DOM).
  if (host.oculta) return null;

  if (!vm || vm.modo === 'card') {
    return vm && vm.card ? html`<${TarjetaEstado} ...${vm.card} />` : null;
  }
  const { items, ctx } = vm;
  const filas = items.map((clase) => html`<${FilaClase} key=${clase.id} clase=${clase} ctx=${ctx} />`);

  // [MULTISITIO CORTE 6A] La fila anclada (la que se está bajando) llega SIEMPRE primera —
  // eso lo decide popup.js al armar el vm, no la isla. Acá sólo se pinta la línea divisoria
  // detrás de ella, que es puro asunto de vista.
  if (!ctx.anclaActiva || filas.length === 0) return filas;

  const divisor = html`<div class="cola-divisor" key="divisor"><span>En cola</span></div>`;
  const resto = ctx.sinResultados
    // Si el filtro dejó el resto vacío, la lista NO está vacía: hay una descarga en curso. Sin
    // esta nota la fila anclada quedaría sola y sin explicación de por qué no hay nada más.
    ? [html`<p class="cola-sin-resultados" key="vacio">Ninguna otra clase coincide con el filtro.</p>`]
    : filas.slice(1);

  return [filas[0], divisor, ...resto];
}

export function montar(root) {
  if (root) {
    _host = root;
    // La región se re-pinta también cuando cambia la ALERTA, que vive en otro store. Es la
    // contrapartida de compartir contenedor: un solo dueño del DOM, dos fuentes de estado.
    BannerConexionStore.suscribir(() => _store._emit());
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
// FASE 8: el puente se EXPORTA; lo importa quien lo usa (popup.js) en vez de buscarlo en
// window. Era el último acoplamiento por global de esta isla.
export default _store;

// Auto-montaje en el popup real (los tests importan los componentes, no montan acá).
if (typeof document !== 'undefined') {
  montar(document.getElementById('ui-list'));
}
