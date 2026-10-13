/**
 * ADAPTADOR DE SITIO — IDEAS (LIDI, UNLP): RESOLUCIÓN DE ADJUNTOS (V1.0.0)
 * =======================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 35 / MODO PURO] Implementación del resolver de descargas para ideas.info.unlp.edu.ar.
 *   - Validación de idArchivo: <slug>/(material|medioteca)/<guid> (RN-5).
 *   - Construcción de URL para Material y Medioteca.
 *   - Detección de sesión vencida si response.url tiene pathname /login (RN-11).
 *   - Clasificación de 404/410 con tipoPortal: "rechazo" (RN-12).
 *   - Cancelación del body y retorno de la URL de descarga (RN-17).
 * =======================================================================
 */

const ORIGEN = "https://ideas.info.unlp.edu.ar";
const REGEX_ID_ARCHIVO = /^([a-z0-9-]+)\/(material|medioteca)\/([0-9a-f-]{36})$/;

function fallo(paso, detalle, extra) {
  const e = new Error(`[ideas-info] ${paso}: ${detalle}`);
  if (extra) Object.assign(e, extra);
  return e;
}

const DescargarAdjuntoIdeasInfo = {
  /**
   * Resuelve la URL de descarga para un material o recurso de medioteca en IDEAS.
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

    const match = REGEX_ID_ARCHIVO.exec(String(idArchivo));
    if (!match) {
      throw fallo("adjunto", `idArchivo inválido: "${idArchivo}"`, { tipoPortal: "rechazo" });
    }

    const [, slug, tipo, guid] = match;
    const url =
      tipo === "material"
        ? `${ORIGEN}/${slug}/Contents/Material/View/Access/${guid}`
        : `${ORIGEN}/${slug}/Resources/MediaLibrary/View/AccessResource/${guid}`;

    const response = await fetch(url, { credentials: "include", signal });

    const urlFinal = response.url || "";
    try {
      const parsed = new URL(urlFinal);
      if (parsed.pathname === "/login" || parsed.pathname.endsWith("/login")) {
        throw fallo("sesion", "sesión vencida en IDEAS", { tipoConexion: "sesion" });
      }
    } catch (err) {
      if (err.tipoConexion === "sesion") throw err;
      if (/\/login(?:\/|$)/.test(urlFinal)) {
        throw fallo("sesion", "sesión vencida en IDEAS", { tipoConexion: "sesion" });
      }
    }

    if (response.status === 404 || response.status === 410) {
      throw fallo("descarga", `el archivo devolvió HTTP ${response.status}`, {
        tipoPortal: "rechazo",
      });
    }

    if (!response.ok) {
      throw fallo("descarga", `el archivo devolvió HTTP ${response.status}`);
    }

    if (response.body && typeof response.body.cancel === "function") {
      try {
        response.body.cancel();
      } catch {}
    }

    return url;
  },
};

globalThis.DescargarAdjuntoIdeasInfo = DescargarAdjuntoIdeasInfo;
export default DescargarAdjuntoIdeasInfo;
