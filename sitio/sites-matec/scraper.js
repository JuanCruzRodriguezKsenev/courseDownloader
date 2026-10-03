/**
 * ADAPTADOR DE SITIO — GOOGLE SITES MATE C: SCRAPER (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [SITES MATEC CORTE 1] Implementación inicial del scraper multi-página para
 *   la videoteca de Matemática C (D-4, D-5, D-6, RN-5 a RN-8).
 *   Escanea en paralelo las 9 subpáginas temáticas mediante Promise.all y DOMParser.
 * ==========================================================================
 *
 * El scraper se inyecta en la pestaña de Google Sites mediante chrome.scripting.
 * No debe importar módulos externos; sus funciones auxiliares residen en este archivo.
 */

const SUBPAGINAS_MATEC = [
  { slug: "series", tema: "Series" },
  { slug: "sistemas", tema: "Sistemas" },
  { slug: "matrices", tema: "Matrices" },
  { slug: "espacios", tema: "Espacios" },
  { slug: "transformaciones", tema: "Transformaciones" },
  { slug: "autovalores", tema: "Autovalores" },
  { slug: "diferenciales", tema: "Diferenciales" },
  { slug: "fourier", tema: "Fourier" },
  { slug: "autoevaluaciones", tema: "Autoevaluaciones" },
];

/**
 * Busca un título adecuado para un elemento iframe o a dentro de Google Sites.
 *
 * @param {Element} el
 * @param {string} fallback
 * @returns {string}
 */
function buscarTituloElemento(el, fallback) {
  const titleAttr = el.getAttribute("title");
  if (titleAttr && !/^(youtube|drive|google docs|video player)/i.test(titleAttr.trim())) {
    return titleAttr.trim();
  }

  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && !/^(youtube|drive|reproducir|abrir)/i.test(ariaLabel.trim())) {
    return ariaLabel.trim();
  }

  if (el.tagName.toLowerCase() === "a") {
    const txt = el.textContent ? el.textContent.trim() : "";
    if (txt && !/^https?:\/\//i.test(txt)) {
      return txt;
    }
  }

  // Buscar encabezado previo en el árbol DOM (h1..h4 o [role="heading"])
  let actual = el;
  for (let i = 0; i < 5 && actual && actual !== actual.ownerDocument.body; i++) {
    let previo = actual.previousElementSibling;
    while (previo) {
      if (/^h[1-6]$/i.test(previo.tagName) || previo.getAttribute("role") === "heading") {
        const hTxt = previo.textContent ? previo.textContent.trim() : "";
        if (hTxt) return hTxt;
      }
      const headingHijo = previo.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']");
      if (headingHijo) {
        const hTxt = headingHijo.textContent ? headingHijo.textContent.trim() : "";
        if (hTxt) return hTxt;
      }
      previo = previo.previousElementSibling;
    }
    actual = actual.parentElement;
  }

  return fallback;
}

/**
 * Extrae los ítems catalogados de un Document de una subpágina temática.
 *
 * @param {Document} doc
 * @param {string} tema
 * @param {string} urlSubpagina
 * @returns {Array<import("../../core/puertos/sitio").EnlaceListado>}
 */
