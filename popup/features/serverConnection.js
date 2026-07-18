/**
 * CLON DOWNLOADHELPER - FEATURE: CONEXIÓN AL SERVIDOR BUN (V1.10.0)
 * ==========================================================================
 * CHANGELOG v1.10.0:
 * - [ISLA #4 · Etapa 2] Dejó de tocar el DOM de #ui-list directo (innerHTML="" +
 *   style.display) para ocultar/restaurar la lista mientras el banner ocupa su lugar.
 *   Ahora empuja ListaClases.setOculta(true/false): la isla Preact #4 devuelve null y
 *   Preact quita los hijos, sin desincronizar su vdom contra un DOM borrado por fuera.
 * CHANGELOG v1.9.0:
 * - [MIGRACIÓN] El banner de conexión caída (.server-error-card) ya no se crea acá
 *   dentro de #ui-list: lo pinta la isla Preact #2 (features/bannerConexion.preact.js)
 *   en su propio root. activarEstadoOfflineUI ahora oculta/vacía #ui-list y llama
 *   BannerConexion.mostrar(tipo); reaccionarAConexion lee BannerConexion.get() como
 *   flag (antes querySelector('.server-error-card')) y al reconectar hace ocultar()
 *   + restaura la lista. TARJETAS_OFFLINE se partió: el contenido de la card se movió
 *   a la isla, acá queda ESTADO_OFFLINE (texto del footer + botón). Ver ADR-0006.
 * CHANGELOG v1.8.0:
 * - [MIGRACIÓN] El texto de la ruta del disco (📁 PC:) ya no se escribe acá vía
 *   nodos.pcPath: pasa por el store window.RutaDisco (isla Preact #1b,
 *   features/rutaDisco.preact.js). cargarRutaServidorSilencioso y activarEstadoOfflineUI
 *   llaman RutaDisco.mostrar(...). El toggle .path-bar.offline sigue vanilla acá.
 * CHANGELOG v1.7.0:
 * - [MIGRACIÓN] El estado del servidor dentro del onboarding tampoco se empuja ya
 *   desde acá: la isla Preact features/onboarding.preact.js lo deriva del daemon
 *   Conexion (igual que el puntito). Se elimina el callback ctx.actualizarEstadoServidorOnboarding
 *   y el tracking de transición `previoServidor` que existía sólo para alimentarlo.
 *   Ver docs/adr/0006-adopt-preact-islands-in-popup.md, docs/preact-migration.md.
 * CHANGELOG v1.6.0:
 * - [MIGRACIÓN] El puntito de estado (statusDot) ya NO se pinta acá: lo posee la
 *   isla Preact features/conexionHeader.preact.js, que lo deriva del daemon Conexion.
 *   Se elimina pintarStatusDot y las escrituras a nodos.statusDot en
 *   cargarRutaServidorSilencioso / activarEstadoOfflineUI / reaccionarAConexion.
 *   Esta feature sigue dueña del banner offline, la recuperación de cola y el
 *   indicador del onboarding. Ver docs/adr/0006-adopt-preact-islands-in-popup.md.
 * CHANGELOG v1.5.0:
 * - [FIX] El puntito de estado ahora refleja la conexión SIEMPRE, incluso durante
 *   una descarga activa. Antes, si el servidor Bun caía a mitad de una ráfaga, el
 *   handler abortaba en la guarda "ráfagaEnCurso" y el indicador quedaba verde para
 *   siempre (el SW no marcaba el fallo si el streaming se colgaba). pintarStatusDot
 *   se movió ANTES de la guarda (level-triggered); el banner/lista siguen delegados
 *   al SW durante la descarga. Ver bunClient.js (timeout de enviarFragmentoStream).
 * CHANGELOG v1.4.0:
 * - [FEAT] La caída de INTERNET ahora también se refleja en la UI (antes sólo el
 *   servidor). activarEstadoOfflineUI(tipo) muestra el banner correcto ("Servidor
 *   Desconectado" o "Sin conexión a internet") según cuál falte; el puntito de
 *   estado se pone rojo si falta CUALQUIERA de las dos (antes: sólo el servidor).
 *   El indicador del onboarding sigue = servidor (elegir carpeta no necesita internet).
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
      onReintentarCola,
      onReescanearAula
    } = ctx;

    // El estado de conexión NO vive acá: lo posee el daemon Conexion (shared/conexion.js).
    // Esta feature sólo se SUSCRIBE a sus cambios y reacciona (UI + recuperación de cola).
    let suscrito = false;
    let previoCompleta = null;  // transición de "ambas conexiones OK" (para recuperación).

    // NOTA: el puntito de estado (statusDot) ya NO se pinta acá — lo posee la isla
    // Preact features/conexionHeader.preact.js, que lo deriva del daemon Conexion.

    async function cargarRutaServidorSilencioso() {
      if (!nodos.btnExplore) return;
      try {
        const ruta = await BunClient.obtenerRutaServidor();
        if (ruta) {
          nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;
          RutaDisco.mostrar(ruta);
        }
      } catch (err) {
        console.warn("⚠️ No se pudo conectar al servidor Bun para obtener la ruta raíz:", err);
        RutaDisco.mostrar("Desconectado", "Servidor desconectado");
        nodos.txtEstado.textContent = "❌ Servidor Bun apagado. Enciéndalo en consola para operar.";
      }
    }

    // Texto de estado del footer + label del botón según el tipo de caída. El
    // CONTENIDO de la tarjeta (icono/título/cuerpo/pulso) vive ahora en la isla
    // Preact features/bannerConexion.preact.js; acá sólo queda lo que pinta el footer.
    const ESTADO_OFFLINE = {
      servidor: {
        estadoTxt: '⚠️ <span style="color:var(--accent-error-visible)">Servidor Bun desconectado.</span>',
        botonTxt: "Buscando servidor... ⏳"
      },
      internet: {
        estadoTxt: '⚠️ <span style="color:var(--accent-error-visible)">Sin conexión a internet.</span>',
        botonTxt: "Esperando internet... ⏳"
      }
    };

    // Muestra el banner de conexión caída. `tipo` = "servidor" | "internet".
    function activarEstadoOfflineUI(tipo = "servidor") {
      const info = ESTADO_OFFLINE[tipo] || ESTADO_OFFLINE.servidor;
      // (el puntito de estado lo maneja la isla Preact conexionHeader.preact.js)

      nodos.folder.disabled = true;
      nodos.btnExplore.disabled = true;
      document.querySelector('.path-bar')?.classList.add('offline');

      nodos.search.disabled = true;
      nodos.btnFilterPills.disabled = true;
      nodos.masterCheck.disabled = true;
      nodos.masterCheck.checked = false;
      if (nodos.btnSort) nodos.btnSort.disabled = true;

      // El banner lo pinta la isla Preact #2 (BannerConexion) en su propio root.
      // La lista (#ui-list) se oculta mientras el banner ocupa su lugar (se repuebla
      // al reconectar, en reaccionarAConexion). Ocultar/vaciar lo hace la propia isla
      // #4 vía setOculta (devuelve null → Preact quita los hijos), NO un innerHTML="" +
      // display:none externo que desincronizaría su vdom. mostrar() es idempotente.
      ListaClases.setOculta(true);
      BannerConexion.mostrar(tipo);
      nodos.loader.style.display = 'none';

      // El path del disco sólo se pierde si el que cayó es el servidor Bun (localhost).
      if (tipo === "servidor") {
        RutaDisco.mostrar("Desconectado", "Servidor desconectado");
      }
      nodos.txtEstado.innerHTML = info.estadoTxt;
      configurarBotonesUX("sincronizar-disco", info.botonTxt, true);

      const tabsBar = document.querySelector(".tabs-bar");
      if (tabsBar) tabsBar.style.display = "none";
      nodos.filtersBar.style.display = "none";

      // (el estado del servidor en el onboarding lo deriva la isla Preact del daemon)

      // Asegura que el detector esté corriendo (idempotente; normalmente ya arrancó en el init).
      iniciarDetectorEstado();
    }

    // Reacción a los cambios del daemon Conexion (shared/conexion.js), la fuente única
    // de verdad. Esta feature NO sondea: sólo consume el estado que le llega por push.
    //   1. Recuperación de cola pausada: reanuda apenas vuelve la conexión que faltaba.
    //   2. Banner offline pasivo: muestra el del servidor o el de internet según cuál
    //      falte (servidor tiene prioridad si caen ambos), y lo saca al reconectar.
    // Los indicadores (puntito de estado y estado del servidor en el onboarding) los
    // derivan las islas Preact del daemon directo — ya no se pintan desde acá.
    function reaccionarAConexion(estado) {
      // El puntito de estado lo maneja la isla Preact (conexionHeader.preact.js), que
      // se suscribe al daemon directo — refleja la conexión SIEMPRE, incluso durante
      // una descarga (por eso ya no importa que este handler aborte en la guarda).
      // Acá sólo queda la UI de descarga: banner/lista/recuperación de cola.
      if (AppState.ráfagaEnCurso && !AppState.fallaConexionActiva) return;

      const completaAntes = previoCompleta;
      previoCompleta = estado.completa;

      // Recuperación de una cola pausada por error: reanudar apenas vuelve la conexión que
      // faltaba (edge-triggered: Conexion notifica sólo en transición).
      if (AppState.fallaConexionActiva === "internet" && estado.internet) {
        onReintentarCola();
        return;
      }
      if (AppState.fallaConexionActiva === "servidor" && estado.servidor) {
        console.log("🔌 [UI-AUTOHEAL] Servidor Bun recuperado. Reanudando descarga masiva...");
        onReintentarCola();
        return;
      }
      // Cola pausada pero aún falta la conexión: la UI de descarga interrumpida ya se encarga.
      if (AppState.fallaConexionActiva) return;

      // Sin cola pausada. Falta alguna conexión (detección pasiva): mostrar el banner del
      // que falte (servidor tiene prioridad). Si ya está el banner correcto, no re-renderiza.
      if (!estado.completa) {
        const tipo = !estado.servidor ? "servidor" : "internet";
        const b = BannerConexion.get();
        if (!b.visible || b.tipo !== tipo) {
          activarEstadoOfflineUI(tipo);
        }
        return;
      }

      // Ambas conexiones OK y veníamos de un banner offline: re-habilitar y re-escanear.
      if (completaAntes !== true) {
        if (BannerConexion.get().visible) {
          BannerConexion.ocultar();
          ListaClases.setOculta(false); // restaura la lista (la repuebla el re-escaneo).

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
