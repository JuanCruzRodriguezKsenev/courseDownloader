/**
 * CLON DOWNLOADHELPER - ORQUESTADOR DE INTERFAZ GENERAL (V5.8.1)
 * ARCHIVO COMPLETO — LECTURA DE DISCO UNIFICADA HÍBRIDA (CHROME SEARCH / BUN LÓGICO)
 * ==========================================================================
 * CHANGELOG v5.8.1:
 * - [SPLIT] La cancelación de descarga (frenado suave + detención dura) pasó a
 *   QueueFeature: los listeners btnSoftCancel/btnHardCancel ahora sólo llaman a
 *   _queue.solicitarFrenadoSuave() / _queue.abortarRafagaInmediata(). El panel se
 *   restaura vía ctx.onRestaurarPanel (restaurarPanelPorInterrupcion sigue acá,
 *   la usan 5 call-sites). Sin cambio de comportamiento. Ver queue.js v1.1.0.
 * CHANGELOG v5.8.0:
 * - [SPLIT] Las mutaciones de la cola (encolarItemsEnCaliente, quitarItemsDeColaEnLote)
 *   se extrajeron a la feature popup/features/queue.js (QueueFeature.crear(ctx)).
 *   popup.js las recibe por ctx (nodos + callbacks aplicarFiltros/actualizarContadores/
 *   resetSeleccionFila) y las expone como alias locales — los call-sites no cambian.
 *   Sin cambio de comportamiento. Ver ADR-0005, ROADMAP Fase 2, queue.test.js.
 * CHANGELOG v5.7.1:
 * - [FIX] encolarItemsEnCaliente hacía optimistic update (AppState.colaDescargas +
 *   DOM + estado 'process') y disparaba inyectar_items_en_cola_activa SIN verificar
 *   la respuesta. Si el SW no confirmaba (dormido, error de storage), la UI quedaba
 *   mostrando ítems "en cola" nunca persistidos en background.js (estado inconsistente
 *   popup↔SW hasta el próximo sincronizarConBackground). Ahora el sendMessage tiene
 *   callback: ante lastError o status != "encolados_ok" revierte la cola (por id),
 *   restaura estado/selección de los ítems y re-renderiza. Ver docs/TECHNICAL_DEBT.md
 *   (Robustez del flujo de datos), ROADMAP Fase 3.
 * CHANGELOG v5.7.0:
 * - [MIGRACIÓN] El texto de la ruta del disco (📁 PC:) pasó a ser la isla Preact #1b
 *   (features/rutaDisco.preact.js). Se quitó nodos.pcPath: los sets de texto/título/
 *   spinner ahora pasan por el store window.RutaDisco (mostrar/cargando/get). El botón
 *   "Explorar", el input de materia y el toggle .path-bar.offline siguen vanilla.
 *   Ver docs/preact-migration.md, ADR-0006.
 * CHANGELOG v5.6.0:
 * - [MIGRACIÓN] El onboarding (welcome tour) pasó a ser la isla Preact #3
 *   (features/onboarding.preact.js): posee todo el overlay #ui-onboarding y su DOM.
 *   popup.js ya NO tiene refs nodos.onboarding* (se quitaron del mapa) y le pasa a
 *   OnboardingFeature.crear sólo { btnHelp, onExplore, onComplete }. Desaparece el
 *   alias/callback actualizarEstadoServidorOnboarding: el estado del servidor del
 *   tour lo deriva la isla del daemon Conexion. Ver docs/preact-migration.md, ADR-0006.
 * CHANGELOG v5.5.6:
 * - [FIX] Al reconectar el servidor, el banner de "descarga interrumpida" no se iba
 *   hasta refrescar el popup. ejecutarReintentoDeCola ponía fallaConexionActiva=null
 *   sin re-renderizar; el handler update_progress_bar (única limpieza del banner) no
 *   entraba a su rama porque esa rama está gateada a que la falla siga activa, y su
 *   re-render está gateado a que cambie el título (no cambia: se reanuda el mismo
 *   video). Ahora ejecutarReintentoDeCola restaura el panel y re-renderiza al reanudar.
 * CHANGELOG v5.5.5:
 * - [FIX] En la primera vez, el loader "Escaneando..." aparecía antes/detrás del
 *   tutorial. Ahora el onboarding va primero y solo; la conexión al servidor y el
 *   escaneo del aula se extrajeron a conectarYArrancar() y se difieren hasta que
 *   el usuario cierra el tour (onboarding onComplete). El estado del servidor
 *   dentro del tour lo mantiene el daemon de conexión, que arranca antes.
 * CHANGELOG v5.5.4:
 * - [LIMPIEZA] Se borra el wrapper muerto clasificarCatedraYCarpeta (solo
 *   reenviaba a Utils.clasificarCatedraYCarpeta); ningún call-site lo usaba —
 *   los 5 reales llaman directo a Utils.* (ver docs/TECHNICAL_DEBT.md).
 * CHANGELOG v5.5.3:
 * - [REFACTOR] El init arranca el único detector de estado de serverConnection
 *   (iniciarDetectorEstado), que reemplaza al monitor + latido separados. El
 *   alias iniciarMonitoreoServidor apunta a ese detector (idempotente).
 * CHANGELOG v5.5.1:
 * - [REFACTOR] Fase 2 (módulo 2/4): la conexión al servidor Bun
 *   (cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarMonitoreoServidor)
 *   se extrajo a popup/features/serverConnection.js, que ahora es dueño de los flags
 *   intervalReconexion/comprobacionEnProgreso. popup.js inyecta las llamadas cruzadas
 *   (configurarBotonesUX, ejecutarReintentoDeCola, ejecutarPaso1EscaneoRamonAutomatico,
 *   actualizarEstadoServidorOnboarding) como callbacks del ctx.
 * CHANGELOG v5.5.0:
 * - [REFACTOR] Fase 2 (split feature-driven): el onboarding (welcome tour) se
 *   extrajo a popup/features/onboarding.js. popup.js lo instancia como
 *   _onboardingFeature y conserva alias locales mostrarOnboarding /
 *   actualizarEstadoServidorOnboarding para no tocar los call-sites.
 * CHANGELOG v5.4.2:
 * - [SEGURIDAD] renderizarListadoInterfaz: se escapa el título scrapeado con
 *   Utils.escaparHtml antes de interpolarlo en la tarjeta de error (se pinta vía
 *   innerHTML en Renderers.renderizarTarjetaEstado). Cierra el XSS conocido.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log("🤖 [POPUP-CORE] Orquestador unificado V5.4.1 activo. Sincronización de escáner híbrido (Chrome/Bun) integrada.");

  const nodos = {
    btnAction:       document.getElementById('ui-btn-action'),
    btnStartQueue:   document.getElementById('ui-btn-start-queue'),
    txtEstado:       document.getElementById('ui-msg-status'),
    lista:           document.getElementById('ui-list'),
    search:          document.getElementById('ui-search'),
    btnFilterPills:  document.getElementById('ui-btn-filter-pills'),
    filterMenu:      document.getElementById('ui-filter-menu'),
    masterCheck:     document.getElementById('ui-master-check'),
    folder:          document.getElementById('ui-path-folder'),
    progressCont:    document.getElementById('ui-progress-container'),
    progressBar:     document.getElementById('ui-progress-bar'),
    loader:          document.getElementById('ui-loader'),
    loaderTxt:       document.getElementById('ui-loader-txt'),
    filtersBar:      document.getElementById('ui-filter-bar'),
    queueBadge:      document.getElementById('ui-queue-badge'),
    tabDisp:         document.getElementById('tab-available'),
    tabCola:         document.getElementById('tab-queue'),
    cancelBox:       document.getElementById('ui-cancel-box'),
    btnSoftCancel:   document.getElementById('ui-btn-soft-cancel'),
    btnHardCancel:   document.getElementById('ui-btn-hard-cancel'),
    panelTel:        document.getElementById('ui-telemetry'),
    bytes:           document.getElementById('ui-tel-bytes'),
    speed:           document.getElementById('ui-tel-speed'),
    frags:           document.getElementById('ui-tel-frags'),
    btnExplore:      document.getElementById('ui-btn-explore'),
    catedraBadge:    document.getElementById('ui-catedra-badge'),
    // El texto de la ruta (#preact-pc-path) lo posee la isla Preact
    // features/rutaDisco.preact.js; se empuja vía window.RutaDisco (no hay ref nodos.*).
    btnSort:         document.getElementById('ui-btn-sort'),
    btnToggleSelect: document.getElementById('ui-btn-toggle-select'),
    btnHelp:         document.getElementById('ui-btn-help')
    // El overlay del onboarding y su DOM interno los posee la isla Preact
    // features/onboarding.preact.js (ver ADR-0006). Ya no hay refs nodos.* a él.
  };

  let punteroOyenteRuntimeActivo = null;
  let modoSeleccionFilaActivo = false;
  const filtrosActivos = {
    estados: new Set(),
    materias: new Set(),
    catedras: new Set()
  };

  // --- Isla Preact #3: Onboarding (welcome tour) — features/onboarding.preact.js ---
  // Se cablea temprano porque el flujo de inicialización (más abajo) invoca
  // mostrarOnboarding. lanzarSeleccionCarpetaFisica es una declaración de función
  // (hoisted), así que la referencia diferida es segura.
  // La isla Preact features/onboarding.preact.js expone window.OnboardingFeature.crear
  // (misma firma que la feature vieja). Le pasamos el botón de ayuda (vive en el header,
  // fuera de la isla) y los callbacks cruzados. El estado del servidor del slide de la
  // carpeta ya NO se empuja desde acá: la isla lo deriva del daemon Conexion.
  const _onboardingFeature = OnboardingFeature.crear({
    btnHelp: nodos.btnHelp,
    onExplore: () => lanzarSeleccionCarpetaFisica(),
    // Al cerrar el tour de la PRIMERA vez (no el reabierto por el botón de ayuda),
    // recién ahí conectamos al servidor y escaneamos el aula, para que el loader no
    // aparezca detrás/antes del tutorial. conectarYArrancar es hoisted (ver init).
    onComplete: () => conectarYArrancar()
  });
  const mostrarOnboarding = _onboardingFeature.mostrarOnboarding;

  nodos.catedraBadge.addEventListener("click", () => {
    const catedrasDetectadas = Array.from(new Set(
      AppState.listadoClasesGlobal.map(c => c.catedra).filter(cat => cat !== "COMUN")
    ));
    if (catedrasDetectadas.length > 1) {
      mostrarModalMulticatedra(catedrasDetectadas);
    }
  });

  if (nodos.btnSort) {
    nodos.btnSort.addEventListener("click", () => {
      if (AppState.pestañaActiva === "cola") {
        if (AppState.ordenAscendente === true) {
          AppState.ordenAscendente = false;
        } else if (AppState.ordenAscendente === false) {
          AppState.ordenAscendente = null; // FIFO natural
        } else {
          AppState.ordenAscendente = true;
        }
      } else {
        AppState.ordenAscendente = (AppState.ordenAscendente === null) ? true : !AppState.ordenAscendente;
      }
      AppState.respaldar();
      actualizarIconoSorteo();
      renderizarListadoInterfaz();
    });
  }

  if (nodos.btnToggleSelect) {
    nodos.btnToggleSelect.addEventListener("click", () => {
      modoSeleccionFilaActivo = !modoSeleccionFilaActivo;
      if (modoSeleccionFilaActivo) {
        nodos.btnToggleSelect.textContent = "Cancelar";
        nodos.btnToggleSelect.title = "Desactivar selección múltiple";
        const wrapper = document.getElementById('ui-master-select-wrapper');
        if (wrapper) wrapper.style.display = 'flex';
      } else {
        nodos.btnToggleSelect.textContent = "Seleccionar";
        nodos.btnToggleSelect.title = "Activar selección múltiple";
        const wrapper = document.getElementById('ui-master-select-wrapper');
        if (wrapper) wrapper.style.display = 'none';
        
        // Deseleccionar todas las clases de la fila al cancelar
        AppState.colaDescargas.forEach(c => c.seleccionado = false);
        nodos.masterCheck.checked = false;
        AppState.respaldar();
      }
      actualizarContadoresBoton();
      aplicarFiltrosCruzados();
    });
  }

  // Toggle visibility of popover menu
  if (nodos.btnFilterPills) {
    nodos.btnFilterPills.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = nodos.filterMenu.style.display === 'flex';
      if (!open) {
        renderizarFiltrosMenuPopover();
      }
      nodos.filterMenu.style.display = open ? 'none' : 'flex';
      nodos.btnFilterPills.classList.toggle('open', !open);
    });
  }

  // Close when clicking outside
  document.addEventListener('click', () => {
    if (nodos.filterMenu) {
      nodos.filterMenu.style.display = 'none';
    }
    if (nodos.btnFilterPills) {
      nodos.btnFilterPills.classList.remove('open');
    }
  });

  // Prevent close when clicking inside the popover
  if (nodos.filterMenu) {
    nodos.filterMenu.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  let verificandoConexionBoton = false;
  let reintentandoColaActivo = false;

  // --- Feature: conexión al servidor Bun (monitoreo/offline) — popup/features/serverConnection.js ---
  // El módulo es dueño de su propio estado de monitoreo (intervalReconexion,
  // comprobacionEnProgreso). Las llamadas cruzadas a queue/scan/UX se inyectan como
  // callbacks (referencias diferidas a funciones hoisted de popup.js).
  const _serverConnection = ServerConnectionFeature.crear({
    nodos,
    configurarBotonesUX: (modo, txt, dis) => configurarBotonesUX(modo, txt, dis),
    onReintentarCola: () => ejecutarReintentoDeCola(),
    onReescanearAula: () => ejecutarPaso1EscaneoRamonAutomatico()
  });
  const activarEstadoOfflineUI = _serverConnection.activarEstadoOfflineUI;
  // Un único detector de estado de conexión, siempre activo mientras el popup está
  // abierto: mantiene el indicador al día en ambos sentidos y recupera la cola/aula al
  // reconectar. mostrarAlertDeConexionCaida lo (re)dispara vía este alias (idempotente).
  const iniciarMonitoreoServidor = _serverConnection.iniciarDetectorEstado;
  _serverConnection.iniciarDetectorEstado();

  // Feature: mutaciones de la cola (agregar/quitar en lote). Ver popup/features/queue.js.
  const _queue = QueueFeature.crear({
    nodos,
    aplicarFiltros: () => aplicarFiltrosCruzados(),
    actualizarContadores: () => actualizarContadoresBoton(),
    resetSeleccionFila: () => { modoSeleccionFilaActivo = false; },
    onRestaurarPanel: (txt, limpiarCola) => restaurarPanelPorInterrupcion(txt, limpiarCola)
  });
  const encolarItemsEnCaliente = _queue.encolarItemsEnCaliente;
  const quitarItemsDeColaEnLote = _queue.quitarItemsDeColaEnLote;

  nodos.btnAction.setAttribute('data-modo', 'sincronizar-disco');

  // Forzar re-escaneo automático si la pestaña de Ramón Net cambia de dirección o se recarga
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url && tab.url.includes("plataforma.ramonnet.com.ar")) {
      console.log("🔄 [POPUP] Pestaña Ramón Net actualizada. Re-escaneando...");
      if (!AppState.fallaConexionActiva) {
        ejecutarPaso1EscaneoRamonAutomatico();
      }
    }
  });

  // Forzar re-escaneo si el usuario cambia a la pestaña de Ramón Net
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      if (tab.active && tab.url && tab.url.includes("plataforma.ramonnet.com.ar")) {
        console.log("🔄 [POPUP] Pestaña Ramón Net enfocada. Re-escaneando...");
        if (!AppState.fallaConexionActiva) {
          ejecutarPaso1EscaneoRamonAutomatico();
        }
      }
    });
  });

  // Conecta con el servidor Bun, sincroniza con el SW y arranca el escaneo del aula.
  // Se invoca al inicio si el tutorial ya estaba completo, o al cerrar el onboarding
  // de la primera vez (onComplete). Es dueña de su propio loader (mostrar/ocultar).
  async function conectarYArrancar() {
    try {
      nodos.loaderTxt.textContent = "Conectando con el servidor Bun...";
      nodos.loader.style.display = 'flex';

      const ruta = await BunClient.obtenerRutaServidor();
      if (ruta) {
        const tabsBar = document.querySelector(".tabs-bar");
        if (tabsBar) tabsBar.style.display = "flex";

        nodos.folder.disabled = false;
        nodos.btnExplore.disabled = false;
        document.querySelector('.path-bar')?.classList.remove('offline');

        nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;
        RutaDisco.mostrar(ruta);
        nodos.txtEstado.textContent = "Analizando aula virtual...";
        // (el puntito de estado y el estado del servidor en el onboarding los derivan
        //  las islas Preact del daemon Conexion — ya no se empujan imperativamente)

        const respuestaFondo = await AppState.sincronizarConBackground();

        if (AppState.ráfagaEnCurso) {
          congelarUIPorDescargaActiva(AppState.videoActualEnTransmisiónSW, respuestaFondo.porcentaje, respuestaFondo.telemetry);
        } else if (respuestaFondo && respuestaFondo.colaPausadaPorError) {
          AppState.fallaConexionActiva = respuestaFondo.tipoDeErrorConexion;
          AppState.videoFalladoParaReintento = respuestaFondo.videoActual;
          mostrarAlertDeConexionCaida(respuestaFondo.tipoDeErrorConexion, respuestaFondo.videoActual);
        }

        if (!AppState.fallaConexionActiva) {
          ejecutarPaso1EscaneoRamonAutomatico();
        }
      }
    } catch (errConexion) {
      console.warn("⚠️ Servidor Bun desconectado en inicio:", errConexion.message);
      activarEstadoOfflineUI();
    } finally {
      nodos.loader.style.display = 'none';
    }
  }

  try {
    await AppState.inicializarSincronizacionStorage();
    actualizarIconoSorteo();
    actualizarBadgeCatedra();
    nodos.queueBadge.textContent = AppState.colaDescargas.length;

    // Primera vez: el tutorial va PRIMERO y solo. El estado del servidor dentro del
    // onboarding lo mantiene al día el daemon (iniciarDetectorEstado, ya arrancado);
    // la conexión + escaneo se difieren hasta cerrar el tour (onComplete), así el
    // loader no aparece detrás/antes del tutorial. Si ya se completó, arrancamos ya.
    if (!AppState.tutorialCompletado) {
      // El loader (.loader-overlay) tiene z-index MAYOR que el onboarding y arranca
      // en display:flex por CSS; hay que ocultarlo o taparía el tour.
      nodos.loader.style.display = 'none';
      mostrarOnboarding();
    } else {
      await conectarYArrancar();
    }
  } catch (error) {
    console.error("❌ Error en inicio del Orquestador:", error);
    nodos.txtEstado.textContent = "⚠️ Error de inicialización interna.";
    nodos.loader.style.display = 'none'; // el loader tapa el mensaje de error si queda visible
  }

  function lanzarSeleccionCarpetaFisica() {
    nodos.btnExplore.disabled = true;
    nodos.btnExplore.classList.add('loading');
    const originalBtnHTML = nodos.btnExplore.innerHTML;
    nodos.btnExplore.innerHTML = `<span class="spinner-inline"></span> Cargando...`;
    
    const rutaPrevia = RutaDisco.get();
    RutaDisco.cargando("Abriendo explorador...");

    // Mostrar loader de espera
    nodos.loaderTxt.textContent = "Abriendo explorador de archivos...";
    nodos.loader.style.display = 'flex';

    BunClient.seleccionarCarpeta().then(res => {
      if (res.success) {
        RutaDisco.mostrar(res.ruta);
        nodos.btnExplore.title = `Carpeta raíz actual: ${res.ruta} (Click para cambiar)`;
        AppState.sincronizacionDiscoCompletada = false;

        // Disparar auto-sincronización inmediatamente
        ejecutarPaso2SincronizarDiscoVeloz();
      } else {
        RutaDisco.mostrar(rutaPrevia.texto, rutaPrevia.titulo);
      }
    }).catch(err => {
      RutaDisco.mostrar(rutaPrevia.texto, rutaPrevia.titulo);
      console.error(err);
      if (err instanceof TypeError || err.message?.includes("fetch") || err.message?.includes("connect")) {
        activarEstadoOfflineUI();
      }
    }).finally(() => {
      // El estado .loading-text lo apagó RutaDisco.mostrar (cargando:false) en cada rama.
      nodos.btnExplore.disabled = false;
      nodos.btnExplore.classList.remove('loading');
      nodos.btnExplore.innerHTML = originalBtnHTML;
      nodos.loader.style.display = 'none';
    });
  }

  if (nodos.btnExplore) {
    nodos.btnExplore.addEventListener('click', () => {
      if (AppState.ocultarAdvertenciaExplorar) {
        lanzarSeleccionCarpetaFisica();
        return;
      }

      mostrarModalAdvertencia({
        titulo: "Selección de Carpeta 📂",
        cuerpo: "Por favor, seleccioná tu carpeta principal (ej: 'RamonNet').<br><br>El sistema creará y organizará automáticamente las subcarpetas por materia y cátedra dentro de ella.<br><br><strong>Nota:</strong> Evitá elegir directamente subcarpetas específicas de materias.",
        checkboxKey: "ocultarAdvExplorar",
        onConfirm: () => {
          lanzarSeleccionCarpetaFisica();
        }
      });
    });
  }

  let advertenciaAulaMostradaEsteFoco = false;
  if (nodos.folder) {
    nodos.folder.addEventListener('focus', () => {
      if (AppState.ocultarAdvertenciaAula || AppState.ráfagaEnCurso || advertenciaAulaMostradaEsteFoco) return;
      
      nodos.folder.blur();
      advertenciaAulaMostradaEsteFoco = true;

      mostrarModalAdvertencia({
        titulo: "Modificación de Subcarpeta 📚",
        cuerpo: "El descargador está diseñado para crear y gestionar las subcarpetas de materias automáticamente.<br><br>Podés modificar esta ruta si tenés una estructura personalizada, pero te aconsejamos dejar que el sistema opere con sus nombres por defecto para evitar inconsistencias.",
        checkboxKey: "ocultarAdvAula",
        onConfirm: () => {
          setTimeout(() => {
            nodos.folder.focus();
            advertenciaAulaMostradaEsteFoco = false;
          }, 150);
        },
        onCancel: () => {
          advertenciaAulaMostradaEsteFoco = false;
        }
      });
    });
  }

  function mostrarModalAdvertencia({ titulo, cuerpo, checkboxKey, onConfirm, onCancel }) {
    document.querySelector(".adv-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "adv-overlay";

    const card = document.createElement("div");
    card.className = "adv-card";

    card.innerHTML = `
      <h4>${titulo}</h4>
      <p>${cuerpo}</p>
    `;

    const labelCheckbox = document.createElement("label");
    labelCheckbox.className = "adv-checkbox-label";
    labelCheckbox.innerHTML = `
      <input type="checkbox" id="ui-adv-dontshow">
      <span>No volver a mostrar este aviso</span>
    `;
    card.appendChild(labelCheckbox);

    const buttons = document.createElement("div");
    buttons.className = "adv-buttons";

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "btn-adv-primary";
    btnConfirm.textContent = "Entendido";
    btnConfirm.addEventListener("click", () => {
      const checked = document.getElementById("ui-adv-dontshow").checked;
      if (checked) {
        if (checkboxKey === "ocultarAdvExplorar") {
          AppState.ocultarAdvertenciaExplorar = true;
        } else if (checkboxKey === "ocultarAdvAula") {
          AppState.ocultarAdvertenciaAula = true;
        }
        AppState.respaldar();
      }
      overlay.remove();
      if (onConfirm) onConfirm();
    });

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn-adv-secondary";
    btnCancel.textContent = "Cancelar";
    btnCancel.addEventListener("click", () => {
      overlay.remove();
      if (onCancel) onCancel();
    });

    buttons.append(btnConfirm, btnCancel);
    card.appendChild(buttons);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }

  // cargarRutaServidorSilencioso, activarEstadoOfflineUI e iniciarMonitoreoServidor
  // viven ahora en popup/features/serverConnection.js, instanciados más arriba como
  // _serverConnection. Los dos últimos se exponen como alias locales.

  let timerSincronizacionDebounce = null;
  nodos.folder.addEventListener('input', () => {
    const modoActual = nodos.btnAction.getAttribute('data-modo');
    if (modoActual === 're-escanear') return; 

    const nuevaRuta = nodos.folder.value.trim();
    
    // Actualizar la carpeta de destino en todas las clases no encoladas en caliente (KeyUp)
    AppState.listadoClasesGlobal.forEach(c => {
      if (c.estado !== 'process') {
        c.carpeta = nuevaRuta;
      }
    });
    
    AppState.respaldar();
    renderizarListadoInterfaz();
    
    // Debounce de la sincronización de archivos físicos con Bun (400ms)
    clearTimeout(timerSincronizacionDebounce);
    timerSincronizacionDebounce = setTimeout(() => {
      AppState.sincronizacionDiscoCompletada = false;
      ejecutarPaso2SincronizarDiscoVeloz();
    }, 400);
  });

  nodos.tabDisp.addEventListener('click', () => conmutarPestañaA("disponibles", 'block', 'none', 'flex'));
  nodos.tabCola.addEventListener('click', () => {
    conmutarPestañaA("cola", 'none', 'block', 'none');
    nodos.btnStartQueue.disabled = (AppState.colaDescargas.length === 0);
  });

  function conmutarPestañaA(id, actDisp, qDisp, filtDisp) {
    AppState.pestañaActiva = id;
    nodos.tabDisp.classList.toggle('active', id === "disponibles");
    nodos.tabCola.classList.toggle('active', id === "cola");
    nodos.filtersBar.style.display = 'flex';
    nodos.btnStartQueue.style.display = AppState.ráfagaEnCurso ? 'none' : qDisp;
    
    // Limpiar filtros activos y cerrar el menú
    filtrosActivos.estados.clear();
    filtrosActivos.materias.clear();
    filtrosActivos.catedras.clear();
    actualizarPillsUIState();
    if (nodos.filterMenu) nodos.filterMenu.style.display = 'none';
    if (nodos.btnFilterPills) nodos.btnFilterPills.classList.remove('open');

    const selectWrapper = document.getElementById('ui-master-select-wrapper');
    if (id === "disponibles") {
      if (nodos.btnToggleSelect) nodos.btnToggleSelect.style.display = 'none';
      if (selectWrapper) selectWrapper.style.display = 'flex';
      modoSeleccionFilaActivo = false;
    } else {
      if (nodos.btnToggleSelect) {
        nodos.btnToggleSelect.style.display = 'flex';
        nodos.btnToggleSelect.textContent = "Seleccionar";
        nodos.btnToggleSelect.title = "Activar selección múltiple";
      }
      if (selectWrapper) selectWrapper.style.display = 'none';
      modoSeleccionFilaActivo = false;
    }
    
    actualizarContadoresBoton();
    aplicarFiltrosCruzados();
  }

  function ejecutarPaso1EscaneoRamonAutomatico() {
    nodos.loaderTxt.textContent = "Escaneando entorno de Ramón Net...";
    nodos.loader.style.display = 'flex';
    // Ocultar badge de cátedra al iniciar un nuevo escaneo para evitar estados inconsistentes
    nodos.catedraBadge.style.display = "none";

    const safetyTimeout = setTimeout(() => {
      nodos.loader.style.display = 'none';
      nodos.txtEstado.textContent = "⚠️ Timeout de carga del DOM.";
      configurarBotonesUX("re-escanear", "Re-escanear aula virtual 🔄", false);
    }, 6000);

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab || !tab.url.includes("plataforma.ramonnet.com.ar")) {
        clearTimeout(safetyTimeout);
        nodos.txtEstado.textContent = "⚠️ No estás en Ramón Net.";
        configurarBotonesUX("re-escanear", "Re-escanear aula virtual 🔄", false);
        if (AppState.listadoClasesGlobal.length > 0) { desbanearFiltros(); aplicarFiltrosCruzados(); }
        nodos.loader.style.display = 'none'; 
        return;
      }

      // Preservar en memoria los elementos que están en la cola de descarga activa
      const itemsEnCola = AppState.listadoClasesGlobal.filter(c => c.estado === 'process');
      AppState.sincronizacionDiscoCompletada = false;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: Scraper.escanearAulaVirtual
      }, (resultados) => {
        clearTimeout(safetyTimeout);

        // Controlar de forma resiliente si ocurrió un error de inyección (ej: permisos de host o página de sistema)
        if (chrome.runtime.lastError) {
          console.error("❌ [POPUP-SCRIPT-ERROR] Falló inyección de script de escaneo:", chrome.runtime.lastError.message);
          nodos.txtEstado.textContent = `❌ Error de escaneo: ${chrome.runtime.lastError.message}`;
          nodos.loader.style.display = 'none';
          configurarBotonesUX("re-escanear", "Re-escanear aula virtual 🔄", false);
          
          // Cargar el listado anterior del storage para evitar dejar la interfaz vacía
          AppState.inicializarSincronizacionStorage().then(() => {
            if (AppState.listadoClasesGlobal.length > 0) {
              desbanearFiltros();
              aplicarFiltrosCruzados();
              actualizarBadgeCatedra();
            }
          });
          return;
        }

        const res = resultados?.[0];
        try {
          const resultado = res?.result || { materia: "biologia", enlaces: [] };
          const enlaces = resultado.enlaces;
          
          nodos.folder.value = resultado.materia || "biologia";

          if (!enlaces || enlaces.length === 0) {
            AppState.listadoClasesGlobal = itemsEnCola;
            AppState.respaldar();
            nodos.search.disabled = true;
            nodos.btnFilterPills.disabled = true;
            nodos.masterCheck.disabled = true;
            
            Renderers.renderizarTarjetaEstado(nodos.lista, {
              tipo: 'info',
              titulo: 'Sin clases detectadas',
              descripcion: 'No encontramos enlaces de video en esta pestaña.<br>Asegurate de estar dentro de una clase de Ramón Net y hacé click en Re-escanear.',
              icono: '🔍'
            });
            
            configurarBotonesUX("re-escanear", "Re-escanear aula virtual 🔄", false);
          } else {
            const nuevasClases = enlaces.map((item, idx) => {
              const materiaBase = nodos.folder.value.trim();
              const tituloFinalEstandar = Utils.formatTitleStructured(item.texto, materiaBase);
              const clasif = Utils.clasificarCatedraYCarpeta(item.texto, materiaBase);

              return {
                id: idx + Date.now(), // ID único dinámico para evitar colisiones con clases persistidas
                numeroOriginal: idx + 1,
                titulo: tituloFinalEstandar,
                urlInterna: item.href,
                catedra: clasif.catedra,
                carpeta: clasif.carpeta,
                estado: 'pending',
                seleccionado: false,
                visible: true
              };
            });

            // Combinar evitando duplicar elementos que ya están en la cola
            const titulosEnCola = new Set(itemsEnCola.map(c => c.titulo));
            const clasesNuevasFiltradas = nuevasClases.filter(c => !titulosEnCola.has(c.titulo));

            AppState.listadoClasesGlobal = [...itemsEnCola, ...clasesNuevasFiltradas];
            AppState.sincronizacionDiscoCompletada = false;
            AppState.respaldar();
            desbanearFiltros(); 
            nodos.masterCheck.checked = false;
            renderizarListadoInterfaz();
            // Mostrar asistente de autoselección si es multicátedra
            verificarYMostrarAsistenteMulticatedra();
            // Auto-sincronizar inmediatamente
            ejecutarPaso2SincronizarDiscoVeloz();
          }
        } catch (e) {
          console.error("❌ Error procesando payload de inyección:", e);
          configurarBotonesUX("re-escanear", "Re-escanear aula virtual 🔄", false);
        } finally {
          nodos.loader.style.display = 'none';
        }
      });
    });
  }

  // [REFACTORIZADO V5.4.1]: Motor de Sincronización Unificado e Híbrido (0% improvisación)
  async function ejecutarPaso2SincronizarDiscoVeloz() {
    configurarBotonesUX("sincronizar-disco", "", true);
    nodos.btnAction.innerHTML = `<span class="spinner-inline"></span> Sincronizando disco local...`;
    nodos.lista.style.opacity = '0.5';

    const subcarpetaFiltro = nodos.folder.value.trim().toLowerCase();

    AppState.listadoClasesGlobal.forEach(clase => {
      if (clase.estado !== 'process') {
        clase.estado = 'pending';
        let debeSeleccionar = true;
        if (AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS") {
          if (clase.catedra !== AppState.catedraSeleccionada && clase.catedra !== "COMUN") {
            debeSeleccionar = false;
          }
        }
        clase.seleccionado = debeSeleccionar;
      }
    });

    // Inyectores lógicos del resolvedor final de nombres
    const resolverMapeoEnUI = (nombresEnDisco) => {
      try {
        const setArchivosNormalizados = new Set(
          nombresEnDisco.map(nom => nom.toLowerCase().trim())
        );

        AppState.listadoClasesGlobal.forEach(clase => {
          if (clase.estado === 'process') return; 

          const tituloNormalizado = clase.titulo.toLowerCase().trim();
          let yaExiste = setArchivosNormalizados.has(tituloNormalizado);

          if (!yaExiste) {
            for (const nom of setArchivosNormalizados) {
              if (nom.includes(tituloNormalizado)) {
                yaExiste = true;
                break;
              }
            }
          }

          clase.estado = yaExiste ? 'downloaded' : 'pending';
          
          let debeSeleccionar = !yaExiste;
          if (AppState.catedraSeleccionada && AppState.catedraSeleccionada !== "TODAS") {
            if (clase.catedra !== AppState.catedraSeleccionada && clase.catedra !== "COMUN") {
              debeSeleccionar = false;
            }
          }
          clase.seleccionado = debeSeleccionar; 
        });

        AppState.sincronizacionDiscoCompletada = true;
        desbanearFiltros();
        AppState.respaldar(); 
        
        nodos.queueBadge.textContent = AppState.listadoClasesGlobal.filter(c => c.estado === 'process').length;
        nodos.masterCheck.checked = AppState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending').every(i => i.seleccionado);

        configurarBotonesUX("descargar", "Agregar seleccionados a la cola 📥", false);
        aplicarFiltrosCruzados();
        actualizarContadoresBoton();
      } catch (err) {
        console.error("❌ Error en empaquetado de sincronización:", err);
      } finally {
        nodos.lista.style.opacity = '1';
      }
    };

    // ─── PIPELINE DE LECTURA DE DATOS (MULTIPLE O BUN SERVER DIRECTO) ────────
    const carpetasUnicas = Array.from(new Set(AppState.listadoClasesGlobal.map(c => c.carpeta || subcarpetaFiltro)));
    if (carpetasUnicas.length === 0) {
      carpetasUnicas.push(subcarpetaFiltro);
    }

    try {
      let todosLosArchivos = [];
      const promesas = carpetasUnicas.map(carp => 
        BunClient.escanearDisco(carp)
          .then(data => data?.archivos || [])
          .catch(e => {
            if (e instanceof TypeError || e.message?.includes("fetch") || e.message?.includes("connect")) {
              throw e;
            }
            console.warn(`⚠️ No se pudo escanear la carpeta ${carp}:`, e.message);
            return [];
          })
      );
      const resultados = await Promise.all(promesas);
      todosLosArchivos = resultados.flat();

      // (el puntito de estado lo maneja la isla Preact features/conexionHeader.preact.js)
      const tabsBar = document.querySelector(".tabs-bar");
      if (tabsBar) tabsBar.style.display = "flex";
      
      resolverMapeoEnUI(todosLosArchivos);
    } catch (errFetch) {
      console.error("❌ [UI-ERROR] Imposible conectar con el escáner de Bun:", errFetch.message);
      activarEstadoOfflineUI();
    }
  }

  nodos.btnSoftCancel.addEventListener('click', () => _queue.solicitarFrenadoSuave());
  nodos.btnHardCancel.addEventListener('click', () => _queue.abortarRafagaInmediata());

  nodos.btnAction.addEventListener('click', () => {
    const modo = nodos.btnAction.getAttribute('data-modo');
    if (modo === 're-escanear') {
      ejecutarPaso1EscaneoRamonAutomatico();
    } else if (modo === 'sincronizar-disco') {
      ejecutarPaso2SincronizarDiscoVeloz();
    } else if (modo === 'descargar') {
      const elegidos = AppState.listadoClasesGlobal.filter(c => c.seleccionado && c.estado === 'pending');
      if (elegidos.length > 0) encolarItemsEnCaliente(elegidos);
    } else if (modo === 'reintentar-cola') {
      ejecutarReintentoDeCola();
    } else if (modo === 'quitar-de-cola') {
      const seleccionados = AppState.colaDescargas.filter(c => c.seleccionado);
      if (seleccionados.length > 0) quitarItemsDeColaEnLote(seleccionados);
    }
  });

  async function verificarRedAntesDeDescargar() {
    if (!navigator.onLine) return false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout
    try {
      await fetch("https://plataforma.ramonnet.com.ar", { 
        method: "HEAD", 
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      clearTimeout(timeoutId);
      return false;
    }
  }

  nodos.btnStartQueue.addEventListener('click', async () => {
    const cola = AppState.colaDescargas;
    if (cola.length === 0) return;
    
    verificandoConexionBoton = true;
    actualizarContadoresBoton();

    const redDisponible = await verificarRedAntesDeDescargar();
    verificandoConexionBoton = false;

    if (!redDisponible) {
      actualizarContadoresBoton();
      mostrarAlertDeConexionCaida("internet", cola[0].titulo);
      return;
    }

    congelarUIPorDescargaActiva(cola[0].titulo, 0, null);
    chrome.runtime.sendMessage({ action: "iniciar_descarga_cola" });
  });


  nodos.search.addEventListener('input', aplicarFiltrosCruzados);
  nodos.masterCheck.addEventListener('change', (e) => {
    const check = e.target.checked;

    if (AppState.pestañaActiva === "cola") {
      const busqueda = nodos.search.value.toLowerCase().trim();
      
      const visibles = AppState.colaDescargas.filter(clase => {
        const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
        const esActivo = AppState.videoActualEnTransmisiónSW === clase.titulo && AppState.ráfagaEnCurso;
        
        const clasif = Utils.clasificarCatedraYCarpeta(clase.titulo, clase.carpeta);
        const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
        const coincideCatedra = filtrosActivos.catedras.size === 0 || filtrosActivos.catedras.has(clasif.catedra);

        return coincideTexto && coincideMateria && coincideCatedra && !esActivo;
      });

      visibles.forEach(c => {
        c.seleccionado = check;
        const chk = document.getElementById(`chk-cola-${c.id}`);
        if (chk) {
          chk.checked = check;
          const row = chk.closest('.video-item');
          if (row) row.classList.toggle('selected', check);
        }
      });
    } else {
      if (!AppState.sincronizacionDiscoCompletada) return; 
      const visibles = AppState.listadoClasesGlobal.filter(c => c.visible);
      AppState.conmutarSeleccionMasiva(check, visibles);
      
      visibles.forEach(c => {
        const chk = document.getElementById(`chk-${c.id}`);
        if (chk) {
          chk.checked = check;
          const row = chk.closest('.video-item');
          if (row) row.classList.toggle('selected', check);
        }
      });
    }

    AppState.respaldar();
    actualizarContadoresBoton();
  });

  function aplicarFiltrosCruzados() {
    const busqueda = nodos.search.value.toLowerCase().trim();
    const materiaActiva = nodos.folder.value.trim().toLowerCase();

    // Recalcular siempre la visibilidad del listado global de disponibles
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

    renderizarListadoInterfaz();
    actualizarContadoresBoton();
  }

  function renderizarListadoInterfaz() {
    nodos.lista.innerHTML = "";
    
    if (AppState.fallaConexionActiva) {
      // El título proviene del scraping del DOM de Ramón Net (contenido de terceros):
      // se escapa antes de interpolarlo porque renderizarTarjetaEstado usa innerHTML.
      const titulo = Utils.escaparHtml(AppState.videoFalladoParaReintento || "clase");
      if (AppState.fallaConexionActiva === "servidor") {
        Renderers.renderizarTarjetaEstado(nodos.lista, {
          tipo: 'error',
          titulo: 'Servidor Desconectado',
          descripcion: `El servidor local de Bun se desconectó.<br>Por favor, ejecutá <strong>iniciar.bat</strong> para reanudar.<br><br><strong>Pausado en:</strong> ${titulo}`,
          icono: '🔌'
        });
      } else {
        Renderers.renderizarTarjetaEstado(nodos.lista, {
          tipo: 'error',
          titulo: 'Conexión a Internet Caída',
          descripcion: `Se interrumpió la conexión a internet.<br>La descarga se reanudará automáticamente apenas vuelva la red.<br><br><strong>Pausado en:</strong> ${titulo}`,
          icono: '⚠️'
        });
      }
      return;
    }
    
    // Sincronizar el estado de disponibles con los elementos en la cola real
    const titulosEnCola = new Set(AppState.colaDescargas.map(c => c.titulo));
    AppState.listadoClasesGlobal.forEach(c => {
      if (titulosEnCola.has(c.titulo)) {
        c.estado = 'process';
      } else if (c.estado === 'process') {
        c.estado = 'pending'; // Regresar a pendiente si ya no está en la cola real
      }
    });

    let filtrados = [];
    if (AppState.pestañaActiva === "cola") {
      const busqueda = nodos.search.value.toLowerCase().trim();
      
      filtrados = AppState.colaDescargas.filter(clase => {
        const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
        
        const clasif = Utils.clasificarCatedraYCarpeta(clase.titulo, clase.carpeta);
        const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
        const coincideCatedra = filtrosActivos.catedras.size === 0 || filtrosActivos.catedras.has(clasif.catedra);

        return coincideTexto && coincideMateria && coincideCatedra;
      });

      if (AppState.ordenAscendente !== null) {
        filtrados.sort((a, b) => {
          const comp = a.titulo.localeCompare(b.titulo, undefined, { numeric: true, sensitivity: 'base' });
          return AppState.ordenAscendente ? comp : -comp;
        });
      } else {
        filtrados.sort((a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0));
      }
    } else {
      filtrados = AppState.listadoClasesGlobal.filter(c => c.visible);
      
      // Ordenar por título (semana) de forma ascendente o descendente (orden natural tipo Windows)
      filtrados.sort((a, b) => {
        const comp = a.titulo.localeCompare(b.titulo, undefined, { numeric: true, sensitivity: 'base' });
        return AppState.ordenAscendente ? comp : -comp;
      });
    }

    if (filtrados.length === 0) {
      if (AppState.pestañaActiva === "cola") {
        Renderers.renderizarTarjetaEstado(nodos.lista, {
          tipo: 'info',
          titulo: 'Fila de descarga vacía',
          descripcion: 'No tenés clases agregadas en esta lista.<br>Volvé a "Clases Disponibles", marcá las clases y agregalas.',
          icono: '📥'
        });
      } else {
        Renderers.renderizarTarjetaEstado(nodos.lista, {
          tipo: 'info',
          titulo: 'No hay clases',
          descripcion: 'No se encontraron clases que coincidan con la búsqueda o el filtro seleccionado.',
          icono: '🔍'
        });
      }
      return;
    }

    filtrados.forEach(clase => {
      const fila = Renderers.construirFilaClaseDOM(clase, {
        pestaña: AppState.pestañaActiva,
        sincronizado: AppState.sincronizacionDiscoCompletada,
        enCurso: AppState.ráfagaEnCurso,
        videoActivo: AppState.videoActualEnTransmisiónSW,
        onCheckChange: (c, check, div) => {
          c.seleccionado = check;
          div.classList.toggle('selected', check);
          
          if (AppState.pestañaActiva === "cola") {
            const busqueda = nodos.search.value.toLowerCase().trim();
            const visibles = AppState.colaDescargas.filter(i => i.titulo.toLowerCase().includes(busqueda));
            nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
          } else {
            if (!AppState.sincronizacionDiscoCompletada) return;
            nodos.masterCheck.checked = AppState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending').every(i => i.seleccionado);
          }
          
          actualizarContadoresBoton();
          AppState.respaldar();
        },
        onRemoverClick: (c, div) => {
          console.log(`🗑️ [UI] Intento de remoción de la fila: "${c.titulo}"`);
          
          const esActivo = AppState.videoActualEnTransmisiónSW === c.titulo;
          const esUltimoConRafaga = AppState.ráfagaEnCurso && AppState.colaDescargas.length <= 1;

          // Determinar si la selección maestro "Todos" estaba activa para heredarla
          const visiblesPendientes = AppState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
          const seleccionMaestraActiva = visiblesPendientes.length > 0 && visiblesPendientes.every(i => i.seleccionado);

          if (esActivo || esUltimoConRafaga) {
            chrome.runtime.sendMessage({ action: "abortar_rafaga_inmediata" }, () => {
              // Remover de la cola local para persistencia correcta
              AppState.colaDescargas = AppState.colaDescargas.filter(i => i.titulo !== c.titulo);
              c.estado = 'pending';
              c.seleccionado = seleccionMaestraActiva;

              // Actualizar disponibles
              const matchDisp = AppState.listadoClasesGlobal.find(i => i.titulo === c.titulo);
              if (matchDisp) {
                matchDisp.estado = 'pending';
                matchDisp.seleccionado = seleccionMaestraActiva;
              }

              div.remove();
              nodos.queueBadge.textContent = AppState.colaDescargas.length;
              AppState.respaldar();
              restaurarPanelPorInterrupcion("🛑 Descargas detenidas porque se eliminó la clase de la fila.");
            });
            return;
          }

          // Remover de la cola local
          AppState.colaDescargas = AppState.colaDescargas.filter(i => i.titulo !== c.titulo);
          div.remove();
          
          // Actualizar estado en disponibles
          const matchDisp = AppState.listadoClasesGlobal.find(i => i.titulo === c.titulo);
          if (matchDisp) {
            matchDisp.estado = 'pending';
            matchDisp.seleccionado = seleccionMaestraActiva;
          }
          
          nodos.queueBadge.textContent = AppState.colaDescargas.length;
          AppState.respaldar();

          chrome.runtime.sendMessage({ 
            action: "remover_item_de_cola", 
            titulo: c.titulo
          }, () => {
            setTimeout(aplicarFiltrosCruzados, 100);
          });
        },
      });
      
      if (!AppState.sincronizacionDiscoCompletada && AppState.pestañaActiva === "disponibles") {
        const inputCheck = fila.querySelector('input[type="checkbox"]');
        if (inputCheck) inputCheck.disabled = true;
        fila.style.opacity = "0.65";
      }

      nodos.lista.appendChild(fila);
    });
  }

  function congelarUIPorDescargaActiva(titulo, pct, tel) {
    AppState.videoActualEnTransmisiónSW = titulo;
    AppState.ráfagaEnCurso = true;
    document.body.classList.add('downloading');
    
    nodos.txtEstado.innerHTML = "";
    const span = document.createElement('span');
    span.style.color = "var(--accent-orange)";
    span.textContent = titulo;
    
    const prefijo = AppState.banderaFrenadoSolicitado ? "Frenando al terminar:" : "Descargando:";
    nodos.txtEstado.append(prefijo, document.createElement('br'), span);

    nodos.btnStartQueue.style.display = 'none';
    nodos.cancelBox.style.display = 'flex';
    nodos.folder.disabled = false;
    nodos.btnExplore.disabled = true;
    if (nodos.turboSwitch) nodos.turboSwitch.disabled = true; 
    
    nodos.btnSoftCancel.disabled = AppState.banderaFrenadoSolicitado;
    
    nodos.progressBar.style.width = `${pct}%`;
    nodos.progressCont.style.display = 'block';
    if (tel) Renderers.pintarTelemetria(tel, nodos);
    renderizarListadoInterfaz();
    conectarEscuchadoresDelWorker();
    
    actualizarContadoresBoton();
  }

  function conectarEscuchadoresDelWorker() {
    if (punteroOyenteRuntimeActivo) {
      chrome.runtime.onMessage.removeListener(punteroOyenteRuntimeActivo);
      punteroOyenteRuntimeActivo = null;
    }
    
    chrome.runtime.onMessage.addListener(punteroOyenteRuntimeActivo = (req) => {
      if (req.action === "update_progress_bar") {
        let debeReRenderizar = false;
        if (AppState.fallaConexionActiva) {
          AppState.fallaConexionActiva = null;
          AppState.videoFalladoParaReintento = null;
          
          nodos.cancelBox.style.display = 'flex';
          nodos.btnStartQueue.style.display = 'none';
          nodos.progressCont.style.display = 'block';
          if (req.telemetry) nodos.panelTel.style.display = 'flex';
          
          debeReRenderizar = true;
        }

        nodos.progressBar.style.width = `${req.percentage}%`;
        
        if (req.compiling && !AppState.modoTurboBun) {
          nodos.txtEstado.innerHTML = "";
          const spanComp = document.createElement('span');
          spanComp.style.color = "#ffc107";
          spanComp.textContent = `Guardando en /${nodos.folder.value}/ por favor espere...`;
          nodos.txtEstado.append("⚙️ Compilando archivo final...", document.createElement('br'), spanComp);
        } else if (!req.compiling) {
          if (AppState.videoActualEnTransmisiónSW !== req.titulo || debeReRenderizar) {
            AppState.videoActualEnTransmisiónSW = req.titulo;
            renderizarListadoInterfaz();
            actualizarContadoresBoton();
          }
          nodos.txtEstado.innerHTML = "";
          const spanDesc = document.createElement('span');
          spanDesc.style.color = "var(--accent-orange)";
          spanDesc.textContent = req.titulo;
          
          const prefijo = AppState.banderaFrenadoSolicitado ? "Frenando al terminar:" : "Descargando:";
          nodos.txtEstado.append(prefijo, document.createElement('br'), spanDesc);
          
          nodos.btnSoftCancel.disabled = AppState.banderaFrenadoSolicitado;
          
          if (req.telemetry) Renderers.pintarTelemetria(req.telemetry, nodos);
        }
      }
      if (req.action === "clase_guardada_ok") {
        const obj = AppState.listadoClasesGlobal.find(c => c.titulo === req.titulo);
        if (obj) { obj.estado = 'downloaded'; obj.seleccionado = false; }
        
        // También remover de la cola local
        AppState.colaDescargas = AppState.colaDescargas.filter(c => c.titulo !== req.titulo);
        AppState.respaldar();
        
        nodos.queueBadge.textContent = AppState.colaDescargas.length;

        if (req.suaveFrenado) { restaurarPanelPorInterrupcion("🏁 Fila interrumpida de forma segura.", false); return; }
        aplicarFiltrosCruzados();
      }
      
      if (req.action === "clase_con_error") {
        console.error(`⚠️ [POPUP-ALERT] El Service Worker reportó un crash en: ${req.titulo}`);
        nodos.txtEstado.textContent = "";
        const spanErr = document.createElement('span');
        spanErr.className = "text-danger";
        spanErr.textContent = `Error de red en fragmentos. Saltando...`;
        nodos.txtEstado.append(`⚠️ `, spanErr);
        setTimeout(aplicarFiltrosCruzados, 500);
      }

      if (req.action === "cola_completamente_vacia") {
        if (req.suaveFrenado) {
          restaurarPanelPorInterrupcion("🏁 Fila interrumpida de forma segura.", false);
        } else {
          restaurarPanelPorInterrupcion("🏁 ¡Procesamiento terminado!", true);
        }
      }

      if (req.action === "cola_pausada_por_error") {
        mostrarAlertDeConexionCaida(req.errorType, req.titulo);
      }
    });
  }

  async function restaurarPanelPorInterrupcion(txt, limpiarCola = false) {
    document.body.classList.remove('downloading');
    if (punteroOyenteRuntimeActivo) {
      chrome.runtime.onMessage.removeListener(punteroOyenteRuntimeActivo);
      punteroOyenteRuntimeActivo = null; 
    }
    
    const mantenerModoTurbo = AppState.modoTurboBun;

    // Restablecer fallas de conexión al cancelar o interrumpir
    AppState.fallaConexionActiva = null;
    AppState.videoFalladoParaReintento = null;

    if (limpiarCola) {
      AppState.limpiarSesionLocal();
    } else {
      AppState.ráfagaEnCurso = false;
      AppState.videoActualEnTransmisiónSW = "";
      AppState.banderaFrenadoSolicitado = false;
      await AppState.inicializarSincronizacionStorage();
    }
    
    AppState.modoTurboBun = mantenerModoTurbo;
    AppState.respaldar();
    if (nodos.turboSwitch) {
      nodos.turboSwitch.disabled = false;
      nodos.turboSwitch.checked = mantenerModoTurbo;
    }

    nodos.progressCont.style.display = 'none';
    nodos.panelTel.style.display = 'none';
    nodos.cancelBox.style.display = 'none';
    nodos.folder.disabled = false;
    nodos.btnExplore.disabled = false;
    
    // Restablecer el botón de inicio de cola
    nodos.btnStartQueue.innerHTML = "Iniciar descarga masiva 🚀";
    
    const countRestantes = AppState.colaDescargas.length;
    nodos.queueBadge.textContent = countRestantes;
    
    if (!limpiarCola) {
      conmutarPestañaA(AppState.pestañaActiva, 
        AppState.pestañaActiva === "disponibles" ? 'block' : 'none', 
        AppState.pestañaActiva === "cola" ? 'block' : 'none', 
        AppState.pestañaActiva === "disponibles" ? 'flex' : 'none'
      );
      nodos.txtEstado.textContent = txt;
    } else {
      conmutarPestañaA("disponibles", 'block', 'none', 'flex');
      nodos.txtEstado.textContent = txt;
      ejecutarPaso1EscaneoRamonAutomatico();
    }

    // Actualizar botones de acción y restablecer filtros visuales
    actualizarContadoresBoton();
    setTimeout(aplicarFiltrosCruzados, 100);
  }

  function desbanearFiltros() {
    nodos.search.disabled = false;
    nodos.btnFilterPills.disabled = false;
    nodos.masterCheck.disabled = !AppState.sincronizacionDiscoCompletada;
    if (nodos.btnSort) nodos.btnSort.disabled = false;
  }

  function actualizarMasterCheckState() {
    if (AppState.pestañaActiva === "cola") {
      const busqueda = nodos.search.value.toLowerCase().trim();
      const visibles = AppState.colaDescargas.filter(clase => {
        const coincideTexto = clase.titulo.toLowerCase().includes(busqueda);
        const clasif = Utils.clasificarCatedraYCarpeta(clase.titulo, clase.carpeta);
        const coincideMateria = filtrosActivos.materias.size === 0 || filtrosActivos.materias.has(clase.carpeta.toUpperCase());
        const coincideCatedra = filtrosActivos.catedras.size === 0 || filtrosActivos.catedras.has(clasif.catedra);
        return coincideTexto && coincideMateria && coincideCatedra;
      });
      nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
    } else {
      const visibles = AppState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
      nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
    }
  }

  function actualizarModoSeleccion() {
    if (AppState.pestañaActiva === "disponibles") {
      nodos.lista.classList.add('selection-mode');
      return;
    }

    if (modoSeleccionFilaActivo) {
      nodos.lista.classList.add('selection-mode');
    } else {
      nodos.lista.classList.remove('selection-mode');
    }
  }

  function actualizarContadoresBoton() {
    actualizarMasterCheckState();
    actualizarModoSeleccion();

    if (AppState.fallaConexionActiva) {
      const txt = AppState.fallaConexionActiva === "internet" 
        ? "Reintentar conexión a internet 🔄" 
        : "Reintentar conexión con servidor 🔄";
      configurarBotonesUX("reintentar-cola", txt, reintentandoColaActivo);
      nodos.btnAction.style.display = 'block';
      nodos.btnStartQueue.style.display = 'none';
      nodos.masterCheck.disabled = true;
      return;
    }

    if (AppState.pestañaActiva !== "disponibles") {
      const seleccionadosEnCola = AppState.colaDescargas.filter(c => c.seleccionado).length;
      
      // Permitir habilitar masterCheck en la fila siempre
      nodos.masterCheck.disabled = false;

      if (seleccionadosEnCola > 0 && !AppState.ráfagaEnCurso) {
        configurarBotonesUX("quitar-de-cola", `Quitar ${seleccionadosEnCola} clases de la fila 🗑️`, false);
        nodos.btnAction.style.display = 'block';
        nodos.btnStartQueue.style.display = 'none';
      } else {
        nodos.btnAction.style.display = 'none';
        nodos.btnStartQueue.style.display = AppState.ráfagaEnCurso ? 'none' : 'block';
        
        if (verificandoConexionBoton) {
          nodos.btnStartQueue.disabled = true;
          nodos.btnStartQueue.innerHTML = `<span class="spinner-inline"></span> Verificando conexión...`;
        } else {
          nodos.btnStartQueue.disabled = (AppState.colaDescargas.length === 0);
          if (!AppState.ráfagaEnCurso) {
            nodos.btnStartQueue.innerHTML = "Iniciar descarga masiva 🚀";
          }
        }
      }
      return;
    }
    
    nodos.btnStartQueue.style.display = 'none';
    
    const modoActual = nodos.btnAction.getAttribute('data-modo');
    if (modoActual === 're-escanear') return; 

    if (!AppState.sincronizacionDiscoCompletada) {
      const isOffline = nodos.folder.disabled;
      configurarBotonesUX("sincronizar-disco", isOffline ? "Buscando servidor... ⏳" : "Sincronizar carpeta local 📂", isOffline);
      nodos.btnAction.style.display = 'block';
      nodos.masterCheck.disabled = true;
      return;
    }

    const sel = AppState.listadoClasesGlobal.filter(c => c.seleccionado && c.estado === 'pending').length;

    if (AppState.ráfagaEnCurso) {
      configurarBotonesUX("descargar", sel === 0 ? "Seleccioná clases" : `Agregar ${sel} clases a la fila 📥`, sel === 0);
      nodos.btnAction.style.display = 'block';
      nodos.masterCheck.disabled = false;
    } else {
      nodos.txtEstado.innerHTML = "";

      configurarBotonesUX("descargar", sel === 0 ? "Seleccioná clases" : `Agregar ${sel} clases a la fila 📥`, sel === 0);
      nodos.btnAction.style.display = 'block';
      nodos.masterCheck.disabled = false;
    }
  }

  function configurarBotonesUX(modo, txt, dis) {
    nodos.btnAction.setAttribute('data-modo', modo);
    nodos.btnAction.className = `btn-action modo-${modo}`;
    nodos.btnAction.textContent = txt;
    nodos.btnAction.disabled = dis;
  }

  function mostrarAlertDeConexionCaida(errorType, titulo) {
    AppState.fallaConexionActiva = errorType;
    AppState.videoFalladoParaReintento = titulo;
    AppState.videoActualEnTransmisiónSW = titulo;
    
    nodos.cancelBox.style.display = 'none';
    nodos.btnStartQueue.style.display = 'none';
    nodos.progressCont.style.display = 'none';
    nodos.panelTel.style.display = 'none';
    
    conectarEscuchadoresDelWorker();
    
    // Simplemente volver a renderizar y actualizar el botón en la pestaña activa sin redirigir
    renderizarListadoInterfaz();
    actualizarContadoresBoton();
    
    // Iniciar monitoreo para esperar la reconexión activa
    iniciarMonitoreoServidor();
  }

  function actualizarIconoSorteo() {
    if (!nodos.btnSort) return;
    if (AppState.pestañaActiva === "cola" && AppState.ordenAscendente === null) {
      nodos.btnSort.innerHTML = "Fila";
      nodos.btnSort.title = "Orden: De llegada original (FIFO)";
    } else {
      nodos.btnSort.innerHTML = AppState.ordenAscendente ? "Sem. ↑" : "Sem. ↓";
      nodos.btnSort.title = AppState.ordenAscendente ? "Orden: Semanas más viejas primero (Ascendente)" : "Orden: Semanas más nuevas primero (Descendente)";
    }
  }

  function actualizarBadgeCatedra() {
    const catedrasDetectadas = Array.from(new Set(
      AppState.listadoClasesGlobal
        .map(c => c.catedra)
        .filter(cat => cat !== "COMUN")
    ));
    const tieneMultiCatedras = catedrasDetectadas.length > 1;

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
    aplicarFiltrosCruzados();
  }

  function verificarYMostrarAsistenteMulticatedra() {
    const catedrasDetectadas = Array.from(new Set(
      AppState.listadoClasesGlobal
        .map(c => c.catedra)
        .filter(cat => cat !== "COMUN")
    ));

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

  async function ejecutarReintentoDeCola() {
    reintentandoColaActivo = true;
    actualizarContadoresBoton();
    nodos.txtEstado.textContent = "⏳ Verificando conexión...";
    
    const redDisponible = await verificarRedAntesDeDescargar();
    reintentandoColaActivo = false;

    if (!redDisponible) {
      const primerItem = AppState.colaDescargas[0];
      const tituloFallado = primerItem ? primerItem.titulo : (AppState.videoFalladoParaReintento || "clase");
      mostrarAlertDeConexionCaida("internet", tituloFallado);
      return;
    }

    AppState.fallaConexionActiva = null;
    AppState.videoFalladoParaReintento = null;

    // Restaurar la UI de descarga (quitar el banner) YA, al reanudar. No alcanza con
    // esperar al primer update_progress_bar: como acá dejamos fallaConexionActiva en
    // null, ese handler ya no entra a su rama de limpieza (está gateada a que la falla
    // siga activa), y su re-render está gateado a que cambie el título — que no cambia
    // porque se reanuda el MISMO video. Sin esto, el banner quedaba hasta refrescar.
    nodos.cancelBox.style.display = 'flex';
    nodos.btnStartQueue.style.display = 'none';
    nodos.progressCont.style.display = 'block';
    renderizarListadoInterfaz();
    actualizarContadoresBoton();

    nodos.txtEstado.textContent = "⏳ Conectando y reanudando fila...";
    chrome.runtime.sendMessage({ action: "iniciar_descarga_cola" });
  }

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

  function actualizarPillsUIState() {
    if (!nodos.btnFilterPills) return;
    const total = filtrosActivos.estados.size + filtrosActivos.materias.size + filtrosActivos.catedras.size;
    nodos.btnFilterPills.classList.toggle('active', total > 0);
    const span = nodos.btnFilterPills.querySelector('span');
    if (span) {
      span.textContent = total > 0 ? `Filtros (${total})` : "Filtros";
    }
  }

  // El onboarding (overlay, carrusel, botón de ayuda y "Seleccionar Carpeta" del tour)
  // vive ahora en la isla Preact features/onboarding.preact.js, cableada más arriba
  // como _onboardingFeature (window.OnboardingFeature.crear).
});