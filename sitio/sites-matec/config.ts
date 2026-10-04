/**
 * ADAPTADOR DE SITIO — GOOGLE SITES MATE C: CONFIGURACIÓN (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [SITES MATEC CORTE 1] Primer descriptor de Google Sites Matemática C (D-2 a D-5).
 *   Portal sin videos HLS: contenidos catalogados como PDFs de Drive o accesos .md.
 *   Declara destinoPorIndice: true, credencialesAdjunto: "include", sondeo /favicon.ico.
 * ==========================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperSitesMatec: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoSitesMatec: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosSitesMatec: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioSitesMatec: PuertoSitio = {
  id: "sites-matec",
  nombre: "Google Sites Mate C",
  color: "#1a73e8",

  urlSondeoInternet: "https://sites.google.com/favicon.ico",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/sites\.google\.com\/ing\.unlp\.edu\.ar\/matec(?:\/.*)?$/.test(url);
  },

  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    return this.esPaginaDelSitio(url) ? "matec" : undefined;
  },

  get patronPestañas() {
    return "https://sites.google.com/ing.unlp.edu.ar/matec*";
  },

  get urlListado() {
    return "https://sites.google.com/ing.unlp.edu.ar/matec";
  },

  instruccionEscaneo:
    "Abrí cualquier página de la videoteca de Matemática C y presioná Escanear para catalogar los PDFs, videos y autoevaluaciones de las 9 secciones temáticas.",

  topeEscaneoMs: 10000,

  credencialesAdjunto: "include",

  destinoPorIndice: true,

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[sites-matec] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoSitesMatec.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado(): () => Promise<ResultadoEscaneo> {
    return ScraperSitesMatec.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosSitesMatec.clasificarCarpeta(crudo, materiaBase),

  faceta: {
    id: "ninguna",
    etiqueta: "Sin clasificación",
    icono: "📚",

    valorComun: "COMUN",
    valorTodas: "TODAS",

    leer: () => "COMUN",
    leerDeCola: () => "COMUN",

    etiquetar: () => "Todas las clases",
    etiquetarCorto: () => "Todas",

    ordenar: () => 0,

    modal: {
      titulo: "(faceta inerte: este modal no se muestra)",
      descripcion:
        "Este portal no tiene eje de clasificación. El descriptor existe porque PuertoSitio lo exige; la UI nunca lo muestra.",
    },
  },
};

(globalThis as Record<string, unknown>).SitioSitesMatec = SitioSitesMatec;
export { SitioSitesMatec };
export default SitioSitesMatec;
