/**
 * ADAPTADOR DE SITIO — RAMÓN NET: CONFIGURACIÓN (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CAPA 2] Primer archivo del adaptador de sitio (ver ADR-0008 y
 *   docs/rearquitectura-diseno.md). Concentra lo que hoy estaba hardcodeado en
 *   la UI: el concepto de "cátedra" (etiquetas, centinelas COMUN/TODAS, copy del
 *   modal). La UI pasa a consumir este descriptor en vez de conocer Ramón Net.
 * ==========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * Todo lo específico del portal Ramón Net que la interfaz necesita saber. La regla
 * de la re-arquitectura es que la UI y el núcleo NO conocen este archivo por dentro:
 * reciben el descriptor por inyección (`ctx.sitio`) y trabajan contra su forma.
 * Clonar la extensión para otro portal = escribir otro `sitio/<portal>/config.js`.
 *
 * FACETA
 * ------
 * Una "faceta" es un eje de clasificación del listado por el que el usuario puede
 * (a) ser preguntado una vez —"¿cuál cursás?"— y (b) filtrar. En Ramón Net ese eje
 * es la **cátedra** (A-D), pero el mecanismo no tiene nada de Ramón Net: otro portal
 * podría llamarle "comisión", "turno" o "sede" y la UI funciona igual.
 *
 * - `valorComun`: el valor que pertenece a TODAS las opciones (en Ramón Net, las
 *   clases comunes a todas las cátedras). Nunca se ofrece como opción a elegir y
 *   siempre queda seleccionado junto con la elección del usuario.
 * - `valorTodas`: centinela de "no filtrar por esta faceta".
 * - `claveEstado`: propiedad de `AppState` donde vive la elección. Existe como dato
 *   —y no hardcodeada— para que la UI genérica no nombre el concepto del sitio.
 *   TODO(re-arquitectura): al mudar `AppState` a un puerto de almacenamiento, esto
 *   pasa a `facetaSeleccionada` y la clave de storage `catedraElegida` necesita una
 *   migración (ver docs/data-model.md).
 * - `leer(clase)`: de dónde sale el valor de la faceta en un item scrapeado.
 */
const SitioRamonNet = {
  id: "ramonnet",

  // --- Endpoints y marcadores del portal ---------------------------------------
  // Origen del portal. Lo usa el daemon de conexión como sonda de "hay internet":
  // es deliberadamente el sitio objetivo y no un genérico tipo google.com — lo que
  // importa no es tener red, sino poder llegar A ESTE portal.
  urlSondeoInternet: "https://plataforma.ramonnet.com.ar",

  // Segmento de la ruta que identifica la página de una clase grabada. Si la URL
  // final de un fetch lo pierde, el portal redirigió al login (no hay sesión).
  marcaRutaClase: "clases-grabadas",

  // Host del portal + los dos derivados que necesita el resto del código: reconocer
  // si una pestaña pertenece al sitio, y el patrón de match para chrome.tabs.query.
  // Estaban hardcodeados en 5 lugares entre popup.js y background.js.
  host: "plataforma.ramonnet.com.ar",
  esPaginaDelSitio(url) {
    return typeof url === "string" && url.includes(this.host);
  },
  get patronPestañas() { return `https://${this.host}/*`; },

  // Página del listado de clases: la usa el onboarding para mandar al usuario al
  // lugar correcto del portal.
  get urlListado() { return `https://${this.host}/usuario/${this.marcaRutaClase}`; },

  // --- CDN de video (Bunny) -----------------------------------------------------
  cdn: {
    // Hosts que puede tener el <iframe> del reproductor embebido.
    hostsIframe: ["b-cdn.net", "mediadelivery.net"],
    // Zona de Bunny de este portal: con el UUID del video alcanza para armar la URL.
    plantillaM3u8: (hash) => `https://vz-c3e7bda8-f29.b-cdn.net/${hash}/480p/video.m3u8`,
    // Calidad que se descarga (la plantilla de arriba ya la fija).
    calidad: "480p",
  },

  // --- Puertas al resto del adaptador -------------------------------------------
  // Las implementaciones viven en archivos hermanos y se referencian perezosamente
  // (arrow functions) para no depender del orden de carga de los <script>/importScripts.
  // El núcleo y la UI consumen SIEMPRE por estas puertas, nunca los módulos directo.

  // HTML de la página de la clase → URL del manifiesto .m3u8.
  resolverManifiesto: (urlClase, signal) => ResolverManifiesto.resolver(urlClase, signal),

  // Función que se INYECTA en la pestaña del portal (chrome.scripting.executeScript)
  // para leer el listado de clases del DOM. Es un getter y no una arrow: hay que
  // entregar la función cruda, porque executeScript serializa su código fuente y lo
  // corre en la página, donde no existe ninguna global de la extensión. Envolverla
  // rompería la inyección.
  get escanearListado() { return Scraper.escanearAulaVirtual; },

  // Título crudo scrapeado → nombre canónico del archivo.
  parsearTitulo: (crudo, materiaBase, options) => ParserTitulos.formatTitleStructured(crudo, materiaBase, options),

  // Título crudo + materia → { catedra, carpeta } donde se guarda.
  clasificarCarpeta: (crudo, materiaBase) => ParserTitulos.clasificarCatedraYCarpeta(crudo, materiaBase),

  faceta: {
    id: "catedra",
    etiqueta: "Cátedra",        // título de la sección de filtros
    icono: "🎓",

    valorComun: "COMUN",
    valorTodas: "TODAS",
    claveEstado: "catedraSeleccionada",

    // De dónde sale el valor en un item del listado scrapeado.
    leer: (clase) => clase.catedra,
    // Los items de la COLA no llevan el campo: se re-deriva del título con el parser
    // del sitio. Que esta derivación viva acá es justamente el punto — la UI genérica
    // no sabe que existe un parser de títulos.
    leerDeCola: (clase) => SitioRamonNet.clasificarCarpeta(clase.titulo, clase.carpeta).catedra,

    // Etiqueta larga: badge de la cabecera y botones del modal ("Cátedra A").
    etiquetar: (valor) => (valor === "COMUN" ? "Común" : `Cátedra ${valor}`),
    // Etiqueta corta: opciones del popover de filtros, donde el espacio es poco.
    etiquetarCorto: (valor) => (valor === "COMUN" ? "Común" : `Cat ${valor}`),

    ordenar: (a, b) => a.localeCompare(b),

    modal: {
      titulo: "Multicátedra Detectada 🎓",
      descripcion:
        "Esta aula virtual tiene videos de varias cátedras. ¿Cuál de ellas estás cursando para autoseleccionar tus videos?",
    },
  },
};

// Sitio activo de esta build. Cuando haya bundler, esto lo elige la compilación
// (una build por portal — ver docs/rearquitectura-diseno.md); por ahora es el único
// archivo de sitio que se carga en popup.html.
const SitioActivo = SitioRamonNet;

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SitioRamonNet, SitioActivo };
} else if (typeof window !== "undefined") {
  window.SitioRamonNet = SitioRamonNet;
  window.SitioActivo = SitioActivo;
} else if (typeof self !== "undefined") {
  self.SitioRamonNet = SitioRamonNet;
  self.SitioActivo = SitioActivo;
}
