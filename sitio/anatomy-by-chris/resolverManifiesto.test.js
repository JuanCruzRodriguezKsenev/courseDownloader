/**
 * Tests de `resolverManifiesto` de Anatomy by Chris (Capa 2).
 *
 * Las respuestas de los tres fetch son las MEDIDAS en el navegador el 2026-08-07 (contrato de
 * la API del club, `__NEXT_DATA__` del embed y master de Akamai), recortadas a lo que el
 * algoritmo lee. Ver `docs/portal-anatomy-by-chris-diseno.md`.
 *
 * Lo que estos tests protegen, y es lo que más caro sale si se rompe: que se devuelva la
 * **variante** y no el master. `core/hls/hlsEngine.ts` no los distingue y falla en silencio —
 * se baja el `.m3u8` de la variante creyéndolo un `.ts` y manda al backend un archivo de KB
 * sin un solo error.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResolverManifiestoAnatomy from './resolverManifiesto.js';

const URL_CLASE =
  'https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/M7qypD3n7x?source=CLASS_MODULES_LIST';
const CREDENCIALES = { idToken: 'jwt-id-token' };

const URL_EMBED =
  'https://cf-embed.play.hotmart.com/embed/WLagKxokRk?applicationCode=abc&jwtToken=fresco';
const URL_MASTER =
  'https://vod-akm.play.hotmart.com/video/WLagKxokRk/hls/master-pkg-t-1755460336000.m3u8?hdnts=st=1~exp=2~hmac=x&app=abc';

/** Respuesta de `…/v2/web/lessons/<hash>`, recortada. */
const LECCION = {
  hash: 'M7qypD3n7x',
  name: 'Artrologia',
  module: { id: 'YOm6q5b64d', name: 'Miembro Superior' },
  hasMedia: true,
  medias: [{ code: 'WLagKxokRk', type: 'VIDEO', name: 'Articulacion de MMSS.mp4', url: URL_EMBED }],
};

/**
 * El embed. Ojo con `mediaAssets`: son CINCO entradas con la MISMA url, que difieren sólo en
 * `height` — el campo invita a creer que hay una URL por calidad y no la hay.
 */
function htmlEmbed({ drm = false } = {}) {
  const datos = {
    props: {
      pageProps: {
        applicationData: {
          isDrmEnabled: drm,
          cdnProvider: 'AKAMAI',
          mediaAssets: [1080, 540, 720, 360, 240].map((height) => ({
            height,
            qualityLabel: 'auto',
            url: URL_MASTER,
          })),
        },
      },
    },
  };
  return `<!doctype html><html><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(datos)}</script>
</body></html>`;
}

const MASTER = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=628000,RESOLUTION=426x240,CODECS="avc1.4d401e,mp4a.40.2"
WLagKxokRk-1755460336000-audio=82530-video=297419.m3u8?hdntl=exp=99~acl=/*~hmac=y&app=abc
#EXT-X-STREAM-INF:BANDWIDTH=1928000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
WLagKxokRk-1755460336000-audio=82530-video=1700000.m3u8?hdntl=exp=99~acl=/*~hmac=z&app=abc
#EXT-X-STREAM-INF:BANDWIDTH=1128000,RESOLUTION=854x480,CODECS="avc1.4d401e,mp4a.40.2"
WLagKxokRk-1755460336000-audio=82530-video=900000.m3u8?hdntl=exp=99~acl=/*~hmac=w&app=abc
`;

/** Playlist de MEDIOS: lo que el motor sí sabe leer. */
const PLAYLIST_MEDIOS = `#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="https://contentplayer.hotmart.com/video/x/mp4/key/x.key"
#EXTINF:10.0,
segmento-0.ts
`;

/**
 * Stub de `fetch` que responde por URL. Devuelve además el registro de llamadas, que es donde
 * se verifica el ORDEN de los tres pasos y los headers de auth.
 */
function stubearFetch(respuestas) {
  const llamadas = [];
  const impl = vi.fn(async (url, opciones) => {
    llamadas.push({ url, opciones: opciones || {} });
    for (const [patron, respuesta] of respuestas) {
      if (url.includes(patron)) return respuesta();
    }
    throw new Error(`fetch no esperado: ${url}`);
  });
  vi.stubGlobal('fetch', impl);
  return llamadas;
}

const ok = (cuerpo, json) => () => ({
  ok: true,
  status: 200,
  text: async () => cuerpo,
  json: async () => json,
});
const falla = (status) => () => ({
  ok: false,
  status,
  text: async () => '',
  json: async () => ({}),
});

