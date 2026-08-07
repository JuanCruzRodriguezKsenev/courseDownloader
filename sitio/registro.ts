/**
 * REGISTRO DE SITIOS (V1.0.0)
 * ==========================================================================
 * Capa 2, pero **genérico**: no es de ningún portal. Es la única lista de qué adaptadores
 * conoce esta build, y las dos formas de llegar a uno.
 *
 * Es lo que ADR-0009 decidió (una sola extensión que resuelve el adaptador en runtime) y
 * ADR-0010 completó (el sitio es un dato del ítem, no de la build). Diseño de ejecución y
 * orden de cortes: `docs/multisitio-diseno.md`.
 *
 * CHANGELOG v1.0.0:
 * - [MULTISITIO CORTE 2] Creado con **un solo portal adentro**. Con N=1 el comportamiento es
 *   idéntico al de antes, que es justamente lo que hace este corte mergeable y verificable sin
 *   tener todavía un segundo adaptador.
 * ==========================================================================
 *
 * POR QUÉ `obtener()` PUEDE DEVOLVER `undefined`
 * -----------------------------------------------
 * Un `sitioId` puede no resolver: viene de storage, o sea de datos que sobreviven a los
 * cambios de código. Si se saca un portal de esta lista, la cola del usuario puede tener
 * ítems suyos. Devolver `undefined` **obliga al consumidor a decidir qué hacer** —saltear el
 * ítem con un fallo tipado, o avisar— en vez de tirar una excepción a mitad de una ráfaga o,
 * peor, caer en silencio al portal equivocado. El compilador fuerza ese manejo.
 *
 * Por eso mismo NO hay fallback al portal por defecto: "no sé de dónde salió esto" y "salió de
 * Ramón Net" son cosas distintas, y confundirlas es exactamente el bug que ADR-0010 previene.
 * El único lugar donde esa asunción es legítima es la migración de datos viejos, y vive en
 * `SITIO_LEGADO` (`core/estado/appState.ts`), aplicada al cargar.
 */
import type { PuertoSitio } from "../core/puertos/sitio";
import { SitioRamonNet } from "./ramonnet/config";

/**
 * Los adaptadores que conoce esta build. **Sumar un portal es agregarlo acá** (más su carpeta
 * en `sitio/<portal>/`, y su origen + ruleset dNR en `wxt.config.ts`, que es estático).
 *
 * El orden importa sólo para `resolverPorUrl`: gana el primero que reconoce la URL. Hoy es
 * irrelevante con un solo portal; si dos llegaran a reclamar el mismo origen, es un bug del
 * descriptor y no algo que este registro deba desempatar.
 */
//
// El tipo es una **tupla no vacía** a propósito: obliga a que siempre haya al menos un portal
// registrado, que es lo que hace seguro el `SITIOS[0]` del andamio de abajo. Lo pidió `tsc`,
// no un criterio estético.
const SITIOS: readonly [PuertoSitio, ...PuertoSitio[]] = [SitioRamonNet];

export const Sitios = {
  /**
   * Por id, que es como llega desde un ítem persistido (`Clase.sitioId`, `ColaItem.sitioId`).
   * `undefined` si no lo conoce — ver el bloque de arriba.
   */
  obtener(id: string | undefined): PuertoSitio | undefined {
    if (!id) return undefined;
    return SITIOS.find((s) => s.id === id);
  },

  /**
   * Por URL, que es como se resuelve el portal de la **pestaña activa** al escanear. Se apoya
   * en `esPaginaDelSitio()`, que ya declara el puerto: el mecanismo de detección lo pone cada
   * adaptador, acá sólo se recorre la lista.
   */
  resolverPorUrl(url: string | undefined): PuertoSitio | undefined {
    if (!url) return undefined;
    return SITIOS.find((s) => s.esPaginaDelSitio(url));
  },

  /** Todos los conocidos. Para diagnósticos y para la UI que ofrezca elegir portal. */
  todos(): readonly PuertoSitio[] {
    return SITIOS;
  },
};

/**
 * ANDAMIO SIN LECTORES — los cortes 3, 8, 5 y el multiportal C se los llevaron a todos.
 *
 * El último era el `urlSondeoInternet` del daemon de conexión; desde el multiportal C la sonda
 * **sigue al portal** (el del ítem de la cola en el SW, el de la pestaña en el popup) y su piso
 * sale de `sitios.obtener(undefined)`, que aplica la misma regla de migración que el resto.
 *
 * Se conserva el export porque el nombre documenta una decisión —ADR-0010 dice que **no existe**
 * un portal por defecto legítimo, y por eso se llama `sitioAsumido` y no `sitioPorDefecto`— pero
 * **no lo consume nadie**. Si te hace falta "el portal" en un lugar nuevo, casi seguro lo que
 * necesitás es resolverlo por ítem o por pestaña.
 *
 * El sitio que la composición **asume** mientras el service worker y el popup no resuelvan por
 * ítem / por pestaña. Se llama `sitioAsumido` y no `sitioPorDefecto` a propósito: ADR-0010 dice
 * que **no existe** un portal por defecto legítimo, así que el nombre tiene que incomodar lo
 * suficiente como para que nadie lo adopte como API estable.
 *
 * Lo que sí mejora respecto de antes: la decisión de "cuál es el sitio activo" salió de
 * `sitio/ramonnet/config.ts` —donde un portal se declaraba a sí mismo el activo— y pasó al
 * registro, que es genérico. Con N=1 el comportamiento es idéntico.
 */
export const sitioAsumido: PuertoSitio = SITIOS[0];

export default Sitios;
