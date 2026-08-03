// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/queue.js (QueueFeature).
 * Cubre las dos mutaciones de la cola: encolarItemsEnCaliente (optimistic update
 * + rollback si el SW no confirma) y quitarItemsDeColaEnLote (saca lote + vuelve
 * a 'pending' + IPC remover_item_de_cola). Mockea chrome + AppState + nodos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueueFeature from './queue.js';

let sendMessage;

function montarNodos() {
  document.body.innerHTML = `
    <input id="ui-path-folder" value="biologia">
    <span id="ui-queue-badge">0</span>
    <p id="ui-msg-status"></p>
    <input id="ui-master-check" type="checkbox">
    <button id="ui-btn-toggle-select"></button>
    <label id="ui-master-select-wrapper"></label>
    <button id="ui-btn-soft-cancel"></button>
    <button id="ui-btn-start-queue"></button>
    <div id="ui-cancel-box"></div>
    <div id="ui-progress-container"></div>
  `;
  return {
    folder: document.getElementById('ui-path-folder'),
    queueBadge: document.getElementById('ui-queue-badge'),
    txtEstado: document.getElementById('ui-msg-status'),
    masterCheck: document.getElementById('ui-master-check'),
    btnToggleSelect: document.getElementById('ui-btn-toggle-select'),
    btnSoftCancel: document.getElementById('ui-btn-soft-cancel'),
    btnStartQueue: document.getElementById('ui-btn-start-queue'),
    cancelBox: document.getElementById('ui-cancel-box'),
    progressCont: document.getElementById('ui-progress-container'),
  };
}

function crearFeature(overrides = {}) {
  const nodos = montarNodos();
  const ctx = {
    nodos,
    aplicarFiltros: vi.fn(),
    actualizarContadores: vi.fn(),
    resetSeleccionFila: vi.fn(),
    mostrarAlerta: vi.fn(),
    congelarUI: vi.fn(),
    renderizar: vi.fn(),
    setVerificandoConexion: vi.fn(),
    setReintentandoCola: vi.fn(),
    ...overrides,
  };
  const feature = QueueFeature.crear(ctx);
  return { feature, ctx, nodos };
}

// Snapshot del daemon como lo devuelve Conexion.verificarAhora()/get().
function estadoConexion({ internet = true, servidor = true } = {}) {
  return {
    servidor,
    internet,
    listo: true,
    completa: servidor && internet,
    tipoFalla: !servidor ? 'servidor' : (!internet ? 'internet' : null),
  };
}

// El chequeo previo al arranque delega en el daemon (v1.3.0): se stubea Conexion,
// no fetch. Devuelve el mock para poder afirmar sobre él.
function stubConexion(opts) {
  globalThis.Conexion = { verificarAhora: vi.fn().mockResolvedValue(estadoConexion(opts)) };
  return globalThis.Conexion;
}

