/**
 * CLON DOWNLOADHELPER - FEATURE: COLA DE DESCARGA (V1.4.0)
 * ==========================================================================
 * CHANGELOG v1.4.0:
 * - [FASE 5C] Los 9 usos de chrome.runtime pasan al PuertoMensajeria, que llega por
 *   ctx.mensajeria. Cada call-site declara ahora su intención: `enviar()` donde la
 *   respuesta importa (inyección en cola, abort) y `notificar()` donde es fire-and-forget
 *   (frenado suave, arranque). Sin cambios de comportamiento — en particular, la
 *   restauración del panel tras el abort sigue ocurriendo AUNQUE el SW no conteste
 *   (antes: callback que Chrome invoca igual con lastError; ahora: .finally()).
 *   El módulo sigue en JS: el puerto le llega por ctx, así que no lo importa
 *   composicion.ts y no lo alcanza la restricción de allowJs.
 * CHANGELOG v1.3.0:
 * - [FIX] verificarRedAntesDeDescargar deja de sondear por su cuenta: hacía su
 *   propio fetch(HEAD) + AbortController de 4s contra el portal, duplicando al
 *   daemon Conexion (que ya sondea cada 3s) y violando la regla operativa de
 *   docs/patterns.md §Daemon de estado de conexión. Ahora delega en
 *   Conexion.verificarAhora() y lee .internet del snapshot. Dos consecuencias
 *   buscadas: una sola fuente de verdad sobre "hay internet" (antes podían
 *   discrepar) y se va la latencia extra del sondeo propio al arrancar cada
 *   ráfaga. Se mantiene verificarAhora() en vez de get() para conservar la
 *   semántica de chequeo fresco al arrancar; el gate sigue mirando SÓLO
 *   .internet para no cambiar qué bloquea el arranque.
 * CHANGELOG v1.2.0:
 * - [SPLIT] Último corte: el arranque de descarga (iniciarDescargaCola) y la
 *   reanudación tras caída (ejecutarReintentoDeCola) pasan a QueueFeature, junto
 *   con el helper privado verificarRedAntesDeDescargar. Los flags de UI
 *   verificandoConexionBoton/reintentandoColaActivo siguen en popup.js (los lee
 *   actualizarContadoresBoton); la feature los togglea vía ctx.setVerificandoConexion
 *   / ctx.setReintentandoCola. Sin cambio de comportamiento respecto a popup.js v5.8.1.
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
 *   - iniciarDescargaCola(): arranca la cola (verifica red → congela UI → iniciar_descarga_cola).
 *   - ejecutarReintentoDeCola(): reanuda tras una caída (verifica red → limpia falla → reanuda).
 *
 * Dependencias que recibe por ctx:
 *   - ctx.nodos                 : mapa de nodos (usa folder, queueBadge, txtEstado,
 *                                 masterCheck, btnToggleSelect, btnSoftCancel,
 *                                 cancelBox, btnStartQueue, progressCont).
 *   - ctx.aplicarFiltros()      : re-render cruzado de popup.js (aplicarFiltrosCruzados).
 *   - ctx.actualizarContadores(): refresco de contadores del botón de acción (popup.js).
 *   - ctx.resetSeleccionFila()  : apaga el modo selección múltiple de la fila
 *                                 (flag modoSeleccionFilaActivo, dueño en popup.js).
 *   - ctx.onRestaurarPanel(txt, limpiarCola): restaura el panel del popup tras la
 *                                 detención dura (restaurarPanelPorInterrupcion, popup.js).
 *   - ctx.mostrarAlerta(tipo, titulo): banner/alert de conexión caída (popup.js).
 *   - ctx.congelarUI(titulo, pct, tel): congela la UI en "descargando" (popup.js).
 *   - ctx.renderizar()          : re-render del listado (renderizarListadoInterfaz, popup.js).
 *   - ctx.setVerificandoConexion(bool) / ctx.setReintentandoCola(bool): togglean los
 *                                 flags de UI que sigue leyendo actualizarContadoresBoton (popup.js).
 *   - ctx.mensajeria            : PuertoMensajeria (Fase 5c). Es el ÚNICO canal de IPC de
 *                                 esta feature; no debe volver a aparecer chrome.runtime acá.
 *
 * Expone: encolarItemsEnCaliente, quitarItemsDeColaEnLote, solicitarFrenadoSuave,
 *         abortarRafagaInmediata, iniciarDescargaCola, ejecutarReintentoDeCola.
 */