function stubFeliz(extra = {}) {
  return stubearFetch([
    ['/v2/web/lessons/', extra.leccion || ok('', LECCION)],
    ['cf-embed.play.hotmart.com', extra.embed || ok(htmlEmbed())],
    ['master-pkg-t-', extra.master || ok(MASTER)],
  ]);
}

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('resolver — el camino feliz, en tres fetch', () => {
  it('devuelve la URL de la VARIANTE, nunca la del master', async () => {
    stubFeliz();
    const url = await ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES);

    expect(url).not.toContain('master-pkg-t-');
    expect(url).toContain('-audio=82530-video=');
    expect(url.startsWith('https://vod-akm.play.hotmart.com/video/WLagKxokRk/hls/')).toBe(true);
  });

  it('elige la variante de mayor BANDWIDTH', async () => {
    stubFeliz();
    const url = await ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES);
    expect(url).toContain('video=1700000');
  });

  it('la variante conserva SU hdntl y no arrastra el hdnts del master', async () => {
    // El hdnts del master vive 500 s; el hdntl de la variante, 24 h. Arrastrar el primero
    // haría que la descarga muriera a los pocos minutos.
    stubFeliz();
    const url = await ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES);
    expect(url).toContain('hdntl=');
    expect(url).not.toContain('hdnts=');
  });

  it('pide la lección con Bearer y x-product-id, en ese orden de pasos', async () => {
    const llamadas = stubFeliz();
    await ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES);

    expect(llamadas).toHaveLength(3);
    expect(llamadas[0].url).toContain('/v2/web/lessons/M7qypD3n7x');
    expect(llamadas[0].opciones.headers).toEqual({
      Authorization: 'Bearer jwt-id-token',
      // Sin este header la API contesta 400 y el mensaje NO parece de auth.
      'x-product-id': '6083220',
    });
    expect(llamadas[1].url).toBe(URL_EMBED);
    expect(llamadas[2].url).toBe(URL_MASTER);
  });

  it('propaga el AbortSignal a los tres fetch', async () => {
    const llamadas = stubFeliz();
    const ac = new AbortController();
    await ResolverManifiestoAnatomy.resolver(URL_CLASE, ac.signal, CREDENCIALES);
    expect(llamadas.every((l) => l.opciones.signal === ac.signal)).toBe(true);
  });
});

describe('resolver — falla fuerte, nunca en silencio', () => {
  it('sin credenciales dice que hay que re-escanear, y no sale a la red', async () => {
    const llamadas = stubFeliz();
    await expect(ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, undefined)).rejects.toThrow(
      /re-escane/i
    );
    expect(llamadas).toHaveLength(0);
  });

  it('una URL de clase sin /content/<hash> falla antes de pedir nada', async () => {
    const llamadas = stubFeliz();
    await expect(
      ResolverManifiestoAnatomy.resolver('https://hotmart.com/es/club/anatomy-by-chris', undefined, CREDENCIALES)
    ).rejects.toThrow(/content/);
    expect(llamadas).toHaveLength(0);
  });

  it('una URL sin /products/<id> falla: sin ese dato la API contesta 400', async () => {
    stubFeliz();
    await expect(
      ResolverManifiestoAnatomy.resolver('https://hotmart.com/es/club/x/content/ABC', undefined, CREDENCIALES)
    ).rejects.toThrow(/products/);
  });

  it('un 401 del embed nombra la regla de Referer, que es la causa real', async () => {
    stubFeliz({ embed: falla(401) });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/Referer|dNR/i);
  });

  it('un 401/403 de la API de lecciones se distingue del embed', async () => {
    stubFeliz({ leccion: falla(401) });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/API de lecciones/);
  });

  it('una lección de TEXTO (sin medias) falla con un mensaje que lo dice', async () => {
    stubFeliz({ leccion: ok('', { hash: 'x', hasMedia: false, medias: [] }) });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/no trae ningún media/);
  });

  it('un embed sin __NEXT_DATA__ falla en vez de adivinar con regex', async () => {
    stubFeliz({ embed: ok('<html><body>nada</body></html>') });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/__NEXT_DATA__/);
  });

  it('si Hotmart activara DRM, lo dice acá y no diez pasos más adelante', async () => {
    stubFeliz({ embed: ok(htmlEmbed({ drm: true })) });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/DRM/);
  });

  it('un 403 del master apunta al CDN, no al token vencido', async () => {
    // Este test decía lo contrario —que el mensaje mencionara los 500 s del `hdnts`— y así se
    // quedó fijada una explicación falsa: el master se pide en el `await` siguiente al que lo
    // devuelve, milisegundos después, así que su token NO puede haber vencido. El 403 real del
    // 2026-08-07 era el CDN pidiendo `Referer`. Un test puede blindar una hipótesis equivocada
    // igual de bien que una correcta.
    stubFeliz({ master: falla(403) });
    await expect(
      ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES)
    ).rejects.toThrow(/CDN|Referer/i);
  });
});

