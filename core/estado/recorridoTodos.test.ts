import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  aplicarEvento,
  esVigente,
  resumen,
  textoResumen,
  enlacesDe,
  esRecorridoTodos,
  crearLectorRecorrido,
  CLAVE_STORAGE,
  type RecorridoTodos,
  type EventoRecorrido,
} from "./recorridoTodos";
import { AlmacenamientoEnMemoria } from "../puertos/almacenamientoEnMemoria";

describe("recorridoTodos — Reductor puro", () => {
  it("secuencia feliz completa: inicio -> latido -> curso -> fin terminado", () => {
    const t0 = 1000;
    const evInicio: EventoRecorrido = {
      tipo: "inicio",
      idRecorrido: 42,
      tabId: 1,
      sitioId: "google-classroom",
      cursos: [
        { id: "c1", nombre: "Física" },
        { id: "c2", nombre: "Química" },
      ],
    };

    let r = aplicarEvento(null, evInicio, t0);
    expect(r).toEqual({
      idRecorrido: 42,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [
        { id: "c1", nombre: "Física" },
        { id: "c2", nombre: "Química" },
      ],
      indice: 0,
      ultimaSenal: t0,
      materializado: false,
    });

    // Latido en curso 0
    const t1 = 2000;
    r = aplicarEvento(r, { tipo: "latido", idRecorrido: 42, indice: 0 }, t1);
    expect(r?.indice).toBe(0);
    expect(r?.ultimaSenal).toBe(t1);

    // Curso 0 ok
    const t2 = 3000;
    r = aplicarEvento(
      r,
      {
        tipo: "curso",
        idRecorrido: 42,
        indice: 0,
        resultado: "ok",
        enlaces: [{ id: "doc1", modulo: "Física › T1" }],
        adjuntosSinResolver: 0,
      },
      t2
    );
    expect(r?.cursos[0]?.resultado).toBe("ok");
    expect(r?.cursos[0]?.enlaces).toHaveLength(1);
    expect(r?.ultimaSenal).toBe(t2);

    // Latido en curso 1
    const t3 = 4000;
    r = aplicarEvento(r, { tipo: "latido", idRecorrido: 42, indice: 1 }, t3);
    expect(r?.indice).toBe(1);

    // Curso 1 vacío
    const t4 = 5000;
    r = aplicarEvento(
      r,
      {
        tipo: "curso",
        idRecorrido: 42,
        indice: 1,
        resultado: "vacio",
      },
      t4
    );
    expect(r?.cursos[1]?.resultado).toBe("vacio");

    // Fin terminado
    const t5 = 6000;
    r = aplicarEvento(r, { tipo: "fin", idRecorrido: 42, estado: "terminado" }, t5);
    expect(r?.estado).toBe("terminado");
    expect(r?.ultimaSenal).toBe(t5);
  });

  it("un rezagado de otro idRecorrido se ignora devolviendo prev", () => {
    const rInicial: RecorridoTodos = {
      idRecorrido: 50,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [{ id: "c1", nombre: "Física" }],
      indice: 0,
      ultimaSenal: 1000,
      materializado: false,
    };

    const rezagado: EventoRecorrido = {
      tipo: "latido",
      idRecorrido: 49,
      indice: 0,
    };

    const res = aplicarEvento(rInicial, rezagado, 2000);
    expect(res).toBe(rInicial);
    expect(res?.ultimaSenal).toBe(1000);
  });

  it("un inicio nuevo pisa a un recorrido terminado (incluso con distinto id)", () => {
    const rTerminado: RecorridoTodos = {
      idRecorrido: 10,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [{ id: "c1", nombre: "Física", resultado: "ok" }],
      indice: 0,
      ultimaSenal: 5000,
      materializado: true,
    };

    const evInicio: EventoRecorrido = {
      tipo: "inicio",
      idRecorrido: 11,
      tabId: 2,
      sitioId: "google-classroom",
      cursos: [{ id: "c2", nombre: "Biología" }],
    };

    const res = aplicarEvento(rTerminado, evInicio, 6000);
    expect(res?.idRecorrido).toBe(11);
    expect(res?.tabId).toBe(2);
    expect(res?.estado).toBe("escaneando");
    expect(res?.cursos).toEqual([{ id: "c2", nombre: "Biología" }]);
    expect(res?.materializado).toBe(false);
    expect(res?.ultimaSenal).toBe(6000);
  });

  it("materializado marca materializado: true y vacía los enlaces de cada curso", () => {
    const rConEnlaces: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [
        {
          id: "c1",
          nombre: "Física",
          resultado: "ok",
          enlaces: [{ id: 1 }, { id: 2 }],
          adjuntosSinResolver: 0,
        },
        { id: "c2", nombre: "Química", resultado: "vacio" },
      ],
      indice: 1,
      ultimaSenal: 1000,
      materializado: false,
    };

    const res = aplicarEvento(rConEnlaces, { tipo: "materializado", idRecorrido: 1 }, 2000);
    expect(res?.materializado).toBe(true);
    expect(res?.ultimaSenal).toBe(2000);
    expect(res?.cursos[0]?.enlaces).toBeUndefined();
    expect(res?.cursos[0]?.resultado).toBe("ok");
    expect(res?.cursos[1]?.enlaces).toBeUndefined();
  });

  it("estado terminal: un curso y un fin terminado después de un fin cortado sin-respuesta no cambian nada", () => {
    const rCortado: RecorridoTodos = {
      idRecorrido: 10,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "cortado",
      motivoCorte: "sin-respuesta",
      cursos: [
        { id: "c1", nombre: "Física", resultado: "ok" },
        { id: "c2", nombre: "Química" },
      ],
      indice: 1,
      ultimaSenal: 5000,
      materializado: false,
    };

    // Evento curso después de corte
    const rTrasCurso = aplicarEvento(
      rCortado,
      {
        tipo: "curso",
        idRecorrido: 10,
        indice: 1,
        resultado: "ok",
        enlaces: [{ id: "x" }],
      },
      6000
    );
    expect(rTrasCurso).toBe(rCortado);
    expect(rTrasCurso?.estado).toBe("cortado");
    expect(rTrasCurso?.cursos[1]?.resultado).toBeUndefined();

    // Evento latido después de corte
    const rTrasLatido = aplicarEvento(
      rCortado,
      { tipo: "latido", idRecorrido: 10, indice: 1 },
      7000
    );
    expect(rTrasLatido).toBe(rCortado);

    // Evento fin terminado después de corte
    const rTrasFin = aplicarEvento(
      rCortado,
      { tipo: "fin", idRecorrido: 10, estado: "terminado" },
      8000
    );
    expect(rTrasFin).toBe(rCortado);
    expect(rTrasFin?.estado).toBe("cortado");
  });

  it("materializado después de fin sí se aplica", () => {
    const rTerminado: RecorridoTodos = {
      idRecorrido: 10,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [
        { id: "c1", nombre: "Física", resultado: "ok", enlaces: [{ id: 1 }] },
      ],
      indice: 0,
      ultimaSenal: 5000,
      materializado: false,
    };

    const res = aplicarEvento(
      rTerminado,
      { tipo: "materializado", idRecorrido: 10 },
      6000
    );
    expect(res?.materializado).toBe(true);
    expect(res?.cursos[0]?.enlaces).toBeUndefined();
    expect(res?.ultimaSenal).toBe(6000);
  });
});

