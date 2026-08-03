/**
 * ADAPTADOR DE SITIO — RAMÓN NET: CONFIGURACIÓN (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [FASE 5C] `config.js` → `config.ts`. El descriptor pasa a declararse como
 *   implementación de `PuertoSitio` (core/puertos/sitio.ts), así que ahora el
 *   compilador verifica que el adaptador esté completo, en vez de que lo verifique
 *   quien lo lea. Cero cambios de comportamiento: mismos valores, mismas puertas,
 *   mismos dos globals.
 * - Motivo del corte: era EL TAPÓN de la re-arquitectura. Con `allowJs: false`, un
 *   `.ts` no puede importar un `.js`, así que mientras este archivo fuera `.js`,
 *   `plataforma/composicion.ts` no podía importarlo — y sin eso no se le puede
 *   inyectar la URL de sondeo al daemon de conexión, que es lo único que lo retiene
 *   en `shared/` en vez de `core/`. Ver docs/rearquitectura-diseno.md §El próximo paso.
 * - Los módulos hermanos (`ResolverManifiesto`, `Scraper`, `ParserTitulos`) siguen
 *   siendo `.js` y se siguen leyendo como globals, ahora vía `declare const`. No se
 *   importan a propósito: eso es lo que mantiene perezosas las puertas de abajo.
 *
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
 * Clonar la extensión para otro portal = escribir otro `sitio/<portal>/config.ts`.
 *
 * La forma en sí —qué tiene que traer un adaptador y qué significa cada campo— vive
 * en `core/puertos/sitio.ts`, que es su hogar canónico. Acá van los VALORES de Ramón
 * Net, no la explicación del mecanismo.
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
  OpcionesParseo,
} from "../../core/puertos/sitio";

/**
 * Módulos hermanos del adaptador. Son `.js` y se consumen como globals: `allowJs`
 * está en `false`, así que este `.ts` no puede importarlos aunque quisiera. Lo cual
 * coincide con lo que ya se quería igual — ver las puertas más abajo.
 */
declare const ResolverManifiesto: {
  resolver(urlClase: string, signal?: AbortSignal): Promise<string>;
};
declare const Scraper: {
  escanearAulaVirtual: () => ResultadoEscaneo;
};
declare const ParserTitulos: {
  formatTitleStructured(crudo: string, materiaBase?: string, options?: OpcionesParseo): string;
  clasificarCatedraYCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

/**
 * Lo de Ramón Net que NO es parte del puerto: sólo lo consumen los archivos de esta
 * misma carpeta (`resolverManifiesto.ts/js`). Si algo de acá lo empezara a leer el
 * núcleo o la UI, ahí sí subiría a `PuertoSitio`.
 */
interface SitioRamonNetDescriptor extends PuertoSitio {
  /** Segmento de ruta que identifica la página de una clase grabada. */
  marcaRutaClase: string;
  /** Host del portal, base de `patronPestañas` y `urlListado`. */
  host: string;
  cdn: {
    /** Hosts que puede tener el `<iframe>` del reproductor embebido. */
    hostsIframe: string[];
    /** Zona de Bunny de este portal: con el UUID del video alcanza para armar la URL. */
    plantillaM3u8: (hash: string) => string;
    /** Calidad que se descarga (la plantilla de arriba ya la fija). */
    calidad: string;
  };
}

const SitioRamonNet: SitioRamonNetDescriptor = {
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
    hostsIframe: ["b-cdn.net", "mediadelivery.net"],
    plantillaM3u8: (hash) => `https://vz-c3e7bda8-f29.b-cdn.net/${hash}/480p/video.m3u8`,
    calidad: "480p",
  },

  // --- Puertas al resto del adaptador -------------------------------------------
  // Las implementaciones viven en archivos hermanos y se referencian perezosamente
  // (arrow functions) para no depender del orden de carga de los imports del
  // entrypoint. El núcleo y la UI consumen SIEMPRE por estas puertas, nunca los
  // módulos directo.

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
    // PENDIENTE(re-arquitectura): generalizar el nombre — `claveEstado` pasaría a
    // `facetaSeleccionada`, y la clave de storage `catedraElegida` necesita migración de
    // datos (ver docs/data-model.md). OJO: este comentario esperaba un disparador que ya
    // ocurrió — `AppState` pasó al puerto de almacenamiento en la Fase 5b (2026-08-03) y
    // el renombre no se hizo. Hoy es lo ÚNICO que ata `shared/state.ts` a vocabulario del
    // sitio, así que es el paso que falta para poder mudarlo a `core/`.
    claveEstado: "catedraSeleccionada",

    // De dónde sale el valor en un item del listado scrapeado.
    leer: (clase) => clase.catedra,
    // Los items de la COLA no llevan el campo: se re-deriva del título con el parser
    // del sitio. Que esta derivación viva acá es justamente el punto — la UI genérica
    // no sabe que existe un parser de títulos.
    leerDeCola: (clase) => SitioRamonNet.clasificarCarpeta(clase.titulo ?? "", clase.carpeta).catedra,

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

/**
 * Sitio activo de esta build. ADR-0009 decidió resolverlo en runtime contra un
 * registro de adaptadores (por URL de pestaña en el popup, por ítem de cola en el SW);
 * mientras Ramón Net sea el único portal, sigue siendo esta constante.
 */
const SitioActivo: PuertoSitio = SitioRamonNet;

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest/composicion.ts lo importen.
(globalThis as Record<string, unknown>).SitioRamonNet = SitioRamonNet;
(globalThis as Record<string, unknown>).SitioActivo = SitioActivo;
export { SitioRamonNet, SitioActivo };
export type { SitioRamonNetDescriptor };
export default SitioActivo;
