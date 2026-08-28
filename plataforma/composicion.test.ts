// @vitest-environment jsdom
/**
 * Tests del wrapper `sitios` de la raíz de composición.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ---------------------------
 * `plataforma/composicion.ts` exporta `sitios` —no el registro crudo— y ése es el export que
 * comparten el service worker y el popup **para que no puedan divergir**: la regla de cómo se
 * resuelve un portal vive en un solo lugar. Hasta el 2026-08-12 esa regla no tenía ni un test
 * propio; lo que estaba cubierto era `sitio/registro.ts`, que es la capa de abajo y **no**
 * implementa la parte que más se puede equivocar: la migración del `sitioId` ausente.
 *
 * La distinción que se fija acá es la que `AGENTS.md` marca como silenciosa en los dos
 * sentidos, y son TRES casos, no dos:
 *
 *   - `sitioId` **ausente** → dato anterior al multi-sitio → resuelve al portal LEGADO.
 *     Tratarlo como huérfano saltearía la cola entera de un usuario real.
 *   - `sitioId` **presente pero no registrado** → huérfano → NO resuelve.
 *     Tratarlo como ausente lo descargaría con el adaptador del portal equivocado.
 *   - **por URL de pestaña** → sin migración, a propósito: una URL que no matchea no es un dato
 *     viejo, es una pestaña que no es de ningún portal.
 *
 * El tercero es el que este archivo estrena, y entró junto con el ítem 5 de la auditoría de
 * loaders: el onboarding montaba con `obtener(undefined)` fijo —el legado— en vez de resolver
 * la pestaña, así que la slide 3 mostraba la instrucción de Ramón Net también en Anatomy.
 */
import { describe, it, expect } from "vitest";
import { sitios } from "./composicion.ts";
import { SitioRamonNet } from "../sitio/ramonnet/config.ts";
import { SitioAnatomyByChris } from "../sitio/anatomy-by-chris/config.ts";

describe("sitios.obtener: la migración del sitioId ausente vive acá", () => {
  it("un sitioId ausente resuelve al portal legado (dato pre-multisitio)", () => {
    // Es la mitad que `sitio/registro.ts` NO hace: allá `obtener(undefined)` da `undefined`.
    expect(sitios.obtener(undefined)).toBe(SitioRamonNet);
  });

  it("un id conocido resuelve a su portal, sin pasar por la migración", () => {
    expect(sitios.obtener("ramonnet")).toBe(SitioRamonNet);
    expect(sitios.obtener("anatomy-by-chris")).toBe(SitioAnatomyByChris);
  });

  it("⚠️ presente pero NO registrado es huérfano: no resuelve ni cae al legado", () => {
    // El caso que se confunde con el de arriba. Si cayera al legado, un ítem de un portal
    // muerto se bajaría con el adaptador de Ramón Net, en silencio.
    expect(sitios.obtener("portal-que-ya-no-existe")).toBeUndefined();
  });
});

describe("sitios.resolverPorUrl: para la pestaña, y SIN migración", () => {
  it("reconoce la pestaña de cada portal", () => {
    expect(sitios.resolverPorUrl("https://ramonnet.com.ar/usuario/clases-grabadas"))
      .toBe(SitioRamonNet);
    expect(sitios.resolverPorUrl("https://hotmart.com/es/club/anatomy-by-chris/products/6083220"))
      .toBe(SitioAnatomyByChris);
  });

  it("⚠️ una pestaña ajena NO cae al legado, a diferencia de obtener()", () => {
    // Ésta es la asimetría deliberada entre los dos métodos, y el motivo de que este test
    // exista: caer al legado acá haría que el popup escanee cualquier página con el adaptador
    // de Ramón Net. Es el bug que ADR-0010 previene.
    expect(sitios.resolverPorUrl("https://www.google.com")).toBeFalsy();
  });

  it("tolera una pestaña sin URL legible (chrome://, about:blank) sin tirar", () => {
    // El popup llama a esto con `tab.url`, que puede no estar: sin permiso de host, Chrome lo
    // deja en `undefined`. Si tirara, se caería el montaje del onboarding.
    expect(() => sitios.resolverPorUrl(undefined)).not.toThrow();
    expect(sitios.resolverPorUrl(undefined)).toBeFalsy();
    expect(sitios.resolverPorUrl("")).toBeFalsy();
  });
});

describe("el fallback que usa el onboarding (ítem 5 de la auditoría de loaders)", () => {
  // `entrypoints/popup/main.js` monta la isla con
  //   `sitios.resolverPorUrl(tab.url) || sitios.obtener(undefined)`
  // y ese entrypoint es `.js`, así que ni `tsc` ni la suite lo alcanzan. Lo que sí se puede
  // fijar es que la expresión de la que depende se comporte como el fix asume.
  const portalParaElTour = (url?: string) => sitios.resolverPorUrl(url) || sitios.obtener(undefined);

  it("en la pestaña de Anatomy el tour describe Anatomy, no el legado", () => {
    const portal = portalParaElTour("https://hotmart.com/es/club/anatomy-by-chris/products/6083220");
    expect(portal).toBe(SitioAnatomyByChris);
    // Y la consecuencia visible, que es el defecto que se cerró: la slide 3 deja de prometer un
    // selector de materia que ese portal no tiene.
    expect(portal!.instruccionEscaneo).not.toContain("selector");
  });

  it("fuera de todo portal el tour cae al legado, que es a donde manda al usuario", () => {
    expect(portalParaElTour("https://www.google.com")).toBe(SitioRamonNet);
    expect(portalParaElTour(undefined)).toBe(SitioRamonNet);
  });
});

describe("sitios.todos: la card de 'no estás en un portal reconocido' los NOMBRA", () => {
  // Ese cartel dice "abrí una de <portales> y tocá Re-escanear". Si la lista se escribiera a
  // mano en el copy, envejecería en el próximo portal que se registre — que es exactamente lo
  // que ADR-0010 evita en los datos, entrando por el texto.
  //
  // OJO CON CÓMO SE COMPARA ACÁ, y costó un test rojo: los descriptores llevan el getter
  // `escanearListado`, que lee la global `Scraper` de un `.js` hermano que estos tests no
  // cargan. Cualquier aserción que INSPECCIONE el objeto (un `toContain` sobre descriptores,
  // un `toEqual` profundo) lo invoca y muere con "Scraper is not defined" — un rojo que no
  // habla de lo que se está probando. Se compara por `id`, que es dato plano.
  const ids = () => sitios.todos().map((s) => s.id);

  it("devuelve los dos portales registrados", () => {
    expect(ids()).toContain("ramonnet");
    expect(ids()).toContain("anatomy-by-chris");
  });

  it("todos tienen nombre legible: es lo único que la card muestra", () => {
    for (const portal of sitios.todos()) {
      expect(typeof portal.nombre).toBe("string");
      expect(portal.nombre.length).toBeGreaterThan(0);
    }
  });

  // El wrapper de composición es el que comparten SW y popup; que no filtre ni reordene es lo
  // que hace que el cartel enumere lo mismo que el registro resuelve por id.
  it("no esconde ninguno: cada uno resuelve por su id al mismo descriptor", () => {
    for (const portal of sitios.todos()) {
      expect(sitios.obtener(portal.id)).toBe(portal);
    }
  });
});
