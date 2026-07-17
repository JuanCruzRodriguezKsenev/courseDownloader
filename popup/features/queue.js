/**
 * CLON DOWNLOADHELPER - FEATURE: COLA DE DESCARGA (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [SPLIT] Sumada la cancelación de descarga: solicitarFrenadoSuave (frenado
 *   suave, activar_frenado_suave) y abortarRafagaInmediata (detención dura,
 *   abortar_rafaga_inmediata + restauración del panel vía ctx.onRestaurarPanel).
 *   Sin cambios de comportamiento respecto a popup.js v5.8.0.
 * CHANGELOG v1.0.0:
 * - [SPLIT] Extraídas de popup.js las dos operaciones de MUTACIÓN de la cola:
 *   encolarItemsEnCaliente (agregar con optimistic update + rollback) y
 *   quitarItemsDeColaEnLote (sacar un lote y volverlo a 'pending'). Sin cambios
 *   de comportamiento respecto a popup.js v5.7.1. Ver ADR-0005, ROADMAP Fase 2.
 * ==========================================================================
 * Módulo 3/4 de la reorganización feature-driven de popup.js
 * (ver docs/adr/0005-feature-driven-popup-split.md, docs/ROADMAP.md Fase 2).
 *
 * Encapsula las operaciones que MUTAN la cola de descarga (AppState.colaDescargas)
 * y sincronizan con el service worker por IPC:
 *   - encolarItemsEnCaliente(items): agrega a la cola con optimistic update, y
 *     revierte si el SW no confirma la persistencia (inyectar_items_en_cola_activa).
 *   - quitarItemsDeColaEnLote(items): saca un lote de la cola, restablece esas
 *     clases a 'pending' y las remueve en el SW (remover_item_de_cola).
 *   - solicitarFrenadoSuave(): frenado suave (activar_frenado_suave).
 *   - abortarRafagaInmediata(): detención dura (abortar_rafaga_inmediata).
 *
 * NO incluye (siguen en popup.js por su acoplamiento con la recuperación de
 * conexión y el render): ejecutarReintentoDeCola y el arranque de descarga
 * (btnStartQueue → iniciar_descarga_cola, que arrastra verificarRed / congelarUI /
 * mostrarAlert). Se migrarán en pasos siguientes del split.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos                 : mapa de nodos (usa folder, queueBadge, txtEstado,
 *                                 masterCheck, btnToggleSelect, btnSoftCancel).
 *   - ctx.aplicarFiltros()      : re-render cruzado de popup.js (aplicarFiltrosCruzados).
 *   - ctx.actualizarContadores(): refresco de contadores del botón de acción (popup.js).
 *   - ctx.resetSeleccionFila()  : apaga el modo selección múltiple de la fila
 *                                 (flag modoSeleccionFilaActivo, dueño en popup.js).
 *   - ctx.onRestaurarPanel(txt, limpiarCola): restaura el panel del popup tras la
 *                                 detención dura (restaurarPanelPorInterrupcion, popup.js).
 *
 * Expone: encolarItemsEnCaliente, quitarItemsDeColaEnLote,
 *         solicitarFrenadoSuave, abortarRafagaInmediata.
 */
