/**
 * CLON DOWNLOADHELPER - FEATURE: FACETA DEL LISTADO (V2.2.0)
 * ==========================================================================
 * CHANGELOG v2.2.0:
 * - [MULTIPORTAL A] `valoresPresentes()` mira sólo las clases del portal activo, vía el nuevo
 *   `ctx.sitios`. El listado puede traer ítems encolados de otro portal y derivarles la faceta
 *   con este descriptor ofrecía en el modal valores que no existen — sin fallar, porque el
 *   parser siempre devuelve algo.
 * CHANGELOG v2.1.0:
 * - [MULTISITIO CORTE 5] `ctx.sitio` pasa de ser el descriptor a ser una FUNCIÓN que lo
 *   devuelve. El popup ya no tiene un portal fijo: lo resuelve por pestaña, así que puede
 *   cambiar entre dos escaneos. Capturar el descriptor al crear la feature —como se hacía—
 *   la dejaría clasificando con el vocabulario del portal anterior, sin error visible.
 * CHANGELOG v2.0.0:
 * - [CAPA 2] Generalizada: era `catedra.js` / `CatedraFeature`, con "Cátedra",
 *   "COMUN" y el copy del modal hardcodeados. Ahora el mecanismo es agnóstico del
 *   sitio y recibe el descriptor por `ctx.sitio` (ver sitio/ramonnet/config.js).
 *   Mismo comportamiento: los strings que produce salen del descriptor y son los
 *   de antes. Renombres: actualizarBadgeCatedra → actualizarBadge,
 *   aplicarSeleccionCatedraSilencioso → aplicarSeleccionSilenciosa,
 *   verificarYMostrarAsistenteMulticatedra → verificarYMostrarAsistente.
 * CHANGELOG v1.0.0:
 * - [SPLIT] Extraída de popup.js toda la lógica de cátedra (badge, autoselección,
 *   asistente multicátedra y su modal). Cerró la Fase 2 del split feature-driven
 *   (ver ADR-0005, docs/ROADMAP.md).
 * ==========================================================================
 * QUÉ HACE
 * --------
 * Implementa el mecanismo genérico de "faceta": si el listado scrapeado trae más de
 * un valor en el eje de clasificación del sitio, le pregunta UNA vez al usuario cuál
 * le corresponde (modal), autoselecciona los items de ese valor + los comunes, y deja
 * un badge en la cabecera para volver a abrir la elección. Nada acá sabe qué es una
 * "cátedra": eso lo aporta `ctx.sitio.faceta`.
 *
 * Dependencias que recibe por ctx:
 *   - ctx.sitio()          : FUNCIÓN que devuelve el adaptador del portal de la pestaña
 *                            activa; usa `sitio().faceta`. Ver el changelog v2.1.0.
 *   - ctx.sitios           : resolvedor por `sitioId` (el compartido de la composición), para
 *                            saber de qué portal es cada clase del listado.
 *   - ctx.badge            : nodo del badge de la cabecera (no el mapa `nodos`, para
 *                            que la feature no dependa del nombre de la clave).
 *   - ctx.aplicarFiltros() : re-aplica el filtrado cruzado del listado
 *                            (aplicarFiltrosCruzados, popup.js).
 *
 * Expone: actualizarBadge, aplicarSeleccionSilenciosa, verificarYMostrarAsistente,
 *         perteneceASeleccion.
 */
