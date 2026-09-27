/**
 * ORIGEN DEL LISTADO GUARDADO (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [CLASSROOM ESCANEAR TODAS] Decisiones al abrir extendidas para recorrido
 *   multi-curso: 'mostrar-recorrido', 'materializar-recorrido', 'ofrecer-todos'.
 *
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1 — LISTA GUARDADA] Nace para decidir si al abrir el popup
 *   se debe re-escanear o si la lista guardada en AppState ya corresponde al
 *   listado de la pestaña abierta.
 * ==========================================================================
 */
import type { EstadoRecorrido } from "./recorridoTodos";

/** De qué listado salió la lista guardada: el portal y la clave que devolvió su descriptor. */
export interface OrigenListado {
  sitioId: string;
  clave: string;
}

export type DecisionAlAbrir =
  | "mostrar-recorrido"
  | "materializar-recorrido"
  | "usar-guardada"
  | "ofrecer-todos"
  | "escanear";

/**
 * ¿Qué acción toma el popup al abrirse?
 * Orden de evaluación (tabla de decisión de spec.md + fila materializar):
 * 1. Recorrido escaneando en esta pestaña y vigente → "mostrar-recorrido"
 * 2. Recorrido terminado/cortado no materializado → "materializar-recorrido" (en cualquier página)
 * 3. Lista guardada coincide con la clave de listado → "usar-guardada"
 * 4. Portada del portal → "ofrecer-todos"
 * 5. Cualquier otro caso → "escanear"
 */
export function decidirAlAbrir(p: {
  origen: OrigenListado | null;
  sitioId: string;
  clave: string | undefined;
  hayItemsDelPortal: boolean;
  esPortada?: boolean;
  recorrido?: { tabId: number; estado: EstadoRecorrido; vigente: boolean; materializado: boolean } | null;
  tabId?: number | undefined;
}): DecisionAlAbrir {
  // 1. Recorrido escaneando en esta pestaña y vigente
  if (
    p.recorrido &&
    p.recorrido.estado === "escaneando" &&
    p.recorrido.vigente &&
    p.tabId !== undefined &&
    p.recorrido.tabId === p.tabId
  ) {
    return "mostrar-recorrido";
  }

  // 2. Recorrido terminado o cortado sin materializar (en cualquier página)
  if (p.recorrido && p.recorrido.estado !== "escaneando" && !p.recorrido.materializado) {
    return "materializar-recorrido";
  }

  // 3. Regla previa de lista guardada
  if (
    p.clave &&
    p.origen &&
    p.hayItemsDelPortal &&
    p.origen.sitioId === p.sitioId &&
    p.origen.clave === p.clave
  ) {
    return "usar-guardada";
  }

  // 4. Portada de portal
  if (p.esPortada) {
    return "ofrecer-todos";
  }

  // 5. Escaneo por defecto
  return "escanear";
}

/** Valida lo leído de storage: cualquier otra forma se trata como "sin origen". */
export function esOrigenListado(v: unknown): v is OrigenListado {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.sitioId === "string" && o.sitioId !== "" && typeof o.clave === "string" && o.clave !== "";
}
