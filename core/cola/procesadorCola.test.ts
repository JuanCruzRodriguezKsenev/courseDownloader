/**
 * Tests de `core/cola/procesadorCola.ts`.
 *
 * El comportamiento del bucle —los cuatro caminos de fallo, el FIFO, el freno suave, el
 * auto-heal— ya está caracterizado en `background.test.js`, que desde la Fase 6b construye
 * **este mismo módulo** y lo ejercita por su superficie real (IPC). No se duplica acá.
 *
 * Lo que sí vive acá es lo que por IPC no se puede expresar: las invariantes de la API que
 * antes eran variables de módulo sueltas en `background.js` y que ahora son estado privado.
 * Son justamente las que nadie miraba.
 */
import { describe, it, expect, vi } from "vitest";
import { AlmacenamientoEnMemoria } from "../puertos/almacenamientoEnMemoria";
import { MensajeriaEnMemoria } from "../puertos/mensajeriaEnMemoria";
import { ProgramadorEnMemoria } from "../puertos/programadorEnMemoria";
import { crearEstadoSesion } from "./estadoSesion";
import { crearEstadosProgreso } from "./estadosProgreso";
import { crearProcesadorCola } from "./procesadorCola";

/* eslint-disable @typescript-eslint/no-explicit-any */

function montar(over: Record<string, any> = {}) {
  const almacenamiento = new AlmacenamientoEnMemoria();
  const sesion = crearEstadoSesion(almacenamiento);
  const estados = crearEstadosProgreso(almacenamiento);
  const mensajeria = new MensajeriaEnMemoria(1000);
  const programador = new ProgramadorEnMemoria();

  const motor = {
    descargarYAnalizarIndexM3u8: vi.fn().mockResolvedValue({ urls: ["a.ts"], lineaLlave: "", urlLlave: "" }),
    compilarTranscodificacionStream: vi.fn().mockResolvedValue(null),
    ...(over.motor || {}),
  };

  // Se declara afuera para poder afirmar sobre él: el corte 8 hizo que el `sitioId` del ítem
  // viaje hasta la notificación, y eso hay que poder verlo desde los tests.
  const notificarFallo = over.notificarFallo ?? vi.fn();

  // `over` va ANTES de `motor` a propósito: si fuera después, un override parcial del motor
  // reemplazaría el objeto entero y se llevaría puestos los métodos que el test no redefine.
  const cola = crearProcesadorCola({
    ...over,
    almacenamiento,
    sesion,
    mensajeria,
    programador,
    // El bucle resuelve el portal por ítem (ADR-0010): el doble es un REGISTRO, no un sitio.
    // Imita al de producción, incluida su parte de migración: `undefined` resuelve (dato
    // viejo, de antes del multi-sitio) y un id desconocido NO (huérfano). Ver composicion.ts.
    sitios: {
      obtener: (id: string | undefined) =>
        id === undefined || id === "prueba"
          ? { resolverManifiesto: resolverManifiestoDoble, nombre: "Portal de Prueba" }
          : undefined,
    },
    historial: { registrar: vi.fn().mockResolvedValue({}) },
    notificarFallo,
    calcularMetricas: () => ({ porcentaje: 50, telemetry: { velocidadTexto: "1.5" } }),
    actualizarConsolaBackend: vi.fn(),
    guardarBlobLegacy: vi.fn(),
    persistirEstados: (e) => estados.persistir(e),
    recuperarEstados: () => estados.recuperar(),
    conexion: over.conexion ?? {
      verificarAhora: async () => {},
      get: () => ({ servidor: true, internet: true, tipoFalla: null }),
    },
    motor,
  });

  return { cola, almacenamiento, sesion, mensajeria, programador, motor, notificarFallo };
}

const item = (titulo: string) => ({ titulo, urlInterna: `https://p/${titulo}`, fechaEncolado: 1 });
const esperar = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const resolverManifiestoDoble = vi.fn().mockResolvedValue("https://cdn/v.m3u8");

describe("arrancarSiNoCorre — la guarda contra dos ráfagas simultáneas", () => {
  it("dos llamadas seguidas NO arrancan dos bucles", async () => {
    // Es EL bug que la guarda previene: dos bucles sobre la misma cola descargan la misma
    // clase dos veces y se pisan el progreso. Antes esto era un `if (!loopActivo)` suelto en
    // background.js, repetido en tres call-sites y sin ningún test.
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({ colaDescargas: [item("Clase 1")], listaPersistente: [] });

    cola.arrancarSiNoCorre();
    cola.arrancarSiNoCorre();
    await esperar(60);

    expect(motor.compilarTranscodificacionStream).toHaveBeenCalledTimes(1);
  });

  it("estaActivo() refleja si el bucle está corriendo", async () => {
    const { cola, sesion } = montar();
    expect(cola.estaActivo()).toBe(false);

    await sesion.set({ rafagaCorriendo: true });
    cola.arrancarSiNoCorre();
    expect(cola.estaActivo()).toBe(true);
  });

  it("con la ráfaga apagada el bucle se detiene solo y libera la guarda", async () => {
    const { cola, sesion } = montar();
    await sesion.set({ rafagaCorriendo: false });

    cola.arrancarSiNoCorre();
    await esperar();

    // Si no se liberara, la próxima ráfaga no arrancaría nunca.
    expect(cola.estaActivo()).toBe(false);
  });
});

