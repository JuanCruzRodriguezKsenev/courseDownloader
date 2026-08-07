/**
 * MAQUINARIA DE ESTADO CENTRAL DEL POPUP (V6.3.0)
 * ==============================================================================================
 * CHANGELOG v6.3.0:
 * - [MULTISITIO CORTE 6D — ADR-0011] Normalización de una sola vez de `colaDescargas` por
 *   `fechaEncolado` para las instalaciones anteriores al corte 6b. Desde este corte el array
 *   es el orden de descarga, y una cola guardada antes está en un orden que nadie garantizó
 *   —el service worker la re-ordenaba en cada vuelta—. Se cuelga de la rama de migración que
 *   ya existía, así que no agrega una clave nueva a storage.
 * CHANGELOG v6.2.0:
 * - [FASE 5C] Generalizado el último vocabulario de sitio: `catedraSeleccionada` pasa a
 *   `facetaSeleccionada` en memoria y la clave persistida `catedraElegida` a `facetaElegida`.
 *   El resto del popup ya era genérico —`faceta.js` y `filters.js` leen por
 *   `faceta.claveEstado`, del descriptor del sitio—, así que el único acoplado era este
 *   archivo. **Con esto no le queda nada de Ramón Net y puede mudarse a `core/`.**
 * - [MIGRACIÓN DE DATOS] La clave vieja se sigue LEYENDO al inicializar y se adopta si la
 *   nueva no está: una instalación existente ya tiene su cátedra elegida, y perderla haría
 *   reaparecer el modal multicátedra sin motivo visible para el usuario. Adoptado el valor,
 *   la clave vieja se borra — la migración se paga una vez. Si ambas existen gana la nueva.
 * CHANGELOG v6.1.0:
 * - [FASE 5C] `sincronizarConBackground()` deja de tocar `chrome.runtime`: el único IPC de este
 *   archivo pasa al `PuertoMensajeria`, que llega por inyección como el de storage
 *   (`crearAppState(almacenamiento, mensajeria)`). Con esto **no queda ni un `chrome.*` acá**.
 *   La elección de `enviar()` (y no `notificar()`) es deliberada: esto es una consulta cuya
 *   respuesta se procesa. Sin cambios de comportamiento — se conservan tal cual el timeout de
 *   rescate de 3s y el resolver-vacío ante canal caído; lo que antes era `lastError` ahora es
 *   el rechazo del puerto, que es exactamente lo que el puerto promete.
 * CHANGELOG v6.0.0:
 * - [FASE 5B + TS] Migrado de `shared/state.js` a TypeScript y desacoplado de `chrome.storage`:
 *   los tres call-sites de storage (get/set/remove) pasan por `PuertoAlmacenamiento`, que llega
 *   por inyección. De objeto singleton a factory `crearAppState(almacenamiento)`, instanciada en
 *   `plataforma/composicion.ts` (mismo patrón que `core/historial/historialFallos.ts` en 5a).
 *   Sin cambios de comportamiento. Estrenó tests propios (`state.test.ts`) contra
 *   `AlmacenamientoEnMemoria`: antes este archivo NO tenía cobertura real — los tests del popup
 *   mockean `globalThis.AppState` entero, así que nunca lo ejercitaban.
 * CHANGELOG v5.2.1:
 * - [FIX] inicializarSincronizacionStorage normaliza un estado 'error' heredado de storage
 *   viejo (fix bug 400 previo, ya revertido) a 'pending' al cargar, para que esas clases
 *   sean re-encolables y se rendericen bien. Ver background.js v5.10.1, docs/notificaciones-fallos-diseno.md.
 * CHANGELOG v5.2.0:
 * - [FIX] limpiarSesionLocal: ahora resetea listadoClasesGlobal y ráfagaEnCurso en memoria.
 *   Antes solo limpiaba el storage, dejando el estado en memoria inconsistente si el popup
 *   permanecía abierto tras cancelar una descarga.
 * ==============================================================================================
 * Estado del POPUP: la lista scrapeada, la selección/filtros de UI y la cola, espejados en
 * `chrome.storage.local`. El estado de la descarga en curso NO vive acá: es del service worker
 * (`SessionState`, en `storage.session`). Ver docs/data-model.md §State ownership split.
 *
 * CAPA 1: ESTADO GENÉRICO, NI `chrome.*` NI VOCABULARIO DE PORTAL
 * ---------------------------------------------------------------
 * Llegó acá en tres pasos, y el orden importa porque es el patrón: primero los puertos
 * (storage en la 5b, IPC en la 5c), después **sacarle el dato de sitio**. Mientras el campo se
 * llamó `catedraSeleccionada` este archivo no podía ser Capa 1 por una sola palabra.
 *
 * Qué faceta se filtra lo decide el adaptador de sitio: `PuertoSitio.faceta.claveEstado`
 * nombra el campo de acá que le corresponde, y `faceta.js`/`filters.js` lo leen por esa
 * indirección. Este módulo no sabe —ni tiene por qué— que existen las cátedras.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";
import type { PuertoMensajeria } from "../puertos/mensajeria";

/**
 * Forma mínima de una clase de la lista: sólo los campos que ESTE módulo toca. El modelo real
 * lo produce el scraper del sitio y lo consumen popup/features; tiparlo entero acá sería
 * apropiarse de un contrato que no es de este archivo.
 */
