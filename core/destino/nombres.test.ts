import { describe, it, expect } from "vitest";
import { proponerNombre } from "./nombres";

describe("core/destino/nombres.ts", () => {
  describe("ejemplos de AC-11", () => {
    it("P3.- Ley de Gauss-2023.pdf -> 03_ley_de_gauss.pdf", () => {
      expect(
        proponerNombre({
          original: "P3.- Ley de Gauss-2023.pdf",
        })
      ).toBe("03_ley_de_gauss.pdf");
    });

    it("P10.- Circuitos de CC en estado transitorio -> 10_circuitos_de_cc_en_estado_transitorio", () => {
      expect(
        proponerNombre({
          original: "P10.- Circuitos de CC en estado transitorio",
        })
      ).toBe("10_circuitos_de_cc_en_estado_transitorio");
    });

    it("Documento_completo.pdf-PDFA.pdf -> documento_completo_pdfa.pdf", () => {
      expect(
        proponerNombre({
          original: "Documento_completo.pdf-PDFA.pdf",
        })
      ).toBe("documento_completo_pdfa.pdf");
    });

    it("Teoria Grupo G-MAS.pdf con tema sin módulo (Clases teóricas) -> teoria_grupo_g_mas.pdf", () => {
      // AC-11 fila 4 se prueba con un tema sin módulo (Clases teóricas),
      // que es la única forma en que da su "propuesto" sin prefijo modN_.
      expect(
        proponerNombre({
          original: "Teoria Grupo G-MAS.pdf",
          tema: "Clases teóricas",
        })
      ).toBe("teoria_grupo_g_mas.pdf");
    });
  });

  describe("reglas adicionales y casos reales", () => {
    it("Teoria Grupo G-MAS.pdf con tema con módulo -> mod1_teoria_grupo_g_mas.pdf", () => {
      expect(
        proponerNombre({
          original: "Teoria Grupo G-MAS.pdf",
          tema: "Clases teóricas - Módulo I",
        })
      ).toBe("mod1_teoria_grupo_g_mas.pdf");
    });

    it("Palacio - Clase 5 - Capacitores.pdf con docente Palacio -> 05_capacitores.pdf (AC-1)", () => {
      expect(
        proponerNombre({
          original: "Palacio - Clase 5 - Capacitores.pdf",
          docente: "Palacio",
        })
      ).toBe("05_capacitores.pdf");
    });

    it("10 Experimentos de Electrostática.mp4.md -> 10_experimentos_de_electrostatica.md (RN-17)", () => {
      expect(
        proponerNombre({
          original: "10 Experimentos de Electrostática.mp4.md",
        })
      ).toBe("10_experimentos_de_electrostatica.md");
    });

    it("Apunte (1).PDF -> apunte.pdf", () => {
      expect(
        proponerNombre({
          original: "Apunte (1).PDF",
        })
      ).toBe("apunte.pdf");
    });

    it("2023_Fisica1_Clase01.pdf no lleva NN_ al principio", () => {
      expect(
        proponerNombre({
          original: "2023_Fisica1_Clase01.pdf",
        })
      ).toBe("2023_fisica1_clase01.pdf");
    });

    it("tema 'Prácticas - Módulos I y II' (con 's') queda sin modN_", () => {
      expect(
        proponerNombre({
          original: "TP 1 - Ley de Ohm.pdf",
          tema: "Prácticas - Módulos I y II",
        })
      ).toBe("01_ley_de_ohm.pdf");
    });
  });
});
