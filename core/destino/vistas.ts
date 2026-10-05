/**
 * VISTAS Y CONVERSIÓN BIDIRECCIONAL ENTRE EL ÍNDICE Y EL EDITOR WEB (V1.0.0)
 * ==========================================================================
 * Implementa la transformación entre el índice real (.course-downloader.json)
 * y las tres tablas que consume y envía el editor web (cursos, temas, archivos).
 * Pura, sin fs (D-1, D-2, D-3, D-4, D-6, D-7).
 */

import { DESTINOS, resolverCarpeta, sugerirDestino, nombreSubcarpetaTema } from "./carpetas";
import { claveCurso } from "./indice";
import type { Indice, CursoIndice } from "./indice";
import { proponerParaCurso } from "./propuesta";
import type { ItemEntradaPropuesta } from "./propuesta";
import { proponerNombre } from "./nombres";
import { nombreEnDisco } from "../util/texto";
import { claveEsVideollamada } from "./videollamada";

export interface FilaCursoEditor {
  clave_curso: string;
  nombre: string;
  carpeta: string;
  materia: string;
  docente: string;
  items: string;
}

export interface FilaTemaEditor {
  clave_curso: string;
  tema: string;
  destino: string;
  regla: "si" | "no";
  items: string;
  editable?: boolean;
  subcarpeta?: "si" | "no";
}


export interface FilaArchivoEditor {
  clave: string;
  clave_curso: string;
  tema: string;
  accion: "copiar" | "omitir" | "ya-esta" | string;
  carpeta: string;
  nombre: string;
  original: string;
  origen: string;
  md5: string;
  destinoPropio?: string;
  movido?: boolean;
}

export interface FilasEditor {
  cursos: FilaCursoEditor[];
  temas: FilaTemaEditor[];
  archivos: FilaArchivoEditor[];
}

export interface ItemVisto extends ItemEntradaPropuesta {
  texto?: string;
  url?: string;
  href?: string;
  tipo?: string;
}

export interface VistoCurso {
  clave?: string;
  id?: string;
  idCurso?: string;
  sitio?: string;
  nombre?: string;
  items: ItemVisto[];
}

export type VistosInput =
  | VistoCurso[]
  | Record<string, VistoCurso>
  | Map<string, VistoCurso>;

export interface OpcionesIndiceAFilas {
  indice: Indice;
  vistos: VistosInput;
  claveCursoActivo?: string;
  sitioIdPorDefecto?: string;
  movidos?: Set<string>;
}

export interface OpcionesFilasAIndice {
  indice: Indice;
  filas: FilasEditor;
  vistos?: VistosInput;
  materiasValidas?: Set<string> | string[];
  sitioIdPorDefecto?: string;
}

export type ResultadoFilasAIndice =
  | { ok: true; indice: Indice }
  | { ok: false; errores: string[] };

/**
 * Calcula la inversa de `resolverCarpeta(destino, docente)` (D-6).
 * Si la carpeta no proviene de ningún destino estándar con ese docente,
 * se considera editada a mano y se marca como no editable.
 */
export function invertirCarpeta(
  carpeta: string,
  docente?: string | null,
  tema?: string | null
): { destino: string; editable: boolean; subcarpeta: boolean } {
  if (carpeta === "-") {
    return { destino: "-", editable: true, subcarpeta: false };
  }
  for (const d of DESTINOS) {
    if (resolverCarpeta(d, docente) === carpeta) {
      return { destino: d, editable: true, subcarpeta: false };
    }
  }
  if (tema) {
    for (const d of DESTINOS) {
      if (resolverCarpeta(d, docente, tema) === carpeta) {
        return { destino: d, editable: true, subcarpeta: true };
      }
    }
  }
  return { destino: carpeta, editable: false, subcarpeta: false };
}


export function esDestinoSeguro(destino: string): boolean {
  if (destino === "-" || destino === ".") return true;
  if (!destino || destino.trim().length === 0) return false;
  if (/[\0-\x1f\x7f\t\r\n]/.test(destino)) return false;
  if (destino.includes("..")) return false;
  if (destino.startsWith("/") || destino.startsWith("\\")) return false;
  return true;
}

