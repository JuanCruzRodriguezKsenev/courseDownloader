// @vitest-environment jsdom
/**
 * Test del módulo extraído popup/features/queue.js (QueueFeature).
 * Cubre las dos mutaciones de la cola: encolarItemsEnCaliente (optimistic update
 * + rollback si el SW no confirma) y quitarItemsDeColaEnLote (saca lote + vuelve
 * a 'pending' + IPC remover_item_de_cola). Mockea chrome + AppState + nodos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QueueFeature from './queue.js';
import { crearIdentidadClase } from '../../core/cola/identidadClase.ts';
import { MensajeriaEnMemoria } from '../../core/puertos/mensajeriaEnMemoria.ts';

let mensajeria;
let desregistrar;

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
    // MULTIPORTAL D: la identidad es (portal, título). Doble simple: todo cae en el legado,
    // que es el comportamiento de una instalación de un solo portal.
    identidad: crearIdentidadClase({ obtener: (id) => ({ id: id ?? 'ramonnet' }) }),
    mensajeria,
    ...overrides,
  };
  // FASE 7C: appState y conexion entran por ctx (los siembra el harness en globalThis).
  const feature = QueueFeature.crear({ ...ctx, appState: globalThis.AppState, conexion: globalThis.Conexion });
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

/** Registra un "SW" que contesta lo indicado a todo mensaje. */
function responderCon(respuesta) {
  desregistrar?.();
  desregistrar = mensajeria.onMensaje((_m, responder) => {
    responder(respuesta);
  });
}

/** Simula el SW dormido: sin manejador, `enviar()` rechaza (como el lastError de Chrome). */
function sinReceptor() {
  desregistrar?.();
  desregistrar = null;
}

