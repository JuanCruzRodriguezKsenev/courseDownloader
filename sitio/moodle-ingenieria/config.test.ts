/**
 * Tests del descriptor de Moodle Ingeniería (sitio/moodle-ingenieria/config.ts).
 */
import { describe, it, expect, vi } from "vitest";
import { SitioMoodleIngenieria } from "./config.ts";

describe("SitioMoodleIngenieria", () => {
  it("1. miembros estáticos e invariantes de PuertoSitio", () => {
    expect(SitioMoodleIngenieria.id).toBe("moodle-ingenieria");
    expect(SitioMoodleIngenieria.nombre).toBe("Moodle Ingeniería (UNLP)");
    expect(SitioMoodleIngenieria.color).toBe("#8B1E3F");
    expect(SitioMoodleIngenieria.urlSondeoInternet).toBe(
      "https://www.asignaturas.ing.unlp.edu.ar/"
    );
    expect(SitioMoodleIngenieria.patronPestañas).toBe(
      "https://*.asignaturas.ing.unlp.edu.ar/*"
    );
    expect(SitioMoodleIngenieria.urlListado).toBe(
      "https://www.asignaturas.ing.unlp.edu.ar/my/"
    );
    expect(SitioMoodleIngenieria.credencialesAdjunto).toBe("include");
    expect(SitioMoodleIngenieria.destinoPorIndice).toBe(true);
    expect(SitioMoodleIngenieria.topeEscaneoMs).toBe(60000);
    expect(SitioMoodleIngenieria.instruccionEscaneo).toContain("course/view.php");
  });

  it("2. esPaginaDelSitio reconoce vistas de curso (con y sin www), portada /my/ y descarta otras URLs", () => {
    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091"
      )
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://asignaturas.ing.unlp.edu.ar/course/view.php?id=4091"
      )
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091#section-2"
      )
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?section=1&id=4091"
      )
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio("https://www.asignaturas.ing.unlp.edu.ar/my/")
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/my/?myoverviewtab=courses"
      )
    ).toBe(true);

    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://www.asignaturas.ing.unlp.edu.ar/calendar/view.php"
      )
    ).toBe(false);

    // Negativos: no son páginas de este sitio
    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://asignaturas.info.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe(false);
    expect(
      SitioMoodleIngenieria.esPaginaDelSitio("https://asignaturas.info.unlp.edu.ar/my/")
    ).toBe(false);
    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://catedras.linti.unlp.edu.ar/course/view.php?id=82"
      )
    ).toBe(false);
    expect(
      SitioMoodleIngenieria.esPaginaDelSitio(
        "https://classroom.google.com/c/OGY4Nzg3MjY4MjVa"
      )
    ).toBe(false);
    expect(SitioMoodleIngenieria.esPaginaDelSitio(null as unknown as string)).toBe(false);
    expect(SitioMoodleIngenieria.esPaginaDelSitio(undefined)).toBe(false);
    expect(SitioMoodleIngenieria.esPaginaDelSitio("")).toBe(false);
  });

  it("2b. esPortada identifica /my/, con query params, pero descarta /my/courses.php y vistas de curso", () => {
    expect(
      SitioMoodleIngenieria.esPortada?.("https://www.asignaturas.ing.unlp.edu.ar/my/")
    ).toBe(true);
    expect(
      SitioMoodleIngenieria.esPortada?.("https://asignaturas.ing.unlp.edu.ar/my/")
    ).toBe(true);
    expect(
      SitioMoodleIngenieria.esPortada?.(
        "https://www.asignaturas.ing.unlp.edu.ar/my/?myoverviewtab=courses"
      )
    ).toBe(true);

    // /my/courses.php no existe en Moodle Ingeniería (devuelve 404) y es descartada
    expect(
      SitioMoodleIngenieria.esPortada?.(
        "https://www.asignaturas.ing.unlp.edu.ar/my/courses.php"
      )
    ).toBe(false);

    expect(
      SitioMoodleIngenieria.esPortada?.(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091"
      )
    ).toBe(false);
    expect(
      SitioMoodleIngenieria.esPortada?.(
        "https://www.asignaturas.ing.unlp.edu.ar/calendar/view.php"
      )
    ).toBe(false);
    expect(SitioMoodleIngenieria.esPortada?.(null as unknown as string)).toBe(false);
  });

  it("3. claveDeListado devuelve el id numérico del curso y 'todos' en portada", () => {
    expect(
      SitioMoodleIngenieria.claveDeListado?.(
        "https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091"
      )
    ).toBe("4091");

    expect(
      SitioMoodleIngenieria.claveDeListado?.(
        "https://asignaturas.ing.unlp.edu.ar/course/view.php?foo=bar&id=4091"
      )
    ).toBe("4091");

    expect(
      SitioMoodleIngenieria.claveDeListado?.("https://www.asignaturas.ing.unlp.edu.ar/my/")
    ).toBe("todos");
    expect(
      SitioMoodleIngenieria.claveDeListado?.(
        "https://www.asignaturas.ing.unlp.edu.ar/my/?myoverviewtab=courses"
      )
    ).toBe("todos");
    expect(
      SitioMoodleIngenieria.claveDeListado?.(
        "https://www.asignaturas.ing.unlp.edu.ar/calendar/view.php"
      )
    ).toBeUndefined();

    expect(SitioMoodleIngenieria.claveDeListado?.(null as unknown as string)).toBeUndefined();
  });

  it("4. resolverManifiesto rechaza con tipoPortal: rechazo", async () => {
    await expect(
      SitioMoodleIngenieria.resolverManifiesto("https://ejemplo.com/clase")
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("5. resolverAdjunto delega en DescargarAdjuntoMoodleIngenieria", async () => {
    const resolverMock = vi.fn().mockResolvedValue("https://descarga.com/archivo.pdf");
    (globalThis as Record<string, unknown>).DescargarAdjuntoMoodleIngenieria = {
      resolver: resolverMock,
    };

    const res = await SitioMoodleIngenieria.resolverAdjunto?.("4002");
    expect(res).toBe("https://descarga.com/archivo.pdf");
    expect(resolverMock).toHaveBeenCalledWith("4002", undefined, undefined);

    delete (globalThis as Record<string, unknown>).DescargarAdjuntoMoodleIngenieria;
  });

  it("6. clasificarCarpeta delega en ParserTitulosMoodleIngenieria", () => {
    (globalThis as Record<string, unknown>).ParserTitulosMoodleIngenieria = {
      clasificarCarpeta: () => ({ catedra: "COMUN", carpeta: "mate_b3" }),
    };

    const res = SitioMoodleIngenieria.clasificarCarpeta("x.pdf", "Mate B3");
    expect(res).toEqual({ catedra: "COMUN", carpeta: "mate_b3" });

    delete (globalThis as Record<string, unknown>).ParserTitulosMoodleIngenieria;
  });
});
