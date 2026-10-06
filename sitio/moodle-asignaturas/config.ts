/**
 * ADAPTADOR DE SITIO — MOODLE ASIGNATURAS (UNLP): CONFIGURACIÓN (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [PLAN 29 / MULTICURSO] Portada en /my/ y subrutas (esPortada, claveDeListado "todos").
 *
 * CHANGELOG v1.0.0:
 * - [PLAN 13 / MODO PURO] Descriptor del portal asignaturas.info.unlp.edu.ar (UNLP Informática).
 *   - Implementa PuertoSitio con destinoPorIndice: true (RN-1, RN-13).
 *   - Sondeo de internet a la raíz del portal (D-3).
 *   - Detección de página del curso con course/view.php?id=\d+ y claveDeListado por id (RN-3, D-2).
 *   - credencialesAdjunto: "include" y topeEscaneoMs: 60000 (D-2, NFR-3).
 * ==========================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperMoodleAsignaturas: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoMoodleAsignaturas: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosMoodleAsignaturas: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioMoodleAsignaturas: PuertoSitio = {
  id: "moodle-asignaturas",
  nombre: "Moodle Asignaturas (UNLP)",
  color: "#0B5394",

  // Medición en vivo: /favicon.ico responde 404; la raíz responde 200 OK y corp: null
  // al fetch de la extensión sin bloquearse (D-3).
  urlSondeoInternet: "https://asignaturas.info.unlp.edu.ar/",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return (
      /^https:\/\/asignaturas\.info\.unlp\.edu\.ar\/course\/view\.php\?(?:[^#]*&)?id=\d+/.test(
        url
      ) || this.esPortada?.(url) === true
    );
  },

  esPortada(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/asignaturas\.info\.unlp\.edu\.ar\/my(?:\/|$|\?)/.test(url);
  },

  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    if (this.esPortada?.(url)) return "todos";
    if (!this.esPaginaDelSitio(url)) return undefined;
    const m = /[?&]id=(\d+)/.exec(url);
    return m ? m[1] : undefined;
  },

  get patronPestañas() {
    return "https://asignaturas.info.unlp.edu.ar/*";
  },

  get urlListado() {
    return "https://asignaturas.info.unlp.edu.ar/my/";
  },

  instruccionEscaneo:
    "Abrí la página principal de la materia (course/view.php) y escaneá desde acá. Podés asociar la materia al árbol con 🗂️.",

  topeEscaneoMs: 60000,

  credencialesAdjunto: "include",

  destinoPorIndice: true,

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[moodle-asignaturas] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoMoodleAsignaturas.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado() {
    return ScraperMoodleAsignaturas.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosMoodleAsignaturas.clasificarCarpeta(crudo, materiaBase),

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

(globalThis as Record<string, unknown>).SitioMoodleAsignaturas = SitioMoodleAsignaturas;
export { SitioMoodleAsignaturas };
export default SitioMoodleAsignaturas;
