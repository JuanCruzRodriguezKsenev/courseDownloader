/**
 * MAQUINARIA DE ESTADO CENTRAL DEL POPUP (V6.2.0)
 * ==============================================================================================
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
  "facetaElegida",
  "ocultarAdvExplorar",
  "ocultarAdvAula",
  "ordenAscendente",
  "tutorialCompletado",
] as const;

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

/** Claves que se borran al cerrar una sesión de trabajo (la faceta elegida sobrevive). */
const CLAVES_DE_SESION = ["listaPersistente", "colaDescargas", "faseDiscoOk"];

const TIMEOUT_IPC_MS = 3000;

interface DatosPersistidos {
  listaPersistente?: ClaseEnLista[];
  colaDescargas?: unknown[];
  faseDiscoOk?: boolean;
  facetaElegida?: string | null;
  /** Sólo para la migración de la clave vieja; no se escribe nunca más. */
  catedraElegida?: string | null;
  ocultarAdvExplorar?: boolean;
  ocultarAdvAula?: boolean;
  ordenAscendente?: boolean;
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
    facetaSeleccionada: null as string | null,
    videoActualEnTransmisiónSW: "",
    modoTurboBun: true, // Forzado a true (Modo Turbo único activo)
    ocultarAdvertenciaExplorar: false,
    ocultarAdvertenciaAula: false,
    ordenAscendente: true,
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
      app.listadoClasesGlobal = (data.listaPersistente || []).map((c) =>
        c && c.estado === "error" ? { ...c, estado: "pending" } : c
      );
      app.colaDescargas = data.colaDescargas || [];
      app.sincronizacionDiscoCompletada = data.faseDiscoOk || false;
      // Migración de la clave vieja (ver CLAVE_FACETA_LEGACY). La nueva gana si existe: si
      // ambas están, la vieja es un resto de una instalación migrada y ya no manda.
      app.facetaSeleccionada = data.facetaElegida ?? data.catedraElegida ?? null;
      if (data.catedraElegida !== undefined) {
        // Se paga una sola vez: adoptado el valor, la clave vieja se va. Fire-and-forget
        // como `respaldar()` — si falla, el peor caso es volver a migrar el próximo arranque.
        void almacenamiento.borrarLocal([CLAVE_FACETA_LEGACY]).catch((e: unknown) => {
          console.warn("[AppState] No se pudo limpiar la clave de faceta vieja:", e);
        });
      }
      app.ocultarAdvertenciaExplorar = data.ocultarAdvExplorar || false;
      app.ocultarAdvertenciaAula = data.ocultarAdvAula || false;
      app.ordenAscendente = data.ordenAscendente !== undefined ? data.ordenAscendente : true;
      app.tutorialCompletado = data.tutorialCompletado || false;
      app.modoTurboBun = true;
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
          facetaElegida: app.facetaSeleccionada,
          ocultarAdvExplorar: app.ocultarAdvertenciaExplorar,
          ocultarAdvAula: app.ocultarAdvertenciaAula,
          ordenAscendente: app.ordenAscendente,
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
