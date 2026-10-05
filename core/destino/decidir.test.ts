import { describe, it, expect } from "vitest";
import { decidirAntes, decidirDespues } from "./decidir";

describe("core/destino/decidir.ts", () => {
  describe("decidirAntes", () => {
    it("fila 0: destino .md existente -> anotar-existente fila 0", () => {
      const res = decidirAntes({
        destinoMdExiste: true,
        enIndice: false,
        esAcceso: false,
        estaEnRutaAnotada: false,
      });
      expect(res).toEqual({ accion: "anotar-existente", fila: "0" });
    });

    it("fila 0b: en índice y es acceso -> no-bajar fila 0b", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: true,
        esAcceso: true,
        estaEnRutaAnotada: false,
        md5EncontradoEnRaiz: null,
      });
      expect(res).toEqual({ accion: "no-bajar", fila: "0b" });
    });

    it("fila 1: en índice y en ruta anotada -> no-bajar fila 1", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: true,
        esAcceso: false,
        estaEnRutaAnotada: true,
      });
      expect(res).toEqual({ accion: "no-bajar", fila: "1" });
    });

    it("fila 2: en índice, no en ruta, md5 encontrado en raíz -> corregir-ruta fila 2", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: true,
        esAcceso: false,
        estaEnRutaAnotada: false,
        md5EncontradoEnRaiz: "Ingenieria/Fisica 1/Teorias/otro.pdf",
      });
      expect(res).toEqual({ accion: "corregir-ruta", fila: "2" });
    });

    it("fila 3: en índice, no en ruta, md5 no encontrado -> bajar fila 3", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: true,
        esAcceso: false,
        estaEnRutaAnotada: false,
        md5EncontradoEnRaiz: null,
      });
      expect(res).toEqual({ accion: "bajar", fila: "3" });
    });

    it("fila 4: no en índice -> bajar fila 4", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: false,
        esAcceso: false,
        estaEnRutaAnotada: false,
      });
      expect(res).toEqual({ accion: "bajar", fila: "4" });
    });

    it("orden: un .md editado con id en el índice cae en 0 y no en 2 o 3 (RN-30)", () => {
      const res = decidirAntes({
        destinoMdExiste: true,
        enIndice: true,
        esAcceso: false,
        estaEnRutaAnotada: false,
        md5EncontradoEnRaiz: null,
      });
      expect(res).toEqual({ accion: "anotar-existente", fila: "0" });
    });

    it("orden: un acceso movido cae en 0b y no en 3 (RN-29a)", () => {
      const res = decidirAntes({
        destinoMdExiste: false,
        enIndice: true,
        esAcceso: true,
        estaEnRutaAnotada: false,
        md5EncontradoEnRaiz: null,
      });
      expect(res).toEqual({ accion: "no-bajar", fila: "0b" });
    });
  });

  describe("decidirDespues", () => {
    it("fila 0: destino es .md y existe en destino -> no-escribir", () => {
      const res = decidirDespues({
        destinoEsMd: true,
        existeDestino: true,
        md5ExisteEnCarpetaDestino: false,
      });
      expect(res).toBe("no-escribir");
    });

    it("fila 5: md5 existe en carpeta destino -> descartar", () => {
      const res = decidirDespues({
        destinoEsMd: false,
        existeDestino: false,
        md5ExisteEnCarpetaDestino: true,
      });
      expect(res).toBe("descartar");
    });

    it("fila 6: no existe destino ni md5 en carpeta -> escribir", () => {
      const res = decidirDespues({
        destinoEsMd: false,
        existeDestino: false,
        md5ExisteEnCarpetaDestino: false,
      });
      expect(res).toBe("escribir");
    });

    it("rechazar: destino ocupado con otro contenido (D-7)", () => {
      const res = decidirDespues({
        destinoEsMd: false,
        existeDestino: true,
        md5ExisteEnCarpetaDestino: false,
        existeDestinoConOtroContenido: true,
      });
      expect(res).toBe("rechazar");
    });

    it("orden: un .md existente con md5 distinto no cae en 5 ni en rechazar", () => {
      const res = decidirDespues({
        destinoEsMd: true,
        existeDestino: true,
        md5ExisteEnCarpetaDestino: false,
        existeDestinoConOtroContenido: true,
      });
      expect(res).toBe("no-escribir");
    });

    it("fila 5b: md5 existe en raíz -> descartar (RN-5)", () => {
      const res = decidirDespues({
        destinoEsMd: false,
        existeDestino: false,
        md5ExisteEnCarpetaDestino: false,
        md5ExisteEnRaiz: true,
      });
      expect(res).toBe("descartar");
    });

    it("orden (AC-10): destino ocupado pero md5 en raíz -> descartar sin error (descartar antes que rechazar)", () => {
      const res = decidirDespues({
        destinoEsMd: false,
        existeDestino: true,
        md5ExisteEnCarpetaDestino: false,
        md5ExisteEnRaiz: true,
        existeDestinoConOtroContenido: true,
      });
      expect(res).toBe("descartar");
    });
  });
});