export interface ClaseEnLista {
  titulo?: string;
  estado?: string;
  seleccionado?: boolean;
  /**
   * De qué portal salió esta clase (ADR-0010: el sitio es propiedad del ítem, no de la build).
   * Opcional en el tipo porque los datos previos al multi-sitio no lo traen; en memoria
   * siempre está, porque se normaliza al cargar. Ver `SITIO_LEGADO`.
   */
  sitioId?: string;
  [clave: string]: unknown;
}

/** Respuesta del SW a `obtener_estados_en_progreso`. */
export interface RespuestaFondo {
  estados?: Record<string, string>;
  suaveFrenado?: boolean;
  videoActual?: string;
  porcentaje?: number;
  telemetry?: unknown;
}

const CLAVES_PERSISTIDAS = [
  "listaPersistente",
  "colaDescargas",
  "faseDiscoOk",
  "facetasElegidas",
  // Se sigue LEYENDO para migrar (ver MIGRACION_FACETA). No se escribe nunca más.
  "facetaElegida",
  "ocultarAdvExplorar",
  "ocultarAdvAula",
  "ordenAscendente",
  "criterioOrdenCola",
  "ordenColaAscendente",
  "criterioOrdenDisponibles",
  "tutorialCompletado",
] as const;

/**
 * Criterios de orden de la pestaña Cola (corte 6b del multi-sitio).
 *
 * `faceta` y `portal` se resuelven contra el descriptor de CADA ítem, no contra uno fijo: la
 * cola puede mezclar portales (ADR-0010). `portal` ordena por portal y, dentro de cada uno, por
 * llegada — elegirlo es *agrupar*, no reordenar.
 */
export const CRITERIOS_ORDEN_COLA = ["llegada", "nombre", "faceta", "portal"] as const;
export type CriterioOrdenCola = (typeof CRITERIOS_ORDEN_COLA)[number];

/**
 * Criterios de la pestaña Disponibles. Son otros porque ahí los ejes existentes son otros:
 * no hay `llegada` (el listado no se encoló, se escaneó) ni `portal` (sale del scrapeo de una
 * pestaña, o sea un portal por construcción). El sentido lo sigue dando `ordenAscendente`.
 */
export const CRITERIOS_ORDEN_DISPONIBLES = ["nombre", "faceta", "estado"] as const;
export type CriterioOrdenDisponibles = (typeof CRITERIOS_ORDEN_DISPONIBLES)[number];

/**
 * Clave anterior de la faceta, leída sólo para migrar. Hasta el 2026-08-03 la elección se
 * guardaba como `catedraElegida`, vocabulario de Ramón Net metido en la maquinaria genérica.
 *
 * Se lee **además** de la nueva y se adopta si la nueva no está: una instalación existente
 * ya tiene su cátedra elegida en storage, y perderla no rompe nada pero obliga al usuario a
 * volver a elegirla —y el modal multicátedra reaparece— sin ninguna razón visible. Adoptado el
 * valor, la clave vieja se borra ahí mismo: la migración se paga una vez y no queda basura.
 */
const CLAVE_FACETA_LEGACY = "catedraElegida";

