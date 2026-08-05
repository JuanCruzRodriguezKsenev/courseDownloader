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
 * **Las dos pestañas usan el mismo panel, con criterios distintos** (unificado el 2026-08-05,
 * después de que la primera versión dejara a Disponibles con el toggle viejo: el mismo botón
 * hacía dos cosas según la pestaña, y eso se notaba al primer uso). Los criterios difieren
 * porque los ejes que existen en cada pestaña difieren:
 *
 *   - Cola: llegada, nombre, faceta, portal.
 *   - Disponibles: nombre, faceta, estado. No hay `llegada` —ese listado no se encoló, se
 *     escaneó— ni `portal`, porque sale del scrapeo de UNA pestaña.
 *
 * Reglas que no son obvias y conviene no desandar:
 *
 * - **Cada pestaña guarda su criterio aparte**, y el sentido también: la Cola tiene
 *   `criterioOrdenCola` + `ordenColaAscendente`; Disponibles, `criterioOrdenDisponibles` +
 *   `ordenAscendente`. El tri-estado viejo servía a las dos con semánticas distintas (ver la
 *   migración en `core/estado/appState.ts`), y separarlos es lo que evita que tocar una dé
 *   vuelta la otra.
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

    const enCola = () => appState.pestañaActiva === "cola";

    /**
     * El valor de la faceta de un ítem, derivado con el descriptor de SU portal.
     *
     * Ojo con los dos accesores del descriptor, que no son intercambiables: `leerDeCola`
     * RE-DERIVA el valor del título (un `ColaItem` no lo persiste), mientras que `leer` lo
     * toma del campo ya parseado que trae una clase del listado.
     */
    const facetaDe = (item) => {
      const faceta = portalDe(item)?.faceta;
      if (!faceta) return "";
      return (enCola() ? faceta.leerDeCola(item) : faceta.leer(item)) ?? "";
    };

    /** Orden de los estados de Disponibles: lo pendiente primero, lo terminado último. */
    const RANGO_ESTADO = { pending: 0, process: 1, downloaded: 2 };

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
      const cola = enCola();
      // El desempate por defecto cambia con la pestaña: en la Cola hay llegada, en Disponibles
      // no existe ese dato y lo natural es el título.
      const desempate = cola ? porLlegada : porTitulo;

      const criterio = cola
        ? appState.criterioOrdenCola || "llegada"
        : appState.criterioOrdenDisponibles || "nombre";

      // `ordenAscendente` puede ser `null` en instalaciones viejas, y ahí significaba
      // DESCENDENTE porque Disponibles sólo miraba su verdad/falsedad. Se conserva ese matiz.
      const signo = cola ? (appState.ordenColaAscendente === false ? -1 : 1) : appState.ordenAscendente ? 1 : -1;

      const base =
        {
          llegada: porLlegada,
          nombre: porTitulo,
          faceta: (a, b) =>
            facetaDe(a).localeCompare(facetaDe(b), undefined, { numeric: true }) || desempate(a, b),
          portal: (a, b) => {
            const na = portalDe(a)?.nombre || "";
            const nb = portalDe(b)?.nombre || "";
            return na.localeCompare(nb) || porLlegada(a, b);
          },
          estado: (a, b) =>
            (RANGO_ESTADO[a.estado] ?? 9) - (RANGO_ESTADO[b.estado] ?? 9) || porTitulo(a, b),
        }[criterio] || desempate;

      return (a, b) => signo * base(a, b);
    }

    /** Los criterios de la pestaña activa, con la etiqueta de faceta ya resuelta. */
    function criteriosDisponibles() {
      const items = enCola() ? appState.colaDescargas || [] : appState.listadoClasesGlobal || [];
      const mezclada = enCola() && colaMezclada(items);

      // Con un solo portal la etiqueta sale de su descriptor ("Cátedra"); con mezcla no hay un
      // nombre único posible y se cae a lo genérico (ADR-0008: la UI no hardcodea vocabulario).
      const primero = items.length ? portalDe(items[0]) : sitios.obtener(undefined);
      const etiquetaFaceta = mezclada ? "Faceta" : primero?.faceta?.etiqueta || "Faceta";

      if (!enCola()) {
        return [
          { id: "nombre", etiqueta: "Nombre", corta: "Nombre" },
          { id: "faceta", etiqueta: etiquetaFaceta, corta: etiquetaFaceta },
          { id: "estado", etiqueta: "Estado", corta: "Estado" },
        ];
      }

      const lista = [
        { id: "llegada", etiqueta: "De llegada", corta: "Fila" },
        { id: "nombre", etiqueta: "Nombre", corta: "Nombre" },
        { id: "faceta", etiqueta: etiquetaFaceta, corta: etiquetaFaceta },
      ];
      if (mezclada) lista.push({ id: "portal", etiqueta: "Portal", corta: "Portal" });
      return lista;
    }

    const criterioActivo = () =>
      enCola() ? appState.criterioOrdenCola || "llegada" : appState.criterioOrdenDisponibles || "nombre";

    const esAscendente = () =>
      enCola() ? appState.ordenColaAscendente !== false : Boolean(appState.ordenAscendente);

    function elegirCriterio(id) {
      if (enCola()) appState.criterioOrdenCola = id;
      else appState.criterioOrdenDisponibles = id;
      appState.respaldar();
      actualizarBoton();
      renderizarMenu();
      renderizar();
    }

    function elegirSentido(ascendente) {
      if (enCola()) appState.ordenColaAscendente = ascendente;
      else appState.ordenAscendente = ascendente;
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
      if (!criterios.some((c) => c.id === criterioActivo())) {
        if (enCola()) appState.criterioOrdenCola = "llegada";
        else appState.criterioOrdenDisponibles = "nombre";
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
        const activo = esAscendente() === dir;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "dir-btn" + (activo ? " activo" : "");
        b.textContent = txt;
        b.title = title;
        b.setAttribute("aria-pressed", String(activo));
        b.addEventListener("click", () => elegirSentido(dir));
        direccion.appendChild(b);
      });

      cabecera.appendChild(direccion);
      seccion.appendChild(cabecera);

      criterios.forEach((c) => {
        const elegido = criterioActivo() === c.id;
        const op = document.createElement("div");
        op.className = "popover-option";
        op.setAttribute("role", "radio");
        op.setAttribute("aria-checked", String(elegido));

        const radio = document.createElement("span");
        radio.className = "radio-orden" + (elegido ? " marcado" : "");
        op.appendChild(radio);
        op.appendChild(document.createTextNode(c.etiqueta));

        op.addEventListener("click", () => elegirCriterio(c.id));
        seccion.appendChild(op);
      });

      if (criterioActivo() === "portal") {
        const pie = document.createElement("div");
        pie.className = "orden-pie";
        pie.textContent = "Dentro de cada portal, por orden de llegada.";
        seccion.appendChild(pie);
      }

      nodos.sortMenu.appendChild(seccion);
    }

    /** La etiqueta del botón: criterio + sentido, igual en las dos pestañas. */
    function actualizarBoton() {
      if (!nodos.btnSort) return;

      const criterio = criteriosDisponibles().find((c) => c.id === criterioActivo());
      const flecha = esAscendente() ? " ↑" : " ↓";
      const porDefecto = enCola() ? "Fila" : "Nombre";
      nodos.btnSort.textContent = (criterio ? criterio.corta : porDefecto) + flecha;
      nodos.btnSort.title = `Orden: ${criterio ? criterio.etiqueta : porDefecto}${flecha}`;
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

    // El botón abre el panel en LAS DOS pestañas. La primera versión de este corte dejó a
    // Disponibles con el toggle viejo, y el resultado fue que el mismo botón hacía dos cosas
    // según dónde estabas — se notaba al primer uso.
    if (nodos.btnSort) {
      nodos.btnSort.addEventListener("click", alternarMenu);
    }

    return { comparador, renderizarMenu, actualizarBoton, alternarMenu, cerrarMenu, criteriosDisponibles };
  },
};

// Sin `globalThis`: desde la Fase 8a los módulos hermanos viajan por `import` y no son
// adaptadores intercambiables. Publicar el global acá sería desandar esa fase.
export default OrdenFeature;
