/**
 * PORTALES CON DESTINO — CONFIGURACIÓN Y PORTALES VÁLIDOS
 * =======================================================
 * Módulo puro (node-free) dueño de la lista de portales válidos
 * y el conjunto de portales que implementan destino por índice.
 */

export const PORTALES_VALIDOS = new Set([
  "ramonnet",
  "anatomy-by-chris",
  "google-classroom",
  "moodle-linti",
  "moodle-asignaturas",
  "sites-matec",
  "moodle-ingenieria",
]);

export const PORTALES_CON_DESTINO_INDICE = new Set([
  "google-classroom",
  "moodle-linti",
  "moodle-asignaturas",
  "sites-matec",
  "moodle-ingenieria",
]);

/**
 * Resuelve la raíz en disco para un portal dado.
 *
 * @param {object} params
 * @param {string} [params.portalId]
 * @param {Record<string, string>} [params.raices]
 * @param {string} params.raizPorDefecto
 * @param {string} params.raizFacultad
 * @returns {string}
 */
export function resolverRaizDeDestino({ portalId, raices, raizPorDefecto, raizFacultad }) {
  if (portalId && raices && raices[portalId]) {
    return raices[portalId];
  }
  if (portalId && PORTALES_CON_DESTINO_INDICE.has(portalId)) {
    return raizFacultad;
  }
  return raizPorDefecto;
}
