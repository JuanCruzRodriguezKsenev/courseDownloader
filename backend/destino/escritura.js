import fs from "node:fs/promises";
import path from "node:path";
import { esRutaBajo } from "./rutas.js";
import { md5Archivo } from "./md5.js";
import { modificarIndice } from "./indiceServicio.js";
import { sanitizarNombreArchivo } from "../utils.js";
import { recorrerRaiz } from "./recorrido.js";
import { decidirDespues } from "../../core/destino/decidir.ts";
import { PORTALES_CON_DESTINO_INDICE } from "./portales.js";
import { log } from "../logger.js";

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
 * RN-16c: primer `<base>_<n><ext>` (n de 2 a 999) que no existe en la carpeta, comparando en minúsculas.
 * Si no hay ninguno libre, lanza DESTINO_OCUPADO (el 409 queda sólo para ese caso extremo).
 */
async function nombreLibre(carpetaAbs, nombre) {
  let existentes = [];
  try {
    existentes = await fs.readdir(carpetaAbs);
  } catch {
    existentes = [];
  }
  const ocupados = new Set(existentes.map((n) => n.toLowerCase()));
  const matchExt = nombre.match(/\.([a-z0-9]{1,5})$/i);
  const tieneExt = Boolean(matchExt && matchExt.index !== undefined);
  const base = tieneExt ? nombre.slice(0, matchExt.index) : nombre;
  const ext = tieneExt ? matchExt[0] : "";
  for (let n = 2; n <= 999; n++) {
    const candidato = `${base}_${n}${ext}`;
    if (!ocupados.has(candidato.toLowerCase())) return candidato;
  }
  const err = new Error("El archivo destino ya existe con otro contenido.");
  err.codigo = "DESTINO_OCUPADO";
  throw err;
}

/**
 * Aplica la decisión de guardado al completarse la descarga según las filas 0, 5, 6 y renombrar (RN-16c).
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

  let md5ExisteEnRaiz = false;
  if (!destinoEsMd && !md5ExisteEnCarpetaDestino) {
    const archivos = await recorrerRaiz(raiz);
    const coincidencias = [];

    for (const rel of archivos) {
      if (rel.endsWith(".part")) continue;
      const rutaAbs = path.join(raiz, rel);
      if (rutaAbs === parcial) continue;

      try {
        const statHijo = await fs.stat(rutaAbs);
        if (statHijo.size === statParcial.size) {
          const md5Hijo = await md5Archivo(rutaAbs, opciones);
          if (md5Hijo === md5Parcial) {
            coincidencias.push({ rel, mtimeMs: statHijo.mtimeMs });
          }
        }
      } catch {}
    }

    if (coincidencias.length > 0) {
      coincidencias.sort((a, b) => {
        if (b.mtimeMs !== a.mtimeMs) {
          return b.mtimeMs - a.mtimeMs;
        }
        return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0;
      });

      const mejor = coincidencias[0].rel;
      md5ExisteEnRaiz = true;
      archivoExistenteNombre = path.basename(mejor);
      const dirRel = path.dirname(mejor);
      archivoExistenteRuta = dirRel === "." ? "" : dirRel;
    }
  }

  const accion = decidirDespues({
    destinoEsMd,
    existeDestino,
    md5ExisteEnCarpetaDestino,
    md5ExisteEnRaiz,
    existeDestinoConOtroContenido,
  });

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

  // Fila 6: acción "escribir", o "renombrar" (RN-16c: destino ocupado → se guarda con _N, NFR-4)
  await modificarIndice(raiz, async (indice) => {
    indice.archivos = indice.archivos || {};
    const entradaPrevia = indice.archivos[claveArchivo];

    // RN-14, AC-6: Si el id ya tiene entrada con otro nombre, se conserva el nombre del índice
    let nombreDefinitivo = entradaPrevia?.nombre || nombreFinal;
    const rutaDefinitiva = entradaPrevia?.ruta || rutaRelativa;

    const carpetaDestinoFinal = path.resolve(raiz, rutaDefinitiva);
    await fs.mkdir(carpetaDestinoFinal, { recursive: true });

    let destinoFinal = path.resolve(carpetaDestinoFinal, nombreDefinitivo);
    // RN-16c: también si otra descarga ocupó el mismo nombre entre el cálculo y el lock
    let destinoOcupado = false;
    try {
      await fs.stat(destinoFinal);
      destinoOcupado = true;
    } catch {
      destinoOcupado = false;
    }
    if (accion === "renombrar" || destinoOcupado) {
      const nombreOriginal = nombreDefinitivo;
      try {
        nombreDefinitivo = await nombreLibre(carpetaDestinoFinal, nombreDefinitivo);
      } catch (err) {
        // Sin _N libre hasta 999: el mismo 409 de antes, sin dejar el .part (NFR-4)
        await fs.unlink(parcial).catch(() => {});
        throw err;
      }
      destinoFinal = path.resolve(carpetaDestinoFinal, nombreDefinitivo);
      log("WARN", "DESTINO", `${rutaDefinitiva}/${nombreOriginal} ya existía con otro contenido: se guardó como ${nombreDefinitivo}`);
    }

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
