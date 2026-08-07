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

/** Un enlace de clase tal como lo devuelve el scraper desde el DOM del portal. */
export interface EnlaceListado {
  /** Texto visible del enlace: el título crudo, sin normalizar. */
  texto: string;
  /** URL absoluta de la página de la clase. */
  href: string;
}

/** Lo que devuelve el escaneo del listado de clases de una pestaña. */
export interface ResultadoEscaneo {
  /** Materia detectada en la página, base para el nombre de carpeta. */
  materia: string;
  enlaces: EnlaceListado[];
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

  /** HTML de la página de la clase → URL del manifiesto `.m3u8`. Tira si no la encuentra. */
  resolverManifiesto(urlClase: string, signal?: AbortSignal): Promise<string>;

  /**
   * Función que se INYECTA en la pestaña del portal (`chrome.scripting.executeScript`)
   * para leer el listado del DOM. Se entrega CRUDA: executeScript serializa su código
   * fuente y lo corre en la página, donde no existe ninguna global de la extensión.
   */
  readonly escanearListado: () => ResultadoEscaneo;

  /** Título crudo scrapeado → nombre canónico del archivo. */
  parsearTitulo(crudo: string, materiaBase?: string, options?: OpcionesParseo): string;

  /** Título crudo + materia → dónde se guarda. */
  clasificarCarpeta(crudo: string, materiaBase?: string): ClasificacionCarpeta;

  faceta: DescriptorFaceta;
}
