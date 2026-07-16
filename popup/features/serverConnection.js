/**
 * CLON DOWNLOADHELPER - FEATURE: CONEXIÓN AL SERVIDOR BUN (V1.0.0)
 * ==========================================================================
 * Módulo 2/4 de la reorganización feature-driven de popup.js
 * (ver docs/adr/0005-feature-driven-popup-split.md, docs/ROADMAP.md Fase 2).
 *
 * Encapsula la detección de estado del servidor Bun y el auto-healing:
 * el polling de reconexión (internet + servidor) y la UI de "offline".
 * Es dueño de su propio estado de monitoreo (intervalReconexion,
 * comprobacionEnProgreso) — antes eran flags sueltos en el closure de popup.js.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos                            : mapa de nodos del popup.
 *   - ctx.configurarBotonesUX(modo,txt,dis): helper de UX de popup.js.
 *   - ctx.actualizarEstadoServidorOnboarding(online): de la feature onboarding.
 *   - ctx.onReintentarCola()               : reanuda la cola (queue de popup.js).
 *   - ctx.onReescanearAula()               : dispara el re-escaneo del aula (popup.js).
 *
 * Expone: cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarMonitoreoServidor.
 * ==========================================================================
 */

const ServerConnectionFeature = {
  crear(ctx) {
    const {
      nodos,
      configurarBotonesUX,
      actualizarEstadoServidorOnboarding,
      onReintentarCola,
      onReescanearAula
    } = ctx;

    // Estado interno de monitoreo (antes: closure flags de popup.js).
    let intervalReconexion = null;
    let comprobacionEnProgreso = false;

    async function cargarRutaServidorSilencioso() {
      if (!nodos.btnExplore) return;
      try {
        const ruta = await BunClient.obtenerRutaServidor();
        if (ruta) {
          nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;
          nodos.pcPath.textContent = ruta;
          nodos.pcPath.title = ruta;
          if (nodos.statusDot) {
            nodos.statusDot.className = "status-dot online";
            nodos.statusDot.title = "Servidor conectado";
          }
        }
      } catch (err) {
        console.warn("⚠️ No se pudo conectar al servidor Bun para obtener la ruta raíz:", err);
        nodos.pcPath.textContent = "Desconectado";
        nodos.pcPath.title = "Servidor desconectado";
        nodos.txtEstado.textContent = "❌ Servidor Bun apagado. Enciéndalo en consola para operar.";
        if (nodos.statusDot) {
          nodos.statusDot.className = "status-dot offline";
          nodos.statusDot.title = "Servidor desconectado";
        }
      }
    }

    function activarEstadoOfflineUI() {
      if (nodos.statusDot) {
        nodos.statusDot.className = "status-dot offline";
        nodos.statusDot.title = "Servidor desconectado";
      }

      nodos.folder.disabled = true;
      nodos.btnExplore.disabled = true;
      document.querySelector('.path-bar')?.classList.add('offline');

      nodos.search.disabled = true;
      nodos.btnFilterPills.disabled = true;
      nodos.masterCheck.disabled = true;
      nodos.masterCheck.checked = false;
      if (nodos.btnSort) nodos.btnSort.disabled = true;

      const tieneErrorCard = nodos.lista.querySelector(".server-error-card");
      if (!tieneErrorCard) {
        nodos.lista.innerHTML = "";
        const card = document.createElement("div");
        card.className = "server-error-card";
        card.innerHTML = `
          <div class="server-error-icon">🔌</div>
          <h5>Servidor Desconectado</h5>
          <p>Por favor, iniciá el servidor ejecutando <strong>iniciar.bat</strong> en tu PC.<br>La extensión se sincronizará sola apenas esté encendido.</p>
          <div class="server-error-pulse">
            <span class="pulse-dot"></span>
            <span>Esperando conexión en puerto 3001...</span>
          </div>
        `;
        nodos.lista.appendChild(card);
      }
      nodos.lista.style.opacity = "1";
      nodos.loader.style.display = 'none';

      nodos.pcPath.textContent = "Desconectado";
      nodos.pcPath.title = "Servidor desconectado";
      nodos.txtEstado.innerHTML = '⚠️ <span style="color:var(--accent-error-visible)">Servidor Bun desconectado.</span>';
      configurarBotonesUX("sincronizar-disco", "Buscando servidor... ⏳", true);

      const tabsBar = document.querySelector(".tabs-bar");
      if (tabsBar) tabsBar.style.display = "none";
      nodos.filtersBar.style.display = "none";

      actualizarEstadoServidorOnboarding(false);

      iniciarMonitoreoServidor();
    }

    function iniciarMonitoreoServidor() {
      if (intervalReconexion) return;

      intervalReconexion = setInterval(async () => {
        if (AppState.ráfagaEnCurso && !AppState.fallaConexionActiva) return;


        // Auto-reintento si cayó el internet
        if (AppState.fallaConexionActiva === "internet") {
          if (navigator.onLine) {
            if (comprobacionEnProgreso) return;
            comprobacionEnProgreso = true;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            try {
              await fetch("https://plataforma.ramonnet.com.ar", {
                method: "HEAD",
                mode: "no-cors",
                cache: "no-store",
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              comprobacionEnProgreso = false;

              // ⚡ AUTOLIMPIEZA: Apagar el monitoreo ya que recuperamos internet
              clearInterval(intervalReconexion);
              intervalReconexion = null;

              onReintentarCola();
              return;
            } catch (e) {
              clearTimeout(timeoutId);
              comprobacionEnProgreso = false;
              // Sigue sin internet
            }
          }
        }

        try {
          const ruta = await BunClient.obtenerRutaServidor();
          if (ruta) {
            // ⚡ AUTOLIMPIEZA: Apagar el monitoreo ya que estamos conectados y sanos
            clearInterval(intervalReconexion);
            intervalReconexion = null;

            actualizarEstadoServidorOnboarding(true);

            if (AppState.fallaConexionActiva === "servidor") {
              console.log("🔌 [UI-AUTOHEAL] Servidor Bun recuperado. Reanudando descarga masiva...");
              onReintentarCola();
              return;
            }

            const tieneErrorCard = nodos.lista.querySelector(".server-error-card");
            if (tieneErrorCard) {
              nodos.folder.disabled = false;
              nodos.btnExplore.disabled = false;
              document.querySelector('.path-bar')?.classList.remove('offline');

              nodos.pcPath.textContent = ruta;
              nodos.pcPath.title = ruta;
              nodos.txtEstado.textContent = "Analizando aula virtual...";
              nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;

              if (nodos.statusDot) {
                nodos.statusDot.className = "status-dot online";
                nodos.statusDot.title = "Servidor conectado";
              }

              const tabsBar = document.querySelector(".tabs-bar");
              if (tabsBar) tabsBar.style.display = "flex";
              nodos.filtersBar.style.display = AppState.pestañaActiva === "disponibles" ? "flex" : "none";

              onReescanearAula();
            } else {
              if (nodos.statusDot) {
                nodos.statusDot.className = "status-dot online";
                nodos.statusDot.title = "Servidor conectado";
              }
            }
          }
        } catch (err) {
          const tieneErrorCard = nodos.lista.querySelector(".server-error-card");
          if (!tieneErrorCard && !AppState.ráfagaEnCurso && !AppState.fallaConexionActiva) {
            activarEstadoOfflineUI();
          }
        }
      }, 1500);
    }

    return { cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarMonitoreoServidor };
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = ServerConnectionFeature;
} else if (typeof window !== "undefined") {
  window.ServerConnectionFeature = ServerConnectionFeature;
} else if (typeof self !== "undefined") {
  self.ServerConnectionFeature = ServerConnectionFeature;
}
