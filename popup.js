/**
 * CLON DOWNLOADHELPER - ORQUESTADOR DE INTERFAZ GENERAL (V5.21.0)
 * ARCHIVO COMPLETO — LECTURA DE DISCO UNIFICADA HÍBRIDA (CHROME SEARCH / BUN LÓGICO)
 * ==========================================================================
 * CHANGELOG v5.21.0:
 * - [LOADERS — ítem 1] El watchdog del escaneo dejó de saltar SIEMPRE en Anatomy. Eran 6000 ms
 *   fijos contra ~11 s reales de ese portal, así que en cada escaneo escribía "⚠️ Timeout de
 *   carga del DOM" —vocabulario de la era del scraper, que ese portal ya no usa— y ~5 s después
 *   el resultado real le pintaba encima. Un error que se borra solo enseña a ignorar los
 *   errores. Cuatro partes:
 *   (a) el tope sale del descriptor (`PuertoSitio.topeEscaneoMs`, requerido; 6 s Ramón Net,
 *       30 s Anatomy) y el watchdog se arma DESPUÉS de resolver el portal, porque antes el
 *       portal no se sabe — la misma trampa que el cartel de `ejecutarPaso1...`;
 *   (b) abandono explícito por generación: al vencerse, el watchdog invalida la corrida y el
 *       callback tardío se descarta en vez de pintar;
 *   (c) guarda de reentrada: el botón volvía a "Re-escanear 🔄" durante la ventana y un click
 *       lanzaba un segundo escaneo concurrente sobre el primero;
 *   (d) el mensaje va a la TARJETA de la lista, no al footer, donde convivía con el
 *       diagnóstico de conexión —que tiene otro dueño— y quedaba pisado.
 *   Estado del ítem → docs/TECHNICAL_DEBT.md; detalle → docs/alertas-y-bloqueo-diseno.md §6.1.
 *
 * CHANGELOG v5.20.0:
 * - [BANNER OCUPA LISTA + TOOLBAR] Con la cola pausada, la card de error ocupaba #ui-list
 *   pero la barra de filtros seguía viva ENCIMA de ella: buscador, filtros, orden y "Todos"
 *   habilitados, operando sobre una lista que no estaba en pantalla. Ahora
 *   `mostrarAlertDeConexionCaida` la oculta, y `conmutarPestañaA` dejó de re-mostrarla
 *   incondicionalmente — que era el agujero por el que volvía al cambiar de pestaña. Las
 *   PESTAÑAS no se ocultan: la cola tiene que seguir siendo consultable mientras está pausada.
 * - [BANNER DUEÑO DEL DIAGNÓSTICO] El botón dejó de reescribir lo que dice la card. Los cuatro
 *   textos de `actualizarContadoresBoton` ("Reintentar conexión con servidor", "Iniciar sesión
 *   y reintentar", …) pasaron a uno solo, "Reintentar 🔄": el diagnóstico y el qué-hacer viven
 *   en la card, el botón sólo ofrece la acción.
 * - [ALERTA EN EL CONTENEDOR] La alerta de conexión dejó de vivir en un root hermano: la pinta
 *   la isla de #ui-list, que ahora es dueña única de esa región. Se ve una sola cosa a la vez.
 * - [BLOQUEAR, NO ESCONDER] La toolbar no desaparece: va `.bloqueada` (atenuada +
 *   `pointer-events: none`). Esconderla movía todo de lugar en cada caída y en cada reconexión
 *   del auto-heal, que pasa seguido. Las PESTAÑAS quedan operativas —con el servidor caído
 *   sigue siendo legítimo mirar la cola— y el progreso, si hay una descarga, se queda en
 *   pantalla bloqueado en vez de desaparecer.
 * - [ALERTA ⇒ NINGUNA ACCIÓN] `actualizarContadoresBoton` mira la alerta ANTES que la pestaña.
 *   Sin eso el footer lo decidía la pestaña: con el servidor caído, pasar a Fila mostraba
 *   "Iniciar descarga masiva 🚀" y volver a Clases mostraba "Seleccioná clases". La función
 *   conocía la cola pausada (`fallaConexionActiva`) y no la otra alerta, que es un estado
 *   distinto y más grave. Los dos botones se apagan juntos, porque `btnStartQueue` lo enciende
 *   `conmutarPestañaA` sin consultar nada.
 * - [EL BOTÓN, SEGÚN HAYA ALGO QUE HACER] Sin label no se muestra, y `configurarBotonesUX` es
 *   quien lo decide. Con la alerta de conexión no hay ninguna acción (la reconexión es
 *   automática) → se va; con la cola pausada sí la hay → "Reintentar 🔄". La regla que queda:
 *   **el botón dice lo que hace, la alerta dice qué pasa**.
 * - [FIX de arrastre] `.path-bar.offline` sumó `pointer-events: none`. Sólo tenía `opacity`, y
 *   el badge de la faceta es un `<span>` —no admite `disabled`—, así que se veía apagado y
 *   seguía abriendo el modal de cátedra sobre una UI muerta.
 * - NOTA de versiones: la 5.19.0 (corte 1 del copy genérico) NO se salteó — está acá abajo.
 *   Las dos ramas se mergearon juntas en `integracion-alertas` el 2026-08-12, así que los dos
 *   changelogs conviven en orden. El conflicto fue de cabecera, no de lógica.
 * ==========================================================================
 * CHANGELOG v5.19.0:
 * - [COPY GENÉRICA — corte 1] Esta UI dejó de hablar el vocabulario de Ramón Net, que
 *   con dos portales era falso la mitad de las veces: "Analizando aula virtual…" (:573),
 *   los cinco "Re-escanear aula virtual 🔄", el ejemplo de carpeta "'RamonNet'" (:671) y
 *   el cartel de escaneo (:857) quedaron genéricos. Los dos console.log de la pestaña
 *   fueron de arrastre. Inventario y regla de decisión → docs/copy-generico-diseno.md.
 * - [OJO con el cartel de :857] Es genérico A PROPÓSITO, no por falta de ganas: ahí
 *   `sitioActivo` todavía es el portal anterior. El comentario en el sitio lo explica.
 * - [NO entró] La instrucción de escaneo del onboarding (necesita un miembro nuevo en
 *   PuertoSitio) ni el rename de los identificadores internos. Cortes 2 y 3 del doc.
 *
 * CHANGELOG v5.18.0:
 * - [FIX — el cartel mentiroso] Dos tarjetas nuevas para los tipos de pausa que agregó
 *   `core/cola/procesadorCola.ts` ("bloqueo" y "desconocido") y su texto de botón. Sin esto
 *   los dos caían en el `else` y se pintaban como "Conexión a Internet Caída", que es
 *   justamente la mentira que el fix del bucle salió a corregir.
 * - [FIX] La tarjeta de "Sesión no iniciada" dejó de decir **Ramón Net** hardcodeado. Con dos
 *   portales eso es falso la mitad de las veces, y el portal que pausó sale del ÍTEM (ADR-0010),
 *   no de la pestaña abierta — así que la copy genérica es la única que nunca miente. El nombre
 *   correcto sí viaja en la notificación del SO y en la campanita, que lo reciben del bucle.
 *
 * CHANGELOG v5.17.0:
 * - [FASE 5C] Todo el IPC de este archivo pasa al PuertoMensajeria (global Mensajeria,
 *   publicado por plataforma/composicion.ts): los dos sendMessage y el par
 *   addListener/removeListener del oyente del worker. Ese oyente ya no se guarda por
 *   REFERENCIA para poder removerlo: el puerto devuelve la función de baja, así que
 *   punteroOyenteRuntimeActivo pasa a ser desengancharOyenteWorker y desengancharlo es
 *   llamarla. Los dos envíos van con .finally() y no .then(): sus callbacks hacían limpieza
 *   local que Chrome ejecutaba igual ante lastError, y perderla dejaría clases en 'process'
 *   fuera de la cola. Lo que queda de chrome.* acá es tabs + scripting (con sus propios
 *   lastError, que NO son IPC) y espera sus puertos. Ver docs/patterns.md §IPC.
 * CHANGELOG v5.16.0:
 * - [CAPA 2] Se saca de acá el vocabulario del sitio: CatedraFeature pasó a ser la
 *   FacetaFeature genérica (popup/features/faceta.js) y qué ES la faceta lo aporta
 *   sitio/ramonnet/config.js (SitioActivo), que se le inyecta por ctx igual que a
 *   FilterFeature. Los dos bloques que decidían la autoselección repitiendo
 *   'catedraSeleccionada !== "TODAS" && catedra !== "COMUN"' ahora llaman a
 *   perteneceASeleccionFaceta(clase). Renombres: actualizarBadgeCatedra →
 *   actualizarBadgeFaceta, verificarYMostrarAsistenteMulticatedra →
 *   verificarYMostrarAsistenteFaceta, filtrosActivos.catedras → .valoresFaceta.
 *   Sin cambio de comportamiento. Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * CHANGELOG v5.15.0:
 * - [FIX] El handler "clase_con_error" ahora vuelve la clase rechazada a 'pending' (antes
 *   'error'). El estado 'error' no lo reconocía el resto del popup: los filtros de
 *   selección/encolado piden 'pending' (no se podía re-encolar) y no hay CSS .badge.error
 *   (render roto). Ahora la clase se ve como una pendiente normal y es re-encolable; el
 *   fallo se comunica por la campanita + notificación. Espejo del SW en background.js
 *   v5.10.1. Ver docs/notificaciones-fallos-diseno.md.
 * CHANGELOG v5.14.0:
 * - [SPLIT] Extraída la lógica de cátedra/multicátedra a la feature
 *   popup/features/catedra.js (CatedraFeature.crear(ctx)): actualizarBadgeCatedra,
 *   aplicarSeleccionCatedraSilencioso, verificarYMostrarAsistenteMulticatedra, el modal
 *   (mostrarModalMulticatedra + aplicarSeleccionCatedra) y el listener del click en el
 *   badge. popup.js la recibe por ctx (nodos + aplicarFiltros) y expone como alias
 *   locales las 2 que sus call-sites llaman (actualizarBadgeCatedra en init/scraping,
 *   verificarYMostrarAsistenteMulticatedra en scraping) — sin cambiar call-sites. El
 *   cálculo de cátedras presentes (Array.from(new Set(...))), antes triplicado, se
 *   unificó en detectarCatedras() dentro de la feature. Sin cambio de comportamiento.
 *   Cierra la Fase 2 del split feature-driven (ADR-0005, ROADMAP). Ver docs/patterns.md.
 * CHANGELOG v5.13.0:
 * - [FIX bug 400] El handler "clase_con_error" ahora NOMBRA la clase saltada y limpia la
 *   cola local. Antes mostraba un texto genérico ("Error de red en fragmentos. Saltando...")
 *   y encima nadie emitía el mensaje (handler muerto). Con el fix del loop 4xx del backend
 *   (background.js v5.9.0), el SW emite "clase_con_error" {titulo, motivo}: el popup marca la
 *   clase 'error', la saca de AppState.colaDescargas, respalda, actualiza el badge y avisa
 *   cuál se saltó y por qué (título vía textContent — regla anti-XSS de docs/security.md).
 *   Espeja la limpieza de "clase_guardada_ok". Ver docs/TECHNICAL_DEBT.md, docs/patterns.md.
 * CHANGELOG v5.12.0:
 * - [FIX] Nuevo tipo de falla "sesion" (descargar sin sesión iniciada en Ramón Net).
 *   renderizarListadoInterfaz pinta una card dedicada ("Sesión no iniciada" 🔑) y
 *   actualizarContadoresBoton muestra el botón "Iniciar sesión y reintentar 🔄". El
 *   resto fluye genérico (mostrarAlertDeConexionCaida/ejecutarReintentoDeCola). La
 *   detección (redirect al login) y la clasificación viven en hlsEngine.js v1.0.5 /
 *   background.js v5.8.0. Ver docs/data-model.md, docs/patterns.md.
 * CHANGELOG v5.11.0:
 * - [SPLIT] Los filtros y la búsqueda se extrajeron a la feature
 *   popup/features/filters.js (FilterFeature.crear(ctx)): aplicarFiltrosCruzados,
 *   desbanearFiltros, renderizarFiltrosMenuPopover, crearPopoverOptionDOM (privada)
 *   y actualizarPillsUIState. popup.js las recibe por ctx (nodos + filtrosActivos
 *   POR REFERENCIA + callbacks renderizar/actualizarContadores) y las expone como
 *   alias locales — los call-sites no cambian. Además se unificó el predicado de
 *   filtrado de la pestaña Cola —antes duplicado en masterCheck,
 *   renderizarListadoInterfaz y actualizarMasterCheckState— en
 *   _filters.coincideConFiltrosCola(clase, busqueda). Sin cambio de comportamiento.
 *   Ver ADR-0005, ROADMAP Fase 2, filters.test.js.
 * CHANGELOG v5.10.0:
 * - [ISLA #4 · Etapa 2] La isla Preact ahora es dueña también de los ATRIBUTOS del
 *   host #ui-list. Se quitó nodos.lista: la opacidad de sincronización de disco pasó
 *   a ListaClases.setAtenuada(bool), y la clase .selection-mode (actualizarModoSeleccion)
 *   a ListaClases.setSelectionMode(bool). serverConnection dejó de tocar
 *   innerHTML/display de #ui-list y usa ListaClases.setOculta(bool). La card de
 *   conexión caída de renderizarListadoInterfaz SE CONSERVA (sigue viva para el caso
 *   "descarga interrumpida", donde #ui-list no se oculta). Ver docs/preact-migration.md.
 * CHANGELOG v5.9.0:
 * - [ISLA #4 · Etapa 1] El pintado de #ui-list se migró a la isla Preact
 *   features/listaClases.preact.js. renderizarListadoInterfaz ya NO construye DOM:
 *   mantiene la lógica (sincronizar cola, filtrar, ordenar) y empuja un view-model
 *   a window.ListaClases.render(vm) — { modo:'card', card } o { modo:'lista', items, ctx }.
 *   onCheckChange pasó a firma (clase, checked) y re-empuja el vm; el post-proceso
 *   por fila (atenuar/deshabilitar sin sincronizar) vive ahora en <FilaClase>. La
 *   card de escaneo "sin enlaces" también empuja al store. AppState sigue siendo la
 *   fuente de verdad; la isla es vista pura. renderers.js (construirFilaClaseDOM /
 *   renderizarTarjetaEstado) fue eliminado por muerto (renderers.js v5.2.0). Los
 *   atributos del contenedor (opacity/.selection-mode/display) se migraron a la isla
 *   en la Etapa 2 (ver v5.10.0). Ver docs/preact-migration.md, ADR-0006.
 * CHANGELOG v5.8.3:
 * - [ISLA #4 · Etapa 0] Render de la lista state-driven, sin refs imperativas al
 *   DOM de las filas (prep para la migración Preact). El handler de masterCheck ya
 *   no sincroniza cada checkbox por getElementById('chk-...') + classList.toggle:
 *   muta sólo el estado (seleccionado / conmutarSeleccionMasiva) y re-renderiza.
 *   onRemoverClick reemplaza div.remove() por renderizarListadoInterfaz(). Así el
 *   render queda como única vía de pintar filas. Sin cambio de comportamiento.
 *   Ver docs/preact-migration.md (isla #4).
 * CHANGELOG v5.8.2:
 * - [SPLIT] Último corte de queue.js: el arranque de descarga (btnStartQueue) y
 *   ejecutarReintentoDeCola pasaron a QueueFeature (iniciarDescargaCola /
 *   ejecutarReintentoDeCola), junto con verificarRedAntesDeDescargar. Los flags
 *   verificandoConexionBoton/reintentandoColaActivo se quedan acá (los lee
 *   actualizarContadoresBoton); la feature los togglea por ctx (setVerificandoConexion/
 *   setReintentandoCola) y recibe mostrarAlerta/congelarUI/renderizar por ctx. El
 *   listener de btnStartQueue quedó en one-liner; onReintentarCola de serverConnection
 *   apunta al alias. Sin cambio de comportamiento. Ver queue.js v1.2.0.
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

// FASE 8: los módulos hermanos entran por import, no por globals. Se importan y NO se
// inyectan porque no son adaptadores intercambiables —no hay una segunda implementación de
// "la feature de filtros"—; lo inyectable son los servicios, y ésos siguen entrando por
// parámetro. Efecto colateral que importa: el orden de imports del entrypoint deja de ser
// load-bearing para todo esto, porque ahora lo resuelve el grafo del bundler.
import FacetaFeature from './popup/features/faceta.js';
import FilterFeature from './popup/features/filters.js';
import OrdenFeature from './popup/features/orden.js';
import QueueFeature from './popup/features/queue.js';
import ServerConnectionFeature from './popup/features/serverConnection.js';
import OnboardingFeature from './popup/features/onboarding.preact.js';
import ListaClases from './popup/features/listaClases.preact.js';
import RutaDisco from './popup/features/rutaDisco.preact.js';
import BannerConexion from './popup/features/bannerConexion.preact.js';

/**
 * Arranca el popup con sus dependencias ya resueltas (Fase 7b).
 *
 * Antes este archivo se evaluaba por su efecto secundario y buscaba en `globalThis` todo lo
 * que necesitaba. Ahora lo llama `entrypoints/popup/main.js` pasándole las piezas por nombre.
 * El `addEventListener` sigue registrándose en el mismo momento: los módulos ES son
 * diferidos, así que el entrypoint termina de evaluarse ANTES de que dispare
 * `DOMContentLoaded`, igual que cuando el listener se registraba al importar.
 *
 * Lo que queda adentro es lo que ADR-0005 define como el estado final del orquestador: init,
 * wiring de features/islas y la orquestación de scraping/render/IPC. **No se extrae.**
 *
 * @param {object} deps
 * @param {object} deps.appState    Estado del popup (`core/estado/appState.ts`).
 * @param {object} deps.conexion    Daemon de estado de conexión; se lo pasa a las features.
 * @param {object} deps.mensajeria  PuertoMensajeria: el IPC hacia el service worker.
 * @param {object} deps.utils       Ensamblado `Utils` (Fase 6a).
 * @param {object} deps.backend     Cliente del backend Bun.
 * @param {object} deps.sitios      Registro de portales. Resuelve por `sitioId` (lo que
 *                                  mezcla portales: la cola) y por URL (la pestaña activa).
 *                                  Ver ADR-0010. Desde el corte 5 **no hay un `sitio` fijo**.
 * @param {object} deps.identidadClase [MULTIPORTAL D] Cómo se decide si dos ítems son la misma
 *                                  clase: por (portal, título). El MISMO que usa el service
 *                                  worker — si divergieran, el popup sacaría de la cola algo
 *                                  distinto de lo que el SW considera esa clase.
 * @param {object} deps.credencialesPortal [CORTE 7] Dónde se guardan las credenciales que un
 *                                  portal expone sólo dentro de su pestaña. Las escribe el
 *                                  escaneo (acá) y las lee el service worker al bajar. El
 *                                  MISMO módulo de los dos lados, por lo mismo que
 *                                  `identidadClase`.
 * @param {object} deps.renderers   Pintado vanilla que todavía no es isla.
 */
