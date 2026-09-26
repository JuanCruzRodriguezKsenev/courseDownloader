/**
 * Tests de caracterización de core/util/texto.ts (antes shared/utils.js).
 *
 * Documentan el comportamiento ACTUAL como red de regresión: los valores esperados se
 * capturaron ejecutando el código real, no son un contrato nuevo. Si un cambio los rompe, hay
 * que decidir conscientemente si es un fix o una regresión, no ajustar el test a ciegas.
 *
 * Sobrevivieron sin tocar una aserción al reparto de la Fase 6a — que era exactamente para lo
 * que estaban.
 */
// @ts-expect-error Entorno de test en Node sin @types/node en la extensión
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { sanitizarTexto, escaparHtml, quitarAcentos, nombreEnDisco, CARACTERES_VALIDOS_EN_DISCO } from './texto';

describe('sanitizarTexto', () => {
  it('reemplaza caracteres inválidos para nombre de archivo por "_"', () => {
    expect(sanitizarTexto('Clase: 1/2 <test>')).toBe('Clase_ 1_2 _test_');
  });

  it('colapsa espacios múltiples y recorta extremos', () => {
    expect(sanitizarTexto('  Hola   Mundo  ')).toBe('Hola Mundo');
  });

  it('preserva acentos, ñ, guiones y paréntesis permitidos', () => {
    expect(sanitizarTexto('Niño (2024) - Introducción')).toBe('Niño (2024) - Introducción');
  });

  it('devuelve placeholder ante texto vacío o nulo', () => {
    expect(sanitizarTexto('')).toBe('video_sin_nombre');
    expect(sanitizarTexto(null)).toBe('video_sin_nombre');
    expect(sanitizarTexto(undefined)).toBe('video_sin_nombre');
  });
});

describe('escaparHtml', () => {
  it('neutraliza un payload de inyección de markup', () => {
    expect(escaparHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa los cinco metacaracteres de HTML', () => {
    expect(escaparHtml(`a & b "c" 'd' <e>`))
      .toBe('a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;');
  });

  it('escapa el ampersand primero para no doble-escapar', () => {
    expect(escaparHtml('&lt;')).toBe('&amp;lt;');
  });

  it('trata null/undefined como string vacío', () => {
    expect(escaparHtml(null)).toBe('');
    expect(escaparHtml(undefined)).toBe('');
  });

  it('no altera texto sin metacaracteres', () => {
    expect(escaparHtml('Clase 3 - Parte 1')).toBe('Clase 3 - Parte 1');
  });
});

/**
 * `quitarAcentos` no tenía tests propios: los suyos vivían en `parserTitulos.test.js`, que la
 * ejercita de rebote a través del parser. Al quedar como función exportada de Capa 1 —con
 * consumidores fuera del parser— se le escriben los directos que le faltaban.
 */
describe('quitarAcentos', () => {
  it('reemplaza vocales acentuadas conservando la caja', () => {
    expect(quitarAcentos('Introducción a la Química Orgánica')).toBe('Introduccion a la Quimica Organica');
    expect(quitarAcentos('ÁÉÍÓÚ')).toBe('AEIOU');
  });

  it('cubre diéresis y acento grave/circunflejo, no sólo el agudo', () => {
    expect(quitarAcentos('Müller à côté')).toBe('Muller a cote');
  });

  it('NO toca la ñ (es letra propia, no un acento)', () => {
    expect(quitarAcentos('Diseño de Señales')).toBe('Diseño de Señales');
  });

  it('trata null/undefined/vacío como string vacío', () => {
    expect(quitarAcentos(null)).toBe('');
    expect(quitarAcentos(undefined)).toBe('');
    expect(quitarAcentos('')).toBe('');
  });
});

describe('nombreEnDisco', () => {
  it('conserva el doble espacio', () => {
    expect(nombreEnDisco('MC4 2026  - Copia de P2F2.pdf')).toBe('MC4 2026  - Copia de P2F2.pdf');
  });

  it('sanea caracteres fuera de la lista blanca', () => {
    expect(nombreEnDisco('27 abr 2026 a la(s) 5:36 p.m..jpg')).toBe('27 abr 2026 a la(s) 5_36_p.m..jpg');
  });

  it('extrae el nombre de archivo con barras normales y barras invertidas', () => {
    expect(nombreEnDisco('a/b\\c.pdf')).toBe('c.pdf');
  });

  it('devuelve placeholder ante texto vacío o nulo', () => {
    expect(nombreEnDisco('')).toBe('video_sin_nombre');
    expect(nombreEnDisco(null)).toBe('video_sin_nombre');
    expect(nombreEnDisco(undefined)).toBe('video_sin_nombre');
    expect(nombreEnDisco('   ')).toBe('video_sin_nombre');
  });

  it('paridad con el backend: backend/utils.js contiene la misma clase de caracteres', () => {
    const fuenteBackend = readFileSync(new URL('../../backend/utils.js', import.meta.url), 'utf8');
    expect(fuenteBackend).toContain(CARACTERES_VALIDOS_EN_DISCO);
  });
});
