/**
 * Tests del historial de fallos (shared/historialFallos.js): CRUD acotado sobre
 * chrome.storage.local + suscripción vía storage.onChanged. Fuente de verdad de
 * la campanita del popup y de la notificación nativa del SW.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HistorialFallos from './historialFallos.js';

// Mock de chrome.storage.local (get/set) + onChanged, con store en memoria.
function mockChrome() {
  const bucket = {};
  const listeners = [];
  return {
    _bucket: bucket,
    _emitir(cambios, area) { listeners.forEach(l => l(cambios, area)); },
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const k = Array.isArray(keys) ? keys[0] : keys;
          return (k in bucket) ? { [k]: bucket[k] } : {};
        }),
        set: vi.fn(async (obj) => { Object.assign(bucket, obj); })
      },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    }
  };
}

beforeEach(() => {
  // Resetear el singleton entre tests.
  HistorialFallos._subs = new Set();
  HistorialFallos._oyenteEnganchado = false;
  globalThis.chrome = mockChrome();
});

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(lista[0].titulo).toBe('Clase 54');
    expect(lista[49].titulo).toBe('Clase 5');
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
    globalThis.chrome.storage.local.set.mockClear();

    await HistorialFallos.marcarTodosLeidos();

    expect(globalThis.chrome.storage.local.set).toHaveBeenCalledTimes(1);
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
  it('notifica ante un cambio en la clave con area="local"', () => {
    const cb = vi.fn();
    HistorialFallos.suscribir(cb);
    globalThis.chrome._emitir({ historialFallos: { newValue: [] } }, 'local');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('NO notifica ante otra clave o area distinta de "local"', () => {
    const cb = vi.fn();
    HistorialFallos.suscribir(cb);
    globalThis.chrome._emitir({ otraClave: { newValue: 1 } }, 'local');
    globalThis.chrome._emitir({ historialFallos: { newValue: [] } }, 'session');
    expect(cb).not.toHaveBeenCalled();
  });

  it('la función devuelta desuscribe', () => {
    const cb = vi.fn();
    const off = HistorialFallos.suscribir(cb);
    off();
    globalThis.chrome._emitir({ historialFallos: { newValue: [] } }, 'local');
    expect(cb).not.toHaveBeenCalled();
  });
});
