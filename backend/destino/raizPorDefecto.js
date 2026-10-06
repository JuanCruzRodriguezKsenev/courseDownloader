import path from "node:path";
import { existsSync } from "node:fs";

/**
 * Elige la carpeta raíz por defecto para descargas.
 * Si ya existe Downloads/RamonNet_Turbo en el disco, la sigue usando (instalación previa).
 * Si no existe, usa la nueva Downloads/CourseDownloader.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.home] - Ruta base del home del usuario (o vacía)
 * @param {(ruta: string) => boolean} [opciones.existe] - Inyección para testeo
 * @returns {string} Ruta de la carpeta raíz por defecto
 */
export function elegirRaizPorDefecto({ home = "", existe = existsSync } = {}) {
  const rutaHeredada = path.join(home, "Downloads", "RamonNet_Turbo");
  if (existe(rutaHeredada)) {
    return rutaHeredada;
  }
  return path.join(home, "Downloads", "CourseDownloader");
}
