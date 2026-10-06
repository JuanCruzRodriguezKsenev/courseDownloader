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
import misCursosHtml from "./__fixtures__/mis-cursos.html?raw";
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

describe("ScraperMoodleAsignaturas.escanearListado (modo todos)", () => {
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
          <div id="section-1" class="section" data-for="section" data-number="1">
            <h3 class="sectionname">Tema 1</h3>
            <ul class="section">
              ${itemsHtml}
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  function itemResource(cmid, nombre) {
    return `
      <li class="activity modtype_resource" data-for="cmitem" data-id="${cmid}" id="module-${cmid}">
        <div class="activity-item" data-activityname="${nombre}">
          <a class="activityname" href="https://asignaturas.info.unlp.edu.ar/mod/resource/view.php?id=${cmid}">${nombre}</a>
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
    window.location = new URL("https://asignaturas.info.unlp.edu.ar/my/");
    document.documentElement.innerHTML = misCursosHtml;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  it("I:AC-2: 1 curso (id 82) en portada emite inicio (1 curso), 1 curso ok y fin terminado", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=82")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("82", "Programación II", itemResource("4697", "Presentación")),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    const res = await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 101,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    expect(res.recorrido).toBe(true);

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio).toBeDefined();
    expect(evInicio.cursos).toHaveLength(1);
    expect(evInicio.cursos[0].id).toBe("82");

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1);
    expect(evCursos[0].resultado).toBe("ok");
    expect(evCursos[0].enlaces).toHaveLength(1);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("terminado");
  });

  it("I:AC-3: 5 cursos con 2 vacíos emite 3 ok y 2 vacio", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=10">C10</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=20">C20</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=30">C30</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=40">C40</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=50">C50</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=10") || u.includes("id=30") || u.includes("id=50")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("c", "Con Material", itemResource("10", "Mat.pdf")),
          };
        }
        if (u.includes("id=20") || u.includes("id=40")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("c", "Sin Material", ""),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 102,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(5);
    expect(evCursos.filter((c) => c.resultado === "ok")).toHaveLength(3);
    expect(evCursos.filter((c) => c.resultado === "vacio")).toHaveLength(2);
    expect(evCursos[1].resultado).toBe("vacio");
    expect(evCursos[3].resultado).toBe("vacio");
  });

  it("I:AC-4: curso que supera tope emite fallido y el siguiente continúa", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=81">C81</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes("id=81")) {
          return new Promise((_, reject) => {
            if (init?.signal) {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }
          });
        }
        if (u.includes("id=82")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("82", "C82", itemResource("2", "R2")),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 103,
      tabId: 1,
      sitioId: "moodle-asignaturas",
      topeCursoMs: 50,
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(2);
    expect(evCursos[0].resultado).toBe("fallido");
    expect(evCursos[0].motivo).toContain("superó el tope");
    expect(evCursos[1].resultado).toBe("ok");
  });

  it("I:AC-5: curso que devuelve /login/ emite fin cortado sesion sin evento curso", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=81">C81</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=81")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("81", "C81", itemResource("1", "R1")),
          };
        }
        if (u.includes("id=82")) {
          return {
            ok: true,
            url: "https://asignaturas.info.unlp.edu.ar/login/index.php",
            text: async () => "<html><body class='path-login'></body></html>",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 104,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1);
    expect(evCursos[0].indice).toBe(0);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("sesion");
  });

  it("I:AC-7: pagehide a mitad de recorrido emite fin cortado navegacion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        window.dispatchEvent(new Event("pagehide"));
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("82", "C82", itemResource("1", "R1")),
        };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 105,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    const evFinNav = mensajesEnviados.find(
      (m) => m.tipo === "fin" && m.motivoCorte === "navegacion"
    );
    expect(evFinNav).toBeDefined();
    expect(evFinNav.estado).toBe("cortado");
  });

  it("I:AC-8: el mismo idArchivo en dos cursos emite dos ítems con cursoId distinto", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=81">C81</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=81")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("81", "C81", itemResource("777", "Guia")),
          };
        }
        if (u.includes("id=82")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("82", "C82", itemResource("777", "Guia")),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 106,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(2);
    expect(evCursos[0].enlaces[0].idArchivo).toBe("777");
    expect(evCursos[1].enlaces[0].idArchivo).toBe("777");
    expect(evCursos[0].enlaces[0].cursoId).toBe("81");
    expect(evCursos[1].enlaces[0].cursoId).toBe("82");
  });

  it("I:RN-2: enlaces duplicados y en nav se desduplican y se procesa una vez cada id", async () => {
    document.documentElement.innerHTML = `
      <nav><a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82 nav</a></nav>
      <div id="region-main">
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82</a>
        <a href="https://asignaturas.info.unlp.edu.ar/course/view.php?id=82">C82 bis</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("82", "C82", itemResource("1", "R1")),
        };
      })
    );

    await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 107,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio.cursos).toHaveLength(1);
    expect(evInicio.cursos[0].id).toBe("82");
  });

  it("cancelar_escaneo con otro idRecorrido se ignora; con el propio corta inmediatamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 999 });
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 108 });
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("82", "C82", itemResource("1", "R1")),
        };
      })
    );

    const res = await ScraperMoodleAsignaturas.escanearListado({
      modo: "todos",
      idRecorrido: 108,
      tabId: 1,
      sitioId: "moodle-asignaturas",
    });

    expect(res.cancelado).toBe(true);
    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("cancelado");
  });
});
