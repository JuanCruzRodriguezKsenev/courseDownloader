/**
 * CREDENCIALES POR PORTAL (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Nace midiendo el pendiente 1d del segundo portal (Anatomy by Chris, sobre
 *   Hotmart Club): su `resolverManifiesto` no scrapea HTML, le pega a una API que exige
 *   un `Bearer <id_token>` que vive en el `localStorage` de la pestaña. O sea: **un dato
 *   que nace en la pestaña y lo necesita el service worker**, que no tiene pestaña.
 * ==========================================================================
 *
 * QUÉ ES ESTO, Y POR QUÉ NO VIAJA CON EL ÍTEM
 * -------------------------------------------
 * La medición del 1d siguió el camino completo del escaneo hasta el SW y encontró **cuatro
 * saltos con re-mapeo explícito campo por campo**: `escanearListado` → `popup.js` (arma la
 * clase) → `queue.js` (arma el ítem de cola, 7 campos elegidos a mano) → storage →
 * `procesadorCola`. Meter la credencial en ese tren costaba tocar los cuatro, agregaba un
 * campo al esquema persistido de DOS colecciones y **duplicaba el token en cada ítem**, con
 * copias que envejecen por separado.
 *
 * Pero una credencial **no es un atributo de la clase: es de la sesión del usuario en el
 * portal**. Guardarla una vez por portal deja el tren intacto (`Clase` y `ColaItem` no
 * cambian), no necesita migración —una instalación sin la clave lee `{}`— y hace que
 * re-escanear refresque el token de TODA la cola de ese portal de una sola vez.
 *
 * POR QUÉ ES UN MÓDULO PROPIO Y NO UN CAMPO DE `AppState`
 * -------------------------------------------------------
 * `AppState` es del popup (docs/data-model.md §State ownership split) y acá el lector es el
 * **service worker**. Es la misma razón por la que `identidadClase` y el resolvedor de
 * portales son exports compartidos de `plataforma/composicion.ts` en vez de helpers locales:
 * si cada lado se armara el suyo, podrían divergir en silencio. Un módulo, inyectado a los
 * dos.
 *
 * QUÉ NO HACE
 * -----------
 * No sabe qué credenciales necesita cada portal ni las valida: es un `Record<string,string>`
 * opaco que el adaptador escribe (desde su `escanearListado`) y lee (en su
 * `resolverManifiesto`). El vocabulario —`idToken`, `productId`— es de Capa 2 y no entra acá.
 * Tampoco sabe si están vencidas: eso lo descubre el adaptador cuando la API le contesta.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

/** Clave única en `chrome.storage.local`. Ver docs/data-model.md. */
export const CLAVE_CREDENCIALES = "credencialesPortal";

/** Lo que el adaptador de un portal escribe y lee. Opaco a propósito. */
export type CredencialesDePortal = Record<string, string>;

interface DatosCredenciales {
  [CLAVE_CREDENCIALES]?: Record<string, CredencialesDePortal>;
}

export interface CredencialesPortalAPI {
  /**
   * Las credenciales vigentes de un portal, o `undefined` si nunca se escanearon (o si el
   * `sitioId` no vino). `undefined` **no es un error**: un portal que no necesita
   * credenciales —Ramón Net— nunca escribe ninguna y su `resolverManifiesto` ignora el
   * parámetro.
   */
  para(sitioId: string | undefined): Promise<CredencialesDePortal | undefined>;
  /**
   * Reemplaza las de UN portal, sin tocar las de los otros. Con `undefined` las borra, que
   * es lo que corresponde cuando un escaneo no pudo cosechar ninguna: dejar las viejas
   * daría un fallo de auth mucho más adelante y más difícil de leer.
   */
  guardar(sitioId: string | undefined, credenciales: CredencialesDePortal | undefined): Promise<void>;
}

export function crearCredencialesPortal(almacenamiento: PuertoAlmacenamiento): CredencialesPortalAPI {
  async function leerMapa(): Promise<Record<string, CredencialesDePortal>> {
    const datos = await almacenamiento.obtenerLocal<DatosCredenciales>([CLAVE_CREDENCIALES]);
    const mapa = datos[CLAVE_CREDENCIALES];
    return mapa && typeof mapa === "object" ? mapa : {};
  }

  return {
    async para(sitioId) {
      if (!sitioId) return undefined;
      const mapa = await leerMapa();
      const credenciales = mapa[sitioId];
      // Un objeto vacío se trata como "no hay": el adaptador que reciba `{}` haría el fetch
      // igual y fallaría con un 400 que no parece de auth (le pasó a este portal midiendo).
      if (!credenciales || Object.keys(credenciales).length === 0) return undefined;
      return credenciales;
    },

    async guardar(sitioId, credenciales) {
      if (!sitioId) return;
      const mapa = await leerMapa();
      if (credenciales && Object.keys(credenciales).length > 0) {
        mapa[sitioId] = credenciales;
      } else {
        delete mapa[sitioId];
      }
      // Lectura-modificación-escritura sobre el mapa entero, no sobre la clave del portal:
      // el puerto sólo garantiza atomicidad DENTRO de una llamada, así que escribir el mapa
      // completo es lo que impide que guardar un portal borre otro.
      await almacenamiento.guardarLocal({ [CLAVE_CREDENCIALES]: mapa });
    },
  };
}

export default crearCredencialesPortal;
