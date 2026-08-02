/**
 * NÚCLEO — CLIENTE DEL BACKEND BUN (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [CAPA 1 + TS] Movido desde `shared/bunClient.js` a `core/backend/` y tipado. Es el
 *   primer archivo del núcleo genérico y el primero en TypeScript (Fase 4 de
 *   docs/rearquitectura-diseno.md). Califica porque no toca `chrome.*` ni Ramón Net:
 *   es fetch puro contra el contrato del backend local. Lógica sin cambios; lo que suma
 *   TypeScript son los tipos de los errores, que hasta hoy eran convención documentada
 *   en comentarios (ver `ErrorBackend`).
 * CHANGELOG v1.4.0 y anteriores: ver el historial de git de shared/bunClient.js.
 * ==========================================================================
 * El contrato completo de endpoints (rutas, headers, formas de respuesta, semántica de
 * los status) vive en `docs/deployment.md` §Contrato de endpoints.
 */

/** Headers que el backend exige para cada fragmento de video. */
export interface HeadersFragmento {
  videoTitle: string;
  chunkIndex: number;
  totalChunks: number;
  targetFolder: string;
  sessionId?: string;
}

/** Telemetría que se empuja a la consola gráfica del servidor. */
export interface DatosConsola {
  titulo: string;
  porcentaje: number;
  terminados: number;
  totales: number;
  velocidad: number;
}

/**
 * Error de `enviarFragmentoStream` con la clasificación que el resto del sistema usa
 * para decidir entre "saltar esta clase" y "pausar la cola".
 *
 * `tipoBackend: "rechazo"` marca SÓLO los 4xx: son rechazos aplicativos con el servidor
 * vivo, así que reintentar el mismo fragmento no los cura y el SW salta la clase. Los
 * 5xx NO se marcan a propósito: pueden ser transitorios y conservan pausa + autoheal.
 * Tiparlo es el motivo por el que este archivo estrena TypeScript: era la convención
 * más fácil de romper en silencio (ver el bug 400 en docs/TECHNICAL_DEBT.md).
 */
export interface ErrorBackend extends Error {
  httpStatus?: number;
  tipoBackend?: "rechazo";
}

// Default de fábrica del backend Bun. Sobreescribible SIN editar código:
//  - global globalThis.RAMONNET_BUN_BASE_URL (leído al cargar el módulo, ej. tests de integración)
//  - en runtime/tests: BunClient.configurarBaseUrl(url)
const BASE_URL_DEFECTO = "http://localhost:3001";

function normalizarBaseUrl(url: unknown): string {
  // Fallback al default si viene vacío/no-string; saca la barra final para no duplicar '//'.
  if (typeof url !== "string" || !url.trim()) return BASE_URL_DEFECTO;
  return url.trim().replace(/\/+$/, "");
}

export const BunClient = {
  baseUrl: normalizarBaseUrl(
    (globalThis as Record<string, unknown>).RAMONNET_BUN_BASE_URL || BASE_URL_DEFECTO
  ),

  /**
   * Configura la URL base del backend en runtime (tests de integración / otro host:puerto).
   * Sin argumento válido, vuelve al default de fábrica.
   */
  configurarBaseUrl(url?: unknown): string {
    this.baseUrl = normalizarBaseUrl(url);
    return this.baseUrl;
  },

  /** Consulta los archivos ya descargados en la subcarpeta indicada. */
  async escanearDisco(subcarpeta: string): Promise<{ archivos?: string[] }> {
    const url = `${this.baseUrl}/api/escanear-disco?carpeta=${encodeURIComponent(subcarpeta)}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("El servidor local Bun no respondió correctamente.");
    }
    return await res.json();
  },

  /** Empuja el progreso a la consola gráfica del servidor. Best-effort: nunca lanza. */
  async actualizarConsola(datos: DatosConsola): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/actualizar-consola`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });
      return res.ok;
    } catch {
      return false; // Fallback ante fallos de red
    }
  },

  /** Envía un fragmento descifrado del video en caliente al servidor Bun. */
  async enviarFragmentoStream(
    // ArrayBuffer o vista tipada: `fetch` acepta ambos como body y ambos llegan en la
    // práctica (crypto.subtle.decrypt devuelve ArrayBuffer; los tests usan Uint8Array).
    bloqueBinario: ArrayBuffer | ArrayBufferView<ArrayBuffer>,
    headers: HeadersFragmento,
    signal?: AbortSignal,
    timeoutMs = 30000
  ): Promise<Response> {
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
        const err: ErrorBackend = new Error(
          `El backend de Bun rechazó el fragmento con código: ${res.status}`
        );
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

  /** Pide al servidor que abra el diálogo nativo de selección de carpeta. */
  async seleccionarCarpeta(): Promise<{ success?: boolean; ruta?: string }> {
    const res = await fetch(`${this.baseUrl}/api/seleccionar-carpeta`);
    if (!res.ok) {
      throw new Error("El servidor local Bun no respondió correctamente.");
    }
    return await res.json();
  },

  /**
   * Lee la carpeta raíz configurada en el servidor. Doble función: es TAMBIÉN la sonda
   * de vida que usa el daemon de conexión, por eso el timeout duro.
   */
  async obtenerRutaServidor({ timeoutMs = 4000 }: { timeoutMs?: number } = {}): Promise<string | undefined> {
    // Timeout duro: con el server apagado, localhost:3001 puede colgar la conexión
    // en vez de rechazarla al instante; sin abort, este fetch nunca resolvería y
    // congelaría al poller que lo llama (ver el daemon de conexión).
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

  /** Avisa al backend que se canceló una descarga, para que limpie los temporales. */
  async cancelarDescarga(titulo: string, sessionId?: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/cancelar-descarga?titulo=${encodeURIComponent(titulo)}&sessionId=${encodeURIComponent(sessionId || "")}`
      );
      return res.ok;
    } catch (e) {
      console.warn("⚠️ No se pudo notificar la cancelación al servidor Bun:", (e as Error).message);
      return false;
    }
  }
};

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
(globalThis as Record<string, unknown>).BunClient = BunClient;
export default BunClient;