beforeEach(() => {
  // Desde v1.3.0 la feature no toca SitioActivo: el sondeo (y con él la URL del
  // portal) es asunto del daemon.
  stubConexion();
  // Ningún camino de la feature debería sondear por su cuenta: si algo llama a
  // fetch, el test falla en vez de pegarle a la red real.
  globalThis.fetch = vi.fn(() => { throw new Error('la feature no debe hacer fetch propio'); });
  sendMessage = vi.fn();
  globalThis.chrome = { runtime: { sendMessage, lastError: null } };
  globalThis.AppState = {
    colaDescargas: [],
    listadoClasesGlobal: [],
    ráfagaEnCurso: false,
    respaldar: vi.fn(),
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('QueueFeature.encolarItemsEnCaliente', () => {
  it('agrega a la cola, marca process y persiste cuando el SW confirma', () => {
    // El SW responde OK de forma síncrona.
    sendMessage.mockImplementation((_msg, cb) => cb({ status: 'encolados_ok' }));
    const { feature, ctx, nodos } = crearFeature();

    const item = { id: 1, numeroOriginal: 3, titulo: 'A', urlInterna: 'u', estado: 'pending', seleccionado: true };
    feature.encolarItemsEnCaliente([item]);

    expect(AppState.colaDescargas).toHaveLength(1);
    expect(AppState.colaDescargas[0].titulo).toBe('A');
    expect(AppState.colaDescargas[0].carpeta).toBe('biologia'); // toma nodos.folder
    expect(item.estado).toBe('process');
    expect(item.seleccionado).toBe(false);
    expect(nodos.queueBadge.textContent).toBe('1');
    expect(AppState.respaldar).toHaveBeenCalled();
    expect(ctx.aplicarFiltros).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'inyectar_items_en_cola_activa' }),
      expect.any(Function)
    );
    // Éxito => sin rollback.
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('revierte el optimistic update si el SW no confirma (lastError)', () => {
    // El SW no confirma: hay chrome.runtime.lastError al invocar el callback.
    sendMessage.mockImplementation((_msg, cb) => {
      chrome.runtime.lastError = { message: 'canal cerrado' };
      cb(undefined);
      chrome.runtime.lastError = null; // Chrome lo limpia tras el callback.
    });
    const { feature, nodos } = crearFeature();

    const item = { id: 7, titulo: 'B', urlInterna: 'u', estado: 'pending', seleccionado: true };
    feature.encolarItemsEnCaliente([item]);

    // Rollback completo: cola vacía, estado y selección restaurados, badge en 0.
    expect(AppState.colaDescargas).toHaveLength(0);
    expect(item.estado).toBe('pending');
    expect(item.seleccionado).toBe(true);
    expect(nodos.queueBadge.textContent).toBe('0');
    expect(console.warn).toHaveBeenCalled();
  });

  it('revierte también si el status no es "encolados_ok"', () => {
    sendMessage.mockImplementation((_msg, cb) => cb({ status: 'error_raro' }));
    const { feature } = crearFeature();

    feature.encolarItemsEnCaliente([{ id: 9, titulo: 'C', urlInterna: 'u', estado: 'pending', seleccionado: false }]);

    expect(AppState.colaDescargas).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('QueueFeature.quitarItemsDeColaEnLote', () => {
  it('saca el lote de la cola, vuelve las clases a pending y las remueve en el SW', async () => {
    sendMessage.mockImplementation((_msg, cb) => cb({ status: 'removido_ok' }));
    AppState.colaDescargas = [{ titulo: 'A' }, { titulo: 'B' }];
    AppState.listadoClasesGlobal = [
      { titulo: 'A', estado: 'process', visible: true, seleccionado: false },
      { titulo: 'B', estado: 'process', visible: true, seleccionado: false },
    ];
    const { feature, ctx, nodos } = crearFeature();

    feature.quitarItemsDeColaEnLote([{ titulo: 'A' }]);

    // 'A' sale de la cola, 'B' queda.
    expect(AppState.colaDescargas.map(c => c.titulo)).toEqual(['B']);
    // 'A' vuelve a pending en el listado global.
    const a = AppState.listadoClasesGlobal.find(c => c.titulo === 'A');
    expect(a.estado).toBe('pending');
    expect(nodos.queueBadge.textContent).toBe('1');
    expect(nodos.masterCheck.checked).toBe(false);
    expect(ctx.resetSeleccionFila).toHaveBeenCalled();
    expect(ctx.actualizarContadores).toHaveBeenCalled();
    expect(AppState.respaldar).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'remover_item_de_cola', titulo: 'A' }),
      expect.any(Function)
    );

    // aplicarFiltros se dispara diferido (Promise.all + setTimeout 100ms).
    await new Promise(r => setTimeout(r, 150));
    expect(ctx.aplicarFiltros).toHaveBeenCalled();
  });
});

describe('QueueFeature.solicitarFrenadoSuave', () => {
  it('deshabilita el botón, marca la bandera y avisa al SW', () => {
    AppState.videoActualEnTransmisiónSW = 'Clase X';
    const { feature, nodos } = crearFeature();

    feature.solicitarFrenadoSuave();

    expect(nodos.btnSoftCancel.disabled).toBe(true);
    expect(AppState.banderaFrenadoSolicitado).toBe(true);
    expect(nodos.txtEstado.textContent).toContain('Frenando al terminar:');
    expect(nodos.txtEstado.textContent).toContain('Clase X');
    expect(sendMessage).toHaveBeenCalledWith({ action: 'activar_frenado_suave' });
  });
});

describe('QueueFeature.abortarRafagaInmediata', () => {
  it('avisa al SW y restaura el panel cuando el SW confirma', () => {
    sendMessage.mockImplementation((_msg, cb) => cb({ status: 'abortado_ok' }));
    const onRestaurarPanel = vi.fn();
    const { feature } = crearFeature({ onRestaurarPanel });

    feature.abortarRafagaInmediata();

    expect(sendMessage).toHaveBeenCalledWith(
      { action: 'abortar_rafaga_inmediata' },
      expect.any(Function)
    );
    expect(onRestaurarPanel).toHaveBeenCalledWith('🛑 Descargas detenidas. Fila preservada.', false);
  });
});

describe('QueueFeature.iniciarDescargaCola', () => {
  it('con red OK: congela la UI y avisa al SW', async () => {
    const conexion = stubConexion({ internet: true });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.setVerificandoConexion).toHaveBeenCalledWith(true);
    expect(ctx.setVerificandoConexion).toHaveBeenCalledWith(false);
    expect(ctx.congelarUI).toHaveBeenCalledWith('A', 0, null);
    expect(sendMessage).toHaveBeenCalledWith({ action: 'iniciar_descarga_cola' });
    expect(ctx.mostrarAlerta).not.toHaveBeenCalled();
    // El chequeo va por el daemon, no por un sondeo propio.
    expect(conexion.verificarAhora).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('sin red: muestra el alert y NO arranca', async () => {
    stubConexion({ internet: false });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.mostrarAlerta).toHaveBeenCalledWith('internet', 'A');
    expect(ctx.congelarUI).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('con el servidor caído pero internet OK: arranca igual (el gate mira SÓLO internet)', async () => {
    stubConexion({ internet: true, servidor: false });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.congelarUI).toHaveBeenCalledWith('A', 0, null);
    expect(sendMessage).toHaveBeenCalledWith({ action: 'iniciar_descarga_cola' });
    expect(ctx.mostrarAlerta).not.toHaveBeenCalled();
  });

  it('con la cola vacía no hace nada', async () => {
    AppState.colaDescargas = [];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.setVerificandoConexion).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe('QueueFeature.ejecutarReintentoDeCola', () => {
  it('con red OK: limpia la falla, restaura el panel y reanuda', async () => {
    stubConexion({ internet: true });
    AppState.colaDescargas = [{ titulo: 'A' }];
    AppState.fallaConexionActiva = 'internet';
    AppState.videoFalladoParaReintento = 'A';
    const { feature, ctx, nodos } = crearFeature();

    await feature.ejecutarReintentoDeCola();

    expect(AppState.fallaConexionActiva).toBeNull();
    expect(AppState.videoFalladoParaReintento).toBeNull();
    expect(ctx.renderizar).toHaveBeenCalled();
    expect(nodos.progressCont.style.display).toBe('block');
    expect(sendMessage).toHaveBeenCalledWith({ action: 'iniciar_descarga_cola' });
    expect(ctx.mostrarAlerta).not.toHaveBeenCalled();
  });

  it('sin red: muestra el alert y NO reanuda', async () => {
    stubConexion({ internet: false });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.ejecutarReintentoDeCola();

    expect(ctx.mostrarAlerta).toHaveBeenCalledWith('internet', 'A');
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
