/**
 * Tests de los handlers IPC del Service Worker (background.js, manejadoresIPC).
 *
 * Enfoque: se importa background.js una sola vez con un harness que mockea todo lo
 * que el SW toca al cargar (importScripts no-op, chrome.* con store en memoria, y
 * los globales Utils/BunClient/Conexion/HlsEngine que normalmente vienen por
 * importScripts). NO se modifica código de producción. El listener de
 * chrome.runtime.onMessage se captura al registrarse y se invoca por acción; como
 * cada handler llama sendResponse(...) recién tras persistir en storage, resolver
 * en sendResponse garantiza que el store ya quedó consistente.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

let listener;               // el callback de chrome.runtime.onMessage
const store = { local: {}, session: {} };

/** Crea un área de storage (local/session) con semántica tipo chrome.storage. */
function crearArea(getBucket) {
  return {
    get: async (keys) => {
      const src = getBucket();
      if (keys == null) return { ...src };
      if (typeof keys === 'string') return (keys in src) ? { [keys]: src[keys] } : {};
      if (Array.isArray(keys)) {
        const o = {};
        keys.forEach(k => { if (k in src) o[k] = src[k]; });
        return o;
      }
      // forma objeto {clave: default}
      const o = {};
      Object.keys(keys).forEach(k => { o[k] = (k in src) ? src[k] : keys[k]; });
      return o;
    },
    set: async (obj) => { Object.assign(getBucket(), obj); },
    remove: async (keys) => {
      (Array.isArray(keys) ? keys : [keys]).forEach(k => delete getBucket()[k]);
    },
  };
}

beforeAll(async () => {
  globalThis.importScripts = () => {};
  globalThis.Utils = {};
  globalThis.BunClient = { cancelarDescarga: async () => {} };
  globalThis.Conexion = {};
  globalThis.HlsEngine = {};
  globalThis.HistorialFallos = { registrar: async () => ({ id: 'x' }) };

  const noopEvent = { addListener: () => {} };
  globalThis.chrome = {
    runtime: {
      lastError: null,
      onInstalled: noopEvent,
      onMessage: { addListener: (cb) => { listener = cb; } },
      sendMessage: () => {},
      getURL: (p) => p,
    },
    storage: {
      local: crearArea(() => store.local),
      session: crearArea(() => store.session),
    },
    alarms: { onAlarm: noopEvent, clear: async () => {}, create: () => {} },
    downloads: { search: async () => [] },
    // El listener de onClicked se registra al cargar el SW; create/clear sólo se
    // usan dentro de registrarFallo/onClicked, que estos tests IPC no invocan.
    notifications: { onClicked: noopEvent, create: () => {}, clear: () => {} },
  };

  await import('./background.js');
});

beforeEach(() => {
  store.local = {};
  store.session = {};
});

/** Invoca el listener IPC y resuelve con la respuesta de sendResponse. */
function invocar(request) {
  return new Promise((resolve) => {
    listener(request, {}, (respuesta) => resolve(respuesta));
  });
}

describe('listener IPC', () => {
  it('devuelve false (síncrono) ante una acción desconocida', () => {
    expect(listener({ action: 'accion_inexistente' }, {}, () => {})).toBe(false);
  });
});

describe('inyectar_items_en_cola_activa', () => {
  it('encola el ítem, lo marca "process" y actualiza la lista persistente', async () => {
    store.local.listaPersistente = [{ titulo: 'Clase 1', estado: 'pending', carpeta: '' }];
    store.local.colaDescargas = [];
    store.local.SW_ESTADOS_PROGRESO = {};

    const resp = await invocar({
      action: 'inyectar_items_en_cola_activa',
      items: [{ titulo: 'Clase 1', carpeta: 'anatomia' }],
    });

    expect(resp).toEqual({ status: 'encolados_ok' });
    expect(store.local.colaDescargas).toEqual([{ titulo: 'Clase 1', carpeta: 'anatomia' }]);
    expect(store.local.SW_ESTADOS_PROGRESO['Clase 1']).toBe('process');
    expect(store.local.listaPersistente[0].estado).toBe('process');
    expect(store.local.listaPersistente[0].carpeta).toBe('anatomia');
  });

  it('no duplica un ítem ya presente en la cola', async () => {
    store.local.colaDescargas = [{ titulo: 'Clase 1', carpeta: 'x' }];
    const resp = await invocar({
      action: 'inyectar_items_en_cola_activa',
      items: [{ titulo: 'Clase 1', carpeta: 'x' }],
    });
    expect(resp.status).toBe('encolados_ok');
    expect(store.local.colaDescargas).toHaveLength(1);
  });
});

describe('remover_item_de_cola', () => {
  it('saca el ítem de la cola, borra su progreso y lo vuelve a "pending"', async () => {
    store.local.listaPersistente = [{ titulo: 'Clase 1', estado: 'process' }];
    store.local.colaDescargas = [{ titulo: 'Clase 1' }, { titulo: 'Clase 2' }];
    store.local.SW_ESTADOS_PROGRESO = { 'Clase 1': 'process', 'Clase 2': 'process' };

    const resp = await invocar({ action: 'remover_item_de_cola', titulo: 'Clase 1' });

    expect(resp).toEqual({ status: 'removido_ok' });
    expect(store.local.colaDescargas).toEqual([{ titulo: 'Clase 2' }]);
    expect(store.local.SW_ESTADOS_PROGRESO['Clase 1']).toBeUndefined();
    expect(store.local.listaPersistente[0].estado).toBe('pending');
  });
});

describe('obtener_estados_en_progreso', () => {
  it('reporta estados + telemetría derivada del SessionState', async () => {
    store.local.SW_ESTADOS_PROGRESO = { 'Clase 1': 'process' };
    store.session.videoActualTitulo = 'Clase 1';
    store.session.totalFragmentosEnVideoActual = 10;
    store.session.fragmentosTerminadosEnVideoActual = 5;
    store.session.bytesProcesadosEnVideoActual = 1234;
    store.session.velocidadMbsActual = 2.5;

    const resp = await invocar({ action: 'obtener_estados_en_progreso' });

    expect(resp.estados).toEqual({ 'Clase 1': 'process' });
    expect(resp.videoActual).toBe('Clase 1');
    expect(resp.porcentaje).toBe(50);
    expect(resp.telemetry).toEqual({
      bytesProcesados: 1234,
      fragsTerminados: 5,
      totalFrags: 10,
      velocidadMbs: 2.5,
    });
  });
});
