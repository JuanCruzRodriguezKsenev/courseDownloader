/**
 * Tests de caracterización de sitio/ramonnet/parserTitulos.js (Capa 2).
 * Describen el comportamiento REAL del parser de títulos de Ramón Net, no el deseado:
 * son la red que permite mover/refactorizar la lógica más sensible del proyecto sin
 * cambiarla en silencio. Vinieron de shared/utils.test.js al mudar el parser al
 * adaptador de sitio; se agregó el stub de Utils.quitarAcentos, del que depende.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ParserTitulos from './parserTitulos.js';
import { quitarAcentos } from '../../core/util/texto';

// El parser consume `Utils` como global (así lo carga el entrypoint). Desde la Fase 6a ese
// global lo ensambla la composición, así que acá se arma sólo la parte que el parser usa.
beforeEach(() => { globalThis.Utils = { quitarAcentos }; });
afterEach(() => { delete globalThis.Utils; });

describe('parseSmartDate', () => {
  it('detecta el día cuando el primer número es > 12 (día/mes)', () => {
    expect(ParserTitulos.parseSmartDate('13', '5')).toEqual({ day: '13', month: '05' });
  });

  it('desambigua invirtiendo cuando el segundo número es > 12 (mes/día)', () => {
    expect(ParserTitulos.parseSmartDate('5', '13')).toEqual({ day: '13', month: '05' });
  });

  it('ante ambigüedad (ambos <= 12) asume el orden recibido como día-mes', () => {
    expect(ParserTitulos.parseSmartDate('3', '4')).toEqual({ day: '03', month: '04' });
    expect(ParserTitulos.parseSmartDate('12', '12')).toEqual({ day: '12', month: '12' });
  });

  it('rellena con ceros a la izquierda', () => {
    expect(ParserTitulos.parseSmartDate('1', '9')).toEqual({ day: '01', month: '09' });
  });
});

describe('clasificarCatedraYCarpeta', () => {
  it('prioriza la mención explícita de CÁTEDRA', () => {
    expect(ParserTitulos.clasificarCatedraYCarpeta('Biologia Catedra A Clase 2', 'biologia'))
      .toEqual({ catedra: 'A', carpeta: 'biologia' });
  });

  it('infiere la letra a partir de "MATERIA X" cuando no hay cátedra explícita', () => {
    expect(ParserTitulos.clasificarCatedraYCarpeta('BIOLOGIA A clase 3', 'biologia'))
      .toEqual({ catedra: 'A', carpeta: 'biologia' });
    expect(ParserTitulos.clasificarCatedraYCarpeta('ANATO D repaso', 'anatomia'))
      .toEqual({ catedra: 'D', carpeta: 'anatomia' });
  });

  it('cae en "COMUN" cuando la sigla no matchea la materia base', () => {
    expect(ParserTitulos.clasificarCatedraYCarpeta('XYZ B algo', 'biologia'))
      .toEqual({ catedra: 'COMUN', carpeta: 'biologia' });
  });

  it('cae en "COMUN" cuando no hay ninguna letra de cátedra', () => {
    expect(ParserTitulos.clasificarCatedraYCarpeta('Clase sin nada', 'quimica'))
      .toEqual({ catedra: 'COMUN', carpeta: 'quimica' });
  });

  it('la carpeta siempre es la materia base en minúsculas y sin espacios', () => {
    expect(ParserTitulos.clasificarCatedraYCarpeta('Clase sin nada', '  Quimica  ').carpeta)
      .toBe('quimica');
  });
});

describe('formatTitleStructured', () => {
  it('arma el nombre canónico completo con fecha, cátedra, clase, parte y detalle', () => {
    expect(ParserTitulos.formatTitleStructured('SEM 3-15 Biologia Catedra A Clase 2 Parte 1 Introduccion', 'biologia'))
      .toBe('SEM 03-15 - BIO A - CLASE 2 - PARTE 1 - INTRODUCCION');
  });

  it('resuelve fecha ambigua día/mes con la heurística >12 (05-13 => día 13)', () => {
    expect(ParserTitulos.formatTitleStructured('Anatomia 05-13 CLASE 4 PARTE 2 Sistema Nervioso', 'anatomia'))
      .toBe('SEM 05-13 - ANATO - CLASE 4 - PARTE 2 - SISTEMA NERVIOSO');
  });

  it('usa el prefijo SEM 00-00 cuando no encuentra fecha (forcePrefix)', () => {
    expect(ParserTitulos.formatTitleStructured('Histologia Catedra B Clase 1', 'histologia'))
      .toBe('SEM 00-00 - HISTO B - CLASE 1');
  });

  it('vuelca el texto sobrante como DETALLE en mayúsculas cuando no hay estructura', () => {
    expect(ParserTitulos.formatTitleStructured('Clase suelta sin fecha ni catedra', 'quimica'))
      .toBe('SEM 00-00 - QUIM - CLASE SUELTA SIN FECHA NI CATEDRA');
  });

  it('limpia signos de puntuación finales del detalle', () => {
    expect(ParserTitulos.formatTitleStructured('FISIO C 12-08 Clase 7 Parte A Repaso final!!!', 'fisiologia'))
      .toBe('SEM 08-12 - FISIO C - CLASE 7 - PARTE A - REPASO FINAL');
  });
});
