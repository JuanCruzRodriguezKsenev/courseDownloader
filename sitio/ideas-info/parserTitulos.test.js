/**
 * Tests del parser de títulos de IDEAS (sitio/ideas-info/parserTitulos.js).
 */
import { describe, it, expect, afterEach } from "vitest";
import ParserTitulosIdeasInfo from "./parserTitulos.js";
import { sanearNombreCarpeta } from "../../core/util/texto.ts";

describe("ParserTitulosIdeasInfo.clasificarCarpeta", () => {
  afterEach(() => {
    delete globalThis.Utils;
  });

  it("1. clasifica curso y tema devolviendo catedra: COMUN y carpeta saneada", () => {
    const res = ParserTitulosIdeasInfo.clasificarCarpeta(
      "CBD2026-Clase-1.pdf",
      "Conceptos de Bases de Datos › Teorías"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "conceptos_de_bases_de_datos",
    });
  });

  it("2. funciona con globalThis.Utils presente", () => {
    globalThis.Utils = { sanearNombreCarpeta };
    const res = ParserTitulosIdeasInfo.clasificarCarpeta(
      "archivo.pdf",
      "Conceptos de Bases de Datos › Práctica"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "conceptos_de_bases_de_datos",
    });
  });

  it("3. maneja materiaBase simple sin separador", () => {
    const res = ParserTitulosIdeasInfo.clasificarCarpeta(
      "archivo.pdf",
      "Conceptos de Bases de Datos"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "conceptos_de_bases_de_datos",
    });
  });
});
