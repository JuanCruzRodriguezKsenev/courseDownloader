/**
 * ADAPTADOR DE SITIO — MOODLE ASIGNATURAS (UNLP): ESCANEO DEL LISTADO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 13 / MODO PURO] Implementación del scraper para asignaturas.info.unlp.edu.ar.
 *   - Lectura de actividades resource, folder y url bajo el curso.
 *   - Desduplicación estricta por module-<cmid> con Set (RN-4a, AC-1).
 *   - Asignación de tema por sección (sección 0 o General -> "Sin tema", RN-4).
 *   - Resolución de folder y url intermedias con concurrencia <= 4 (RN-5, RN-7, RN-9, NFR-3).
 *   - Emisión de campos estándar con cursoId, cursoNombre, modulo, publicacion y tipo "adjunto" (RN-1, RN-8).
 * ==========================================================================
 *
 * ⚠️ REGLA DEL PROYECTO:
 * escanearListado se inyecta en la pestaña vía chrome.scripting.executeScript.
 * Debe ser autocontenida y serializable — sin importar ni referenciar globales
 * externas de la extensión ni constantes fuera de su ámbito inyectado.
 */

async function escanearListado() {
  async function mapearConConcurrencia(items, limite, fn) {
    const resultados = new Array(items.length);
    let indice = 0;
    async function trabajador() {
      while (indice < items.length) {
        const actual = indice++;
        resultados[actual] = await fn(items[actual], actual);
      }
    }
    const trabajadores = Array.from(
      { length: Math.min(limite, items.length) },
      () => trabajador()
    );
    await Promise.all(trabajadores);
    return resultados;
  }

  const cursoId = new URLSearchParams(window.location.search).get("id") || "";
  const encabezado = document.querySelector(".page-header-headings h1, .page-header h1, h1");
  let cursoNombre = encabezado ? encabezado.textContent.trim() : "";
  if (!cursoNombre) {
    const tm = document.title.match(/Curso:\s*(.+?)(?:\s*\|.*)?$/i);
    cursoNombre = tm ? tm[1].trim() : document.title.trim();
  }

  const origen = window.location.origin;
  const vistos = new Set();
  const actividades = [];

  const sections = document.querySelectorAll("[data-for=\"section\"], .section");
  for (const s of sections) {
    const h3 = s.querySelector("h3[data-for=\"section_title\"], h3.sectionname");
    const rawTitle = h3 ? h3.textContent.trim() : "";
    const isSection0 =
      s.id === "section-0" ||
      s.getAttribute("data-number") === "0" ||
      rawTitle.toLowerCase() === "general";
    const tema = !rawTitle || isSection0 ? "Sin tema" : rawTitle;

    const items = s.querySelectorAll("li[data-for=\"cmitem\"], li.activity, .activity");
    for (const act of items) {
      const m =
        (act.id || "").match(/module-(\d+)/) ||
        (act.getAttribute("data-id") ? [null, act.getAttribute("data-id")] : null);
      if (!m) continue;
      const cmid = m[1];
      if (vistos.has(cmid)) continue;

      let tipo = null;
      if (act.classList.contains("modtype_resource")) tipo = "resource";
      else if (act.classList.contains("modtype_url")) tipo = "url";
      else if (act.classList.contains("modtype_folder")) tipo = "folder";
      if (!tipo) continue;

      vistos.add(cmid);
      const actItem = act.querySelector(".activity-item");
      let actName = actItem?.getAttribute("data-activityname") || "";
      if (!actName) {
        const inst = act.querySelector(".instancename");
        if (inst) {
          const clon = inst.cloneNode(true);
          clon.querySelectorAll(".accesshide").forEach((el) => el.remove());
          actName = clon.textContent.trim();
        } else {
          actName = act.querySelector(".activityname")?.textContent?.trim() || "";
        }
      }

      actividades.push({
        cmid,
        tipo,
        tema,
        actName: actName.trim(),
      });
    }
  }

  const moduloPorTema = (t) => `${cursoNombre} › ${t}`;

  const resultadosPorActividad = await mapearConConcurrencia(actividades, 4, async (act) => {
    const { cmid, tipo, tema, actName } = act;
    const modulo = moduloPorTema(tema);

    if (tipo === "resource") {
      const url = `${origen}/mod/resource/view.php?id=${cmid}`;
      return [
        {
          texto: actName,
          url,
          tipo: "adjunto",
          idArchivo: String(cmid),
          modulo,
          tema,
          publicacion: actName,
          cursoId,
          cursoNombre,
        },
      ];
    }

    if (tipo === "folder") {
      const urlFolder = `${origen}/mod/folder/view.php?id=${cmid}`;
      try {
        const res = await fetch(urlFolder, { credentials: "include" });
        const html = await res.text();
        const parser = new DOMParser();
        const docFolder = parser.parseFromString(html, "text/html");
        const anchors = Array.from(
          docFolder.querySelectorAll(
            ".filemanager a[href*=\"pluginfile.php\"], .foldertree a[href*=\"pluginfile.php\"], a[href*=\"mod_folder/content\"]"
          )
        );

        if (anchors.length === 0) {
          return [];
        }

        return anchors.map((a) => {
          const href = a.getAttribute("href") || a.href;
          const fullUrl = new URL(href, origen).href;
          const match = fullUrl.match(/\/mod_folder\/content\/\d+\/(.+?)(?:\?.*)?$/);
          const rutaInterna = match
            ? decodeURIComponent(match[1])
            : a.querySelector(".fp-filename")?.textContent?.trim() || a.textContent.trim();
          const nombreArchivo = rutaInterna.split("/").pop() || rutaInterna;

          return {
            texto: nombreArchivo,
            url: fullUrl,
            tipo: "adjunto",
            idArchivo: `${cmid}/${rutaInterna}`,
            modulo,
            tema,
            publicacion: actName,
            cursoId,
            cursoNombre,
          };
        });
      } catch {
        return [];
      }
    }

    if (tipo === "url") {
      const urlView = `${origen}/mod/url/view.php?id=${cmid}`;
      let destinoUrl = urlView;
      try {
        const res = await fetch(urlView, { credentials: "include" });
        const html = await res.text();
        const parser = new DOMParser();
        const docUrl = parser.parseFromString(html, "text/html");
        const link = docUrl.querySelector(".urlworkaround a[href], #region-main a[href^=\"http\"]");
        if (link) {
          destinoUrl = link.getAttribute("href") || link.href;
        }
      } catch {
        // fallback a urlView
      }

      const titulo = actName;
      const idArchivo = `acceso:${encodeURIComponent(destinoUrl)}:${encodeURIComponent(titulo)}`;
      const texto = titulo.endsWith(".md") ? titulo : `${titulo}.md`;

      return [
        {
          texto,
          url: destinoUrl,
          tipo: "adjunto",
          idArchivo,
          modulo,
          tema,
          publicacion: actName,
          cursoId,
          cursoNombre,
        },
      ];
    }

    return [];
  });

  const enlaces = resultadosPorActividad.flat();

  return {
    materia: cursoNombre,
    enlaces,
  };
}

const ScraperMoodleAsignaturas = {
  escanearListado,
};

globalThis.ScraperMoodleAsignaturas = ScraperMoodleAsignaturas;
export default ScraperMoodleAsignaturas;
