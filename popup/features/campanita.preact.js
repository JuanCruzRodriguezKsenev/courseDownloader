/**
 * ISLA PREACT #5 — la campanita de fallos (V1.0.0)
 * ==========================================================================
 * Isla de la migración incremental del popup a Preact (ver ADR-0006,
 * docs/preact-migration.md). Campanita persistente en el header: un botón 🔔 con
 * badge de fallos no leídos y un panel desplegable con el historial (título, tipo,
 * "hace X", motivo) + acciones "Marcar leídas" / "Limpiar".
 *
 * A diferencia de las otras islas, su store-puente NO es un window.X efímero: es el
 * módulo compartido shared/historialFallos.js, respaldado en chrome.storage.local y
 * espejado vía storage.onChanged. El escritor principal es el SW (background.js
 * registrarFallo) — típicamente con el popup CERRADO —, así que la fuente de verdad
 * debe sobrevivir fuera del popup. El hook se suscribe y vuelve a pedir obtener().
 *
 * Seguridad: `titulo` y `motivo` son texto scrapeado / derivado del backend (no
 * confiable). Se interpolan como TEXTO plano (${...}) dentro del template html —
 * htm/Preact los escapa. NUNCA dangerouslySetInnerHTML acá (regla de docs/security.md).
 * ==========================================================================
 */
import { html, render, useState, useEffect, useRef } from '../vendor/htm-preact-standalone.module.js';
import { Capa } from './capa.preact.js';

// Etiqueta corta por tipo para la fila del panel (el título largo va en la notificación
// nativa; acá alcanza con un chip escaneable).
const ETIQUETA_TIPO = {
  rechazo: 'Clase saltada',
  sesion: 'Sesión',
  servidor: 'Servidor',
  internet: 'Internet',
};

// "hace X" aproximado a partir del timestamp, sin dependencias de formato de fechas.
function haceCuanto(ts) {
  const seg = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seg < 60) return 'recién';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const hs = Math.floor(min / 60);
  if (hs < 24) return `hace ${hs} h`;
  return `hace ${Math.floor(hs / 24)} d`;
}

// Hook puente al módulo compartido: lista siempre fresca. Se suscribe a los cambios de
// storage (los provoca el SW al registrar un fallo, o el propio popup al marcar/limpiar)
// y vuelve a pedir obtener() en cada señal.
// FASE 7C: el historial entra por parámetro, no por `window.HistorialFallos`.
function useHistorialFallos(historial) {
  const [lista, setLista] = useState([]);
  useEffect(() => {
    if (!historial) return undefined;
    let vivo = true;
    const recargar = () => {
      historial.obtener().then((l) => { if (vivo) setLista(l); });
    };
    recargar();
    const off = historial.suscribir(recargar);
    return () => { vivo = false; off(); };
  }, []);
  return lista;
}

export function CampanitaBoton({ count, onClick }) {
  return html`
    <button class="campanita-btn" onClick=${onClick} title="Fallos de descarga" aria-label="Fallos de descarga">
      🔔${count > 0 && html`<span class="campanita-badge">${count > 99 ? '99+' : count}</span>`}
    </button>`;
}

export function FilaFallo({ fallo }) {
  return html`
    <li class="campanita-fila ${fallo.leido ? 'leido' : 'no-leido'}">
      <div class="campanita-fila-top">
        <span class="campanita-chip ${fallo.tipo}">${ETIQUETA_TIPO[fallo.tipo] || 'Fallo'}</span>
        <span class="campanita-cuando">${haceCuanto(fallo.ts)}</span>
      </div>
      ${fallo.titulo && html`<div class="campanita-titulo">${fallo.titulo}</div>`}
      <div class="campanita-motivo">${fallo.motivo}</div>
    </li>`;
}

// El CONTENIDO del panel. La superficie (fondo, borde, sombra) y el cierre los pone `Capa`
// (`capa.preact.js`); acá quedó sólo lo que es propio del historial de fallos.
export function PanelFallos({ lista, onMarcarLeidos, onLimpiar }) {
  return html`
    <div class="campanita-panel-head">
      <strong>Fallos de descarga</strong>
      <div class="campanita-acciones">
        <button class="campanita-accion" onClick=${onMarcarLeidos} disabled=${lista.length === 0}>Marcar leídas</button>
        <button class="campanita-accion" onClick=${onLimpiar} disabled=${lista.length === 0}>Limpiar</button>
      </div>
    </div>
    ${lista.length === 0
      ? html`<div class="campanita-vacio">Sin fallos 🎉</div>`
      : html`<ul class="campanita-lista">${lista.map((f) => html`<${FilaFallo} key=${f.id} fallo=${f} />`)}</ul>`}`;
}

export function Campanita({ historial }) {
  const lista = useHistorialFallos(historial);
  const [abierto, setAbierto] = useState(false);
  const noLeidos = lista.reduce((n, f) => (f.leido ? n : n + 1), 0);
  // El contenedor envuelve AL BOTÓN Y AL PANEL. `Capa` lo usa para saber qué es "afuera": sin
  // esto, tocar la campanita estando abierto dispara el cierre por clic-afuera **y** el toggle
  // del botón, se anulan, y el panel no se cierra nunca.
  const contenedor = useRef(null);

  const marcar = () => { if (historial) historial.marcarTodosLeidos(); };
  const limpiar = () => { if (historial) historial.limpiar(); };

  return html`
    <div class="campanita" ref=${contenedor}>
      <${CampanitaBoton} count=${noLeidos} onClick=${() => setAbierto((a) => !a)} />
      <${Capa} variante="anclado"
               abierto=${abierto}
               onCerrar=${() => setAbierto(false)}
               etiqueta="Fallos de descarga"
               clase="campanita-panel"
               contenedorRef=${contenedor}>
        <${PanelFallos} lista=${lista} onMarcarLeidos=${marcar} onLimpiar=${limpiar} />
      <//>
    </div>`;
}

// FASE 7C: la monta el entrypoint del popup con el historial inyectado, no este módulo al
// evaluarse buscando el global.
export function montar(root, { historial } = {}) {
  if (root && historial) {
    render(html`<${Campanita} historial=${historial} />`, root);
  }
}
