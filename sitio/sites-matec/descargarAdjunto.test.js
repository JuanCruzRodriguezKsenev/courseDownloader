/**
 * Tests de resolución de adjuntos de Google Sites Matemática C (Capa 2).
 */
import { describe, it, expect, vi } from "vitest";
import DescargarAdjuntoSitesMatec from "./descargarAdjunto.js";
describe("DescargarAdjuntoSitesMatec.resolver", () => {
  it("un archivo drive: devuelve la URL de drive.usercontent.google.com con confirm=t y sin authuser", async () => {
    const url = await DescargarAdjuntoSitesMatec.resolver("drive:1CGTCOnu1xcKRX_Ez8tQY4GWFHxHa_WPo");
    expect(url).toBe(
      "https://drive.usercontent.google.com/download?id=1CGTCOnu1xcKRX_Ez8tQY4GWFHxHa_WPo&export=download&confirm=t"
    );
    const parsed = new URL(url);
    expect(parsed.hostname).toBe("drive.usercontent.google.com");
    expect(parsed.searchParams.get("id")).toBe("1CGTCOnu1xcKRX_Ez8tQY4GWFHxHa_WPo");
    expect(parsed.searchParams.get("export")).toBe("download");
    expect(parsed.searchParams.get("confirm")).toBe("t");
    expect(parsed.searchParams.has("authuser")).toBe(false);
  });

  it("un archivo drive: con credenciales.authuser incluye authuser", async () => {
    const url = await DescargarAdjuntoSitesMatec.resolver(
      "drive:1CGTCOnu1xcKRX_Ez8tQY4GWFHxHa_WPo",
      undefined,
      { authuser: "1" }
    );
    expect(url).toBe(
      "https://drive.usercontent.google.com/download?id=1CGTCOnu1xcKRX_Ez8tQY4GWFHxHa_WPo&export=download&confirm=t&authuser=1"
    );
    const parsed = new URL(url);
    expect(parsed.searchParams.get("authuser")).toBe("1");
  });

  it("un archivo drive: codifica el fileId", async () => {
    const url = await DescargarAdjuntoSitesMatec.resolver("drive:archivo con espacios/raro");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("id")).toBe("archivo con espacios/raro");
    expect(url).toContain("id=archivo+con+espacios%2Fraro");
  });

  it("un acceso da un data: que decodificado tiene frontmatter, conserva '# título\\n\\nurl'", async () => {
    const urlOriginal = "https://www.youtube.com/watch?v=meW-bo5A3vo";
    const tituloOriginal = "Serie de potencias y series de taylor";
    const idAcceso = `acceso:${encodeURIComponent(urlOriginal)}:${encodeURIComponent(tituloOriginal)}`;

    const dataUri = await DescargarAdjuntoSitesMatec.resolver(idAcceso);
    expect(dataUri.startsWith("data:text/markdown;charset=utf-8;base64,")).toBe(true);

    const b64 = dataUri.split(",")[1];
    const textoDecodificado = Buffer.from(b64, "base64").toString("utf-8");
    expect(textoDecodificado).toMatch(/^---\ntipo: acceso\nrevisado: \d{4}-\d{2}-\d{2}\n---\n\n/);
    expect(textoDecodificado).toContain(`# ${tituloOriginal}\n\n${urlOriginal}`);
  });

  it("la fecha en frontmatter es la del día local a las 23:30 (no salta a UTC)", async () => {
    vi.useFakeTimers();
    try {
      const fechaLocal = new Date(2026, 9, 15, 23, 30, 0);
      vi.setSystemTime(fechaLocal);

      const idAcceso = `acceso:${encodeURIComponent("https://ejemplo.com")}:${encodeURIComponent("Clase")}`;
      const dataUri = await DescargarAdjuntoSitesMatec.resolver(idAcceso);
      const b64 = dataUri.split(",")[1];
      const textoDecodificado = Buffer.from(b64, "base64").toString("utf-8");

      expect(textoDecodificado).toBe(
        "---\ntipo: acceso\nrevisado: 2026-10-15\n---\n\n# Clase\n\nhttps://ejemplo.com"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("idArchivo vacío da rechazo", async () => {
    await expect(DescargarAdjuntoSitesMatec.resolver("")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("idArchivo drive: sin fileId da rechazo", async () => {
    await expect(DescargarAdjuntoSitesMatec.resolver("drive:")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("idArchivo con prefijo no soportado da rechazo", async () => {
    await expect(DescargarAdjuntoSitesMatec.resolver("desconocido:123")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });
});
