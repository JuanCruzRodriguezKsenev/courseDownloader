/**
 * MODELO Y SERIALIZACIÓN DEL ÍNDICE DE DESTINO (V1.1.0)
 * =====================================================
 */

export const NOMBRE_INDICE = ".course-downloader.json";

export interface CursoIndice {
  nombre: string;
  materia: string;
  docente: string;
  temas: Record<string, string>;
  omitidos?: string[];
  /** Nombres personalizados por el dueño antes de descargar (RN-14, D-3) */
  nombres?: Record<string, string>;
}

export interface ArchivoIndice {
  curso: string;
  nombre: string;
  ruta: string;
  md5: string;
  original: string;
}

export interface Indice {
  version: 1;
  cursos: Record<string, CursoIndice>;
  archivos: Record<string, ArchivoIndice>;
}

export type ResultadoParseoIndice =
  | { ok: true; indice: Indice }
  | { ok: false; error: string };

export function claveCurso(sitioId: string, idCurso: string): string {
  return `${sitioId}:${idCurso}`;
}

export function claveArchivo(sitioId: string, idArchivo: string): string {
  return `${sitioId}:${idArchivo}`;
}

export function parsearIndice(texto: string): ResultadoParseoIndice {
  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "El contenido del índice no es un objeto JSON válido" };
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.version !== 1) {
    return { ok: false, error: `Versión de índice no soportada: ${String(obj.version)} (se esperaba 1)` };
  }

  if (!obj.cursos || typeof obj.cursos !== "object" || Array.isArray(obj.cursos)) {
    return { ok: false, error: "La propiedad 'cursos' debe ser un objeto" };
  }

  if (!obj.archivos || typeof obj.archivos !== "object" || Array.isArray(obj.archivos)) {
    return { ok: false, error: "La propiedad 'archivos' debe ser un objeto" };
  }

  return { ok: true, indice: parsed as Indice };
}

export function serializarIndice(indice: Indice): string {
  const cursosOrdenados: Record<string, CursoIndice> = {};
  for (const k of Object.keys(indice.cursos || {}).sort()) {
    const curso = indice.cursos[k];
    if (curso) {
      cursosOrdenados[k] = curso;
    }
  }

  const archivosOrdenados: Record<string, ArchivoIndice> = {};
  for (const k of Object.keys(indice.archivos || {}).sort()) {
    const archivo = indice.archivos[k];
    if (archivo) {
      archivosOrdenados[k] = archivo;
    }
  }

  const salida: Indice = {
    version: indice.version,
    cursos: cursosOrdenados,
    archivos: archivosOrdenados,
  };

  return JSON.stringify(salida, null, 2) + "\n";
}
