import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { sanitizarNombreArchivo } from "../utils.js";
import { sanearNombreCarpeta } from "../../core/util/texto.ts";
import { claveCurso, claveArchivo } from "../../core/destino/indice.ts";
import { sugerirDestino, resolverCarpeta } from "../../core/destino/carpetas.ts";
import { proponerNombre } from "../../core/destino/nombres.ts";
import { buscarChoques } from "../../core/destino/choques.ts";
import { leerUltimoValor } from "./leerStorage.js";

export const SEMILLA = {
  fisica_ii_g22_2026_2do_cuatrimestre_facultad_de_ingenieria_unlp: {
    materia: "Ingenieria/Fisica 2",
    docente: "Palacio",
  },
  fisica_ii_g25_2026: {
    materia: "Ingenieria/Fisica 2",
    docente: "Bianchi",
  },
  "2026_2c_mc6_mate_c": {
    materia: "Ingenieria/Matematica C",
    docente: "Bava",
  },
  mc2_2025: {
    materia: "Ingenieria/Matematica C",
    docente: "Rey Grange",
  },
  mb5_2024: {
    materia: "Ingenieria/Matematica B",
    docente: "",
  },
  fisica_i_grupo_g_ing_2024: {
    materia: "Ingenieria/Fisica 1",
    docente: "",
  },
  q5_primer_cuatrimestre_2023: {
    materia: "",
    docente: "",
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    storage: path.join(
      os.homedir(),
      ".config/BraveSoftware/Brave-Browser/Default/Local Extension Settings/daameiendaidaagnimcbpmdjkpccfemh"
    ),
    origen: path.join(os.homedir(), "Descargas/verificacion-b/google-classroom"),
    raiz: path.join(os.homedir(), "U.N.L.P"),
    salida: path.join(os.homedir(), "Descargas/adopcion-classroom"),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--storage" && args[i + 1]) {
      opts.storage = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--origen" && args[i + 1]) {
      opts.origen = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--raiz" && args[i + 1]) {
      opts.raiz = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    } else if (args[i] === "--salida" && args[i + 1]) {
      opts.salida = args[++i].replace(/^~(?=$|\/)/, os.homedir());
    }
  }

  return opts;
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

