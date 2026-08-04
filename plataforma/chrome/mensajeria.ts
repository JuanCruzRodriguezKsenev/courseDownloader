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
 * "No hay receptor" es el estado NORMAL de esta extensión, no una anomalía: el service worker
 * avisa progreso mientras el popup está cerrado la mayor parte del tiempo. Loguear cada vez
 * convertiría una descarga en cientos de warnings —`update_progress_bar` sale por fragmento— y
 * taparía lo que sí importa en la consola del SW. Se avisa **una vez por acción** y por vida
 * del contexto: alcanza para descubrir un mensaje que nadie escucha nunca, que es el bug que
 * este log existe para revelar, sin convertirse en ruido de fondo.
 */
const accionesYaAvisadas = new Set<string>();

function avisarSinReceptorUnaVez(accion: string, detalle?: string): void {
  if (accionesYaAvisadas.has(accion)) return;
  accionesYaAvisadas.add(accion);
  console.warn(`[Mensajeria] "${accion}" sin receptor (no se repite este aviso):`, detalle);
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
      if (error) avisarSinReceptorUnaVez(mensaje.action, error.message);
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
(globalThis as Record<string, unknown>).MensajeriaChrome = MensajeriaChrome;
export default MensajeriaChrome;
