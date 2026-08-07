/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: RESOLUCIÓN DEL MANIFIESTO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Nace con el segundo portal. Todo el algoritmo está MEDIDO en el navegador el
 *   2026-08-07 — cadena de video, contrato de la API y auth incluidos. Ver
 *   `docs/portal-anatomy-by-chris-diseno.md`.
 * ==========================================================================
 *
 * EL ALGORITMO, EN TRES FETCH
 * ----------------------------
 *   1. `GET …/v2/web/lessons/<hash>`  (Bearer id_token + x-product-id)
 *        → `medias[0].url`: la URL del embed, con un `jwtToken` **fresco en cada llamada**.
 *   2. `GET <embed>`  (con `Referer`, que lo pone `declarativeNetRequest`)
 *        → `<script id="__NEXT_DATA__">` → `…applicationData.mediaAssets[0].url`: el MASTER.
 *   3. `GET <master>`
 *        → elegir una VARIANTE y devolver ESA URL.
 *
 * POR QUÉ SE DEVUELVE LA VARIANTE Y NO EL MASTER
 * -----------------------------------------------
 * Porque `core/hls/hlsEngine.ts` **no sabe leer un master multi-variante y falla en
 * silencio**: toma toda línea sin `#` como fragmento, así que ante un master se baja el
 * `.m3u8` de la variante creyéndolo un `.ts`, lo desencripta y le manda al backend un archivo
 * de unos KB — sin un error en ningún lado. Ramón Net nunca lo destapó porque su plantilla
 * apunta directo a una playlist de medios. Elegir la variante es trabajo del adaptador.
 *
 * POR QUÉ NO SE PUEDE RESOLVER AL ENCOLAR (los dos tokens tienen vidas distintas)
 * -------------------------------------------------------------------------------
 *   - el `hdnts` del MASTER vive **500 s** → los pasos 1-3 van al bajar, no al encolar.
 *   - el `hdntl` de la VARIANTE (y de la clave AES y los fragmentos) vive **24 h** → una vez
 *     resuelta la variante, la descarga entera tiene tiempo de sobra.
 *
 * POR QUÉ ES ESTRICTO Y NO TIENE FALLBACKS POR REGEX
 * ---------------------------------------------------
 * A propósito, y es la diferencia con el de Ramón Net: aquel degrada en silencio y puede
 * resolver el video de OTRA clase en vez de fallar (`docs/architecture.md` §Capa 2). Acá el
 * dato viene de un `<script type="application/json">`, así que se recorta y se hace
 * `JSON.parse`: o sale bien, o tira con un mensaje que dice qué paso falló.
 */

/** Base de la API del club. Medida, no adivinada. */
const API_LECCIONES =
  "https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v2/web/lessons/";

/** El hash de la lección es el último segmento de `/content/<hash>`. */
const RE_HASH_LECCION = /\/content\/([A-Za-z0-9]+)/;
/** El id del producto vive en la URL del portal: `/products/<id>`. */
const RE_PRODUCT_ID = /\/products\/(\d+)/;

/** El `<script id="__NEXT_DATA__" type="application/json">` del embed. */
const RE_NEXT_DATA =
  /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;

function fallo(paso, detalle) {
  return new Error(`[anatomy-by-chris] ${paso}: ${detalle}`);
}

