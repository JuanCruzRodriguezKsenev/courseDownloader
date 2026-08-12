/**
 * CLON DOWNLOADHELPER - FEATURE: CONEXIÓN AL SERVIDOR BUN (V1.12.0)
 * ==========================================================================
 * CHANGELOG v1.12.0:
 * - [BANNER DUEÑO DEL DIAGNÓSTICO] Murió el mapa ESTADO_OFFLINE: sus `estadoTxt`/`botonTxt`
 *   eran la segunda y la tercera copia de lo que la card de la isla ya dice y explica. El
 *   footer queda vacío y el botón sin label (y con eso, oculto — ver `configurarBotonesUX` en
 *   popup.js): en este estado la reconexión es automática y NO hay acción que ofrecer.
 * - La 1.11.0 NO se salteó: es el corte 1 del copy genérico y está acá abajo. Las dos ramas
 *   se mergearon juntas en `integracion-alertas` el 2026-08-12.
 * ==========================================================================
 * CHANGELOG v1.11.0:
 * - [COPY GENÉRICA — corte 1] "Analizando aula virtual…" → "Analizando…". El texto era
 *   idéntico al de popup.js:573 y este archivo es el camino de RECUPERACIÓN TRAS CAÍDA
 *   DEL SERVER: si se arreglaba uno solo, el usuario veía una copy u otra según por
 *   dónde entrara. Los dos van siempre juntos → docs/copy-generico-diseno.md §5.1.
 *
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
 *   el daemon Conexion (core/conexion/conexion.ts), fuente única de verdad. iniciarDetectorEstado
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
      // [BLOQUEO REAL] Bloquea/libera la path-bar, la toolbar y la caja de cancelar. Vive en
      // popup.js —es dueño de `nodos` y de las condiciones de re-habilitación— y entra por ctx
      // como `configurarBotonesUX`, para que los dos estados de alerta bloqueen IGUAL.
      bloquearRegiones,
      onReintentarCola,
      onReescanearAula,
      appState,
      conexion,
      // FASE 8: los puentes de las islas entran por ctx y no por window. Van por acá y no
      // por un import directo a propósito: los tests inyectan dobles de los tres.
      // [ALERTA EN EL CONTENEDOR] `listaClases` salió de acá: esta feature ya no apaga ni
      // enciende la lista para hacerle lugar al banner. Muestra la alerta en su store y la
      // región se resuelve sola. Sigue llegando por ctx (popup.js) y los tests lo inyectan
      // para poder afirmar justamente que NO se lo toca.
      rutaDisco,
      bannerConexion,
      backend,
    } = ctx;

    // El estado de conexión NO vive acá: lo posee el daemon conexion (core/conexion/conexion.ts).
    // Esta feature sólo se SUSCRIBE a sus cambios y reacciona (UI + recuperación de cola).
    let suscrito = false;
    let previoCompleta = null;  // transición de "ambas conexiones OK" (para recuperación).

    // NOTA: el puntito de estado (statusDot) ya NO se pinta acá — lo posee la isla
    // Preact features/conexionHeader.preact.js, que lo deriva del daemon conexion.

    async function cargarRutaServidorSilencioso() {
      if (!nodos.btnExplore) return;
      try {
        const ruta = await backend.obtenerRutaServidor();
        if (ruta) {
          nodos.btnExplore.title = `Carpeta raíz actual: ${ruta} (Click para cambiar)`;
          rutaDisco.mostrar(ruta);
        }
      } catch (err) {
        console.warn("⚠️ No se pudo conectar al servidor Bun para obtener la ruta raíz:", err);
        rutaDisco.mostrar("Desconectado", "Servidor desconectado");
        nodos.txtEstado.textContent = "❌ Servidor Bun apagado. Enciéndalo en consola para operar.";
      }
    }

    // [BANNER DUEÑO DEL DIAGNÓSTICO] Acá vivía un mapa `estadoTxt`/`botonTxt` por tipo de
    // caída, y era la SEGUNDA Y TERCERA copia del mismo hecho: la card de la isla ya dice
    // "Servidor Desconectado" / "Sin conexión a internet", explica qué hacer y late con
    // "Esperando conexión en puerto 3001...". El footer repetía "⚠️ Servidor Bun
    // desconectado." y el botón "Buscando servidor... ⏳".
    //
    // Ahora el banner es el único que diagnostica. El footer queda vacío y el botón se oculta
    // (`actualizarContadoresBoton` hace lo propio con la rama `isOffline`), porque en este
    // estado NO HAY ACCIÓN que ofrecer: la reconexión la maneja el daemon sola. Un botón
    // deshabilitado que narra lo que ya se lee arriba es ruido, no información.

    // Muestra el banner de conexión caída. `tipo` = "servidor" | "internet".
    function activarEstadoOfflineUI(tipo = "servidor") {
      // (el puntito de estado lo maneja la isla Preact conexionHeader.preact.js)

      // [BLOQUEO REAL] Acá vivía la lista de `disabled` a mano —seis controles, y sólo los de
      // este camino: el de la cola pausada no deshabilitaba ninguno—. Ahora las dos regiones se
      // bloquean por el mismo helper de popup.js, así que el mismo bloque bloqueado se comporta
      // igual haya fallado lo que haya fallado. Nada se esconde: quedan a la vista, apagados y
      // sin operar, teclado incluido.
      bloquearRegiones(true);
      nodos.masterCheck.checked = false;

      // El banner lo pinta la isla Preact #2 (bannerConexion) en su propio root.
      // La lista (#ui-list) se oculta mientras el banner ocupa su lugar (se repuebla
      // al reconectar, en reaccionarAConexion). Ocultar/vaciar lo hace la propia isla
      // #4 vía setOculta (devuelve null → Preact quita los hijos), NO un innerHTML="" +
      // display:none externo que desincronizaría su vdom. mostrar() es idempotente.
      // [ALERTA EN EL CONTENEDOR] Ya no hay que ocultar la lista para hacerle lugar al banner:
      // la alerta se pinta DENTRO de #ui-list y gana sobre la lista en el propio render de la
      // isla. El `setOculta(true)` que había acá era la mitad frágil del arreglo viejo — dos
      // dueños de la misma región puestos de acuerdo a mano, y alcanzaba con que algo tocara el
      // host (una sincronización, un cambio de pestaña) para que la lista volviera abajo.
      bannerConexion.mostrar(tipo);
      nodos.loader.style.display = 'none';

      // El path del disco sólo se pierde si el que cayó es el servidor Bun (localhost).
      if (tipo === "servidor") {
        rutaDisco.mostrar("Desconectado", "Servidor desconectado");
      }
      // El diagnóstico es de la card, no del footer: acá se LIMPIA en vez de duplicarlo.
      nodos.txtEstado.textContent = "";
      // El botón se va: sin label no se muestra (ver `configurarBotonesUX`). Acá NO hay nada
      // que hacer —la reconexión la maneja el daemon solo, y la card lo dice con su pulso—, y
      // un botón deshabilitado en pantalla es una acción que se ofrece y no existe.
      configurarBotonesUX("sincronizar-disco", "", true);

      // La toolbar se BLOQUEA, no se esconde: sus controles no operan sobre nada, pero
      // esconderla mueve todo de lugar en cada caída y en cada reconexión del auto-heal.
      // Las PESTAÑAS quedan activas: cambiar de Clases a Fila sigue siendo legítimo con el
      // servidor caído —la alerta se pinta igual en las dos— y bloquearlas dejaba al usuario
      // sin poder ni mirar su cola.

      // El progreso, si hay una descarga en curso, se queda EN PANTALLA y bloqueado (lo hace el
      // helper): taparlo borraría la única referencia de cuánto se hizo.

      // (el estado del servidor en el onboarding lo deriva la isla Preact del daemon)

      // Asegura que el detector esté corriendo (idempotente; normalmente ya arrancó en el init).
      iniciarDetectorEstado();
    }

    // Reacción a los cambios del daemon conexion (core/conexion/conexion.ts), la fuente única
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
      if (appState.ráfagaEnCurso && !appState.fallaConexionActiva) return;

      const completaAntes = previoCompleta;
      previoCompleta = estado.completa;

      // Recuperación de una cola pausada por error: reanudar apenas vuelve la conexión que
      // faltaba (edge-triggered: conexion notifica sólo en transición).
      if (appState.fallaConexionActiva === "internet" && estado.internet) {
        onReintentarCola();
        return;
      }
      if (appState.fallaConexionActiva === "servidor" && estado.servidor) {
        console.log("🔌 [UI-AUTOHEAL] Servidor Bun recuperado. Reanudando descarga masiva...");
        onReintentarCola();
        return;
      }
      // Cola pausada pero aún falta la conexión: la UI de descarga interrumpida ya se encarga.
      if (appState.fallaConexionActiva) return;

      // Sin cola pausada. Falta alguna conexión (detección pasiva): mostrar el banner del
      // que falte (servidor tiene prioridad). Si ya está el banner correcto, no re-renderiza.
      if (!estado.completa) {
        const tipo = !estado.servidor ? "servidor" : "internet";
        const b = bannerConexion.get();
        if (!b.visible || b.tipo !== tipo) {
          activarEstadoOfflineUI(tipo);
        }
        return;
      }

      // Ambas conexiones OK y veníamos de un banner offline: re-habilitar y re-escanear.
      if (completaAntes !== true) {
        if (bannerConexion.get().visible) {
          // Sacar la alerta ALCANZA: la lista vuelve sola, porque comparten contenedor y es el
          // render de la isla el que elige. Antes había que acordarse de un `setOculta(false)`.
          bannerConexion.ocultar();

          bloquearRegiones(false);

          nodos.txtEstado.textContent = "Analizando...";

          // Se levanta el bloqueo. El `display` ya no se toca acá: la barra nunca se escondió,
          // así que no hay que reconstruir cuál correspondía según la pestaña —que era, además,
          // de donde salía que al reconectar en la Fila la toolbar quedaba distinta.


          cargarRutaServidorSilencioso(); // restaura el path mostrado (PC: ...)
          onReescanearAula();
        }
      }
    }

    // Arranca el daemon de conexión y se suscribe a sus cambios. Idempotente.
    function iniciarDetectorEstado() {
      if (suscrito) return;
      suscrito = true;
      conexion.suscribir(reaccionarAConexion);
      conexion.iniciar();
    }

    return { cargarRutaServidorSilencioso, activarEstadoOfflineUI, iniciarDetectorEstado, reaccionarAConexion };
  }
};

// Exportación (ver docs/coding-standards.md). Desde la Fase 8a NO publica global: los
// módulos hermanos viajan por `import` y no son adaptadores intercambiables. (Hasta el
// 2026-08-05 este comentario decía que "sigue publicando el global", que era falso: la
// 8a lo sacó y el texto quedó.)
export default ServerConnectionFeature;
