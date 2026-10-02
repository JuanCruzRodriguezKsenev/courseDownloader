import fs from "node:fs/promises";
import path from "node:path";
import { esRutaBajo } from "./rutas.js";
import { md5Archivo } from "./md5.js";
import { modificarIndice } from "./indiceServicio.js";
import { sanitizarNombreArchivo } from "../utils.js";
import { decidirDespues } from "../../core/destino/decidir.ts";
import { PORTALES_CON_DESTINO_INDICE } from "./portales.js";

export { PORTALES_CON_DESTINO_INDICE };

/**
 * Valida la ruta y el nombre propuestos para escribir en la raíz del usuario.
 * Exige que la carpeta de la materia exista (RN-1) y rechaza rutas inseguras (D-2, D-3).
 */
export async function validarDestino({ raiz, ruta, nombre, materia }) {
  if (!raiz || typeof raiz !== "string") {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }
  if (!materia || typeof materia !== "string") {
    return { ok: false, codigo: "MATERIA_INEXISTENTE" };
  }
  if (!ruta || typeof ruta !== "string" || !nombre || typeof nombre !== "string") {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }

  // Rechazar segmentos vacíos, "." o ".." en la ruta de destino (D-2)
  const segmentos = ruta.split(/[/\\]/);
  for (const seg of segmentos) {
    if (seg === "" || seg === "." || seg === "..") {
      return { ok: false, codigo: "RUTA_INSEGURA" };
    }
  }

  const carpetaAbs = path.resolve(raiz, ruta);
  if (!esRutaBajo(raiz, carpetaAbs)) {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }

  const nombreFinal = sanitizarNombreArchivo(nombre);
  if (!nombreFinal || nombreFinal === "." || nombreFinal === "..") {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }

  const archivoAbs = path.resolve(carpetaAbs, nombreFinal);
  if (!esRutaBajo(carpetaAbs, archivoAbs)) {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }

  // La carpeta de la materia tiene que existir en disco (RN-1, D-3)
  const carpetaMateria = path.resolve(raiz, materia);
  if (!esRutaBajo(raiz, carpetaMateria)) {
    return { ok: false, codigo: "RUTA_INSEGURA" };
  }

  try {
    const statMat = await fs.stat(carpetaMateria);
    if (!statMat.isDirectory()) {
      return { ok: false, codigo: "MATERIA_INEXISTENTE" };
    }
  } catch {
    return { ok: false, codigo: "MATERIA_INEXISTENTE" };
  }

  return { ok: true, carpetaAbs, archivoAbs, nombreFinal };
}

/**
 * Aplica la decisión de guardado al completarse la descarga según las filas 0, 5, 6 y D-7.
 */
