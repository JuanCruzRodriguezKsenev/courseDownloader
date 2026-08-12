import path from "node:path";
import { CARPETA_RAIZ_VIDEOS } from "./config.js";

/**
 * Sanitiza un nombre de archivo eliminando caracteres peligrosos para el sistema de archivos.
 */
export function sanitizarNombreArchivo(nombre) {
  return path.basename(nombre).replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, '_').trim() || "video_sin_nombre";
}

/**
 * Valida que la ruta resuelta esté estrictamente dentro de la carpeta raíz.
 */
export function esRutaSegura(rutaResuelta) {
  const raizNormalizada = path.resolve(CARPETA_RAIZ_VIDEOS);
  const rutaNormalizada = path.resolve(rutaResuelta);
  return rutaNormalizada.startsWith(raizNormalizada + path.sep) || rutaNormalizada === raizNormalizada;
}
