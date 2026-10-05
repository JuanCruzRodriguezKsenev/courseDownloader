/**
 * PUERTO DE SITIO (V1.10.0)
 * ==========================================================================
 * CHANGELOG v1.10.0:
 * - [CANCELAR ESCANEO] Miembro nuevo `escaneoCancelable?: boolean;` (opcional):
 *   indica si el escaneo inyectado atiende `cancelar_escaneo`.
 *
 * CHANGELOG v1.9.0:
 * - [DESTINO CORTE 2b-4] Campos opcionales en `EnlaceListado`: `cursoId`, `cursoNombre` y `tema`.
 *   Permiten al popup consultar el estado de cada curso al backend sin desarmar `modulo` (RN-2, D-1).
 *
 * CHANGELOG v1.8.0:
 * - [DESTINO CORTE 2b-3] Miembro nuevo `destinoPorIndice?: boolean` (opcional, default false):
 *   indica si el portal delega la ubicación y nombre en el índice de destino (.course-downloader.json).
 *
 * CHANGELOG v1.7.0:
 * - [CLASSROOM ESCANEAR TODAS] Miembro nuevo `esPortada?(url)` (opcional):
 *   predicado que identifica la portada desde donde se puede escanear todos los listados.
 *   El puerto pasa de 13 a 14 miembros.
 *
 * CHANGELOG v1.6.0:
 * - [CLASSROOM CORTE 1 — ADJUNTOS SIN RESOLVER] Miembro opcional `adjuntosSinResolver`
 *   en `ResultadoEscaneo`: conteo de adjuntos descartados por hidratación incompleta.
 *
 * CHANGELOG v1.5.0:
 * - [CLASSROOM CORTE 1 — LISTA GUARDADA] Miembro nuevo `claveDeListado?(url)` (opcional):
 *   devuelve una clave estable del listado que muestra la URL (el id de curso en Classroom).
 *   Si la URL no es de un listado o el portal no la declara, devuelve `undefined`.
 *
 * CHANGELOG v1.4.0:
 * - [CLASSROOM VERIFICACIÓN B] `urlSondeoInternet`: URL del portal que el daemon sondea; no hace
 *   falta que sea navegable ni que dé 200, y no se abre en una pestaña. Tiene que responder sin
 *   un Cross-Origin-Resource-Policy que la bloquee desde la extensión (el caso de Classroom).
 * - [CLASSROOM VERIFICACIÓN B] `urlListado`: documentado que también es lo que abre la
 *   notificación de fallo cuando no hay pestaña del portal.
 *
 * CHANGELOG v1.3.0:
 * - [CLASSROOM CORTE 1] Miembro nuevo `credencialesAdjunto` ("omit" | "include", opcional).
 *   La descarga del adjunto va con las credenciales de la sesión del navegador en portales
 *   que lo requieran (Classroom con Drive, donde sin cookies da 401). El default sigue siendo
 *   "omit" para no romper CloudFront en Anatomy.
 *
 * CHANGELOG v1.2.0:
 * - [LOADERS — ítem 1] Miembro nuevo `topeEscaneoMs` (el puerto pasa de 12 a 13). El
 *   `safetyTimeout` del escaneo era 6000 fijo en popup.js contra ~11 s reales de Anatomy
 *   (/v1/navigation ~4,0 s + el pool de 114 materiales 7,1 s), así que ese portal mostraba
 *   SIEMPRE un error falso que después se borraba solo. Un tope global no existe: es una
 *   propiedad medida de cada portal.
 * - Requerido, por el mismo motivo que `instruccionEscaneo`: un portal nuevo que lo olvide
 *   tiene que no compilar, no heredar un número ajeno.
 *
 * CHANGELOG v1.1.0:
 * - [COPY GENÉRICA — corte 2] Miembro nuevo `instruccionEscaneo` (el puerto pasa de 11 a
 *   12 miembros). Es el único texto del onboarding que describe un FLUJO y no un hecho, y
 *   el flujo difiere entre portales: Ramón Net filtra por materia con un selector, Anatomy
 *   trae el curso entero de un escaneo. Estaba hardcodeado con el de Ramón Net.
 * - Va REQUERIDO, no opcional: el motivo de meterlo al puerto era que `tsc` obligue a cada
 *   portal nuevo a escribir la suya. Detalle en el docblock del miembro.
 *
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

  /**
   * [ESCANEO-API CORTE 5] Qué es este ítem. **Ausente = `"video"`**, por el mismo motivo que
   * `sitioId`: todo lo ya persistido es de antes de que existieran los adjuntos, y era video.
   *
   * Viaja con el ÍTEM y no con el portal, mismo razonamiento que ADR-0010: la cola sobrevive a
   * la pestaña, así que "qué estoy bajando" tiene que estar en el ítem.
   */
  tipo?: "video" | "adjunto";

  /** Sólo en adjuntos: el id con el que el portal entrega la URL firmada. */
  idArchivo?: string;

  /**
   * Sólo en adjuntos: el peso en bytes, que el portal ya devuelve en el listado.
   *
   * Se muestra porque **hace falta para decidir**: en la lección más cargada de este curso
   * conviven un PDF de 83,9 MB con guías de 90 KB.
   */
  bytes?: number;

  /**
   * Título de la publicación de donde sale el adjunto (portales con destino por índice (Classroom, Moodle del LINTI)):
   * lo usa la sugerencia de destino (RN-7a).
   */
  publicacion?: string;

  /**
   * Texto del anuncio de Novedades (portales con destino por índice (Classroom, Moodle del LINTI)), hasta 500 caracteres:
   * nombra el archivo cuando choca (RN-16a).
   */
  anuncio?: string;

  /**
   * [CORTE 2b-4] Id del curso en el portal (portales con destino por índice (Classroom, Moodle del LINTI)). Permite consultar el
   * estado del curso al backend sin desarmar `modulo` (D-1, RN-2).
   */
  cursoId?: string;

  /** [CORTE 2b-4] Nombre crudo del curso en el portal (portales con destino por índice (Classroom, Moodle del LINTI)). */
  cursoNombre?: string;

  /** [CORTE 2b-4] Tema o sección dentro del curso (portales con destino por índice (Classroom, Moodle del LINTI)). */
  tema?: string;
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
  /**
   * [CLASSROOM CORTE 1] El escaneo se cortó por algo que el usuario puede arreglar;
   * se muestra en lugar del listado y **no** reemplaza la lista anterior.
   */
  aviso?: string;
  /**
   * [CLASSROOM CORTE 1] Cuántos adjuntos se descartaron por no haber terminado de
   * hidratarse. **No es un `aviso`**: el escaneo salió bien y la lista se muestra entera;
   * esto se pinta como una nota arriba de las filas. Un portal que no lo devuelve deja
   * `undefined`, y el consumidor lo lee como 0.
   */
  adjuntosSinResolver?: number;
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
   * Color con el que la UI distingue a este portal de un vistazo (CSS válido).
   *
   * Entra al puerto porque lo lee alguien de **afuera** de `sitio/`: la fila de la lista, que
   * pinta con él la pastilla de materia. Hasta acá lo único que la UI sabía de un portal era su
   * nombre, y en la Cola —que mezcla portales a propósito— dos filas de portales distintos se
   * veían exactamente iguales.
   *
   * ⚠️ **No uses el naranja del acento** (`--accent-orange`): ya significa "seleccionada" y
   * "bajando" en esa misma fila, y un tercer significado para el mismo color no se distingue.
   */
  color: string;

  /**
   * URL del portal que el daemon de conexión sondea como prueba de "hay internet":
   * es deliberadamente el sitio objetivo y no un genérico tipo google.com — lo que
   * importa no es tener red, sino poder llegar A ESTE portal.
   *
   * Tiene que responder sin un `Cross-Origin-Resource-Policy` que la bloquee desde la
   * extensión (el caso de Classroom, donde la raíz bloquea con CORP y se sondea `/favicon.ico`).
   * No hace falta que sea navegable ni que dé 200, y **no se abre en una pestaña**.
   */
  urlSondeoInternet: string;

  /** ¿Esta URL pertenece al portal? */
  esPaginaDelSitio(url: string | undefined): boolean;

  /**
   * [CLASSROOM ESCANEAR TODAS] ¿Esta URL es la portada del portal desde la que se
   * ofrece escanear todos sus listados (en Classroom, /h)?
   * Corre en el popup, no en la pestaña.
   */
  esPortada?(url: string | undefined): boolean;

  /**
   * [CANCELAR ESCANEO] `true` si el escaneo inyectado atiende `cancelar_escaneo`
   * (`chrome.runtime.onMessage` dentro de `escanearListado`). Lo lee el popup
   * para mostrar el botón Cancelar.
   */
  escaneoCancelable?: boolean;

  /** Patrón de match para `chrome.tabs.query`. */
  readonly patronPestañas: string;
  /**
   * Página del listado de clases, a donde el onboarding manda al usuario y lo que
   * abre la notificación de fallo si no hay ninguna pestaña del portal abierta.
   */
  readonly urlListado: string;

  /**
   * [CLASSROOM CORTE 1 — LISTA GUARDADA] Qué listado muestra esta URL, como una clave estable
   * (en Classroom, el id del curso). El popup la guarda al escanear y, al abrirse en una pestaña
   * con la MISMA clave, muestra la lista guardada en vez de escanear de nuevo.
   *
   * - Opcional: un portal que no la declara escanea siempre al abrir (Ramón Net y Anatomy,
   *   cuyos escaneos duran segundos).
   * - Corre en el POPUP, no en la pestaña: no va dentro de `escanearListado`.
   * - Devuelve `undefined` si la URL no es de un listado.
   */
  claveDeListado?(url: string | undefined): string | undefined;

  /**
   * [COPY GENÉRICA CORTE 2] Cómo se le explica al usuario, en el onboarding, qué va a ver
   * después de escanear. **Es lo único del tour que describe un FLUJO y no un hecho**, y por
   * eso no se puede escribir una vez para todos: en Ramón Net el usuario elige la materia en
   * un selector y aprieta 👁️ mostrar; en Anatomy un solo escaneo trae el curso entero y no
   * existe ninguno de los dos controles. Hasta el 2026-08-12 la frase estaba hardcodeada con
   * el flujo de Ramón Net, así que el onboarding del segundo portal describía una UI que ahí
   * no existe.
   *
   * **Obligatorio a propósito, no opcional.** El diseño (`copy-generico-diseno.md` §5.3) lo
   * proponía opcional; se ejecutó como requerido porque el motivo entero de meterlo al puerto
   * era que `tsc` obligue a cada portal nuevo a escribir la suya. Con `?` el portal que la
   * olvide compila igual y hereda un texto ajeno o vacío — que es exactamente el defecto que
   * este miembro viene a cerrar.
   *
   * **Texto plano, sin markup**: se interpola en la isla Preact del onboarding, que escapa lo
   * que recibe. Un `<strong>` acá se vería literal en pantalla.
   */
  readonly instruccionEscaneo: string;

  /**
   * Techo en milisegundos para un escaneo de este portal, antes de darlo por colgado.
   *
   * **Es una medición, no una preferencia.** Estaba hardcodeado en 6000 dentro de
   * `popup.js` cuando el único portal escaneaba el DOM y tardaba menos de un segundo. Con el
   * escaneo por API de Anatomy —`/v1/navigation` ~4,0 s más un pool de 114 materiales que
   * mide 7,1 s— el tope quedó por debajo del caso normal, así que el watchdog saltaba en
   * **todos** los escaneos de ese portal: pintaba «⚠️ Timeout de carga del DOM» y ~5 s
   * después llegaba el escaneo de verdad y le pintaba encima. Un error que se borra solo es
   * peor que ninguno: enseña a ignorar los errores.
   *
   * Poné el tope con holgura sobre el peor caso **medido** de ese portal, no sobre el típico.
   * Un tope que salta en operación normal no es una guarda: es ruido.
   *
   * **No sirve para cancelar el escaneo** — nadie sabe abortar `chrome.scripting` a mitad de
   * camino. Lo que hace al vencerse es *abandonar* el escaneo: suelta la UI y marca esa
   * corrida como muerta, para que si el callback llega tarde no pinte sobre lo que el usuario
   * esté mirando.
   */
  readonly topeEscaneoMs: number;

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
   * [ESCANEO-API CORTE 5] Id de un adjunto → **URL directa y descargable** del archivo.
   *
   * **Opcional**: un portal sin adjuntos no lo implementa, y el bucle nunca se lo pide porque
   * ningún ítem suyo lleva `tipo: "adjunto"`.
   *
   * ⚠️ **Se resuelve al BAJAR, nunca al escanear** (riesgo R8). La URL que devuelve Hotmart es
   * de CloudFront y vive **exactamente 1 hora**; resolverla al encolar haría que una cola larga
   * de PDF empiece a fallar a mitad de camino, y el fallo se vería como "el portal rechazó el
   * archivo". Es la misma razón por la que las credenciales se leen por ítem y no por ráfaga.
   */
  resolverAdjunto?(
    idArchivo: string,
    signal?: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;

  /**
   * [CLASSROOM CORTE 1] Política de credenciales (`fetch(urlFirmada, { credentials })`)
   * para la descarga directa de un adjunto.
   *
   * - Default: `"omit"`.
   * - Opcional: un portal sin adjuntos no lo necesita, y Anatomy queda en el valor
   *   medido sin declararlo (CloudFront responde a curl pelado y mandar cookies puede
   *   hacer que rechace).
   * - Classroom lo declara `"include"`: Google Drive necesita las cookies de sesión del
   *   navegador junto con `authuser` para autorizar la descarga (diseño D1 y M0).
   */
  readonly credencialesAdjunto?: "omit" | "include";

  /**
   * Si el portal delega la ubicación y nombre en el índice de destino (.course-downloader.json).
   * Cuando es true, la cola exige que el ítem traiga `destino` y envía los headers `x-destino-*`.
   */
  readonly destinoPorIndice?: boolean;

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
