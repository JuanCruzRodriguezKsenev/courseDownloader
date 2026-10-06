/**
 * ADAPTADOR DE SITIO — MOODLE INGENIERÍA (UNLP): CONFIGURACIÓN (V1.0.0)
 * =====================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 31 / MODO PURO] Descriptor del portal asignaturas.ing.unlp.edu.ar (UNLP Ingeniería).
 *   - Implementa PuertoSitio con destinoPorIndice: true (RN-1, RN-13).
 *   - Sondeo de internet a la raíz del portal con www (D-3).
 *   - Detección de página del curso con course/view.php?id=\d+ y claveDeListado por id (RN-3, D-2).
 *   - Portada en /my/ y subrutas (esPortada, claveDeListado "todos", RN-3).
 *   - patronPestañas con comodín *.asignaturas.ing.unlp.edu.ar cubre con y sin www.
 *   - credencialesAdjunto: "include" y topeEscaneoMs: 60000 (D-2, NFR-3).
 * =====================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperMoodleIngenieria: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoMoodleIngenieria: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosMoodleIngenieria: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioMoodleIngenieria: PuertoSitio = {
  id: "moodle-ingenieria",
  nombre: "Moodle Ingeniería (UNLP)",
  color: "#8B1E3F",

  urlSondeoInternet: "https://www.asignaturas.ing.unlp.edu.ar/",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return (
      /^https:\/\/(?:www\.)?asignaturas\.ing\.unlp\.edu\.ar\/course\/view\.php\?(?:[^#]*&)?id=\d+/.test(
        url
      ) || this.esPortada?.(url) === true
    );
  },

  esPortada(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/(?:www\.)?asignaturas\.ing\.unlp\.edu\.ar\/my\/?(?:\?.*)?$/.test(url);
  },

  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    if (this.esPortada?.(url)) return "todos";
    if (!this.esPaginaDelSitio(url)) return undefined;
    const m = /[?&]id=(\d+)/.exec(url);
    return m ? m[1] : undefined;
  },

  get patronPestañas() {
    return "https://*.asignaturas.ing.unlp.edu.ar/*";
  },

  get urlListado() {
    return "https://www.asignaturas.ing.unlp.edu.ar/my/";
  },

  instruccionEscaneo:
    "Abrí la página principal de la materia (course/view.php) y escaneá desde acá. Podés asociar la materia al árbol con 🗂️.",

  topeEscaneoMs: 60000,

  credencialesAdjunto: "include",

  destinoPorIndice: true,

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[moodle-ingenieria] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoMoodleIngenieria.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado() {
    return ScraperMoodleIngenieria.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosMoodleIngenieria.clasificarCarpeta(crudo, materiaBase),

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

(globalThis as Record<string, unknown>).SitioMoodleIngenieria = SitioMoodleIngenieria;
export { SitioMoodleIngenieria };
export default SitioMoodleIngenieria;