function extraerItemsDeDocumento(doc, tema, _urlSubpagina) {
  const enlaces = [];
  const clavesVistas = new Set();

  const elementos = doc.querySelectorAll("iframe[src], a[href]");

  for (const el of elementos) {
    const esIframe = el.tagName.toLowerCase() === "iframe";
    const srcOrHref = esIframe ? el.getAttribute("src") || "" : el.getAttribute("href") || "";

    if (!srcOrHref) continue;

    // 1. YouTube
    const ytMatch = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i.exec(srcOrHref);
    if (ytMatch) {
      const videoId = ytMatch[1];
      const clave = `youtube:${videoId}`;
      if (clavesVistas.has(clave)) continue;
      clavesVistas.add(clave);

      const titulo = buscarTituloElemento(el, `Video ${tema} (${videoId})`);
      const urlCanonica = `https://www.youtube.com/watch?v=${videoId}`;
      const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

      enlaces.push({
        texto: titulo,
        href: urlCanonica,
        modulo: `Matemática C › ${tema}`,
        tema,
        cursoId: "matec",
        cursoNombre: "Matemática C",
        tipo: "adjunto",
        idArchivo,
      });
      continue;
    }

    // 2. Google Forms
    const formMatch = /docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/i.exec(srcOrHref);
    if (formMatch) {
      const formId = formMatch[1];
      const clave = `form:${formId}`;
      if (clavesVistas.has(clave)) continue;
      clavesVistas.add(clave);

      const titulo = buscarTituloElemento(el, `Autoevaluación ${tema}`);
      const esEmbedOConE = srcOrHref.includes("/e/");
      const urlCanonica = esEmbedOConE
        ? `https://docs.google.com/forms/d/e/${formId}/viewform`
        : `https://docs.google.com/forms/d/${formId}/viewform`;
      const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

      enlaces.push({
        texto: titulo,
        href: urlCanonica,
        modulo: `Matemática C › ${tema}`,
        tema,
        cursoId: "matec",
        cursoNombre: "Matemática C",
        tipo: "adjunto",
        idArchivo,
      });
      continue;
    }

    // 3. Google Drive
    const driveMatch = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i.exec(srcOrHref);
    if (driveMatch) {
      const fileId = driveMatch[1];
      const titulo = buscarTituloElemento(el, `Archivo Drive (${fileId})`);

      const esVideo = /\.(mp4|mov)(\?|$)/i.test(srcOrHref) || /\.(mp4|mov)$/i.test(titulo);
      const clave = `${esVideo ? "drive-video" : "drive"}:${fileId}`;
      if (clavesVistas.has(clave)) continue;
      clavesVistas.add(clave);

      if (esVideo) {
        const urlCanonica = `https://drive.google.com/file/d/${fileId}/view`;
        const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

        enlaces.push({
          texto: titulo,
          href: urlCanonica,
          modulo: `Matemática C › ${tema}`,
          tema,
          cursoId: "matec",
          cursoNombre: "Matemática C",
          tipo: "adjunto",
          idArchivo,
        });
      } else {
        enlaces.push({
          texto: titulo,
          href: `https://drive.google.com/file/d/${fileId}/view`,
          modulo: `Matemática C › ${tema}`,
          tema,
          cursoId: "matec",
          cursoNombre: "Matemática C",
          tipo: "adjunto",
          idArchivo: `drive:${fileId}`,
        });
      }
      continue;
    }

    // 4. PDFs directos fuera de Drive (si hubiera)
    if (/\.pdf(\?|$)/i.test(srcOrHref)) {
      const clave = `pdf:${srcOrHref}`;
      if (clavesVistas.has(clave)) continue;
      clavesVistas.add(clave);

      const titulo = buscarTituloElemento(el, `Documento ${tema}`);
      enlaces.push({
        texto: titulo,
        href: srcOrHref,
        modulo: `Matemática C › ${tema}`,
        tema,
        cursoId: "matec",
        cursoNombre: "Matemática C",
        tipo: "adjunto",
        idArchivo: `url:${srcOrHref}`,
      });
    }
  }

  return enlaces;
}

/**
 * Escanea el listado consolidado de Matemática C recorriendo las 9 subpáginas.
 * ⚠️ Función serializable inyectada en la pestaña mediante chrome.scripting.executeScript:
 * No debe referenciar constantes ni funciones del módulo externo.
 *
 * @returns {Promise<import("../../core/puertos/sitio").ResultadoEscaneo>}
 */
