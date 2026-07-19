/**
 * CLON DOWNLOADHELPER - FEATURE: FILTROS Y BÚSQUEDA (V1.0.0)
 * ==========================================================================
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
 * El objeto de estado `filtrosActivos` (Sets estados/materias/catedras) sigue viviendo
 * en popup.js y se pasa POR REFERENCIA en ctx (objeto compartido, igual que queue.js
 * recibe `nodos`): así los pocos call-sites externos que lo mutan/leen directo
 * (conmutarPestañaA lo limpia) no se rompen. Esta feature muta ESE mismo objeto.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos               : mapa de nodos (usa search, folder, filterMenu,
 *                               btnFilterPills, masterCheck, btnSort).
 *   - ctx.filtrosActivos      : { estados:Set, materias:Set, catedras:Set } por referencia.
 *   - ctx.renderizar()        : re-render del listado (renderizarListadoInterfaz, popup.js).
 *   - ctx.actualizarContadores(): refresco de contadores del botón de acción (popup.js).
 *
 * Expone: coincideConFiltrosCola, aplicarFiltrosCruzados, desbanearFiltros,
 *         actualizarPillsUIState, renderizarFiltrosMenuPopover.
 */
const FilterFeature = {
  crear(ctx) {
    const { nodos, filtrosActivos, renderizar, actualizarContadores } = ctx;

    // Predicado compartido del filtrado de la pestaña Cola. Unifica las 3 copias
    // que vivían duplicadas en popup.js (masterCheck, renderizarListadoInterfaz,
    // actualizarMasterCheckState). NO incluye el descarte del video activo (!esActivo):
    // eso es específico de la selección maestra, el caller lo agrega aparte.
    function coincideConFiltrosCola(clase, busqueda) {
      const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
      const clasif = Utils.clasificarCatedraYCarpeta(clase.titulo, clase.carpeta);
      const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
      const coincideCatedra = filtrosActivos.catedras.size === 0 || filtrosActivos.catedras.has(clasif.catedra);
      return coincideTexto && coincideMateria && coincideCatedra;
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

        let coincideCatedra = true;
        if (filtrosActivos.catedras.size > 0) {
          coincideCatedra = filtrosActivos.catedras.has(clase.catedra);
        } else if (AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS") {
          coincideCatedra = (clase.catedra === AppState.catedraSeleccionada || clase.catedra === "COMUN");
        }

        clase.visible = coincideMateria && coincideTexto && coincideEstado && coincideCatedra;
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
      const total = filtrosActivos.estados.size + filtrosActivos.materias.size + filtrosActivos.catedras.size;
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

        // --- Sección Cátedra ---
        let catedrasDetectadas = Array.from(new Set(
          AppState.listadoClasesGlobal.map(c => c.catedra).filter(cat => cat !== "COMUN")
        )).sort();

        if (AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS") {
          catedrasDetectadas = catedrasDetectadas.filter(cat => cat === AppState.catedraSeleccionada);
        }

        if (catedrasDetectadas.length > 0) {
          const secCatedra = document.createElement("div");
          secCatedra.className = "popover-section";

          const titCatedra = document.createElement("div");
          titCatedra.className = "popover-section-title";
          titCatedra.textContent = "Cátedra";
          secCatedra.appendChild(titCatedra);

          // Opción COMUN
          const optComun = crearPopoverOptionDOM("Común", filtrosActivos.catedras.has("COMUN"), (checked) => {
            if (checked) filtrosActivos.catedras.add("COMUN");
            else filtrosActivos.catedras.delete("COMUN");
            actualizarPillsUIState();
            aplicarFiltrosCruzados();
          });
          secCatedra.appendChild(optComun);

          catedrasDetectadas.forEach(cat => {
            const opt = crearPopoverOptionDOM(`Cat ${cat}`, filtrosActivos.catedras.has(cat), (checked) => {
              if (checked) filtrosActivos.catedras.add(cat);
              else filtrosActivos.catedras.delete(cat);
              actualizarPillsUIState();
              aplicarFiltrosCruzados();
            });
            secCatedra.appendChild(opt);
          });
          nodos.filterMenu.appendChild(secCatedra);
        }
      } else {
        // --- Vista Pestaña Cola ---
        const materiasUnicas = new Set();
        const catedrasUnicas = new Set();

        AppState.colaDescargas.forEach(c => {
          const clasif = Utils.clasificarCatedraYCarpeta(c.titulo, c.carpeta);
          materiasUnicas.add(c.carpeta.toUpperCase());
          catedrasUnicas.add(clasif.catedra);
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

        // --- Sección Cátedras ---
        if (catedrasUnicas.size > 0) {
          const secCatedra = document.createElement("div");
          secCatedra.className = "popover-section";

          const titCatedra = document.createElement("div");
          titCatedra.className = "popover-section-title";
          titCatedra.textContent = "Cátedra";
          secCatedra.appendChild(titCatedra);

          Array.from(catedrasUnicas).sort().forEach(cat => {
            const label = cat === "COMUN" ? "Común" : `Cat ${cat}`;
            const opt = crearPopoverOptionDOM(`🎓 ${label}`, filtrosActivos.catedras.has(cat), (checked) => {
              if (checked) filtrosActivos.catedras.add(cat);
              else filtrosActivos.catedras.delete(cat);
              actualizarPillsUIState();
              aplicarFiltrosCruzados();
            });
            secCatedra.appendChild(opt);
          });
          nodos.filterMenu.appendChild(secCatedra);
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

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = FilterFeature;
} else if (typeof window !== "undefined") {
  window.FilterFeature = FilterFeature;
} else if (typeof self !== "undefined") {
  self.FilterFeature = FilterFeature;
}
