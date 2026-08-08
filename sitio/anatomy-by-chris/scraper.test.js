// @vitest-environment jsdom
/**
 * Tests del escaneo de Anatomy by Chris — **contra un doble de `/v1/navigation`**.
 *
 * ⚠️ ESTO ES UNA PÉRDIDA, Y VA ESCRITA
 * -------------------------------------
 * Hasta el corte 1 estos tests corrían contra el **HTML real** del portal
 * (`__fixtures__/listado-modulo.html`, recortado de las páginas que el dueño guardó del club), y
 * eso los hacía la única observación real del portal que existía sin abrir el navegador: las
 * cuatro trampas del DOM —el `innerText` envenenado por los `<title>` de los íconos, las flechas
 * de navegación que parecen clases, las filas de Texto sin thumbnail y el `<aside>` de Perfil que
 * gana un `querySelector('aside')`— vivían en el fixture y ningún doble escrito a mano las habría
 * reproducido.
 *
 * Con el escaneo por API eso deja de aplicar: **ya no se lee el DOM**, así que un fixture de HTML
 * no probaría nada. Lo que se gana a cambio es que el escaneo deje de depender de que el sidebar
 * haya terminado de pintarse, que es de donde salían los tres síntomas. El fixture queda en el
 * repo porque sigue documentando el DOM del portal, pero ya no lo lee nadie.
 *
 * El JSON de abajo está **recortado del crudo medido el 2026-08-07**
 * (`descargas/medicion-navigation.json`, no versionado): mismos campos, mismos nombres, y las
 * colisiones reales de títulos entre módulos.
 *
 * Lo que estos tests NO pueden ver, y por eso el navegador sigue siendo obligatorio:
 *   1. Que la función sea **serializable y autocontenida** (riesgo R1). Acá corre importada, con
 *      su módulo entero disponible; en producción la serializa `executeScript`.
 *   2. Que una función **`async` inyectada resuelva** (riesgo R2). Acá la espera Vitest.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ScraperAnatomy from './scraper.js';

const URL_CLASE =
  'https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/M7qypD3n7x';
const URL_HOME = 'https://hotmart.com/es/club/anatomy-by-chris/products/6083220';
const API = 'https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v1/navigation';

/** Recorte del árbol real. Incluye las dos colisiones y los dos tipos de clase. */
const ARBOL = {
  modules: [
    {
      id: 1,
      name: 'Miembro Superior',
      pages: [
        { name: 'Osteologia', hash: 'aaa111', type: 'CONTENT', locked: false, hasPlayerMedia: true },
        { name: 'Miologia 1', hash: 'aaa222', type: 'CONTENT', locked: false, hasPlayerMedia: true },
        { name: 'Irrigación', hash: 'aaa333', type: 'CONTENT', locked: false, hasPlayerMedia: true },
        // Una de Texto: `hasPlayerMedia: false`. En el escaneo por DOM se colaban.
        { name: 'Bibliografía', hash: 'aaa444', type: 'CONTENT', locked: false, hasPlayerMedia: false },
      ],
    },
    {
      id: 2,
      name: 'Miembro Inferior',
      pages: [
        // Los MISMOS dos títulos que arriba: son otras clases, con otro hash y otra carpeta.
        { name: 'Miologia 1', hash: 'bbb222', type: 'CONTENT', locked: false, hasPlayerMedia: true },
        { name: 'Irrigación', hash: 'bbb333', type: 'CONTENT', locked: false, hasPlayerMedia: true },
        // Bloqueada por drip: no se puede resolver, así que no se encola.
        { name: 'Clase futura', hash: 'bbb444', type: 'CONTENT', locked: true, hasPlayerMedia: true },
      ],
    },
    {
      // El módulo que devuelve CERO videos, y eso es correcto: son todas de Texto.
      id: 3,
      name: 'Libros y Herramientas de Estudio',
      pages: [
        { name: 'Atlas', hash: 'ccc111', type: 'CONTENT', locked: false, hasPlayerMedia: false },
      ],
    },
  ],
  tags: [],
};

/** Pone la URL de la pestaña. jsdom no deja asignar `location.href` directo. */
function estarEn(url) {
  delete window.location;
  window.location = new URL(url);
}