/**
 * MIGRACION_FACETA — la elección de faceta pasó de un valor único a un mapa por portal.
 *
 * Hasta el corte multiportal B la clave `facetaElegida` guardaba **un** valor, porque había un
 * solo portal. Con dos, ese casillero compartido rompe el caso central del frente: la elección
 * de un portal se aplica al otro, no matchea ninguno de sus valores y **el listado se ve
 * vacío** — sin error, sin explicación y sin nada que lo afirme.
 *
 * La migración es la misma forma que ya se usó dos veces acá (`catedraElegida` →
 * `facetaElegida`): se lee la clave vieja, su valor entra como el del **portal legado**
 * —correcto por construcción, era el único portal que existía— y la clave vieja se borra. Se
 * paga una vez y no queda basura.
 *
 * Perder la elección no rompe nada, pero hace reaparecer el modal de cátedra sin motivo
 * visible para el usuario. Por eso se migra en vez de arrancar de cero.
 */
const CLAVE_FACETA_UNICA_LEGACY = "facetaElegida";

/**
 * Portal que se le asume a un ítem persistido SIN `sitioId` (ADR-0010).
 *
 * No es un default de negocio ni "el portal principal": es una regla de **migración de datos**.
 * Es correcta por construcción —hasta que existió el multi-sitio, Ramón Net era el único
 * portal, así que todo lo guardado antes vino de ahí— y por eso el valor está clavado acá y no
 * sale del registro de sitios: si mañana cambia cuál es el portal "por defecto", **este valor
 * no debe cambiar**, porque describe el pasado.
 *
 * Se aplica al cargar (`inicializarSincronizacionStorage`), no al escribir: lo escrito nuevo ya
 * viene estampado desde el scraping. Mismo criterio que `CLAVE_FACETA_LEGACY`.
 */
export const SITIO_LEGADO = "ramonnet";

/** Claves que se borran al cerrar una sesión de trabajo (la faceta elegida sobrevive). */
const CLAVES_DE_SESION = ["listaPersistente", "colaDescargas", "faseDiscoOk"];

const TIMEOUT_IPC_MS = 3000;

interface DatosPersistidos {
  listaPersistente?: ClaseEnLista[];
  colaDescargas?: unknown[];
  faseDiscoOk?: boolean;
  /** La elección por portal: `{ [sitioId]: valor }`. Ver MIGRACION_FACETA. */
  facetasElegidas?: Record<string, string | null>;
  /** Sólo para la migración: era la elección ÚNICA, previa al multiportal. */
  facetaElegida?: string | null;
  /** Sólo para la migración de la clave más vieja todavía; no se escribe nunca más. */
  catedraElegida?: string | null;
  ocultarAdvExplorar?: boolean;
  ocultarAdvAula?: boolean;
  /**
   * Tri-estado histórico. **Servía a las dos pestañas con semánticas distintas**, que es la
   * razón por la que el corte 6b NO lo partió en dos y le agregó un par propio a la cola:
   *   - Disponibles: sólo mira su verdad/falsedad → `null` ordenaba DESCENDENTE.
   *   - Cola: `null` = FIFO, `true`/`false` = nombre ascendente/descendente.
   * Un split ingenuo (`null` → ascendente) habría dado vuelta el orden de Disponibles en toda
   * instalación existente, sin que nada lo dijera. Sigue siendo el sentido de Disponibles.
   */
  ordenAscendente?: boolean;
  criterioOrdenCola?: string;
  ordenColaAscendente?: boolean;
  criterioOrdenDisponibles?: string;
  tutorialCompletado?: boolean;
}

