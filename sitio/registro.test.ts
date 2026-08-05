import { describe, it, expect } from "vitest";
import { Sitios } from "./registro";
import { SitioRamonNet } from "./ramonnet/config";

/**
 * Tests del registro de sitios (multi-sitio, corte 2).
 *
 * Con un solo portal registrado esto parece trivial, y a propósito: lo que se afirma no es
 * "encuentra Ramón Net" sino el **contrato con el que va a trabajar el corte 3** — sobre todo
 * que un id desconocido devuelve `undefined` y NO cae al portal por defecto, que es el bug que
 * ADR-0010 previene.
 */
describe("Sitios.obtener (por id, como viene de un ítem persistido)", () => {
  it("devuelve el adaptador cuyo id coincide", () => {
    expect(Sitios.obtener("ramonnet")).toBe(SitioRamonNet);
  });

  it("un id desconocido devuelve undefined y NO cae al portal por defecto", () => {
    // Es el caso de un ítem que quedó en la cola de un portal que ya no está registrado.
    // Caer al primero de la lista lo descargaría con el adaptador equivocado, en silencio.
    expect(Sitios.obtener("portal-que-no-existe")).toBeUndefined();
  });

  it("tolera id vacío/ausente sin tirar", () => {
    expect(Sitios.obtener(undefined)).toBeUndefined();
    expect(Sitios.obtener("")).toBeUndefined();
  });
});

describe("Sitios.resolverPorUrl (para la pestaña activa)", () => {
  it("reconoce una URL del portal delegando en su esPaginaDelSitio", () => {
    expect(Sitios.resolverPorUrl("https://plataforma.ramonnet.com.ar/usuario/clases-grabadas")).toBe(
      SitioRamonNet
    );
  });

  it("una URL ajena no resuelve a ningún portal", () => {
    expect(Sitios.resolverPorUrl("https://www.google.com/")).toBeUndefined();
  });

  it("tolera URL vacía/ausente (pestaña sin URL legible, chrome://…)", () => {
    expect(Sitios.resolverPorUrl(undefined)).toBeUndefined();
    expect(Sitios.resolverPorUrl("")).toBeUndefined();
  });
});

describe("Sitios.todos", () => {
  it("expone los registrados y todos cumplen el contrato mínimo del puerto", () => {
    const todos = Sitios.todos();
    expect(todos.length).toBeGreaterThan(0);
    for (const s of todos) {
      expect(typeof s.id).toBe("string");
      expect(s.id).not.toBe("");
      expect(typeof s.nombre).toBe("string");
      expect(typeof s.esPaginaDelSitio).toBe("function");
    }
  });

  it("no hay ids repetidos: obtener() sería ambiguo", () => {
    const ids = Sitios.todos().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
