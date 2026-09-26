/**
 * ADAPTADOR DE SITIO — GOOGLE CLASSROOM: ESCANEO DEL LISTADO (V1.3.1)
 * ==========================================================================
 * CHANGELOG v1.3.1:
 * - [CLASSROOM CORTE 1 — IDENTIDAD EN ARCHIVADOS] En cursos archivados el title lo confirma el
 *   ancla del `<h1>` (el encabezado del curso), no "cualquier ancla al curso menos los links de
 *   vista": ese filtro descartaba al propio encabezado y dejaba G25 y MB5 sin poder escanearse.
 *
 * CHANGELOG v1.3.0:
 * - [CLASSROOM CORTE 1 — IDENTIDAD DEL CURSO] El nombre del curso sale del
 *   sidebar validado por idCurso en cursos activos, y del <title> validado
 *   contra anclas del DOM en archivados; si no valida, aborta con aviso.
 *   Verifica que los ítems y la URL pertenezcan a este curso.
 *
 * CHANGELOG v1.2.0:
 * - [CLASSROOM CORTE 1 — ADJUNTOS SIN RESOLVER] El escaneo espera a que los
 *   adjuntos resuelvan su URL real de Drive antes de listarlos, y descarta los
 *   que sigan con el href de placeholder (/open?id=). Devuelve el conteo en
 *   `adjuntosSinResolver` para que la UI pinte una nota no bloqueante.
 *
 * CHANGELOG v1.1.0:
 * - [CLASSROOM CORTE 1 — ABRIR TODOS] El paso 7 abre todos los ítems plegados
 *   en el mismo tick y espera una sola vez a que resuelvan todos. Medido
 *   (M5): 49 ítems en ~5,5 s con 57 adjuntos, contra 30–70 s de a uno.
 *
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
  escanearListado: async function (opciones) {
    const tiempos = Object.assign(
      {
        pintado: 20000,
        vuelta: 1500,
        navegacion: 15000,
        verMas: 8000,
        abrir: 8000,
        abrirTodos: 30000,
        sinAdjuntos: 1500,
        hidratacion: 10000,
        identidadCurso: 8000,
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
    const avisoCursoCambiado = {
      materia: "",
      enlaces: [],
      aviso:
        "Cambiaste de curso mientras escaneábamos, así que descartamos lo leído para no " +
        "mezclar los archivos. Re-escaneá en el curso que quieras bajar.",
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

    // El título de la SPA se sincroniza DESPUÉS de la URL y del contenido: por eso no se puede
    // usar como fuente del nombre (defecto del 2026-09-21: 81 archivos de G22 en la carpeta de
    // MC6). Se conserva sólo como candidato A VALIDAR contra el DOM.
    function nombreSegunTitulo() {
      let t = document.title || "";
      if (t.startsWith("Trabajo en clase de ")) t = t.slice("Trabajo en clase de ".length);
      if (t.startsWith("Novedades de ")) t = t.slice("Novedades de ".length);
      if (t.endsWith(" - Classroom")) t = t.slice(0, -" - Classroom".length);
      return t.trim();
    }

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

    function normalizarNombre(s) {
      return (s || "").normalize("NFKD").replace(/\s+/g, "").toLowerCase();
    }

    function hrefDelCurso(a) {
      const href = (a.getAttribute("href") || "").split(/[?#]/)[0];
      return href.endsWith("/c/" + idCurso);
    }

    // Devuelve { nombre, fuente } o null. NUNCA devuelve un nombre que el DOM no confirme.
    function resolverIdentidadCurso() {
      // (a) Cursos activos: el ancla del curso actual en la barra lateral. Su `aria-label` trae
      // el nombre completo en UN atributo, así que no se parte en nodos (medido: 12/12 idéntico
      // al nombre que hoy sale del title).
      for (const a of document.querySelectorAll('a[aria-current="page"][href*="/c/"]')) {
        const etiqueta = (a.getAttribute("aria-label") || "").trim();
        if (etiqueta && hrefDelCurso(a)) return { nombre: etiqueta, fuente: "sidebar" };
      }

      // (b) Cursos ARCHIVADOS: no están en la barra lateral (medido: G25 y MB5 no tienen ningún
      // `aria-current="page"`). Ahí el nombre sale del title, pero SÓLO si el ancla al curso
      // actual dentro del `<h1>` lo confirma. La comparación es normalizada porque el header parte
      // el nombre en varios nodos y `textContent` lo devuelve sin espacios.
      const candidato = nombreSegunTitulo();
      if (!candidato) return null;
      const objetivo = normalizarNombre(candidato);
      if (!objetivo) return null;

      // El único confirmante aceptable es el ancla al curso actual dentro del `<h1>`: el
      // encabezado del curso. Medido sobre las 62 muestras (2026-09-22): existe en 40 de las 41
      // muestras de curso, es única en todas, y su texto normalizado confirma el title en 40/40,
      // sin ninguna contradicción. Las dos pestañas de vista quedan afuera por no vivir en un
      // `<h1>`, sin mirarles el texto: filtrarlas por `buscarLinkNav` era el defecto del
      // 2026-09-21, porque `buscarLinkNav` devuelve la PRIMERA `nav a[href]` que coincide y en el
      // DOM real ésa es justamente el encabezado (el único que puede confirmar).
      for (const a of document.querySelectorAll("h1 a[href]")) {
        if (!hrefDelCurso(a)) continue;
        if (normalizarNombre(a.textContent || "") === objetivo) {
          return { nombre: candidato, fuente: "titulo-validado" };
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

    // Un adjunto está RESUELTO cuando su ancla ya apunta al archivo. Classroom pinta el
    // contenedor [data-attachment-id] ANTES de resolver el material: en esa ventana el ancla
    // lleva href .../open?id=<id> y un aria-label con los defaults del propio Classroom
    // ("Desconocido" / "Archivo de Drive", literales en su bundle — ver el plan). Los textos
    // están localizados; el href no, así que la señal es el href.
    function anclaSinResolver(a) {
      const href = a.getAttribute("href") || "";
      return /drive\.google\.com\/open\?id=/.test(href);
    }

    // Por ID de adjunto y no por div: un mismo data-attachment-id aparece en varios div
    // anidados (medido: 21 div para 15 ids) y alcanza con que UNA de sus anclas resuelva.
    // Devuelve los ids que siguen sin resolver.
    function adjuntosSinResolver(raiz) {
      const estado = new Map();
      for (const div of raiz.querySelectorAll("div[data-attachment-id]")) {
        const id = div.getAttribute("data-attachment-id") || "";
        if (!id) continue;
        const a = div.querySelector("a[aria-label][href]");
        const resuelto = Boolean(a) && !anclaSinResolver(a);
        estado.set(id, Boolean(estado.get(id)) || resuelto);
      }
      const sinResolver = [];
      for (const [id, resuelto] of estado) {
        if (!resuelto) sinResolver.push(id);
      }
      return sinResolver;
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

    let nombreCurso = "";
    let identidad = null;
    const idsSinResolver = new Set();
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

      // 7. Abrir los ítems — TODOS en el mismo tick, y una sola espera (M5, 2026-09-13).
      // Classroom no cierra un ítem al abrir otro y resuelve los ~N pedidos de detalle a la vez.
      // Sólo se hace click en los plegados: un click sobre uno ya abierto lo cerraría.
      const pendientes = Array.from(
        vistaTrabajo.querySelectorAll("li[data-expandable-row-id]")
      ).filter((li) => !li.querySelector("[data-attachment-id]"));
      for (const li of pendientes) {
        const btn = li.querySelector('div[role="button"][aria-expanded="false"]');
        if (btn) btn.click();
      }
      const expandidoDesde = new Map();
      await esperarCondicion(() => {
        const ahora = Date.now();
        return pendientes.every((li) => {
          if (li.querySelector("[data-attachment-id]")) {
            return adjuntosSinResolver(li).length === 0;
          }
          if (!li.querySelector("[expanded-item-id]")) return false;
          if (!expandidoDesde.has(li)) expandidoDesde.set(li, ahora);
          return ahora - expandidoDesde.get(li) >= tiempos.sinAdjuntos;
        });
      }, tiempos.abrirTodos);

      // 7b. Los ítems que YA estaban abiertos no pasaron por `pendientes`. Esta espera es
      // sobre la vista entera y en el camino feliz cuesta 0 ms: `esperarCondicion` evalúa el
      // predicado antes de dormir.
      await esperarCondicion(
        () => adjuntosSinResolver(vistaTrabajo).length === 0,
        tiempos.hidratacion
      );
      for (const id of adjuntosSinResolver(vistaTrabajo)) idsSinResolver.add(id);
      if (!visible()) return avisoVisibilidad;

      // Identidad del curso: recién acá el DOM ya está pintado. En el camino feliz esta espera
      // cuesta 0 ms (`esperarCondicion` evalúa el predicado antes de dormir).
      identidad = resolverIdentidadCurso();
      if (!identidad) {
        await esperarCondicion(() => Boolean(resolverIdentidadCurso()), tiempos.identidadCurso);
        identidad = resolverIdentidadCurso();
      }
      if (!identidad) {
        return {
          materia: "",
          enlaces: [],
          aviso:
            "No pudimos confirmar de qué curso es esta lista, así que no se muestra nada " +
            "(el riesgo es bajar los archivos a la carpeta de otro curso). Dejá Classroom al " +
            "frente, esperá a que el curso termine de cargar y re-escaneá.",
        };
      }
      nombreCurso = identidad.nombre;

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
          // Un `/c/<otroId>/m/` en la vista significa DOM de otro curso todavía montado.
          const anclaItem = li.querySelector('a[href*="/m/"]');
          if (anclaItem) {
            const m = /\/c\/([^/?#]+)\/m\//.exec(anclaItem.getAttribute("href") || "");
            if (m && m[1] !== idCurso) return avisoCursoCambiado;
          }

          const btn = li.querySelector('div[role="button"][aria-expanded]');
          const material = btn ? (btn.getAttribute("aria-label") || "").trim() : "";

          const vistosAtt = new Set();
          const links = li.querySelectorAll("div[data-attachment-id] a[aria-label][href]");
          for (const a of links) {
            const container = a.closest("div[data-attachment-id]");
            const attId = container ? container.getAttribute("data-attachment-id") : "";
            if (attId && vistosAtt.has(attId)) continue;
            // Ya contado en la espera; acá sólo se lo saltea para no listar un placeholder.
            // VA ANTES de marcar el id como visto: un ancla sin resolver no puede "gastar" el
            // adjunto, porque otra ancla del mismo id puede estar resuelta (un mismo
            // data-attachment-id tiene 2 o 3 anclas). Al revés, el adjunto se perdería en
            // silencio y `adjuntosSinResolver` —que mira por id— tampoco lo contaría.
            if (anclaSinResolver(a)) continue;
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

      await esperarCondicion(
        () => adjuntosSinResolver(vistaNovedades).length === 0,
        tiempos.hidratacion
      );
      for (const id of adjuntosSinResolver(vistaNovedades)) idsSinResolver.add(id);

      const todosStream = Array.from(vistaNovedades.querySelectorAll("[data-stream-item-id]"));
      const itemsExternos = todosStream.filter(
        (el) => !el.parentElement.closest("[data-stream-item-id]")
      );

      for (const post of itemsExternos) {
        // Un `/c/<otroId>/m/` en la vista significa DOM de otro curso todavía montado.
        const anclaItem = post.querySelector('a[href*="/m/"]');
        if (anclaItem) {
          const m = /\/c\/([^/?#]+)\/m\//.exec(anclaItem.getAttribute("href") || "");
          if (m && m[1] !== idCurso) return avisoCursoCambiado;
        }

        const heading = post.querySelector('h2, [role="heading"]');
        const material = heading ? (heading.textContent || "").trim() : "Novedad";
        const tema = "Novedades";

        const vistosAtt = new Set();
        const links = post.querySelectorAll("div[data-attachment-id] a[aria-label][href]");
        for (const a of links) {
          const container = a.closest("div[data-attachment-id]");
          const attId = container ? container.getAttribute("data-attachment-id") : "";
          if (attId && vistosAtt.has(attId)) continue;
          // Ya contado en la espera; acá sólo se lo saltea para no listar un placeholder.
          // VA ANTES de marcar el id como visto: un ancla sin resolver no puede "gastar" el
          // adjunto, porque otra ancla del mismo id puede estar resuelta (un mismo
          // data-attachment-id tiene 2 o 3 anclas). Al revés, el adjunto se perdería en
          // silencio y `adjuntosSinResolver` —que mira por id— tampoco lo contaría.
          if (anclaSinResolver(a)) continue;
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

    if (idsSinResolver.size > 0) {
      console.warn("[CLASSROOM] Adjuntos sin resolver, descartados:", [...idsSinResolver]);
    }
    if (identidad) {
      console.log("[CLASSROOM] Curso:", idCurso, "→", nombreCurso, `(${identidad.fuente})`);
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
        aviso:
          idsSinResolver.size > 0
            ? `Classroom no terminó de cargar los ${idsSinResolver.size} adjuntos de este curso. Dejá la pestaña al frente y re-escaneá.`
            : "Este curso no tiene archivos en Trabajo en clase ni en Novedades.",
      };
    }

    const pathFinal = location.pathname || "";
    const idCursoFinalMatch = /\/(?:c|w)\/([^/]+)/.exec(pathFinal);
    const idCursoFinal = idCursoFinalMatch ? idCursoFinalMatch[1] : null;
    if (idCursoFinal !== idCurso) {
      return avisoCursoCambiado;
    }

    return {
      materia: "",
      enlaces,
      credenciales: { authuser: cuenta },
      ...(idsSinResolver.size > 0 ? { adjuntosSinResolver: idsSinResolver.size } : {}),
    };
  },
};

globalThis.ScraperClassroom = ScraperClassroom;
export default ScraperClassroom;
