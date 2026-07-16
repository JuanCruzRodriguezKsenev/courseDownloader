/**
 * Tests de caracterización para shared/utils.js.
 *
 * Documentan el comportamiento ACTUAL de las funciones puras como red de
 * regresión antes de refactorizar (ver docs/ROADMAP.md, Fase 1). Los valores
 * esperados se capturaron ejecutando el código real, no son un contrato nuevo:
 * si un cambio los rompe, hay que decidir conscientemente si es un fix o una
 * regresión, no ajustar el test a ciegas.
 */
import { describe, it, expect } from 'vitest';
import Utils from './utils.js';

describe('sanitizarTexto', () => {
  it('reemplaza caracteres inválidos para nombre de archivo por "_"', () => {
    expect(Utils.sanitizarTexto('Clase: 1/2 <test>')).toBe('Clase_ 1_2 _test_');
  });

  it('colapsa espacios múltiples y recorta extremos', () => {
    expect(Utils.sanitizarTexto('  Hola   Mundo  ')).toBe('Hola Mundo');
  });

  it('preserva acentos, ñ, guiones y paréntesis permitidos', () => {
    expect(Utils.sanitizarTexto('Niño (2024) - Introducción')).toBe('Niño (2024) - Introducción');
  });

  it('devuelve placeholder ante texto vacío o nulo', () => {
    expect(Utils.sanitizarTexto('')).toBe('video_sin_nombre');
    expect(Utils.sanitizarTexto(null)).toBe('video_sin_nombre');
    expect(Utils.sanitizarTexto(undefined)).toBe('video_sin_nombre');
  });
});

describe('escaparHtml', () => {
  it('neutraliza un payload de inyección de markup', () => {
    expect(Utils.escaparHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapa los cinco metacaracteres de HTML', () => {
    expect(Utils.escaparHtml(`a & b "c" 'd' <e>`))
      .toBe('a &amp; b &quot;c&quot; &#39;d&#39; &lt;e&gt;');
  });

  it('escapa el ampersand primero para no doble-escapar', () => {
    expect(Utils.escaparHtml('&lt;')).toBe('&amp;lt;');
  });

  it('trata null/undefined como string vacío', () => {
    expect(Utils.escaparHtml(null)).toBe('');
    expect(Utils.escaparHtml(undefined)).toBe('');
  });

  it('no altera texto sin metacaracteres', () => {
    expect(Utils.escaparHtml('Clase 3 - Parte 1')).toBe('Clase 3 - Parte 1');
  });
});

describe('parseSmartDate', () => {
  it('detecta el día cuando el primer número es > 12 (día/mes)', () => {
    expect(Utils.parseSmartDate('13', '5')).toEqual({ day: '13', month: '05' });
  });

  it('desambigua invirtiendo cuando el segundo número es > 12 (mes/día)', () => {
    expect(Utils.parseSmartDate('5', '13')).toEqual({ day: '13', month: '05' });
  });

  it('ante ambigüedad (ambos <= 12) asume el orden recibido como día-mes', () => {
    expect(Utils.parseSmartDate('3', '4')).toEqual({ day: '03', month: '04' });
    expect(Utils.parseSmartDate('12', '12')).toEqual({ day: '12', month: '12' });
  });

  it('rellena con ceros a la izquierda', () => {
    expect(Utils.parseSmartDate('1', '9')).toEqual({ day: '01', month: '09' });
  });
});

describe('clasificarCatedraYCarpeta', () => {
  it('prioriza la mención explícita de CÁTEDRA', () => {
    expect(Utils.clasificarCatedraYCarpeta('Biologia Catedra A Clase 2', 'biologia'))
      .toEqual({ catedra: 'A', carpeta: 'biologia' });
  });

  it('infiere la letra a partir de "MATERIA X" cuando no hay cátedra explícita', () => {
    expect(Utils.clasificarCatedraYCarpeta('BIOLOGIA A clase 3', 'biologia'))
      .toEqual({ catedra: 'A', carpeta: 'biologia' });
    expect(Utils.clasificarCatedraYCarpeta('ANATO D repaso', 'anatomia'))
      .toEqual({ catedra: 'D', carpeta: 'anatomia' });
  });

  it('cae en "COMUN" cuando la sigla no matchea la materia base', () => {
    expect(Utils.clasificarCatedraYCarpeta('XYZ B algo', 'biologia'))
      .toEqual({ catedra: 'COMUN', carpeta: 'biologia' });
  });

  it('cae en "COMUN" cuando no hay ninguna letra de cátedra', () => {
    expect(Utils.clasificarCatedraYCarpeta('Clase sin nada', 'quimica'))
      .toEqual({ catedra: 'COMUN', carpeta: 'quimica' });
  });

  it('la carpeta siempre es la materia base en minúsculas y sin espacios', () => {
    expect(Utils.clasificarCatedraYCarpeta('Clase sin nada', '  Quimica  ').carpeta)
      .toBe('quimica');
  });
});

describe('formatTitleStructured', () => {
  it('arma el nombre canónico completo con fecha, cátedra, clase, parte y detalle', () => {
    expect(Utils.formatTitleStructured('SEM 3-15 Biologia Catedra A Clase 2 Parte 1 Introduccion', 'biologia'))
      .toBe('SEM 03-15 - BIO A - CLASE 2 - PARTE 1 - INTRODUCCION');
  });

  it('resuelve fecha ambigua día/mes con la heurística >12 (05-13 => día 13)', () => {
    expect(Utils.formatTitleStructured('Anatomia 05-13 CLASE 4 PARTE 2 Sistema Nervioso', 'anatomia'))
      .toBe('SEM 05-13 - ANATO - CLASE 4 - PARTE 2 - SISTEMA NERVIOSO');
  });

  it('usa el prefijo SEM 00-00 cuando no encuentra fecha (forcePrefix)', () => {
    expect(Utils.formatTitleStructured('Histologia Catedra B Clase 1', 'histologia'))
      .toBe('SEM 00-00 - HISTO B - CLASE 1');
  });

  it('vuelca el texto sobrante como DETALLE en mayúsculas cuando no hay estructura', () => {
    expect(Utils.formatTitleStructured('Clase suelta sin fecha ni catedra', 'quimica'))
      .toBe('SEM 00-00 - QUIM - CLASE SUELTA SIN FECHA NI CATEDRA');
  });

  it('limpia signos de puntuación finales del detalle', () => {
    expect(Utils.formatTitleStructured('FISIO C 12-08 Clase 7 Parte A Repaso final!!!', 'fisiologia'))
      .toBe('SEM 08-12 - FISIO C - CLASE 7 - PARTE A - REPASO FINAL');
  });
});
