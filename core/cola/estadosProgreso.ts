/**
 * ESPEJO DE PROGRESO POR CLASE (V1.0.0)
 * ==========================================================================
 * Capa 1. Salió de `background.js` en la Fase 6b.
 *
 * Mapa `titulo → estado` bajo la clave local `SW_ESTADOS_PROGRESO`. Es un **espejo liviano**
 * del progreso que escribe el service worker para que el popup pueda reconciliar su lista sin
 * pedirle el detalle completo por IPC en cada render.
 *
 * Vive en el ámbito **local** y no en el de sesión —a diferencia del resto del estado de la
 * ráfaga— a propósito: tiene que sobrevivir a que el SW se suspenda, porque es lo que el popup
 * lee al abrirse para saber qué clase quedó en curso. Su schema está en `docs/data-model.md`.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

const CLAVE = "SW_ESTADOS_PROGRESO";

export type EstadosProgreso = Record<string, string>;

export function crearEstadosProgreso(almacenamiento: PuertoAlmacenamiento) {
  return {
    async recuperar(): Promise<EstadosProgreso> {
      const data = await almacenamiento.obtenerLocal<{ [CLAVE]: EstadosProgreso }>([CLAVE]);
      return data[CLAVE] || {};
    },

    async persistir(estados: EstadosProgreso): Promise<void> {
      await almacenamiento.guardarLocal({ [CLAVE]: estados });
    },
  };
}

export type EstadosProgresoAPI = ReturnType<typeof crearEstadosProgreso>;
