/**
 * CLON DOWNLOADHELPER - FEATURE: FILTROS Y BÚSQUEDA (V2.1.0)
 * ==========================================================================
 * CHANGELOG v2.1.0:
 * - [MULTISITIO CORTE 6C] La pestaña Cola gana una sección **Portal**: una casilla maestra
 *   por portal y, anidadas debajo, SUS facetas con SU vocabulario. Es en cascada, no
 *   cruzada — ver el bloque de abajo, que explica por qué esa diferencia es la que hace
 *   barato este corte. La sección aparece sólo con la cola mezclada; con un solo portal la
 *   pantalla queda idéntica a la de antes.
 * - [MULTISITIO CORTE 6C] En la Cola, los valores de faceta van **calificados por portal**
 *   (`sitioId|valor`) dentro de `filtrosActivos.valoresFaceta`. Sin calificar, dos portales
 *   con una faceta de la misma etiqueta se pisan y el filtro de uno arrastra al otro.
 *   Disponibles NO cambia: es de un solo portal por construcción.
 * CHANGELOG v2.0.0:
 * - [CAPA 2] El filtro por cátedra pasa a ser un filtro por "faceta" genérica: los
 *   strings "Cátedra"/"Cat X"/"Común", los centinelas COMUN/TODAS, el ícono 🎓 y la
 *   derivación del valor (campo del listado vs. re-parseo del título en la cola)
 *   salen ahora del descriptor `ctx.sitio.faceta` (sitio/ramonnet/config.js). El Set
 *   `filtrosActivos.catedras` se renombró a `filtrosActivos.valoresFaceta`. Mismos
 *   textos en pantalla y mismo comportamiento.
 * CHANGELOG v1.0.0:
 * - [SPLIT] Extraída de popup.js toda la lógica de filtrado/búsqueda: el filtrado
 *   cruzado del listado de disponibles (aplicarFiltrosCruzados), el popover de
 *   filtros (renderizarFiltrosMenuPopover + crearPopoverOptionDOM), el contador de
 *   filtros activos (actualizarPillsUIState) y la (re)habilitación de los controles
 *   (desbanearFiltros). Además se unificó el predicado de filtrado de la pestaña Cola
 *   —antes duplicado en 3 lugares de popup.js (masterCheck, renderizarListadoInterfaz,
 *   actualizarMasterCheckState)— en coincideConFiltrosCola(clase, busqueda). Sin
 *   cambio de comportamiento respecto a popup.js v5.10.0. Ver ADR-0005, ROADMAP Fase 2.
 * ==========================================================================
 * Módulo 4/4 de la reorganización feature-driven de popup.js
 * (ver docs/adr/0005-feature-driven-popup-split.md, docs/ROADMAP.md Fase 2).
 *
 * El objeto de estado `filtrosActivos` (Sets estados/materias/valoresFaceta) sigue viviendo
 * en popup.js y se pasa POR REFERENCIA en ctx (objeto compartido, igual que queue.js
 * recibe `nodos`): así los pocos call-sites externos que lo mutan/leen directo
 * (conmutarPestañaA lo limpia) no se rompen. Esta feature muta ESE mismo objeto.
 *
 * **Por qué la cascada y no el filtro cruzado** (decidido el 2026-08-05): cruzado sería
 * ofrecer todas las facetas de todos los portales a la vez, y poder marcar "Cátedra A" junto
 * con "Comisión 1". En cascada se elige portal y el filtro de faceta pasa a ser exactamente el
 * de hoy, pero dentro de ese portal. La diferencia se paga en el popover, y el popover ya está
 * hecho de secciones — así que "Portal" es una sección más, no una estructura nueva.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos               : mapa de nodos (usa search, folder, filterMenu,
 *                               btnFilterPills, masterCheck, btnSort).
 *   - ctx.filtrosActivos      : { estados:Set, materias:Set, valoresFaceta:Set, portales:Set }
 *                               por referencia.
 *   - ctx.sitio               : adaptador de sitio activo; usa `sitio.faceta`.
 *   - ctx.renderizar()        : re-render del listado (renderizarListadoInterfaz, popup.js).
 *   - ctx.actualizarContadores(): refresco de contadores del botón de acción (popup.js).
 *
 * Expone: coincideConFiltrosCola, aplicarFiltrosCruzados, desbanearFiltros,
 *         actualizarPillsUIState, renderizarFiltrosMenuPopover.
 */
