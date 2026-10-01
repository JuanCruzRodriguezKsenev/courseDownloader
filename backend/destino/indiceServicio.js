import fs from "node:fs/promises";
import path from "node:path";
import { NOMBRE_INDICE, parsearIndice, serializarIndice } from "../../core/destino/indice.ts";

export class ErrorIndiceIlegible extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "ErrorIndiceIlegible";
    this.mensaje = mensaje;
  }
}

/**
 * Lee el índice de la raíz. Si no existe, devuelve una estructura vacía sin crear el archivo en disco (D-5).
 * Si existe pero es inválido, lanza ErrorIndiceIlegible (RN-25).
 */
export async function leerIndice(raiz) {
  const rutaIndice = path.join(raiz, NOMBRE_INDICE);
  let contenido = "";
  try {
    contenido = await fs.readFile(rutaIndice, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return {
        version: 1,
        cursos: {},
        archivos: {},
      };
    }
    throw err;
  }

  const res = parsearIndice(contenido);
  if (!res.ok) {
    throw new ErrorIndiceIlegible(res.error);
  }
  return res.indice;
}

const candadosPorRaiz = new Map();

/**
 * Modifica el índice bajo un candado por raíz (D-6).
 * Relee el archivo antes de modificar (RN-26), ejecuta `fn(indice)` y escribe
 * atómicamente mediante un archivo temporal y rename en el mismo directorio.
 */
export async function modificarIndice(raiz, fn) {
  const raizNorm = path.resolve(raiz);

  const colaActual = candadosPorRaiz.get(raizNorm) || Promise.resolve();

  let resolver;
  const promesaCandado = new Promise((resolve) => {
    resolver = resolve;
  });

  candadosPorRaiz.set(raizNorm, colaActual.then(() => promesaCandado, () => promesaCandado));

  await colaActual;

  try {
    const indice = await leerIndice(raiz);
    const retorno = await fn(indice);
    const indiceFinal = retorno ?? indice;

    const textoSerializado = serializarIndice(indiceFinal);
    const rutaFinal = path.join(raiz, NOMBRE_INDICE);
    const nombreTmp = `${NOMBRE_INDICE}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
    const rutaTmp = path.join(raiz, nombreTmp);

    try {
      await fs.writeFile(rutaTmp, textoSerializado, "utf8");
      await fs.rename(rutaTmp, rutaFinal);
    } catch (err) {
      await fs.unlink(rutaTmp).catch(() => {});
      throw err;
    }

    return indiceFinal;
  } finally {
    resolver();
    if (candadosPorRaiz.get(raizNorm) === promesaCandado) {
      candadosPorRaiz.delete(raizNorm);
    }
  }
}
