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
import { ProgramadorEnMemoria } from './core/puertos/programadorEnMemoria.ts';
import { MensajeriaEnMemoria } from './core/puertos/mensajeriaEnMemoria.ts';
import { crearEstadoSesion } from './core/cola/estadoSesion.ts';
import { crearEstadosProgreso } from './core/cola/estadosProgreso.ts';
import { crearProcesadorCola } from './core/cola/procesadorCola.ts';

const store = { local: {}, session: {} };

/**
 * El puerto de mensajería (Fase 5c). Reemplaza al mock de `chrome.runtime.onMessage` +
 * `sendMessage`: el SW ya no toca ninguno de los dos. Los tests invocan handlers con
 * `enviar()` y afirman sobre lo que el SW emitió mirando `notificados` — que a propósito NO
 * incluye lo que mandó el propio test, cosa que el array único del mock viejo no distinguía.
 */
let mensajeria;
/**
 * El puerto de programación del auto-heal (Fase 5c). Reemplaza al mock de `chrome.alarms`:
 * el SW ya no la toca. Ojo con una diferencia de fidelidad que el mock viejo no tenía —
 * `dispararAhora` sólo notifica si la alarma está **programada**, igual que el navegador. Un
 * test que simule un disparo tiene que programarla primero, como parte de sembrar el estado
 * "la cola quedó pausada con su alarma viva".
 */
let programador;
const ALARMA_AUTOHEAL = 'alarma_autoheal';
/** Fallos registrados vía registrarFallo (historial + notificación). */
let fallosRegistrados = [];
/** Lo empujado a la barra de progreso de la consola del backend Bun. */
let consolaBackend = [];

/** Comportamiento configurable del motor HLS por test. */
let motor = {};
/** Estado que reporta el daemon de conexión. */
let estadoConexion = { servidor: true, internet: true, tipoFalla: null };

/** Lo que el SW EMITIÓ (no lo que el test mandó para invocarlo). */
const accionesEnviadas = () => mensajeria.accionesNotificadas();

/** Espera activa hasta que se cumpla `cond` (el loop encadena con setTimeout 60ms). */
async function esperarA(cond, descripcion = 'condición', limiteMs = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < limiteMs) {
    if (cond()) return;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error(`Timeout esperando: ${descripcion}`);
}

/**
 * Implementación del PuertoAlmacenamiento sobre el objeto `store` del harness.
 *
 * A propósito NO se usa acá `AlmacenamientoEnMemoria` (el adaptador real de core/): estos son
 * tests de CARACTERIZACIÓN, y cambiar al mismo tiempo el código bajo prueba y la forma de
 * sembrar/inspeccionar el estado anularía su valor — no podrían distinguir "la migración
 * cambió el comportamiento" de "cambió el harness". Los tests siguen sembrando y leyendo
 * `store.local`/`store.session` igual que antes de la migración. El contrato del puerto en sí
 * ya está cubierto, aparte, en `core/puertos/almacenamientoEnMemoria.test.ts`.
 */
function crearAlmacenamientoDePrueba() {
  const leer = (bucket, claves) => {
    const o = {};
    claves.forEach(k => { if (k in bucket) o[k] = bucket[k]; });
    return o;
  };
  return {
    obtenerLocal: async (claves) => leer(store.local, claves),
    guardarLocal: async (valores) => { Object.assign(store.local, valores); },
    borrarLocal: async (claves) => { claves.forEach(k => delete store.local[k]); },
    obtenerSesion: async (claves) => leer(store.session, claves),
    guardarSesion: async (valores) => { Object.assign(store.session, valores); },
    borrarSesion: async (claves) => { claves.forEach(k => delete store.session[k]); },
    onCambio: () => () => {},
  };
}

