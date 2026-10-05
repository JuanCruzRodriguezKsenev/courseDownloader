import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NOMBRE_INDICE } from "../../core/destino/indice.ts";
import { RAIZ_FACULTAD } from "./raiz.js";
import { leerIndice, modificarIndice } from "../destino/indiceServicio.js";

/**
 * Parsea los argumentos de la línea de comandos para la migración de omitidos.
 * Formato esperado:
 *   bun backend/adopcion/migrar-omitidos.js --tsv <dir> [--indice <ruta>] [--escribir]
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const opts = {
    tsv: "",
    indice: path.join(RAIZ_FACULTAD, NOMBRE_INDICE),
    escribir: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === "--tsv" || arg === "-t") && argv[i + 1]) {
      opts.tsv = argv[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if ((arg === "--indice" || arg === "-i") && argv[i + 1]) {
      opts.indice = argv[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (arg === "--escribir") {
      opts.escribir = true;
    } else if (arg === "--ensayo") {
      opts.escribir = false;
    }
  }

  return opts;
}

/**
 * Lee y parsea un archivo TSV omitiendo comentarios (#) y líneas vacías.
 */
export function parsearTsv(rutaArchivo) {
  if (!fs.existsSync(rutaArchivo)) {
    throw new Error(`No se encontró el archivo TSV: ${rutaArchivo}`);
  }
  const contenido = fs.readFileSync(rutaArchivo, "utf8");
  const lineas = contenido
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lineas.length === 0) {
    return { cabecera: [], filas: [] };
  }

  const cabecera = lineas[0].split("\t").map((c) => c.trim());
  const filas = [];

  for (let i = 1; i < lineas.length; i++) {
    const valores = lineas[i].split("\t").map((v) => v.trim());
    const obj = {};
    for (let j = 0; j < cabecera.length; j++) {
      obj[cabecera[j]] = valores[j] !== undefined ? valores[j] : "";
    }
    filas.push(obj);
  }

  return { cabecera, filas };
}

/**
 * Calcula la migración de temas '-' y archivos omitidos.
 * Valida que cada clave_curso exista en el índice; falla entero si alguna no existe.
 */