export async function finalizarEnDestino({
  raiz,
  parcial,
  carpetaAbs,
  archivoAbs,
  nombreFinal,
  claveArchivo,
  claveCurso,
  original,
  rutaRelativa,
  opciones = {},
}) {
  const md5Parcial = await md5Archivo(parcial, opciones);
  const statParcial = await fs.stat(parcial);

  const destinoEsMd = /\.md$/i.test(nombreFinal);

  let existeDestino = false;
  let statDestino = null;
  try {
    statDestino = await fs.stat(archivoAbs);
    existeDestino = statDestino.isFile();
  } catch {
    existeDestino = false;
  }

  let md5ExisteEnCarpetaDestino = false;
  let existeDestinoConOtroContenido = false;
  let archivoExistenteNombre = "";
  let archivoExistenteRuta = "";

  if (existeDestino) {
    if (destinoEsMd) {
      // Fila 0: el archivo es .md y ya existe en destino
      // No comparamos contenido (RN-30)
    } else {
      if (statDestino.size === statParcial.size) {
        const md5Dest = await md5Archivo(archivoAbs, opciones);
        if (md5Dest === md5Parcial) {
          md5ExisteEnCarpetaDestino = true;
          archivoExistenteNombre = nombreFinal;
          archivoExistenteRuta = rutaRelativa;
        } else {
          existeDestinoConOtroContenido = true;
        }
      } else {
        existeDestinoConOtroContenido = true;
      }
    }
  }

  // D-8: Si no chocó con el destino con otro contenido y no se encontró aún por MD5,
  // buscar en la carpeta destino si hay otro archivo de igual tamaño e igual MD5
  if (!existeDestinoConOtroContenido && !md5ExisteEnCarpetaDestino && !destinoEsMd) {
    let items = [];
    try {
      items = await fs.readdir(carpetaAbs, { withFileTypes: true });
    } catch {
      items = [];
    }

    for (const item of items) {
      if (!item.isFile()) continue;
      const rutaHijo = path.join(carpetaAbs, item.name);
      if (rutaHijo === parcial || rutaHijo === archivoAbs) continue;

      try {
        const statHijo = await fs.stat(rutaHijo);
        if (statHijo.size === statParcial.size) {
          const md5Hijo = await md5Archivo(rutaHijo, opciones);
          if (md5Hijo === md5Parcial) {
            md5ExisteEnCarpetaDestino = true;
            archivoExistenteNombre = item.name;
            archivoExistenteRuta = rutaRelativa;
            break;
          }
        }
      } catch {}
    }
  }

  const accion = decidirDespues({
    destinoEsMd,
    existeDestino,
    md5ExisteEnCarpetaDestino,
    existeDestinoConOtroContenido,
  });

  if (accion === "rechazar") {
    // D-7: borrar el .part y lanzar error con codigo DESTINO_OCUPADO (NFR-4)
    await fs.unlink(parcial).catch(() => {});
    const err = new Error("El archivo destino ya existe con otro contenido.");
    err.codigo = "DESTINO_OCUPADO";
    throw err;
  }

  if (accion === "no-escribir") {
    // Fila 0: borrar .part y anotar si falta con el md5 del .md existente (RN-30)
    await fs.unlink(parcial).catch(() => {});
    const md5Existente = await md5Archivo(archivoAbs, opciones);

    await modificarIndice(raiz, (indice) => {
      indice.archivos = indice.archivos || {};
      const entradaPrevia = indice.archivos[claveArchivo];
      if (!entradaPrevia) {
        indice.archivos[claveArchivo] = {
          curso: claveCurso,
          nombre: nombreFinal,
          ruta: rutaRelativa,
          md5: md5Existente,
          original: original || "",
        };
      }
    });

    return "existente";
  }

  if (accion === "descartar") {
    // Fila 5: borrar .part y anotar apuntando al archivo que ya estaba (AC-2, AC-3)
    await fs.unlink(parcial).catch(() => {});

    await modificarIndice(raiz, (indice) => {
      indice.archivos = indice.archivos || {};
      const entradaPrevia = indice.archivos[claveArchivo];
      const nombreGuardar = entradaPrevia?.nombre || archivoExistenteNombre || nombreFinal;
      const rutaGuardar = entradaPrevia?.ruta || archivoExistenteRuta || rutaRelativa;

      indice.archivos[claveArchivo] = {
        curso: claveCurso,
        nombre: nombreGuardar,
        ruta: rutaGuardar,
        md5: md5Parcial,
        original: original || entradaPrevia?.original || "",
      };
    });

    return "descartado";
  }

  // Fila 6: acción "escribir"
  await modificarIndice(raiz, async (indice) => {
    indice.archivos = indice.archivos || {};
    const entradaPrevia = indice.archivos[claveArchivo];

    // RN-14, AC-6: Si el id ya tiene entrada con otro nombre, se conserva el nombre del índice
    const nombreDefinitivo = entradaPrevia?.nombre || nombreFinal;
    const rutaDefinitiva = entradaPrevia?.ruta || rutaRelativa;

    const carpetaDestinoFinal = path.resolve(raiz, rutaDefinitiva);
    await fs.mkdir(carpetaDestinoFinal, { recursive: true });

    const destinoFinal = path.resolve(carpetaDestinoFinal, nombreDefinitivo);
    await fs.rename(parcial, destinoFinal);

    indice.archivos[claveArchivo] = {
      curso: claveCurso,
      nombre: nombreDefinitivo,
      ruta: rutaDefinitiva,
      md5: md5Parcial,
      original: original || entradaPrevia?.original || "",
    };
  });

  return "escrito";
}
