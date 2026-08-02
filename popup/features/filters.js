/**
 * CLON DOWNLOADHELPER - FEATURE: FILTROS Y BÚSQUEDA (V2.0.0)
 * ==========================================================================
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
 * Dependencias que recibe por ctx:
 *   - ctx.nodos               : mapa de nodos (usa search, folder, filterMenu,
 *                               btnFilterPills, masterCheck, btnSort).
 *   - ctx.filtrosActivos      : { estados:Set, materias:Set, valoresFaceta:Set } por referencia.
 *   - ctx.sitio               : adaptador de sitio activo; usa `sitio.faceta`.
 *   - ctx.renderizar()        : re-render del listado (renderizarListadoInterfaz, popup.js).
 *   - ctx.actualizarContadores(): refresco de contadores del botón de acción (popup.js).
 *
 * Expone: coincideConFiltrosCola, aplicarFiltrosCruzados, desbanearFiltros,
 *         actualizarPillsUIState, renderizarFiltrosMenuPopover.
 */
const FilterFeature = {
  crear(ctx) {
    const { nodos, filtrosActivos, renderizar, actualizarContadores, sitio } = ctx;
    // Eje de clasificación propio del sitio (en Ramón Net: la cátedra). Esta feature
    // filtra POR la faceta sin saber qué representa — ver sitio/ramonnet/config.js.
    const faceta = sitio.faceta;

    // Predicado compartido del filtrado de la pestaña Cola. Unifica las 3 copias
    // que vivían duplicadas en popup.js (masterCheck, renderizarListadoInterfaz,
    // actualizarMasterCheckState). NO incluye el descarte del video activo (!esActivo):
    // eso es específico de la selección maestra, el caller lo agrega aparte.
    function coincideConFiltrosCola(clase, busqueda) {
      const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
      const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
      const coincideFaceta = filtrosActivos.valoresFaceta.size === 0
        || filtrosActivos.valoresFaceta.has(faceta.leerDeCola(clase));
      return coincideTexto && coincideMateria && coincideFaceta;
    }

    // Recalcula la visibilidad del listado global de disponibles cruzando materia +
    // texto + estado + cátedra, y re-renderiza. La pestaña Cola filtra aparte, en el
    // render (con coincideConFiltrosCola).
    function aplicarFiltrosCruzados() {
      const busqueda = nodos.search.value.toLowerCase().trim();
      const materiaActiva = nodos.folder.value.trim().toLowerCase();

      AppState.listadoClasesGlobal.forEach(clase => {
        const coincideMateria = !clase.carpeta || (clase.carpeta.toLowerCase() === materiaActiva);
        const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
        const coincideEstado = filtrosActivos.estados.size === 0 || filtrosActivos.estados.has(clase.estado);

        const valor = faceta.leer(clase);
        const elegido = AppState[faceta.claveEstado];
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
      nodos.masterCheck.disabled = !AppState.sincronizacionDiscoCompletada;
      if (nodos.btnSort) nodos.btnSort.disabled = false;
    }

    // Actualiza el badge del botón "Filtros (N)" según cuántos filtros haya activos.
    function actualizarPillsUIState() {
      if (!nodos.btnFilterPills) return;
      const total = filtrosActivos.estados.size + filtrosActivos.materias.size + filtrosActivos.valoresFaceta.size;
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

      if (AppState.pestañaActiva === "disponibles") {
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
          AppState.listadoClasesGlobal.map(c => faceta.leer(c)).filter(v => v !== faceta.valorComun)
        )).sort(faceta.ordenar);

        const elegido = AppState[faceta.claveEstado];
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
        const valoresUnicos = new Set();

        AppState.colaDescargas.forEach(c => {
          materiasUnicas.add(c.carpeta.toUpperCase());
          valoresUnicos.add(faceta.leerDeCola(c));
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

        // --- Sección de la faceta del sitio, derivada de la cola ---
        if (valoresUnicos.size > 0) {
          const secFaceta = document.createElement("div");
          secFaceta.className = "popover-section";

          const titFaceta = document.createElement("div");
          titFaceta.className = "popover-section-title";
          titFaceta.textContent = faceta.etiqueta;
          secFaceta.appendChild(titFaceta);

          Array.from(valoresUnicos).sort(faceta.ordenar).forEach(valor => {
            const etiqueta = `${faceta.icono} ${faceta.etiquetarCorto(valor)}`;
            const opt = crearPopoverOptionDOM(etiqueta, filtrosActivos.valoresFaceta.has(valor), (checked) => {
              if (checked) filtrosActivos.valoresFaceta.add(valor);
              else filtrosActivos.valoresFaceta.delete(valor);
              actualizarPillsUIState();
              aplicarFiltrosCruzados();
            });
            secFaceta.appendChild(opt);
          });
          nodos.filterMenu.appendChild(secFaceta);
        }
      }
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

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.FilterFeature = FilterFeature;
export default FilterFeature;