/**
 * El TIPO del error, que es lo que decide qué hace el bucle: saltear la clase, pausar la cola
 * o pausarla con auto-heal. Existen desde el fix del cartel mentiroso (2026-08-07): hasta
 * entonces todos salían pelados y `procesadorCola` los clasificaba a todos como "internet".
 *
 * La regla que afirman: **por clase se saltea, sistémico se pausa**. No es "4xx = saltear".
 */
describe('resolver — el TIPO del fallo', () => {
  const tipoDe = async (over) => {
    stubFeliz(over);
    return ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, CREDENCIALES).then(
      () => ({}),
      (e) => e
    );
  };

  it('sin credenciales es "sesion": pausa y le dice al usuario que re-escanee', async () => {
    stubFeliz();
    const e = await ResolverManifiestoAnatomy.resolver(URL_CLASE, undefined, undefined).catch((x) => x);
    expect(e.tipoConexion).toBe('sesion');
  });

  it('un 401 de la API de lecciones es el token vencido → "sesion", no un bloqueo', async () => {
    const e = await tipoDe({ leccion: falla(401) });
    expect(e.tipoConexion).toBe('sesion');
    expect(e.tipoPortal).toBeUndefined();
  });

  it('un 404 de la lección es de ESA clase → "rechazo" (se saltea y la cola sigue)', async () => {
    const e = await tipoDe({ leccion: falla(404) });
    expect(e.tipoPortal).toBe('rechazo');
    expect(e.httpStatus).toBe(404);
  });

  it('una lección sin media es "rechazo": cambió de tipo, las demás siguen bien', async () => {
    const e = await tipoDe({ leccion: ok('', { hash: 'x', hasMedia: false, medias: [] }) });
    expect(e.tipoPortal).toBe('rechazo');
  });

  it('el DRM es "rechazo": es de ese video, no del portal', async () => {
    const e = await tipoDe({ embed: ok(htmlEmbed({ drm: true })) });
    expect(e.tipoPortal).toBe('rechazo');
  });

  it('un 401 del embed es "bloqueo": la regla de Referer le falta a TODAS las clases', async () => {
    const e = await tipoDe({ embed: falla(401) });
    expect(e.tipoPortal).toBe('bloqueo');
  });

  it('un 403 del master es "bloqueo": el CDN rechaza igual las 114 clases', async () => {
    const e = await tipoDe({ master: falla(403) });
    expect(e.tipoPortal).toBe('bloqueo');
    expect(e.httpStatus).toBe(403);
  });

  it('que el embed cambie de forma es "bloqueo", no un problema de esa clase', async () => {
    const e = await tipoDe({ embed: ok('<html><body>nada</body></html>') });
    expect(e.tipoPortal).toBe('bloqueo');
  });

  it('un 5xx queda SIN tipar: es transitorio y el auto-heal tiene que actuar', async () => {
    const e = await tipoDe({ master: falla(503) });
    expect(e.tipoPortal).toBeUndefined();
    expect(e.tipoConexion).toBeUndefined();
  });
});

