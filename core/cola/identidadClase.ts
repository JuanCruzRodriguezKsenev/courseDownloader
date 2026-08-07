/**
 * IDENTIDAD DE UNA CLASE (V1.0.0)
 * ==========================================================================
 * Capa 1. Nace con el corte multiportal D.
 *
 * QUÉ RESUELVE
 * ------------
 * Hasta acá, la identidad de una clase **era su título**: la cola la filtraba por título, la
 * lista persistente la buscaba por título y el espejo de progreso era un mapa `titulo → estado`.
 * Con un solo portal eso alcanzaba, porque dos clases distintas no compartían nombre.
 *
 * Con dos portales sí pueden. Y el modo de fallar es feo y silencioso: **completar la descarga
 * de una clase saca de la cola a su homónima del otro portal**, que nunca se baja y desaparece
 * sin error. Lo mismo el espejo de progreso, que mostraría el avance de una en la fila de la otra.
 *
 * LA REGLA
 * --------
 * La identidad es el par **(portal, título)**. Y el portal sale del **descriptor**, no del campo
 * crudo, porque los tres casos de `sitioId` significan cosas distintas (la distinción del corte 3):
 *
 *   - **ausente** → dato anterior al multi-sitio ⇒ portal legado. Un ítem sin `sitioId` y otro
 *     con `"ramonnet"` son **la misma clase**, y compararlos crudos diría que no.
 *   - **presente y registrado** → su portal.
 *   - **presente y desconocido** (huérfano) → no resuelve, y ahí se usa el id crudo: dos
 *     huérfanos del mismo portal muerto siguen siendo la misma clase entre sí.
 *
 * POR QUÉ VIVE ACÁ Y NO EN CADA CONSUMIDOR
 * ----------------------------------------
 * Porque la usan el bucle de descarga, los handlers IPC del service worker y el popup. Si cada
 * uno la implementara, podrían divergir — y la forma que toma esa divergencia es exactamente la
 * que el corte 4 cerró en el filtro: un ítem tratado como dos, o dos como uno. Es el mismo
 * motivo por el que el resolvedor con migración es un export compartido de la composición.
 */

/** Lo mínimo que hace falta para identificar una clase. */
export interface ItemIdentificable {
  titulo?: string;
  sitioId?: string;
}

/** Lo mínimo que esta capa necesita del registro: no le pide el descriptor entero. */
export interface ResolvedorDePortal {
  obtener(id?: string): { id: string } | undefined;
}

export function crearIdentidadClase(sitios: ResolvedorDePortal) {
  /**
   * El id de portal con el que se compara. Sale del descriptor —así el `sitioId` ausente cae
   * en el legado— y cae al valor crudo sólo cuando el portal no resuelve, para que dos
   * huérfanos del mismo portal muerto sigan siendo comparables entre sí.
   */
  const idPortalDe = (item: ItemIdentificable | undefined | null): string =>
    sitios.obtener(item?.sitioId)?.id ?? item?.sitioId ?? "";

  /**
   * Clave estable de una clase, para los mapas (el espejo `SW_ESTADOS_PROGRESO`).
   *
   * El separador es `|` y el `sitioId` NO se escapa, igual que en el `notificationId` del corte
   * 8... **con una diferencia deliberada**: allá el id viaja URL-encodeado porque el string lo
   * custodia Chrome y hay que volver a partirlo. Acá la clave sólo se compara y se borra, nunca
   * se parsea de vuelta, así que un `|` en un id daría una clave rara pero jamás una colisión
   * entre dos clases distintas.
   */
  const clave = (item: ItemIdentificable | undefined | null): string =>
    `${idPortalDe(item)}|${item?.titulo ?? ""}`;

  /** ¿Son la misma clase? El reemplazo de todos los `a.titulo === b.titulo` del proyecto. */
  const misma = (
    a: ItemIdentificable | undefined | null,
    b: ItemIdentificable | undefined | null
  ): boolean => clave(a) === clave(b);

  return { idPortalDe, clave, misma };
}

export type IdentidadClase = ReturnType<typeof crearIdentidadClase>;
