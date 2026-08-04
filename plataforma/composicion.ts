/**
 * COMPOSICIÓN (RAÍZ DE INYECCIÓN)
 * ==========================================================================
 * Único lugar donde se eligen los adaptadores concretos y se los enchufa al núcleo.
 * Es lo que hace que `core/` pueda no saber que existe `chrome.*`: los módulos del
 * núcleo reciben sus puertos acá, y no los importan ellos mismos.
 *
 * Lo importan los dos entrypoints (popup y service worker), así que corre una vez por
 * contexto. Vive acá y no en `entrypoints/` porque WXT trata como entrypoint a todo
 * archivo suelto de esa carpeta. Publica las instancias como globals porque los consumidores actuales las
 * leen así (`HistorialFallos.registrar(...)` en background.js, `window.HistorialFallos`
 * en la isla campanita) — ver docs/coding-standards.md §Módulos ES + global.
 *
 * A medida que avance la Fase 5 este archivo va a crecer: cada módulo que se desacople
 * de `chrome.*` se instancia acá con su adaptador.
 */
import AlmacenamientoChrome from "./chrome/almacenamiento";
import MensajeriaChrome from "./chrome/mensajeria";
import ProgramadorChrome from "./chrome/programador";
import * as texto from "../core/util/texto";
import * as media from "../core/util/media";
import * as progreso from "../core/util/progreso";
import * as descargas from "./chrome/descargas";
import { crearFetchConReintentos } from "../core/util/reintentos";
import { crearHlsEngine } from "../core/hls/hlsEngine";
import { crearEstadoSesion } from "../core/cola/estadoSesion";
import { crearEstadosProgreso } from "../core/cola/estadosProgreso";
import { crearProcesadorCola } from "../core/cola/procesadorCola";
import { notificarFallo } from "./chrome/notificaciones";
import { crearVolcadoLegacy } from "./chrome/volcadoLegacy";
import BunClient from "../core/backend/bunClient";
import { crearHistorialFallos } from "../core/historial/historialFallos";
import { crearAppState } from "../core/estado/appState";
import { crearConexion } from "../core/conexion/conexion";
// Capa 2. Es el primer import del adaptador de sitio desde acá, y lo habilitó el corte
// `config.js` → `config.ts` (Fase 5c): con `allowJs: false`, un `.ts` no puede importar un
// `.js`. Los entrypoints ya lo importaban primero, así que no cambia el orden de evaluación.
import { SitioActivo } from "../sitio/ramonnet/config";

/** Adaptadores de plataforma activos en esta build. */
export const almacenamiento = AlmacenamientoChrome;
// Publicado como global porque `background.js` (todavía vanilla) lo consume así: el SW no lo
// importa desde acá, lo recibe. Cuando el SW sea composición (Fase 7), esto se va.
(globalThis as Record<string, unknown>).Almacenamiento = almacenamiento;

export const mensajeria = MensajeriaChrome;
// Publicado como global porque `popup.js` (todavía vanilla) se lo pasa por `ctx` a las
// features que lo necesitan. Cuando popup.js sea composición (Fase 7), esto se va.
(globalThis as Record<string, unknown>).Mensajeria = mensajeria;

export const programador = ProgramadorChrome;
// Sólo lo consume el service worker (la alarma de auto-sanación), pero se publica desde acá
// como los demás: el popup construye una instancia inerte, que degrada a no-op porque no
// tiene `chrome.alarms` en su contexto.
(globalThis as Record<string, unknown>).Programador = programador;

export const HistorialFallos = crearHistorialFallos(almacenamiento);
(globalThis as Record<string, unknown>).HistorialFallos = HistorialFallos;

/**
 * OJO: `AppState` es estado del POPUP. Este archivo lo importan los dos entrypoints, así que el
 * service worker también construye una instancia — inerte: el constructor no hace I/O y el SW
 * nunca la lee (su estado es `SessionState`, en `storage.session`). Se acepta esa instancia de
 * más para no partir la raíz de composición en dos por un solo módulo. Si aparece un segundo
 * módulo popup-only, ahí sí conviene una raíz por contexto.
 */
export const AppState = crearAppState(almacenamiento, mensajeria);
(globalThis as Record<string, unknown>).AppState = AppState;

