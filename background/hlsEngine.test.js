/**
 * Tests de las funciones puras de HlsEngine (background/hlsEngine.js):
 *   - extraerEnlaceMaestroM3u8Clasico: HTML de la clase → URL .m3u8 (iframe + 3 fallbacks).
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

/** Respuesta simulada para el fetch del HTML de la clase. */
function resHtml(html) {
  return { url: 'https://plataforma.ramonnet.com.ar/clase/1', status: 200, text: async () => html };
}
/** Respuesta simulada para el fetch del manifiesto .m3u8. */
function resTexto(texto) {
  return { text: async () => texto };
}

const HASH = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

describe('extraerEnlaceMaestroM3u8Clasico()', () => {
  it('extrae el UUID del iframe (mediadelivery/b-cdn) y arma la URL 480p canónica', async () => {
    const html = `<html><body>
      <iframe src="https://iframe.mediadelivery.net/embed/12345/${HASH}?autoplay=true"></iframe>
    </body></html>`;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await HlsEngine.extraerEnlaceMaestroM3u8Clasico('https://plataforma.ramonnet.com.ar/clase/1');
    expect(url).toBe(`https://vz-c3e7bda8-f29.b-cdn.net/${HASH}/480p/video.m3u8`);
  });

  it('fallback 1: sin iframe, toma el ÚLTIMO .m3u8 directo del HTML', async () => {
    const html = `
      var a = "https://cdn.uno.net/vieja/video.m3u8";
      var b = "https://cdn.dos.net/nueva/video.m3u8";
    `;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await HlsEngine.extraerEnlaceMaestroM3u8Clasico('https://x/clase');
    expect(url).toBe('https://cdn.dos.net/nueva/video.m3u8');
  });

  it('fallback 2: sin iframe ni .m3u8, arma la URL desde un hash Bunny suelto', async () => {
    const html = `<a href="https://vz-abcdef01-x1.b-cdn.net/${HASH}">link</a>`;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await HlsEngine.extraerEnlaceMaestroM3u8Clasico('https://x/clase');
    expect(url).toBe(`https://vz-abcdef01-x1.b-cdn.net/${HASH}/480p/video.m3u8`);
  });

  it('lanza error si el HTML no tiene ninguna firma de streaming válida', async () => {
    Utils.fetchConReintentos.mockResolvedValue(resHtml('<html>nada útil aquí</html>'));
    await expect(
      HlsEngine.extraerEnlaceMaestroM3u8Clasico('https://x/clase')
    ).rejects.toThrow(/No se localizaron firmas/);
  });

  it('sin sesión: la clase redirige al login (URL final pierde /clases-grabadas/) → error tipado "sesion"', async () => {
    const urlClase = 'https://plataforma.ramonnet.com.ar/usuario/clases-grabadas/ver/11868-474';
    // La URL final es la raíz (login), sin el segmento de la clase; el HTML es la página de login.
    Utils.fetchConReintentos.mockResolvedValue({
      url: 'https://plataforma.ramonnet.com.ar/',
      status: 200,
      text: async () => '<html><body>Iniciá sesión</body></html>'
    });

    await expect(
      HlsEngine.extraerEnlaceMaestroM3u8Clasico(urlClase)
    ).rejects.toMatchObject({ tipoConexion: 'sesion' });
  });

  it('control: con sesión (la URL final conserva /clases-grabadas/) NO se marca "sesion", cae al error genérico', async () => {
    const urlClase = 'https://plataforma.ramonnet.com.ar/usuario/clases-grabadas/ver/11868-474';
    // Misma ruta de clase en la URL final (no hubo redirect al login), pero sin firmas de streaming.
    Utils.fetchConReintentos.mockResolvedValue({
      url: urlClase,
      status: 200,
      text: async () => '<html>sin iframe ni m3u8</html>'
    });

    const promesa = HlsEngine.extraerEnlaceMaestroM3u8Clasico(urlClase);
    await expect(promesa).rejects.toThrow(/No se localizaron firmas/);
    await expect(promesa).rejects.not.toMatchObject({ tipoConexion: 'sesion' });
  });
});

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
