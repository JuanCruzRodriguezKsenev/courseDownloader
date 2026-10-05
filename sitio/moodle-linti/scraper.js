/**
 * ADAPTADOR DE SITIO — MOODLE LINTI: SCRAPER (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [MOODLE CORTE 2] Scraper de Moodle del LINTI (catedras.linti.unlp.edu.ar).
 *   Soporta actividades resource, folder y url. Corre inyectado en la pestaña
 *   y resuelve carpetas y páginas intermedias con sesión del navegador.
 * ==========================================================================
 *
 * NOTA DE ARQUITECTURA:
 * Este módulo se inyecta serializado en la pestaña del navegador vía
 * chrome.scripting. No debe importar módulos externos ni depender de
 * variables globales de la extensión.
 */

/**
 * Escanea el listado de actividades de un curso de Moodle del LINTI.
 *
 * @param {object} [opciones]
 * @returns {Promise<{ materia: string, enlaces: Array<object>, aviso?: string, motivoAviso?: string }>}
 */
async function escanearListado(_opciones = {}) {
  const doc = document;
  const win = window;

  // 1. Detección de sesión vencida / pantalla de login
  const pathActual = (win.location && win.location.pathname) || "";
  const esLogin =
    pathActual.startsWith("/login/") ||
    Boolean(doc.body && doc.body.classList && doc.body.classList.contains("path-login")) ||
    Boolean(doc.getElementById("page-login-index"));

  if (esLogin) {
    return {
      materia: "",
      enlaces: [],
      aviso: "La sesión en Moodle ha vencido o no está iniciada",
      motivoAviso: "sesion",
    };
  }

  // 2. Metadatos del curso
  let cursoId = "";
  try {
    const params = new URLSearchParams(win.location ? win.location.search : "");
    cursoId = params.get("id") || "";
  } catch {
    cursoId = "";
  }

  const h1El = doc.querySelector(".page-header-headings h1, #page-header h1, h1");
  const cursoNombre = h1El ? h1El.textContent.trim().replace(/\s+/g, " ") : "";

  // 3. Localizar las secciones dentro de la región principal del curso
  // Usamos selectores que evitan el índice lateral (sidebar treeview)
  let secciones = Array.from(
    doc.querySelectorAll(
      "#region-main li.course-section[data-for='section'], ul[data-for='course_sectionlist'] > li[data-for='section'], li.course-section[data-for='section']"
    )
  );

  if (secciones.length === 0) {
    secciones = Array.from(doc.querySelectorAll("li[data-for='section']"));
  }

  const tareasActividades = [];

  for (let idxSeccion = 0; idxSeccion < secciones.length; idxSeccion++) {
    const seccionEl = secciones[idxSeccion];

    let nombreSeccion =
      seccionEl.getAttribute("data-sectionname") ||
      seccionEl.querySelector("h3.sectionname a, h3.sectionname, [data-for='section_title'] a")?.textContent ||
      "";
    nombreSeccion = nombreSeccion.trim().replace(/\s+/g, " ");

    const numSec = seccionEl.getAttribute("data-number");
    let tema = nombreSeccion;
    if (
      numSec === "0" ||
      idxSeccion === 0 ||
      nombreSeccion.toLowerCase() === "general" ||
      !nombreSeccion
    ) {
      tema = "Sin tema";
    }

    const itemsCm = Array.from(seccionEl.querySelectorAll("li[data-for='cmitem']"));

    for (const cmEl of itemsCm) {
      const className = cmEl.className || "";

      let tipo = null;
      if (className.includes("modtype_resource")) {
        tipo = "resource";
      } else if (className.includes("modtype_folder")) {
        tipo = "folder";
      } else if (className.includes("modtype_url")) {
        tipo = "url";
      }

      // Ignorar actividades fuera de alcance (forum, quiz, page, choice, etc.)
      if (!tipo) continue;

      const cmid =
        cmEl.getAttribute("data-id") ||
        (cmEl.id ? (cmEl.id.match(/^module-(\d+)$/) || [])[1] : null);

      if (!cmid) continue;

      let nombreActividad = "";
      const actCard = cmEl.querySelector("[data-activityname]");
      if (actCard && actCard.getAttribute("data-activityname")) {
        nombreActividad = actCard.getAttribute("data-activityname").trim().replace(/\s+/g, " ");
      } else {
        const linkNombre = cmEl.querySelector(".activityname .instancename, .activityname a");
        if (linkNombre) {
          const clon = linkNombre.cloneNode(true);
          const ocultos = clon.querySelectorAll(".accesshide");
          for (let i = 0; i < ocultos.length; i++) {
            ocultos[i].remove();
          }
          nombreActividad = clon.textContent.trim().replace(/\s+/g, " ");
        }
      }

      if (!nombreActividad) {
        nombreActividad = `Actividad ${cmid}`;
      }

      const linkEl = cmEl.querySelector(".activityname a, a.aalink");
      const href =
        linkEl && linkEl.href
          ? linkEl.href
          : `https://catedras.linti.unlp.edu.ar/mod/${tipo}/view.php?id=${cmid}`;

      tareasActividades.push({
        tipo,
        cmid: String(cmid),
        nombreActividad,
        href,
        tema,
      });
    }
  }

  // 4. Resolver cada actividad respetando el límite de concurrencia (≤ 4)
  let sesionVencida = false;

  async function procesarActividad(act) {
    if (sesionVencida) return [];

    try {
      if (act.tipo === "resource") {
        const resp = await fetch(act.href, { credentials: "include" });
        const urlFinal = resp.url || "";
        const pathname = new URL(urlFinal, win.location ? win.location.origin : undefined).pathname;

        if (pathname.startsWith("/login/")) {
          sesionVencida = true;
          return [];
        }

        if (resp.body && typeof resp.body.cancel === "function") {
          resp.body.cancel().catch(() => {});
        }

        const segmentos = pathname.split("/").filter(Boolean);
        const ultimoSegmento = segmentos[segmentos.length - 1] || `recurso_${act.cmid}.bin`;
        const texto = decodeURIComponent(ultimoSegmento);

        return [
          {
            texto,
            href: act.href,
            modulo: `${cursoNombre} › ${act.tema}`,
            tipo: "adjunto",
            idArchivo: act.cmid,
            cursoId: String(cursoId),
            cursoNombre,
            tema: act.tema,
            publicacion: act.nombreActividad,
            subcarpeta: "",
          },
        ];
      }

      if (act.tipo === "folder") {
        const resp = await fetch(act.href, { credentials: "include" });
        const urlFinal = resp.url || "";
        const pathname = new URL(urlFinal, win.location ? win.location.origin : undefined).pathname;

        if (pathname.startsWith("/login/")) {
          sesionVencida = true;
          return [];
        }

        const html = await resp.text();
        const parser = new DOMParser();
        const carpetaDoc = parser.parseFromString(html, "text/html");
        const links = Array.from(
          carpetaDoc.querySelectorAll("a[href*='pluginfile.php'][href*='mod_folder']")
        );

        const itemsFolder = [];
        for (const a of links) {
          const hrefArchivo = a.href;
          const match = hrefArchivo.match(/\/content\/\d+\/(.*?)(?:\?.*)?$/);
          if (!match) continue;

          const rutaInterna = decodeURIComponent(match[1]);
          const partesRuta = rutaInterna.split("/");
          const nombreArchivo = partesRuta[partesRuta.length - 1];
          const subcarpeta =
            partesRuta.length > 1 ? partesRuta.slice(0, partesRuta.length - 1).join("/") : "";

          itemsFolder.push({
            texto: nombreArchivo,
            href: hrefArchivo,
            modulo: `${cursoNombre} › ${act.tema}`,
            tipo: "adjunto",
            idArchivo: `${act.cmid}/${rutaInterna}`,
            cursoId: String(cursoId),
            cursoNombre,
            tema: act.tema,
            publicacion: act.nombreActividad,
            subcarpeta,
          });
        }

        return itemsFolder;
      }

      if (act.tipo === "url") {
        let destino = null;
        try {
          const resp = await fetch(act.href, { credentials: "include" });
          const urlFinal = resp.url || "";
          const pathname = new URL(urlFinal, win.location ? win.location.origin : undefined).pathname;

          if (pathname.startsWith("/login/")) {
            sesionVencida = true;
            return [];
          }

          const html = await resp.text();
          const parser = new DOMParser();
          const urlDoc = parser.parseFromString(html, "text/html");
          const workaroundLink = urlDoc.querySelector(".urlworkaround a[href]");
          if (workaroundLink && workaroundLink.href) {
            destino = workaroundLink.href;
          }
        } catch {
          // CORS o redirect opaco sin página intermedia
        }

        if (!destino) {
          destino = `https://catedras.linti.unlp.edu.ar/mod/url/view.php?id=${act.cmid}`;
        }

        const idArchivo = `acceso:${encodeURIComponent(destino)}:${encodeURIComponent(act.nombreActividad)}`;

        return [
          {
            texto: act.nombreActividad,
            href: act.href,
            modulo: `${cursoNombre} › ${act.tema}`,
            tipo: "adjunto",
            idArchivo,
            cursoId: String(cursoId),
            cursoNombre,
            tema: act.tema,
            publicacion: act.nombreActividad,
            subcarpeta: "",
          },
        ];
      }
    } catch {
      return [];
    }

    return [];
  }

  // Ejecución en pool de hasta 4 trabajadores
  const limiteConcurrencia = 4;
  const resultadosPorActividad = new Array(tareasActividades.length);
  let proximoIndice = 0;

  async function trabajador() {
    while (proximoIndice < tareasActividades.length) {
      if (sesionVencida) break;
      const indiceActual = proximoIndice++;
      resultadosPorActividad[indiceActual] = await procesarActividad(
        tareasActividades[indiceActual]
      );
    }
  }

  const promesasTrabajadores = [];
  const cantidadTrabajadores = Math.min(limiteConcurrencia, tareasActividades.length);
  for (let i = 0; i < cantidadTrabajadores; i++) {
    promesasTrabajadores.push(trabajador());
  }
  await Promise.all(promesasTrabajadores);

  if (sesionVencida) {
    return {
      materia: cursoNombre,
      enlaces: [],
      aviso: "La sesión en Moodle ha vencido o no está iniciada",
      motivoAviso: "sesion",
    };
  }

  const itemsPlanos = [];
  for (const grupo of resultadosPorActividad) {
    if (Array.isArray(grupo)) {
      for (const it of grupo) {
        itemsPlanos.push(it);
      }
    }
  }

  if (itemsPlanos.length === 0) {
    return {
      materia: "",
      enlaces: [],
      aviso: "Este curso no tiene archivos",
      motivoAviso: "sin-material",
    };
  }

  // 5. Desduplicado (RN-7)
  function normDisco(str) {
    if (!str) return "sin_nombre";
    const base = str.replace(/^.*[/\\]/, "");
    return (
      base
        .replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, "_")
        .trim()
        .toLowerCase() || "sin_nombre"
    );
  }

  function insertarAntesDeExt(nombre, sufijo) {
    const idx = nombre.lastIndexOf(".");
    if (idx > 0) {
      return nombre.slice(0, idx) + sufijo + nombre.slice(idx);
    }
    return nombre + sufijo;
  }

  // Primera vuelta: agrupar por (tema, texto normalizado)
  const grupos1 = new Map();
  for (const it of itemsPlanos) {
    const clave = `${it.tema}::${normDisco(it.texto)}`;
    if (!grupos1.has(clave)) grupos1.set(clave, []);
    grupos1.get(clave).push(it);
  }

  for (const [, grupo] of grupos1) {
    const idsDistintos = new Set(grupo.map((i) => i.idArchivo));
    if (idsDistintos.size > 1) {
      for (const it of grupo) {
        it.texto = insertarAntesDeExt(it.texto, ` - ${it.publicacion}`);
      }
    }
  }

  // Segunda vuelta: si siguen chocando dentro del mismo tema, agregar subcarpeta
  const grupos2 = new Map();
  for (const it of itemsPlanos) {
    const clave = `${it.tema}::${normDisco(it.texto)}`;
    if (!grupos2.has(clave)) grupos2.set(clave, []);
    grupos2.get(clave).push(it);
  }

  for (const [, grupo] of grupos2) {
    const idsDistintos = new Set(grupo.map((i) => i.idArchivo));
    if (idsDistintos.size > 1) {
      for (const it of grupo) {
        const sufijo = it.subcarpeta || it.idArchivo;
        if (sufijo) {
          it.texto = insertarAntesDeExt(it.texto, ` - ${sufijo}`);
        }
      }
    }
  }

  // 6. Resultado final
  const enlaces = itemsPlanos.map((it) => ({
    texto: it.texto,
    href: it.href,
    modulo: it.modulo,
    tipo: "adjunto",
    idArchivo: it.idArchivo,
    cursoId: it.cursoId,
    cursoNombre: it.cursoNombre,
    tema: it.tema,
    publicacion: it.publicacion,
  }));

  return {
    materia: cursoNombre,
    enlaces,
  };
}

const ScraperMoodleLinti = {
  escanearListado,
};

globalThis.ScraperMoodleLinti = ScraperMoodleLinti;
export default ScraperMoodleLinti;
export { escanearListado };
