/**
 * Tests de parserTitulos para Google Sites Matemática C (Capa 2).
 */
import { describe, it, expect } from "vitest";
import ParserTitulosSitesMatec from "./parserTitulos.js";

describe("ParserTitulosSitesMatec.clasificarCarpeta", () => {
  it("devuelve catedra COMUN y carpeta saneada del curso", () => {
    const res = ParserTitulosSitesMatec.clasificarCarpeta("Serie de potencias", "Matemática C › Series");
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "matematica_c",
    });
  });

  it("tolera materiaBase vacía o nula usando fallback", () => {
    const res = ParserTitulosSitesMatec.clasificarCarpeta("Serie de potencias", "");
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "matematica_c",
    });
  });
});
