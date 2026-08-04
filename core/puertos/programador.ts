/**
 * PUERTO — PROGRAMACIÓN DE TAREAS DIFERIDAS (V1.0.0)
 * ==========================================================================
 * Contrato del núcleo (Capa 1 de ADR-0008) para "volvé a llamarme cada tanto". Hoy lo
 * implementa `chrome.alarms`; el único cliente es la **auto-sanación**: cuando la cola se
 * pausa por un corte, un disparo periódico revisa si la conexión volvió.
 *
 * POR QUÉ NO ES `setInterval`
 * ---------------------------
 * En MV3 el service worker se suspende, y con él muere cualquier `setInterval`. La alarma
 * sobrevive a la suspensión y **despierta al worker** para el disparo. Esa es toda la razón
 * de existir de este puerto: no es "un timer con otra cara", es el único reloj que sigue
 * andando con el SW dormido. Un adaptador que lo implemente con `setInterval` es válido sólo
 * en contextos que no se suspenden (tests, o un popup abierto).
 *
 * FORMA
 * -----
 * `programar()` es idempotente por nombre: volver a programar el mismo nombre reemplaza lo
 * anterior en vez de acumular disparos (es lo que hace `chrome.alarms.create`, y de lo que ya
 * dependía el código de auto-heal antes de que existiera este puerto).
 *
 * El período va en **minutos** y admite decimales porque así lo expresa `chrome.alarms`
 * (`periodInMinutes: 0.2` = 12s, el valor real del auto-heal). Se conserva esa unidad a
 * propósito en vez de pasar a milisegundos: cambiarla acá obligaría a convertir en el
 * adaptador y a releer todos los call-sites para ver si alguno quedó en la unidad vieja —
 * un cambio de comportamiento silencioso disfrazado de mejora de API.
 */

export interface OpcionesProgramacion {
  /** Cada cuánto se repite el disparo, en minutos (acepta decimales: 0.2 = 12s). */
  periodoMin: number;
}

export interface PuertoProgramador {
  /** Programa (o reprograma) un disparo periódico con este nombre. */
  programar(nombre: string, opciones: OpcionesProgramacion): void;

  /** Cancela el disparo con ese nombre. No falla si no existe. */
  cancelar(nombre: string): void;

  /** Registra un oyente de disparos. Devuelve la función para desregistrarlo. */
  onDisparo(cb: (nombre: string) => void): () => void;
}
