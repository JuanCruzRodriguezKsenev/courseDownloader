/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: RESOLUCIÓN DE ADJUNTOS (V1.2.0)
 * ==========================================================================
 * CHANGELOG v1.2.0:
 * - [MOODLE CORTE 1] La construcción de accesos Markdown delega en
 *   core/destino/accesoMd.ts (D-3, RN-9). Se elimina bytesABase64 local.
 *
 * CHANGELOG v1.1.0:
 * - [DESTINO CORTE 2b-3] Accesos Markdown (.md) nacen con frontmatter `tipo: acceso`
 *   y `revisado: AAAA-MM-DD` en fecha local (RN-17, D-5).
 *
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1] Nace con el tercer portal.
 * ==========================================================================
 *
 * Convierte el idArchivo de un adjunto en una URL descargable (Drive o data: URI para .md).
 * No realiza pedidos de red; los status HTTP los clasifica el procesador de cola.
 */

import { accesoADataUri } from "../../core/destino/accesoMd.ts";

function fallo(paso, detalle, extra) {
  const e = new Error(`[google-classroom] ${paso}: ${detalle}`);
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

const DescargarAdjuntoClassroom = {
  /**
   * Resuelve la URL de descarga para un archivo de Drive o un acceso Markdown.
   *
   * @param {string} idArchivo
   * @param {AbortSignal} [_signal]
   * @param {{ authuser?: string }} [credenciales]
   * @returns {Promise<string>}
   */
  async resolver(idArchivo, _signal, credenciales) {
    if (!idArchivo) {
      throw fallo("adjunto", "el ítem no trae idArchivo", { tipoPortal: "rechazo" });
    }

    if (idArchivo.startsWith("acceso:")) {
      return accesoADataUri(idArchivo, fechaLocalHoy());
    }

    const authuser = credenciales && credenciales.authuser;
    if (authuser == null || authuser === "") {
      throw fallo(
        "credenciales",
        "no hay cuenta de Google guardada para Classroom. Abrí el curso y re-escaneá.",
        { tipoConexion: "sesion" }
      );
    }

    const driveUrl = new URL("https://drive.usercontent.google.com/download");
    driveUrl.searchParams.set("id", idArchivo);
    driveUrl.searchParams.set("export", "download");
    driveUrl.searchParams.set("confirm", "t");
    driveUrl.searchParams.set("authuser", String(authuser));

    return driveUrl.toString();
  },
};

globalThis.DescargarAdjuntoClassroom = DescargarAdjuntoClassroom;
export default DescargarAdjuntoClassroom;
