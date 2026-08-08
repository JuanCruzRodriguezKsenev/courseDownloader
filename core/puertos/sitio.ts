/**
 * PUERTO DE SITIO (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [FASE 5C] Primer puerto de la Capa 2. Nace al pasar `sitio/ramonnet/config.js`
 *   a TypeScript: hasta ahora el "contrato" del adaptador de sitio era una
 *   convención documentada en prosa, y lo que verificaba que un portal nuevo
 *   estuviera completo era leerse el archivo. Ahora lo verifica el compilador.
 * ==========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * La forma que tiene que cumplir el adaptador de un portal para que el núcleo y la
 * UI puedan trabajar contra él sin saber de qué portal se trata. Es el mismo
 * mecanismo que `PuertoAlmacenamiento`/`PuertoMensajeria`, en la otra dirección:
 * aquellos abstraen el navegador (Capa 3), éste abstrae el sitio (Capa 2).
 *
 * Clonar la extensión a otro portal = escribir un objeto que cumpla esta interfaz.
 *
 * QUÉ **NO** VA ACÁ
 * -----------------
 * Sólo entra lo que consume alguien de afuera del adaptador. Lo que `sitio/ramonnet/`
 * usa puertas adentro —`host`, `marcaRutaClase`, el bloque `cdn`— es asunto suyo y
 * vive en su propio tipo, que extiende a éste. Si una constante de sitio no la lee
 * nadie fuera de su carpeta, no pertenece al puerto.
 */

/** Un enlace de clase tal como lo devuelve el scraper del portal (del DOM o de su API). */
export interface EnlaceListado {
  /** Texto visible del enlace: el título crudo, sin normalizar. */
  texto: string;
  /** URL absoluta de la página de la clase. */
  href: string;
  /**
   * [ESCANEO-API CORTE 1] El módulo del que salió la clase, **ya saneado como nombre de
   * carpeta**, en portales de dos niveles (producto → módulos → clases).
   *
   * Aditivo a propósito: un portal de un solo nivel —Ramón Net— no lo manda, y ausente es un
   * valor válido que nadie rellena por su cuenta.
   *
   * Sirve para dos cosas que conviene no confundir:
   *   1. **La identidad** de la clase (`core/cola/identidadClase.ts`), donde es el ORIGEN.
   *   2. La carpeta de destino por omisión, que el popup deriva de él.
   * La segunda la puede pisar el override del input; la primera **nunca**.
   */
  modulo?: string;
}

/** Lo que devuelve el escaneo del listado de clases de una pestaña. */
export interface ResultadoEscaneo {
  /** Materia detectada en la página, base para el nombre de carpeta. */
  materia: string;
  enlaces: EnlaceListado[];
  /**
   * [CORTE 7] Credenciales que el portal expone **sólo dentro de su pestaña** y que su
   * `resolverManifiesto` va a necesitar después, desde el service worker.
   *
   * Opcional porque la mayoría de los portales no las necesita: Ramón Net resuelve con la
   * cookie de sesión, que el SW ya manda sola. Las necesita un portal cuya API pida un
   * token de `localStorage` — Anatomy by Chris, que fue quien obligó a agregar esto.
   *
   * **No viajan con la clase ni con el ítem de la cola**: son de la sesión del usuario en el
   * portal, no de una clase. El popup las guarda una vez por portal
   * (`core/estado/credencialesPortal.ts`) y el SW las lee de ahí. Esa decisión salió de
   * medir el camino completo del escaneo — ver ese módulo.
   */
  credenciales?: Record<string, string>;
}

/** Destino de una clase: valor del eje de faceta + carpeta en disco. */
export interface ClasificacionCarpeta {
  catedra: string;
  carpeta: string;
}

/**
 * Lo mínimo que la faceta necesita leer de un item. Es a propósito parcial: los
 * items del LISTADO traen `catedra` ya calculada, y los de la COLA no la traen y hay
 * que re-derivarla del título — dos formas distintas que esta interfaz cubre a la vez.
 */
export interface ItemFacetable {
  catedra?: string;
  titulo?: string;
  carpeta?: string;
}

/** Opciones del parser de títulos (cada sitio decide cuáles respeta). */
export interface OpcionesParseo {
  abbreviate?: boolean;
  cleanBody?: boolean;
  forcePrefix?: boolean;
}

/**
 * Descriptor de la FACETA: el eje por el que el usuario puede ser preguntado una vez
 * ("¿cuál cursás?") y filtrar después. En Ramón Net es la cátedra (A-D), pero el
 * mecanismo no tiene nada de Ramón Net — otro portal podría llamarle "comisión",
 * "turno" o "sede" y la UI genérica funciona igual.
 */
