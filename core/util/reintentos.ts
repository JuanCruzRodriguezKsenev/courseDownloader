/**
 * FETCH CON REINTENTOS Y BACKOFF (V2.0.0)
 * ==========================================================================
 * Capa 1. Salió de `shared/utils.js` en la Fase 6a.
 *
 * CHANGELOG v2.0.0:
 * - [CAPA 1] De función suelta a **factory**: el daemon de conexión entra por inyección en
 *   vez de leerse del global `Conexion`. Era la última dependencia ambiente del módulo, y la
 *   misma que le impedía a este archivo —y por arrastre al motor HLS— vivir en `core/`.
 *   Sin cambios de lógica: los cuatro cortes (abort del usuario, `onLine===false`, veredicto
 *   del daemon, límite de reintentos) se comportan igual.
 *
 * QUÉ RESUELVE, Y POR QUÉ TIENE TANTAS SALIDAS
 * --------------------------------------------
 * Tolerar micro-cortes sin abortar la descarga, pero **sin quemar 15s de backoff cuando la
 * caída es real**. Las cuatro salidas, en el orden en que se evalúan, y cada una existe por
 * un caso concreto que se vio en producción:
 *
 *   1. **Abort del usuario/hermano** → propaga el `AbortError` tal cual. Cancelar es
 *      cancelar; no se reintenta ni se reescribe el error.
 *   2. **`navigator.onLine === false`** → corta ya. Sólo se usa la forma NEGATIVA, que es la
 *      confiable: un `true` de `onLine` no prueba nada (ver punto 3).
 *   3. **El daemon confirma internet caída** → corta. Existe porque en Windows `onLine` se
 *      queda en `true` ante un corte AGUAS ARRIBA (WAN caída con la placa local "conectada"),
 *      y ese caso pasaba de ~16s a ~4-5s al preguntarle al daemon, que hace un HEAD real.
 *      Si el daemon dice que hay internet, se sigue reintentando: eso es el micro-corte.
 *   4. **Límite de reintentos** → propaga el último error.
 *
 * Y un backstop por intento (10s): un socket colgado que nunca rechaza dejaría este fetch
 * esperando para siempre y ninguna de las salidas de arriba llegaría a correr. Son 10s y no
 * menos para no matar un fetch lento-pero-vivo antes de que el daemon alcance a votar.
 */

/** Lo único que este módulo necesita del daemon. Ver `core/conexion/conexion.ts`. */
export interface SondaDeConexion {
  verificarAhora(): Promise<{ internet: boolean }>;
}

/** > TIMEOUT_HEAD_MS del daemon (4s), para no cortar antes de que alcance a opinar. */
const TIMEOUT_INTENTO_MS = 10000;

export function crearFetchConReintentos(conexion?: SondaDeConexion) {
  return async function fetchConReintentos(
    url: string,
    opciones: RequestInit = {},
    maxReintentos = 4,
    delayInicial = 1000
  ): Promise<Response> {
    let reintento = 0;

    for (;;) {
      const acIntento = new AbortController();
      let porTimeout = false;
      const tIntento = setTimeout(() => {
        porTimeout = true;
        acIntento.abort();
      }, TIMEOUT_INTENTO_MS);

      // Se combina el signal del caller (abort de usuario) con el del timeout, sin perder
      // ninguno de los dos.
      const signalCombinado = opciones.signal
        ? AbortSignal.any([acIntento.signal, opciones.signal])
        : acIntento.signal;

      try {
        const res = await fetch(url, { ...opciones, signal: signalCombinado });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res;
      } catch (errFetch) {
        // (1) Abortado por el usuario o por un hermano: propagar el AbortError original.
        if (opciones.signal?.aborted) throw errFetch;

        // Nuestro timeout aborta con AbortError, que aguas arriba se trataría como abort
        // externo (el motor no frena a los hermanos) y se confundiría con una cancelación.
        // Se reescribe a un Error normal —igual que `BunClient.enviarFragmentoStream`— para
        // que se clasifique como fallo real y corte en cascada.
        const err = porTimeout
          ? new Error(`Timeout de ${TIMEOUT_INTENTO_MS}ms al descargar fragmento: ${url}`)
          : (errFetch as Error);

        // (2) El browser ya sabe que no hay red.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          console.warn(`📴 [FETCH-REINTENTOS] Sin red (navigator.onLine=false); no se reintenta: ${url}`);
          throw err;
        }

        // (3) Veredicto del daemon (HEAD real) antes de quemar la escalera de backoff.
        if (conexion) {
          try {
            const snap = await conexion.verificarAhora();
            if (!snap.internet) {
              console.warn(`📴 [FETCH-REINTENTOS] Daemon confirma internet caída; no se reintenta: ${url}`);
              throw err; // relanza el error ORIGINAL del fetch
            }
          } catch (e) {
            if (e === err) throw err; // nuestro relanzamiento → propagar
            // el propio sondeo del daemon falló por otra causa: seguir con el backoff normal
          }
        }

        // (4) Límite de reintentos.
        reintento++;
        if (reintento > maxReintentos) {
          console.error(`❌ [FETCH-REINTENTOS] Superado el límite de reintentos para: ${url}. Error: ${err.message}`);
          throw err;
        }

        const delay = delayInicial * Math.pow(2, reintento - 1);
        console.warn(
          `⚠️ [FETCH-REINTENTOS] Intento ${reintento} fallido para ${url}. Reintentando en ${delay}ms... Error: ${err.message}`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } finally {
        clearTimeout(tIntento);
      }
    }
  };
}

export type FetchConReintentos = ReturnType<typeof crearFetchConReintentos>;
