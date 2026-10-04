/**
 * Tests de resolución de adjuntos de Moodle del LINTI (Capa 2).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import DescargarAdjuntoMoodleLinti from "./descargarAdjunto.js";
import { accesoADataUri } from "../../core/destino/accesoMd.ts";

describe("DescargarAdjuntoMoodleLinti.resolver", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resource feliz devuelve URL de redirección directa", async () => {
    const urlDescarga =
      "https://catedras.linti.unlp.edu.ar/pluginfile.php/14077/mod_resource/content/1/intro.pdf";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: urlDescarga,
        body: { cancel: vi.fn().mockResolvedValue() },
      })
    );

    const res = await DescargarAdjuntoMoodleLinti.resolver("46390");
    expect(res).toBe(urlDescarga);
  });

  it("resource con sesión vencida (r.url = /login/index.php) → tipoConexion: 'sesion' y no es tipoPortal: 'rechazo' (AC-6)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://catedras.linti.unlp.edu.ar/login/index.php",
        body: { cancel: vi.fn().mockResolvedValue() },
      })
    );

    let errorCapturado = null;
    try {
      await DescargarAdjuntoMoodleLinti.resolver("46390");
    } catch (e) {
      errorCapturado = e;
    }

    expect(errorCapturado).not.toBeNull();
    expect(errorCapturado.tipoConexion).toBe("sesion");
    expect(errorCapturado.tipoPortal).toBeUndefined();
  });

  it("folder feliz con ruta con espacios y tildes", async () => {
    const htmlFolder = `
      <div>
        <a href="https://catedras.linti.unlp.edu.ar/pluginfile.php/51880/mod_folder/content/0/Tema%201/%C3%81rboles%20y%20Grafos.pdf?forcedownload=1">Árboles</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://catedras.linti.unlp.edu.ar/mod/folder/view.php?id=45872",
        text: async () => htmlFolder,
      })
    );

    const res = await DescargarAdjuntoMoodleLinti.resolver("45872/Tema 1/Árboles y Grafos.pdf");
    expect(res).toBe(
      "https://catedras.linti.unlp.edu.ar/pluginfile.php/51880/mod_folder/content/0/Tema%201/%C3%81rboles%20y%20Grafos.pdf?forcedownload=1"
    );
  });

  it("folder sin coincidencia → rechazo", async () => {
    const htmlFolder = `
      <div>
        <a href="https://catedras.linti.unlp.edu.ar/pluginfile.php/51880/mod_folder/content/0/otro_archivo.pdf">Otro</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        url: "https://catedras.linti.unlp.edu.ar/mod/folder/view.php?id=45872",
        text: async () => htmlFolder,
      })
    );

    await expect(
      DescargarAdjuntoMoodleLinti.resolver("45872/archivo_inexistente.pdf")
    ).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("acceso → igualdad byte a byte con accesoADataUri (AC-3)", async () => {
    const urlOriginal = "https://t.me/isocso";
    const tituloOriginal = "Canal de Telegram";
    const idAcceso = `acceso:${encodeURIComponent(urlOriginal)}:${encodeURIComponent(tituloOriginal)}`;

    const res = await DescargarAdjuntoMoodleLinti.resolver(idAcceso);

    // Calcular hoy local
    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(
      ahora.getDate()
    ).padStart(2, "0")}`;
    const esperado = accesoADataUri(idAcceso, hoy);

    expect(res).toBe(esperado);
  });

  it("404 → httpStatus: 404, tipoPortal: 'rechazo' (AC-11)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        url: "https://catedras.linti.unlp.edu.ar/mod/resource/view.php?id=99999",
      })
    );

    await expect(DescargarAdjuntoMoodleLinti.resolver("99999")).rejects.toMatchObject({
      httpStatus: 404,
      tipoPortal: "rechazo",
    });
  });
});
