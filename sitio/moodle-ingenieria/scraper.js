/**
 * ADAPTADOR DE SITIO — MOODLE INGENIERÍA (UNLP): ESCANEO DEL LISTADO (V1.0.0)
 * ===========================================================================
 * CHANGELOG v1.0.0:
 * - [PLAN 31 / MULTICURSO] Implementación del scraper para www.asignaturas.ing.unlp.edu.ar.
 *   - Lectura de actividades resource, folder y url bajo el curso.
 *   - Desduplicación estricta por module-<cmid> con Set (RN-4a, AC-1).
 *   - Asignación de tema por sección (sección 0 usa su nombre si lo tiene, sin nombre o General -> "Sin tema", RN-4).
 *   - Recorrido de todos los cursos desde /my/ idéntico por paridad (RN-14 a RN-24).
 *   - Emisión de campos estándar con cursoId, cursoNombre, modulo, publicacion y tipo "adjunto" (RN-1, RN-8).
 * ===========================================================================
 *
 * ⚠️ REGLA DEL PROYECTO:
 * escanearListado se inyecta en la pestaña vía chrome.scripting.executeScript.
 * Debe ser autocontenida y serializable — sin importar ni referenciar globales
 * externas de la extensión ni constantes fuera de su ámbito inyectado.
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
    if (ctx.detectarLogin) {
      const pathActual =
        (typeof window !== "undefined" && window.location && window.location.pathname) || "";
      if (esPantallaLogin(doc, pathActual)) {
        return {
          materia: "",
          enlaces: [],
          aviso: "La sesión en Moodle ha vencido o no está iniciada",
          motivoAviso: "sesion",
        };
      }
    }

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

    const cursoId = ctx.cursoId || "";
    const encabezado = doc.querySelector(".page-header-headings h1, .page-header h1, h1");
    let cursoNombre = encabezado ? encabezado.textContent.trim() : "";
    if (!cursoNombre && doc.title) {
      const tm = doc.title.match(/Curso:\s*(.+?)(?:\s*\|.*)?$/i);
      cursoNombre = tm ? tm[1].trim() : doc.title.trim();
    }

    const origen = ctx.origen || "";
    const vistos = new Set();
    const actividades = [];

    const sections = doc.querySelectorAll("[data-for=\"section\"], .section");
    for (const s of sections) {
      const h3 = s.querySelector("h3[data-for=\"section_title\"], h3.sectionname");
      const rawTitle = h3 ? h3.textContent.trim() : "";
      const esGeneral = rawTitle.toLowerCase() === "general";
      const tema = !rawTitle || esGeneral ? "Sin tema" : rawTitle;

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
    let sesionDetectada = false;

    const resultadosPorActividad = await mapearConConcurrencia(actividades, 4, async (act) => {
      if (sesionDetectada) return [];
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
          const res = await fetch(urlFolder, { credentials: "include", signal: ctx.signal });
          const urlFinal = res.url || "";
          let pathname = "";
          try {
            pathname = new URL(urlFinal, origen || undefined).pathname;
          } catch {}

          if (
            ctx.detectarLogin &&
            (pathname.startsWith("/login/") || pathname === "/login")
          ) {
            sesionDetectada = true;
            return [];
          }

          const html = await res.text();
          const parser = new DOMParser();
          const docFolder = parser.parseFromString(html, "text/html");

          if (ctx.detectarLogin && esPantallaLogin(docFolder, pathname)) {
            sesionDetectada = true;
            return [];
          }

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
          const res = await fetch(urlView, { credentials: "include", signal: ctx.signal });
          const urlFinal = res.url || "";
          let pathname = "";
          try {
            pathname = new URL(urlFinal, origen || undefined).pathname;
          } catch {}

          if (
            ctx.detectarLogin &&
            (pathname.startsWith("/login/") || pathname === "/login")
          ) {
            sesionDetectada = true;
            return [];
          }

          const html = await res.text();
          const parser = new DOMParser();
          const docUrl = parser.parseFromString(html, "text/html");

          if (ctx.detectarLogin && esPantallaLogin(docUrl, pathname)) {
            sesionDetectada = true;
            return [];
          }

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

    if (ctx.detectarLogin && sesionDetectada) {
      return {
        materia: cursoNombre,
        enlaces: [],
        aviso: "La sesión en Moodle ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    const enlaces = resultadosPorActividad.flat();

    if (enlaces.length === 0) {
      return {
        materia: cursoNombre,
        enlaces: [],
        aviso: "Este curso no tiene archivos",
        motivoAviso: "sin-material",
      };
    }

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

const ScraperMoodleIngenieria = {
  escanearListado,
};

globalThis.ScraperMoodleIngenieria = ScraperMoodleIngenieria;
export default ScraperMoodleIngenieria;
export { escanearListado };
