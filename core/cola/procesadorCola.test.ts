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
import { crearIdentidadClase } from "./identidadClase";

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
    // El `?? ` es necesario: `over` se esparce ARRIBA, así que sin esto un override de `sitios`
    // quedaría pisado por el doble de acá y el test afirmaría sobre otra cosa. Pasó al escribir
    // el test de identidad compuesta, que necesita un segundo portal registrado.
    sitios: over.sitios ?? {
      obtener: (id: string | undefined) =>
        id === undefined || id === "prueba"
          ? { resolverManifiesto: resolverManifiestoDoble, nombre: "Portal de Prueba", id: "prueba" }
          : undefined,
    },
    // [CORTE 7] Credenciales del portal del ítem. El default no tiene ninguna, que es el caso
    // de Ramón Net (resuelve con la cookie de sesión) y el que ejercitan casi todos los tests
    // de acá: lo que se afirma es que el bucle las PASA, no que sepa qué contienen.
    credenciales: over.credenciales ?? { para: async () => undefined },
    historial: { registrar: vi.fn().mockResolvedValue({}) },
    notificarFallo,
    calcularMetricas: () => ({ porcentaje: 50, telemetry: { velocidadTexto: "1.5" } }),
    actualizarConsolaBackend: vi.fn(),
    guardarBlobLegacy: vi.fn(),
    persistirEstados: (e) => estados.persistir(e),
    recuperarEstados: () => estados.recuperar(),
    // MULTIPORTAL D: la identidad es (portal, título). Se arma con el MISMO doble de registro
    // que el bucle, así el test no puede quedar comparando distinto que producción.
    identidad:
      over.identidad ??
      crearIdentidadClase({
        obtener: (id?: string) =>
          id === undefined || id === "prueba" ? { id: "prueba" } : undefined,
      }),
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
// [MULTIPORTAL D] EL bug del corte: con la identidad por título, completar una clase sacaba de
// la cola a su homónima del OTRO portal, que nunca se bajaba y desaparecía sin error.
describe("la identidad es (portal, título)", () => {
  it("bajar una clase no saca de la cola a su homónima de otro portal", async () => {
    const { cola, almacenamiento, sesion, motor } = montar({
      sitios: {
        obtener: (id: string | undefined) =>
          id === undefined || id === "prueba" || id === "otro"
            ? { resolverManifiesto: resolverManifiestoDoble, nombre: "Portal", id: id ?? "prueba" }
            : undefined,
      },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [
        { ...item("Semana 3"), sitioId: "prueba" },
        { ...item("Semana 3"), sitioId: "otro" },
      ],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(200);

    // Las DOS se bajaron. Con la identidad por título, la segunda salía de la cola al
    // completarse la primera y el motor nunca la veía.
    const titulos = motor.compilarTranscodificacionStream.mock.calls.map(
      (c: unknown[]) => (c[3] as { titulo: string }).titulo
    );
    expect(titulos).toEqual(["Semana 3", "Semana 3"]);
    expect((almacenamiento._volcar().local as { colaDescargas: unknown[] }).colaDescargas).toEqual([]);
  });
});

// [CORTE 7] El segundo portal resuelve el manifiesto contra una API que pide un token que sólo
// existe dentro de la pestaña. El bucle no sabe qué es: lo lee por ítem y lo pasa.
describe("las credenciales del portal viajan hasta resolverManifiesto", () => {
  it("le pasa al adaptador las credenciales de SU portal", async () => {
    resolverManifiestoDoble.mockClear();
    const { cola, almacenamiento, sesion } = montar({
      credenciales: { para: async (id: string | undefined) => ({ idToken: `token-de-${id}` }) },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Clase 1"), sitioId: "prueba" }],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(resolverManifiestoDoble).toHaveBeenCalledWith(
      "https://p/Clase 1",
      expect.anything(),
      { idToken: "token-de-prueba" }
    );
  });

  it("las pide por el id del DESCRIPTOR, no por el sitioId crudo del ítem", async () => {
    // Mismo criterio que la carpeta del multiportal E: el del descriptor ya pasó por la
    // migración, así que un ítem viejo sin `sitioId` busca las credenciales del portal legado
    // y no las de `undefined`, que no existen y darían un fallo de auth sin explicación.
    const pedidos: (string | undefined)[] = [];
    const { cola, almacenamiento, sesion } = montar({
      credenciales: {
        para: async (id: string | undefined) => {
          pedidos.push(id);
          return undefined;
        },
      },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Sin sitioId")], // sin el campo: encolada antes del multi-sitio
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect(pedidos).toEqual(["prueba"]);
  });

  it("las lee POR ÍTEM, no una vez por ráfaga", async () => {
    // Importa porque el usuario puede re-escanear el portal a mitad de una cola larga para
    // renovar un token vencido: una lectura al arrancar no vería esa renovación.
    resolverManifiestoDoble.mockClear();
    let vuelta = 0;
    const { cola, almacenamiento, sesion } = montar({
      credenciales: { para: async () => ({ idToken: `t${++vuelta}` }) },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Clase 1"), item("Clase 2")],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(200);

    const tokens = resolverManifiestoDoble.mock.calls.map((c: unknown[]) => c[2]);
    expect(tokens).toEqual([{ idToken: "t1" }, { idToken: "t2" }]);
  });

  it("un portal sin credenciales recibe undefined y baja igual (Ramón Net)", async () => {
    resolverManifiestoDoble.mockClear();
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Clase 1")],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    const credencialesPasadas = resolverManifiestoDoble.mock.calls.map((c: unknown[]) => c[2]);
    expect(credencialesPasadas).toEqual([undefined]);
    expect(motor.compilarTranscodificacionStream).toHaveBeenCalledTimes(1);
  });
});

describe("resolución del portal por ítem", () => {
  it("saltea la clase y SIGUE si su portal no está registrado (huérfana)", async () => {
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Huerfana"), sitioId: "portal-borrado" }, item("Clase 2")],
      // MULTIPORTAL D: la entrada de la lista lleva el MISMO `sitioId` que el ítem de la cola,
      // como en producción — la cola hereda el portal de la clase al encolar. Antes de este
      // corte daba igual (se comparaba sólo por título); ahora un fixture inconsistente
      // afirmaría algo que no puede pasar y taparía el caso real.
      listaPersistente: [{ titulo: "Huerfana", estado: "process", sitioId: "portal-borrado" }],
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

/**
 * El fix del cartel mentiroso (2026-08-07). Estos cuatro tests existen por un fallo REAL: un
 * 403 del CDN de Hotmart le mostraba al usuario "se perdió la conexión a internet" —con el
 * daemon midiendo `internet=true` una línea antes— y encima programaba el auto-heal, que
 * reanudaba, comía el mismo 403 y volvía a pausar cada 12 s.
 *
 * Ojo con lo que afirma el tercero: que un bloqueo **no** saltea. Es lo contrario de lo que uno
 * haría por analogía con la rama 4xx del backend, y el motivo es que un bloqueo es sistémico:
 * saltear iría vaciando la cola de a una clase, en silencio.
 */
describe("clasificación de fallos del PORTAL", () => {
  /** Un motor que rechaza con el error ya tipado, como lo hace `resolverManifiesto`. */
  const motorQueFalla = (extra: Record<string, unknown>) => ({
    descargarYAnalizarIndexM3u8: vi.fn().mockImplementation(() => {
      const e = Object.assign(new Error("[portal] master: HTTP 403"), extra);
      return Promise.reject(e);
    }),
  });

  async function correrCon(extra: Record<string, unknown>) {
    const arnes = montar({ motor: motorQueFalla(extra) });
    await arnes.sesion.set({ rafagaCorriendo: true });
    await arnes.almacenamiento.guardarLocal({
      colaDescargas: [item("Osteologia"), item("Clase 2")],
      listaPersistente: [{ titulo: "Osteologia", estado: "process" }],
    });
    arnes.cola.arrancarSiNoCorre();
    await esperar(120);
    return arnes;
  }

  it('un rechazo del portal saltea SÓLO esa clase y la cola sigue', async () => {
    const { almacenamiento, sesion } = await correrCon({ tipoPortal: "rechazo", httpStatus: 404 });

    const local = almacenamiento._volcar().local as {
      colaDescargas: { titulo: string }[];
      listaPersistente: { titulo: string; estado?: string }[];
    };
    expect(local.colaDescargas.map((c) => c.titulo)).not.toContain("Osteologia");
    expect(local.listaPersistente.find((c) => c.titulo === "Osteologia")?.estado).toBe("pending");
    expect((await sesion.get()).colaPausadaPorError).toBeFalsy();
  });

  it('un bloqueo del portal PAUSA y no dice "internet"', async () => {
    const { sesion } = await correrCon({ tipoPortal: "bloqueo", httpStatus: 403 });

    const estado = await sesion.get();
    expect(estado.colaPausadaPorError).toBe(true);
    expect(estado.tipoDeErrorConexion).toBe("bloqueo");
    // Lo que se rompió y no queremos de vuelta: afirmar una caída de red que el daemon
    // acaba de desmentir.
    expect(estado.tipoDeErrorConexion).not.toBe("internet");
  });

  it("un bloqueo NO saltea la clase: vaciaría la cola entera, de a una", async () => {
    const { almacenamiento } = await correrCon({ tipoPortal: "bloqueo", httpStatus: 403 });

    const local = almacenamiento._volcar().local as { colaDescargas: { titulo: string }[] };
    expect(local.colaDescargas.map((c) => c.titulo)).toContain("Osteologia");
  });

  it("un bloqueo no programa el auto-heal (reintentaría contra el mismo 403 cada 12 s)", async () => {
    const { programador } = await correrCon({ tipoPortal: "bloqueo", httpStatus: 403 });

    expect(programador.estaProgramada("alarma_autoheal")).toBe(false);
  });

  it('un error SIN tipar ya no se llama "internet": se llama "desconocido"', async () => {
    // El daemon dice que todo está bien (es el default del harness), así que se cae a la
    // heurística por mensaje. El mensaje no nombra al backend → antes salía "internet".
    const { sesion } = await correrCon({});

    const estado = await sesion.get();
    expect(estado.tipoDeErrorConexion).toBe("desconocido");
  });

  it('lo desconocido SÍ conserva el auto-heal: puede ser transitorio', async () => {
    const { programador } = await correrCon({});

    expect(programador.estaProgramada("alarma_autoheal")).toBe(true);
  });
});

/**
 * El aviso al popup lleva el PORTAL, no sólo el título. Sin eso el popup no puede sacar la
 * clase de su copia de la cola, y su `respaldar()` reescribe encima de la cola que este bucle
 * acaba de vaciar → el bucle vuelve a tomar la misma clase y la baja para siempre.
 *
 * Medido en el navegador el 2026-08-07 con Anatomy. **En Ramón Net no se veía**: su id es el
 * legado, que es a donde la migración manda un `sitioId` ausente, así que las claves coincidían
 * de casualidad. Ése es el motivo por el que un doble tiene que usar un portal que NO sea el
 * legado — con `"ramonnet"` este test pasaría con el bug puesto.
 */
describe("los avisos al popup llevan el sitioId", () => {
  const mensajes = (m: { notificados: { action?: string }[] }, action: string) =>
    m.notificados.filter((x) => x.action === action);

  it("clase_guardada_ok lo lleva, para que el popup pueda sacarla de su cola", async () => {
    const { cola, almacenamiento, sesion, mensajeria } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Osteologia"), sitioId: "prueba" }],
      listaPersistente: [{ titulo: "Osteologia", estado: "process", sitioId: "prueba" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(150);

    const [aviso] = mensajes(mensajeria as never, "clase_guardada_ok") as { sitioId?: string }[];
    expect(aviso).toBeDefined();
    expect(aviso!.sitioId).toBe("prueba");
  });

  it("clase_con_error también, cuando el portal saltea la clase", async () => {
    const motor = {
      descargarYAnalizarIndexM3u8: vi.fn().mockRejectedValue(
        Object.assign(new Error("[portal] 404"), { tipoPortal: "rechazo", httpStatus: 404 })
      ),
    };
    const { cola, almacenamiento, sesion, mensajeria } = montar({ motor });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Osteologia"), sitioId: "prueba" }],
      listaPersistente: [{ titulo: "Osteologia", estado: "process", sitioId: "prueba" }],
    });

    cola.arrancarSiNoCorre();
    await esperar(150);

    const [aviso] = mensajes(mensajeria as never, "clase_con_error") as { sitioId?: string }[];
    expect(aviso).toBeDefined();
    expect(aviso!.sitioId).toBe("prueba");
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

// [MULTIPORTAL E] El portal del ítem viaja hasta el backend: define la carpeta
// `raíz/<portal>/<materia>/` donde se escribe el archivo, y con qué clave el backend acumula
// los fragmentos. Sin él, dos clases homónimas de portales distintos escriben el mismo archivo.
describe("el portal del ítem viaja al backend", () => {
  it("el contexto de la ráfaga lleva el sitioId del ítem", async () => {
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Clase 1"), sitioId: "prueba" }],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    const contexto = motor.compilarTranscodificacionStream.mock.calls[0]![3] as {
      sitioId?: string;
    };
    expect(contexto.sitioId).toBe("prueba");
  });

  it("un ítem SIN sitioId usa el portal del descriptor migrado, no una carpeta vacía", async () => {
    // El resolvedor migra el ausente al legado, así que el archivo cae en la carpeta de ese
    // portal. Leer `item.sitioId` crudo habría mandado `undefined` y el backend habría escrito
    // en el layout viejo, mezclando lo nuevo con lo de antes.
    const { cola, almacenamiento, sesion, motor } = montar();
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [item("Vieja")],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    const contexto = motor.compilarTranscodificacionStream.mock.calls[0]![3] as {
      sitioId?: string;
    };
    expect(contexto.sitioId).toBe("prueba");
  });

  it("la sesión recuerda el portal en curso, para que el aborto limpie el .part correcto", async () => {
    const { cola, almacenamiento, sesion } = montar({
      motor: {
        compilarTranscodificacionStream: vi.fn(
          () => new Promise(() => {}) // queda colgada: la ráfaga sigue "en curso"
        ),
      },
    });
    await sesion.set({ rafagaCorriendo: true });
    await almacenamiento.guardarLocal({
      colaDescargas: [{ ...item("Clase 1"), sitioId: "prueba" }],
      listaPersistente: [],
    });

    cola.arrancarSiNoCorre();
    await esperar(120);

    expect((await sesion.get()).videoActualSitioId).toBe("prueba");
  });
});
