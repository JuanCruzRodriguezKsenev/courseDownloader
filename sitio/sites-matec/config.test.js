/**
 * Tests de configuración de SitioSitesMatec (Capa 2).
 */
import { describe, it, expect } from "vitest";
import "./descargarAdjunto.js";
import "./scraper.js";
import "./parserTitulos.js";
import SitioSitesMatec from "./config.ts";

describe("SitioSitesMatec", () => {
  it("cumple el descriptor de PuertoSitio", () => {
    expect(SitioSitesMatec.id).toBe("sites-matec");
    expect(SitioSitesMatec.nombre).toBe("Google Sites Mate C");
    expect(SitioSitesMatec.color).toBe("#1a73e8");
    expect(SitioSitesMatec.urlSondeoInternet).toBe("https://sites.google.com/favicon.ico");
    expect(SitioSitesMatec.patronPestañas).toBe("https://sites.google.com/ing.unlp.edu.ar/matec*");
    expect(SitioSitesMatec.urlListado).toBe("https://sites.google.com/ing.unlp.edu.ar/matec");
    expect(SitioSitesMatec.topeEscaneoMs).toBe(10000);
    expect(SitioSitesMatec.credencialesAdjunto).toBe("include");
    expect(SitioSitesMatec.destinoPorIndice).toBe(true);
  });

  it("patronPestañas y los patrones del manifiesto cubren las URLs de Matemática C y rechazan otras", () => {
    const matchPatternARegex = (patron) => {
      const escapado = patron.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escapado}$`);
    };

    const regexPestañas = matchPatternARegex(SitioSitesMatec.patronPestañas);
    const patronesManifiesto = [
      "https://sites.google.com/ing.unlp.edu.ar/matec",
      "https://sites.google.com/ing.unlp.edu.ar/matec/*",
    ];
    const regexManifiesto = patronesManifiesto.map(matchPatternARegex);
    const matcheaManifiesto = (url) => regexManifiesto.some((r) => r.test(url));

    const urlsValidas = [
      "https://sites.google.com/ing.unlp.edu.ar/matec",
      "https://sites.google.com/ing.unlp.edu.ar/matec/",
      "https://sites.google.com/ing.unlp.edu.ar/matec/inicio/series",
    ];

    const urlsInvalidas = [
      "https://sites.google.com/otra/cosa",
      "https://sites.google.com/ing.unlp.edu.ar/otrosite",
    ];

    for (const url of urlsValidas) {
      expect(regexPestañas.test(url), `patronPestañas debería matchear ${url}`).toBe(true);
      expect(matcheaManifiesto(url), `patrones del manifiesto deberían matchear ${url}`).toBe(true);
    }

    for (const url of urlsInvalidas) {
      expect(regexPestañas.test(url), `patronPestañas no debería matchear ${url}`).toBe(false);
      expect(matcheaManifiesto(url), `patrones del manifiesto no deberían matchear ${url}`).toBe(false);
    }
  });

  it("esPaginaDelSitio reconoce rutas de Matemática C y rechaza otras", () => {
    expect(SitioSitesMatec.esPaginaDelSitio("https://sites.google.com/ing.unlp.edu.ar/matec")).toBe(true);
    expect(SitioSitesMatec.esPaginaDelSitio("https://sites.google.com/ing.unlp.edu.ar/matec/inicio")).toBe(true);
    expect(SitioSitesMatec.esPaginaDelSitio("https://sites.google.com/ing.unlp.edu.ar/matec/inicio/series")).toBe(true);

    expect(SitioSitesMatec.esPaginaDelSitio("https://sites.google.com/ing.unlp.edu.ar/otra-materia")).toBe(false);
    expect(SitioSitesMatec.esPaginaDelSitio("https://classroom.google.com/c/123")).toBe(false);
    expect(SitioSitesMatec.esPaginaDelSitio(undefined)).toBe(false);
  });

  it("claveDeListado devuelve 'matec' para páginas del sitio y undefined para otras", () => {
    expect(SitioSitesMatec.claveDeListado?.("https://sites.google.com/ing.unlp.edu.ar/matec")).toBe("matec");
    expect(SitioSitesMatec.claveDeListado?.("https://sites.google.com/ing.unlp.edu.ar/matec/inicio/series")).toBe("matec");
    expect(SitioSitesMatec.claveDeListado?.("https://otra-url.com")).toBe(undefined);
    expect(SitioSitesMatec.claveDeListado?.(undefined)).toBe(undefined);
  });

  it("resolverManifiesto rechaza indicando ausencia de HLS", async () => {
    await expect(SitioSitesMatec.resolverManifiesto("https://cualquiera.com")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("resolverAdjunto delega en DescargarAdjuntoSitesMatec", async () => {
    const res = await SitioSitesMatec.resolverAdjunto?.("drive:123");
    expect(res).toBe("https://drive.usercontent.google.com/download?id=123&export=download&confirm=t");
  });

  it("clasificarCarpeta delega en ParserTitulosSitesMatec", () => {
    const res = SitioSitesMatec.clasificarCarpeta("Ejercicios", "Matemática C › Series");
    expect(res).toEqual({
      catedra: "COMUN",
      carpeta: "matematica_c",
    });
  });

  it("faceta es inerte", () => {
    expect(SitioSitesMatec.faceta.id).toBe("ninguna");
    expect(SitioSitesMatec.faceta.leer({})).toBe("COMUN");
    expect(SitioSitesMatec.faceta.leerDeCola({})).toBe("COMUN");
    expect(SitioSitesMatec.faceta.etiquetar("COMUN")).toBe("Todas las clases");
    expect(SitioSitesMatec.faceta.etiquetarCorto("COMUN")).toBe("Todas");
    expect(SitioSitesMatec.faceta.ordenar("a", "b")).toBe(0);
  });
});
