import { sanearNombreCarpeta } from "../util/texto";
import { claveArchivo } from "./indice";
import type { CursoIndice, ArchivoIndice } from "./indice";
import { proponerNombre } from "./nombres";
import { buscarChoques, renombrarChoquesNovedades } from "./choques";
import type { FilaNovedad, FilaChoque } from "./choques";

export interface ItemEntradaPropuesta {
  idArchivo: string;
  original: string;
  tema?: string | null;
  publicacion?: string | null;
  anuncio?: string | null;
  bytes?: number;
  md5?: string;
}

export interface OpcionesProponerParaCurso {
  curso?: CursoIndice | null;
  items: ItemEntradaPropuesta[];
  archivos?: Record<string, ArchivoIndice>;
  sitioId?: string;
}

export interface PropuestaItem {
  idArchivo: string;
  clave: string;
  nombre: string | null;
  carpeta: string | null;
  sinAsignar: boolean;
  omitido: boolean;
}

function agregarSufijoMaterial(nombre: string, publicacion?: string | null, fallback?: string): string {
  const sufijo = sanearNombreCarpeta((publicacion || "").trim() || (fallback || "").trim());
  if (!sufijo) return nombre;
  const matchExt = nombre.match(/\.([a-z0-9]{1,5})$/i);
  if (matchExt && matchExt.index !== undefined) {
    const base = nombre.slice(0, matchExt.index);
    const ext = matchExt[0];
    return `${base}_${sufijo}${ext}`;
  }
  return `${nombre}_${sufijo}`;
}

/**
 * Propone nombre, carpeta y marcas (sinAsignar, omitido) para cada ítem de un curso (B-7).
 */
export function proponerParaCurso({
  curso,
  items,
  archivos = {},
  sitioId = "google-classroom",
}: OpcionesProponerParaCurso): PropuestaItem[] {
  const resultados: {
    idArchivo: string;
    clave: string;
    nombre: string | null;
    carpeta: string | null;
    sinAsignar: boolean;
    omitido: boolean;
    fijoEnIndice: boolean;
    original: string;
    tema: string;
    publicacion?: string | null;
    anuncio?: string | null;
    md5?: string;
  }[] = [];

  for (const item of items) {
    const clave = claveArchivo(sitioId, item.idArchivo);
    const temaStr = (item.tema || "").trim();

    if (!curso) {
      // Curso sin asociar (RN-2)
      let nombreInicial = "";
      let fijoEnIndice = false;
      if (archivos[clave]?.nombre) {
        nombreInicial = archivos[clave].nombre;
        fijoEnIndice = true;
      } else {
        nombreInicial = proponerNombre({ original: item.original, tema: item.tema, docente: null });
      }

      resultados.push({
        idArchivo: item.idArchivo,
        clave,
        nombre: nombreInicial,
        carpeta: null,
        sinAsignar: false,
        omitido: false,
        fijoEnIndice,
        original: item.original,
        tema: temaStr,
        publicacion: item.publicacion,
        anuncio: item.anuncio,
        md5: item.md5,
      });
      continue;
    }

    // Comprobar si está omitido (D-7)
    const temaOmitido = curso.temas && curso.temas[temaStr] === "-";
    const claveOmitida = Boolean(
      curso.omitidos && (curso.omitidos.includes(clave) || curso.omitidos.includes(item.idArchivo))
    );

    if (temaOmitido || claveOmitida) {
      resultados.push({
        idArchivo: item.idArchivo,
        clave,
        nombre: null,
        carpeta: null,
        sinAsignar: false,
        omitido: true,
        fijoEnIndice: false,
        original: item.original,
        tema: temaStr,
        publicacion: item.publicacion,
        anuncio: item.anuncio,
        md5: item.md5,
      });
      continue;
    }

    // Carpeta propuesta
    let carpetaPropuesta = ".";
    let sinAsignar = false;

    if (curso.carpetas && curso.carpetas[clave] !== undefined) {
      carpetaPropuesta = curso.carpetas[clave]!;
      sinAsignar = false;
    } else if (curso.temas && temaStr in curso.temas && curso.temas[temaStr] !== undefined) {
      carpetaPropuesta = curso.temas[temaStr]!;
      sinAsignar = false;
    } else {
      carpetaPropuesta = ".";
      const esNovedadesOSinTema = !temaStr || /^(novedades|sin tema)$/i.test(temaStr);
      sinAsignar = !esNovedadesOSinTema;
    }

    // Nombre propuesto
    let nombreInicial = "";
    let fijoEnIndice = false;
    if (archivos[clave]?.nombre) {
      nombreInicial = archivos[clave].nombre;
      fijoEnIndice = true;
    } else if (curso.nombres?.[clave]) {
      nombreInicial = curso.nombres[clave];
      fijoEnIndice = true;
    } else {
      nombreInicial = proponerNombre({
        original: item.original,
        tema: item.tema,
        docente: curso.docente,
      });
    }

    resultados.push({
      idArchivo: item.idArchivo,
      clave,
      nombre: nombreInicial,
      carpeta: carpetaPropuesta,
      sinAsignar,
      omitido: false,
      fijoEnIndice,
      original: item.original,
      tema: temaStr,
      publicacion: item.publicacion,
      anuncio: item.anuncio,
      md5: item.md5,
    });
  }

  // Resolución de choques RN-16a (Novedades)
  const filasNovedades: FilaNovedad[] = resultados
    .filter((r) => !r.omitido && r.carpeta !== null && r.nombre !== null)
    .map((r) => ({
      clave: r.clave,
      ruta: r.carpeta!,
      nombre: r.nombre!,
      md5: r.md5 || r.idArchivo,
      renombrable: !r.fijoEnIndice && /^novedades$/i.test(r.tema),
      original: r.original,
      anuncio: r.anuncio || undefined,
      tema: r.tema,
      docente: curso?.docente,
    }));

  const renombresNovedades = renombrarChoquesNovedades(filasNovedades);
  for (const r of resultados) {
    if (renombresNovedades.has(r.clave)) {
      r.nombre = renombresNovedades.get(r.clave)!;
    }
  }

  // Resolución de choques RN-16 (Trabajo / general)
  const filasParaChoques: FilaChoque[] = resultados
    .filter((r) => !r.omitido && r.carpeta !== null && r.nombre !== null)
    .map((r) => ({
      clave: r.clave,
      ruta: r.carpeta!,
      nombre: r.nombre!,
      md5: r.md5 || r.idArchivo,
    }));

  const gruposChoque = buscarChoques(filasParaChoques);
  for (const grupo of gruposChoque) {
    for (const fila of grupo.filas) {
      const target = resultados.find((r) => r.clave === fila.clave);
      if (target && !target.fijoEnIndice && target.nombre) {
        target.nombre = agregarSufijoMaterial(target.nombre, target.publicacion, target.idArchivo);
      }
    }
  }

  return resultados.map((r) => ({
    idArchivo: r.idArchivo,
    clave: r.clave,
    nombre: r.nombre,
    carpeta: r.carpeta,
    sinAsignar: r.sinAsignar,
    omitido: r.omitido,
  }));
}
