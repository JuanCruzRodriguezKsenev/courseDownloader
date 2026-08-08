/**
 * UTILIDADES DE TEXTO (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [ESCANEO-API CORTE 2] Nace `sanearNombreCarpeta`, para el override del input de carpeta.
 * ==========================================================================
 * Capa 1. Salieron de `shared/utils.js` en la Fase 6a, sin cambios de lógica.
 *
 * Las cuatro son puras y sincrónicas, pero resuelven problemas distintos y conviene no
 * confundirlas al elegir cuál usar:
 *   - `sanitizarTexto` → nombre de ARCHIVO válido para el SO. Su lista de caracteres está
 *     **sincronizada con el backend Bun**: si cambia acá y no allá, el archivo se escribe con
 *     otro nombre del que la extensión cree y la deduplicación por título deja de coincidir.
 *   - `sanearNombreCarpeta` → nombre de CARPETA. Es mucho más estricto que el anterior
 *     (minúsculas, sin acentos, sólo `[a-z0-9_]`) porque tiene que coincidir con lo que el
 *     scraper produce a partir del nombre de un módulo, y esos dos valores se comparan.
 *   - `escaparHtml` → neutraliza markup de texto NO confiable (títulos scrapeados) antes de
 *     interpolarlo en un string que va a `.innerHTML`. Es la defensa del XSS, no un formateo.
 *   - `quitarAcentos` → normalización para comparar/parsear, no para mostrar.
 */

// Tabla estática: es un lookup por carácter, más barato que normalize() en el camino caliente
// del parser de títulos, que corre por cada clase de la lista.
const MAPA_ACENTOS: Record<string, string> = {
  á: "a", ä: "a", â: "a", à: "a",
  é: "e", ë: "e", ê: "e", è: "e",
  í: "i", ï: "i", î: "i", ì: "i",
  ó: "o", ö: "o", ô: "o", ò: "o",
  ú: "u", ü: "u", û: "u", ù: "u",
  Á: "A", Ä: "A", Â: "A", À: "A",
  É: "E", Ë: "E", Ê: "E", È: "E",
  Í: "I", Ï: "I", Î: "I", Ì: "I",
  Ó: "O", Ö: "O", Ô: "O", Ò: "O",
  Ú: "U", Ü: "U", Û: "U", Ù: "U",
};

const REGEX_ACENTOS = /[áäâàéëêèíïîìóöôòúüûùÁÄÂÀÉËÊÈÍÏÎÌÓÖÔÒÚÜÛÙ]/g;

/** Sanitiza títulos para usarlos como nombres de archivo válidos en el OS. */
export function sanitizarTexto(texto?: string | null): string {
  if (!texto) return "video_sin_nombre";
  return texto
    .replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, "_") // Sincronizado con backend Bun para evitar desvíos
    .replace(/\s+/g, " ") // Colapsar espacios múltiples
    .trim();
}

/**
 * Escapa los metacaracteres de HTML de un texto no confiable (ej. títulos scrapeados del DOM
 * del portal) antes de interpolarlo dentro de un string que se asigna vía innerHTML.
 * Neutraliza inyección de markup (XSS). Ver `docs/security.md`.
 */
export function escaparHtml(texto?: unknown): string {
  if (texto == null) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Texto libre → nombre de carpeta en disco (`raíz/<portal>/<carpeta>/`).
 *
 * ⚠️ **Tiene que producir exactamente lo mismo que el saneo del scraper de Anatomy**, que
 * convierte el nombre del módulo en carpeta. Los dos valores se comparan —el override del input
 * contra la carpeta del módulo— y también se buscan en disco, así que una diferencia de criterio
 * haría que la extensión mire una carpeta y escriba en otra, sin error en ningún lado.
 *
 * Y la duplicación es DELIBERADA, no un descuido: la función del scraper se inyecta en la
 * pestaña vía `executeScript` y no puede referenciar nada de la extensión, ni siquiera esto.
 * Ver `docs/architecture.md` §Capa 2.
 */
export function sanearNombreCarpeta(texto?: string | null): string {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Elimina acentos en un solo paso, vía tabla de lookup. */
export function quitarAcentos(str?: string | null): string {
  if (!str) return "";
  return str.replace(REGEX_ACENTOS, (match) => MAPA_ACENTOS[match] || match);
}
