/**
 * ADAPTADOR CHROME — NOTIFICACIONES NATIVAS (V1.1.0)
 * ==========================================================================
 * Capa 3. Salió de `background.js` en la Fase 6b: la cola decide *cuándo* avisar de un fallo,
 * pero *cómo* se muestra el aviso es del navegador.
 *
 * Es el aviso que llega **con el popup cerrado**, que es justo cuando importa: si la cola se
 * pausa y nadie está mirando, sin esto el usuario se entera horas después. Su contraparte
 * persistente es la campanita (`core/historial/historialFallos.ts`).
 *
 * Todo el módulo es best-effort y **nunca propaga**: una regresión real (v5.10.0) fue que un
 * `chrome.notifications` ausente —el permiso no se aplica hasta recargar la extensión desde
 * su tarjeta— frenaba la cola entera. Avisar de un fallo no puede causar otro.
 *
 * CHANGELOG v1.1.0:
 * - [MULTISITIO CORTE 8] El `notificationId` deja de ser `""` y pasa a **llevar adentro el
 *   `sitioId` del ítem que falló**. El click en la notificación tiene que enfocar la pestaña
 *   DE ESE portal, y hasta ahora enfocaba la del portal asumido (ver §5 de
 *   `docs/multisitio-diseno.md`): con la cola mezclada, el fallo del portal B abría el A.
 *
 *   **Por qué en el id y no en un Map en memoria**, que es lo primero que uno escribe: el SW
 *   se suspende y se lleva el Map, pero la notificación sobrevive en pantalla. Al volver el
 *   click, el Map ya no está y no hay a quién preguntarle. El id lo custodia Chrome, así que
 *   el dato viaja con el único que sobrevive al ciclo de vida del worker. Sin storage nuevo.
 *
 *   La unicidad del id se conserva (timestamp + random), que es lo que hace que cada fallo
 *   se APILE en vez de reemplazar al anterior — la razón por la que antes era `""`.
 */

/** Prefijo y separador del `notificationId`. Ver el changelog: el id es el canal del dato. */
const PREFIJO_FALLO = "fallo";
const SEPARADOR = "|";

/**
 * `fallo|<sitioId>|<único>`. El `sitioId` va URL-encodeado para que un id de portal con el
 * separador adentro no parta el parseo — hoy los ids son slugs, pero el contrato no lo exige.
 */
function idDeNotificacionDeFallo(sitioId?: string): string {
  const unico = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return [PREFIJO_FALLO, encodeURIComponent(sitioId ?? ""), unico].join(SEPARADOR);
}

/**
 * Lee el `sitioId` que viaja en un `notificationId`.
 *
 * Devuelve `undefined` en los dos casos que significan **"no hay portal anotado"**, que NO es
 * lo mismo que "portal desconocido":
 *   - el id no tiene esta forma → es una notificación anterior al corte 8, que puede seguir en
 *     pantalla tras recargar la extensión;
 *   - el id la tiene pero con el sitio vacío → el ítem no llevaba `sitioId` (dato pre
 *     multi-sitio).
 *
 * Los dos son "dato viejo" y le tocan al resolvedor compartido migrarlos al portal legado
 * (`plataforma/composicion.ts`). Un `sitioId` presente pero no registrado sale de acá **tal
 * cual**, para que el resolvedor lo rechace: esa distinción es la trampa del corte 3 y no se
 * puede colapsar acá sin volver a abrirla.
 */
export function sitioIdDeNotificacion(notificationId: string): string | undefined {
  try {
    const partes = (notificationId ?? "").split(SEPARADOR);
    if (partes.length < 3 || partes[0] !== PREFIJO_FALLO) return undefined;
    // `?? ""` por el índice: la guarda de longitud de arriba no lo estrecha para `tsc`.
    const crudo = decodeURIComponent(partes[1] ?? "");
    return crudo === "" ? undefined : crudo;
  } catch {
    // decodeURIComponent tira ante un porcentaje suelto. Un id ilegible es "sin portal
    // anotado", no una excepción: este módulo nunca propaga.
    return undefined;
  }
}

/** Un título distinto por tipo, para que la notificación sea escaneable de un vistazo. */
const TITULOS_POR_TIPO: Record<string, string> = {
  rechazo: "Clase saltada",
  sesion: "Sesión expirada",
  servidor: "Servidor desconectado",
  internet: "Sin conexión a internet",
};

export function notificarFallo(tipo: string, titulo: string, motivo: string, sitioId?: string): void {
  try {
    if (typeof chrome === "undefined" || !chrome.notifications?.create) {
      console.warn(
        "[SW] chrome.notifications no disponible (¿falta recargar la extensión desde la tarjeta tras sumar el permiso 'notifications'?)."
      );
      return;
    }
    chrome.notifications.create(
      // El id lleva el `sitioId` del ítem y un sufijo único (corte 8). Antes era "" para que
      // Chrome lo autogenerara; la unicidad —que es lo que hace que los fallos se apilen en
      // vez de reemplazarse— ahora la pone el sufijo.
      idDeNotificacionDeFallo(sitioId),
      {
        type: "basic",
        // URL absoluta vía getURL: la ruta relativa "icons/..." puede no resolver en el SW
        // (falla silenciosa "Unable to download all specified images").
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: TITULOS_POR_TIPO[tipo] || "Fallo en la descarga",
        message: titulo ? `"${titulo}": ${motivo}` : motivo,
        priority: 2,
      },
      () => {
        // La API reporta el motivo real por lastError (no por throw): queda logueado para
        // diagnóstico si la notificación no se muestra pese a recargar bien la extensión.
        if (chrome.runtime.lastError) {
          console.warn("[SW] La notificación no se pudo mostrar:", chrome.runtime.lastError.message);
        }
      }
    );
  } catch (e) {
    console.warn("[SW] Error creando la notificación de fallo:", e);
  }
}

export default { notificarFallo, sitioIdDeNotificacion };
