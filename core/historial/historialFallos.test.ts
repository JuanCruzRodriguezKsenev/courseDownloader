/**
 * Tests del historial de fallos (core/historial/historialFallos.ts): CRUD acotado +
 * suscripción. Fuente de verdad de la campanita del popup y de la notificación del SW.
 *
 * NO mockean `chrome.*`: el módulo recibe un `PuertoAlmacenamiento` por inyección y acá
 * se le pasa `AlmacenamientoEnMemoria`. Ese es el punto del diseño de puertos — antes
 * este archivo tenía que fabricar a mano un doble de chrome.storage con su bucket, sus
 * listeners y su emisor de eventos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crearHistorialFallos } from './historialFallos.ts';
import type { HistorialFallos as TipoHistorial } from './historialFallos.ts';
import { AlmacenamientoEnMemoria } from '../puertos/almacenamientoEnMemoria.ts';

let almacenamiento: AlmacenamientoEnMemoria;
let HistorialFallos: TipoHistorial;

beforeEach(() => {
  almacenamiento = new AlmacenamientoEnMemoria();
  HistorialFallos = crearHistorialFallos(almacenamiento);
});

describe('registrar()', () => {
  it('sobre storage vacío crea una entrada con la forma correcta', async () => {
    const entrada = await HistorialFallos.registrar('rechazo', 'Clase 1', 'motivo x');
    expect(entrada).toMatchObject({
      tipo: 'rechazo', titulo: 'Clase 1', motivo: 'motivo x', leido: false
    });
    expect(typeof entrada.id).toBe('string');
    expect(typeof entrada.ts).toBe('number');

    const lista = await HistorialFallos.obtener();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toEqual(entrada);
  });

  it('llamadas repetidas anteponen (más reciente primero)', async () => {
    await HistorialFallos.registrar('sesion', 'A', 'm');
    await HistorialFallos.registrar('servidor', 'B', 'm');
    await HistorialFallos.registrar('internet', 'C', 'm');
    const lista = await HistorialFallos.obtener();
    expect(lista.map(f => f.titulo)).toEqual(['C', 'B', 'A']);
  });

  it('acota la lista a LIMITE (50) conservando los más recientes', async () => {
    for (let i = 0; i < 55; i++) {
      await HistorialFallos.registrar('rechazo', `Clase ${i}`, 'm');
    }
    const lista = await HistorialFallos.obtener();
    expect(lista).toHaveLength(50);
    // El más reciente es Clase 54; el más viejo conservado es Clase 5 (0-4 caen).
    expect(lista[0]?.titulo).toBe('Clase 54');
    expect(lista[49]?.titulo).toBe('Clase 5');
  });

  it('titulo/motivo ausentes se normalizan a ""', async () => {
    const entrada = await HistorialFallos.registrar('internet');
    expect(entrada.titulo).toBe('');
    expect(entrada.motivo).toBe('');
  });
});

describe('obtener()', () => {
  it('sobre clave no seteada devuelve [] (no undefined)', async () => {
    const lista = await HistorialFallos.obtener();
    expect(lista).toEqual([]);
  });
});

describe('marcarTodosLeidos()', () => {
  it('pone leido:true en todas en una sola escritura, sin alterar orden ni cantidad', async () => {
    await HistorialFallos.registrar('sesion', 'A', 'm');
    await HistorialFallos.registrar('servidor', 'B', 'm');
    const espia = vi.spyOn(almacenamiento, 'guardarLocal');

    await HistorialFallos.marcarTodosLeidos();

    expect(espia).toHaveBeenCalledTimes(1); // una sola escritura, no una por entrada
    const lista = await HistorialFallos.obtener();
    expect(lista.every(f => f.leido)).toBe(true);
    expect(lista.map(f => f.titulo)).toEqual(['B', 'A']);
  });
});

describe('limpiar()', () => {
  it('vacía la lista', async () => {
    await HistorialFallos.registrar('rechazo', 'A', 'm');
    await HistorialFallos.limpiar();
    expect(await HistorialFallos.obtener()).toEqual([]);
  });
});

describe('contarNoLeidos()', () => {
  it('cuenta sólo las no leídas', async () => {
    await HistorialFallos.registrar('rechazo', 'A', 'm');
    await HistorialFallos.registrar('sesion', 'B', 'm');
    await HistorialFallos.marcarTodosLeidos();
    await HistorialFallos.registrar('internet', 'C', 'm'); // nueva, no leída
    expect(await HistorialFallos.contarNoLeidos()).toBe(1);
  });
});

describe('suscribir()', () => {
  it('notifica ante un cambio en la clave con ámbito local', async () => {
    const cb = vi.fn();
    HistorialFallos.suscribir(cb);
    await almacenamiento.guardarLocal({ historialFallos: [] });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('NO notifica ante otra clave ni ante otro ámbito', async () => {
    const cb = vi.fn();
    HistorialFallos.suscribir(cb);
    await almacenamiento.guardarLocal({ otraClave: 1 });
    await almacenamiento.guardarSesion({ historialFallos: [] });
    expect(cb).not.toHaveBeenCalled();
  });

  it('la función devuelta desuscribe', async () => {
    const cb = vi.fn();
    const off = HistorialFallos.suscribir(cb);
    off();
    await almacenamiento.guardarLocal({ historialFallos: [] });
    expect(cb).not.toHaveBeenCalled();
  });
});
