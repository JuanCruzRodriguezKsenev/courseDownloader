/**
 * ADAPTADOR CHROME — NOTIFICACIONES NATIVAS (V1.0.0)
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
 */

/** Un título distinto por tipo, para que la notificación sea escaneable de un vistazo. */
const TITULOS_POR_TIPO: Record<string, string> = {
  rechazo: "Clase saltada",
  sesion: "Sesión expirada",
  servidor: "Servidor desconectado",
  internet: "Sin conexión a internet",
};

export function notificarFallo(tipo: string, titulo: string, motivo: string): void {
  try {
    if (typeof chrome === "undefined" || !chrome.notifications?.create) {
      console.warn(
        "[SW] chrome.notifications no disponible (¿falta recargar la extensión desde la tarjeta tras sumar el permiso 'notifications'?)."
      );
      return;
    }
    chrome.notifications.create(
      // notificationId "" (auto-generado): cada fallo es un evento distinto y debe apilarse,
      // no reemplazar al anterior.
      "",
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

export default { notificarFallo };
