/**
 * Tests de la identidad de una clase (corte multiportal D).
 *
 * Lo que se afirma acá es la distinción de tres casos de `sitioId` —ausente, registrado,
 * huérfano— que el corte 3 destapó y que acá vuelve a decidir si dos ítems son el mismo. El
 * bug que previene no es teórico: con la identidad por título, completar una clase sacaba de
 * la cola a su homónima del otro portal, que desaparecía sin error.
 */
import { describe, it, expect } from "vitest";
import { crearIdentidadClase } from "./identidadClase";

/** Imita al resolvedor compartido de la composición, migración incluida. */
const sitios = {
  obtener: (id?: string) => {
    const efectivo = id ?? "ramonnet";
    return efectivo === "ramonnet" || efectivo === "otro" ? { id: efectivo } : undefined;
  },
};

const identidad = crearIdentidadClase(sitios);

describe("crearIdentidadClase.misma", () => {
  it("dos clases con el mismo título en portales distintos NO son la misma", () => {
    // EL caso del corte: con la identidad por título, bajar una borraba a la otra.
    expect(
      identidad.misma(
        { titulo: "Semana 3", sitioId: "ramonnet" },
        { titulo: "Semana 3", sitioId: "otro" }
      )
    ).toBe(false);
  });

  it("la misma clase del mismo portal sí lo es", () => {
    expect(
      identidad.misma(
        { titulo: "Semana 3", sitioId: "ramonnet" },
        { titulo: "Semana 3", sitioId: "ramonnet" }
      )
    ).toBe(true);
  });

  it("títulos distintos del mismo portal no son la misma", () => {
    expect(
      identidad.misma(
        { titulo: "Semana 3", sitioId: "ramonnet" },
        { titulo: "Semana 4", sitioId: "ramonnet" }
      )
    ).toBe(false);
  });

  // La distinción del corte 3: ausente ≠ desconocido.
  it("un ítem SIN sitioId es la misma clase que uno del portal legado", () => {
    expect(
      identidad.misma({ titulo: "Vieja" }, { titulo: "Vieja", sitioId: "ramonnet" })
    ).toBe(true);
  });

  it("un ítem sin sitioId NO es la misma que una homónima de otro portal", () => {
    expect(
      identidad.misma({ titulo: "Vieja" }, { titulo: "Vieja", sitioId: "otro" })
    ).toBe(false);
  });

  it("dos huérfanos del mismo portal muerto siguen siendo la misma clase", () => {
    // No resuelven, así que se comparan por el id crudo: si no, cada huérfano sería único y
    // sacarlo de la cola no lo encontraría nunca.
    expect(
      identidad.misma(
        { titulo: "X", sitioId: "borrado" },
        { titulo: "X", sitioId: "borrado" }
      )
    ).toBe(true);
  });

  it("huérfanos de portales muertos DISTINTOS no se confunden", () => {
    expect(
      identidad.misma(
        { titulo: "X", sitioId: "borrado-a" },
        { titulo: "X", sitioId: "borrado-b" }
      )
    ).toBe(false);
  });

  it("no tira con nulos ni con ítems incompletos", () => {
    expect(identidad.misma(null, null)).toBe(true);
    expect(identidad.misma(undefined, { titulo: "X", sitioId: "ramonnet" })).toBe(false);
    expect(() => identidad.clave(null)).not.toThrow();
  });
});

describe("crearIdentidadClase.clave", () => {
  it("normaliza el ausente al portal legado, así el mapa no duplica entradas", () => {
    expect(identidad.clave({ titulo: "Vieja" })).toBe("ramonnet|Vieja");
    expect(identidad.clave({ titulo: "Vieja", sitioId: "ramonnet" })).toBe("ramonnet|Vieja");
  });

  it("un huérfano conserva su id crudo en la clave", () => {
    expect(identidad.clave({ titulo: "X", sitioId: "borrado" })).toBe("borrado|X");
  });
});
