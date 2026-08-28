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
    expect(Sitios.resolverPorUrl("https://ramonnet.com.ar/usuario/clases-grabadas")).toBe(
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
      "https://ramonnet.com.ar/usuario/clases-grabadas",
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

/**
 * [LOADERS — ítem 1] El tope del escaneo.
 *
 * `tsc` ya obliga a que el miembro EXISTA (es requerido). Lo que no puede ver es que el
 * número sirva, y ése fue exactamente el defecto: el tope existía —6000, hardcodeado en
 * `popup.js`— y era **más chico que el escaneo normal** del segundo portal, así que el
 * watchdog saltaba en cada corrida y mostraba un error que después se borraba solo.
 *
 * Por eso estos tests miran el VALOR contra las mediciones reales, y no que el campo esté.
 */
describe("topeEscaneoMs: el techo del escaneo es una medición, no un default", () => {
  it("todos los portales registrados declaran un tope usable", () => {
    for (const s of Sitios.todos()) {
      expect(typeof s.topeEscaneoMs, `${s.id} no declara topeEscaneoMs numérico`).toBe("number");
      expect(Number.isFinite(s.topeEscaneoMs)).toBe(true);
      expect(s.topeEscaneoMs, `${s.id} tiene un tope no positivo`).toBeGreaterThan(0);
    }
  });

  it("ningún tope queda por debajo de 5 s: era el defecto original", () => {
    // Un portal que salga a la red no puede tener un techo de milisegundos. El piso es
    // arbitrario a propósito — lo que NO es arbitrario es que exista un piso, porque el bug
    // fue justamente un tope creíble (6 s) que quedó corto cuando el portal cambió de
    // mecanismo de escaneo sin que nadie re-mirara el número.
    for (const s of Sitios.todos()) {
      expect(s.topeEscaneoMs, `${s.id} tiene un tope sospechosamente corto`).toBeGreaterThanOrEqual(5000);
    }
  });

  it("Anatomy le deja margen real a sus ~11 s medidos", () => {
    // /v1/navigation ~4,0 s + el pool de 114 materiales 7,1 s → ~11,1 s
    // (docs/escaneo-api-anatomy-diseno.md). El tope tiene que estar por ENCIMA con holgura:
    // si alguien lo baja a "11 s porque eso mide", vuelve el error falso en la primera
    // conexión lenta.
    expect(SitioAnatomyByChris.topeEscaneoMs).toBeGreaterThan(15000);
  });

  it("Ramón Net escanea el DOM y conserva su tope corto", () => {
    // No sale a la red: 6 s le sobran. Este test fija que el corte NO le cambió el
    // comportamiento al portal que nunca tuvo el problema.
    expect(SitioRamonNet.topeEscaneoMs).toBe(6000);
  });

  it("el tope de Anatomy es mayor que el de Ramón Net, no al revés", () => {
    // Suena obvio y es la aserción que atrapa un copy-paste entre configs, que es como se
    // escribe un portal nuevo en este proyecto (§Cómo escribir un portal nuevo).
    expect(SitioAnatomyByChris.topeEscaneoMs).toBeGreaterThan(SitioRamonNet.topeEscaneoMs);
  });
});
