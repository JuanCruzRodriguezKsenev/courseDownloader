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
    notificarFallo: vi.fn(),
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

  return { cola, almacenamiento, sesion, mensajeria, programador, motor };
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
