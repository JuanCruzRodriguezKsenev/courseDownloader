/**
 * DAEMON DE ESTADO DE CONEXIÓN (V3.0.0)
 * ==========================================================================
 * CHANGELOG v3.0.0:
 * - [CAPA 1] Mudado de `shared/conexion.ts` a `core/conexion/conexion.ts`. Lo que
 *   faltaba para poder hacerlo era la última atadura a la Capa 2: leía el global
 *   `SitioActivo` para saber a qué host mandarle el HEAD de "hay internet". Ahora esa
 *   URL **se inyecta** (`crearConexion(puerto, { urlSondeoInternet })`) desde
 *   `plataforma/composicion.ts`, que la toma del adaptador de sitio. Destrabó el corte
 *   `config.js` → `config.ts` (Fase 5c): hasta entonces `composicion.ts` no podía
 *   importar el adaptador (`allowJs: false`).
 * - [CAPA 1] Se fue con él el fallback `URL_SONDEO_FALLBACK`, que era el host de Ramón
 *   Net hardcodeado. En `shared/` era tolerable; en `core/` viola el invariante de la
 *   capa (cero vocabulario de sitio), así que la URL pasa a ser **obligatoria** y los
 *   tests pasan la suya. Sin cambios de comportamiento en runtime: el valor efectivo es
 *   el mismo que ya venía de `SitioActivo.urlSondeoInternet`.
 * CHANGELOG v2.0.0:
 * - [FASE 5B + TS] Migrado de `shared/conexion.js` a TypeScript y desacoplado de
 *   `chrome.storage`: el espejado cross-contexto (escribir en session + escuchar cambios)
 *   pasa por `PuertoAlmacenamiento`. De objeto singleton a factory `crearConexion(puerto)`,
 *   instanciada en `plataforma/composicion.ts`. `BunClient` pasa de global sniffeada a
 *   import directo (los dos ya son módulos del núcleo). Sin cambios de comportamiento;
 *   sus tests dejaron de mockear `chrome.*` a mano y corren contra `AlmacenamientoEnMemoria`.
 * CHANGELOG v1.1.0:
 * - [CAPA 2] URL_SONDEO_INTERNET pasó de constante hardcodeada a getter que lee
 *   `SitioActivo.urlSondeoInternet` (sitio/ramonnet/config.js), con fallback al valor
 *   de siempre para los tests que cargan este módulo aislado. El daemon queda genérico:
 *   a qué portal sondear lo decide el adaptador de sitio. Ver ADR-0008.
 * CHANGELOG v1.0.2:
 * - [OBS] Log en cada transición de estado de conexión (edge-triggered, bajo ruido)
 *   para depurar caídas/recuperaciones tanto en el popup como en el SW.
 * CHANGELOG v1.0.1:
 * - [FIX] _chequearServidor pasa un timeout (2500ms < INTERVALO_SONDEO_MS) a
 *   BunClient.obtenerRutaServidor. Antes, con el server colgado (no apagado
 *   limpio), el chequeo sin timeout congelaba verificarAhora() y el estado
 *   quedaba pegado en "conectado". Ver core/backend/bunClient.ts v1.1.0.
 * ==========================================================================
 * Fuente ÚNICA de verdad del estado de conexión de la extensión. Modelo push,
 * no pull: un solo subproceso (poller) mantiene una variable de estado siempre
 * fresca; el resto del código sólo la LEE (Conexion.get()) o se SUSCRIBE a sus
 * cambios (Conexion.suscribir(cb)). Nadie más dispara chequeos de conexión.
 *
 * Dos conexiones independientes se rastrean por separado:
 *   - servidor: el backend Bun local (http://localhost:3001) — vía /api/health.
 *   - internet: salida al portal — navigator.onLine (señal push del browser vía
 *     eventos online/offline) confirmada con un HEAD real (navigator.onLine da
 *     falsos positivos en LAN sin salida a internet).
 *
 * Manifest V3 no tiene un proceso eterno: este daemon corre mientras su contexto
 * (popup o service worker) está vivo. El estado se espeja en el ámbito de sesión del
 * puerto y cada contexto escucha sus cambios, así popup y SW convergen en un único
 * valor y, al despertar, arrancan desde el último estado conocido.
 *
 * CAPA 1: NO NOMBRA NI A `chrome.*` NI A NINGÚN PORTAL
 * ----------------------------------------------------
 * El storage entra por `PuertoAlmacenamiento` y la URL de sondeo por parámetro. Si alguna
 * vez hace falta otro dato del sitio acá, va por el mismo camino (`opciones`, desde la
 * composición) — no volviendo a leer el global `SitioActivo`, que es Capa 2.
 */
