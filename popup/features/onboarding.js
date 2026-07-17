/**
 * CLON DOWNLOADHELPER - FEATURE: ONBOARDING (WELCOME TOUR) (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [FIX] onComplete: callback que se dispara al cerrar el tour de la PRIMERA vez
 *   (no el reabierto por el botón de ayuda, forzado=true). popup.js lo usa para
 *   diferir la conexión al servidor + escaneo del aula hasta después del tour, así
 *   el loader "Escaneando..." ya no aparece detrás/antes del tutorial.
 * ==========================================================================
 * Primer módulo extraído de popup.js en la reorganización feature-driven
 * (ver docs/adr/0005-feature-driven-popup-split.md, docs/ROADMAP.md Fase 2).
 *
 * Patrón (sin bundler): se carga como <script> antes de popup.js y expone el
 * objeto global `OnboardingFeature`. `crear(ctx)` recibe las dependencias
 * cruzadas (nodos del popup + callback onExplore) y devuelve las funciones que
 * el orquestador y el módulo de conexión al servidor necesitan invocar.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos     : mapa de nodos del popup (usa onboarding*, btnHelp).
 *   - ctx.onExplore : callback a ejecutar cuando se toca "Seleccionar Carpeta"
 *                     dentro del slide de onboarding (= lanzarSeleccionCarpetaFisica).
 *   - ctx.onComplete: (opcional) callback al terminar el tour de la primera vez.
 * ==========================================================================
 */

const OnboardingFeature = {
  crear(ctx) {
    const { nodos, onExplore, onComplete } = ctx;

    // --- MÁQUINA DE ESTADO DE ONBOARDING (WELCOME TOUR) ---
    function mostrarOnboarding(forzado = false) {
      if (!nodos.onboarding || !nodos.onboardingSlides || !nodos.onboardingPrev || !nodos.onboardingNext || !nodos.onboardingSkip || !nodos.onboardingDots) {
        console.warn("⚠️ Nodos de onboarding no encontrados en el DOM.");
        return;
      }

      let slideActual = 0;
      const totalSlides = 6;

      nodos.onboarding.style.display = 'flex';
      actualizarSlides();

      function actualizarSlides() {
        nodos.onboardingSlides.style.transform = `translateX(-${slideActual * 100}%)`;

        const dots = nodos.onboardingDots.querySelectorAll('.onboarding-dot');
        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === slideActual);
        });

        nodos.onboardingPrev.disabled = (slideActual === 0);

        if (slideActual === totalSlides - 1) {
          nodos.onboardingNext.textContent = "Comenzar";
        } else {
          nodos.onboardingNext.textContent = "Siguiente";
        }
      }

      function irAtras() {
        if (slideActual > 0) {
          slideActual--;
          actualizarSlides();
        }
      }

      function irSiguiente() {
        if (slideActual < totalSlides - 1) {
          slideActual++;
          actualizarSlides();
        } else {
          cerrarTutorial();
        }
      }

      function cerrarTutorial() {
        AppState.tutorialCompletado = true;
        AppState.respaldar();
        nodos.onboarding.style.display = 'none';

        // Limpiar listeners asignados para esta sesión de tutorial
        nodos.onboardingPrev.removeEventListener('click', irAtras);
        nodos.onboardingNext.removeEventListener('click', irSiguiente);
        nodos.onboardingSkip.removeEventListener('click', cerrarTutorial);

        // Solo tras el tour de la primera vez (no el reabierto por el botón de ayuda)
        // avisamos al orquestador para que conecte y arranque el escaneo del aula.
        if (!forzado && typeof onComplete === 'function') onComplete();
      }

      nodos.onboardingPrev.addEventListener('click', irAtras);
      nodos.onboardingNext.addEventListener('click', irSiguiente);
      nodos.onboardingSkip.addEventListener('click', cerrarTutorial);
    }

    function actualizarEstadoServidorOnboarding(online) {
      const statusMsg = document.getElementById('ui-onboarding-server-status');
      const exploreBtn = document.getElementById('ui-onboarding-explore');
      if (!statusMsg || !exploreBtn) return;

      if (online) {
        statusMsg.className = "onboarding-server-msg success";
        statusMsg.textContent = "🔌 Servidor conectado. ¡Ya podés elegir carpeta!";
        exploreBtn.disabled = false;
        exploreBtn.title = "Seleccionar carpeta principal de descargas";
      } else {
        statusMsg.className = "onboarding-server-msg error";
        statusMsg.textContent = "⚠️ Primero tenés que levantar el servidor";
        exploreBtn.disabled = true;
        exploreBtn.title = "Servidor desconectado. Ejecutá iniciar.bat primero.";
      }
    }

    // --- Wiring de listeners propios de esta feature ---
    if (nodos.btnHelp) {
      nodos.btnHelp.addEventListener("click", () => {
        mostrarOnboarding(true);
      });
    }

    const onboardingExplore = document.getElementById('ui-onboarding-explore');
    if (onboardingExplore) {
      onboardingExplore.addEventListener("click", () => {
        if (typeof onExplore === 'function') onExplore();
      });
    }

    return { mostrarOnboarding, actualizarEstadoServidorOnboarding };
  }
};

// Exportación dual (ver docs/coding-standards.md). En Node/tests se expone por
// module.exports para poder cargar el módulo en el smoke test de jsdom.
if (typeof module !== "undefined" && module.exports) {
  module.exports = OnboardingFeature;
} else if (typeof window !== "undefined") {
  window.OnboardingFeature = OnboardingFeature;
} else if (typeof self !== "undefined") {
  self.OnboardingFeature = OnboardingFeature;
}
