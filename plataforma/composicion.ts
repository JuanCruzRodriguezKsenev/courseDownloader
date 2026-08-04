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
export const Utils = {
  ...texto,
  ...media,
  ...progreso,
  ...descargas,
  fetchConReintentos: crearFetchConReintentos(Conexion),
};
(globalThis as Record<string, unknown>).Utils = Utils;
