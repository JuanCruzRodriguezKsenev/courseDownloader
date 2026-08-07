/**
 * PROCESADOR DE LA COLA DE DESCARGA (V1.2.0)
 * ==========================================================================
 * Capa 1. Salió de `background.js` en la Fase 6b — es el bloque de lógica más grande que
 * tenía el service worker, y el más sensible del proyecto.
 *
 * CHANGELOG v1.2.0:
 * - [FIX — el cartel mentiroso] Dos ramas nuevas para los fallos del PORTAL (`tipoPortal`:
 *   `"rechazo"` saltea la clase, `"bloqueo"` pausa sin auto-heal) y el `else` de la heurística
 *   pasa de `"internet"` a `"desconocido"`. Un 403 del CDN de Hotmart se mostraba como "se
 *   perdió la conexión a internet" —con el daemon midiendo `internet=true`— y el auto-heal lo
 *   reintentaba cada 12 s para siempre. Ver el bloque POR QUÉ EXISTEN 4 Y 5.
 * - [FIX] El auto-heal pasa a decidirse por lista POSITIVA (`TIPOS_CON_AUTOHEAL`). Con la
 *   negativa ("todo menos sesion"), cada tipo nuevo entraba al auto-heal por omisión.
 * - [REFACTOR] El "saltear la clase y seguir" que tenían duplicado las ramas de rechazo es
 *   ahora `saltearClaseYSeguir`.
 *
 * CHANGELOG v1.1.0:
 * - [MULTISITIO CORTE 6D — ADR-0011] Se fue el `sort` por `fechaEncolado`: **el array de
 *   `colaDescargas` ES el orden de descarga**. El popup lo escribe, este bucle baja `[0]`.
 *   Con eso esta capa deja de tener una política de orden propia — una decisión menos en el
 *   lugar que menos se puede observar.
 *
 * QUÉ ES
 * ------
 * El bucle que toma la primera clase de la cola, la descarga con el motor HLS y decide
 * qué pasa cuando algo falla. Esa segunda parte es el verdadero contenido: **la clasificación
 * de fallos tiene seis caminos y cada uno existe por un bug real**.
 *
 *   1. **Cancelación del usuario** (`abortadoPorUsuario`) → no es un fallo. Sale limpio.
 *   2. **`tipoConexion: "sesion"`** → pausa SIN alarma. El daemon ve la red OK y
 *      malclasificaría; además el auto-heal reintentaría en loop contra el login.
 *   3. **`tipoBackend: "rechazo"` (4xx)** → **saltea sólo esa clase** y sigue. Es el fix del
 *      bug 400: el server está vivo, así que `/api/health` daría 200 y el daemon diría
 *      "servidor", generando el loop pausa→autoheal→mismo 400.
 *   4. **`tipoPortal: "rechazo"`** → saltea sólo esa clase, igual que 3, pero el que rechaza es
 *      el PORTAL y no el backend local (la lección no existe, no tiene media, tiene DRM).
 *   5. **`tipoPortal: "bloqueo"`** → pausa SIN alarma. El portal rechaza de forma sistémica
 *      (token, `Referer`, hotlink del CDN): le va a pasar a TODAS las clases, así que saltear
 *      vaciaría la cola en silencio.
 *   6. **Cualquier otro** → fallo real: pausa CON alarma de auto-heal.
 *
 * El orden importa: 1 a 5 se clasifican **antes** de consultar al daemon.
 *
 * POR QUÉ EXISTEN 4 Y 5 (el bug del cartel mentiroso, 2026-08-07)
 * ---------------------------------------------------------------
 * Hasta el corte 7 había DOS orígenes de fallo: el backend local y la red. Por eso el `else`
 * de la heurística de abajo podía decir `"internet"` sin mentir casi nunca. El segundo portal
 * agregó un TERCER origen —el portal mismo, que ahora resuelve el manifiesto con tres fetch
 * contra su API y su CDN— y ahí ese `else` pasó a ser una afirmación falsa: el daemon medía
 * `internet=true` y una línea después la UI decía *"se perdió la conexión a internet"* por un
 * 403 del CDN. Peor: como no era `"sesion"`, se programaba el auto-heal, que veía internet OK,
 * reanudaba, comía el mismo 403 y volvía a pausar **cada 12 s, para siempre**.
 *
 * Es el mismo patrón que este proyecto ya vio dos veces en otra forma (la clave de identidad
 * que desbordó con cada eje nuevo): **un eje nuevo desborda una clasificación que asumía los
 * ejes viejos, y el síntoma es silencioso o mentiroso**. Por eso el `else` ya no afirma nada
 * (`"desconocido"`), y por eso el default de un error SIN tipar sigue siendo pausar con alarma:
 * "no sé qué pasó" tiene que comportarse como lo transitorio, no como lo determinístico.
 *
 * ESTADO PROPIO (y por qué vive acá)
 * ----------------------------------
 * `loopActivo` y `controladorGraficoActivo` eran variables de módulo de `background.js`
 * compartidas entre el bucle y los handlers IPC. Ahora son estado privado de esta factory y
 * se tocan por su API (`arrancarSiNoCorre`, `detener`, `abortarRafaga`). Es lo que evita el
 * bug clásico de este bucle: **dos ráfagas corriendo a la vez**, que duplica descargas y
 * pisa el progreso.
 *
 * LO QUE NO ESTÁ ACÁ, A PROPÓSITO
 * -------------------------------
 * La notificación nativa y el camino legacy de volcado a disco (offscreen + `chrome.downloads`)
 * son Capa 3: entran como callbacks (`notificarFallo`, `guardarBlobLegacy`) desde la
 * composición. El historial de fallos sí es del núcleo y entra como colaborador.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";
import type { PuertoMensajeria } from "../puertos/mensajeria";
import type { PuertoProgramador } from "../puertos/programador";
import type { EstadoSesionAPI } from "./estadoSesion";
import type { IdentidadClase } from "./identidadClase";
import type { MetadataHls, ContextoRafaga, CallbacksRafaga } from "../hls/hlsEngine";

/** Nombre y período de la tarea de auto-sanación. 0.2 min = 12 s. */
export const ALARMA_AUTOHEAL = "alarma_autoheal";
export const PERIODO_AUTOHEAL_MIN = 0.2;

