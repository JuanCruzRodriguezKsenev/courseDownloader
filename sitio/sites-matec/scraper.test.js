// @vitest-environment jsdom
/**
 * Tests del scraper de Google Sites Matemática C (Capa 2).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ScraperSitesMatec, { extraerItemsDeDocumento, escanearListado, SUBPAGINAS_MATEC } from "./scraper.js";

const FIXTURES_DIR = path.join(__dirname, "__fixtures__");
const seriesHtml = fs.readFileSync(path.join(FIXTURES_DIR, "series.html"), "utf-8");
const autoevaluacionesHtml = fs.readFileSync(path.join(FIXTURES_DIR, "autoevaluaciones.html"), "utf-8");

describe("ScraperSitesMatec.extraerItemsDeDocumento", () => {
  it("ScraperSitesMatec expone escanearListado y SUBPAGINAS_MATEC", () => {
    expect(ScraperSitesMatec.escanearListado).toBeDefined();
    expect(ScraperSitesMatec.SUBPAGINAS_MATEC).toBe(SUBPAGINAS_MATEC);
  });

  it("extrae items de series.html clasificando YouTube, Drive videos y Drive PDFs", () => {
    const doc = new DOMParser().parseFromString(seriesHtml, "text/html");
    const items = extraerItemsDeDocumento(doc, "Series", "https://sites.google.com/ing.unlp.edu.ar/matec/inicio/series");

    expect(items.length).toBe(18);

    // 8 videos de YouTube
    const ytItems = items.filter((it) => it.idArchivo?.startsWith("acceso:https%3A%2F%2Fwww.youtube.com"));
    expect(ytItems.length).toBe(8);
    for (const yt of ytItems) {
      expect(yt.tipo).toBe("adjunto");
      expect(yt.modulo).toBe("Matemática C › Series");
      expect(yt.tema).toBe("Series");
      expect(yt.cursoId).toBe("matec");
      expect(yt.cursoNombre).toBe("Matemática C");
      expect(yt.texto).toBeTruthy();
    }

    // 2 videos de Drive (.mp4 / .MOV)
    const driveVideos = items.filter(
      (it) => it.idArchivo?.startsWith("acceso:https%3A%2F%2Fdrive.google.com")
    );
    expect(driveVideos.length).toBe(2);
    for (const dv of driveVideos) {
      expect(dv.tipo).toBe("adjunto");
      expect(dv.modulo).toBe("Matemática C › Series");
      expect(dv.tema).toBe("Series");
      expect(dv.cursoId).toBe("matec");
    }

    // 8 PDFs de Drive
    const drivePdfs = items.filter((it) => it.idArchivo?.startsWith("drive:"));
    expect(drivePdfs.length).toBe(8);
    for (const pdf of drivePdfs) {
      expect(pdf.tipo).toBe("adjunto");
      expect(pdf.modulo).toBe("Matemática C › Series");
      expect(pdf.tema).toBe("Series");
      expect(pdf.cursoId).toBe("matec");
      expect(pdf.texto).toBeTruthy();
    }
  });

  it("extrae los 11 formularios Google Forms de autoevaluaciones.html", () => {
    const doc = new DOMParser().parseFromString(autoevaluacionesHtml, "text/html");
    const items = extraerItemsDeDocumento(
      doc,
      "Autoevaluaciones",
      "https://sites.google.com/ing.unlp.edu.ar/matec/inicio/autoevaluaciones"
    );

    expect(items.length).toBe(11);
    for (const item of items) {
      expect(item.tipo).toBe("adjunto");
      expect(item.modulo).toBe("Matemática C › Autoevaluaciones");
      expect(item.tema).toBe("Autoevaluaciones");
      expect(item.cursoId).toBe("matec");
      expect(item.cursoNombre).toBe("Matemática C");
      expect(item.idArchivo?.startsWith("acceso:https%3A%2F%2Fdocs.google.com%2Fforms")).toBe(true);
      expect(item.texto).toMatch(/Autoevaluacion \d+/);
    }
  });

  it("deduplica ítems si una subpágina contiene iframe y enlace a la misma clave", () => {
    const htmlDuplicado = `
      <div>
        <h2>Video Repetido</h2>
        <iframe src="https://www.youtube.com/embed/meW-bo5A3vo" title="Video"></iframe>
        <a href="https://www.youtube.com/watch?v=meW-bo5A3vo">Ver en YouTube</a>
      </div>
    `;
    const doc = new DOMParser().parseFromString(htmlDuplicado, "text/html");
    const items = extraerItemsDeDocumento(doc, "Series", "https://ejemplo.com");
    expect(items.length).toBe(1);
  });
});

describe("ScraperSitesMatec.escanearListado", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("fetchea las 9 subpáginas en paralelo y devuelve el resultado consolidado", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      let body = "<html><body></body></html>";
      if (url.includes("/series")) body = seriesHtml;
      if (url.includes("/autoevaluaciones")) body = autoevaluacionesHtml;

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(body),
      });
    });

    const resultado = await escanearListado();

    expect(resultado.materia).toBe("Matemática C");
    expect(resultado.enlaces.length).toBe(29); // 18 de series + 11 de autoevaluaciones
    expect(globalThis.fetch).toHaveBeenCalledTimes(SUBPAGINAS_MATEC.length);
    expect(SUBPAGINAS_MATEC.length).toBe(9);
  });

  it("tolera errores de red en una subpágina puntual sin fallar el escaneo total", async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes("/series")) {
        return Promise.reject(new Error("Network Error"));
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(autoevaluacionesHtml),
      });
    });

    const resultado = await escanearListado();
    expect(resultado.materia).toBe("Matemática C");
    // 8 subpáginas * 11 autoevaluaciones = 88 items
    expect(resultado.enlaces.length).toBe(88);
  });
});
