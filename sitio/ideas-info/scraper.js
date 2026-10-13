/**
 * ADAPTADOR DE SITIO — IDEAS (LIDI, UNLP): ESCANEO DEL LISTADO (V1.1.0)
 * =====================================================================
 * CHANGELOG:
 * - v1.1.0 [PLAN 36]:
 *   - Manejo estricto de errores del portal en Material, Secciones, Medioteca, Headers y EnterCourse (A1, RN-15).
 *   - Orden de secciones preservado y Medioteca al final (RN-9).
 *   - Filtrado de orígenes externos en enlaces de sección y Medioteca.
 *   - Validación de slug con SLUG_VALIDO en recorrido y curso individual (RN-5).
 *   - Lectura de texto de EnterCourse encapsulada en try-catch.
 * - v1.0.0 [PLAN 35 / MODO PURO]: Implementación del scraper para ideas.info.unlp.edu.ar.
 *   - Escaneo de curso individual a través de Material y Medioteca (RN-2, RN-3, RN-5).
 *   - Lectura de content-disposition de cabeceras para obtener nombres de archivo y tipos (RN-6).
 *   - Desduplicación de colisiones en el mismo tema agregando sufijos (RN-6, AC-10).
 *   - Recorrido multicurso desde /home con EnterCourse previo por curso (RN-13, RN-14).
 *   - Detección estricta de sesión vencida (/login) al escanear y en recorrido (RN-11).
 * =====================================================================
 *
 * ⚠️ REGLA DEL PROYECTO:
 * escanearListado se inyecta en la pestaña vía chrome.scripting.executeScript.
 * Debe ser autocontenida y serializable — sin importar ni referenciar globales
 * externas de la extensión ni constantes fuera de su ámbito inyectado.
 */

