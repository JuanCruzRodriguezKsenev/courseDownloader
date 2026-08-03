/**
 * Tests de shared/state.ts (AppState) — estrenados con la Fase 5b.
 *
 * Este archivo NO tenía cobertura: los tests del popup mockean `globalThis.AppState` entero,
 * así que nunca ejercitaban la maquinaria real. Al desacoplarla del `chrome.storage` se pudo
 * testear contra `AlmacenamientoEnMemoria`, sin mocks de `chrome.*` a mano.
 *
 * `sincronizarConBackground` sigue siendo IPC (`chrome.runtime`), así que ahí sí se stubea
 * `chrome` — es lo que queda pendiente de un futuro PuertoMensajeria.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crearAppState } from "./state";
import { AlmacenamientoEnMemoria } from "../core/puertos/almacenamientoEnMemoria";

let almacenamiento: AlmacenamientoEnMemoria;
let app: ReturnType<typeof crearAppState>;

/** `respaldar()`/`limpiarSesionLocal()` son fire-and-forget: hay que dejar correr la microtask. */
const dejarCorrer = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  almacenamiento = new AlmacenamientoEnMemoria();
  app = crearAppState(almacenamiento);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppState.inicializarSincronizacionStorage", () => {
  it("con el storage vacío deja los valores por defecto", async () => {
    await app.inicializarSincronizacionStorage();

    expect(app.listadoClasesGlobal).toEqual([]);
    expect(app.colaDescargas).toEqual([]);
    expect(app.sincronizacionDiscoCompletada).toBe(false);
    expect(app.catedraSeleccionada).toBeNull();
    expect(app.ordenAscendente).toBe(true);
    expect(app.tutorialCompletado).toBe(false);
  });

  it("hidrata todas las claves persistidas", async () => {
    await almacenamiento.guardarLocal({
      listaPersistente: [{ titulo: "A", estado: "pending" }],
      colaDescargas: [{ id: 1 }],
      faseDiscoOk: true,
      catedraElegida: "B",
      ocultarAdvExplorar: true,
      ocultarAdvAula: true,
      ordenAscendente: false,
      tutorialCompletado: true,
    });

    await app.inicializarSincronizacionStorage();

    expect(app.listadoClasesGlobal).toEqual([{ titulo: "A", estado: "pending" }]);
    expect(app.colaDescargas).toEqual([{ id: 1 }]);
    expect(app.sincronizacionDiscoCompletada).toBe(true);
    expect(app.catedraSeleccionada).toBe("B");
    expect(app.ocultarAdvertenciaExplorar).toBe(true);
    expect(app.ocultarAdvertenciaAula).toBe(true);
    expect(app.tutorialCompletado).toBe(true);
  });

  it("respeta ordenAscendente=false (no lo pisa el default)", async () => {
    await almacenamiento.guardarLocal({ ordenAscendente: false });

    await app.inicializarSincronizacionStorage();

    expect(app.ordenAscendente).toBe(false);
  });

  it("normaliza el estado 'error' heredado a 'pending' (bug 400 ya revertido)", async () => {
    await almacenamiento.guardarLocal({
      listaPersistente: [
        { titulo: "vieja", estado: "error" },
        { titulo: "sana", estado: "pending" },
        { titulo: "lista", estado: "done" },
      ],
    });

    await app.inicializarSincronizacionStorage();

    expect(app.listadoClasesGlobal.map((c) => c.estado)).toEqual(["pending", "pending", "done"]);
  });

  it("modoTurboBun queda forzado en true venga lo que venga del storage", async () => {
    await almacenamiento.guardarLocal({ modoTurboBun: false });

    await app.inicializarSincronizacionStorage();

    expect(app.modoTurboBun).toBe(true);
  });
});

describe("AppState.respaldar", () => {
  it("persiste las 8 claves en UNA sola escritura (invariante multi-clave del puerto)", async () => {
    const spy = vi.spyOn(almacenamiento, "guardarLocal");
    app.listadoClasesGlobal = [{ titulo: "A" }];
    app.colaDescargas = [{ id: 7 }];
    app.sincronizacionDiscoCompletada = true;
    app.catedraSeleccionada = "C";

    app.respaldar();
    await dejarCorrer();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(Object.keys(spy.mock.calls[0]![0]).sort()).toEqual(
      [
        "catedraElegida",
        "colaDescargas",
        "faseDiscoOk",
        "listaPersistente",
        "ocultarAdvAula",
        "ocultarAdvExplorar",
        "ordenAscendente",
        "tutorialCompletado",
      ].sort()
    );

    const { local } = almacenamiento._volcar();
    expect(local.listaPersistente).toEqual([{ titulo: "A" }]);
    expect(local.catedraElegida).toBe("C");
  });

  it("un fallo del storage se avisa por consola y no rechaza (es fire-and-forget)", async () => {
    vi.spyOn(almacenamiento, "guardarLocal").mockRejectedValue(new Error("storage lleno"));

    expect(() => app.respaldar()).not.toThrow();
    await dejarCorrer();

    expect(console.warn).toHaveBeenCalledWith(
      "[AppState] Error al persistir estado:",
      expect.any(Error)
    );
  });
});

