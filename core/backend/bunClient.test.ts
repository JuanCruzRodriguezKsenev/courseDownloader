// @vitest-environment jsdom
/**
 * Tests de BunClient (core/backend/bunClient.ts).
 * Foco: el timeout duro que evita que un servidor colgado congele al poller del
 * daemon de conexión (regresión del bug "dice conectado estando apagado").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BunClient from './bunClient.ts';

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  BunClient.configurarBaseUrl(); // reset del singleton al default (evita fugas entre tests)
});

describe('obtenerRutaServidor()', () => {
  it('devuelve data.ruta y usa cache:"no-store" cuando el server responde OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ruta: 'C:/RamonNet' })
    });
    const ruta = await BunClient.obtenerRutaServidor();
    expect(ruta).toBe('C:/RamonNet');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/health'),
      expect.objectContaining({ cache: 'no-store', signal: expect.anything() })
    );
  });

  it('rechaza (no se cuelga) cuando el fetch nunca resuelve: el timeout lo aborta', async () => {
    // Simula el server "colgado": el fetch sólo termina si se dispara el abort.
    globalThis.fetch = vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      );
    })) as unknown as typeof fetch;
    // timeout corto para no demorar el test; el abort debe rechazar la promesa.
    await expect(BunClient.obtenerRutaServidor({ timeoutMs: 20 })).rejects.toThrow();
  });

  it('propaga el error si el server responde !ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(BunClient.obtenerRutaServidor()).rejects.toThrow(/no respondió/);
  });
});

/**
 * [LOADERS — ítem 4] Los dos fetch que no tenían techo.
 *
 * El cliente estaba asimétrico y no por diseño: `obtenerRutaServidor` (4 s) y
 * `enviarFragmentoStream` (30 s) tenían timeout con el motivo escrito —en Windows
 * `localhost:3001` con el server apagado **cuelga** en vez de rechazar— y estos dos no tenían
 * ninguno. El síntoma no era un error: era el popup clavado en "Sincronizando disco local…"
 * con la lista atenuada, sin salida ni mensaje.
 *
 * Los tests simulan el cuelgue igual que el de arriba: un `fetch` que sólo termina si alguien
 * dispara el abort. Si el timeout no existiera, la promesa nunca resolvería y el test moriría
 * por timeout de Vitest en vez de pasar — que es exactamente la diferencia que se quiere fijar.
 */
describe('los fetch que pueden colgar tienen techo', () => {
  const fetchQueSeCuelga = () =>
    vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      );
    })) as unknown as typeof fetch;

  it('escanearDisco() aborta en vez de colgarse para siempre', async () => {
    globalThis.fetch = fetchQueSeCuelga();
    await expect(BunClient.escanearDisco('anatomia', 'ramonnet', { timeoutMs: 20 })).rejects.toThrow();
  });

  it('escanearDisco() le pasa el signal al fetch (sin eso el timeout no aborta nada)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ archivos: [] }) });
    await BunClient.escanearDisco('anatomia', 'ramonnet');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/escanear-disco'),
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('escanearDisco() sigue devolviendo los archivos cuando el server contesta', async () => {
    // El techo no puede cambiarle el comportamiento al camino feliz.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ archivos: ['clase 1.mp4', 'clase 2.mp4'] })
    });
    const data = await BunClient.escanearDisco('anatomia', 'ramonnet');
    expect(data.archivos).toEqual(['clase 1.mp4', 'clase 2.mp4']);
  });

  it('seleccionarCarpeta() aborta en vez de colgarse para siempre', async () => {
    globalThis.fetch = fetchQueSeCuelga();
    await expect(BunClient.seleccionarCarpeta({ timeoutMs: 20 })).rejects.toThrow();
  });

  it('seleccionarCarpeta() tiene un techo MUCHO más generoso: del otro lado hay una persona', async () => {
    // La aserción es sobre el default, y es el punto del ítem: un techo de segundos acá le
    // cancelaría el diálogo nativo a alguien que está eligiendo una carpeta. Se fija contra el
    // techo del escaneo de disco para que nadie los "unifique" a un valor común.
    vi.useFakeTimers();
    try {
      globalThis.fetch = fetchQueSeCuelga();
      const promesa = BunClient.seleccionarCarpeta();
      promesa.catch(() => {}); // el rechazo se afirma abajo; esto evita el unhandled rejection
      // A los 30 s —techo del fragmento, y seis veces el del disco— todavía NO abortó.
      await vi.advanceTimersByTimeAsync(30000);
      let abortoTemprano = false;
      promesa.catch(() => { abortoTemprano = true; });
      await Promise.resolve();
      expect(abortoTemprano).toBe(false);
      // A los 3 min sí.
      await vi.advanceTimersByTimeAsync(150001);
      await expect(promesa).rejects.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('seleccionarCarpeta() devuelve la ruta elegida cuando el diálogo se completa', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, ruta: 'D:/Cursos' })
    });
    const res = await BunClient.seleccionarCarpeta();
    expect(res).toEqual({ success: true, ruta: 'D:/Cursos' });
  });
});

