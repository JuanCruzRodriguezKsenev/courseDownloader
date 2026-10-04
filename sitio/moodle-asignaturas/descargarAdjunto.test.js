/**
 * Tests del resolver de adjuntos de Moodle Asignaturas (sitio/moodle-asignaturas/descargarAdjunto.js).
 * Verifica resolución de recursos con redirect directo, incrustados HTML, archivos de carpetas,
 * accesos directos Markdown y clasificación de errores (sesión, rechazo por 404).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DescargarAdjuntoMoodleAsignaturas from "./descargarAdjunto.js";
import carpetaHtml from "./__fixtures__/carpeta.html?raw";
import loginHtml from "./__fixtures__/login.html?raw";

describe("DescargarAdjuntoMoodleAsignaturas.resolver", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("1. idArchivo vacío arroja error con tipoPortal: rechazo", async () => {
    await expect(DescargarAdjuntoMoodleAsignaturas.resolver("")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });

  it("2. acceso: convierte a data: URI de Markdown sin llamar a red (RN-9)", async () => {
    globalThis.fetch = vi.fn();
    const urlDestino = "https://forms.gle/hwcQdJZAKi6V7Pop8";
    const titulo = "Encuesta Obligatoria";
    const idArchivo = `acceso:${encodeURIComponent(urlDestino)}:${encodeURIComponent(titulo)}`;

    const dataUri = await DescargarAdjuntoMoodleAsignaturas.resolver(idArchivo);

    expect(dataUri.startsWith("data:text/markdown;charset=utf-8;base64,")).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();

    const base64 = dataUri.split(",")[1];
    const decoded = atob(base64);
    expect(decoded).toContain("tipo: acceso");
    expect(decoded).toContain("# Encuesta Obligatoria");
    expect(decoded).toContain(urlDestino);
  });

  it("3. recurso con redirección 302 a pluginfile.php devuelve la URL final", async () => {
    const pluginfileUrl =
      "https://asignaturas.info.unlp.edu.ar/pluginfile.php/51835/mod_resource/content/1/Presentacion.pdf";

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: pluginfileUrl,
      text: async () => "",
    }));

    const resultado = await DescargarAdjuntoMoodleAsignaturas.resolver("4697");
    expect(resultado).toBe(pluginfileUrl);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=4697",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("4. AC-2: recurso incrustado en HTML extrae la URL de pluginfile mediante regex", async () => {
    const htmlIncrustado = `
      <html>
        <body>
          <div class="resourcecontent">
            <object data="https://asignaturas.info.unlp.edu.ar/pluginfile.php/51835/mod_resource/content/1/2024_Clase0_Presentacion%20Programacion2.pptx.pdf" type="application/pdf"></object>
          </div>
        </body>
      </html>
    `;

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=4697",
      text: async () => htmlIncrustado,
    }));

    const resultado = await DescargarAdjuntoMoodleAsignaturas.resolver("4697");
    expect(resultado).toBe(
      "https://asignaturas.info.unlp.edu.ar/pluginfile.php/51835/mod_resource/content/1/2024_Clase0_Presentacion%20Programacion2.pptx.pdf"
    );
  });

  it("5. AC-4: archivo de carpeta resuelve enlace interno con forcedownload=1", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://asignaturas.info.unlp.edu.ar/mod/folder/view.php?id=4737",
      text: async () => carpetaHtml,
    }));

    const resultado = await DescargarAdjuntoMoodleAsignaturas.resolver("4737/Árboles.pptx");
    expect(resultado).toContain("pluginfile.php/51880/mod_folder/content/0/%C3%81rboles.pptx");
    expect(resultado).toContain("forcedownload=1");
  });

  it("6. redirección a /login/ o página de login lanza error con tipoConexion: sesion (RN-11)", async () => {
    // Redirección por URL
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://asignaturas.info.unlp.edu.ar/login/index.php",
      text: async () => loginHtml,
    }));

    await expect(DescargarAdjuntoMoodleAsignaturas.resolver("4697")).rejects.toMatchObject({
      tipoConexion: "sesion",
    });

    // Sin redirección pero contenido de login
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: "https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=4697",
      text: async () => loginHtml,
    }));

    await expect(DescargarAdjuntoMoodleAsignaturas.resolver("4697")).rejects.toMatchObject({
      tipoConexion: "sesion",
    });
  });

  it("7. error HTTP 404 o 410 arroja error con tipoPortal: rechazo (RN-12)", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      url: "https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=9999",
      text: async () => "Not Found",
    }));

    await expect(DescargarAdjuntoMoodleAsignaturas.resolver("9999")).rejects.toMatchObject({
      tipoPortal: "rechazo",
    });
  });
});
