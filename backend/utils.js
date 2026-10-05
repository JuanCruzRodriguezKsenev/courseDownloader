import path from "node:path";
import { CARPETA_RAIZ_VIDEOS } from "./config.js";
import { esRutaBajo } from "./destino/rutas.js";

/**
 * Sanitiza un nombre de archivo eliminando caracteres peligrosos para el sistema de archivos.
 */
export function sanitizarNombreArchivo(nombre) {
  return path.basename(nombre).replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, '_').trim() || "video_sin_nombre";
}

/**
 * Valida que la ruta resuelta esté estrictamente dentro de la carpeta raíz global.
 * Delega en `esRutaBajo` con CARPETA_RAIZ_VIDEOS.
 */
export function esRutaSegura(rutaResuelta) {
  return esRutaBajo(CARPETA_RAIZ_VIDEOS, rutaResuelta);
}

