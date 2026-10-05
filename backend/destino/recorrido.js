import fs from "node:fs/promises";
import path from "node:path";
import { md5Archivo } from "./md5.js";

const CARPETAS_IGNORADAS = new Set(["Wiki", "Mis notas", "Clases"]);

/**
 * Recorre la raíz ignorando carpetas excluidas (Wiki, Mis notas, Clases en cualquier nivel),
 * carpetas/archivos que comiencen con '.' y symlinks (D-4).
 * Devuelve un array de rutas relativas a la raíz, normalizadas con '/'.
 */
export async function recorrerRaiz(raiz) {
  const relativas = [];

  async function explorar(dirActual) {
    let entradas;
    try {
      entradas = await fs.readdir(dirActual, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entradas) {
      if (ent.isSymbolicLink()) continue;
      if (ent.name.startsWith(".")) continue;

      const rutaAbs = path.join(dirActual, ent.name);

      if (ent.isDirectory()) {
        if (CARPETAS_IGNORADAS.has(ent.name)) continue;
        await explorar(rutaAbs);
      } else if (ent.isFile()) {
        const rel = path.relative(raiz, rutaAbs);
        const relConBarra = rel.split(path.sep).join("/");
        relativas.push(relConBarra);
      }
    }
  }

  await explorar(raiz);
  return relativas;
}

/**
 * Busca por md5 en la raíz y devuelve la ruta relativa con '/' del primer archivo
 * cuyo hash coincida, o null si no se encuentra.
 */
export async function buscarPorMd5(raiz, md5Buscado, opciones = {}) {
  if (!md5Buscado) return null;
  const hashObjetivo = md5Buscado.toLowerCase();
  const archivos = await recorrerRaiz(raiz);
  const coincidencias = [];

  for (const rel of archivos) {
    const rutaAbs = path.join(raiz, rel);
    try {
      let stat = null;
      if (typeof opciones.tamano === "number") {
        stat = await fs.stat(rutaAbs);
        if (stat.size !== opciones.tamano) {
          continue;
        }
      }
      const hash = await md5Archivo(rutaAbs, opciones);
      if (hash === hashObjetivo) {
        if (!stat) {
          stat = await fs.stat(rutaAbs);
        }
        coincidencias.push({ rel, mtimeMs: stat.mtimeMs });
      }
    } catch {
      // Ignorar archivos que no se puedan leer
    }
  }

  if (coincidencias.length === 0) return null;
  if (coincidencias.length === 1) return coincidencias[0].rel;

  coincidencias.sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) {
      return b.mtimeMs - a.mtimeMs;
    }
    return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
  });

  return coincidencias[0].rel;
}
