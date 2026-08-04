/**
 * ESTADO DE SESIÓN DE LA RÁFAGA (V1.0.0)
 * ==========================================================================
 * Capa 1. Salió de `background.js` en la Fase 6b, primer paso de la mudanza de la cola.
 *
 * Es la mitad "service worker" del **split de ownership** (ver `docs/data-model.md`): el
 * progreso de la descarga ACTIVA, en el ámbito de sesión. La otra mitad —la lista scrapeada y
 * la selección de UI— es de `AppState`, en el ámbito local, y no se tocan entre sí: se
 * reconcilian por IPC (`obtener_estados_en_progreso`).
 *
 * POR QUÉ EXISTE ESTA ENVOLTURA Y NO SE LLAMA AL PUERTO DIRECTO
 * ------------------------------------------------------------
 * Por los **defaults**. `chrome.storage.session` arranca vacío en cada arranque del service
 * worker, y el bucle de descarga lee estas claves esperando valores, no `undefined`. Sin este
 * relleno, un SW recién despierto vería `rafagaCorriendo === undefined` y trataría un estado
 * "no sé" como "no". Acá el default es explícito y está en un solo lugar.
 *
 * `get()` devuelve SIEMPRE el estado completo. Hasta la Fase 6 aceptaba además una clave
 * suelta o una lista —el motor HLS pedía tres claves— pero ese call-site desapareció cuando
 * el motor pasó a recibir su contexto por parámetro, y los 11 restantes llamaban sin
 * argumentos. Se sacaron las ramas muertas en vez de tipar una polimorfia que nadie usa.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

export interface EstadoSesion {
  /** ¿Hay una ráfaga de descarga en curso? */
  rafagaCorriendo: boolean;
  /** El usuario pidió frenar al terminar la clase actual (no cortar de una). */
  frenadoSuaveSolicitado: boolean;
  /** Turbo = streaming al backend Bun. Hoy forzado a `true` en todo el proyecto. */
  modoTurboBunActivo: boolean;
  videoActualTitulo: string;
  bytesProcesadosEnVideoActual: number;
  fragmentosTerminadosEnVideoActual: number;
  totalFragmentosEnVideoActual: number;
  /** Sello de `performance.now()` al arrancar la clase, base del cálculo de velocidad. */
  tiempoInicioVideoActual: number;
  velocidadMbsActual: number;
  /** La cola quedó pausada por un fallo de conexión (ver `tipoDeErrorConexion`). */
  colaPausadaPorError: boolean;
  /** `""` | `"sesion"` | `"servidor"` | `"internet"`. Decide si el auto-heal aplica. */
  tipoDeErrorConexion: string;
  /** Distingue "el usuario canceló" de "falló": el primero no es un fallo que reportar. */
  abortadoPorUsuario: boolean;
  /** Vincula los fragmentos de una ráfaga; evita huérfanos en disco al cancelar. */
  videoActualSessionId: string;
}

export const DEFAULTS: EstadoSesion = {
  rafagaCorriendo: false,
  frenadoSuaveSolicitado: false,
  modoTurboBunActivo: true,
  videoActualTitulo: "",
  bytesProcesadosEnVideoActual: 0,
  fragmentosTerminadosEnVideoActual: 0,
  totalFragmentosEnVideoActual: 0,
  tiempoInicioVideoActual: 0,
  velocidadMbsActual: 0,
  colaPausadaPorError: false,
  tipoDeErrorConexion: "",
  abortadoPorUsuario: false,
  videoActualSessionId: "",
};

export function crearEstadoSesion(almacenamiento: PuertoAlmacenamiento) {
  const claves = Object.keys(DEFAULTS) as (keyof EstadoSesion)[];

  return {
    /** Estado completo, con los defaults rellenando lo que la sesión todavía no tiene. */
    async get(): Promise<EstadoSesion> {
      const data = await almacenamiento.obtenerSesion<EstadoSesion>(claves);
      // Se filtra por `!= null` y no por falsy: un `false` o un `0` **guardados** son valores
      // legítimos, y tratarlos como "vacío" haría que el default los pise. Es la diferencia
      // entre "no hay dato" y "el dato es false".
      const presentes = Object.fromEntries(
        claves.filter((k) => data[k] != null).map((k) => [k, data[k]])
      );
      return { ...DEFAULTS, ...presentes };
    },

    /**
     * Escritura parcial. Va por una sola llamada al puerto a propósito: un cambio lógico que
     * toca varias claves tiene que ser atómico, o el SW puede suspenderse en el medio y
     * dejarlas desincronizadas (ver `docs/patterns.md` §State ownership).
     */
    async set(updates: Partial<EstadoSesion>): Promise<void> {
      await almacenamiento.guardarSesion(updates);
    },

    async clear(): Promise<void> {
      await almacenamiento.borrarSesion(claves);
    },
  };
}

export type EstadoSesionAPI = ReturnType<typeof crearEstadoSesion>;
