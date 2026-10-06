// @vitest-environment jsdom
/**
 * Tests del scraper de Moodle Ingeniería (sitio/moodle-ingenieria/scraper.js).
 * Verifica escaneo de curso individual (sección 0 con nombre propio según RN-4,
 * descarte de actividades no soportadas, resolución de folders y urls),
 * y recorrido de todos los cursos desde /my/ (paridad, cortes, eventos y resumen).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import cursoHtml from "./__fixtures__/curso.html?raw";
import carpetaHtml from "./__fixtures__/carpeta.html?raw";
import urlIntermediaHtml from "./__fixtures__/url-intermedia.html?raw";
import misCursosHtml from "./__fixtures__/mis-cursos.html?raw";
import ScraperMoodleIngenieria from "./scraper.js";

describe("ScraperMoodleIngenieria.escanearListado (curso individual)", () => {
  let fetchOriginal;

  beforeEach(() => {
    fetchOriginal = window.fetch;
    delete window.location;
    window.location = new URL("https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091");
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
    const res = await ScraperMoodleIngenieria.escanearListado();
    expect(res.materia).toBe("Matemática B3 (2023)");
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(res.enlaces[0].cursoId).toBe("4091");
    expect(res.enlaces[0].cursoNombre).toBe("Matemática B3 (2023)");
  });

  it("2. desduplica por cmid en Moodle Ingeniería", async () => {
    // Clonamos un resource para verificar desduplicación
    const primerResource = document.querySelector(".modtype_resource");
    if (primerResource) {
      primerResource.parentNode.appendChild(primerResource.cloneNode(true));
    }

    const res = await ScraperMoodleIngenieria.escanearListado();
    const ids = res.enlaces.map((e) => e.idArchivo);
    const unicos = new Set(ids);
    expect(unicos.size).toBe(ids.length);
  });

  it("3. descarta actividades no soportadas (forum, quiz, assign, label) (RN-2)", async () => {
    const res = await ScraperMoodleIngenieria.escanearListado();

    const foro = res.enlaces.find((e) => e.publicacion.includes("Foro"));
    expect(foro).toBeUndefined();

    const quiz = res.enlaces.find((e) => e.publicacion.includes("Autoevaluación"));
    expect(quiz).toBeUndefined();

    const assign = res.enlaces.find((e) => e.publicacion.includes("Entrega"));
    expect(assign).toBeUndefined();

    const label = res.enlaces.find((e) => e.publicacion.includes("Lecturas"));
    expect(label).toBeUndefined();
  });

  it("4. campos por ítem cumplen RN-1, RN-8 y el contrato de EnlaceListado", async () => {
    const res = await ScraperMoodleIngenieria.escanearListado();
    const item = res.enlaces.find((e) => e.idArchivo === "4002");

    expect(item).toBeDefined();
    expect(item?.tipo).toBe("adjunto");
    expect(item?.texto).toBe("Cronograma 2023");
    expect(item?.publicacion).toBe("Cronograma 2023");
    expect(item?.tema).toBe("Anuncios Parroquiales");
    expect(item?.modulo).toBe("Matemática B3 (2023) › Anuncios Parroquiales");
    expect(item?.url).toBe("https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=4002");
  });

  it("5. folder resuelve archivos internos con idArchivo cmid/ruta (RN-5, AC-2)", async () => {
    const res = await ScraperMoodleIngenieria.escanearListado();

    const archivo1 = res.enlaces.find(
      (e) => e.idArchivo === "4006/Pautas para elaborar el informe de laboratorio.pdf"
    );
    const archivo2 = res.enlaces.find((e) => e.idArchivo === "4006/Anexo 1.pdf");

    expect(archivo1).toBeDefined();
    expect(archivo1?.texto).toBe("Pautas para elaborar el informe de laboratorio.pdf");
    expect(archivo1?.publicacion).toBe("Práctica 1");
    expect(archivo1?.url).toContain("pluginfile.php/384155/mod_folder/content/0/");

    expect(archivo2).toBeDefined();
    expect(archivo2?.texto).toBe("Anexo 1.pdf");
  });

  it("6. url resuelve página intermedia y genera acceso .md (RN-6)", async () => {
    const res = await ScraperMoodleIngenieria.escanearListado();

    const urlItem = res.enlaces.find((e) => e.publicacion === "Clase Grabada - Vectores");
    expect(urlItem).toBeDefined();
    expect(urlItem?.tipo).toBe("adjunto");
    expect(urlItem?.texto).toBe("Clase Grabada - Vectores.md");
    expect(urlItem?.url).toBe("https://youtu.be/ejemplo-vectores-123");
    expect(urlItem?.idArchivo.startsWith("acceso:")).toBe(true);
    expect(urlItem?.idArchivo).toContain("youtu.be");
  });

  it("7. si la página intermedia de mod/url falla, usa la URL de Moodle como fallback", async () => {
    window.fetch = vi.fn(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/mod/folder/")) {
        return { ok: true, text: async () => carpetaHtml };
      }
      return { ok: false, status: 500, text: async () => "" };
    });

    const res = await ScraperMoodleIngenieria.escanearListado();
    const urlItem = res.enlaces.find((e) => e.idArchivo.startsWith("acceso:"));
    expect(urlItem).toBeDefined();
    expect(urlItem?.url).toContain("/mod/url/view.php?id=");
  });

  it("8. RN-4: sección 0 con nombre usa su nombre; sección sin nombre o «General» usa «Sin tema»", async () => {
    const res = await ScraperMoodleIngenieria.escanearListado();

    // 8a. Sección 0 con nombre propio ("Anuncios Parroquiales")
    const itemSec0 = res.enlaces.find((e) => e.idArchivo === "4002");
    expect(itemSec0).toBeDefined();
    expect(itemSec0?.tema).toBe("Anuncios Parroquiales");
    expect(itemSec0?.modulo).toBe("Matemática B3 (2023) › Anuncios Parroquiales");

    // 8b. Sección 3 sin nombre -> "Sin tema"
    const itemSecSinNombre = res.enlaces.find((e) => e.idArchivo === "4011");
    expect(itemSecSinNombre).toBeDefined();
    expect(itemSecSinNombre?.tema).toBe("Sin tema");
    expect(itemSecSinNombre?.modulo).toBe("Matemática B3 (2023) › Sin tema");

    // 8c. Sección 4 con nombre "General" -> "Sin tema"
    const itemSecGeneral = res.enlaces.find((e) => e.idArchivo === "4012");
    expect(itemSecGeneral).toBeDefined();
    expect(itemSecGeneral?.tema).toBe("Sin tema");
    expect(itemSecGeneral?.modulo).toBe("Matemática B3 (2023) › Sin tema");
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

    await ScraperMoodleIngenieria.escanearListado();
    expect(maxActivas).toBeLessThanOrEqual(4);
  });

  it("10. AC-3: curso con 158 actividades, 27 quiz y 2 forum -> la lista solo tiene resource/folder/url sin avisos", async () => {
    let htmlActividades = "";
    // 129 resources
    for (let i = 1; i <= 129; i++) {
      htmlActividades += `
        <li class="activity resource modtype_resource" id="module-5${i.toString().padStart(3, "0")}">
          <div class="activityinstance"><span class="instancename">Guía ${i} <span class="accesshide"> Archivo</span></span></div>
        </li>`;
    }
    // 27 quiz
    for (let i = 1; i <= 27; i++) {
      htmlActividades += `
        <li class="activity quiz modtype_quiz" id="module-6${i.toString().padStart(3, "0")}">
          <div class="activityinstance"><span class="instancename">Cuestionario ${i} <span class="accesshide"> Cuestionario</span></span></div>
        </li>`;
    }
    // 2 forum
    for (let i = 1; i <= 2; i++) {
      htmlActividades += `
        <li class="activity forum modtype_forum" id="module-7${i.toString().padStart(3, "0")}">
          <div class="activityinstance"><span class="instancename">Foro ${i} <span class="accesshide"> Foro</span></span></div>
        </li>`;
    }

    document.documentElement.innerHTML = `
      <html>
      <head><title>Curso: Física II (2023)</title></head>
      <body>
        <div class="page-header-headings"><h1>Física II (2023)</h1></div>
        <ul class="topics">
          <li id="section-1" class="section">
            <h3 class="sectionname">Electrostática</h3>
            <ul class="section">${htmlActividades}</ul>
          </li>
        </ul>
      </body>
      </html>
    `;

    const res = await ScraperMoodleIngenieria.escanearListado();
    expect(res.enlaces).toHaveLength(129);
    expect(res.aviso).toBeUndefined();
    expect(res.enlaces.every((e) => e.tipo === "adjunto")).toBe(true);
  });

  it("11. AC-4: curso de 8 resource y 85 url en 10 secciones -> 93 ítems agrupados por sección y 85 accesos .md", async () => {
    let htmlSecciones = "";
    let idCounter = 8000;

    // 10 secciones. En las primeras 8 secciones ponemos 1 resource y 8 urls cada una (= 8 res + 64 urls).
    // En la 9 ponemos 11 urls y en la 10 ponemos 10 urls (= 85 urls en total).
    for (let s = 1; s <= 10; s++) {
      let acts = "";
      if (s <= 8) {
        idCounter++;
        acts += `
          <li class="activity resource modtype_resource" id="module-${idCounter}">
            <div class="activityinstance"><span class="instancename">Apunte Sec ${s} <span class="accesshide"> Archivo</span></span></div>
          </li>`;
      }
      const cantUrls = s <= 8 ? 8 : s === 9 ? 11 : 10;
      for (let u = 1; u <= cantUrls; u++) {
        idCounter++;
        acts += `
          <li class="activity url modtype_url" id="module-${idCounter}">
            <div class="activityinstance"><span class="instancename">Video S${s} U${u} <span class="accesshide"> URL</span></span></div>
          </li>`;
      }

      htmlSecciones += `
        <li id="section-${s}" class="section">
          <h3 class="sectionname">Sección ${s}</h3>
          <ul class="section">${acts}</ul>
        </li>`;
    }

    document.documentElement.innerHTML = `
      <html>
      <head><title>Curso: Matemática B3 (2023)</title></head>
      <body>
        <div class="page-header-headings"><h1>Matemática B3 (2023)</h1></div>
        <ul class="topics">${htmlSecciones}</ul>
      </body>
      </html>
    `;

    const res = await ScraperMoodleIngenieria.escanearListado();
    expect(res.enlaces).toHaveLength(93);

    const accesos = res.enlaces.filter((e) => e.idArchivo.startsWith("acceso:"));
    const resources = res.enlaces.filter((e) => !e.idArchivo.startsWith("acceso:"));

    expect(accesos).toHaveLength(85);
    expect(resources).toHaveLength(8);
    expect(accesos.every((a) => a.texto.endsWith(".md"))).toBe(true);
    expect(res.enlaces.every((e) => e.tema.startsWith("Sección "))).toBe(true);
  });
});

describe("ScraperMoodleIngenieria.escanearListado (modo todos)", () => {
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
          <div id="section-1" class="section">
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
      <li class="activity resource modtype_resource" id="module-${cmid}">
        <div class="activityinstance">
          <a class="activityname" href="https://www.asignaturas.ing.unlp.edu.ar/mod/resource/view.php?id=${cmid}">
            <span class="instancename">${nombre} <span class="accesshide"> Archivo</span></span>
          </a>
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
    window.location = new URL("https://www.asignaturas.ing.unlp.edu.ar/my/");
    document.documentElement.innerHTML = misCursosHtml;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
  });

  it("12. AC-6: /my/ con 9 cursos, 3 vacíos -> emite 6 ok y 3 vacio, sin incluir los vacíos en enlaces", async () => {
    // En misCursosHtml hay 9 cursos: 4091 a 4099.
    // Haremos que 4097, 4098, 4099 sean vacíos.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        const match = u.match(/id=(\d+)/);
        const id = match ? match[1] : "0";
        if (["4097", "4098", "4099"].includes(id)) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml(id, `Curso ${id}`, ""),
          };
        }
        return {
          ok: true,
          url: u,
          text: async () =>
            armarCursoHtml(id, `Curso ${id}`, itemResource(`99${id}`, `Apunte ${id}`)),
        };
      })
    );

    const res = await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 201,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    expect(res.recorrido).toBe(true);

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio).toBeDefined();
    expect(evInicio.cursos).toHaveLength(9);

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(9);
    expect(evCursos.filter((c) => c.resultado === "ok")).toHaveLength(6);
    expect(evCursos.filter((c) => c.resultado === "vacio")).toHaveLength(3);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("terminado");
  });

  it("13. AC-7: curso que supera tope emite fallido y el siguiente continúa", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091">C1</a>
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4092">C2</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        const u = String(url);
        if (u.includes("id=4091")) {
          return new Promise((_, reject) => {
            if (init?.signal) {
              init.signal.addEventListener("abort", () => {
                reject(new DOMException("Aborted", "AbortError"));
              });
            }
          });
        }
        if (u.includes("id=4092")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("4092", "C2", itemResource("2", "R2")),
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 202,
      tabId: 1,
      sitioId: "moodle-ingenieria",
      topeCursoMs: 50,
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(2);
    expect(evCursos[0].resultado).toBe("fallido");
    expect(evCursos[0].motivo).toContain("superó el tope");
    expect(evCursos[1].resultado).toBe("ok");
  });

  it("14. AC-8: cancelar_escaneo con id propio corta inmediatamente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 999 });
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 203 });
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("4091", "C1", itemResource("1", "R1")),
        };
      })
    );

    const res = await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 203,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    expect(res.cancelado).toBe(true);
    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("cancelado");
  });

  it("15. AC-9: pagehide a mitad de recorrido emite fin cortado navegacion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        window.dispatchEvent(new Event("pagehide"));
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("4091", "C1", itemResource("1", "R1")),
        };
      })
    );

    await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 204,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    const evFinNav = mensajesEnviados.find(
      (m) => m.tipo === "fin" && m.motivoCorte === "navegacion"
    );
    expect(evFinNav).toBeDefined();
    expect(evFinNav.estado).toBe("cortado");
  });

  it("16. AC-10: el mismo idArchivo en dos cursos emite dos ítems con cursoId distinto", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091">C1</a>
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4092">C2</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        return {
          ok: true,
          url: u,
          text: async () => armarCursoHtml("c", "Curso", itemResource("777", "GuíaCompartida")),
        };
      })
    );

    await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 205,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(2);
    expect(evCursos[0].enlaces[0].idArchivo).toBe("777");
    expect(evCursos[1].enlaces[0].idArchivo).toBe("777");
    expect(evCursos[0].enlaces[0].cursoId).toBe("4091");
    expect(evCursos[1].enlaces[0].cursoId).toBe("4092");
  });

  it("17. RN-18: curso que devuelve login emite fin cortado sesion sin evento curso", async () => {
    document.documentElement.innerHTML = `
      <div id="region-main">
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4091">C1</a>
        <a href="https://www.asignaturas.ing.unlp.edu.ar/course/view.php?id=4092">C2</a>
      </div>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        const u = String(url);
        if (u.includes("id=4091")) {
          return {
            ok: true,
            url: u,
            text: async () => armarCursoHtml("4091", "C1", itemResource("1", "R1")),
          };
        }
        if (u.includes("id=4092")) {
          return {
            ok: true,
            url: "https://www.asignaturas.ing.unlp.edu.ar/login/index.php",
            text: async () => "<html><body class='path-login'></body></html>",
          };
        }
        return { ok: true, url: u, text: async () => "" };
      })
    );

    await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 206,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
    expect(evCursos).toHaveLength(1);
    expect(evCursos[0].indice).toBe(0);

    const evFin = mensajesEnviados.find((m) => m.tipo === "fin");
    expect(evFin).toBeDefined();
    expect(evFin.estado).toBe("cortado");
    expect(evFin.motivoCorte).toBe("sesion");
  });

  it("18. RN-2: enlaces en nav/drawer y duplicados se descartan conservando los 9 cursos únicos", async () => {
    // Usamos el fixture misCursosHtml que tiene 9 en nav, 1 en drawer, 1 dup en cuerpo y 9 en lista
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        return {
          ok: true,
          url: String(url),
          text: async () => armarCursoHtml("c", "Curso", itemResource("1", "R1")),
        };
      })
    );

    await ScraperMoodleIngenieria.escanearListado({
      modo: "todos",
      idRecorrido: 207,
      tabId: 1,
      sitioId: "moodle-ingenieria",
    });

    const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
    expect(evInicio.cursos).toHaveLength(9);
    expect(evInicio.cursos.map((c) => c.id)).toEqual([
      "4091",
      "4092",
      "4093",
      "4094",
      "4095",
      "4096",
      "4097",
      "4098",
      "4099",
    ]);
  });
});
