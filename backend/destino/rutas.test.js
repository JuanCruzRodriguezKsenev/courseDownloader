import { describe, it, expect } from "vitest";
import path from "node:path";
import { esRutaBajo } from "./rutas.js";

describe("backend/destino/rutas.js", () => {
  it("acepta una ruta dentro de la raíz común", () => {
    expect(esRutaBajo("/home/usuario/descargas", "/home/usuario/descargas/curso/archivo.mp4")).toBe(true);
  });

  it("acepta la ruta igual a la raíz", () => {
    expect(esRutaBajo("/home/usuario/descargas", "/home/usuario/descargas")).toBe(true);
  });

  it("rechaza traversal hacia afuera con ../", () => {
    expect(esRutaBajo("/home/usuario/descargas", "/home/usuario/descargas/../secreto.txt")).toBe(false);
  });

  it("rechaza hermano con prefijo común (/x/raiz2 contra /x/raiz)", () => {
    expect(esRutaBajo("/x/raiz", "/x/raiz2/archivo.txt")).toBe(false);
  });

  it("maneja raíz con barra final explícita", () => {
    const raizConBarra = `/home/usuario/descargas${path.sep}`;
    expect(esRutaBajo(raizConBarra, `/home/usuario/descargas${path.sep}curso`)).toBe(true);
    expect(esRutaBajo(raizConBarra, `/home/usuario/otro`)).toBe(false);
  });

  it("maneja D:\\ pelada en Windows simulando con path.win32", () => {
    expect(esRutaBajo("D:\\", "D:\\archivo.mp4", path.win32)).toBe(true);
    expect(esRutaBajo("D:\\", "D:\\curso\\archivo.mp4", path.win32)).toBe(true);
    expect(esRutaBajo("D:\\", "D:\\", path.win32)).toBe(true);
    expect(esRutaBajo("D:\\", "C:\\archivo.mp4", path.win32)).toBe(false);
  });

  it("devuelve false si falta raíz o ruta", () => {
    expect(esRutaBajo("", "/algo")).toBe(false);
    expect(esRutaBajo("/algo", "")).toBe(false);
    expect(esRutaBajo(null, "/algo")).toBe(false);
  });
});
