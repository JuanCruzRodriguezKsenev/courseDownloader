/**
 * MAQUINARIA DE ESTADO CENTRAL DEL POPUP (V6.0.0)
 * ==============================================================================================
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
 * QUÉ QUEDÓ FUERA DE LA FASE 5B (a propósito)
 * -------------------------------------------
 * `sincronizarConBackground()` sigue tocando `chrome.runtime` directo: es IPC, no storage, y el
 * puerto de esta fase cubre sólo persistencia. Desacoplarlo pide un `PuertoMensajeria` que
 * todavía no existe. Por eso este módulo sigue en `shared/` y no se mudó a `core/`: además del
 * IPC, arrastra vocabulario del sitio (`catedraSeleccionada` / la clave `catedraElegida`), que
 * en Capa 1 no puede entrar. Su hogar definitivo se decide cuando exista ese puerto.
 */
import type { PuertoAlmacenamiento } from "../core/puertos/almacenamiento";

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

export function crearAppState(almacenamiento: PuertoAlmacenamiento) {
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
     * Reconcilia con el SW, que es la autoridad sobre el progreso de la descarga. El timeout de
     * rescate existe porque el SW puede estar dormido: sin él, el popup queda esperando para
     * siempre. Sigue en `chrome.runtime` — ver la nota de cabecera sobre el puerto de mensajería.
     */
    async sincronizarConBackground(): Promise<RespuestaFondo> {
      return new Promise((resolve) => {
        const vacio: RespuestaFondo = { estados: {}, porcentaje: 0, telemetry: null };
        const timer = setTimeout(() => {
          console.warn("[AppState] SW no respondió (Timeout de rescate).");
          resolve(vacio);
        }, TIMEOUT_IPC_MS);

        chrome.runtime.sendMessage(
          { action: "obtener_estados_en_progreso" },
          (respuestaFondo: RespuestaFondo | undefined) => {
            clearTimeout(timer);

            if (chrome.runtime.lastError || !respuestaFondo) {
              console.warn("[AppState] Canal IPC inactivo o SW dormido.");
              resolve(vacio);
              return;
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

            resolve(respuestaFondo);
          }
        );
      });
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