/**
 * Copy por tipo de pausa; viaja al historial de fallos y a la notificación del SO.
 *
 * Es una FUNCIÓN del nombre del portal, no una constante: el texto de `sesion` lo nombra, y
 * Capa 1 no puede tener vocabulario de sitio (ADR-0008). Antes decía "Ramón Net" hardcodeado
 * — era una de las tres fugas que destapó la auditoría del 2026-08-04, y la única de las tres
 * que llegaba a los ojos del usuario.
 */
const motivosPausa = (nombreSitio: string): Record<string, string> => ({
  sesion: `no hay sesión activa en ${nombreSitio}`,
  servidor: "se perdió la conexión con el servidor local",
  internet: "se perdió la conexión a internet",
  // Los dos que entraron con el fix del cartel mentiroso. Ninguno nombra la red: el daemon
  // acaba de medir que está bien, y afirmar lo contrario fue exactamente el bug.
  bloqueo: `${nombreSitio} rechazó la descarga`,
  desconocido: "falló por un motivo que no es la red ni el servidor local",
});

/**
 * Los únicos tipos que el daemon PUEDE ver recuperarse, y por lo tanto los únicos que se
 * auto-sanan. Se declara la lista positiva a propósito: con la lista negativa ("todo menos
 * sesion"), cada tipo nuevo entraba al auto-heal por omisión — que es cómo un 403
 * determinístico terminó reintentándose cada 12 s.
 */
const TIPOS_CON_AUTOHEAL = ["servidor", "internet", "desconocido"];

/**
 * Lo único que el bucle necesita de un adaptador de sitio. Es un subconjunto estructural de
 * `PuertoSitio` a propósito: mantiene los dobles de los tests chicos y deja explícito que el
 * procesador no conoce el resto del contrato del portal.
 */
export interface SitioDeDescarga {
  /**
   * El tercer parámetro son las credenciales que ESE portal cosechó al escanear
   * (`core/estado/credencialesPortal.ts`). El bucle no las mira ni sabe qué contienen: las
   * pasa. Un portal que no las use ignora el parámetro.
   */
  resolverManifiesto(
    urlClase: string,
    signal: AbortSignal,
    credenciales?: Record<string, string>
  ): Promise<string>;
  /** Nombre del portal, para el copy que ve el usuario. Capa 1 no lo puede saber. */
  nombre: string;
  /**
   * [MULTIPORTAL E] Identificador del portal. Viaja hasta el backend con cada fragmento: define
   * la carpeta `raíz/<portal>/<materia>/` donde se escribe el archivo. Se pide acá y no se lee
   * de `ItemCola.sitioId` a propósito — el del descriptor ya pasó por la migración, así que un
   * ítem sin `sitioId` escribe en la carpeta del portal legado y no en una vacía.
   */
  id: string;
}

export interface ItemCola {
  titulo: string;
  urlInterna: string;
  carpeta?: string;
  fechaEncolado?: number;
  /**
   * De qué portal salió (ADR-0010). Opcional porque un ítem encolado antes del multi-sitio no
   * lo trae; `AppState` lo normaliza al cargar, pero el SW lee la cola de storage por su
   * cuenta, así que acá puede llegar `undefined` y hay que tratarlo.
   */
  sitioId?: string;
}

export interface ClasePersistida {
  titulo: string;
  estado?: string;
  [k: string]: unknown;
}

