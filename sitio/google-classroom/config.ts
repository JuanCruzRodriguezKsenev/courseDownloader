/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: CONFIGURACIÓN (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [CLASSROOM VERIFICACIÓN B] `urlSondeoInternet` apunta a `/favicon.ico`: la raíz con sesión
 *   responde `Cross-Origin-Resource-Policy: same-site` y el fetch desde la extensión rechaza
 *   (ERR_BLOCKED_BY_RESPONSE.NotSameSite), marcando "sin internet". `/favicon.ico` responde 404
 *   sin CORP y el daemon no mira el status. Esta URL nunca se abre en pestaña (para eso está
 *   `urlListado`). Medido el 2026-09-12 en la consola del popup; ver
 *   `docs/portal-google-classroom-diseno.md` §8.
 *
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1] Primer descriptor de Google Classroom. Portal sin videos HLS:
 *   todos sus materiales son adjuntos (Drive o accesos .md).
 * ==========================================================================
 */
import type {
  PuertoSitio,
  ResultadoEscaneo,
  ClasificacionCarpeta,
} from "../../core/puertos/sitio";

declare const ScraperClassroom: {
  escanearListado: (opciones?: unknown) => Promise<ResultadoEscaneo>;
};
declare const DescargarAdjuntoClassroom: {
  resolver(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
};
declare const ParserTitulosClassroom: {
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;
};

const SitioGoogleClassroom: PuertoSitio = {
  id: "google-classroom",
  nombre: "Google Classroom",
  color: "#1E8E3E",

  // La raíz con sesión responde `Cross-Origin-Resource-Policy: same-site` y el `fetch` desde la
  // extensión rechaza (`ERR_BLOCKED_BY_RESPONSE.NotSameSite`), lo que marcaba "sin internet".
  // `/favicon.ico` responde 404 sin CORP y el daemon no mira el status. Esta URL no se abre
  // nunca en una pestaña: para eso está `urlListado`. Medido el 2026-09-12 en la consola del
  // popup; ver `docs/portal-google-classroom-diseno.md` §8.
  urlSondeoInternet: "https://classroom.google.com/favicon.ico",

  esPaginaDelSitio(url) {
    if (typeof url !== "string") return false;
    return /^https:\/\/classroom\.google\.com\/(?:u\/\d+\/)?(?:c|w)\/[^/]+/.test(url);
  },

  get patronPestañas() {
    return "https://classroom.google.com/*";
  },

  get urlListado() {
    return "https://classroom.google.com/";
  },

  instruccionEscaneo:
    "Escaneá desde un curso (Trabajo en clase o Novedades) y dejá esa pestaña al frente hasta que termine: puede tardar un par de minutos, y si cambiás de pestaña el escaneo se corta.",

  topeEscaneoMs: 180000,

  credencialesAdjunto: "include",

  resolverManifiesto(_urlClase, _signal, _credenciales) {
    const error: Error & { tipoPortal?: string } = new Error(
      "[google-classroom] este portal no tiene videos HLS"
    );
    error.tipoPortal = "rechazo";
    return Promise.reject(error);
  },

  resolverAdjunto(idArchivo, signal, credenciales) {
    return DescargarAdjuntoClassroom.resolver(idArchivo, signal, credenciales);
  },

  get escanearListado() {
    return ScraperClassroom.escanearListado;
  },

  parsearTitulo: (crudo) => crudo,

  clasificarCarpeta: (crudo, materiaBase) =>
    ParserTitulosClassroom.clasificarCarpeta(crudo, materiaBase),

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

(globalThis as Record<string, unknown>).SitioGoogleClassroom = SitioGoogleClassroom;
export { SitioGoogleClassroom };
export default SitioGoogleClassroom;
