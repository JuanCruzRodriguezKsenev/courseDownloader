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
    <span id="ui-master-select-wrapper"></span>
    <button id="ui-btn-sort"></button>
    <button id="ui-btn-toggle-select">Seleccionar</button>
  `;
  return {
    search: document.getElementById('ui-search'),
    folder: document.getElementById('ui-path-folder'),
    filterMenu: document.getElementById('ui-filter-menu'),
    btnFilterPills: document.getElementById('ui-btn-filter-pills'),
    masterCheck: document.getElementById('ui-master-check'),
    btnSort: document.getElementById('ui-btn-sort'),
    btnToggleSelect: document.getElementById('ui-btn-toggle-select'),
  };
}

function crearFeature(overrides = {}) {
  const nodos = montarNodos();
  const filtrosActivos = {
    estados: new Set(),
    materias: new Set(),
    valoresFaceta: new Set(),
    portales: new Set(),
    // [ESCANEO-API CORTE 5] Vacío, igual que en producción: el filtro por tipo no tiene default.
    tipos: new Set(),
  };
  const ctx = {
    nodos,
    filtrosActivos,
    // CORTE 5: `sitio` es una FUNCIÓN (ver el harness de faceta.test.js).
    sitio: () => SitioRamonNet,
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

/**
 * Doble de registro con DOS portales, que es lo único que hace visible el corte 6C: con un
 * solo portal la sección Portal no se dibuja y la pantalla queda igual que antes.
 * El segundo portal trae su propio vocabulario de faceta (comisiones, no cátedras).
 */
function sitiosDeDosPortales() {
  const otro = {
    id: 'otroportal',
    nombre: 'Otro Portal',
    faceta: {
      ...SitioRamonNet.faceta,
      etiqueta: 'Comisión',
      icono: '🏫',
      etiquetarCorto: (v) => `Com ${v}`,
      leerDeCola: (c) => c.comision ?? '1',
    },
  };
  return { obtener: (id) => (id === 'otroportal' ? otro : SitioRamonNet) };
}

beforeEach(() => {
  globalThis.AppState = {
    listadoClasesGlobal: [],
    colaDescargas: [],
    pestañaActiva: 'disponibles',
    facetasElegidas: {},
    facetaElegidaDe(sitioId) { return this.facetasElegidas[sitioId] ?? null; },
    fijarFacetaElegida(sitioId, valor) {
      if (valor === null) delete this.facetasElegidas[sitioId];
      else this.facetasElegidas[sitioId] = valor;
    },
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

  // CORTE 6C: el valor va CALIFICADO por portal (`sitioId|valor`). Antes de este corte el Set
  // guardaba el valor pelado; se cambió porque dos portales pueden tener una faceta con la
  // misma etiqueta y marcar una filtraba las dos.
  it('respeta el filtro de faceta (derivada por el adaptador de sitio)', () => {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, filtrosActivos } = crearFeature();
    filtrosActivos.valoresFaceta.add('ramonnet|A');
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'biologia' }, '')).toBe(true);
    filtrosActivos.valoresFaceta.clear();
    filtrosActivos.valoresFaceta.add('ramonnet|B');
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
          id === 'otroportal'
            ? { id: 'otroportal', nombre: 'Otro Portal', faceta: facetaOtroPortal }
            : SitioRamonNet,
      },
    });
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });

    filtrosActivos.valoresFaceta.add('otroportal|COMISION-1');
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
    filtrosActivos.valoresFaceta.add('ramonnet|A');
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'borrado' }, '')
    ).toBe(false);
  });

  // --- CORTE 6C: el filtro maestro por portal -------------------------------------------
  it('el filtro por portal muestra el portal entero cuando no hay faceta marcada', () => {
    const { feature, filtrosActivos } = crearFeature({ sitios: sitiosDeDosPortales() });

    filtrosActivos.portales.add('otroportal');
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'otroportal' }, '')
    ).toBe(true);
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'ramonnet' }, '')
    ).toBe(false);
  });

  // El caso que justifica calificar por portal: dos portales con una faceta de la MISMA
  // etiqueta. Sin el prefijo, marcar "A" en uno filtraba también al otro.
  it('dos portales con una faceta de la misma etiqueta no se pisan', () => {
    const facetaA = { ...SitioRamonNet.faceta, leerDeCola: () => 'A' };
    const { feature, filtrosActivos } = crearFeature({
      sitios: {
        obtener: (id) =>
          id === 'otroportal'
            ? { id: 'otroportal', nombre: 'Otro Portal', faceta: facetaA }
            : SitioRamonNet,
      },
    });
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });

    filtrosActivos.valoresFaceta.add('otroportal|A');
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'otroportal' }, '')
    ).toBe(true);
    // Mismo valor de faceta ("A"), otro portal: NO matchea.
    expect(
      feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio', sitioId: 'ramonnet' }, '')
    ).toBe(false);
  });

  // Un ítem anterior al multi-sitio no trae `sitioId`; el resolvedor lo migra al portal
  // legado. La clave se arma con el id DEL DESCRIPTOR, así que cae en el grupo correcto.
  it('un ítem sin sitioId (dato viejo) se califica con el portal legado', () => {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, filtrosActivos } = crearFeature();
    filtrosActivos.valoresFaceta.add('ramonnet|A');
    expect(feature.coincideConFiltrosCola({ titulo: 'x', carpeta: 'bio' }, '')).toBe(true);
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

  // [LA SELECCIÓN SIGUE AL FILTRO] Sin esto la selección quedaba invisible y operante: "Todos"
  // sin filtro marcaba las 103, filtrabas a 12 en pantalla y el botón seguía ofreciendo —y
  // encolando— las 103, porque el conteo lee `seleccionado` y no `visible`.
  it('deselecciona lo que el filtro deja fuera', () => {
    const { feature, nodos } = crearFeature();
    nodos.search.value = 'semana';
    nodos.folder.value = 'biologia';
    AppState.listadoClasesGlobal = [
      { titulo: 'Semana 1', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', seleccionado: true },
      { titulo: 'Otra cosa', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', seleccionado: true },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(true);  // sigue visible
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(false); // la filtró el texto
  });

  it('no toca la selección de lo que sigue visible al re-aplicar el filtro', () => {
    const { feature, nodos } = crearFeature();
    nodos.folder.value = 'biologia';
    AppState.listadoClasesGlobal = [
      { titulo: 'A', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', seleccionado: true },
      { titulo: 'B', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', seleccionado: false },
    ];

    feature.aplicarFiltrosCruzados();
    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(true);
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(false);
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
  // "Todos" ahora tiene DOS condiciones, así que los casos que sólo miran la sincronización
  // necesitan que además haya algo seleccionable; si no, se apaga por la otra razón.
  function conUnaSeleccionable() {
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ titulo: 'A', visible: true, estado: 'pending' }];
  }

  it('habilita search/filtros/sort y master según sincronización', () => {
    const { feature, nodos } = crearFeature();
    conUnaSeleccionable();
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

  /**
   * El defecto que cierra esto: con "Todos" marcado y el filtro puesto en "descargados", el
   * control quedaba encendido, aceptaba el clic y NO hacía nada (la selección masiva sólo toca
   * las `pending`), y el repintado lo devolvía a desmarcado. Ofrecía una acción inexistente.
   */
  it('apaga "Todos" cuando el filtro no dejó nada seleccionable', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    // Lo que deja en pantalla filtrar por "descargados": visibles, pero ninguna marcable.
    AppState.listadoClasesGlobal = [
      { titulo: 'A', visible: true, estado: 'downloaded' },
      { titulo: 'B', visible: true, estado: 'downloaded' },
    ];

    feature.desbanearFiltros();

    expect(nodos.masterCheck.disabled).toBe(true);
    const wrapper = document.getElementById('ui-master-select-wrapper');
    expect(wrapper.getAttribute('aria-disabled')).toBe('true');
    expect(wrapper.title).toBe('No hay clases seleccionables con este filtro');
  });

  it('alcanza UNA pendiente visible para que vuelva a encenderse', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'A', visible: true, estado: 'downloaded' },
      { titulo: 'B', visible: true, estado: 'pending' },
    ];

    feature.desbanearFiltros();
    expect(nodos.masterCheck.disabled).toBe(false);
    expect(document.getElementById('ui-master-select-wrapper').getAttribute('aria-disabled')).toBe('false');
  });

  it('no cuenta las pendientes que el filtro escondió (visible: false)', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'A', visible: true, estado: 'downloaded' },
      { titulo: 'B', visible: false, estado: 'pending' }, // pendiente, pero fuera de pantalla
    ];

    feature.desbanearFiltros();
    expect(nodos.masterCheck.disabled).toBe(true);
  });

  it('distingue las dos causas en el title: sin sincronizar no es lo mismo que sin seleccionables', () => {
    const { feature } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ titulo: 'A', visible: true, estado: 'pending' }];
    AppState.sincronizacionDiscoCompletada = false;

    feature.desbanearFiltros();
    expect(document.getElementById('ui-master-select-wrapper').title)
      .toBe('Esperando la sincronización con el disco');
  });
});

describe('FilterFeature: ordenar y "Seleccionar" siguen a "hay algo en pantalla"', () => {
  it('los apaga cuando el filtro no dejó NINGUNA clase visible', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ titulo: 'A', visible: false, estado: 'pending' }];

    feature.desbanearFiltros();
    expect(nodos.btnSort.disabled).toBe(true);
    expect(nodos.btnToggleSelect.disabled).toBe(true);
  });

  /**
   * El caso que separa los dos predicados, y la razón de que no se compartan: filtrando por
   * "descargados" hay clases en pantalla y ninguna marcable. "Todos" no tiene qué marcar;
   * ordenar dos descargadas sí tiene sentido. Copiar un predicado en el otro apaga un control
   * que sirve.
   */
  it('ordenar sigue ENCENDIDO con clases visibles no seleccionables, aunque "Todos" se apague', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'A', visible: true, estado: 'downloaded' },
      { titulo: 'B', visible: true, estado: 'downloaded' },
    ];

    feature.desbanearFiltros();
    expect(nodos.btnSort.disabled).toBe(false);      // hay 2 clases que ordenar
    expect(nodos.masterCheck.disabled).toBe(true);   // pero ninguna que marcar
  });

  it('el buscador y los filtros NO se apagan nunca por el resultado: son la salida', () => {
    const { feature, nodos } = crearFeature();
    AppState.sincronizacionDiscoCompletada = true;
    AppState.pestañaActiva = 'disponibles';
    // Cero visibles: el peor caso, y justo cuando más se necesita poder sacar el filtro.
    AppState.listadoClasesGlobal = [{ titulo: 'A', visible: false, estado: 'pending' }];

    feature.desbanearFiltros();
    expect(nodos.search.disabled).toBe(false);
    expect(nodos.btnFilterPills.disabled).toBe(false);
  });
});

describe('FilterFeature.hayVisibles', () => {
  it('en la Cola SÍ cuenta la que se está bajando (a diferencia de haySeleccionablesVisibles)', () => {
    const { feature } = crearFeature();
    AppState.pestañaActiva = 'cola';
    AppState.ráfagaEnCurso = true;
    AppState.videoActualEnTransmisiónSW = 'La que baja';
    AppState.colaDescargas = [{ titulo: 'La que baja', materia: 'x', sitioId: 'ramonnet' }];

    expect(feature.hayVisibles()).toBe(true);              // ocupa un renglón: se puede ordenar
    expect(feature.haySeleccionablesVisibles()).toBe(false); // pero no se la puede desmarcar
  });
});

describe('FilterFeature.haySeleccionablesVisibles', () => {
  it('en la Cola no cuenta la que se está bajando: no se la puede desmarcar', () => {
    const { feature } = crearFeature();
    AppState.pestañaActiva = 'cola';
    AppState.ráfagaEnCurso = true;
    AppState.videoActualEnTransmisiónSW = 'La que baja';
    AppState.colaDescargas = [{ titulo: 'La que baja', materia: 'x', sitioId: 'ramonnet' }];

    expect(feature.haySeleccionablesVisibles()).toBe(false);
  });

  it('en la Cola cuenta las demás', () => {
    const { feature } = crearFeature();
    AppState.pestañaActiva = 'cola';
    AppState.ráfagaEnCurso = true;
    AppState.videoActualEnTransmisiónSW = 'La que baja';
    AppState.colaDescargas = [
      { titulo: 'La que baja', materia: 'x', sitioId: 'ramonnet' },
      { titulo: 'Otra', materia: 'x', sitioId: 'ramonnet' },
    ];

    expect(feature.haySeleccionablesVisibles()).toBe(true);
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
    // Con UN solo portal no hay sección Portal: la pantalla queda idéntica a la de antes
    // del corte 6C, que era la condición de la forma elegida.
    expect(titulos).not.toContain('Portal');
  });
});

// --- CORTE 6C: la sección Portal ---------------------------------------------------------
// Nada de esto se puede ver hoy en el navegador: exige la cola mezclada y hay un solo portal
// registrado. Hasta el corte 7, estos tests son la única observación que tiene.
describe('FilterFeature.renderizarFiltrosMenuPopover — sección Portal (corte 6C)', () => {
  const colaMezclada = () => ([
    { titulo: 'a', carpeta: 'biologia', sitioId: 'ramonnet' },
    { titulo: 'b', carpeta: 'biologia', sitioId: 'otroportal', comision: '2' },
  ]);

  function montarMezclada(overrides = {}) {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const armado = crearFeature({ sitios: sitiosDeDosPortales(), ...overrides });
    AppState.pestañaActiva = 'cola';
    AppState.colaDescargas = colaMezclada();
    armado.feature.renderizarFiltrosMenuPopover();
    return armado;
  }

  const etiquetas = (nodos) =>
    [...nodos.filterMenu.querySelectorAll('.popover-option span')].map(s => s.textContent);

  const opcionPorTexto = (nodos, texto) =>
    [...nodos.filterMenu.querySelectorAll('.popover-option')]
      .find(l => l.querySelector('span').textContent === texto);

  it('con la cola mezclada arma la sección Portal, con cada portal y SUS facetas anidadas', () => {
    const { nodos } = montarMezclada();

    const titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Portal');

    // Cada portal, con el vocabulario de faceta que le corresponde: cátedras en uno,
    // comisiones en el otro. Es la razón de que la sección sea en cascada.
    expect(etiquetas(nodos)).toEqual(expect.arrayContaining([
      'Ramón Net', '🎓 Cat A', 'Otro Portal', '🏫 Com 2',
    ]));

    expect(opcionPorTexto(nodos, 'Ramón Net').classList.contains('maestra')).toBe(true);
    expect(opcionPorTexto(nodos, '🏫 Com 2').classList.contains('anidada')).toBe(true);
  });

  it('marcar la maestra filtra el portal entero', () => {
    const { nodos, filtrosActivos, ctx } = montarMezclada();

    const check = opcionPorTexto(nodos, 'Otro Portal').querySelector('input');
    check.checked = true;
    check.dispatchEvent(new Event('change'));

    expect(filtrosActivos.portales.has('otroportal')).toBe(true);
    expect(ctx.renderizar).toHaveBeenCalled();
  });

  it('desmarcar la maestra se lleva las facetas de ESE portal, y no las del otro', () => {
    const { nodos, filtrosActivos } = montarMezclada();
    filtrosActivos.portales.add('otroportal');
    filtrosActivos.valoresFaceta.add('otroportal|2');
    filtrosActivos.valoresFaceta.add('ramonnet|A');

    const check = opcionPorTexto(nodos, 'Otro Portal').querySelector('input');
    check.checked = false;
    check.dispatchEvent(new Event('change'));

    expect(filtrosActivos.portales.has('otroportal')).toBe(false);
    // Dejarla suelta seguiría filtrando por un portal que en pantalla figura apagado.
    expect(filtrosActivos.valoresFaceta.has('otroportal|2')).toBe(false);
    expect(filtrosActivos.valoresFaceta.has('ramonnet|A')).toBe(true);
  });

  it('la maestra queda indeterminada con algunas de sus facetas marcadas, no todas', () => {
    // Tres comisiones en el otro portal, para poder marcar una sola.
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, nodos, filtrosActivos } = crearFeature({ sitios: sitiosDeDosPortales() });
    AppState.pestañaActiva = 'cola';
    AppState.colaDescargas = [
      { titulo: 'a', carpeta: 'bio', sitioId: 'ramonnet' },
      { titulo: 'b', carpeta: 'bio', sitioId: 'otroportal', comision: '1' },
      { titulo: 'c', carpeta: 'bio', sitioId: 'otroportal', comision: '2' },
    ];

    filtrosActivos.valoresFaceta.add('otroportal|1');
    feature.renderizarFiltrosMenuPopover();

    const maestra = opcionPorTexto(nodos, 'Otro Portal').querySelector('input');
    expect(maestra.indeterminate).toBe(true);
    // Marcada aunque nadie tocó la maestra: su estado se deriva de las facetas.
    expect(maestra.checked).toBe(true);

    filtrosActivos.valoresFaceta.add('otroportal|2');
    feature.renderizarFiltrosMenuPopover();
    expect(opcionPorTexto(nodos, 'Otro Portal').querySelector('input').indeterminate).toBe(false);
  });

  it('un huérfano no aparece como portal ni rompe la sección', () => {
    ParserTitulos.clasificarCatedraYCarpeta = (t, c) => ({ catedra: 'A', carpeta: c });
    const { feature, nodos } = crearFeature({ sitios: sitiosDeDosPortales() });
    AppState.pestañaActiva = 'cola';
    AppState.colaDescargas = [...colaMezclada(), { titulo: 'z', carpeta: 'bio', sitioId: 'borrado' }];

    feature.renderizarFiltrosMenuPopover();

    // Sin descriptor no hay nombre que mostrar ni faceta que derivar; se lo omite en vez de
    // adivinar, que es lo que ADR-0010 previene.
    expect(etiquetas(nodos)).toEqual(expect.arrayContaining(['Ramón Net', 'Otro Portal']));
    expect(etiquetas(nodos).filter(e => e === 'undefined')).toHaveLength(0);
  });

  it('el badge de filtros cuenta también los portales', () => {
    const { feature, filtrosActivos, nodos } = crearFeature();
    filtrosActivos.portales.add('ramonnet');
    feature.actualizarPillsUIState();
    expect(nodos.btnFilterPills.querySelector('span').textContent).toBe('Filtros (1)');
  });
});

// [MULTISITIO CORTE 5] Mismo motivo que en faceta.test.js: el descriptor se re-lee en cada
// llamada, no se captura al crear la feature. Sólo afecta a Disponibles — la Cola resuelve
// por ítem desde el corte 4, que es un mecanismo distinto.
describe('FilterFeature — el descriptor se re-lee, no se captura (corte 5)', () => {
  it('cambiar el portal activo cambia el título de la sección de faceta', () => {
    // El doble lleva `id` porque desde el corte multiportal A el listado se filtra por portal:
    // un descriptor sin id no matchea ninguna clase y la sección no se dibujaría.
    const OTRO = { id: 'otroportal', faceta: { ...SitioRamonNet.faceta, etiqueta: 'Comisión' } };
    let actual = SitioRamonNet;
    const { feature, nodos } = crearFeature({ sitio: () => actual, sitios: sitiosDeDosPortales() });

    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'a', catedra: 'A', carpeta: 'bio', estado: 'pending', sitioId: 'ramonnet' },
      { titulo: 'b', catedra: 'A', carpeta: 'bio', estado: 'pending', sitioId: 'otroportal' },
    ];

    feature.renderizarFiltrosMenuPopover();
    let titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Cátedra');

    actual = OTRO;
    feature.renderizarFiltrosMenuPopover();
    titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Comisión');
    expect(titulos).not.toContain('Cátedra');
  });
});

// [MULTIPORTAL A] Disponibles muestra UN portal: el de la pestaña escaneada.
// `listadoClasesGlobal` puede tener ítems de dos portales porque `popup.js` preserva entre
// escaneos lo que está en la cola. Sin filtrar, se los clasificaba con el descriptor activo.
describe('FilterFeature — Disponibles es de un solo portal (multiportal A)', () => {
  it('oculta del listado las clases de otro portal', () => {
    const { feature, nodos } = crearFeature({ sitios: sitiosDeDosPortales() });
    nodos.folder.value = 'biologia';
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'Propia', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', sitioId: 'ramonnet' },
      { titulo: 'Ajena', carpeta: 'biologia', estado: 'process', catedra: 'COMUN', sitioId: 'otroportal' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(true);
    expect(AppState.listadoClasesGlobal[1].visible).toBe(false);
  });

  // Ausente ≠ desconocido, la distinción del corte 3: un ítem anterior al multi-sitio es del
  // portal legado, así que se ve cuando el legado es el activo.
  it('una clase sin sitioId se trata como del portal legado, no como comodín', () => {
    const { feature, nodos } = crearFeature({ sitios: sitiosDeDosPortales() });
    nodos.folder.value = 'biologia';
    AppState.listadoClasesGlobal = [
      { titulo: 'Vieja', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN' },
    ];

    feature.aplicarFiltrosCruzados();

    // El sitio activo del harness es Ramón Net, que es el legado: se ve.
    expect(AppState.listadoClasesGlobal[0].visible).toBe(true);
  });

  it('un huérfano no se muestra en ningún portal', () => {
    const { feature, nodos } = crearFeature({
      sitios: { obtener: (id) => (id === 'ramonnet' ? SitioRamonNet : undefined) },
    });
    nodos.folder.value = 'biologia';
    AppState.listadoClasesGlobal = [
      { titulo: 'Huerfana', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', sitioId: 'borrado' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(false);
  });

  it('la sección de faceta del popover no ofrece valores de otro portal', () => {
    const { feature, nodos } = crearFeature({ sitios: sitiosDeDosPortales() });
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [
      { titulo: 'Propia', carpeta: 'bio', estado: 'pending', catedra: 'A', sitioId: 'ramonnet' },
      // Del otro portal, y con un valor que NO existe en Ramón Net. Derivarlo con el descriptor
      // activo lo ofrecería como si fuese una cátedra.
      { titulo: 'Ajena', carpeta: 'bio', estado: 'process', catedra: 'ZZZ', sitioId: 'otroportal' },
    ];

    feature.renderizarFiltrosMenuPopover();

    const opciones = [...nodos.filterMenu.querySelectorAll('.popover-option span')].map(s => s.textContent);
    expect(opciones).toContain('Cat A');
    expect(opciones).not.toContain('Cat ZZZ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [ESCANEO-API CORTE 5] El filtro por TIPO.
//
// Vive en su propio Set y no en `valoresFaceta` a propósito: la faceta es el eje DE UN PORTAL,
// con vocabulario propio y elegido por portal (ADR-0012); el tipo es universal y ortogonal.
// Mezclarlos reabriría el bug que ese ADR cerró.
// ─────────────────────────────────────────────────────────────────────────────
describe('FilterFeature — el filtro por tipo', () => {
  const video = { titulo: 'Osteologia', carpeta: 'ms', estado: 'pending', catedra: 'COMUN', sitioId: 'ramonnet', modulo: 'ms', tipo: 'video' };
  const pdf = { titulo: 'Atlas.pdf', carpeta: 'ms', estado: 'pending', catedra: 'COMUN', sitioId: 'ramonnet', modulo: 'ms', tipo: 'adjunto' };

  it('con el Set vacío no filtra nada', () => {
    const { feature } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }, { ...pdf }];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal.map(c => c.visible)).toEqual([true, true]);
  });

  it('arranca vacío: los materiales se ven sin pedir nada', () => {
    // El default de "sólo video" duró lo que tardó el dueño en abrir el popup. El problema no
    // era el criterio: era que **un filtro activo que nadie prendió es invisible** — la lista
    // venía recortada y no había cómo notarlo salvo contando.
    const { feature, ctx } = crearFeature();
    expect(ctx.filtrosActivos.tipos.size).toBe(0);

    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }, { ...pdf }];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal.map(c => c.visible)).toEqual([true, true]);
  });

  it('pidiendo sólo videos, los materiales se esconden', () => {
    const { feature, ctx } = crearFeature();
    ctx.filtrosActivos.tipos.add('video');
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }, { ...pdf }];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal.map(c => c.visible)).toEqual([true, false]);
  });

  it('un ítem SIN tipo cuenta como video: es todo lo persistido de antes', () => {
    const { feature, ctx } = crearFeature();
    ctx.filtrosActivos.tipos.add('video');
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video, tipo: undefined }];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(true);
  });

  it('pidiendo materiales se esconden los videos', () => {
    const { feature, ctx } = crearFeature();
    ctx.filtrosActivos.tipos.add('adjunto');
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }, { ...pdf }];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal.map(c => c.visible)).toEqual([false, true]);
  });

  it('la sección Tipo del popover sólo aparece si el portal trajo adjuntos', () => {
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }];

    feature.renderizarFiltrosMenuPopover();

    const titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).not.toContain('Tipo');
  });

  it('con adjuntos, la sección Tipo aparece con sus dos opciones', () => {
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    AppState.listadoClasesGlobal = [{ ...video }, { ...pdf }];

    feature.renderizarFiltrosMenuPopover();

    const titulos = [...nodos.filterMenu.querySelectorAll('.popover-section-title')].map(t => t.textContent);
    expect(titulos).toContain('Tipo');
    const opciones = [...nodos.filterMenu.querySelectorAll('.popover-option span')].map(s => s.textContent);
    expect(opciones).toContain('Videos 🎬');
    expect(opciones).toContain('Materiales 📄');
  });

  it('sin filtros el badge no cuenta nada', () => {
    const { feature, nodos } = crearFeature();

    feature.actualizarPillsUIState();

    expect(nodos.btnFilterPills.querySelector('span').textContent).toBe('Filtros');
  });

  it('el badge cuenta el tipo como cualquier otro eje', () => {
    // Ya no hay excepción: desde que el filtro arranca vacío, todo lo que tenga adentro lo puso
    // el usuario.
    const { feature, ctx, nodos } = crearFeature();
    ctx.filtrosActivos.tipos.add('video');

    feature.actualizarPillsUIState();

    expect(nodos.btnFilterPills.querySelector('span').textContent).toBe('Filtros (1)');
  });

  it('el badge cuenta el tipo cuando el usuario pide materiales', () => {
    const { feature, ctx, nodos } = crearFeature();
    ctx.filtrosActivos.tipos.add('adjunto');

    feature.actualizarPillsUIState();

    expect(nodos.btnFilterPills.querySelector('span').textContent).toBe('Filtros (1)');
  });

  it('en la Cola también filtra por tipo', () => {
    const { feature, ctx } = crearFeature();
    ctx.filtrosActivos.tipos.add('adjunto');

    expect(feature.coincideConFiltrosCola({ ...video }, '')).toBe(false);
    expect(feature.coincideConFiltrosCola({ ...pdf }, '')).toBe(true);
  });
});

// [ESCANEO-API CORTE 1] La carpeta de una clase con módulo NO la decide el input.
describe('FilterFeature — el filtro de materia con módulos', () => {
  it('una clase con módulo NO se compara contra el input de carpeta', () => {
    // Sin esta regla, un portal de dos niveles deja la lista ENTERA invisible apenas el input
    // queda vacío — que es exactamente lo que hace el escaneo por API.
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    nodos.folder.value = '';
    AppState.listadoClasesGlobal = [
      { titulo: 'Miologia 1', carpeta: 'miembro_superior', modulo: 'miembro_superior', estado: 'pending', catedra: 'COMUN', sitioId: 'ramonnet' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(true);
  });

  it('una clase SIN módulo sigue comparándose contra el input, como siempre', () => {
    const { feature, nodos } = crearFeature();
    AppState.pestañaActiva = 'disponibles';
    nodos.folder.value = 'otra';
    AppState.listadoClasesGlobal = [
      { titulo: 'Clase', carpeta: 'biologia', estado: 'pending', catedra: 'COMUN', sitioId: 'ramonnet' },
    ];

    feature.aplicarFiltrosCruzados();

    expect(AppState.listadoClasesGlobal[0].visible).toBe(false);
  });
});
