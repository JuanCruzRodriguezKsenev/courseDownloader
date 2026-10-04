import path from "node:path";

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
export function esRutaBajo(raiz, rutaResuelta, pathMod = path) {
  if (!raiz || !rutaResuelta) return false;
  const raizNormalizada = pathMod.resolve(raiz);
  const rutaNormalizada = pathMod.resolve(rutaResuelta);
  const prefijo = raizNormalizada.endsWith(pathMod.sep) ? raizNormalizada : raizNormalizada + pathMod.sep;
  return rutaNormalizada.startsWith(prefijo) || rutaNormalizada === raizNormalizada;
}
