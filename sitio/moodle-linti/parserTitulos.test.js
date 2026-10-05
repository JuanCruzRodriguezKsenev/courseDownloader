/**
 * Tests de parserTitulos de Moodle del LINTI (Capa 2).
 */
import { describe, it, expect, vi } from "vitest";
import ParserTitulosMoodleLinti from "./parserTitulos.js";

describe("ParserTitulosMoodleLinti.clasificarCarpeta", () => {
  it("extrae el nombre del curso de 'curso › sección' y catedra COMUN", () => {
    globalThis.Utils = {
      sanearNombreCarpeta: vi.fn((c) => `saneado_${c}`),
    };

    const res = ParserTitulosMoodleLinti.clasificarCarpeta(
      "archivo.pdf",
      "ISO-CSO (2026) › Clases teóricas"
    );

    expect(res.catedra).toBe("COMUN");
    expect(res.carpeta).toBe("saneado_ISO-CSO (2026)");
    expect(globalThis.Utils.sanearNombreCarpeta).toHaveBeenCalledWith("ISO-CSO (2026)");
  });

  it("si no hay Utils, sanea caracteres inválidos por fallback", () => {
    delete globalThis.Utils;

    const res = ParserTitulosMoodleLinti.clasificarCarpeta(
      "archivo.pdf",
      "Curso/Con:Caracteres*Raros › General"
    );

    expect(res.catedra).toBe("COMUN");
    expect(res.carpeta).toBe("Curso_Con_Caracteres_Raros");
  });
});
