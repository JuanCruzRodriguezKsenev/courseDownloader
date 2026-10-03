// @vitest-environment jsdom
/**
 * Tests del scraper de Moodle Asignaturas (sitio/moodle-asignaturas/scraper.js).
 * Verifica desduplicación de cmids en DOM de Moodle 4, resolución de folders y urls,
 * asignación de tema por sección y campos emitidos conforme a RN-1 a RN-9 y AC-1 a AC-4.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import cursoHtml from "./__fixtures__/curso.html?raw";
import carpetaHtml from "./__fixtures__/carpeta.html?raw";
import urlIntermediaHtml from "./__fixtures__/url-intermedia.html?raw";
import ScraperMoodleAsignaturas from "./scraper.js";

describe("ScraperMoodleAsignaturas.escanearListado", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = window.fetch;
    delete window.location;
    window.location = new URL("https://asignaturas.info.unlp.edu.ar/course/view.php?id=82");
    document.documentElement.innerHTML = cursoHtml;

    window.fetch = vi.fn(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/mod/folder/")) {
        return {
          ok: true,
          text: async () => carpetaHtml,
        };
      }
      if (urlStr.includes("/mod/url/")) {
        return {
          ok: true,
          text: async () => urlIntermediaHtml,
        };
      }
      return {
        ok: true,
        text: async () => "<html><body></body></html>",
      };
    });
  });

  afterEach(() => {
    window.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("1. extrae cursoId, cursoNombre y materia correctamente", async () => {
    const res = await ScraperMoodleAsignaturas.escanearListado();
    expect(res.materia).toBe("2024_CURSADA REGULAR_Programación II");
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(res.enlaces[0].cursoId).toBe("82");
    expect(res.enlaces[0].cursoNombre).toBe("2024_CURSADA REGULAR_Programación II");
  });

  it("2. AC-1: desduplica por cmid en Moodle 4 (80 resources, 28 urls y 1 folder con 2 archivos = 110 enlaces)", async () => {
    // En el DOM sin filtrar hay 160 .modtype_resource y 56 .modtype_url por la duplicación de bloques de Moodle
    expect(document.querySelectorAll(".modtype_resource").length).toBe(160);
    expect(document.querySelectorAll(".modtype_url").length).toBe(56);
    expect(document.querySelectorAll(".modtype_folder").length).toBe(2);

    const res = await ScraperMoodleAsignaturas.escanearListado();

    const resources = res.enlaces.filter((e) => !e.idArchivo.startsWith("acceso:") && !e.idArchivo.includes("/"));
    const urls = res.enlaces.filter((e) => e.idArchivo.startsWith("acceso:"));
    const folderFiles = res.enlaces.filter((e) => e.idArchivo.includes("/"));

    expect(resources.length).toBe(80);
    expect(urls.length).toBe(28);
    expect(folderFiles.length).toBe(2);
    expect(res.enlaces.length).toBe(110);

    // No hay idArchivo duplicado
    const ids = res.enlaces.map((e) => e.idArchivo);
    const unicos = new Set(ids);
    expect(unicos.size).toBe(ids.length);
  });

  it("3. descarta actividades no soportadas (forum, label, quiz, assign, choicegroup) (RN-2)", async () => {
    const res = await ScraperMoodleAsignaturas.escanearListado();

    // No debe contener títulos de actividades de foro o tareas
    const avisos = res.enlaces.find((e) => e.publicacion === "Avisos");
    expect(avisos).toBeUndefined();

    const entregas = res.enlaces.find((e) => e.idArchivo === "module-5411");
    expect(entregas).toBeUndefined();
  });

  it("4. campos por ítem cumplen RN-1, RN-8 y el contrato de EnlaceListado", async () => {
    const res = await ScraperMoodleAsignaturas.escanearListado();
    const item = res.enlaces.find((e) => e.idArchivo === "4697");

    expect(item).toBeDefined();
    expect(item?.tipo).toBe("adjunto");
    expect(item?.texto).toBe("Presentación de la Asignatura 2024");
    expect(item?.publicacion).toBe("Presentación de la Asignatura 2024");
    expect(item?.tema).toBe("Bienvenida");
    expect(item?.modulo).toBe("2024_CURSADA REGULAR_Programación II › Bienvenida");
    expect(item?.url).toBe("https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=4697");
  });

  it("5. folder resuelve archivos internos con idArchivo cmid/ruta (RN-5, RN-7, AC-4)", async () => {
    const res = await ScraperMoodleAsignaturas.escanearListado();

    const archivo1 = res.enlaces.find((e) => e.idArchivo === "4737/Árboles.pptx");
    const archivo2 = res.enlaces.find((e) => e.idArchivo === "4737/clase4_ejercicio.lpr");

    expect(archivo1).toBeDefined();
    expect(archivo1?.texto).toBe("Árboles.pptx");
    expect(archivo1?.publicacion).toBe("Ejercicio de Práctica y explicación");
    expect(archivo1?.url).toContain("pluginfile.php/51880/mod_folder/content/0/%C3%81rboles.pptx");

    expect(archivo2).toBeDefined();
    expect(archivo2?.texto).toBe("clase4_ejercicio.lpr");
    expect(archivo2?.publicacion).toBe("Ejercicio de Práctica y explicación");
  });

  it("6. url resuelve página intermedia y genera acceso .md (RN-5, RN-9)", async () => {
    const res = await ScraperMoodleAsignaturas.escanearListado();

    const urlItem = res.enlaces.find((e) => e.publicacion === "Acceso a encuesta obligatoria");
    expect(urlItem).toBeDefined();
    expect(urlItem?.tipo).toBe("adjunto");
    expect(urlItem?.texto).toBe("Acceso a encuesta obligatoria.md");
    expect(urlItem?.url).toBe("https://forms.gle/hwcQdJZAKi6V7Pop8");
    expect(urlItem?.idArchivo.startsWith("acceso:")).toBe(true);
    expect(urlItem?.idArchivo).toContain("forms.gle");
  });

  it("7. si la página intermedia de mod/url falla, usa la URL de Moodle como fallback", async () => {
    window.fetch = vi.fn(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/mod/folder/")) {
        return { ok: true, text: async () => carpetaHtml };
      }
      return { ok: false, status: 500, text: async () => "" };
    });

    const res = await ScraperMoodleAsignaturas.escanearListado();
    const urlItem = res.enlaces.find((e) => e.idArchivo.startsWith("acceso:"));
    expect(urlItem).toBeDefined();
    expect(urlItem?.url).toContain("/mod/url/view.php?id=");
  });

  it("8. sección 0 o «General» asigna tema «Sin tema» (RN-4)", async () => {
    // Agregamos un resource artificial a section-0 ("General")
    const s0 = document.getElementById("section-0");
    const ul = s0.querySelector("ul.section");
    const li = document.createElement("li");
    li.id = "module-99999";
    li.className = "activity resource modtype_resource";
    li.innerHTML = '<div class="activity-item" data-activityname="Reglamento"><div class="activityname">Reglamento</div></div>';
    ul.appendChild(li);

    const res = await ScraperMoodleAsignaturas.escanearListado();
    const item = res.enlaces.find((e) => e.idArchivo === "99999");
    expect(item).toBeDefined();
    expect(item?.tema).toBe("Sin tema");
    expect(item?.modulo).toBe("2024_CURSADA REGULAR_Programación II › Sin tema");
  });

  it("9. respeta concurrencia <= 4 en peticiones internas (NFR-3)", async () => {
    let activas = 0;
    let maxActivas = 0;

    window.fetch = vi.fn(async (url) => {
      activas++;
      if (activas > maxActivas) maxActivas = activas;
      await new Promise((r) => setTimeout(r, 10));
      activas--;

      const urlStr = String(url);
      if (urlStr.includes("/mod/folder/")) {
        return { ok: true, text: async () => carpetaHtml };
      }
      return { ok: true, text: async () => urlIntermediaHtml };
    });

    await ScraperMoodleAsignaturas.escanearListado();
    expect(maxActivas).toBeLessThanOrEqual(4);
  });
});
