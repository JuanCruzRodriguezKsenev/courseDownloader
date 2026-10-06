/**
 * ADAPTADOR DE SITIO — MOODLE LINTI: SCRAPER (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [PLAN 29 / MULTICURSO] Recorrido de todos los cursos desde /my/.
 *   Extrae escanearCurso para reuso puro con AbortSignal y credenciales.
 *   Oyente de cancelación, eventos de recorrido y bloque con paridad.
 *
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
 * Escanea el listado de actividades de un curso de Moodle del LINTI
 * o recorre todos los cursos si opciones.modo === "todos".
 *
 * @param {object} [opciones]
 * @returns {Promise<{ materia: string, enlaces: Array<object>, aviso?: string, motivoAviso?: string, recorrido?: boolean, cancelado?: boolean }>}
 */
async function escanearListado(opciones = {}) {
  function esPantallaLogin(doc, rutaFinal = "") {
    if (
      typeof rutaFinal === "string" &&
      (rutaFinal.startsWith("/login/") || rutaFinal === "/login")
    ) {
      return true;
    }
    const body = doc && doc.body;
    if (body && body.classList && body.classList.contains("path-login")) {
      return true;
    }
    if (doc && typeof doc.getElementById === "function" && doc.getElementById("page-login-index")) {
      return true;
    }
    return false;
  }

  async function escanearCurso(doc, ctx) {
    const origen = ctx.origen || "";
    const cursoId = ctx.cursoId || "";

    // 1. Detección de sesión vencida / pantalla de login
    const pathActual = (typeof window !== "undefined" && window.location && window.location.pathname) || "";
    if (esPantallaLogin(doc, pathActual)) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en Moodle ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    // 2. Metadatos del curso
    const h1El = doc.querySelector(".page-header-headings h1, #page-header h1, h1");
    const cursoNombre = h1El ? h1El.textContent.trim().replace(/\s+/g, " ") : "";

    // 3. Localizar las secciones dentro de la región principal del curso
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
            : `${origen || "https://catedras.linti.unlp.edu.ar"}/mod/${tipo}/view.php?id=${cmid}`;

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
          const resp = await fetch(act.href, { credentials: "include", signal: ctx.signal });
          const urlFinal = resp.url || "";
          const pathname = new URL(urlFinal, origen || undefined).pathname;

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
          const resp = await fetch(act.href, { credentials: "include", signal: ctx.signal });
          const urlFinal = resp.url || "";
          const pathname = new URL(urlFinal, origen || undefined).pathname;

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
            const resp = await fetch(act.href, { credentials: "include", signal: ctx.signal });
            const urlFinal = resp.url || "";
            const pathname = new URL(urlFinal, origen || undefined).pathname;

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
            destino = `${origen || "https://catedras.linti.unlp.edu.ar"}/mod/url/view.php?id=${act.cmid}`;
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

  // <recorrido-moodle>
  if (opciones && opciones.modo === "todos") {
    const {
      idRecorrido,
      tabId,
      sitioId,
      topeCursoMs = 60000,
      lanzadoEn,
    } = opciones;

    let cancelado = false;
    let abortControllerCurso = null;

    const oyenteCancelar = (msg, _sender, responder) => {
      if (!msg || msg.action !== "cancelar_escaneo") return;
      if (msg.idRecorrido !== idRecorrido) return;
      cancelado = true;
      if (abortControllerCurso) {
        abortControllerCurso.abort();
      }
      try {
        responder({ ok: true });
      } catch {}
    };

    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.onMessage &&
      typeof chrome.runtime.onMessage.addListener === "function"
    ) {
      chrome.runtime.onMessage.addListener(oyenteCancelar);
    }

    let recorridoTerminado = false;
    const oyentePagehide = () => {
      if (!recorridoTerminado) {
        try {
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            typeof chrome.runtime.sendMessage === "function"
          ) {
            chrome.runtime.sendMessage({
              action: "recorrido_evento",
              idRecorrido,
              tabId,
              sitioId,
              tipo: "fin",
              estado: "cortado",
              motivoCorte: "navegacion",
            });
          }
        } catch {}
      }
    };
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("pagehide", oyentePagehide);
    }

    let colaAvisos = Promise.resolve();
    const avisar = (evento) => {
      const p = colaAvisos.then(async () => {
        try {
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            typeof chrome.runtime.sendMessage === "function"
          ) {
            await chrome.runtime.sendMessage({
              action: "recorrido_evento",
              idRecorrido,
              tabId,
              sitioId,
              ...evento,
            });
          }
        } catch {}
      });
      colaAvisos = p.catch(() => {});
      return p;
    };

    try {
      // 4. Esperar la lista (hasta 5 s, sondeo cada 250 ms)
      const selectorEnlaces = 'a[href*="course/view.php?id="]';
      const esEnlaceValido = (a) => {
        if (!a || !a.href) return false;
        if (a.closest("nav, [data-region='drawer'], .breadcrumb")) return false;
        return /\/course\/view\.php\?(?:[^#]*&)?id=\d+/.test(a.href);
      };

      const obtenerEnlacesCursos = () => {
        const todos = Array.from(document.querySelectorAll(selectorEnlaces));
        return todos.filter(esEnlaceValido);
      };

      let enlaces = obtenerEnlacesCursos();
      if (enlaces.length === 0) {
        const inicioEspera = Date.now();
        while (enlaces.length === 0 && Date.now() - inicioEspera < 5000) {
          await new Promise((r) => setTimeout(r, 250));
          if (cancelado) break;
          enlaces = obtenerEnlacesCursos();
        }
      }

      if (cancelado) {
        await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" });
        return { materia: "", enlaces: [], recorrido: true, cancelado: true };
      }

      if (enlaces.length === 0) {
        await avisar({
          tipo: "fin",
          tabId,
          sitioId,
          estado: "cortado",
          motivoCorte: "sin-cursos",
        });
        return { materia: "", enlaces: [], recorrido: true };
      }

      // 5. Enumerar
      const cursosVistos = new Set();
      const cursos = [];
      for (const a of enlaces) {
        const m = /[?&]id=(\d+)/.exec(a.href);
        if (!m) continue;
        const id = m[1];
        if (cursosVistos.has(id)) continue;
        cursosVistos.add(id);

        let nombre = (a.getAttribute("aria-label") || a.textContent || "")
          .trim()
          .replace(/\s+/g, " ");
        if (!nombre) {
          nombre = `Curso ${id}`;
        }
        cursos.push({ id, nombre });
      }

      if (cursos.length === 0) {
        await avisar({
          tipo: "fin",
          tabId,
          sitioId,
          estado: "cortado",
          motivoCorte: "sin-cursos",
        });
        return { materia: "", enlaces: [], recorrido: true };
      }

      // 6. inicio
      const evInicio = {
        tipo: "inicio",
        cursos,
        ...(lanzadoEn !== undefined ? { lanzadoEn } : {}),
      };
      await avisar(evInicio);

      const origen = (typeof window !== "undefined" && window.location && window.location.origin) || "";

      // 7. Por curso i en serie
      for (let i = 0; i < cursos.length; i++) {
        if (cancelado) {
          await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" });
          return { materia: "", enlaces: [], recorrido: true, cancelado: true };
        }

        const curso = cursos[i];
        const inicioCurso = Date.now();

        await avisar({ tipo: "latido", indice: i });

        const timerLatido = setInterval(() => {
          avisar({ tipo: "latido", indice: i });
        }, 10000);

        abortControllerCurso = new AbortController();
        const signal = abortControllerCurso.signal;

        let superoTope = false;
        const timerTope = setTimeout(() => {
          superoTope = true;
          if (abortControllerCurso) {
            abortControllerCurso.abort();
          }
        }, topeCursoMs);

        try {
          let resp;
          try {
            resp = await fetch(`${origen}/course/view.php?id=${curso.id}`, {
              credentials: "include",
              signal,
            });
          } catch (err) {
            if (cancelado) throw err;
            const segs = Math.round(topeCursoMs / 1000);
            const motivo = superoTope ? `superó el tope de ${segs} s` : "error de red";
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          const urlFinal = resp.url || "";
          let pathnameFinal = "";
          try {
            pathnameFinal = new URL(urlFinal, origen).pathname;
          } catch {
            pathnameFinal = "";
          }

          if (!resp.ok) {
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo: `HTTP ${resp.status}`,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          const html = await resp.text();
          const docCurso = new DOMParser().parseFromString(html, "text/html");

          if (
            pathnameFinal.startsWith("/login") ||
            (typeof esPantallaLogin === "function" && esPantallaLogin(docCurso, pathnameFinal))
          ) {
            await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "sesion" });
            return { materia: "", enlaces: [], recorrido: true };
          }

          let res;
          try {
            res = await escanearCurso(docCurso, {
              cursoId: curso.id,
              origen,
              signal,
              detectarLogin: true,
            });
          } catch (err) {
            if (cancelado) throw err;
            const segs = Math.round(topeCursoMs / 1000);
            const motivo = superoTope ? `superó el tope de ${segs} s` : "error inesperado";
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          if (superoTope) {
            const segs = Math.round(topeCursoMs / 1000);
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo: `superó el tope de ${segs} s`,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          if (res.motivoAviso === "sesion") {
            await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "sesion" });
            return { materia: "", enlaces: [], recorrido: true };
          }

          if (res.motivoAviso === "sin-material") {
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "vacio",
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          if (res.aviso) {
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo: res.aviso,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          await avisar({
            tipo: "curso",
            indice: i,
            resultado: "ok",
            enlaces: res.enlaces || [],
            duracionMs: Date.now() - inicioCurso,
          });
        } finally {
          clearInterval(timerLatido);
          clearTimeout(timerTope);
          abortControllerCurso = null;
        }
      }

      if (cancelado) {
        await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" });
        return { materia: "", enlaces: [], recorrido: true, cancelado: true };
      }

      // 8. Fin
      recorridoTerminado = true;
      await avisar({ tipo: "fin", estado: "terminado" });
      return { materia: "", enlaces: [], recorrido: true };
    } catch (e) {
      if (cancelado) {
        await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" });
        return { materia: "", enlaces: [], recorrido: true, cancelado: true };
      }
      throw e;
    } finally {
      recorridoTerminado = true;
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.onMessage &&
        typeof chrome.runtime.onMessage.removeListener === "function"
      ) {
        chrome.runtime.onMessage.removeListener(oyenteCancelar);
      }
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("pagehide", oyentePagehide);
      }
    }
  }
  // </recorrido-moodle>

  // Modo curso suelto
  const win = typeof window !== "undefined" ? window : {};
  let cursoId = "";
  try {
    const params = new URLSearchParams(win.location ? win.location.search : "");
    cursoId = params.get("id") || "";
  } catch {
    cursoId = "";
  }
  const origen = (win.location && win.location.origin) || "";

  return escanearCurso(document, {
    cursoId,
    origen,
    signal: undefined,
  });
}

const ScraperMoodleLinti = {
  escanearListado,
};

globalThis.ScraperMoodleLinti = ScraperMoodleLinti;
export default ScraperMoodleLinti;
export { escanearListado };
