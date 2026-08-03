// @vitest-environment jsdom
/**
 * Tests del daemon de conexión (shared/conexion.ts): fuente única de verdad del
 * estado de conexión, modelo push (get/suscribir), espejado cross-contexto.
 *
 * Desde la Fase 5b ya no hay mock de `chrome.*` a mano: el daemon recibe un
 * `PuertoAlmacenamiento` y los tests le pasan `AlmacenamientoEnMemoria`, que además emite
 * `onCambio` en cada escritura — con eso el espejado popup↔SW se ejercita de verdad, con
 * dos instancias reales contra el mismo storage, en vez de simular el evento a mano.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearConexion, CLAVE_STORAGE } from './conexion';
import { AlmacenamientoEnMemoria } from '../core/puertos/almacenamientoEnMemoria';
import BunClient from '../core/backend/bunClient';

let almacenamiento: AlmacenamientoEnMemoria;
let Conexion: ReturnType<typeof crearConexion>;

beforeEach(() => {
  almacenamiento = new AlmacenamientoEnMemoria();
  Conexion = crearConexion(almacenamiento);
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
  vi.spyOn(BunClient, 'obtenerRutaServidor').mockResolvedValue('C:/RamonNet');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  Conexion.detener();
  vi.restoreAllMocks();
});

describe('get() — estado derivado', () => {
  it('completa=true y tipoFalla=null cuando servidor e internet están OK', () => {
    Conexion._sembrarEstado({ servidor: true, internet: true, listo: true });
    expect(Conexion.get()).toMatchObject({ completa: true, tipoFalla: null });
  });

  it('tipoFalla="servidor" tiene prioridad cuando el servidor está caído', () => {
    Conexion._sembrarEstado({ servidor: false, internet: false, listo: true });
    expect(Conexion.get().tipoFalla).toBe('servidor');
  });

  it('tipoFalla="internet" cuando sólo falta internet', () => {
    Conexion._sembrarEstado({ servidor: true, internet: false, listo: true });
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
    vi.spyOn(BunClient, 'obtenerRutaServidor').mockRejectedValue(new Error('down'));
    await Conexion.verificarAhora();
    expect(Conexion.hayServidor()).toBe(false);
    expect(Conexion.get().tipoFalla).toBe('servidor');
  });

  it('no le pega a la red si navigator.onLine es false (short-circuit)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await Conexion.verificarAhora();
    expect(Conexion.hayInternet()).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('marca internet=false si el HEAD falla aunque navigator diga online', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
    await Conexion.verificarAhora();
    expect(Conexion.hayInternet()).toBe(false);
  });

  it('espeja el estado en el ámbito de sesión del puerto', async () => {
    await Conexion.verificarAhora();
    const { sesion } = almacenamiento._volcar();
    expect(sesion[CLAVE_STORAGE]).toMatchObject({ servidor: true, internet: true });
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
  it('lo que escribe un contexto lo adopta el otro, sin re-escribir (anti-loop)', async () => {
    // Dos daemons sobre el MISMO storage = popup y SW.
    const otroContexto = crearConexion(almacenamiento);
    otroContexto._escucharStorage();
    const cb = vi.fn();
    otroContexto.suscribir(cb);

    // El primero sondea y espeja; el segundo debería adoptarlo por onCambio.
    await Conexion.verificarAhora();

    expect(otroContexto.hayServidor()).toBe(true);
    expect(otroContexto.hayInternet()).toBe(true);
    expect(cb).toHaveBeenCalled();
    otroContexto.detener();
  });

  it('adoptar un estado espejado NO dispara otra escritura', async () => {
    const otroContexto = crearConexion(almacenamiento);
    otroContexto._escucharStorage();
    const spyGuardar = vi.spyOn(almacenamiento, 'guardarSesion');

    // Simular que el otro contexto escribió un estado nuevo.
    await almacenamiento.guardarSesion({
      [CLAVE_STORAGE]: { servidor: false, internet: true, ts: Date.now() },
    });

    expect(otroContexto.hayServidor()).toBe(false);
    expect(otroContexto.hayInternet()).toBe(true);
    // La única escritura es la que hizo el test; el daemon no re-espejó.
    expect(spyGuardar).toHaveBeenCalledTimes(1);
    otroContexto.detener();
  });

  it('detener() desengancha el oyente de storage', async () => {
    Conexion._escucharStorage();
    Conexion.detener();

    await almacenamiento.guardarSesion({
      [CLAVE_STORAGE]: { servidor: true, internet: true, ts: Date.now() },
    });

    expect(Conexion.hayServidor()).toBe(false);
  });
});

describe('iniciar()/detener()', () => {
  it('iniciar hace un chequeo inmediato y arranca el intervalo; detener lo frena', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setInterval');
    Conexion.iniciar({ intervaloMs: 3000 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(Conexion._tieneTimer).toBe(true);
    Conexion.detener();
    expect(Conexion._tieneTimer).toBe(false);
    vi.useRealTimers();
  });
});
