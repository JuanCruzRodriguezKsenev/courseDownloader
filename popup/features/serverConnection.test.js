// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/serverConnection.js.
 * Desde v1.3.0 el módulo NO sondea: se suscribe al daemon Conexion. Estos tests
 * inyectan un Conexion falso que captura al suscriptor y emite estados, y
 * verifican la reacción (recuperación de cola/aula + banner offline).
 * Desde v1.9.0 el banner de conexión caída lo pinta la isla Preact #2
 * (window.BannerConexion); acá se inyecta un BannerConexion falso con estado real
 * (mostrar/ocultar mutan .estado) para poder asertar y para que reaccionarAConexion
 * lea .get().visible correctamente.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

// Store falso de la isla #2 (banner): estado real + spies.
function fakeBanner() {
  const b = { estado: { visible: false, tipo: null }, get() { return this.estado; } };
  b.mostrar = vi.fn((tipo = 'servidor') => { b.estado = { visible: true, tipo }; });
  b.ocultar = vi.fn(() => { b.estado = { visible: false, tipo: null }; });
  return b;
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
    <p id="ui-msg-status"></p>
    <section id="ui-filter-bar"></section>
  `;
  // El texto de la ruta (isla #1b, window.RutaDisco) y el banner (isla #2,
  // window.BannerConexion) ya no son nodos del popup: serverConnection los empuja.
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
    txtEstado: document.getElementById('ui-msg-status'),
    filtersBar: document.getElementById('ui-filter-bar'),
  };
}

describe('ServerConnectionFeature.crear', () => {
  let nodos, ctx, api, suscriptor, banner, lista;

  beforeEach(() => {
    globalThis.AppState.ráfagaEnCurso = false;
    globalThis.AppState.fallaConexionActiva = null;
    globalThis.BunClient = { obtenerRutaServidor: vi.fn().mockResolvedValue('C:/RamonNet') };
    globalThis.RutaDisco = { mostrar: vi.fn(), cargando: vi.fn(), get: () => ({ texto: '', titulo: '' }) };
    banner = fakeBanner();
    globalThis.BannerConexion = banner;
    // La isla #4 (window.ListaClases) es dueña de #ui-list: serverConnection le
    // empuja setOculta(true/false) en vez de tocar nodos.lista.style.display.
    lista = { setOculta: vi.fn() };
    globalThis.ListaClases = lista;
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
      onReintentarCola: vi.fn(),
      onReescanearAula: vi.fn(),
    };
    // FASE 7C: appState y conexion entran por ctx (los siembra el harness en globalThis).
    // FASE 8: los puentes de las islas entran por ctx. Los dobles se siguen creando igual
    // (arriba, en globalThis) para no cambiar la forma del harness; lo único que cambia es
    // que acá se los pasa explícito.
    api = ServerConnectionFeature.crear({
      ...ctx,
      appState: globalThis.AppState,
      conexion: globalThis.Conexion,
      listaClases: globalThis.ListaClases,
      rutaDisco: globalThis.RutaDisco,
      bannerConexion: globalThis.BannerConexion,
      backend: globalThis.BunClient,
    });
  });

  // Emite un estado del daemon al suscriptor de la feature.
  function emitir(estado) { suscriptor(estadoConexion(estado)); }

  it('expone las funciones públicas', () => {
    expect(typeof api.cargarRutaServidorSilencioso).toBe('function');
    expect(typeof api.activarEstadoOfflineUI).toBe('function');
    expect(typeof api.iniciarDetectorEstado).toBe('function');
    expect(typeof api.reaccionarAConexion).toBe('function');
  });

  it('activarEstadoOfflineUI muestra el banner (store), oculta la lista y deshabilita los controles', () => {
    api.activarEstadoOfflineUI();
    expect(banner.get()).toEqual({ visible: true, tipo: 'servidor' });
    expect(lista.setOculta).toHaveBeenCalledWith(true);
    expect(nodos.folder.disabled).toBe(true);
    expect(nodos.btnExplore.disabled).toBe(true);
    expect(nodos.search.disabled).toBe(true);
  });

  it('activarEstadoOfflineUI delega en los callbacks cruzados del ctx', () => {
    api.activarEstadoOfflineUI();
    expect(ctx.configurarBotonesUX).toHaveBeenCalledWith('sincronizar-disco', expect.any(String), true);
  });

  // [BANNER DUEÑO DEL DIAGNÓSTICO] Los dos de abajo fijan que el footer NO repita lo que la
  // card ya dice. Antes escribían "⚠️ Servidor Bun desconectado." y "Buscando servidor... ⏳",
  // que eran la segunda y la tercera copia del mismo hecho.
  it('activarEstadoOfflineUI no duplica el diagnóstico en el texto de estado', () => {
    nodos.txtEstado.textContent = 'algo previo';
    api.activarEstadoOfflineUI();
    expect(nodos.txtEstado.textContent).toBe('');
  });

  it('activarEstadoOfflineUI deja el botón con SU acción y deshabilitado, no con el diagnóstico', () => {
    api.activarEstadoOfflineUI('internet');
    // Decía "Esperando internet... ⏳" / "Buscando servidor... ⏳": el qué-pasa es de la card.
    expect(ctx.configurarBotonesUX).toHaveBeenCalledWith('sincronizar-disco', 'Sincronizar carpeta local 📂', true);
  });

  // [BANNER] Bloquear, no esconder: esconder mueve el layout en cada caída y en cada
  // reconexión del auto-heal. La clase se revierte sola al reconectar.
  it('activarEstadoOfflineUI BLOQUEA la toolbar y las pestañas en vez de ocultarlas', () => {
    api.activarEstadoOfflineUI();
    expect(nodos.filtersBar.classList.contains('bloqueada')).toBe(true);
    expect(document.querySelector('.tabs-bar').classList.contains('bloqueada')).toBe(true);
    expect(nodos.filtersBar.style.display).not.toBe('none');
  });

  it('al reconectar levanta el bloqueo de la toolbar y las pestañas', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    expect(nodos.filtersBar.classList.contains('bloqueada')).toBe(true);
    emitir({ servidor: true, internet: true });
    expect(nodos.filtersBar.classList.contains('bloqueada')).toBe(false);
    expect(document.querySelector('.tabs-bar').classList.contains('bloqueada')).toBe(false);
  });

  it('iniciarDetectorEstado se suscribe al daemon y lo arranca una sola vez (idempotente)', () => {
    api.iniciarDetectorEstado();
    api.iniciarDetectorEstado();
    expect(globalThis.Conexion.suscribir).toHaveBeenCalledTimes(1);
    expect(globalThis.Conexion.iniciar).toHaveBeenCalledTimes(1);
  });

  it('muestra el banner de servidor cuando cae el server (detección pasiva)', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    expect(banner.get()).toEqual({ visible: true, tipo: 'servidor' });
  });

  it('muestra el banner de internet cuando cae internet con el server OK', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: true, internet: false });
    expect(banner.get()).toEqual({ visible: true, tipo: 'internet' });
  });

  it('prioriza el banner de servidor si caen ambas conexiones', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false, internet: false });
    expect(banner.get().tipo).toBe('servidor');
  });

  it('cambia el banner de servidor a internet si el server vuelve pero internet sigue caído', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false, internet: false }); // banner servidor
    emitir({ servidor: true, internet: false });  // server volvió, falta internet
    expect(banner.get().tipo).toBe('internet');
  });

  it('no re-dispara activarEstadoOfflineUI si el banner ya es del tipo correcto', () => {
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    emitir({ servidor: false });
    emitir({ servidor: false });
    expect(banner.mostrar).toHaveBeenCalledTimes(1);
  });

  it('NO muestra el banner offline si hay una cola pausada por error (lo maneja la UI de descarga)', () => {
    globalThis.AppState.fallaConexionActiva = 'servidor';
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    expect(banner.get().visible).toBe(false);
    expect(banner.mostrar).not.toHaveBeenCalled();
  });

  it('al reconectar con el banner visible: lo oculta, restaura la lista y re-escanea una sola vez', () => {
    api.activarEstadoOfflineUI(); // muestra el banner y se suscribe
    emitir({ servidor: false });  // confirma offline
    emitir({ servidor: true });   // reconecta
    emitir({ servidor: true });   // no vuelve a disparar
    expect(banner.ocultar).toHaveBeenCalledTimes(1);
    expect(banner.get().visible).toBe(false);
    expect(lista.setOculta).toHaveBeenCalledWith(false);
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

  it('durante una descarga activa NO toca la UI de descarga (banner)', () => {
    globalThis.AppState.ráfagaEnCurso = true;
    api.iniciarDetectorEstado();
    emitir({ servidor: false });
    // No interfiere con la UI de la descarga (eso lo maneja el SW).
    expect(banner.mostrar).not.toHaveBeenCalled();
    expect(banner.get().visible).toBe(false);
    // (El puntito SÍ refleja la caída durante la descarga, pero eso ahora lo garantiza
    //  la isla Preact conexionHeader.preact.js, que se suscribe a Conexion directo.)
  });
});
