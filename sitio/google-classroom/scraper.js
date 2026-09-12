/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: ESCANEO DEL LISTADO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CLASSROOM CORTE 1] Primer scraper de Google Classroom. Escanea Trabajo en clase
 *   y Novedades en una inyección de executeScript serializable y autocontenida.
 * ==========================================================================
 */

const ScraperClassroom = {
  /**
   * Lee el listado de materiales y adjuntos del curso activo de Classroom.
   * Función inyectada por executeScript en la pestaña: debe ser estrictamente
   * autocontenida (sin closures sobre el módulo ni variables externas).
   *
   * @param {{ tiempos?: Record<string, number> }} [opciones]
   * @returns {Promise<{ materia: string, enlaces: any[], aviso?: string, credenciales?: Record<string, string> }>}
   */
  async escanearListado(opciones) {
    const tiempos = Object.assign(
      {
        pintado: 20000,
        vuelta: 1500,
        navegacion: 15000,
        verMas: 8000,
        abrir: 8000,
        sinAdjuntos: 1500,
      },
      opciones && opciones.tiempos
    );

    const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function esperarCondicion(predicado, timeoutMs, pasoMs = 50) {
      const inicio = Date.now();
      while (Date.now() - inicio < timeoutMs) {
        if (predicado()) return true;
        await dormir(pasoMs);
      }
      return Boolean(predicado());
    }

    const visible = () => document.visibilityState === "visible";
    const avisoVisibilidad = {
      materia: "",
      enlaces: [],
      aviso: "Cambiaste de pestaña durante el escaneo y Classroom dejó de cargar la página. Dejá Classroom al frente y re-escaneá.",
    };

    // 1. Visibilidad inicial
    if (!visible()) return avisoVisibilidad;

    // 2. Curso y cuenta
    const path = location.pathname || "";
    const idCursoMatch = /\/(?:c|w)\/([^/]+)/.exec(path);
    if (!idCursoMatch) {
      return {
        materia: "",
        enlaces: [],
        aviso: "Abrí un curso de Classroom (Trabajo en clase o Novedades) y re-escaneá.",
      };
    }
    const idCurso = idCursoMatch[1];
    const cuentaMatch = /^\/u\/(\d+)\//.exec(path);
    const cuenta = cuentaMatch ? cuentaMatch[1] : "0";

    let nombreCurso = document.title || "";
    if (nombreCurso.startsWith("Trabajo en clase de ")) {
      nombreCurso = nombreCurso.slice("Trabajo en clase de ".length);
    }
    if (nombreCurso.endsWith(" - Classroom")) {
      nombreCurso = nombreCurso.slice(0, -" - Classroom".length);
    }
    nombreCurso = nombreCurso.trim();

    function obtenerVistaActiva() {
      const wizzes = document.querySelectorAll("body > c-wiz");
      for (const w of wizzes) {
        if (w.getAttribute("aria-hidden") !== "true") return w;
      }
      return document.body;
    }

    function buscarLinkNav(patronRegex) {
      const links = document.querySelectorAll("nav a[href]");
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        const pathname = a.pathname || "";
        if (patronRegex.test(href) || patronRegex.test(pathname)) {
          return a;
        }
      }
      return null;
    }

    function buscarContenedorScroll() {
      let mejor = null;
      let maxScrollHeight = 0;
      const todos = document.querySelectorAll("*");
      for (const el of todos) {
        const style = window.getComputedStyle(el);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          if (el.scrollHeight > maxScrollHeight) {
            maxScrollHeight = el.scrollHeight;
            mejor = el;
          }
        }
      }
      return mejor || document.scrollingElement || document.documentElement || document.body;
    }

    async function esperarQuietud(vista) {
      const scroller = buscarContenedorScroll();
      let prevHeight = -1;
      let prevCount = -1;
      let prevBusy = null;
      let estables = 0;
      for (let vuelta = 0; vuelta < 40; vuelta++) {
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight;
        }
        await dormir(tiempos.vuelta);
        const height = scroller ? scroller.scrollHeight : 0;
        const count = vista.querySelectorAll("[data-stream-item-id]").length;
        const busy = vista.getAttribute("aria-busy");
        if (height === prevHeight && count === prevCount && busy === prevBusy) {
          estables++;
          if (estables >= 3) break;
        } else {
          estables = 0;
        }
        prevHeight = height;
        prevCount = count;
        prevBusy = busy;
      }
    }

    function clasificarAdjunto(a, material, attId) {
      const href = a.getAttribute("href") || "";
      const label = (a.getAttribute("aria-label") || "").trim();

      const driveIdMatch = /\/file\/d\/([^/]+)/.exec(href);
      const labelMatch = /^[^:]+: ([^:]+): ([\s\S]+)$/.exec(label);
      if (driveIdMatch && labelMatch) {
        const tipoDoc = labelMatch[1].trim();
        const nombreDoc = labelMatch[2].trim();
        if (tipoDoc.toLowerCase() === "video") {
          return { tipo: "acceso", url: href, titulo: nombreDoc, attId };
        }
        return { tipo: "archivo", idArchivo: driveIdMatch[1], nombre: nombreDoc, url: href, attId };
      }

      if (label.includes(": video de YouTube: ")) {
        const partes = label.split(": video de YouTube: ");
        const tit = (partes[1] || label).trim();
        return { tipo: "acceso", url: href, titulo: tit, attId };
      }

      if (label.includes("Vínculo a ")) {
        const urlVinculo = label.slice(label.indexOf("Vínculo a ") + "Vínculo a ".length).trim();
        let host = "";
        try {
          host = new URL(urlVinculo).host;
        } catch {
          host = urlVinculo;
        }
        return { tipo: "acceso", url: urlVinculo, titulo: `${material} - ${host}`, attId };
      }

      if (/docs\.google\.com\/(?:document|presentation|spreadsheets)/.test(href)) {
        const tit = labelMatch ? labelMatch[2].trim() : label;
        return { tipo: "acceso", url: href, titulo: tit, attId };
      }

      return { tipo: "acceso", url: href, titulo: label, attId };
    }

    // 3. Ir a "Trabajo en clase" si no estamos ahí
    const enTrabajoEnClase = /\/w\/[^/]+\/t\/all/.test(path);
    if (!enTrabajoEnClase) {
      const regexTrabajo = new RegExp(`^(?:/u/\\d+)?/w/${idCurso}/t/all(?:$|\\?)`);
      const linkTrabajo = buscarLinkNav(regexTrabajo);
      if (!linkTrabajo) {
        return {
          materia: "",
          enlaces: [],
          aviso: "Classroom no terminó de abrir Trabajo en clase. Re-escaneá.",
        };
      }
      const vistaPrevia = obtenerVistaActiva();
      linkTrabajo.click();
      const navOk = await esperarCondicion(() => {
        const va = obtenerVistaActiva();
        if (va === vistaPrevia) return false;
        return Boolean(
          va.querySelector("[data-stream-item-id]") || va.querySelector("[data-no-topic-items]")
        );
      }, tiempos.navegacion);

      if (!navOk) {
        return {
          materia: "",
          enlaces: [],
          aviso: "Classroom no terminó de abrir Trabajo en clase. Re-escaneá.",
        };
      }
    }

    // 4. Esperar a que pinte Trabajo en clase
    const pintadoOk = await esperarCondicion(() => {
      const va = obtenerVistaActiva();
      return Boolean(
        va.querySelector("li[data-stream-item-id]") || va.querySelector("[data-no-topic-items]")
      );
    }, tiempos.pintado);

    if (!pintadoOk) {
      return {
        materia: "",
        enlaces: [],
        aviso: "Classroom no terminó de cargar el curso. Re-escaneá.",
      };
    }

    if (!visible()) return avisoVisibilidad;

    const vistaTrabajo = obtenerVistaActiva();
    const tieneMarcadorVacio = Boolean(vistaTrabajo.querySelector("[data-no-topic-items]"));
    const lisTrabajo = vistaTrabajo.querySelectorAll("li[data-stream-item-id]");
    const trabajoVacio = tieneMarcadorVacio && lisTrabajo.length === 0;

    const itemsLeidosTrabajo = [];

    if (!trabajoVacio) {
      // 5. Quietud
      await esperarQuietud(vistaTrabajo);
      if (!visible()) return avisoVisibilidad;

      // 6. "Ver más" por tema
      let algunTemaCrecio = false;
      const regiones = vistaTrabajo.querySelectorAll('div[role="region"][aria-label]');
      for (const region of regiones) {
        const botones = region.querySelectorAll('button[aria-label="Ver más publicaciones"]');
        let boton = null;
        for (const b of botones) {
          if (!b.closest("li")) {
            boton = b;
            break;
          }
        }
        if (!boton) continue;

        function esBotonVisible(el) {
          if (!el || el.getClientRects().length === 0) return false;
          const s = window.getComputedStyle(el);
          return s.display !== "none" && s.visibility !== "hidden";
        }

        while (esBotonVisible(boton) && !boton.disabled) {
          const cantAntes = region.querySelectorAll("li[data-stream-item-id]").length;
          boton.click();
          const crecio = await esperarCondicion(() => {
            return region.querySelectorAll("li[data-stream-item-id]").length > cantAntes;
          }, tiempos.verMas);

          if (crecio) {
            algunTemaCrecio = true;
            await dormir(tiempos.vuelta);
          } else {
            break;
          }
        }
      }

      if (algunTemaCrecio) {
        await esperarQuietud(vistaTrabajo);
      }
      if (!visible()) return avisoVisibilidad;

      // 7. Abrir los ítems
      const itemsExpandibles = vistaTrabajo.querySelectorAll("li[data-expandable-row-id]");
      for (const li of itemsExpandibles) {
        if (li.querySelector("[data-attachment-id]")) continue;
        const btn = li.querySelector('div[role="button"][aria-expanded]');
        if (!btn) continue;
        btn.click();

        let expandidoDetectado = 0;
        await esperarCondicion(() => {
          if (li.querySelector("[data-attachment-id]")) return true;
          if (li.querySelector("[expanded-item-id]")) {
            if (!expandidoDetectado) expandidoDetectado = Date.now();
            if (Date.now() - expandidoDetectado >= tiempos.sinAdjuntos) {
              return true;
            }
          }
          return false;
        }, tiempos.abrir);
      }
      if (!visible()) return avisoVisibilidad;

      // 8. Leer "Trabajo en clase"
      const regionesActualizadas = vistaTrabajo.querySelectorAll('div[role="region"][aria-label]');
      for (const region of regionesActualizadas) {
        const ariaLabelRegion = region.getAttribute("aria-label") || "";
        let tema = ariaLabelRegion;
        if (tema === "Elementos de trabajo en clase sin tema") {
          tema = "Sin tema";
        } else if (tema.startsWith("Tema ")) {
          tema = tema.slice("Tema ".length);
        }
        tema = tema.trim();

        const lis = region.querySelectorAll("li[data-stream-item-id]");
        for (const li of lis) {
          const btn = li.querySelector('div[role="button"][aria-expanded]');
          const material = btn ? (btn.getAttribute("aria-label") || "").trim() : "";

          const vistosAtt = new Set();
          const links = li.querySelectorAll("div[data-attachment-id] a[aria-label][href]");
          for (const a of links) {
            const container = a.closest("div[data-attachment-id]");
            const attId = container ? container.getAttribute("data-attachment-id") : "";
            if (attId && vistosAtt.has(attId)) continue;
            if (attId) vistosAtt.add(attId);

            const clasif = clasificarAdjunto(a, material, attId);
            if (clasif) {
              itemsLeidosTrabajo.push({
                ...clasif,
                tema,
                material,
                vista: "trabajo",
              });
            }
          }
        }
      }
    }

    // 9. Ir a "Novedades"
    const regexNovedades = new RegExp(`^(?:/u/\\d+)?/c/${idCurso}(?:$|\\?)`);
    const linkNovedades = buscarLinkNav(regexNovedades);
    const itemsLeidosNovedades = [];

    if (linkNovedades) {
      const vistaPrevia = obtenerVistaActiva();
      linkNovedades.click();
      const navNovOk = await esperarCondicion(() => {
        const va = obtenerVistaActiva();
        if (va === vistaPrevia) return false;
        return Boolean(va.querySelector("[data-stream-item-id]"));
      }, tiempos.navegacion);

      if (!navNovOk) {
        return {
          materia: "",
          enlaces: [],
          aviso: "Classroom no terminó de abrir Novedades. Re-escaneá.",
        };
      }

      if (!visible()) return avisoVisibilidad;

      const vistaNovedades = obtenerVistaActiva();
      await esperarQuietud(vistaNovedades);

      if (!visible()) return avisoVisibilidad;

      const todosStream = Array.from(vistaNovedades.querySelectorAll("[data-stream-item-id]"));
      const itemsExternos = todosStream.filter(
        (el) => !el.parentElement.closest("[data-stream-item-id]")
      );

      for (const post of itemsExternos) {
        const heading = post.querySelector('h2, [role="heading"]');
        const material = heading ? (heading.textContent || "").trim() : "Novedad";
        const tema = "Novedades";

        const vistosAtt = new Set();
        const links = post.querySelectorAll("div[data-attachment-id] a[aria-label][href]");
        for (const a of links) {
          const container = a.closest("div[data-attachment-id]");
          const attId = container ? container.getAttribute("data-attachment-id") : "";
          if (attId && vistosAtt.has(attId)) continue;
          if (attId) vistosAtt.add(attId);

          const clasif = clasificarAdjunto(a, material, attId);
          if (clasif) {
            itemsLeidosNovedades.push({
              ...clasif,
              tema,
              material,
              vista: "novedades",
            });
          }
        }
      }
    }

    // 10. Volver a "Trabajo en clase"
    try {
      const regexTrabajo = new RegExp(`^(?:/u/\\d+)?/w/${idCurso}/t/all(?:$|\\?)`);
      const linkVolver = buscarLinkNav(regexTrabajo);
      if (linkVolver) linkVolver.click();
    } catch {
      // Ignorar fallo al volver
    }

    // 12. Deduplicar entre vistas
    const idsEnTrabajo = new Set();
    for (const item of itemsLeidosTrabajo) {
      const clave = item.tipo === "archivo" ? `drive:${item.idArchivo}` : `url:${item.url}`;
      idsEnTrabajo.add(clave);
    }

    const novedadesDeduplicadas = [];
    for (const item of itemsLeidosNovedades) {
      const clave = item.tipo === "archivo" ? `drive:${item.idArchivo}` : `url:${item.url}`;
      if (!idsEnTrabajo.has(clave)) {
        novedadesDeduplicadas.push(item);
      }
    }

    const todosLosItems = [...itemsLeidosTrabajo, ...novedadesDeduplicadas];

    // 13. Nombres repetidos
    for (const item of todosLosItems) {
      item.nombreFinal = item.tipo === "archivo" ? item.nombre : `${item.titulo}.md`;
      item.idDistinto = item.tipo === "archivo" ? item.idArchivo : item.url;
    }

    // Normalizado con la regla de nombreEnDisco (core/util/texto.ts).
    // La regla se repite acá para mantener la función autocontenida y serializable
    // para executeScript. Ver core/util/texto.test.ts para el test de paridad.
    function normDisco(str) {
      if (!str) return "video_sin_nombre";
      const base = str.replace(/^.*[/\\]/, "");
      return (
        base
          .replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, "_")
          .trim()
          .toLowerCase() || "video_sin_nombre"
      );
    }

    function insertarAntesDeExt(nombre, sufijo) {
      const idx = nombre.lastIndexOf(".");
      if (idx > 0) {
        return nombre.slice(0, idx) + sufijo + nombre.slice(idx);
      }
      return nombre + sufijo;
    }

    // Agrupar por nombre normalizado
    const grupos = new Map();
    for (const item of todosLosItems) {
      const clave = normDisco(item.nombreFinal);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(item);
    }

    for (const [, grupo] of grupos) {
      const idsDistintos = new Set(grupo.map((i) => i.idDistinto));
      if (idsDistintos.size > 1) {
        for (const item of grupo) {
          item.nombreFinal = insertarAntesDeExt(item.nombreFinal, ` - ${item.material}`);
        }
      }
    }

    // Re-agrupar para verificar si todavía chocan
    const gruposSegunda = new Map();
    for (const item of todosLosItems) {
      const clave = normDisco(item.nombreFinal);
      if (!gruposSegunda.has(clave)) gruposSegunda.set(clave, []);
      gruposSegunda.get(clave).push(item);
    }

    for (const [, grupo] of gruposSegunda) {
      const idsDistintos = new Set(grupo.map((i) => i.idDistinto));
      if (idsDistintos.size > 1) {
        for (const item of grupo) {
          if (item.attId) {
            item.nombreFinal = insertarAntesDeExt(item.nombreFinal, ` - ${item.attId}`);
          }
        }
      }
    }

    // 14. Resultado
    const enlaces = todosLosItems.map((item) => ({
      texto: item.nombreFinal,
      href: item.url,
      modulo: `${nombreCurso} › ${item.tema}`,
      tipo: "adjunto",
      idArchivo:
        item.tipo === "archivo"
          ? item.idArchivo
          : `acceso:${encodeURIComponent(item.url)}:${encodeURIComponent(item.titulo)}`,
    }));

    if (enlaces.length === 0) {
      return {
        materia: "",
        enlaces: [],
        aviso: "Este curso no tiene archivos en Trabajo en clase ni en Novedades.",
      };
    }

    return {
      materia: "",
      enlaces,
      credenciales: { authuser: cuenta },
    };
  },
};

globalThis.ScraperClassroom = ScraperClassroom;
export default ScraperClassroom;