function mockearApi(respuesta, { ok = true } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: async () => respuesta,
  });
  globalThis.fetch = fetchMock;
  return fetchMock;
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('token', 'ID_TOKEN_FALSO');
  estarEn(URL_CLASE);
  mockearApi(ARBOL);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.fetch;
});

const escanear = () => ScraperAnatomy.escanearListadoDelModulo();

describe('escanearListadoDelModulo — la llamada a la API', () => {
  it('pide el árbol UNA sola vez, con el Bearer y el x-product-id', async () => {
    const fetchMock = mockearApi(ARBOL);
    await escanear();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe(API);
    expect(opciones.headers.Authorization).toBe('Bearer ID_TOKEN_FALSO');
    // Sin este header la API contesta 400 "Required header 'x-product-id' is not present", que
    // NO parece un error de auth y hace perder tiempo buscando el token equivocado.
    expect(opciones.headers['x-product-id']).toBe('6083220');
  });

  it('el productId sale de la URL de la pestaña, no de una constante', async () => {
    estarEn('https://hotmart.com/pt/club/anatomy-by-chris/products/999/content/zzz');
    const fetchMock = mockearApi(ARBOL);
    await escanear();
    expect(fetchMock.mock.calls[0][1].headers['x-product-id']).toBe('999');
  });

  it('SÍNTOMA 1: escanea igual desde la home del producto, sin entrar a una clase', async () => {
    // Era el defecto más visible del escaneo por DOM: sin estar dentro de una clase no había
    // sidebar, y sin sidebar no había nada que leer.
    estarEn(URL_HOME);
    const { enlaces } = await escanear();
    expect(enlaces.length).toBe(5);
  });

  it('en una pestaña que no es del club devuelve vacío sin llamar a nadie', async () => {
    estarEn('https://hotmart.com/es/club/otro-curso/products/1/content/x');
    const fetchMock = mockearApi(ARBOL);
    const res = await escanear();
    // El slug no matchea el patrón del portal... pero el patrón de la URL sí es el de un club,
    // así que lo que se afirma es que igual arma bien el producto. Ver el test de abajo para el
    // caso de una URL que no es de club.
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('en una URL que no es de un club devuelve vacío y NO llama a la API', async () => {
    estarEn('https://hotmart.com/es/dashboard');
    const fetchMock = mockearApi(ARBOL);
    const res = await escanear();
    expect(res).toEqual({ materia: '', enlaces: [], credenciales: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('escanearListadoDelModulo — las clases', () => {
  it('trae los once módulos de una: el escaneo ya no es por módulo abierto', async () => {
    // SÍNTOMA 2. Con el DOM sólo se veía la sección `aria-expanded="true"`, o sea uno de once,
    // y los anteriores se perdían al re-escanear.
    const { enlaces } = await escanear();
    const modulos = new Set(enlaces.map((e) => e.modulo));
    expect(modulos).toEqual(new Set(['miembro_superior', 'miembro_inferior']));
  });

  it('cada enlace lleva su módulo SANEADO como nombre de carpeta', async () => {
    const { enlaces } = await escanear();
    const osteologia = enlaces.find((e) => e.texto === 'Osteologia');
    expect(osteologia.modulo).toBe('miembro_superior');
  });

  it('el módulo saca los acentos en vez de convertirlos en guiones bajos', async () => {
    mockearApi({ modules: [{ name: 'Irrigación y Miología', pages: [
      { name: 'X', hash: 'h1', locked: false, hasPlayerMedia: true },
    ] }] });
    const { enlaces } = await escanear();
    expect(enlaces[0].modulo).toBe('irrigacion_y_miologia');
  });

  it('hasPlayerMedia es el discriminador: las de Texto no entran', async () => {
    // Reemplaza a la heurística del thumbnail, que dependía de que el sidebar hubiera pintado
    // — y que en la corrida real del 2026-08-07 dejó colar dos clases de Texto.
    const { enlaces } = await escanear();
    expect(enlaces.map((e) => e.texto)).not.toContain('Bibliografía');
    expect(enlaces.map((e) => e.texto)).not.toContain('Atlas');
  });

  it('un módulo entero de Texto devuelve cero clases, y eso es correcto', async () => {
    const { enlaces } = await escanear();
    expect(enlaces.filter((e) => e.modulo === 'libros_y_herramientas_de_estudio')).toEqual([]);
  });

  it('una clase bloqueada por drip no se encola: encolarla sería programar un fallo', async () => {
    const { enlaces } = await escanear();
    expect(enlaces.map((e) => e.texto)).not.toContain('Clase futura');
  });

  it('LAS COLISIONES: el mismo título en dos módulos son dos enlaces distintos', async () => {
    const { enlaces } = await escanear();
    const miologias = enlaces.filter((e) => e.texto === 'Miologia 1');

    expect(miologias).toHaveLength(2);
    expect(miologias.map((e) => e.modulo).sort()).toEqual(['miembro_inferior', 'miembro_superior']);
    // Distinto hash ⇒ distinto video. Es lo que hace que tratarlas como una sola pierda una.
    expect(miologias[0].href).not.toBe(miologias[1].href);
  });

  it('el href se arma con el hash y tiene la forma que resolverManifiesto ya parsea', async () => {
    const { enlaces } = await escanear();
    const osteologia = enlaces.find((e) => e.texto === 'Osteologia');
    expect(osteologia.href).toBe(
      'https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/aaa111'
    );
    // Los dos regex del resolvedor tienen que matchear sobre esto, o la clase se saltea.
    expect(/\/content\/([A-Za-z0-9]+)/.exec(osteologia.href)[1]).toBe('aaa111');
    expect(/\/products\/(\d+)/.exec(osteologia.href)[1]).toBe('6083220');
  });

  it('conserva el segmento de idioma de la pestaña al armar los href', async () => {
    estarEn('https://hotmart.com/pt/club/anatomy-by-chris/products/6083220');
    const { enlaces } = await escanear();
    expect(enlaces[0].href).toContain('/pt/club/');
  });

  it('colapsa espacios y recorta el título', async () => {
    mockearApi({ modules: [{ name: 'M', pages: [
      { name: '  Osteologia   del   humero ', hash: 'h1', locked: false, hasPlayerMedia: true },
    ] }] });
    const { enlaces } = await escanear();
    expect(enlaces[0].texto).toBe('Osteologia del humero');
  });

  it('una clase sin título o sin hash no se cuela', async () => {
    mockearApi({ modules: [{ name: 'M', pages: [
      { name: '', hash: 'h1', locked: false, hasPlayerMedia: true },
      { name: 'Sin hash', hash: '', locked: false, hasPlayerMedia: true },
      { name: 'Buena', hash: 'h3', locked: false, hasPlayerMedia: true },
    ] }] });
    const { enlaces } = await escanear();
    expect(enlaces.map((e) => e.texto)).toEqual(['Buena']);
  });

  it('devuelve materia vacía: ya no hay UNA materia, hay una por módulo', async () => {
    const { materia } = await escanear();
    expect(materia).toBe('');
  });
});

describe('escanearListadoDelModulo — las credenciales', () => {
  it('cosecha el id_token de localStorage, que es lo único que sólo existe en la pestaña', async () => {
    const { credenciales } = await escanear();
    expect(credenciales).toEqual({ idToken: 'ID_TOKEN_FALSO' });
  });

  it('sin token corta antes de llamar: sin credencial no hay árbol', async () => {
    window.localStorage.clear();
    const fetchMock = mockearApi(ARBOL);
    const res = await escanear();

    expect(res).toEqual({ materia: '', enlaces: [], credenciales: undefined });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si la API falla NO se tiran las credenciales: puede ser la red y el token estar sano', async () => {
    // Tirarlas obligaría a re-escanear para renovar algo que no venció.
    mockearApi(null, { ok: false });
    const res = await escanear();
    expect(res.credenciales).toEqual({ idToken: 'ID_TOKEN_FALSO' });
    expect(res.enlaces).toEqual([]);
  });

  it('un fetch que TIRA devuelve vacío en vez de propagar', async () => {
    // Una excepción cruzando executeScript se ve como "error de inyección", que manda a
    // diagnosticar permisos de host en vez del portal.
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(escanear()).resolves.toEqual({
      materia: '',
      enlaces: [],
      credenciales: { idToken: 'ID_TOKEN_FALSO' },
    });
  });

  it('un árbol sin modules no rompe', async () => {
    mockearApi({});
    const { enlaces } = await escanear();
    expect(enlaces).toEqual([]);
  });
});
