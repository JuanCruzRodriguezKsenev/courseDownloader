import { claveCurso } from "../../core/destino/indice.ts";

const vistosMemoria = new Map();

/**
 * Guarda en memoria un curso visto con sus ítems escaneados (D-2).
 * @param {{ sitio?: string, curso: { id?: string, idCurso?: string, clave?: string, nombre?: string }, items?: any[] }} datos
 */
export function guardarVisto({ sitio = "google-classroom", curso, items = [] }) {
  if (!curso) return null;
  const id = curso.id || curso.idCurso;
  const clave = curso.clave || (id ? claveCurso(sitio, id) : "");
  if (!clave) return null;

  const entrada = {
    sitio,
    clave,
    id: id || curso.id,
    idCurso: id || curso.idCurso,
    nombre: curso.nombre || "",
    items: Array.isArray(items) ? items : [],
  };
  vistosMemoria.set(clave, entrada);
  return entrada;
}

/**
 * Retorna todos los cursos vistos en memoria (D-2).
 * @returns {Map<string, any>}
 */
export function leerVistos() {
  return new Map(vistosMemoria);
}

/**
 * Limpia la memoria de cursos vistos (útil para pruebas).
 */
export function limpiarVistos() {
  vistosMemoria.clear();
}
