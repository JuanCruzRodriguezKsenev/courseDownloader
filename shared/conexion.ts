/**
 * DAEMON DE ESTADO DE CONEXIÓN (V2.0.0)
 * ==========================================================================
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
 * POR QUÉ SIGUE EN `shared/` Y NO EN `core/`
 * ------------------------------------------
 * Ya no le queda nada de `chrome.*`, pero todavía lee el global `SitioActivo` para saber a
 * qué portal sondear. Inyectar esa URL desde la composición es el paso que falta, y hoy está
 * bloqueado: `sitio/ramonnet/config.js` es `.js` y `composicion.ts` no puede importarlo
 * (`allowJs: false`). Cuando ese archivo pase a TypeScript, este módulo se muda a
 * `core/conexion/` con la URL inyectada y queda como Capa 1 puro.
 */
import type { PuertoAlmacenamiento, CambiosStorage, AmbitoStorage } from "../core/puertos/almacenamiento";
import BunClient from "../core/backend/bunClient";

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
const URL_SONDEO_FALLBACK = "https://plataforma.ramonnet.com.ar";

/** El adaptador de sitio se publica como global; acá sólo se lo lee (ver nota de cabecera). */
declare const SitioActivo: { urlSondeoInternet?: string } | undefined;

export function crearConexion(almacenamiento: PuertoAlmacenamiento) {
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

    // La sonda de internet apunta al portal objetivo, no a un host genérico: lo que
    // importa no es tener red sino poder llegar AL SITIO. Por eso la URL la declara el
    // adaptador de sitio (Capa 2, ADR-0008) y no este daemon, que es genérico. El
    // fallback existe sólo para los tests, que cargan este módulo aislado.
    get URL_SONDEO_INTERNET(): string {
      return (typeof SitioActivo !== "undefined" && SitioActivo?.urlSondeoInternet) || URL_SONDEO_FALLBACK;
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
      } catch (e) {
        return false;
      }
    },
    async _chequearInternet(): Promise<boolean> {
      // El browser ya sabe que no hay red: cortamos sin pegarle a la red.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), daemon.TIMEOUT_HEAD_MS);
      try {
        await fetch(daemon.URL_SONDEO_INTERNET, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return true;
      } catch (e) {
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
