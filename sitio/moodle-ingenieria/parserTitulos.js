/**
 * ADAPTADOR DE SITIO — MOODLE INGENIERÍA (UNLP): PARSER DE TÍTULOS (V1.0.0)
 * =========================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 31 / MODO PURO] Implementación del clasificador de carpeta para Moodle Ingeniería.
 *   - Devuelve catedra: "COMUN" y carpeta saneada a partir del nombre del curso (RN-1, RN-13).
 * =========================================================================
 */

import { sanearNombreCarpeta } from "../../core/util/texto.ts";

function saneaCarpeta(nombre) {
  if (
    typeof globalThis.Utils !== "undefined" &&
    typeof globalThis.Utils.sanearNombreCarpeta === "function"
  ) {
    return globalThis.Utils.sanearNombreCarpeta(nombre);
  }
  return sanearNombreCarpeta(nombre);
}

const ParserTitulosMoodleIngenieria = {
  /**
   * Clasifica la carpeta de destino a partir del curso en materiaBase.
   *
   * @param {string} _crudo
   * @param {string} [materiaBase] Formato "<curso> › <tema>" o nombre del curso
   * @returns {{ catedra: "COMUN", carpeta: string }}
   */
  clasificarCarpeta(_crudo, materiaBase) {
    const raw = String(materiaBase || "").trim();
    const partes = raw.split(" › ");
    const curso = partes[0].trim();
    return {
      catedra: "COMUN",
      carpeta: saneaCarpeta(curso),
    };
  },
};

globalThis.ParserTitulosMoodleIngenieria = ParserTitulosMoodleIngenieria;
export default ParserTitulosMoodleIngenieria;
