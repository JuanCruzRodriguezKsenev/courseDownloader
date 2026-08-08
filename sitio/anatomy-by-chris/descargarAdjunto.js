/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: LA URL FIRMADA DE UN ADJUNTO (V1.2.0)
 * ==========================================================================
 * CHANGELOG v1.2.0:
 * - [FIX] El campo de la respuesta es **`directDownloadUrl`**, medido bajando el primer PDF. No
 *   era adivinable y la v1.1.0 probó cuatro nombres plausibles y erró los cuatro.
 * CHANGELOG v1.1.0:
 * - [FIX 403] El paso 2 manda `x-product-id`. Ver el bloque del 403 más abajo.
 * CHANGELOG v1.0.0:
 * - [ESCANEO-API CORTE 5] Nace con los materiales. Cuarto hermano `.js` del adaptador.
 * ==========================================================================
 *
 * QUÉ HACE, Y QUÉ NO
 * -------------------
 * Convierte el `fileMembershipId` de un adjunto en una **URL directa y descargable**. Nada más:
 * los bytes los baja el bucle (`core/cola/procesadorCola.ts`), que es genérico y ya sabe
 * mandárselos al backend. Acá vive sólo lo que es de Hotmart.
 *
 * Es el paso 2 de la cadena de tres que está medida entera en
 * `docs/portal-anatomy-by-chris-diseno.md` §Apéndice B:
 *
 *   1. listado   → `/v1/pages/<hash>/complementary-content`  (lo hace el scraper, al escanear)
 *   2. **firma** → `/rest/v3/attachment/<uuid>/download`     ← ESTE ARCHIVO
 *                  → `{ "directDownloadUrl": "https://hotmart-club-files…" }`  (medido)
 *   3. archivo   → CloudFront                                (lo hace el bucle, al bajar)
 *
 * ⚠️ POR QUÉ ESTO SE PIDE AL BAJAR Y NO AL ESCANEAR
 * --------------------------------------------------
 * Porque la URL que devuelve el paso 2 **vive exactamente 1 hora** (medido: 3601 s, es
 * CloudFront). Resolverla al encolar haría que una cola larga de PDF empiece a fallar a mitad de
 * camino, y el fallo se leería como "el portal rechazó el archivo" cuando en realidad se
 * resolvió demasiado temprano. Es el riesgo R8, y es la misma trampa que el `hdnts` de 500 s del
 * master ya había puesto en el camino del video.
 *
 * ⚠️ EL 403 DEL PRIMER PDF (2026-08-07), Y LAS DOS COSAS QUE LE FALTABAN
 * ------------------------------------------------------------------------
 * Bajar el primer adjunto dio **403**, y las dos causas eran del mismo tipo que ya habían
 * mordido dos veces en la cadena de video: **la medición se hizo desde una pestaña**, donde el
 * navegador manda `Origin`, `Referer` y cookies solo, y el service worker no manda ninguno.
 *
 *   1. Los dos hosts de esta cadena **no estaban en `host_permissions`** (`wxt.config.ts`). El
 *      de la firma es OTRO host que el de las lecciones —`hot-club-api`, no el gateway— y es
 *      fácil darlo por cubierto de un vistazo.
 *   2. El paso 2 salía **sin `x-product-id`** y **sin `Referer`**. El header lo pone este
 *      módulo; el `Referer` lo pone una regla dNR nueva, igual que para el embed.
 *
 * **El paso 3 NO lleva `Referer` a propósito**: está medido que anda con un `curl` pelado, y
 * agregarle uno sería inventar un requisito que el CDN no pidió.
 *
 * EL PASO 3 NO NECESITA CREDENCIALES, Y ESO DECIDE QUE EL SW PUEDA BAJARLO
 * ------------------------------------------------------------------------
 * Medido con `curl` pelado, sin cookies ni token ni `Referer`: `200 · application/pdf`, idéntico
 * al archivo bajado a mano. **No hace falta una regla dNR** para los adjuntos, a diferencia del
 * embed del video.
 *
 * EL NOMBRE DEL GLOBAL
 * ---------------------
 * `DescargarAdjuntoAnatomy`, con el sufijo del portal, por la misma razón que los otros tres
 * hermanos: dos adaptadores publicando el mismo nombre hacen que el último entrypoint evaluado
 * le pise el suyo al otro, en silencio. Ver `docs/multisitio-diseno.md`.
 */

/** Host de la API que firma. **Es otro** que el de las lecciones: `hot-club-api`, no el gateway. */
const API_ADJUNTO = "https://api-club-hot-club-api.cb.hotmart.com/rest/v3/attachment/";

/** Mismo criterio de tipado que `resolverManifiesto.js` — ver su encabezado. */
function fallo(paso, detalle, extra) {
  const e = new Error(`[anatomy-by-chris] ${paso}: ${detalle}`);
  if (extra) Object.assign(e, extra);
  return e;
}