async function escanearListado() {
  const SUBPAGINAS = [
    { slug: "series", tema: "Series" },
    { slug: "sistemas", tema: "Sistemas" },
    { slug: "matrices", tema: "Matrices" },
    { slug: "espacios", tema: "Espacios" },
    { slug: "transformaciones", tema: "Transformaciones" },
    { slug: "autovalores", tema: "Autovalores" },
    { slug: "diferenciales", tema: "Diferenciales" },
    { slug: "fourier", tema: "Fourier" },
    { slug: "autoevaluaciones", tema: "Autoevaluaciones" },
  ];

  function buscarTitulo(el, fallback) {
    const titleAttr = el.getAttribute("title");
    if (titleAttr && !/^(youtube|drive|google docs|video player)/i.test(titleAttr.trim())) {
      return titleAttr.trim();
    }

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel && !/^(youtube|drive|reproducir|abrir)/i.test(ariaLabel.trim())) {
      return ariaLabel.trim();
    }

    if (el.tagName.toLowerCase() === "a") {
      const txt = el.textContent ? el.textContent.trim() : "";
      if (txt && !/^https?:\/\//i.test(txt)) {
        return txt;
      }
    }

    let actual = el;
    for (let i = 0; i < 5 && actual && actual !== actual.ownerDocument.body; i++) {
      let previo = actual.previousElementSibling;
      while (previo) {
        if (/^h[1-6]$/i.test(previo.tagName) || previo.getAttribute("role") === "heading") {
          const hTxt = previo.textContent ? previo.textContent.trim() : "";
          if (hTxt) return hTxt;
        }
        const headingHijo = previo.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']");
        if (headingHijo) {
          const hTxt = headingHijo.textContent ? headingHijo.textContent.trim() : "";
          if (hTxt) return hTxt;
        }
        previo = previo.previousElementSibling;
      }
      actual = actual.parentElement;
    }

    return fallback;
  }

  function extraerItems(doc, tema, _urlSubpagina) {
    const enlaces = [];
    const clavesVistas = new Set();
    const elementos = doc.querySelectorAll("iframe[src], a[href]");

    for (const el of elementos) {
      const esIframe = el.tagName.toLowerCase() === "iframe";
      const srcOrHref = esIframe ? el.getAttribute("src") || "" : el.getAttribute("href") || "";

      if (!srcOrHref) continue;

      // 1. YouTube
      const ytMatch = /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i.exec(srcOrHref);
      if (ytMatch) {
        const videoId = ytMatch[1];
        const clave = `youtube:${videoId}`;
        if (clavesVistas.has(clave)) continue;
        clavesVistas.add(clave);

        const titulo = buscarTitulo(el, `Video ${tema} (${videoId})`);
        const urlCanonica = `https://www.youtube.com/watch?v=${videoId}`;
        const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

        enlaces.push({
          texto: titulo,
          href: urlCanonica,
          modulo: `Matemática C › ${tema}`,
          tema,
          cursoId: "matec",
          cursoNombre: "Matemática C",
          tipo: "adjunto",
          idArchivo,
        });
        continue;
      }

      // 2. Google Forms
      const formMatch = /docs\.google\.com\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/i.exec(srcOrHref);
      if (formMatch) {
        const formId = formMatch[1];
        const clave = `form:${formId}`;
        if (clavesVistas.has(clave)) continue;
        clavesVistas.add(clave);

        const titulo = buscarTitulo(el, `Autoevaluación ${tema}`);
        const esEmbedOConE = srcOrHref.includes("/e/");
        const urlCanonica = esEmbedOConE
          ? `https://docs.google.com/forms/d/e/${formId}/viewform`
          : `https://docs.google.com/forms/d/${formId}/viewform`;
        const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

        enlaces.push({
          texto: titulo,
          href: urlCanonica,
          modulo: `Matemática C › ${tema}`,
          tema,
          cursoId: "matec",
          cursoNombre: "Matemática C",
          tipo: "adjunto",
          idArchivo,
        });
        continue;
      }

      // 3. Google Drive
      const driveMatch = /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i.exec(srcOrHref);
      if (driveMatch) {
        const fileId = driveMatch[1];
        const titulo = buscarTitulo(el, `Archivo Drive (${fileId})`);

        const esVideo = /\.(mp4|mov)(\?|$)/i.test(srcOrHref) || /\.(mp4|mov)$/i.test(titulo);
        const clave = `${esVideo ? "drive-video" : "drive"}:${fileId}`;
        if (clavesVistas.has(clave)) continue;
        clavesVistas.add(clave);

        if (esVideo) {
          const urlCanonica = `https://drive.google.com/file/d/${fileId}/view`;
          const idArchivo = `acceso:${encodeURIComponent(urlCanonica)}:${encodeURIComponent(titulo)}`;

          enlaces.push({
            texto: titulo,
            href: urlCanonica,
            modulo: `Matemática C › ${tema}`,
            tema,
            cursoId: "matec",
            cursoNombre: "Matemática C",
            tipo: "adjunto",
            idArchivo,
          });
        } else {
          enlaces.push({
            texto: titulo,
            href: `https://drive.google.com/file/d/${fileId}/view`,
            modulo: `Matemática C › ${tema}`,
            tema,
            cursoId: "matec",
            cursoNombre: "Matemática C",
            tipo: "adjunto",
            idArchivo: `drive:${fileId}`,
          });
        }
        continue;
      }

      // 4. PDFs directos fuera de Drive
      if (/\.pdf(\?|$)/i.test(srcOrHref)) {
        const clave = `pdf:${srcOrHref}`;
        if (clavesVistas.has(clave)) continue;
        clavesVistas.add(clave);

        const titulo = buscarTitulo(el, `Documento ${tema}`);
        enlaces.push({
          texto: titulo,
          href: srcOrHref,
          modulo: `Matemática C › ${tema}`,
          tema,
          cursoId: "matec",
          cursoNombre: "Matemática C",
          tipo: "adjunto",
          idArchivo: `url:${srcOrHref}`,
        });
      }
    }

    return enlaces;
  }

  const origin = typeof window !== "undefined" && window.location ? window.location.origin : "https://sites.google.com";
  const pathname = typeof window !== "undefined" && window.location ? window.location.pathname : "/ing.unlp.edu.ar/matec";

  const baseMatch = pathname.match(/^(\/ing\.unlp\.edu\.ar\/matec)(?:\/inicio)?/);
  const basePath = baseMatch ? `${baseMatch[1]}/inicio` : "/ing.unlp.edu.ar/matec/inicio";

  const resultados = await Promise.all(
    SUBPAGINAS.map(async ({ slug, tema }) => {
      const url = `${origin}${basePath}/${slug}`;
      try {
        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) return [];
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return extraerItems(doc, tema, url);
      } catch {
        return [];
      }
    })
  );

  const enlaces = resultados.flat();

  return {
    materia: "Matemática C",
    enlaces,
  };
}

const ScraperSitesMatec = {
  escanearListado,
  extraerItemsDeDocumento,
  SUBPAGINAS_MATEC,
};

globalThis.ScraperSitesMatec = ScraperSitesMatec;
export { escanearListado, extraerItemsDeDocumento, SUBPAGINAS_MATEC };
export default ScraperSitesMatec;
