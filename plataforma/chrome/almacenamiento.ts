/**
 * ADAPTADOR CHROME — ALMACENAMIENTO (V1.0.0)
 * ==========================================================================
 * Implementa `PuertoAlmacenamiento` sobre `chrome.storage`. Capa 3 de ADR-0008: es
 * el único lugar (junto a sus hermanos) donde el núcleo toca la API del navegador.
 * Migrar la extensión a otro runtime = escribir otro archivo como éste.
 *
 * Las guardas de disponibilidad (`typeof chrome === "undefined"`) vienen del código
 * original y siguen valiendo: los módulos se cargan también en contextos sin la API
 * (tests que importan el módulo suelto, o el popup antes de que exista el permiso).
 * Degradan a no-op / vacío en vez de romper.
 */
import type { PuertoAlmacenamiento, CambiosStorage, AmbitoStorage } from "../../core/puertos/almacenamiento";

function hayStorage(): boolean {
  return typeof chrome !== "undefined" && !!chrome.storage;
}

/**
 * Subconjunto de `chrome.storage.StorageArea` del que realmente depende el puerto.
 * Se declara a mano porque @types/chrome parametriza `get` con `keyof T` del store
 * concreto, y eso no encaja con el genérico del puerto —que describe lo que espera el
 * LLAMADOR, no lo que hay guardado—. Escribirlo así deja explícita la superficie de la
 * API del navegador de la que dependemos: tres métodos.
 */
type AreaAlmacenamiento = {
  get(claves: string[]): Promise<Record<string, unknown>>;
  set(valores: Record<string, unknown>): Promise<void>;
  remove(claves: string[]): Promise<void>;
};

function area(a: "local" | "session"): AreaAlmacenamiento | null {
  if (!hayStorage()) return null;
  const nativa = a === "local" ? chrome.storage.local : chrome.storage.session;
  return (nativa as unknown as AreaAlmacenamiento) ?? null;
}

export const AlmacenamientoChrome: PuertoAlmacenamiento = {
  async obtenerLocal<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>> {
    const a = area("local");
    if (!a) return {} as Partial<T>;
    return (await a.get(claves)) as Partial<T>;
  },

  async guardarLocal(valores: Record<string, unknown>): Promise<void> {
    const a = area("local");
    if (!a) return;
    await a.set(valores);
  },

  async borrarLocal(claves: string[]): Promise<void> {
    const a = area("local");
    if (!a) return;
    await a.remove(claves);
  },

  async obtenerSesion<T = Record<string, unknown>>(claves: string[]): Promise<Partial<T>> {
    const a = area("session");
    if (!a) return {} as Partial<T>;
    return (await a.get(claves)) as Partial<T>;
  },

  async guardarSesion(valores: Record<string, unknown>): Promise<void> {
    const a = area("session");
    if (!a) return;
    await a.set(valores);
  },

  async borrarSesion(claves: string[]): Promise<void> {
    const a = area("session");
    if (!a) return;
    await a.remove(claves);
  },

  onCambio(cb: (cambios: CambiosStorage, ambito: AmbitoStorage) => void): () => void {
    if (!hayStorage() || !chrome.storage.onChanged) return () => {};
    const oyente = (cambios: Record<string, chrome.storage.StorageChange>, area: string) => {
      cb(cambios as CambiosStorage, area as AmbitoStorage);
    };
    chrome.storage.onChanged.addListener(oyente);
    return () => chrome.storage.onChanged.removeListener(oyente);
  }
};

// Exportación (ver docs/coding-standards.md).
export default AlmacenamientoChrome;