export function calcularMigracion(indice, datosTemas, datosArchivos) {
  const errores = [];

  // 1. Validar que toda clave_curso referenciada en los TSV exista en el índice
  const cursosEnTsv = new Set();
  for (const fila of datosTemas.filas) {
    if (fila.clave_curso) cursosEnTsv.add(fila.clave_curso);
  }
  for (const fila of datosArchivos.filas) {
    if (fila.clave_curso) cursosEnTsv.add(fila.clave_curso);
  }

  for (const claveCurso of cursosEnTsv) {
    if (!indice.cursos || !indice.cursos[claveCurso]) {
      errores.push(`El curso '${claveCurso}' referenciado en los TSV no existe en el índice .course-downloader.json.`);
    }
  }

  if (errores.length > 0) {
    return {
      ok: false,
      errores,
      temasAAgregar: new Map(),
      omitidosAAgregar: new Map(),
      filasTabla: [],
      totales: { temasAgrega: 0, temasYaEstaba: 0, omitidosAgrega: 0, omitidosYaEstaba: 0, totalCambios: 0 },
    };
  }

  // 2. Procesar temas.tsv con destino "-"
  const temasAAgregar = new Map();
  const temasYaEstaban = new Map();

  for (const fila of datosTemas.filas) {
    if (fila.destino === "-") {
      const c = fila.clave_curso;
      const tema = fila.tema;
      const cursoIndice = indice.cursos[c];
      const temasExistentes = cursoIndice.temas || {};

      if (tema in temasExistentes) {
        // Ya existía (si ya tiene carpeta no se pisa)
        if (!temasYaEstaban.has(c)) temasYaEstaban.set(c, new Set());
        temasYaEstaban.get(c).add(tema);
      } else {
        // No existe: se agrega como "-"
        if (!temasAAgregar.has(c)) temasAAgregar.set(c, new Set());
        temasAAgregar.get(c).add(tema);
      }
    }
  }

  // 3. Procesar archivos.tsv con accion === "omitir"
  // cuyo tema no esté ya en "-" (ni en el índice ni planificado como '-')
  const omitidosAAgregar = new Map();
  const omitidosYaEstaban = new Map();

  for (const fila of datosArchivos.filas) {
    if (fila.accion === "omitir") {
      const c = fila.clave_curso;
      const tema = fila.tema;
      const claveArchivo = fila.clave;
      const cursoIndice = indice.cursos[c];

      const esTemaGuion =
        (cursoIndice.temas && cursoIndice.temas[tema] === "-") ||
        (temasAAgregar.get(c) && temasAAgregar.get(c).has(tema));

      if (esTemaGuion) {
        // El tema completo está en '-', el archivo no necesita ir a omitidos
        continue;
      }

      const listaOmitidos = cursoIndice.omitidos || [];
      if (listaOmitidos.includes(claveArchivo)) {
        if (!omitidosYaEstaban.has(c)) omitidosYaEstaban.set(c, new Map());
        const porTema = omitidosYaEstaban.get(c);
        if (!porTema.has(tema)) porTema.set(tema, new Set());
        porTema.get(tema).add(claveArchivo);
      } else {
        if (!omitidosAAgregar.has(c)) omitidosAAgregar.set(c, new Map());
        const porTema = omitidosAAgregar.get(c);
        if (!porTema.has(tema)) porTema.set(tema, new Set());
        porTema.get(tema).add(claveArchivo);
      }
    }
  }

  // 4. Armar tabla: curso | tema | agrega | ya estaba
  const filasTabla = [];
  const todosCursosTemas = new Set();

  for (const [c, setTemas] of temasAAgregar) {
    for (const t of setTemas) todosCursosTemas.add(`${c}\t${t}`);
  }
  for (const [c, setTemas] of temasYaEstaban) {
    for (const t of setTemas) todosCursosTemas.add(`${c}\t${t}`);
  }
  for (const [c, mapTemas] of omitidosAAgregar) {
    for (const t of mapTemas.keys()) todosCursosTemas.add(`${c}\t${t}`);
  }
  for (const [c, mapTemas] of omitidosYaEstaban) {
    for (const t of mapTemas.keys()) todosCursosTemas.add(`${c}\t${t}`);
  }

  let totalTemasAgrega = 0;
  let totalTemasYaEstaba = 0;
  let totalOmitidosAgrega = 0;
  let totalOmitidosYaEstaba = 0;

  for (const cursoTema of Array.from(todosCursosTemas).sort()) {
    const [c, t] = cursoTema.split("\t");
    const nombreCurso = indice.cursos[c]?.nombre || c;

    const partesAgrega = [];
    const partesYaEstaba = [];

    if (temasAAgregar.get(c)?.has(t)) {
      partesAgrega.push('tema "-"');
      totalTemasAgrega++;
    }
    if (temasYaEstaban.get(c)?.has(t)) {
      const destActual = indice.cursos[c]?.temas?.[t];
      partesYaEstaba.push(`tema "${destActual}"`);
      totalTemasYaEstaba++;
    }

    const nOmitidosAgrega = omitidosAAgregar.get(c)?.get(t)?.size || 0;
    if (nOmitidosAgrega > 0) {
      partesAgrega.push(`${nOmitidosAgrega} omitido${nOmitidosAgrega > 1 ? "s" : ""}`);
      totalOmitidosAgrega += nOmitidosAgrega;
    }

    const nOmitidosYaEstaba = omitidosYaEstaban.get(c)?.get(t)?.size || 0;
    if (nOmitidosYaEstaba > 0) {
      partesYaEstaba.push(`${nOmitidosYaEstaba} omitido${nOmitidosYaEstaba > 1 ? "s" : ""}`);
      totalOmitidosYaEstaba += nOmitidosYaEstaba;
    }

    filasTabla.push({
      claveCurso: c,
      curso: nombreCurso,
      tema: t,
      agrega: partesAgrega.join(", ") || "-",
      yaEstaba: partesYaEstaba.join(", ") || "-",
    });
  }

  return {
    ok: true,
    errores: [],
    temasAAgregar,
    omitidosAAgregar,
    filasTabla,
    totales: {
      temasAgrega: totalTemasAgrega,
      temasYaEstaba: totalTemasYaEstaba,
      omitidosAgrega: totalOmitidosAgrega,
      omitidosYaEstaba: totalOmitidosYaEstaba,
      totalCambios: totalTemasAgrega + totalOmitidosAgrega,
    },
  };
}

/**
 * Imprime la tabla formateada y los totales.
 */
