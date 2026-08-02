/**
 * Tests de las funciones puras de HlsEngine (background/hlsEngine.js):
 *   - descargarYAnalizarIndexM3u8: manifiesto M3U8 → { urls, lineaLlave, urlLlave }.
 * No tocan chrome.*; sólo se mockea la global Utils.fetchConReintentos.
 * (compilarTranscodificacionStream queda fuera: depende de SessionState/crypto/BunClient.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HlsEngine from './hlsEngine.js';

// Silenciar los console.log de diagnóstico del motor durante los tests.
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.Utils = { fetchConReintentos: vi.fn() };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.Utils;
});

/** Respuesta simulada para el fetch del manifiesto .m3u8. */
function resTexto(texto) {
  return { text: async () => texto };
}

describe('descargarYAnalizarIndexM3u8()', () => {
  const BASE = 'https://vz-c3e7bda8-f29.b-cdn.net/xyz/480p';
  const URL_M3U8 = `${BASE}/video.m3u8`;

  it('absolutiza fragmentos y clave relativos contra la base del manifiesto', async () => {
    const manifiesto = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x00000000000000000000000000000000',
      '#EXTINF:6.0,',
      'seg0.ts',
      '#EXTINF:6.0,',
      'seg1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');
    Utils.fetchConReintentos.mockResolvedValue(resTexto(manifiesto));

    const r = await HlsEngine.descargarYAnalizarIndexM3u8(URL_M3U8);
    expect(r.urls).toEqual([`${BASE}/seg0.ts`, `${BASE}/seg1.ts`]);
    expect(r.urlLlave).toBe(`${BASE}/key.bin`);
    expect(r.lineaLlave).toContain('#EXT-X-KEY');
  });

  it('respeta fragmentos y clave que ya son URLs absolutas', async () => {
    const manifiesto = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="https://keys.test/k.bin"',
      'https://otro.cdn.net/a.ts',
      'https://otro.cdn.net/b.ts'
    ].join('\n');
    Utils.fetchConReintentos.mockResolvedValue(resTexto(manifiesto));

    const r = await HlsEngine.descargarYAnalizarIndexM3u8(URL_M3U8);
    expect(r.urls).toEqual(['https://otro.cdn.net/a.ts', 'https://otro.cdn.net/b.ts']);
    expect(r.urlLlave).toBe('https://keys.test/k.bin');
  });

  it('lanza error si el manifiesto no tiene fragmentos', async () => {
    const manifiesto = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST';
    Utils.fetchConReintentos.mockResolvedValue(resTexto(manifiesto));
    await expect(
      HlsEngine.descargarYAnalizarIndexM3u8(URL_M3U8)
    ).rejects.toThrow(/no contiene fragmentos/);
  });
});

/**
 * Bug 400 (loop pausa/autoheal): el worker de compilarTranscodificacionStream reintenta
 * el envío N=3 SÓLO ante el rechazo 4xx tipado (err.tipoBackend="rechazo") y, agotado,
 * propaga el error tipado intacto para que background.js salte SOLO esa clase. Cualquier
 * otro error de envío se propaga en el primer intento. Se monta el harness mínimo del pool
 * (SessionState/BunClient/controladorGraficoActivo stubeados) — un solo fragmento sin clave
 * AES, así corre un único worker sin carrera de aborts entre hermanos.
 */
describe('compilarTranscodificacionStream() — reintento de rechazo 4xx (bug 400)', () => {
  // Un solo fragmento, sin clave: passthrough directo, un único worker activo.
  const META = { urls: ['https://cdn.test/seg0.ts'], lineaLlave: null, urlLlave: null };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
    globalThis.SessionState = {
      get: vi.fn().mockResolvedValue({
        modoTurboBunActivo: true,
        videoActualSessionId: 'sess1',
        videoActualTitulo: 'Titulo X'
      })
    };
    // El fetch del fragmento resuelve un buffer cualquiera (no hay clave → passthrough).
    Utils.fetchConReintentos.mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) });
    // El motor aborta este controlador global ante un fallo real de fragmento.
    globalThis.controladorGraficoActivo = new AbortController();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.SessionState;
    delete globalThis.BunClient;
    delete globalThis.controladorGraficoActivo;
  });

  it('4xx tipado: reintenta el envío 3 veces y propaga el error con tipoBackend/httpStatus intactos', async () => {
    const rechazo = Object.assign(new Error('rechazado 400'), { tipoBackend: 'rechazo', httpStatus: 400 });
    globalThis.BunClient = { enviarFragmentoStream: vi.fn().mockRejectedValue(rechazo) };

    const signal = new AbortController().signal;
    const corrida = HlsEngine.compilarTranscodificacionStream(META, signal, 'bio', 'Titulo X', {});
    const capturado = corrida.then(() => null, e => e); // captura el rechazo sin unhandled
    await vi.runAllTimersAsync(); // drena los 2 backoffs (300ms, 600ms)
    const err = await capturado;

    expect(BunClient.enviarFragmentoStream).toHaveBeenCalledTimes(3);
    expect(err).toMatchObject({ tipoBackend: 'rechazo', httpStatus: 400 });
  });

  it('error NO-rechazo (ej. 5xx/red): NO se reintenta — se propaga en el primer intento', async () => {
    const otro = Object.assign(new Error('El backend no respondió (timeout)'), { httpStatus: 503 });
    globalThis.BunClient = { enviarFragmentoStream: vi.fn().mockRejectedValue(otro) };

    const signal = new AbortController().signal;
    const corrida = HlsEngine.compilarTranscodificacionStream(META, signal, 'bio', 'Titulo X', {});
    const capturado = corrida.then(() => null, e => e);
    await vi.runAllTimersAsync();
    const err = await capturado;

    expect(BunClient.enviarFragmentoStream).toHaveBeenCalledTimes(1);
    expect(err).toBe(otro);
    expect(err.tipoBackend).toBeUndefined();
  });
});

