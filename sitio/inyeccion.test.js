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
import { describe, it, expect } from 'vitest';
// Los scrapers publican su global al cargarse, y el getter `escanearListado` de cada
// descriptor lee ese global.
import './ramonnet/scraper.js';
import './anatomy-by-chris/scraper.js';
import './google-classroom/scraper.js';
import { Sitios } from './registro.ts';

const compilaComoExpresion = (fn) => new Function(`return (${fn.toString()});`);

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
});