const ResolverManifiestoAnatomy = {
  /**
   * URL de la página de la clase → URL de la VARIANTE `.m3u8`.
   *
   * @param {string} urlClase     `https://hotmart.com/es/club/…/products/<id>/content/<hash>`
   * @param {AbortSignal} [signal]
   * @param {{ idToken?: string }} [credenciales] Cosechadas por el scraper en la pestaña
   *        (`core/estado/credencialesPortal.ts`). Sin ellas no se puede ni empezar.
   */
  async resolver(urlClase, signal, credenciales) {
    const hash = (RE_HASH_LECCION.exec(urlClase || "") || [])[1];
    if (!hash) throw fallo("URL de clase", `no tiene /content/<hash>: ${urlClase}`);

    const productId = (RE_PRODUCT_ID.exec(urlClase || "") || [])[1];
    if (!productId) throw fallo("URL de clase", `no tiene /products/<id>: ${urlClase}`);

    const idToken = credenciales && credenciales.idToken;
    if (!idToken) {
      // Mensaje explícito a propósito: el usuario tiene que saber que la salida es re-escanear
      // el portal, no reintentar. Sin esto el fallo se ve como "no encontré el video".
      throw fallo(
        "credenciales",
        "no hay id_token guardado para este portal. Abrí el club y re-escaneá para renovarlo."
      );
    }

    // --- 1. La lección: de acá sale el embed con jwtToken fresco ---------------------
    //
    // OJO con el `x-product-id`: sin ese header la API contesta
    // `400 Validation error: Required header 'x-product-id' is not present`, que NO parece un
    // error de auth y hace perder tiempo buscando el token equivocado.
    const rLeccion = await fetch(API_LECCIONES + encodeURIComponent(hash), {
      signal,
      headers: {
        Authorization: `Bearer ${idToken}`,
        "x-product-id": productId,
      },
    });
    if (!rLeccion.ok) {
      throw fallo("API de lecciones", `HTTP ${rLeccion.status} para la lección ${hash}`);
    }
    const leccion = await rLeccion.json();

    const medias = (leccion && leccion.medias) || [];
    const media = medias.find((m) => m && m.url);
    if (!media) {
      // `hasMedia: false` es el caso legítimo: una clase de TEXTO. El scraper ya no las
      // encola, así que llegar acá significa que la clase cambió de tipo en el portal.
      throw fallo("API de lecciones", `la lección ${hash} no trae ningún media con url`);
    }

    // --- 2. El embed: el master viene renderizado del lado del servidor --------------
    //
    // Este fetch necesita `Referer: https://hotmart.com/` o el embed contesta 401. `Referer`
    // es un header prohibido para `fetch`, así que lo pone `declarativeNetRequest`
    // (`public/sitio/anatomy-by-chris/rules.json`). Si esa regla no está cargada, el síntoma
    // es exactamente este 401.
    const rEmbed = await fetch(media.url, { signal });
    if (!rEmbed.ok) {
      throw fallo(
        "embed",
        `HTTP ${rEmbed.status}. Un 401 acá suele ser la regla de Referer (dNR) sin cargar.`
      );
    }
    const htmlEmbed = await rEmbed.text();

    const crudoNextData = (RE_NEXT_DATA.exec(htmlEmbed) || [])[1];
    if (!crudoNextData) throw fallo("embed", "no tiene el <script id=\"__NEXT_DATA__\">");

    let nextData;
    try {
      nextData = JSON.parse(crudoNextData);
    } catch (e) {
      throw fallo("embed", `__NEXT_DATA__ no es JSON válido (${e && e.message})`);
    }

    const appData =
      (nextData && nextData.props && nextData.props.pageProps &&
        nextData.props.pageProps.applicationData) || {};

    if (appData.isDrmEnabled) {
      // No debería pasar (medido: `false`), pero si Hotmart lo activa, el motor no puede y hay
      // que decirlo acá y no dejar que la descarga falle diez pasos más adelante.
      throw fallo("embed", "el video tiene DRM activo: este motor no puede descargarlo");
    }

    // ⚠️ `mediaAssets` son CINCO entradas con la MISMA `url`. Difieren sólo en `height`
    // (1080/540/720/360/240) y las cinco dicen `qualityLabel: "auto"`. El `height` invita a
    // creer que hay una URL por calidad y no la hay: la calidad se elige más abajo, entre las
    // variantes del master. Se toma la primera con url y se sigue.
    const assets = appData.mediaAssets || [];
    const master = (assets.find((a) => a && a.url) || {}).url;
    if (!master) throw fallo("embed", "__NEXT_DATA__ no trae mediaAssets con url");

    // --- 3. El master: elegir variante ----------------------------------------------
    const rMaster = await fetch(master, { signal });
    if (!rMaster.ok) {
      throw fallo(
        "master",
        `HTTP ${rMaster.status}. El hdnts del master vive 500 s: si esto es 403, se resolvió tarde.`
      );
    }
    const textoMaster = await rMaster.text();

    return ResolverManifiestoAnatomy.elegirVariante(textoMaster, master);
  },

  /**
   * Playlist master → URL absoluta de la variante elegida.
   *
   * **Criterio: la de mayor `BANDWIDTH`.** Ramón Net baja una calidad fija (480p) porque su
   * plantilla la clavaba; acá no hay plantilla, y el usuario está bajando clases para verlas,
   * no para ahorrar disco.
   *
   * Si el texto NO es un master (no tiene `#EXT-X-STREAM-INF`) se devuelve la URL original:
   * ya es una playlist de medios y el motor la puede leer tal cual. Eso deja este resolvedor
   * a salvo de que Hotmart cambie a servir la playlist directo.
   */
  elegirVariante(textoMaster, urlMaster) {
    const lineas = String(textoMaster || "").split(/\r?\n/);
    let mejorAncho = -1;
    let mejorUrl = "";

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (linea.indexOf("#EXT-X-STREAM-INF") !== 0) continue;

      const mBw = /BANDWIDTH=(\d+)/.exec(linea);
      const ancho = mBw ? parseInt(mBw[1], 10) : 0;

      // La URI de la variante es la primera línea no vacía y no-comentario que sigue.
      let j = i + 1;
      while (j < lineas.length && (!lineas[j].trim() || lineas[j].trim()[0] === "#")) j++;
      const uri = j < lineas.length ? lineas[j].trim() : "";
      if (!uri) continue;

      if (ancho > mejorAncho) {
        mejorAncho = ancho;
        mejorUrl = uri;
      }
    }

    if (!mejorUrl) {
      if (textoMaster && textoMaster.indexOf("#EXT-X-STREAM-INF") === -1) return urlMaster;
      throw fallo("master", "no se pudo elegir ninguna variante");
    }

    // Las variantes vienen relativas al master, y el master lleva query (`?hdnts=…`) que NO
    // hay que arrastrar: la variante trae su propio `hdntl`. `new URL` resuelve las dos cosas.
    return new URL(mejorUrl, urlMaster).href;
  },
};

// Exportación dual (ver docs/coding-standards.md). Global con nombre PROPIO del portal.
globalThis.ResolverManifiestoAnatomy = ResolverManifiestoAnatomy;
export default ResolverManifiestoAnatomy;
