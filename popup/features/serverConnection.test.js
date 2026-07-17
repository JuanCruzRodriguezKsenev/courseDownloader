// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/serverConnection.js.
 * Desde v1.3.0 el módulo NO sondea: se suscribe al daemon Conexion. Estos tests
 * inyectan un Conexion falso que captura al suscriptor y emite estados, y
 * verifican la reacción (indicador + recuperación de cola/aula) + activarEstadoOfflineUI.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ServerConnectionFeature from './serverConnection.js';

globalThis.AppState = {
  ráfagaEnCurso: false,
  fallaConexionActiva: null,
  pestañaActiva: 'disponibles'
};

// Construye un objeto de estado como el que emite Conexion.get().
function estadoConexion({ servidor, internet = true }) {
  return {
    servidor,
    internet,
    listo: true,
    completa: servidor && internet,
    tipoFalla: !servidor ? 'servidor' : (!internet ? 'internet' : null)
  };
}

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
  let nodos, ctx, api, suscriptor;

  beforeEach(() => {
    globalThis.AppState.ráfagaEnCurso = false;
    globalThis.AppState.fallaConexionActiva = null;
    globalThis.BunClient = { obtenerRutaServidor: vi.fn().mockResolvedValue('C:/RamonNet') };
    // Conexion falso: captura al suscriptor para poder emitir estados a mano.
    suscriptor = null;
    globalThis.Conexion = {
      suscribir: vi.fn((cb) => { suscriptor = cb; return () => { suscriptor = null; }; }),
      iniciar: vi.fn(),
    };
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

  // Emite un estado del daemon al suscriptor de la feature.
  function emitir(estado) { suscriptor(estadoConexion(estado)); }

  it('expone las funciones públicas', () => {
    expect(typeof api.cargarRutaServidorSilencioso).toBe('function');
    expect(typeof api.activarEstadoOfflineUI).toBe('function');
    expect(typeof api.iniciarDetectorEstado).toBe('function');
    expect(typeof api.reaccionarAConexion).toBe('function');
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

  it('iniciarDetectorEstado se suscribe al daemon y lo arranca una sola vez (idempotente)', () => {
    api.iniciarDetectorEstado();
    api.iniciarDetectorEstado();
    expect(globalThis.Conexion.suscribir).toHaveBeenCalledTimes(1);
    expect(globalThis.Conexion.iniciar).toHaveBeenCalledTimes(1);
  });

  it('pinta el indicador en rojo cuando el daemon reporta el server caído', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    expect(ctx.actualizarEstadoServidorOnboarding).toHaveBeenLastCalledWith(false);
    expect(nodos.statusDot.className).toContain('offline');
  });

  it('muestra el banner de servidor cuando cae el server (detección pasiva)', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    const card = nodos.lista.querySelector('.server-error-card');
    expect(card).not.toBeNull();
    expect(card.dataset.tipo).toBe('servidor');
  });

  it('muestra el banner de internet cuando cae internet con el server OK', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: true, internet: false });
    const card = nodos.lista.querySelector('.server-error-card');
    expect(card).not.toBeNull();
    expect(card.dataset.tipo).toBe('internet');
  });

  it('prioriza el banner de servidor si caen ambas conexiones', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false, internet: false });
    expect(nodos.lista.querySelector('.server-error-card').dataset.tipo).toBe('servidor');
  });

  it('el puntito general se pone rojo si falta internet aunque el server esté OK', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: true, internet: false });
    expect(nodos.statusDot.className).toContain('offline');
  });

  it('cambia el banner de servidor a internet si el server vuelve pero internet sigue caído', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false, internet: false }); // banner servidor
    emitir({ servidor: true, internet: false });  // server volvió, falta internet
    expect(nodos.lista.querySelector('.server-error-card').dataset.tipo).toBe('internet');
  });

  it('NO muestra el banner offline si hay una cola pausada por error (lo maneja la UI de descarga)', () => {
    globalThis.AppState.fallaConexionActiva = 'servidor';
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    expect(nodos.lista.querySelector('.server-error-card')).toBeNull();
  });

  it('pinta el indicador en verde cuando el daemon reporta el server OK', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: true });
    expect(ctx.actualizarEstadoServidorOnboarding).toHaveBeenLastCalledWith(true);
    expect(nodos.statusDot.className).toContain('online');
  });

  it('sólo repinta el indicador en la transición de estado, no en cada notificación', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: true });
    emitir({ servidor: true });
    emitir({ servidor: true });
    expect(ctx.actualizarEstadoServidorOnboarding).toHaveBeenCalledTimes(1);
  });

  it('al reconectar el server con la tarjeta de error visible, re-escanea el aula una sola vez', () => {
    api.activarEstadoOfflineUI(); // pinta la tarjeta y se suscribe
    emitir({ servidor: false });  // confirma offline
    emitir({ servidor: true });   // reconecta
    emitir({ servidor: true });   // no vuelve a disparar
    expect(ctx.onReescanearAula).toHaveBeenCalledTimes(1);
  });

  it('al reconectar tras fallo de servidor, reanuda la cola', () => {
    globalThis.AppState.fallaConexionActiva = 'servidor';
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    emitir({ servidor: true });
    expect(ctx.onReintentarCola).toHaveBeenCalledTimes(1);
  });

  it('al volver internet tras fallo de internet, reanuda la cola', () => {
    globalThis.AppState.fallaConexionActiva = 'internet';
    api.iniciarDetectorEstado();
    emitir({ servidor: true, internet: false });
    emitir({ servidor: true, internet: true });
    expect(ctx.onReintentarCola).toHaveBeenCalledTimes(1);
  });

  it('durante una descarga activa NO toca banner/onboarding, pero el puntito SÍ refleja la caída', () => {
    globalThis.AppState.ráfagaEnCurso = true;
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    // No interfiere con la UI de la descarga (eso lo maneja el SW)...
    expect(ctx.actualizarEstadoServidorOnboarding).not.toHaveBeenCalled();
    expect(nodos.lista.querySelector('.server-error-card')).toBeNull();
    // ...pero el indicador refleja la realidad (antes quedaba verde para siempre).
    expect(nodos.statusDot.className).toContain('offline');
  });
});