// ADR-0011 (corte 6D): el array de `colaDescargas` ES el orden de descarga. Hasta este corte
// el bucle ordenaba por `fechaEncolado` en cada vuelta y el orden del popup era sólo una vista.
describe("el orden de la cola lo decide el array", () => {
  it("baja el PRIMERO del array aunque su fechaEncolado sea el más nuevo", async () => {
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    // Deliberadamente al revés de lo que diría `fechaEncolado`: es lo que escribe el popup
    // cuando el usuario invierte el orden. Con el `sort` viejo, esto bajaba "Primera".
    await almacenamiento.guardarLocal({
      colaDescargas: [
        { ...item("Ultima"), fechaEncolado: 9999 },
        { ...item("Primera"), fechaEncolado: 1 },
      ],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    // Lo que importa es cuál bajó PRIMERO: el bucle sigue con el resto igual.
    // La firma del motor es (meta, signal, subcarpeta, contexto, callbacks): el título va
    // en el contexto de la ráfaga.
    const titulos = motor.compilarTranscodificacionStream.mock.calls.map(
      (c: unknown[]) => (c[3] as { titulo: string }).titulo
    );
    expect(titulos[0]).toBe("Ultima");
  });
});

// ADR-0010: el portal se resuelve POR ÍTEM. Estos dos casos son la razón de ser del corte —
// distinguir "dato viejo" de "portal desconocido", que hasta acá eran indistinguibles.
describe("resolución del portal por ítem", () => {
  it("saltea la clase y SIGUE si su portal no está registrado (huérfana)", async () => {
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Huerfana"), sitioId: "portal-borrado" }, item("Clase 2")],
      listaPersistente: [{ titulo: "Huerfana", estado: "process" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    const local = almacenamiento._volcar().local as {
      colaDescargas: { titulo: string }[];
      listaPersistente: { titulo: string; estado?: string }[];
    };
    // Se fue de la cola y volvió a 'pending' (re-encolable, no un 'error' que la UI no pinta).
    expect(local.colaDescargas.map((c) => c.titulo)).not.toContain("Huerfana");
    expect(local.listaPersistente.find((c) => c.titulo === "Huerfana")?.estado).toBe("pending");
    // Y lo crítico: NO pausó la cola. Pausar dispararía el auto-heal en loop contra algo que
    // no se recupera solo — es el mismo razonamiento que la rama 4xx del bug 400.
    expect((await sesion.get()).colaPausadaPorError).toBeFalsy();
    // Siguió con la próxima.
    expect(motor.compilarTranscodificacionStream).toHaveBeenCalled();
  });

  it("un ítem SIN sitioId (encolado antes del multi-sitio) NO se trata como huérfano", async () => {
    // El SW lee `colaDescargas` de storage sin pasar por la normalización de AppState, que es
    // del popup. Así que esto es real para cualquier instalación existente: sin la migración
    // que aplica la composición, la cola entera se saltearía. El doble de `sitios` la imita.
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Vieja")],
      listaPersistente: [{ titulo: "Vieja", estado: "process" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(motor.compilarTranscodificacionStream).toHaveBeenCalled();
    expect((await sesion.get()).colaPausadaPorError).toBeFalsy();
  });
});

describe("abortarRafaga", () => {
  it("aborta la descarga en vuelo y suelta el bucle", async () => {
    let signalVisto: AbortSignal | undefined;
    const { cola, almacenamiento, sesion } = montar({
      motor: {
        compilarTranscodificacionStream: vi.fn(
          (_m: any, signal: AbortSignal) =>
            new Promise((_res, rej) => {
              signalVisto = signal;
              signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" })));
            })
        ),
      },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({ colaDescargas: [item("Clase 1")], listaPersistente: [] });

    cola.arrancarSiNoCorre();
    await esperar();
    expect(signalVisto!.aborted).toBe(false);

    cola.abortarRafaga();

    expect(signalVisto!.aborted).toBe(true);
    expect(cola.estaActivo()).toBe(false);
  });

  it("sin descarga en vuelo no falla", () => {
    const { cola } = montar();
    expect(() => cola.abortarRafaga()).not.toThrow();
  });
});

describe("alDispararAutoheal", () => {
  it("devuelve false y limpia la alarma si la cola no está pausada", async () => {
    const { cola, programador } = montar();
    programador.programar("alarma_autoheal", { periodoMin: 0.2 });

    await expect(cola.alDispararAutoheal()).resolves.toBe(false);
    expect(programador.estaProgramada("alarma_autoheal")).toBe(false);
  });

  it('con tipo "sesion" no reanuda aunque la conexión esté OK', async () => {
    // El daemon ve la red bien —el problema es el login—, así que reanudar dispararía un
    // loop contra la página de login. La guarda es defensiva: para "sesion" ni se crea
    // alarma, pero puede haber quedado una de un estado anterior.
    const { cola, sesion, programador } = montar();
    await sesion.set({ colaPausadaPorError: true, tipoDeErrorConexion: "sesion" });
    programador.programar("alarma_autoheal", { periodoMin: 0.2 });

    await expect(cola.alDispararAutoheal()).resolves.toBe(false);
    expect(programador.estaProgramada("alarma_autoheal")).toBe(false);
  });

  it("reanuda cuando el daemon reporta recuperado el recurso que faltaba", async () => {
    const { cola, sesion } = montar({
      conexion: { verificarAhora: async () => {}, get: () => ({ servidor: true, internet: true, tipoFalla: null }) },
    });
    await sesion.set({ colaPausadaPorError: true, tipoDeErrorConexion: "servidor" });

    await expect(cola.alDispararAutoheal()).resolves.toBe(true);
    // Sólo se afirma que salió de pausa: `rafagaCorriendo` es transitorio — el bucle arranca
    // y, con la cola vacía, la vuelve a apagar enseguida.
    await expect(sesion.get()).resolves.toMatchObject({ colaPausadaPorError: false });
  });

  it("NO reanuda si el recurso que faltaba sigue caído", async () => {
    const { cola, sesion } = montar({
      conexion: {
        verificarAhora: async () => {},
        get: () => ({ servidor: false, internet: true, tipoFalla: "servidor" }),
      },
    });
    await sesion.set({ colaPausadaPorError: true, tipoDeErrorConexion: "servidor" });

    await expect(cola.alDispararAutoheal()).resolves.toBe(false);
    await expect(sesion.get()).resolves.toMatchObject({ colaPausadaPorError: true });
  });
});

// [MULTISITIO CORTE 8] El aviso de fallo lleva el portal DEL ÍTEM. El service worker no tiene
// pestaña de la cual deducirlo, así que si el dato no sale de acá, el click de la notificación
// no tiene con qué decidir a dónde llevar al usuario.
describe("el sitioId del ítem viaja hasta el aviso de fallo", () => {
  it("una pausa por sesión caída lo pasa a notificarFallo", async () => {
    const { cola, almacenamiento, sesion, notificarFallo, motor } = montar();
    motor.compilarTranscodificacionStream.mockRejectedValue(
      Object.assign(new Error("login"), { tipoConexion: "sesion" })
    );
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Clase 1"), sitioId: "prueba" }],
      listaPersistente: [{ titulo: "Clase 1", estado: "process" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(notificarFallo).toHaveBeenCalledWith("sesion", "Clase 1", expect.any(String), "prueba");
  });

  it("un ítem sin sitioId lo pasa como undefined, no inventa uno", async () => {
    // Es lo que hace que el click resuelva al portal legado por la vía de la migración, en vez
    // de por un valor adivinado acá. Capa 1 no sabe cuál es el portal legado, y no debe.
    const { cola, almacenamiento, sesion, notificarFallo, motor } = montar();
    motor.compilarTranscodificacionStream.mockRejectedValue(
      Object.assign(new Error("login"), { tipoConexion: "sesion" })
    );
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Vieja")],
      listaPersistente: [{ titulo: "Vieja", estado: "process" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(notificarFallo).toHaveBeenCalledWith("sesion", "Vieja", expect.any(String), undefined);
  });

  it("la huérfana avisa CON su id desconocido, para que el click no resuelva nada", async () => {
    // Pasar undefined acá sería peor que no avisar: el resolvedor lo migraría al portal legado
    // y el click abriría un portal que no es el del ítem — el bug que este corte arregla.
    const { cola, almacenamiento, sesion, notificarFallo } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Huerfana"), sitioId: "portal-borrado" }],
      listaPersistente: [{ titulo: "Huerfana", estado: "process" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(notificarFallo).toHaveBeenCalledWith(
      "rechazo",
      "Huerfana",
      expect.any(String),
      "portal-borrado"
    );
  });
});
