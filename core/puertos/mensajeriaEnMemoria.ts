/**
 * ADAPTADOR EN MEMORIA DEL PUERTO DE MENSAJERÍA (V1.0.0)
 * ==========================================================================
 * Implementa `PuertoMensajeria` enrutando los mensajes a los manejadores registrados en la
 * misma instancia. Es el equivalente de `AlmacenamientoEnMemoria` para el IPC: permite
 * testear una conversación popup↔SW completa sin `chrome.*` ni navegador.
 *
 * Modela los dos modos de fallo que importan y que en `chrome.runtime` son fáciles de pasar
 * por alto:
 *   - **Sin receptor**: nadie registró manejador → `enviar()` rechaza (es el equivalente del
 *     `lastError` "Could not establish connection"), y `notificar()` sólo loguea.
 *   - **Manejador que no contesta**: devolvió `true` (respondería async) y nunca llamó a
 *     `responder` → `enviar()` rechaza al agotarse el timeout, que es lo que en el navegador
 *     aparece como canal cerrado sin respuesta.
 *
 * Con eso, los tests pueden reproducir "el SW está dormido" sin trucos.
 */
import type { MensajeIPC, ManejadorMensaje, PuertoMensajeria, Responder } from "./mensajeria";

export class MensajeriaEnMemoria implements PuertoMensajeria {
  private manejadores = new Set<ManejadorMensaje>();
  /** Todo lo saliente, en orden: los tests afirman sobre esto en vez de espiar un mock. */
  readonly enviados: MensajeIPC[] = [];
  /**
   * Sólo lo que salió por `notificar()`. Es un subconjunto de `enviados`, y existe porque
   * distinguir las dos intenciones es justamente para lo que está el puerto: un test que
   * quiera afirmar "el SW avisó X" no debería ver también los mensajes que el propio test
   * mandó para invocarlo.
   */
  readonly notificados: MensajeIPC[] = [];

  constructor(private timeoutMs = 0) {}

  async enviar<R = unknown>(mensaje: MensajeIPC): Promise<R> {
    this.enviados.push(mensaje);
    if (this.manejadores.size === 0) {
      throw new Error(`[MensajeriaEnMemoria] Sin receptor para "${mensaje.action}"`);
    }

    return new Promise<R>((resolve, reject) => {
      let contestado = false;
      let esperaAsincrona = false;

      const responder: Responder = (respuesta) => {
        if (contestado) return;
        contestado = true;
        resolve(respuesta as R);
      };

      for (const cb of this.manejadores) {
        if (cb(mensaje, responder) === true) esperaAsincrona = true;
        if (contestado) return;
      }

      // Nadie contestó en el acto. Si ninguno pidió tiempo, no va a haber respuesta.
      if (!esperaAsincrona) {
        resolve(undefined as R);
        return;
      }
      setTimeout(() => {
        if (!contestado) {
          reject(new Error(`[MensajeriaEnMemoria] Sin respuesta para "${mensaje.action}"`));
        }
      }, this.timeoutMs);
    });
  }

  notificar(mensaje: MensajeIPC): void {
    this.enviados.push(mensaje);
    this.notificados.push(mensaje);
    if (this.manejadores.size === 0) return; // fire-and-forget: nadie escucha, no pasa nada
    const noOp: Responder = () => {};
    this.manejadores.forEach((cb) => cb(mensaje, noOp));
  }

  onMensaje(cb: ManejadorMensaje): () => void {
    this.manejadores.add(cb);
    return () => this.manejadores.delete(cb);
  }

  /** Ayuda de tests: ¿qué acciones se enviaron, en orden? */
  accionesEnviadas(): string[] {
    return this.enviados.map((m) => m.action);
  }

  /** Ayuda de tests: ¿qué acciones se **notificaron**, en orden? */
  accionesNotificadas(): string[] {
    return this.notificados.map((m) => m.action);
  }

  /**
   * Vacía el registro sin desregistrar manejadores. Para suites donde la instancia tiene que
   * sobrevivir entre tests porque el código bajo prueba enganchó su oyente una sola vez al
   * cargarse (es el caso del service worker).
   */
  limpiarRegistro(): void {
    this.enviados.length = 0;
    this.notificados.length = 0;
  }
}