export interface DescriptorFaceta {
  id: string;
  /** Título de la sección de filtros. */
  etiqueta: string;
  icono: string;

  /**
   * Valor que pertenece a TODAS las opciones (en Ramón Net, las clases comunes a
   * todas las cátedras). Nunca se ofrece como opción y siempre queda seleccionado
   * junto con la elección del usuario.
   */
  valorComun: string;
  /** Centinela de "no filtrar por esta faceta". */
  valorTodas: string;
  // [MULTIPORTAL B] Acá vivía `claveEstado`: el nombre de la propiedad de `AppState` donde se
  // guardaba la elección. Se fue porque nombraba UN casillero, y la elección pasó a ser **por
  // portal** (`AppState.facetaElegidaDe(sitioId)`). Mientras fue única, la elección de un
  // portal se aplicaba al otro y le vaciaba el listado sin decir nada.

  /** De dónde sale el valor de la faceta en un item del listado scrapeado. */
  leer(clase: ItemFacetable): string | undefined;
  /** Ídem para un item de la cola, que no lleva el campo y hay que re-derivarlo. */
  leerDeCola(clase: ItemFacetable): string | undefined;

  /** Etiqueta larga: badge de la cabecera y botones del modal ("Cátedra A"). */
  etiquetar(valor: string): string;
  /** Etiqueta corta: opciones del popover de filtros, donde el espacio es poco. */
  etiquetarCorto(valor: string): string;

  ordenar(a: string, b: string): number;

  modal: {
    titulo: string;
    descripcion: string;
  };
}

/** El contrato completo que tiene que cumplir el adaptador de un portal. */
export interface PuertoSitio {
  /** Identificador corto, el que aparece en los logs (`[SITIO:ramonnet]`). */
  id: string;

  /**
   * Nombre del portal **como se le muestra al usuario** ("Ramón Net"), distinto del `id`, que
   * es para logs. Lo consume el onboarding, que es la única parte de la UI que nombra al
   * portal en su copy. Sacarlo de acá es lo que deja las islas Preact genéricas: el resto ya
   * lo estaba, y el eje de clasificación viaja aparte en `faceta.etiqueta`.
   */
  nombre: string;

  /**
   * Origen del portal. Lo usa el daemon de conexión como sonda de "hay internet":
   * es deliberadamente el sitio objetivo y no un genérico tipo google.com — lo que
   * importa no es tener red, sino poder llegar A ESTE portal.
   */
  urlSondeoInternet: string;

  /** ¿Esta URL pertenece al portal? */
  esPaginaDelSitio(url: string | undefined): boolean;
  /** Patrón de match para `chrome.tabs.query`. */
  readonly patronPestañas: string;
  /** Página del listado de clases, a donde el onboarding manda al usuario. */
  readonly urlListado: string;

  /**
   * URL de la página de la clase → URL del manifiesto `.m3u8`. Tira si no la encuentra.
   *
   * `credenciales` es lo que ese mismo portal cosechó en su último escaneo
   * (`ResultadoEscaneo.credenciales`), o `undefined` si nunca cosechó ninguna. Un portal que
   * no las use simplemente ignora el parámetro.
   *
   * **Devolver una playlist de MEDIOS, nunca un master multi-variante**: `core/hls/hlsEngine.ts`
   * no los distingue —toma toda línea sin `#` como fragmento— así que ante un master se baja
   * el `.m3u8` de la variante creyéndolo un `.ts` y no da error en ningún lado. Si el portal
   * sirve un master, el adaptador elige la variante y devuelve esa.
   */
  resolverManifiesto(
    urlClase: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;

  /**
   * Función que se INYECTA en la pestaña del portal (`chrome.scripting.executeScript`)
   * para leer el listado. Se entrega CRUDA: executeScript serializa su código fuente y lo
   * corre en la página, donde no existe ninguna global de la extensión.
   *
   * **Puede ser `async`** desde el corte 1 del escaneo por API: `executeScript` espera la
   * promesa y devuelve su valor resuelto. Eso es lo que habilita leer el listado de la **API
   * del portal** en vez del DOM — un `fetch` desde la pestaña sale con el origen y el
   * `localStorage` del portal, cosa que el service worker no puede replicar.
   *
   * El único call-site (`popup.js`) hace `await` del resultado, así que las dos formas
   * conviven: Ramón Net sigue devolviendo sincrónicamente y no se enteró.
   */
  readonly escanearListado: () => ResultadoEscaneo | Promise<ResultadoEscaneo>;

  /** Título crudo scrapeado → nombre canónico del archivo. */
  parsearTitulo(crudo: string, materiaBase?: string, options?: OpcionesParseo): string;

  /** Título crudo + materia → dónde se guarda. */
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;

  faceta: DescriptorFaceta;
}