import { SITIO_LEGADO } from '../../core/estado/appState.ts';
const QueueFeature = {
  crear(ctx) {
    const {
      nodos,
      aplicarFiltros,
      actualizarContadores,
      resetSeleccionFila,
      onRestaurarPanel,
      mostrarAlerta,
      congelarUI,
      renderizar,
      setVerificandoConexion,
      setReintentandoCola,
      // [CORTE 6D — ADR-0011] Reordena la cola persistida según el criterio elegido. Encolar
      // agrega al final, así que sin esto un ítem nuevo contradiría el orden que la pantalla
      // muestra — y desde este corte ese orden es el de descarga, no una vista.
      reordenarCola,
      identidad,
      mensajeria,
      appState,
      conexion,
    } = ctx;

    // Chequeo de red previo a arrancar/reanudar. NO sondea por su cuenta: le pide
    // al daemon un chequeo fresco y lee su resultado (regla operativa de
    // docs/patterns.md §Daemon de estado de conexión — el daemon es el único que
    // sondea). Se usa verificarAhora() y no get() a propósito: conserva la
    // semántica de "verificar justo antes de arrancar" en vez de leer un estado
    // de hasta INTERVALO_SONDEO_MS de antigüedad.
    //
    // El snapshot trae servidor + internet, pero acá se mira SÓLO internet: el
    // gate de arranque es el mismo de siempre y la caída de servidor tiene su
    // propio camino (banner/daemon), no bloquea desde acá.
    async function verificarRedAntesDeDescargar() {
      const estado = await conexion.verificarAhora();
      return estado.internet;
    }

    function encolarItemsEnCaliente(items) {
      const carpeta = nodos.folder.value.trim().toLowerCase();

      // Crear los objetos limpios de la cola
      const nuevosEncolados = items.map((c, idx) => ({
        id: c.id,
        numeroOriginal: c.numeroOriginal,
        titulo: c.titulo,
        urlInterna: c.urlInterna,
        carpeta: carpeta,
        fechaEncolado: Date.now() + idx,
        // ADR-0010: viaja con el ítem. Sale de la clase y NO del sitio activo a propósito —
        // la cola sobrevive a que el usuario cambie de pestaña, así que "el sitio de ahora"
        // no es necesariamente el de esta clase. El fallback cubre una clase persistida
        // antes del multi-sitio que se encole después.
        sitioId: c.sitioId || SITIO_LEGADO
      }));

      // Snapshot para revertir el optimistic update si el SW no confirma la persistencia
      const estadoPrevioItems = items.map(c => ({ ref: c, estado: c.estado, seleccionado: c.seleccionado }));
      const idsNuevos = new Set(nuevosEncolados.map(n => n.id));

      // Combinar en el array de la cola desacoplado
      appState.colaDescargas = [...appState.colaDescargas, ...nuevosEncolados];

      // Cambiar estado en listado visible
      items.forEach(c => { c.estado = 'process'; c.seleccionado = false; });
      nodos.queueBadge.textContent = appState.colaDescargas.length;

      if (appState.ráfagaEnCurso) {
        // No molestar
      } else {
        nodos.txtEstado.textContent = `📥 ¡Clases agregadas! Pasá a la pestaña de Fila para iniciar.`;
      }

      // [CORTE 6D] Antes de respaldar: lo recién agregado va al final del array y el criterio
      // vigente puede querer otra cosa. El rollback de más abajo sigue funcionando porque
      // filtra por id, no por posición.
      if (reordenarCola) reordenarCola();

      appState.respaldar();
      aplicarFiltros();

      // Rollback del optimistic update: saca sólo lo que agregamos (por id, robusto ante
      // encolados intermedios) y restaura estado/selección de los ítems tocados.
      const revertirInyeccion = (motivo) => {
        console.warn('[popup] La inyección en cola no se confirmó; revirtiendo optimistic update:', motivo);
        appState.colaDescargas = appState.colaDescargas.filter(item => !idsNuevos.has(item.id));
        estadoPrevioItems.forEach(({ ref, estado, seleccionado }) => {
          ref.estado = estado;
          ref.seleccionado = seleccionado;
        });
        nodos.queueBadge.textContent = appState.colaDescargas.length;
        nodos.txtEstado.textContent = `⚠️ No se pudieron agregar las clases a la Fila. Reintentá.`;
        appState.respaldar();
        aplicarFiltros();
      };

      // El SW responde { status: "encolados_ok" } tras persistir. Dos modos de fallo, mismo
      // desenlace: que el canal falle (SW dormido → el puerto rechaza) o que conteste algo
      // inesperado. En ambos revertimos, para no dejar la UI mostrando ítems "en cola" que
      // nunca se persistieron en background.js.
      mensajeria
        .enviar({ action: "inyectar_items_en_cola_activa", items: nuevosEncolados })
        .then((respuesta) => {
          if (!respuesta || respuesta.status !== "encolados_ok") {
            revertirInyeccion(`respuesta inesperada: ${JSON.stringify(respuesta)}`);
          }
        })
        .catch((err) => revertirInyeccion(err?.message || String(err)));
    }

    function quitarItemsDeColaEnLote(items) {
      // [MULTIPORTAL D] Por (portal, título): con la clave pelada, quitar una clase se
      // llevaba también a su homónima del otro portal.
      const titulosAQuitar = new Set(items.map(c => identidad.clave(c)));

      // Determinar si la selección maestro "Todos" estaba activa para heredarla
      const visiblesPendientes = appState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
      const seleccionMaestraActiva = visiblesPendientes.length > 0 && visiblesPendientes.every(i => i.seleccionado);

      // Filtrar de la fila local
      appState.colaDescargas = appState.colaDescargas.filter(c => !titulosAQuitar.has(identidad.clave(c)));

      // Restablecer estados a pending en el listado global
      appState.listadoClasesGlobal.forEach(c => {
        if (titulosAQuitar.has(identidad.clave(c))) {
          c.estado = 'pending';
          c.seleccionado = seleccionMaestraActiva;
        }
      });

      nodos.queueBadge.textContent = appState.colaDescargas.length;
      nodos.masterCheck.checked = false;
      resetSeleccionFila();
      if (nodos.btnToggleSelect) {
        nodos.btnToggleSelect.textContent = "Seleccionar";
        nodos.btnToggleSelect.title = "Activar selección múltiple";
      }
      const selectWrapper = document.getElementById('ui-master-select-wrapper');
      if (selectWrapper) selectWrapper.style.display = 'none';

      appState.respaldar();
      actualizarContadores();

      // El re-render se hace cuando el SW terminó de procesar TODAS las remociones. Un fallo
      // de canal no debe frenar el re-render (la UI local ya se actualizó arriba), así que
      // cada envío absorbe su error — igual que antes, cuando el callback de Chrome resolvía
      // la promesa con undefined incluso habiendo lastError.
      const promesas = items.map(c =>
        mensajeria.enviar({ action: "remover_item_de_cola", titulo: c.titulo, sitioId: c.sitioId }).catch(() => undefined)
      );

      Promise.all(promesas).then(() => {
        setTimeout(aplicarFiltros, 100);
      });
    }

    // Frenado suave: termina el video en curso y no arranca los siguientes.
    // Deja el botón deshabilitado, marca la bandera y avisa al SW.
    function solicitarFrenadoSuave() {
      nodos.btnSoftCancel.disabled = true;
      appState.banderaFrenadoSolicitado = true;

      nodos.txtEstado.innerHTML = "";
      const spanDesc = document.createElement('span');
      spanDesc.style.color = "var(--accent-orange)";
      spanDesc.textContent = appState.videoActualEnTransmisiónSW || "Video actual";
      nodos.txtEstado.append("Frenando al terminar:", document.createElement('br'), spanDesc);

      mensajeria.notificar({ action: "activar_frenado_suave" });
    }

    // Detención dura: aborta la ráfaga ya, preservando la fila. Restaura el panel
    // del popup (callback de popup.js) cuando el SW confirma el abort.
    function abortarRafagaInmediata() {
      // .finally y no .then: el panel se restaura CONTESTE O NO el SW. Es el
      // comportamiento que ya había (Chrome invoca el callback igual, con lastError) y hay
      // que conservarlo: si el SW está dormido, dejar el panel congelado sería peor que
      // restaurarlo de más.
      mensajeria
        .enviar({ action: "abortar_rafaga_inmediata" })
        .catch(() => undefined)
        .finally(() => {
          onRestaurarPanel("🛑 Descargas detenidas. Fila preservada.", false);
        });
    }

    // Arranque de la cola: verifica red, congela la UI en "descargando" y avisa
    // al SW. Si no hay red, muestra el alert de conexión caída y no arranca.
    async function iniciarDescargaCola() {
      const cola = appState.colaDescargas;
      if (cola.length === 0) return;

      setVerificandoConexion(true);
      actualizarContadores();

      const redDisponible = await verificarRedAntesDeDescargar();
      setVerificandoConexion(false);

      if (!redDisponible) {
        actualizarContadores();
        mostrarAlerta("internet", cola[0].titulo);
        return;
      }

      congelarUI(cola[0].titulo, 0, null);
      mensajeria.notificar({ action: "iniciar_descarga_cola" });
    }

    // Reanudación tras una caída: verifica red, limpia el estado de falla y
    // restaura el panel de descarga (quitando el banner) al reanudar.
    async function ejecutarReintentoDeCola() {
      setReintentandoCola(true);
      actualizarContadores();
      nodos.txtEstado.textContent = "⏳ Verificando conexión...";

      const redDisponible = await verificarRedAntesDeDescargar();
      setReintentandoCola(false);

      if (!redDisponible) {
        const primerItem = appState.colaDescargas[0];
        const tituloFallado = primerItem ? primerItem.titulo : (appState.videoFalladoParaReintento || "clase");
        mostrarAlerta("internet", tituloFallado);
        return;
      }

      appState.fallaConexionActiva = null;
      appState.videoFalladoParaReintento = null;

      // Restaurar la UI de descarga (quitar el banner) YA, al reanudar. No alcanza con
      // esperar al primer update_progress_bar: como acá dejamos fallaConexionActiva en
      // null, ese handler ya no entra a su rama de limpieza (está gateada a que la falla
      // siga activa), y su re-render está gateado a que cambie el título — que no cambia
      // porque se reanuda el MISMO video. Sin esto, el banner quedaba hasta refrescar.
      nodos.cancelBox.style.display = 'flex';
      nodos.btnStartQueue.style.display = 'none';
      nodos.progressCont.style.display = 'block';
      renderizar();
      actualizarContadores();

      nodos.txtEstado.textContent = "⏳ Conectando y reanudando fila...";
      mensajeria.notificar({ action: "iniciar_descarga_cola" });
    }

    return {
      encolarItemsEnCaliente,
      quitarItemsDeColaEnLote,
      solicitarFrenadoSuave,
      abortarRafagaInmediata,
      iniciarDescargaCola,
      ejecutarReintentoDeCola,
    };
  }
};

// Exportación (ver docs/coding-standards.md). Desde la Fase 8a NO publica global: los
// módulos hermanos viajan por `import` y no son adaptadores intercambiables. (Hasta el
// 2026-08-05 este comentario decía que "sigue publicando el global", que era falso: la
// 8a lo sacó y el texto quedó.)
export default QueueFeature;
