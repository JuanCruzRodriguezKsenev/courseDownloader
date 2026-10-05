import { describe, it, expect } from "vitest";
import { DESTINOS, sugerirDestino, resolverCarpeta, nombreSubcarpetaTema } from "./carpetas";

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

  describe("nombreSubcarpetaTema (AC-5, RN-1..3, RN-6..8)", () => {
    it.each([
      { tema: "series", esperado: "Series" },
      { tema: "Clases teóricas - Módulo I", esperado: "Clases teoricas - Modulo I" },
      { tema: "TP 1: Límites / Derivadas", esperado: "TP 1- Limites - Derivadas" },
      { tema: "..", esperado: "" },
    ])("AC-5: '$tema' -> '$esperado'", ({ tema, esperado }) => {
      expect(nombreSubcarpetaTema(tema)).toBe(esperado);
    });

    it("devuelve vacío para temas reservados o vacíos", () => {
      expect(nombreSubcarpetaTema("Novedades")).toBe("");
      expect(nombreSubcarpetaTema("novedades")).toBe("");
      expect(nombreSubcarpetaTema("Sin tema")).toBe("");
      expect(nombreSubcarpetaTema("sin tema")).toBe("");
      expect(nombreSubcarpetaTema("")).toBe("");
      expect(nombreSubcarpetaTema(null)).toBe("");
      expect(nombreSubcarpetaTema(undefined)).toBe("");
      expect(nombreSubcarpetaTema(".")).toBe("");
      expect(nombreSubcarpetaTema("..")).toBe("");
      expect(nombreSubcarpetaTema("???")).toBe("");
    });
  });

  describe("resolverCarpeta con subcarpetaTema (AC-1..4, RN-9)", () => {
    it("agrega docente si destino es 'Teorias'", () => {
      expect(resolverCarpeta("Teorias", "Palacio")).toBe("Teorias/Palacio");
    });

    it("deja 'Teorias' plana si docente está vacío o sólo tiene espacios", () => {
      expect(resolverCarpeta("Teorias", "  ")).toBe("Teorias");
      expect(resolverCarpeta("Teorias", "")).toBe("Teorias");
      expect(resolverCarpeta("Teorias", null)).toBe("Teorias");
    });

    it("no modifica destinos distintos de 'Teorias' sin subcarpeta", () => {
      expect(resolverCarpeta("Practicas", "Palacio")).toBe("Practicas");
      expect(resolverCarpeta("Laboratorios", "Palacio")).toBe("Laboratorios");
      expect(resolverCarpeta(".", "Palacio")).toBe(".");
    });

    it("tercer parámetro ausente preserva comportamiento existente", () => {
      expect(resolverCarpeta("Teorias", "Gomez")).toBe("Teorias/Gomez");
      expect(resolverCarpeta("Practicas")).toBe("Practicas");
    });

    it("AC-1 — Ruta con docente", () => {
      expect(resolverCarpeta("Teorias", "Gomez", "Series")).toBe("Teorias/Gomez/Series");
    });

    it("AC-2 — Ruta sin docente", () => {
      expect(resolverCarpeta("Teorias", "", "Series")).toBe("Teorias/Series");
      expect(resolverCarpeta("Teorias", null, "Series")).toBe("Teorias/Series");
    });

    it("AC-3 — Destinos sin docente", () => {
      expect(resolverCarpeta("Practicas", null, "Guía 1")).toBe("Practicas/Guia 1");
    });

    it.each([
      { tema: "Series", destino: ".", esperado: "." },
      { tema: "Series", destino: "-", esperado: "-" },
      { tema: "Novedades", destino: "Teorias", esperado: "Teorias" },
      { tema: "Sin tema", destino: "Teorias", esperado: "Teorias" },
      { tema: "???", destino: "Teorias", esperado: "Teorias" },
    ])("AC-4: tema '$tema' con destino '$destino' -> '$esperado'", ({ tema, destino, esperado }) => {
      expect(resolverCarpeta(destino, undefined, tema)).toBe(esperado);
    });

    it("RN-9 — dos temas con el mismo nombre saneado dan la misma carpeta", () => {
      const carpeta1 = resolverCarpeta("Teorias", "Gomez", "series");
      const carpeta2 = resolverCarpeta("Teorias", "Gomez", "Series");
      expect(carpeta1).toBe("Teorias/Gomez/Series");
      expect(carpeta2).toBe("Teorias/Gomez/Series");
      expect(carpeta1).toBe(carpeta2);
    });
  });
});

