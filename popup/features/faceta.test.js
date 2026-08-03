// @vitest-environment jsdom
/**
 * Test del módulo popup/features/faceta.js (FacetaFeature), genérico.
 * Cubre: el badge (visible/oculto según haya varios valores + limpieza de selección
 * huérfana), la autoselección silenciosa (marca 'seleccionado' en los pending del
 * valor elegido + el común), el asistente (modal / selección persistida / reseteo) y
 * el modal (opciones ordenadas + click). Mockea AppState + el nodo del badge.
 *
 * El último bloque es el que justifica la generalización: el MISMO mecanismo con un
 * descriptor de otro sitio (comisiones en vez de cátedras) debe funcionar igual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FacetaFeature from './faceta.js';
import { SitioRamonNet } from '../../sitio/ramonnet/config.ts';

function crearFeature(overrides = {}) {
  document.body.innerHTML = `<span id="ui-faceta-badge" style="display:none"></span>`;
  const badge = document.getElementById('ui-faceta-badge');
  const aplicarFiltros = vi.fn();
  const feature = FacetaFeature.crear({ badge, aplicarFiltros, sitio: SitioRamonNet, ...overrides });
  return { feature, badge, aplicarFiltros };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  globalThis.AppState = {
    listadoClasesGlobal: [],
    catedraSeleccionada: null,
    respaldar: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.AppState;
  document.querySelector('.faceta-overlay')?.remove();
});

describe('FacetaFeature.actualizarBadge', () => {
  it('varios valores con uno elegido: muestra el badge con el texto del sitio', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A';
    const { feature, badge } = crearFeature();

    feature.actualizarBadge();

    expect(badge.style.display).toBe('inline-flex');
    expect(badge.textContent).toBe('Cátedra A');
    expect(badge.title).toBe('Hacé click para cambiar de Cátedra');
  });

  it('un solo valor: oculta el badge y limpia la selección huérfana', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A'; // huérfana: ya no hay varios valores
    const { feature, badge } = crearFeature();

    feature.actualizarBadge();

    expect(badge.style.display).toBe('none');
    expect(AppState.catedraSeleccionada).toBeNull();
    expect(AppState.respaldar).toHaveBeenCalled();
  });

  it('varios valores sin elección: oculta el badge sin tocar el estado', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }];
    AppState.catedraSeleccionada = null;
    const { feature, badge } = crearFeature();

    feature.actualizarBadge();

    expect(badge.style.display).toBe('none');
    expect(AppState.respaldar).not.toHaveBeenCalled();
  });
});

describe('FacetaFeature.aplicarSeleccionSilenciosa', () => {
  it('marca seleccionado en los pending del valor elegido + el común, no en el resto', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: true },
      { catedra: 'COMUN', estado: 'pending', seleccionado: false },
      { catedra: 'A', estado: 'downloaded', seleccionado: false }, // no-pending: intacto
    ];
    AppState.listadoClasesGlobal.push({ catedra: 'A' }, { catedra: 'B' }); // asegurar varios
    const { feature, aplicarFiltros } = crearFeature();

    feature.aplicarSeleccionSilenciosa('A');

    const [a, b, comun, aDescargada] = AppState.listadoClasesGlobal;
    expect(AppState.catedraSeleccionada).toBe('A');
    expect(a.seleccionado).toBe(true);   // pending A
    expect(b.seleccionado).toBe(false);  // pending B (deseleccionada)
    expect(comun.seleccionado).toBe(true); // el valor común siempre entra
    expect(aDescargada.seleccionado).toBe(false); // no-pending no se toca
    expect(aplicarFiltros).toHaveBeenCalled();
    expect(AppState.respaldar).toHaveBeenCalled();
  });
});

describe('FacetaFeature.verificarYMostrarAsistente', () => {
  it('varios valores sin selección previa: muestra el modal con las opciones ordenadas', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'C' }, { catedra: 'A' }, { catedra: 'B' }];
    AppState.catedraSeleccionada = null;
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistente();

    const overlay = document.querySelector('.faceta-overlay');
    expect(overlay).not.toBeNull();
    const labels = [...overlay.querySelectorAll('.btn-faceta-opt')].map(b => b.textContent);
    expect(labels).toEqual(['Cátedra A', 'Cátedra B', 'Cátedra C']); // ordenadas
  });

  it('el modal pinta el copy del descriptor del sitio', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }];
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistente();

    const card = document.querySelector('.faceta-card');
    expect(card.querySelector('h4').textContent).toBe(SitioRamonNet.faceta.modal.titulo);
    expect(card.querySelector('p').textContent).toBe(SitioRamonNet.faceta.modal.descripcion);
  });

  it('selección persistida válida: aplica silencioso, sin modal', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: false },
    ];
    AppState.catedraSeleccionada = 'A';
    const { feature, aplicarFiltros } = crearFeature();

    feature.verificarYMostrarAsistente();

    expect(document.querySelector('.faceta-overlay')).toBeNull();
    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(true);
    expect(aplicarFiltros).toHaveBeenCalled();
  });

  it('un solo valor: resetea la selección a null', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A';
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistente();

    expect(AppState.catedraSeleccionada).toBeNull();
    expect(document.querySelector('.faceta-overlay')).toBeNull();
  });
});

describe('FacetaFeature — click en el badge y modal', () => {
  it('click en el badge con varios valores abre el modal; elegir aplica y cierra', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: false },
    ];
    const { badge, aplicarFiltros } = crearFeature();

    badge.click();
    const overlay = document.querySelector('.faceta-overlay');
    expect(overlay).not.toBeNull();

    // Elegir "Cátedra B" aplica la selección y remueve el overlay.
    const botones = [...overlay.querySelectorAll('.btn-faceta-opt')];
    botones.find(b => b.textContent === 'Cátedra B').click();

    expect(AppState.catedraSeleccionada).toBe('B');
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(true);
    expect(aplicarFiltros).toHaveBeenCalled();
    expect(document.querySelector('.faceta-overlay')).toBeNull();
  });

  it('click en el badge con un solo valor no abre modal', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    const { badge } = crearFeature();

    badge.click();

    expect(document.querySelector('.faceta-overlay')).toBeNull();
  });
});

/**
 * La prueba de que la generalización sirve: otro sitio, con otro nombre de faceta,
 * otro centinela de "común", otra clave de estado y otro campo en el item — sin tocar
 * una línea de faceta.js.
 */
