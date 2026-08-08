/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: RESOLUCIÓN DEL MANIFIESTO (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [FIX] **Los errores ahora van TIPADOS.** Todos salían como `Error` pelado, y el bucle
 *   (`core/cola/procesadorCola.ts`) no tiene con qué clasificarlos: le pregunta al daemon, el
 *   daemon contesta que la red está bien, y el `else` de su heurística por mensaje decía
 *   "internet". O sea que un 403 del CDN se le mostraba al usuario como *"se perdió la conexión
 *   a internet"* — y encima programaba el auto-heal, que reintentaba contra el mismo 403 cada
 *   12 s. Ver el bloque LOS TRES TIPOS DE FALLO de abajo.
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Nace con el segundo portal. Todo el algoritmo está MEDIDO en el navegador el
 *   2026-08-07 — cadena de video, contrato de la API y auth incluidos. Ver
 *   `docs/portal-anatomy-by-chris-diseno.md`.
 * ==========================================================================
 *
 * LOS TRES TIPOS DE FALLO, Y POR QUÉ LA DIFERENCIA IMPORTA
 * --------------------------------------------------------
 * El bucle hace tres cosas MUY distintas según cómo venga tipado el error, así que elegir mal
 * el tipo no es cosmético:
 *
 *   - `tipoConexion: "sesion"` → **pausa la cola, sin auto-heal**. Es el token vencido o
 *     ausente: ninguna clase de este portal va a andar hasta que el usuario re-escanee. Ya
 *     existía para Ramón Net (su redirect al login); acá es el `id_token` de Hotmart.
 *   - `tipoPortal: "rechazo"` → **saltea SÓLO esa clase y sigue**. Es un fallo de *esa* lección
 *     y de ninguna otra: no existe, no tiene media, tiene DRM. La cola continúa.
 *   - `tipoPortal: "bloqueo"` → **pausa la cola, sin auto-heal**. Es sistémico: el embed sin
 *     `Referer` (401) o el CDN rechazando el master (403) le van a pasar IGUAL a las 114
 *     clases. **Y por eso no se saltea**: saltear un fallo sistémico vacía la cola entera clase
 *     por clase, en silencio y sin que el usuario entienda por qué se quedó sin nada. Es el
 *     mismo patrón que ya mordió dos veces en este proyecto (la identidad que borra la
 *     homónima, el `sitioId` huérfano que resuelve al portal equivocado).
 *
 * La regla, entonces, no es "4xx = saltear" sino **por clase se saltea, sistémico se pausa**.
 * Un 404 de la lección es por clase; un 403 del CDN no lo es.
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

/**
 * Error del adaptador. `extra` son las props que el bucle lee para clasificar
 * (`tipoConexion` / `tipoPortal` / `httpStatus`) — ver el bloque de tipos del encabezado.
 * Sin `extra` el error queda SIN tipar, y eso significa "no sé qué pasó": el bucle lo pausa
 * con auto-heal. Es el default correcto para lo inesperado, no para lo que ya sabemos.
 */
function fallo(paso, detalle, extra) {
  const e = new Error(`[anatomy-by-chris] ${paso}: ${detalle}`);
  if (extra) Object.assign(e, extra);
  return e;
}

/**
 * Status HTTP de un paso de la cadena → con qué tipo lanzarlo.
 *
 * **401 y 403 son siempre sistémicos acá**, y no es una generalización cómoda: los tres únicos
 * motivos posibles en esta cadena —el `id_token`, el `Referer` que pone la regla dNR y la
 * protección de hotlink del CDN— le pasan igual a las 114 clases. El resto de los 4xx sí son de
 * *esa* lección (no existe, cambió de tipo). Los 5xx quedan **sin tipar a propósito**: un CDN
 * caído es transitorio y ahí el auto-heal es exactamente lo que uno quiere.
 */
function tipoSegunHttp(status) {
  if (status === 401 || status === 403) return { tipoPortal: "bloqueo", httpStatus: status };
  if (status >= 400 && status < 500) return { tipoPortal: "rechazo", httpStatus: status };
  return undefined;
}

const ResolverManifiestoAnatomy = {
  /**
   * URL de la página de la clase → URL de la VARIANTE `.m3u8`.
   *
   * @param {string} urlClase     `https://hotmart.com/es/club/…/products/<id>/content/<hash>`
   * @param {AbortSignal} [signal]
   * @param {{ idToken?: string }} [credenciales] Cosechadas por el scraper en la pestaña
   *        (`core/estado/credencialesPortal.ts`). Sin ellas no se puede ni empezar.
   * @param {number} [alturaMaxima] Tope de calidad del portal, que lo pone `config.ts` — el
   *        VALOR es del portal y el ALGORITMO de acá. Se pasa por parámetro y no se importa
   *        porque este `.js` no puede leer el `.ts` del descriptor (`allowJs: false`).
   */
  async resolver(urlClase, signal, credenciales, alturaMaxima) {
    // Una URL mal formada es de ESTA clase y de ninguna otra: se saltea y la cola sigue.
    const hash = (RE_HASH_LECCION.exec(urlClase || "") || [])[1];
    if (!hash) {
      throw fallo("URL de clase", `no tiene /content/<hash>: ${urlClase}`, { tipoPortal: "rechazo" });
    }

    const productId = (RE_PRODUCT_ID.exec(urlClase || "") || [])[1];
    if (!productId) {
      throw fallo("URL de clase", `no tiene /products/<id>: ${urlClase}`, { tipoPortal: "rechazo" });
    }

    const idToken = credenciales && credenciales.idToken;
    if (!idToken) {
      // Mensaje explícito a propósito: el usuario tiene que saber que la salida es re-escanear
      // el portal, no reintentar. Sin esto el fallo se ve como "no encontré el video".
      throw fallo(
        "credenciales",
        "no hay id_token guardado para este portal. Abrí el club y re-escaneá para renovarlo.",
        // `sesion` y no `bloqueo`: los dos pausan sin auto-heal, pero éste le dice al usuario
        // QUÉ hacer (re-escanear), que es la diferencia entre un cartel útil y uno que sólo
        // informa que algo salió mal.
        { tipoConexion: "sesion" }
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
      // El 401 de ESTA API es el `id_token` vencido, y se trata como sesión (no como bloqueo)
      // para que el cartel diga "re-escaneá" en vez de "el portal rechazó la descarga".
      const extra =
        rLeccion.status === 401 ? { tipoConexion: "sesion" } : tipoSegunHttp(rLeccion.status);
      throw fallo(
        "API de lecciones",
        rLeccion.status === 401
          ? "el id_token venció. Abrí el club y re-escaneá para renovarlo."
          : `HTTP ${rLeccion.status} para la lección ${hash}`,
        extra
      );
    }
    const leccion = await rLeccion.json();

    const medias = (leccion && leccion.medias) || [];
    const media = medias.find((m) => m && m.url);
    if (!media) {
      // `hasMedia: false` es el caso legítimo: una clase de TEXTO. El scraper ya no las
      // encola, así que llegar acá significa que la clase cambió de tipo en el portal.
      throw fallo("API de lecciones", `la lección ${hash} no trae ningún media con url`, {
        tipoPortal: "rechazo",
      });
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
        `HTTP ${rEmbed.status}. Un 401 acá suele ser la regla de Referer (dNR) sin cargar.`,
        tipoSegunHttp(rEmbed.status)
      );
    }
    const htmlEmbed = await rEmbed.text();

    // Que el embed cambie de forma es SISTÉMICO: si Hotmart movió el `__NEXT_DATA__`, no falla
    // esta clase, fallan todas. Saltear una por una vaciaría la cola sin decir nada.
    const crudoNextData = (RE_NEXT_DATA.exec(htmlEmbed) || [])[1];
    if (!crudoNextData) {
      throw fallo("embed", 'no tiene el <script id="__NEXT_DATA__">', { tipoPortal: "bloqueo" });
    }

    let nextData;
    try {
      nextData = JSON.parse(crudoNextData);
    } catch (e) {
      throw fallo("embed", `__NEXT_DATA__ no es JSON válido (${e && e.message})`, {
        tipoPortal: "bloqueo",
      });
    }

    const appData =
      (nextData && nextData.props && nextData.props.pageProps &&
        nextData.props.pageProps.applicationData) || {};

    if (appData.isDrmEnabled) {
      // No debería pasar (medido: `false`), pero si Hotmart lo activa, el motor no puede y hay
      // que decirlo acá y no dejar que la descarga falle diez pasos más adelante.
      throw fallo("embed", "el video tiene DRM activo: este motor no puede descargarlo", {
        tipoPortal: "rechazo",
      });
    }

    // ⚠️ `mediaAssets` son CINCO entradas con la MISMA `url`. Difieren sólo en `height`
    // (1080/540/720/360/240) y las cinco dicen `qualityLabel: "auto"`. El `height` invita a
    // creer que hay una URL por calidad y no la hay: la calidad se elige más abajo, entre las
    // variantes del master. Se toma la primera con url y se sigue.
    const assets = appData.mediaAssets || [];
    const master = (assets.find((a) => a && a.url) || {}).url;
    if (!master) {
      throw fallo("embed", "__NEXT_DATA__ no trae mediaAssets con url", { tipoPortal: "rechazo" });
    }

    // --- 3. El master: elegir variante ----------------------------------------------
    const rMaster = await fetch(master, { signal });
    if (!rMaster.ok) {
      // OJO con el mensaje de antes, que mandaba al lugar equivocado: decía que un 403 era el
      // `hdnts` resuelto tarde, y **no puede serlo**. El master sale del `__NEXT_DATA__` del
      // embed y se pide en el `await` siguiente, milisegundos después; los 500 s de vida del
      // token no se consumen entre dos líneas. Un 403 acá es auth de CDN — hotlink protection,
      // o sea el `Referer` que la regla dNR pone para el embed y NO para este host.
      throw fallo(
        "master",
        `HTTP ${rMaster.status}. Un 403 acá es el CDN rechazando el pedido (Referer/hotlink), ` +
          `no el hdnts vencido: el master se resolvió recién.`,
        tipoSegunHttp(rMaster.status)
      );
    }
    const textoMaster = await rMaster.text();

    return ResolverManifiestoAnatomy.elegirVariante(textoMaster, master, alturaMaxima);
  },

  /**
   * Playlist master → URL absoluta de la variante elegida.
   *
   * **EL CRITERIO, Y POR QUÉ ES UN RANGO Y NO UN NÚMERO**
   * ------------------------------------------------------
   *     el escalón MÁS ALTO cuyo `RESOLUTION` no pase de `alturaMaxima`;
   *     si ninguno baja de ahí, el MÁS CHICO disponible.
   *
   * Nunca una búsqueda exacta ("dame 720"). El día que Hotmart mueva la escalera, una búsqueda
   * exacta no encuentra nada y se rompe **hacia el peor lado posible**: devolver el master, que
   * `hlsEngine` no distingue de una playlist de medios y baja como si fuera un `.ts`, mandándole
   * al backend un archivo de KB sin un error en ningún lado. Con la regla por rango, el mismo
   * cambio de escalera degrada sola a la calidad vecina.
   *
   * La escalera medida el 2026-08-07 (clase *Osteologia*): 240 / 360 / 540 / 720 / 1080.
   * **No hay escalón 480**, así que "clavarlo en 480" era irrealizable tal cual — hay que
   * elegir vecino, que es exactamente lo que hace esta regla.
   *
   * `alturaMaxima` la pone el PORTAL (`config.ts`), no este archivo: es una decisión de
   * producto, no del algoritmo.
   *
   * **El fallback a `BANDWIDTH`** cubre un master cuyas variantes no declaren `RESOLUTION`
   * (es opcional en el estándar). Ahí no hay altura que comparar y se elige la de mayor ancho
   * de banda, que era el criterio anterior de este método.
   *
   * Si el texto NO es un master (no tiene `#EXT-X-STREAM-INF`) se devuelve la URL original:
   * ya es una playlist de medios y el motor la puede leer tal cual. Eso deja este resolvedor
   * a salvo de que Hotmart cambie a servir la playlist directo.
   *
   * @param {string} textoMaster
   * @param {string} urlMaster
   * @param {number} [alturaMaxima] Tope del portal. Sin tope, se comporta como antes.
   */
  elegirVariante(textoMaster, urlMaster, alturaMaxima) {
    const lineas = String(textoMaster || "").split(/\r?\n/);

    /** @type {{ alto: number, ancho: number, uri: string }[]} */
    const variantes = [];

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (linea.indexOf("#EXT-X-STREAM-INF") !== 0) continue;

      const mBw = /BANDWIDTH=(\d+)/.exec(linea);
      const mRes = /RESOLUTION=(\d+)x(\d+)/.exec(linea);

      // La URI de la variante es la primera línea no vacía y no-comentario que sigue.
      let j = i + 1;
      while (j < lineas.length && (!lineas[j].trim() || lineas[j].trim()[0] === "#")) j++;
      const uri = j < lineas.length ? lineas[j].trim() : "";
      if (!uri) continue;

      variantes.push({
        alto: mRes ? parseInt(mRes[2], 10) : 0,
        ancho: mBw ? parseInt(mBw[1], 10) : 0,
        uri: uri,
      });
    }

    let mejorUrl = "";

    // Con altura declarada en alguna variante, manda la altura. Se ordena de mayor a menor y se
    // toma la primera que entra en el tope; si ninguna entra, la última (la más chica).
    const conAltura = variantes.filter((v) => v.alto > 0);
    if (conAltura.length > 0) {
      conAltura.sort((a, b) => b.alto - a.alto);
      const tope = typeof alturaMaxima === "number" && alturaMaxima > 0 ? alturaMaxima : Infinity;
      const elegida =
        conAltura.find((v) => v.alto <= tope) || conAltura[conAltura.length - 1];
      mejorUrl = elegida.uri;
    } else if (variantes.length > 0) {
      // Sin `RESOLUTION` en ninguna: criterio viejo, el mayor `BANDWIDTH`.
      mejorUrl = variantes.reduce((a, b) => (b.ancho > a.ancho ? b : a)).uri;
    }

    if (!mejorUrl) {
      if (textoMaster && textoMaster.indexOf("#EXT-X-STREAM-INF") === -1) return urlMaster;
      // Sistémico igual que el embed sin `__NEXT_DATA__`: si el master cambió de forma, cambió
      // para todas las clases.
      throw fallo("master", "no se pudo elegir ninguna variante", { tipoPortal: "bloqueo" });
    }

    // Las variantes vienen relativas al master, y el master lleva query (`?hdnts=…`) que NO
    // hay que arrastrar: la variante trae su propio `hdntl`. `new URL` resuelve las dos cosas.
    return new URL(mejorUrl, urlMaster).href;
  },
};

// Exportación dual (ver docs/coding-standards.md). Global con nombre PROPIO del portal.
globalThis.ResolverManifiestoAnatomy = ResolverManifiestoAnatomy;
export default ResolverManifiestoAnatomy;