/** Deja correr las cadenas de promesas del IPC (antes el callback era síncrono). */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  // Desde v1.3.0 la feature no toca SitioActivo: el sondeo (y con él la URL del
  // portal) es asunto del daemon.
  stubConexion();
  // Ningún camino de la feature debería sondear por su cuenta: si algo llama a
  // fetch, el test falla en vez de pegarle a la red real.
  globalThis.fetch = vi.fn(() => { throw new Error('la feature no debe hacer fetch propio'); });
  mensajeria = new MensajeriaEnMemoria();
  // Por defecto el SW contesta OK. Los tests que necesitan "SW dormido" usan sinReceptor().
  responderCon({ status: 'encolados_ok' });
  // La feature ya no debe tocar chrome.runtime: si lo hace, explota en vez de pasar.
  globalThis.chrome = { runtime: { get sendMessage() { throw new Error('la feature no debe usar chrome.runtime'); } } };
  globalThis.AppState = {
    colaDescargas: [],
    listadoClasesGlobal: [],
    ráfagaEnCurso: false,
    respaldar: vi.fn(),
  };
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('QueueFeature.encolarItemsEnCaliente', () => {
  it('agrega a la cola, marca process y persiste cuando el SW confirma', async () => {
    responderCon({ status: 'encolados_ok' });
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
    expect(mensajeria.enviados[0]).toMatchObject({ action: 'inyectar_items_en_cola_activa' });
    // Éxito => sin rollback (la confirmación llega en microtask).
    await flush();
    expect(console.warn).not.toHaveBeenCalled();
    expect(AppState.colaDescargas).toHaveLength(1);
  });

  it('revierte el optimistic update si el canal falla (SW dormido)', async () => {
    sinReceptor(); // sin manejador => enviar() rechaza, como el lastError de Chrome
    const { feature, nodos } = crearFeature();

    const item = { id: 7, titulo: 'B', urlInterna: 'u', estado: 'pending', seleccionado: true };
    feature.encolarItemsEnCaliente([item]);
    await flush();

    // Rollback completo: cola vacía, estado y selección restaurados, badge en 0.
    expect(AppState.colaDescargas).toHaveLength(0);
    expect(item.estado).toBe('pending');
    expect(item.seleccionado).toBe(true);
    expect(nodos.queueBadge.textContent).toBe('0');
    expect(console.warn).toHaveBeenCalled();
  });

  it('revierte también si el status no es "encolados_ok"', async () => {
    responderCon({ status: 'error_raro' });
    const { feature } = crearFeature();

    feature.encolarItemsEnCaliente([{ id: 9, titulo: 'C', urlInterna: 'u', estado: 'pending', seleccionado: false }]);
    await flush();

    expect(AppState.colaDescargas).toHaveLength(0);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('QueueFeature.quitarItemsDeColaEnLote', () => {
  it('saca el lote de la cola, vuelve las clases a pending y las remueve en el SW', async () => {
    responderCon({ status: 'removido_ok' });
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
    expect(mensajeria.enviados).toContainEqual({ action: 'remover_item_de_cola', titulo: 'A' });

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
    expect(mensajeria.accionesEnviadas()).toContain('activar_frenado_suave');
  });
});

describe('QueueFeature.abortarRafagaInmediata', () => {
  it('avisa al SW y restaura el panel cuando el SW confirma', async () => {
    responderCon({ status: 'abortado_ok' });
    const onRestaurarPanel = vi.fn();
    const { feature } = crearFeature({ onRestaurarPanel });

    feature.abortarRafagaInmediata();
    await flush();

    expect(mensajeria.enviados).toContainEqual({ action: 'abortar_rafaga_inmediata' });
    expect(onRestaurarPanel).toHaveBeenCalledWith('🛑 Descargas detenidas. Fila preservada.', false);
  });

  it('restaura el panel AUNQUE el SW no conteste (si no, queda congelado)', async () => {
    sinReceptor();
    const onRestaurarPanel = vi.fn();
    const { feature } = crearFeature({ onRestaurarPanel });

    feature.abortarRafagaInmediata();
    await flush();

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
    expect(mensajeria.accionesEnviadas()).toContain('iniciar_descarga_cola');
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
    expect(mensajeria.enviados).toHaveLength(0);
  });

  it('con el servidor caído pero internet OK: arranca igual (el gate mira SÓLO internet)', async () => {
    stubConexion({ internet: true, servidor: false });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.congelarUI).toHaveBeenCalledWith('A', 0, null);
    expect(mensajeria.accionesEnviadas()).toContain('iniciar_descarga_cola');
    expect(ctx.mostrarAlerta).not.toHaveBeenCalled();
  });

  it('con la cola vacía no hace nada', async () => {
    AppState.colaDescargas = [];
    const { feature, ctx } = crearFeature();

    await feature.iniciarDescargaCola();

    expect(ctx.setVerificandoConexion).not.toHaveBeenCalled();
    expect(mensajeria.enviados).toHaveLength(0);
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
    expect(mensajeria.accionesEnviadas()).toContain('iniciar_descarga_cola');
    expect(ctx.mostrarAlerta).not.toHaveBeenCalled();
  });

  it('sin red: muestra el alert y NO reanuda', async () => {
    stubConexion({ internet: false });
    AppState.colaDescargas = [{ titulo: 'A' }];
    const { feature, ctx } = crearFeature();

    await feature.ejecutarReintentoDeCola();

    expect(ctx.mostrarAlerta).toHaveBeenCalledWith('internet', 'A');
    expect(mensajeria.enviados).toHaveLength(0);
  });
});

// [MULTISITIO CORTE 6D — ADR-0011] Encolar agrega al FINAL del array, y desde este corte el
// array es el orden de descarga. Sin re-aplicar el orden, un ítem nuevo se mostraría en el
// lugar que el criterio dice y se bajaría último — que es exactamente la mentira que la ADR
// existe para cerrar.
describe('QueueFeature.encolarItemsEnCaliente — el orden persistido (corte 6d)', () => {
  it('re-aplica el orden de la cola antes de respaldar', () => {
    const reordenarCola = vi.fn();
    const { feature } = crearFeature({ reordenarCola });
    const respaldar = vi.spyOn(globalThis.AppState, 'respaldar');

    feature.encolarItemsEnCaliente([
      { id: 1, titulo: 'A', urlInterna: 'u', estado: 'pending', seleccionado: true },
    ]);

    expect(reordenarCola).toHaveBeenCalled();
    // Antes de respaldar: si fuera después, se persistiría el orden viejo y recién lo
    // corregiría el siguiente respaldo, que puede no llegar nunca.
    expect(reordenarCola.mock.invocationCallOrder[0])
      .toBeLessThan(respaldar.mock.invocationCallOrder[0]);
  });

  it('sin reordenarCola en el ctx no rompe (la dependencia es opcional)', () => {
    const { feature } = crearFeature();
    expect(() =>
      feature.encolarItemsEnCaliente([
        { id: 2, titulo: 'B', urlInterna: 'u', estado: 'pending', seleccionado: false },
      ])
    ).not.toThrow();
  });
});
