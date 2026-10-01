export type AccionAntes = "no-bajar" | "corregir-ruta" | "anotar-existente" | "bajar";
export type FilaAntes = "0" | "0b" | "1" | "2" | "3" | "4";

export interface DecidirAntesEntrada {
  enIndice: boolean;
  esAcceso: boolean;
  estaEnRutaAnotada: boolean;
  md5EncontradoEnRaiz?: boolean | string | null;
  destinoMdExiste: boolean;
}

export interface DecidirAntesResultado {
  accion: AccionAntes;
  fila: FilaAntes;
}

/**
 * Evalúa las condiciones previas a la descarga según la tabla de decisión de la spec.
 * Se evalúa en orden estricto; la primera fila coincidente decide.
 */
export function decidirAntes(entrada: DecidirAntesEntrada): DecidirAntesResultado {
  // Fila 0: destinoMdExiste va antes que todas (RN-30)
  if (entrada.destinoMdExiste) {
    return { accion: "anotar-existente", fila: "0" };
  }

  // Fila 0b: enIndice && esAcceso va antes que 2 y 3 (RN-29a)
  if (entrada.enIndice && entrada.esAcceso) {
    return { accion: "no-bajar", fila: "0b" };
  }

  // Fila 1: enIndice y está en la ruta anotada
  if (entrada.enIndice && entrada.estaEnRutaAnotada) {
    return { accion: "no-bajar", fila: "1" };
  }

  // Fila 2: enIndice, no en ruta anotada, pero su md5 se encontró en la raíz
  if (entrada.enIndice && entrada.md5EncontradoEnRaiz) {
    return { accion: "corregir-ruta", fila: "2" };
  }

  // Fila 3: enIndice, no en ruta anotada y su md5 no está en la raíz
  if (entrada.enIndice) {
    return { accion: "bajar", fila: "3" };
  }

  // Fila 4: no en índice
  return { accion: "bajar", fila: "4" };
}

export type AccionDespues = "no-escribir" | "descartar" | "escribir" | "rechazar";

export interface DecidirDespuesEntrada {
  destinoEsMd: boolean;
  existeDestino: boolean;
  md5ExisteEnCarpetaDestino: boolean;
  existeDestinoConOtroContenido?: boolean;
}

/**
 * Evalúa la acción a tomar tras completarse la descarga según las filas 0, 5, 6 y rechazo (D-7).
 */
export function decidirDespues(entrada: DecidirDespuesEntrada): AccionDespues {
  // Fila 0: destino es .md y ya existe en destino -> no escribir (RN-30)
  if (entrada.destinoEsMd && entrada.existeDestino) {
    return "no-escribir";
  }

  // Rechazo por destino ocupado con otro contenido (D-7 del plan 02, NFR-4)
  if (entrada.existeDestinoConOtroContenido) {
    return "rechazar";
  }

  // Fila 5: md5 idéntico ya existe en la carpeta destino -> descartar sin escribir
  if (entrada.md5ExisteEnCarpetaDestino) {
    return "descartar";
  }

  // Fila 6: no existe -> escribir con el nombre propuesto
  return "escribir";
}
