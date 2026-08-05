// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/filters.js (FilterFeature).
 * Cubre: el predicado unificado de la pestaña Cola (coincideConFiltrosCola), el
 * filtrado cruzado del listado de disponibles (aplicarFiltrosCruzados), el badge
 * del botón de filtros (actualizarPillsUIState), la (re)habilitación de controles
 * (desbanearFiltros) y el armado del popover (renderizarFiltrosMenuPopover).
 * Mockea AppState + ParserTitulos + nodos. filtrosActivos se pasa por referencia.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FilterFeature from './filters.js';
import { SitioRamonNet } from '../../sitio/ramonnet/config.ts';

function montarNodos() {
  document.body.innerHTML = `
    <input id="ui-search" value="">
    <input id="ui-path-folder" value="biologia">
    <div id="ui-filter-menu"></div>
    <button id="ui-btn-filter-pills"><span>Filtros</span></button>
    <input id="ui-master-check" type="checkbox">
    <button id="ui-btn-sort"></button>
  `;
  return {
    search: document.getElementById('ui-search'),
    folder: document.getElementById('ui-path-folder'),
    filterMenu: document.getElementById('ui-filter-menu'),
    btnFilterPills: document.getElementById('ui-btn-filter-pills'),
    masterCheck: document.getElementById('ui-master-check'),
    btnSort: document.getElementById('ui-btn-sort'),
  };
}

function crearFeature(overrides = {}) {
  const nodos = montarNodos();
  const filtrosActivos = { estados: new Set(), materias: new Set(), valoresFaceta: new Set() };
  const ctx = {
    nodos,
    filtrosActivos,
    sitio: SitioRamonNet,
    renderizar: vi.fn(),
    actualizarContadores: vi.fn(),
    ...overrides,
  };
  // FASE 7C: appState entra por ctx (lo sembró globalThis.AppState más arriba).
  // CORTE 4 (multi-sitio): `sitios` resuelve el portal DE CADA ÍTEM de la cola. Por defecto
  // todo resuelve a Ramón Net —que es el comportamiento de una instalación de un solo
  // portal—; el test de cola mezclada de abajo lo sobreescribe.
  const feature = FilterFeature.crear({
    sitios: { obtener: () => SitioRamonNet },
    ...ctx,
    appState: globalThis.AppState,
  });
  return { feature, ctx, nodos, filtrosActivos };
}

beforeEach(() => {
  globalThis.AppState = {
    listadoClasesGlobal: [],
    colaDescargas: [],
    pestañaActiva: 'disponibles',
    facetaSeleccionada: null,
  };
  // El valor de la faceta para los items de la COLA lo deriva el adaptador de sitio
  // re-parseando el título (SitioRamonNet.clasificarCarpeta → ParserTitulos). Acá se
  // stubea el parser: lo que se testea es el filtrado, no el parseo.
  globalThis.ParserTitulos = {
    clasificarCatedraYCarpeta: (titulo, carpeta) => ({ catedra: 'COMUN', carpeta }),
  };
});

describe('FilterFeature.coincideConFiltrosCola', () => {
  it('sin filtros activos, sólo aplica el texto de búsqueda', () => {
    const { feature } = crearFeature();
    const clase = { titulo: 'Semana 3 Biología', carpeta: 'biologia' };
    expect(feature.coincideConFiltrosCola(clase, 'semana')).toBe(true);
    expect(feature.coincideConFiltrosCola(clase, 'quimica')).toBe(false);
  });

  it('respeta el filtro de materia (case-insensitive por toUpperCase)', () => {
    const { feature, filtrosActivos } = crearFeature();
    filtrosActivos.materias.add('BIOLOGIA');
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'biologia' }, '')).toBe(true);
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'quimica' }, '')).toBe(false);
  });

  it('respeta el filtro de faceta (derivada por el adaptador de sitio)', () => {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, filtrosActivos } = crearFeature();
    filtrosActivos.valoresFaceta.add('A');
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'biologia' }, '')).toBe(true);
    filtrosActivos.valoresFaceta.clear();
    filtrosActivos.valoresFaceta.add('B');
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'biologia' }, '')).toBe(false);
  });

  // EL bug que arregla el corte 4 de docs/multisitio-diseno.md. `ColaItem` no persiste el
  // valor de la faceta: el descriptor lo RE-DERIVA con clasificarCarpeta(), que es específica
  // del portal. Si se re-deriva con el descriptor equivocado, sale un valor plausible pero
  // falso — y sin error, porque el parser devuelve algo igual.
  it('deriva la faceta con el descriptor DEL PORTAL DE CADA ÍTEM, no con el del sitio activo', () => {
    const facetaOtroPortal = { ...SitioRamonNet.faceta, leerDeCola: () => 'COMISION-1' };
    const { feature, filtrosActivos } = crearFeature({
      sitios: {
        obtener: (id) =>
          id === 'otroportal' ? { faceta: facetaOtroPortal } : SitioRamonNet,
      },
    });
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });

    filtrosActivos.valoresFaceta.add('COMISION-1');
    // El ítem del otro portal matchea por SU faceta...
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'otroportal' }, '')
    ).toBe(true);
    // ...y el de Ramón Net no, aunque estén en la misma cola.
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'ramonnet' }, '')
    ).toBe(false);
  });

  it('un ítem huérfano (portal no registrado) no matchea un filtro de faceta activo', () => {
    const { feature, filtrosActivos } = crearFeature({
      sitios: { obtener: (id) => (id === 'ramonnet' ? SitioRamonNet : undefined) },
    });
    filtrosActivos.valoresFaceta.add('A');
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'borrado' }, '')
    ).toBe(false);
  });
});