describe('FacetaFeature — con el descriptor de OTRO sitio', () => {
  const SitioFalso = {
    id: 'otro-portal',
    faceta: {
      id: 'comision',
      etiqueta: 'Comisión',
      icono: '👥',
      valorComun: 'GENERAL',
      valorTodas: 'TODAS',
      claveEstado: 'comisionSeleccionada',
      leer: (clase) => clase.comision,
      etiquetar: (v) => (v === 'GENERAL' ? 'General' : `Comisión ${v}`),
      etiquetarCorto: (v) => (v === 'GENERAL' ? 'General' : `Com ${v}`),
      ordenar: (a, b) => a.localeCompare(b),
      modal: { titulo: 'Varias comisiones', descripcion: '¿Cuál cursás?' },
    },
  };

  beforeEach(() => {
    AppState.comisionSeleccionada = null;
  });

  it('badge, modal y autoselección usan el vocabulario del otro sitio', () => {
    AppState.listadoClasesGlobal = [
      { comision: '2', estado: 'pending', seleccionado: false },
      { comision: '1', estado: 'pending', seleccionado: false },
      { comision: 'GENERAL', estado: 'pending', seleccionado: false },
    ];
    const { feature, badge } = crearFeature({ sitio: SitioFalso });

    feature.verificarYMostrarAsistente();

    const overlay = document.querySelector('.faceta-overlay');
    expect(overlay.querySelector('h4').textContent).toBe('Varias comisiones');
    const labels = [...overlay.querySelectorAll('.btn-faceta-opt')].map(b => b.textContent);
    expect(labels).toEqual(['Comisión 1', 'Comisión 2']); // 'GENERAL' no es una opción

    overlay.querySelectorAll('.btn-faceta-opt')[0].click();

    expect(AppState.comisionSeleccionada).toBe('1');
    expect(AppState.catedraSeleccionada).toBeNull();                 // no tocó la clave del otro sitio
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(true);  // comisión 1
    expect(AppState.listadoClasesGlobal[2].seleccionado).toBe(true);  // GENERAL entra
    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(false); // comisión 2 no
    expect(badge.textContent).toBe('Comisión 1');
  });
});