beforeAll(async () => {
  globalThis.importScripts = () => {};
  // Puerto de almacenamiento (Fase 5b): lo publica plataforma/composicion.ts en producción.
  globalThis.Almacenamiento = crearAlmacenamientoDePrueba();
  // SessionState salió de background.js en la Fase 6b: ahora lo publica la composición. Se
  // construye sobre el MISMO doble de almacenamiento, así los tests siguen sembrando y
  // leyendo `store.session` como siempre.
  globalThis.SessionState = crearEstadoSesion(globalThis.Almacenamiento);
  // Puerto de programación (Fase 5c), el de la alarma de auto-sanación. Se crea una sola vez
  // porque el SW registra su oyente al evaluarse, igual que con el listener de IPC.
  programador = new ProgramadorEnMemoria();
  globalThis.Programador = programador;
  // Puerto de mensajería (Fase 5c). El timeout generoso NO es decorativo: los handlers del SW
  // devuelven `true` (respondo async) y contestan recién tras varios `await` contra storage.
  // Con el 0ms por defecto, el puerto rechazaría antes de que llegue la respuesta y los tests
  // fallarían por el reloj, no por la lógica.
  mensajeria = new MensajeriaEnMemoria(5000);
  globalThis.Mensajeria = mensajeria;
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
    // El nombre del portal alimenta el copy de la pausa (Capa 1 no lo puede saber).
    nombre: 'Portal de Prueba',
    patronPestañas: 'https://portal/*',
    urlSondeoInternet: 'https://portal',
  };
  globalThis.HlsEngine = {
    descargarYAnalizarIndexM3u8: async (...args) => motor.analizar(...args),
    compilarTranscodificacionStream: async (...args) => motor.compilar(...args),
  };
  // El bucle de descarga se fue a core/cola/ en la Fase 6b. El harness construye el
  // procesador REAL con dobles de sus once colaboradores — no lo stubea: es justamente el
  // código que estos tests caracterizan. Los `chrome.*` que le quedaban (notificación nativa,
  // volcado legacy) entran como callbacks, así que acá son no-ops observables.
  globalThis.EstadosProgreso = crearEstadosProgreso(globalThis.Almacenamiento);
  globalThis.HistorialFallos = {
    registrar: async (tipo, titulo, motivo) => {
      fallosRegistrados.push({ tipo, titulo, motivo });
      return { id: 'x' };
    },
  };

  globalThis.Cola = crearProcesadorCola({
    almacenamiento: globalThis.Almacenamiento,
    sesion: globalThis.SessionState,
    mensajeria,
    programador,
    conexion: globalThis.Conexion,
    motor: globalThis.HlsEngine,
    // ADR-0010: el bucle resuelve el portal por ítem. El doble imita al envoltorio real de
    // composicion.ts, migración incluida: sin sitioId es un dato viejo y resuelve; un id
    // desconocido no.
    sitios: {
      obtener: (id) =>
        id === undefined || id === 'ramonnet' ? globalThis.SitioActivo : undefined,
    },
    historial: globalThis.HistorialFallos,
    notificarFallo: () => {},
    calcularMetricas: globalThis.Utils.calcularMétricasProgreso,
    actualizarConsolaBackend: (d) => consolaBackend.push(d),
    guardarBlobLegacy: async () => {},
    persistirEstados: (e) => globalThis.EstadosProgreso.persistir(e),
    recuperarEstados: () => globalThis.EstadosProgreso.recuperar(),
  });

  const noopEvent = { addListener: () => {} };
  globalThis.chrome = {
    runtime: {
      lastError: null,
      onInstalled: noopEvent,
      // El IPC del SW va entero por el PuertoMensajeria (Fase 5c): ni el receptor ni los
      // emisores tocan chrome.runtime. Si alguno vuelve, que explote acá.
      get onMessage() { throw new Error('el SW no debe usar chrome.runtime.onMessage: va por Mensajeria'); },
      get sendMessage() { throw new Error('el SW no debe usar chrome.runtime.sendMessage: va por Mensajeria'); },
      getURL: (p) => p,
    },
    // El SW ya no toca chrome.storage: todo pasa por el puerto. Si algo vuelve a usarlo,
    // que explote en vez de pasar en silencio.
    get storage() { throw new Error('el SW no debe usar chrome.storage: va por Almacenamiento'); },
    // Mismo criterio que storage: el SW ya no toca chrome.alarms (va por Programador).
    get alarms() { throw new Error('el SW no debe usar chrome.alarms: va por Programador'); },
    downloads: { search: async () => [] },
    notifications: { onClicked: noopEvent, create: () => {}, clear: () => {} },
    tabs: { query: async () => [], update: async () => {}, create: async () => {} },
    windows: { update: async () => {} },
  };

  // FASE 7A: el SW dejó de leer globals. Antes acá alcanzaba con `await import(...)` y el
  // archivo se enganchaba a lo que hubiera en `globalThis`; ahora se le PASAN las mismas
  // piezas que arma este harness. Los `globalThis.X` de arriba se conservan a propósito: son
  // los que siguen consumiendo el procesador de cola real y los dobles entre sí, y cambiarlos
  // en el mismo corte que el código bajo prueba es justo lo que estos tests de
  // caracterización no deben hacer. Ninguna aserción cambió.
  const { iniciarServiceWorker } = await import('./background.js');
  iniciarServiceWorker({
    almacenamiento: globalThis.Almacenamiento,
    mensajeria,
    programador,
    sesion: globalThis.SessionState,
    estadosProgreso: globalThis.EstadosProgreso,
    cola: globalThis.Cola,
    backend: globalThis.BunClient,
    sitio: globalThis.SitioActivo,
  });
});

