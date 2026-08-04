/**
 * ADAPTADOR CHROME — MENSAJERÍA (V1.0.0)
 * ==========================================================================
 * Implementa `PuertoMensajeria` sobre `chrome.runtime`. Capa 3 de ADR-0008.
 *
 * Se usa la forma con **callback** y no la que devuelve promesa, a propósito: la de callback
 * es la que expone `chrome.runtime.lastError`, que es como el navegador reporta "no hay
 * receptor" / "el canal se cerró sin responder". Sin leer ese campo dentro del callback, el
 * error queda registrado como no manejado en la consola del popup. Acá se lo lee siempre y se
 * lo convierte en un rechazo (`enviar`) o en un `console.warn` (`notificar`).
 *
 * Las guardas de disponibilidad siguen el mismo criterio que el adaptador de almacenamiento:
 * en un contexto sin la API, degradar en vez de romper.
 */
import type { MensajeIPC, ManejadorMensaje, PuertoMensajeria } from "../../core/puertos/mensajeria";

function hayRuntime(): boolean {
  return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.sendMessage;
}

/**
 * Chrome reporta DOS condiciones distintas por `lastError` en un envío, y confundirlas fue un
 * bug real de este archivo (se descubrió leyendo la consola del SW tras una descarga):
 *
 *   - **"The message port closed before a response was received"** — hubo receptor, recibió el
 *     mensaje y no contestó. Para un `notificar()` eso **no es un fallo: es la definición de
 *     fire-and-forget**. Loguearlo es reportar que la operación hizo exactamente lo suyo.
 *   - **"Could not establish connection"** — no había nadie escuchando. En esta extensión
 *     también es normal: el service worker avisa progreso con el popup cerrado casi siempre.
 *
 * O sea que **ninguna de las dos merece un warning en `notificar()`**. El callback existe por
 * otra razón: leer `lastError` es lo que evita que Chrome lo reporte como error no manejado.
 * Se deja una traza en `debug` (oculta salvo que se active "Verbose") para no perder el rastro
 * de un mensaje que nadie escucha nunca, que es el único bug que esto podría revelar.
 */
const accionesYaTrazadas = new Set<string>();

function trazarEnvioSinRespuesta(accion: string, detalle?: string): void {
  if (accionesYaTrazadas.has(accion)) return;
  accionesYaTrazadas.add(accion);
  console.debug(`[Mensajeria] "${accion}" no obtuvo respuesta (esperable en notificar):`, detalle);
}

export const MensajeriaChrome: PuertoMensajeria = {
  enviar<R = unknown>(mensaje: MensajeIPC): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      if (!hayRuntime()) {
        reject(new Error("[Mensajeria] chrome.runtime no disponible en este contexto"));
        return;
      }
      chrome.runtime.sendMessage(mensaje, (respuesta: unknown) => {
        // Leer lastError DENTRO del callback es obligatorio: si no, Chrome lo reporta
        // como error no manejado.
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message || "canal IPC cerrado sin respuesta"));
          return;
        }
        resolve(respuesta as R);
      });
    });
  },

  notificar(mensaje: MensajeIPC): void {
    if (!hayRuntime()) return;
    // Se pasa callback igual (aunque no se use la respuesta) para poder consumir lastError:
    // sin él, un envío sin receptor ensucia la consola con un rechazo no manejado.
    chrome.runtime.sendMessage(mensaje, () => {
      const error = chrome.runtime.lastError;
      if (error) trazarEnvioSinRespuesta(mensaje.action, error.message);
    });
  },

  onMensaje(cb: ManejadorMensaje): () => void {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return () => {};
    const oyente = (
      mensaje: unknown,
      _emisor: chrome.runtime.MessageSender,
      responder: (r?: unknown) => void
    ): boolean | undefined => {
      const r = cb(mensaje as MensajeIPC, responder);
      // `true` mantiene abierto el canal para una respuesta asíncrona.
      return r === true ? true : undefined;
    };
    chrome.runtime.onMessage.addListener(oyente);
    return () => chrome.runtime.onMessage.removeListener(oyente);
  },
};

// Exportación (ver docs/coding-standards.md).
export default MensajeriaChrome;
