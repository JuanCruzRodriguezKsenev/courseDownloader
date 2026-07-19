/**
 * CLON DOWNLOADHELPER - CLIENTE API BUN BACKEND (V1.4.0)
 * CENTRALIZA LAS CONSULTAS DE ESCANEO DE DISCO Y ENVIOS DE STREAMING AL SERVIDOR BUN
 * ==========================================================================
 * CHANGELOG v1.4.0:
 * - [FIX bug 400] enviarFragmentoStream ahora tipa el error de un rechazo 4xx del
 *   backend: err.httpStatus = res.status y err.tipoBackend = "rechazo" (sólo 400-499).
 *   Antes el status vivía SÓLO en el string del mensaje, así que aguas arriba no se
 *   podía distinguir un 400 (rechazo aplicativo, server vivo) de un 503 (server
 *   muriendo): un 400 a un fragmento se malclasificaba como caída de servidor y
 *   entraba en loop pausa→autoheal→mismo 400. Con el error tipado, el worker
 *   (hlsEngine v1.0.6) reintenta N=3 y background.js (v5.9.0) salta SOLO esa clase.
 *   El 5xx NO se marca: conserva el flujo pausa+autoheal (puede ser transitorio).
 *   Ver docs/TECHNICAL_DEBT.md y docs/patterns.md §Circuit breaker.
 * CHANGELOG v1.3.0:
 * - [CONFIG] La URL base del backend ya no es un literal hardcodeado: se puede
 *   sobreescribir SIN editar código, para tests de integración o apuntar a otro
 *   host/puerto. Default de fábrica intacto ("http://localhost:3001"). Dos vías:
 *   el global globalThis.RAMONNET_BUN_BASE_URL (leído al cargar el módulo) y el
 *   método BunClient.configurarBaseUrl(url) en runtime (sin arg válido → default).
 *   Las 6 funciones no cambiaron (siguen usando this.baseUrl). Ver TECHNICAL_DEBT.
 * CHANGELOG v1.2.0:
 * - [FIX CRÍTICO] enviarFragmentoStream ahora tiene timeout (30s). Si el servidor
 *   Bun moría a mitad de una descarga, el POST a /api/bypass-stream se colgaba sin
 *   fin: el loop del SW nunca fallaba, nunca pausaba la cola ni marcaba la caída, y
 *   el indicador del popup quedaba verde para siempre. El timeout lanza un Error de
 *   "backend" (NO AbortError, que el SW trata como cancelación de usuario) para que
 *   la cola se pause y el autoheal la reanude al volver el server. El abort real del
 *   usuario se sigue propagando tal cual.
 * CHANGELOG v1.1.0:
 * - [FIX CRÍTICO] obtenerRutaServidor ahora tiene timeout (AbortController) y
 *   cache:"no-store". Antes, con el servidor apagado, localhost:3001 no rechaza
 *   al instante (Windows deja la conexión colgada): el fetch sin timeout NUNCA
 *   resolvía, lo que congelaba el poll del daemon Conexion en "conectado" (falso
 *   positivo "dice conectado estando apagado"). Con el abort, el fetch falla
 *   rápido y el daemon puede marcar servidor=false. Mismo patrón que ya usaba el
 *   chequeo de internet en shared/conexion.js.
 * ==========================================================================
 */

// Default de fábrica del backend Bun. Sobreescribible SIN editar código:
//  - global globalThis.RAMONNET_BUN_BASE_URL (seteado antes de cargar el módulo, ej. tests de integración)
//  - en runtime/tests: BunClient.configurarBaseUrl(url)
const BASE_URL_DEFECTO = "http://localhost:3001";

function normalizarBaseUrl(url) {
  // Fallback al default si viene vacío/no-string; saca la barra final para no duplicar '//'.
  if (typeof url !== "string" || !url.trim()) return BASE_URL_DEFECTO;
  return url.trim().replace(/\/+$/, "");
}

