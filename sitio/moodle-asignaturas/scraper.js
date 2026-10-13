/**
 * ADAPTADOR DE SITIO — MOODLE ASIGNATURAS (UNLP): ESCANEO DEL LISTADO (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [PLAN 29 / MULTICURSO] Recorrido de todos los cursos desde /my/.
 *   Extrae escanearCurso para reuso con AbortSignal y detección opcional de sesión.
 *   Oyente de cancelación, eventos de recorrido y bloque con paridad idéntico a LINTI.
 *
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
    const entriesKaltura = new Set();

    const sections = doc.querySelectorAll("[data-for=\"section\"], .section");
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
        let kaltura = null;
        if (!tipo && act.classList.contains("modtype_label")) {
          // RN-15/16: video Kaltura embebido; el iframe lo crea el script, así que se arma del HTML crudo
          let entryId = "";
          let embed = null;
          for (const sc of act.querySelectorAll("script")) {
            const src = sc.getAttribute("src") || "";
            const ms = src.match(/^https?:\/\/([^/]+)\/p\/(\d+)\/sp\/\d+\/embedIframeJs\/uiconf_id\/(\d+)\/partner_id\/(\d+)/);
            if (ms && !embed) embed = { host: ms[1], pid: ms[2], uiconf: ms[3] };
            const txt = sc.textContent || "";
            if (!entryId && txt.includes("kWidget.embed")) {
              const me = txt.match(/"entry_id"\s*:\s*"([^"]+)"/);
              if (me) entryId = me[1];
            }
          }
          if (entryId && embed && !entriesKaltura.has(entryId)) {
            entriesKaltura.add(entryId);
            tipo = "kaltura";
            kaltura = { ...embed, entryId };
          }
        }
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
          kaltura,
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
        let texto = actName;
        try {
          const res = await fetch(url, { credentials: "include", signal: ctx.signal });
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

          let nombreArchivo = "";
          if (urlFinal.includes("pluginfile.php")) {
            if (res.body && typeof res.body.cancel === "function") {
              try {
                res.body.cancel().catch(() => {});
              } catch {}
            }
            const segmentos = pathname.split("/").filter(Boolean);
            const ultimoSegmento = segmentos[segmentos.length - 1] || "";
            try {
              nombreArchivo = decodeURIComponent(ultimoSegmento);
            } catch {
              nombreArchivo = ultimoSegmento;
            }
          } else {
            const html = await res.text();
            if (ctx.detectarLogin) {
              const parser = new DOMParser();
              const docResource = parser.parseFromString(html, "text/html");
              if (esPantallaLogin(docResource, pathname)) {
                sesionDetectada = true;
                return [];
              }
            }
            const regexResource = /https?:\/\/[^\s"'><]+pluginfile\.php\/[^\s"'><]+mod_resource\/content\/[^\s"'><]+/;
            const match = html.match(regexResource);
            if (match) {
              const enlaceEncontrado = match[0].replace(/&amp;/g, "&");
              try {
                const uObj = new URL(enlaceEncontrado, origen || undefined);
                const segs = uObj.pathname.split("/").filter(Boolean);
                const ultimoSeg = segs[segs.length - 1] || "";
                nombreArchivo = decodeURIComponent(ultimoSeg);
              } catch {
                const sinQuery = enlaceEncontrado.split("?")[0];
                const partes = sinQuery.split("/");
                const ultimo = partes[partes.length - 1] || "";
                try {
                  nombreArchivo = decodeURIComponent(ultimo);
                } catch {
                  nombreArchivo = ultimo;
                }
              }
            }
          }

          if (nombreArchivo) {
            const mExt = /\.([a-z0-9]{1,8})$/i.exec(nombreArchivo);
            if (mExt) {
              const ext = mExt[1].toLowerCase();
              const regexFinExt = new RegExp(`\\.${ext}$`, "i");
              if (regexFinExt.test(actName)) {
                texto = actName;
              } else {
                texto = `${actName}.${ext}`;
              }
            }
          }
        } catch (err) {
          if (err && (err.name === "AbortError" || ctx.signal?.aborted)) {
            throw err;
          }
          texto = actName;
        }

        return [
          {
            texto,
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

      if (tipo === "kaltura") {
        const { host, pid, uiconf, entryId } = act.kaltura;
        const urlVideo = `https://${host}/p/${pid}/sp/${pid}00/embedIframeJs/uiconf_id/${uiconf}/partner_id/${pid}?iframeembed=true&entry_id=${entryId}`;
        const titulo = actName || `Video ${entryId}`;
        return [
          {
            texto: titulo.endsWith(".md") ? titulo : `${titulo}.md`,
            url: urlVideo,
            tipo: "adjunto",
            idArchivo: `acceso:${encodeURIComponent(urlVideo)}:${encodeURIComponent(titulo)}`,
            modulo,
            tema,
            publicacion: actName,
            cursoId,
            cursoNombre,
          },
        ];
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
    let paginaSaliendo = false;
    const oyentePagehide = () => {
      paginaSaliendo = true;
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
          if (paginaSaliendo) return;
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
      const textoVisible = (el) => {
        if (!el) return "";
        const clon = el.cloneNode(true);
        if (typeof clon.querySelectorAll === "function") {
          clon
            .querySelectorAll(".sr-only, .accesshide, .visually-hidden")
            .forEach((s) => s.remove());
        }
        return (clon.textContent || "").trim().replace(/\s+/g, " ");
      };

      const ordenIds = [];
      const enlacesPorId = new Map();
      for (const a of enlaces) {
        const m = /[?&]id=(\d+)/.exec(a.href);
        if (!m) continue;
        const id = m[1];
        if (!enlacesPorId.has(id)) {
          ordenIds.push(id);
          enlacesPorId.set(id, []);
        }
        enlacesPorId.get(id).push(a);
      }

      const cursos = [];
      for (const id of ordenIds) {
        const lista = enlacesPorId.get(id) || [];
        let nombre = "";

        // 1. el texto visible del primer a.coursename del id
        const primerCoursename = lista.find(
          (a) =>
            (typeof a.matches === "function" && a.matches("a.coursename, .coursename")) ||
            (a.classList && typeof a.classList.contains === "function" && a.classList.contains("coursename")) ||
            (typeof a.querySelector === "function" && a.querySelector(".coursename"))
        );
        if (primerCoursename) {
          nombre = textoVisible(primerCoursename);
        }

        // 2. si no hay, el primer texto visible no vacío entre sus enlaces
        if (!nombre) {
          for (const a of lista) {
            const txt = textoVisible(a);
            if (txt) {
              nombre = txt;
              break;
            }
          }
        }

        // 3. si no hay, el primer aria-label o textContent no vacío (lo de hoy)
        if (!nombre) {
          for (const a of lista) {
            const fallback = (
              (typeof a.getAttribute === "function" && a.getAttribute("aria-label")) ||
              a.textContent ||
              ""
            )
              .trim()
              .replace(/\s+/g, " ");
            if (fallback) {
              nombre = fallback;
              break;
            }
          }
        }

        // 4. si no, Curso <id>
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
    detectarLogin: true,
  });
}

const ScraperMoodleAsignaturas = {
  escanearListado,
};

globalThis.ScraperMoodleAsignaturas = ScraperMoodleAsignaturas;
export default ScraperMoodleAsignaturas;
export { escanearListado };
