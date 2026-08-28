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
 *
 * Cuando la raíz elegida es la letra de disco pelada en Windows (ej. "D:\"),
 * `path.resolve` la devuelve CON la barra final — a diferencia de cualquier carpeta
 * normal, donde no la lleva. Concatenarle `path.sep` de nuevo daba "D:\\" (doble
 * barra), que ningún hijo real empieza: la raíz quedaba bloqueada contra sí misma,
 * sin loguear nada, justo entre el "Extensión conectada" y el "carpeta sincronizada"
 * de handleEscanearDisco.
 */
export function esRutaSegura(rutaResuelta) {
  const raizNormalizada = path.resolve(CARPETA_RAIZ_VIDEOS);
  const rutaNormalizada = path.resolve(rutaResuelta);
  const prefijo = raizNormalizada.endsWith(path.sep) ? raizNormalizada : raizNormalizada + path.sep;
  return rutaNormalizada.startsWith(prefijo) || rutaNormalizada === raizNormalizada;
}