beforeEach(() => {
  store.local = {};
  store.session = {};
  // Las dos instancias se conservan (el SW enganchó sus oyentes al cargarse); se limpia
  // sólo lo acumulado: el registro de mensajes y lo que haya quedado programado.
  mensajeria.limpiarRegistro();
  programador.cancelar(ALARMA_AUTOHEAL);
  fallosRegistrados = [];
  consolaBackend = [];
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

/** Invoca el receptor IPC del SW y resuelve con lo que haya contestado. */
function invocar(request) {
  return mensajeria.enviar(request);
}

describe('listener IPC', () => {
  it('ante una acción desconocida el SW no responde (devuelve false, no abre el canal)', async () => {
    // El receptor devuelve `false` síncrono, así que el puerto resuelve `undefined` en vez de
    // quedarse esperando: es la forma que tiene el adaptador de decir "nadie se hizo cargo".
    await expect(mensajeria.enviar({ action: 'accion_inexistente' })).resolves.toBeUndefined();
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
    const guardadas = mensajeria.notificados.filter(m => m.action === 'clase_guardada_ok').map(m => m.titulo);
    expect(guardadas).toEqual(['Clase 1', 'Clase 2']);
  });

  it('respeta el orden FIFO por fechaEncolado, no el del array', async () => {
    await arrancarCola([item('Segunda', 200), item('Primera', 100)]);

    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    const guardadas = mensajeria.notificados.filter(m => m.action === 'clase_guardada_ok').map(m => m.titulo);
    expect(guardadas).toEqual(['Primera', 'Segunda']);
  });

  it('le pasa al motor el contexto de la ráfaga (turbo, título, sessionId y cómo frenar a los hermanos)', async () => {
    // Contrato nuevo de la Fase 6: el motor ya no lee SessionState ni conoce el
    // AbortController del SW. Si esto se rompe, el motor descarga con el título equivocado o
    // deja de poder frenar a los workers hermanos — y nada más lo detecta.
    let visto = null;
    motor.compilar = async (_f, _s, _c, contexto) => { visto = contexto; return null; };

    await arrancarCola([item('Clase 1', 1)]);
    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    expect(visto).toMatchObject({ modoTurbo: true, titulo: 'Clase 1' });
    expect(visto.sessionId).toBeTruthy();
    expect(typeof visto.abortarHermanos).toBe('function');
  });

  it('emite progreso con telemetría mientras baja los fragmentos', async () => {
    // Firma desde la Fase 6: (metadata, signal, subcarpeta, contexto, callbacks).
    motor.compilar = async (_frags, _signal, _carpeta, _contexto, cbs) => {
      await cbs.onFragmentoCompletado(500, 2, 500, 1);
      return null;
    };
    await arrancarCola([item('Clase 1', 1)]);

    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'cola vacía');

    const progreso = mensajeria.notificados.find(m => m.action === 'update_progress_bar');
    expect(progreso).toMatchObject({ titulo: 'Clase 1', percentage: 50 });
    expect(progreso.telemetry).toMatchObject({ fragsTerminados: 1, totalFrags: 2 });

    // El progreso tiene DOS destinos y sólo uno es el popup: el otro es la barra de la
    // consola del backend Bun, que es lo único que el usuario ve con el popup cerrado.
    // Este expect existe porque la Fase 6b se comió esa llamada al extraer el bucle y NADIE
    // lo detectó — ni los 262 tests ni el compilador; se vio recién usando la extensión.
    expect(consolaBackend).toContainEqual(
      expect.objectContaining({ titulo: 'Clase 1', porcentaje: 50, terminados: 1, totales: 2 })
    );
  });
});

describe('bucle de descarga — rechazo 4xx del backend (bug 400)', () => {
  it('salta SOLO esa clase, la deja re-encolable y sigue con la próxima', async () => {
    // El título viaja dentro del `contexto` desde la Fase 6, no como 4º argumento suelto.
    motor.compilar = async (_f, _s, _c, contexto) => {
      if (contexto.titulo === 'Mala') {
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
    expect(mensajeria.notificados.find(m => m.action === 'clase_con_error')).toMatchObject({ titulo: 'Mala' });
    expect(accionesEnviadas()).not.toContain('cola_pausada_por_error');
    expect(programador.nombresProgramados()).toEqual([]);
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

    expect(mensajeria.notificados.find(m => m.action === 'cola_pausada_por_error'))
      .toMatchObject({ errorType: 'sesion', titulo: 'Clase 1' });
    expect(store.session.colaPausadaPorError).toBe(true);
    expect(store.session.rafagaCorriendo).toBe(false);
    expect(programador.nombresProgramados()).toEqual([]);
    await esperarA(() => fallosRegistrados.length === 1, 'fallo en historial');
    expect(fallosRegistrados[0]).toMatchObject({ tipo: 'sesion' });
  });

  it('servidor caído: pausa Y crea la alarma de autoheal', async () => {
    estadoConexion = { servidor: false, internet: true, tipoFalla: 'servidor' };
    motor.compilar = async () => { throw new Error('falló el POST al backend'); };

    await arrancarCola([item('Clase 1', 1)]);
    await esperarA(() => accionesEnviadas().includes('cola_pausada_por_error'), 'pausa');

    expect(mensajeria.notificados.find(m => m.action === 'cola_pausada_por_error'))
      .toMatchObject({ errorType: 'servidor' });
    expect(programador.periodoDe(ALARMA_AUTOHEAL)).toBe(0.2);
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
    expect(programador.nombresProgramados()).toEqual([]);
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

    expect(mensajeria.notificados.find(m => m.action === 'cola_completamente_vacia').suaveFrenado).toBe(true);
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

    // La alarma existe porque la cola se pausó: sin esto el disparo no notificaría a nadie,
    // igual que en el navegador (ver la nota del harness sobre fidelidad).
    programador.programar(ALARMA_AUTOHEAL, { periodoMin: 0.2 });

    expect(await programador.dispararYEsperar(ALARMA_AUTOHEAL)).toBe(true);
    await esperarA(() => accionesEnviadas().includes('cola_completamente_vacia'), 'reanudó y drenó');

    expect(programador.estaProgramada(ALARMA_AUTOHEAL)).toBe(false);
    expect(store.session.colaPausadaPorError).toBe(false);
    expect(store.local.listaPersistente[0].estado).toBe('downloaded');
  });

  it('NO reanuda si la conexión sigue caída', async () => {
    store.session.colaPausadaPorError = true;
    store.session.tipoDeErrorConexion = 'servidor';
    estadoConexion = { servidor: false, internet: true, tipoFalla: 'servidor' };

    // La alarma existe porque la cola se pausó: sin esto el disparo no notificaría a nadie,
    // igual que en el navegador (ver la nota del harness sobre fidelidad).
    programador.programar(ALARMA_AUTOHEAL, { periodoMin: 0.2 });

    expect(await programador.dispararYEsperar(ALARMA_AUTOHEAL)).toBe(true);

    expect(store.session.colaPausadaPorError).toBe(true);
    expect(accionesEnviadas()).not.toContain('cola_completamente_vacia');
  });

  it('con tipo "sesion" limpia la alarma y no reanuda (guarda defensiva)', async () => {
    store.session.colaPausadaPorError = true;
    store.session.tipoDeErrorConexion = 'sesion';

    // La alarma existe porque la cola se pausó: sin esto el disparo no notificaría a nadie,
    // igual que en el navegador (ver la nota del harness sobre fidelidad).
    programador.programar(ALARMA_AUTOHEAL, { periodoMin: 0.2 });

    expect(await programador.dispararYEsperar(ALARMA_AUTOHEAL)).toBe(true);

    expect(programador.estaProgramada(ALARMA_AUTOHEAL)).toBe(false);
    expect(store.session.colaPausadaPorError).toBe(true);
  });

  it('sin cola pausada, la alarma sólo se limpia sola', async () => {
    store.session.colaPausadaPorError = false;

    // La alarma existe porque la cola se pausó: sin esto el disparo no notificaría a nadie,
    // igual que en el navegador (ver la nota del harness sobre fidelidad).
    programador.programar(ALARMA_AUTOHEAL, { periodoMin: 0.2 });

    expect(await programador.dispararYEsperar(ALARMA_AUTOHEAL)).toBe(true);

    expect(programador.estaProgramada(ALARMA_AUTOHEAL)).toBe(false);
  });
});
