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
