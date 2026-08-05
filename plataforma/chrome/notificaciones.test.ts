/**
 * Tests del adaptador de notificaciones nativas.
 *
 * El foco es el `notificationId` como CANAL DE DATOS (corte 8): el `sitioId` del ítem que
 * falló viaja adentro del id porque el service worker se suspende y se lleva cualquier mapa en
 * memoria, mientras la notificación sigue en pantalla esperando el click. Eso convierte al
 * formato del id en un contrato entre este módulo y `plataforma/composicion.ts`, y un contrato
 * sin test es un contrato que se rompe en el próximo refactor.
 *
 * Lo que NO se prueba acá es a qué pestaña lleva el click: eso es del service worker y vive en
 * `background.test.js`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notificarFallo, sitioIdDeNotificacion } from "./notificaciones";

/** Captura el `notificationId` con el que se creó la notificación. */
let idsCreados: string[] = [];

beforeEach(() => {
  idsCreados = [];
  (globalThis as Record<string, unknown>).chrome = {
    notifications: {
      create: (id: string) => { idsCreados.push(id); },
    },
    runtime: { getURL: (p: string) => p, lastError: null },
  };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).chrome;
});

describe("el sitioId viaja en el notificationId", () => {
  it("ida y vuelta: lo que se emite se puede volver a leer", () => {
    notificarFallo("rechazo", "Clase 1", "motivo", "ramonnet");

    expect(idsCreados).toHaveLength(1);
    expect(sitioIdDeNotificacion(idsCreados[0]!)).toBe("ramonnet");
  });

  it("dos fallos del mismo portal generan ids DISTINTOS (se apilan, no se reemplazan)", () => {
    // Era la razón por la que el id era "" y lo generaba Chrome. Al pasar a un id propio, la
    // unicidad hay que ponerla a mano o el segundo aviso pisa al primero.
    notificarFallo("rechazo", "Clase 1", "motivo", "ramonnet");
    notificarFallo("rechazo", "Clase 2", "motivo", "ramonnet");

    expect(idsCreados[0]).not.toBe(idsCreados[1]);
    expect(sitioIdDeNotificacion(idsCreados[0]!)).toBe("ramonnet");
    expect(sitioIdDeNotificacion(idsCreados[1]!)).toBe("ramonnet");
  });

  it("un sitioId con el separador adentro sobrevive al round-trip", () => {
    // Hoy los ids son slugs, pero el contrato de PuertoSitio no lo exige: si alguna vez uno
    // trae un "|", el parseo no se tiene que partir en silencio.
    notificarFallo("rechazo", "Clase 1", "motivo", "raro|con|barras");

    expect(sitioIdDeNotificacion(idsCreados[0]!)).toBe("raro|con|barras");
  });

  it("sin sitioId, el id se emite igual y se lee como 'sin portal anotado'", () => {
    notificarFallo("rechazo", "Clase 1", "motivo");

    expect(idsCreados).toHaveLength(1);
    expect(sitioIdDeNotificacion(idsCreados[0]!)).toBeUndefined();
  });
});

describe("sitioIdDeNotificacion: los dos 'sin portal' y el que sí es un portal", () => {
  it("un id anterior al corte 8 (autogenerado por Chrome) es 'sin portal anotado'", () => {
    // Puede seguir en pantalla tras recargar la extensión. Devolver undefined es lo que hace
    // que el resolvedor compartido lo migre al portal legado, como cualquier dato viejo.
    expect(sitioIdDeNotificacion("A1B2C3D4-E5F6")).toBeUndefined();
  });

  it("un id ilegible no propaga: es 'sin portal anotado'", () => {
    // decodeURIComponent tira ante un porcentaje suelto. Este módulo nunca propaga.
    expect(sitioIdDeNotificacion("fallo|%E0%A4%A|123")).toBeUndefined();
  });

  it("un portal desconocido sale TAL CUAL, para que el resolvedor lo rechace", () => {
    // La distinción que no se puede colapsar acá (la trampa del corte 3): ausente = dato
    // viejo que migra; presente y desconocido = huérfano que NO debe resolver. Si este caso
    // devolviera undefined, un ítem huérfano abriría el portal legado — el bug de vuelta.
    notificarFallo("rechazo", "Clase 1", "motivo", "portal-que-ya-no-existe");

    expect(sitioIdDeNotificacion(idsCreados[0]!)).toBe("portal-que-ya-no-existe");
  });
});

describe("nunca propaga (la regresión v5.10.0)", () => {
  it("sin chrome.notifications no tira: avisar de un fallo no puede causar otro", () => {
    (globalThis as Record<string, unknown>).chrome = {};

    expect(() => notificarFallo("rechazo", "Clase 1", "motivo", "ramonnet")).not.toThrow();
  });
});