const QueueFeature = {
  crear(ctx) {
    const { nodos, aplicarFiltros, actualizarContadores, resetSeleccionFila, onRestaurarPanel } = ctx;

    function encolarItemsEnCaliente(items) {
      const carpeta = nodos.folder.value.trim().toLowerCase();

      // Crear los objetos limpios de la cola
      const nuevosEncolados = items.map((c, idx) => ({
        id: c.id,
        numeroOriginal: c.numeroOriginal,
        titulo: c.titulo,
        urlInterna: c.urlInterna,
        carpeta: carpeta,
        fechaEncolado: Date.now() + idx
      }));

      // Snapshot para revertir el optimistic update si el SW no confirma la persistencia
      const estadoPrevioItems = items.map(c => ({ ref: c, estado: c.estado, seleccionado: c.seleccionado }));
      const idsNuevos = new Set(nuevosEncolados.map(n => n.id));

      // Combinar en el array de la cola desacoplado
      AppState.colaDescargas = [...AppState.colaDescargas, ...nuevosEncolados];

      // Cambiar estado en listado visible
      items.forEach(c => { c.estado = 'process'; c.seleccionado = false; });
      nodos.queueBadge.textContent = AppState.colaDescargas.length;

      if (AppState.ráfagaEnCurso) {
        // No molestar
      } else {
        nodos.txtEstado.textContent = `📥 ¡Clases agregadas! Pasá a la pestaña de Fila para iniciar.`;
      }

      AppState.respaldar();
      aplicarFiltros();

      // El SW responde { status: "encolados_ok" } tras persistir; si falla (SW dormido,
      // error de storage) el canal se cierra sin respuesta y queda chrome.runtime.lastError.
      // En cualquiera de esos casos revertimos el optimistic update para no dejar la UI
      // mostrando ítems "en cola" que nunca se persistieron en background.js.
      chrome.runtime.sendMessage({
        action: "inyectar_items_en_cola_activa",
        items: nuevosEncolados
      }, (respuesta) => {
        if (chrome.runtime.lastError || !respuesta || respuesta.status !== "encolados_ok") {
          console.warn(
            '[popup] La inyección en cola no se confirmó; revirtiendo optimistic update:',
            chrome.runtime.lastError?.message || `respuesta inesperada: ${JSON.stringify(respuesta)}`
          );
          // Rollback: sacar sólo lo que agregamos (por id, robusto ante encolados intermedios)
          AppState.colaDescargas = AppState.colaDescargas.filter(item => !idsNuevos.has(item.id));
          estadoPrevioItems.forEach(({ ref, estado, seleccionado }) => {
            ref.estado = estado;
            ref.seleccionado = seleccionado;
          });
          nodos.queueBadge.textContent = AppState.colaDescargas.length;
          nodos.txtEstado.textContent = `⚠️ No se pudieron agregar las clases a la Fila. Reintentá.`;
          AppState.respaldar();
          aplicarFiltros();
        }
      });
    }

    function quitarItemsDeColaEnLote(items) {
      const titulosAQuitar = new Set(items.map(c => c.titulo));

      // Determinar si la selección maestro "Todos" estaba activa para heredarla
      const visiblesPendientes = AppState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
      const seleccionMaestraActiva = visiblesPendientes.length > 0 && visiblesPendientes.every(i => i.seleccionado);

      // Filtrar de la fila local
      AppState.colaDescargas = AppState.colaDescargas.filter(c => !titulosAQuitar.has(c.titulo));

      // Restablecer estados a pending en el listado global
      AppState.listadoClasesGlobal.forEach(c => {
        if (titulosAQuitar.has(c.titulo)) {
          c.estado = 'pending';
          c.seleccionado = seleccionMaestraActiva;
        }
      });

      nodos.queueBadge.textContent = AppState.colaDescargas.length;
      nodos.masterCheck.checked = false;
      resetSeleccionFila();
      if (nodos.btnToggleSelect) {
        nodos.btnToggleSelect.textContent = "Seleccionar";
        nodos.btnToggleSelect.title = "Activar selección múltiple";
      }
      const selectWrapper = document.getElementById('ui-master-select-wrapper');
      if (selectWrapper) selectWrapper.style.display = 'none';

      AppState.respaldar();
      actualizarContadores();

      const promesas = items.map(c => {
        return new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: "remover_item_de_cola",
            titulo: c.titulo
          }, resolve);
        });
      });

      Promise.all(promesas).then(() => {
        setTimeout(aplicarFiltros, 100);
      });
    }

    // Frenado suave: termina el video en curso y no arranca los siguientes.
    // Deja el botón deshabilitado, marca la bandera y avisa al SW.
    function solicitarFrenadoSuave() {
      nodos.btnSoftCancel.disabled = true;
      AppState.banderaFrenadoSolicitado = true;

      nodos.txtEstado.innerHTML = "";
      const spanDesc = document.createElement('span');
      spanDesc.style.color = "var(--accent-orange)";
      spanDesc.textContent = AppState.videoActualEnTransmisiónSW || "Video actual";
      nodos.txtEstado.append("Frenando al terminar:", document.createElement('br'), spanDesc);

      chrome.runtime.sendMessage({ action: "activar_frenado_suave" });
    }

    // Detención dura: aborta la ráfaga ya, preservando la fila. Restaura el panel
    // del popup (callback de popup.js) cuando el SW confirma el abort.
    function abortarRafagaInmediata() {
      chrome.runtime.sendMessage({ action: "abortar_rafaga_inmediata" }, () => {
        onRestaurarPanel("🛑 Descargas detenidas. Fila preservada.", false);
      });
    }

    return { encolarItemsEnCaliente, quitarItemsDeColaEnLote, solicitarFrenadoSuave, abortarRafagaInmediata };
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = QueueFeature;
} else if (typeof window !== "undefined") {
  window.QueueFeature = QueueFeature;
} else if (typeof self !== "undefined") {
  self.QueueFeature = QueueFeature;
}
