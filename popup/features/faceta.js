/**
 * CLON DOWNLOADHELPER - FEATURE: FACETA DEL LISTADO (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [CAPA 2] Generalizada: era `catedra.js` / `CatedraFeature`, con "Cátedra",
 *   "COMUN" y el copy del modal hardcodeados. Ahora el mecanismo es agnóstico del
 *   sitio y recibe el descriptor por `ctx.sitio` (ver sitio/ramonnet/config.js).
 *   Mismo comportamiento: los strings que produce salen del descriptor y son los
 *   de antes. Renombres: actualizarBadgeCatedra → actualizarBadge,
 *   aplicarSeleccionCatedraSilencioso → aplicarSeleccionSilenciosa,
 *   verificarYMostrarAsistenteMulticatedra → verificarYMostrarAsistente.
 * CHANGELOG v1.0.0:
 * - [SPLIT] Extraída de popup.js toda la lógica de cátedra (badge, autoselección,
 *   asistente multicátedra y su modal). Cerró la Fase 2 del split feature-driven
 *   (ver ADR-0005, docs/ROADMAP.md).
 * ==========================================================================
 * QUÉ HACE
 * --------
 * Implementa el mecanismo genérico de "faceta": si el listado scrapeado trae más de
 * un valor en el eje de clasificación del sitio, le pregunta UNA vez al usuario cuál
 * le corresponde (modal), autoselecciona los items de ese valor + los comunes, y deja
 * un badge en la cabecera para volver a abrir la elección. Nada acá sabe qué es una
 * "cátedra": eso lo aporta `ctx.sitio.faceta`.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.sitio            : adaptador de sitio activo; usa `sitio.faceta`.
 *   - ctx.badge            : nodo del badge de la cabecera (no el mapa `nodos`, para
 *                            que la feature no dependa del nombre de la clave).
 *   - ctx.aplicarFiltros() : re-aplica el filtrado cruzado del listado
 *                            (aplicarFiltrosCruzados, popup.js).
 *
 * Expone: actualizarBadge, aplicarSeleccionSilenciosa, verificarYMostrarAsistente,
 *         perteneceASeleccion.
 */
const FacetaFeature = {
  crear(ctx) {
    const { badge, aplicarFiltros, sitio } = ctx;
    const faceta = sitio.faceta;

    // Lee/escribe la elección del usuario en AppState sin nombrar el concepto del
    // sitio (la clave la declara el descriptor).
    const leerSeleccion = () => AppState[faceta.claveEstado];
    const fijarSeleccion = (valor) => { AppState[faceta.claveEstado] = valor; };

    // Valores específicos presentes en el listado (excluye el valor común, que no es
    // una opción elegible). Unifica las 3 copias del mismo Array.from(new Set(...))
    // que vivían en popup.js.
    function valoresPresentes() {
      return Array.from(new Set(
        AppState.listadoClasesGlobal
          .map(c => faceta.leer(c))
          .filter(valor => valor !== faceta.valorComun)
      ));
    }

    // ¿Este item entra en la elección actual? True si no hay elección (no filtra).
    // Vive acá para que popup.js no repita el "valor === elegido || valor === común",
    // que era su último resto de vocabulario del sitio.
    function perteneceASeleccion(clase) {
      const elegido = leerSeleccion();
      if (!elegido || elegido === faceta.valorTodas) return true;
      const valor = faceta.leer(clase);
      return valor === elegido || valor === faceta.valorComun;
    }

    function actualizarBadge() {
      const tieneVarios = valoresPresentes().length > 1;
      const elegido = leerSeleccion();

      if (tieneVarios && elegido && elegido !== faceta.valorTodas) {
        badge.textContent = faceta.etiquetar(elegido);
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
        // Si el listado dejó de tener varios valores, limpiar el estado para evitar
        // deselecciones silenciosas por una elección que ya no aplica.
        if (!tieneVarios && elegido !== null) {
          fijarSeleccion(null);
          AppState.respaldar();
        }
      }
    }

    function aplicarSeleccionSilenciosa(valorElegido) {
      fijarSeleccion(valorElegido);

      AppState.listadoClasesGlobal.forEach(clase => {
        if (clase.estado === 'pending') {
          const valor = faceta.leer(clase);
          clase.seleccionado = (valor === valorElegido || valor === faceta.valorComun);
        }
      });

      AppState.respaldar();
      actualizarBadge();
      aplicarFiltros();
    }

    function verificarYMostrarAsistente() {
      const detectados = valoresPresentes();

      console.log(`[FACETA:${faceta.id}] Valores detectados en el listado:`, detectados);

      if (detectados.length > 1) {
        const elegido = leerSeleccion();
        if (elegido && elegido !== faceta.valorTodas && detectados.includes(elegido)) {
          console.log(`[FACETA:${faceta.id}] -> Aplicando selección persistida:`, elegido);
          aplicarSeleccionSilenciosa(elegido);
          return;
        }
        console.log(`[FACETA:${faceta.id}] -> Varios valores presentes. Mostrando modal.`);
        mostrarModal(detectados);
      } else {
        console.log(`[FACETA:${faceta.id}] -> Uno o ningún valor específico. Reseteando selección.`);
        fijarSeleccion(null);
        AppState.respaldar();
        actualizarBadge();
      }
    }

    function mostrarModal(valores) {
      document.querySelector(".faceta-overlay")?.remove();

      const overlay = document.createElement("div");
      overlay.className = "faceta-overlay";

      const card = document.createElement("div");
      card.className = "faceta-card";

      // El copy sale del descriptor del sitio (no es contenido scrapeado), pero se
      // pinta con textContent igual: el descriptor es DATO, no markup literal de este
      // archivo, así que le aplica la regla anti-XSS (ver docs/security.md).
      const titulo = document.createElement("h4");
      titulo.textContent = faceta.modal.titulo;
      const descripcion = document.createElement("p");
      descripcion.textContent = faceta.modal.descripcion;
      card.append(titulo, descripcion);

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "faceta-options";

      [...valores].sort(faceta.ordenar).forEach(valor => {
        const btn = document.createElement("button");
        btn.className = "btn-faceta-opt";
        btn.textContent = faceta.etiquetar(valor);
        btn.addEventListener("click", () => {
          aplicarSeleccionSilenciosa(valor);
          overlay.remove();
        });
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    // El tooltip también sale del descriptor: era el último string del sitio que
    // quedaba escrito a mano en popup.html.
    badge.title = `Hacé click para cambiar de ${faceta.etiqueta}`;

    // Click en el badge: si hay varios valores presentes, reabre el modal de elección.
    badge.addEventListener("click", () => {
      const detectados = valoresPresentes();
      if (detectados.length > 1) {
        mostrarModal(detectados);
      }
    });

    return {
      actualizarBadge,
      aplicarSeleccionSilenciosa,
      verificarYMostrarAsistente,
      perteneceASeleccion,
    };
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = FacetaFeature;
} else if (typeof window !== "undefined") {
  window.FacetaFeature = FacetaFeature;
} else if (typeof self !== "undefined") {
  self.FacetaFeature = FacetaFeature;
}
