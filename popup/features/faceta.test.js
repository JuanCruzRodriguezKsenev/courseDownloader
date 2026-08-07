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
  // FASE 7C: `appState` entra por ctx, no por globalThis. El test lo sigue sembrando en
  // `globalThis.AppState` a propósito —así el harness no cambia y ninguna aserción se toca—;
  // lo único nuevo es que acá se lo pasamos explícito, como hace popup.js.
  // CORTE 5: `sitio` es una FUNCIÓN. El popup resuelve el portal por pestaña, así que el
  // descriptor puede cambiar entre dos escaneos y la feature no puede capturarlo.
  // MULTIPORTAL A: `sitios` resuelve el portal de CADA clase del listado, que puede traer
  // ítems encolados de otro portal. Por defecto todo cae en Ramón Net, que es el
  // comportamiento de una instalación de un solo portal.
  const feature = FacetaFeature.crear({
    badge,
    aplicarFiltros,
    sitio: () => SitioRamonNet,
    sitios: { obtener: () => SitioRamonNet },
    appState: globalThis.AppState,
    ...overrides,
  });
  return { feature, badge, aplicarFiltros };
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  globalThis.AppState = {
    listadoClasesGlobal: [],
    facetaSeleccionada: null,
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
    AppState.facetaSeleccionada = 'A';
    const { feature, badge } = crearFeature();

    feature.actualizarBadge();

    expect(badge.style.display).toBe('inline-flex');
    expect(badge.textContent).toBe('Cátedra A');
    expect(badge.title).toBe('Hacé click para cambiar de Cátedra');
  });

  it('un solo valor: oculta el badge y limpia la selección huérfana', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.facetaSeleccionada = 'A'; // huérfana: ya no hay varios valores
    const { feature, badge } = crearFeature();

    feature.actualizarBadge();

    expect(badge.style.display).toBe('none');
    expect(AppState.facetaSeleccionada).toBeNull();
    expect(AppState.respaldar).toHaveBeenCalled();
  });

  it('varios valores sin elección: oculta el badge sin tocar el estado', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }];
    AppState.facetaSeleccionada = null;
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
    expect(AppState.facetaSeleccionada).toBe('A');
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
    AppState.facetaSeleccionada = null;
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
    AppState.facetaSeleccionada = 'A';
    const { feature, aplicarFiltros } = crearFeature();

    feature.verificarYMostrarAsistente();

    expect(document.querySelector('.faceta-overlay')).toBeNull();
    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(true);
    expect(aplicarFiltros).toHaveBeenCalled();
  });

  it('un solo valor: resetea la selección a null', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.facetaSeleccionada = 'A';
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistente();

    expect(AppState.facetaSeleccionada).toBeNull();
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

    expect(AppState.facetaSeleccionada).toBe('B');
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
    // El registro resuelve al mismo portal: estas clases son de él. Sin esto, el filtro por
    // portal del corte multiportal A las dejaría fuera del listado, que es lo correcto.
    const { feature, badge } = crearFeature({
      sitio: () => SitioFalso,
      sitios: { obtener: () => SitioFalso },
    });

    feature.verificarYMostrarAsistente();

    const overlay = document.querySelector('.faceta-overlay');
    expect(overlay.querySelector('h4').textContent).toBe('Varias comisiones');
    const labels = [...overlay.querySelectorAll('.btn-faceta-opt')].map(b => b.textContent);
    expect(labels).toEqual(['Comisión 1', 'Comisión 2']); // 'GENERAL' no es una opción

    overlay.querySelectorAll('.btn-faceta-opt')[0].click();

    expect(AppState.comisionSeleccionada).toBe('1');
    expect(AppState.facetaSeleccionada).toBeNull();                 // no tocó la clave del otro sitio
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(true);  // comisión 1
    expect(AppState.listadoClasesGlobal[2].seleccionado).toBe(true);  // GENERAL entra
    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(false); // comisión 2 no
    expect(badge.textContent).toBe('Comisión 1');
  });
});

// [MULTISITIO CORTE 5] El popup resuelve el portal por pestaña, así que el descriptor puede
// cambiar entre dos escaneos. Esta feature NO puede capturarlo al crearse: si lo hiciera,
// seguiría clasificando con el vocabulario del portal anterior y nada lo avisaría.
describe('FacetaFeature — el descriptor se re-lee, no se captura (corte 5)', () => {
  it('cambiar el portal activo cambia el vocabulario que usa el badge', () => {
    // Doble mínimo, sin spread del descriptor real: `SitioRamonNet` tiene getters
    // (`escanearListado` lee el global `Scraper`) que un spread evaluaría acá.
    const OTRO = {
      id: 'otroportal',
      faceta: { ...SitioRamonNet.faceta, etiqueta: 'Comisión', etiquetar: (v) => `Comisión ${v}` },
    };
    let actual = SitioRamonNet;
    // El registro sigue al portal activo: lo que se afirma acá es la re-lectura del
    // vocabulario, no la mezcla de portales (eso lo cubre filters.test.js).
    const { feature, badge } = crearFeature({ sitio: () => actual, sitios: { obtener: () => actual } });

    AppState.listadoClasesGlobal = [
      { titulo: 'a', catedra: 'A', estado: 'pending' },
      { titulo: 'b', catedra: 'B', estado: 'pending' },
    ];
    AppState.facetaSeleccionada = 'A';

    feature.actualizarBadge();
    expect(badge.textContent).toBe('Cátedra A');

    // Se cambia el portal activo, como haría un escaneo sobre otra pestaña.
    actual = OTRO;
    feature.actualizarBadge();
    expect(badge.textContent).toBe('Comisión A');
    // El tooltip también: se refresca en cada actualizarBadge, no una sola vez al crear.
    expect(badge.title).toContain('Comisión');
  });
});

// [MULTIPORTAL A] El listado puede traer ítems encolados de otro portal (popup.js los preserva
// entre escaneos). Derivarles la faceta con ESTE descriptor ofrecía en el modal valores que no
// existen — y sin fallar, porque el parser siempre devuelve algo.
describe('FacetaFeature — el modal sólo mira las clases del portal activo (multiportal A)', () => {
  it('ignora los valores de faceta de clases de otro portal', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false, sitioId: 'ramonnet' },
      { catedra: 'COMUN', estado: 'pending', seleccionado: false, sitioId: 'ramonnet' },
      // Encolada desde otro portal: su "cátedra" no es una cátedra.
      { catedra: 'ZZZ', estado: 'process', seleccionado: false, sitioId: 'otroportal' },
    ];
    const { feature } = crearFeature({
      sitios: { obtener: (id) => (id === 'otroportal' ? { id: 'otroportal' } : SitioRamonNet) },
    });

    feature.verificarYMostrarAsistente();

    // Un solo valor propio ('A'): no corresponde modal. Con el ítem ajeno contado serían dos
    // y se habría abierto, ofreciendo "Cátedra ZZZ".
    expect(document.querySelector('.faceta-overlay')).toBeNull();
    expect(AppState.facetaSeleccionada).toBeNull();
  });
});
