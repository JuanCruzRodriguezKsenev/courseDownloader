import fs from "node:fs";
import fsp from "node:fs/promises";
import crypto from "node:crypto";

const cacheMd5 = new Map();

/**
 * Limpia el cache de hashes en memoria (útil en tests o mediciones).
 */
export function limpiarCacheMd5() {
  cacheMd5.clear();
}

/**
 * Calcula el hash MD5 de un archivo por stream, devolviendo 32 caracteres hex en minúsculas.
 * Cachea el resultado por `ruta|tamaño|mtime` (D-4).
 * Permite inyectar `opciones.hasher` para instrumentación o tests.
 */
export async function md5Archivo(ruta, opciones = {}) {
  const stat = await fsp.stat(ruta);
  const claveCache = `${ruta}|${stat.size}|${stat.mtimeMs}`;

  if (cacheMd5.has(claveCache)) {
    return cacheMd5.get(claveCache);
  }

  let hashHex = "";
  if (typeof opciones.hasher === "function") {
    hashHex = await opciones.hasher(ruta);
  } else {
    hashHex = await new Promise((resolve, reject) => {
      const hash = crypto.createHash("md5");
      const stream = fs.createReadStream(ruta);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex").toLowerCase()));
      stream.on("error", (err) => reject(err));
    });
  }

  const resultado = hashHex.toLowerCase();
  cacheMd5.set(claveCache, resultado);
  return resultado;
}
