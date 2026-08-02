/**
 * Tests de caracterización para shared/utils.js.
 *
 * Documentan el comportamiento ACTUAL de las funciones puras como red de
 * regresión antes de refactorizar (ver docs/ROADMAP.md, Fase 1). Los valores
 * esperados se capturaron ejecutando el código real, no son un contrato nuevo:
 * si un cambio los rompe, hay que decidir conscientemente si es un fix o una
 * regresión, no ajustar el test a ciegas.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import Utils from './utils.js';

describe('sanitizarTexto', () => {
  it('reemplaza caracteres inválidos para nombre de archivo por "_"', () => {
    expect(Utils.sanitizarTexto('Clase: 1/2 <test>')).toBe('Clase_ 1_2 _test_');
  });

  it('colapsa espacios múltiples y recorta extremos', () => {
    expect(Utils.sanitizarTexto('  Hola   Mundo  ')).toBe('Hola Mundo');
  });

  it('preserva acentos, ñ, guiones y paréntesis permitidos', () => {
    expect(Utils.sanitizarTexto('Niño (2024) - Introducción')).toBe('Niño (2024) - Introducción');
  });

  it('devuelve placeholder ante texto vacío o nulo', () => {
    expect(Utils.sanitizarTexto('')).toBe('video_sin_nombre');
    expect(Utils.sanitizarTexto(null)).toBe('video_sin_nombre');
    expect(Utils.sanitizarTexto(undefined)).toBe('video_sin_nombre');
  });
});

describe('escaparHtml', () => {
  it('neutraliza un payload de inyección de markup', () => {
    expect(Utils.escaparHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa los cinco metacaracteres de HTML', () => {
    expect(Utils.escaparHtml(`a & b "c" 'd' <e>`))
      .toBe('a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;');
  });

  it('escapa el ampersand primero para no doble-escapar', () => {
    expect(Utils.escaparHtml('&lt;')).toBe('&amp;lt;');
  });

  it('trata null/undefined como string vacío', () => {
    expect(Utils.escaparHtml(null)).toBe('');
    expect(Utils.escaparHtml(undefined)).toBe('');
  });

  it('no altera texto sin metacaracteres', () => {
    expect(Utils.escaparHtml('Clase 3 - Parte 1')).toBe('Clase 3 - Parte 1');
  });
});

describe('fetchConReintentos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sin red (navigator.onLine=false) NO reintenta: falla al primer intento', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(Utils.fetchConReintentos('http://x/frag.ts', {}, 4, 1000))
      .rejects.toThrow(/Failed to fetch/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin backoff: un solo intento
  });

  it('con red (onLine=true) reintenta con backoff hasta que un intento resuelve', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const okRes = { ok: true };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okRes);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = Utils.fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
    await vi.runAllTimersAsync(); // avanza el setTimeout del backoff
    await expect(p).resolves.toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 fallo + 1 éxito
  });

  it('daemon confirma internet caída (onLine=true) → no reintenta pese a la red "activa"', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const verificarAhora = vi.fn().mockResolvedValue({ internet: false });
    vi.stubGlobal('Conexion', { verificarAhora });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(Utils.fetchConReintentos('http://x/frag.ts', {}, 4, 1000))
      .rejects.toThrow(/Failed to fetch/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // corta al primer fallo por el daemon
    expect(verificarAhora).toHaveBeenCalledTimes(1);
  });

  it('daemon dice internet OK → sigue reintentando con backoff (tolera micro-corte)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('Conexion', { verificarAhora: vi.fn().mockResolvedValue({ internet: true }) });
    const okRes = { ok: true };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okRes);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = Utils.fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 fallo + 1 éxito: el daemon no cortó
  });

  it('si el sondeo del daemon lanza, cae al backoff y rechaza con el error ORIGINAL del fetch', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('Conexion', { verificarAhora: vi.fn().mockRejectedValue(new Error('daemon roto')) });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = Utils.fetchConReintentos('http://x/frag.ts', {}, 2, 1000);
    const assertion = expect(p).rejects.toThrow(/Failed to fetch/); // NO "daemon roto"
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 inicial + 2 reintentos (el fallo del daemon no corta)
  });

  it('timeout por-intento: un fetch colgado se aborta y se reescribe a Error normal (NO AbortError)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('Conexion', { verificarAhora: vi.fn().mockResolvedValue({ internet: false }) });
    // fetch colgado: sólo rechaza si le abortan el signal (simula socket sin RST).
    const fetchMock = vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = Utils.fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
    // El timeout se reescribe a Error normal ("Timeout de ...") para no confundirlo con abort.
    const assertion = expect(p).rejects.toThrow(/Timeout de 10000ms/);
    await vi.advanceTimersByTimeAsync(10000); // dispara el timeout por-intento
    await assertion;
    await p.catch((e) => { expect(e.name).not.toBe('AbortError'); });
    expect(fetchMock).toHaveBeenCalledTimes(1); // daemon down → no reintenta tras el timeout
  });

  it('un signal del usuario pre-abortado corta de una, sin consultar al daemon', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const verificarAhora = vi.fn().mockResolvedValue({ internet: true });
    vi.stubGlobal('Conexion', { verificarAhora });
    const fetchMock = vi.fn((_url, opts) =>
      opts.signal.aborted
        ? Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
        : Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const signal = AbortSignal.abort();
    await expect(Utils.fetchConReintentos('http://x/frag.ts', { signal }, 4, 1000))
      .rejects.toThrow(/aborted/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);   // se llama una vez con el signal abortado
    expect(verificarAhora).not.toHaveBeenCalled(); // el guard de user-abort corta antes
  });
});
