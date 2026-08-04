/**
 * Tests de `core/cola/estadoSesion.ts`.
 *
 * Lo que se cubre acá es el **relleno de defaults**, que es la única razón por la que esta
 * envoltura existe: `chrome.storage.session` arranca vacío en cada despertar del service
 * worker, y el bucle de descarga lee estas claves esperando valores. Un default mal aplicado
 * no rompe nada visiblemente — deja al SW tomando decisiones con un `undefined`.
 */
import { describe, it, expect } from "vitest";
import { AlmacenamientoEnMemoria } from "../puertos/almacenamientoEnMemoria";
import { crearEstadoSesion, DEFAULTS } from "./estadoSesion";

function crear() {
  const almacenamiento = new AlmacenamientoEnMemoria();
  return { almacenamiento, estado: crearEstadoSesion(almacenamiento) };
}

describe("EstadoSesion.get", () => {
  it("con la sesión vacía devuelve los defaults completos", async () => {
    const { estado } = crear();

    await expect(estado.get()).resolves.toEqual(DEFAULTS);
  });

  it("lo guardado pisa al default, y lo no guardado lo conserva", async () => {
    const { almacenamiento, estado } = crear();
    await almacenamiento.guardarSesion({ videoActualTitulo: "Clase 1", rafagaCorriendo: true });

    const s = await estado.get();

    expect(s.videoActualTitulo).toBe("Clase 1");
    expect(s.rafagaCorriendo).toBe(true);
    expect(s.tipoDeErrorConexion).toBe(""); // no guardado → default
  });

  it("un `false` guardado NO lo pisa el default (es un valor, no un vacío)", async () => {
    // Es el caso que separa `!= null` de un chequeo por falsy, y el que importa de verdad:
    // `modoTurboBunActivo` arranca en `true` por default, así que un `false` mal descartado
    // haría que el SW crea que sigue en turbo.
    const { almacenamiento, estado } = crear();
    await almacenamiento.guardarSesion({ modoTurboBunActivo: false });

    await expect(estado.get()).resolves.toMatchObject({ modoTurboBunActivo: false });
  });

  it("un `0` guardado tampoco lo pisa el default", async () => {
    const { almacenamiento, estado } = crear();
    await almacenamiento.guardarSesion({ velocidadMbsActual: 0, tiempoInicioVideoActual: 0 });

    const s = await estado.get();

    expect(s.velocidadMbsActual).toBe(0);
    expect(s.tiempoInicioVideoActual).toBe(0);
  });

  it("no inventa claves fuera del schema", async () => {
    const { almacenamiento, estado } = crear();
    await almacenamiento.guardarSesion({ claveIntrusa: "x" });

    const s = await estado.get();

    expect(Object.keys(s).sort()).toEqual(Object.keys(DEFAULTS).sort());
  });
});

describe("EstadoSesion.set / clear", () => {
  it("set escribe parcial sin tocar el resto", async () => {
    const { estado } = crear();
    await estado.set({ rafagaCorriendo: true });
    await estado.set({ videoActualTitulo: "Clase 2" });

    await expect(estado.get()).resolves.toMatchObject({
      rafagaCorriendo: true,
      videoActualTitulo: "Clase 2",
    });
  });

  it("clear vuelve a los defaults", async () => {
    const { estado } = crear();
    await estado.set({ rafagaCorriendo: true, videoActualTitulo: "Clase 1" });

    await estado.clear();

    await expect(estado.get()).resolves.toEqual(DEFAULTS);
  });

  it("clear no borra claves de sesión ajenas al schema", async () => {
    // El daemon de conexión espeja su estado en el MISMO ámbito de sesión: si `clear()`
    // barriera con todo, apagaría el espejado popup↔SW de rebote.
    const { almacenamiento, estado } = crear();
    await almacenamiento.guardarSesion({ estadoConexion: { servidor: true } });
    await estado.set({ rafagaCorriendo: true });

    await estado.clear();

    expect(almacenamiento._volcar().sesion.estadoConexion).toEqual({ servidor: true });
  });
});
