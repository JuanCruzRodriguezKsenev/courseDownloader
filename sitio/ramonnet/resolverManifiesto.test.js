/**
 * Tests de sitio/ramonnet/resolverManifiesto.js (Capa 2).
 * HTML de la página de la clase → URL .m3u8: la ruta del <iframe> del reproductor,
 * los 3 fallbacks progresivamente más laxos, y la detección de "no hay sesión" (el
 * portal redirige al login y la URL final pierde el segmento de la clase).
 *
 * Vinieron de background/hlsEngine.test.js al mover la función al adaptador de sitio;
 * son tests de caracterización — si alguno se rompe, el portal cambió el maquetado.
 * Se mockea la global Utils.fetchConReintentos; SitioRamonNet se importa de verdad
 * (los hosts del CDN y la plantilla de URL salen de ahí).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ResolverManifiesto from './resolverManifiesto.js';
import { SitioRamonNet } from './config.js';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.Utils = { fetchConReintentos: vi.fn() };
  globalThis.SitioRamonNet = SitioRamonNet;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.Utils;
  delete globalThis.SitioRamonNet;
});

/** Respuesta simulada para el fetch del HTML de la clase. */
function resHtml(html) {
  return { url: 'https://plataforma.ramonnet.com.ar/clase/1', status: 200, text: async () => html };
}

const HASH = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

describe('ResolverManifiesto.resolver()', () => {
  it('extrae el UUID del iframe (mediadelivery/b-cdn) y arma la URL 480p canónica', async () => {
    const html = `<html><body>
      <iframe src="https://iframe.mediadelivery.net/embed/12345/${HASH}?autoplay=true"></iframe>
    </body></html>`;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await ResolverManifiesto.resolver('https://plataforma.ramonnet.com.ar/clase/1');
    expect(url).toBe(`https://vz-c3e7bda8-f29.b-cdn.net/${HASH}/480p/video.m3u8`);
  });

  it('la URL final la arma el config del sitio (plantillaM3u8), no el resolvedor', async () => {
    const html = `<iframe src="https://iframe.mediadelivery.net/embed/1/${HASH}"></iframe>`;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await ResolverManifiesto.resolver('https://x/clase');
    expect(url).toBe(SitioRamonNet.cdn.plantillaM3u8(HASH));
  });

  it('fallback 1: sin iframe, toma el ÚLTIMO .m3u8 directo del HTML', async () => {
    const html = `
      var a = "https://cdn.uno.net/vieja/video.m3u8";
      var b = "https://cdn.dos.net/nueva/video.m3u8";
    `;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await ResolverManifiesto.resolver('https://x/clase');
    expect(url).toBe('https://cdn.dos.net/nueva/video.m3u8');
  });

  it('fallback 2: sin iframe ni .m3u8, arma la URL desde un hash Bunny suelto', async () => {
    const html = `<a href="https://vz-abcdef01-x1.b-cdn.net/${HASH}">link</a>`;
    Utils.fetchConReintentos.mockResolvedValue(resHtml(html));

    const url = await ResolverManifiesto.resolver('https://x/clase');
    expect(url).toBe(`https://vz-abcdef01-x1.b-cdn.net/${HASH}/480p/video.m3u8`);
  });

  it('lanza error si el HTML no tiene ninguna firma de streaming válida', async () => {
    Utils.fetchConReintentos.mockResolvedValue(resHtml('<html>nada útil aquí</html>'));
    await expect(
      ResolverManifiesto.resolver('https://x/clase')
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
      ResolverManifiesto.resolver(urlClase)
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

    const promesa = ResolverManifiesto.resolver(urlClase);
    await expect(promesa).rejects.toThrow(/No se localizaron firmas/);
    await expect(promesa).rejects.not.toMatchObject({ tipoConexion: 'sesion' });
  });
});
