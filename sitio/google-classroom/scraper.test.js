// @vitest-environment jsdom
/**
 * Tests del scraper de Google Classroom contra un fixture HTML sintético.
 * Verifica la navegación entre vistas, apertura de ítems, Ver más, deduplicación,
 * clasificación de adjuntos y manejo de avisos de corte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import htmlFixture from "./__fixtures__/curso.html?raw";
import portadaHtml from "./__fixtures__/portada.html?raw";
import archivadasHtml from "./__fixtures__/archivadas.html?raw";
import ScraperClassroom from "./scraper.js";

const TIEMPOS_TEST = {
  pintado: 100,
  vuelta: 5,
  navegacion: 100,
  verMas: 100,
  abrir: 100,
  abrirTodos: 1000,
  sinAdjuntos: 10,
  hidratacion: 200,
  identidadCurso: 200,
};

function prepararDom(html = htmlFixture, urlInicial = "https://classroom.google.com/u/2/w/CURSO123/t/all") {
  document.documentElement.innerHTML = html;

  delete window.location;
  window.location = new URL(urlInicial);

  let quedanPorCargar = 1;
  const btnVerMas = document.querySelector('button[aria-label="Ver más publicaciones"]');
  if (btnVerMas) {
    btnVerMas.getClientRects = () => (quedanPorCargar > 0 ? [{ width: 100, height: 30 }] : []);
    btnVerMas.addEventListener("click", () => {
      setTimeout(() => {
        const region = btnVerMas.closest('div[role="region"]');
        if (region && quedanPorCargar > 0) {
          const li = document.createElement("li");
          li.setAttribute("data-stream-item-id", "tp-11");
          li.setAttribute("data-expandable-row-id", "row-tp-11");
          li.innerHTML = `
            <div role="button" aria-expanded="true" aria-label="TP 11"></div>
            <div data-attachment-id="att-tp-11">
              <a aria-label="Archivo adjunto: PDF: TP11.pdf" href="https://drive.google.com/file/d/drive-tp-11/view"></a>
            </div>
          `;
          region.appendChild(li);
          quedanPorCargar = 0;
        }
      }, 10);
    });
  }

  const btnPlegado = document.querySelector('li[data-stream-item-id="item-plegado"] div[role="button"]');
  if (btnPlegado) {
    btnPlegado.addEventListener("click", () => {
      setTimeout(() => {
        const li = btnPlegado.closest("li");
        if (li) {
          btnPlegado.setAttribute("aria-expanded", "true");
          const divAtt = document.createElement("div");
          divAtt.setAttribute("data-attachment-id", "att-plegado");
          divAtt.innerHTML = `<a aria-label="Archivo adjunto: PDF: Plegado.pdf" href="https://drive.google.com/file/d/drive-plegado/view"></a>`;
          li.appendChild(divAtt);
        }
      }, 10);
    });
  }

  const navLinks = document.querySelectorAll("nav a[href]");
  for (const a of navLinks) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href") || "";
      if (href.includes("/c/")) {
        document.getElementById("vista-trabajo")?.setAttribute("aria-hidden", "true");
        document.getElementById("vista-novedades")?.removeAttribute("aria-hidden");
        window.location.pathname = href;
      } else if (href.includes("/w/")) {
        document.getElementById("vista-novedades")?.setAttribute("aria-hidden", "true");
        document.getElementById("vista-trabajo")?.removeAttribute("aria-hidden");
        window.location.pathname = href;
      }
    });
  }
}

describe("ScraperClassroom.escanearListado", () => {
  beforeEach(() => {
    prepararDom();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. devuelve los adjuntos de Trabajo en clase y de Novedades con modulo '<curso> › <tema>' y tipo 'adjunto'", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    expect(res.aviso).toBeUndefined();
    expect(res.enlaces.length).toBeGreaterThan(0);

    const temas = new Set(res.enlaces.map((e) => e.modulo));
    expect(temas).toContain("Física II › Sin tema");
    expect(temas).toContain("Física II › Presentaciones");
    expect(temas).toContain("Física II › Trabajos Practicos");
    expect(temas).toContain("Física II › Novedades");

    for (const enlace of res.enlaces) {
      expect(enlace.tipo).toBe("adjunto");
      expect(enlace.modulo.startsWith("Física II › ")).toBe(true);
      expect(enlace.texto).toBeTruthy();
      expect(enlace.href).toBeTruthy();
      expect(enlace.idArchivo).toBeTruthy();
    }
  });

  it("2. ignora la vista oculta (aria-hidden='true')", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const secreto = res.enlaces.find(
      (e) => e.idArchivo === "drive-oculto" || e.texto.includes("Secreto")
    );
    expect(secreto).toBeUndefined();
  });

  it("3. carga el tema paginado entero (11 ítems)", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const tp11 = res.enlaces.find((e) => e.texto.includes("TP11") || e.idArchivo === "drive-tp-11");
    expect(tp11).toBeDefined();

    const tps = res.enlaces.filter((e) => e.modulo === "Física II › Trabajos Practicos");
    expect(tps.length).toBe(11);
  });

  it("4. abre el ítem plegado y trae su adjunto", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const plegado = res.enlaces.find(
      (e) => e.idArchivo === "drive-plegado" || e.texto.includes("Plegado")
    );
    expect(plegado).toBeDefined();
    expect(plegado?.idArchivo).toBe("drive-plegado");
  });

  it("5. el video de Drive, el de YouTube y el vínculo salen como acceso .md con idArchivo acceso:…", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    // Video de Drive
    const videoDrive = res.enlaces.find((e) => e.texto.includes("Grabacion Teoria.mp4"));
    expect(videoDrive).toBeDefined();
    expect(videoDrive?.texto).toBe("Grabacion Teoria.mp4.md");
    expect(videoDrive?.idArchivo.startsWith("acceso:")).toBe(true);
    expect(videoDrive?.idArchivo).toContain("Grabacion%20Teoria.mp4");

    // YouTube
    const yt = res.enlaces.find((e) => e.texto.includes("Experimento Optica"));
    expect(yt).toBeDefined();
    expect(yt?.texto).toBe("Experimento Optica.md");
    expect(yt?.idArchivo.startsWith("acceso:")).toBe(true);
    expect(yt?.idArchivo).toContain("Experimento%20Optica");

    // Vínculo
    const vinculo = res.enlaces.find((e) => e.texto.includes("Clase 1 - forms.gle"));
    expect(vinculo).toBeDefined();
    expect(vinculo?.texto).toBe("Clase 1 - forms.gle.md");
    expect(vinculo?.idArchivo.startsWith("acceso:")).toBe(true);
    expect(vinculo?.idArchivo).toContain("forms.gle");
  });

  it("6. el choque de nombres le agrega el material a los dos", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const notasClase1 = res.enlaces.find((e) => e.idArchivo === "drive-dup-a");
    const notasClase2 = res.enlaces.find((e) => e.idArchivo === "drive-dup-b");

    expect(notasClase1).toBeDefined();
    expect(notasClase2).toBeDefined();
    expect(notasClase1?.texto).toBe("Notas - Clase 1.pdf");
    expect(notasClase2?.texto).toBe("Notas - Clase 2.pdf");
  });

  it("7. credenciales.authuser sale de /u/N/", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    expect(res.credenciales).toEqual({ authuser: "2" });
  });

  it("8. un curso con [data-no-topic-items] y sin posts devuelve aviso sin esperar el tope de pintado", async () => {
    const htmlVacio = `
      <title>Trabajo en clase de Curso Vacio - Classroom</title>
      <nav>
        <a href="/u/2/c/CURSOVACIO">Novedades</a>
        <a href="/u/2/w/CURSOVACIO/t/all">Trabajo en clase</a>
      </nav>
      <c-wiz id="vista-trabajo">
        <div data-no-topic-items>No hay publicaciones</div>
      </c-wiz>
      <c-wiz id="vista-novedades" aria-hidden="true">
        <div data-stream-item-id="post-vacio">
          <h2>Bienvenida</h2>
        </div>
      </c-wiz>
    `;
    prepararDom(htmlVacio, "https://classroom.google.com/u/2/w/CURSOVACIO/t/all");

    const t0 = Date.now();
    const res = await ScraperClassroom.escanearListado({
      tiempos: { ...TIEMPOS_TEST, pintado: 5000 },
    });
    const duracion = Date.now() - t0;

    expect(duracion).toBeLessThan(1000);
    expect(res.aviso).toBe("Este curso no tiene archivos en Trabajo en clase ni en Novedades.");
    expect(res.enlaces).toEqual([]);
  });

  it("9. con document.visibilityState en 'hidden' devuelve aviso y enlaces vacío", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    expect(res.enlaces).toEqual([]);
    expect(res.aviso).toContain("Cambiaste de pestaña durante el escaneo");

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("10. un mismo id de Drive en Trabajo en clase y en Novedades sale una sola vez", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const repetidos = res.enlaces.filter((e) => e.idArchivo === "drive-sin-tema");
    expect(repetidos.length).toBe(1);
  });

  it("11. abre todos los ítems plegados antes de que cargue el primero", async () => {
    const liOriginal = document.querySelector('li[data-stream-item-id="item-plegado"]');
    expect(liOriginal).toBeTruthy();
    const region = liOriginal.parentElement;

    const clics = [];
    const cargas = [];

    [2, 3].forEach((n) => {
      const clon = liOriginal.cloneNode(true);
      clon.setAttribute("data-stream-item-id", `item-plegado-${n}`);
      clon.setAttribute("data-expandable-row-id", `row-plegado-${n}`);
      const btn = clon.querySelector('div[role="button"]');
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", `Material Plegado ${n}`);

      btn.addEventListener("click", () => {
        clics.push(Date.now());
        setTimeout(() => {
          btn.setAttribute("aria-expanded", "true");
          const divAtt = document.createElement("div");
          divAtt.setAttribute("data-attachment-id", `att-plegado-${n}`);
          divAtt.innerHTML = `<a aria-label="Archivo adjunto: PDF: Plegado${n}.pdf" href="https://drive.google.com/file/d/drive-plegado-${n}/view"></a>`;
          clon.appendChild(divAtt);
          cargas.push(Date.now());
        }, 60);
      });

      region.appendChild(clon);
    });

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(clics.length).toBe(2);
    expect(Math.max(...clics)).toBeLessThan(Math.min(...cargas));

    const ids = res.enlaces.map((e) => e.idArchivo);
    expect(ids).toContain("drive-plegado");
    expect(ids).toContain("drive-plegado-2");
    expect(ids).toContain("drive-plegado-3");
  });

  it("12. espera a que el adjunto se hidrate y lo lista como archivo, no como acceso .md", async () => {
    const region = document.querySelector('div[role="region"][aria-label="Tema Trabajos Practicos"]');
    const li = document.createElement("li");
    li.setAttribute("data-stream-item-id", "tp-lento");
    li.setAttribute("data-expandable-row-id", "row-tp-lento");
    li.innerHTML = `
      <div role="button" aria-expanded="true" aria-label="TP Lento"></div>
      <div data-attachment-id="att-lento">
        <a aria-label="Archivo adjunto: Desconocido: Archivo de Drive" href="https://drive.google.com/open?id=drive-lento"></a>
      </div>
    `;
    region.appendChild(li);

    // 400 ms y un tope holgado: MEDIDO contra el scraper de `e51d73a` (el de antes del
    // arreglo), que lee la vista a los ~250-300 ms y con este retraso lista el placeholder.
    // Con 50 ms el test pasaba también SIN el arreglo, así que no fijaba nada.
    setTimeout(() => {
      const a = li.querySelector("a");
      if (a) {
        a.setAttribute("aria-label", "Archivo adjunto: PDF: Lento.pdf");
        a.setAttribute("href", "https://drive.google.com/file/d/drive-lento/view");
      }
    }, 400);

    const res = await ScraperClassroom.escanearListado({ tiempos: { ...TIEMPOS_TEST, hidratacion: 1500 } });

    const lento = res.enlaces.filter((e) => e.idArchivo === "drive-lento");
    expect(lento.length).toBe(1);
    expect(lento[0].texto).toBe("Lento.pdf");

    const conPlaceholder = res.enlaces.filter((e) => e.texto.startsWith("Archivo adjunto"));
    expect(conPlaceholder.length).toBe(0);
    expect(res.adjuntosSinResolver).toBeUndefined();
  });

  it("13. el adjunto que nunca resuelve se descarta y se cuenta", async () => {
    const resBase = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const cantBase = resBase.enlaces.length;

    prepararDom();

    const region = document.querySelector('div[role="region"][aria-label="Tema Trabajos Practicos"]');
    const li = document.createElement("li");
    li.setAttribute("data-stream-item-id", "tp-lento");
    li.setAttribute("data-expandable-row-id", "row-tp-lento");
    li.innerHTML = `
      <div role="button" aria-expanded="true" aria-label="TP Lento"></div>
      <div data-attachment-id="att-lento">
        <a aria-label="Archivo adjunto: Desconocido: Archivo de Drive" href="https://drive.google.com/open?id=drive-lento"></a>
      </div>
    `;
    region.appendChild(li);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.adjuntosSinResolver).toBe(1);

    const conPlaceholder = res.enlaces.filter((e) => e.texto.startsWith("Archivo adjunto"));
    expect(conPlaceholder.length).toBe(0);

    expect(res.enlaces.length).toBe(cantBase);
  });

  it("14. el title desfasado no manda: el nombre sale del sidebar", async () => {
    document.title = "Trabajo en clase de OTRO CURSO - Classroom";

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.aviso).toBeUndefined();
    expect(res.enlaces.length).toBeGreaterThan(0);
    for (const e of res.enlaces) {
      expect(e.modulo.startsWith("Física II › ")).toBe(true);
      expect(e.modulo.includes("OTRO CURSO")).toBe(false);
    }
  });

  it("15. curso archivado: sin sidebar, el title vale si el DOM lo confirma", async () => {
    const anclaSidebar = document.querySelector('a[aria-current="page"]');
    if (anclaSidebar) anclaSidebar.removeAttribute("aria-current");

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.aviso).toBeUndefined();
    expect(res.enlaces.length).toBeGreaterThan(0);
    for (const e of res.enlaces) {
      expect(e.modulo.startsWith("Física II › ")).toBe(true);
    }
  });

  it("16. title genérico y sin sidebar: no lista nada y avisa", async () => {
    const anclaSidebar = document.querySelector('a[aria-current="page"]');
    if (anclaSidebar) anclaSidebar.removeAttribute("aria-current");
    document.title = "Trabajo en clase";

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.enlaces.length).toBe(0);
    expect(res.aviso).toBeDefined();
    expect(res.aviso).toContain("curso");
  });

  it("18. un ancla del curso fuera del <h1> no confirma el title", async () => {
    document.querySelector('a[aria-current="page"]').remove();
    document.querySelector("nav h1").remove();
    const suelta = document.createElement("a");
    suelta.setAttribute("href", "/u/2/c/CURSO123");
    suelta.textContent = "Física II";
    document.querySelector("nav").appendChild(suelta);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.enlaces.length).toBe(0);
    expect(res.aviso).toBeDefined();
    expect(res.aviso).toContain("curso");
  });

  it("17. un ítem de otro curso en la vista aborta el escaneo", async () => {
    const region = document.querySelector('#vista-trabajo div[role="region"]');
    const li = document.createElement("li");
    li.setAttribute("data-stream-item-id", "item-otro-curso");
    li.innerHTML = `<a href="/u/2/c/OTRO999/m/item-1/details">Item de otro curso</a>`;
    region.appendChild(li);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.enlaces.length).toBe(0);
    expect(res.aviso).toBeDefined();
    expect(res.aviso).toContain("Cambiaste de curso");
  });

  function simularNavegacionClassroom({ hooksPorCurso = {} } = {}) {
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    const mensajesEnviados = [];
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      mensajesEnviados.push(msg);
    });

    const cargarPagina = (html, urlStr) => {
      document.documentElement.innerHTML = html;
      delete window.location;
      window.location = new URL(urlStr);
    };

    const prepararInteractividadCurso = () => {
      let quedanPorCargar = 1;
      const btnVerMas = document.querySelector('button[aria-label="Ver más publicaciones"]');
      if (btnVerMas) {
        btnVerMas.getClientRects = () => (quedanPorCargar > 0 ? [{ width: 100, height: 30 }] : []);
        btnVerMas.addEventListener("click", () => {
          setTimeout(() => {
            const region = btnVerMas.closest('div[role="region"]');
            if (region && quedanPorCargar > 0) {
              const li = document.createElement("li");
              li.setAttribute("data-stream-item-id", "tp-11");
              li.setAttribute("data-expandable-row-id", "row-tp-11");
              li.innerHTML = `
                <div role="button" aria-expanded="true" aria-label="TP 11"></div>
                <div data-attachment-id="att-tp-11">
                  <a aria-label="Archivo adjunto: PDF: TP11.pdf" href="https://drive.google.com/file/d/drive-tp-11/view"></a>
                </div>
              `;
              region.appendChild(li);
              quedanPorCargar = 0;
            }
          }, 10);
        });
      }

      const btnPlegado = document.querySelector('li[data-stream-item-id="item-plegado"] div[role="button"]');
      if (btnPlegado) {
        btnPlegado.addEventListener("click", () => {
          setTimeout(() => {
            const li = btnPlegado.closest("li");
            if (li) {
              btnPlegado.setAttribute("aria-expanded", "true");
              const divAtt = document.createElement("div");
              divAtt.setAttribute("data-attachment-id", "att-plegado");
              divAtt.innerHTML = `<a aria-label="Archivo adjunto: PDF: Plegado.pdf" href="https://drive.google.com/file/d/drive-plegado/view"></a>`;
              li.appendChild(divAtt);
            }
          }, 10);
        });
      }
    };

    const handlerClick = (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (!href) return;
      e.preventDefault();

      if (href.endsWith("/h") || href.endsWith("/h/st")) {
        cargarPagina(portadaHtml, `https://classroom.google.com${href}`);
      } else if (href.endsWith("/h/archived")) {
        cargarPagina(archivadasHtml, `https://classroom.google.com${href}`);
      } else if (href.includes("/w/")) {
        document.getElementById("vista-novedades")?.setAttribute("aria-hidden", "true");
        document.getElementById("vista-trabajo")?.removeAttribute("aria-hidden");
        delete window.location;
        window.location = new URL(`https://classroom.google.com${href}`);
      } else if (href.includes("/c/")) {
        const m = /\/c\/([^/?#]+)/.exec(href);
        const id = m ? m[1] : "CURSO123";
        if (location.pathname.includes(`/c/${id}`) || location.pathname.includes(`/w/${id}`)) {
          document.getElementById("vista-trabajo")?.setAttribute("aria-hidden", "true");
          document.getElementById("vista-novedades")?.removeAttribute("aria-hidden");
          delete window.location;
          window.location = new URL(`https://classroom.google.com${href}`);
          return;
        }

        let htmlCurso = htmlFixture
          .replace(/CURSO123/g, id)
          .replace('<c-wiz id="vista-trabajo">', '<c-wiz id="vista-trabajo" aria-hidden="true">')
          .replace('<c-wiz id="vista-novedades" aria-hidden="true">', '<c-wiz id="vista-novedades">');
        if (id === "CURSO456") {
          htmlCurso = htmlCurso.replace(/Física II/g, "Química I");
        } else if (id === "CURSO789") {
          htmlCurso = htmlCurso
            .replace(/Física<span> II<\/span>/g, "Matemática<span> Discreta</span>")
            .replace(/Física II/g, "Matemática Discreta")
            .replace('aria-current="page"', "");
        }
        if (!htmlCurso.includes("/h/archived")) {
          htmlCurso = htmlCurso.replace(
            "<nav>",
            `<nav>\n    <a href="/u/2/h">Clases</a>\n    <a href="/u/2/h/archived">Clases archivadas</a>\n    <a href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>\n    <a href="/u/2/c/CURSO456" aria-label="Química I">Química I</a>`
          );
        }
        if (hooksPorCurso[id]) {
          htmlCurso = hooksPorCurso[id](htmlCurso);
        }
        cargarPagina(htmlCurso, `https://classroom.google.com/u/2/c/${id}`);
        prepararInteractividadCurso();
      }
    };

    document.addEventListener("click", handlerClick);
    cargarPagina(portadaHtml, "https://classroom.google.com/u/2/h");

    return {
      mensajesEnviados,
      limpiar: () => document.removeEventListener("click", handlerClick),
    };
  }

  it("19. recorre 3 cursos (2 activos + 1 archivado) en ese orden y emite eventos con enlaces y su modulo", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 100,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const tipos = mensajesEnviados.map((m) => m.tipo);
      expect(tipos).toEqual([
        "inicio",
        "latido",
        "curso",
        "latido",
        "curso",
        "latido",
        "curso",
        "fin",
      ]);

      const evInicio = mensajesEnviados[0];
      expect(evInicio.cursos).toHaveLength(3);
      expect(evInicio.cursos.map((c) => c.id)).toEqual(["CURSO123", "CURSO456", "CURSO789"]);

      const cursosOk = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(cursosOk).toHaveLength(3);
      expect(cursosOk[0].resultado).toBe("ok");
      expect(cursosOk[0].enlaces[0].modulo).toContain("Física II ›");
      expect(cursosOk[1].resultado).toBe("ok");
      expect(cursosOk[1].enlaces[0].modulo).toContain("Química I ›");
      expect(cursosOk[2].resultado).toBe("ok");
      expect(cursosOk[2].enlaces[0].modulo).toContain("Matemática Discreta ›");

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("20. visibilityState pasa a hidden durante el curso 2: hay 1 curso ok y fin cortado visibilidad", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO456: (html) => {
          Object.defineProperty(document, "visibilityState", {
            value: "hidden",
            configurable: true,
          });
          return html;
        },
      },
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 101,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const tipos = mensajesEnviados.map((m) => m.tipo);
      expect(tipos).toEqual(["inicio", "latido", "curso", "latido", "fin"]);

      const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(evCursos).toHaveLength(1);
      expect(evCursos[0].indice).toBe(0);
      expect(evCursos[0].resultado).toBe("ok");

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("cortado");
      expect(evFin.motivoCorte).toBe("visibilidad");
    } finally {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
      });
      limpiar();
    }
  });

  it("21. un curso no confirma identidad: curso fallido con aviso y el recorrido sigue hasta fin terminado", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO456: (html) => {
          return html
            .replace('aria-current="page"', "")
            .replace(/<title>.*?<\/title>/, "<title>Trabajo en clase</title>");
        },
      },
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 102,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(evCursos).toHaveLength(3);
      expect(evCursos[0].resultado).toBe("ok");
      expect(evCursos[1].resultado).toBe("fallido");
      expect(evCursos[1].motivo).toContain("curso");
      expect(evCursos[2].resultado).toBe("ok");

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("22. un curso con [data-no-topic-items] y sin posts resulta en curso vacio", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO456: (html) => {
          return html
            .replace(
              /<c-wiz id="vista-trabajo"[^>]*>[\s\S]*?<\/c-wiz>/,
              '<c-wiz id="vista-trabajo" aria-hidden="true"><div data-no-topic-items="true">No hay publicaciones</div></c-wiz>'
            )
            .replace(
              /<c-wiz id="vista-novedades"[^>]*>[\s\S]*?<\/c-wiz>/,
              '<c-wiz id="vista-novedades"><div data-stream-item-id="post-vacio"><h2>Bienvenida</h2></div></c-wiz>'
            );
        },
      },
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 103,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(evCursos).toHaveLength(3);
      expect(evCursos[1].resultado).toBe("vacio");

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("23. tope por curso: curso que nunca pinta es fallido 'superó...' y el siguiente se escanea bien sin residuales", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO123: (html) => {
          return html
            .replace(/data-stream-item-id/g, "data-ignorado")
            .replace(/data-no-topic-items/g, "data-ignorado");
        },
      },
    });

    const tiemposConNavegacionLarga = { ...TIEMPOS_TEST, navegacion: 1500 };
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 104,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: tiemposConNavegacionLarga,
        topeCursoMs: 600,
      });

      expect(res.recorrido).toBe(true);
      const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(evCursos).toHaveLength(3);
      expect(evCursos[0].resultado).toBe("fallido");
      expect(evCursos[0].motivo).toMatch(/superó \d+ s/);
      expect(evCursos[1].resultado).toBe("ok");
      for (const e of evCursos[1].enlaces) {
        expect(e.modulo.startsWith("Química I › ")).toBe(true);
      }
    } finally {
      limpiar();
    }
  });

  it("24. sin opciones de modo: escaneo de curso idéntico a hoy y sendMessage no se llama", async () => {
    prepararDom();
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    const sendMessageSpy = vi.fn();
    globalThis.chrome.runtime.sendMessage = sendMessageSpy;

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    expect(sendMessageSpy).not.toHaveBeenCalled();
    expect(res.enlaces.length).toBeGreaterThan(0);
    expect(res.aviso).toBeUndefined();
  });
});

