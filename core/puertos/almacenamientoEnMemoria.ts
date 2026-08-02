/**
 * ADAPTADOR EN MEMORIA DEL PUERTO DE ALMACENAMIENTO (V1.0.0)
 * ==========================================================================
 * Implementación del `PuertoAlmacenamiento` con dos objetos en memoria. **Es el punto
 * del diseño de puertos que más paga**: permite testear la lógica del núcleo —cola,
 * auto-heal, historial— sin mockear `chrome.*` a mano en cada archivo de test, que es
 * la razón por la que hoy esa lógica está sin cobertura (ver docs/testing.md).
 *
 * Emite `onCambio` en cada escritura imitando a `chrome.storage.onChanged`, incluido
 * el `oldValue`/`newValue`, así los tests pueden ejercitar el camino de sincronización
 * entre contextos.
 *
 * No es sólo para tests: cualquier entorno sin `chrome.*` (un runner headless, otro
 * navegador con otra API) puede usarlo como base.
 */
import type { PuertoAlmacenamiento, CambiosStorage, AmbitoStorage } from "./almacenamiento";

type Bucket = Record<string, unknown>;

export class AlmacenamientoEnMemoria implements PuertoAlmacenamiento {
  private local: Bucket = {};
  private sesion: Bucket = {};
  private subs = new Set<(c: CambiosStorage, a: AmbitoStorage) => void>();

  private leer(bucket: Bucket, claves: string[]): Record<string, unknown> {
    const salida: Record<string, unknown> = {};
    for (const k of claves) {
      if (k in bucket) salida[k] = bucket[k];
    }
    return salida;
  }

  private escribir(bucket: Bucket, valores: Record<string, unknown>, ambito: AmbitoStorage): void {
    const cambios: CambiosStorage = {};
    for (const [k, v] of Object.entries(valores)) {
      cambios[k] = { oldValue: bucket[k], newValue: v };
      bucket[k] = v;
    }
    this.notificar(cambios, ambito);
  }

  private borrar(bucket: Bucket, claves: string[], ambito: AmbitoStorage): void {
    const cambios: CambiosStorage = {};
    for (const k of claves) {
      if (!(k in bucket)) continue;
      cambios[k] = { oldValue: bucket[k], newValue: undefined };
      delete bucket[k];
    }
    if (Object.keys(cambios).length > 0) this.notificar(cambios, ambito);
  }

  private notificar(cambios: CambiosStorage, ambito: AmbitoStorage): void {
    this.subs.forEach((cb) => {
      try {
        cb(cambios, ambito);
      } catch (e) {
        console.warn("[AlmacenamientoEnMemoria] Error en suscriptor:", e);
      }
    });
  }

  async obtenerLocal<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>> {
    return this.leer(this.local, claves) as Partial<T>;
  }

  async guardarLocal(valores: Record<string, unknown>): Promise<void> {
    this.escribir(this.local, valores, "local");
  }

  async borrarLocal(claves: string[]): Promise<void> {
    this.borrar(this.local, claves, "local");
  }

  async obtenerSesion<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>> {
    return this.leer(this.sesion, claves) as Partial<T>;
  }

  async guardarSesion(valores: Record<string, unknown>): Promise<void> {
    this.escribir(this.sesion, valores, "session");
  }

  async borrarSesion(claves: string[]): Promise<void> {
    this.borrar(this.sesion, claves, "session");
  }

  onCambio(cb: (cambios: CambiosStorage, ambito: AmbitoStorage) => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  /** Ayuda de tests: inspeccionar/sembrar el contenido sin pasar por la API async. */
  _volcar(): { local: Bucket; sesion: Bucket } {
    return { local: { ...this.local }, sesion: { ...this.sesion } };
  }
}