const FacetaFeature = {
  crear(ctx) {
    const { badge, aplicarFiltros, sitio, sitios, appState } = ctx;

    // [MULTISITIO CORTE 5] `ctx.sitio` es una FUNCIÓN, no el descriptor. Desde este corte el
    // portal lo resuelve el popup por pestaña, así que puede cambiar entre dos escaneos y
    // capturarlo acá —como se hacía— dejaría a esta feature clasificando con el vocabulario
    // del portal anterior. Cada función lo re-lee; el shadowing local mantiene los call-sites
    // como estaban.
    const descriptorFaceta = () => sitio().faceta;

    // Lee/escribe la elección del usuario en appState sin nombrar el concepto del
    // sitio (la clave la declara el descriptor).
    const leerSeleccion = () => appState[descriptorFaceta().claveEstado];
    const fijarSeleccion = (valor) => { appState[descriptorFaceta().claveEstado] = valor; };

    /**
     * [MULTIPORTAL A] Las clases del listado que son del portal activo.
     *
     * `listadoClasesGlobal` no es de un solo portal aunque lo parezca: `popup.js` preserva entre
     * escaneos lo que está en la cola (`estado === 'process'`) y lo mezcla con lo recién
     * escaneado. Sin este filtro, `valoresPresentes()` derivaría la faceta de ítems ajenos con
     * ESTE descriptor y metería valores falsos en el modal — y como el parser devuelve algo,
     * no falla: te ofrece elegir una cátedra que no existe.
     *
     * Se resuelve con el registro y no comparando `sitioId` crudo, porque ausente significa
     * **portal legado** y no "cualquiera" (la distinción del corte 3).
     */
    const clasesDelPortalActivo = () =>
      (appState.listadoClasesGlobal || []).filter(
        (c) => sitios.obtener(c && c.sitioId)?.id === sitio().id
      );

    // Valores específicos presentes en el listado (excluye el valor común, que no es
    // una opción elegible). Unifica las 3 copias del mismo Array.from(new Set(...))
    // que vivían en popup.js.
    function valoresPresentes() {
      const faceta = descriptorFaceta();
      return Array.from(new Set(
        clasesDelPortalActivo()
          .map(c => faceta.leer(c))
          .filter(valor => valor !== faceta.valorComun)
      ));
    }

    // ¿Este item entra en la elección actual? True si no hay elección (no filtra).
    // Vive acá para que popup.js no repita el "valor === elegido || valor === común",
    // que era su último resto de vocabulario del sitio.
    function perteneceASeleccion(clase) {
      const faceta = descriptorFaceta();
      const elegido = leerSeleccion();
      if (!elegido || elegido === faceta.valorTodas) return true;
      const valor = faceta.leer(clase);
      return valor === elegido || valor === faceta.valorComun;
    }

    function actualizarBadge() {
      const faceta = descriptorFaceta();
      refrescarTooltip();
      const tieneVarios = valoresPresentes().length > 1;
      const elegido = leerSeleccion();

      if (tieneVarios && elegido && elegido !== faceta.valorTodas) {
        badge.textContent = faceta.etiquetar(elegido);
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
        // Si el listado dejó de tener varios valores, limpiar el estado para evitar
        // deselecciones silenciosas por una elección que ya no aplica.
        if (!tieneVarios && elegido !== null) {
          fijarSeleccion(null);
          appState.respaldar();
        }
      }
    }

    function aplicarSeleccionSilenciosa(valorElegido) {
      const faceta = descriptorFaceta();
      fijarSeleccion(valorElegido);

      appState.listadoClasesGlobal.forEach(clase => {
        if (clase.estado === 'pending') {
          const valor = faceta.leer(clase);
          clase.seleccionado = (valor === valorElegido || valor === faceta.valorComun);
        }
      });

      appState.respaldar();
      actualizarBadge();
      aplicarFiltros();
    }

    function verificarYMostrarAsistente() {
      const faceta = descriptorFaceta();
      const detectados = valoresPresentes();

      console.log(`[FACETA:${faceta.id}] Valores detectados en el listado:`, detectados);

      if (detectados.length > 1) {
        const elegido = leerSeleccion();
        if (elegido && elegido !== faceta.valorTodas && detectados.includes(elegido)) {
          console.log(`[FACETA:${faceta.id}] -> Aplicando selección persistida:`, elegido);
          aplicarSeleccionSilenciosa(elegido);
          return;
        }
        console.log(`[FACETA:${faceta.id}] -> Varios valores presentes. Mostrando modal.`);
        mostrarModal(detectados);
      } else {
        console.log(`[FACETA:${faceta.id}] -> Uno o ningún valor específico. Reseteando selección.`);
        fijarSeleccion(null);
        appState.respaldar();
        actualizarBadge();
      }
    }

    function mostrarModal(valores) {
      const faceta = descriptorFaceta();
      document.querySelector(".faceta-overlay")?.remove();

      const overlay = document.createElement("div");
      overlay.className = "faceta-overlay";

      const card = document.createElement("div");
      card.className = "faceta-card";

      // El copy sale del descriptor del sitio (no es contenido scrapeado), pero se
      // pinta con textContent igual: el descriptor es DATO, no markup literal de este
      // archivo, así que le aplica la regla anti-XSS (ver docs/security.md).
      const titulo = document.createElement("h4");
      titulo.textContent = faceta.modal.titulo;
      const descripcion = document.createElement("p");
      descripcion.textContent = faceta.modal.descripcion;
      card.append(titulo, descripcion);

      const optionsDiv = document.createElement("div");
      optionsDiv.className = "faceta-options";

      [...valores].sort(faceta.ordenar).forEach(valor => {
        const btn = document.createElement("button");
        btn.className = "btn-faceta-opt";
        btn.textContent = faceta.etiquetar(valor);
        btn.addEventListener("click", () => {
          aplicarSeleccionSilenciosa(valor);
          overlay.remove();
        });
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    }

    // El tooltip también sale del descriptor: era el último string del sitio que
    // quedaba escrito a mano en popup.html.
    //
    // [CORTE 5] Se refresca en cada `actualizarBadge()` y no una sola vez acá: al crearse la
    // feature todavía no se escaneó ninguna pestaña, así que el descriptor de ese momento es
    // el inicial y no necesariamente el del portal que el usuario va a mirar.
    const refrescarTooltip = () => {
      badge.title = `Hacé click para cambiar de ${descriptorFaceta().etiqueta}`;
    };
    refrescarTooltip();

    // Click en el badge: si hay varios valores presentes, reabre el modal de elección.
    badge.addEventListener("click", () => {
      const detectados = valoresPresentes();
      if (detectados.length > 1) {
        mostrarModal(detectados);
      }
    });

    return {
      actualizarBadge,
      aplicarSeleccionSilenciosa,
      verificarYMostrarAsistente,
      perteneceASeleccion,
    };
  }
};

// Exportación (ver docs/coding-standards.md). Desde la Fase 8a NO publica global: los
// módulos hermanos viajan por `import` y no son adaptadores intercambiables. (Hasta el
// 2026-08-05 este comentario decía que "sigue publicando el global", que era falso: la
// 8a lo sacó y el texto quedó.)
export default FacetaFeature;
