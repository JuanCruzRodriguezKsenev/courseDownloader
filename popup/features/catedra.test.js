// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/catedra.js (CatedraFeature).
 * Cubre: el badge de cátedra (visible/oculto según multicátedra + limpieza de selección
 * huérfana), la autoselección silenciosa (marca 'seleccionado' en los pending de la
 * cátedra elegida + COMUN), el asistente multicátedra (modal / selección persistida /
 * reseteo) y el modal (opciones ordenadas + click). Mockea AppState + nodos.catedraBadge.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CatedraFeature from './catedra.js';

function crearFeature(overrides = {}) {
  document.body.innerHTML = `<span id="ui-catedra-badge" style="display:none"></span>`;
  const nodos = { catedraBadge: document.getElementById('ui-catedra-badge') };
  const aplicarFiltros = vi.fn();
  const feature = CatedraFeature.crear({ nodos, aplicarFiltros, ...overrides });
  return { feature, nodos, aplicarFiltros };
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
  document.querySelector('.multicatedra-overlay')?.remove();
});

describe('CatedraFeature.actualizarBadgeCatedra', () => {
  it('multicátedra con cátedra elegida: muestra el badge con el texto', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A';
    const { feature, nodos } = crearFeature();

    feature.actualizarBadgeCatedra();

    expect(nodos.catedraBadge.style.display).toBe('inline-flex');
    expect(nodos.catedraBadge.textContent).toBe('Cátedra A');
  });

  it('NO multicátedra: oculta el badge y limpia la selección huérfana', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A'; // huérfana: ya no hay multicátedra
    const { feature, nodos } = crearFeature();

    feature.actualizarBadgeCatedra();

    expect(nodos.catedraBadge.style.display).toBe('none');
    expect(AppState.catedraSeleccionada).toBeNull();
    expect(AppState.respaldar).toHaveBeenCalled();
  });

  it('multicátedra sin cátedra elegida: oculta el badge sin tocar el estado', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'B' }];
    AppState.catedraSeleccionada = null;
    const { feature, nodos } = crearFeature();

    feature.actualizarBadgeCatedra();

    expect(nodos.catedraBadge.style.display).toBe('none');
    expect(AppState.respaldar).not.toHaveBeenCalled();
  });
});

describe('CatedraFeature.aplicarSeleccionCatedraSilencioso', () => {
  it('marca seleccionado en los pending de la cátedra elegida + COMUN, no en el resto', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: true },
      { catedra: 'COMUN', estado: 'pending', seleccionado: false },
      { catedra: 'A', estado: 'downloaded', seleccionado: false }, // no-pending: intacto
    ];
    AppState.listadoClasesGlobal.push({ catedra: 'A' }, { catedra: 'B' }); // asegurar multicátedra
    const { feature, aplicarFiltros } = crearFeature();

    feature.aplicarSeleccionCatedraSilencioso('A');

    const [a, b, comun, aDescargada] = AppState.listadoClasesGlobal;
    expect(AppState.catedraSeleccionada).toBe('A');
    expect(a.seleccionado).toBe(true);   // pending A
    expect(b.seleccionado).toBe(false);  // pending B (deseleccionada)
    expect(comun.seleccionado).toBe(true); // pending COMUN siempre entra
    expect(aDescargada.seleccionado).toBe(false); // no-pending no se toca
    expect(aplicarFiltros).toHaveBeenCalled();
    expect(AppState.respaldar).toHaveBeenCalled();
  });
});

describe('CatedraFeature.verificarYMostrarAsistenteMulticatedra', () => {
  it('multicátedra sin selección previa: muestra el modal con las opciones ordenadas', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'C' }, { catedra: 'A' }, { catedra: 'B' }];
    AppState.catedraSeleccionada = null;
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistenteMulticatedra();

    const overlay = document.querySelector('.multicatedra-overlay');
    expect(overlay).not.toBeNull();
    const labels = [...overlay.querySelectorAll('.btn-catedra-opt')].map(b => b.textContent);
    expect(labels).toEqual(['Cátedra A', 'Cátedra B', 'Cátedra C']); // ordenadas
  });

  it('multicátedra con selección persistida válida: aplica silencioso, sin modal', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: false },
    ];
    AppState.catedraSeleccionada = 'A';
    const { feature, aplicarFiltros } = crearFeature();

    feature.verificarYMostrarAsistenteMulticatedra();

    expect(document.querySelector('.multicatedra-overlay')).toBeNull();
    expect(AppState.listadoClasesGlobal[0].seleccionado).toBe(true);
    expect(aplicarFiltros).toHaveBeenCalled();
  });

  it('una sola cátedra: resetea catedraSeleccionada a null', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    AppState.catedraSeleccionada = 'A';
    const { feature } = crearFeature();

    feature.verificarYMostrarAsistenteMulticatedra();

    expect(AppState.catedraSeleccionada).toBeNull();
    expect(document.querySelector('.multicatedra-overlay')).toBeNull();
  });
});

describe('CatedraFeature — click en el badge y modal', () => {
  it('click en el badge multicátedra abre el modal; elegir una opción aplica y cierra', () => {
    AppState.listadoClasesGlobal = [
      { catedra: 'A', estado: 'pending', seleccionado: false },
      { catedra: 'B', estado: 'pending', seleccionado: false },
    ];
    const { nodos, aplicarFiltros } = crearFeature();

    nodos.catedraBadge.click();
    const overlay = document.querySelector('.multicatedra-overlay');
    expect(overlay).not.toBeNull();

    // Elegir "Cátedra B" aplica la selección y remueve el overlay.
    const botones = [...overlay.querySelectorAll('.btn-catedra-opt')];
    botones.find(b => b.textContent === 'Cátedra B').click();

    expect(AppState.catedraSeleccionada).toBe('B');
    expect(AppState.listadoClasesGlobal[1].seleccionado).toBe(true);
    expect(aplicarFiltros).toHaveBeenCalled();
    expect(document.querySelector('.multicatedra-overlay')).toBeNull();
  });

  it('click en el badge NO multicátedra no abre modal', () => {
    AppState.listadoClasesGlobal = [{ catedra: 'A' }, { catedra: 'COMUN' }];
    const { nodos } = crearFeature();

    nodos.catedraBadge.click();

    expect(document.querySelector('.multicatedra-overlay')).toBeNull();
  });
});
