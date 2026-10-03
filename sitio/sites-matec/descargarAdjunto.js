/**
 * ADAPTADOR DE SITIO — GOOGLE SITES MATE C: RESOLUCIÓN DE ADJUNTOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [SITES MATEC CORTE 1] Nace con el soporte de Google Sites Mate C (D-4, D-5).
 *   Resuelve prefijos `acceso:` a data URIs Markdown (0 ms, sin red)
 *   y prefijos `drive:` a URLs directas de descarga de Google Drive.
 * ==========================================================================
 *
 * Convierte el idArchivo de un adjunto en una URL descargable (Drive o data: URI para .md).
 * No realiza pedidos de red; los status HTTP los clasifica el procesador de cola.
 */

import { accesoADataUri } from "../../core/destino/accesoMd.ts";

function fallo(paso, detalle, extra) {
  const e = new Error(`[sites-matec] ${paso}: ${detalle}`);
  if (extra) Object.assign(e, extra);
  return e;
}

function fechaLocalHoy() {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, "0");
  const d = String(ahora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DescargarAdjuntoSitesMatec = {
  /**
   * Resuelve la URL de descarga para un archivo de Drive o un acceso Markdown.
   *
   * @param {string} idArchivo
   * @param {AbortSignal} [_signal]
   * @param {Record<string, string>} [_credenciales]
   * @returns {Promise<string>}
   */
  async resolver(idArchivo, _signal, _credenciales) {
    if (!idArchivo) {
      throw fallo("adjunto", "el ítem no trae idArchivo", { tipoPortal: "rechazo" });
    }

    if (idArchivo.startsWith("acceso:")) {
      return accesoADataUri(idArchivo, fechaLocalHoy());
    }

    if (idArchivo.startsWith("drive:")) {
      const fileId = idArchivo.slice("drive:".length);
      if (!fileId) {
        throw fallo("adjunto", "id de archivo Drive vacío", { tipoPortal: "rechazo" });
      }
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    }

    if (idArchivo.startsWith("url:")) {
      const urlDirecta = idArchivo.slice("url:".length);
      return urlDirecta;
    }

    throw fallo("adjunto", `prefijo de idArchivo no soportado: ${idArchivo}`, { tipoPortal: "rechazo" });
  },
};

globalThis.DescargarAdjuntoSitesMatec = DescargarAdjuntoSitesMatec;
export { DescargarAdjuntoSitesMatec };
export default DescargarAdjuntoSitesMatec;
