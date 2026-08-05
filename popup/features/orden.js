/**
 * FEATURE: ORDEN DE LA PESTAÑA COLA (V1.0.0)
 * ==========================================================================
 * Corte 6b del multi-sitio. Se lleva las tres piezas del orden que vivían sueltas en el núcleo
 * de `popup.js` —el listener del botón, el comparador y la etiqueta— que era justamente la zona
 * sin tests (ADR-0005). Extraerlas no es prolijidad: es lo que las pone bajo cobertura.
 *
 * Qué cambia respecto de lo que había: el botón dejaba ciclar a ciegas entre tres estados
 * (fila → semana ↑ → semana ↓). Ahora las dos preguntas están separadas — **criterio** (llegada,
 * nombre, faceta, portal) y **sentido** (un ↑↓ propio) — con dos consecuencias:
 *
 *   - **LIFO deja de ser un criterio**: es "de llegada" invertido. Y cada criterio que se sume
 *     después trae sus dos sentidos gratis, sin agregar filas al panel.
 *   - El botón muestra los dos juntos ("Fila ↑"), así se lee el orden sin abrir nada.
 *
 * Reglas que no son obvias y conviene no desandar:
 *
 * - **El criterio es de la pestaña Cola, no global.** Disponibles sigue ordenando por título con
 *   `appState.ordenAscendente`, exactamente como antes. El tri-estado viejo servía a las dos
 *   pestañas con semánticas distintas (ver la migración en `core/estado/appState.ts`), así que
 *   la Cola tiene su propio par de campos y Disponibles quedó intacta.
 * - **`faceta` y `portal` se resuelven contra el descriptor de CADA ítem** vía `ctx.sitios`, no
 *   contra un sitio fijo: la cola puede mezclar portales (ADR-0010). Resolver con el portal
 *   equivocado devuelve un valor plausible y falso, que es el bug del corte 4.
 * - **`portal` ordena por portal y, dentro de cada uno, por llegada.** Elegirlo es *agrupar*, no
 *   reordenar: si además saltara a alfabético, un click estaría cambiando dos cosas. Para
 *   alfabético ya está `nombre`, y así los criterios quedan ortogonales.
 * - **La etiqueta del criterio de faceta sale del descriptor** cuando hay un solo portal en la
 *   cola ("Cátedra"), y es genérica cuando hay mezcla ("Faceta"): con dos portales el eje no
 *   tiene un nombre único, y la UI no puede hardcodear el vocabulario de uno (ADR-0008).
 * - **`portal` sólo se ofrece si la cola está mezclada.** Con un portal no ordena nada.
 *
 * Dependencias por ctx (patrón ADR-0005):
 *   - ctx.nodos       : usa btnSort y sortMenu.
 *   - ctx.appState    : lee/escribe criterioOrdenCola + ordenColaAscendente, y respalda.
 *   - ctx.sitios      : resolvedor por `sitioId` (el compartido de la composición).
 *   - ctx.renderizar(): re-render del listado tras cambiar el orden.
 *
 * Expone: comparador(), renderizarMenu(), actualizarBoton(), alternarMenu(), cerrarMenu().
 */
