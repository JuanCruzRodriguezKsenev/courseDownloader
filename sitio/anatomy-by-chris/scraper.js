/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: ESCANEO DEL LISTADO (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [ESCANEO-API CORTE 1] **El escaneo deja de leer el DOM y le pide el árbol a la API del
 *   club.** Una sola llamada a `/v1/navigation` devuelve los 11 módulos y las 114 clases. Eso
 *   mata de raíz los tres síntomas que tenía el escaneo por DOM, y cada uno tenía su causa:
 *     1. *"Hay que entrar a una clase para que aparezcan videos"* → el sidebar sólo existe
 *        dentro de una clase. La API contesta igual desde la home del producto.
 *     2. *"Sólo aparece el módulo abierto"* → se barría la sección `aria-expanded="true"`, o
 *        sea uno de once. Ahora vienen los once, y **la acumulación entre escaneos no hace
 *        falta**: un escaneo trae todo.
 *     3. *"A veces no muestra ni los de la clase actual"* → el listado lo pinta JS y el escaneo
 *        podía llegar antes. Un `fetch` no depende de que el DOM haya terminado.
 * - Cada enlace lleva su **`modulo`**, que es lo que hace a la clase identificable
 *   (`core/cola/identidadClase.ts`) y de paso decide su carpeta. Sin eso, los 7 títulos que
 *   viven en dos módulos a la vez se pisaban entre ellos y una descarga completada sacaba de la
 *   cola a su homónima.
 * - Muere la heurística del thumbnail: **`hasPlayerMedia` es el discriminador video/texto como
 *   DATO**. En la corrida real del 2026-08-07 esa heurística coló dos clases de Texto.
 * - `materia` pasa a devolverse **vacía a propósito** (ver abajo).
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Primer scraper del segundo portal, leyendo el DOM del sidebar.
 * ==========================================================================
 *
 * ⚠️ REGLA DEL PROYECTO, Y ACÁ NO HAY RED QUE LA ATAJE
 * ----------------------------------------------------
 * `escanearListadoDelModulo` se INYECTA en la pestaña del portal vía
 * `chrome.scripting.executeScript`: corre en LA PÁGINA, no en la extensión. Tiene que ser
 * **autocontenida y serializable** — no puede referenciar ninguna global de la extensión
 * (ni `Utils`, ni el descriptor) **ni una constante de este mismo archivo**. Todo lo que
 * necesite va adentro de la función, y por eso la URL de la API y los regex están repetidos
 * adentro en vez de izados a constantes del módulo, que es la tentación obvia (riesgo R1).
 *
 * Romper esto no lo detecta el bundler, ni el lint, ni `tsc`, ni la suite: sólo el navegador.
 * Ver `docs/architecture.md` §Capa 2.
 *
 * POR QUÉ PUEDE SER `async`
 * --------------------------
 * `executeScript` espera la promesa y devuelve su valor resuelto. El puerto
 * (`core/puertos/sitio.ts`) declara `ResultadoEscaneo | Promise<ResultadoEscaneo>` y el único
 * call-site hace `await`, así que Ramón Net sigue siendo sincrónico sin enterarse.
 *
 * Y **es lo único que ningún test de este proyecto puede ver**: que una función `async` con un
 * `fetch` adentro sobreviva a ser serializada e inyectada. Se verifica en el navegador.
 *
 * POR QUÉ EL `fetch` VA ACÁ Y NO EN EL SERVICE WORKER
 * ----------------------------------------------------
 * Porque desde la pestaña el pedido sale con el origen `hotmart.com` —el club llama a esa misma
 * API— y con el `id_token` que vive en su `localStorage`. El SW no tiene ni una cosa ni la otra,
 * y por eso **el manifest no se toca**: no hace falta un host_permission nuevo.
 *
 * POR QUÉ `materia` VUELVE VACÍA
 * -------------------------------
 * Porque ya no hay UNA materia: hay once, una por módulo, y viaja con cada enlace. Devolver la
 * del módulo abierto sería mentir sobre las otras diez. El popup usa `enlace.modulo` como base
 * de la carpeta y deja el input vacío, con un placeholder que lo explica (corte 2).
 *
 * POR QUÉ EL GLOBAL SE LLAMA `ScraperAnatomy` Y NO `Scraper`
 * ----------------------------------------------------------
 * Porque `Scraper` ya es de Ramón Net. Dos adaptadores publicando el mismo nombre hacen que
 * el último entrypoint evaluado le pise el suyo al otro, y el síntoma es un portal escaneando
 * con el adaptador ajeno — silencioso. Ver `docs/multisitio-diseno.md` §Cómo escribir un
 * portal nuevo.
 */

const ScraperAnatomy = {
  /**
   * Corre DENTRO de la pestaña del portal. Autocontenida, serializable y `async`.
   *
   * Devuelve además `credenciales`, que es lo que sólo se puede leer desde acá: el service
   * worker no tiene pestaña y su `resolverManifiesto` necesita el `id_token`.
   *
   * **Nunca tira.** Un escaneo que falla devuelve `enlaces: []` y el popup conserva la lista
   * que ya tenía: una excepción cruzando `executeScript` se ve como "error de inyección", que
   * manda a diagnosticar permisos de host en vez del portal.
   */
  escanearListadoDelModulo: async function () {
    // Todo lo de adentro es local A PROPÓSITO (ver la regla del encabezado).
    const API_NAVEGACION =
      "https://api-club-course-consumption-gateway-ga.cb.hotmart.com/v1/navigation";

    const vacio = { materia: "", enlaces: [], credenciales: undefined };

    // --- 1. La base de la URL del portal, que es de donde salen el productId y los href ----
    //
    // Se saca de `location.href` y no de una constante: el segmento de idioma (`/es/`, `/pt/`)
    // y el id del producto son datos de la pestaña. Matchea igual desde la home del producto
    // (`…/products/<id>`) que desde adentro de una clase (`…/products/<id>/content/<hash>`),
    // que es justamente el síntoma 1.
    const m = /^(https:\/\/[^/]+\/[^/]+\/club\/[^/]+\/products\/(\d+))/.exec(
      window.location.href || ""
    );
    if (!m) return vacio;
    const base = m[1];
    const productId = m[2];

    // --- 2. Las credenciales, que sólo existen acá adentro ---------------------------
    //
    // La API del club pide `Authorization: Bearer <id_token>`. El `id_token` está en
    // `localStorage["token"]` de la pestaña (dura ~12 días). OJO: el `access_token` opaco de
    // OIDC NO sirve para esta API.
    //
    // Desde v2 son además lo que habilita el escaneo mismo, no sólo la resolución posterior:
    // sin token no hay árbol. Por eso si faltan se corta acá.
    let idToken = null;
    try {
      idToken = window.localStorage.getItem("token");
    } catch (e) {
      // localStorage puede tirar (modo restringido).
      void e;
    }
    if (!idToken) return vacio;
    const credenciales = { idToken: idToken };

    // --- 3. El árbol entero: 11 módulos, 114 clases, una sola llamada -----------------
    //
    // OJO con el `x-product-id`: sin ese header la API contesta
    // `400 Validation error: Required header 'x-product-id' is not present`, que NO parece un
    // error de auth y hace perder tiempo buscando el token equivocado.
    let arbol;
    try {
      const r = await fetch(API_NAVEGACION, {
        headers: {
          Authorization: "Bearer " + idToken,
          "x-product-id": productId,
        },
      });
      // Las credenciales se devuelven IGUAL aunque el árbol falle: puede fallar la red y el
      // token estar perfecto, y tirarlo obligaría a re-escanear sin motivo.
      if (!r.ok) return { materia: "", enlaces: [], credenciales: credenciales };
      arbol = await r.json();
    } catch (e) {
      void e;
      return { materia: "", enlaces: [], credenciales: credenciales };
    }

    // --- 4. Módulos y clases ----------------------------------------------------------
    //
    // El nombre del módulo se sanea ACÁ y no después: es el nombre de la carpeta en disco
    // (`raíz/anatomy-by-chris/<modulo>/`) y la mitad de la identidad de la clase, así que el
    // resto del código lo trata como un valor ya válido.
    const sanear = function (s) {
      return String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    };

    const modulos = (arbol && arbol.modules) || [];
    const enlaces = [];

    for (let i = 0; i < modulos.length; i++) {
      const modulo = modulos[i];
      if (!modulo) continue;
      const nombreModulo = sanear(modulo.name);
      const paginas = modulo.pages || [];

      for (let j = 0; j < paginas.length; j++) {
        const pagina = paginas[j];
        if (!pagina || !pagina.hash) continue;

        // `hasPlayerMedia` es el tipo como DATO: reemplaza a la heurística del thumbnail, que
        // dependía de que el sidebar hubiera terminado de pintar. Las 11 clases de Texto del
        // curso salen por acá.
        if (!pagina.hasPlayerMedia) continue;

        // Una clase bloqueada (drip de contenido) no se puede resolver: encolarla sería
        // programar un fallo. No es lo mismo que no existir, pero para el escaneo sí.
        if (pagina.locked) continue;

        const texto = String(pagina.name || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!texto) continue;

        enlaces.push({
          texto: texto,
          // Es exactamente la forma que `resolverManifiesto` ya parsea (`RE_HASH_LECCION` +
          // `RE_PRODUCT_ID`): encaja sin tocarlo.
          href: base + "/content/" + pagina.hash,
          modulo: nombreModulo,
        });
      }
    }

    return { materia: "", enlaces: enlaces, credenciales: credenciales };
  },
};

// Exportación dual (ver docs/coding-standards.md). El global lleva nombre PROPIO del portal.
globalThis.ScraperAnatomy = ScraperAnatomy;
export default ScraperAnatomy;