export function iniciarPopup({ appState, conexion, mensajeria, utils, backend, sitios, identidadClase, credencialesPortal, renderers }) {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log("🤖 [POPUP-CORE] Orquestador unificado V5.4.1 activo. Sincronización de escáner híbrido (Chrome/Bun) integrada.");

    const nodos = {
      btnAction:       document.getElementById('ui-btn-action'),
      btnStartQueue:   document.getElementById('ui-btn-start-queue'),
      txtEstado:       document.getElementById('ui-msg-status'),
      // #ui-list ya no se referencia por nodos: es dueño la isla Preact #4 (window.ListaClases).
      search:          document.getElementById('ui-search'),
      btnFilterPills:  document.getElementById('ui-btn-filter-pills'),
      filterMenu:      document.getElementById('ui-filter-menu'),
      sortMenu:        document.getElementById('ui-sort-menu'),
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
      facetaBadge:    document.getElementById('ui-faceta-badge'),
      // El texto de la ruta (#preact-pc-path) lo posee la isla Preact
      // features/rutaDisco.preact.js; se empuja vía window.RutaDisco (no hay ref nodos.*).
      btnSort:         document.getElementById('ui-btn-sort'),
      btnToggleSelect: document.getElementById('ui-btn-toggle-select'),
      btnHelp:         document.getElementById('ui-btn-help')
      // El overlay del onboarding y su DOM interno los posee la isla Preact
      // features/onboarding.preact.js (ver ADR-0006). Ya no hay refs nodos.* a él.
    };

    // Fase 5c: antes esto guardaba la REFERENCIA al listener, sólo para poder pasársela después
    // a removeListener. El puerto de mensajería devuelve directamente la función de baja, así
    // que acá se guarda eso: desengancharlo es llamarla.
    let desengancharOyenteWorker = null;
    let modoSeleccionFilaActivo = false;

    // [LOADERS — ítem 1] Estado del escaneo. Son dos cosas distintas y conviene no unificarlas:
    //  - `escaneoEnCurso` es la guarda de REENTRADA: impide lanzar un segundo escaneo encima
    //    del primero mientras el botón dice "Re-escanear 🔄".
    //  - `generacionEscaneo` es el ABANDONO: cada corrida se lleva su número y el watchdog lo
    //    incrementa al vencerse, así un callback tardío sabe que su corrida ya está muerta y no
    //    pinta. Un booleano no alcanzaría — con dos corridas en vuelo no distingue cuál llegó.
    let escaneoEnCurso = false;
    let generacionEscaneo = 0;

    // [MULTISITIO CORTE 5] El portal de la pestaña que se está mirando.
    //
    // Hasta este corte el popup recibía UN sitio inyectado (`sitioAsumido`, el andamio del
    // corte 2) y lo trataba como "el" portal. Ahora lo resuelve por URL de pestaña, que es la
    // mitad de ADR-0010 que le toca: el service worker resuelve por ítem porque su cola no
    // tiene pestaña; el popup sí la tiene, y es el único momento en que se sabe con certeza
    // de qué portal salió una clase.
    //
    // Arranca en el portal legado —el mismo que `sitios.obtener(undefined)` devuelve por la
    // migración— sólo para que la UI tenga vocabulario antes del primer escaneo. En cuanto se
    // escanea, manda la pestaña.
    let sitioActivo = sitios.obtener(undefined);

    /** El descriptor del portal activo. Las features lo reciben ASÍ, como función. */
    const sitio = () => sitioActivo;

    /**
     * Resuelve el portal de una pestaña y lo adopta como activo.
     *
     * Devuelve `undefined` si la pestaña no es de ningún portal registrado — y ahí el llamador
     * tiene que negarse a escanear. No se cae al portal legado a propósito: adivinar el portal
     * de una pestaña cualquiera es exactamente el bug que ADR-0010 previene.
     */
    function adoptarPortalDePestaña(url) {
      const resuelto = sitios.resolverPorUrl(url);
      if (resuelto) sitioActivo = resuelto;
      return resuelto;
    }

    // [MULTIPORTAL C] La sonda de "hay internet" del daemon apunta al portal que se está
    // mirando, no a uno fijo. Con N portales, "hay internet" es "llego a *cuál*": si el
    // usuario está en el portal B y el A está caído, el banner no tiene por qué decirle que
    // no hay conexión. Se registra un getter y no un valor porque `sitioActivo` cambia con
    // cada escaneo. En el service worker el criterio es otro —el portal del ítem de la cola—
    // y lo fija la composición. Ver `docs/multisitio-diseno.md` §4.
    conexion.fijarSondeo(() => sitioActivo.urlSondeoInternet);
    // [MULTISITIO CORTE 6C] `portales` es el filtro maestro de la pestaña Cola: la cola puede
    // mezclar portales (ADR-0010) y cada uno trae su propio vocabulario de faceta. En la Cola
    // los valores de `valoresFaceta` van CALIFICADOS por portal (`sitioId|valor`), porque dos
    // portales pueden tener una faceta con la misma etiqueta y sin calificar se pisarían.
    // No se persiste: se arma acá y viaja por referencia, así que no lleva migración.
    const filtrosActivos = {
      estados: new Set(),
      materias: new Set(),
      valoresFaceta: new Set(),
      portales: new Set(),
      // [ESCANEO-API CORTE 5] Arranca VACÍO, como los otros cuatro Sets: sin filtro.
      //
      // Arrancó en "sólo video" y duró lo que tardó el dueño en abrir el popup. El problema no
      // era el criterio sino que **un filtro activo que nadie prendió es invisible**: la lista ya
      // venía recortada y no había cómo notarlo salvo contando. Un default que esconde datos
      // tiene que anunciarse, y anunciarlo cuesta más UI que no filtrar.
      tipos: new Set()
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

    // El listener del click en el badge de la faceta vive ahora en FacetaFeature
    // (popup/features/faceta.js), cableado en su crear() más abajo.

    // [MULTISITIO CORTE 6B] El listener del orden vive ahora en OrdenFeature
    // (popup/features/orden.js), junto con el comparador y la etiqueta del botón, que
    // también estaban sueltos acá. Se cablea en su crear() más abajo.

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
          appState.colaDescargas.forEach(c => c.seleccionado = false);
          nodos.masterCheck.checked = false;
          appState.respaldar();
        }
        actualizarContadoresBoton();
        aplicarFiltrosCruzados();
      });
    }

    // Toggle visibility of popover menu
    if (nodos.btnFilterPills) {
      nodos.btnFilterPills.addEventListener('click', (e) => {
        e.stopPropagation();
        // [CORTE 6B] El `stopPropagation` de arriba impide que el listener global cierre este
        // popover en el mismo click que lo abre — pero también impide que cierre el de orden.
        // Por eso se lo cierra a mano: si no, quedan los dos abiertos, superpuestos.
        _orden.cerrarMenu();
        const open = nodos.filterMenu.style.display === 'flex';
        if (!open) {
          renderizarFiltrosMenuPopover();
        }
        nodos.filterMenu.style.display = open ? 'none' : 'flex';
        nodos.btnFilterPills.classList.toggle('open', !open);
      });
    }

    // Close when clicking outside — cierra LOS DOS popovers (filtros y orden).
    document.addEventListener('click', () => {
      if (nodos.filterMenu) {
        nodos.filterMenu.style.display = 'none';
      }
      if (nodos.btnFilterPills) {
        nodos.btnFilterPills.classList.remove('open');
      }
      _orden.cerrarMenu();
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
      appState,
      conexion,
      listaClases: ListaClases,
      rutaDisco: RutaDisco,
      bannerConexion: BannerConexion,
      backend,
      configurarBotonesUX: (modo, txt, dis) => configurarBotonesUX(modo, txt, dis),
      // [BLOQUEO REAL] El mismo bloqueo que usa la cola pausada, para que los dos estados de
      // alerta no se comporten distinto. Va envuelto por la misma razón que el de arriba: la
      // función se declara más abajo en este closure.
      bloquearRegiones: (bloquear) => bloquearRegionesDeAlerta(bloquear),
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
      onRestaurarPanel: (txt, limpiarCola) => restaurarPanelPorInterrupcion(txt, limpiarCola),
      mostrarAlerta: (tipo, titulo) => mostrarAlertDeConexionCaida(tipo, titulo),
      congelarUI: (titulo, pct, tel) => congelarUIPorDescargaActiva(titulo, pct, tel),
      renderizar: () => renderizarListadoInterfaz(),
      setVerificandoConexion: (v) => { verificandoConexionBoton = v; },
      setReintentandoCola: (v) => { reintentandoColaActivo = v; },
      // [CORTE 6D — ADR-0011] Diferido a propósito: `_orden` se crea más abajo. Se invoca
      // recién al encolar, mucho después de que este init termine.
      reordenarCola: () => _orden.persistirOrdenCola(),
      identidad: identidadClase,
      // PuertoMensajeria (Fase 5c): lo publica plataforma/composicion.ts. La feature ya no
      // toca chrome.runtime; el IPC entra por acá.
      mensajeria: mensajeria,
      appState,
      conexion,
    });
    const encolarItemsEnCaliente = _queue.encolarItemsEnCaliente;
    const quitarItemsDeColaEnLote = _queue.quitarItemsDeColaEnLote;
    const ejecutarReintentoDeCola = _queue.ejecutarReintentoDeCola;

    // Feature: filtros y búsqueda. filtrosActivos se pasa POR REFERENCIA (objeto
    // compartido) para no romper los call-sites externos que lo mutan (conmutarPestañaA).
    // Ver popup/features/filters.js.
    const _filters = FilterFeature.crear({
      nodos,
      filtrosActivos,
      sitio,
      sitios,
      appState,
      renderizar: () => renderizarListadoInterfaz(),
      actualizarContadores: () => actualizarContadoresBoton()
    });
    const coincideConFiltrosCola = _filters.coincideConFiltrosCola;
    const aplicarFiltrosCruzados = _filters.aplicarFiltrosCruzados;
    const desbanearFiltros = _filters.desbanearFiltros;
    const actualizarPillsUIState = _filters.actualizarPillsUIState;
    const renderizarFiltrosMenuPopover = _filters.renderizarFiltrosMenuPopover;

    // Feature: orden de la pestaña Cola (corte 6b). Se lleva el listener del botón, el
    // comparador y la etiqueta, que estaban sueltos en este archivo. Recibe `sitios` —no un
    // sitio fijo— porque los criterios `faceta` y `portal` se resuelven contra el descriptor
    // de CADA ítem: la cola puede mezclar portales (ADR-0010).
    const _orden = OrdenFeature.crear({
      nodos,
      appState,
      sitios,
      renderizar: () => renderizarListadoInterfaz(),
      // La feature no toca el DOM del popover ajeno: pide que lo cierren.
      cerrarOtrosPaneles: () => {
        if (nodos.filterMenu) nodos.filterMenu.style.display = 'none';
        if (nodos.btnFilterPills) nodos.btnFilterPills.classList.remove('open');
      }
    });

    // Feature: faceta del listado (badge + asistente de autoselección + su modal, y el
    // listener del click en el badge). Genérica: qué ES la faceta —en Ramón Net, la
    // cátedra— lo aporta el descriptor del sitio activo. Depende de aplicarFiltrosCruzados
    // (arriba) y se instancia antes de init/scraping, que llaman actualizarBadgeFaceta y
    // verificarYMostrarAsistenteFaceta. Ver popup/features/faceta.js + sitio/ramonnet/config.js.
    const _faceta = FacetaFeature.crear({
      appState,
      badge: nodos.facetaBadge,
      sitio,
      // [MULTIPORTAL A] El resolvedor compartido, para poder saber de qué portal es CADA clase
      // del listado: `listadoClasesGlobal` puede traer ítems encolados de otro portal.
      sitios,
      aplicarFiltros: () => aplicarFiltrosCruzados()
    });
    const actualizarBadgeFaceta = _faceta.actualizarBadge;
    const verificarYMostrarAsistenteFaceta = _faceta.verificarYMostrarAsistente;
    const perteneceASeleccionFaceta = _faceta.perteneceASeleccion;

    nodos.btnAction.setAttribute('data-modo', 'sincronizar-disco');

    // Forzar re-escaneo automático si la pestaña de Ramón Net cambia de dirección o se recarga
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active && adoptarPortalDePestaña(tab.url)) {
        console.log("🔄 [POPUP] Pestaña del portal actualizada. Re-escaneando...");
        if (!appState.fallaConexionActiva) {
          ejecutarPaso1EscaneoRamonAutomatico();
        }
      }
    });

    // Forzar re-escaneo si el usuario cambia a la pestaña de Ramón Net
    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        // OJO: este lastError es el de chrome.tabs, no IPC. El IPC de este archivo ya pasó
        // entero al PuertoMensajeria (Fase 5c); lo que queda de chrome.* acá es tabs +
        // scripting, que esperan sus propios puertos.
        if (chrome.runtime.lastError || !tab) return;
        if (tab.active && adoptarPortalDePestaña(tab.url)) {
          console.log("🔄 [POPUP] Pestaña del portal enfocada. Re-escaneando...");
          if (!appState.fallaConexionActiva) {
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

        const ruta = await backend.obtenerRutaServidor();
        if (ruta) {
          const tabsBar = document.querySelector(".tabs-bar");
          if (tabsBar) { tabsBar.style.display = "flex"; tabsBar.classList.remove('bloqueada'); }
          // El camino de "arrancó y el server contesta" también levanta el bloqueo: si no, un
          // popup que abre después de una caída podría quedarse con la toolbar inerte sin que
          // nadie la destrabe (la recuperación por daemon sólo corre si hubo TRANSICIÓN).
          bloquearRegionesDeAlerta(false);

          nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;
          RutaDisco.mostrar(ruta);
          nodos.txtEstado.textContent = "Analizando...";
          // (el puntito de estado y el estado del servidor en el onboarding los derivan
          //  las islas Preact del daemon Conexion — ya no se empujan imperativamente)

          const respuestaFondo = await appState.sincronizarConBackground();

          if (appState.ráfagaEnCurso) {
            congelarUIPorDescargaActiva(appState.videoActualEnTransmisiónSW, respuestaFondo.porcentaje, respuestaFondo.telemetry);
          } else if (respuestaFondo && respuestaFondo.colaPausadaPorError) {
            appState.fallaConexionActiva = respuestaFondo.tipoDeErrorConexion;
            appState.videoFalladoParaReintento = respuestaFondo.videoActual;
            mostrarAlertDeConexionCaida(respuestaFondo.tipoDeErrorConexion, respuestaFondo.videoActual);
          }

          if (!appState.fallaConexionActiva) {
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
      await appState.inicializarSincronizacionStorage();
      actualizarIconoSorteo();
      actualizarBadgeFaceta();
      nodos.queueBadge.textContent = appState.colaDescargas.length;

      // Primera vez: el tutorial va PRIMERO y solo. El estado del servidor dentro del
      // onboarding lo mantiene al día el daemon (iniciarDetectorEstado, ya arrancado);
      // la conexión + escaneo se difieren hasta cerrar el tour (onComplete), así el
      // loader no aparece detrás/antes del tutorial. Si ya se completó, arrancamos ya.
      if (!appState.tutorialCompletado) {
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

      backend.seleccionarCarpeta().then(res => {
        if (res.success) {
          RutaDisco.mostrar(res.ruta);
          nodos.btnExplore.title = `Carpeta raíz actual: ${res.ruta} (Click para cambiar)`;
          appState.sincronizacionDiscoCompletada = false;

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
        if (appState.ocultarAdvertenciaExplorar) {
          lanzarSeleccionCarpetaFisica();
          return;
        }

        mostrarModalAdvertencia({
          titulo: "Selección de Carpeta 📂",
          // Copy genérica a propósito: no enumera los niveles de subcarpeta. El árbol real
          // depende del portal —Ramón Net abre un nivel por cátedra, Anatomy no tiene eje de
          // clasificación (`faceta.id: "ninguna"`)— y el descriptor no expone un nombre honesto
          // para ese nivel cuando no existe: interpolar `faceta.etiqueta` acá imprimiría
          // "por materia y sin clasificación" en Anatomy. Ver copy-generico-diseno.md §5.1.
          cuerpo: "Por favor, seleccioná tu carpeta principal (ej: 'Clases').<br><br>El sistema creará y organizará automáticamente las subcarpetas dentro de ella.<br><br><strong>Nota:</strong> Evitá elegir directamente subcarpetas específicas de materias.",
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
        if (appState.ocultarAdvertenciaAula || appState.ráfagaEnCurso || advertenciaAulaMostradaEsteFoco) return;
      
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
            appState.ocultarAdvertenciaExplorar = true;
          } else if (checkboxKey === "ocultarAdvAula") {
            appState.ocultarAdvertenciaAula = true;
          }
          appState.respaldar();
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
      //
      // [ESCANEO-API CORTE 1] **Una clase que trae `modulo` no se toca.** Su carpeta la decide
      // su módulo de origen, y escribir el input encima haría dos cosas malas: mandaría los 103
      // ítems de once módulos a una sola carpeta, y —peor— al BORRAR el input los dejaría en
      // `""`, que es una carpeta inexistente y un fallo silencioso (riesgo R4).
      //
      // El override del input vuelve en el corte 2, pero **sin mutar `c.carpeta`**: vive sólo en
      // el input y se estampa al encolar. La carpeta del ítem sigue siendo la de su módulo.
      appState.listadoClasesGlobal.forEach(c => {
        if (c.estado !== 'process' && !c.modulo) {
          c.carpeta = nuevaRuta;
        }
      });
    
      appState.respaldar();
      renderizarListadoInterfaz();
      // [CORTE 2] El texto del botón también dice el destino, así que se refresca con cada
      // tecla junto con los chips de las filas. Los dos leen el MISMO input: si sólo se
      // actualizara uno, el feedback se contradiría a sí mismo.
      actualizarContadoresBoton();

      // Debounce de la sincronización de archivos físicos con Bun (400ms)
      clearTimeout(timerSincronizacionDebounce);
      timerSincronizacionDebounce = setTimeout(() => {
        appState.sincronizacionDiscoCompletada = false;
        ejecutarPaso2SincronizarDiscoVeloz();
      }, 400);
    });

    nodos.tabDisp.addEventListener('click', () => conmutarPestañaA("disponibles", 'block', 'none', 'flex'));
    nodos.tabCola.addEventListener('click', () => {
      conmutarPestañaA("cola", 'none', 'block', 'none');
      nodos.btnStartQueue.disabled = (appState.colaDescargas.length === 0);
    });

    function conmutarPestañaA(id, actDisp, qDisp, _filtDisp) {
      appState.pestañaActiva = id;
      nodos.tabDisp.classList.toggle('active', id === "disponibles");
      nodos.tabCola.classList.toggle('active', id === "cola");
      // [BANNER OCUPA LISTA + TOOLBAR] El display vuelve a ser incondicional —la barra siempre
      // está—, pero el bloqueo sigue a la falla: con la cola pausada, cambiar de pestaña
      // desbloqueaba la toolbar encima de la card. El estado de falla manda sobre la pestaña.
      nodos.filtersBar.style.display = 'flex';
      // [BLOQUEO REAL] Las dos regiones siguen al mismo estado, por el mismo helper. Acá hacía
      // falta porque cambiar de pestaña volvía a habilitar lo que la alerta había bloqueado.
      bloquearRegionesDeAlerta(!!appState.fallaConexionActiva || BannerConexion.get().visible);
      nodos.btnStartQueue.style.display = appState.ráfagaEnCurso ? 'none' : qDisp;
    
      // Limpiar filtros activos y cerrar el menú
      filtrosActivos.estados.clear();
      filtrosActivos.materias.clear();
      filtrosActivos.valoresFaceta.clear();
      // [CORTE 6C] Limpiar `portales` acá no es prolijidad: en la Cola los valores de faceta van
      // calificados por portal y en Disponibles van crudos. Que el Set se vacíe al conmutar es
      // lo que hace que esas dos convenciones no puedan cruzarse.
      filtrosActivos.portales.clear();
      // [CORTE 5] El tipo se limpia como los demás. No hay default por pestaña: el filtro
      // arranca vacío en las dos.
      filtrosActivos.tipos.clear();
      actualizarPillsUIState();
      if (nodos.filterMenu) nodos.filterMenu.style.display = 'none';
      if (nodos.btnFilterPills) nodos.btnFilterPills.classList.remove('open');
      // El panel de orden también: los criterios son distintos por pestaña, así que dejarlo
      // abierto al cambiar mostraría los de la pestaña que se está dejando.
      _orden.cerrarMenu();

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
      // [LOADERS — ítem 1c] GUARDA DE REENTRADA. Mientras el watchdog corría, el botón volvía a
      // "Re-escanear 🔄" y un click lanzaba un SEGUNDO escaneo encima del primero: dos
      // `executeScript` concurrentes sobre la misma pestaña, resolviendo en cualquier orden.
      // El que llega último gana, y no es necesariamente el último que se pidió.
      if (escaneoEnCurso) {
        console.warn("⏳ [ESCANEO] Ya hay uno en curso; se ignora el pedido nuevo.");
        return;
      }
      escaneoEnCurso = true;

      // [LOADERS — ítem 1b] ABANDONO EXPLÍCITO. Cada corrida se lleva su número; el watchdog lo
      // incrementa al vencerse. Un callback que llegue después compara y se calla, en vez de
      // pintar sobre lo que el usuario esté mirando — que es justo lo que hacía el escaneo de
      // Anatomy al llegar ~5 s DESPUÉS de que el timeout escribiera el error falso.
      const miGeneracion = ++generacionEscaneo;
      const fueAbandonado = () => miGeneracion !== generacionEscaneo;
      const terminarEscaneo = () => { if (!fueAbandonado()) escaneoEnCurso = false; };

      // Genérica OBLIGATORIA: acá `sitioActivo` es todavía el portal ANTERIOR (o el legado por
      // defecto). El portal de este escaneo se resuelve recién ~17 líneas abajo, así que
      // interpolarlo acá anunciaría el portal equivocado justo al cambiar de portal.
      // Caso C de copy-generico-diseno.md §3; la trampa entera, en su §4.
      nodos.loaderTxt.textContent = "Escaneando la pestaña...";
      nodos.loader.style.display = 'flex';
      // Ocultar badge de cátedra al iniciar un nuevo escaneo para evitar estados inconsistentes
      nodos.facetaBadge.style.display = "none";

      // [LOADERS — ítem 1a] El watchdog se arma DESPUÉS de resolver el portal, no acá. Su tope
      // sale del descriptor (`topeEscaneoMs`) y acá arriba el portal todavía no se sabe — es la
      // misma trampa que el cartel de dos líneas más arriba. Lo que queda sin cubrir entre este
      // punto y el armado es `chrome.tabs.query`, que no sale a la red; lo que el watchdog
      // existe para vigilar es el escaneo, que sí.
      let safetyTimeout = null;

      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        // [MULTISITIO CORTE 5] Acá es donde el portal se decide de verdad: el escaneo corre
        // sobre UNA pestaña concreta y es el único momento en que se sabe con certeza de qué
        // portal sale cada clase. Se resuelve una vez y se usa `portal` —el local— en todo el
        // resto del escaneo: leer `sitioActivo` más abajo dejaría la puerta abierta a que otro
        // listener lo cambie a mitad de camino.
        const portal = tab && adoptarPortalDePestaña(tab.url);
        if (!portal) {
          clearTimeout(safetyTimeout);
          terminarEscaneo();
          nodos.txtEstado.textContent = "⚠️ No estás en un portal reconocido.";
          configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
          if (appState.listadoClasesGlobal.length > 0) { desbanearFiltros(); aplicarFiltrosCruzados(); }
          nodos.loader.style.display = 'none';
          return;
        }

        // [LOADERS — ítem 1a] Recién acá se conoce el portal, y con él su tope medido. Antes
        // eran 6000 fijos para todos: en Anatomy el escaneo mide ~11 s, así que el watchdog
        // saltaba SIEMPRE y el error se borraba solo al llegar el resultado real.
        safetyTimeout = setTimeout(() => {
          // [ítem 1b] Abandonar: subir la generación invalida el callback que llegue después.
          generacionEscaneo++;
          escaneoEnCurso = false;
          nodos.loader.style.display = 'none';
          // [ítem 1d] El mensaje va a la TARJETA de la lista, no al footer. En el footer convive
          // con el diagnóstico de conexión —que tiene otro dueño— y queda tapado o pisado; acá
          // ocupa la región y se ve. Nombra el portal porque a esta altura ya está resuelto.
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'El escaneo tardó demasiado',
            descripcion: `Pasaron ${Math.round(portal.topeEscaneoMs / 1000)} s sin respuesta de ${utils.escaparHtml(portal.nombre)}.<br>Puede ser la conexión o que el portal haya cambiado.<br>Probá <strong>Re-escanear</strong>.`,
            icono: '⏱️'
          }});
          configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
        }, portal.topeEscaneoMs);

        // Preservar en memoria los elementos que están en la cola de descarga activa
        const itemsEnCola = appState.listadoClasesGlobal.filter(c => c.estado === 'process');
        appState.sincronizacionDiscoCompletada = false;

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: portal.escanearListado
        }, async (resultados) => {
          clearTimeout(safetyTimeout);

          // [LOADERS — ítem 1b] Si el watchdog ya dio esta corrida por muerta, este callback NO
          // pinta. Es el arreglo del síntoma que se veía todos los días: el escaneo de Anatomy
          // llegaba ~5 s después del error falso y le pintaba la lista encima, así que el
          // usuario veía un error que se resolvía solo sin que nadie lo hubiera resuelto.
          // Ojo con `escaneoEnCurso`: no se toca acá, ya lo soltó el watchdog.
          if (fueAbandonado()) {
            console.warn("🕰️ [ESCANEO] Llegó un resultado de una corrida ya abandonada; se descarta.");
            return;
          }
          terminarEscaneo();

          // Controlar de forma resiliente si ocurrió un error de inyección (ej: permisos de host o página de sistema)
          // lastError de chrome.scripting (la inyección), no de IPC — ver la nota de arriba.
          if (chrome.runtime.lastError) {
            console.error("❌ [POPUP-SCRIPT-ERROR] Falló inyección de script de escaneo:", chrome.runtime.lastError.message);
            nodos.txtEstado.textContent = `❌ Error de escaneo: ${chrome.runtime.lastError.message}`;
            nodos.loader.style.display = 'none';
            configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
          
            // Cargar el listado anterior del storage para evitar dejar la interfaz vacía
            appState.inicializarSincronizacionStorage().then(() => {
              if (appState.listadoClasesGlobal.length > 0) {
                desbanearFiltros();
                aplicarFiltrosCruzados();
                actualizarBadgeFaceta();
              }
            });
            return;
          }

          const res = resultados?.[0];
          try {
            // [ESCANEO-API CORTE 1] `await` porque el escaneo de un portal puede ser `async`
            // (Anatomy le pide el árbol a su API). `chrome.scripting` ya resuelve la promesa
            // antes de llamar a este callback, así que el `await` es cinturón y tirantes: sobre
            // un valor plano no hace nada, y si algún día la API cambia de conducta, no se
            // rompe en silencio con un `[object Promise]` como listado.
            //
            // El default deja de traer `materia: "biologia"`: ese literal era el fallback del
            // scraper de Ramón Net filtrado a la capa genérica, y en el portal equivocado
            // mandaba las clases a `raíz/anatomy-by-chris/biologia/`.
            const resultado = (await res?.result) || { materia: "", enlaces: [] };
            const enlaces = resultado.enlaces;

            // [CORTE 7] Las credenciales que el portal expone SÓLO dentro de su pestaña
            // (un token de localStorage, en Hotmart Club). El service worker las va a
            // necesitar al bajar y no tiene pestaña de la cual sacarlas, así que este es el
            // único momento en que se pueden cosechar. Se guardan por PORTAL y no con cada
            // clase: son de la sesión del usuario, no de un video.
            //
            // Fire-and-forget deliberado: si falla el guardado, el escaneo igual sirve y el
            // fallo se ve después como un error de resolución, no como un escaneo roto.
            void credencialesPortal.guardar(portal.id, resultado.credenciales);


            // Un portal de dos niveles no tiene UNA materia: tiene una por módulo, y viaja con
            // cada enlace. El input queda vacío a propósito y el placeholder explica por qué —
            // vacío y sin explicación se lee como "se rompió el escaneo".
            nodos.folder.value = resultado.materia || "";
            const hayModulos = (enlaces || []).some(e => e && e.modulo);
            nodos.folder.placeholder = hayModulos
              ? "cada clase va a su módulo"
              : "carpeta de destino";

            if (!enlaces || enlaces.length === 0) {
              // [ESCANEO-API CORTE 1] **NO se destruye la lista.** Antes esta rama hacía
              // `listadoClasesGlobal = itemsEnCola`, o sea que un escaneo que volvía vacío
              // —cosa que en Anatomy pasaba por llegar antes de que el sidebar pintara— te
              // borraba de la pantalla todo lo que ya habías escaneado. Un escaneo fallido no
              // es información nueva sobre las clases viejas: se avisa y se deja lo que había.
              const habiaLista = appState.listadoClasesGlobal.length > 0;

              if (habiaLista) {
                nodos.txtEstado.textContent = "⚠️ El escaneo no devolvió clases. Se conserva la lista anterior.";
                desbanearFiltros();
                aplicarFiltrosCruzados();
              } else {
                appState.listadoClasesGlobal = itemsEnCola;
                appState.respaldar();
                nodos.search.disabled = true;
                nodos.btnFilterPills.disabled = true;
                nodos.masterCheck.disabled = true;

                ListaClases.render({ modo: 'card', card: {
                  tipo: 'info',
                  titulo: 'Sin clases detectadas',
                  // El nombre del portal sale del descriptor. Estaba hardcodeado "Ramón Net", y
                  // en el otro portal el cartel mandaba al usuario al lugar equivocado.
                  descripcion: `No encontramos clases en esta pestaña.<br>Asegurate de estar dentro de ${utils.escaparHtml(portal.nombre)} y hacé click en Re-escanear.`,
                  icono: '🔍'
                }});
              }

              configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
            } else {
              const nuevasClases = enlaces.map((item, idx) => {
                // [ESCANEO-API CORTE 1] La base de la carpeta sale del MÓDULO de la clase si el
                // portal es de dos niveles, y sólo cae al input cuando no lo es. Así
                // `clasificarCarpeta` ya devuelve la carpeta por clase y no hubo que tocar el
                // parser de títulos de ningún portal.
                const materiaBase = item.modulo || nodos.folder.value.trim();
                // [ESCANEO-API CORTE 5] Un ADJUNTO no pasa por el parser de títulos. Ese parser
                // existe para normalizar títulos de clase scrapeados (fechas, cátedras, basura
                // del DOM); el nombre de un PDF ya es un nombre de archivo con su extensión, y
                // pasarlo por ahí lo mutilaría — perdería el `.pdf`, entre otras cosas.
                const esAdjunto = item.tipo === 'adjunto';
                const tituloFinalEstandar = esAdjunto
                  ? item.texto
                  : portal.parsearTitulo(item.texto, materiaBase);
                const clasif = portal.clasificarCarpeta(item.texto, materiaBase);

                return {
                  id: idx + Date.now(), // ID único dinámico para evitar colisiones con clases persistidas
                  numeroOriginal: idx + 1,
                  titulo: tituloFinalEstandar,
                  urlInterna: item.href,
                  // El módulo de ORIGEN. Es media identidad de la clase
                  // (`core/cola/identidadClase.ts`) y por eso se persiste con ella: sin él, los
                  // 7 títulos que Anatomy repite en dos módulos son un solo ítem para la cola.
                  // No confundir con `carpeta`, que es el destino y lo puede pisar el override.
                  modulo: item.modulo,
                  // [CORTE 5] Qué es. Ausente sería `video`, pero se estampa explícito porque
                  // también es parte de la identidad y viaja en cada mensaje IPC del ítem.
                  tipo: item.tipo || 'video',
                  idArchivo: item.idArchivo,
                  bytes: item.bytes,
                  // ADR-0010: de qué portal salió. Se estampa ACÁ, que es el único momento en
                  // que se sabe con certeza — el escaneo corre sobre una pestaña concreta.
                  // Después la cola es independiente de la pestaña y ya no habría cómo deducirlo.
                  sitioId: portal.id,
                  catedra: clasif.catedra,
                  carpeta: clasif.carpeta,
                  estado: 'pending',
                  seleccionado: false,
                  visible: true
                };
              });

              // Combinar evitando duplicar elementos que ya están en la cola
              // [MULTIPORTAL D] Por (portal, título), no por título: dos portales pueden tener
              // una clase homónima y con la clave pelada la del portal recién escaneado se
              // descartaba en silencio por culpa de una encolada del otro.
              const yaEnCola = new Set(itemsEnCola.map(c => identidadClase.clave(c)));
              const clasesNuevasFiltradas = nuevasClases.filter(c => !yaEnCola.has(identidadClase.clave(c)));

              appState.listadoClasesGlobal = [...itemsEnCola, ...clasesNuevasFiltradas];
              appState.sincronizacionDiscoCompletada = false;
              appState.respaldar();
              desbanearFiltros(); 
              nodos.masterCheck.checked = false;
              renderizarListadoInterfaz();
              // Mostrar asistente de autoselección si es multicátedra
              verificarYMostrarAsistenteFaceta();
              // Auto-sincronizar inmediatamente
              ejecutarPaso2SincronizarDiscoVeloz();
            }
          } catch (e) {
            console.error("❌ Error procesando payload de inyección:", e);
            configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
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
      // El "" de arriba significa "sin acción → botón oculto"; acá el label se escribe por
      // innerHTML (lleva spinner), así que hay que volver a mostrarlo. Es la única excepción.
      nodos.btnAction.style.display = 'block';
      ListaClases.setAtenuada(true); // atenúa la lista durante la sincronización (isla dueña de #ui-list)

      const subcarpetaFiltro = nodos.folder.value.trim().toLowerCase();

      appState.listadoClasesGlobal.forEach(clase => {
        if (clase.estado !== 'process') {
          clase.estado = 'pending';
          clase.seleccionado = perteneceASeleccionFaceta(clase);
        }
      });

      // [ESCANEO-API CORTE 1] La clave del par (portal, carpeta) en la que vive una clase en
      // disco (`raíz/<portal>/<carpeta>/`). Vive en UNA función porque la usan los dos lados —
      // el que pide los listados y el que los cruza— y si divergieran el match fallaría entero,
      // en silencio y con toda la lista dando "pendiente".
      const clavePar = (clase) => {
        const idPortal = sitios.obtener(clase && clase.sitioId)?.id;
        if (!idPortal) return null; // huérfano: no sabemos en qué carpeta de portal buscar
        return `${idPortal}|${clase.carpeta || subcarpetaFiltro}`;
      };

      // Inyectores lógicos del resolvedor final de nombres
      //
      // [ESCANEO-API CORTE 1] Recibe un MAPA `par → archivos`, no una lista aplanada. Antes se
      // volcaban en un solo Set los archivos de todas las carpetas, así que un `Miologia 1.mp4`
      // bajado en `miembro_superior/` marcaba como descargada también a la de `miembro_inferior/`
      // — que nunca se bajaba (riesgo R5). Con un módulo por portal el aplanado era inocuo;
      // con once, no.
      const resolverMapeoEnUI = (archivosPorPar) => {
        try {
          appState.listadoClasesGlobal.forEach(clase => {
            if (clase.estado === 'process') return;

            const setArchivosNormalizados = archivosPorPar.get(clavePar(clase));
            // Sin listado para su par (huérfana, o la carpeta no se pudo escanear) la clase
            // queda pendiente: es el default seguro. Darla por descargada la escondería.
            if (!setArchivosNormalizados) {
              clase.estado = 'pending';
              clase.seleccionado = perteneceASeleccionFaceta(clase);
              return;
            }

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
          
            clase.seleccionado = !yaExiste && perteneceASeleccionFaceta(clase);
          });

          appState.sincronizacionDiscoCompletada = true;
          desbanearFiltros();
          appState.respaldar(); 
        
          nodos.queueBadge.textContent = appState.listadoClasesGlobal.filter(c => c.estado === 'process').length;
          nodos.masterCheck.checked = appState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending').every(i => i.seleccionado);

          configurarBotonesUX("descargar", "Agregar seleccionados a la cola 📥", false);
          aplicarFiltrosCruzados();
          actualizarContadoresBoton();
        } catch (err) {
          console.error("❌ Error en empaquetado de sincronización:", err);
        } finally {
          ListaClases.setAtenuada(false);
        }
      };

      // ─── PIPELINE DE LECTURA DE DATOS (MULTIPLE O BUN SERVER DIRECTO) ────────
      // [MULTIPORTAL E] Se escanea por PAR (portal, materia), no por materia sola: en disco la
      // ruta es `raíz/<portal>/<materia>/`, así que pedir sólo la materia miraría la carpeta
      // equivocada — y la extensión daría por no descargado todo lo que sí está.
      //
      // El portal sale del descriptor de cada clase (con la migración aplicada) y no del campo
      // crudo, así que una clase anterior al multi-sitio se busca en la carpeta del legado.
      const paresUnicos = new Map();
      appState.listadoClasesGlobal.forEach(c => {
        const clave = clavePar(c);
        if (!clave) return; // huérfano
        paresUnicos.set(clave, { idPortal: sitios.obtener(c.sitioId).id, carpeta: c.carpeta || subcarpetaFiltro });
      });
      if (paresUnicos.size === 0) {
        const idPortal = sitioActivo.id;
        paresUnicos.set(`${idPortal}|${subcarpetaFiltro}`, { idPortal, carpeta: subcarpetaFiltro });
      }

      try {
        // El resultado de cada par se queda ATADO a su par (antes se aplanaba). El `.catch`
        // devuelve el par con lista vacía en vez de nada, para que una carpeta que no se pudo
        // leer se distinga de una carpeta vacía... y para que las demás igual se crucen.
        const promesas = Array.from(paresUnicos.entries()).map(([clave, { idPortal, carpeta: carp }]) =>
          backend.escanearDisco(carp, idPortal)
            .then(data => [clave, data?.archivos || []])
            .catch(e => {
              if (e instanceof TypeError || e.message?.includes("fetch") || e.message?.includes("connect")) {
                throw e;
              }
              console.warn(`⚠️ No se pudo escanear la carpeta ${idPortal}/${carp}:`, e.message);
              return [clave, []];
            })
        );
        const resultados = await Promise.all(promesas);
        const archivosPorPar = new Map(
          resultados.map(([clave, archivos]) => [
            clave,
            new Set(archivos.map(nom => String(nom).toLowerCase().trim())),
          ])
        );

        // (el puntito de estado lo maneja la isla Preact features/conexionHeader.preact.js)
        const tabsBar = document.querySelector(".tabs-bar");
        if (tabsBar) tabsBar.style.display = "flex";

        resolverMapeoEnUI(archivosPorPar);
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
        const elegidos = appState.listadoClasesGlobal.filter(c => c.seleccionado && c.estado === 'pending');
        if (elegidos.length > 0) encolarItemsEnCaliente(elegidos);
      } else if (modo === 'reintentar-cola') {
        ejecutarReintentoDeCola();
      } else if (modo === 'quitar-de-cola') {
        const seleccionados = appState.colaDescargas.filter(c => c.seleccionado);
        if (seleccionados.length > 0) quitarItemsDeColaEnLote(seleccionados);
      }
    });

    nodos.btnStartQueue.addEventListener('click', () => _queue.iniciarDescargaCola());


    nodos.search.addEventListener('input', aplicarFiltrosCruzados);
    nodos.masterCheck.addEventListener('change', (e) => {
      const check = e.target.checked;

      if (appState.pestañaActiva === "cola") {
        const busqueda = nodos.search.value.toLowerCase().trim();
      
        const visibles = appState.colaDescargas.filter(clase => {
          const esActivo = appState.videoActualEnTransmisiónSW === clase.titulo && appState.ráfagaEnCurso;
          return coincideConFiltrosCola(clase, busqueda) && !esActivo;
        });

        visibles.forEach(c => { c.seleccionado = check; });
      } else {
        if (!appState.sincronizacionDiscoCompletada) return;
        const visibles = appState.listadoClasesGlobal.filter(c => c.visible);
        appState.conmutarSeleccionMasiva(check, visibles);
      }

      // Render state-driven: en vez de sincronizar cada checkbox/fila a mano (getElementById +
      // classList), se muta sólo el estado (arriba) y se repinta el listado desde él. Deja el
      // render como única vía de pintar filas (prep para la isla Preact #4, Etapa 0).
      renderizarListadoInterfaz();
      appState.respaldar();
      actualizarContadoresBoton();
    });

    function renderizarListadoInterfaz() {
      // La isla Preact #4 (features/listaClases.preact.js) es dueña de #ui-list (hijos
      // Y atributos de host, Etapa 2). Este render ya no construye DOM: mantiene la
      // lógica de negocio (sincronizar con la cola, filtrar, ordenar) y EMPUJA un
      // view-model al store window.ListaClases.render(vm).

      if (appState.fallaConexionActiva) {
        // El título proviene del scraping del DOM de Ramón Net (contenido de terceros):
        // se escapa antes de interpolarlo porque la card usa dangerouslySetInnerHTML.
        const titulo = utils.escaparHtml(appState.videoFalladoParaReintento || "clase");
        if (appState.fallaConexionActiva === "sesion") {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'Sesión no iniciada',
            // La copy NO nombra el portal a propósito. Decía "Ramón Net" hardcodeado, y desde
            // que hay dos portales eso es una afirmación falsa la mitad de las veces — el que
            // pausó sale del ÍTEM (ADR-0010), no de la pestaña abierta. El nombre correcto sí
            // viaja en la notificación del SO y en la campanita, que lo reciben del bucle.
            descripcion: `No hay una sesión activa en el portal.<br>Iniciá sesión (o re-escaneá para renovar el acceso) y tocá <strong>Reintentar</strong>.<br><br><strong>Pausado en:</strong> ${titulo}`,
            icono: '🔑'
          }});
        } else if (appState.fallaConexionActiva === "bloqueo") {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'El portal rechazó la descarga',
            descripcion: `El portal rechazó el pedido — <strong>no es tu conexión</strong>.<br>Suele ser el acceso vencido: re-escaneá el portal y tocá <strong>Reintentar</strong>.<br><br><strong>Pausado en:</strong> ${titulo}`,
            icono: '🚧'
          }});
        } else if (appState.fallaConexionActiva === "desconocido") {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'La descarga falló',
            descripcion: `No fue la red ni el servidor local; el motivo no se pudo identificar.<br>Mirá la consola del service worker si se repite.<br><br><strong>Pausado en:</strong> ${titulo}`,
            icono: '⚠️'
          }});
        } else if (appState.fallaConexionActiva === "servidor") {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'Servidor Desconectado',
            descripcion: `El servidor local de Bun se desconectó.<br>Por favor, ejecutá <strong>iniciar.bat</strong> para reanudar.<br><br><strong>Pausado en:</strong> ${titulo}`,
            icono: '🔌'
          }});
        } else {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'error',
            titulo: 'Conexión a Internet Caída',
            descripcion: `Se interrumpió la conexión a internet.<br>La descarga se reanudará automáticamente apenas vuelva la red.<br><br><strong>Pausado en:</strong> ${titulo}`,
            icono: '⚠️'
          }});
        }
        return;
      }
    
      // Sincronizar el estado de disponibles con los elementos en la cola real
      const titulosEnCola = new Set(appState.colaDescargas.map(c => identidadClase.clave(c)));
      appState.listadoClasesGlobal.forEach(c => {
        if (titulosEnCola.has(identidadClase.clave(c))) {
          c.estado = 'process';
        } else if (c.estado === 'process') {
          c.estado = 'pending'; // Regresar a pendiente si ya no está en la cola real
        }
      });

      let filtrados = [];
      // [MULTISITIO CORTE 6A] La clase que se está bajando va SIEMPRE primera y no la tocan ni
      // el filtro ni el orden. Estos dos flags viajan en el vm para que la isla sepa dónde va la
      // línea divisoria y si lo de abajo quedó vacío por el filtro.
      let anclaActiva = false;
      let sinResultados = false;
      if (appState.pestañaActiva === "cola") {
        const busqueda = nodos.search.value.toLowerCase().trim();

        // Se saca ANTES de filtrar: es la fila que más se mira y la única que no se puede
        // permitir que desaparezca por haber filtrado otra cátedra.
        const esLaQueBaja = (clase) =>
          appState.ráfagaEnCurso && clase.titulo === appState.videoActualEnTransmisiónSW;
        const laQueBaja = appState.colaDescargas.find(esLaQueBaja);

        filtrados = appState.colaDescargas.filter(
          clase => !esLaQueBaja(clase) && coincideConFiltrosCola(clase, busqueda)
        );

        // [LA SELECCIÓN SIGUE AL FILTRO] Misma regla que en Disponibles, con el predicado de
        // esta pestaña: lo que el filtro sacó, se deselecciona. Sin esto "Quitar N clases de la
        // fila" contaba —y quitaba— ítems que no estaban en pantalla. Acá el filtrado no deja
        // marca en el ítem (no hay `visible` en la cola), así que se resuelve contra el
        // conjunto recién calculado. La que se está bajando queda fuera por el `esLaQueBaja` de
        // arriba, y eso está bien: no se la puede quitar de la fila igual.
        const visiblesEnCola = new Set(filtrados);
        appState.colaDescargas.forEach((clase) => {
          if (clase.seleccionado && !visiblesEnCola.has(clase)) clase.seleccionado = false;
        });

        // [CORTE 6B] El comparador es de OrdenFeature: sabe de criterio, sentido y de resolver
        // la faceta/portal contra el descriptor de CADA ítem (la cola puede mezclar portales).
        filtrados.sort(_orden.comparador());

        if (laQueBaja) {
          anclaActiva = true;
          // Que el resto quede vacío ya NO es "la lista está vacía": hay una descarga en curso.
          // Sin esto se caería en la tarjeta de "no hay clases" y se perdería la fila anclada.
          sinResultados = filtrados.length === 0;
          filtrados.unshift(laQueBaja);
        }
      } else {
        filtrados = appState.listadoClasesGlobal.filter(c => c.visible);

        // [CORTE 6B] Mismo comparador que la Cola: la feature sabe en qué pestaña está y usa
        // los criterios de cada una. Con el default ('nombre' + ordenAscendente) el resultado
        // es idéntico al orden por título que había acá.
        filtrados.sort(_orden.comparador());
      }

      if (filtrados.length === 0) {
        if (appState.pestañaActiva === "cola") {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'info',
            titulo: 'Fila de descarga vacía',
            descripcion: 'No tenés clases agregadas en esta lista.<br>Volvé a "Clases Disponibles", marcá las clases y agregalas.',
            icono: '📥'
          }});
        } else {
          ListaClases.render({ modo: 'card', card: {
            tipo: 'info',
            titulo: 'No hay clases',
            descripcion: 'No se encontraron clases que coincidan con la búsqueda o el filtro seleccionado.',
            icono: '🔍'
          }});
        }
        return;
      }

      // selectionMode espeja actualizarModoSeleccion: en Disponibles siempre activo;
      // en Cola depende del toggle modoSeleccionFilaActivo.
      const selectionMode = appState.pestañaActiva === "disponibles" ? true : modoSeleccionFilaActivo;

      ListaClases.render({
        modo: 'lista',
        items: filtrados,
        ctx: {
          pestaña: appState.pestañaActiva,
          sincronizado: appState.sincronizacionDiscoCompletada,
          enCurso: appState.ráfagaEnCurso,
          videoActivo: appState.videoActualEnTransmisiónSW,
          anclaActiva,
          sinResultados,
          selectionMode,
          // [ESCANEO-API CORTE 2] El override del input, ya saneado, para que cada fila pueda
          // mostrar a dónde va a ir. **No es adorno**: si el input puede pisar el destino de 103
          // clases, tenés que ver el efecto ANTES de encolar. Escribir algo cambia las 103 filas
          // a la vez y es imposible no verlo.
          overrideCarpeta: utils.sanearNombreCarpeta(nodos.folder.value),
          // El portal DEL ÍTEM, para que la fila pueda pintar su pastilla con el color del
          // portal correcto. Va como función y no como campo de cada clase a propósito: la isla
          // es vista pura y no conoce el registro, y estampar el color en el objeto de estado
          // sería persistir en `listaPersistente` un dato de presentación.
          //
          // Se resuelve con `sitios.obtener` (que aplica la migración) y no comparando el
          // `sitioId` crudo, por lo mismo de siempre: un ítem anterior al multi-sitio es del
          // portal legado, no de "ninguno". Un huérfano devuelve `undefined` y la pastilla cae
          // a su color neutro, que es lo correcto — no sabemos de dónde vino.
          portalDe: (clase) => sitios.obtener(clase && clase.sitioId),
          onCheckChange: (c, check) => {
            c.seleccionado = check;

            if (appState.pestañaActiva === "cola") {
              const busqueda = nodos.search.value.toLowerCase().trim();
              const visibles = appState.colaDescargas.filter(i => i.titulo.toLowerCase().includes(busqueda));
              nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
            } else {
              if (!appState.sincronizacionDiscoCompletada) return;
              nodos.masterCheck.checked = appState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending').every(i => i.seleccionado);
            }

            actualizarContadoresBoton();
            appState.respaldar();
            renderizarListadoInterfaz(); // re-empuja el vm para que la fila refleje seleccionado
          },
          onRemoverClick: (c) => {
            console.log(`🗑️ [UI] Intento de remoción de la fila: "${c.titulo}"`);
          
            const esActivo = appState.videoActualEnTransmisiónSW === c.titulo;
            const esUltimoConRafaga = appState.ráfagaEnCurso && appState.colaDescargas.length <= 1;

            // Determinar si la selección maestro "Todos" estaba activa para heredarla
            const visiblesPendientes = appState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
            const seleccionMaestraActiva = visiblesPendientes.length > 0 && visiblesPendientes.every(i => i.seleccionado);

            if (esActivo || esUltimoConRafaga) {
              // .finally: la limpieza local corre CONTESTE O NO el SW — Chrome invocaba el
              // callback igual ante lastError, y si acá se colgara, la clase quedaría en
              // 'process' y fuera de la cola visible sin forma de recuperarla.
              mensajeria.enviar({ action: "abortar_rafaga_inmediata" }).catch(() => undefined).finally(() => {
                // Remover de la cola local para persistencia correcta
                appState.colaDescargas = appState.colaDescargas.filter(i => !identidadClase.misma(i, c));
                c.estado = 'pending';
                c.seleccionado = seleccionMaestraActiva;

                // Actualizar disponibles
                const matchDisp = appState.listadoClasesGlobal.find(i => i.titulo === c.titulo);
                if (matchDisp) {
                  matchDisp.estado = 'pending';
                  matchDisp.seleccionado = seleccionMaestraActiva;
                }

                nodos.queueBadge.textContent = appState.colaDescargas.length;
                renderizarListadoInterfaz(); // re-render desde estado en vez de div.remove() imperativo
                appState.respaldar();
                restaurarPanelPorInterrupcion("🛑 Descargas detenidas porque se eliminó la clase de la fila.");
              });
              return;
            }

            // Remover de la cola local
            appState.colaDescargas = appState.colaDescargas.filter(i => !identidadClase.misma(i, c));
            renderizarListadoInterfaz(); // re-render desde estado en vez de div.remove() imperativo

            // Actualizar estado en disponibles
            const matchDisp = appState.listadoClasesGlobal.find(i => i.titulo === c.titulo);
            if (matchDisp) {
              matchDisp.estado = 'pending';
              matchDisp.seleccionado = seleccionMaestraActiva;
            }
          
            nodos.queueBadge.textContent = appState.colaDescargas.length;
            appState.respaldar();

            // Igual que arriba: el re-render diferido no depende de que el SW conteste (la UI
            // local ya se actualizó), así que va en .finally.
            // Los CUATRO campos de la identidad, no dos: desde el corte 1 la clave lleva módulo
            // y tipo, y un pedido incompleto no matchea ningún ítem — o sea que "Remover" no
            // remueve nada y no avisa. Ver `docs/patterns.md` §IPC.
            mensajeria.enviar({ action: "remover_item_de_cola", titulo: c.titulo, sitioId: c.sitioId, modulo: c.modulo, tipo: c.tipo })
              .catch(() => undefined)
              .finally(() => {
                setTimeout(aplicarFiltrosCruzados, 100);
              });
          },
        }
      });

    }

    function congelarUIPorDescargaActiva(titulo, pct, tel) {
      appState.videoActualEnTransmisiónSW = titulo;
      appState.ráfagaEnCurso = true;
      document.body.classList.add('downloading');
    
      nodos.txtEstado.innerHTML = "";
      const span = document.createElement('span');
      span.style.color = "var(--accent-orange)";
      span.textContent = titulo;
    
      const prefijo = appState.banderaFrenadoSolicitado ? "Frenando al terminar:" : "Descargando:";
      nodos.txtEstado.append(prefijo, document.createElement('br'), span);

      nodos.btnStartQueue.style.display = 'none';
      nodos.cancelBox.style.display = 'flex';
      nodos.folder.disabled = false;
      nodos.btnExplore.disabled = true;
      if (nodos.turboSwitch) nodos.turboSwitch.disabled = true; 
    
      nodos.btnSoftCancel.disabled = appState.banderaFrenadoSolicitado;
    
      nodos.progressBar.style.width = `${pct}%`;
      nodos.progressCont.style.display = 'block';
      if (tel) renderers.pintarTelemetria(tel, nodos);
      renderizarListadoInterfaz();
      conectarEscuchadoresDelWorker();
    
      actualizarContadoresBoton();
    }

    function conectarEscuchadoresDelWorker() {
      if (desengancharOyenteWorker) {
        desengancharOyenteWorker();
        desengancharOyenteWorker = null;
      }

      desengancharOyenteWorker = mensajeria.onMensaje((req) => {
        if (req.action === "update_progress_bar") {
          let debeReRenderizar = false;
          if (appState.fallaConexionActiva) {
            appState.fallaConexionActiva = null;
            appState.videoFalladoParaReintento = null;
          
            nodos.cancelBox.style.display = 'flex';
            nodos.btnStartQueue.style.display = 'none';
            nodos.progressCont.style.display = 'block';
            if (req.telemetry) nodos.panelTel.style.display = 'flex';
          
            debeReRenderizar = true;
          }

          nodos.progressBar.style.width = `${req.percentage}%`;
        
          if (req.compiling && !appState.modoTurboBun) {
            nodos.txtEstado.innerHTML = "";
            const spanComp = document.createElement('span');
            spanComp.style.color = "var(--accent-warning-visible)";
            spanComp.textContent = `Guardando en /${nodos.folder.value}/ por favor espere...`;
            nodos.txtEstado.append("⚙️ Compilando archivo final...", document.createElement('br'), spanComp);
          } else if (!req.compiling) {
            if (appState.videoActualEnTransmisiónSW !== req.titulo || debeReRenderizar) {
              appState.videoActualEnTransmisiónSW = req.titulo;
              renderizarListadoInterfaz();
              actualizarContadoresBoton();
            }
            nodos.txtEstado.innerHTML = "";
            const spanDesc = document.createElement('span');
            spanDesc.style.color = "var(--accent-orange)";
            spanDesc.textContent = req.titulo;
          
            const prefijo = appState.banderaFrenadoSolicitado ? "Frenando al terminar:" : "Descargando:";
            nodos.txtEstado.append(prefijo, document.createElement('br'), spanDesc);
          
            nodos.btnSoftCancel.disabled = appState.banderaFrenadoSolicitado;
          
            if (req.telemetry) renderers.pintarTelemetria(req.telemetry, nodos);
          }
        }
        if (req.action === "clase_guardada_ok") {
          // Por IDENTIDAD, no por título crudo: con dos portales, `c.titulo === req.titulo`
          // marcaba como 'downloaded' a la homónima del OTRO portal —la que nunca se bajó—.
          // Es la comparación que `identidadClase` vino a reemplazar en todo el proyecto.
          const obj = appState.listadoClasesGlobal.find(c => identidadClase.misma(c, req));
          if (obj) { obj.estado = 'downloaded'; obj.seleccionado = false; }
        
          // También remover de la cola local
          appState.colaDescargas = appState.colaDescargas.filter(c => !identidadClase.misma(c, req));
          appState.respaldar();
        
          nodos.queueBadge.textContent = appState.colaDescargas.length;

          if (req.suaveFrenado) { restaurarPanelPorInterrupcion("🏁 Fila interrumpida de forma segura.", false); return; }
          aplicarFiltrosCruzados();
        }
      
        if (req.action === "clase_con_error") {
          // El SW saltó esta clase (hoy: el backend rechazó sus fragmentos con un 4xx
          // determinístico — bug 400). NO es una caída de conexión: la cola sigue con la
          // próxima. Espeja la limpieza de cola local de "clase_guardada_ok". La clase vuelve
          // a 'pending' (no 'error'): se ve como una pendiente normal y es re-encolable — el
          // fallo se comunica por la campanita + la notificación, no por un estado de fila.
          console.error(`⚠️ [POPUP-ALERT] El SW saltó la clase: ${req.titulo} (${req.motivo})`);
          // Por identidad, mismo motivo que en "clase_guardada_ok".
          const obj = appState.listadoClasesGlobal.find(c => identidadClase.misma(c, req));
          if (obj) { obj.estado = 'pending'; obj.seleccionado = false; }
          appState.colaDescargas = appState.colaDescargas.filter(c => !identidadClase.misma(c, req));
          appState.respaldar();
          nodos.queueBadge.textContent = appState.colaDescargas.length;

          nodos.txtEstado.textContent = "";
          const spanErr = document.createElement('span');
          spanErr.className = "text-danger";
          // textContent, NUNCA innerHTML: req.titulo deriva de contenido scrapeado (regla docs/security.md).
          spanErr.textContent = `Se saltó "${req.titulo}": ${req.motivo}.`;
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
      if (desengancharOyenteWorker) {
        desengancharOyenteWorker();
        desengancharOyenteWorker = null;
      }
    
      const mantenerModoTurbo = appState.modoTurboBun;

      // Restablecer fallas de conexión al cancelar o interrumpir
      appState.fallaConexionActiva = null;
      appState.videoFalladoParaReintento = null;

      if (limpiarCola) {
        appState.limpiarSesionLocal();
      } else {
        appState.ráfagaEnCurso = false;
        appState.videoActualEnTransmisiónSW = "";
        appState.banderaFrenadoSolicitado = false;
        await appState.inicializarSincronizacionStorage();
      }
    
      appState.modoTurboBun = mantenerModoTurbo;
      appState.respaldar();
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
    
      const countRestantes = appState.colaDescargas.length;
      nodos.queueBadge.textContent = countRestantes;
    
      if (!limpiarCola) {
        conmutarPestañaA(appState.pestañaActiva, 
          appState.pestañaActiva === "disponibles" ? 'block' : 'none', 
          appState.pestañaActiva === "cola" ? 'block' : 'none', 
          appState.pestañaActiva === "disponibles" ? 'flex' : 'none'
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

    function actualizarMasterCheckState() {
      if (appState.pestañaActiva === "cola") {
        const busqueda = nodos.search.value.toLowerCase().trim();
        const visibles = appState.colaDescargas.filter(clase => coincideConFiltrosCola(clase, busqueda));
        nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
      } else {
        const visibles = appState.listadoClasesGlobal.filter(i => i.visible && i.estado === 'pending');
        nodos.masterCheck.checked = visibles.length > 0 && visibles.every(i => i.seleccionado);
      }
    }

    function actualizarModoSeleccion() {
      // En Disponibles el modo selección está siempre activo; en Cola depende del toggle.
      // La isla Preact #4 es dueña de la clase .selection-mode del host #ui-list.
      const activo = appState.pestañaActiva === "disponibles" ? true : modoSeleccionFilaActivo;
      ListaClases.setSelectionMode(activo);
    }

    // Envoltorio: el cálculo no cambió, pero cualquiera de sus ~8 salidas puede haber movido
    // `btnStartQueue` —que `configurarBotonesUX` no ve— así que el footer se re-mide DESPUÉS,
    // una sola vez y sin depender de que cada rama se acuerde. Ver `sincronizarFooterVacio`.
    function actualizarContadoresBoton() {
      calcularContadoresBoton();
      sincronizarFooterVacio();
    }

    function calcularContadoresBoton() {
      actualizarMasterCheckState();
      actualizarModoSeleccion();

      // [ALERTA ⇒ NINGUNA ACCIÓN] Va PRIMERO, antes que cualquier otra rama, porque manda sobre
      // la pestaña y sobre la selección: con la alerta de conexión en pantalla no hay nada que
      // el usuario pueda hacer desde el footer —no se puede iniciar una descarga contra un
      // servidor que no está, ni encolar contra una lista que no se ve—.
      //
      // Sin esto, el estado del footer lo decidía la PESTAÑA: pasar a Fila mostraba "Iniciar
      // descarga masiva 🚀" y volver a Clases mostraba "Seleccioná clases", los dos con el
      // servidor caído. La función miraba `fallaConexionActiva` (la cola pausada) y no sabía
      // que existe la otra alerta, que es un estado distinto y más grave.
      //
      // Los dos botones se van juntos: `btnStartQueue` lo enciende `conmutarPestañaA` sin
      // consultar nada, así que apagarlo acá —que corre después— es lo que cierra el paso.
      if (BannerConexion.get().visible) {
        configurarBotonesUX("sincronizar-disco", "", true); // sin label ⇒ oculto
        nodos.btnStartQueue.style.display = 'none';
        nodos.masterCheck.disabled = true;
        return;
      }

      if (appState.fallaConexionActiva) {
        // [BANNER DUEÑO DEL DIAGNÓSTICO] Un solo texto para los cinco tipos de pausa, y es un
        // VERBO. Antes había cuatro variantes que le repetían al usuario lo que la card de
        // arriba ya le estaba diciendo con más detalle ("Reintentar conexión con servidor" vs.
        // "Servidor Desconectado", "Iniciar sesión y reintentar" vs. "Iniciá sesión … y tocá
        // Reintentar"). Dos textos para un mismo hecho es un lugar de más donde envejecer:
        // el diagnóstico y el qué-hacer viven en la card (renderizarListadoInterfaz), el
        // botón sólo ofrece la acción.
        configurarBotonesUX("reintentar-cola", "Reintentar 🔄", reintentandoColaActivo);
        nodos.btnAction.style.display = 'block';
        nodos.btnStartQueue.style.display = 'none';
        nodos.masterCheck.disabled = true;
        return;
      }

      if (appState.pestañaActiva !== "disponibles") {
        const seleccionadosEnCola = appState.colaDescargas.filter(c => c.seleccionado).length;
      
        // Permitir habilitar masterCheck en la fila siempre
        nodos.masterCheck.disabled = false;

        if (seleccionadosEnCola > 0 && !appState.ráfagaEnCurso) {
          configurarBotonesUX("quitar-de-cola", `Quitar ${seleccionadosEnCola} clases de la fila 🗑️`, false);
          nodos.btnAction.style.display = 'block';
          nodos.btnStartQueue.style.display = 'none';
        } else {
          nodos.btnAction.style.display = 'none';
          nodos.btnStartQueue.style.display = appState.ráfagaEnCurso ? 'none' : 'block';
        
          if (verificandoConexionBoton) {
            nodos.btnStartQueue.disabled = true;
            nodos.btnStartQueue.innerHTML = `<span class="spinner-inline"></span> Verificando conexión...`;
          } else {
            nodos.btnStartQueue.disabled = (appState.colaDescargas.length === 0);
            if (!appState.ráfagaEnCurso) {
              nodos.btnStartQueue.innerHTML = "Iniciar descarga masiva 🚀";
            }
          }
        }
        return;
      }
    
      nodos.btnStartQueue.style.display = 'none';
    
      const modoActual = nodos.btnAction.getAttribute('data-modo');
      if (modoActual === 're-escanear') return; 

      if (!appState.sincronizacionDiscoCompletada) {
        // `isOffline` equivale a "el banner de conexión está en pantalla": el input de carpeta
        // sólo se deshabilita en activarEstadoOfflineUI y se rehabilita al reconectar.
        const isOffline = nodos.folder.disabled;
        // [BOTÓN SEGÚN HAYA ALGO QUE HACER] Con el banner puesto no hay ninguna acción: no se
        // puede sincronizar contra un servidor que no está, y la reconexión es automática. El
        // label vacío lo saca de pantalla (ver `configurarBotonesUX`). Decía
        // "Buscando servidor... ⏳", que además de ofrecer una acción inexistente era la
        // tercera copia de lo que ya dicen la card y su pulso.
        configurarBotonesUX("sincronizar-disco", isOffline ? "" : "Sincronizar carpeta local 📂", isOffline);
        nodos.masterCheck.disabled = true;
        return;
      }

      const seleccionadas = appState.listadoClasesGlobal.filter(c => c.seleccionado && c.estado === 'pending');
      const sel = seleccionadas.length;

      // [ESCANEO-API CORTE 2] El botón DICE el destino. Es la segunda mitad del feedback del
      // override: el chip por fila muestra el efecto en la lista, y esto lo confirma en el
      // mismo click que lo aplica. Sin esto, encolar 103 clases con el input tocado sin querer
      // se descubre recién mirando el disco.
      const textoDestino = () => {
        const override = utils.sanearNombreCarpeta(nodos.folder.value);
        if (override) return ` → /${override}/`;
        // "por módulo" sólo si de verdad hay módulos: en un portal de un solo nivel esa frase
        // no significaría nada.
        return seleccionadas.some(c => c.modulo) ? " → por módulo" : "";
      };
      const textoBoton = sel === 0
        ? "Seleccioná clases"
        : `Agregar ${sel} clases a la fila 📥${textoDestino()}`;

      if (appState.ráfagaEnCurso) {
        configurarBotonesUX("descargar", textoBoton, sel === 0);
        nodos.btnAction.style.display = 'block';
        nodos.masterCheck.disabled = false;
      } else {
        nodos.txtEstado.innerHTML = "";

        configurarBotonesUX("descargar", textoBoton, sel === 0);
        nodos.btnAction.style.display = 'block';
        nodos.masterCheck.disabled = false;
      }
    }

    function configurarBotonesUX(modo, txt, dis) {
      nodos.btnAction.setAttribute('data-modo', modo);
      nodos.btnAction.className = `btn-action modo-${modo}`;
      nodos.btnAction.textContent = txt;
      nodos.btnAction.disabled = dis;
      // [BOTÓN SEGÚN HAYA ALGO QUE HACER] Sin label no se muestra. Pasar "" es cómo se dice
      // "en este estado no hay ninguna acción" — hoy, el banner de conexión: la reconexión la
      // maneja el daemon solo. Con la cola pausada SÍ hay acción ("Reintentar 🔄") y el botón
      // aparece. La regla vive ACÁ y no en los ~12 call-sites: si la visibilidad se decidiera
      // afuera, basta que uno se olvide para dejar el botón escondido con una acción adentro,
      // o vacío en pantalla. Excepción única y explícita: la sincronización de disco, que
      // escribe su label con innerHTML por el spinner y restaura el display ahí mismo.
      nodos.btnAction.style.display = txt ? 'block' : 'none';
      sincronizarFooterVacio();
    }

    // [FOOTER VACÍO] Con el botón oculto (sin acción que ofrecer) y el texto de estado vacío
    // —que se colapsa solo por `.status-text:empty`— el footer se queda sin contenido y lo
    // único que se ve es su `border-top`: una línea divisoria que no divide nada y que se lee
    // como un botón roto. No se puede resolver con `:empty` en CSS, porque los hijos siguen
    // existiendo: están ocultos. Se mira cuál quedó visible y se marca el footer.
    //
    // Se llama desde los dos embudos por los que pasa cualquier cambio del footer
    // (`configurarBotonesUX` y `actualizarContadoresBoton`) y no desde cada call-site, por el
    // mismo motivo que la visibilidad del botón vive en el helper: uno olvidado deja la línea.
    /**
     * [BLOQUEO REAL] Bloquea o libera las dos regiones que quedan a la vista mientras una
     * alerta ocupa el contenedor: la path-bar (📁 PC / 📚 Materia / faceta) y la toolbar. Más
     * la caja de cancelar, que sigue en pantalla si hay una descarga a medias.
     *
     * **Nada se esconde**: se ven, apagadas, y no operan. Y el bloqueo es el ATRIBUTO
     * `disabled`, no un `pointer-events: none` — que frena el mouse y deja pasar el teclado
     * (se podía tabular al input de materia y escribir, o marcar "Todos" con Espacio).
     * El único que no admite `disabled` es el badge de la faceta, que es un `<span>`: se le
     * marca `aria-disabled` y `faceta.js` lo respeta en su listener.
     *
     * Existe como función y no como dos líneas en cada call-site porque los dos estados de
     * alerta —el banner de conexión y la cola pausada— tenían distinto alcance: uno
     * deshabilitaba seis controles y el otro ninguno, así que el mismo bloque bloqueado se
     * comportaba distinto según qué hubiera fallado.
     */
    function bloquearRegionesDeAlerta(bloquear) {
      const pathBar = document.querySelector('.path-bar');
      [pathBar, nodos.filtersBar, nodos.cancelBox].forEach((n) => n && n.classList.toggle('bloqueada', bloquear));

      const controles = [
        nodos.folder, nodos.btnExplore,
        nodos.search, nodos.btnFilterPills, nodos.btnSort, nodos.masterCheck, nodos.btnToggleSelect,
        nodos.btnSoftCancel, nodos.btnHardCancel,
      ];
      // Lo que NO es un control de formulario no admite `disabled`, así que lleva
      // `aria-disabled`: el badge de la faceta es un <span> y el "Todos" es un <label>. El CSS
      // de `.bloqueada` los apaga con `pointer-events` a partir de ese atributo —única forma
      // de matarles el `cursor: pointer` y el hover— y `faceta.js` lo respeta en su listener.
      // Es el mismo bloqueo, expresado en la forma que cada elemento admite.
      [nodos.facetaBadge, document.getElementById('ui-master-select-wrapper')]
        .forEach((n) => n && n.setAttribute('aria-disabled', String(bloquear)));

      if (bloquear) {
        controles.forEach((c) => { if (c) c.disabled = true; });
        return;
      }

      // Liberar NO es "habilitar todo": cada control tiene su propia condición y ponerlos en
      // `false` a ciegas habilitaría el buscador sin lista o "Todos" sin sincronizar. Se
      // delega en quien ya sabe — `desbanearFiltros` para la toolbar — y se restauran a mano
      // sólo los que dependen del estado de conexión o de la ráfaga.
      if (nodos.folder) nodos.folder.disabled = false;
      if (nodos.btnExplore) nodos.btnExplore.disabled = false;
      desbanearFiltros();
      if (nodos.btnSoftCancel) nodos.btnSoftCancel.disabled = appState.banderaFrenadoSolicitado;
      if (nodos.btnHardCancel) nodos.btnHardCancel.disabled = false;
    }

    function sincronizarFooterVacio() {
      const footer = document.querySelector('.footer-panel');
      if (!footer) return;
      const hayAlgo = [...footer.children].some((el) => getComputedStyle(el).display !== 'none');
      footer.classList.toggle('vacia', !hayAlgo);
    }

    function mostrarAlertDeConexionCaida(errorType, titulo) {
      appState.fallaConexionActiva = errorType;
      appState.videoFalladoParaReintento = titulo;
      appState.videoActualEnTransmisiónSW = titulo;
    
      nodos.cancelBox.style.display = 'none';
      nodos.btnStartQueue.style.display = 'none';
      nodos.progressCont.style.display = 'none';
      nodos.panelTel.style.display = 'none';

      // [BANNER OCUPA LISTA + TOOLBAR] La card de pausa se pinta DENTRO de #ui-list, así que
      // sin esto la barra de filtros quedaba viva encima de ella: buscador, filtros, orden y
      // "Todos" habilitados, operando sobre una lista que no está en pantalla.
      //
      // Se BLOQUEA, no se esconde: esconderla mueve todo de lugar en cada caída y en cada
      // reconexión del auto-heal. Atenuada e inerte se lee como "ahora no". Las pestañas
      // quedan operativas a propósito: la cola tiene que seguir siendo consultable mientras
      // está pausada, que es justo lo que uno quiere mirar cuando algo falló.
      //
      // [UN SOLO BLOQUEO] La path-bar va junto con la toolbar y con la misma clase. Antes no
      // entraba acá —sólo se bloqueaba con el banner de conexión, y con otro nombre
      // (`.offline`)—, así que con la cola pausada quedaban dos comportamientos distintos para
      // el mismo estado: los filtros inertes y, al lado, el input de materia y el badge de la
      // faceta vivos sobre una lista que no está en pantalla.
      bloquearRegionesDeAlerta(true);

      conectarEscuchadoresDelWorker();
    
      // Simplemente volver a renderizar y actualizar el botón en la pestaña activa sin redirigir
      renderizarListadoInterfaz();
      actualizarContadoresBoton();
    
      // Iniciar monitoreo para esperar la reconexión activa
      iniciarMonitoreoServidor();
    }

    // [MULTISITIO CORTE 6B] `actualizarIconoSorteo` pasó a ser `_orden.actualizarBoton()`.
    // Este alias se conserva porque lo llaman dos call-sites (el cambio de pestaña y la
    // reconexión) y renombrarlos no aporta nada.
    function actualizarIconoSorteo() {
      _orden.actualizarBoton();
    }

    // La lógica de la faceta (badge, autoselección silenciosa, asistente, modal y el
    // listener del badge) vive en features/faceta.js, cableada más arriba como _faceta
    // (window.FacetaFeature.crear) con el descriptor de sitio. Cerró la Fase 2 del
    // split (ADR-0005) y es la primera pieza de la Capa 2 (ADR-0008).

    // El onboarding (overlay, carrusel, botón de ayuda y "Seleccionar Carpeta" del tour)
    // vive ahora en la isla Preact features/onboarding.preact.js, cableada más arriba
    // como _onboardingFeature (window.OnboardingFeature.crear).
  });
}