const BunClient = {
  baseUrl: normalizarBaseUrl(
    (typeof globalThis !== "undefined" && globalThis.RAMONNET_BUN_BASE_URL) || BASE_URL_DEFECTO
  ),

  // Configura la URL base del backend en runtime (tests de integración / otro host:puerto).
  // Sin argumento válido, vuelve al default de fábrica.
  configurarBaseUrl(url) {
    this.baseUrl = normalizarBaseUrl(url);
    return this.baseUrl;
  },

  /**
   * Consulta los archivos descargados (.mp4) en la subcarpeta especificada
   */
  async escanearDisco(subcarpeta) {
    const url = `${this.baseUrl}/api/escanear-disco?carpeta=${encodeURIComponent(subcarpeta)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("El servidor local Bun no respondió correctamente.");
    }
    return await res.json();
  },

  /**
   * Actualiza el progreso en la consola gráfica del servidor Bun
   */
  async actualizarConsola(datos) {
    try {
      const res = await fetch(`${this.baseUrl}/api/actualizar-consola`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });
      return res.ok;
    } catch (e) {
      return false; // Fallback ante fallos de red
    }
  },

  /**
   * Envía un fragmento descifrado del video en caliente al servidor Bun
   */
  async enviarFragmentoStream(bloqueBinario, headers, signal, timeoutMs = 30000) {
    // Backstop anti-cuelgue: si el server Bun muere a mitad de la subida, el POST a
    // localhost puede quedarse colgado. Sin timeout, el loop del SW se queda esperando
    // para siempre y nunca pausa la cola ni marca la caída (indicador verde eterno).
    // Combinamos el signal del caller (abort de usuario) con uno de timeout, pero los
    // distinguimos: el SW trata CUALQUIER AbortError como cancelación limpia del
    // usuario, así que ante timeout NO lanzamos AbortError sino un Error de "backend"
    // normal, para que se clasifique como fallo de servidor y la cola se pause.
    const timeoutController = new AbortController();
    let porTimeout = false;
    const timeoutId = setTimeout(() => { porTimeout = true; timeoutController.abort(); }, timeoutMs);
    const reenviarAbort = () => timeoutController.abort();
    if (signal) {
      if (signal.aborted) timeoutController.abort();
      else signal.addEventListener("abort", reenviarAbort, { once: true });
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/bypass-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-video-title":   encodeURIComponent(headers.videoTitle),
          "x-chunk-index":   headers.chunkIndex.toString(),
          "x-total-chunks":  headers.totalChunks.toString(),
          "x-target-folder": headers.targetFolder,
          "x-session-id":    headers.sessionId || ""
        },
        body: bloqueBinario,
        signal: timeoutController.signal
      });

      if (!res.ok) {
        const err = new Error(`El backend de Bun rechazó el fragmento con código: ${res.status}`);
        err.httpStatus = res.status;
        // Un 4xx es un rechazo APLICATIVO determinístico con el server VIVO (/api/health
        // daría 200): reintentar el mismo fragmento no lo cura. Lo tipamos (mismo criterio
        // que err.tipoConexion="sesion") para que aguas arriba se salte SOLO esa clase sin
        // pausar la cola, en vez de entrar al loop pausa→autoheal→mismo 400. El 5xx NO se
        // marca: conserva el flujo actual (pausa+autoheal), puede ser un hipo transitorio.
        if (res.status >= 400 && res.status < 500) err.tipoBackend = "rechazo";
        throw err;
      }
      return res;
    } catch (e) {
      // Timeout = el backend no respondió. Lo reescribimos como error de servidor
      // (no AbortError) para que el SW pause la cola en vez de cortar como si el
      // usuario hubiera cancelado. El abort real del usuario se propaga tal cual.
      if (porTimeout) {
        throw new Error(`El backend de Bun no respondió al enviar el fragmento (timeout ${timeoutMs}ms).`);
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener("abort", reenviarAbort);
    }
  },

  /**
   * Solicita al servidor local Bun que abra el explorador de archivos nativo
   */
  async seleccionarCarpeta() {
    const res = await fetch(`${this.baseUrl}/api/seleccionar-carpeta`);
    if (!res.ok) {
      throw new Error("El servidor local Bun no respondió correctamente.");
    }
    return await res.json();
  },

  /**
   * Obtiene la ruta de la carpeta raíz actual configurada en el servidor Bun
   */
  async obtenerRutaServidor({ timeoutMs = 4000 } = {}) {
    // Timeout duro: con el server apagado, localhost:3001 puede colgar la conexión
    // en vez de rechazarla al instante; sin abort, este fetch nunca resolvería y
    // congelaría al poller que lo llama (ver daemon shared/conexion.js).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, {
        cache: "no-store",
        signal: controller.signal
      });
      if (!res.ok) {
        throw new Error("El servidor local Bun no respondió correctamente.");
      }
      const data = await res.json();
      return data.ruta;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async cancelarDescarga(titulo, sessionId) {
    try {
      const res = await fetch(`${this.baseUrl}/api/cancelar-descarga?titulo=${encodeURIComponent(titulo)}&sessionId=${encodeURIComponent(sessionId || "")}`);
      return res.ok;
    } catch (e) {
      console.warn("⚠️ No se pudo notificar la cancelación al servidor Bun:", e.message);
      return false;
    }
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = BunClient;
} else if (typeof window !== "undefined") {
  window.BunClient = BunClient;
} else if (typeof self !== "undefined") {
  self.BunClient = BunClient;
}
