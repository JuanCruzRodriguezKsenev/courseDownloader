/**
 * ADAPTADOR DE SITIO — MOODLE ASIGNATURAS (UNLP): RESOLUCIÓN DE ADJUNTOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 13 / MODO PURO] Implementación del resolver de descargas para asignaturas.info.unlp.edu.ar.
 *   - Manejo de accesos directos Markdown (accesoADataUri, RN-9).
 *   - Resolución de resources con soporte para redirect 302 y extracción de incrustados HTML (RN-10, AC-2).
 *   - Resolución de carpetas folder hacia el archivo interno correspondiente con forcedownload=1 (RN-5, RN-7, AC-4).
 *   - Detección de sesión vencida con tipoConexion: "sesion" (RN-11, D-5).
 *   - Clasificación de 404/410 con tipoPortal: "rechazo" (RN-12).
 * ==========================================================================
 */

import { accesoADataUri } from "../../core/destino/accesoMd.ts";

const ORIGEN = "https://asignaturas.info.unlp.edu.ar";

function fallo(paso, detalle, extra) {
  const e = new Error(`[moodle-asignaturas] ${paso}: ${detalle}`);
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

const DescargarAdjuntoMoodleAsignaturas = {
  /**
   * Resuelve la URL de descarga para un recurso, carpeta o acceso Markdown.
   *
   * @param {string} idArchivo
   * @param {AbortSignal} [signal]
   * @param {Record<string, string>} [_credenciales]
   * @returns {Promise<string>}
   */
  async resolver(idArchivo, signal, _credenciales) {
    if (!idArchivo) {
      throw fallo("adjunto", "el ítem no trae idArchivo", { tipoPortal: "rechazo" });
    }

    if (idArchivo.startsWith("acceso:")) {
      return accesoADataUri(idArchivo, fechaLocalHoy());
    }

    // Caso 1: Archivo dentro de una carpeta (folder): <cmid>/<rutaInterna>
    if (idArchivo.includes("/")) {
      const slashIndex = idArchivo.indexOf("/");
      const cmid = idArchivo.slice(0, slashIndex);
      const rutaInterna = idArchivo.slice(slashIndex + 1);

      const urlFolder = `${ORIGEN}/mod/folder/view.php?id=${cmid}`;
      const response = await fetch(urlFolder, { credentials: "include", signal });

      const urlFinal = response.url || "";
      if (/\/login\//.test(urlFinal)) {
        throw fallo("sesion", "sesión vencida en Moodle Asignaturas", { tipoConexion: "sesion" });
      }

      if (response.status === 404 || response.status === 410) {
        throw fallo("descarga", `la carpeta devolvió HTTP ${response.status}`, {
          tipoPortal: "rechazo",
        });
      }

      if (!response.ok) {
        throw fallo("descarga", `la carpeta devolvió HTTP ${response.status}`);
      }

      const html = await response.text();
      if (html.includes("id=\"page-login-index\"") || html.includes("/login/index.php")) {
        throw fallo("sesion", "sesión vencida en Moodle Asignaturas", { tipoConexion: "sesion" });
      }

      const regexFolder = /https?:\/\/[^\s"'><]+pluginfile\.php\/[^\s"'><]+mod_folder\/content\/\d+\/[^\s"'><]+/g;
      const matches = html.match(regexFolder) || [];

      for (const m of matches) {
        const cleanUrl = m.replace(/&amp;/g, "&");
        const matchRuta = cleanUrl.match(/\/mod_folder\/content\/\d+\/(.+?)(?:\?.*)?$/);
        if (matchRuta) {
          const rutaDecodificada = decodeURIComponent(matchRuta[1]);
          if (rutaDecodificada === rutaInterna) {
            const urlObj = new URL(cleanUrl);
            urlObj.searchParams.set("forcedownload", "1");
            return urlObj.toString();
          }
        }
      }

      throw fallo(
        "carpeta",
        `no se encontró el archivo ${rutaInterna} en la carpeta ${cmid}`,
        { tipoPortal: "rechazo" }
      );
    }

    // Caso 2: Recurso individual: <cmid>
    const cmid = idArchivo;
    const urlResource = `${ORIGEN}/mod/resource/view.php?id=${cmid}`;
    const response = await fetch(urlResource, { credentials: "include", signal });

    const urlFinal = response.url || "";
    if (/\/login\//.test(urlFinal)) {
      throw fallo("sesion", "sesión vencida en Moodle Asignaturas", { tipoConexion: "sesion" });
    }

    if (response.status === 404 || response.status === 410) {
      throw fallo("descarga", `el recurso devolvió HTTP ${response.status}`, {
        tipoPortal: "rechazo",
      });
    }

    if (!response.ok) {
      throw fallo("descarga", `el recurso devolvió HTTP ${response.status}`);
    }

    // Si hubo redirect a pluginfile.php
    if (urlFinal.includes("pluginfile.php")) {
      return urlFinal;
    }

    // Si sigue siendo view.php, el recurso está incrustado en el HTML
    const html = await response.text();
    if (html.includes("id=\"page-login-index\"") || html.includes("/login/index.php")) {
      throw fallo("sesion", "sesión vencida en Moodle Asignaturas", { tipoConexion: "sesion" });
    }

    const regexResource = /https?:\/\/[^\s"'><]+pluginfile\.php\/[^\s"'><]+mod_resource\/content\/[^\s"'><]+/;
    const match = html.match(regexResource);
    if (match) {
      return match[0].replace(/&amp;/g, "&");
    }

    throw fallo(
      "recurso",
      `no se encontró enlace a pluginfile en el recurso incrustado ${cmid}`,
      { tipoPortal: "rechazo" }
    );
  },
};

globalThis.DescargarAdjuntoMoodleAsignaturas = DescargarAdjuntoMoodleAsignaturas;
export default DescargarAdjuntoMoodleAsignaturas;