const OrdenFeature = {
  crear(ctx) {
    const { nodos, appState, sitios, renderizar } = ctx;

    /** El portal de un ítem de la cola, con la migración ya aplicada por el resolvedor. */
    const portalDe = (item) => sitios.obtener(item && item.sitioId);

    /** El valor de la faceta de un ítem, derivado con el descriptor de SU portal. */
    const facetaDe = (item) => {
      const faceta = portalDe(item)?.faceta;
      return faceta ? (faceta.leerDeCola(item) ?? "") : "";
    };

    const porTitulo = (a, b) =>
      a.titulo.localeCompare(b.titulo, undefined, { numeric: true, sensitivity: "base" });

    const porLlegada = (a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0);

    /** ¿La cola tiene ítems de más de un portal? Decide si `portal` se ofrece como criterio. */
    function colaMezclada(cola) {
      const ids = new Set((cola || []).map((c) => (c && c.sitioId) || ""));
      return ids.size > 1;
    }

    /**
     * Comparador para la pestaña Cola, ya con el sentido aplicado.
     *
     * El desempate por llegada en `faceta` y `portal` no es decorativo: sin él, dos ítems de la
     * misma cátedra quedan en un orden que depende del sort del motor, y la lista se reacomoda
     * sola entre renders sin que el usuario haya tocado nada.
     */
    function comparador() {
      const criterio = appState.criterioOrdenCola || "llegada";
      const signo = appState.ordenColaAscendente === false ? -1 : 1;

      const base = {
        llegada: porLlegada,
        nombre: porTitulo,
        faceta: (a, b) =>
          facetaDe(a).localeCompare(facetaDe(b), undefined, { numeric: true }) || porLlegada(a, b),
        portal: (a, b) => {
          const na = portalDe(a)?.nombre || "";
          const nb = portalDe(b)?.nombre || "";
          return na.localeCompare(nb) || porLlegada(a, b);
        },
      }[criterio] || porLlegada;

      return (a, b) => signo * base(a, b);
    }

    /** Los criterios ofrecibles, con su etiqueta ya resuelta contra el portal (o genérica). */
    function criteriosDisponibles() {
      const cola = appState.colaDescargas || [];
      const mezclada = colaMezclada(cola);

      // Con un solo portal la etiqueta sale de su descriptor ("Cátedra"); con mezcla no hay un
      // nombre único posible y se cae a lo genérico.
      const primero = cola.length ? portalDe(cola[0]) : sitios.obtener(undefined);
      const etiquetaFaceta = mezclada ? "Faceta" : (primero?.faceta?.etiqueta || "Faceta");

      const lista = [
        { id: "llegada", etiqueta: "De llegada", corta: "Fila" },
        { id: "nombre", etiqueta: "Nombre", corta: "Nombre" },
        { id: "faceta", etiqueta: etiquetaFaceta, corta: etiquetaFaceta },
      ];
      if (mezclada) lista.push({ id: "portal", etiqueta: "Portal", corta: "Portal" });
      return lista;
    }

    function elegirCriterio(id) {
      appState.criterioOrdenCola = id;
      appState.respaldar();
      actualizarBoton();
      renderizarMenu();
      renderizar();
    }

    function elegirSentido(ascendente) {
      appState.ordenColaAscendente = ascendente;
      appState.respaldar();
      actualizarBoton();
      renderizarMenu();
      renderizar();
    }

    /** Pinta el panel. Mismo mecanismo de secciones que el popover de filtros. */
    function renderizarMenu() {
      if (!nodos.sortMenu) return;
      nodos.sortMenu.innerHTML = "";

      const criterios = criteriosDisponibles();
      // Si la cola dejó de estar mezclada, `portal` ya no se ofrece: hay que sacarlo de encima
      // o el orden queda apuntando a un criterio que el panel no muestra.
      if (!criterios.some((c) => c.id === appState.criterioOrdenCola)) {
        appState.criterioOrdenCola = "llegada";
        appState.respaldar();
      }

      const seccion = document.createElement("div");

      const cabecera = document.createElement("div");
      cabecera.className = "orden-cabecera";

      const titulo = document.createElement("span");
      titulo.className = "popover-section-title sin-borde";
      titulo.textContent = "Orden";
      cabecera.appendChild(titulo);

      const direccion = document.createElement("div");
      direccion.className = "orden-direccion";
      direccion.setAttribute("role", "group");
      direccion.setAttribute("aria-label", "Sentido del orden");

      [
        { dir: true, txt: "↑", title: "Ascendente" },
        { dir: false, txt: "↓", title: "Descendente" },
      ].forEach(({ dir, txt, title }) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dir-btn" + (appState.ordenColaAscendente !== false === dir ? " activo" : "");
        b.textContent = txt;
        b.title = title;
        b.setAttribute("aria-pressed", String(appState.ordenColaAscendente !== false === dir));
        b.addEventListener("click", () => elegirSentido(dir));
        direccion.appendChild(b);
      });

      cabecera.appendChild(direccion);
      seccion.appendChild(cabecera);

      criterios.forEach((c) => {
        const op = document.createElement("div");
        op.className = "popover-option";
        op.setAttribute("role", "radio");
        op.setAttribute("aria-checked", String(appState.criterioOrdenCola === c.id));

        const radio = document.createElement("span");
        radio.className = "radio-orden" + (appState.criterioOrdenCola === c.id ? " marcado" : "");
        op.appendChild(radio);
        op.appendChild(document.createTextNode(c.etiqueta));

        op.addEventListener("click", () => elegirCriterio(c.id));
        seccion.appendChild(op);
      });

      if (appState.criterioOrdenCola === "portal") {
        const pie = document.createElement("div");
        pie.className = "orden-pie";
        pie.textContent = "Dentro de cada portal, por orden de llegada.";
        seccion.appendChild(pie);
      }

      nodos.sortMenu.appendChild(seccion);
    }

    /**
     * La etiqueta del botón. En Cola muestra criterio + sentido; en Disponibles conserva el
     * texto de siempre, porque esa pestaña sigue con el orden por título de antes.
     */
    function actualizarBoton() {
      if (!nodos.btnSort) return;

      if (appState.pestañaActiva !== "cola") {
        nodos.btnSort.textContent = appState.ordenAscendente ? "Sem. ↑" : "Sem. ↓";
        nodos.btnSort.title = appState.ordenAscendente
          ? "Orden: Semanas más viejas primero (Ascendente)"
          : "Orden: Semanas más nuevas primero (Descendente)";
        return;
      }

      const criterio = criteriosDisponibles().find((c) => c.id === appState.criterioOrdenCola);
      const flecha = appState.ordenColaAscendente === false ? " ↓" : " ↑";
      nodos.btnSort.textContent = (criterio ? criterio.corta : "Fila") + flecha;
      nodos.btnSort.title = `Orden: ${criterio ? criterio.etiqueta : "De llegada"}${flecha}`;
    }

    function menuAbierto() {
      return Boolean(nodos.sortMenu && nodos.sortMenu.style.display === "flex");
    }

    function cerrarMenu() {
      if (nodos.sortMenu) nodos.sortMenu.style.display = "none";
      if (nodos.btnSort) nodos.btnSort.classList.remove("active");
    }

    function abrirMenu() {
      renderizarMenu();
      if (nodos.sortMenu) nodos.sortMenu.style.display = "flex";
      if (nodos.btnSort) nodos.btnSort.classList.add("active");
    }

    function alternarMenu() {
      if (menuAbierto()) cerrarMenu();
      else abrirMenu();
    }

    // El botón hace dos cosas distintas según la pestaña, y es deliberado: el panel de criterios
    // es un asunto de la Cola. En Disponibles conserva el toggle ascendente/descendente que ya
    // tenía, porque ahí no hay más de un criterio posible.
    if (nodos.btnSort) {
      nodos.btnSort.addEventListener("click", () => {
        if (appState.pestañaActiva === "cola") {
          alternarMenu();
          return;
        }
        appState.ordenAscendente = appState.ordenAscendente === null ? true : !appState.ordenAscendente;
        appState.respaldar();
        actualizarBoton();
        renderizar();
      });
    }

    return { comparador, renderizarMenu, actualizarBoton, alternarMenu, cerrarMenu, criteriosDisponibles };
  },
};

// Sin `globalThis`: desde la Fase 8a los módulos hermanos viajan por `import` y no son
// adaptadores intercambiables. Publicar el global acá sería desandar esa fase.
export default OrdenFeature;