export interface DependenciasCola {
  almacenamiento: PuertoAlmacenamiento;
  sesion: EstadoSesionAPI;
  mensajeria: PuertoMensajeria;
  programador: PuertoProgramador;
  /** Fuente única del estado de conexión. Se usa para clasificar el fallo. */
  conexion: {
    verificarAhora(): Promise<unknown>;
    get(): { servidor: boolean; internet: boolean; tipoFalla: string | null };
  };
  motor: {
    descargarYAnalizarIndexM3u8(url: string, signal: AbortSignal): Promise<MetadataHls>;
    compilarTranscodificacionStream(
      meta: MetadataHls,
      signal: AbortSignal,
      subcarpeta: string,
      contexto: ContextoRafaga,
      callbacks?: CallbacksRafaga
    ): Promise<Blob | null>;
  };
  /**
   * Registro de sitios: el bucle resuelve el portal **por ítem**, no por composición
   * (ADR-0010). La cola está desacoplada de la pestaña a propósito, así que puede mezclar
   * portales y no hay ninguna URL de pestaña que consultar cuando el SW toma un ítem.
   *
   * `obtener` puede devolver `undefined` —un `sitioId` viene de storage y puede nombrar un
   * portal que ya no está registrado—; el bucle lo trata como fallo determinístico.
   */
  sitios: {
    obtener(sitioId: string | undefined): SitioDeDescarga | undefined;
  };
  /**
   * [CORTE 7] Credenciales del portal del ítem, cosechadas por el popup al escanear. Entra
   * como colaborador —y no como una lectura de storage acá— por la misma razón que `sitios` e
   * `identidad`: es un dato que el popup y el SW comparten, y armárselo cada uno por su lado
   * es cómo divergen en silencio.
   *
   * Devuelve `undefined` para un portal que no usa credenciales (Ramón Net), y eso **no es un
   * fallo**: el bucle lo pasa tal cual y el adaptador decide.
   */
  credenciales: {
    para(sitioId: string | undefined): Promise<Record<string, string> | undefined>;
  };
  historial: { registrar(tipo: string, titulo: string, motivo: string): Promise<unknown> };
  /** Capa 3: notificación nativa del SO. Best-effort, no puede propagar. */
  /**
   * Aviso nativo del fallo. El `sitioId` viaja hasta acá (corte 8) porque el click en la
   * notificación tiene que enfocar la pestaña del portal DEL ÍTEM: el SW no tiene pestaña de
   * la cual deducirlo, y el portal asumido es justo el que da la respuesta equivocada.
   */
  notificarFallo(tipo: string, titulo: string, motivo: string, sitioId?: string): void;
  /** Métricas de progreso ya formateadas. */
  calcularMetricas(
    bytes: number,
    hechos: number,
    total: number,
    inicio: number
  ): { porcentaje: number; telemetry: { velocidadTexto: string } };
  /**
   * Empuja el progreso a la **consola gráfica del backend Bun** — la barra que se ve en la
   * ventana del servidor. Es la única forma que tiene el usuario de seguir una descarga con
   * el popup cerrado, así que no es decorativa. Best-effort: no puede frenar la ráfaga.
   */
  actualizarConsolaBackend(datos: {
    titulo: string;
    porcentaje: number;
    terminados: number;
    totales: number;
    velocidad: number;
    /** [MULTIPORTAL E] El backend lo necesita para saber de qué descarga es este progreso. */
    sitioId?: string;
  }): void;
  /** Capa 3, camino legacy no-Turbo: volcar el blob a disco. */
  guardarBlobLegacy(blob: Blob, subRuta: string): Promise<void>;
  /** Espejo liviano de progreso que lee el popup. */
  persistirEstados(estados: Record<string, string>): Promise<void>;
  recuperarEstados(): Promise<Record<string, string>>;
  /**
   * [MULTIPORTAL D] Cómo se decide si dos ítems son la misma clase. Entra como colaborador y
   * no se arma acá para que el service worker, el popup y este bucle no puedan divergir — la
   * misma razón por la que el resolvedor de portales es un export compartido (corte 4).
   */
  identidad: IdentidadClase;
}

