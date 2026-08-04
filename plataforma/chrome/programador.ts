/**
 * ADAPTADOR CHROME — PROGRAMACIÓN DE TAREAS DIFERIDAS (V1.0.0)
 * ==========================================================================
 * Implementa `PuertoProgramador` sobre `chrome.alarms`. Capa 3 de ADR-0008.
 *
 * Es un adaptador fino: `chrome.alarms` ya es idempotente por nombre y ya sobrevive a la
 * suspensión del service worker, que son las dos propiedades que el puerto promete. Lo único
 * que agrega es la traducción de nombres (`periodoMin` → `periodInMinutes`) y las guardas de
 * disponibilidad, con el mismo criterio que los otros adaptadores: en un contexto sin la API
 * —el popup, que no declara `alarms` en su superficie— degradar a no-op en vez de romper.
 *
 * `onDisparo` filtra por nada: entrega el nombre y deja que el cliente decida. Es a propósito;
 * el SW tiene una sola alarma hoy, pero el puerto no tiene por qué asumirlo.
 */
import type { OpcionesProgramacion, PuertoProgramador } from "../../core/puertos/programador";

function hayAlarms(): boolean {
  return typeof chrome !== "undefined" && !!chrome.alarms;
}

export const ProgramadorChrome: PuertoProgramador = {
  programar(nombre: string, { periodoMin }: OpcionesProgramacion): void {
    if (!hayAlarms()) {
      console.warn("[Programador] chrome.alarms no disponible: no se programó", nombre);
      return;
    }
    // `create` con un nombre ya existente REEMPLAZA la alarma anterior — de eso depende la
    // idempotencia que promete el puerto, así que no hace falta cancelar antes.
    chrome.alarms.create(nombre, { periodInMinutes: periodoMin });
  },

  cancelar(nombre: string): void {
    if (!hayAlarms()) return;
    // La forma con callback devuelve un booleano de "había algo que limpiar" que a nadie le
    // importa acá; se ignora a propósito para que cancelar sea siempre seguro.
    chrome.alarms.clear(nombre);
  },

  onDisparo(cb: (nombre: string) => void): () => void {
    if (!hayAlarms() || !chrome.alarms.onAlarm) return () => {};
    const oyente = (alarma: chrome.alarms.Alarm) => cb(alarma.name);
    chrome.alarms.onAlarm.addListener(oyente);
    return () => chrome.alarms.onAlarm.removeListener(oyente);
  },
};

export default ProgramadorChrome;
