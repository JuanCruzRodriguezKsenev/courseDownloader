/**
 * Tests del parser de títulos de Moodle Asignaturas (sitio/moodle-asignaturas/parserTitulos.js).
 */
import { describe, it, expect, afterEach } from "vitest";
import ParserTitulosMoodleAsignaturas from "./parserTitulos.js";
import { sanearNombreCarpeta } from "../../core/util/texto.ts";

describe("ParserTitulosMoodleAsignaturas.clasificarCarpeta", () => {
  afterEach(() => {
    delete globalThis.Utils;
  });

  it("1. clasifica curso y tema devolviendo catedra: COMUN y carpeta saneada", () => {
    const res = ParserTitulosMoodleAsignaturas.clasificarCarpeta(
      "Presentacion.pdf",
      "2024_CURSADA REGULAR_Programación II › Bienvenida"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "2024_cursada_regular_programacion_ii",
    });
  });

  it("2. funciona con globalThis.Utils presente", () => {
    globalThis.Utils = { sanearNombreCarpeta };
    const res = ParserTitulosMoodleAsignaturas.clasificarCarpeta(
      "archivo.pdf",
      "Fisica I › Modulo 1"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "fisica_i",
    });
  });

  it("3. maneja materiaBase simple sin separador", () => {
    const res = ParserTitulosMoodleAsignaturas.clasificarCarpeta(
      "archivo.pdf",
      "Programacion 2"
    );
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "programacion_2",
    });
  });
});