export function esMateriaSintacticamenteSegura(materia: string): boolean {
  if (!materia || typeof materia !== "string") return false;
  if (/[\0-\x1f\x7f\t\r\n]/.test(materia)) return false;
  if (materia.includes("\\")) return false;
  const partes = materia.split("/");
  if (partes.length !== 2) return false;
  const [carrera, nombre] = partes;
  if (!carrera || !nombre) return false;
  if (carrera.trim().length === 0 || nombre.trim().length === 0) return false;
  if (carrera === "." || carrera === "-" || nombre === "." || nombre === "-") return false;
  return esDestinoSeguro(carrera) && esDestinoSeguro(nombre);
}

export function normalizarVistos(vistos: VistosInput): Map<string, VistoCurso> {
  const mapa = new Map<string, VistoCurso>();
  if (!vistos) return mapa;
  if (vistos instanceof Map) {
    for (const [k, v] of vistos.entries()) {
      mapa.set(k, { ...v, clave: v.clave || k });
    }
    return mapa;
  }
  if (Array.isArray(vistos)) {
    for (const v of vistos) {
      const sitio = v.sitio || "google-classroom";
      const id = v.id || v.idCurso;
      const k = v.clave || (id ? claveCurso(sitio, id) : "");
      if (k) mapa.set(k, { ...v, clave: k });
    }
    return mapa;
  }
  for (const [k, v] of Object.entries(vistos)) {
    mapa.set(k, { ...v, clave: v.clave || k });
  }
  return mapa;
}

/**
 * Convierte el índice y los cursos vistos en las tres tablas que espera el editor (H-3).
 */