export function crearAppState(almacenamiento: PuertoAlmacenamiento, mensajeria: PuertoMensajeria) {
  const app = {
    listadoClasesGlobal: [] as ClaseEnLista[],
    colaDescargas: [] as unknown[], // 🚀 Cola desacoplada
    ráfagaEnCurso: false,
    banderaFrenadoSolicitado: false,
    pestañaActiva: "disponibles",
    sincronizacionDiscoCompletada: false,
    /**
     * La faceta elegida **por portal**: `{ [sitioId]: valor }`.
     *
     * Era un valor suelto hasta el corte multiportal B, y eso rompía el caso que da nombre al
     * frente: elegís "Cátedra A" en un portal, pasás al otro, y como "A" no matchea ninguno de
     * SUS valores el listado se ve vacío — sin error y sin explicación.
     *
     * No se lee directo: usá `facetaElegidaDe(sitioId)` / `fijarFacetaElegida(...)`.
     */
    facetasElegidas: {} as Record<string, string | null>,
    videoActualEnTransmisiónSW: "",
    modoTurboBun: true, // Forzado a true (Modo Turbo único activo)
    ocultarAdvertenciaExplorar: false,
    ocultarAdvertenciaAula: false,
    ordenAscendente: true,
    /** Pestaña Cola: qué criterio y en qué sentido (corte 6b). Independiente de Disponibles. */
    criterioOrdenCola: "llegada" as CriterioOrdenCola,
    ordenColaAscendente: true,
    /**
     * Disponibles: qué criterio. El sentido sigue siendo `ordenAscendente`, así que no hace
     * falta migración — el default `"nombre"` reproduce exactamente lo que hacía antes, que
     * era ordenar siempre por título.
     */
    criterioOrdenDisponibles: "nombre" as CriterioOrdenDisponibles,
    tutorialCompletado: false,

    async inicializarSincronizacionStorage(): Promise<void> {
      const data = await almacenamiento.obtenerLocal<DatosPersistidos>([
        ...CLAVES_PERSISTIDAS,
        CLAVE_FACETA_LEGACY,
      ]);

      // Normalización defensiva: un estado 'error' heredado de storage viejo (el fix del
      // bug 400 lo usó al principio, ya revertido a 'pending') no lo reconoce el resto del
      // popup — se lo trata como 'pending' para que sea re-encolable y se renderice bien.
      // Ver docs/notificaciones-fallos-diseno.md.
      //
      // Y normalización de `sitioId` (ADR-0010): lo persistido antes del multi-sitio no lo
      // trae. Se completa acá, al cargar, para que el resto del código pueda asumir que
      // SIEMPRE está y no repita el `?? SITIO_LEGADO` en cada consumidor.
      app.listadoClasesGlobal = (data.listaPersistente || []).map((c) => {
        if (!c) return c;
        const estado = c.estado === "error" ? "pending" : c.estado;
        return { ...c, estado, sitioId: c.sitioId || SITIO_LEGADO };
      });
      app.colaDescargas = (data.colaDescargas || []).map((c) =>
        c ? { ...c, sitioId: (c as ClaseEnLista).sitioId || SITIO_LEGADO } : c
      );
      app.sincronizacionDiscoCompletada = data.faseDiscoOk || false;
      // Migración de la faceta elegida, en dos escalones (ver CLAVE_FACETA_LEGACY y
      // MIGRACION_FACETA). El mapa nuevo gana si existe: si conviven, lo viejo es un resto de
      // una instalación ya migrada y no manda.
      //
      // El valor único —de cuando había un solo portal— entra como el del **portal legado**.
      // Es correcto por construcción: no había otro portal del cual pudiera venir.
      const clavesViejasAborrar: string[] = [];
      if (data.facetasElegidas && typeof data.facetasElegidas === "object") {
        app.facetasElegidas = { ...data.facetasElegidas };
      } else {
        const valorUnico = data.facetaElegida ?? data.catedraElegida ?? null;
        app.facetasElegidas = valorUnico === null ? {} : { [SITIO_LEGADO]: valorUnico };
      }
      // Se pagan una sola vez: adoptado el valor, las claves viejas se van. Fire-and-forget
      // como `respaldar()` — si falla, el peor caso es volver a migrar el próximo arranque.
      if (data.catedraElegida !== undefined) clavesViejasAborrar.push(CLAVE_FACETA_LEGACY);
      if (data.facetaElegida !== undefined) clavesViejasAborrar.push(CLAVE_FACETA_UNICA_LEGACY);
      if (clavesViejasAborrar.length > 0) {
        void almacenamiento.borrarLocal(clavesViejasAborrar).catch((e: unknown) => {
          console.warn("[AppState] No se pudieron limpiar las claves de faceta viejas:", e);
        });
      }
      app.ocultarAdvertenciaExplorar = data.ocultarAdvExplorar || false;
      app.ocultarAdvertenciaAula = data.ocultarAdvAula || false;
      app.ordenAscendente = data.ordenAscendente !== undefined ? data.ordenAscendente : true;

      // [MULTISITIO CORTE 6B] Migración del orden de la Cola.
      //
      // Antes, el tri-estado `ordenAscendente` decía las dos cosas a la vez para esta pestaña:
      // `null` = FIFO, `true`/`false` = nombre ascendente/descendente. Ahora el criterio y el
      // sentido son campos propios, y se derivan del valor viejo 1 a 1 y sin pérdida.
      //
      // `ordenAscendente` NO se toca: sigue siendo el sentido de Disponibles, donde `null`
      // significa descendente. Derivarlo hacia `true` acá habría dado vuelta esa pestaña en toda
      // instalación existente — el tri-estado servía a dos consumidores con reglas distintas.
      if (data.criterioOrdenCola !== undefined) {
        app.criterioOrdenCola = (CRITERIOS_ORDEN_COLA as readonly string[]).includes(data.criterioOrdenCola)
          ? (data.criterioOrdenCola as CriterioOrdenCola)
          : "llegada";
        app.ordenColaAscendente = data.ordenColaAscendente !== undefined ? data.ordenColaAscendente : true;
      } else {
        app.criterioOrdenCola = data.ordenAscendente == null ? "llegada" : "nombre";
        app.ordenColaAscendente = data.ordenAscendente == null ? true : data.ordenAscendente;

        // [MULTISITIO CORTE 6D — ADR-0011] Normalización de una sola vez de la cola vieja.
        //
        // Desde este corte el array ES el orden de descarga, pero una cola guardada ANTES
        // quedó en el orden en que el array fue quedando, que nadie garantizó nunca porque el
        // service worker lo re-ordenaba en cada vuelta. Al cargarla por primera vez hay que
        // dejarla en el orden que el usuario venía viendo: por `fechaEncolado`.
        //
        // Va en esta rama y no en una propia porque este `else` YA ES la señal de "instalación
        // anterior al corte 6b": en cuanto se respalde, `criterioOrdenCola` queda escrito y no
        // se vuelve a entrar. Así la migración no necesita una clave nueva en storage.
        app.colaDescargas = [...app.colaDescargas].sort(
          (a, b) =>
            ((a as { fechaEncolado?: number })?.fechaEncolado || 0) -
            ((b as { fechaEncolado?: number })?.fechaEncolado || 0)
        );
      }

      // Disponibles no necesita migración: sin la clave, el default reproduce lo de antes.
      app.criterioOrdenDisponibles = (CRITERIOS_ORDEN_DISPONIBLES as readonly string[]).includes(
        data.criterioOrdenDisponibles as string
      )
        ? (data.criterioOrdenDisponibles as CriterioOrdenDisponibles)
        : "nombre";

      app.tutorialCompletado = data.tutorialCompletado || false;
      app.modoTurboBun = true;
    },

    /**
     * La faceta elegida para un portal, o `null` si todavía no eligió para ese.
     *
     * [MULTIPORTAL B] Existe como método y no como acceso directo al mapa para que el resto del
     * código no pueda volver a tratar la elección como un valor único: el bug que este corte
     * cierra es exactamente ese, y era invisible con un solo portal.
     */
    facetaElegidaDe(sitioId: string | undefined): string | null {
      if (!sitioId) return null;
      return app.facetasElegidas[sitioId] ?? null;
    },

    /** Fija (o limpia, con `null`) la faceta elegida de UN portal. No respalda: eso lo decide el caller. */
    fijarFacetaElegida(sitioId: string | undefined, valor: string | null): void {
      if (!sitioId) return;
      if (valor === null) delete app.facetasElegidas[sitioId];
      else app.facetasElegidas[sitioId] = valor;
    },

    /**
     * Persiste el estado completo. Es una sola escritura multi-clave a propósito: el puerto
     * documenta que un cambio lógico que toca varias claves va en UNA llamada (si el contexto
     * muere entre dos, quedan desincronizadas).
     *
     * Sigue siendo fire-and-forget como en vanilla: ~200 call-sites lo llaman sin await. El
     * `catch` deja rastro en consola en vez de un rechazo sin manejar.
     */
    respaldar(): void {
      void almacenamiento
        .guardarLocal({
          listaPersistente: app.listadoClasesGlobal,
          colaDescargas: app.colaDescargas,
          faseDiscoOk: app.sincronizacionDiscoCompletada,
          facetasElegidas: app.facetasElegidas,
          ocultarAdvExplorar: app.ocultarAdvertenciaExplorar,
          ocultarAdvAula: app.ocultarAdvertenciaAula,
          ordenAscendente: app.ordenAscendente,
          criterioOrdenCola: app.criterioOrdenCola,
          ordenColaAscendente: app.ordenColaAscendente,
          criterioOrdenDisponibles: app.criterioOrdenDisponibles,
          tutorialCompletado: app.tutorialCompletado,
        })
        .catch((e: unknown) => {
          console.warn("[AppState] Error al persistir estado:", e);
        });
    },

    /**
     * Reconcilia con el SW, que es la autoridad sobre el progreso de la descarga.
     *
     * Va por `enviar()` y no por `notificar()` porque es una consulta: sin respuesta no hay
     * nada que reconciliar. El puerto rechaza si el canal falla (SW ausente), y además se
     * mantiene el **timeout de rescate**, que cubre un caso distinto y que el puerto no
     * promete resolver: el SW acepta el mensaje, promete responder async y nunca lo hace —
     * sin este reloj el popup espera para siempre. Los dos caminos terminan igual: estado
     * vacío, sin tocar la lista en memoria.
     */
    async sincronizarConBackground(): Promise<RespuestaFondo> {
      const vacio: RespuestaFondo = { estados: {}, porcentaje: 0, telemetry: null };
      let temporizador: ReturnType<typeof setTimeout> | undefined;

      const rescate = new Promise<undefined>((resolve) => {
        temporizador = setTimeout(() => {
          console.warn("[AppState] SW no respondió (Timeout de rescate).");
          resolve(undefined);
        }, TIMEOUT_IPC_MS);
      });

      let respuestaFondo: RespuestaFondo | undefined;
      try {
        respuestaFondo = await Promise.race([
          mensajeria.enviar<RespuestaFondo | undefined>({ action: "obtener_estados_en_progreso" }),
          rescate,
        ]);
      } catch {
        // El puerto rechaza cuando no hay receptor: antes esto era `chrome.runtime.lastError`.
        respuestaFondo = undefined;
      } finally {
        clearTimeout(temporizador);
      }

      if (!respuestaFondo) {
        console.warn("[AppState] Canal IPC inactivo o SW dormido.");
        return vacio;
      }

      try {
        const estadosEnFondo = respuestaFondo.estados || {};
        app.ráfagaEnCurso = Object.values(estadosEnFondo).some((est) => est === "process");
        app.banderaFrenadoSolicitado = respuestaFondo.suaveFrenado || false;
        app.videoActualEnTransmisiónSW = respuestaFondo.videoActual || "";

        // El SW manda el estado por título: se copia sobre la lista en memoria.
        if (Array.isArray(app.listadoClasesGlobal)) {
          for (const clase of app.listadoClasesGlobal) {
            if (!clase || !clase.titulo) continue;
            const estadoNuevo = estadosEnFondo[clase.titulo];
            if (estadoNuevo !== undefined) clase.estado = estadoNuevo;
          }
        }
      } catch (err) {
        console.error("[AppState] Error procesando respuesta de fondo:", err);
      }

      return respuestaFondo;
    },

    conmutarSeleccionMasiva(marcarTodos: boolean, clasesVisibles: ClaseEnLista[]): void {
      clasesVisibles.forEach((clase) => {
        if (clase.estado === "pending") {
          clase.seleccionado = marcarTodos;
        }
      });
      app.respaldar();
    },

    // Modo Turbo es el único camino vivo: la firma se conserva porque hay call-sites, pero
    // el valor está forzado (ver docs/tech-stack.md §Por qué Bun).
    establecerModoTurbo(_activado?: boolean): void {
      app.modoTurboBun = true;
    },

    limpiarSesionLocal(): void {
      app.listadoClasesGlobal = [];
      app.colaDescargas = [];
      app.ráfagaEnCurso = false;
      app.banderaFrenadoSolicitado = false;
      app.sincronizacionDiscoCompletada = false;
      // Conservamos la cátedra seleccionada para evitar que la UI la vuelva a solicitar al
      // re-escanear tras terminar.
      app.videoActualEnTransmisiónSW = "";
      app.modoTurboBun = true;
      void almacenamiento.borrarLocal(CLAVES_DE_SESION).catch((e: unknown) => {
        console.warn("[AppState] Error al limpiar storage:", e);
      });
    },
  };

  return app;
}

export type AppState = ReturnType<typeof crearAppState>;
