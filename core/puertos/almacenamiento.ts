/**
 * PUERTO — ALMACENAMIENTO PERSISTENTE (V1.0.0)
 * ==========================================================================
 * Contrato de persistencia del núcleo (Capa 1 de ADR-0008). El núcleo NO conoce
 * `chrome.storage`: depende de esta interfaz, y quien la implementa es un adaptador
 * de plataforma (`plataforma/chrome/almacenamiento.ts`) o, en los tests, uno en
 * memoria (`almacenamientoEnMemoria.ts`).
 *
 * POR QUÉ local Y sesión SEPARADOS
 * --------------------------------
 * No son dos backends intercambiables: son los dos lados del split de ownership del
 * proyecto. `local` es lo que sobrevive al reinicio del navegador y lo dueño el popup
 * (`AppState`); `session` es el estado volátil de la descarga en curso y lo dueño el
 * service worker (`SessionState`). Ver docs/data-model.md.
 *
 * Un único `obtener(claves, ambito)` con un flag invitaría a leer el ámbito
 * equivocado en un call-site distraído; separarlos lo hace explícito y deja que el
 * compilador distinga los tipos de cada store.
 */

/** Forma de `chrome.storage.onChanged`: clave → valores viejo/nuevo. */
export type CambiosStorage = Record<string, { oldValue?: unknown; newValue?: unknown }>;

/** Ámbito donde ocurrió un cambio. */
export type AmbitoStorage = "local" | "session";

export interface PuertoAlmacenamiento {
  obtenerLocal<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>>;
  /**
   * Guarda una o varias claves. **Multi-clave = atómico**: cuando un cambio lógico
   * toca varias claves relacionadas (ej. mover un ítem de la lista a la cola), tienen
   * que ir en UNA sola llamada. Si el service worker se suspende entre dos llamadas
   * separadas, el estado queda inconsistente. Este invariante era una convención
   * escrita en comentarios; acá es parte de la firma.
   */
  guardarLocal(valores: Record<string, unknown>): Promise<void>;
  borrarLocal(claves: string[]): Promise<void>;

  obtenerSesion<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>>;
  guardarSesion(valores: Record<string, unknown>): Promise<void>;
  borrarSesion(claves: string[]): Promise<void>;

  /**
   * Se suscribe a los cambios de storage (los propios y los de OTRO contexto: es el
   * canal por el que popup y SW convergen). Devuelve la función para desuscribirse.
   */
  onCambio(cb: (cambios: CambiosStorage, ambito: AmbitoStorage) => void): () => void;
}
