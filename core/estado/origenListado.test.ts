import { describe, it, expect } from "vitest";
import { decidirAlAbrir, esOrigenListado } from "./origenListado";

describe("origenListado", () => {
  it("sin clave → 'escanear' (aunque origen y portal coincidan)", () => {
    expect(
      decidirAlAbrir({
        origen: { sitioId: "google-classroom", clave: "curso-1" },
        sitioId: "google-classroom",
        clave: undefined,
        hayItemsDelPortal: true,
      })
    ).toBe("escanear");
  });

  it("sin origen → 'escanear'", () => {
    expect(
      decidirAlAbrir({
        origen: null,
        sitioId: "google-classroom",
        clave: "curso-1",
        hayItemsDelPortal: true,
      })
    ).toBe("escanear");
  });

  it("misma clave pero otro sitioId → 'escanear'", () => {
    expect(
      decidirAlAbrir({
        origen: { sitioId: "otro-sitio", clave: "curso-1" },
        sitioId: "google-classroom",
        clave: "curso-1",
        hayItemsDelPortal: true,
      })
    ).toBe("escanear");
  });

  it("mismo portal, clave distinta → 'escanear'", () => {
    expect(
      decidirAlAbrir({
        origen: { sitioId: "google-classroom", clave: "curso-1" },
        sitioId: "google-classroom",
        clave: "curso-2",
        hayItemsDelPortal: true,
      })
    ).toBe("escanear");
  });

  it("mismo portal y clave, sin ítems del portal → 'escanear'", () => {
    expect(
      decidirAlAbrir({
        origen: { sitioId: "google-classroom", clave: "curso-1" },
        sitioId: "google-classroom",
        clave: "curso-1",
        hayItemsDelPortal: false,
      })
    ).toBe("escanear");
  });

  it("mismo portal y clave, con ítems → 'usar-guardada'", () => {
    expect(
      decidirAlAbrir({
        origen: { sitioId: "google-classroom", clave: "curso-1" },
        sitioId: "google-classroom",
        clave: "curso-1",
        hayItemsDelPortal: true,
      })
    ).toBe("usar-guardada");
  });

  it("esOrigenListado: valida forma del objeto", () => {
    expect(esOrigenListado(null)).toBe(false);
    expect(esOrigenListado("x")).toBe(false);
    expect(esOrigenListado({ sitioId: 1, clave: "a" })).toBe(false);
    expect(esOrigenListado({ sitioId: "a" })).toBe(false);
    expect(esOrigenListado({ sitioId: "a", clave: "" })).toBe(false);
    expect(
      esOrigenListado({ sitioId: "google-classroom", clave: "ODc0ODk1NDcwNTMw" })
    ).toBe(true);
  });
});
