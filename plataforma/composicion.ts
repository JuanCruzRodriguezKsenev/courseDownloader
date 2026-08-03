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
import { crearHistorialFallos } from "../core/historial/historialFallos";
import { crearAppState } from "../shared/state";
import { crearConexion } from "../shared/conexion";

/** Adaptadores de plataforma activos en esta build. */
export const almacenamiento = AlmacenamientoChrome;
export const mensajeria = MensajeriaChrome;
// Publicado como global porque `popup.js` (todavía vanilla) se lo pasa por `ctx` a las
// features que lo necesitan. Cuando popup.js sea composición (Fase 7), esto se va.
(globalThis as Record<string, unknown>).Mensajeria = mensajeria;

export const HistorialFallos = crearHistorialFallos(almacenamiento);
(globalThis as Record<string, unknown>).HistorialFallos = HistorialFallos;

/**
 * OJO: `AppState` es estado del POPUP. Este archivo lo importan los dos entrypoints, así que el
 * service worker también construye una instancia — inerte: el constructor no hace I/O y el SW
 * nunca la lee (su estado es `SessionState`, en `storage.session`). Se acepta esa instancia de
 * más para no partir la raíz de composición en dos por un solo módulo. Si aparece un segundo
 * módulo popup-only, ahí sí conviene una raíz por contexto.
 */
export const AppState = crearAppState(almacenamiento);
(globalThis as Record<string, unknown>).AppState = AppState;

/**
 * El daemon de conexión SÍ corre en los dos contextos, y a propósito: popup y SW mantienen
 * cada uno su instancia y convergen espejando por el ámbito de sesión del puerto. Quién
 * llama a `iniciar()` no se decide acá — el popup arranca su poller y el SW verifica desde
 * `chrome.alarms` (setInterval no sobrevive la suspensión del service worker).
 */
export const Conexion = crearConexion(almacenamiento);
(globalThis as Record<string, unknown>).Conexion = Conexion;