describe('FilterFeature.aplicarFiltrosCruzados', () => {
  it('marca clase.visible cruzando materia + texto + estado y re-renderiza', () => {
    const { feature, ctx, nodos } = crearFeature();
    nodos.search.value = 'semana';
    nodos.folder.value = 'biologia';
    AppState.listadoClasesGlobal = [
      { titulo: 'Semana 1', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN' },
      { titulo: 'Otra cosa', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN' },
      { titulo: 'Semana 2', carpeta: 'quimica', estado: 'pending', catedra: 'COMUN' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(true);  // coincide texto + materia
    expect(AppState.listadoClasesGlobal[1].visible).toBe(false); // no coincide texto
    expect(AppState.listadoClasesGlobal[2].visible).toBe(false); // otra materia
    expect(ctx.renderizar).toHaveBeenCalled();
    expect(ctx.actualizarContadores).toHaveBeenCalled();
  });

  it('el filtro de estado restringe la visibilidad', () => {
    const { feature, filtrosActivos, nodos } = crearFeature();
    nodos.folder.value = 'biologia';
    filtrosActivos.estados.add('downloaded');
    AppState.listadoClasesGlobal = [
      { titulo: 'A', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN' },
      { titulo: 'B', carpeta: 'biologia', estado: 'downloaded', catedra: 'COMUN' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(false);
    expect(AppState.listadoClasesGlobal[1].visible).toBe(true);
  });
});

describe('FilterFeature.actualizarPillsUIState', () => {
  it('muestra el conteo y togglea .active según filtros activos', () => {
    const { feature, filtrosActivos, nodos } = crearFeature();
    const span = nodos.btnFilterPills.querySelector('span');

    feature.actualizarPillsUIState();
    expect(nodos.btnFilterPills.classList.contains('active')).toBe(false);
    expect(span.textContent).toBe('Filtros');

    filtrosActivos.estados.add('pending');
    filtrosActivos.materias.add('BIOLOGIA');
    feature.actualizarPillsUIState();
    expect(nodos.btnFilterPills.classList.contains('active')).toBe(true);
    expect(span.textContent).toBe('Filtros (2)');
  });
});

describe('FilterFeature.desbanearFiltros', () => {
  it('habilita search/filtros/sort y master según sincronización', () => {
    const { feature, nodos } = crearFeature();
    nodos.search.disabled = true;
    nodos.btnFilterPills.disabled = true;
    nodos.btnSort.disabled = true;
    AppState.sincronizacionDiscoCompletada = false;

    feature.desbanearFiltros();
    expect(nodos.search.disabled).toBe(false);
    expect(nodos.btnFilterPills.disabled).toBe(false);
    expect(nodos.btnSort.disabled).toBe(false);
    expect(nodos.masterCheck.disabled).toBe(true); // no sincronizado

    AppState.sincronizacionDiscoCompletada = true;
    feature.desbanearFiltros();
    expect(nodos.masterCheck.disabled).toBe(false);
  });
});

describe('FilterFeature.renderizarFiltrosMenuPopover', () => {
  it('en Disponibles arma la sección Estado con sus 3 opciones', () => {
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [];

    feature.renderizarFiltrosMenuPopover();

    const titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Estado');
    const opciones = [...nodos.filterMenu.querySelectorAll('.popover-option span')].map(s => s.textContent);
    expect(opciones).toEqual(expect.arrayContaining(['Pendientes', 'Descargados', 'En Fila']));
  });

  it('marcar una opción de Estado muta filtrosActivos y dispara el re-filtrado', () => {
    const { feature, filtrosActivos, ctx, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    feature.renderizarFiltrosMenuPopover();

    const checkPendientes = [...nodos.filterMenu.querySelectorAll('.popover-option')]
      .find(l => l.querySelector('span').textContent === 'Pendientes')
      .querySelector('input');
    checkPendientes.checked = true;
    checkPendientes.dispatchEvent(new Event('change'));

    expect(filtrosActivos.estados.has('pending')).toBe(true);
    expect(ctx.renderizar).toHaveBeenCalled();
  });

  it('en Cola arma Materia + Cátedra derivadas de la cola', () => {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'cola';
    AppState.colaDescargas = [{ titulo: 'x', carpeta: 'biologia' }];

    feature.renderizarFiltrosMenuPopover();

    const titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Materia');
    expect(titulos).toContain('Cátedra');
    const opciones = [...nodos.filterMenu.querySelectorAll('.popover-option span')].map(s => s.textContent);
    expect(opciones).toContain('📁 BIOLOGIA');
    expect(opciones).toContain('🎓 Cat A');
  });
});
