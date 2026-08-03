/**
 * PUERTO — MENSAJERÍA ENTRE CONTEXTOS (V1.0.0)
 * ==========================================================================
 * Contrato de IPC del núcleo (Capa 1 de ADR-0008), hermano de `almacenamiento.ts`.
 * Es el canal por el que popup y service worker se hablan: hoy `chrome.runtime`, mañana
 * lo que sea. Ver docs/rearquitectura-diseno.md §Fase 5c.
 *
 * POR QUÉ DOS FORMAS DE ENVIAR
 * ----------------------------
 * `chrome.runtime.sendMessage` mezcla dos intenciones bajo una firma: con callback espera
 * respuesta, sin callback es fire-and-forget. Esa ambigüedad ya causó un bug real en este
 * proyecto (el optimistic update que no verificaba la respuesta — ver `docs/TECHNICAL_DEBT.md`
 * §Resuelto). Acá se separan:
 *
 *   - `enviar()`   espera respuesta y **rechaza** si el canal falla (receptor dormido o
 *                  ausente). Quien lo llama tiene que decidir qué hacer con esa falla.
 *   - `notificar()` no espera nada y **nunca rechaza**: un fallo de canal se loguea. Es para
 *                  los avisos donde el emisor no necesita confirmación.
 *
 * Elegir entre las dos es ahora una decisión explícita en cada call-site, no un detalle de
 * si alguien pasó callback o no.
 */

/** Todo mensaje del proyecto se despacha por `action` (ver docs/architecture.md §IPC). */
export interface MensajeIPC {
  action: string;
  [clave: string]: unknown;
}

/** Lo que un manejador recibe para contestar. Llamarlo es opcional. */
export type Responder = (respuesta: unknown) => void;

/**
 * Un manejador devuelve `true` para avisar que va a responder de forma **asíncrona**
 * (misma convención que `chrome.runtime.onMessage`, donde ese `true` mantiene abierto el
 * canal). Devolver `false`/`undefined` significa "ya terminé".
 */
export type ManejadorMensaje = (mensaje: MensajeIPC, responder: Responder) => boolean | void;

export interface PuertoMensajeria {
  /** Envía y espera respuesta. Rechaza si el canal falla. */
  enviar<R = unknown>(mensaje: MensajeIPC): Promise<R>;

  /** Envía sin esperar respuesta. No rechaza nunca. */
  notificar(mensaje: MensajeIPC): void;

  /** Registra un manejador. Devuelve la función para desregistrarlo. */
  onMensaje(cb: ManejadorMensaje): () => void;
}