describe('baseUrl configurable', () => {
  // El override por globalThis.RAMONNET_BUN_BASE_URL ocurre al cargar el módulo y no se
  // puede reejercitar sin reimportar; se cubre por inspección (el init usa el mismo
  // normalizarBaseUrl que configurarBaseUrl, testeado abajo).
  it('por defecto apunta a http://localhost:3001', () => {
    expect(BunClient.baseUrl).toBe('http://localhost:3001');
  });

  it('configurarBaseUrl normaliza (saca la barra final)', () => {
    BunClient.configurarBaseUrl('http://192.168.1.5:3001/');
    expect(BunClient.baseUrl).toBe('http://192.168.1.5:3001');
  });

  it('configurarBaseUrl con arg inválido/vacío vuelve al default', () => {
    BunClient.configurarBaseUrl('http://otro:1234');
    BunClient.configurarBaseUrl('');
    expect(BunClient.baseUrl).toBe('http://localhost:3001');
    BunClient.configurarBaseUrl(undefined);
    expect(BunClient.baseUrl).toBe('http://localhost:3001');
  });

  it('las funciones usan la URL configurada', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    BunClient.configurarBaseUrl('http://host:9999');
    await BunClient.escanearDisco('x');
    // El segundo argumento entró con el timeout del ítem 4 de la auditoría de loaders:
    // `escanearDisco` pasó de `fetch(url)` a `fetch(url, { signal })`. Este test afirmaba la
    // llamada con UN solo argumento, así que el cambio lo rompió — correctamente: es lo que
    // hace un test de firma. Lo que le importa sigue siendo la URL.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/host:9999\/api\/escanear-disco/),
      expect.objectContaining({ signal: expect.anything() })
    );
  });
});

describe('enviarFragmentoStream()', () => {
  const headers = { videoTitle: 't', chunkIndex: 0, totalChunks: 1, targetFolder: 'f', sessionId: 's' };
  // fetch que sólo termina si se dispara el abort del signal (server "colgado").
  const fetchQueCuelga = () => vi.fn((url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () =>
      reject(new DOMException('The operation was aborted.', 'AbortError'))
    );
  }));

  it('ante timeout lanza un Error de backend, NO un AbortError (para que el SW pause la cola)', async () => {
    globalThis.fetch = fetchQueCuelga() as unknown as typeof fetch;
    const err = await BunClient
      .enviarFragmentoStream(new Uint8Array([1, 2]), headers, undefined, 20)
      .catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).not.toBe('AbortError'); // el SW trata AbortError como cancelación de usuario
    expect(err.message).toMatch(/backend|timeout/i);
  });

  it('propaga el AbortError del usuario tal cual (cancelación limpia)', async () => {
    globalThis.fetch = fetchQueCuelga() as unknown as typeof fetch;
    const userController = new AbortController();
    const p = BunClient
      .enviarFragmentoStream(new Uint8Array([1]), headers, userController.signal, 10000)
      .catch(e => e);
    userController.abort();
    const err = await p;
    expect(err.name).toBe('AbortError');
  });

  // Bug 400: un rechazo 4xx debe quedar TIPADO (err.tipoBackend="rechazo" + httpStatus)
  // para que aguas arriba se salte SOLO esa clase; un 5xx NO se tipa (mantiene pausa+autoheal).
  it('4xx: tipa el error como "rechazo" con httpStatus (rechazo aplicativo determinístico)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const err = await BunClient
      .enviarFragmentoStream(new Uint8Array([1, 2]), headers, undefined, 10000)
      .catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.tipoBackend).toBe('rechazo');
    expect(err.httpStatus).toBe(400);
  });

  it('5xx: NO tipa "rechazo" (conserva el flujo pausa+autoheal), pero sí expone httpStatus', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const err = await BunClient
      .enviarFragmentoStream(new Uint8Array([1, 2]), headers, undefined, 10000)
      .catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.tipoBackend).toBeUndefined();
    expect(err.httpStatus).toBe(503);
  });
});

