import { describe, it, expect } from "vitest";
import {
  PORTALES_VALIDOS,
  PORTALES_CON_DESTINO_INDICE,
  resolverRaizDeDestino,
} from "./portales.js";

describe("backend/destino/portales.js", () => {
  describe("conjuntos de portales", () => {
    it("PORTALES_VALIDOS contiene los 7 portales soportados", () => {
      expect(PORTALES_VALIDOS.size).toBe(7);
      expect(PORTALES_VALIDOS.has("ramonnet")).toBe(true);
      expect(PORTALES_VALIDOS.has("anatomy-by-chris")).toBe(true);
      expect(PORTALES_VALIDOS.has("google-classroom")).toBe(true);
      expect(PORTALES_VALIDOS.has("moodle-linti")).toBe(true);
      expect(PORTALES_VALIDOS.has("moodle-asignaturas")).toBe(true);
      expect(PORTALES_VALIDOS.has("sites-matec")).toBe(true);
      expect(PORTALES_VALIDOS.has("moodle-ingenieria")).toBe(true);
    });

    it("PORTALES_CON_DESTINO_INDICE contiene los 5 portales con destino por índice", () => {
      expect(PORTALES_CON_DESTINO_INDICE.size).toBe(5);
      expect(PORTALES_CON_DESTINO_INDICE.has("google-classroom")).toBe(true);
      expect(PORTALES_CON_DESTINO_INDICE.has("moodle-linti")).toBe(true);
      expect(PORTALES_CON_DESTINO_INDICE.has("moodle-asignaturas")).toBe(true);
      expect(PORTALES_CON_DESTINO_INDICE.has("sites-matec")).toBe(true);
      expect(PORTALES_CON_DESTINO_INDICE.has("moodle-ingenieria")).toBe(true);
      expect(PORTALES_CON_DESTINO_INDICE.has("ramonnet")).toBe(false);
      expect(PORTALES_CON_DESTINO_INDICE.has("anatomy-by-chris")).toBe(false);
    });
  });

  describe("resolverRaizDeDestino", () => {
    const raizPorDefecto = "/home/user/Downloads/RamonNet_Turbo";
    const raizFacultad = "/home/user/Boveda/Areas/Facultad";

    it("moodle-linti sin raices devuelve raizFacultad", () => {
      const res = resolverRaizDeDestino({
        portalId: "moodle-linti",
        raices: {},
        raizPorDefecto,
        raizFacultad,
      });
      expect(res).toBe(raizFacultad);
    });

    it("moodle-linti con raices configuradas devuelve la ruta personalizada", () => {
      const personalizada = "/home/user/Facultad/LINTI";
      const res = resolverRaizDeDestino({
        portalId: "moodle-linti",
        raices: { "moodle-linti": personalizada },
        raizPorDefecto,
        raizFacultad,
      });
      expect(res).toBe(personalizada);
    });

    it("ramonnet y anatomy-by-chris devuelven raizPorDefecto (no regresion)", () => {
      expect(
        resolverRaizDeDestino({
          portalId: "ramonnet",
          raices: {},
          raizPorDefecto,
          raizFacultad,
        })
      ).toBe(raizPorDefecto);

      expect(
        resolverRaizDeDestino({
          portalId: "anatomy-by-chris",
          raices: {},
          raizPorDefecto,
          raizFacultad,
        })
      ).toBe(raizPorDefecto);
    });

    it("google-classroom devuelve raizFacultad como hoy", () => {
      const res = resolverRaizDeDestino({
        portalId: "google-classroom",
        raices: {},
        raizPorDefecto,
        raizFacultad,
      });
      expect(res).toBe(raizFacultad);
    });

    it("moodle-ingenieria, moodle-asignaturas y sites-matec sin raices devuelven raizFacultad", () => {
      for (const portalId of ["moodle-ingenieria", "moodle-asignaturas", "sites-matec"]) {
        const res = resolverRaizDeDestino({
          portalId,
          raices: {},
          raizPorDefecto,
          raizFacultad,
        });
        expect(res).toBe(raizFacultad);
      }
    });
  });
});
