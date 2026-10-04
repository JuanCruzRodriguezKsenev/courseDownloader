/**
 * ADAPTADOR DE SITIO — MOODLE LINTI: PARSER DE TÍTULOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [MOODLE CORTE 2] Nace para el cuarto portal.
 * ==========================================================================
 *
 * En modo destino (.course-downloader.json) no se usa la clasificación heurística
 * clásica de carpetas, pero PuertoSitio la exige como miembro del contrato.
 * El popup llama clasificarCarpeta(item.texto, item.modulo || input) donde
 * modulo es "<curso> › <sección>". Se toma lo que está antes de " › " y se sanea.
 */

/* global Utils */

const ParserTitulosMoodleLinti = {
  clasificarCarpeta(_crudo, materiaBase) {
    const raw = String(materiaBase || "").trim();
    const partes = raw.split(" › ");
    const curso = partes[0].trim();
    const carpeta =
      typeof Utils !== "undefined" && Utils && typeof Utils.sanearNombreCarpeta === "function"
        ? Utils.sanearNombreCarpeta(curso)
        : curso.replace(/[/\\?%*:|"<>]/g, "_").trim();

    return {
      catedra: "COMUN",
      carpeta,
    };
  },
};

globalThis.ParserTitulosMoodleLinti = ParserTitulosMoodleLinti;
export default ParserTitulosMoodleLinti;
