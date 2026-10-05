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

  describe("decidirAlAbrir — filas de la tabla de decisión y recorrido multi-curso", () => {
    it("fila 1: recorrido escaneando vigente en la misma pestaña → 'mostrar-recorrido'", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "todos",
          hayItemsDelPortal: false,
          esPortada: true,
          recorrido: {
            tabId: 10,
            estado: "escaneando",
            vigente: true,
            materializado: false,
          },
          tabId: 10,
        })
      ).toBe("mostrar-recorrido");
    });

    it("fila 1 no aplica si el recorrido es de OTRA pestaña", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "todos",
          hayItemsDelPortal: false,
          esPortada: true,
          recorrido: {
            tabId: 10,
            estado: "escaneando",
            vigente: true,
            materializado: false,
          },
          tabId: 20,
        })
      ).toBe("ofrecer-todos");
    });

    it("fila 2: recorrido terminado sin materializar aplica en cualquier página (incluso curso) → 'materializar-recorrido'", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "curso:C123",
          hayItemsDelPortal: false,
          esPortada: false,
          recorrido: {
            tabId: 10,
            estado: "terminado",
            vigente: true,
            materializado: false,
          },
          tabId: 10,
        })
      ).toBe("materializar-recorrido");
    });

    it("fila 2: recorrido cortado sin materializar → 'materializar-recorrido'", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "todos",
          hayItemsDelPortal: false,
          esPortada: true,
          recorrido: {
            tabId: 10,
            estado: "cortado",
            vigente: true,
            materializado: false,
          },
          tabId: 10,
        })
      ).toBe("materializar-recorrido");
    });

    it("fila 3: en portada con lista guardada previa ('todos') → 'usar-guardada'", () => {
      expect(
        decidirAlAbrir({
          origen: { sitioId: "google-classroom", clave: "todos" },
          sitioId: "google-classroom",
          clave: "todos",
          hayItemsDelPortal: true,
          esPortada: true,
          recorrido: null,
          tabId: 10,
        })
      ).toBe("usar-guardada");
    });

    it("fila 4: en portada sin lista guardada coincidente → 'ofrecer-todos'", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "todos",
          hayItemsDelPortal: false,
          esPortada: true,
          recorrido: null,
          tabId: 10,
        })
      ).toBe("ofrecer-todos");
    });

    it("fila 5: en curso sin lista guardada → 'escanear'", () => {
      expect(
        decidirAlAbrir({
          origen: null,
          sitioId: "google-classroom",
          clave: "curso:C123",
          hayItemsDelPortal: false,
          esPortada: false,
          recorrido: null,
          tabId: 10,
        })
      ).toBe("escanear");
    });

    it("compatibilidad regresiva (AC-13): llamadas previas con esPortada: false y recorrido: null devuelven exactamente igual", () => {
      expect(
        decidirAlAbrir({
          origen: { sitioId: "google-classroom", clave: "curso-1" },
          sitioId: "google-classroom",
          clave: "curso-1",
          hayItemsDelPortal: true,
          esPortada: false,
          recorrido: null,
        })
      ).toBe("usar-guardada");

      expect(
        decidirAlAbrir({
          origen: { sitioId: "google-classroom", clave: "curso-1" },
          sitioId: "google-classroom",
          clave: "curso-2",
          hayItemsDelPortal: true,
          esPortada: false,
          recorrido: null,
        })
      ).toBe("escanear");
    });
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
