/**
 * Tests de resolución de adjuntos de Google Classroom (Capa 2).
 */
import { describe, it, expect, vi } from "vitest";
import DescargarAdjuntoClassroom from "./descargarAdjunto.js";

describe("DescargarAdjuntoClassroom.resolver", () => {
  it("la URL de Drive lleva authuser", async () => {
    const url = await DescargarAdjuntoClassroom.resolver("drive-id-123", undefined, { authuser: "2" });
    expect(url).toBe(
      "https://drive.usercontent.google.com/download?id=drive-id-123&export=download&confirm=t&authuser=2"
    );
  });

  it("sin authuser da error con tipoConexion: 'sesion'", async () => {
    await expect(
      DescargarAdjuntoClassroom.resolver("drive-id-123", undefined, {})
    ).rejects.toMatchObject({
      tipoConexion: "sesion",
    });
    await expect(
      DescargarAdjuntoClassroom.resolver("drive-id-123", undefined, undefined)
    ).rejects.toMatchObject({
      tipoConexion: "sesion",
    });
  });

  it("un acceso da un data: que, decodificado, tiene frontmatter, conserva '# título\\n\\nurl', tildes incluidas", async () => {
    const urlOriginal = "https://ejemplo.com/teoría?sección=1";
    const tituloOriginal = "Teoría de Óptica — Año 2026";
    const idAcceso = `acceso:${encodeURIComponent(urlOriginal)}:${encodeURIComponent(tituloOriginal)}`;

    const dataUri = await DescargarAdjuntoClassroom.resolver(idAcceso, undefined, { authuser: "2" });
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
      const dataUri = await DescargarAdjuntoClassroom.resolver(idAcceso, undefined, { authuser: "2" });
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
    await expect(
      DescargarAdjuntoClassroom.resolver("", undefined, { authuser: "2" })
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });
});