describe("AppState.limpiarSesionLocal", () => {
  it("resetea el estado en memoria y borra SÓLO las claves de sesión", async () => {
    await almacenamiento.guardarLocal({
      listaPersistente: [{ titulo: "A" }],
      colaDescargas: [{ id: 1 }],
      faseDiscoOk: true,
      catedraElegida: "B",
      tutorialCompletado: true,
    });
    app.listadoClasesGlobal = [{ titulo: "A" }];
    app.colaDescargas = [{ id: 1 }];
    app.ráfagaEnCurso = true;
    app.sincronizacionDiscoCompletada = true;
    app.videoActualEnTransmisiónSW = "algo";

    app.limpiarSesionLocal();
    await dejarCorrer();

    expect(app.listadoClasesGlobal).toEqual([]);
    expect(app.colaDescargas).toEqual([]);
    expect(app.ráfagaEnCurso).toBe(false);
    expect(app.sincronizacionDiscoCompletada).toBe(false);
    expect(app.videoActualEnTransmisiónSW).toBe("");

    const { local } = almacenamiento._volcar();
    expect(local.listaPersistente).toBeUndefined();
    expect(local.colaDescargas).toBeUndefined();
    expect(local.faseDiscoOk).toBeUndefined();
    // La cátedra sobrevive a propósito: si no, la UI la vuelve a pedir al re-escanear.
    expect(local.catedraElegida).toBe("B");
    expect(local.tutorialCompletado).toBe(true);
  });
});

describe("AppState.conmutarSeleccionMasiva", () => {
  it("marca sólo las clases 'pending' y respalda", async () => {
    const spy = vi.spyOn(almacenamiento, "guardarLocal");
    const visibles = [
      { titulo: "A", estado: "pending", seleccionado: false },
      { titulo: "B", estado: "done", seleccionado: false },
    ];

    app.conmutarSeleccionMasiva(true, visibles);
    await dejarCorrer();

    expect(visibles[0]!.seleccionado).toBe(true);
    expect(visibles[1]!.seleccionado).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("AppState.establecerModoTurbo", () => {
  it("fuerza true incluso si le pasan false (Turbo es el único camino vivo)", () => {
    app.establecerModoTurbo(false);
    expect(app.modoTurboBun).toBe(true);
  });
});

describe("AppState.sincronizarConBackground", () => {
  it("copia los estados del SW sobre la lista en memoria y detecta la ráfaga", async () => {
    globalThis.chrome = {
      runtime: {
        lastError: null,
        sendMessage: (_msg: unknown, cb: (r: unknown) => void) =>
          cb({ estados: { A: "process", B: "done" }, suaveFrenado: true, videoActual: "A" }),
      },
    } as unknown as typeof chrome;
    app.listadoClasesGlobal = [
      { titulo: "A", estado: "pending" },
      { titulo: "B", estado: "pending" },
      { titulo: "C", estado: "pending" },
    ];

    await app.sincronizarConBackground();

    expect(app.listadoClasesGlobal.map((c) => c.estado)).toEqual(["process", "done", "pending"]);
    expect(app.ráfagaEnCurso).toBe(true);
    expect(app.banderaFrenadoSolicitado).toBe(true);
    expect(app.videoActualEnTransmisiónSW).toBe("A");
  });

  it("si el SW no responde, el timeout de rescate resuelve vacío en vez de colgar", async () => {
    vi.useFakeTimers();
    globalThis.chrome = {
      runtime: { lastError: null, sendMessage: () => {} }, // nunca llama al callback
    } as unknown as typeof chrome;

    const promesa = app.sincronizarConBackground();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promesa).resolves.toEqual({ estados: {}, porcentaje: 0, telemetry: null });
    vi.useRealTimers();
  });

  it("con el canal IPC caído resuelve vacío sin tocar el estado", async () => {
    globalThis.chrome = {
      runtime: {
        lastError: { message: "no receiver" },
        sendMessage: (_msg: unknown, cb: (r: unknown) => void) => cb(undefined),
      },
    } as unknown as typeof chrome;
    app.listadoClasesGlobal = [{ titulo: "A", estado: "pending" }];

    const r = await app.sincronizarConBackground();

    expect(r).toEqual({ estados: {}, porcentaje: 0, telemetry: null });
    expect(app.listadoClasesGlobal[0]!.estado).toBe("pending");
  });
});