describe('elegirVariante', () => {
  it('resuelve la URI relativa contra la del master', () => {
    const url = ResolverManifiestoAnatomy.elegirVariante(MASTER, URL_MASTER);
    expect(url.startsWith('https://vod-akm.play.hotmart.com/video/WLagKxokRk/hls/')).toBe(true);
  });

  it('si ya es una playlist de MEDIOS la devuelve tal cual', () => {
    // Deja el resolvedor a salvo de que Hotmart pase a servir la playlist directo: sin esto,
    // ese cambio se vería como "no se pudo elegir variante" en vez de simplemente funcionar.
    expect(ResolverManifiestoAnatomy.elegirVariante(PLAYLIST_MEDIOS, URL_MASTER)).toBe(URL_MASTER);
  });

  it('un master con streams pero sin URI utilizable tira', () => {
    const roto = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n';
    expect(() => ResolverManifiestoAnatomy.elegirVariante(roto, URL_MASTER)).toThrow(/variante/);
  });

  it('tolera comentarios entre el STREAM-INF y su URI', () => {
    const conComentario =
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\n\n#comentario\nvariante-a.m3u8\n';
    expect(ResolverManifiestoAnatomy.elegirVariante(conComentario, URL_MASTER)).toContain(
      'variante-a.m3u8'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// [CORTE 4] El tope de calidad.
//
// La regla NO es "dame 720": es *el escalón más alto que no pase del tope; si ninguno baja de
// ahí, el más chico*. La diferencia importa porque una búsqueda exacta se rompe el día que el
// CDN mueva la escalera, y se rompe hacia el peor lado — devolver el master, que `hlsEngine` no
// distingue de una playlist de medios (baja el `.m3u8` creyéndolo un `.ts`, sin error).
// ─────────────────────────────────────────────────────────────────────────────

/** La escalera REAL, medida el 2026-08-07 sobre la clase *Osteologia*. Ojo: NO hay 480. */
const ESCALERA_REAL = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=136000,RESOLUTION=400x240
v-240.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=170000,RESOLUTION=600x360
v-360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=222000,RESOLUTION=900x540
v-540.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=277000,RESOLUTION=1200x720
v-720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=403000,RESOLUTION=1800x1080
v-1080.m3u8
`;

describe('elegirVariante — el tope de calidad', () => {
  const elegir = (texto, tope) =>
    ResolverManifiestoAnatomy.elegirVariante(texto, URL_MASTER, tope);

  it('con la escalera real y tope 720, elige 720', () => {
    expect(elegir(ESCALERA_REAL, 720)).toContain('v-720.m3u8');
  });

  it('con tope 480 elige 360, porque NO existe el escalón 480', () => {
    // El hallazgo que dio vuelta la decisión: "clavarlo en 480p" era irrealizable tal cual.
    expect(elegir(ESCALERA_REAL, 480)).toContain('v-360.m3u8');
  });

  it('con tope 1080 elige 1080: el tope no obliga a bajar de calidad', () => {
    expect(elegir(ESCALERA_REAL, 1080)).toContain('v-1080.m3u8');
  });

  it('si el CDN saca el escalón del tope, degrada al vecino de abajo en vez de romperse', () => {
    // Riesgo R7. Con una búsqueda exacta, este caso devolvía el master: el fallo silencioso.
    const sin720 = ESCALERA_REAL.split('#EXT-X-STREAM-INF:BANDWIDTH=277000,RESOLUTION=1200x720\nv-720.m3u8\n').join('');
    expect(elegir(sin720, 720)).toContain('v-540.m3u8');
  });

  it('si TODOS los escalones superan el tope, elige el más chico', () => {
    // Nunca "ninguno": quedarse sin variante caería en el throw, que pausa la cola entera por
    // algo que tiene una respuesta razonable.
    expect(elegir(ESCALERA_REAL, 100)).toContain('v-240.m3u8');
  });

  it('con una sola variante la toma, entre o no en el tope', () => {
    const una = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=403000,RESOLUTION=1800x1080\nv-1080.m3u8\n';
    expect(elegir(una, 720)).toContain('v-1080.m3u8');
  });

  it('sin RESOLUTION en ninguna variante cae al criterio viejo: el mayor BANDWIDTH', () => {
    // `RESOLUTION` es opcional en el estándar. Sin altura que comparar no hay regla que aplicar.
    const sinRes =
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=100\nchica.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=900\ngrande.m3u8\n';
    expect(elegir(sinRes, 720)).toContain('grande.m3u8');
  });

  it('sin tope se queda con la más alta: el tope es del portal, no del algoritmo', () => {
    expect(elegir(ESCALERA_REAL, undefined)).toContain('v-1080.m3u8');
  });

  it('lo que devuelve es SIEMPRE una variante, nunca el master', () => {
    // La mitad silenciosa del bug: `hlsEngine` toma toda línea sin `#` como fragmento, así que
    // ante un master baja el `.m3u8` creyéndolo un `.ts` y manda al backend un archivo de KB.
    const elegida = elegir(ESCALERA_REAL, 720);
    expect(elegida).not.toBe(URL_MASTER);
    expect(elegida).toContain('v-720.m3u8');
  });
});
