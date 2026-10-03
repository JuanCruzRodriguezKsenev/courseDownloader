/**
 * Tests de configuración de Moodle del LINTI (Capa 2).
 */
import { describe, it, expect } from "vitest";
import { SitioMoodleLinti } from "./config";

describe("SitioMoodleLinti descriptor", () => {
  it("cumple con las propiedades de identidad y configuración", () => {
    expect(SitioMoodleLinti.id).toBe("moodle-linti");
    expect(SitioMoodleLinti.credencialesAdjunto).toBe("include");
    expect(SitioMoodleLinti.destinoPorIndice).toBe(true);
    expect(SitioMoodleLinti.urlSondeoInternet).toBe("https://catedras.linti.unlp.edu.ar/favicon.ico");
    expect(SitioMoodleLinti.patronPestañas).toBe("https://catedras.linti.unlp.edu.ar/*");
    expect(SitioMoodleLinti.urlListado).toBe("https://catedras.linti.unlp.edu.ar/my/");
  });

  it("esPaginaDelSitio valida únicamente cursos con id numérico", () => {
    expect(
      SitioMoodleLinti.esPaginaDelSitio("https://catedras.linti.unlp.edu.ar/course/view.php?id=1352")
    ).toBe(true);
    expect(
      SitioMoodleLinti.esPaginaDelSitio("https://catedras.linti.unlp.edu.ar/course/view.php?id=abc")
    ).toBe(false);
    expect(SitioMoodleLinti.esPaginaDelSitio("https://catedras.linti.unlp.edu.ar/my/")).toBe(false);
    expect(
      SitioMoodleLinti.esPaginaDelSitio("https://classroom.google.com/u/0/c/OTg3NjU0MzIx")
    ).toBe(false);
    expect(SitioMoodleLinti.esPaginaDelSitio(null as unknown as string)).toBe(false);
  });

  it("claveDeListado extrae el id del curso de la URL", () => {
    expect(
      SitioMoodleLinti.claveDeListado?.("https://catedras.linti.unlp.edu.ar/course/view.php?id=1352")
    ).toBe("1352");
    expect(
      SitioMoodleLinti.claveDeListado?.("https://catedras.linti.unlp.edu.ar/course/view.php?id=456&foo=bar")
    ).toBe("456");
    expect(SitioMoodleLinti.claveDeListado?.("https://catedras.linti.unlp.edu.ar/my/")).toBeUndefined();
    expect(SitioMoodleLinti.claveDeListado?.(null as unknown as string)).toBeUndefined();
  });

  it("resolverManifiesto rechaza con error de no tener videos HLS", async () => {
    await expect(SitioMoodleLinti.resolverManifiesto("https://cualquiera")).rejects.toMatchObject({
      tipoPortal: "rechazo",
      message: expect.stringContaining("este portal no tiene videos HLS"),
    });
  });
});
