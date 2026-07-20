/**
 * CLON DOWNLOADHELPER - FEATURE: CÁTEDRA / MULTICÁTEDRA (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [SPLIT] Extraída de popup.js toda la lógica de cátedra: el badge de cátedra
 *   seleccionada (actualizarBadgeCatedra), la autoselección silenciosa de los
 *   videos de una cátedra (aplicarSeleccionCatedraSilencioso), el asistente que
 *   detecta un aula multicátedra al escanear (verificarYMostrarAsistenteMulticatedra)
 *   y su modal (mostrarModalMulticatedra + aplicarSeleccionCatedra). El listener del
 *   click en el badge se cablea acá adentro. Además se unificó el cálculo de las
 *   cátedras presentes —antes triplicado (badge listener, actualizarBadgeCatedra,
 *   verificarYMostrarAsistenteMulticatedra)— en detectarCatedras(). Sin cambio de
 *   comportamiento respecto a popup.js v5.13.0. Cierra la Fase 2 del split
 *   feature-driven (ver ADR-0005, docs/ROADMAP.md). Es el último cluster de bajo
 *   acoplamiento extraíble; el resto de popup.js es orquestación (render/scraping/IPC).
 * ==========================================================================
 * Dependencias que recibe por ctx:
 *   - ctx.nodos            : mapa de nodos (usa catedraBadge).
 *   - ctx.aplicarFiltros() : re-aplica el filtrado cruzado del listado
 *                            (aplicarFiltrosCruzados, popup.js).
 *
 * Expone: actualizarBadgeCatedra, aplicarSeleccionCatedraSilencioso,
 *         verificarYMostrarAsistenteMulticatedra.
 */
const CatedraFeature = {
  crear(ctx) {
    const { nodos, aplicarFiltros } = ctx;

    // Cátedras específicas presentes en el listado (excluye "COMUN"). Unifica las 3
    // copias del mismo Array.from(new Set(...)) que vivían en popup.js.
    function detectarCatedras() {
      return Array.from(new Set(
        AppState.listadoClasesGlobal
          .map(c => c.catedra)
          .filter(cat => cat !== "COMUN")
      ));
    }

    function actualizarBadgeCatedra() {
      const tieneMultiCatedras = detectarCatedras().length > 1;

      if (tieneMultiCatedras && AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS") {
        nodos.catedraBadge.textContent = `Cátedra ${AppState.catedraSeleccionada}`;
        nodos.catedraBadge.style.display = "inline-flex";
      } else {
        nodos.catedraBadge.style.display = "none";
        // Si la materia no es multicátedra, forzar limpieza del estado para evitar deselecciones silenciosas
        if (!tieneMultiCatedras && AppState.catedraSeleccionada !== null) {
          AppState.catedraSeleccionada = null;
          AppState.respaldar();
        }
      }
    }

    function aplicarSeleccionCatedraSilencioso(catedraElegida) {
      AppState.catedraSeleccionada = catedraElegida;

      AppState.listadoClasesGlobal.forEach(clase => {
        if (clase.estado === 'pending') {
          clase.seleccionado = (clase.catedra === catedraElegida || clase.catedra === "COMUN");
        }
      });

      AppState.respaldar();
      actualizarBadgeCatedra();
      aplicarFiltros();
    }

    function verificarYMostrarAsistenteMulticatedra() {
      const catedrasDetectadas = detectarCatedras();

      console.log("[CATEDRA-DEBUG] Cátedras detectadas en total para el aula virtual:", catedrasDetectadas);

      if (catedrasDetectadas.length > 1) {
        if (AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS" && catedrasDetectadas.includes(AppState.catedraSeleccionada)) {
          console.log("[CATEDRA-DEBUG] -> Aplicando selección persistida:", AppState.catedraSeleccionada);
          aplicarSeleccionCatedraSilencioso(AppState.catedraSeleccionada);
          return;
        }
        console.log("[CATEDRA-DEBUG] -> Múltiples cátedras encontradas. Mostrando modal.");
        mostrarModalMulticatedra(catedrasDetectadas);
      } else {
        console.log("[CATEDRA-DEBUG] -> Una o ninguna cátedra específica. Reseteando selección.");
        AppState.catedraSeleccionada = null;
        AppState.respaldar();
        actualizarBadgeCatedra();
      }
    }

    function mostrarModalMulticatedra(catedras) {
      document.querySelector(".multicatedra-overlay")?.remove();

      const overlay = document.createElement("div");
      overlay.className = "multicatedra-overlay";

      const card = document.createElement("div");
      card.className = "multicatedra-card";

      // innerHTML estático (sin contenido scrapeado): copy fijo, no interpola títulos.
      card.innerHTML = `
        <h4>Multicátedra Detectada 🎓</h4>
        <p>Esta aula virtual tiene videos de varias cátedras. ¿Cuál de ellas estás cursando para autoseleccionar tus videos?</p>
      `;

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "multicatedra-options";

      // Ordenar alfabéticamente
      const sortedCatedras = [...catedras].sort((a, b) => a.localeCompare(b));

      sortedCatedras.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = "btn-catedra-opt";
        btn.textContent = `Cátedra ${cat}`;
        btn.addEventListener("click", () => aplicarSeleccionCatedra(cat, overlay));
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    function aplicarSeleccionCatedra(catedraElegida, overlay) {
      aplicarSeleccionCatedraSilencioso(catedraElegida);
      overlay.remove();
    }

    // Click en el badge: si el aula es multicátedra, reabre el modal de selección.
    nodos.catedraBadge.addEventListener("click", () => {
      const catedrasDetectadas = detectarCatedras();
      if (catedrasDetectadas.length > 1) {
        mostrarModalMulticatedra(catedrasDetectadas);
      }
    });

    return {
      actualizarBadgeCatedra,
      aplicarSeleccionCatedraSilencioso,
      verificarYMostrarAsistenteMulticatedra,
    };
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = CatedraFeature;
} else if (typeof window !== "undefined") {
  window.CatedraFeature = CatedraFeature;
} else if (typeof self !== "undefined") {
  self.CatedraFeature = CatedraFeature;
}
