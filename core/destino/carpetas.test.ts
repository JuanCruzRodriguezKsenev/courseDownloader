import { describe, it, expect } from "vitest";
import { DESTINOS, sugerirDestino, resolverCarpeta } from "./carpetas";

describe("core/destino/carpetas.ts", () => {
  it("DESTINOS contiene los 8 destinos canónicos", () => {
    expect(DESTINOS).toEqual([
      ".",
      "Teorias",
      "Practicas",
      "Laboratorios",
      "Parciales",
      "Finales",
      "Bibliografia",
      "Notas",
    ]);
  });

  describe("sugerirDestino con temas reales", () => {
    it("Clases Teóricas Módulo I -> Teorias (regla: true)", () => {
      expect(sugerirDestino("Clases Teóricas Módulo I")).toEqual({
        destino: "Teorias",
        regla: true,
      });
    });

    it("Guía de TP Nº 3 - Ejercicios resueltos y consultas. -> Practicas (regla: true)", () => {
      expect(sugerirDestino("Guía de TP Nº 3 - Ejercicios resueltos y consultas.")).toEqual({
        destino: "Practicas",
        regla: true,
      });
    });

    it("Laboratorios -> Laboratorios (regla: true)", () => {
      expect(sugerirDestino("Laboratorios")).toEqual({
        destino: "Laboratorios",
        regla: true,
      });
    });

    it("Bibliografía de la Cátedra -> Bibliografia (regla: true)", () => {
      expect(sugerirDestino("Bibliografía de la Cátedra")).toEqual({
        destino: "Bibliografia",
        regla: true,
      });
    });

    it("Libro de cátedra -> Bibliografia (regla: true)", () => {
      expect(sugerirDestino("Libro de cátedra")).toEqual({
        destino: "Bibliografia",
        regla: true,
      });
    });

    it("Parciales-Módulo II -> Parciales (regla: true)", () => {
      expect(sugerirDestino("Parciales-Módulo II")).toEqual({
        destino: "Parciales",
        regla: true,
      });
    });

    it("Cronogramas y planificación semanal -> . (regla: true)", () => {
      expect(sugerirDestino("Cronogramas y planificación semanal")).toEqual({
        destino: ".",
        regla: true,
      });
    });

    it("Videos de experiencias y simulaciones -> Teorias (regla: true)", () => {
      expect(sugerirDestino("Videos de experiencias y simulaciones")).toEqual({
        destino: "Teorias",
        regla: true,
      });
    });

    it("Novedades -> . (regla: true)", () => {
      expect(sugerirDestino("Novedades")).toEqual({
        destino: ".",
        regla: true,
      });
    });

    it("Series de fourier y ecuaciones en derivadas parciales -> . con regla:false", () => {
      expect(sugerirDestino("Series de fourier y ecuaciones en derivadas parciales")).toEqual({
        destino: ".",
        regla: false,
      });
    });

    it("Links-Módulo I -> Teorias (regla: true)", () => {
      expect(sugerirDestino("Links-Módulo I")).toEqual({
        destino: "Teorias",
        regla: true,
      });
    });

    it("Notas de evaluaciones -> Notas (regla: true)", () => {
      expect(sugerirDestino("Notas de evaluaciones")).toEqual({
        destino: "Notas",
        regla: true,
      });
    });

    it("Resultados -> Notas (regla: true)", () => {
      expect(sugerirDestino("Resultados")).toEqual({
        destino: "Notas",
        regla: true,
      });
    });
  });

  describe("sugerirDestino con títulos de publicación (RN-7a)", () => {
    it("T1. Complejos con publicación de práctica -> Practicas (regla: true)", () => {
      expect(sugerirDestino("Complejos", ["Ejercicios para practicar: Complejos"])).toEqual({
        destino: "Practicas",
        regla: true,
      });
    });

    it("T2. Mayoría de prácticas -> Practicas (regla: true)", () => {
      expect(
        sugerirDestino("Transformaciones lineales y proyecciones", [
          "Ejercicios para practicar: Proyecciones",
          "Ejercicios resueltos",
          "Ejercicios para practicar: Transformaciones lineales",
        ])
      ).toEqual({
        destino: "Practicas",
        regla: true,
      });
    });

    it("T3. Minoría -> . (regla: false)", () => {
      expect(
        sugerirDestino("Cuestiones administrativas", [
          "Formulario de inscripción interna",
          "Clase I",
          "Guía 1",
        ])
      ).toEqual({
        destino: ".",
        regla: false,
      });
    });

    it("T4. El tema manda siempre -> . (regla: true)", () => {
      expect(sugerirDestino("Novedades", ["Parcial 1", "Parcial 2"])).toEqual({
        destino: ".",
        regla: true,
      });
    });

    it("T5. La mitad justa no alcanza -> . (regla: false)", () => {
      expect(sugerirDestino("Unidad 3", ["Guía 1", "Clase I"])).toEqual({
        destino: ".",
        regla: false,
      });
    });

    it("T6. Mayoría de notas -> Notas (regla: true)", () => {
      expect(
        sugerirDestino("Unidad 3", ["Notas del parcial", "Resultados finales"])
      ).toEqual({
        destino: "Notas",
        regla: true,
      });
    });
  });

  describe("resolverCarpeta", () => {
    it('agrega docente si destino es "Teorias"', () => {
      expect(resolverCarpeta("Teorias", "Palacio")).toBe("Teorias/Palacio");
    });

    it('deja "Teorias" plana si docente está vacío o sólo tiene espacios', () => {
      expect(resolverCarpeta("Teorias", "  ")).toBe("Teorias");
      expect(resolverCarpeta("Teorias", "")).toBe("Teorias");
      expect(resolverCarpeta("Teorias", null)).toBe("Teorias");
    });

    it('no modifica destinos distintos de "Teorias"', () => {
      expect(resolverCarpeta("Practicas", "Palacio")).toBe("Practicas");
      expect(resolverCarpeta("Laboratorios", "Palacio")).toBe("Laboratorios");
      expect(resolverCarpeta(".", "Palacio")).toBe(".");
    });
  });
});