import type { PuertoAlmacenamiento, CambiosStorage, AmbitoStorage } from "../puertos/almacenamiento";
import BunClient from "../backend/bunClient";

export interface EstadoConexion {
  servidor: boolean;
  internet: boolean;
  listo: boolean;
}

export interface SnapshotConexion extends EstadoConexion {
  completa: boolean;
  /** Prioridad: el servidor caído gana sobre internet (ver `get()`). */
  tipoFalla: "servidor" | "internet" | null;
}

/** Lo espejado en el ámbito de sesión, para que popup y SW converjan. */
interface EstadoEspejado {
  servidor: boolean;
  internet: boolean;
  ts: number;
}

export const CLAVE_STORAGE = "estadoConexion";
export const INTERVALO_SONDEO_MS = 3000;
export const TIMEOUT_HEAD_MS = 4000;
/** < INTERVALO_SONDEO_MS para que cada sondeo cierre antes del siguiente. */
const TIMEOUT_SERVIDOR_MS = 2500;

export interface OpcionesConexion {
  /**
   * A qué origen se le manda el HEAD para confirmar que hay salida a internet. Es
   * deliberadamente el **portal objetivo** y no un host genérico: lo que importa no es
   * tener red sino poder llegar al sitio. El valor lo declara el adaptador de sitio
   * (`PuertoSitio.urlSondeoInternet`, Capa 2) y lo inyecta la composición.
   *
   * [MULTIPORTAL C] Puede ser una **función**, y ahí está lo importante: con N portales
   * "hay internet" pasa a ser "llego a *cuál*". La sonda sigue siendo UNA sola —no hay estado
   * de conexión por portal, eso sería un rediseño del daemon— pero apunta al portal que
   * corresponde en cada momento: el del ítem que se está bajando en el service worker, el de
   * la pestaña activa en el popup. Ver `docs/multisitio-diseno.md` §4.
   */
  urlSondeoInternet: string | (() => string | Promise<string>);
}

