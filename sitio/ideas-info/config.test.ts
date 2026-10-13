/**
 * Tests del descriptor de IDEAS (sitio/ideas-info/config.ts).
 */
import { describe, it, expect, vi } from "vitest";
import { SitioIdeasInfo } from "./config.ts";

describe("SitioIdeasInfo", () => {
  it("1. miembros estáticos e invariantes de PuertoSitio", () => {
    expect(SitioIdeasInfo.id).toBe("ideas-info");
    expect(SitioIdeasInfo.nombre).toBe("IDEAS (UNLP)");
    expect(SitioIdeasInfo.color).toBe("#2E7D6B");
    expect(SitioIdeasInfo.urlSondeoInternet).toBe("https://ideas.info.unlp.edu.ar/");
    expect(SitioIdeasInfo.patronPestañas).toBe("https://ideas.info.unlp.edu.ar/*");
    expect(SitioIdeasInfo.urlListado).toBe("https://ideas.info.unlp.edu.ar/home");
    expect(SitioIdeasInfo.credencialesAdjunto).toBe("include");
    expect(SitioIdeasInfo.destinoPorIndice).toBe(true);
    expect(SitioIdeasInfo.topeEscaneoMs).toBe(120000);
    expect(SitioIdeasInfo.instruccionEscaneo).toContain("inicio (/home)");
    expect(SitioIdeasInfo.textoOfertaTodos).toContain("inicio de IDEAS");
  });

  it("2. esPaginaDelSitio reconoce vistas de curso, portada /home y descarta /login, /Search/Course, etc. (AC-1, AC-12)", () => {
    // Portada
    expect(SitioIdeasInfo.esPaginaDelSitio("https://ideas.info.unlp.edu.ar/home")).toBe(true);
    expect(SitioIdeasInfo.esPaginaDelSitio("https://ideas.info.unlp.edu.ar/home/orderCriteria")).toBe(true);

    // Vistas de curso
    expect(
      SitioIdeasInfo.esPaginaDelSitio(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Show?courseTool"
      )
    ).toBe(true);
    expect(
      SitioIdeasInfo.esPaginaDelSitio(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Resources/MediaLibrary/View/Show?courseTool"
      )
    ).toBe(true);
    expect(
      SitioIdeasInfo.esPaginaDelSitio(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Start/Welcome/View/Show/EnterCourse/123"
      )
    ).toBe(true);

    // Descartados: /login, /Search/Course, raíz /
    expect(SitioIdeasInfo.esPaginaDelSitio("https://ideas.info.unlp.edu.ar/login")).toBe(false);
    expect(SitioIdeasInfo.esPaginaDelSitio("https://ideas.info.unlp.edu.ar/Search/Course")).toBe(false);
    expect(SitioIdeasInfo.esPaginaDelSitio("https://ideas.info.unlp.edu.ar/")).toBe(false);

    // Otros sitios
    expect(
      SitioIdeasInfo.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091"
      )
    ).toBe(false);
    expect(SitioIdeasInfo.esPaginaDelSitio(null as unknown as string)).toBe(false);
    expect(SitioIdeasInfo.esPaginaDelSitio(undefined)).toBe(false);
    expect(SitioIdeasInfo.esPaginaDelSitio("")).toBe(false);
  });

  it("2b. esPortada identifica /home y sus subrutas, descarta /login y cursos", () => {
    expect(SitioIdeasInfo.esPortada?.("https://ideas.info.unlp.edu.ar/home")).toBe(true);
    expect(SitioIdeasInfo.esPortada?.("https://ideas.info.unlp.edu.ar/home/orderCriteria")).toBe(true);
    expect(SitioIdeasInfo.esPortada?.("https://ideas.info.unlp.edu.ar/home?foo=bar")).toBe(true);

    expect(SitioIdeasInfo.esPortada?.("https://ideas.info.unlp.edu.ar/login")).toBe(false);
    expect(
      SitioIdeasInfo.esPortada?.(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Show?courseTool"
      )
    ).toBe(false);
    expect(SitioIdeasInfo.esPortada?.(null as unknown as string)).toBe(false);
  });

  it("3. claveDeListado devuelve 'todos' en portada y el slug en páginas de curso (RN-20)", () => {
    expect(SitioIdeasInfo.claveDeListado?.("https://ideas.info.unlp.edu.ar/home")).toBe("todos");
    expect(
      SitioIdeasInfo.claveDeListado?.(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Show?courseTool"
      )
    ).toBe("conceptos-de-bases-de-datos-1");
    expect(
      SitioIdeasInfo.claveDeListado?.(
        "https://ideas.info.unlp.edu.ar/bases-de-datos-avanzadas/Start/Welcome/View/Show"
      )
    ).toBe("bases-de-datos-avanzadas");

    expect(SitioIdeasInfo.claveDeListado?.("https://ideas.info.unlp.edu.ar/login")).toBeUndefined();
    expect(SitioIdeasInfo.claveDeListado?.("https://ideas.info.unlp.edu.ar/Search/Course")).toBeUndefined();
    expect(SitioIdeasInfo.claveDeListado?.(null as unknown as string)).toBeUndefined();
  });

  it("4. resolverManifiesto rechaza con tipoPortal: rechazo", async () => {
    await expect(
      SitioIdeasInfo.resolverManifiesto("https://ejemplo.com/clase")
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("5. resolverAdjunto delega en DescargarAdjuntoIdeasInfo", async () => {
    const resolverMock = vi.fn().mockResolvedValue("https://descarga.com/archivo.pdf");
    (globalThis as Record<string, unknown>).DescargarAdjuntoIdeasInfo = {
      resolver: resolverMock,
    };

    const res = await SitioIdeasInfo.resolverAdjunto?.("c/material/123");
    expect(res).toBe("https://descarga.com/archivo.pdf");
    expect(resolverMock).toHaveBeenCalledWith("c/material/123", undefined, undefined);

    delete (globalThis as Record<string, unknown>).DescargarAdjuntoIdeasInfo;
  });

  it("6. clasificarCarpeta delega en ParserTitulosIdeasInfo", () => {
    (globalThis as Record<string, unknown>).ParserTitulosIdeasInfo = {
      clasificarCarpeta: () => ({ catedra: "COMUN", carpeta: "cbd" }),
    };

    const res = SitioIdeasInfo.clasificarCarpeta("x.pdf", "CBD");
    expect(res).toEqual({ catedra: "COMUN", carpeta: "cbd" });

    delete (globalThis as Record<string, unknown>).ParserTitulosIdeasInfo;
  });

  it("7. sugerenciaFueraDeListado devuelve sugerencia en páginas fuera del sitio y undefined en páginas escaneables u otro host", () => {
    const textoEsperado =
      "Andá a tu inicio (/home) para escanear todos tus cursos, o abrí un curso.";
    expect(SitioIdeasInfo.sugerenciaFueraDeListado?.("https://ideas.info.unlp.edu.ar/")).toBe(
      textoEsperado
    );
    expect(SitioIdeasInfo.sugerenciaFueraDeListado?.("https://ideas.info.unlp.edu.ar/login")).toBe(
      textoEsperado
    );
    expect(
      SitioIdeasInfo.sugerenciaFueraDeListado?.("https://ideas.info.unlp.edu.ar/Search/Course")
    ).toBe(textoEsperado);

    expect(
      SitioIdeasInfo.sugerenciaFueraDeListado?.("https://ideas.info.unlp.edu.ar/home")
    ).toBeUndefined();
    expect(
      SitioIdeasInfo.sugerenciaFueraDeListado?.(
        "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Show?courseTool"
      )
    ).toBeUndefined();
    expect(SitioIdeasInfo.sugerenciaFueraDeListado?.("https://otro-host.com/")).toBeUndefined();
    expect(SitioIdeasInfo.sugerenciaFueraDeListado?.(undefined)).toBeUndefined();
  });
});