export function indiceAFilasEditor({
  indice,
  vistos,
  claveCursoActivo: _claveCursoActivo,
  sitioIdPorDefecto = "google-classroom",
  movidos,
}: OpcionesIndiceAFilas): FilasEditor {
  const mapaVistos = normalizarVistos(vistos);
  const cursos: FilaCursoEditor[] = [];
  const temas: FilaTemaEditor[] = [];
  const archivos: FilaArchivoEditor[] = [];

  for (const [claveC, visto] of mapaVistos.entries()) {
    const cursoIndice = indice.cursos[claveC];
    const nombreCurso = cursoIndice?.nombre || visto.nombre || claveC;
    const materia = cursoIndice?.materia || "";
    const docente = cursoIndice?.docente || "";
    const itemsVistos = visto.items || [];

    cursos.push({
      clave_curso: claveC,
      nombre: nombreCurso,
      carpeta: cursoIndice?.materia || visto.nombre || "",
      materia,
      docente,
      items: String(itemsVistos.length),
    });

    // Recolectar temas de este curso
    const temasVistosSet = new Set<string>();
    if (cursoIndice?.temas) {
      for (const t of Object.keys(cursoIndice.temas)) {
        temasVistosSet.add(t);
      }
    }
    for (const it of itemsVistos) {
      const t = (it.tema || "").trim();
      if (t) temasVistosSet.add(t);
    }
    // Si no hay temas, asegurar al menos "." o Sin tema si hay items sin tema
    if (temasVistosSet.size === 0 && itemsVistos.length > 0) {
      temasVistosSet.add("");
    }

    // Convertir items a formato de propuesta
    const itemsEntrada: ItemEntradaPropuesta[] = itemsVistos.map((it) => ({
      idArchivo: it.idArchivo,
      original: it.original || it.texto || it.idArchivo,
      tema: it.tema,
      publicacion: it.publicacion,
      anuncio: it.anuncio,
      bytes: it.bytes,
      md5: it.md5,
    }));

    // Propuesta base para nombres y carpetas
    const propuestas = proponerParaCurso({
      curso: cursoIndice || null,
      items: itemsEntrada,
      archivos: indice.archivos,
      sitioId: visto.sitio || sitioIdPorDefecto,
    });

    for (const nombreTema of temasVistosSet) {
      const itemsDelTema = itemsVistos.filter((it) => (it.tema || "").trim() === nombreTema);

      let destino: string;
      let regla: "si" | "no";
      let editable = true;
      let subcarpeta: "si" | "no" = "no";

      if (cursoIndice && cursoIndice.temas && nombreTema in cursoIndice.temas) {
        const carpIndice = cursoIndice.temas[nombreTema]!;
        if (carpIndice === "-" || carpIndice === ".") {
          destino = carpIndice;
          regla = "si";
          subcarpeta = nombreSubcarpetaTema(nombreTema) !== "" ? "si" : "no";
        } else {
          const inv = invertirCarpeta(carpIndice, cursoIndice.docente, nombreTema);
          destino = inv.destino;
          regla = "si";
          editable = inv.editable;
          subcarpeta = inv.subcarpeta ? "si" : "no";
        }
      } else {
        const pubs = itemsDelTema.map((it) => it.publicacion || it.anuncio || "").filter(Boolean);
        const sug = sugerirDestino(nombreTema, pubs);
        destino = sug.destino;
        regla = sug.regla ? "si" : "no";
        subcarpeta = nombreSubcarpetaTema(nombreTema) !== "" ? "si" : "no";
      }

      temas.push({
        clave_curso: claveC,
        tema: nombreTema,
        destino,
        regla,
        items: String(itemsDelTema.length),
        editable,
        subcarpeta,
      });
    }

    // Archivos
    for (let i = 0; i < itemsVistos.length; i++) {
      const it = itemsVistos[i]!;
      const prop = propuestas[i]!;
      const clave = prop.clave;
      const temaStr = (it.tema || "").trim();
      const original = it.original || it.texto || it.idArchivo;
      const origen = it.url || it.href || "";

      let accion: "copiar" | "omitir" | "ya-esta";
      let carpeta: string;
      let nombre: string;
      let md5 = it.md5 || "";

      if (indice.archivos && indice.archivos[clave]) {
        const archExistente = indice.archivos[clave]!;
        accion = "ya-esta";
        nombre = archExistente.nombre;
        carpeta = archExistente.ruta;
        md5 = archExistente.md5;
      } else {
        const estaOmitido = prop.omitido;
        if (estaOmitido) {
          accion = "omitir";
          // Para mostrar en el editor si se desmarca
          nombre =
            cursoIndice?.nombres?.[clave] ||
            proponerNombre({ original, tema: temaStr, docente: cursoIndice?.docente });
          const temaFila = temas.find((t) => t.clave_curso === claveC && t.tema === temaStr);
          const destTema = temaFila && temaFila.destino !== "-" ? temaFila.destino : ".";
          const subTema = temaFila && temaFila.subcarpeta === "si" ? temaStr : null;
          carpeta = resolverCarpeta(destTema, cursoIndice?.docente, subTema);
        } else {
          accion = "copiar";
          nombre = prop.nombre || proponerNombre({ original, tema: temaStr, docente: cursoIndice?.docente });
          carpeta = prop.carpeta || ".";
        }


        if (cursoIndice?.carpetas?.[clave]) {
          carpeta = cursoIndice.carpetas[clave];
        }
      }

      let destinoPropio: string | undefined;
      if (cursoIndice?.carpetas?.[clave]) {
        destinoPropio = invertirCarpeta(cursoIndice.carpetas[clave], cursoIndice?.docente).destino;
      }

      const filaArch: FilaArchivoEditor = {
        clave,
        clave_curso: claveC,
        tema: temaStr,
        accion,
        carpeta,
        nombre,
        original,
        origen,
        md5,
        movido: Boolean(movidos && movidos.has(clave)),
      };
      if (destinoPropio !== undefined) {
        filaArch.destinoPropio = destinoPropio;
      }
      archivos.push(filaArch);
    }
  }

  return { cursos, temas, archivos };
}

/**
 * Normaliza la carpeta de un archivo para comparar ocupación en el editor.
 * Remueve el prefijo de materia si está presente y limpia barras finales.
 */
export function normalizarCarpetaOcupacion(carpeta: string | undefined | null, materia: string): string {
  let c = (carpeta || "").trim().replace(/\/+$/, "");
  const m = (materia || "").trim().replace(/\/+$/, "");
  if (m && (c === m || c.startsWith(`${m}/`))) {
    c = c.slice(m.length).replace(/^\/+/, "");
  }
  if (!c || c === ".") return ".";
  return c;
}