const DescargarAdjuntoAnatomy = {
  /**
   * `fileMembershipId` → URL firmada del archivo.
   *
   * @param {string} idArchivo
   * @param {AbortSignal} [signal]
   * @param {{ idToken?: string }} [credenciales]
   * @param {string} [productId] Lo pasa `config.ts`, como el tope de calidad: el VALOR es del
   *        portal y este `.js` no puede leer el `.ts` del descriptor (`allowJs: false`).
   * @returns {Promise<string>}
   */
  async resolver(idArchivo, signal, credenciales, productId) {
    if (!idArchivo) {
      // De ESTE ítem y de ningún otro: se saltea y la cola sigue.
      throw fallo("adjunto", "el ítem no trae idArchivo", { tipoPortal: "rechazo" });
    }

    const idToken = credenciales && credenciales.idToken;
    if (!idToken) {
      // Mismo mensaje accionable que el video: la salida es re-escanear, no reintentar.
      throw fallo(
        "credenciales",
        "no hay id_token guardado para este portal. Abrí el club y re-escaneá para renovarlo.",
        { tipoConexion: "sesion" }
      );
    }

    // El `x-product-id` va también acá, aunque esta API sea otro host que la de lecciones: el
    // club identifica al producto por header en todas sus llamadas, y **la primera versión de
    // este módulo no lo mandaba** — que es una de las dos causas candidatas del 403 que apareció
    // al bajar el primer PDF. Es barato y no puede empeorar nada: si la API lo ignora, lo ignora.
    const headers = { Authorization: `Bearer ${idToken}` };
    if (productId) headers["x-product-id"] = String(productId);

    const r = await fetch(API_ADJUNTO + encodeURIComponent(idArchivo) + "/download", {
      signal,
      headers,
    });

    if (!r.ok) {
      // 401 = token vencido ⇒ "sesion" (le dice al usuario QUÉ hacer). 403 es sistémico igual
      // que en el video. El resto de los 4xx son de ESTE archivo.
      let extra;
      if (r.status === 401) extra = { tipoConexion: "sesion" };
      else if (r.status === 403) extra = { tipoPortal: "bloqueo", httpStatus: 403 };
      else if (r.status >= 400 && r.status < 500) extra = { tipoPortal: "rechazo", httpStatus: r.status };
      // Los 5xx quedan sin tipar a propósito: transitorios, y ahí el auto-heal sirve.

      throw fallo(
        "firma del adjunto",
        r.status === 401
          ? "el id_token venció. Abrí el club y re-escaneá para renovarlo."
          : `HTTP ${r.status} al pedir la URL de descarga de ${idArchivo}`,
        extra
      );
    }

    // La respuesta, MEDIDA el 2026-08-07 bajando el primer PDF:
    //
    //   { "directDownloadUrl": "https://hotmart-club-files.cb.hotmart.com/membership_area/…" }
    //
    // El nombre del campo **no era adivinable** —no es `url` ni `downloadUrl`— y la primera
    // versión de este módulo probó cuatro nombres plausibles y erró los cuatro. Lo que salvó el
    // diagnóstico fue que el error **volcara el cuerpo recibido** en vez de decir "no se pudo":
    // con los 120 caracteres del mensaje alcanzó para ver el campo real. Si tocás este bloque,
    // conservá eso.
    //
    // Los otros nombres quedan como TOLERANCIA, no como conocimiento: cubren que Hotmart lo
    // renombre, y ninguno puede resolver el archivo equivocado —son claves distintas del mismo
    // objeto—, que es la diferencia con los fallbacks por regex que este proyecto sí prohíbe.
    const texto = (await r.text()).trim();

    let url = "";
    if (texto.indexOf("{") === 0 || texto.indexOf("[") === 0) {
      try {
        const cuerpo = JSON.parse(texto);
        url =
          (typeof cuerpo === "string" && cuerpo) ||
          (cuerpo &&
            (cuerpo.directDownloadUrl || // ← el medido
              cuerpo.url ||
              cuerpo.downloadUrl ||
              cuerpo.signedUrl ||
              cuerpo.link)) ||
          "";
      } catch (e) {
        void e;
      }
    } else if (texto.indexOf("http") === 0) {
      url = texto.replace(/^"|"$/g, "");
    }

    if (!url) {
      // Sistémico: si la forma de la respuesta cambió, cambió para los 15 adjuntos.
      throw fallo(
        "firma del adjunto",
        `la respuesta no trae una URL reconocible (${texto.slice(0, 120)})`,
        { tipoPortal: "bloqueo" }
      );
    }

    return String(url);
  },
};

// Exportación dual (ver docs/coding-standards.md). El global lleva nombre PROPIO del portal.
globalThis.DescargarAdjuntoAnatomy = DescargarAdjuntoAnatomy;
export default DescargarAdjuntoAnatomy;
