/**
 * Tests del descriptor de Moodle Asignaturas (sitio/moodle-asignaturas/config.ts).
 */
import { describe, it, expect, vi } from "vitest";
import { SitioMoodleAsignaturas } from "./config.ts";

describe("SitioMoodleAsignaturas", () => {
  it("1. miembros estáticos e invariantes de PuertoSitio", () => {
    expect(SitioMoodleAsignaturas.id).toBe("moodle-asignaturas");
    expect(SitioMoodleAsignaturas.nombre).toBe("Moodle Asignaturas (UNLP)");
    expect(SitioMoodleAsignaturas.urlSondeoInternet).toBe("https://asignaturas.info.unlp.edu.ar/");
    expect(SitioMoodleAsignaturas.patronPestañas).toBe("https://asignaturas.info.unlp.edu.ar/*");
    expect(SitioMoodleAsignaturas.urlListado).toBe("https://asignaturas.info.unlp.edu.ar/my/");
    expect(SitioMoodleAsignaturas.credencialesAdjunto).toBe("include");
    expect(SitioMoodleAsignaturas.destinoPorIndice).toBe(true);
    expect(SitioMoodleAsignaturas.topeEscaneoMs).toBe(60000);
    expect(SitioMoodleAsignaturas.instruccionEscaneo).toContain("course/view.php");
  });

  it("2. esPaginaDelSitio reconoce vistas de curso, portada /my/ y descarta otras URLs", () => {
    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe(true);

    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?id=82#section-2"
      )
    ).toBe(true);

    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?section=1&id=82"
      )
    ).toBe(true);

    expect(SitioMoodleAsignaturas.esPaginaDelSitio("https://asignaturas.info.unlp.edu.ar/my/")).toBe(
      true
    );
    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio("https://asignaturas.info.unlp.edu.ar/my/courses.php")
    ).toBe(true);
    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio("https://asignaturas.info.unlp.edu.ar/calendar/view.php")
    ).toBe(false);

    // No son páginas de este sitio
    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio(
        "https://catedras.linti.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe(false);
    expect(
      SitioMoodleAsignaturas.esPaginaDelSitio(
        "https://classroom.google.com/c/OGY4Nzg3MjY4MjVa"
      )
    ).toBe(false);
    expect(SitioMoodleAsignaturas.esPaginaDelSitio(null as unknown as string)).toBe(false);
    expect(SitioMoodleAsignaturas.esPaginaDelSitio(undefined)).toBe(false);
    expect(SitioMoodleAsignaturas.esPaginaDelSitio("")).toBe(false);
  });

  it("2b. esPortada identifica /my/, /my/courses.php y con query params, pero no un curso", () => {
    expect(SitioMoodleAsignaturas.esPortada?.("https://asignaturas.info.unlp.edu.ar/my/")).toBe(true);
    expect(
      SitioMoodleAsignaturas.esPortada?.("https://asignaturas.info.unlp.edu.ar/my/courses.php")
    ).toBe(true);
    expect(
      SitioMoodleAsignaturas.esPortada?.("https://asignaturas.info.unlp.edu.ar/my/courses.php?x=1")
    ).toBe(true);
    expect(
      SitioMoodleAsignaturas.esPortada?.(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe(false);
    expect(
      SitioMoodleAsignaturas.esPortada?.("https://asignaturas.info.unlp.edu.ar/calendar/view.php")
    ).toBe(false);
    expect(SitioMoodleAsignaturas.esPortada?.(null as unknown as string)).toBe(false);
  });

  it("3. claveDeListado devuelve el id numérico del curso y 'todos' en portada", () => {
    expect(
      SitioMoodleAsignaturas.claveDeListado?.(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe("82");

    expect(
      SitioMoodleAsignaturas.claveDeListado?.(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?foo=bar&id=1054"
      )
    ).toBe("1054");

    expect(
      SitioMoodleAsignaturas.claveDeListado?.("https://asignaturas.info.unlp.edu.ar/my/")
    ).toBe("todos");
    expect(
      SitioMoodleAsignaturas.claveDeListado?.("https://asignaturas.info.unlp.edu.ar/my/courses.php")
    ).toBe("todos");
    expect(
      SitioMoodleAsignaturas.claveDeListado?.(
        "https://asignaturas.info.unlp.edu.ar/my/courses.php?x=1"
      )
    ).toBe("todos");
    expect(
      SitioMoodleAsignaturas.claveDeListado?.("https://asignaturas.info.unlp.edu.ar/calendar/view.php")
    ).toBeUndefined();

    expect(SitioMoodleAsignaturas.claveDeListado?.(null as unknown as string)).toBeUndefined();
  });

  it("4. resolverManifiesto rechaza con tipoPortal: rechazo", async () => {
    await expect(
      SitioMoodleAsignaturas.resolverManifiesto("https://ejemplo.com/clase")
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("5. resolverAdjunto delega en DescargarAdjuntoMoodleAsignaturas", async () => {
    const resolverMock = vi.fn().mockResolvedValue("https://descarga.com/archivo.pdf");
    (globalThis as Record<string, unknown>).DescargarAdjuntoMoodleAsignaturas = {
      resolver: resolverMock,
    };

    const res = await SitioMoodleAsignaturas.resolverAdjunto?.("4697");
    expect(res).toBe("https://descarga.com/archivo.pdf");
    expect(resolverMock).toHaveBeenCalledWith("4697", undefined, undefined);

    delete (globalThis as Record<string, unknown>).DescargarAdjuntoMoodleAsignaturas;
  });

  it("6. clasificarCarpeta delega en ParserTitulosMoodleAsignaturas", () => {
    (globalThis as Record<string, unknown>).ParserTitulosMoodleAsignaturas = {
      clasificarCarpeta: () => ({ catedra: "COMUN", carpeta: "prog2" }),
    };

    const res = SitioMoodleAsignaturas.clasificarCarpeta("x.pdf", "Prog2");
    expect(res).toEqual({ catedra: "COMUN", carpeta: "prog2" });

    delete (globalThis as Record<string, unknown>).ParserTitulosMoodleAsignaturas;
  });
});
