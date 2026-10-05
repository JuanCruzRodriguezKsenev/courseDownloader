/**
 * Tests del parser de títulos de Google Classroom (Capa 2).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import ParserTitulosClassroom from "./parserTitulos.js";
import { sanearNombreCarpeta } from "../../core/util/texto";

beforeEach(() => {
  globalThis.Utils = { sanearNombreCarpeta };
});
afterEach(() => {
  delete globalThis.Utils;
});

describe("ParserTitulosClassroom.clasificarCarpeta", () => {
  it('clasificarCarpeta("x.pdf", "Fisica_II_G25_2026 › Presentaciones teóricas") devuelve { catedra: "COMUN", carpeta: "fisica_ii_g25_2026" }', () => {
    const res = ParserTitulosClassroom.clasificarCarpeta(
      "x.pdf",
      "Fisica_II_G25_2026 › Presentaciones teóricas"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "fisica_ii_g25_2026",
    });
  });

  it("dos cursos con el mismo tema dan carpetas distintas", () => {
    const resPalacio = ParserTitulosClassroom.clasificarCarpeta(
      "lab1.pdf",
      "Física II G22 (Palacio) › Laboratorios"
    );
    const resBianchi = ParserTitulosClassroom.clasificarCarpeta(
      "lab1.pdf",
      "Fisica_II_G25_2026 › Laboratorios"
    );

    expect(resPalacio.carpeta).not.toBe(resBianchi.carpeta);
    expect(resPalacio.carpeta).toBe("fisica_ii_g22_palacio");
    expect(resBianchi.carpeta).toBe("fisica_ii_g25_2026");
  });
});
