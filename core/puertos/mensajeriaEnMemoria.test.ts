/**
 * Tests del adaptador en memoria del PuertoMensajeria.
 *
 * Fija el contrato del puerto, que es lo que después van a asumir los tests del SW: cómo se
 * comporta `enviar` con y sin receptor, la diferencia con `notificar`, y el caso del manejador
 * que promete responder async y no lo hace (el "canal cerrado sin respuesta" de Chrome).
 */
import { describe, it, expect, vi } from 'vitest';
import { MensajeriaEnMemoria } from './mensajeriaEnMemoria';

describe('enviar()', () => {
  it('entrega el mensaje al manejador y resuelve con su respuesta', async () => {
    const m = new MensajeriaEnMemoria();
    m.onMensaje((mensaje, responder) => {
      if (mensaje.action === 'ping') responder({ pong: true });
    });

    await expect(m.enviar({ action: 'ping' })).resolves.toEqual({ pong: true });
  });

  it('rechaza si no hay ningún receptor (el SW dormido)', async () => {
    const m = new MensajeriaEnMemoria();
    await expect(m.enviar({ action: 'ping' })).rejects.toThrow(/Sin receptor/);
  });

  it('soporta respuesta asíncrona cuando el manejador devuelve true', async () => {
    const m = new MensajeriaEnMemoria(50);
    m.onMensaje((_mensaje, responder) => {
      setTimeout(() => responder({ tarde: true }), 5);
      return true; // "voy a contestar después"
    });

    await expect(m.enviar({ action: 'lento' })).resolves.toEqual({ tarde: true });
  });

  it('rechaza si el manejador prometió responder async y nunca lo hizo', async () => {
    const m = new MensajeriaEnMemoria(10);
    m.onMensaje(() => true); // promete y no cumple

    await expect(m.enviar({ action: 'colgado' })).rejects.toThrow(/Sin respuesta/);
  });

  it('resuelve undefined si hay manejador pero nadie contesta ni pide tiempo', async () => {
    const m = new MensajeriaEnMemoria();
    m.onMensaje(() => undefined);

    await expect(m.enviar({ action: 'ignorado' })).resolves.toBeUndefined();
  });
});

describe('notificar()', () => {
  it('llega al manejador y no devuelve nada', () => {
    const m = new MensajeriaEnMemoria();
    const visto = vi.fn();
    m.onMensaje((mensaje) => visto(mensaje.action));

    m.notificar({ action: 'aviso' });

    expect(visto).toHaveBeenCalledWith('aviso');
  });

  it('sin receptor NO explota (a diferencia de enviar)', () => {
    const m = new MensajeriaEnMemoria();
    expect(() => m.notificar({ action: 'al vacío' })).not.toThrow();
    expect(m.accionesEnviadas()).toEqual(['al vacío']);
  });
});

describe('onMensaje()', () => {
  it('la función devuelta desregistra el manejador', async () => {
    const m = new MensajeriaEnMemoria();
    const off = m.onMensaje((_msg, responder) => responder('ok'));
    off();

    await expect(m.enviar({ action: 'ping' })).rejects.toThrow(/Sin receptor/);
  });
});

describe('registro de enviados', () => {
  it('acumula todo lo enviado, en orden, sin importar el modo', () => {
    const m = new MensajeriaEnMemoria();
    m.onMensaje((_msg, responder) => responder(null));

    void m.enviar({ action: 'uno' });
    m.notificar({ action: 'dos' });

    expect(m.accionesEnviadas()).toEqual(['uno', 'dos']);
  });
});