async function escanearListado(opciones = {}) {
  const SLUG_VALIDO = /^[a-z0-9-]+$/;

  function extraerNombreHeader(disposition, textoEnlaceFallback = "") {
    if (!disposition || typeof disposition !== "string") {
      return textoEnlaceFallback;
    }
    // 1. filename*=UTF-8''... (o utf-8'')
    const matchExt = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i.exec(disposition);
    if (matchExt && matchExt[1]) {
      try {
        const decoded = decodeURIComponent(matchExt[1].trim().replace(/^["']|["']$/g, ""));
        if (decoded) return decoded;
      } catch {}
    }

    // 2. filename="..." o filename=...
    const matchFn = /filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i.exec(disposition);
    if (matchFn) {
      const raw = matchFn[1] || matchFn[2] || matchFn[3] || "";
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    }

    return textoEnlaceFallback;
  }

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

  function esPantallaLogin(doc, rutaFinal = "") {
    if (typeof rutaFinal === "string" && (rutaFinal === "/login" || rutaFinal.endsWith("/login"))) {
      return true;
    }
    if (doc) {
      if (typeof doc.querySelector === "function") {
        if (doc.querySelector("#username") && doc.querySelector("#_submit")) {
          return true;
        }
      }
      const body = doc.body;
      if (body && body.classList && body.classList.contains("path-login")) {
        return true;
      }
    }
    return false;
  }

  async function escanearCurso(slug, ctx = {}) {
    const origen =
      ctx.origen ||
      (typeof window !== "undefined" && window.location && window.location.origin) ||
      "https://ideas.info.unlp.edu.ar";
    const signal = ctx.signal;

    // 1. Fetch de Material
    const urlMaterial = `${origen}/${slug}/Contents/Material/View/Show?courseTool`;
    let respMaterial;
    try {
      respMaterial = await fetch(urlMaterial, { credentials: "include", signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      return { materia: "", enlaces: [], aviso: "Error de red al consultar material", motivoAviso: "red" };
    }

    const urlMaterialFinal = respMaterial.url || "";
    let pathnameMaterialFinal = "";
    try {
      pathnameMaterialFinal = new URL(urlMaterialFinal, origen).pathname;
    } catch {}

    if (esPantallaLogin(null, pathnameMaterialFinal)) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    if (!respMaterial.ok) {
      return {
        materia: "",
        enlaces: [],
        aviso: `IDEAS respondió HTTP ${respMaterial.status} al pedir el material`,
        motivoAviso: "portal",
      };
    }

    const htmlMaterial = await respMaterial.text();
    const docMaterial = new DOMParser().parseFromString(htmlMaterial, "text/html");

    if (esPantallaLogin(docMaterial, pathnameMaterialFinal)) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    // 2. Nombre del curso
    let cursoNombre = ctx.nombreCurso || "";
    if (!cursoNombre) {
      const h4 = docMaterial.querySelector("span.col-md-8 > h4");
      cursoNombre = h4 ? h4.textContent.trim() : "";
      if (!cursoNombre) cursoNombre = slug;
    }

    // 3. Secciones de Material
    const enlacesSecciones = Array.from(docMaterial.querySelectorAll('a[onclick*="toggleContent"]'));
    const secciones = [];
    for (const a of enlacesSecciones) {
      const onclick = a.getAttribute("onclick") || "";
      const mGuid = onclick.match(/[0-9a-f-]{36}/i);
      if (mGuid) {
        secciones.push({
          guid: mGuid[0],
          titulo: a.textContent.trim(),
        });
      }
    }

    let sesionDetectada = false;
    let fallaPortal = null;

    // Pedir cada Show/<guid> con concurrencia <= 4
    const resultadosPorSeccion = await mapearConConcurrencia(secciones, 4, async (sec) => {
      if (sesionDetectada || (fallaPortal && signal?.aborted)) return [];
      const urlSec = `${origen}/${slug}/Contents/Material/View/Show/${sec.guid}`;
      try {
        const respSec = await fetch(urlSec, { credentials: "include", signal });
        const urlSecFinal = respSec.url || "";
        let pathnameSec = "";
        try {
          pathnameSec = new URL(urlSecFinal, origen).pathname;
        } catch {}
        if (esPantallaLogin(null, pathnameSec)) {
          sesionDetectada = true;
          return [];
        }

        if (!respSec.ok) {
          if (!fallaPortal) {
            fallaPortal = `IDEAS respondió HTTP ${respSec.status} al pedir la sección «${sec.titulo}»`;
          }
          return [];
        }

        const htmlSec = await respSec.text();
        const docSec = new DOMParser().parseFromString(htmlSec, "text/html");
        if (esPantallaLogin(docSec, pathnameSec)) {
          sesionDetectada = true;
          return [];
        }

        const links = Array.from(docSec.querySelectorAll("a.contentToView"));
        const candidatosSec = [];
        for (const a of links) {
          const hrefRel = a.getAttribute("href") || "";
          const mGuid = hrefRel.match(/[0-9a-f-]{36}/i);
          if (!mGuid) continue;
          const u = new URL(hrefRel, origen);
          if (u.origin !== new URL(origen).origin) continue;
          candidatosSec.push({
            href: u.href,
            idArchivo: `${slug}/material/${mGuid[0]}`,
            tema: sec.titulo,
            publicacion: sec.titulo,
            textoEnlace: a.textContent.trim(),
          });
        }
        return candidatosSec;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (!fallaPortal) {
          fallaPortal = `error de red al pedir la sección «${sec.titulo}»`;
        }
        return [];
      }
    });

    if (sesionDetectada) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    if (fallaPortal) {
      return {
        materia: "",
        enlaces: [],
        aviso: fallaPortal,
        motivoAviso: "portal",
      };
    }

    const archivosCandidatos = resultadosPorSeccion.flat();

    // 4. Medioteca
    const urlMedioteca = `${origen}/${slug}/Resources/MediaLibrary/View/Show?courseTool`;
    let respMedioteca;
    try {
      respMedioteca = await fetch(urlMedioteca, { credentials: "include", signal });
    } catch (err) {
      if (signal?.aborted) throw err;
      return {
        materia: "",
        enlaces: [],
        aviso: "error de red al pedir la Medioteca",
        motivoAviso: "portal",
      };
    }

    const urlMediotecaFinal = respMedioteca.url || "";
    let pathnameMedioteca = "";
    try {
      pathnameMedioteca = new URL(urlMediotecaFinal, origen).pathname;
    } catch {}
    if (esPantallaLogin(null, pathnameMedioteca)) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    if (!respMedioteca.ok) {
      return {
        materia: "",
        enlaces: [],
        aviso: `IDEAS respondió HTTP ${respMedioteca.status} al pedir la Medioteca`,
        motivoAviso: "portal",
      };
    }

    const htmlMedioteca = await respMedioteca.text();
    const docMedioteca = new DOMParser().parseFromString(htmlMedioteca, "text/html");
    if (esPantallaLogin(docMedioteca, pathnameMedioteca)) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    const linksMedioteca = Array.from(docMedioteca.querySelectorAll('a[href*="AccessResource"]'));
    for (const a of linksMedioteca) {
      const hrefRel = a.getAttribute("href") || "";
      const mGuid = hrefRel.match(/[0-9a-f-]{36}/i);
      if (!mGuid) continue;
      const u = new URL(hrefRel, origen);
      if (u.origin !== new URL(origen).origin) continue;
      archivosCandidatos.push({
        href: u.href,
        idArchivo: `${slug}/medioteca/${mGuid[0]}`,
        tema: "Medioteca",
        publicacion: "Medioteca",
        textoEnlace: a.textContent.trim(),
      });
    }

    // 5. Headers con concurrencia <= 4
    let fallaHeader = null;
    const itemsObtenidos = await mapearConConcurrencia(archivosCandidatos, 4, async (cand) => {
      if (sesionDetectada || (fallaHeader && signal?.aborted)) return null;
      try {
        const respHeader = await fetch(cand.href, { credentials: "include", signal });
        const urlHFinal = respHeader.url || "";
        let pathnameH = "";
        try {
          pathnameH = new URL(urlHFinal, origen).pathname;
        } catch {}

        if (esPantallaLogin(null, pathnameH)) {
          sesionDetectada = true;
          return null;
        }

        if (respHeader.status === 404 || respHeader.status === 410) {
          return null; // Archivo afuera (RN-12)
        }

        if (!respHeader.ok) {
          if (respHeader.body && typeof respHeader.body.cancel === "function") {
            try {
              respHeader.body.cancel();
            } catch {}
          }
          if (!fallaHeader) {
            fallaHeader = `IDEAS respondió HTTP ${respHeader.status} al leer el nombre de «${cand.textoEnlace}»`;
          }
          return null;
        }

        const cd = respHeader.headers ? respHeader.headers.get("content-disposition") : null;
        const nombre = extraerNombreHeader(cd, cand.textoEnlace);

        if (respHeader.body && typeof respHeader.body.cancel === "function") {
          try {
            respHeader.body.cancel();
          } catch {}
        }

        return {
          texto: nombre,
          url: cand.href,
          tipo: "adjunto",
          idArchivo: cand.idArchivo,
          modulo: `${cursoNombre} › ${cand.tema}`,
          tema: cand.tema,
          publicacion: cand.publicacion,
          cursoId: slug,
          cursoNombre,
          textoEnlace: cand.textoEnlace,
        };
      } catch (err) {
        if (signal?.aborted) throw err;
        if (!fallaHeader) {
          fallaHeader = `error de red al leer el nombre de «${cand.textoEnlace}»`;
        }
        return null;
      }
    });

    if (sesionDetectada) {
      return {
        materia: "",
        enlaces: [],
        aviso: "La sesión en IDEAS ha vencido o no está iniciada",
        motivoAviso: "sesion",
      };
    }

    if (fallaHeader) {
      return {
        materia: "",
        enlaces: [],
        aviso: fallaHeader,
        motivoAviso: "portal",
      };
    }

    const itemsValidos = itemsObtenidos.filter(Boolean);

    // 6. Choques (RN-6, AC-10)
    const grupos1 = new Map();
    for (const it of itemsValidos) {
      const clave = `${it.tema}::${normDisco(it.texto)}`;
      if (!grupos1.has(clave)) grupos1.set(clave, []);
      grupos1.get(clave).push(it);
    }

    for (const [, grupo] of grupos1) {
      const idsDistintos = new Set(grupo.map((i) => i.idArchivo));
      if (idsDistintos.size > 1) {
        for (const it of grupo) {
          if (it.textoEnlace) {
            it.texto = insertarAntesDeExt(it.texto, ` - ${it.textoEnlace}`);
          }
        }
      }
    }

    const grupos2 = new Map();
    for (const it of itemsValidos) {
      const clave = `${it.tema}::${normDisco(it.texto)}`;
      if (!grupos2.has(clave)) grupos2.set(clave, []);
      grupos2.get(clave).push(it);
    }

    for (const [, grupo] of grupos2) {
      const idsDistintos = new Set(grupo.map((i) => i.idArchivo));
      if (idsDistintos.size > 1) {
        let cuenta = 1;
        for (const it of grupo) {
          if (cuenta > 1) {
            it.texto = insertarAntesDeExt(it.texto, ` (${cuenta})`);
          }
          cuenta++;
        }
      }
    }

    // Limpiar propiedad auxiliar
    const enlaces = itemsValidos.map((it) => ({
      texto: it.texto,
      url: it.url,
      tipo: it.tipo,
      idArchivo: it.idArchivo,
      modulo: it.modulo,
      tema: it.tema,
      publicacion: it.publicacion,
      cursoId: it.cursoId,
      cursoNombre: it.cursoNombre,
    }));

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

  // <recorrido-ideas>
  if (opciones && opciones.modo === "todos") {
    const {
      idRecorrido,
      tabId,
      sitioId,
      topeCursoMs = 120000,
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
      const origen =
        opciones.origen ||
        (typeof window !== "undefined" && window.location && window.location.origin) ||
        "https://ideas.info.unlp.edu.ar";

      // Esperar los cursos de /home (hasta 5 s)
      const selectorEnlaces = '.content-my-courses a[href*="/Start/Welcome/View/Show/EnterCourse/"]';
      const obtenerEnlacesCursos = () => {
        return Array.from(document.querySelectorAll(selectorEnlaces));
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

      // Enumeración (RN-13)
      const slugsVistos = new Set();
      const cursos = [];
      for (const a of enlaces) {
        const href = a.getAttribute("href") || a.href || "";
        let pathname = "";
        try {
          pathname = new URL(href, origen).pathname;
        } catch {
          pathname = href;
        }
        const segmentos = pathname.replace(/^\/+/, "").split("/");
        const slug = segmentos[0] || "";
        if (!slug || slugsVistos.has(slug)) continue;
        slugsVistos.add(slug);

        const box = typeof a.closest === "function" ? a.closest(".course-box") : null;
        const linkTitulo = box ? box.querySelector(".course-title-header p.title a") : null;
        const nombre = (linkTitulo ? linkTitulo.textContent.trim() : "") || slug;

        const enterCourseHref = new URL(href, origen).href;
        cursos.push({
          id: slug,
          slug,
          nombre,
          enterCourseHref,
        });
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

      // Inicio
      const evInicio = {
        tipo: "inicio",
        cursos: cursos.map((c) => ({ slug: c.slug, nombre: c.nombre, id: c.slug })),
        ...(lanzadoEn !== undefined ? { lanzadoEn } : {}),
      };
      await avisar(evInicio);

      // Por curso en serie
      for (let i = 0; i < cursos.length; i++) {
        if (cancelado) {
          await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" });
          return { materia: "", enlaces: [], recorrido: true, cancelado: true };
        }

        const curso = cursos[i];
        const inicioCurso = Date.now();

        if (!SLUG_VALIDO.test(curso.slug)) {
          await avisar({
            tipo: "curso",
            indice: i,
            resultado: "fallido",
            motivo: `IDEAS devolvió un curso con un identificador que no se puede bajar («${curso.slug}»)`,
            duracionMs: Date.now() - inicioCurso,
          });
          continue;
        }

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
          let respEnter;
          try {
            respEnter = await fetch(curso.enterCourseHref, { credentials: "include", signal });
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

          const urlEnterFinal = respEnter.url || "";
          let pathnameEnterFinal = "";
          try {
            pathnameEnterFinal = new URL(urlEnterFinal, origen).pathname;
          } catch {}

          if (esPantallaLogin(null, pathnameEnterFinal)) {
            await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "sesion" });
            return { materia: "", enlaces: [], recorrido: true };
          }

          if (!respEnter.ok) {
            await avisar({
              tipo: "curso",
              indice: i,
              resultado: "fallido",
              motivo: `HTTP ${respEnter.status}`,
              duracionMs: Date.now() - inicioCurso,
            });
            continue;
          }

          let docEnter;
          try {
            const htmlEnter = await respEnter.text();
            docEnter = new DOMParser().parseFromString(htmlEnter, "text/html");
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

          if (esPantallaLogin(docEnter, pathnameEnterFinal)) {
            await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "sesion" });
            return { materia: "", enlaces: [], recorrido: true };
          }

          let res;
          try {
            res = await escanearCurso(curso.slug, {
              nombreCurso: curso.nombre,
              origen,
              signal,
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
  // </recorrido-ideas>

  // Modo un curso
  const win = typeof window !== "undefined" ? window : {};
  let slug = opciones.slug || "";
  if (!slug && win.location && win.location.pathname) {
    const segmentos = win.location.pathname.replace(/^\/+/, "").split("/");
    slug = segmentos[0] || "";
  }

  if (!slug || slug === "home" || slug === "login" || !SLUG_VALIDO.test(slug)) {
    return {
      materia: "",
      enlaces: [],
      aviso: "Andá a tu inicio (/home) para escanear todos tus cursos, o abrí un curso.",
      motivoAviso: "fuera-de-curso",
    };
  }

  const origen =
    opciones.origen ||
    (win.location && win.location.origin) ||
    "https://ideas.info.unlp.edu.ar";

  return escanearCurso(slug, {
    origen,
    signal: opciones.signal,
    nombreCurso: opciones.nombreCurso,
  });
}

const ScraperIdeasInfo = {
  escanearListado,
};

globalThis.ScraperIdeasInfo = ScraperIdeasInfo;
export default ScraperIdeasInfo;
export { escanearListado };
