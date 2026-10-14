import { sanearNombreCarpeta } from "../util/texto";
import { claveArchivo } from "./indice";
import type { CursoIndice, ArchivoIndice } from "./indice";
import { proponerNombre } from "./nombres";
import { buscarChoques, renombrarChoquesNovedades } from "./choques";
import type { FilaNovedad, FilaChoque } from "./choques";
import { claveEsVideollamada } from "./videollamada";

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
 * RN-16b: numera con `_N` (N ≥ 2) un nombre que sigue chocando después del sufijo de RN-16.
 * Elige el menor N cuyo nombre (en minúsculas) no esté en `ocupados`.
 */
function numerarResiduo(nombre: string, ocupados: Set<string>): string {
  const matchExt = nombre.match(/\.([a-z0-9]{1,5})$/i);
  const tieneExt = Boolean(matchExt && matchExt.index !== undefined);
  const base = tieneExt ? nombre.slice(0, matchExt!.index) : nombre;
  const ext = tieneExt ? matchExt![0] : "";
  for (let n = 2; ; n++) {
    const candidato = `${base}_${n}${ext}`;
    if (!ocupados.has(candidato.toLowerCase())) return candidato;
  }
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
      // Curso sin asociar (RN-2, RN-A)
      if (claveEsVideollamada(clave) && !archivos[clave]) {
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

    // Comprobar si está omitido (D-7, RN-A)
    const temaOmitido = curso.temas && curso.temas[temaStr] === "-";
    const claveOmitida = Boolean(
      (curso.omitidos && (curso.omitidos.includes(clave) || curso.omitidos.includes(item.idArchivo))) ||
      (claveEsVideollamada(clave) && !archivos[clave] && !curso.videollamadasPermitidas?.includes(clave))
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
    .filter((r) => !r.omitido && r.nombre !== null)
    .map((r) => ({
      clave: r.clave,
      ruta: r.carpeta ?? `(sin asociar)/${r.tema}`,
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
    .filter((r) => !r.omitido && r.nombre !== null)
    .map((r) => ({
      clave: r.clave,
      ruta: r.carpeta ?? `(sin asociar)/${r.tema}`,
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

  // RN-16b: lo que sigue chocando después del sufijo se numera con _N, en el orden del escaneo
  const rutaDe = (r: { carpeta: string | null; tema: string }) =>
    (r.carpeta ?? `(sin asociar)/${r.tema}`).replace(/\/+$/, "");
  const vivos = resultados.filter((r) => !r.omitido && r.nombre !== null);
  const residuos = buscarChoques(
    vivos.map((r) => ({
      clave: r.clave,
      ruta: r.carpeta ?? `(sin asociar)/${r.tema}`,
      nombre: r.nombre!,
      md5: r.md5 || r.idArchivo,
    }))
  );
  if (residuos.length > 0) {
    const ocupadosPorRuta = new Map<string, Set<string>>();
    for (const r of vivos) {
      const ruta = rutaDe(r);
      const set = ocupadosPorRuta.get(ruta) || new Set<string>();
      set.add(r.nombre!.toLowerCase());
      ocupadosPorRuta.set(ruta, set);
    }
    for (const grupo of residuos) {
      const filasGrupo = grupo.filas
        .map((f) => resultados.find((r) => r.clave === f.clave))
        .filter((r): r is (typeof resultados)[number] => Boolean(r));
      const hayFija = filasGrupo.some((r) => r.fijoEnIndice);
      let primeraLibreConserva = !hayFija;
      for (const r of filasGrupo) {
        if (r.fijoEnIndice) continue;
        if (primeraLibreConserva) {
          primeraLibreConserva = false;
          continue;
        }
        const ocupados = ocupadosPorRuta.get(rutaDe(r))!;
        r.nombre = numerarResiduo(r.nombre!, ocupados);
        ocupados.add(r.nombre.toLowerCase());
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
