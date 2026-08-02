/**
 * Tests del adaptador en memoria del puerto de almacenamiento.
 *
 * Se testea el DOBLE, no sólo lo que lo usa: de acá en adelante toda la cobertura del
 * núcleo se apoya en él, así que si miente (no aísla los ámbitos, no emite cambios, no
 * respeta la forma de `chrome.storage.onChanged`) los tests que lo usen mentirían con
 * él sin que nada lo delate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlmacenamientoEnMemoria } from './almacenamientoEnMemoria.ts';

let a: AlmacenamientoEnMemoria;

beforeEach(() => {
  a = new AlmacenamientoEnMemoria();
});

describe('lectura y escritura', () => {
  it('devuelve sólo las claves pedidas y omite las ausentes', async () => {
    await a.guardarLocal({ uno: 1, dos: 2 });
    expect(await a.obtenerLocal(['uno'])).toEqual({ uno: 1 });
    expect(await a.obtenerLocal(['uno', 'noExiste'])).toEqual({ uno: 1 });
  });

  it('una clave nunca escrita devuelve {} (no undefined)', async () => {
    expect(await a.obtenerLocal(['nada'])).toEqual({});
  });

  it('guardar es multi-clave y pisa el valor anterior', async () => {
    await a.guardarLocal({ x: 1, y: 2 });
    await a.guardarLocal({ x: 99 });
    expect(await a.obtenerLocal(['x', 'y'])).toEqual({ x: 99, y: 2 });
  });

  it('borrar quita la clave', async () => {
    await a.guardarLocal({ x: 1 });
    await a.borrarLocal(['x']);
    expect(await a.obtenerLocal(['x'])).toEqual({});
  });
});

describe('aislamiento entre ámbitos', () => {
  it('local y sesión no se pisan aunque compartan el nombre de la clave', async () => {
    await a.guardarLocal({ misma: 'de-local' });
    await a.guardarSesion({ misma: 'de-sesion' });

    expect(await a.obtenerLocal(['misma'])).toEqual({ misma: 'de-local' });
    expect(await a.obtenerSesion(['misma'])).toEqual({ misma: 'de-sesion' });
  });
});

describe('onCambio', () => {
  it('notifica con el ámbito y con oldValue/newValue, como chrome.storage.onChanged', async () => {
    const cb = vi.fn();
    a.onCambio(cb);

    await a.guardarLocal({ k: 'v1' });
    await a.guardarLocal({ k: 'v2' });

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, { k: { oldValue: undefined, newValue: 'v1' } }, 'local');
    expect(cb).toHaveBeenNthCalledWith(2, { k: { oldValue: 'v1', newValue: 'v2' } }, 'local');
  });

  it('distingue el ámbito de sesión', async () => {
    const cb = vi.fn();
    a.onCambio(cb);
    await a.guardarSesion({ k: 1 });
    expect(cb).toHaveBeenCalledWith(expect.anything(), 'session');
  });

  it('borrar emite newValue undefined, y no emite nada si la clave no estaba', async () => {
    const cb = vi.fn();
    await a.guardarLocal({ k: 1 });
    a.onCambio(cb);

    await a.borrarLocal(['k']);
    expect(cb).toHaveBeenCalledWith({ k: { oldValue: 1, newValue: undefined } }, 'local');

    cb.mockClear();
    await a.borrarLocal(['inexistente']);
    expect(cb).not.toHaveBeenCalled();
  });

  it('la función devuelta desuscribe', async () => {
    const cb = vi.fn();
    const off = a.onCambio(cb);
    off();
    await a.guardarLocal({ k: 1 });
    expect(cb).not.toHaveBeenCalled();
  });

  it('un suscriptor que lanza no frena a los demás', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const malo = vi.fn(() => { throw new Error('boom'); });
    const bueno = vi.fn();
    a.onCambio(malo);
    a.onCambio(bueno);

    await a.guardarLocal({ k: 1 });

    expect(malo).toHaveBeenCalled();
    expect(bueno).toHaveBeenCalled();
  });
});
