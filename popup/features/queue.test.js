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
  `;
  return {
    folder: document.getElementById('ui-path-folder'),
    queueBadge: document.getElementById('ui-queue-badge'),
    txtEstado: document.getElementById('ui-msg-status'),
    masterCheck: document.getElementById('ui-master-check'),
    btnToggleSelect: document.getElementById('ui-btn-toggle-select'),
  };
}

function crearFeature(overrides = {}) {
  const nodos = montarNodos();
  const ctx = {
    nodos,
    aplicarFiltros: vi.fn(),
    actualizarContadores: vi.fn(),
    resetSeleccionFila: vi.fn(),
    ...overrides,
  };
  const feature = QueueFeature.crear(ctx);
  return { feature, ctx, nodos };
}

beforeEach(() => {
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
