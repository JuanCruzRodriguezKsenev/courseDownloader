/**
 * Tests de core/util/reintentos.ts (antes `fetchConReintentos`).
 *
 * Cubren las cuatro salidas del bucle, que es donde está toda la sustancia: abort del
 * usuario, `navigator.onLine === false`, veredicto del daemon y límite de reintentos.
 *
 * Desde la Fase 6a el daemon **se inyecta** en vez de sniffearse del global, así que estos
 * tests ya no usan `vi.stubGlobal('Conexion', ...)`: le pasan una sonda de mentira a la
 * factory. Es la diferencia entre probar el contrato y probar el ambiente.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { crearFetchConReintentos } from './reintentos';

/** Sonda de conexión de mentira: lo único que el módulo consume del daemon. */
const sonda = (verificarAhora: () => Promise<{ internet: boolean }>) => ({ verificarAhora });

describe('fetchConReintentos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sin red (navigator.onLine=false) NO reintenta: falla al primer intento', async () => {
    // Sin sonda: el corte por onLine ocurre antes de que el daemon tenga algo que decir.
    const fetchConReintentos = crearFetchConReintentos();
    vi.stubGlobal('navigator', { onLine: false });
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(fetchConReintentos('http://x/frag.ts', {}, 4, 1000))
      .rejects.toThrow(/Failed to fetch/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin backoff: un solo intento
  });

  it('con red (onLine=true) reintenta con backoff hasta que un intento resuelve', async () => {
    // Sin sonda: es el caso de un contexto que no levantó el daemon (degradar, no romper).
    const fetchConReintentos = crearFetchConReintentos();
    vi.stubGlobal('navigator', { onLine: true });
    const okRes = { ok: true };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okRes);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
    await vi.runAllTimersAsync(); // avanza el setTimeout del backoff
    await expect(p).resolves.toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 fallo + 1 éxito
  });

  it('daemon confirma internet caída (onLine=true) → no reintenta pese a la red "activa"', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const verificarAhora = vi.fn().mockResolvedValue({ internet: false });
    const fetchConReintentos = crearFetchConReintentos(sonda(verificarAhora));
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(fetchConReintentos('http://x/frag.ts', {}, 4, 1000))
      .rejects.toThrow(/Failed to fetch/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // corta al primer fallo por el daemon
    expect(verificarAhora).toHaveBeenCalledTimes(1);
  });

  it('daemon dice internet OK → sigue reintentando con backoff (tolera micro-corte)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetchConReintentos = crearFetchConReintentos(sonda(vi.fn().mockResolvedValue({ internet: true })));
    const okRes = { ok: true };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okRes);
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe(okRes);
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 fallo + 1 éxito: el daemon no cortó
  });

  it('si el sondeo del daemon lanza, cae al backoff y rechaza con el error ORIGINAL del fetch', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetchConReintentos = crearFetchConReintentos(sonda(vi.fn().mockRejectedValue(new Error('daemon roto'))));
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = fetchConReintentos('http://x/frag.ts', {}, 2, 1000);
    const assertion = expect(p).rejects.toThrow(/Failed to fetch/); // NO "daemon roto"
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 inicial + 2 reintentos (el fallo del daemon no corta)
  });

  it('timeout por-intento: un fetch colgado se aborta y se reescribe a Error normal (NO AbortError)', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const fetchConReintentos = crearFetchConReintentos(sonda(vi.fn().mockResolvedValue({ internet: false })));
    // fetch colgado: sólo rechaza si le abortan el signal (simula socket sin RST).
    const fetchMock = vi.fn((_url, opts) => new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();

    const p = fetchConReintentos('http://x/frag.ts', {}, 4, 1000);
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
    const fetchConReintentos = crearFetchConReintentos(sonda(verificarAhora));
    const fetchMock = vi.fn((_url, opts) =>
      opts.signal.aborted
        ? Promise.reject(new DOMException('The operation was aborted.', 'AbortError'))
        : Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const signal = AbortSignal.abort();
    await expect(fetchConReintentos('http://x/frag.ts', { signal }, 4, 1000))
      .rejects.toThrow(/aborted/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);   // se llama una vez con el signal abortado
    expect(verificarAhora).not.toHaveBeenCalled(); // el guard de user-abort corta antes
  });
});
