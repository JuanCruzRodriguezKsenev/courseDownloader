/**
 * Tests de core/estado/appState.ts (AppState) — estrenados con la Fase 5b.
 *
 * Este archivo NO tenía cobertura: los tests del popup mockean `globalThis.AppState` entero,
 * así que nunca ejercitaban la maquinaria real. Al desacoplarla del `chrome.storage` se pudo
 * testear contra `AlmacenamientoEnMemoria`, sin mocks de `chrome.*` a mano.
 *
 * Desde la Fase 5c tampoco se stubea `chrome.runtime` para `sincronizarConBackground`: el IPC
 * entra por `MensajeriaEnMemoria`, donde "el SW está dormido" (sin manejador) y "el SW promete
 * responder y no lo hace" (devuelve `true` y no llama a `responder`) son escenarios reales del
 * adaptador y no un `lastError` inventado a mano. Ya no queda ningún mock de `chrome.*` acá.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crearAppState } from "./appState";
import { AlmacenamientoEnMemoria } from "../puertos/almacenamientoEnMemoria";
import { MensajeriaEnMemoria } from "../puertos/mensajeriaEnMemoria";

let almacenamiento: AlmacenamientoEnMemoria;
let mensajeria: MensajeriaEnMemoria;
let app: ReturnType<typeof crearAppState>;

/** `respaldar()`/`limpiarSesionLocal()` son fire-and-forget: hay que dejar correr la microtask. */
const dejarCorrer = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  almacenamiento = new AlmacenamientoEnMemoria();
  mensajeria = new MensajeriaEnMemoria();
  app = crearAppState(almacenamiento, mensajeria);
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
    expect(app.facetaSeleccionada).toBeNull();
    expect(app.ordenAscendente).toBe(true);
    expect(app.tutorialCompletado).toBe(false);
  });

  it("hidrata todas las claves persistidas", async () => {
    await almacenamiento.guardarLocal({
      listaPersistente: [{ titulo: "A", estado: "pending" }],
      colaDescargas: [{ id: 1 }],
      faseDiscoOk: true,
      facetaElegida: "B",
      ocultarAdvExplorar: true,
      ocultarAdvAula: true,
      ordenAscendente: false,
      tutorialCompletado: true,
    });

    await app.inicializarSincronizacionStorage();

    // `sitioId` lo agrega la normalización de ADR-0010 (ver el describe de más abajo).
    expect(app.listadoClasesGlobal).toEqual([{ titulo: "A", estado: "pending", sitioId: "ramonnet" }]);
    expect(app.colaDescargas).toEqual([{ id: 1, sitioId: "ramonnet" }]);
    expect(app.sincronizacionDiscoCompletada).toBe(true);
    expect(app.facetaSeleccionada).toBe("B");
    expect(app.ocultarAdvertenciaExplorar).toBe(true);
    expect(app.ocultarAdvertenciaAula).toBe(true);
    expect(app.tutorialCompletado).toBe(true);
  });

  // Red de la migración de ADR-0010 (`sitioId` en los ítems). Mismo criterio que la de la
  // faceta, de abajo: se corre sobre el storage REAL de una instalación existente, porque el
  // valor de esto es exactamente que no rompa datos que ya están en disco.
  describe("migración de sitioId (ADR-0010)", () => {
    it("a un ítem sin sitioId le asume el portal legado, en la lista y en la cola", async () => {
      await almacenamiento.guardarLocal({
        listaPersistente: [{ titulo: "vieja", estado: "pending" }],
        colaDescargas: [{ id: 9, titulo: "vieja" }],
      });

      await app.inicializarSincronizacionStorage();

      expect(app.listadoClasesGlobal[0]).toMatchObject({ sitioId: "ramonnet" });
      expect(app.colaDescargas[0]).toMatchObject({ sitioId: "ramonnet" });
    });

    it("respeta el sitioId que ya trae el ítem: el default NO pisa", async () => {
      await almacenamiento.guardarLocal({
        listaPersistente: [{ titulo: "nueva", estado: "pending", sitioId: "otroportal" }],
        colaDescargas: [{ id: 10, sitioId: "otroportal" }],
      });

      await app.inicializarSincronizacionStorage();

      expect(app.listadoClasesGlobal[0]).toMatchObject({ sitioId: "otroportal" });
      expect(app.colaDescargas[0]).toMatchObject({ sitioId: "otroportal" });
    });

    it("no rompe con una lista vacía ni con entradas nulas", async () => {
      await almacenamiento.guardarLocal({ listaPersistente: [], colaDescargas: [null] });

      await app.inicializarSincronizacionStorage();

      expect(app.listadoClasesGlobal).toEqual([]);
      expect(app.colaDescargas).toEqual([null]);
    });
  });

  // La faceta se guardaba como `catedraElegida` hasta el 2026-08-03. Estos tres tests son la
  // red de esa migración: se corre sobre el storage REAL de una instalación existente, así que
  // un error acá se paga perdiendo la elección del usuario (y con el modal multicátedra
  // reapareciendo de la nada), no con un test rojo.
  describe("migración de la clave de faceta", () => {
    it("adopta la clave vieja cuando no existe la nueva", async () => {
      await almacenamiento.guardarLocal({ catedraElegida: "C" });

      await app.inicializarSincronizacionStorage();

      expect(app.facetaSeleccionada).toBe("C");
    });

    it("borra la clave vieja apenas la adopta (la migración se paga una vez)", async () => {
      await almacenamiento.guardarLocal({ catedraElegida: "C" });

      await app.inicializarSincronizacionStorage();
      await dejarCorrer(); // el borrado es fire-and-forget

      expect(almacenamiento._volcar().local.catedraElegida).toBeUndefined();
    });

    it("si están las dos, gana la nueva (la vieja es un resto)", async () => {
      await almacenamiento.guardarLocal({ facetaElegida: "A", catedraElegida: "C" });

      await app.inicializarSincronizacionStorage();

      expect(app.facetaSeleccionada).toBe("A");
    });
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
  it("persiste las 10 claves en UNA sola escritura (invariante multi-clave del puerto)", async () => {
    const spy = vi.spyOn(almacenamiento, "guardarLocal");
    app.listadoClasesGlobal = [{ titulo: "A" }];
    app.colaDescargas = [{ id: 7 }];
    app.sincronizacionDiscoCompletada = true;
    app.facetaSeleccionada = "C";

    app.respaldar();
    await dejarCorrer();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(Object.keys(spy.mock.calls[0]![0]).sort()).toEqual(
      [
        "facetaElegida",
        "colaDescargas",
        "faseDiscoOk",
        "listaPersistente",
        "ocultarAdvAula",
        "ocultarAdvExplorar",
        "ordenAscendente",
        // El par propio de la Cola (corte 6b). `ordenAscendente` sigue existiendo y es el
        // sentido de Disponibles: el tri-estado viejo servía a las dos pestañas.
        "criterioOrdenCola",
        "ordenColaAscendente",
        "tutorialCompletado",
      ].sort()
    );

    const { local } = almacenamiento._volcar();
    expect(local.listaPersistente).toEqual([{ titulo: "A" }]);
    expect(local.facetaElegida).toBe("C");
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
      facetaElegida: "B",
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
    // La faceta elegida sobrevive a propósito: si no, la UI la vuelve a pedir al re-escanear.
    expect(local.facetaElegida).toBe("B");
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
    mensajeria.onMensaje((_msg, responder) => {
      responder({ estados: { A: "process", B: "done" }, suaveFrenado: true, videoActual: "A" });
    });
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

  it("si el SW acepta pero nunca contesta, el timeout de rescate resuelve vacío en vez de colgar", async () => {
    // OJO con el timeout del adaptador: por defecto es 0ms, así que el puerto rechazaría
    // primero y este test verificaría el OTRO camino sin que se note. Se le da un plazo largo
    // para que el único reloj que puede sonar sea el rescate de AppState — que es justo lo que
    // en el navegador no existe (chrome.runtime no vence solo) y por eso hay que probar.
    const mensajeriaLenta = new MensajeriaEnMemoria(60_000);
    const appLenta = crearAppState(almacenamiento, mensajeriaLenta);
    // Devolver `true` es la convención de "respondo async"; después no responde nunca.
    mensajeriaLenta.onMensaje(() => true);

    vi.useFakeTimers();
    const promesa = appLenta.sincronizarConBackground();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(promesa).resolves.toEqual({ estados: {}, porcentaje: 0, telemetry: null });
    vi.useRealTimers();
  });

  it("con el canal IPC caído (sin receptor) resuelve vacío sin tocar el estado", async () => {
    // Sin manejadores registrados: el puerto rechaza, que es el equivalente del `lastError`
    // "Could not establish connection" del SW dormido.
    app.listadoClasesGlobal = [{ titulo: "A", estado: "pending" }];

    const r = await app.sincronizarConBackground();

    expect(r).toEqual({ estados: {}, porcentaje: 0, telemetry: null });
    expect(app.listadoClasesGlobal[0]!.estado).toBe("pending");
  });

  it("pregunta por la acción correcta", async () => {
    mensajeria.onMensaje((_msg, responder) => responder({ estados: {} }));

    await app.sincronizarConBackground();

    expect(mensajeria.accionesEnviadas()).toEqual(["obtener_estados_en_progreso"]);
  });
});

// [MULTISITIO CORTE 6B] Migración del orden de la Cola.
//
// El tri-estado `ordenAscendente` servía a las DOS pestañas con reglas distintas: Disponibles
// sólo mira su verdad/falsedad (así que `null` era descendente) y la Cola lo leía como
// `null` = FIFO / `true`|`false` = nombre ↑|↓. Estos tests fijan que la Cola estrene su par
// propio SIN dar vuelta Disponibles, que es el error que un split ingenuo cometería en silencio.
describe("migración del orden de la Cola (corte 6b)", () => {
  async function cargarCon(persistido: Record<string, unknown>) {
    const almacenamiento = new AlmacenamientoEnMemoria();
    await almacenamiento.guardarLocal(persistido);
    const app = crearAppState(almacenamiento, new MensajeriaEnMemoria(1000));
    await app.inicializarSincronizacionStorage();
    return app;
  }

  it("ordenAscendente null (FIFO) → criterio 'llegada' ascendente", async () => {
    const app = await cargarCon({ ordenAscendente: null });

    expect(app.criterioOrdenCola).toBe("llegada");
    expect(app.ordenColaAscendente).toBe(true);
  });

  it("ordenAscendente true → criterio 'nombre' ascendente", async () => {
    const app = await cargarCon({ ordenAscendente: true });

    expect(app.criterioOrdenCola).toBe("nombre");
    expect(app.ordenColaAscendente).toBe(true);
  });

  it("ordenAscendente false → criterio 'nombre' descendente", async () => {
    const app = await cargarCon({ ordenAscendente: false });

    expect(app.criterioOrdenCola).toBe("nombre");
    expect(app.ordenColaAscendente).toBe(false);
  });

  it("la migración NO toca ordenAscendente: Disponibles conserva su sentido", async () => {
    // Es el punto entero. Con `null`, Disponibles ordenaba DESCENDENTE (sólo mira truthiness).
    // Derivarlo a `true` acá habría dado vuelta esa pestaña en toda instalación existente.
    const app = await cargarCon({ ordenAscendente: null });

    expect(app.ordenAscendente).toBeNull();
  });

  it("sin nada persistido, arranca en llegada ascendente", async () => {
    const app = await cargarCon({});

    expect(app.criterioOrdenCola).toBe("llegada");
    expect(app.ordenColaAscendente).toBe(true);
  });

  it("con el par nuevo ya persistido, se lee tal cual y NO se re-migra", async () => {
    const app = await cargarCon({
      ordenAscendente: true,          // diría 'nombre' si se re-migrara
      criterioOrdenCola: "portal",
      ordenColaAscendente: false,
    });

    expect(app.criterioOrdenCola).toBe("portal");
    expect(app.ordenColaAscendente).toBe(false);
  });

  it("un criterio desconocido en storage cae a 'llegada' en vez de romper el orden", async () => {
    const app = await cargarCon({ criterioOrdenCola: "inventado", ordenColaAscendente: true });

    expect(app.criterioOrdenCola).toBe("llegada");
  });
});
