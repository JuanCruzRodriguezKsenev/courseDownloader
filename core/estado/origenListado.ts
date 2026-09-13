/**
 * ORIGEN DEL LISTADO GUARDADO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1 — LISTA GUARDADA] Nace para decidir si al abrir el popup
 *   se debe re-escanear o si la lista guardada en AppState ya corresponde al
 *   listado de la pestaña abierta.
 * ==========================================================================
 */

/** De qué listado salió la lista guardada: el portal y la clave que devolvió su descriptor. */
export interface OrigenListado {
  sitioId: string;
  clave: string;
}

export type DecisionAlAbrir = "usar-guardada" | "escanear";

/**
 * ¿Hace falta escanear, o la lista guardada ya es la de esta pestaña?
 * Sin clave (el portal no declara `claveDeListado`, o la URL no es de un listado) SIEMPRE se
 * escanea: es el comportamiento de antes y el de Ramón Net y Anatomy.
 */
export function decidirAlAbrir(p: {
  origen: OrigenListado | null;
  sitioId: string;
  clave: string | undefined;
  hayItemsDelPortal: boolean;
}): DecisionAlAbrir {
  if (!p.clave || !p.origen || !p.hayItemsDelPortal) return "escanear";
  return p.origen.sitioId === p.sitioId && p.origen.clave === p.clave ? "usar-guardada" : "escanear";
}

/** Valida lo leído de storage: cualquier otra forma se trata como "sin origen". */
export function esOrigenListado(v: unknown): v is OrigenListado {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.sitioId === "string" && o.sitioId !== "" && typeof o.clave === "string" && o.clave !== "";
}
