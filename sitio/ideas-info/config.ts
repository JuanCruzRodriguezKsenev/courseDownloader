/**
 * ADAPTADOR DE SITIO — IDEAS (LIDI, UNLP): CONFIGURACIÓN (V1.0.0)
 * =================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 35 / MODO PURO] Descriptor del portal ideas.info.unlp.edu.ar (IDEAS, LIDI, UNLP).
 *   - Implementa PuertoSitio con destinoPorIndice: true (RN-1, RN-19).
 *   - Sondeo de internet a la raíz del portal (RN-20).
 *   - Detección de página de curso y portada en /home (esPortada, claveDeListado "todos", RN-4, RN-20).
 *   - No reclama /login, /Search/... ni la raíz / (AC-1, AC-12).
 *   - patronPestañas: https://ideas.info.unlp.edu.ar/* (RN-20).
 *   - credencialesAdjunto: "include" y topeEscaneoMs: 120000 (RN-9, RN-10).
 * =================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperIdeasInfo: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoIdeasInfo: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosIdeasInfo: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioIdeasInfo: PuertoSitio = {
  id: "ideas-info",
  nombre: "IDEAS (UNLP)",
  color: "#2E7D6B",

  urlSondeoInternet: "https://ideas.info.unlp.edu.ar/",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return (
      this.esPortada?.(url) === true ||
      /^https:\/\/ideas\.info\.unlp\.edu\.ar\/[a-z0-9-]+\/(?:Start|Contents|Resources|Evaluation|Communication|Collaboration)(?:\/|$)/.test(
        url
      )
    );
  },

  esPortada(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/ideas\.info\.unlp\.edu\.ar\/home(?:\/[^?#]*)?(?:[?#].*)?$/.test(url);
  },

  claveDeListado(url) {
    if (typeof url !== "string") return undefined;
    if (this.esPortada?.(url)) return "todos";
    if (!this.esPaginaDelSitio(url)) return undefined;
    const m = /^https:\/\/ideas\.info\.unlp\.edu\.ar\/([a-z0-9-]+)\/(?:Start|Contents|Resources|Evaluation|Communication|Collaboration)(?:\/|$)/.exec(
      url
    );
    return m ? m[1] : undefined;
  },

  sugerenciaFueraDeListado(url) {
    if (typeof url !== "string") return undefined;
    if (
      /^https?:\/\/ideas\.info\.unlp\.edu\.ar(?:\/|$)/i.test(url) &&
      !this.esPaginaDelSitio(url)
    ) {
      return "Andá a tu inicio (/home) para escanear todos tus cursos, o abrí un curso.";
    }
    return undefined;
  },

  get patronPestañas() {
    return "https://ideas.info.unlp.edu.ar/*";
  },

  get urlListado() {
    return "https://ideas.info.unlp.edu.ar/home";
  },

  textoOfertaTodos:
    "Escaneamos los cursos de tu inicio de IDEAS, uno por uno. Suele tardar alrededor de medio minuto por curso.\nPodés cerrar este popup, pero no cambies de página en esta pestaña hasta que termine.",

  instruccionEscaneo:
    "Escaneá desde un curso o desde tu inicio (/home) para escanear todos. Podés asociar la materia al árbol con 🗂️.",

  topeEscaneoMs: 120000,

  credencialesAdjunto: "include",

  destinoPorIndice: true,

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[ideas-info] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoIdeasInfo.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado() {
    return ScraperIdeasInfo.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosIdeasInfo.clasificarCarpeta(crudo, materiaBase),

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

(globalThis as Record<string, unknown>).SitioIdeasInfo = SitioIdeasInfo;
export { SitioIdeasInfo };
export default SitioIdeasInfo;
