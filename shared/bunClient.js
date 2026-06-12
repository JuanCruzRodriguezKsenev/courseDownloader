/**
 * CLON DOWNLOADHELPER - CLIENTE API BUN BACKEND (V1.0.0)
 * CENTRALIZA LAS CONSULTAS DE ESCANEO DE DISCO Y ENVIOS DE STREAMING AL SERVIDOR BUN
 * ==========================================================================
 */

const BunClient = {
  baseUrl: "http://localhost:3001",

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
  async enviarFragmentoStream(bloqueBinario, headers, signal) {
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
      signal
    });
    
    if (!res.ok) {
      throw new Error(`El backend de Bun rechazó el fragmento con código: ${res.status}`);
    }
    return res;
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
  async obtenerRutaServidor() {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) {
      throw new Error("El servidor local Bun no respondió correctamente.");
    }
    const data = await res.json();
    return data.ruta;
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

// Exportar según el contexto de ejecución (Window o Service Worker)
if (typeof window !== "undefined") {
  window.BunClient = BunClient;
} else {
  self.BunClient = BunClient;
}
