import { describe, it, expect } from "vitest";
import { Sitios } from "./registro";
import { SitioRamonNet } from "./ramonnet/config";
import { SitioAnatomyByChris } from "./anatomy-by-chris/config";

/**
 * Tests del registro de sitios (multi-sitio, corte 2; ampliado en el corte 7).
 *
 * Lo que se afirma no es "encuentra Ramón Net" sino el contrato del que depende el bucle de
 * descarga: que un id desconocido devuelve `undefined` y NO cae al portal por defecto, que es
 * el bug que ADR-0010 previene.
 *
 * **Desde el corte 7 hay dos portales registrados**, y con eso una mitad del frente
 * multiportal deja de tener sólo dobles: que los `esPaginaDelSitio` sean DISJUNTOS se puede
 * afirmar de verdad recién acá.
 */
describe("Sitios.obtener (por id, como viene de un ítem persistido)", () => {
  it("devuelve el adaptador cuyo id coincide", () => {
    expect(Sitios.obtener("ramonnet")).toBe(SitioRamonNet);
    expect(Sitios.obtener("anatomy-by-chris")).toBe(SitioAnatomyByChris);
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

  it("reconoce el segundo portal por el SLUG del curso", () => {
    expect(
      Sitios.resolverPorUrl("https://hotmart.com/es/club/anatomy-by-chris/products/6083220")
    ).toBe(SitioAnatomyByChris);
  });

  it("una URL ajena no resuelve a ningún portal", () => {
    expect(Sitios.resolverPorUrl("https://www.google.com/")).toBeUndefined();
  });

  it("⚠️ OTRO curso de Hotmart NO lo reclama nadie", () => {
    // La trampa del corte 7: `hotmart.com` hospeda miles de cursos ajenos. Un
    // `esPaginaDelSitio` que mirara sólo el host haría que este adaptador gane esa pestaña —y
    // como el registro recorre la lista en orden, gana el primero que dice que sí—, o sea
    // escanear/descargar con el adaptador equivocado, en silencio.
    expect(
      Sitios.resolverPorUrl("https://hotmart.com/es/club/otro-curso/products/999")
    ).toBeUndefined();
  });

  it("los dos portales son DISJUNTOS: ninguno reclama la URL del otro", () => {
    // La mitad "el otro portal no se ve afectado" del frente multiportal, que hasta el corte 7
    // sólo tenía dobles.
    const urls = [
      "https://plataforma.ramonnet.com.ar/usuario/clases-grabadas",
      "https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/ABC",
    ];
    for (const url of urls) {
      const reclaman = Sitios.todos().filter((s) => s.esPaginaDelSitio(url));
      expect(reclaman).toHaveLength(1);
    }
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
