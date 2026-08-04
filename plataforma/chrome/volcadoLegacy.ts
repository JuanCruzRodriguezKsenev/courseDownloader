/**
 * ADAPTADOR CHROME — VOLCADO A DISCO DEL CAMINO LEGACY (V1.0.0)
 * ==========================================================================
 * Capa 3. Salió de `background.js` en la Fase 6b. Junta las tres piezas del camino
 * **no-Turbo**: abrir el documento offscreen, obtener una object-URL del blob y escribirla a
 * disco con `chrome.downloads`.
 *
 * ⚠️ **Hoy inalcanzable**: Turbo está forzado a `true` en todo el proyecto, así que los
 * fragmentos se streamean al backend Bun y nunca se arma un blob local. Se conserva porque es
 * el único camino que no depende del backend; borrarlo es una decisión aparte (ver
 * `docs/tech-stack.md` §Por qué Bun).
 *
 * POR QUÉ HACE FALTA UN DOCUMENTO OFFSCREEN PARA ALGO TAN SIMPLE
 * -------------------------------------------------------------
 * Los service workers de MV3 **no tienen `URL.createObjectURL`**. El documento offscreen
 * existe sólo para eso: es un DOM mínimo al que se le manda el blob por IPC para que devuelva
 * una object-URL utilizable. Se abre y se cierra alrededor de cada volcado.
 */
import type { PuertoMensajeria } from "../../core/puertos/mensajeria";
import { inyectarArchivoEnDiscoChrome } from "./descargas";

export function crearVolcadoLegacy(mensajeria: PuertoMensajeria) {
  async function obtenerBlobUrlDeOffscreen(blob: Blob): Promise<string> {
    try {
      await chrome.offscreen.createDocument({
        url: "offscreen/offscreen.html",
        reasons: ["DOM_PARSING" as chrome.offscreen.Reason],
        justification: "Generar URL de objeto para descarga de video HLS",
      });
    } catch (err) {
      // Ya había uno abierto: es el caso normal si un volcado anterior no alcanzó a cerrarlo.
      if (!(err as Error).message.includes("Only one offscreen document")) throw err;
    }

    const response = await mensajeria.enviar<{ error?: string; blobUrl: string }>({
      action: "crear_blob_url",
      blob,
    });

    if (response.error) throw new Error(response.error);
    return response.blobUrl;
  }

  async function cerrarOffscreenYRevocar(blobUrl: string): Promise<void> {
    try {
      await mensajeria.enviar({ action: "revocar_blob_url", blobUrl });
    } catch (e) {
      console.error("Error al revocar Object URL en Offscreen:", e);
    }
    try {
      await chrome.offscreen.closeDocument();
    } catch (e) {
      // Puede fallar si no había documento abierto (esperado); el warn deja rastro si el
      // cierre falló por otra razón.
      console.warn("⚠️ No se pudo cerrar el documento offscreen:", (e as Error)?.message);
    }
  }

  /**
   * Vuelca el blob a `subRuta` dentro de la carpeta de descargas. El `finally` cierra el
   * documento offscreen **pase lo que pase**: dejarlo abierto se lleva memoria y hace fallar
   * el próximo `createDocument`.
   */
  return async function guardarBlobLegacy(blob: Blob, subRuta: string): Promise<void> {
    const blobUrl = await obtenerBlobUrlDeOffscreen(blob);
    try {
      await inyectarArchivoEnDiscoChrome(blobUrl, subRuta);
    } finally {
      await cerrarOffscreenYRevocar(blobUrl);
    }
  };
}
