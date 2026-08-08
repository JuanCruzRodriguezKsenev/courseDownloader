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
    expect(identidad.clave({ titulo: "Vieja" })).toBe("ramonnet||video|Vieja");
    expect(identidad.clave({ titulo: "Vieja", sitioId: "ramonnet" })).toBe("ramonnet||video|Vieja");
  });

  it("un huérfano conserva su id crudo en la clave", () => {
    expect(identidad.clave({ titulo: "X", sitioId: "borrado" })).toBe("borrado||video|X");
  });

  it("un portal de un solo nivel no manda módulo ni tipo: su clave queda como la de siempre", () => {
    // Es la garantía de que el corte 1 NO migra datos de Ramón Net: la clave que produce hoy es
    // semánticamente la misma que producía la v1, con dos campos vacíos en el medio.
    expect(identidad.clave({ titulo: "Anatomía TP 1", sitioId: "ramonnet" })).toBe(
      "ramonnet||video|Anatomía TP 1"
    );
  });

  it('el tipo cae en "video" cuando no viene, y un adjunto NO comparte clave con su video', () => {
    // El día que entren los adjuntos (corte 5), un PDF y el video del que cuelga comparten
    // portal, módulo y título. Si el tipo no estuviera en la clave, bajar uno sacaría al otro
    // de la cola — el mismo modo de fallar que este corte vino a cerrar.
    const video = { titulo: "Osteologia", sitioId: "anatomy-by-chris", modulo: "miembro_superior" };
    const pdf = { ...video, tipo: "adjunto" as const };

    expect(identidad.clave(video)).toBe("anatomy-by-chris|miembro_superior|video|Osteologia");
    expect(identidad.clave(pdf)).toBe("anatomy-by-chris|miembro_superior|adjunto|Osteologia");
    expect(identidad.misma(video, pdf)).toBe(false);
  });
});

describe("crearIdentidadClase — las 7 colisiones reales de Anatomy by Chris", () => {
  // Medidas sobre `/v1/navigation` el 2026-08-07: siete títulos existen en DOS módulos a la vez.
  // Son clases distintas, con distinto video y distinta carpeta, y con la clave `(portal, título)`
  // eran una sola: completar la descarga de una sacaba a la otra de la cola, que nunca se bajaba
  // y desaparecía sin error. Esta es la regresión que el corte 1 cierra.
  const COLISIONES = [
    "Miologia 1",
    "Miologia 2",
    "Miologia 3",
    "Miologia 4",
    "Miologia 5",
    "Miologia 6",
    "Irrigación",
  ];

  it.each(COLISIONES)('"%s" de Miembro Superior NO es la de Miembro Inferior', (titulo) => {
    const superior = { titulo, sitioId: "anatomy-by-chris", modulo: "miembro_superior" };
    const inferior = { titulo, sitioId: "anatomy-by-chris", modulo: "miembro_inferior" };

    expect(identidad.misma(superior, inferior)).toBe(false);
    expect(identidad.clave(superior)).not.toBe(identidad.clave(inferior));
  });

  it("la misma clase del mismo módulo sigue siendo la misma clase", () => {
    // El contrapeso: distinguir de más rompería la cola igual de fuerte, sólo que al revés
    // (un ítem tratado como dos, que se bajaría dos veces).
    const a = { titulo: "Miologia 1", sitioId: "anatomy-by-chris", modulo: "miembro_superior" };
    const b = { titulo: "Miologia 1", sitioId: "anatomy-by-chris", modulo: "miembro_superior" };
    expect(identidad.misma(a, b)).toBe(true);
  });

  it("el módulo es del ORIGEN: cambiar la carpeta de destino no cambia la identidad", () => {
    // La trampa que el diseño evita nombrando el campo `modulo` y no `carpeta`. Si la identidad
    // se calculara sobre el destino, activar el override del input (corte 2) le cambiaría la
    // identidad a los 103 ítems y ninguno matchearía contra la cola.
    const enLista = {
      titulo: "Miologia 1",
      sitioId: "anatomy-by-chris",
      modulo: "miembro_superior",
      carpeta: "miembro_superior",
    };
    const encoladaConOverride = { ...enLista, carpeta: "repaso_final" };

    expect(identidad.misma(enLista, encoladaConOverride)).toBe(true);
  });
});
