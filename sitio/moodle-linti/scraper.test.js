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
import misCursosHtml from "./__fixtures__/mis-cursos.html?raw";
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

describe("ScraperMoodleLinti.escanearListado (modo todos)", () => {
  let mensajesEnviados;
  let mockMsg;

  function mockOnMessage() {
    let oyenteRegistrado = null;
    const addListener = vi.fn((fn) => {
      oyenteRegistrado = fn;
    });
    const removeListener = vi.fn((fn) => {
      if (oyenteRegistrado === fn) {
        oyenteRegistrado = null;
      }
    });
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    globalThis.chrome.runtime.onMessage = { addListener, removeListener };
    return {
      addListener,
      removeListener,
      getOyente: () => oyenteRegistrado,
      dispararCancelar: (msg, responder = vi.fn()) => {
        if (oyenteRegistrado) {
          oyenteRegistrado(msg, {}, responder);
        }
      },
    };
  }

  function armarCursoHtml(id, nombre, itemsHtml = "") {
    return `
      <!DOCTYPE html>
      <html>
      <head><title>${nombre}</title></head>
      <body class="format-topics">
        <div class="page-header-headings"><h1>${nombre}</h1></div>
        <div id="region-main">
          <ul data-for="course_sectionlist">
            <li class="course-section" data-for="section" data-number="1" data-sectionname="Tema 1">
              <h3 class="sectionname">Tema 1</h3>
              <ul class="section">
                ${itemsHtml}
              </ul>
            </li>
          </ul>
        </div>
      </body>
      </html>
    `;
  }

  function itemResource(cmid, nombre) {
    return `
      <li class="activity modtype_resource" data-for="cmitem" data-id="${cmid}" id="module-${cmid}">
        <div class="activityname" data-activityname="${nombre}">
          <a class="aalink" href="https://catedras.linti.unlp.edu.ar/mod/resource/view.php?id=${cmid}">${nombre}</a>
        </div>
      </li>
    `;
  }

  beforeEach(() => {
    mensajesEnviados = [];
    mockMsg = mockOnMessage();
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      mensajesEnviados.push(msg);
    });

    delete window.location;
    window.location = new URL("https://catedras.linti.unlp.edu.ar/my/courses.php");
    document.documentElement.innerHTML = misCursosHtml;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  it("L:AC-2: 3 cursos en portada emiten inicio (3 cursos), 3 curso ok y fin terminado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "Programación III", itemResource("101", "Guia 1")),
          };
        }
        if (u.includes("id=1352")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1352", "ISO-CSO", itemResource("102", "Teoria 1")),
          };
        }
        if (u.includes("id=1371")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1371", "Taller II", itemResource("103", "Practica 1")),
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    const res = await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 10,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    expect(res.recorrido).toBe(true);

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio).toBeDefined();
    expect(evInicio.cursos).toHaveLength(3);
    expect(evInicio.cursos.map((c) => c.id)).toEqual(["1331", "1352", "1371"]);

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(3);
    expect(evCursos.every((c) => c.resultado === "ok")).toBe(true);
    expect(evCursos[0].enlaces).toHaveLength(1);
    expect(evCursos[1].enlaces).toHaveLength(1);
    expect(evCursos[2].enlaces).toHaveLength(1);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("terminado");
  });

  it("L:AC-3: 5 cursos con 2 sin material emiten 3 ok y 2 vacio", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=1">C1</a>
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=2">C2</a>
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=3">C3</a>
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=4">C4</a>
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=5">C5</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1") || u.includes("id=3") || u.includes("id=5")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("c", "Con Material", itemResource("10", "Mat.pdf")),
          };
        }
        if (u.includes("id=2") || u.includes("id=4")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("c", "Sin Material", ""),
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 20,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(5);
    expect(evCursos.filter((c) => c.resultado === "ok")).toHaveLength(3);
    expect(evCursos.filter((c) => c.resultado === "vacio")).toHaveLength(2);
    expect(evCursos[1].resultado).toBe("vacio");
    expect(evCursos[3].resultado).toBe("vacio");
  });

  it("L:AC-4: curso 2 no responde por tope de tiempo y emite fallido con motivo, curso 3 sigue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemResource("1", "R1")),
          };
        }
        if (u.includes("id=1352")) {
          return new Promise((_, reject) => {
            if (init?.signal) {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }
          });
        }
        if (u.includes("id=1371")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1371", "C3", itemResource("3", "R3")),
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 30,
      tabId: 1,
      sitioId: "moodle-linti",
      topeCursoMs: 50,
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(3);
    expect(evCursos[0].resultado).toBe("ok");
    expect(evCursos[1].resultado).toBe("fallido");
    expect(evCursos[1].motivo).toContain("superó el tope");
    expect(evCursos[2].resultado).toBe("ok");
  });

  it("L:AC-5: curso 2 redirige a /login/ y emite fin cortado sesion sin evento curso para índice 1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemResource("1", "R1")),
          };
        }
        if (u.includes("id=1352")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/login/index.php",
            text: async () => "<html><body class='path-login'></body></html>",
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 40,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1);
    expect(evCursos[0].indice).toBe(0);
    expect(evCursos[0].resultado).toBe("ok");

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("sesion");
  });

  it("L:AC-7: pagehide a mitad de recorrido emite fin cortado navegacion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemResource("1", "R1")),
          };
        }
        if (u.includes("/mod/resource/")) {
          window.dispatchEvent(new Event("pagehide"));
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 50,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evFinNav = mensajesEnviados.find(
      (m) => m.tipo === "fin" && m.motivoCorte === "navegacion"
    );
    expect(evFinNav).toBeDefined();
    expect(evFinNav.estado).toBe("cortado");
  });

  it("L:AC-8: el mismo idArchivo en dos cursos produce dos ítems con cursoId distinto", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemResource("999", "Programa")),
          };
        }
        if (u.includes("id=1352")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1352", "C2", itemResource("999", "Programa")),
          };
        }
        if (u.includes("id=1371")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1371", "C3", itemResource("888", "Otro")),
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 60,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(3);
    const item1 = evCursos[0].enlaces[0];
    const item2 = evCursos[1].enlaces[0];
    expect(item1.idArchivo).toBe("999");
    expect(item2.idArchivo).toBe("999");
    expect(item1.cursoId).toBe("1331");
    expect(item2.cursoId).toBe("1352");
  });

  it("L:AC-11 y L:RN-5: curso con bigbluebuttonbn, forum y label no los lista ni genera aviso", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://catedras.linti.unlp.edu.ar/course/view.php?id=1331">C1</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          const itemsExcluidos = `
            <li class="activity modtype_bigbluebuttonbn" data-for="cmitem" data-id="801" id="module-801">
              <div class="activityname" data-activityname="Sala BBB"></div>
            </li>
            <li class="activity modtype_forum" data-for="cmitem" data-id="802" id="module-802">
              <div class="activityname" data-activityname="Foro"></div>
            </li>
            <li class="activity modtype_label" data-for="cmitem" data-id="803" id="module-803">
              <div class="activityname" data-activityname="Texto informativo"></div>
            </li>
            ${itemResource("101", "Archivo real.pdf")}
          `;
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemsExcluidos),
          };
        }
        if (u.includes("/mod/resource/")) {
          return {
            ok: true,
            url: "https://catedras.linti.unlp.edu.ar/content/doc.pdf",
            body: { cancel: vi.fn().mockResolvedValue() },
            text: async () => "",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 70,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1);
    expect(evCursos[0].resultado).toBe("ok");
    expect(evCursos[0].enlaces).toHaveLength(1);
    expect(evCursos[0].enlaces[0].idArchivo).toBe("101");
  });

  it("L:RN-2: enlaces duplicados y en nav se desduplican y se procesa una vez cada id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        return {
          ok: true,
          url: u,
          text: async () => armarCursoHtml("c", "Curso", itemResource("1", "R1")),
        };
      })
    );

    await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 80,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio.cursos).toHaveLength(3);
    const ids = evInicio.cursos.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("cancelar_escaneo con otro idRecorrido se ignora; con el propio corta inmediatamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=1331")) {
          // Disparamos primero con id distinto (no debe cancelar)
          mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 999 });
          // Luego con el id correcto
          mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 90 });
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("1331", "C1", itemResource("1", "R1")),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    const res = await ScraperMoodleLinti.escanearListado({
      modo: "todos",
      idRecorrido: 90,
      tabId: 1,
      sitioId: "moodle-linti",
    });

    expect(res.cancelado).toBe(true);
    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("cancelado");
  });
});

