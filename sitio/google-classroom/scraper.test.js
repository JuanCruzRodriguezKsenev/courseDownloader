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
  asentadoVacio: 30,
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

  it("5b. los enlaces conservan el título de la publicación de donde salen (RN-7a)", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    const tp1 = res.enlaces.find((e) => e.texto === "TP1.pdf");
    expect(tp1).toBeDefined();
    expect(tp1?.publicacion).toBe("TP 1");

    const videoDrive = res.enlaces.find((e) => e.texto === "Grabacion Teoria.mp4.md");
    expect(videoDrive).toBeDefined();
    expect(videoDrive?.publicacion).toBe("Clase 1");
  });

  it("5c. los enlaces de Novedades conservan el texto del anuncio (RN-16a)", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    const cronograma = res.enlaces.find((e) => e.texto === "Cronograma.pdf");
    expect(cronograma).toBeDefined();
    expect(cronograma?.anuncio).toBe("Buenos días,\nles dejamos el cronograma del parcial.\nSaludos");
    expect(cronograma?.publicacion).toBe("Aviso de Parcial");

    const tp1 = res.enlaces.find((e) => e.texto === "TP1.pdf");
    expect(tp1).toBeDefined();
    expect(tp1?.anuncio).toBeUndefined();
  });

  it("5d. los enlaces conservan cursoId, cursoNombre y tema (D-1)", async () => {
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    // Trabajo en clase
    const tp1 = res.enlaces.find((e) => e.texto === "TP1.pdf");
    expect(tp1).toBeDefined();
    expect(tp1?.cursoId).toBe("CURSO123");
    expect(tp1?.cursoNombre).toBe("Física II");
    expect(tp1?.tema).toBe("Trabajos Practicos");
    expect(tp1?.modulo).toBe("Física II › Trabajos Practicos");

    // Novedades
    const cronograma = res.enlaces.find((e) => e.texto === "Cronograma.pdf");
    expect(cronograma).toBeDefined();
    expect(cronograma?.cursoId).toBe("CURSO123");
    expect(cronograma?.cursoNombre).toBe("Física II");
    expect(cronograma?.tema).toBe("Novedades");
    expect(cronograma?.modulo).toBe("Física II › Novedades");
  });

  it("5e. ignora enlaces a meet.google.com porque son reuniones efímeras", async () => {
    const region = document.querySelector('#vista-trabajo div[role="region"]');
    const li = document.createElement("li");
    li.setAttribute("data-stream-item-id", "item-meet");
    li.setAttribute("data-expandable-row-id", "row-meet");
    li.innerHTML = `
      <div role="button" aria-expanded="true" aria-label="Consulta Meet"></div>
      <div data-attachment-id="att-meet-vinculo">
        <a aria-label="Archivo adjunto: Vínculo a https://meet.google.com/abc-defg-hij" href="https://meet.google.com/abc-defg-hij"></a>
      </div>
      <div data-attachment-id="att-meet-directo">
        <a aria-label="Archivo adjunto: Reunión en vivo" href="https://meet.google.com/xyz-uvw-rst"></a>
      </div>
    `;
    region.appendChild(li);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const meet = res.enlaces.find(
      (e) => e.href?.includes("meet.google.com") || e.texto?.includes("meet.google.com")
    );
    expect(meet).toBeUndefined();
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

  function simularNavegacionClassroom({ hooksPorCurso = {}, demoraNavMs = 0 } = {}) {
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    const mensajesEnviados = [];
    let reloj = 0;
    const navegaciones = [];
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      mensajesEnviados.push({ ...msg, orden: ++reloj, timestamp: Date.now() });
    });

    let timerArchivadas = null;

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

      navegaciones.push({ href, orden: ++reloj, timestamp: Date.now() });

      if (timerArchivadas) {
        clearTimeout(timerArchivadas);
        timerArchivadas = null;
      }

      if (href.endsWith("/h") || href.endsWith("/h/st")) {
        cargarPagina(portadaHtml, `https://classroom.google.com${href}`);
      } else if (href.endsWith("/h/archived")) {
        const htmlSinActiva = archivadasHtml.replace(
          /<c-wiz>[\s\S]*?<\/c-wiz>\s*<\/body>/,
          "</body>"
        );
        cargarPagina(htmlSinActiva, `https://classroom.google.com${href}`);
        timerArchivadas = setTimeout(() => {
          timerArchivadas = null;
          cargarPagina(archivadasHtml, `https://classroom.google.com${href}`);
        }, 50);
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
        if (demoraNavMs > 0) {
          const htmlSinNav = htmlCurso.replace(/<nav>[\s\S]*?<\/nav>/, "<nav></nav>");
          cargarPagina(htmlSinNav, `https://classroom.google.com/u/2/c/${id}`);
          setTimeout(() => {
            const nav = document.querySelector("nav");
            if (nav) {
              const divTemp = document.createElement("div");
              divTemp.innerHTML = htmlCurso;
              const nuevoNav = divTemp.querySelector("nav");
              if (nuevoNav) {
                nav.innerHTML = nuevoNav.innerHTML;
              }
            }
            prepararInteractividadCurso();
          }, demoraNavMs);
        } else {
          cargarPagina(htmlCurso, `https://classroom.google.com/u/2/c/${id}`);
          prepararInteractividadCurso();
        }
      }
    };

    document.addEventListener("click", handlerClick);
    cargarPagina(portadaHtml, "https://classroom.google.com/u/2/h");

    return {
      mensajesEnviados,
      navegaciones,
      limpiar: () => {
        if (timerArchivadas) {
          clearTimeout(timerArchivadas);
          timerArchivadas = null;
        }
        document.removeEventListener("click", handlerClick);
      },
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
      const tipos = mensajesEnviados.map((m) => m.tipo).filter((t) => t !== "progreso");
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
      expect(evInicio.cursos.map((c) => c.nombre)).toEqual([
        "Física II",
        "Química I",
        "Matemática Discreta",
      ]);

      const cursosOk = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(cursosOk).toHaveLength(3);
      expect(cursosOk[0].resultado).toBe("ok");
      expect(cursosOk[0].enlaces[0].modulo).toContain("Física II ›");
      expect(cursosOk[0].enlaces[0].cursoId).toBe(evInicio.cursos[0].id);
      expect(cursosOk[1].resultado).toBe("ok");
      expect(cursosOk[1].enlaces[0].modulo).toContain("Química I ›");
      expect(cursosOk[1].enlaces[0].cursoId).toBe(evInicio.cursos[1].id);
      expect(cursosOk[2].resultado).toBe("ok");
      expect(cursosOk[2].enlaces[0].modulo).toContain("Matemática Discreta ›");
      expect(cursosOk[2].enlaces[0].cursoId).toBe(evInicio.cursos[2].id);

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("20. visibilityState pasa a hidden durante el curso 2: hay 1 curso ok y fin cortado visibilidad", async () => {
    const { mensajesEnviados, navegaciones, limpiar } = simularNavegacionClassroom({
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
      const tipos = mensajesEnviados.map((m) => m.tipo).filter((t) => t !== "progreso");
      expect(tipos).toEqual(["inicio", "latido", "curso", "latido", "fin"]);

      const evCursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(evCursos).toHaveLength(1);
      expect(evCursos[0].indice).toBe(0);
      expect(evCursos[0].resultado).toBe("ok");

      const evFin = mensajesEnviados.at(-1);
      expect(evFin.estado).toBe("cortado");
      expect(evFin.motivoCorte).toBe("visibilidad");

      // 35. Corte por visibilidad no navega a /h
      const navH = navegaciones.filter((n) => n.href.endsWith("/h"));
      expect(navH).toHaveLength(0);
      expect(window.location.pathname).not.toMatch(/\/h\/?$/);
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
    const topeCursoMs = 800;
    let timerPintadoTardio = null;
    const { mensajesEnviados, navegaciones, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO123: (html) => {
          const htmlSinItems = html
            .replace(/data-stream-item-id/g, "data-ignorado")
            .replace(/data-no-topic-items/g, "data-ignorado");
          timerPintadoTardio = setTimeout(() => {
            const items = document.querySelectorAll("[data-ignorado]");
            for (const el of items) {
              el.setAttribute("data-stream-item-id", el.getAttribute("data-ignorado"));
            }
          }, topeCursoMs + 100);
          return htmlSinItems;
        },
        CURSO456: (html) => {
          return html.replace(
            '<a href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>',
            '<a aria-current="page" href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>'
          );
        },
      },
    });

    const tiemposConNavegacionLarga = { ...TIEMPOS_TEST, navegacion: 2000 };
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 104,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: tiemposConNavegacionLarga,
        topeCursoMs,
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

      const evLatidoCurso2 = mensajesEnviados.find((m) => m.tipo === "latido" && m.indice === 1);
      expect(evLatidoCurso2).toBeDefined();

      const navsCurso123PostLatido2 = navegaciones.filter(
        (n) => n.href.includes("CURSO123") && n.orden > evLatidoCurso2.orden
      );
      expect(navsCurso123PostLatido2).toHaveLength(0);
    } finally {
      if (timerPintadoTardio) clearTimeout(timerPintadoTardio);
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

  it("25. vista con marcador de vacío que recibe 11 li a los 60 ms espera el asentado y trae los enlaces", async () => {
    const htmlInicial = `
      <title>Trabajo en clase de Física II - Classroom</title>
      <nav>
        <a href="/u/2/c/CURSO123">Novedades</a>
        <a href="/u/2/w/CURSO123/t/all">Trabajo en clase</a>
        <a aria-current="page" href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>
      </nav>
      <c-wiz id="vista-trabajo">
        <div data-no-topic-items>No hay publicaciones</div>
        <div role="region" aria-label="Tema 1">
          <ul id="lista-items"></ul>
        </div>
      </c-wiz>
      <c-wiz id="vista-novedades" aria-hidden="true">
        <div data-stream-item-id="post-vacio"></div>
      </c-wiz>
    `;
    prepararDom(htmlInicial, "https://classroom.google.com/u/2/w/CURSO123/t/all");

    setTimeout(() => {
      const ul = document.getElementById("lista-items");
      if (ul) {
        for (let i = 1; i <= 11; i++) {
          const li = document.createElement("li");
          li.setAttribute("data-stream-item-id", `item-${i}`);
          li.innerHTML = `
            <div role="button" aria-expanded="true" aria-label="TP ${i}"></div>
            <div data-attachment-id="att-${i}">
              <a aria-label="Archivo adjunto: PDF: TP${i}.pdf" href="https://drive.google.com/file/d/drive-tp-${i}/view"></a>
            </div>
          `;
          ul.appendChild(li);
        }
      }
    }, 60);

    const res = await ScraperClassroom.escanearListado({
      tiempos: { ...TIEMPOS_TEST, asentadoVacio: 200, pintado: 2000 },
    });

    expect(res.aviso).toBeUndefined();
    expect(res.enlaces).toHaveLength(11);
  });

  it("26. marcador con progressbar que se quita a los 80 ms con llegada de li trae los enlaces", async () => {
    const htmlInicial = `
      <title>Trabajo en clase de Física II - Classroom</title>
      <nav>
        <a href="/u/2/c/CURSO123">Novedades</a>
        <a href="/u/2/w/CURSO123/t/all">Trabajo en clase</a>
        <a aria-current="page" href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>
      </nav>
      <c-wiz id="vista-trabajo">
        <div data-no-topic-items>No hay publicaciones</div>
        <div role="progressbar"></div>
        <div role="region" aria-label="Tema 1">
          <ul id="lista-items"></ul>
        </div>
      </c-wiz>
      <c-wiz id="vista-novedades" aria-hidden="true">
        <div data-stream-item-id="post-vacio"></div>
      </c-wiz>
    `;
    prepararDom(htmlInicial, "https://classroom.google.com/u/2/w/CURSO123/t/all");

    setTimeout(() => {
      const pb = document.querySelector('[role="progressbar"]');
      if (pb) pb.remove();
      const ul = document.getElementById("lista-items");
      if (ul) {
        for (let i = 1; i <= 5; i++) {
          const li = document.createElement("li");
          li.setAttribute("data-stream-item-id", `item-${i}`);
          li.innerHTML = `
            <div role="button" aria-expanded="true" aria-label="TP ${i}"></div>
            <div data-attachment-id="att-${i}">
              <a aria-label="Archivo adjunto: PDF: TP${i}.pdf" href="https://drive.google.com/file/d/drive-tp-${i}/view"></a>
            </div>
          `;
          ul.appendChild(li);
        }
      }
    }, 80);

    const res = await ScraperClassroom.escanearListado({
      tiempos: { ...TIEMPOS_TEST, asentadoVacio: 200, pintado: 2000 },
    });

    expect(res.aviso).toBeUndefined();
    expect(res.enlaces).toHaveLength(5);
  });

  it("27. demora en montar nav: espera a que aparezca nav del curso y sale ok", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      demoraNavMs: 50,
    });
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 105,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const cursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(cursos.length).toBeGreaterThan(0);
      expect(cursos[0].resultado).toBe("ok");
    } finally {
      limpiar();
    }
  });

  it("28. con demora de 50 ms en archivadas, el inicio trae los 3 cursos", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 106,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const evInicio = mensajesEnviados[0];
      expect(evInicio.cursos).toHaveLength(3);
    } finally {
      limpiar();
    }
  });

  it("29. serialización: sendMessage simulado que tarda 300 ms y cuenta envíos en vuelo; recorrido con progreso -> en vuelo nunca > 1 y orden respeta latido -> progreso -> curso", async () => {
    let enVuelo = 0;
    let maxEnVuelo = 0;
    const mensajesEnviados = [];
    let reloj = 0;

    const { limpiar } = simularNavegacionClassroom();
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      enVuelo++;
      if (enVuelo > maxEnVuelo) maxEnVuelo = enVuelo;
      await new Promise((resolve) => setTimeout(resolve, 300)); // con 20 ms el control negativo (progreso fuera de la cola) no fallaba
      mensajesEnviados.push({ ...msg, orden: ++reloj, timestamp: Date.now() });
      enVuelo--;
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 100,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: { ...TIEMPOS_TEST, asentadoVacio: 550, pintado: 2000 },
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      expect(maxEnVuelo).toBe(1);

      const progresos = mensajesEnviados.filter((m) => m.tipo === "progreso");
      expect(progresos.length).toBeGreaterThan(0);

      const relevantes = mensajesEnviados
        .filter((m) => m.tipo === "latido" || m.tipo === "progreso" || m.tipo === "curso" || m.tipo === "fin");

      for (let i = 0; i < relevantes.length - 1; i++) {
        const actual = relevantes[i].tipo;
        const siguiente = relevantes[i + 1].tipo;
        if (actual === "latido") {
          expect(["progreso", "curso"]).toContain(siguiente);
        } else if (actual === "progreso") {
          expect(["progreso", "curso"]).toContain(siguiente);
        } else if (actual === "curso") {
          expect(["latido", "fin"]).toContain(siguiente);
        }
      }
    } finally {
      limpiar();
    }
  }, 15000);

  it("30. en modo todos llegan eventos progreso con fase trabajo y novedades para un curso con material, y ninguno llega después de curso", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 102,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: { ...TIEMPOS_TEST, vuelta: 200 },
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const progresos = mensajesEnviados.filter((m) => m.tipo === "progreso");
      expect(progresos.length).toBeGreaterThan(0);

      const fases = progresos.map((p) => p.fase);
      expect(fases).toContain("trabajo");
      expect(fases).toContain("novedades");

      for (const p of progresos) {
        const idxCurso = mensajesEnviados.findIndex(
          (m) => m.tipo === "curso" && m.indice === p.indice
        );
        const idxProgreso = mensajesEnviados.indexOf(p);
        expect(idxProgreso).toBeLessThan(idxCurso);
      }
    } finally {
      limpiar();
    }
  }, 15000);

  it("31. modo un curso con idEscaneo emite escaneo_progreso con idEscaneo, fases en orden y nombre; sin idEscaneo cero escaneo_progreso", async () => {
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    const recibidosConId = [];
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      recibidosConId.push(msg);
    });

    await ScraperClassroom.escanearListado({
      idEscaneo: 7,
      tiempos: { ...TIEMPOS_TEST, asentadoVacio: 50, pintado: 100, vuelta: 550 },
    });

    const progresos7 = recibidosConId.filter((m) => m.action === "escaneo_progreso");
    expect(progresos7.length).toBeGreaterThan(0);
    expect(progresos7.every((p) => p.idEscaneo === 7)).toBe(true);
    expect(progresos7.some((p) => p.nombre === "Física II")).toBe(true);

    const recibidosSinId = [];
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      recibidosSinId.push(msg);
    });

    await ScraperClassroom.escanearListado({
      tiempos: TIEMPOS_TEST,
    });

    const progresosSin = recibidosSinId.filter((m) => m.action === "escaneo_progreso");
    expect(progresosSin).toHaveLength(0);
  }, 15000);

  it("32. frecuencia: progresos enviados están separados >= 500 ms entre sí", async () => {
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    const envios = [];
    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      if (msg.action === "escaneo_progreso") {
        envios.push({ msg, t: Date.now() });
      }
    });

    const region = document.querySelector('div[role="region"]');
    const btnVerMas = document.querySelector('button[aria-label="Ver más publicaciones"]');
    let clicks = 0;
    if (btnVerMas && region) {
      btnVerMas.getClientRects = () => [{ width: 100, height: 30 }];
      btnVerMas.addEventListener("click", () => {
        clicks++;
        if (clicks <= 10) {
          const li = document.createElement("li");
          li.setAttribute("data-stream-item-id", `tp-extra-${clicks}`);
          li.innerHTML = `<div>Item extra ${clicks}</div>`;
          region.appendChild(li);
        }
      });
    }

    await ScraperClassroom.escanearListado({
      idEscaneo: 99,
      tiempos: { ...TIEMPOS_TEST, asentadoVacio: 550, verMas: 50, vuelta: 5 },
    });

    await new Promise((r) => setTimeout(r, 600));

    expect(envios.length).toBeGreaterThan(1);
    for (let i = 0; i < envios.length - 1; i++) {
      const delta = envios[i + 1].t - envios[i].t;
      expect(delta).toBeGreaterThanOrEqual(490);
    }
  });

  it("33. al terminar el recorrido de test 19, location.pathname termina en /h y el último mensaje es fin terminado", async () => {
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
      expect(window.location.pathname).toMatch(/\/h\/?$/);
      const evFin = mensajesEnviados.at(-1);
      expect(evFin.tipo).toBe("fin");
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("34. sin link /h en el nav: el recorrido igual manda fin terminado", async () => {
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom({
      hooksPorCurso: {
        CURSO789: (html) => {
          return html.replace(/<a href="\/u\/2\/h">Clases<\/a>/g, "");
        },
      },
    });
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 104,
        tabId: 1,
        sitioId: "google-classroom",
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const evFin = mensajesEnviados.at(-1);
      expect(evFin.tipo).toBe("fin");
      expect(evFin.estado).toBe("terminado");
    } finally {
      limpiar();
    }
  });

  it("36. curso lleva duracionMs numérico >= 0 en ok, vacío y fallido; inicio lleva lanzadoEn", async () => {
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
        CURSO789: (html) => {
          return html.replace(/<nav>[\s\S]*?<\/nav>/, "<nav></nav>");
        },
      },
    });
    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 105,
        tabId: 1,
        sitioId: "google-classroom",
        lanzadoEn: 987654321,
        tiempos: TIEMPOS_TEST,
        topeCursoMs: 5000,
      });

      expect(res.recorrido).toBe(true);
      const evInicio = mensajesEnviados.find((m) => m.tipo === "inicio");
      expect(evInicio.lanzadoEn).toBe(987654321);

      const cursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(cursos.length).toBeGreaterThanOrEqual(3);

      expect(cursos[0].resultado).toBe("ok");
      expect(typeof cursos[0].duracionMs).toBe("number");
      expect(cursos[0].duracionMs).toBeGreaterThanOrEqual(0);

      expect(cursos[1].resultado).toBe("vacio");
      expect(typeof cursos[1].duracionMs).toBe("number");
      expect(cursos[1].duracionMs).toBeGreaterThanOrEqual(0);

      expect(cursos[2].resultado).toBe("fallido");
      expect(typeof cursos[2].duracionMs).toBe("number");
      expect(cursos[2].duracionMs).toBeGreaterThanOrEqual(0);
    } finally {
      limpiar();
    }
  });

  const VISTA_OTRO_CURSO_HTML = `
<c-wiz id="vista-otro-curso" aria-hidden="true">
  <a href="/u/2/c/OTRO999/sp/xyz/all/default">Ver tus trabajos</a>
  <div role="region" aria-label="Tema Viejo">
    <li data-stream-item-id="viejo-1" data-expandable-row-id="row-viejo-1">
      <div role="button" aria-expanded="true" aria-label="Material Viejo"></div>
      <a href="/u/2/c/OTRO999/m/m1/details">Material Viejo</a>
      <div data-attachment-id="att-viejo">
        <a aria-label="Archivo adjunto: PDF: Viejo.pdf" href="https://drive.google.com/file/d/drive-viejo/view"></a>
      </div>
    </li>
  </div>
</c-wiz>
`;

  it("37. Trabajo: la vista de otro curso que queda visible un instante no se lee", async () => {
    const htmlConOtroCurso = htmlFixture.replace(
      '<c-wiz id="vista-trabajo">',
      `${VISTA_OTRO_CURSO_HTML}\n  <c-wiz id="vista-trabajo">`
    );
    prepararDom(htmlConOtroCurso, "https://classroom.google.com/u/2/c/CURSO123");
    document.getElementById("vista-trabajo")?.setAttribute("aria-hidden", "true");
    document.getElementById("vista-novedades")?.removeAttribute("aria-hidden");

    let primerClic = true;
    const clickHandler = (e) => {
      const a = e.target.closest('a[href="/u/2/w/CURSO123/t/all"]');
      if (a && primerClic) {
        primerClic = false;
        e.preventDefault();
        e.stopPropagation();
        document.getElementById("vista-novedades")?.setAttribute("aria-hidden", "true");
        document.getElementById("vista-otro-curso")?.removeAttribute("aria-hidden");
        window.location.pathname = "/u/2/w/CURSO123/t/all";
        setTimeout(() => {
          document.getElementById("vista-otro-curso")?.setAttribute("aria-hidden", "true");
          document.getElementById("vista-trabajo")?.removeAttribute("aria-hidden");
        }, 150);
      }
    };
    document.addEventListener("click", clickHandler, true);
    try {
      const res = await ScraperClassroom.escanearListado({
        tiempos: { ...TIEMPOS_TEST, navegacion: 1000, pintado: 1000 },
      });
      expect(res.motivoAviso).toBeUndefined();
      expect(res.aviso).toBeUndefined();
      expect(res.enlaces.some((e) => e.idArchivo === "drive-sin-tema")).toBe(true);
      expect(res.enlaces.some((e) => e.idArchivo === "drive-viejo")).toBe(false);
    } finally {
      document.removeEventListener("click", clickHandler, true);
    }
  });

  it("38. Novedades: con ningún c-wiz visible no se lee el body", async () => {
    const htmlConOtroCurso = htmlFixture.replace(
      '<c-wiz id="vista-trabajo">',
      `${VISTA_OTRO_CURSO_HTML}\n  <c-wiz id="vista-trabajo">`
    );
    prepararDom(htmlConOtroCurso, "https://classroom.google.com/u/2/w/CURSO123/t/all");

    let primerClic = true;
    const clickHandler = (e) => {
      const a = e.target.closest('a[href="/u/2/c/CURSO123"]');
      if (a && primerClic) {
        primerClic = false;
        e.preventDefault();
        e.stopPropagation();
        for (const cwiz of document.querySelectorAll("body > c-wiz")) {
          cwiz.setAttribute("aria-hidden", "true");
        }
        window.location.pathname = "/u/2/c/CURSO123";
        setTimeout(() => {
          document.getElementById("vista-novedades")?.removeAttribute("aria-hidden");
        }, 150);
      }
    };
    document.addEventListener("click", clickHandler, true);
    try {
      const res = await ScraperClassroom.escanearListado({
        tiempos: { ...TIEMPOS_TEST, navegacion: 1000, pintado: 1000 },
      });
      expect(res.motivoAviso).toBeUndefined();
      expect(res.enlaces.some((e) => e.idArchivo === "drive-viejo")).toBe(false);
    } finally {
      document.removeEventListener("click", clickHandler, true);
    }
  });

  // El DOM real de Classroom (medido 2026-09-27): la <nav> lateral tiene overflow-y:auto pero NO
  // scrollea; el que scrollea es el documento, y Novedades carga 10 publicaciones más por scroll.
  function simularNovedadesPaginadas({ paginas = 3, porPagina = 2 } = {}) {
    const nav = document.querySelector("nav");
    nav.style.overflowY = "auto";
    Object.defineProperty(nav, "scrollHeight", { configurable: true, get: () => 806 });
    Object.defineProperty(nav, "clientHeight", { configurable: true, get: () => 806 });

    const doc = document.documentElement;
    Object.defineProperty(document, "scrollingElement", { configurable: true, get: () => doc });
    let cargadas = 0;
    Object.defineProperty(doc, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: () => {
        const vista = document.getElementById("vista-novedades");
        if (!vista || vista.hasAttribute("aria-hidden") || cargadas >= paginas) return;
        cargadas++;
        const n = cargadas;
        setTimeout(() => {
          for (let i = 1; i <= porPagina; i++) {
            const post = document.createElement("div");
            post.setAttribute("data-stream-item-id", `post-pag-${n}-${i}`);
            post.innerHTML = `
              <h2>Publicación ${n}.${i}</h2>
              <div data-attachment-id="att-pag-${n}-${i}">
                <a aria-label="Archivo adjunto: PDF: Pagina${n}_${i}.pdf" href="https://drive.google.com/file/d/drive-pag-${n}-${i}/view"></a>
              </div>`;
            vista.appendChild(post);
          }
        }, 1);
      },
    });
    return () => cargadas;
  }

  it("39. Novedades: scrollea el documento aunque la <nav> tenga overflow-y:auto, y lee todas las páginas", async () => {
    const obtenerCargadas = simularNovedadesPaginadas();
    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
    const ids = res.enlaces.map((e) => e.idArchivo);
    expect(ids).toContain("drive-cronograma");
    for (let n = 1; n <= 3; n++) {
      for (let i = 1; i <= 2; i++) {
        expect(ids).toContain(`drive-pag-${n}-${i}`);
      }
    }
    expect(obtenerCargadas()).toBe(3);
  });

  it("40. un contenedor que scrollea de verdad se prefiere al documento", async () => {
    const scroller = document.createElement("div");
    scroller.id = "scroller";
    scroller.style.overflowY = "auto";
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, get: () => 5000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, get: () => 600 });
    let scrollCount = 0;
    Object.defineProperty(scroller, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: () => {
        scrollCount++;
      },
    });
    document.body.appendChild(scroller);

    try {
      await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });
      expect(scrollCount).toBeGreaterThan(0);
    } finally {
      scroller.remove();
    }
  });

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

  it("41. S1: cancelar recorrido de 3 cursos en el latido de curso 1 corta y emite fin cortado cancelado", async () => {
    const mockMsg = mockOnMessage();
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    const responder = vi.fn();
    const originalSend = globalThis.chrome.runtime.sendMessage;

    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      await originalSend(msg);
      if (msg.action === "recorrido_evento" && msg.tipo === "latido" && msg.indice === 1) {
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 100 }, responder);
      }
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 100,
        tiempos: TIEMPOS_TEST,
      });

      expect(res.cancelado).toBe(true);
      const cursos = mensajesEnviados.filter((m) => m.tipo === "curso");
      expect(cursos).toHaveLength(1);
      expect(cursos[0].indice).toBe(0);
      expect(cursos[0].resultado).toBe("ok");
      expect(cursos.some((c) => c.indice >= 1)).toBe(false);

      const ultimo = mensajesEnviados.at(-1);
      expect(ultimo.tipo).toBe("fin");
      expect(ultimo.estado).toBe("cortado");
      expect(ultimo.motivoCorte).toBe("cancelado");

      expect(location.pathname.endsWith("/h")).toBe(false);
      expect(mockMsg.removeListener).toHaveBeenCalledWith(mockMsg.addListener.mock.calls[0][0]);
      expect(responder).toHaveBeenCalledWith({ ok: true });
    } finally {
      limpiar();
      delete globalThis.chrome?.runtime?.onMessage;
    }
  });

  it("42. S2: cancelar antes de que termine la enumeración envía fin cortado cancelado sin inicio", async () => {
    const mockMsg = mockOnMessage();
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    mockMsg.addListener.mockImplementation((fn) => {
      setTimeout(() => {
        fn({ action: "cancelar_escaneo", idRecorrido: 200 }, {}, vi.fn());
      }, 5);
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 200,
        tiempos: TIEMPOS_TEST,
      });

      expect(res.cancelado).toBe(true);
      const inicios = mensajesEnviados.filter((m) => m.tipo === "inicio");
      expect(inicios).toHaveLength(0);

      const fines = mensajesEnviados.filter((m) => m.tipo === "fin");
      expect(fines).toHaveLength(1);
      expect(fines[0].estado).toBe("cortado");
      expect(fines[0].motivoCorte).toBe("cancelado");
    } finally {
      limpiar();
      delete globalThis.chrome?.runtime?.onMessage;
    }
  });

  it("43. S3: cancelar un curso con idEscaneo al primer escaneo_progreso resuelve en < 200 ms", async () => {
    const mockMsg = mockOnMessage();
    globalThis.chrome = globalThis.chrome || {};
    globalThis.chrome.runtime = globalThis.chrome.runtime || {};
    let tOrden = 0;
    let tResolvio = 0;

    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      if (msg.action === "escaneo_progreso" && tOrden === 0) {
        tOrden = Date.now();
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idEscaneo: 7 });
      }
    });

    try {
      const p = ScraperClassroom.escanearListado({ idEscaneo: 7, tiempos: TIEMPOS_TEST });
      const res = await p;
      tResolvio = Date.now();
      expect(res.cancelado).toBe(true);
      expect(res.enlaces).toEqual([]);
      expect(tOrden).toBeGreaterThan(0);
      expect(tResolvio - tOrden).toBeLessThan(200);
    } finally {
      delete globalThis.chrome?.runtime?.onMessage;
    }
  });

  it("44. S4: cancelar_escaneo con otro idRecorrido no hace nada", async () => {
    const mockMsg = mockOnMessage();
    const { mensajesEnviados, limpiar } = simularNavegacionClassroom();
    const responder = vi.fn();
    const originalSend = globalThis.chrome.runtime.sendMessage;

    globalThis.chrome.runtime.sendMessage = vi.fn(async (msg) => {
      await originalSend(msg);
      if (msg.action === "recorrido_evento" && msg.tipo === "latido" && msg.indice === 1) {
        mockMsg.dispararCancelar({ action: "cancelar_escaneo", idRecorrido: 99999 }, responder);
      }
    });

    try {
      const res = await ScraperClassroom.escanearListado({
        modo: "todos",
        idRecorrido: 300,
        tiempos: TIEMPOS_TEST,
      });

      expect(responder).not.toHaveBeenCalled();
      const ultimo = mensajesEnviados.at(-1);
      expect(ultimo.tipo).toBe("fin");
      expect(ultimo.estado).toBe("terminado");
      expect(res.cancelado).toBeFalsy();
    } finally {
      limpiar();
      delete globalThis.chrome?.runtime?.onMessage;
    }
  });
});