/**
 * Traduce las filas editadas de vuelta al índice (H-3).
 * Valida formatos, rechaza cambios prohibidos y preserva campos no editados.
 */
export function filasEditorAIndice({
  indice,
  filas,
  vistos,
  materiasValidas,
  sitioIdPorDefecto = "google-classroom",
}: OpcionesFilasAIndice): ResultadoFilasAIndice {
  const errores: string[] = [];
  const setMaterias = materiasValidas
    ? materiasValidas instanceof Set
      ? materiasValidas
      : new Set(materiasValidas)
    : null;

  // 1. Validar cursos
  for (const c of filas.cursos) {
    const materia = c.materia !== undefined ? String(c.materia) : "";
    const docente = c.docente !== undefined ? String(c.docente) : "";

    if (/[\t\r\n]/.test(materia) || /[\t\r\n]/.test(docente)) {
      errores.push(`Curso '${c.nombre}': contiene tabulaciones o saltos de línea.`);
    }
    if (docente.includes("/") || docente.includes("\\")) {
      errores.push(`Curso '${c.nombre}': docente contiene barras (/ o \\): '${docente}'.`);
    }
    const esSegura = esMateriaSintacticamenteSegura(materia);
    const estaEnDisco = setMaterias ? setMaterias.has(materia) : false;
    if (materia !== "" && !esSegura && !estaEnDisco) {
      errores.push(`Curso '${c.nombre}': materia '${materia}' inválida.`);
    }

    const cursoExistente = indice.cursos[c.clave_curso];
    if (
      cursoExistente &&
      cursoExistente.materia &&
      cursoExistente.materia.trim().length > 0 &&
      materia !== cursoExistente.materia
    ) {
      errores.push(
        `Curso '${c.nombre}': no se puede cambiar la materia de un curso ya asociado ('${cursoExistente.materia}' -> '${materia}').`
      );
    }
  }

  // 2. Validar temas
  for (const t of filas.temas) {
    const cFila = filas.cursos.find((fc) => fc.clave_curso === t.clave_curso);
    const nombreCurso = cFila ? cFila.nombre : t.clave_curso;
    const destino = t.destino !== undefined ? String(t.destino) : "";

    if (/[\t\r\n]/.test(destino)) {
      errores.push(`Tema '${nombreCurso} › ${t.tema}': contiene tabulaciones o saltos de línea.`);
    }

    const cursoExistente = indice.cursos[t.clave_curso];
    const temaOriginal = cursoExistente?.temas?.[t.tema];
    const esOriginalNoEditable =
      Boolean(temaOriginal &&
      !invertirCarpeta(temaOriginal, cursoExistente?.docente, t.tema).editable &&
      destino === temaOriginal);


    if (!esOriginalNoEditable && destino !== "-" && !esDestinoSeguro(destino)) {
      errores.push(`Tema '${nombreCurso} › ${t.tema}': destino inválido '${destino}'.`);
    }
  }

  // 3. Validar archivos
  for (const a of filas.archivos) {
    const accion = a.accion !== undefined ? String(a.accion) : "";
    const nombre = a.nombre !== undefined ? String(a.nombre) : "";

    const archExistente = indice.archivos[a.clave];
    if (archExistente) {
      if (accion !== "ya-esta" || nombre !== archExistente.nombre) {
        errores.push(`la fila ${a.clave} es 'ya-esta' y no se edita`);
      }
      continue;
    }

    if (/[\t\r\n]/.test(accion) || /[\t\r\n]/.test(nombre)) {
      errores.push(`Archivo '${a.original}': contiene tabulaciones o saltos de línea.`);
    }
    if (accion !== "copiar" && accion !== "omitir") {
      errores.push(`Archivo '${a.original}': acción '${accion}' inválida.`);
    }
    if (!nombre || nombre.trim().length === 0) {
      errores.push(`Archivo '${a.original}': tiene nombre vacío.`);
    } else {
      const sanitizado = nombreEnDisco(nombre);
      if (nombre.includes("/") || nombre.includes("\\") || sanitizado !== nombre) {
        errores.push(
          `Archivo '${a.original}': nombre '${nombre}' no coincide con su sanitizado. Quedaría '${sanitizado}'.`
        );
      }
    }
    if (a.destinoPropio && !esDestinoSeguro(a.destinoPropio)) {
      errores.push(`Archivo '${a.original}': destino propio inválido '${a.destinoPropio}'.`);
    }
    if (a.carpeta && !esDestinoSeguro(a.carpeta)) {
      errores.push(`Archivo '${a.original}': carpeta destino inválida '${a.carpeta}'.`);
    }
  }

  if (errores.length > 0) {
    return { ok: false, errores };
  }

  // 4. Construir nuevo índice inmutable
  const nuevoIndice: Indice = {
    version: 1,
    cursos: { ...indice.cursos },
    archivos: { ...indice.archivos },
  };

  const mapaVistos = normalizarVistos(vistos || []);

  for (const cFila of filas.cursos) {
    const cursoExistente = indice.cursos[cFila.clave_curso];
    const nuevoCurso: CursoIndice = cursoExistente
      ? { ...cursoExistente }
      : {
          nombre: cFila.nombre,
          materia: cFila.materia,
          docente: cFila.docente,
          temas: {},
        };

    nuevoCurso.materia = cFila.materia;
    nuevoCurso.docente = cFila.docente;
    nuevoCurso.temas = { ...(nuevoCurso.temas || {}) };

    // Actualizar temas
    const temasCurso = filas.temas.filter((t) => t.clave_curso === cFila.clave_curso);
    for (const t of temasCurso) {
      const temaOriginal = cursoExistente?.temas?.[t.tema];
      if (
        temaOriginal &&
        !invertirCarpeta(temaOriginal, cursoExistente?.docente, t.tema).editable
      ) {
        // Conservar carpeta no editable
        nuevoCurso.temas[t.tema] = temaOriginal;
      } else if (t.destino === "-") {
        nuevoCurso.temas[t.tema] = "-";
      } else {
        nuevoCurso.temas[t.tema] = resolverCarpeta(
          t.destino,
          nuevoCurso.docente,
          t.subcarpeta === "si" ? t.tema : null
        );
      }
    }

    // Actualizar omitidos
    const archivosCurso = filas.archivos.filter((a) => a.clave_curso === cFila.clave_curso);
    let omitidos = cursoExistente?.omitidos ? [...cursoExistente.omitidos] : [];

    for (const a of archivosCurso) {
      if (a.accion === "omitir") {
        if (!omitidos.includes(a.clave)) {
          omitidos.push(a.clave);
        }
      } else if (a.accion === "copiar") {
        const idSinPrefijo = a.clave.includes(":") ? a.clave.split(":")[1] : a.clave;
        omitidos = omitidos.filter((k) => k !== a.clave && k !== idSinPrefijo);
      }
    }

    if (omitidos.length > 0) {
      nuevoCurso.omitidos = omitidos;
    } else if (cursoExistente && "omitidos" in cursoExistente && cursoExistente.omitidos !== undefined) {
      nuevoCurso.omitidos = [];
    } else {
      delete nuevoCurso.omitidos;
    }

    // Actualizar videollamadas permitidas (RN-B, Plan 25)
    let permitidas = cursoExistente?.videollamadasPermitidas
      ? [...cursoExistente.videollamadasPermitidas]
      : [];

    for (const a of archivosCurso) {
      if (!claveEsVideollamada(a.clave)) continue;
      if (a.accion === "copiar") {
        if (!permitidas.includes(a.clave)) {
          permitidas.push(a.clave);
        }
      } else if (a.accion === "omitir") {
        permitidas = permitidas.filter((k) => k !== a.clave);
      }
      // ya-esta -> no tocar
    }

    if (permitidas.length > 0) {
      nuevoCurso.videollamadasPermitidas = permitidas;
    } else {
      delete nuevoCurso.videollamadasPermitidas;
    }

    // Actualizar carpetas personalizadas (D-5, Plan 08d)
    const carpetasFinales: Record<string, string> = cursoExistente?.carpetas
      ? { ...cursoExistente.carpetas }
      : {};

    for (const a of archivosCurso) {
      if (a.accion === "ya-esta" || a.accion === "omitir") {
        delete carpetasFinales[a.clave];
        continue;
      }
      const carpetaTema = nuevoCurso.temas[a.tema] || ".";
      let carpetaArchivo = carpetaTema;

      if (a.destinoPropio !== undefined && a.destinoPropio !== "") {
        carpetaArchivo = a.destinoPropio === "." ? "." : resolverCarpeta(a.destinoPropio, nuevoCurso.docente);
      }

      if (carpetaArchivo !== carpetaTema) {
        carpetasFinales[a.clave] = carpetaArchivo;
      } else {
        delete carpetasFinales[a.clave];
      }
    }


    if (Object.keys(carpetasFinales).length > 0) {
      nuevoCurso.carpetas = carpetasFinales;
    } else {
      delete nuevoCurso.carpetas;
    }

    // Actualizar nombres personalizados (D-3)
    const visto = mapaVistos.get(cFila.clave_curso);
    const itemsEntrada: ItemEntradaPropuesta[] = visto
      ? visto.items.map((it) => ({
          idArchivo: it.idArchivo,
          original: it.original || it.texto || it.idArchivo,
          tema: it.tema,
          publicacion: it.publicacion,
          anuncio: it.anuncio,
          bytes: it.bytes,
          md5: it.md5,
        }))
      : archivosCurso
          .filter((a) => a.accion !== "ya-esta")
          .map((a) => ({
            idArchivo: a.clave.includes(":") ? a.clave.split(":")[1]! : a.clave,
            original: a.original,
            tema: a.tema,
            md5: a.md5,
          }));

    const cursoParaPropuesta: CursoIndice = {
      ...nuevoCurso,
      nombres: undefined,
      omitidos: undefined,
      carpetas: nuevoCurso.carpetas,
    };

    const propuestasBase = proponerParaCurso({
      curso: cursoParaPropuesta,
      items: itemsEntrada,
      archivos: indice.archivos,
      sitioId: visto?.sitio || sitioIdPorDefecto,
    });

    const mapaPropBase = new Map<string, string>();
    for (const p of propuestasBase) {
      if (p.nombre) mapaPropBase.set(p.clave, p.nombre);
    }

    const nombresFinales: Record<string, string> = cursoExistente?.nombres
      ? { ...cursoExistente.nombres }
      : {};

    const mapaOcupacion = new Map<string, string[]>();
    for (const a of archivosCurso) {
      if (a.accion === "omitir") continue;
      const cNorm = normalizarCarpetaOcupacion(a.carpeta, nuevoCurso.materia);
      const claveOcupacion = `${cNorm}/${a.nombre}`.toLowerCase();
      const arr = mapaOcupacion.get(claveOcupacion) || [];
      arr.push(a.clave);
      mapaOcupacion.set(claveOcupacion, arr);
    }

    for (const a of archivosCurso) {
      if (a.accion === "ya-esta") continue;
      const propBase =
        mapaPropBase.get(a.clave) ||
        proponerNombre({ original: a.original, tema: a.tema, docente: nuevoCurso.docente });

      if (a.nombre !== propBase) {
        const cNorm = normalizarCarpetaOcupacion(a.carpeta, nuevoCurso.materia);
        const claveOcupacion = `${cNorm}/${a.nombre}`.toLowerCase();
        const ocupantes = mapaOcupacion.get(claveOcupacion) || [];
        const chocaConOtra = ocupantes.some((k) => k !== a.clave);

        if (chocaConOtra) {
          delete nombresFinales[a.clave];
          continue;
        }

        nombresFinales[a.clave] = a.nombre;
      } else {
        delete nombresFinales[a.clave];
      }
    }

    if (Object.keys(nombresFinales).length > 0) {
      nuevoCurso.nombres = nombresFinales;
    } else {
      delete nuevoCurso.nombres;
    }

    nuevoIndice.cursos[cFila.clave_curso] = nuevoCurso;
  }

  return { ok: true, indice: nuevoIndice };
}
