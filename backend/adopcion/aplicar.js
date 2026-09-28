import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { sanitizarNombreArchivo } from "../utils.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";
import { DESTINOS, resolverCarpeta } from "../../core/destino/carpetas.ts";
import { buscarChoques } from "../../core/destino/choques.ts";
import { RAIZ_FACULTAD } from "./raiz.js";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    raiz: RAIZ_FACULTAD,
    salida: path.join(os.homedir(), "Descargas/adopcion-classroom"),
    escribir: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--raiz" && args[i + 1]) {
      opts.raiz = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--salida" && args[i + 1]) {
      opts.salida = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--escribir") {
      opts.escribir = true;
    }
  }

  return opts;
}

function parsearTsv(rutaArchivo) {
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

function recorrerArchivos(directorio) {
  const archivos = [];
  if (!fs.existsSync(directorio)) {
    return archivos;
  }
  const entradas = fs.readdirSync(directorio, { withFileTypes: true });
  for (const entrada of entradas) {
    const rutaCompleta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      archivos.push(...recorrerArchivos(rutaCompleta));
    } else if (entrada.isFile()) {
      archivos.push(rutaCompleta);
    }
  }
  return archivos;
}

function esDestinoSeguro(raiz, destinoAbs) {
  const raizNorm = path.resolve(raiz);
  const destNorm = path.resolve(destinoAbs);
  const prefijo = raizNorm.endsWith(path.sep) ? raizNorm : raizNorm + path.sep;
  return destNorm.startsWith(prefijo);
}

