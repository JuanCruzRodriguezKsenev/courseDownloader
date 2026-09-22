// @vitest-environment jsdom
/**
 * Tests del scraper de Google Classroom contra un fixture HTML sintético.
 * Verifica la navegación entre vistas, apertura de ítems, Ver más, deduplicación,
 * clasificación de adjuntos y manejo de avisos de corte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import htmlFixture from "./__fixtures__/curso.html?raw";
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

    setTimeout(() => {
      const a = li.querySelector("a");
      if (a) {
        a.setAttribute("aria-label", "Archivo adjunto: PDF: Lento.pdf");
        a.setAttribute("href", "https://drive.google.com/file/d/drive-lento/view");
      }
    }, 50);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

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
});

