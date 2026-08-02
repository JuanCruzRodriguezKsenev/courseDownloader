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
import { crearHistorialFallos } from "../core/historial/historialFallos";

/** Adaptador de plataforma activo en esta build. */
export const almacenamiento = AlmacenamientoChrome;

export const HistorialFallos = crearHistorialFallos(almacenamiento);
(globalThis as Record<string, unknown>).HistorialFallos = HistorialFallos;
