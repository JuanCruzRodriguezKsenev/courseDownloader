/**
 * ESPEJO DE PROGRESO POR CLASE (V1.0.0)
 * ==========================================================================
 * Capa 1. Salió de `background.js` en la Fase 6b.
 *
 * Mapa `<sitioId>|<titulo> → estado` bajo la clave local `SW_ESTADOS_PROGRESO`. Es un **espejo
 * liviano** del progreso que escribe el service worker para que el popup pueda reconciliar su
 * lista sin pedirle el detalle completo por IPC en cada render.
 *
 * [MULTIPORTAL D] La clave era el título solo. Con dos portales eso colisiona: el avance de una
 * clase se mostraría en la fila de su homónima del otro portal. Al leer se **migran una vez**
 * las claves sin `|`, que son las de antes de este corte, prefijándolas con el portal legado —
 * correcto por construcción, no había otro portal. Ver `core/cola/identidadClase.ts`.
 *
 * Vive en el ámbito **local** y no en el de sesión —a diferencia del resto del estado de la
 * ráfaga— a propósito: tiene que sobrevivir a que el SW se suspenda, porque es lo que el popup
 * lee al abrirse para saber qué clase quedó en curso. Su schema está en `docs/data-model.md`.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

const CLAVE = "SW_ESTADOS_PROGRESO";

export type EstadosProgreso = Record<string, string>;

/**
 * Portal al que migran las claves viejas. Es el mismo criterio (y el mismo valor) que
 * `SITIO_LEGADO` en `core/estado/appState.ts`: describe el pasado, no un default de negocio.
 * Entra por parámetro para que este módulo no importe estado que no le corresponde.
 */
const SITIO_LEGADO_POR_DEFECTO = "ramonnet";

export function crearEstadosProgreso(
  almacenamiento: PuertoAlmacenamiento,
  sitioLegado: string = SITIO_LEGADO_POR_DEFECTO
) {
  return {
    async recuperar(): Promise<EstadosProgreso> {
      const data = await almacenamiento.obtenerLocal<{ [CLAVE]: EstadosProgreso }>([CLAVE]);
      const crudos = data[CLAVE] || {};

      // Migración de lectura: una clave sin `|` es de antes del multiportal D. No se reescribe
      // storage acá —este espejo se regenera solo en cada ráfaga— así que migrar al leer
      // alcanza y evita una escritura extra en el camino caliente del bucle.
      const migrados: EstadosProgreso = {};
      for (const [clave, estado] of Object.entries(crudos)) {
        migrados[clave.includes("|") ? clave : `${sitioLegado}|${clave}`] = estado;
      }
      return migrados;
    },

    async persistir(estados: EstadosProgreso): Promise<void> {
      await almacenamiento.guardarLocal({ [CLAVE]: estados });
    },
  };
}

export type EstadosProgresoAPI = ReturnType<typeof crearEstadosProgreso>;
