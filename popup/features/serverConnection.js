/**
 * CLON DOWNLOADHELPER - FEATURE: CONEXIÓN AL SERVIDOR BUN (V1.3.1)
 * ==========================================================================
 * CHANGELOG v1.3.1:
 * - [FIX] La caída pasiva del servidor (detectada por el daemon, sin acción del
 *   usuario) ahora dispara el banner "Servidor Desconectado" (activarEstadoOfflineUI),
 *   no sólo el indicador. Se omite si hay una cola pausada (esa UI ya se encarga).
 * CHANGELOG v1.3.0:
 * - [REFACTOR] La feature deja de sondear: el estado de conexión ahora lo posee
 *   el daemon Conexion (shared/conexion.js), fuente única de verdad. iniciarDetectorEstado
 *   se suscribe a Conexion y reacciona (reaccionarAConexion): indicador + recuperación
 *   de cola/aula. Se eliminan de acá el setInterval, el HEAD de internet duplicado y
 *   navigator.onLine (todo eso vive ahora en el daemon).
 * CHANGELOG v1.2.0:
 * - [REFACTOR] Un ÚNICO detector de estado (iniciarDetectorEstado) reemplaza a
 *   los dos loops que se solapaban (el monitor reactivo de recuperación + el
 *   latido de indicador de v1.1.0). Es la fuente única de verdad de la conexión:
 *   siempre activo mientras el popup está abierto, mantiene el indicador al día
 *   en ambos sentidos y ejecuta la recuperación (reanudar cola / re-escanear)
 *   sólo en la transición offline->online (edge-triggered).
 * - v1.1.0: latido de salud (iniciarLatidoSalud) para detectar la desconexión
 *   pasiva del servidor. Absorbido por el detector unificado de v1.2.0.
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
 * Expone: cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarDetectorEstado.
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

    // El estado de conexión NO vive acá: lo posee el daemon Conexion (shared/conexion.js).
    // Esta feature sólo se SUSCRIBE a sus cambios y reacciona (UI + recuperación de cola).
    let suscrito = false;
    let previoServidor = null; // para detectar la transición offline->online del servidor.

    // Refleja el estado del servidor en los indicadores visuales (puntito de estado
    // + indicador del onboarding) sin tocar el resto de la UI.
    function pintarIndicadorConexion(online) {
      actualizarEstadoServidorOnboarding(online);
      if (nodos.statusDot) {
        nodos.statusDot.className = online ? "status-dot online" : "status-dot offline";
        nodos.statusDot.title = online ? "Servidor conectado" : "Servidor desconectado";
      }
    }

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

      // Asegura que el detector esté corriendo (idempotente; normalmente ya arrancó en el init).
      iniciarDetectorEstado();
    }

    // Reacción a los cambios del daemon Conexion (shared/conexion.js), la fuente única
    // de verdad. Esta feature NO sondea: sólo consume el estado que le llega por push.
    //   1. Mantiene el indicador (puntito + onboarding) al día según el estado del server.
    //   2. En la transición del servidor offline->online (o de internet, según el tipo de
    //      falla), ejecuta la recuperación: reanudar la cola y/o sacar la tarjeta de error
    //      + re-escanear el aula.
    // No dispara el modo offline completo ante una caída pasiva: eso lo siguen gatillando
    // las acciones del usuario que fallan (activarEstadoOfflineUI).
    function reaccionarAConexion(estado) {
      // Durante una descarga activa sin fallo, el estado lo maneja el SW; no interferir
      // (ni siquiera el indicador: la UI de telemetría es la que manda ahí).
      if (AppState.ráfagaEnCurso && !AppState.fallaConexionActiva) return;

      // El indicador refleja el estado del servidor Bun (es lo que habilita elegir carpeta).
      if (estado.servidor !== previoServidor) {
        pintarIndicadorConexion(estado.servidor);
      }

      // Recuperación de una cola pausada por error: reanudar apenas vuelve la conexión que
      // faltaba. Conexion notifica sólo en transición, así que esto es edge-triggered.
      if (AppState.fallaConexionActiva === "internet" && estado.internet) {
        previoServidor = estado.servidor;
        onReintentarCola();
        return;
      }
      if (AppState.fallaConexionActiva === "servidor" && estado.servidor) {
        console.log("🔌 [UI-AUTOHEAL] Servidor Bun recuperado. Reanudando descarga masiva...");
        previoServidor = estado.servidor;
        onReintentarCola();
        return;
      }

      // Servidor caído sin descarga pausada (detección pasiva): mostrar el banner
      // "Servidor Desconectado". El daemon notifica sólo en transición, así que esto
      // dispara activarEstadoOfflineUI una única vez al perder el servidor. Si hay una
      // cola pausada (fallaConexionActiva), la UI de descarga interrumpida ya se encarga.
      if (!estado.servidor && !AppState.fallaConexionActiva) {
        if (!nodos.lista.querySelector(".server-error-card")) {
          activarEstadoOfflineUI();
        }
        previoServidor = estado.servidor;
        return;
      }

      // El servidor (re)conectó y estábamos mostrando la tarjeta de error offline (sin
      // descarga pausada): re-habilitar controles, restaurar la ruta y re-escanear el aula.
      if (previoServidor !== true && estado.servidor) {
        const tieneErrorCard = nodos.lista.querySelector(".server-error-card");
        if (tieneErrorCard) {
          nodos.folder.disabled = false;
          nodos.btnExplore.disabled = false;
          document.querySelector('.path-bar')?.classList.remove('offline');

          nodos.txtEstado.textContent = "Analizando aula virtual...";

          const tabsBar = document.querySelector(".tabs-bar");
          if (tabsBar) tabsBar.style.display = "flex";
          nodos.filtersBar.style.display = AppState.pestañaActiva === "disponibles" ? "flex" : "none";

          cargarRutaServidorSilencioso(); // restaura el path mostrado (PC: ...)
          onReescanearAula();
        }
      }

      previoServidor = estado.servidor;
    }

    // Arranca el daemon de conexión y se suscribe a sus cambios. Idempotente.
    function iniciarDetectorEstado() {
      if (suscrito) return;
      suscrito = true;
      Conexion.suscribir(reaccionarAConexion);
      Conexion.iniciar();
    }

    return { cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarDetectorEstado, reaccionarAConexion };
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
