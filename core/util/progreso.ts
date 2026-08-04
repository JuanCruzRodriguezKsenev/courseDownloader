/**
 * MÉTRICAS DE PROGRESO Y TELEMETRÍA (V1.0.0)
 * ==========================================================================
 * Capa 1. Salieron de `shared/utils.js` en la Fase 6a, sin cambios de lógica.
 *
 * Todo devuelve **strings ya formateados**, no números: son valores para pintar en la UI, y
 * el redondeo vive acá para que el SW y el popup no puedan mostrar cifras distintas del mismo
 * dato. La única entrada no obvia es `tiempoInicio`, que es un sello de `performance.now()`.
 */

export interface Telemetria {
  bytesTexto: string;
  velocidadTexto: string;
  fragmentosTexto: string;
}

export interface MetricasProgreso {
  porcentaje: number;
  telemetry: Telemetria;
}

const BYTES_POR_MB = 1024 * 1024;

/** Progreso + telemetría de una ráfaga en curso. `tiempoInicio` es un `performance.now()`. */
export function calcularMétricasProgreso(
  bytesAcumulados: number,
  fragmentosTerminados: number,
  totalFragmentos: number,
  tiempoInicio: number
): MetricasProgreso {
  const tiempoTranscurrido = (performance.now() - tiempoInicio) / 1000;
  const velocidadBytesPorSeg = tiempoTranscurrido > 0 ? bytesAcumulados / tiempoTranscurrido : 0;

  const velocidadMegas = (velocidadBytesPorSeg / BYTES_POR_MB).toFixed(2);
  const megasDescargados = (bytesAcumulados / BYTES_POR_MB).toFixed(2);
  const porcentajeCalculado = Math.floor((fragmentosTerminados / totalFragmentos) * 100);

  return {
    // Se recorta a 100 porque el último fragmento puede pesar más que el promedio y el
    // cálculo por fragmentos terminados llega a pasarse.
    porcentaje: Math.min(porcentajeCalculado, 100),
    telemetry: {
      bytesTexto: `${megasDescargados} MB`,
      velocidadTexto: `${velocidadMegas} MB/s`,
      fragmentosTexto: `${fragmentosTerminados} / ${totalFragmentos}`,
    },
  };
}

/** Bytes crudos → MB legibles. */
export function formatearMB(bytes?: number | null): string {
  if (!bytes || isNaN(bytes)) return "0.0";
  return (bytes / BYTES_POR_MB).toFixed(1);
}

/**
 * Proyecta el tamaño final a partir del peso promedio de los fragmentos ya bajados. Es una
 * estimación y se muestra como tal: los fragmentos de un HLS no pesan todos igual.
 */
export function calcularProyeccionMB(
  bytesAcumulados?: number | null,
  fragsTerminados?: number | null,
  totalFrags?: number | null
): string {
  if (!bytesAcumulados || !fragsTerminados || totalFrags === 0) return "0.0";
  const pesoPromedioChunk = bytesAcumulados / fragsTerminados;
  const tamañoProyectadoBytes = pesoPromedioChunk * (totalFrags || 0);
  return (tamañoProyectadoBytes / BYTES_POR_MB).toFixed(1);
}
