// @vitest-environment jsdom
/**
 * Tests de BunClient.obtenerRutaServidor (shared/bunClient.js).
 * Foco: el timeout duro que evita que un servidor colgado congele al poller del
 * daemon de conexión (regresión del bug "dice conectado estando apagado").
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import BunClient from './bunClient.js';

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
    globalThis.fetch = vi.fn((url, opts) => new Promise((_, reject) => {
      opts.signal.addEventListener('abort', () =>
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      );
    }));
    // timeout corto para no demorar el test; el abort debe rechazar la promesa.
    await expect(BunClient.obtenerRutaServidor({ timeoutMs: 20 })).rejects.toThrow();
  });

  it('propaga el error si el server responde !ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(BunClient.obtenerRutaServidor()).rejects.toThrow(/no respondió/);
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
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/host:9999\/api\/escanear-disco/)
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
    globalThis.fetch = fetchQueCuelga();
    const err = await BunClient
      .enviarFragmentoStream(new Uint8Array([1, 2]), headers, undefined, 20)
      .catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).not.toBe('AbortError'); // el SW trata AbortError como cancelación de usuario
    expect(err.message).toMatch(/backend|timeout/i);
  });

  it('propaga el AbortError del usuario tal cual (cancelación limpia)', async () => {
    globalThis.fetch = fetchQueCuelga();
    const userController = new AbortController();
    const p = BunClient
      .enviarFragmentoStream(new Uint8Array([1]), headers, userController.signal, 10000)
      .catch(e => e);
    userController.abort();
    const err = await p;
    expect(err.name).toBe('AbortError');
  });
});
