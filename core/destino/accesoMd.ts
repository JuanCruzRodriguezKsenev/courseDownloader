/**
 * FORMATEO DE ACCESOS MARKDOWN
 * =============================
 * Convierte un idArchivo de tipo `acceso:<url>:<titulo>` en una data: URI
 * con frontmatter `tipo: acceso` y `revisado: <fecha>`.
 *
 * Módulo puro (isomórfico Node/browser), sin dependencias de plataforma.
 */

function bytesABase64(bytes: Uint8Array): string {
  let binario = "";
  const len = bytes.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const sub = bytes.subarray(i, Math.min(i + chunk, len));
    binario += String.fromCharCode(...sub);
  }
  return btoa(binario);
}

/**
 * Convierte un id de acceso en un data URI de Markdown.
 *
 * @param idArchivo Formato `acceso:<url_codificada>:<titulo_codificado>`
 * @param fecha Fecha ISO o local YYYY-MM-DD
 */
export function accesoADataUri(idArchivo: string, fecha: string): string {
  const partes = idArchivo.split(":");
  const url = decodeURIComponent(partes[1] || "");
  const titulo = decodeURIComponent(partes.slice(2).join(":") || "");
  const contenidoMd = `---\ntipo: acceso\nrevisado: ${fecha}\n---\n\n# ${titulo}\n\n${url}`;
  const bytes = new TextEncoder().encode(contenidoMd);
  const b64 = bytesABase64(bytes);
  return `data:text/markdown;charset=utf-8;base64,${b64}`;
}
