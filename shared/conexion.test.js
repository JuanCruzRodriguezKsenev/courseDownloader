// @vitest-environment jsdom
/**
 * Tests del daemon de conexión (shared/conexion.js): fuente única de verdad del
 * estado de conexión, modelo push (get/suscribir), espejado cross-contexto.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Conexion from './conexion.js';

// Mock de chrome.storage (session + onChanged).
function mockChrome() {
  const listeners = [];
  return {
    _emitir(cambios, area) { listeners.forEach(l => l(cambios, area)); },
    storage: {
      session: { set: vi.fn() },
      onChanged: { addListener: (fn) => listeners.push(fn) }
    }
  };
}

beforeEach(() => {
  // Resetear el singleton entre tests.
  Conexion.detener();
  Conexion._estado = { servidor: false, internet: false, listo: false };
  Conexion._subs = new Set();
  Conexion._oyentesRed = null;
  globalThis.chrome = mockChrome();
  // navigator.onLine por defecto true en jsdom; fetch mockeado OK salvo que el test lo cambie.
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  globalThis.BunClient = { obtenerRutaServidor: vi.fn().mockResolvedValue('C:/RamonNet') };
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});

afterEach(() => {
  Conexion.detener();
  vi.restoreAllMocks();
});

describe('get() — estado derivado', () => {
  it('completa=true y tipoFalla=null cuando servidor e internet están OK', () => {
    Conexion._estado = { servidor: true, internet: true, listo: true };
    expect(Conexion.get()).toMatchObject({ completa: true, tipoFalla: null });
  });

  it('tipoFalla="servidor" tiene prioridad cuando el servidor está caído', () => {
    Conexion._estado = { servidor: false, internet: false, listo: true };
    expect(Conexion.get().tipoFalla).toBe('servidor');
  });

  it('tipoFalla="internet" cuando sólo falta internet', () => {
    Conexion._estado = { servidor: true, internet: false, listo: true };
    expect(Conexion.get().tipoFalla).toBe('internet');
  });

  it('listo=false hasta el primer sondeo', () => {
    expect(Conexion.get().listo).toBe(false);
  });
});

describe('verificarAhora()', () => {
  it('actualiza el estado desde los primitivos de chequeo', async () => {
    await Conexion.verificarAhora();
    expect(Conexion.get()).toMatchObject({ servidor: true, internet: true, listo: true });
  });

  it('marca servidor=false si BunClient falla', async () => {
    globalThis.BunClient.obtenerRutaServidor.mockRejectedValue(new Error('down'));
    await Conexion.verificarAhora();
    expect(Conexion.hayServidor()).toBe(false);
    expect(Conexion.get().tipoFalla).toBe('servidor');
  });

  it('no le pega a la red si navigator.onLine es false (short-circuit)', async () => {
    navigator.onLine.mockReturnValue?.(false); // por si acaso
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await Conexion.verificarAhora();
    expect(Conexion.hayInternet()).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('marca internet=false si el HEAD falla aunque navigator diga online', async () => {
    globalThis.fetch.mockRejectedValue(new Error('timeout'));
    await Conexion.verificarAhora();
    expect(Conexion.hayInternet()).toBe(false);
  });

  it('espeja el estado en chrome.storage.session', async () => {
    await Conexion.verificarAhora();
    expect(globalThis.chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({ estadoConexion: expect.objectContaining({ servidor: true, internet: true }) })
    );
  });
});

describe('suscribir() — push', () => {
  it('notifica al suscriptor cuando el estado cambia', async () => {
    const cb = vi.fn();
    Conexion.suscribir(cb);
    await Conexion.verificarAhora();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ servidor: true, internet: true }));
  });

  it('NO notifica si el estado no cambió entre dos verificaciones', async () => {
    await Conexion.verificarAhora(); // primer cambio
    const cb = vi.fn();
    Conexion.suscribir(cb);
    await Conexion.verificarAhora(); // mismo estado
    expect(cb).not.toHaveBeenCalled();
  });

  it('la función devuelta desuscribe', async () => {
    const cb = vi.fn();
    const off = Conexion.suscribir(cb);
    off();
    await Conexion.verificarAhora();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('espejado cross-contexto', () => {
  it('un cambio en storage (de otro contexto) actualiza el estado sin re-escribir', async () => {
    Conexion.iniciar({ intervaloMs: 999999 }); // engancha el listener de storage
    globalThis.chrome.storage.session.set.mockClear();
    const cb = vi.fn();
    Conexion.suscribir(cb);

    // Simular que el SW escribió un estado nuevo.
    globalThis.chrome._emitir(
      { estadoConexion: { newValue: { servidor: false, internet: true } } },
      'session'
    );

    expect(Conexion.hayServidor()).toBe(false);
    expect(cb).toHaveBeenCalled();
    // No debe re-espejar (evita loop entre contextos).
    expect(globalThis.chrome.storage.session.set).not.toHaveBeenCalled();
  });
});

describe('iniciar()/detener()', () => {
  it('iniciar hace un chequeo inmediato y arranca el intervalo; detener lo frena', async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setInterval');
    Conexion.iniciar({ intervaloMs: 3000 });
    expect(spy).toHaveBeenCalledTimes(1);
    Conexion.detener();
    expect(Conexion._timer).toBeNull();
    vi.useRealTimers();
  });
});
