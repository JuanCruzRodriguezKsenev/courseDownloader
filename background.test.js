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
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

let listener;               // el callback de chrome.runtime.onMessage
let oyenteAlarma;           // el callback de chrome.alarms.onAlarm
const store = { local: {}, session: {} };

/** Todo lo que el SW manda por IPC durante un test (para afirmar sobre el flujo). */
let mensajesEnviados = [];
/** Alarmas creadas/limpiadas, para el auto-heal. */
let alarmas = { creadas: [], limpiadas: [] };
/** Fallos registrados vía registrarFallo (historial + notificación). */
let fallosRegistrados = [];

/** Comportamiento configurable del motor HLS por test. */
let motor = {};
/** Estado que reporta el daemon de conexión. */
let estadoConexion = { servidor: true, internet: true, tipoFalla: null };

const accionesEnviadas = () => mensajesEnviados.map(m => m.action);

/** Espera activa hasta que se cumpla `cond` (el loop encadena con setTimeout 60ms). */
async function esperarA(cond, descripcion = 'condición', limiteMs = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < limiteMs) {
    if (cond()) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`Timeout esperando: ${descripcion}`);
}

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
  globalThis.performance = globalThis.performance || { now: () => Date.now() };
  globalThis.Utils = {
    // Sólo lo que usa el bucle de descarga (el resto está cubierto en utils.test.js).
    calcularMétricasProgreso: (bytes, hechos, total) => ({
      porcentaje: Math.round((hechos / total) * 100),
      telemetry: { velocidadTexto: '1.5' },
    }),
  };
  globalThis.BunClient = { cancelarDescarga: async () => {}, actualizarConsola: () => {} };
  globalThis.Conexion = {
    verificarAhora: async () => estadoConexion,
    get: () => estadoConexion,
  };
  // El adaptador de sitio: la resolución del .m3u8 salió del motor en la Capa 2.
  globalThis.SitioActivo = {
    resolverManifiesto: async () => 'https://cdn/video.m3u8',
    patronPestañas: 'https://portal/*',
    urlSondeoInternet: 'https://portal',
  };
  globalThis.HlsEngine = {
    descargarYAnalizarIndexM3u8: async (...args) => motor.analizar(...args),
    compilarTranscodificacionStream: async (...args) => motor.compilar(...args),
  };
  globalThis.HistorialFallos = {
    registrar: async (tipo, titulo, motivo) => {
      fallosRegistrados.push({ tipo, titulo, motivo });
      return { id: 'x' };
    },
  };

  const noopEvent = { addListener: () => {} };
  globalThis.chrome = {
    runtime: {
      lastError: null,
      onInstalled: noopEvent,
      onMessage: { addListener: (cb) => { listener = cb; } },
      // Devuelve promesa: el bucle encadena .catch(() => {}) sobre cada envío.
      sendMessage: (msg) => { mensajesEnviados.push(msg); return Promise.resolve(); },
      getURL: (p) => p,
    },
    storage: {
      local: crearArea(() => store.local),
      session: crearArea(() => store.session),
    },
    alarms: {
      onAlarm: { addListener: (cb) => { oyenteAlarma = cb; } },
      clear: (n) => { alarmas.limpiadas.push(n); },
      create: (n, o) => { alarmas.creadas.push({ nombre: n, opciones: o }); },
    },
    downloads: { search: async () => [] },
    notifications: { onClicked: noopEvent, create: () => {}, clear: () => {} },
    tabs: { query: async () => [], update: async () => {}, create: async () => {} },
    windows: { update: async () => {} },
  };

  await import('./background.js');
});

