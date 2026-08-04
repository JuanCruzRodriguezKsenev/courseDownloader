/**
 * Tests del motor HLS (`core/hls/hlsEngine.ts`).
 *
 * Cubren el parseo del manifiesto y el corazón del motor: el pool de 6 workers, AES, el
 * streaming turbo vs. blob, los aborts en cascada y el reintento del rechazo 4xx (bug 400).
 *
 * Desde la Fase 6 **no se stubea ni un global**: el motor es una factory y recibe sus cuatro
 * colaboradores. Lo que antes eran `globalThis.Utils` / `globalThis.BunClient` /
 * `globalThis.SessionState` / `globalThis.controladorGraficoActivo` hoy son, respectivamente,
 * dos dependencias inyectadas, un objeto `contexto` y un callback `abortarHermanos`. Las
 * aserciones de comportamiento quedaron **iguales** — eran la red para migrarlo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearHlsEngine } from './hlsEngine';
import type { MetadataHls, ContextoRafaga } from './hlsEngine';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Dobles de los colaboradores; cada test sobreescribe lo que le importa. */
function crearDeps(over: Partial<Record<string, any>> = {}) {
  return {
    fetchConReintentos: vi.fn(),
    descifrarFragmento: vi.fn(async (buf: any) => buf),
    generarVideoFinalBlob: vi.fn(),
    backend: { enviarFragmentoStream: vi.fn().mockResolvedValue(undefined) },
    ...over,
  } as any;
}

/** Contexto de ráfaga por defecto (lo que antes salía de SessionState). */
const contexto = (over: Partial<ContextoRafaga> = {}): ContextoRafaga => ({
  modoTurbo: true,
  titulo: 'Titulo X',
  sessionId: 'sess1',
  ...over,
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Respuesta simulada para el fetch del manifiesto .m3u8. */
function resTexto(texto: string) {
  return { text: async () => texto };
}

describe('descargarYAnalizarIndexM3u8()', () => {
  const BASE = 'https://vz-c3e7bda8-f29.b-cdn.net/xyz/480p';
  const URL_M3U8 = `${BASE}/video.m3u8`;

  it('resuelve fragmentos relativos contra la base del .m3u8', async () => {
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(
        resTexto('#EXTM3U\n#EXTINF:4,\nseg0.ts\n#EXTINF:4,\nseg1.ts\n#EXT-X-ENDLIST')
      ),
    });

    const meta = await crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8);

    expect(meta.urls).toEqual([`${BASE}/seg0.ts`, `${BASE}/seg1.ts`]);
    expect(meta.lineaLlave).toBe('');
    expect(meta.urlLlave).toBe('');
  });

  it('respeta las URLs absolutas de fragmento tal cual', async () => {
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(
        resTexto('#EXTM3U\nhttps://otro.cdn/abs0.ts\nseg1.ts')
      ),
    });

    const meta = await crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8);

    expect(meta.urls).toEqual(['https://otro.cdn/abs0.ts', `${BASE}/seg1.ts`]);
  });

  it('extrae la línea y la URI de #EXT-X-KEY (relativa → absoluta)', async () => {
    const linea = '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x0123';
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(resTexto(`#EXTM3U\n${linea}\nseg0.ts`)),
    });

    const meta = await crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8);

    expect(meta.lineaLlave).toBe(linea);
    expect(meta.urlLlave).toBe(`${BASE}/key.bin`);
  });

  it('acepta una URI de llave absoluta sin prefijarle la base', async () => {
    const linea = '#EXT-X-KEY:METHOD=AES-128,URI="https://llaves.test/k.bin"';
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(resTexto(`#EXTM3U\n${linea}\nseg0.ts`)),
    });

    const meta = await crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8);

    expect(meta.urlLlave).toBe('https://llaves.test/k.bin');
  });

  it('ignora comentarios/directivas y líneas vacías', async () => {
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(
        resTexto('#EXTM3U\n\n#EXT-X-VERSION:3\n\nseg0.ts\n\n#EXT-X-ENDLIST\n')
      ),
    });

    const meta = await crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8);

    expect(meta.urls).toEqual([`${BASE}/seg0.ts`]);
  });

  it('lanza si el manifiesto no tiene fragmentos', async () => {
    const deps = crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue(resTexto('#EXTM3U\n#EXT-X-ENDLIST')),
    });

    await expect(crearHlsEngine(deps).descargarYAnalizarIndexM3u8(URL_M3U8)).rejects.toThrow(
      /no contiene fragmentos/i
    );
  });
});

/**
 * Reintento del rechazo 4xx (bug 400): un solo fragmento sin clave AES, así corre un único
 * worker y no hay carrera de aborts entre hermanos.
 */
