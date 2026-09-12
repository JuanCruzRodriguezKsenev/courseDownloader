/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: RESOLUCIÓN DE ADJUNTOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1] Nace con el tercer portal.
 * ==========================================================================
 *
 * Convierte el idArchivo de un adjunto en una URL descargable (Drive o data: URI para .md).
 * No realiza pedidos de red; los status HTTP los clasifica el procesador de cola.
 */

function fallo(paso, detalle, extra) {
  const e = new Error(`[google-classroom] ${paso}: ${detalle}`);
  if (extra) Object.assign(e, extra);
  return e;
}

function bytesABase64(bytes) {
  let binario = "";
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, len));
    binario += String.fromCharCode.apply(null, sub);
  }
  return btoa(binario);
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
      const partes = idArchivo.split(":");
      const url = decodeURIComponent(partes[1] || "");
      const titulo = decodeURIComponent(partes.slice(2).join(":") || "");
      const contenidoMd = `# ${titulo}\n\n${url}`;
      const bytes = new TextEncoder().encode(contenidoMd);
      const b64 = bytesABase64(bytes);
      return `data:text/markdown;charset=utf-8;base64,${b64}`;
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