beforeEach(() => {
  store.local = {};
  store.session = {};
  mensajesEnviados = [];
  alarmas = { creadas: [], limpiadas: [] };
  fallosRegistrados = [];
  estadoConexion = { servidor: true, internet: true, tipoFalla: null };
  // Motor por defecto: 2 fragmentos y descarga exitosa.
  motor = {
    analizar: async () => ({ urls: ['a.ts', 'b.ts'] }),
    compilar: async () => null,
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// `loopActivo` es estado de MÓDULO en background.js: si un test deja el bucle marcado como
// activo, el siguiente que intente arrancarlo (o reanudarlo por auto-heal) no hace nada.
// abortar_rafaga_inmediata es el único camino público que lo apaga, así que se usa de reset.
afterEach(async () => {
  await invocar({ action: 'abortar_rafaga_inmediata' });
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

// ─────────────────────────────────────────────────────────────────────────────
// Bucle de descarga + auto-heal.
//
// Hasta acá esto era zona SIN cobertura ("manual/e2e por diseño"). Estos tests de
// caracterización fijan el comportamiento ACTUAL antes de migrar background.js a
// los puertos: son la red que tiene que seguir en verde después.
// ─────────────────────────────────────────────────────────────────────────────

/** Siembra una cola y arranca la ráfaga por el mismo camino que usa el popup. */
async function arrancarCola(items, lista) {
  store.local.colaDescargas = items;
  store.local.listaPersistente = lista || items.map(i => ({ titulo: i.titulo, estado: 'process' }));
  store.local.SW_ESTADOS_PROGRESO = {};
  return invocar({ action: 'iniciar_descarga_cola' });
}

const item = (titulo, fecha) => ({ titulo, urlInterna: 'u/' + titulo, carpeta: 'anatomia', fechaEncolado: fecha });

describe('bucle de descarga — camino feliz', () => {
  it('descarga toda la cola, marca las clases y avisa al popup', async () => {
    await arrancarCola([item('Clase 1', 1), item('Clase 2', 2)]);

    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    expect(store.local.colaDescargas).toEqual([]);
    expect(store.local.listaPersistente.map(c => c.estado)).toEqual(['downloaded', 'downloaded']);
    expect(store.local.SW_ESTADOS_PROGRESO).toEqual({});
    const guardadas = mensajesEnviados.filter(m => m.action === 'clase_guardada_ok').map(m => m.titulo);
    expect(guardadas).toEqual(['Clase 1', 'Clase 2']);
  });

  it('respeta el orden FIFO por fechaEncolado, no el del array', async () => {
    await arrancarCola([item('Segunda', 200), item('Primera', 100)]);

    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    const guardadas = mensajesEnviados.filter(m => m.action === 'clase_guardada_ok').map(m => m.titulo);
    expect(guardadas).toEqual(['Primera', 'Segunda']);
  });

  it('emite progreso con telemetría mientras baja los fragmentos', async () => {
    motor.compilar = async (_frags, _signal, _carpeta, _titulo, cbs) => {
      await cbs.onFragmentoCompletado(500, 2, 500, 1);
      return null;
    };
    await arrancarCola([item('Clase 1', 1)]);

    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    const progreso = mensajesEnviados.find(m => m.action === 'update_progress_bar');
    expect(progreso).toMatchObject({ titulo: 'Clase 1', percentage: 50 });
    expect(progreso.telemetry).toMatchObject({ fragsTerminados: 1, totalFrags: 2 });
  });
});

describe('bucle de descarga — rechazo 4xx del backend (bug 400)', () => {
  it('salta SOLO esa clase, la deja re-encolable y sigue con la próxima', async () => {
    motor.compilar = async (_f, _s, _c, titulo) => {
      if (titulo === 'Mala') {
        const e = new Error('El backend de Bun rechazó el fragmento con código: 400');
        e.tipoBackend = 'rechazo';
        e.httpStatus = 400;
        throw e;
      }
      return null;
    };

    await arrancarCola([item('Mala', 1), item('Buena', 2)]);
    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    // La clase saltada vuelve a 'pending' (NO a un 'error' que el resto del popup no reconoce).
    expect(store.local.listaPersistente.find(c => c.titulo === 'Mala').estado).toBe('pending');
    // La siguiente se descargó igual: la cola NO se frenó.
    expect(store.local.listaPersistente.find(c => c.titulo === 'Buena').estado).toBe('downloaded');
    expect(store.local.colaDescargas).toEqual([]);

    // Aviso al popup + historial, y NADA de pausa/alarma.
    expect(mensajesEnviados.find(m => m.action === 'clase_con_error')).toMatchObject({ titulo: 'Mala' });
    expect(accionesEnviadas()).not.toContain('cola_pausada_por_error');
    expect(alarmas.creadas).toHaveLength(0);
    await esperarA(() => fallosRegistrados.length === 1, 'fallo en historial');
    expect(fallosRegistrados[0]).toMatchObject({ tipo: 'rechazo', titulo: 'Mala' });
  });
});

describe('bucle de descarga — fallos que pausan la cola', () => {
  it('sesión expirada: pausa SIN alarma de autoheal (el daemon no ve el login)', async () => {
    motor.compilar = async () => {
      const e = new Error('sin sesión');
      e.tipoConexion = 'sesion';
      throw e;
    };

    await arrancarCola([item('Clase 1', 1)]);
    await esperarA(() => accionesEnviadas().includes('cola_pausada_por_error'), 'pausa');

    expect(mensajesEnviados.find(m => m.action === 'cola_pausada_por_error'))
      .toMatchObject({ errorType: 'sesion', titulo: 'Clase 1' });
    expect(store.session.colaPausadaPorError).toBe(true);
    expect(store.session.rafagaCorriendo).toBe(false);
    expect(alarmas.creadas).toHaveLength(0);
    await esperarA(() => fallosRegistrados.length === 1, 'fallo en historial');
    expect(fallosRegistrados[0]).toMatchObject({ tipo: 'sesion' });
  });

  it('servidor caído: pausa Y crea la alarma de autoheal', async () => {
    estadoConexion = { servidor: false, internet: true, tipoFalla: 'servidor' };
    motor.compilar = async () => { throw new Error('falló el POST al backend'); };

    await arrancarCola([item('Clase 1', 1)]);
    await esperarA(() => accionesEnviadas().includes('cola_pausada_por_error'), 'pausa');

    expect(mensajesEnviados.find(m => m.action === 'cola_pausada_por_error'))
      .toMatchObject({ errorType: 'servidor' });
    expect(alarmas.creadas).toEqual([{ nombre: 'alarma_autoheal', opciones: { periodInMinutes: 0.2 } }]);
    expect(store.session.tipoDeErrorConexion).toBe('servidor');
  });

  it('cancelación del usuario: NO es un fallo (no pausa, no historial)', async () => {
    // Camino real: el usuario aprieta "detener" → IPC abortar_rafaga_inmediata (que setea
    // abortadoPorUsuario y aborta el controlador) → los fetches hermanos rechazan con
    // AbortError. Simular sólo el flag en storage no sería fiel: el handler es el que
    // además apaga loopActivo.
    motor.compilar = async () => {
      await invocar({ action: 'abortar_rafaga_inmediata' });
      throw Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
    };

    await arrancarCola([item('Clase 1', 1)]);
    await new Promise(r => setTimeout(r, 150));

    expect(accionesEnviadas()).not.toContain('cola_pausada_por_error');
    expect(fallosRegistrados).toEqual([]);
    expect(alarmas.creadas).toHaveLength(0);
  });
});

describe('frenado suave', () => {
  it('termina el video en curso y NO arranca el siguiente', async () => {
    // El freno se pide MIENTRAS baja la primera clase: iniciar_descarga_cola resetea
    // frenadoSuaveSolicitado, así que sembrarlo antes de arrancar no probaría nada.
    let primera = true;
    motor.compilar = async () => {
      if (primera) {
        primera = false;
        await invocar({ action: 'activar_frenado_suave' });
      }
      return null;
    };

    await arrancarCola([item('Clase 1', 1), item('Clase 2', 2)]);
    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'freno');

    expect(mensajesEnviados.find(m => m.action === 'cola_completamente_vacia').suaveFrenado).toBe(true);
    expect(store.session.rafagaCorriendo).toBe(false);
    // La primera terminó; la segunda quedó en la cola, intacta para reanudar después.
    expect(store.local.listaPersistente.find(c => c.titulo === 'Clase 1').estado).toBe('downloaded');
    expect(store.local.colaDescargas.map(c => c.titulo)).toEqual(['Clase 2']);
  });
});

describe('auto-heal por alarma', () => {
  it('reanuda la cola cuando vuelve la conexión que la había pausado', async () => {
    store.session.colaPausadaPorError = true;
    store.session.tipoDeErrorConexion = 'servidor';
    store.local.colaDescargas = [item('Clase 1', 1)];
    store.local.listaPersistente = [{ titulo: 'Clase 1', estado: 'process' }];
    estadoConexion = { servidor: true, internet: true, tipoFalla: null };

    await oyenteAlarma({ name: 'alarma_autoheal' });
    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'reanudó y drenó');

    expect(alarmas.limpiadas).toContain('alarma_autoheal');
    expect(store.session.colaPausadaPorError).toBe(false);
    expect(store.local.listaPersistente[0].estado).toBe('downloaded');
  });

  it('NO reanuda si la conexión sigue caída', async () => {
    store.session.colaPausadaPorError = true;
    store.session.tipoDeErrorConexion = 'servidor';
    estadoConexion = { servidor: false, internet: true, tipoFalla: 'servidor' };

    await oyenteAlarma({ name: 'alarma_autoheal' });

    expect(store.session.colaPausadaPorError).toBe(true);
    expect(accionesEnviadas()).not.toContain('cola_completamente_vacia');
  });

  it('con tipo "sesion" limpia la alarma y no reanuda (guarda defensiva)', async () => {
    store.session.colaPausadaPorError = true;
    store.session.tipoDeErrorConexion = 'sesion';

    await oyenteAlarma({ name: 'alarma_autoheal' });

    expect(alarmas.limpiadas).toContain('alarma_autoheal');
    expect(store.session.colaPausadaPorError).toBe(true);
  });

  it('sin cola pausada, la alarma sólo se limpia sola', async () => {
    store.session.colaPausadaPorError = false;

    await oyenteAlarma({ name: 'alarma_autoheal' });

    expect(alarmas.limpiadas).toContain('alarma_autoheal');
  });
});