export function ejecutarAplicar(opts = parseArgs()) {
  console.log(`=== Adopción Classroom — Aplicar (${opts.escribir ? "ESCRITURA REAL" : "ENSAYO"}) ===`);
  console.log(`Raíz: ${opts.raiz}`);
  console.log(`Directorio TSV: ${opts.salida}`);

  const rutaIndice = path.join(opts.raiz, NOMBRE_INDICE);
  const errores = [];

  // 1. Validaciones
  // - El índice .course-downloader.json ya existe -> abortar
  if (fs.existsSync(rutaIndice)) {
    errores.push(`El índice ${rutaIndice} ya existe. La adopción es de una sola vez y no pisa índices existentes (RN-25, RN-26).`);
  }


  // Cargar TSVs
  let datosCursos, datosTemas, datosArchivos;
  try {
    datosCursos = parsearTsv(path.join(opts.salida, "cursos.tsv"));
    datosTemas = parsearTsv(path.join(opts.salida, "temas.tsv"));
    datosArchivos = parsearTsv(path.join(opts.salida, "archivos.tsv"));
  } catch (e) {
    errores.push(e instanceof Error ? e.message : String(e));
    console.error("Errores encontrados antes de procesar:");
    for (const err of errores) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const mapCursos = new Map();
  for (const c of datosCursos.filas) {
    mapCursos.set(c.clave_curso, c);
    // Cada materia no vacía existe como carpeta bajo la raíz (RN-1)
    if (c.materia && c.materia.trim().length > 0) {
      const rutaMateria = path.join(opts.raiz, c.materia);
      if (!fs.existsSync(rutaMateria) || !fs.statSync(rutaMateria).isDirectory()) {
        errores.push(`La carpeta de materia ${rutaMateria} no existe en disco (RN-1).`);
      }
    }
  }

  const mapTemas = new Map();
  const setDestinosPermitidos = new Set([...DESTINOS, "-"]);
  for (const t of datosTemas.filas) {
    // Cada destino de temas.tsv está en DESTINOS o es -
    if (!setDestinosPermitidos.has(t.destino)) {
      errores.push(
        `Destino inválido '${t.destino}' en temas.tsv para el tema '${t.tema}' del curso '${t.clave_curso}'.`
      );
    }
    mapTemas.set(`${t.clave_curso}\t${t.tema}`, t.destino);
  }

  // Re-indexar md5 del árbol para verificar que 'ya-esta' y 'duplicado' coincidan con la realidad
  const mapMd5Arbol = new Map();
  const materiasRevisadas = new Set(
    datosCursos.filas.map((c) => c.materia).filter(Boolean)
  );

  for (const materia of materiasRevisadas) {
    const dirMateria = path.join(opts.raiz, materia);
    const archivosEnMateria = recorrerArchivos(dirMateria);
    for (const arch of archivosEnMateria) {
      try {
        const buf = fs.readFileSync(arch);
        const hash = crypto.createHash("md5").update(buf).digest("hex").toLowerCase();
        const rel = path.relative(opts.raiz, arch);
        const arr = mapMd5Arbol.get(hash) || [];
        arr.push(rel);
        mapMd5Arbol.set(hash, arr);
      } catch {
        // Ignorar
      }
    }
  }

  // Identificar destinos que esta misma adopción propone para 'copiar', a fin de no tomarlos como 'ya-esta' en reintentos
  const destinosPropios = new Set();
  for (const fila of datosArchivos.filas) {
    if (fila.accion === "copiar") {
      const curso = mapCursos.get(fila.clave_curso);
      if (curso && curso.materia) {
        const destinoTema = mapTemas.get(`${fila.clave_curso}\t${fila.tema}`);
        if (destinoTema && destinoTema !== "-") {
          const carpeta = resolverCarpeta(destinoTema, curso.docente);
          destinosPropios.add(path.join(curso.materia, carpeta, fila.nombre));
        }
      }
    }
  }

  const filasParaChoques = [];
  const filasProcesadas = [];
  const vistosMd5 = new Map();

  for (const fila of datosArchivos.filas) {
    const curso = mapCursos.get(fila.clave_curso);
    if (!curso) {
      errores.push(`Archivo ${fila.clave} referencia clave_curso desconocida '${fila.clave_curso}'.`);
      continue;
    }

    // Releer md5 del archivo origen
    if (!fs.existsSync(fila.origen)) {
      errores.push(`No existe el archivo origen: ${fila.origen}`);
      continue;
    }

    const md5Real = crypto.createHash("md5").update(fs.readFileSync(fila.origen)).digest("hex").toLowerCase();
    if (md5Real !== fila.md5.toLowerCase()) {
      errores.push(
        `El md5 del archivo ${fila.origen} (${md5Real}) difiere del registrado en archivos.tsv (${fila.md5}).`
      );
    }

    const destinoTema = mapTemas.get(`${fila.clave_curso}\t${fila.tema}`);
    if (destinoTema === undefined) {
      errores.push(`Tema '${fila.tema}' del curso '${fila.clave_curso}' no figura en temas.tsv.`);
    }

    // Recalcular estado esperado
    const enMateria = curso.materia
      ? (mapMd5Arbol.get(md5Real) || [])
          .filter((r) => r.startsWith(curso.materia + path.sep))
          .filter((r) => !destinosPropios.has(r))
      : [];

    let accionEsperada = "";
    let carpetaEsperada = "";
    let nombreEsperado = "";

    if (enMateria.length > 0) {
      enMateria.sort();
      const yaRuta = enMateria[0];
      nombreEsperado = path.basename(yaRuta);
      carpetaEsperada = path.relative(curso.materia, path.dirname(yaRuta)) || ".";
      accionEsperada = "ya-esta";
    } else if (vistosMd5.has(md5Real)) {
      accionEsperada = "duplicado";
    }

    // Validar que filas ya-esta y duplicado no hayan cambiado
    if (accionEsperada === "ya-esta") {
      if (fila.accion !== accionEsperada) {
        errores.push(
          `La fila ${fila.clave} es '${accionEsperada}' pero en archivos.tsv tiene accion='${fila.accion}'. No se puede modificar.`
        );
      }
      if (fila.carpeta !== carpetaEsperada) {
        errores.push(
          `La fila ${fila.clave} es '${accionEsperada}' pero su carpeta '${fila.carpeta}' difiere de la esperada '${carpetaEsperada}'.`
        );
      }
      if (fila.nombre !== nombreEsperado) {
        errores.push(
          `La fila ${fila.clave} es '${accionEsperada}' pero su nombre '${fila.nombre}' difiere del esperado '${nombreEsperado}'.`
        );
      }
    } else if (accionEsperada === "duplicado") {
      if (fila.accion !== "duplicado") {
        errores.push(
          `La fila ${fila.clave} es 'duplicado' pero en archivos.tsv tiene accion='${fila.accion}'. No se puede modificar.`
        );
      }
    } else {
      // Fila no es ya-esta ni duplicado en el árbol: no puede ser declarada como tal en TSV
      if (fila.accion === "ya-esta" || fila.accion === "duplicado") {
        errores.push(
          `La fila ${fila.clave} fue marcada como '${fila.accion}' pero no corresponde a un archivo existente en el árbol ni a un duplicado previo.`
        );
      }
    }

    if (accionEsperada === "duplicado") {
      const primera = vistosMd5.get(md5Real);
      const itemProcesado = {
        ...fila,
        accion: primera.accion === "omitir" ? "omitir" : "duplicado",
        carpeta: primera.carpeta,
        nombre: primera.nombre,
        rutaDestinoRel: primera.rutaDestinoRel,
      };
      filasProcesadas.push(itemProcesado);
      continue;
    }

    // Recalcular carpeta y validar según accion
    let carpetaRecalculada = fila.carpeta;
    let accionFinal = fila.accion;

    if (accionFinal === "copiar" || accionFinal === "omitir") {
      if (destinoTema === "-") {
        accionFinal = "omitir";
      } else if (destinoTema) {
        carpetaRecalculada = resolverCarpeta(destinoTema, curso.docente);
      }
    }

    // Validar nombre en filas copiar
    if (accionFinal === "copiar") {
      if (!fila.nombre || fila.nombre.trim().length === 0) {
        errores.push(`Fila ${fila.clave} tiene nombre vacío en archivos.tsv.`);
      } else if (fila.nombre.includes("/") || fila.nombre.includes("\\")) {
        errores.push(`Fila ${fila.clave} contiene barras (/ o \\) en el nombre: '${fila.nombre}'.`);
      } else {
        const sanitizado = sanitizarNombreArchivo(fila.nombre);
        if (sanitizado !== fila.nombre) {
          errores.push(
            `Fila ${fila.clave}: nombre '${fila.nombre}' no coincide con su sanitizado. Quedaría '${sanitizado}'.`
          );
        }
      }
    }

    // Determinar rutaDestinoRel (relativa a raíz)
    let rutaDestinoRel = "";
    if (accionFinal === "copiar" || accionFinal === "omitir") {
      if (!curso.materia) {
        if (accionFinal === "copiar") {
          errores.push(`Fila ${fila.clave} marcada para 'copiar' pertenece al curso '${curso.nombre}' sin materia asignada (RN-2).`);
        }
      } else {
        rutaDestinoRel = carpetaRecalculada === "." ? curso.materia : path.join(curso.materia, carpetaRecalculada);
      }
    } else {
      // ya-esta
      rutaDestinoRel = fila.carpeta === "." ? curso.materia : path.join(curso.materia, fila.carpeta);
    }

    // Chequeo de seguridad de ruta
    if (rutaDestinoRel) {
      const rutaDestinoAbs = path.join(opts.raiz, rutaDestinoRel, fila.nombre);
      if (!esDestinoSeguro(opts.raiz, rutaDestinoAbs)) {
        errores.push(`Ruta de destino insegura (escapa de la raíz): ${rutaDestinoAbs}`);
      }

      // Si una fila 'copiar' ya existe en disco:
      if (accionFinal === "copiar" && fs.existsSync(rutaDestinoAbs)) {
        const md5Dest = crypto.createHash("md5").update(fs.readFileSync(rutaDestinoAbs)).digest("hex").toLowerCase();
        if (md5Dest === md5Real) {
          console.log(`Información: destino ${rutaDestinoRel}/${fila.nombre} ya existe con el mismo md5; pasa a 'ya-esta'.`);
          accionFinal = "ya-esta";
        } else {
          errores.push(
            `Destino ${rutaDestinoRel}/${fila.nombre} ya existe en disco pero su md5 difiere de ${fila.origen}.`
          );
        }
      }
    }

    const itemProcesado = {
      ...fila,
      accion: accionFinal,
      carpeta: carpetaRecalculada,
      rutaDestinoRel,
    };
    filasProcesadas.push(itemProcesado);

    if (!vistosMd5.has(md5Real)) {
      vistosMd5.set(md5Real, itemProcesado);
    }

    if (accionFinal === "copiar" || accionFinal === "ya-esta") {
      filasParaChoques.push({
        clave: fila.clave,
        ruta: rutaDestinoRel,
        nombre: fila.nombre,
        md5: md5Real,
      });
    }
  }

  // Choques
  const choques = buscarChoques(filasParaChoques);
  if (choques.length > 0) {
    for (const ch of choques) {
      errores.push(
        `Choque detectado en ${ch.ruta}/${ch.nombre} entre ${ch.filas.length} archivos con distinto md5.`
      );
    }
  }

  if (errores.length > 0) {
    console.error(`\nSe encontraron ${errores.length} error(es) de validación. No se realiza ninguna modificación:`);
    for (const err of errores) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log("Validaciones superadas exitosamente.");

  // Estadísticas
  const stats = {
    copiados: 0,
    yaEsta: 0,
    duplicados: 0,
    omitidos: 0,
    carpetasCreadas: new Set(),
  };

  for (const f of filasProcesadas) {
    if (f.accion === "copiar") stats.copiados++;
    else if (f.accion === "ya-esta") stats.yaEsta++;
    else if (f.accion === "duplicado") stats.duplicados++;
    else if (f.accion === "omitir") stats.omitidos++;
  }

  if (!opts.escribir) {
    console.log("\nModo ENSAYO (sin --escribir). Resumen de lo que se realizaría:");
    console.log(`  - A copiar: ${stats.copiados}`);
    console.log(`  - Ya existentes (ya-esta): ${stats.yaEsta}`);
    console.log(`  - Duplicados en lista: ${stats.duplicados}`);
    console.log(`  - Omitidos: ${stats.omitidos}`);
    console.log(`  - Índice a crear: ${rutaIndice}`);
    console.log("Para escribir los cambios en disco, ejecutar con --escribir.");
    return;
  }

  // 2. Escritura (--escribir)
  console.log("\nIniciando escritura en disco...");

  // Copia de archivos
  for (const f of filasProcesadas) {
    if (f.accion === "copiar") {
      const dirDestino = path.join(opts.raiz, f.rutaDestinoRel);
      if (!fs.existsSync(dirDestino)) {
        fs.mkdirSync(dirDestino, { recursive: true });
        stats.carpetasCreadas.add(dirDestino);
      }
      const archDestino = path.join(dirDestino, f.nombre);

      fs.copyFileSync(f.origen, archDestino, fs.constants.COPYFILE_EXCL);

      // Releer md5 en destino
      const md5Destino = crypto.createHash("md5").update(fs.readFileSync(archDestino)).digest("hex").toLowerCase();
      if (md5Destino !== f.md5.toLowerCase()) {
        throw new Error(
          `Error crítico: md5 en destino (${md5Destino}) no coincide con origen (${f.md5}) en ${archDestino}. Proceso abortado sin escribir índice.`
        );
      }
    }
  }

  // Armar índice .course-downloader.json
  const indice = {
    version: 1,
    cursos: {},
    archivos: {},
  };

  for (const [claveCurso, curso] of mapCursos.entries()) {
    if (curso.materia && curso.materia.trim().length > 0) {
      const temasCurso = {};
      for (const [parKey, destino] of mapTemas.entries()) {
        const [cKey, tema] = parKey.split("\t");
        if (cKey === claveCurso) {
          if (destino !== "-") {
            temasCurso[tema] = resolverCarpeta(destino, curso.docente);
          }
        }
      }
      indice.cursos[claveCurso] = {
        nombre: curso.nombre,
        materia: curso.materia,
        docente: curso.docente,
        temas: temasCurso,
      };
    }
  }

  for (const f of filasProcesadas) {
    if (f.accion === "copiar" || f.accion === "ya-esta" || f.accion === "duplicado") {
      const rutaRelativa = f.rutaDestinoRel.replace(/\/+$/, "");
      indice.archivos[f.clave] = {
        curso: f.clave_curso,
        nombre: f.nombre,
        ruta: rutaRelativa,
        md5: f.md5,
        original: f.original,
      };
    }
  }

  const jsonIndice = serializarIndice(indice);
  const rutaTmp = path.join(opts.raiz, `${NOMBRE_INDICE}.tmp`);
  fs.writeFileSync(rutaTmp, jsonIndice, "utf8");
  fs.renameSync(rutaTmp, rutaIndice);


  console.log("\n=== Resumen de Escritura Finalizada ===");
  console.log(`Archivos copiados: ${stats.copiados}`);
  console.log(`Archivos ya-esta: ${stats.yaEsta}`);
  console.log(`Archivos duplicados: ${stats.duplicados}`);
  console.log(`Archivos omitidos: ${stats.omitidos}`);
  console.log(`Carpetas creadas: ${stats.carpetasCreadas.size}`);
  console.log(`Índice generado: ${rutaIndice}`);
}

// Ejecutar si se invoca directamente desde CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  ejecutarAplicar();
}
