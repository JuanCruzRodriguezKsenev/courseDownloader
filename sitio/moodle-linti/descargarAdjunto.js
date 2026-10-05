/**
 * ADAPTADOR DE SITIO — MOODLE LINTI: RESOLUCIÓN DE ADJUNTOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [MOODLE CORTE 2] Nace para el cuarto portal.
 *   Resuelve URLs descargables para resources, folders y accesos Markdown.
 *   Corre en el service worker y verifica si la sesión sigue viva (D-4, D-5).
 * ==========================================================================
 */

import { accesoADataUri } from "../../core/destino/accesoMd.ts";

const ORIGEN = "https://catedras.linti.unlp.edu.ar";

function fallo(paso, detalle, extra) {
  const e = new Error(`[moodle-linti] ${paso}: ${detalle}`);
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

const DescargarAdjuntoMoodleLinti = {
  /**
   * Resuelve la URL descargable de un recurso, archivo en carpeta o acceso Markdown.
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

    // 1. Acceso Markdown (.md)
    if (idArchivo.startsWith("acceso:")) {
      return accesoADataUri(idArchivo, fechaLocalHoy());
    }

    // 2. Folder: <cmid>/<ruta interna>
    const barraIdx = idArchivo.indexOf("/");
    if (barraIdx !== -1) {
      const cmid = idArchivo.slice(0, barraIdx);
      const rutaBuscada = idArchivo.slice(barraIdx + 1);

      const urlFolder = `${ORIGEN}/mod/folder/view.php?id=${cmid}`;
      const r = await fetch(urlFolder, { credentials: "include", signal });

      const urlFinal = r.url || "";
      let pathname = "";
      try {
        pathname = new URL(urlFinal, ORIGEN).pathname;
      } catch {
        pathname = urlFinal;
      }

      if (pathname.startsWith("/login/")) {
        throw fallo("sesion", "la sesión en Moodle ha vencido", { tipoConexion: "sesion" });
      }

      if (!r.ok) {
        throw fallo("httpStatus", `error HTTP ${r.status}`, {
          httpStatus: r.status,
          tipoPortal: "rechazo",
        });
      }

      const html = await r.text();
      const re = /href=["']([^"']*pluginfile\.php[^"']*mod_folder[^"']*)["']/g;
      let m;

      while ((m = re.exec(html)) !== null) {
        const urlCoincidencia = m[1];
        const matchContenido = urlCoincidencia.match(/\/content\/\d+\/([^?#]+)/);
        if (!matchContenido) continue;

        let rutaEnlace = "";
        try {
          rutaEnlace = decodeURIComponent(matchContenido[1]);
        } catch {
          rutaEnlace = matchContenido[1];
        }

        if (rutaEnlace === rutaBuscada) {
          if (!urlCoincidencia.includes("forcedownload=1")) {
            const separador = urlCoincidencia.includes("?") ? "&" : "?";
            return `${urlCoincidencia}${separador}forcedownload=1`;
          }
          return urlCoincidencia;
        }
      }

      throw fallo("archivo", "el archivo ya no está en la carpeta", { tipoPortal: "rechazo" });
    }

    // 3. Resource: <cmid>
    const cmid = idArchivo;
    const urlResource = `${ORIGEN}/mod/resource/view.php?id=${cmid}`;
    const r = await fetch(urlResource, { credentials: "include", signal });

    const urlFinal = r.url || "";
    let pathname = "";
    try {
      pathname = new URL(urlFinal, ORIGEN).pathname;
    } catch {
      pathname = urlFinal;
    }

    if (pathname.startsWith("/login/")) {
      throw fallo("sesion", "la sesión en Moodle ha vencido", { tipoConexion: "sesion" });
    }

    if (!r.ok) {
      throw fallo("httpStatus", `error HTTP ${r.status}`, {
        httpStatus: r.status,
        tipoPortal: "rechazo",
      });
    }

    if (pathname.includes("/mod/resource/view.php")) {
      // Página intermedia de resource: extraer primer pluginfile
      const html = await r.text();
      const matchPluginfile = html.match(
        /https?:\/\/[^"'\s<>]+pluginfile\.php\/[^"'\s<>]+mod_resource\/[^"'\s<>]+/
      );
      if (matchPluginfile) {
        return matchPluginfile[0];
      }
      throw fallo("resource", "no se encontró enlace descargable en la página intermedia", {
        tipoPortal: "rechazo",
      });
    }

    if (r.body && typeof r.body.cancel === "function") {
      r.body.cancel().catch(() => {});
    }

    return urlFinal;
  },
};

globalThis.DescargarAdjuntoMoodleLinti = DescargarAdjuntoMoodleLinti;
export default DescargarAdjuntoMoodleLinti;
