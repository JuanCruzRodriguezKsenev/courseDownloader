/**
 * NÚCLEO — HISTORIAL DE FALLOS DE COLA (V2.0.0)
 * ==========================================================================
 * CHANGELOG v2.0.0:
 * - [CAPA 1 + TS] Movido desde `shared/historialFallos.js` y desacoplado de `chrome.*`:
 *   ahora recibe un `PuertoAlmacenamiento` por inyección y se instancia en los
 *   entrypoints (composición). Pasa de objeto singleton a factory `crearHistorialFallos`.
 *   Sin cambios de comportamiento; sus 11 tests dejaron de mockear `chrome` a mano y
 *   corren contra `AlmacenamientoEnMemoria`. Fase 5 de docs/rearquitectura-diseno.md.
 * CHANGELOG v1.0.0:
 * - [NUEVO] Fuente de verdad del historial de fallos terminales de la cola.
 * ==========================================================================
 * Historial acotado (últimos 50, más-reciente-primero) de fallos terminales de la cola
 * (rechazo 4xx / sesión / servidor / internet). Lo escribe el service worker; lo lee y
 * lo muta el popup (campanita). Schema en docs/data-model.md; diseño completo en
 * docs/notificaciones-fallos-diseno.md.
 *
 * A diferencia del daemon de conexión, NO mantiene espejo en memoria: el storage es la
 * única fuente. `suscribir(cb)` sólo avisa "algo cambió" y el suscriptor vuelve a pedir
 * `obtener()`. El oyente se engancha lazy, en el primer `suscribir()`, para que el SW
 * —que sólo escribe— no registre un oyente muerto.
 *
 * Nota de concurrencia (aceptada): `registrar` (SW) y `marcarTodosLeidos`/`limpiar`
 * (popup) hacen read-modify-write sobre la misma clave desde contextos distintos; una
 * colisión exacta podría perder una escritura. Mismo trade-off que el resto del storage
 * (sin transacciones); la ventana es de ms y el dato es informativo.
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

export type TipoFallo = "rechazo" | "sesion" | "servidor" | "internet";

export interface Fallo {
  id: string;
  tipo: TipoFallo;
  titulo: string;
  motivo: string;
  ts: number;
  leido: boolean;
}

export const CLAVE_STORAGE = "historialFallos";
export const LIMITE = 50;

export function crearHistorialFallos(almacenamiento: PuertoAlmacenamiento) {
  const subs = new Set<() => void>();
  let desengancharOyente: (() => void) | null = null;

  function notificar(): void {
    subs.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.warn("[HistorialFallos] Error en suscriptor:", e);
      }
    });
  }

  function engancharOyente(): void {
    if (desengancharOyente) return;
    desengancharOyente = almacenamiento.onCambio((cambios, ambito) => {
      if (ambito !== "local") return;
      if (!cambios[CLAVE_STORAGE]) return;
      notificar();
    });
  }

  async function obtener(): Promise<Fallo[]> {
    const data = await almacenamiento.obtenerLocal<Record<string, Fallo[]>>([CLAVE_STORAGE]);
    return data[CLAVE_STORAGE] || [];
  }

  async function guardar(lista: Fallo[]): Promise<void> {
    await almacenamiento.guardarLocal({ [CLAVE_STORAGE]: lista });
  }

  return {
    CLAVE_STORAGE,
    LIMITE,

    obtener,

    async contarNoLeidos(): Promise<number> {
      return (await obtener()).filter((f) => !f.leido).length;
    },

    async registrar(tipo: TipoFallo, titulo?: string, motivo?: string): Promise<Fallo> {
      const entrada: Fallo = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tipo,
        titulo: titulo || "",
        motivo: motivo || "",
        ts: Date.now(),
        leido: false
      };
      const lista = await obtener();
      // Más reciente primero, acotado a LIMITE (los más viejos se descartan).
      await guardar([entrada, ...lista].slice(0, LIMITE));
      return entrada;
    },

    async marcarTodosLeidos(): Promise<void> {
      const lista = await obtener();
      await guardar(lista.map((f) => ({ ...f, leido: true })));
    },

    async limpiar(): Promise<void> {
      await guardar([]);
    },

    /** El suscriptor recibe una señal sin payload y vuelve a pedir `obtener()`. */
    suscribir(cb: () => void): () => void {
      engancharOyente();
      subs.add(cb);
      return () => subs.delete(cb);
    }
  };
}

export type HistorialFallos = ReturnType<typeof crearHistorialFallos>;
