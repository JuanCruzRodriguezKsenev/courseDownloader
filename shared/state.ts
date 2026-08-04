/**
 * MAQUINARIA DE ESTADO CENTRAL DEL POPUP (V6.1.0)
 * ==============================================================================================
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
 * POR QUÉ SIGUE EN `shared/` Y NO EN `core/`
 * ------------------------------------------
 * Ya no es por los puertos: desde la 5b el storage entra por `PuertoAlmacenamiento` y desde la
 * 5c el IPC por `PuertoMensajeria`. Lo único que lo retiene es **vocabulario del sitio**:
 * `catedraSeleccionada` en memoria y la clave `catedraElegida` en storage, que en Capa 1 no
 * pueden entrar. Se muda cuando se generalice a `facetaSeleccionada` — lo que pide migrar datos
 * ya persistidos (ver `docs/data-model.md` y el descriptor de faceta en
 * `sitio/ramonnet/config.ts`). Es el mismo patrón que destrabó al daemon de conexión: primero
 * se saca el dato de sitio, después el archivo se muda.
 */
import type { PuertoAlmacenamiento } from "../core/puertos/almacenamiento";
import type { PuertoMensajeria } from "../core/puertos/mensajeria";

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
  "catedraElegida",
  "ocultarAdvExplorar",
  "ocultarAdvAula",
  "ordenAscendente",
  "tutorialCompletado",
] as const;

/** Claves que se borran al cerrar una sesión de trabajo (la elección de cátedra sobrevive). */
const CLAVES_DE_SESION = ["listaPersistente", "colaDescargas", "faseDiscoOk"];

const TIMEOUT_IPC_MS = 3000;

interface DatosPersistidos {
  listaPersistente?: ClaseEnLista[];
  colaDescargas?: unknown[];
  faseDiscoOk?: boolean;
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
    catedraSeleccionada: null as string | null,
    videoActualEnTransmisiónSW: "",
    modoTurboBun: true, // Forzado a true (Modo Turbo único activo)
    ocultarAdvertenciaExplorar: false,
    ocultarAdvertenciaAula: false,
    ordenAscendente: true,
    tutorialCompletado: false,

    async inicializarSincronizacionStorage(): Promise<void> {
      const data = await almacenamiento.obtenerLocal<DatosPersistidos>([...CLAVES_PERSISTIDAS]);

      // Normalización defensiva: un estado 'error' heredado de storage viejo (el fix del
      // bug 400 lo usó al principio, ya revertido a 'pending') no lo reconoce el resto del
      // popup — se lo trata como 'pending' para que sea re-encolable y se renderice bien.
      // Ver docs/notificaciones-fallos-diseno.md.
      app.listadoClasesGlobal = (data.listaPersistente || []).map((c) =>
        c && c.estado === "error" ? { ...c, estado: "pending" } : c
      );
      app.colaDescargas = data.colaDescargas || [];
      app.sincronizacionDiscoCompletada = data.faseDiscoOk || false;
      app.catedraSeleccionada = data.catedraElegida || null;
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
          catedraElegida: app.catedraSeleccionada,
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
