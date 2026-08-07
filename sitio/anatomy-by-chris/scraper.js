/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: SCRAPER DEL LISTADO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Primer scraper del segundo portal. Los selectores salen de medir el HTML
 *   real de tres páginas guardadas del club (ver `docs/portal-anatomy-by-chris-diseno.md`
 *   §El scraper), no de suponer.
 * ==========================================================================
 *
 * ⚠️ REGLA DEL PROYECTO, Y ACÁ NO HAY RED QUE LA ATAJE
 * ----------------------------------------------------
 * `escanearListadoDelModulo` se INYECTA en la pestaña del portal vía
 * `chrome.scripting.executeScript`: corre en LA PÁGINA, no en la extensión. Tiene que ser
 * **autocontenida y serializable** — no puede referenciar ninguna global de la extensión
 * (ni `Utils`, ni el descriptor) **ni una constante de este mismo archivo**. Todo lo que
 * necesite va adentro de la función.
 *
 * Romper esto no lo detecta el bundler, ni el lint, ni `tsc`, ni la suite: sólo el navegador.
 * Ver `docs/architecture.md` §Capa 2.
 *
 * POR QUÉ EL GLOBAL SE LLAMA `ScraperAnatomy` Y NO `Scraper`
 * ----------------------------------------------------------
 * Porque `Scraper` ya es de Ramón Net. Dos adaptadores publicando el mismo nombre hacen que
 * el último entrypoint evaluado le pise el suyo al otro, y el síntoma es un portal escaneando
 * con el adaptador ajeno — silencioso. Ver `docs/multisitio-diseno.md` §Cómo escribir un
 * portal nuevo.
 *
 * EL DESAJUSTE ESTRUCTURAL: UN ESCANEO = UN MÓDULO
 * -------------------------------------------------
 * `ResultadoEscaneo` es `{ materia, enlaces[] }`, o sea un nivel. Hotmart tiene dos
 * (producto → 11 módulos → clases). La resolución elegida es **un escaneo por módulo**: el
 * usuario abre un módulo y escanea, `materia` es el nombre de ese módulo. Encaja en el
 * contrato sin tocarlo. El costo aceptado: bajar el curso entero son 11 escaneos.
 */

const ScraperAnatomy = {
  /**
   * Corre DENTRO de la pestaña del portal. Autocontenida y serializable.
   *
   * Devuelve además `credenciales`, que es lo que sólo se puede leer desde acá: el service
   * worker no tiene pestaña y su `resolverManifiesto` necesita el `id_token`.
   */
  escanearListadoDelModulo: function () {
    // --- 1. El módulo activo, que es de donde sale `materia` ------------------------
    //
    // El `<h1>` NO sirve: es el título de la CLASE, así que cada clase caería en su propia
    // carpeta. El nombre del módulo está en la cabecera expandida del sidebar.
    //
    // Anclas: `aria-expanded` / `aria-controls` / `data-test`. NUNCA `class` — las clases son
    // Tailwind generado y hashes de CSS-modules, y cambian con cada build de Hotmart.
    // Tampoco `aside` a secas: el PRIMER `<aside>` de la página es el panel de Perfil.
    const cabecera = document.querySelector(
      'button[aria-expanded="true"][aria-controls^="sectionId_"]'
    );
    if (!cabecera) {
      return { materia: "", enlaces: [], credenciales: undefined };
    }

    const nodoNombre = cabecera.querySelector('[data-test="module-item-name"]');
    const nombreModulo = (
      (nodoNombre && (nodoNombre.getAttribute("title") || nodoNombre.textContent)) ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();

    // `materia` es el nombre de la carpeta en disco (`raíz/anatomy-by-chris/<materia>/`), así
    // que se sanea acá y no después: el resto del código la trata como un nombre ya válido.
    const materia = nombreModulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    // --- 2. Las clases de ESE módulo ------------------------------------------------
    //
    // Se barre la sección que la cabecera declara por `aria-controls`, no todas las
    // `[data-hash]` de la página: el contenedor `[data-test="lesson-module-list"]` es común a
    // los once módulos, así que un barrido suelto mezclaría módulos si hubiera dos expandidos.
    const seccion = document.getElementById(cabecera.getAttribute("aria-controls"));
    const filas = seccion ? seccion.querySelectorAll("div[data-hash]") : [];

    const enlaces = [];
    for (const fila of filas) {
      // El enlace de la fila. Los `<a href*="/content/">` de la página incluyen las flechas
      // de navegación "Anterior/Próxima" (`?source=CLASS_TOP_ARROW`), que NO son clases;
      // buscar dentro de la fila ya las deja afuera, y el filtro por `source` lo asegura.
      const a = fila.querySelector('a[href*="/content/"]');
      if (!a) continue;
      const href = a.href || "";
      if (href.indexOf("CLASS_TOP_ARROW") !== -1) continue;

      // ⚠️ `innerText` viene ENVENENADO: los íconos son FontAwesome inline con un `<title>`
      // accesible adentro del `<a>` ("Ícono de un curso del tipo Texto"), y la clase que se
      // está reproduciendo suma además "Tocando ahora". O sea que la basura NO es la misma en
      // todas las filas, que es lo que hace fácil no darse cuenta. El título limpio está en
      // el atributo `title` del `<span>`.
      const span = fila.querySelector("span[title]");
      const texto = ((span && span.getAttribute("title")) || "").replace(/\s+/g, " ").trim();
      if (!texto) continue;

      // ¿Es una clase de VIDEO? Lo dice el thumbnail. El `data-icon` del SVG NO sirve: la
      // fila activa suma el ícono `play` aunque la clase sea de texto.
      const tieneThumbnail = !!fila.querySelector(
        '[data-test="content-background-thumbnail"], img[src*="/thumbnail/"]'
      );
      if (!tieneThumbnail) continue;

      enlaces.push({ texto: texto, href: href });
    }

    // --- 3. Las credenciales, que sólo existen acá adentro ---------------------------
    //
    // La API del club pide `Authorization: Bearer <id_token>`. El `id_token` está en
    // `localStorage["token"]` de la pestaña (dura ~12 días). OJO: el `access_token` opaco de
    // OIDC NO sirve para esta API.
    //
    // `x-product-id` no viaja acá: sale de la URL de cada clase, que el ítem de la cola ya
    // lleva. Un dato menos que persistir y que puede vencer.
    let credenciales;
    try {
      const idToken = window.localStorage.getItem("token");
      if (idToken) credenciales = { idToken: idToken };
    } catch (e) {
      // localStorage puede tirar (modo restringido). Sin credenciales el escaneo igual sirve;
      // lo que falla después es la resolución, con un error explícito.
      void e;
    }

    return { materia: materia, enlaces: enlaces, credenciales: credenciales };
  },
};

// Exportación dual (ver docs/coding-standards.md). El global lleva nombre PROPIO del portal.
globalThis.ScraperAnatomy = ScraperAnatomy;
export default ScraperAnatomy;