describe("recorridoTodos — esVigente", () => {
  it("si el estado no es 'escaneando', siempre es vigente", () => {
    const rTerminado: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [],
      indice: 0,
      ultimaSenal: 1000,
      materializado: false,
    };
    expect(esVigente(rTerminado, 9999999, 5000)).toBe(true);

    const rCortado: RecorridoTodos = {
      ...rTerminado,
      estado: "cortado",
      motivoCorte: "visibilidad",
    };
    expect(esVigente(rCortado, 9999999, 5000)).toBe(true);
  });

  it("en 'escaneando', es vigente justo en topeCursoMs + 30000, y no en +30001", () => {
    const topeCursoMs = 45000;
    const topeTotal = topeCursoMs + 30000; // 75000
    const ultimaSenal = 100000;
    const r: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [],
      indice: 0,
      ultimaSenal,
      materializado: false,
    };

    expect(esVigente(r, ultimaSenal + topeTotal, topeCursoMs)).toBe(true);
    expect(esVigente(r, ultimaSenal + topeTotal + 1, topeCursoMs)).toBe(false);
  });
});

describe("recorridoTodos — resumen, textoResumen y enlacesDe", () => {
  it("textoResumen de recorrido terminado con fallidos", () => {
    const r: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [
        { id: "c1", nombre: "Física", resultado: "ok" },
        { id: "c2", nombre: "Química", resultado: "ok" },
        { id: "c3", nombre: "Biología", resultado: "vacio" },
        { id: "c4", nombre: "Matemática", resultado: "fallido", motivo: "superó 45 s" },
      ],
      indice: 3,
      ultimaSenal: 1000,
      materializado: false,
    };

    const res = resumen(r);
    expect(res).toEqual({
      total: 4,
      ok: 2,
      vacios: 1,
      fallidos: [{ nombre: "Matemática", motivo: "superó 45 s" }],
      sinRecorrer: 0,
    });

    const texto = textoResumen(r);
    expect(texto).toBe(
      "4 cursos: 2 con material · 1 vacíos · 1 fallidos\n" + "⚠ Matemática: superó 45 s"
    );
  });

  it("textoResumen de recorrido cortado con motivo legible y cursos sin recorrer", () => {
    const r: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "cortado",
      motivoCorte: "visibilidad",
      cursos: [
        { id: "c1", nombre: "Física", resultado: "ok" },
        { id: "c2", nombre: "Química" }, // sin recorrer
        { id: "c3", nombre: "Biología" }, // sin recorrer
      ],
      indice: 0,
      ultimaSenal: 1000,
      materializado: false,
    };

    const texto = textoResumen(r);
    expect(texto).toContain("3 cursos: 1 con material · 0 vacíos · 0 fallidos");
    expect(texto).toContain(
      "Se cortó en el curso 1 de 3: Classroom quedó en segundo plano. Quedaron 2 sin recorrer."
    );
  });

  it("enlacesDe concatena los enlaces de cursos ok en orden y suma adjuntosSinResolver", () => {
    const r: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "terminado",
      cursos: [
        {
          id: "c1",
          nombre: "Física",
          resultado: "ok",
          enlaces: [{ id: "e1" }, { id: "e2" }],
          adjuntosSinResolver: 2,
        },
        { id: "c2", nombre: "Química", resultado: "vacio", adjuntosSinResolver: 0 },
        {
          id: "c3",
          nombre: "Biología",
          resultado: "fallido",
          enlaces: [{ id: "ignorado" }],
          adjuntosSinResolver: 1,
        },
        {
          id: "c4",
          nombre: "Matemática",
          resultado: "ok",
          enlaces: [{ id: "e3" }],
          adjuntosSinResolver: 1,
        },
      ],
      indice: 3,
      ultimaSenal: 1000,
      materializado: false,
    };

    const out = enlacesDe(r);
    expect(out.enlaces).toEqual([{ id: "e1" }, { id: "e2" }, { id: "e3" }]);
    expect(out.adjuntosSinResolver).toBe(4);
  });
});

