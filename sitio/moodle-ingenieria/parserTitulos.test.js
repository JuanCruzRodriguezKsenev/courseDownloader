/**
 * Tests del parser de títulos de Moodle Ingeniería (sitio/moodle-ingenieria/parserTitulos.js).
 */
import { describe, it, expect, afterEach } from "vitest";
import ParserTitulosMoodleIngenieria from "./parserTitulos.js";
import { sanearNombreCarpeta } from "../../core/util/texto.ts";

describe("ParserTitulosMoodleIngenieria.clasificarCarpeta", () => {
  afterEach(() => {
    delete globalThis.Utils;
  });

  it("1. clasifica curso y tema devolviendo catedra: COMUN y carpeta saneada", () => {
    const res = ParserTitulosMoodleIngenieria.clasificarCarpeta(
      "Cronograma.pdf",
      "Matemática B3 (2023) › Anuncios Parroquiales"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "matematica_b3_2023",
    });
  });

  it("2. funciona con globalThis.Utils presente", () => {
    globalThis.Utils = { sanearNombreCarpeta };
    const res = ParserTitulosMoodleIngenieria.clasificarCarpeta(
      "archivo.pdf",
      "Fisica II (2023) › Modulo 1"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "fisica_ii_2023",
    });
  });

  it("3. maneja materiaBase simple sin separador", () => {
    const res = ParserTitulosMoodleIngenieria.clasificarCarpeta(
      "archivo.pdf",
      "Matematica B3 (2023)"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "matematica_b3_2023",
    });
  });
});