const FilterFeature = {
  crear(ctx) {
    const { nodos, filtrosActivos, renderizar, actualizarContadores, sitio, appState, sitios } = ctx;
    // Eje de clasificación propio del sitio (en Ramón Net: la cátedra). Esta feature
    // filtra POR la faceta sin saber qué representa — ver sitio/ramonnet/config.js.
    const faceta = sitio.faceta;

    /**
     * La faceta de un ítem DE LA COLA sale de su propio portal, no del sitio activo.
     *
     * `ColaItem` no persiste el valor de la faceta: el descriptor lo re-deriva con
     * `clasificarCarpeta()`, que es específica del portal. Con la cola mezclada —y está
     * desacoplada de la pestaña justamente para poder mezclarse— re-derivar con el descriptor
     * equivocado devuelve un valor **plausible pero falso**, sin tirar ningún error. Ese es el
     * bug que arregla el corte 4 de `docs/multisitio-diseno.md`.
     *
     * Si el portal no resuelve (ítem huérfano), devuelve `undefined`: el ítem simplemente no
     * matchea un filtro de faceta activo, que es el comportamiento que ya tenía un ítem sin
     * valor.
     */
    const facetaDeCola = (item) => sitios.obtener(item && item.sitioId)?.faceta;

    /** El descriptor del portal de un ítem de la cola, con la migración ya aplicada. */
    const portalDe = (item) => sitios.obtener(item && item.sitioId);

    /**
     * El id del portal de un ítem, tomado del DESCRIPTOR y no del campo crudo.
     *
     * La diferencia importa: un ítem anterior al multi-sitio tiene `sitioId` ausente y el
     * resolvedor lo migra al portal legado. Leer el campo crudo lo dejaría en un grupo `""`
     * propio y la cola parecería mezclada cuando no lo está. Un huérfano (id presente pero
     * no registrado) sí devuelve `""`: no sabemos de dónde vino y no se le puede poner nombre.
     */
    const idPortalDe = (item) => portalDe(item)?.id ?? "";

    /**
     * La clave con la que un ítem de la cola entra en `filtrosActivos.valoresFaceta`.
     *
     * Calificada por portal, porque dos portales pueden tener facetas con la misma etiqueta
     * ("A" de cátedra y "A" de comisión) y sin el prefijo marcar una filtraría las dos.
     */
    const claveFaceta = (item) => `${idPortalDe(item)}|${facetaDeCola(item)?.leerDeCola(item)}`;

    // Predicado compartido del filtrado de la pestaña Cola. Unifica las 3 copias
    // que vivían duplicadas en popup.js (masterCheck, renderizarListadoInterfaz,
    // actualizarMasterCheckState). NO incluye el descarte del video activo (!esActivo):
    // eso es específico de la selección maestra, el caller lo agrega aparte.
    function coincideConFiltrosCola(clase, busqueda) {
      const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
      const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
      // [CORTE 6C] El portal filtra ANTES que la faceta, que es lo que hace la cascada: elegir
      // un portal sin marcar ninguna faceta suya muestra todo ese portal.
      const coincidePortal = filtrosActivos.portales.size === 0
        || filtrosActivos.portales.has(idPortalDe(clase));
      const coincideFaceta = filtrosActivos.valoresFaceta.size === 0
        || filtrosActivos.valoresFaceta.has(claveFaceta(clase));
      return coincideTexto && coincideMateria && coincidePortal && coincideFaceta;
    }

    // Recalcula la visibilidad del listado global de disponibles cruzando materia +
    // texto + estado + cátedra, y re-renderiza. La pestaña Cola filtra aparte, en el
    // render (con coincideConFiltrosCola).
    function aplicarFiltrosCruzados() {
      const busqueda = nodos.search.value.toLowerCase().trim();
      const materiaActiva = nodos.folder.value.trim().toLowerCase();

      appState.listadoClasesGlobal.forEach(clase => {
        const coincideMateria = !clase.carpeta || (clase.carpeta.toLowerCase() === materiaActiva);
        const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
        const coincideEstado = filtrosActivos.estados.size === 0 || filtrosActivos.estados.has(clase.estado);

        const valor = faceta.leer(clase);
        const elegido = appState[faceta.claveEstado];
        let coincideFaceta = true;
        if (filtrosActivos.valoresFaceta.size > 0) {
          coincideFaceta = filtrosActivos.valoresFaceta.has(valor);
        } else if (elegido && elegido !== faceta.valorTodas) {
          coincideFaceta = (valor === elegido || valor === faceta.valorComun);
        }

        clase.visible = coincideMateria && coincideTexto && coincideEstado && coincideFaceta;
      });

      renderizar();
      actualizarContadores();
    }

    // (Re)habilita los controles de filtrado/búsqueda una vez que hay listado cargado.
    function desbanearFiltros() {
      nodos.search.disabled = false;
      nodos.btnFilterPills.disabled = false;
      nodos.masterCheck.disabled = !appState.sincronizacionDiscoCompletada;
      if (nodos.btnSort) nodos.btnSort.disabled = false;
    }

    // Actualiza el badge del botón "Filtros (N)" según cuántos filtros haya activos.
    function actualizarPillsUIState() {
      if (!nodos.btnFilterPills) return;
      const total = filtrosActivos.estados.size + filtrosActivos.materias.size
        + filtrosActivos.valoresFaceta.size + filtrosActivos.portales.size;
      nodos.btnFilterPills.classList.toggle('active', total > 0);
      const span = nodos.btnFilterPills.querySelector('span');
      if (span) {
        span.textContent = total > 0 ? `Filtros (${total})` : "Filtros";
      }
    }

    function crearPopoverOptionDOM(labelText, isChecked, onChange) {
      const label = document.createElement("label");
      label.className = "popover-option";

      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = isChecked;
      check.addEventListener("change", (e) => onChange(e.target.checked));

      const span = document.createElement("span");
      span.textContent = labelText;

      label.append(check, span);
      return label;
    }

    // Reconstruye el contenido del popover de filtros según la pestaña activa:
    // Disponibles => Estado + Cátedra; Cola => Materia + Cátedra (derivadas de la cola).
    function renderizarFiltrosMenuPopover() {
      if (!nodos.filterMenu) return;
      nodos.filterMenu.innerHTML = "";

      if (appState.pestañaActiva === "disponibles") {
        // --- Sección Estado ---
        const secEstado = document.createElement("div");
        secEstado.className = "popover-section";

        const titEstado = document.createElement("div");
        titEstado.className = "popover-section-title";
        titEstado.textContent = "Estado";
        secEstado.appendChild(titEstado);

        const estadosDisponibles = [
          { key: "pending", label: "Pendientes" },
          { key: "downloaded", label: "Descargados" },
          { key: "process", label: "En Fila" }
        ];

        estadosDisponibles.forEach(est => {
          const opt = crearPopoverOptionDOM(est.label, filtrosActivos.estados.has(est.key), (checked) => {
            if (checked) {
              filtrosActivos.estados.add(est.key);
            } else {
              filtrosActivos.estados.delete(est.key);
            }
            actualizarPillsUIState();
            aplicarFiltrosCruzados();
          });
          secEstado.appendChild(opt);
        });
        nodos.filterMenu.appendChild(secEstado);

        // --- Sección de la faceta del sitio (en Ramón Net: Cátedra) ---
        let valoresDetectados = Array.from(new Set(
          appState.listadoClasesGlobal.map(c => faceta.leer(c)).filter(v => v !== faceta.valorComun)
        )).sort(faceta.ordenar);

        const elegido = appState[faceta.claveEstado];
        if (elegido && elegido !== faceta.valorTodas) {
          valoresDetectados = valoresDetectados.filter(v => v === elegido);
        }

        if (valoresDetectados.length > 0) {
          const secFaceta = document.createElement("div");
          secFaceta.className = "popover-section";

          const titFaceta = document.createElement("div");
          titFaceta.className = "popover-section-title";
          titFaceta.textContent = faceta.etiqueta;
          secFaceta.appendChild(titFaceta);

          // El valor común va siempre como opción, aunque no esté en los detectados.
          [faceta.valorComun, ...valoresDetectados].forEach(valor => {
            const opt = crearPopoverOptionDOM(
              faceta.etiquetarCorto(valor),
              filtrosActivos.valoresFaceta.has(valor),
              (checked) => {
                if (checked) filtrosActivos.valoresFaceta.add(valor);
                else filtrosActivos.valoresFaceta.delete(valor);
                actualizarPillsUIState();
                aplicarFiltrosCruzados();
              }
            );
            secFaceta.appendChild(opt);
          });
          nodos.filterMenu.appendChild(secFaceta);
        }
      } else {
        // --- Vista Pestaña Cola ---
        const materiasUnicas = new Set();

        // [CORTE 6C] La cola se agrupa por portal: cada grupo lleva su descriptor —del que sale
        // SU vocabulario de faceta— y los valores presentes en la cola para ese portal. Los
        // huérfanos (portal no registrado) quedan fuera a propósito: sin descriptor no hay ni
        // nombre que mostrar ni faceta que derivar, y adivinar es el bug que ADR-0010 previene.
        const grupos = new Map();

        appState.colaDescargas.forEach(c => {
          materiasUnicas.add(c.carpeta.toUpperCase());

          const portal = portalDe(c);
          if (!portal) return;
          if (!grupos.has(portal.id)) grupos.set(portal.id, { portal, valores: new Set() });
          const valor = portal.faceta?.leerDeCola(c);
          if (valor != null) grupos.get(portal.id).valores.add(valor);
        });

        // --- Sección Materias ---
        if (materiasUnicas.size > 0) {
          const secMateria = document.createElement("div");
          secMateria.className = "popover-section";

          const titMateria = document.createElement("div");
          titMateria.className = "popover-section-title";
          titMateria.textContent = "Materia";
          secMateria.appendChild(titMateria);

          Array.from(materiasUnicas).sort().forEach(mat => {
            const opt = crearPopoverOptionDOM(`📁 ${mat}`, filtrosActivos.materias.has(mat), (checked) => {
              if (checked) filtrosActivos.materias.add(mat);
              else filtrosActivos.materias.delete(mat);
              actualizarPillsUIState();
              aplicarFiltrosCruzados();
            });
            secMateria.appendChild(opt);
          });
          nodos.filterMenu.appendChild(secMateria);
        }

        // [CORTE 6C] Con la cola mezclada manda la sección Portal (cada portal con SUS facetas
        // anidadas); con un solo portal se mantiene la sección plana de siempre, que es lo que
        // deja la pantalla idéntica a la de antes del corte.
        if (grupos.size > 1) {
          nodos.filterMenu.appendChild(crearSeccionPortales(grupos));
        } else if (grupos.size === 1) {
          const { portal, valores } = grupos.values().next().value;
          if (valores.size > 0) nodos.filterMenu.appendChild(crearSeccionFacetaPlana(portal, valores));
        }
      }
    }

    /** Una opción de faceta de la cola, con su valor ya calificado por portal. */
    function crearOpcionFaceta(portal, valor, anidada) {
      const clave = `${portal.id}|${valor}`;
      const etiqueta = `${portal.faceta.icono} ${portal.faceta.etiquetarCorto(valor)}`;
      const opt = crearPopoverOptionDOM(etiqueta, filtrosActivos.valoresFaceta.has(clave), (checked) => {
        if (checked) filtrosActivos.valoresFaceta.add(clave);
        else filtrosActivos.valoresFaceta.delete(clave);
        actualizarPillsUIState();
        aplicarFiltrosCruzados();
        // Anidada, el estado de la maestra se DERIVA de estas casillas, así que hay que
        // repintar la sección o la maestra queda mostrando un estado viejo. En la sección
        // plana no hay maestra y repintar sería trabajo de más.
        if (anidada) renderizarFiltrosMenuPopover();
      });
      if (anidada) opt.classList.add("anidada");
      return opt;
    }

    /** La sección de faceta de siempre, para cuando la cola es de un solo portal. */
    function crearSeccionFacetaPlana(portal, valores) {
      const sec = document.createElement("div");
      sec.className = "popover-section";

      const tit = document.createElement("div");
      tit.className = "popover-section-title";
      tit.textContent = portal.faceta.etiqueta;
      sec.appendChild(tit);

      Array.from(valores).sort(portal.faceta.ordenar)
        .forEach(valor => sec.appendChild(crearOpcionFaceta(portal, valor, false)));
      return sec;
    }

    /**
     * La sección Portal: una casilla maestra por portal y, anidadas, sus facetas.
     *
     * La maestra es un filtro por derecho propio —marcarla sin tocar ninguna faceta muestra el
     * portal entero—, y su estado se DERIVA de las facetas marcadas: si hay algunas y no todas,
     * queda indeterminada. Desmarcarla se lleva sus facetas: dejarlas sueltas seguiría filtrando
     * por un portal que en pantalla figura como apagado.
     */
    function crearSeccionPortales(grupos) {
      const sec = document.createElement("div");
      sec.className = "popover-section";

      const tit = document.createElement("div");
      tit.className = "popover-section-title";
      tit.textContent = "Portal";
      sec.appendChild(tit);

      Array.from(grupos.values())
        .sort((a, b) => a.portal.nombre.localeCompare(b.portal.nombre))
        .forEach(({ portal, valores }) => {
          const claves = Array.from(valores).map(v => `${portal.id}|${v}`);
          const marcadas = claves.filter(k => filtrosActivos.valoresFaceta.has(k));
          const elegido = filtrosActivos.portales.has(portal.id) || marcadas.length > 0;

          const maestra = crearPopoverOptionDOM(portal.nombre, elegido, (checked) => {
            if (checked) {
              filtrosActivos.portales.add(portal.id);
            } else {
              filtrosActivos.portales.delete(portal.id);
              claves.forEach(k => filtrosActivos.valoresFaceta.delete(k));
            }
            actualizarPillsUIState();
            aplicarFiltrosCruzados();
            renderizarFiltrosMenuPopover();
          });
          maestra.classList.add("maestra");
          // Parcial: algunas de sus facetas marcadas, pero no todas.
          maestra.querySelector("input").indeterminate =
            marcadas.length > 0 && marcadas.length < claves.length;
          sec.appendChild(maestra);

          Array.from(valores).sort(portal.faceta.ordenar)
            .forEach(valor => sec.appendChild(crearOpcionFaceta(portal, valor, true)));
        });

      return sec;
    }

    return {
      coincideConFiltrosCola,
      aplicarFiltrosCruzados,
      desbanearFiltros,
      actualizarPillsUIState,
      renderizarFiltrosMenuPopover,
    };
  }
};

// Exportación (ver docs/coding-standards.md). Desde la Fase 8a NO publica global: los
// módulos hermanos viajan por `import` y no son adaptadores intercambiables. (Hasta el
// 2026-08-05 este comentario decía que "sigue publicando el global", que era falso: la
// 8a lo sacó y el texto quedó.)
export default FilterFeature;
