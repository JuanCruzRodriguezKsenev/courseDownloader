/**
 * Tests del parser de títulos de Anatomy by Chris (Capa 2).
 *
 * Los títulos crudos de acá son los MEDIDOS en el portal, no inventados: espacios al final,
 * espacios múltiples con la duración pegada, acentos es/pt y los casi homónimos que no hay que
 * colapsar.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ParserTitulosAnatomy from './parserTitulos.js';
import { sanitizarTexto, quitarAcentos } from '../../core/util/texto';

// El parser consume `Utils` como global (así lo carga el entrypoint) y usa la función REAL:
// `sanitizarTexto` tiene su lista de caracteres sincronizada con el backend Bun, así que
// stubearla acá probaría otra cosa que la que corre. `quitarAcentos` se siembra igual aunque
// este parser NO la use, para que el test falle si algún día vuelve a leerla — es justamente
// la que no alcanza para el portugués (ver la cabecera del parser).
beforeEach(() => { globalThis.Utils = { sanitizarTexto, quitarAcentos }; });
afterEach(() => { delete globalThis.Utils; });

describe('formatearTitulo', () => {
  it('recorta el espacio final que traen los títulos del portal', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Miologia 6 ')).toBe('Miologia 6');
  });

  it('colapsa los espacios múltiples y saca la duración pegada al final', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Artrologia Movimietos MS   02:55')).toBe(
      'Artrologia Movimietos MS'
    );
  });

  it('saca también la duración con horas', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Intensivo Torax 01:12:32')).toBe(
      'Intensivo Torax'
    );
  });

  it('NO saca un número que no es una duración', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Miologia 6')).toBe('Miologia 6');
    expect(ParserTitulosAnatomy.formatearTitulo('Osteologia 2 3')).toBe('Osteologia 2 3');
  });

  it('quita los acentos, en español y en portugués', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Irrigación')).toBe('Irrigacion');
    // El caso que rompía con `Utils.quitarAcentos`: su tabla estática no tiene `ç` ni `ã`, así
    // que los saneaba a `_` y el archivo quedaba "Articula__o do ombro".
    expect(ParserTitulosAnatomy.formatearTitulo('Articulação do ombro')).toBe(
      'Articulacao do ombro'
    );
    expect(ParserTitulosAnatomy.formatearTitulo('Tórax e Câmara')).toBe('Torax e Camara');
  });

  it('la ñ pasa a n, y es una decisión: este portal quiere nombres ASCII parejos', () => {
    // Ramón Net conserva la ñ (su tabla no la toca y el backend la permite en su lista
    // blanca). Acá el criterio es otro porque el portal mezcla dos idiomas.
    expect(ParserTitulosAnatomy.formatearTitulo('Clase del año')).toBe('Clase del ano');
  });

  it('⚠️ NO colapsa los casi homónimos: son clases distintas', () => {
    // Si estas dos dieran el mismo nombre, la identidad (portal, título) las trataría como la
    // misma clase y una de las dos desaparecería de la cola sin descargarse.
    const a = ParserTitulosAnatomy.formatearTitulo('Irrigación 1');
    const b = ParserTitulosAnatomy.formatearTitulo('Irrigación');
    expect(a).not.toBe(b);
  });

  it('sanea los caracteres que romperían la escritura a disco', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Anatomia: cabeza / cuello')).not.toMatch(/[:/]/);
  });

  it('un título vacío no produce un archivo sin nombre', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('')).toBe('video_sin_nombre');
    expect(ParserTitulosAnatomy.formatearTitulo('   ')).toBe('video_sin_nombre');
    expect(ParserTitulosAnatomy.formatearTitulo(undefined)).toBe('video_sin_nombre');
  });

  it('NO prefija la materia: en este portal ya es la carpeta', () => {
    expect(ParserTitulosAnatomy.formatearTitulo('Miologia 6', 'miembro_superior')).toBe(
      'Miologia 6'
    );
  });
});

describe('clasificarCarpeta', () => {
  it('la carpeta es la materia (el módulo) en minúsculas', () => {
    expect(ParserTitulosAnatomy.clasificarCarpeta('Miologia 6', 'Miembro_Superior')).toEqual({
      catedra: 'COMUN',
      carpeta: 'miembro_superior',
    });
  });

  it('la cátedra es SIEMPRE el valorComun: la faceta de este portal es inerte', () => {
    expect(ParserTitulosAnatomy.clasificarCarpeta('lo que sea', 'x').catedra).toBe('COMUN');
    expect(ParserTitulosAnatomy.clasificarCarpeta('CATEDRA B', 'x').catedra).toBe('COMUN');
  });

  it('sin materia cae a una carpeta con nombre, no a una vacía', () => {
    expect(ParserTitulosAnatomy.clasificarCarpeta('Miologia 6', '').carpeta).toBe('anatomy');
    expect(ParserTitulosAnatomy.clasificarCarpeta('Miologia 6').carpeta).toBe('anatomy');
  });
});
