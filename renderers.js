/**
 * CLON DOWNLOADHELPER - MÓDULO RENDERIZADOR Y AUXILIARES DE VISTA (V5.2.0)
 * ENCAPSULA EL DIBUJO DINÁMICO DEL DOM NATIVO ACOPLADO A APPSTATE
 * ==========================================================================
 * CHANGELOG v5.2.0:
 * - [CLEANUP] Se eliminan `construirFilaClaseDOM` y `renderizarTarjetaEstado`:
 *   quedaron como referencia muerta tras migrar la lista de clases a la isla
 *   Preact `popup/features/listaClases.preact.js` (`<FilaClase>` / `<TarjetaEstado>`,
 *   ports 1:1). Confirmado sin call-sites reales. `pintarTelemetria` sigue vivo
 *   (lo usa `popup.js`).
 * CHANGELOG v5.1.0:
 * - [FIX UX CRÍTICO] Se eliminan los checkboxes en la pestaña "Disponibles" si la
 * clase tiene `clase.estado === 'process'`. Evita mutaciones inválidas de cola en caliente.
 * - [REFACTOR] Agrupación homogénea de placeholders de grilla para mantener simetría visual.
 */

const Renderers = {
  /**
   * Pinta el panel de telemetría.
   * Firma unificada: recibe el objeto `nodos` completo del popup.
   * Reemplaza tanto a `pintarTelemetria` como a `renderizarMétricasTelemetria`.
   *
   * @param {object} tel    - Objeto de telemetría del SW { bytesProcesados, fragsTerminados, totalFrags, velocidadMbs }
   * @param {object} nodos  - Mapa de nodos del popup (usa: panelTel, bytes, speed, frags)
   */
  pintarTelemetria(tel, nodos) {
    if (!tel || tel.totalFrags === 0) return;

    nodos.panelTel.style.display = 'flex';

    const mbProcesados = Utils.formatearMB(tel.bytesProcesados);
    const mbTotales    = Utils.calcularProyeccionMB(tel.bytesProcesados, tel.fragsTerminados, tel.totalFrags);

    nodos.bytes.innerText = `${mbProcesados} MB / ${isNaN(mbTotales) ? '0.0' : mbTotales} MB`;

    // Guardia ante velocidadMbs null/undefined para evitar TypeError en .toFixed()
    nodos.speed.innerText = `${(tel.velocidadMbs ?? 0).toFixed(1)} MB/s`;

    nodos.frags.innerText = `Frags: ${tel.fragsTerminados}/${tel.totalFrags}`;
  }
};

window.Renderers = Renderers;
