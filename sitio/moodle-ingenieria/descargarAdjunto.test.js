/**
 * Tests del resolver de adjuntos de Moodle Ingeniería (sitio/moodle-ingenieria/descargarAdjunto.js).
 * Verifica resolución de recursos con redirect directo, incrustados HTML, archivos de carpetas,
 * accesos directos Markdown y clasificación de errores (sesión, rechazo por 404).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DescargarAdjuntoMoodleIngenieria from "./descargarAdjunto.js";
import carpetaHtml from "./__fixtures__/carpeta.html?raw";
import loginHtml from "./__fixtures__/login.html?raw";

describe("DescargarAdjuntoMoodleIngenieria.resolver", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("1. idArchivo vacío arroja error con tipoPortal: rechazo", async () => {
    await expect(DescargarAdjuntoMoodleIngenieria.resolver("")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("2. acceso: convierte a data: URI de Markdown sin llamar a red (RN-6)", async () => {
    globalThis.fetch = vi.fn();
    const urlDestino = "https://youtu.be/ejemplo-vectores-123";
    const titulo = "Clase Grabada - Vectores";
    const idArchivo = `acceso:${encodeURIComponent(urlDestino)}:${encodeURIComponent(titulo)}`;

    const dataUri = await DescargarAdjuntoMoodleIngenieria.resolver(idArchivo);

    expect(dataUri.startsWith("data:text/markdown;charset=utf-8;base64,")).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const base64 = dataUri.split(",")[1];
    const decoded = atob(base64);
    expect(decoded).toContain("tipo: acceso");
    expect(decoded).toContain("# Clase Grabada - Vectores");
    expect(decoded).toContain(urlDestino);
  });

  it("3. AC-1: recurso con redirección 302 a pluginfile.php devuelve la URL final", async () => {
    const pluginfileUrl =
      "https://www.asignaturas.ing.unlp.edu.ar/pluginfile.php/293695/mod_resource/content/1/Repaso%20de%20Mate%20A.pdf";

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: pluginfileUrl,
      text: async () => "",
    }));

    const resultado = await DescargarAdjuntoMoodleIngenieria.resolver("4002");
    expect(resultado).toBe(pluginfileUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=4002",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("4. recurso incrustado en HTML extrae la URL de pluginfile mediante regex", async () => {
    const htmlIncrustado = `
      <html>
        <body>
          <div class="resourcecontent">
            <object data="https://www.asignaturas.ing.unlp.edu.ar/pluginfile.php/293695/mod_resource/content/1/Repaso%20de%20Mate%20A.pdf" type="application/pdf"></object>
          </div>
        </body>
      </html>
    `;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=4002",
      text: async () => htmlIncrustado,
    }));

    const resultado = await DescargarAdjuntoMoodleIngenieria.resolver("4002");
    expect(resultado).toBe(
      "https://www.asignaturas.ing.unlp.edu.ar/pluginfile.php/293695/mod_resource/content/1/Repaso%20de%20Mate%20A.pdf"
    );
  });

  it("5. AC-2: archivo de carpeta resuelve enlace interno sin perder ruta y con forcedownload=1", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://www.asignaturas.ing.unlp.edu.ar/mod/folder/view.php?id=384155",
      text: async () => carpetaHtml,
    }));

    const resultado = await DescargarAdjuntoMoodleIngenieria.resolver(
      "384155/Pautas para elaborar el informe de laboratorio.pdf"
    );
    expect(resultado).toBe(
      "https://www.asignaturas.ing.unlp.edu.ar/pluginfile.php/384155/mod_folder/content/0/Pautas%20para%20elaborar%20el%20informe%20de%20laboratorio.pdf?forcedownload=1"
    );
  });

  it("6. AC-11: redirección a /login/ o página de login lanza error con tipoConexion: sesion", async () => {
    // Redirección por URL
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://www.asignaturas.ing.unlp.edu.ar/login/index.php",
      text: async () => loginHtml,
    }));

    await expect(DescargarAdjuntoMoodleIngenieria.resolver("4002")).rejects.toMatchObject({
      tipoConexion: "sesion",
    });

    // Sin redirección pero contenido de login
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=4002",
      text: async () => loginHtml,
    }));

    await expect(DescargarAdjuntoMoodleIngenieria.resolver("4002")).rejects.toMatchObject({
      tipoConexion: "sesion",
    });
  });

  it("7. error HTTP 404 o 410 arroja error con tipoPortal: rechazo (RN-12)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      url: "https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=9999",
      text: async () => "Not Found",
    }));

    await expect(DescargarAdjuntoMoodleIngenieria.resolver("9999")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });
});
