// @vitest-environment jsdom
/**
 * Tests del scraper de IDEAS (sitio/ideas-info/scraper.js).
 * Verifica escaneo de curso individual (secciones de material, medioteca,
 * extracción de content-disposition, descarte de 404, detección de sesión),
 * y recorrido multicurso desde /home (enumeración, EnterCourse previo, cortes y tope).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import homeHtml from "./__fixtures__/home.html?raw";
import materialHtml from "./__fixtures__/material.html?raw";
import mediotecaHtml from "./__fixtures__/medioteca.html?raw";
import indiceJson from "./__fixtures__/indice.json";

import sec1Html from "./__fixtures__/secciones/1.html?raw";
import sec2Html from "./__fixtures__/secciones/2.html?raw";
import sec3Html from "./__fixtures__/secciones/3.html?raw";
import sec4Html from "./__fixtures__/secciones/4.html?raw";
import sec5Html from "./__fixtures__/secciones/5.html?raw";
import sec6Html from "./__fixtures__/secciones/6.html?raw";
import sec7Html from "./__fixtures__/secciones/7.html?raw";
import sec8Html from "./__fixtures__/secciones/8.html?raw";
import sec9Html from "./__fixtures__/secciones/9.html?raw";

import ScraperIdeasInfo from "./scraper.js";

const SEC_HTML_BY_GUID = {
  "529ec66c-72a9-11eb-afbb-b26a7e7cf880": sec1Html,
  "becf3256-72a9-11eb-afbb-b26a7e7cf880": sec2Html,
  "488e6dae-753c-11eb-a91d-b26a7e7cf880": sec3Html,
  "6701263b-6678-11e7-929a-b26a7e7cf880": sec4Html,
  "7e047250-6678-11e7-929a-b26a7e7cf880": sec5Html,
  "a6e09458-7885-11e7-a1e4-b26a7e7cf880": sec6Html,
  "0b5d4664-496b-11e7-929a-b26a7e7cf880": sec7Html,
  "d29d925c-6943-4b2a-9025-88139d53cfde": sec8Html,
  "3a0c73df-1c8d-11f1-90f7-3292d73aa1e7": sec9Html,
};

function crearFetchRealFixtures(overrides = {}) {
  return vi.fn(async (url, init) => {
    const u = String(url);

    if (overrides[u]) {
      return overrides[u](url, init);
    }

    if (u.includes("/Contents/Material/View/Show?courseTool")) {
      return {
        ok: true,
        status: 200,
        url: u,
        text: async () => materialHtml,
      };
    }

    if (u.includes("/Resources/MediaLibrary/View/Show?courseTool")) {
      return {
        ok: true,
        status: 200,
        url: u,
        text: async () => mediotecaHtml,
      };
    }

    if (u.includes("/Start/Welcome/View/Show/EnterCourse/")) {
      return {
        ok: true,
        status: 200,
        url: u,
        text: async () => "<html><body>Bienvenida</body></html>",
      };
    }

    for (const [guid, html] of Object.entries(SEC_HTML_BY_GUID)) {
      if (u.includes(`/Show/${guid}`)) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => html,
        };
      }
    }

    let pathname = "";
    try {
      pathname = new URL(u, "https://ideas.info.unlp.edu.ar").pathname;
    } catch {
      pathname = u;
    }

    if (indiceJson.headers[pathname]) {
      const h = indiceJson.headers[pathname];
      return {
        ok: h.status === 200,
        status: h.status,
        url: u,
        headers: new Headers({
          "content-type": h.ct || "application/octet-stream",
          "content-disposition": h.cd || "",
        }),
        body: { cancel: vi.fn() },
      };
    }

    return {
      ok: true,
      status: 200,
      url: u,
      headers: new Headers(),
      text: async () => "<html><body></body></html>",
      body: { cancel: vi.fn() },
    };
  });
}

describe("ScraperIdeasInfo.escanearListado (curso individual)", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = window.fetch;
    delete window.location;
    window.location = new URL(
      "https://ideas.info.unlp.edu.ar/conceptos-de-bases-de-datos-1/Contents/Material/View/Show?courseTool"
    );
    window.fetch = crearFetchRealFixtures();
  });

  afterEach(() => {
    window.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("1. AC-2: un curso → 33 ítems, 31 .pdf, 1 .pptx y 1 .rar, ninguno .md", async () => {
    const res = await ScraperIdeasInfo.escanearListado();
    expect(res.materia).toBe("Conceptos de Bases de Datos");
    expect(res.enlaces).toHaveLength(33);

    const pdfs = res.enlaces.filter((e) => e.texto.endsWith(".pdf"));
    const pptxs = res.enlaces.filter((e) => e.texto.endsWith(".pptx"));
    const rars = res.enlaces.filter((e) => e.texto.endsWith(".rar"));
    const mds = res.enlaces.filter((e) => e.texto.endsWith(".md"));

    expect(pdfs).toHaveLength(31);
    expect(pptxs).toHaveLength(1);
    expect(rars).toHaveLength(1);
    expect(mds).toHaveLength(0);

    for (const e of res.enlaces) {
      expect(e.tipo).toBe("adjunto");
      expect(e.cursoId).toBe("conceptos-de-bases-de-datos-1");
      expect(e.cursoNombre).toBe("Conceptos de Bases de Datos");
      expect(e.url.startsWith("https://ideas.info.unlp.edu.ar/")).toBe(true);
    }
  });

  it("2. AC-3: el href de «Clase 1» → CBD2026-Clase-1.pdf", async () => {
    const res = await ScraperIdeasInfo.escanearListado();
    const clase1 = res.enlaces.find((e) =>
      e.idArchivo.includes("595453dd-1ecf-11f1-90f7-3292d73aa1e7")
    );
    expect(clase1).toBeDefined();
    expect(clase1.texto).toBe("CBD2026-Clase-1.pdf");
    expect(clase1.modulo).toBe("Conceptos de Bases de Datos › Teorías");
  });

  it("3. AC-4: los 5 PDF de las tres secciones «Notas…» con su tema", async () => {
    const res = await ScraperIdeasInfo.escanearListado();
    const notas = res.enlaces.filter((e) => e.tema.startsWith("Notas "));
    expect(notas).toHaveLength(5);

    const temas = new Set(notas.map((e) => e.tema));
    expect(temas.has("Notas Evaluación Teórica")).toBe(true);
    expect(temas.has("Notas Evaluación Teórica Rec.")).toBe(true);
    expect(temas.has("Notas Examen Práctico")).toBe(true);
  });

  it("4. AC-5: ningún ítem con tema Información de cátedra ni Promoción", async () => {
    const res = await ScraperIdeasInfo.escanearListado();
    const info = res.enlaces.find((e) => e.tema === "Información de cátedra");
    const promo = res.enlaces.find((e) => e.tema === "Promoción");
    expect(info).toBeUndefined();
    expect(promo).toBeUndefined();
  });

  it("5. AC-6: el .rar con tema Medioteca e idArchivo …/medioteca/<guid>", async () => {
    const res = await ScraperIdeasInfo.escanearListado();
    const rar = res.enlaces.find((e) => e.texto.endsWith(".rar"));
    expect(rar).toBeDefined();
    expect(rar.tema).toBe("Medioteca");
    expect(rar.modulo).toBe("Conceptos de Bases de Datos › Medioteca");
    expect(rar.idArchivo).toMatch(
      /^conceptos-de-bases-de-datos-1\/medioteca\/[0-9a-f-]{36}$/
    );
  });

  it("6. AC-10 (sintético): dos enlaces del mismo tema con mismo filename y textos distintos → - <texto>; iguales → (2)", async () => {
    window.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/Contents/Material/View/Show?courseTool")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => `
            <html><body>
              <span class="col-md-8"><h4>Curso Choques</h4></span>
              <a onclick="toggleContent('11111111-1111-1111-1111-111111111111')">Tema Choques</a>
            </body></html>
          `,
        };
      }
      if (u.includes("/Show/11111111-1111-1111-1111-111111111111")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => `
            <html><body>
              <a class="contentToView" href="/c/Contents/Material/View/Access/22222222-2222-2222-2222-222222222222">Texto A</a>
              <a class="contentToView" href="/c/Contents/Material/View/Access/33333333-3333-3333-3333-333333333333">Texto B</a>
              <a class="contentToView" href="/c/Contents/Material/View/Access/44444444-4444-4444-4444-444444444444">Mismo</a>
              <a class="contentToView" href="/c/Contents/Material/View/Access/55555555-5555-5555-5555-555555555555">Mismo</a>
            </body></html>
          `,
        };
      }
      if (u.includes("/Resources/MediaLibrary/View/Show?courseTool")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => "<html><body></body></html>",
        };
      }
      if (u.includes("22222222") || u.includes("33333333")) {
        return {
          ok: true,
          status: 200,
          url: u,
          headers: new Headers({ "content-disposition": 'inline; filename="guia.pdf"' }),
          body: { cancel: vi.fn() },
        };
      }
      if (u.includes("44444444") || u.includes("55555555")) {
        return {
          ok: true,
          status: 200,
          url: u,
          headers: new Headers({ "content-disposition": 'inline; filename="repetido.pdf"' }),
          body: { cancel: vi.fn() },
        };
      }
      return { ok: true, status: 200, url: u, text: async () => "" };
    });

    const res = await ScraperIdeasInfo.escanearListado({ slug: "c" });
    expect(res.enlaces).toHaveLength(4);

    const guiaA = res.enlaces.find((e) => e.idArchivo.includes("22222222"));
    const guiaB = res.enlaces.find((e) => e.idArchivo.includes("33333333"));
    expect(guiaA.texto).toBe("guia - Texto A.pdf");
    expect(guiaB.texto).toBe("guia - Texto B.pdf");

    const rep1 = res.enlaces.find((e) => e.idArchivo.includes("44444444"));
    const rep2 = res.enlaces.find((e) => e.idArchivo.includes("55555555"));
    expect(rep1.texto).toBe("repetido - Mismo.pdf");
    expect(rep2.texto).toBe("repetido - Mismo (2).pdf");
  });

  it("7. filename* gana sobre filename; sin content-disposition se usa texto del enlace", async () => {
    window.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/Contents/Material/View/Show?courseTool")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => `
            <html><body>
              <span class="col-md-8"><h4>Curso Pruebas</h4></span>
              <a onclick="toggleContent('11111111-1111-1111-1111-111111111111')">Tema</a>
            </body></html>
          `,
        };
      }
      if (u.includes("/Show/11111111-1111-1111-1111-111111111111")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => `
            <html><body>
              <a class="contentToView" href="/c/Contents/Material/View/Access/22222222-2222-2222-2222-222222222222">Fallback Enlace</a>
              <a class="contentToView" href="/c/Contents/Material/View/Access/33333333-3333-3333-3333-333333333333">Enlace Sec</a>
            </body></html>
          `,
        };
      }
      if (u.includes("/Resources/MediaLibrary/View/Show?courseTool")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => "<html><body></body></html>",
        };
      }
      if (u.includes("22222222")) {
        // Sin content-disposition
        return {
          ok: true,
          status: 200,
          url: u,
          headers: new Headers(),
          body: { cancel: vi.fn() },
        };
      }
      if (u.includes("33333333")) {
        // filename* y filename
        return {
          ok: true,
          status: 200,
          url: u,
          headers: new Headers({
            "content-disposition": "attachment; filename*=UTF-8''Ganador%20RFC5987.pdf; filename=\"Perdedor.pdf\"",
          }),
          body: { cancel: vi.fn() },
        };
      }
      return { ok: true, status: 200, url: u, text: async () => "" };
    });

    const res = await ScraperIdeasInfo.escanearListado({ slug: "c" });
    const itemFallback = res.enlaces.find((e) => e.idArchivo.includes("22222222"));
    const itemRfc = res.enlaces.find((e) => e.idArchivo.includes("33333333"));

    expect(itemFallback.texto).toBe("Fallback Enlace");
    expect(itemRfc.texto).toBe("Ganador RFC5987.pdf");
  });

  it("8. un header con 404 deja el archivo afuera y los demás siguen (RN-12, A5)", async () => {
    const fetchBase = crearFetchRealFixtures();
    window.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes("595453dd-1ecf-11f1-90f7-3292d73aa1e7")) {
        return {
          ok: false,
          status: 404,
          url: u,
          body: { cancel: vi.fn() },
        };
      }
      return fetchBase(url, init);
    });

    const res = await ScraperIdeasInfo.escanearListado();
    expect(res.enlaces).toHaveLength(32);
    expect(
      res.enlaces.find((e) => e.idArchivo.includes("595453dd-1ecf-11f1-90f7-3292d73aa1e7"))
    ).toBeUndefined();
  });

  it("9. Material que redirige a /login devuelve motivoAviso: sesion", async () => {
    window.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/Contents/Material/View/Show?courseTool")) {
        return {
          ok: true,
          status: 200,
          url: "https://ideas.info.unlp.edu.ar/login",
          text: async () => "<html><body><input id='username'/><button id='_submit'/></body></html>",
        };
      }
      return { ok: true, status: 200, url: u, text: async () => "" };
    });

    const res = await ScraperIdeasInfo.escanearListado();
    expect(res.motivoAviso).toBe("sesion");
  });
});

describe("ScraperIdeasInfo.escanearListado (modo todos)", () => {
  let fetchOriginal;
  let mensajesEnviados;
  let oyenteCancelarRegistrado;

  function mockOnMessage() {
    const addListener = vi.fn((fn) => {
      oyenteCancelarRegistrado = fn;
    });
    const removeListener = vi.fn(() => {
      oyenteCancelarRegistrado = null;
    });
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    globalThis.chrome.runtime.onMessage = { addListener, removeListener };
    return {
      dispararCancelar: (msg, responder = vi.fn()) => {
        if (oyenteCancelarRegistrado) {
          oyenteCancelarRegistrado(msg, {}, responder);
        }
      },
    };
  }

  let mockMsg;

  beforeEach(() => {
    mensajesEnviados = [];
    mockMsg = mockOnMessage();
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      mensajesEnviados.push(msg);
    });

    delete window.location;
    window.location = new URL("https://ideas.info.unlp.edu.ar/home");
    document.documentElement.innerHTML = homeHtml;
    window.fetch = crearFetchRealFixtures();
  });

  afterEach(() => {
    window.fetch = fetchOriginal;
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  it("10. modo todos con home.html: inicio con 1 curso, evento curso ok y fin terminado", async () => {
    const res = await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 101,
      tabId: 1,
      sitioId: "ideas-info",
    });

    expect(res.recorrido).toBe(true);

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio).toBeDefined();
    expect(evInicio.cursos).toEqual([
      {
        slug: "conceptos-de-bases-de-datos-1",
        nombre: "Conceptos de Bases de Datos",
        id: "conceptos-de-bases-de-datos-1",
      },
    ]);

    const evCurso = mensajesEnviados.find((m) => m.tipo === "curso");
    expect(evCurso).toBeDefined();
    expect(evCurso.resultado).toBe("ok");
    expect(evCurso.enlaces).toHaveLength(33);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("terminado");
  });

  it("11. modo todos con 2 cursos: orden y desduplicado (AC-11: mismo filename da 2 ítems con cursoId distinto)", async () => {
    // Clonamos el .course-box en home para simular un segundo curso
    const box = document.querySelector(".course-box");
    const clonBox = box.cloneNode(true);
    const linkTitulo = clonBox.querySelector(".course-title-header p.title a");
    linkTitulo.href = "/bases-de-datos-avanzadas/Start/Welcome/View/Show/EnterCourse/99999999";
    linkTitulo.textContent = "Bases de Datos Avanzadas";
    const toolsLinks = clonBox.querySelectorAll(".course-icon-tools a");
    for (const a of toolsLinks) {
      a.href = a.href.replace("conceptos-de-bases-de-datos-1", "bases-de-datos-avanzadas");
    }
    box.parentNode.appendChild(clonBox);

    const fetchBase = crearFetchRealFixtures();
    window.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes("bases-de-datos-avanzadas")) {
        const uEquiv = u.replace("bases-de-datos-avanzadas", "conceptos-de-bases-de-datos-1");
        return fetchBase(uEquiv, init);
      }
      return fetchBase(url, init);
    });

    const res = await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 102,
      tabId: 1,
      sitioId: "ideas-info",
    });

    expect(res.recorrido).toBe(true);

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio.cursos).toHaveLength(2);
    expect(evInicio.cursos[0].slug).toBe("conceptos-de-bases-de-datos-1");
    expect(evInicio.cursos[1].slug).toBe("bases-de-datos-avanzadas");

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(2);
    expect(evCursos[0].resultado).toBe("ok");
    expect(evCursos[1].resultado).toBe("ok");

    // AC-11: Verificar que el mismo filename en ambos cursos genera ítems con cursoId distinto
    const clase1C1 = evCursos[0].enlaces.find((e) => e.texto === "CBD2026-Clase-1.pdf");
    const clase1C2 = evCursos[1].enlaces.find((e) => e.texto === "CBD2026-Clase-1.pdf");
    expect(clase1C1).toBeDefined();
    expect(clase1C2).toBeDefined();
    expect(clase1C1.cursoId).toBe("conceptos-de-bases-de-datos-1");
    expect(clase1C2.cursoId).toBe("bases-de-datos-avanzadas");
  });

  it("12. curso 2 que supera el tope → fallido con motivo y el 3 sigue (AC-9)", async () => {
    // Tres cursos sintéticos
    document.querySelector(".content-my-courses").innerHTML = `
      <div class="course-box">
        <div class="course-title-header"><p class="title"><a href="/c1/Start/Welcome/View/Show/EnterCourse/1">Curso 1</a></p></div>
      </div>
      <div class="course-box">
        <div class="course-title-header"><p class="title"><a href="/c2/Start/Welcome/View/Show/EnterCourse/2">Curso 2</a></p></div>
      </div>
      <div class="course-box">
        <div class="course-title-header"><p class="title"><a href="/c3/Start/Welcome/View/Show/EnterCourse/3">Curso 3</a></p></div>
      </div>
    `;

    window.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes("/c2/")) {
        return new Promise((_, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }
        });
      }
      if (u.includes("EnterCourse")) {
        return { ok: true, status: 200, url: u, text: async () => "<html><body></body></html>" };
      }
      if (u.includes("Contents/Material")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => "<span class='col-md-8'><h4>C</h4></span>",
        };
      }
      return { ok: true, status: 200, url: u, text: async () => "" };
    });

    await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 103,
      tabId: 1,
      sitioId: "ideas-info",
      topeCursoMs: 50,
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(3);
    expect(evCursos[0].resultado).toBe("vacio");
    expect(evCursos[1].resultado).toBe("fallido");
    expect(evCursos[1].motivo).toContain("superó el tope");
    expect(evCursos[2].resultado).toBe("vacio");
  });

  it("13. EnterCourse del curso 2 que va a /login → fin cortado sesion, sin fallido (AC-8)", async () => {
    document.querySelector(".content-my-courses").innerHTML = `
      <div class="course-box">
        <div class="course-title-header"><p class="title"><a href="/c1/Start/Welcome/View/Show/EnterCourse/1">Curso 1</a></p></div>
      </div>
      <div class="course-box">
        <div class="course-title-header"><p class="title"><a href="/c2/Start/Welcome/View/Show/EnterCourse/2">Curso 2</a></p></div>
      </div>
    `;

    window.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("/c2/Start/Welcome/View/Show/EnterCourse/")) {
        return {
          ok: true,
          status: 200,
          url: "https://ideas.info.unlp.edu.ar/login",
          text: async () => "<html><body><input id='username'/><button id='_submit'/></body></html>",
        };
      }
      if (u.includes("EnterCourse")) {
        return { ok: true, status: 200, url: u, text: async () => "<html><body></body></html>" };
      }
      if (u.includes("Contents/Material")) {
        return {
          ok: true,
          status: 200,
          url: u,
          text: async () => "<span class='col-md-8'><h4>C</h4></span>",
        };
      }
      return { ok: true, status: 200, url: u, text: async () => "" };
    });

    await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 104,
      tabId: 1,
      sitioId: "ideas-info",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1); // Sólo curso 1 emitió resultado vacio/ok
    expect(evCursos.find((c) => c.indice === 1)).toBeUndefined(); // Curso 2 NO emitió evento

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("sesion");
  });

  it("14. cancelación por oyente corta el recorrido con motivoCorte: cancelado", async () => {
    window.fetch = vi.fn(async (url) => {
      mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 999 });
      mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 105 });
      return { ok: true, status: 200, url: String(url), text: async () => "" };
    });

    const res = await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 105,
      tabId: 1,
      sitioId: "ideas-info",
    });

    expect(res.cancelado).toBe(true);
    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("cancelado");
  });

  it("15. pagehide a mitad de recorrido emite fin cortado navegacion", async () => {
    window.fetch = vi.fn(async (url) => {
      window.dispatchEvent(new Event("pagehide"));
      return { ok: true, status: 200, url: String(url), text: async () => "" };
    });

    await ScraperIdeasInfo.escanearListado({
      modo: "todos",
      idRecorrido: 106,
      tabId: 1,
      sitioId: "ideas-info",
    });

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("navegacion");
  });
});