export function ejecutarGenerar(opts = parseArgs()) {
  // 1. Leer recorridoTodos y listaPersistente
  const recorridoTodos = leerUltimoValor(
    opts.storage,
    "recorridoTodos",
    (r) => r && Array.isArray(r.cursos) && r.cursos.length > 0
  );
  const lista = leerUltimoValor(
    opts.storage,
    "listaPersistente",
    (l) => Array.isArray(l)
  );

  if (!recorridoTodos || !lista) {
    console.error("Error: no se encontró recorridoTodos o listaPersistente en el storage.");
    console.error("volvé a correr 'Escanear todos los cursos' y repetí");
    process.exit(1);
  }

  // 2. Exigir que cada item.carpeta sea sanearNombreCarpeta de algún curso
  const carpetasValidas = new Map();
  for (const c of recorridoTodos.cursos) {
    carpetasValidas.set(sanearNombreCarpeta(c.nombre), c);
  }

  const carpetasEnLista = new Set(lista.map((i) => i.carpeta));
  const huerfanas = [...carpetasEnLista].filter((c) => !carpetasValidas.has(c));

  if (huerfanas.length > 0) {
    console.error("Error: se encontraron carpetas huérfanas en la lista:", huerfanas);
    process.exit(1);
  }

  const cursosOk = recorridoTodos.cursos.filter((c) => c.resultado === "ok");
  if (carpetasEnLista.size === 1 && cursosOk.length > 1) {
    console.error("Error: la última lista es de un solo curso: corré 'Escanear todos los cursos'");
    process.exit(1);
  }

  // 3. Verificar origen y calcular md5 por ítem
  const faltantes = [];
  const itemsConMd5 = [];

  for (const item of lista) {
    const nombreEnDisco = sanitizarNombreArchivo(item.titulo);
    const rutaOrigen = path.join(opts.origen, item.carpeta, nombreEnDisco);

    if (!fs.existsSync(rutaOrigen)) {
      faltantes.push({ carpeta: item.carpeta, titulo: item.titulo, ruta: rutaOrigen });
    } else {
      const buf = fs.readFileSync(rutaOrigen);
      const md5 = crypto.createHash("md5").update(buf).digest("hex");
      itemsConMd5.push({ item, origen: rutaOrigen, md5 });
    }
  }

  if (faltantes.length > 0) {
    console.error(`Error: faltan ${faltantes.length} archivos en origen:`);
    for (const f of faltantes) {
      console.error(`  - [${f.carpeta}] ${f.titulo} -> ${f.ruta}`);
    }
    process.exit(1);
  }

  // 4. Índice md5 del árbol en raiz/materia
  const mapMd5Arbol = new Map();
  const materiasRevisadas = new Set(
    Object.values(SEMILLA)
      .map((s) => s.materia)
      .filter(Boolean)
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
        // Ignorar archivos no legibles
      }
    }
  }

  // 5. Preparar TSVs
  fs.mkdirSync(opts.salida, { recursive: true });

  // 5.a cursos.tsv
  const lineasCursos = [
    "# Semántica de edición:",
    "# - Podés editar 'materia' y 'docente'.",
    "# - Cambiar el docente actualiza automáticamente la carpeta de Teorias para las filas 'copiar'.",
    "clave_curso\tnombre\tcarpeta\tmateria\tdocente\titems",
  ];

  const conteoPorCurso = new Map();
  for (const { item } of itemsConMd5) {
    conteoPorCurso.set(item.carpeta, (conteoPorCurso.get(item.carpeta) || 0) + 1);
  }

  for (const curso of recorridoTodos.cursos) {
    const cCarpeta = sanearNombreCarpeta(curso.nombre);
    const sem = SEMILLA[cCarpeta] || { materia: "", docente: "" };
    const cKey = claveCurso("google-classroom", curso.id);
    const cant = conteoPorCurso.get(cCarpeta) || 0;
    lineasCursos.push(`${cKey}\t${curso.nombre}\t${cCarpeta}\t${sem.materia}\t${sem.docente}\t${cant}`);
  }

  fs.writeFileSync(path.join(opts.salida, "cursos.tsv"), lineasCursos.join("\n") + "\n", "utf8");

  // 5.b temas.tsv
  const lineasTemas = [
    "# Semántica de edición:",
    "# - Podés editar 'destino' (uno de DESTINOS: ., Teorias, Practicas, Laboratorios, Parciales, Finales, Bibliografia)",
    "# - O fijar destino en '-' para omitir el tema completo.",
    "clave_curso\ttema\tdestino\tregla\titems",
  ];

  const paresTemaCurso = new Map();
  for (const { item } of itemsConMd5) {
    const c = carpetasValidas.get(item.carpeta);
    const cKey = claveCurso("google-classroom", c ? c.id : "");
    const partes = (item.modulo || "").split(" › ");
    const tema = partes.length > 1 ? partes.slice(1).join(" › ") : (item.modulo || "Sin tema");
    const parKey = `${cKey}\t${tema}`;
    let entrada = paresTemaCurso.get(parKey);
    if (!entrada) {
      entrada = { cant: 0, publicaciones: [] };
      paresTemaCurso.set(parKey, entrada);
    }
    entrada.cant++;
    entrada.publicaciones.push(item.publicacion ?? "");
  }

  const sugerenciasPorPar = new Map();
  let temasSinRegla = 0;
  for (const [parKey, { cant, publicaciones }] of paresTemaCurso.entries()) {
    const [cKey, tema] = parKey.split("\t");
    const sugerencia = sugerirDestino(tema, publicaciones);
    sugerenciasPorPar.set(parKey, sugerencia);
    if (!sugerencia.regla) temasSinRegla++;
    lineasTemas.push(`${cKey}\t${tema}\t${sugerencia.destino}\t${sugerencia.regla ? "si" : "no"}\t${cant}`);
  }

  fs.writeFileSync(path.join(opts.salida, "temas.tsv"), lineasTemas.join("\n") + "\n", "utf8");

  // 5.c archivos.tsv
  const lineasArchivos = [
    "# Semántica de edición:",
    "# - En archivos.tsv podés editar 'nombre' y 'accion' ('copiar' <-> 'omitir').",
    "# - 'ya-esta' no se modifica. 'duplicado' sigue a la primera fila con su md5: si a esa le cambiás nombre o acción, el duplicado la acompaña.",
    "# - 'carpeta' es informativa: 'aplicar' la recalcula desde cursos.tsv y temas.tsv.",
    "clave\tclave_curso\ttema\taccion\tcarpeta\tnombre\toriginal\torigen\tmd5",
  ];

  const filasParaChoques = [];
  const vistosMd5 = new Map();
  const conteoPorAccion = { "ya-esta": 0, duplicado: 0, omitir: 0, copiar: 0 };

  for (const { item, origen, md5 } of itemsConMd5) {
    const c = carpetasValidas.get(item.carpeta);
    const cKey = claveCurso("google-classroom", c ? c.id : "");
    const partes = (item.modulo || "").split(" › ");
    const tema = partes.length > 1 ? partes.slice(1).join(" › ") : (item.modulo || "Sin tema");
    const parKey = `${cKey}\t${tema}`;
    const clave = claveArchivo(item.sitioId || "google-classroom", item.idArchivo);
    const sem = SEMILLA[item.carpeta] || { materia: "", docente: "" };
    const { destino } = sugerenciasPorPar.get(parKey) || { destino: ".", regla: false };

    let accion = "";
    let carpeta = "";
    let nombre = "";

    // 1. ya-esta
    const enMateria = sem.materia
      ? (mapMd5Arbol.get(md5.toLowerCase()) || []).filter((r) => r.startsWith(sem.materia + path.sep))
      : [];

    if (enMateria.length > 0) {
      enMateria.sort();
      const yaRuta = enMateria[0];
      nombre = path.basename(yaRuta);
      const dirRel = path.relative(sem.materia, path.dirname(yaRuta));
      carpeta = dirRel || ".";
      accion = "ya-esta";
    } else if (vistosMd5.has(md5.toLowerCase())) {
      // 2. duplicado
      const primera = vistosMd5.get(md5.toLowerCase());
      carpeta = primera.carpeta;
      nombre = primera.nombre;
      accion = "duplicado";
    } else if (/cronograma/i.test(tema)) {
      // 3. omitir
      accion = "omitir";
      carpeta = resolverCarpeta(destino, sem.docente);
      nombre = proponerNombre({ original: item.titulo, tema, docente: sem.docente });
    } else {
      // 4. copiar
      accion = "copiar";
      carpeta = resolverCarpeta(destino, sem.docente);
      nombre = proponerNombre({ original: item.titulo, tema, docente: sem.docente });
    }

    if (!vistosMd5.has(md5.toLowerCase())) {
      vistosMd5.set(md5.toLowerCase(), { carpeta, nombre });
    }

    conteoPorAccion[accion]++;

    lineasArchivos.push(
      `${clave}\t${cKey}\t${tema}\t${accion}\t${carpeta}\t${nombre}\t${item.titulo}\t${origen}\t${md5}`
    );

    if (accion === "copiar" || accion === "ya-esta") {
      const rutaCompletaRel = sem.materia ? path.join(sem.materia, carpeta) : carpeta;
      filasParaChoques.push({
        clave,
        ruta: rutaCompletaRel,
        nombre,
        md5,
      });
    }
  }

  fs.writeFileSync(path.join(opts.salida, "archivos.tsv"), lineasArchivos.join("\n") + "\n", "utf8");

  // 6. Resumen por consola
  const choques = buscarChoques(filasParaChoques);

  console.log("=== Resumen de Generación ===");
  console.log("Cursos en recorrido:", recorridoTodos.cursos.length);
  console.log("Ítems en lista:", itemsConMd5.length);
  console.log("Ítems por curso:");
  for (const [cCarpeta, cant] of conteoPorCurso.entries()) {
    console.log(`  - ${cCarpeta}: ${cant}`);
  }
  console.log("Ítems por acción:");
  for (const [acc, cant] of Object.entries(conteoPorAccion)) {
    console.log(`  - ${acc}: ${cant}`);
  }
  console.log("Temas con regla=no:", temasSinRegla);
  const nSinPub = itemsConMd5.filter(({ item }) => !item.publicacion || !item.publicacion.trim()).length;
  console.log("Ítems sin título de publicación:", nSinPub);
  if (nSinPub === itemsConMd5.length) {
    console.log("  ! La lista es anterior al campo 'publicacion': re-escaneá todos los cursos.");
  }
  console.log("Choques detectados:", choques.length);
  if (choques.length > 0) {
    for (const ch of choques) {
      console.log(`  ! Choque en ${ch.ruta}/${ch.nombre} (${ch.filas.length} archivos con distinto md5)`);
    }
  }
  console.log(`Archivos TSV escritos en: ${opts.salida}`);
}

// Ejecutar si se invoca directamente desde CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  ejecutarGenerar();
}
