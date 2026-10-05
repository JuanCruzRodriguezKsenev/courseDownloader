/**
 * Las funciones de escaneo se INYECTAN en la pestaña: `popup.js` hace
 * `executeScript({ func: portal.escanearListado })`, que las serializa con `toString()`.
 * Si no compilan como expresión, la inyección falla antes de correr una línea, y los tests
 * de cada scraper no lo ven porque llaman a la función directo.
 *
 * Esto NO ve que la función use algo de afuera (una constante del módulo, `this`): eso
 * compila y rompe recién en la pestaña. Eso sigue siendo del navegador (AGENTS.md, bullet
 * de `Scraper.escanearAulaVirtual`).
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
// Los scrapers publican su global al cargarse, y el getter `escanearListado` de cada
// descriptor lee ese global.
import './ramonnet/scraper.js';
import './anatomy-by-chris/scraper.js';
import './google-classroom/scraper.js';
import './moodle-linti/scraper.js';
import './sites-matec/scraper.js';
import './moodle-asignaturas/scraper.js';
import { Sitios } from './registro.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const matecSeriesHtml = fs.readFileSync(path.join(__dirname, 'sites-matec/__fixtures__/series.html'), 'utf-8');
const matecAutoHtml = fs.readFileSync(path.join(__dirname, 'sites-matec/__fixtures__/autoevaluaciones.html'), 'utf-8');
const moodleCursoHtml = fs.readFileSync(path.join(__dirname, 'moodle-asignaturas/__fixtures__/curso.html'), 'utf-8');
const moodleCarpetaHtml = fs.readFileSync(path.join(__dirname, 'moodle-asignaturas/__fixtures__/carpeta.html'), 'utf-8');
const moodleUrlHtml = fs.readFileSync(path.join(__dirname, 'moodle-asignaturas/__fixtures__/url-intermedia.html'), 'utf-8');

const compilaComoExpresion = (fn) => new Function(`return (${fn.toString()});`);

function crearContextoNavegador() {
  const mockLocation = {
    origin: 'https://ejemplo.unlp.edu.ar',
    pathname: '/ing.unlp.edu.ar/matec/inicio',
    search: '?id=82',
    href: 'https://ejemplo.unlp.edu.ar/ing.unlp.edu.ar/matec/inicio?id=82',
  };

  const mockElement = {
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    textContent: 'Texto de prueba',
    tagName: 'DIV',
    classList: { contains: () => false },
    cloneNode: function () {
      return this;
    },
  };

  const mockDoc = {
    querySelector: () => mockElement,
    querySelectorAll: () => [],
    title: 'Curso de prueba | UNLP',
    body: mockElement,
    documentElement: mockElement,
    getElementById: () => null,
  };

  mockElement.ownerDocument = mockDoc;

  class MockDOMParser {
    parseFromString() {
      return mockDoc;
    }
  }

  const mockWindow = {
    location: mockLocation,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    document: mockDoc,
    DOMParser: MockDOMParser,
    fetch: () =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve('<html><body></body></html>'),
        json: () => Promise.resolve({}),
      }),
  };

  mockWindow.window = mockWindow;

  return vm.createContext({
    window: mockWindow,
    document: mockDoc,
    location: mockLocation,
    DOMParser: MockDOMParser,
    fetch: mockWindow.fetch,
    localStorage: mockWindow.localStorage,
    URL,
    URLSearchParams,
    Set,
    Map,
    Promise,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Math,
    Date,
    console,
    setTimeout,
    clearTimeout,
    encodeURIComponent,
    decodeURIComponent,
  });
}

describe('inyección: la función de escaneo sobrevive a executeScript', () => {
  it.each(Sitios.todos().map((s) => [s.id, s]))('%s: escanearListado es una función serializable', (_id, sitio) => {
    const fn = sitio.escanearListado;
    expect(typeof fn).toBe('function');
    expect(() => compilaComoExpresion(fn)).not.toThrow();
  });

  it('control negativo: un método abreviado NO compila', () => {
    const abreviado = { async escanearListado() { return 1; } }.escanearListado;
    expect(() => compilaComoExpresion(abreviado)).toThrow(SyntaxError);
  });

  it.each(Sitios.todos().map((s) => [s.id, s]))(
    '%s: escanearListado no lanza ReferenceError al ejecutarse en node:vm limpio',
    async (_id, sitio) => {
      const contexto = crearContextoNavegador();
      const fnCodigo = `(${sitio.escanearListado.toString()})`;
      const fnInyectada = vm.runInContext(fnCodigo, contexto);

      expect(typeof fnInyectada).toBe('function');
      try {
        const resultado = fnInyectada();
        if (resultado && typeof resultado.then === 'function') {
          await resultado;
        }
      } catch (err) {
        expect(err.name).not.toBe('ReferenceError');
      }
    }
  );

  it('control negativo: una función con variables libres falla con ReferenceError en el sandbox', async () => {
    const contexto = crearContextoNavegador();
    const conVariableLibre = async function () {
      // eslint-disable-next-line no-undef
      return VARIABLE_QUE_NO_EXISTE_EN_EL_SANDBOX;
    };
    const fnInyectada = vm.runInContext(`(${conVariableLibre.toString()})`, contexto);
    let errorCapturado = null;
    try {
      await fnInyectada();
    } catch (err) {
      errorCapturado = err;
    }
    expect(errorCapturado).not.toBeNull();
    expect(errorCapturado.name).toBe('ReferenceError');
  });
});

describe('inyección sobre DOM real con fixtures (sites-matec y moodle-asignaturas)', () => {
  it('sites-matec: evalúa escanearListado en ventana JSDOM limpia con fixtures y resuelve enlaces > 0 sin ReferenceError', async () => {
    const sitio = Sitios.obtener('sites-matec');
    expect(sitio).toBeDefined();

    const dom = new JSDOM('<html><body></body></html>', {
      url: 'https://sites.google.com/ing.unlp.edu.ar/matec/inicio',
      runScripts: 'outside-only',
    });
    const ctx = dom.getInternalVMContext();
    ctx.fetch = async (url) => {
      const urlStr = String(url);
      let body = '<html><body></body></html>';
      if (urlStr.includes('/series')) body = matecSeriesHtml;
      if (urlStr.includes('/autoevaluaciones')) body = matecAutoHtml;
      return {
        ok: true,
        status: 200,
        text: async () => body,
      };
    };

    const fnCodigo = `(${sitio.escanearListado.toString()})`;
    const fnInyectada = vm.runInContext(fnCodigo, ctx);
    expect(typeof fnInyectada).toBe('function');

    const res = await fnInyectada();
    expect(res.materia).toBe('Matemática C');
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(res.enlaces.length).toBe(29);
  });

  it('moodle-asignaturas: evalúa escanearListado en ventana JSDOM limpia con fixtures y resuelve enlaces > 0 sin ReferenceError', async () => {
    const sitio = Sitios.obtener('moodle-asignaturas');
    expect(sitio).toBeDefined();

    const dom = new JSDOM(moodleCursoHtml, {
      url: 'https://asignaturas.info.unlp.edu.ar/course/view.php?id=82',
      runScripts: 'outside-only',
    });
    const ctx = dom.getInternalVMContext();
    ctx.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/mod/folder/')) {
        return {
          ok: true,
          status: 200,
          text: async () => moodleCarpetaHtml,
        };
      }
      if (urlStr.includes('/mod/url/')) {
        return {
          ok: true,
          status: 200,
          text: async () => moodleUrlHtml,
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => '<html><body></body></html>',
      };
    };

    const fnCodigo = `(${sitio.escanearListado.toString()})`;
    const fnInyectada = vm.runInContext(fnCodigo, ctx);
    expect(typeof fnInyectada).toBe('function');

    const res = await fnInyectada();
    expect(res.materia).toBe('2024_CURSADA REGULAR_Programación II');
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(res.enlaces.length).toBe(110);
  });
});