export function crearConexion(
  almacenamiento: PuertoAlmacenamiento,
  { urlSondeoInternet }: OpcionesConexion
) {
  // Estado interno (la "variable global" siempre fresca). `listo` es false hasta
  // el primer sondeo, para que los consumidores no traten "desconocido" como offline.
  let estado: EstadoConexion = { servidor: false, internet: false, listo: false };
  const subs = new Set<(s: SnapshotConexion) => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let oyentesRed: { objetivo: EventTarget; alCambiar: () => void } | null = null;
  let desengancharStorage: (() => void) | null = null;

  const daemon = {
    CLAVE_STORAGE,
    INTERVALO_SONDEO_MS,
    TIMEOUT_HEAD_MS,

    // Se expone (y no sólo como variable de la clausura) porque los tests y el diagnóstico la
    // leen. Con un valor fijo devuelve ese valor; con una función, la resuelve al momento del
    // sondeo — que es lo que hace que la sonda siga al portal (ver `OpcionesConexion`).
    async resolverUrlSondeo(): Promise<string> {
      return typeof urlSondeoInternet === "function"
        ? await urlSondeoInternet()
        : urlSondeoInternet;
    },

    /**
     * Reemplaza el origen de la sonda. Lo usa el popup para apuntarla al portal de la pestaña
     * activa, que la composición no puede saber: la resuelve `popup.js` al escanear.
     */
    fijarSondeo(nuevo: string | (() => string | Promise<string>)): void {
      urlSondeoInternet = nuevo;
    },

    // -------- Lectura pura (sin I/O) --------
    get(): SnapshotConexion {
      const { servidor, internet, listo } = estado;
      return {
        servidor,
        internet,
        listo,
        completa: servidor && internet,
        // Prioridad: el servidor caído bloquea toda descarga (los fragmentos se
        // vuelcan al Bun), así que gana sobre internet cuando ambos están mal.
        tipoFalla: !servidor ? "servidor" : !internet ? "internet" : null,
      };
    },
    hayServidor(): boolean {
      return estado.servidor;
    },
    hayInternet(): boolean {
      return estado.internet;
    },
    hayConexionCompleta(): boolean {
      return estado.servidor && estado.internet;
    },

    // -------- Suscripción (push / "websocket") --------
    suscribir(cb: (s: SnapshotConexion) => void): () => void {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    _notificar(): void {
      const snap = daemon.get();
      subs.forEach((cb) => {
        try {
          cb(snap);
        } catch (e) {
          console.warn("[Conexion] Error en suscriptor:", e);
        }
      });
    },

    // -------- Primitivos de chequeo (los ÚNICOS del proyecto) --------
    async _chequearServidor(): Promise<boolean> {
      try {
        return !!(await BunClient.obtenerRutaServidor({ timeoutMs: TIMEOUT_SERVIDOR_MS }));
      } catch {
        return false;
      }
    },
    async _chequearInternet(): Promise<boolean> {
      // El browser ya sabe que no hay red: cortamos sin pegarle a la red.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), daemon.TIMEOUT_HEAD_MS);
      try {
        await fetch(await daemon.resolverUrlSondeo(), {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return true;
      } catch {
        clearTimeout(timeoutId);
        return false;
      }
    },

    // -------- Ciclo de verificación (el "latido" del subproceso) --------
    async verificarAhora(): Promise<SnapshotConexion> {
      const [servidor, internet] = await Promise.all([
        daemon._chequearServidor(),
        daemon._chequearInternet(),
      ]);
      daemon._aplicar({ servidor, internet, listo: true }, true);
      return daemon.get();
    },

    // Aplica un estado nuevo; sólo notifica/espeja si algo cambió (edge-triggered).
    _aplicar(nuevo: Partial<EstadoConexion>, espejar: boolean): void {
      const cambio =
        nuevo.servidor !== estado.servidor ||
        nuevo.internet !== estado.internet ||
        nuevo.listo !== estado.listo;
      estado = { ...estado, ...nuevo };
      if (cambio) {
        console.log(
          `🔌 [Conexion] estado → servidor=${estado.servidor} internet=${estado.internet} (espejar=${!!espejar})`
        );
        daemon._notificar();
        if (espejar) daemon._escribirEnStorage();
      }
    },

    // -------- Espejado cross-contexto (popup <-> SW) --------
    _escribirEnStorage(): void {
      const espejo: EstadoEspejado = {
        servidor: estado.servidor,
        internet: estado.internet,
        ts: Date.now(),
      };
      // Fire-and-forget: el adaptador ya degrada a no-op si no hay storage en este contexto.
      void almacenamiento.guardarSesion({ [CLAVE_STORAGE]: espejo }).catch((e: unknown) => {
        console.warn("[Conexion] No se pudo espejar el estado:", e);
      });
    },
    _escucharStorage(): void {
      if (desengancharStorage) return;
      desengancharStorage = almacenamiento.onCambio((cambios: CambiosStorage, ambito: AmbitoStorage) => {
        if (ambito !== "session") return;
        const c = cambios[CLAVE_STORAGE];
        const nuevo = c?.newValue as EstadoEspejado | undefined;
        if (!nuevo) return;
        // Aplicar SIN re-espejar para no generar un loop de escrituras entre contextos.
        daemon._aplicar({ servidor: nuevo.servidor, internet: nuevo.internet, listo: true }, false);
      });
    },

    // Reacción instantánea a los eventos push del browser (sin esperar al poller).
    _engancharEventosDeRed(): void {
      if (oyentesRed) return;
      const alCambiar = () => {
        void daemon.verificarAhora();
      };
      const objetivo: EventTarget | null =
        typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : null;
      if (!objetivo || !objetivo.addEventListener) return;
      objetivo.addEventListener("online", alCambiar);
      objetivo.addEventListener("offline", alCambiar);
      oyentesRed = { objetivo, alCambiar };
    },

    // -------- Arranque / parada del subproceso --------
    // Para el popup: poller con setInterval. Para el SW, ver verificarAhora() desde
    // el handler de chrome.alarms (setInterval no sobrevive la suspensión del SW).
    iniciar({ intervaloMs = INTERVALO_SONDEO_MS }: { intervaloMs?: number } = {}): void {
      daemon._escucharStorage();
      daemon._engancharEventosDeRed();
      void daemon.verificarAhora();
      if (!timer) {
        timer = setInterval(() => void daemon.verificarAhora(), intervaloMs);
      }
    },
    detener(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      if (oyentesRed) {
        const { objetivo, alCambiar } = oyentesRed;
        objetivo.removeEventListener("online", alCambiar);
        objetivo.removeEventListener("offline", alCambiar);
        oyentesRed = null;
      }
      if (desengancharStorage) {
        desengancharStorage();
        desengancharStorage = null;
      }
    },

    /** Sólo para tests: sembrar el estado sin pasar por los primitivos de chequeo. */
    _sembrarEstado(nuevo: EstadoConexion): void {
      estado = { ...nuevo };
    },
    /** Sólo para tests/diagnóstico: ¿hay poller activo? */
    get _tieneTimer(): boolean {
      return timer !== null;
    },
  };

  return daemon;
}

export type Conexion = ReturnType<typeof crearConexion>;
