/**
 * Tests del resolver de adjuntos de IDEAS (sitio/ideas-info/descargarAdjunto.js).
 * Verifica resolución de URLs de Material y Medioteca, validación de idArchivo,
 * detección de sesión (/login) y clasificación de errores 404/410 como rechazo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DescargarAdjuntoIdeasInfo from "./descargarAdjunto.js";

describe("DescargarAdjuntoIdeasInfo.resolver", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("1. idArchivo vacío arroja error con tipoPortal: rechazo", async () => {
    await expect(DescargarAdjuntoIdeasInfo.resolver("")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("2. idArchivo con formato inválido arroja error con tipoPortal: rechazo", async () => {
    await expect(DescargarAdjuntoIdeasInfo.resolver("formato/invalido")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
    await expect(
      DescargarAdjuntoIdeasInfo.resolver("curso/otro/595453dd-1ecf-11f1-90f7-3292d73aa1e7")
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("3. URL de Material resuelve a Access/<guid> y pasa credentials: include", async () => {
    const cancelSpy = vi.fn();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/595453dd-1ecf-11f1-90f7-3292d73aa1e7",
      body: { cancel: cancelSpy },
    }));

    const id = "conceptos-de-bases-de-datos-1/material/595453dd-1ecf-11f1-90f7-3292d73aa1e7";
    const res = await DescargarAdjuntoIdeasInfo.resolver(id);

    expect(res).toBe(
      "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/595453dd-1ecf-11f1-90f7-3292d73aa1e7"
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/595453dd-1ecf-11f1-90f7-3292d73aa1e7",
      expect.objectContaining({ credentials: "include" })
    );
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("4. URL de Medioteca resuelve a AccessResource/<guid> y cancela el cuerpo", async () => {
    const cancelSpy = vi.fn();
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Resources/MediaLibrary/View/AccessResource/595453dd-1ecf-11f1-90f7-3292d73aa1e8",
      body: { cancel: cancelSpy },
    }));

    const id = "conceptos-de-bases-de-datos-1/medioteca/595453dd-1ecf-11f1-90f7-3292d73aa1e8";
    const res = await DescargarAdjuntoIdeasInfo.resolver(id);

    expect(res).toBe(
      "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Resources/MediaLibrary/View/AccessResource/595453dd-1ecf-11f1-90f7-3292d73aa1e8"
    );
    expect(cancelSpy).toHaveBeenCalled();
  });

  it("5. AC-8: redirección a /login lanza error con tipoConexion: sesion", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://ideas.info.unlp.edu.ar/login",
      body: { cancel: vi.fn() },
    }));

    const id = "conceptos-de-bases-de-datos-1/material/595453dd-1ecf-11f1-90f7-3292d73aa1e7";
    await expect(DescargarAdjuntoIdeasInfo.resolver(id)).rejects.toMatchObject({
      tipoConexion: "sesion",
    });
  });

  it("6. error HTTP 404 arroja error con tipoPortal: rechazo (RN-12)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      url: "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/595453dd-1ecf-11f1-90f7-3292d73aa1e7",
      body: { cancel: vi.fn() },
    }));

    const id = "conceptos-de-bases-de-datos-1/material/595453dd-1ecf-11f1-90f7-3292d73aa1e7";
    await expect(DescargarAdjuntoIdeasInfo.resolver(id)).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("7. error HTTP 410 arroja error con tipoPortal: rechazo (RN-12)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 410,
      url: "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/595453dd-1ecf-11f1-90f7-3292d73aa1e7",
      body: { cancel: vi.fn() },
    }));

    const id = "conceptos-de-bases-de-datos-1/material/595453dd-1ecf-11f1-90f7-3292d73aa1e7";
    await expect(DescargarAdjuntoIdeasInfo.resolver(id)).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("8. un idArchivo con el GUID en mayúsculas se acepta y arma la URL con ese mismo GUID (RN-5)", async () => {
    const guidMayus = "595453DD-1ECF-11F1-90F7-3292D73AA1E7";
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: `https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/${guidMayus}`,
      body: { cancel: vi.fn() },
    }));

    const id = `conceptos-de-bases-de-datos-1/material/${guidMayus}`;
    const res = await DescargarAdjuntoIdeasInfo.resolver(id);

    expect(res).toBe(
      `https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/${guidMayus}`
    );
    expect(globalThis.fetch).toHaveBeenCalledWith(
      `https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Access/${guidMayus}`,
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("9. Curso_X/material/<guid> y ../x/material/<guid> se rechazan con tipoPortal: rechazo (RN-5)", async () => {
    const guid = "595453dd-1ecf-11f1-90f7-3292d73aa1e7";
    await expect(DescargarAdjuntoIdeasInfo.resolver(`Curso_X/material/${guid}`)).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
    await expect(DescargarAdjuntoIdeasInfo.resolver(`../x/material/${guid}`)).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });
});