describe('compilarTranscodificacionStream() — reintento de rechazo 4xx (bug 400)', () => {
  const META: MetadataHls = { urls: ['https://cdn.test/seg0.ts'], lineaLlave: '', urlLlave: '' };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Deps con el fetch del fragmento resuelto (sin clave → passthrough). */
  const depsConFragmento = (enviarFragmentoStream: any) =>
    crearDeps({
      fetchConReintentos: vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) }),
      backend: { enviarFragmentoStream },
    });

  it('4xx tipado: reintenta el envío 3 veces y propaga el error con tipoBackend/httpStatus intactos', async () => {
    const rechazo = Object.assign(new Error('rechazado 400'), { tipoBackend: 'rechazo', httpStatus: 400 });
    const deps = depsConFragmento(vi.fn().mockRejectedValue(rechazo));

    const signal = new AbortController().signal;
    const corrida = crearHlsEngine(deps).compilarTranscodificacionStream(META, signal, 'bio', contexto());
    const capturado = corrida.then(() => null, (e) => e); // captura el rechazo sin unhandled
    await vi.runAllTimersAsync(); // drena los 2 backoffs (300ms, 600ms)
    const err = await capturado;

    expect(deps.backend.enviarFragmentoStream).toHaveBeenCalledTimes(3);
    expect(err).toMatchObject({ tipoBackend: 'rechazo', httpStatus: 400 });
  });

  it('error NO-rechazo (ej. 5xx/red): NO se reintenta — se propaga en el primer intento', async () => {
    const otro = Object.assign(new Error('El backend no respondió (timeout)'), { httpStatus: 503 });
    const deps = depsConFragmento(vi.fn().mockRejectedValue(otro));

    const signal = new AbortController().signal;
    const corrida = crearHlsEngine(deps).compilarTranscodificacionStream(META, signal, 'bio', contexto());
    const capturado = corrida.then(() => null, (e) => e);
    await vi.runAllTimersAsync();
    const err = await capturado;

    expect(deps.backend.enviarFragmentoStream).toHaveBeenCalledTimes(1);
    expect(err).toBe(otro);
    expect((err as any).tipoBackend).toBeUndefined();
  });
});

/**
 * Pool de 6 workers: el corazón del motor (concurrencia fija, AES, streaming turbo vs blob,
 * aborts en cascada). Timers reales: acá no hay backoff — los reintentos de rechazo tienen su
 * propio bloque con fake timers arriba.
 */