/**
 * Pool de 6 workers de compilarTranscodificacionStream: el corazón del motor
 * (concurrencia fija, AES, streaming turbo vs blob, aborts en cascada). Se stubean
 * los ~6 globals que el SW le inyecta (SessionState/BunClient/Utils/crypto/
 * controladorGraficoActivo). Timers reales: acá no hay backoff (los reintentos de
 * rechazo tienen su propio bloque con fake timers arriba).
 */
describe('compilarTranscodificacionStream() — pool de workers', () => {
  /** Metadata de N fragmentos sin clave (passthrough directo). */
  const metaSinClave = (n) => ({
    urls: Array.from({ length: n }, (_, i) => `https://cdn.test/seg${i}.ts`),
    lineaLlave: null,
    urlLlave: null
  });
  /** El fetch de cada fragmento resuelve un buffer distinto (byteLength = idx+1). */
  const fetchBufferPorIndice = () => vi.fn(async (url) => {
    const i = Number(url.match(/seg(\d+)\.ts/)[1]);
    return { arrayBuffer: async () => new ArrayBuffer(i + 1) };
  });

  function stubSession(modoTurboBunActivo) {
    globalThis.SessionState = {
      get: vi.fn().mockResolvedValue({
        modoTurboBunActivo,
        videoActualSessionId: 'sess1',
        videoActualTitulo: 'Titulo X'
      })
    };
  }

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.controladorGraficoActivo = new AbortController();
    globalThis.BunClient = { enviarFragmentoStream: vi.fn().mockResolvedValue(undefined) };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.SessionState;
    delete globalThis.BunClient;
    delete globalThis.controladorGraficoActivo;
  });

  it('reparte TODOS los índices exactamente una vez (sin duplicar ni saltear) con tope de 6 en vuelo', async () => {
    stubSession(true);
    Utils.fetchConReintentos = fetchBufferPorIndice();

    // enviarFragmentoStream mide la concurrencia máxima observada.
    let enVuelo = 0, maxEnVuelo = 0;
    globalThis.BunClient = {
      enviarFragmentoStream: vi.fn(async () => {
        enVuelo++; maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
        await new Promise(r => setTimeout(r, 5));
        enVuelo--;
      })
    };

    await HlsEngine.compilarTranscodificacionStream(metaSinClave(15), new AbortController().signal, 'bio', 'Titulo X', {});

    expect(BunClient.enviarFragmentoStream).toHaveBeenCalledTimes(15);
    const indices = BunClient.enviarFragmentoStream.mock.calls.map(c => c[1].chunkIndex).sort((a, b) => a - b);
    expect(indices).toEqual([...Array(15).keys()]); // 0..14, cada uno una vez
    expect(maxEnVuelo).toBe(6); // CONCURRENCIA_MAXIMA
  });

  it('turbo: envía cada fragmento por BunClient con los headers correctos y retorna null', async () => {
    stubSession(true);
    Utils.fetchConReintentos = fetchBufferPorIndice();

    const ret = await HlsEngine.compilarTranscodificacionStream(metaSinClave(3), new AbortController().signal, 'quimica', 'Titulo X', {});

    expect(ret).toBeNull();
    expect(BunClient.enviarFragmentoStream).toHaveBeenCalledTimes(3);
    const [, headers] = BunClient.enviarFragmentoStream.mock.calls[0];
    expect(headers).toMatchObject({ videoTitle: 'Titulo X', totalChunks: 3, targetFolder: 'quimica', sessionId: 'sess1' });
  });

  it('blob (no turbo): NO llama a BunClient, acumula y retorna Utils.generarVideoFinalBlob(bloques)', async () => {
    stubSession(false);
    Utils.fetchConReintentos = fetchBufferPorIndice();
    Utils.generarVideoFinalBlob = vi.fn().mockReturnValue('BLOB_FINAL');

    const ret = await HlsEngine.compilarTranscodificacionStream(metaSinClave(4), new AbortController().signal, 'bio', 'Titulo X', {});

    expect(BunClient.enviarFragmentoStream).not.toHaveBeenCalled();
    expect(ret).toBe('BLOB_FINAL');
    const bloques = Utils.generarVideoFinalBlob.mock.calls[0][0];
    expect(bloques).toHaveLength(4); // un bloque por fragmento, en su índice
    expect(bloques.every(b => b instanceof ArrayBuffer)).toBe(true);
  });

  it('con clave AES: importa la clave una vez y descifra cada fragmento con (buffer, clave, idx, lineaLlave)', async () => {
    stubSession(true);
    // Genérico: sirve tanto la clave (key.bin) como los fragmentos; el contenido no importa
    // acá (descifrarFragmento es passthrough y sólo se asertan sus args + importKey).
    Utils.fetchConReintentos = vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }));
    Utils.descifrarFragmento = vi.fn(async (buf) => buf); // passthrough verificable
    const claveFake = { tipo: 'clave' };
    vi.stubGlobal('crypto', { subtle: { importKey: vi.fn().mockResolvedValue(claveFake) } });

    const meta = { urls: ['https://cdn.test/seg0.ts', 'https://cdn.test/seg1.ts'], lineaLlave: '#EXT-X-KEY:...', urlLlave: 'https://cdn.test/key.bin' };
    await HlsEngine.compilarTranscodificacionStream(meta, new AbortController().signal, 'bio', 'Titulo X', {});

    expect(crypto.subtle.importKey).toHaveBeenCalledTimes(1);
    expect(Utils.descifrarFragmento).toHaveBeenCalledTimes(2);
    // Cada llamada recibe la clave importada, el índice del fragmento y la línea de la llave.
    const idxDescifrados = Utils.descifrarFragmento.mock.calls.map(c => c[2]).sort((a, b) => a - b);
    expect(idxDescifrados).toEqual([0, 1]);
    expect(Utils.descifrarFragmento.mock.calls[0][1]).toBe(claveFake);
    expect(Utils.descifrarFragmento.mock.calls[0][3]).toBe('#EXT-X-KEY:...');
  });

  it('fallo REAL de un fragmento: aborta el controlador, los hermanos rechazan AbortError silencioso (1 solo crítico) y propaga el error real', async () => {
    stubSession(true);
    // El fetch del fragmento 0 falla de verdad; los demás quedan pendientes hasta que el
    // abort en cascada los rechace con AbortError (que el worker propaga callado).
    Utils.fetchConReintentos = vi.fn((url, opts) => {
      if (url.endsWith('seg0.ts')) return Promise.reject(new Error('boom fragmento'));
      return new Promise((_, reject) => {
        opts.signal.addEventListener('abort', () =>
          reject(Object.assign(new Error('abortado'), { name: 'AbortError' })), { once: true });
      });
    });

    const signal = globalThis.controladorGraficoActivo.signal; // el SW pasa esta misma señal
    const err = await HlsEngine
      .compilarTranscodificacionStream(metaSinClave(7), signal, 'bio', 'Titulo X', {})
      .catch(e => e);

    expect(err.message).toMatch(/boom fragmento/);
    expect(err.name).not.toBe('AbortError'); // gana el error REAL, no el AbortError de un hermano
    expect(globalThis.controladorGraficoActivo.signal.aborted).toBe(true); // abortó a los hermanos
    expect(console.error).toHaveBeenCalledTimes(1); // sólo el fallo real loguea crítico
    expect(BunClient.enviarFragmentoStream).not.toHaveBeenCalled(); // ningún fragmento llegó a enviarse
  });

  it('signal ya abortado antes de arrancar: no procesa nada y lanza "interrumpida"', async () => {
    stubSession(true);
    Utils.fetchConReintentos = fetchBufferPorIndice();
    const ctrl = new AbortController();
    ctrl.abort();

    await expect(
      HlsEngine.compilarTranscodificacionStream(metaSinClave(5), ctrl.signal, 'bio', 'Titulo X', {})
    ).rejects.toThrow(/interrumpida/i);
    expect(BunClient.enviarFragmentoStream).not.toHaveBeenCalled();
  });

  it('reporta progreso vía onFragmentoCompletado y la última notificación lleva el total', async () => {
    stubSession(true);
    Utils.fetchConReintentos = fetchBufferPorIndice();
    const onFragmentoCompletado = vi.fn();

    await HlsEngine.compilarTranscodificacionStream(metaSinClave(8), new AbortController().signal, 'bio', 'Titulo X', { onFragmentoCompletado });

    expect(onFragmentoCompletado).toHaveBeenCalled();
    const ultima = onFragmentoCompletado.mock.calls.at(-1);
    expect(ultima[1]).toBe(8); // totalUrls
    expect(ultima[3]).toBe(8); // fragmentosTerminados: el último reporte es el 100%
  });
});
