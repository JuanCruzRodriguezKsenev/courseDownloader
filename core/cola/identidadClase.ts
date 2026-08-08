/**
 * IDENTIDAD DE UNA CLASE (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [ESCANEO-API CORTE 1] La clave pasa de `(portal, título)` a
 *   **`(portal, módulo, tipo, título)`**. El par anterior colisionaba DENTRO de un portal de dos
 *   niveles: Anatomy by Chris tiene 7 títulos que viven en dos módulos a la vez (`Miologia 1..6`
 *   e `Irrigación`, en *Miembro Superior* y *Miembro Inferior*), y el modo de fallar era el mismo
 *   que la v1 había cerrado para dos portales, sólo que intra-portal. **Rompía datos.**
 * - `tipo` entra en el mismo cambio, con `"video"` por omisión, aunque el corte 1 sólo traiga
 *   videos: un adjunto y el video del que cuelga comparten portal, módulo y título.
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
 * La identidad es la tupla **(portal, módulo, tipo, título)**. Y el portal sale del
 * **descriptor**, no del campo crudo, porque los tres casos de `sitioId` significan cosas
 * distintas (la distinción del corte 3):
 *
 *   - **ausente** → dato anterior al multi-sitio ⇒ portal legado. Un ítem sin `sitioId` y otro
 *     con `"ramonnet"` son **la misma clase**, y compararlos crudos diría que no.
 *   - **presente y registrado** → su portal.
 *   - **presente y desconocido** (huérfano) → no resuelve, y ahí se usa el id crudo: dos
 *     huérfanos del mismo portal muerto siguen siendo la misma clase entre sí.
 *
 * EL MÓDULO ES EL ORIGEN, NUNCA LA CARPETA DE DESTINO
 * ----------------------------------------------------
 * Es la parte fácil de arruinar. La identidad tiene que decir **qué clase es**, no **dónde
 * decidiste guardarla**: si tomara `carpeta`, activar el override del input (corte 2) le
 * cambiaría la identidad a los 103 ítems y ninguno matchearía contra la cola. Por eso el campo se
 * llama `modulo` y lo estampa el scraper con el nombre del módulo del que salió la clase.
 *
 * POR QUÉ NO HAY MIGRACIÓN DE DATOS
 * ----------------------------------
 * Porque la clave **se calcula, no se persiste**. Lo único que la guarda es el espejo de progreso
 * (`SW_ESTADOS_PROGRESO`), que vive en `storage.session` y muere con la sesión del navegador.
 * Un portal de un solo nivel —Ramón Net— no manda `modulo` ni `tipo`, así que su clave queda
 * `ramonnet||video|Título`: semánticamente idéntica a la de la v1.
 *
 * POR QUÉ VIVE ACÁ Y NO EN CADA CONSUMIDOR
 * ----------------------------------------
 * Porque la usan el bucle de descarga, los handlers IPC del service worker y el popup. Si cada
 * uno la implementara, podrían divergir — y la forma que toma esa divergencia es exactamente la
 * que el corte 4 cerró en el filtro: un ítem tratado como dos, o dos como uno. Es el mismo
 * motivo por el que el resolvedor con migración es un export compartido de la composición.
 */

/** El tipo de contenido de un ítem. `"video"` es el default de todo el proyecto. */
export type TipoContenido = "video" | "adjunto";

/** Lo mínimo que hace falta para identificar una clase. */
export interface ItemIdentificable {
  titulo?: string;
  sitioId?: string;
  /**
   * El módulo del que salió la clase, en portales de dos niveles. **Origen, no destino.**
   * Ausente en portales de un solo nivel, y ausente es un valor válido: no se inventa.
   */
  modulo?: string;
  /** `"video"` por omisión. Distingue un adjunto del video del que cuelga. */
  tipo?: TipoContenido;
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
   * El separador es `|` y ningún componente se escapa, igual que en el `notificationId` del corte
   * 8... **con una diferencia deliberada**: allá el id viaja URL-encodeado porque el string lo
   * custodia Chrome y hay que volver a partirlo. Acá la clave sólo se compara y se borra, nunca
   * se parsea de vuelta, así que un `|` en un id daría una clave rara pero jamás una colisión
   * entre dos clases distintas.
   *
   * El orden de los cuatro campos no es indistinto para leerla en un log: va de lo más general
   * (el portal) a lo más específico (el título), que es como uno la lee cuando algo no matchea.
   */
  const clave = (item: ItemIdentificable | undefined | null): string =>
    `${idPortalDe(item)}|${item?.modulo ?? ""}|${item?.tipo || "video"}|${item?.titulo ?? ""}`;

  /** ¿Son la misma clase? El reemplazo de todos los `a.titulo === b.titulo` del proyecto. */
  const misma = (
    a: ItemIdentificable | undefined | null,
    b: ItemIdentificable | undefined | null
  ): boolean => clave(a) === clave(b);

  return { idPortalDe, clave, misma };
}

export type IdentidadClase = ReturnType<typeof crearIdentidadClase>;