export function crearProcesadorCola(deps: DependenciasCola) {
  const {
    almacenamiento,
    sesion,
    mensajeria,
    programador,
    conexion,
    motor,
    sitios,
    credenciales,
    historial,
    notificarFallo,
    calcularMetricas,
    actualizarConsolaBackend,
    guardarBlobLegacy,
    persistirEstados,
    recuperarEstados,
    identidad,
  } = deps;

  // Estado volátil del service worker. Privado: se toca sólo por la API de abajo.
  let controladorGraficoActivo: AbortController | null = null;
  let loopActivo = false;

  /**
   * Choke point de aviso de fallos: historial + notificación nativa.
   *
   * **A prueba de balas a propósito**: ni el historial ni la notificación pueden propagar. El
   * aviso es un efecto secundario best-effort y la salud de la cola nunca debe depender de que
   * funcione — fue una regresión real (un `chrome.notifications` ausente frenaba la cola).
   */
  async function registrarFallo(
    tipo: string,
    titulo: string,
    motivo: string,
    sitioId?: string
  ): Promise<void> {
    try {
      await historial.registrar(tipo, titulo, motivo);
    } catch (e) {
      console.warn("[SW] No se pudo registrar el fallo en el historial:", e);
    }
    try {
      // El `sitioId` va SÓLO a la notificación, no al historial: la campanita se lee con el
      // popup abierto, que ya resuelve el portal por pestaña. Meterlo también en el historial
      // sería cambiar la forma del storage (`docs/data-model.md`) sin un lector que lo pida.
      notificarFallo(tipo, titulo, motivo, sitioId);
    } catch (e) {
      console.warn("[SW] No se pudo disparar la notificación de fallo:", e);
    }
  }

  async function notificarFrenoSuaveExitoso(): Promise<void> {
    await sesion.set({ rafagaCorriendo: false, frenadoSuaveSolicitado: false, videoActualTitulo: "" });
    loopActivo = false;
    await persistirEstados({});
    mensajeria.notificar({ action: "cola_completamente_vacia", suaveFrenado: true });
  }

  async function pausarPorError(
    tipoError: string,
    titulo: string,
    nombreSitio?: string,
    sitioId?: string
  ): Promise<void> {
    await sesion.set({
      colaPausadaPorError: true,
      tipoDeErrorConexion: tipoError,
      rafagaCorriendo: false,
    });
    loopActivo = false;

    // El aviso va DESPUÉS de persistir la pausa: que quede el estado es lo crítico.
    // El nombre sale del portal DEL ÍTEM, no de uno fijo. El fallback genérico cubre el caso
    // en que se pausa sin ítem resuelto: mejor "el portal" que un nombre equivocado.
    const motivos = motivosPausa(nombreSitio ?? "el portal");
    void registrarFallo(tipoError, titulo, motivos[tipoError] || "error de conexión", sitioId);

    // Auto-heal sólo para fallas que el daemon PUEDE detectar recuperadas (TIPOS_CON_AUTOHEAL).
    // "sesion" y "bloqueo" quedan afuera: el daemon ve la red OK, así que la alarma reintentaría
    // en loop contra el login o contra el mismo rechazo del portal.
    if (TIPOS_CON_AUTOHEAL.includes(tipoError)) {
      programador.programar(ALARMA_AUTOHEAL, { periodoMin: PERIODO_AUTOHEAL_MIN });
    }

    mensajeria.notificar({ action: "cola_pausada_por_error", errorType: tipoError, titulo });
  }

  async function reanudar(): Promise<void> {
    programador.cancelar(ALARMA_AUTOHEAL);
    await sesion.set({ colaPausadaPorError: false, tipoDeErrorConexion: "", rafagaCorriendo: true });
    arrancarSiNoCorre();
  }

  /** Entrada del bucle. Se re-encola a sí misma con un respiro de 60ms entre clases. */
  async function procesarSiguiente(): Promise<void> {
    const state = await sesion.get();

    if (state.frenadoSuaveSolicitado) {
      await notificarFrenoSuaveExitoso();
      return;
    }
    if (!state.rafagaCorriendo) {
      loopActivo = false;
      return;
    }

    try {
      const data = await almacenamiento.obtenerLocal<{
        listaPersistente: ClasePersistida[];
        colaDescargas: ItemCola[];
      }>(["listaPersistente", "colaDescargas"]);
      const listaCompleta = data.listaPersistente || [];
      const colaDescargas = data.colaDescargas || [];

      // [MULTISITIO CORTE 6D — ADR-0011] Acá vivía un `sort` por `fechaEncolado`, y con él la
      // única política de orden que tenía esta capa. Ya no: **el array ES el orden de
      // descarga**. El popup lo escribe, este bucle lo obedece y baja `[0]`.
      //
      // Que la cola se pueda reordenar en storage entre dos vueltas dejó de ser el riesgo que
      // ese `sort` cubría y pasó a ser el mecanismo: es exactamente así como el usuario decide
      // qué se baja después. `fechaEncolado` sigue existiendo —es el dato del criterio "de
      // llegada" y el que normaliza las colas viejas al cargarlas—, pero dejó de ser *la*
      // fuente del orden.
      //
      // El riesgo aceptado (ver la ADR): si el popup escribiera un orden inconsistente, este
      // bucle ya no tiene una red que lo corrija. La red es que el popup sea el único escritor.

      if (colaDescargas.length === 0) {
        await sesion.set({ rafagaCorriendo: false });
        loopActivo = false;
        await persistirEstados({});
        mensajeria.notificar({ action: "cola_completamente_vacia" });
        return;
      }

      const elementoActual = colaDescargas[0]!;
      const tituloInmutableVideo = elementoActual.titulo;
      // [MULTIPORTAL D] La identidad es (portal, título), no el título solo: dos portales
      // pueden tener una clase homónima y sacar "la del título X" borraría las dos. Ver
      // `core/cola/identidadClase.ts`, que es el único lugar donde vive esa regla.
      const esteItem = { titulo: tituloInmutableVideo, sitioId: elementoActual.sitioId };
      const claveItem = identidad.clave(esteItem);

      /**
       * Saca ESTA clase de la cola y sigue con la próxima. Es la resolución compartida de las
       * dos ramas de rechazo determinístico —la del backend (3) y la del portal (4)—, que
       * hacían lo mismo con el mismo comentario duplicado.
       *
       * La clase vuelve a `pending` y NO a un `error`: el resto del popup no conoce ese estado,
       * así que quedaría invisible en vez de re-encolable.
       */
      async function saltearClaseYSeguir(motivo: string): Promise<void> {
        const dataUpdate = await almacenamiento.obtenerLocal<{ colaDescargas: ItemCola[] }>([
          "colaDescargas",
        ]);
        const colaFiltrada = (dataUpdate.colaDescargas || []).filter(
          (c) => !identidad.misma(c, esteItem)
        );
        const objPersistente = listaCompleta.find((c) => identidad.misma(c, esteItem));
        if (objPersistente) objPersistente.estado = "pending";
        const estadosUpdate = await recuperarEstados();
        delete estadosUpdate[claveItem];
        // Misma escritura atómica de 3 claves que el path de éxito.
        await almacenamiento.guardarLocal({
          listaPersistente: listaCompleta,
          colaDescargas: colaFiltrada,
          SW_ESTADOS_PROGRESO: estadosUpdate,
        });
        // El `sitioId` va por el mismo motivo que en `clase_guardada_ok`: el popup saca la clase
        // de su cola comparando por identidad, y sin el portal el mensaje no matchea nada.
        mensajeria.notificar({
          action: "clase_con_error",
          titulo: tituloInmutableVideo,
          sitioId: elementoActual.sitioId,
          motivo,
        });
        setTimeout(procesarSiguiente, 60); // seguir con la próxima
        // Aviso DESPUÉS de garantizar la continuación de la cola.
        void registrarFallo("rechazo", tituloInmutableVideo, motivo, elementoActual.sitioId);
      }

      // ADR-0010: el portal sale del ÍTEM. Puede no resolver —el `sitioId` viene de storage y
      // puede nombrar un portal que ya no está registrado—, y eso es un fallo DETERMINÍSTICO:
      // reintentarlo no lo arregla. Se clasifica como la rama 4xx (saltear la clase y seguir)
      // y NO como pausa, que dispararía el auto-heal en loop contra algo que no se recupera.
      //
      // La guarda va ANTES de escribir el estado de sesión y el progreso a propósito: así el
      // salteo es una sola escritura y no hay que deshacer nada.
      const sitioDelItem = sitios.obtener(elementoActual.sitioId);
      if (!sitioDelItem) {
        console.warn(`⛔ [SW] "${tituloInmutableVideo}" quedó huérfana: su portal (${elementoActual.sitioId ?? "sin id"}) no está registrado. Se salta y la cola sigue.`);
        const colaFiltrada = colaDescargas.filter((c) => !identidad.misma(c, esteItem));
        const objHuerfano = listaCompleta.find((c) => identidad.misma(c, esteItem));
        if (objHuerfano) objHuerfano.estado = "pending";
        await almacenamiento.guardarLocal({
          listaPersistente: listaCompleta,
          colaDescargas: colaFiltrada,
        });
        const motivoHuerfano = "su portal ya no está registrado en la extensión";
        mensajeria.notificar({
          action: "clase_con_error",
          titulo: tituloInmutableVideo,
          // Va el id CRUDO, que es lo que tiene el ítem del popup. Para un huérfano no resuelve
          // a ningún descriptor, pero `identidadClase` cae al valor crudo justamente para que dos
          // huérfanos del mismo portal muerto sigan comparándose entre sí.
          sitioId: elementoActual.sitioId,
          motivo: motivoHuerfano,
        });
        setTimeout(procesarSiguiente, 60);
        // El id huérfano viaja igual, y a propósito: el resolvedor compartido lo va a rechazar
        // y el click no va a abrir ninguna pestaña. Es la conducta correcta —no sabemos a qué
        // portal llevar al usuario— y la única alternativa sería adivinar, que es el bug.
        void registrarFallo("rechazo", tituloInmutableVideo, motivoHuerfano, elementoActual.sitioId);
        return;
      }

      const sessionId = Date.now().toString();

      await sesion.set({
        videoActualTitulo: tituloInmutableVideo,
        videoActualSessionId: sessionId,
        // [MULTIPORTAL E] Para que el aborto sepa en qué carpeta de portal limpiar el `.part`.
        videoActualSitioId: sitioDelItem.id,
        bytesProcesadosEnVideoActual: 0,
        fragmentosTerminadosEnVideoActual: 0,
        totalFragmentosEnVideoActual: 0,
        tiempoInicioVideoActual: performance.now(),
        velocidadMbsActual: 0,
        abortadoPorUsuario: false,
      });

      const estados = await recuperarEstados();
      estados[claveItem] = "process";
      await persistirEstados(estados);

      controladorGraficoActivo = new AbortController();
      const controlador = controladorGraficoActivo;

      try {
        // La resolución del .m3u8 es específica del portal (iframe, CDN, API): vive en el
        // adaptador de sitio, no en el motor, que es genérico.
        //
        // [CORTE 7] Las credenciales se leen ACÁ, por ítem y en el momento de bajar, no una
        // vez al arrancar la ráfaga: el usuario puede re-escanear el portal a mitad de una
        // cola larga para renovar un token vencido, y esa lectura tiene que verlo. Es la
        // misma razón por la que el portal se resuelve por ítem y no por composición.
        //
        // Se pide por `sitioDelItem.id` y no por `elementoActual.sitioId` crudo, por el mismo
        // motivo que la carpeta del multiportal E: el del descriptor ya pasó por la migración,
        // así que un ítem viejo sin `sitioId` busca las credenciales del portal legado y no
        // las de `undefined`.
        const credencialesDelPortal = await credenciales.para(sitioDelItem.id);
        const urlM3u8Descubierta = await sitioDelItem.resolverManifiesto(
          elementoActual.urlInterna,
          controlador.signal,
          credencialesDelPortal
        );

        const currentState = await sesion.get();
        if (!currentState.rafagaCorriendo) {
          return;
        }

        const listaFragmentos = await motor.descargarYAnalizarIndexM3u8(
          urlM3u8Descubierta,
          controlador.signal
        );
        await sesion.set({ totalFragmentosEnVideoActual: listaFragmentos.urls.length });

        const subcarpetaFinal = elementoActual.carpeta
          ? elementoActual.carpeta.trim().toLowerCase()
          : "biologia";

        const resultadoBloquesBlob = await motor.compilarTranscodificacionStream(
          listaFragmentos,
          controlador.signal,
          subcarpetaFinal,
          {
            modoTurbo: currentState.modoTurboBunActivo,
            titulo: tituloInmutableVideo,
            sessionId,
            // [MULTIPORTAL E] Va hasta el backend con cada fragmento: define en qué carpeta de
            // portal se escribe el archivo. El portal es el DEL ÍTEM, resuelto arriba.
            sitioId: sitioDelItem.id,
            // El motor sabe CUÁNDO frenar la ráfaga; el dueño del controlador es este bucle.
            abortarHermanos: () => controlador.abort(),
          },
          {
            onFragmentoCompletado: async (_peso, totalUrls, bytesAcumulados, fragmentosTerminados) => {
              const current = await sesion.get();
              if (!current.rafagaCorriendo) return;

              const progreso = calcularMetricas(
                bytesAcumulados,
                fragmentosTerminados,
                totalUrls,
                current.tiempoInicioVideoActual
              );
              const velocidadMbs = parseFloat(progreso.telemetry.velocidadTexto) || 0;

              await sesion.set({
                bytesProcesadosEnVideoActual: bytesAcumulados,
                fragmentosTerminadosEnVideoActual: fragmentosTerminados,
                velocidadMbsActual: velocidadMbs,
              });

              // Barra de progreso de la consola del backend. Sólo en turbo: en el camino
              // legacy los fragmentos no pasan por el servidor, así que no hay nada que
              // mostrar allá.
              if (current.modoTurboBunActivo) {
                actualizarConsolaBackend({
                  titulo: tituloInmutableVideo,
                  sitioId: sitioDelItem.id,
                  porcentaje: progreso.porcentaje,
                  terminados: fragmentosTerminados,
                  totales: totalUrls,
                  velocidad: velocidadMbs,
                });
              }

              mensajeria.notificar({
                action: "update_progress_bar",
                percentage: progreso.porcentaje,
                titulo: tituloInmutableVideo,
                compiling: false,
                telemetry: {
                  bytesProcesados: bytesAcumulados,
                  fragsTerminados: fragmentosTerminados,
                  totalFrags: totalUrls,
                  velocidadMbs,
                },
              });
            },
          }
        );

        const postDownloadState = await sesion.get();
        if (!postDownloadState.rafagaCorriendo) {
          return;
        }

        if (!postDownloadState.modoTurboBunActivo) {
          // Camino legacy no-Turbo: el blob se arma en memoria y se vuelca a disco. Hoy
          // inalcanzable (turbo está forzado), pero se conserva el flujo intacto.
          mensajeria.notificar({
            action: "update_progress_bar",
            percentage: 100,
            titulo: tituloInmutableVideo,
            compiling: true,
          });
          await guardarBlobLegacy(
            resultadoBloquesBlob as Blob,
            `${subcarpetaFinal}/${tituloInmutableVideo}.mp4`
          );
        } else {
          console.log(`✨ [SW-ENGINE] Modo Turbo Bun completado con éxito para: "${tituloInmutableVideo}"`);
        }

        const postWriteState = await sesion.get();
        if (!postWriteState.rafagaCorriendo) {
          return;
        }

        // Cola fresca: pudo cambiar mientras se descargaba.
        const dataUpdate = await almacenamiento.obtenerLocal<{ colaDescargas: ItemCola[] }>([
          "colaDescargas",
        ]);
        const colaActual = (dataUpdate.colaDescargas || []).filter(
          (c) => !identidad.misma(c, esteItem)
        );

        const objPersistente = listaCompleta.find((c) => identidad.misma(c, esteItem));
        if (objPersistente) objPersistente.estado = "downloaded";

        const estadosUpdate = await recuperarEstados();
        delete estadosUpdate[claveItem];

        // Escritura ATÓMICA: las tres claves describen el estado de la misma clase
        // (descargada → fuera de la cola, marcada 'downloaded', sin entrada de progreso).
        // En un solo `set` para que una suspensión del SW no las desincronice.
        await almacenamiento.guardarLocal({
          listaPersistente: listaCompleta,
          colaDescargas: colaActual,
          SW_ESTADOS_PROGRESO: estadosUpdate,
        });

        mensajeria.notificar({
          action: "clase_guardada_ok",
          titulo: tituloInmutableVideo,
          // ⚠️ EL `sitioId` NO ES OPCIONAL ACÁ. El popup usa este mensaje para sacar la clase de
          // SU copia de la cola, y compara por identidad (portal, título). Sin este campo el
          // `sitioId` viaja `undefined`, la migración lo interpreta como dato viejo y lo resuelve
          // al portal LEGADO — así que el mensaje de una clase de otro portal no matchea nada, el
          // popup no la saca, y su `respaldar()` reescribe la cola que el SW acaba de vaciar.
          // Resultado: el bucle vuelve a tomar la misma clase y la baja para siempre.
          // (Medido el 2026-08-07 con Anatomy. En Ramón Net no se veía porque su id ES el legado,
          // así que la clave coincidía de casualidad.)
          sitioId: elementoActual.sitioId,
          suaveFrenado: postWriteState.frenadoSuaveSolicitado,
        });

        setTimeout(procesarSiguiente, 60);
      } catch (errDescarga) {
        const err = errDescarga as { name?: string; message?: string; tipoConexion?: string; tipoBackend?: string; tipoPortal?: string; httpStatus?: number };
        const estadoTrasFallo = await sesion.get();

        // (1) SÓLO el flag explícito marca cancelación del usuario. NO usar `signal.aborted`
        // ni `name === 'AbortError'`: el motor aborta ese controlador A PROPÓSITO para frenar
        // a los workers hermanos cuando UN fragmento falla, así que los hermanos rechazan con
        // AbortError. Confiar en eso hacía que una caída de conexión se confundiera con
        // cancelación → la cola no se pausaba y el popup nunca recibía el banner.
        if (estadoTrasFallo.abortadoPorUsuario) {
          console.log(`🛑 [SW] Descarga de "${tituloInmutableVideo}" abortada por el usuario de forma limpia.`);
          return;
        }

        // (2) Sesión no iniciada: la página de la clase redirigió al login. No es red ni
        // crash, es accionable por el usuario. Se clasifica ANTES del daemon, que vería
        // internet=true y diría "internet".
        if (err?.tipoConexion === "sesion") {
          console.warn(`🔑 [SW] Descarga de "${tituloInmutableVideo}" pausada: no hay sesión activa en ${sitioDelItem.nombre}.`);
          await pausarPorError("sesion", tituloInmutableVideo, sitioDelItem.nombre, elementoActual.sitioId);
          return;
        }

        // (3) Rechazo aplicativo 4xx del backend, tras el reintento del motor. El server está
        // VIVO: /api/health daría 200 y el daemon diría "servidor" → loop pausa→autoheal→400.
        // Un 4xx es determinístico: se saltea SOLO esta clase y la cola sigue. La clase
        // vuelve a 'pending' (no a un 'error' que el resto del popup no reconoce): se ve como
        // pendiente normal y es re-encolable.
        if (err?.tipoBackend === "rechazo") {
          console.warn(`⛔ [SW] El backend rechazó fragmentos de "${tituloInmutableVideo}" (HTTP ${err.httpStatus}). Se salta la clase y la cola continúa.`);
          await saltearClaseYSeguir(`el backend rechazó sus fragmentos (HTTP ${err.httpStatus})`);
          return;
        }

        // (4) Rechazo del PORTAL sobre esta lección y sólo esta: no existe, no tiene media,
        // tiene DRM. Misma resolución que (3) —saltear y seguir— por el mismo motivo: es
        // determinístico, así que pausar y auto-sanar sería reintentarlo para siempre. Lo que
        // cambia es quién rechaza, y por eso el motivo que ve el usuario nombra al portal.
        if (err?.tipoPortal === "rechazo") {
          const detalle = err.httpStatus ? ` (HTTP ${err.httpStatus})` : "";
          console.warn(`⛔ [SW] ${sitioDelItem.nombre} rechazó "${tituloInmutableVideo}"${detalle}. Se salta la clase y la cola continúa.`);
          await saltearClaseYSeguir(`${sitioDelItem.nombre} rechazó esta clase${detalle}`);
          return;
        }

        // (5) Bloqueo SISTÉMICO del portal (token, `Referer`, hotlink del CDN). Se pausa y NO
        // se saltea: le va a pasar a todas las clases, así que saltear iría vaciando la cola de
        // a una, en silencio, hasta dejarla en cero sin que el usuario sepa por qué. Sin alarma
        // porque el daemon no puede ver que esto se recuperó: la red nunca estuvo caída.
        if (err?.tipoPortal === "bloqueo") {
          console.warn(`🚧 [SW] ${sitioDelItem.nombre} bloqueó la descarga de "${tituloInmutableVideo}" (HTTP ${err.httpStatus ?? "s/d"}): ${err.message}`);
          await pausarPorError("bloqueo", tituloInmutableVideo, sitioDelItem.nombre, elementoActual.sitioId);
          return;
        }

        // (6) Fallo REAL. Recién acá se loguea como error.
        console.error(`⚠️ [BUCLE-ERROR] Falló la descarga de "${tituloInmutableVideo}":`, errDescarga);

        // Clasificar con el daemon (fuente única). Si la conectividad está OK —el fallo no
        // fue de red— se cae a la heurística por mensaje para no clasificar mal.
        await conexion.verificarAhora();
        let tipoError = conexion.get().tipoFalla;
        if (!tipoError) {
          const msg = err?.message || "";
          // ⚠️ El `else` de esta heurística decía `"internet"`, y era una AFIRMACIÓN, no un
          // default: se llega acá justamente cuando el daemon acaba de medir que la red está
          // bien. Con dos orígenes de fallo (backend local y red) casi nunca mentía; con el
          // portal como tercero pasó a mentirle al usuario en cada 4xx de Hotmart. Ahora lo que
          // no se reconoce se llama por su nombre. **No agregues más `msg.includes()` acá**:
          // esa es la forma que degrada en silencio. Un fallo que se sabe clasificar se tipa en
          // el origen, como hacen los adaptadores de sitio y `bunClient`.
          tipoError =
            msg.includes("Bun") ||
            msg.includes("localhost") ||
            msg.includes("127.0.0.1") ||
            msg.includes("backend")
              ? "servidor"
              : "desconocido";
        }
        await pausarPorError(tipoError, tituloInmutableVideo, sitioDelItem.nombre, elementoActual.sitioId);
      }
    } catch (errStorage) {
      console.error("❌ [CRÍTICO-STORAGE] No se pudo leer el storage local de la cola:", errStorage);
      await sesion.set({ rafagaCorriendo: false });
      loopActivo = false;
    }
  }

  /**
   * Arranca el bucle si no está corriendo. La guarda es lo que impide **dos ráfagas
   * simultáneas**, que duplicaría descargas y pisaría el progreso.
   */
  function arrancarSiNoCorre(): void {
    if (loopActivo) return;
    loopActivo = true;
    void procesarSiguiente();
  }

  return {
    procesarSiguiente,
    arrancarSiNoCorre,
    pausarPorError,
    reanudar,
    estaActivo: () => loopActivo,
    /** Marca el bucle como detenido sin tocar el controlador (fin de ráfaga ordenado). */
    detener(): void {
      loopActivo = false;
    },
    /** Cancelación dura: frena el bucle y aborta la descarga en vuelo. */
    abortarRafaga(): void {
      loopActivo = false;
      if (!controladorGraficoActivo) return;
      try {
        controladorGraficoActivo.abort();
      } catch (e) {
        console.warn("⚠️ Falló el abort del controlador de gráfico activo (limpieza de fin de ráfaga):", (e as Error)?.message);
      }
      controladorGraficoActivo = null;
    },
    /**
     * Handler del disparo de auto-sanación. Devuelve si reanudó, para que el caller pueda
     * afirmar sobre ello sin espiar el estado.
     */
    async alDispararAutoheal(): Promise<boolean> {
      const state = await sesion.get();
      if (!state.colaPausadaPorError) {
        programador.cancelar(ALARMA_AUTOHEAL);
        return false;
      }
      // Guarda defensiva: los tipos que el daemon no puede ver recuperarse ("sesion",
      // "bloqueo") no se auto-reanudan. No se les crea alarma, pero si quedó una de un estado
      // previo —o de una versión anterior de la extensión— se limpia acá. Es la misma lista
      // positiva de `pausarPorError`: si las dos no coinciden, la alarma vuelve a loopear.
      if (!TIPOS_CON_AUTOHEAL.includes(state.tipoDeErrorConexion)) {
        programador.cancelar(ALARMA_AUTOHEAL);
        return false;
      }
      try {
        // Un solo chequeo vía el daemon. `verificarAhora()` además espeja el estado en la
        // sesión, así que el popup (si está abierto) lo ve.
        await conexion.verificarAhora();
        const est = conexion.get();
        const recuperado = state.tipoDeErrorConexion === "servidor" ? est.servidor : est.internet;
        if (recuperado) {
          console.log(`✅ [ALARM-AUTOHEAL] Conexión (${state.tipoDeErrorConexion}) recuperada. Reanudando...`);
          await reanudar();
          return true;
        }
      } catch {
        // Sigue sin conexión/servidor.
      }
      return false;
    },
  };
}

export type ProcesadorCola = ReturnType<typeof crearProcesadorCola>;
