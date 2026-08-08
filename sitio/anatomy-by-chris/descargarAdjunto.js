/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: LA URL FIRMADA DE UN ADJUNTO (V1.0.0)
 * ==========================================================================
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
   * @returns {Promise<string>}
   */
  async resolver(idArchivo, signal, credenciales) {
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

    const r = await fetch(API_ADJUNTO + encodeURIComponent(idArchivo) + "/download", {
      signal,
      headers: { Authorization: `Bearer ${idToken}` },
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

    // La respuesta trae la URL firmada. Se aceptan las dos formas en las que una API de este
    // estilo la devuelve —un string pelado o un objeto con la URL adentro— porque la medición
    // sólo observó el resultado final, y adivinar la envoltura exacta sería justo el tipo de
    // suposición que este repo no permite. Si no aparece, se dice qué se recibió.
    const texto = (await r.text()).trim();

    let url = "";
    if (texto.indexOf("{") === 0 || texto.indexOf("[") === 0) {
      try {
        const cuerpo = JSON.parse(texto);
        url =
          (typeof cuerpo === "string" && cuerpo) ||
          (cuerpo && (cuerpo.url || cuerpo.downloadUrl || cuerpo.signedUrl || cuerpo.link)) ||
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