describe("recorridoTodos — esRecorridoTodos", () => {
  it("valida objeto con la forma correcta", () => {
    const valido: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 2,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [],
      indice: 0,
      ultimaSenal: 1234,
      materializado: false,
    };
    expect(esRecorridoTodos(valido)).toBe(true);
  });

  it("rechaza null, objetos sin cursos o con estado desconocido", () => {
    expect(esRecorridoTodos(null)).toBe(false);
    expect(esRecorridoTodos(undefined)).toBe(false);
    expect(esRecorridoTodos("string")).toBe(false);
    expect(esRecorridoTodos({ idRecorrido: 1 })).toBe(false);
    expect(
      esRecorridoTodos({
        idRecorrido: 1,
        tabId: 2,
        sitioId: "google-classroom",
        estado: "inventado",
        cursos: [],
        indice: 0,
        ultimaSenal: 1234,
        materializado: false,
      })
    ).toBe(false);
    expect(
      esRecorridoTodos({
        idRecorrido: 1,
        tabId: 2,
        sitioId: "google-classroom",
        estado: "escaneando",
        cursos: "no es array",
        indice: 0,
        ultimaSenal: 1234,
        materializado: false,
      })
    ).toBe(false);
  });
});

describe("crearLectorRecorrido con AlmacenamientoEnMemoria", () => {
  let storage: AlmacenamientoEnMemoria;

  beforeEach(() => {
    storage = new AlmacenamientoEnMemoria();
  });

  it("leer() devuelve null si no hay datos o los datos son inválidos", async () => {
    const lector = crearLectorRecorrido(storage);
    expect(await lector.leer()).toBeNull();

    await storage.guardarLocal({ [CLAVE_STORAGE]: { estado: "invalido" } });
    expect(await lector.leer()).toBeNull();
  });

  it("leer() devuelve el objeto si cumple esRecorridoTodos", async () => {
    const lector = crearLectorRecorrido(storage);
    const r: RecorridoTodos = {
      idRecorrido: 10,
      tabId: 2,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [{ id: "c1", nombre: "Física" }],
      indice: 0,
      ultimaSenal: 500,
      materializado: false,
    };
    await storage.guardarLocal({ [CLAVE_STORAGE]: r });

    const leido = await lector.leer();
    expect(leido).toEqual(r);
  });

  it("suscribir() notifica cuando cambia CLAVE_STORAGE en ámbito local", async () => {
    const lector = crearLectorRecorrido(storage);
    const cb = vi.fn();
    const desuscribir = lector.suscribir(cb);

    const r: RecorridoTodos = {
      idRecorrido: 1,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [],
      indice: 0,
      ultimaSenal: 100,
      materializado: false,
    };

    // Cambio en clave ajena: no debe notificar
    await storage.guardarLocal({ otraClave: 123 });
    expect(cb).not.toHaveBeenCalled();

    // Cambio en ámbito sesion: no debe notificar
    await storage.guardarSesion({ [CLAVE_STORAGE]: r });
    expect(cb).not.toHaveBeenCalled();

    // Cambio en ámbito local y clave correcta
    await storage.guardarLocal({ [CLAVE_STORAGE]: r });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(r);

    // Tras desuscribir, no notifica más
    desuscribir();
    await storage.guardarLocal({ [CLAVE_STORAGE]: { ...r, indice: 1 } });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  describe("Loader con progreso y metadata (v1.1.0)", () => {
    const estadoBase: RecorridoTodos = {
      idRecorrido: 100,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [
        { id: "c1", nombre: "Física" },
        { id: "c2", nombre: "Química" },
      ],
      indice: 0,
      ultimaSenal: 1000,
      materializado: false,
    };

    it("progreso con índice correcto se guarda y actualiza ultimaSenal", () => {
      const res = aplicarEvento(
        estadoBase,
        {
          tipo: "progreso",
          idRecorrido: 100,
          indice: 0,
          fase: "trabajo",
          verMas: 0,
          publicaciones: 5,
          archivos: 2,
        },
        2000
      );
      expect(res?.actual).toEqual({
        indice: 0,
        fase: "trabajo",
        verMas: 0,
        publicaciones: 5,
        archivos: 2,
      });
      expect(res?.ultimaSenal).toBe(2000);
    });

    it("progreso con índice viejo se ignora", () => {
      const estadoIndice1: RecorridoTodos = { ...estadoBase, indice: 1 };
      const res = aplicarEvento(
        estadoIndice1,
        {
          tipo: "progreso",
          idRecorrido: 100,
          indice: 0,
          fase: "trabajo",
          verMas: 0,
          publicaciones: 5,
          archivos: 2,
        },
        2000
      );
      expect(res).toBe(estadoIndice1);
      expect(res?.actual).toBeUndefined();
    });

    it("progreso después de fin se ignora", () => {
      const estadoFin: RecorridoTodos = { ...estadoBase, estado: "terminado" };
      const res = aplicarEvento(
        estadoFin,
        {
          tipo: "progreso",
          idRecorrido: 100,
          indice: 0,
          fase: "trabajo",
          verMas: 0,
          publicaciones: 5,
          archivos: 2,
        },
        2000
      );
      expect(res).toBe(estadoFin);
    });

    it("latido y curso limpian actual", () => {
      const conActual: RecorridoTodos = {
        ...estadoBase,
        actual: {
          indice: 0,
          fase: "trabajo",
          verMas: 0,
          publicaciones: 5,
          archivos: 2,
        },
      };

      // Latido limpia actual
      const trasLatido = aplicarEvento(
        conActual,
        { tipo: "latido", idRecorrido: 100, indice: 1 },
        3000
      );
      expect(trasLatido?.actual).toBeUndefined();
      expect(trasLatido?.indice).toBe(1);

      // Curso limpia actual
      const conActualDeNuevo: RecorridoTodos = {
        ...estadoBase,
        actual: {
          indice: 0,
          fase: "novedades",
          verMas: 0,
          publicaciones: 5,
          archivos: 8,
        },
      };
      const trasCurso = aplicarEvento(
        conActualDeNuevo,
        { tipo: "curso", idRecorrido: 100, indice: 0, resultado: "ok" },
        4000
      );
      expect(trasCurso?.actual).toBeUndefined();
    });

    it("inicio con lanzadoEn lo guarda en el estado", () => {
      const res = aplicarEvento(
        null,
        {
          tipo: "inicio",
          idRecorrido: 200,
          tabId: 1,
          sitioId: "google-classroom",
          cursos: [{ id: "c1", nombre: "Física" }],
          lanzadoEn: 12345678,
        },
        1000
      );
      expect(res?.lanzadoEn).toBe(12345678);
    });

    it("curso con duracionMs lo guarda en el curso", () => {
      const res = aplicarEvento(
        estadoBase,
        {
          tipo: "curso",
          idRecorrido: 100,
          indice: 0,
          resultado: "ok",
          duracionMs: 15400,
        },
        5000
      );
      expect(res?.cursos[0]?.duracionMs).toBe(15400);
    });

    it("un estado sin campos nuevos sigue pasando esRecorridoTodos", () => {
      expect(esRecorridoTodos(estadoBase)).toBe(true);
      const conCamposNuevos: RecorridoTodos = {
        ...estadoBase,
        lanzadoEn: 1000,
        actual: {
          indice: 0,
          fase: "ver-mas",
          verMas: 1,
          publicaciones: 10,
          archivos: 4,
        },
        cursos: [{ id: "c1", nombre: "Física", duracionMs: 25000 }],
      };
      expect(esRecorridoTodos(conCamposNuevos)).toBe(true);
    });
  });
});
