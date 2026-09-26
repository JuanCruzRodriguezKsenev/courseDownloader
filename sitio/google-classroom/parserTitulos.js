/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: PARSER DE TÍTULOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1] Nace para el tercer portal.
 * ==========================================================================
 *
 * En este corte, la carpeta de destino es el curso entero (sin subcarpetas por tema),
 * porque varios cursos comparten nombres de tema ("Laboratorios") y se mezclarían.
 * El popup llama clasificarCarpeta(item.texto, item.modulo || input) donde modulo es "<curso> › <tema>".
 * Se toma lo que está antes de " › " y se sanea con Utils.sanearNombreCarpeta.
 */

const ParserTitulosClassroom = {
  clasificarCarpeta(_crudo, materiaBase) {
    const raw = String(materiaBase || "").trim();
    const partes = raw.split(" › ");
    const curso = partes[0].trim();
    return {
      catedra: "COMUN",
      carpeta: Utils.sanearNombreCarpeta(curso),
    };
  },
};

globalThis.ParserTitulosClassroom = ParserTitulosClassroom;
export default ParserTitulosClassroom;
