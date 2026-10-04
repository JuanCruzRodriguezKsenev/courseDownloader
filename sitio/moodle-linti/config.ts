/**
 * ADAPTADOR DE SITIO — MOODLE LINTI: CONFIGURACIÓN (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [MOODLE CORTE 2] Nace para el cuarto portal (catedras.linti.unlp.edu.ar).
 *   Portal sin videos HLS, con destino por índice (.course-downloader.json)
 *   y credencialesAdjunto "include" (D-2, D-3).
 * ==========================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperMoodleLinti: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoMoodleLinti: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosMoodleLinti: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioMoodleLinti: PuertoSitio = {
  id: "moodle-linti",
  nombre: "Moodle del LINTI",
  color: "#F98012",

  urlSondeoInternet: "https://catedras.linti.unlp.edu.ar/favicon.ico",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/catedras\.linti\.unlp\.edu\.ar\/course\/view\.php\?id=\d+/.test(url);
  },

  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    const m = /^https:\/\/catedras\.linti\.unlp\.edu\.ar\/course\/view\.php\?id=(\d+)/.exec(url);
    return m ? m[1] : undefined;
  },

  get patronPestañas() {
    return "https://catedras.linti.unlp.edu.ar/*";
  },

  get urlListado() {
    return "https://catedras.linti.unlp.edu.ar/my/";
  },

  instruccionEscaneo:
    "Escaneá desde la página principal de un curso. Dejá esa pestaña al frente hasta que termine.",

  topeEscaneoMs: 60000,

  credencialesAdjunto: "include",

  destinoPorIndice: true,

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[moodle-linti] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoMoodleLinti.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado() {
    return ScraperMoodleLinti.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosMoodleLinti.clasificarCarpeta(crudo, materiaBase),

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

(globalThis as Record<string, unknown>).SitioMoodleLinti = SitioMoodleLinti;
export { SitioMoodleLinti };
export default SitioMoodleLinti;