describe('compilarTranscodificacionStream() — pool de workers', () => {
  /** Metadata de N fragmentos sin clave (passthrough directo). */
  const metaSinClave = (n: number): MetadataHls => ({
    urls: Array.from({ length: n }, (_, i) => `https://cdn.test/seg${i}.ts`),
    lineaLlave: '',
    urlLlave: '',
  });

  /** El fetch de cada fragmento resuelve un buffer distinto (byteLength = idx+1). */
  const fetchBufferPorIndice = () =>
    vi.fn(async (url: string) => {
      const i = Number(url.match(/seg(\d+)\.ts/)![1]);
      return { arrayBuffer: async () => new ArrayBuffer(i + 1) };
    });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reparte TODOS los índices exactamente una vez (sin duplicar ni saltear) con tope de 6 en vuelo', async () => {
    // enviarFragmentoStream mide la concurrencia máxima observada.
    let enVuelo = 0;
    let maxEnVuelo = 0;
    const deps = crearDeps({
      fetchConReintentos: fetchBufferPorIndice(),
      backend: {
        enviarFragmentoStream: vi.fn(async () => {
          enVuelo++;
          maxEnVuelo = Math.max(maxEnVuelo, enVuelo);
          await new Promise((r) => setTimeout(r, 5));
          enVuelo--;
        }),
      },
    });

    await crearHlsEngine(deps).compilarTranscodificacionStream(
      metaSinClave(15),
      new AbortController().signal,
      'bio',
      contexto()
    );

    expect(deps.backend.enviarFragmentoStream).toHaveBeenCalledTimes(15);
    const indices = deps.backend.enviarFragmentoStream.mock.calls
      .map((c: any) => c[1].chunkIndex)
      .sort((a: number, b: number) => a - b);
    expect(indices).toEqual([...Array(15).keys()]); // 0..14, cada uno una vez
    expect(maxEnVuelo).toBe(6); // CONCURRENCIA_MAXIMA
  });

  it('turbo: envía cada fragmento por el backend con los headers correctos y retorna null', async () => {
    const deps = crearDeps({ fetchConReintentos: fetchBufferPorIndice() });

    const ret = await crearHlsEngine(deps).compilarTranscodificacionStream(
      metaSinClave(3),
      new AbortController().signal,
      'quimica',
      contexto()
    );

    expect(ret).toBeNull();
    expect(deps.backend.enviarFragmentoStream).toHaveBeenCalledTimes(3);
    const [, headers] = deps.backend.enviarFragmentoStream.mock.calls[0];
    expect(headers).toMatchObject({
      videoTitle: 'Titulo X',
      totalChunks: 3,
      targetFolder: 'quimica',
      sessionId: 'sess1',
    });
  });

  it('blob (no turbo): NO llama al backend, acumula y retorna generarVideoFinalBlob(bloques)', async () => {
    const deps = crearDeps({
      fetchConReintentos: fetchBufferPorIndice(),
      generarVideoFinalBlob: vi.fn().mockReturnValue('BLOB_FINAL'),
    });

    const ret = await crearHlsEngine(deps).compilarTranscodificacionStream(
      metaSinClave(4),
      new AbortController().signal,
      'bio',
      contexto({ modoTurbo: false })
    );

    expect(deps.backend.enviarFragmentoStream).not.toHaveBeenCalled();
    expect(ret).toBe('BLOB_FINAL');
    const bloques = deps.generarVideoFinalBlob.mock.calls[0][0];
    expect(bloques).toHaveLength(4); // un bloque por fragmento, en su índice
    expect(bloques.every((b: unknown) => b instanceof ArrayBuffer)).toBe(true);
  });

  it('con clave AES: importa la clave una vez y descifra cada fragmento con (buffer, clave, idx, lineaLlave)', async () => {
    // Genérico: sirve tanto la clave (key.bin) como los fragmentos; el contenido no importa
    // acá (descifrarFragmento es passthrough y sólo se asertan sus args + importKey).
    const deps = crearDeps({
      fetchConReintentos: vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })),
    });
    const claveFake = { tipo: 'clave' };
    vi.stubGlobal('crypto', { subtle: { importKey: vi.fn().mockResolvedValue(claveFake) } });

    const meta: MetadataHls = {
      urls: ['https://cdn.test/seg0.ts', 'https://cdn.test/seg1.ts'],
      lineaLlave: '#EXT-X-KEY:...',
      urlLlave: 'https://cdn.test/key.bin',
    };
    await crearHlsEngine(deps).compilarTranscodificacionStream(
      meta,
      new AbortController().signal,
      'bio',
      contexto()
    );

    expect(crypto.subtle.importKey).toHaveBeenCalledTimes(1);
    expect(deps.descifrarFragmento).toHaveBeenCalledTimes(2);
    // Cada llamada recibe la clave importada, el índice del fragmento y la línea de la llave.
    const idxDescifrados = deps.descifrarFragmento.mock.calls
      .map((c: any) => c[2])
      .sort((a: number, b: number) => a - b);
    expect(idxDescifrados).toEqual([0, 1]);
    expect(deps.descifrarFragmento.mock.calls[0][1]).toBe(claveFake);
    expect(deps.descifrarFragmento.mock.calls[0][3]).toBe('#EXT-X-KEY:...');
  });

  it('fallo REAL de un fragmento: frena a los hermanos, que rechazan AbortError silencioso (1 solo crítico), y propaga el error real', async () => {
    // El fetch del fragmento 0 falla de verdad; los demás quedan pendientes hasta que el
    // abort en cascada los rechace con AbortError (que el worker propaga callado).
    const deps = crearDeps({
      fetchConReintentos: vi.fn((url: string, opts: any) => {
        if (url.endsWith('seg0.ts')) return Promise.reject(new Error('boom fragmento'));
        return new Promise((_, reject) => {
          opts.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('abortado'), { name: 'AbortError' })),
            { once: true }
          );
        });
      }),
    });

    // El caller es dueño del controlador: le pasa su signal y la forma de abortarlo.
    const ctrl = new AbortController();
    const err = await crearHlsEngine(deps)
      .compilarTranscodificacionStream(
        metaSinClave(7),
        ctrl.signal,
        'bio',
        contexto({ abortarHermanos: () => ctrl.abort() })
      )
      .catch((e) => e);

    expect(err.message).toMatch(/boom fragmento/);
    expect(err.name).not.toBe('AbortError'); // gana el error REAL, no el AbortError de un hermano
    expect(ctrl.signal.aborted).toBe(true); // frenó a los hermanos
    expect(console.error).toHaveBeenCalledTimes(1); // sólo el fallo real loguea crítico
    expect(deps.backend.enviarFragmentoStream).not.toHaveBeenCalled(); // nada llegó a enviarse
  });

  it('signal ya abortado antes de arrancar: no procesa nada y lanza "interrumpida"', async () => {
    const deps = crearDeps({ fetchConReintentos: fetchBufferPorIndice() });
    const ctrl = new AbortController();
    ctrl.abort();

    await expect(
      crearHlsEngine(deps).compilarTranscodificacionStream(metaSinClave(5), ctrl.signal, 'bio', contexto())
    ).rejects.toThrow(/interrumpida/i);
    expect(deps.backend.enviarFragmentoStream).not.toHaveBeenCalled();
  });

  it('reporta progreso vía onFragmentoCompletado y la última notificación lleva el total', async () => {
    const deps = crearDeps({ fetchConReintentos: fetchBufferPorIndice() });
    const onFragmentoCompletado = vi.fn();

    await crearHlsEngine(deps).compilarTranscodificacionStream(
      metaSinClave(8),
      new AbortController().signal,
      'bio',
      contexto(),
      { onFragmentoCompletado }
    );

    expect(onFragmentoCompletado).toHaveBeenCalled();
    const ultima = onFragmentoCompletado.mock.calls.at(-1)!;
    expect(ultima[1]).toBe(8); // totalUrls
    expect(ultima[3]).toBe(8); // fragmentosTerminados: el último reporte es el 100%
  });
});
