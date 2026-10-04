/**
 * ADAPTADOR DE SITIO — GOOGLE SITES MATE C: PARSER DE TÍTULOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [SITES MATEC CORTE 1] Nace para Google Sites Matemática C (H-4).
 * ==========================================================================
 */

function sanearCarpeta(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const ParserTitulosSitesMatec = {
  clasificarCarpeta(_crudo, materiaBase) {
    const raw = String(materiaBase || "").trim();
    const partes = raw.split(" › ");
    const curso = partes[0].trim() || "Matemática C";
    const carpeta =
      typeof globalThis.Utils !== "undefined" && typeof globalThis.Utils.sanearNombreCarpeta === "function"
        ? globalThis.Utils.sanearNombreCarpeta(curso)
        : sanearCarpeta(curso);

    return {
      catedra: "COMUN",
      carpeta: carpeta || "matematica_c",
    };
  },
};

globalThis.ParserTitulosSitesMatec = ParserTitulosSitesMatec;
export { ParserTitulosSitesMatec };
export default ParserTitulosSitesMatec;