/**
 * El daemon de conexión SÍ corre en los dos contextos, y a propósito: popup y SW mantienen
 * cada uno su instancia y convergen espejando por el ámbito de sesión del puerto. Quién
 * llama a `iniciar()` no se decide acá — el popup arranca su poller y el SW verifica desde
 * `chrome.alarms` (setInterval no sobrevive la suspensión del service worker).
 *
 * La URL de sondeo entra por acá y no la lee el daemon: es el único dato de sitio que
 * necesita, y es lo que le permitió mudarse a `core/` (Capa 1 no nombra portales).
 */
export const Conexion = crearConexion(almacenamiento, {
  urlSondeoInternet: SitioActivo.urlSondeoInternet,
});
(globalThis as Record<string, unknown>).Conexion = Conexion;

/**
 * `Utils` dejó de ser un archivo y pasó a ser **un ensamblado** (Fase 6a): sus funciones se
 * repartieron entre `core/util/` (genéricas) y `plataforma/chrome/descargas.ts` (que usaba
 * `chrome.downloads`, o sea Capa 3). Acá se vuelven a juntar bajo el mismo nombre porque
 * ~200 call-sites del código vanilla lo consumen como `Utils.loQueSea(...)`; reescribirlos
 * era un corte aparte, y mucho más grande que el que resolvía el problema de capas.
 *
 * El que cambió de forma es `fetchConReintentos`: ahora se **construye** con el daemon en vez
 * de sniffearlo del global. Ése era el acoplamiento que impedía que el motor HLS —su mayor
 * consumidor— pudiera vivir en `core/`.
 *
 * **Ojo con el orden de carga**: este global lo publicaba `shared/utils.js` al evaluarse, y
 * ahora aparece más tarde en la cadena (acá). Es seguro porque ningún consumidor llama a
 * `Utils.*` en tiempo de evaluación, sólo dentro de funciones — se verificó archivo por
 * archivo antes de mover la publicación. Si algún día alguien lo llama en el top-level de un
 * módulo que carga antes que la composición, va a explotar sin que el bundler avise.
 */
/**
 * Estado de la ráfaga activa (ámbito de sesión). Sólo lo usa el service worker; el popup
 * construye una instancia inerte —el constructor no hace I/O— por la misma razón que con
 * `AppState`: no partir la raíz de composición en dos por un módulo.
 */
export const SessionState = crearEstadoSesion(almacenamiento);
(globalThis as Record<string, unknown>).SessionState = SessionState;

export const HlsEngine = crearHlsEngine({
  fetchConReintentos: crearFetchConReintentos(Conexion),
  descifrarFragmento: media.descifrarFragmento,
  generarVideoFinalBlob: media.generarVideoFinalBlob,
  backend: BunClient,
});
// Sólo lo usa el service worker; se publica como global porque `background.js` sigue siendo
// vanilla y lo consume así. Cuando el SW sea composición (Fase 7), esto se va.
(globalThis as Record<string, unknown>).HlsEngine = HlsEngine;

export const Utils = {
  ...texto,
  ...media,
  ...progreso,
  ...descargas,
  fetchConReintentos: crearFetchConReintentos(Conexion),
};
(globalThis as Record<string, unknown>).Utils = Utils;

export const EstadosProgreso = crearEstadosProgreso(almacenamiento);
(globalThis as Record<string, unknown>).EstadosProgreso = EstadosProgreso;

/**
 * El procesador de la cola: el bucle FIFO + la clasificación de fallos, que fue el bloque más
 * grande de `background.js` hasta la Fase 6b.
 *
 * Acá se ve para qué sirvió todo lo anterior: recibe **once colaboradores** y ninguno es
 * `chrome.*`. Los tres que sí tocan el navegador —la notificación nativa, el volcado legacy a
 * disco y el adaptador de sitio— entran ya envueltos desde Capa 3 o Capa 2, así que el bucle
 * se puede correr entero en un test sin navegador.
 */
export const Cola = crearProcesadorCola({
  almacenamiento,
  sesion: SessionState,
  mensajeria,
  programador,
  conexion: Conexion,
  motor: HlsEngine,
  sitio: { resolverManifiesto: (url, signal) => SitioActivo.resolverManifiesto(url, signal) },
  historial: HistorialFallos,
  notificarFallo,
  calcularMetricas: progreso.calcularMétricasProgreso,
  guardarBlobLegacy: crearVolcadoLegacy(mensajeria),
  persistirEstados: (estados) => EstadosProgreso.persistir(estados),
  recuperarEstados: () => EstadosProgreso.recuperar(),
});
(globalThis as Record<string, unknown>).Cola = Cola;