export function imprimirResumen(plan) {
  console.log("\ncurso | tema | agrega | ya estaba");
  console.log("--------------------------------------------------------------------------------");
  for (const f of plan.filasTabla) {
    console.log(`${f.curso} | ${f.tema} | ${f.agrega} | ${f.yaEstaba}`);
  }
  console.log("--------------------------------------------------------------------------------");
  console.log(
    `Totales a agregar: ${plan.totales.temasAgrega} tema${plan.totales.temasAgrega === 1 ? ' "-"' : 's "-"'}` +
    `, ${plan.totales.omitidosAgrega} omitido${plan.totales.omitidosAgrega === 1 ? "" : "s"}`
  );
  console.log(
    `Totales ya existentes: ${plan.totales.temasYaEstaba} tema${plan.totales.temasYaEstaba === 1 ? ' "-"' : 's "-"'}` +
    `, ${plan.totales.omitidosYaEstaba} omitido${plan.totales.omitidosYaEstaba === 1 ? "" : "s"}`
  );
}

/**
 * Función principal que ejecuta la migración.
 */
export async function ejecutarMigracion(opciones = parseArgs()) {
  const opts = { ...opciones };

  if (!opts.tsv) {
    throw new Error("Debe especificar el directorio con los TSV usando --tsv <dir>.");
  }

  const rutaTemas = path.join(opts.tsv, "temas.tsv");
  const rutaArchivos = path.join(opts.tsv, "archivos.tsv");

  if (!fs.existsSync(rutaTemas)) {
    throw new Error(`No se encontró temas.tsv en ${opts.tsv}`);
  }
  if (!fs.existsSync(rutaArchivos)) {
    throw new Error(`No se encontró archivos.tsv en ${opts.tsv}`);
  }

  const datosTemas = parsearTsv(rutaTemas);
  const datosArchivos = parsearTsv(rutaArchivos);

  // Determinar raíz del índice
  const rutaIndiceAbs = path.resolve(opts.indice);
  const raiz = fs.existsSync(rutaIndiceAbs) && fs.statSync(rutaIndiceAbs).isDirectory()
    ? rutaIndiceAbs
    : path.dirname(rutaIndiceAbs);

  const rutaArchivoIndice = path.join(raiz, NOMBRE_INDICE);
  if (!fs.existsSync(rutaArchivoIndice)) {
    throw new Error(`No se encontró el índice en ${rutaArchivoIndice}`);
  }

  const indiceActual = await leerIndice(raiz);
  const plan = calcularMigracion(indiceActual, datosTemas, datosArchivos);

  if (!plan.ok) {
    console.error("\n[ERROR] No se pudo migrar:");
    for (const err of plan.errores) {
      console.error(`- ${err}`);
    }
    throw new Error(`Validación fallida: ${plan.errores.join("; ")}`);
  }

  imprimirResumen(plan);

  if (!opts.escribir) {
    console.log("\n[ENSAYO] Modo ensayo: no se escribieron cambios (usar --escribir para aplicar).\n");
    return plan;
  }

  if (plan.totales.totalCambios === 0) {
    console.log("\n[ESCRITURA] 0 cambios: el índice ya está al día (idempotente).\n");
    return plan;
  }

  await modificarIndice(raiz, (indice) => {
    // Aplicar temas
    for (const [claveCurso, setTemas] of plan.temasAAgregar) {
      if (!indice.cursos[claveCurso].temas) {
        indice.cursos[claveCurso].temas = {};
      }
      for (const t of setTemas) {
        if (!(t in indice.cursos[claveCurso].temas)) {
          indice.cursos[claveCurso].temas[t] = "-";
        }
      }
    }

    // Aplicar omitidos
    for (const [claveCurso, mapTemas] of plan.omitidosAAgregar) {
      if (!indice.cursos[claveCurso].omitidos) {
        indice.cursos[claveCurso].omitidos = [];
      }
      for (const setClaves of mapTemas.values()) {
        for (const clave of setClaves) {
          if (!indice.cursos[claveCurso].omitidos.includes(clave)) {
            indice.cursos[claveCurso].omitidos.push(clave);
          }
        }
      }
    }
  });

  console.log(`\n[ESCRITURA] Se actualizó el índice en ${rutaArchivoIndice}.\n`);
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ejecutarMigracion().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
