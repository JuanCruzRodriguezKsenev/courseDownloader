// @vitest-environment jsdom
/**
 * Tests del scraper de Moodle del LINTI (Capa 2).
 * Verifica extracción de actividades resource, folder y url,
 * aplanamiento de subcarpetas, deduplicación con sufijos,
 * manejo de sesión vencida y descarte de actividades no soportadas.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import cursoHtml from "./__fixtures__/curso.html?raw";
import carpetaHtml from "./__fixtures__/carpeta.html?raw";
import urlIntermediaHtml from "./__fixtures__/url-intermedia.html?raw";
import loginHtml from "./__fixtures__/login.html?raw";
import ScraperMoodleLinti from "./scraper.js";

function armarHtmlFolder(archivos) {
  const links = archivos
    .map(
      (ruta) =>
        `<li><a href="https://catedras.linti.unlp.edu.ar/pluginfile.php/51880/mod_folder/content/0/${encodeURI(
          ruta
        )}?forcedownload=1">${ruta.split("/").pop()}</a></li>`
    )
    .join("\n");
  return `<div class="filemanager"><ul>${links}</ul></div>`;
}

describe("ScraperMoodleLinti.escanearListado", () => {
  beforeEach(() => {
    delete window.location;
    window.location = new URL("https://catedras.linti.unlp.edu.ar/course/view.php?id=1352");
    document.documentElement.innerHTML = cursoHtml;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockearRedCursoCompleto() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);

        // Resources
        if (u.includes("/mod/resource/view.php")) {
          const match = u.match(/id=(\d+)/);
          const cmid = match ? match[1] : "0";
          if (cmid === "46390") {
            return {
              ok: true,
              url: "https://catedras.linti.unlp.edu.ar/pluginfile.php/14077/mod_resource/content/1/R%C3%A9gimen%20de%20cursada.pdf",
              body: { cancel: vi.fn().mockResolvedValue() },
              text: async () => "",
            };
          }
          return {
            ok: true,
            url: `https://catedras.linti.unlp.edu.ar/pluginfile.php/14077/mod_resource/content/1/archivo_${cmid}.pdf`,
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }

        // Folders
        if (u.includes("/mod/folder/view.php")) {
          if (u.includes("id=45872")) {
            // Material y Transparencias: 11 archivos en 3 subcarpetas
            const archivos = [
              "Tema 1/intro.pdf",
              "Tema 1/clase1.pdf",
              "Tema 1/clase2.pdf",
              "Tema 1/clase3.pdf",
              "Tema 2/intro.pdf",
              "Tema 2/clase4.pdf",
              "Tema 2/clase5.pdf",
              "Tema 2/clase6.pdf",
              "Tema 3/clase7.pdf",
              "Tema 3/clase8.pdf",
              "Tema 3/clase9.pdf",
            ];
            return {
              ok: true,
              url: u,
              text: async () => armarHtmlFolder(archivos),
            };
          }
          if (u.includes("id=46593")) {
            // Simulador: 3 archivos
            const archivos = ["simulador.jar", "config.xml", "instrucciones.txt"];
            return {
              ok: true,
              url: u,
              text: async () => armarHtmlFolder(archivos),
            };
          }
          if (u.includes("id=46396")) {
            // Material de Practica 1: 2 archivos (usamos el fixture carpeta.html)
            return {
              ok: true,
              url: u,
              text: async () => carpetaHtml,
            };
          }
        }

        // URLs
        if (u.includes("/mod/url/view.php")) {
          if (u.includes("id=46399")) {
            // Caso WhatsApp: redirect externo que da error o sin enlace legible
            throw new Error("CORS / Failed to fetch");
          }
          return {
            ok: true,
            url: u,
            text: async () => urlIntermediaHtml,
          };
        }

        return {
          ok: true,
          url: u,
          text: async () => "",
        };
      })
    );
  }

  it("conteo 8 resource + (11+3+2) archivos de folder + 5 url y ninguno de forum|quiz|page|choice (AC-5)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    expect(resultado.enlaces).toBeDefined();
    // 8 resources + (11 + 3 + 2) de folders + 5 urls = 29 items
    expect(resultado.enlaces).toHaveLength(29);

    // Ninguno es forum, quiz, page o choice
    const hrefs = resultado.enlaces.map((e) => e.href);
    expect(hrefs.some((h) => h.includes("/mod/forum/"))).toBe(false);
    expect(hrefs.some((h) => h.includes("/mod/quiz/"))).toBe(false);
    expect(hrefs.some((h) => h.includes("/mod/page/"))).toBe(false);
    expect(hrefs.some((h) => h.includes("/mod/choice/"))).toBe(false);
  });

  it("sección «General» se traduce en 'Sin tema' (AC-8)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    const itemGeneral = resultado.enlaces.find((e) => e.idArchivo === "46390");
    expect(itemGeneral).toBeDefined();
    expect(itemGeneral.tema).toBe("Sin tema");
    expect(itemGeneral.modulo).toBe("ISO-CSO - Segundo Semestre 2026 › Sin tema");
  });

  it("dos intro.pdf en Tema 1/Tema 2 terminan con sufijos distintos e idArchivo distintos (AC-2)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    const intros = resultado.enlaces.filter((e) => e.idArchivo.endsWith("/intro.pdf"));
    expect(intros).toHaveLength(2);

    expect(intros[0].idArchivo).not.toBe(intros[1].idArchivo);
    expect(intros[0].texto).not.toBe(intros[1].texto);
    expect(intros.some((i) => i.texto.includes("Tema 1"))).toBe(true);
    expect(intros.some((i) => i.texto.includes("Tema 2"))).toBe(true);
  });

  it("texto decodifica R%C3%A9gimen (AC-9)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    const regimen = resultado.enlaces.find((e) => e.idArchivo === "46390");
    expect(regimen).toBeDefined();
    expect(regimen.texto).toBe("Régimen de cursada.pdf");
  });

  it("url sin destino legible usa la URL de Moodle (AC-4)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    const itemWhatsapp = resultado.enlaces.find((e) => e.href.includes("id=46399"));
    expect(itemWhatsapp).toBeDefined();
    expect(itemWhatsapp.idArchivo).toBe(
      `acceso:${encodeURIComponent("https://catedras.linti.unlp.edu.ar/mod/url/view.php?id=46399")}:${encodeURIComponent(
        itemWhatsapp.publicacion
      )}`
    );
  });

  it("url con página intermedia legible extrae el destino de .urlworkaround a[href] (AC-3)", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    const itemConUrl = resultado.enlaces.find(
      (e) => e.href.includes("/mod/url/") && !e.href.includes("id=46399")
    );
    expect(itemConUrl).toBeDefined();
    expect(itemConUrl.idArchivo).toContain(encodeURIComponent("https://forms.gle/hwcQdJZAKi6V7Pop8"));
  });

  it("el módulo siempre es curso › sección, jamás con la carpeta", async () => {
    mockearRedCursoCompleto();
    const resultado = await ScraperMoodleLinti.escanearListado();

    for (const enlace of resultado.enlaces) {
      expect(enlace.modulo).toMatch(/^ISO-CSO - Segundo Semestre 2026 › /);
      expect(enlace.modulo).not.toContain("Material y Transparencias");
      expect(enlace.modulo).not.toContain("Tema 1");
    }
  });

  it("login.html → aviso de sesión, sin ítems", async () => {
    document.documentElement.innerHTML = loginHtml;
    delete window.location;
    window.location = new URL("https://catedras.linti.unlp.edu.ar/login/index.php");

    const resultado = await ScraperMoodleLinti.escanearListado();
    expect(resultado.enlaces).toHaveLength(0);
    expect(resultado.motivoAviso).toBe("sesion");
    expect(resultado.aviso).toContain("sesión en Moodle");
  });

  it("curso sin archivos → aviso de sin material (A5)", async () => {
    document.documentElement.innerHTML = `<div id="region-main"><li class="course-section" data-for="section"><h3 class="sectionname">General</h3><ul data-for="cmlist"></ul></li></div>`;
    const resultado = await ScraperMoodleLinti.escanearListado();
    expect(resultado.enlaces).toHaveLength(0);
    expect(resultado.motivoAviso).toBe("sin-material");
    expect(resultado.aviso).toBe("Este curso no tiene archivos");
  });
});
