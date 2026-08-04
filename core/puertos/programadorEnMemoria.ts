/**
 * ADAPTADOR EN MEMORIA DEL PUERTO DE PROGRAMACIÓN (V1.0.0)
 * ==========================================================================
 * Hermano de `AlmacenamientoEnMemoria` y `MensajeriaEnMemoria`. No usa relojes de verdad:
 * los disparos los provoca el test llamando a `dispararAhora(nombre)`. Es a propósito —
 * un test que espera 12 segundos reales no es un test, y uno con timers falsos termina
 * verificando el reloj de Vitest en vez de la lógica de auto-sanación.
 *
 * Lo que sí modela con fidelidad es lo que el puerto promete:
 *   - **Idempotencia por nombre**: reprogramar el mismo nombre reemplaza, no acumula.
 *   - **Cancelar lo desprograma**: `dispararAhora` sobre algo cancelado no notifica a nadie,
 *     que es la diferencia entre "la alarma sigue viva" y "quedó un oyente colgado".
 */
import type { OpcionesProgramacion, PuertoProgramador } from "./programador";

export class ProgramadorEnMemoria implements PuertoProgramador {
  private programadas = new Map<string, OpcionesProgramacion>();
  private oyentes = new Set<(nombre: string) => void>();

  programar(nombre: string, opciones: OpcionesProgramacion): void {
    this.programadas.set(nombre, opciones);
  }

  cancelar(nombre: string): void {
    this.programadas.delete(nombre);
  }

  onDisparo(cb: (nombre: string) => void): () => void {
    this.oyentes.add(cb);
    return () => this.oyentes.delete(cb);
  }

  // -------- Ayudas de test --------

  /** ¿Está programada? */
  estaProgramada(nombre: string): boolean {
    return this.programadas.has(nombre);
  }

  /** Qué período se pidió (para afirmar sobre él sin espiar un mock). */
  periodoDe(nombre: string): number | undefined {
    return this.programadas.get(nombre)?.periodoMin;
  }

  /** Nombres programados, en orden de alta. */
  nombresProgramados(): string[] {
    return [...this.programadas.keys()];
  }

  /**
   * Simula que sonó la alarma. Devuelve `false` si no estaba programada — así un test que
   * cree estar ejercitando un disparo real se entera de que no lo estaba.
   */
  dispararAhora(nombre: string): boolean {
    if (!this.programadas.has(nombre)) return false;
    this.oyentes.forEach((cb) => cb(nombre));
    return true;
  }

  /**
   * Igual que `dispararAhora`, pero **espera** a que terminen los oyentes asíncronos.
   *
   * Existe porque los handlers reales son `async` (el del auto-heal consulta storage y el
   * daemon antes de decidir) y el puerto, como `chrome.alarms`, ignora lo que devuelvan. Sin
   * esto, un test tendría que dormir un rato arbitrario y esperar que alcance: flakiness
   * disfrazada de test. Acá se aprovecha que el doble sí puede juntar las promesas.
   */
  async dispararYEsperar(nombre: string): Promise<boolean> {
    if (!this.programadas.has(nombre)) return false;
    await Promise.all([...this.oyentes].map((cb) => cb(nombre) as unknown));
    return true;
  }
}
