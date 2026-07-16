// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/serverConnection.js.
 * Cubre la función determinista más usada (activarEstadoOfflineUI) y la
 * idempotencia del polling de reconexión, verificando además que las
 * dependencias cruzadas se invocan a través de los callbacks del ctx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ServerConnectionFeature from './serverConnection.js';

globalThis.AppState = {
  ráfagaEnCurso: false,
  fallaConexionActiva: null,
  pestañaActiva: 'disponibles'
};

function montarNodos() {
  document.body.innerHTML = `
    <div class="path-bar"></div>
    <div class="tabs-bar"></div>
    <div id="ui-status-dot"></div>
    <input id="ui-path-folder">
    <button id="ui-btn-explore"></button>
    <input id="ui-search">
    <button id="ui-btn-filter-pills"></button>
    <input id="ui-master-check" type="checkbox">
    <button id="ui-btn-sort"></button>
    <main id="ui-list"></main>
    <div id="ui-loader"></div>
    <span id="ui-pc-path"></span>
    <p id="ui-msg-status"></p>
    <section id="ui-filter-bar"></section>
  `;
  return {
    statusDot: document.getElementById('ui-status-dot'),
    folder: document.getElementById('ui-path-folder'),
    btnExplore: document.getElementById('ui-btn-explore'),
    search: document.getElementById('ui-search'),
    btnFilterPills: document.getElementById('ui-btn-filter-pills'),
    masterCheck: document.getElementById('ui-master-check'),
    btnSort: document.getElementById('ui-btn-sort'),
    lista: document.getElementById('ui-list'),
    loader: document.getElementById('ui-loader'),
    pcPath: document.getElementById('ui-pc-path'),
    txtEstado: document.getElementById('ui-msg-status'),
    filtersBar: document.getElementById('ui-filter-bar'),
  };
}

describe('ServerConnectionFeature.crear', () => {
  let nodos, ctx, api;

  beforeEach(() => {
    vi.useFakeTimers();
    nodos = montarNodos();
    ctx = {
      nodos,
      configurarBotonesUX: vi.fn(),
      actualizarEstadoServidorOnboarding: vi.fn(),
      onReintentarCola: vi.fn(),
      onReescanearAula: vi.fn(),
    };
    api = ServerConnectionFeature.crear(ctx);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('expone las tres funciones de conexión', () => {
    expect(typeof api.cargarRutaServidorSilencioso).toBe('function');
    expect(typeof api.activarEstadoOfflineUI).toBe('function');
    expect(typeof api.iniciarMonitoreoServidor).toBe('function');
  });

  it('activarEstadoOfflineUI pinta la tarjeta de error y deshabilita los controles', () => {
    api.activarEstadoOfflineUI();
    expect(nodos.lista.querySelector('.server-error-card')).not.toBeNull();
    expect(nodos.folder.disabled).toBe(true);
    expect(nodos.btnExplore.disabled).toBe(true);
    expect(nodos.search.disabled).toBe(true);
    expect(nodos.statusDot.className).toContain('offline');
  });

  it('activarEstadoOfflineUI delega en los callbacks cruzados del ctx', () => {
    api.activarEstadoOfflineUI();
    expect(ctx.configurarBotonesUX).toHaveBeenCalledWith('sincronizar-disco', expect.any(String), true);
    expect(ctx.actualizarEstadoServidorOnboarding).toHaveBeenCalledWith(false);
  });

  it('no duplica la tarjeta de error si ya existe una', () => {
    api.activarEstadoOfflineUI();
    api.activarEstadoOfflineUI();
    expect(nodos.lista.querySelectorAll('.server-error-card').length).toBe(1);
  });

  it('iniciarMonitoreoServidor es idempotente (un solo intervalo activo)', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    api.iniciarMonitoreoServidor();
    api.iniciarMonitoreoServidor();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