// [MULTIPORTAL E] El portal viaja al backend para que el archivo caiga en
// `raíz/<portal>/<materia>/`. Va en campos propios y no pegado a la materia porque el backend
// sanitiza cada segmento con `path.basename()`: un "portal/materia" se colapsaría a "materia".
describe('el portal viaja al backend (multiportal E)', () => {
  /** Las cabeceras del primer fetch, tipadas: `mock.calls` es una tupla vacía para `tsc`. */
  const cabecerasDe = (espia: { mock: { calls: unknown[][] } }) =>
    (espia.mock.calls[0]?.[1] as { headers: Record<string, string> }).headers;
  const urlDe = (espia: { mock: { calls: unknown[][] } }) => String(espia.mock.calls[0]?.[0]);
  const respuestaOk = () =>
    vi.fn(async () => new Response(JSON.stringify({ archivos: [] }), { status: 200 }));

  it('enviarFragmentoStream manda x-site-folder', async () => {
    const espia = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = espia as unknown as typeof fetch;

    await BunClient.enviarFragmentoStream(new Uint8Array([1]), {
      videoTitle: 't', chunkIndex: 0, totalChunks: 1, targetFolder: 'biologia',
      siteFolder: 'ramonnet', sessionId: 's',
    });

    const opts = cabecerasDe(espia);
    expect(opts['x-site-folder']).toBe('ramonnet');
    // La materia sigue yendo sola en su header: son dos segmentos, no uno concatenado.
    expect(opts['x-target-folder']).toBe('biologia');
  });

  it('sin siteFolder manda vacío, y el backend cae al layout viejo', async () => {
    const espia = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = espia as unknown as typeof fetch;

    await BunClient.enviarFragmentoStream(new Uint8Array([1]), {
      videoTitle: 't', chunkIndex: 0, totalChunks: 1, targetFolder: 'biologia', sessionId: 's',
    });

    expect(cabecerasDe(espia)['x-site-folder']).toBe('');
  });

  it('escanearDisco pide la carpeta DENTRO del portal', async () => {
    const espia = respuestaOk();
    globalThis.fetch = espia as unknown as typeof fetch;

    await BunClient.escanearDisco('biologia', 'ramonnet');

    expect(urlDe(espia)).toContain('carpeta=biologia');
    expect(urlDe(espia)).toContain('sitio=ramonnet');
  });

  it('escanearDisco sin portal no manda el parámetro (compatible con el backend viejo)', async () => {
    const espia = respuestaOk();
    globalThis.fetch = espia as unknown as typeof fetch;

    await BunClient.escanearDisco('biologia');

    expect(urlDe(espia)).not.toContain('sitio=');
  });

  it('cancelarDescarga lleva el portal, para no borrar el .part del otro', async () => {
    const espia = respuestaOk();
    globalThis.fetch = espia as unknown as typeof fetch;

    await BunClient.cancelarDescarga('Semana 3', 'sess-1', 'ramonnet');

    const url = urlDe(espia);
    expect(url).toContain('titulo=Semana%203');
    expect(url).toContain('sitio=ramonnet');
  });
});
