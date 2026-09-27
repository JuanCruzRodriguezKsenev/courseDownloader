import { describe, it, expect } from "vitest";
import { buscarChoques, type FilaChoque } from "./choques";

describe("core/destino/choques.ts", () => {
  it("devuelve vacío si no hay filas", () => {
    expect(buscarChoques([])).toEqual([]);
  });

  it("dos claves con igual ruta+nombre y md5 distinto -> un grupo de choque", () => {
    const filas: FilaChoque[] = [
      {
        clave: "google-classroom:1",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "01_intro.pdf",
        md5: "md5_a",
      },
      {
        clave: "google-classroom:2",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "01_intro.pdf",
        md5: "md5_b",
      },
    ];

    const choques = buscarChoques(filas);
    expect(choques).toHaveLength(1);
    expect(choques[0]!.ruta).toBe("Ingenieria/Fisica 2/Teorias");
    expect(choques[0]!.nombre).toBe("01_intro.pdf");
    expect(choques[0]!.filas).toEqual(filas);
  });

  it("filas con igual ruta+nombre y md5 igual no son choque (es PA-2 duplicado)", () => {
    const filas: FilaChoque[] = [
      {
        clave: "google-classroom:1",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "01_intro.pdf",
        md5: "md5_mismo",
      },
      {
        clave: "google-classroom:2",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "01_intro.pdf",
        md5: "md5_mismo",
      },
    ];

    expect(buscarChoques(filas)).toEqual([]);
  });

  it("Foo.pdf vs foo.pdf en la misma ruta genera choque si tienen md5 distinto", () => {
    const filas: FilaChoque[] = [
      {
        clave: "google-classroom:1",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "Foo.pdf",
        md5: "md5_1",
      },
      {
        clave: "google-classroom:2",
        ruta: "Ingenieria/Fisica 2/Teorias",
        nombre: "foo.pdf",
        md5: "md5_2",
      },
    ];

    const choques = buscarChoques(filas);
    expect(choques).toHaveLength(1);
    expect(choques[0]!.filas).toHaveLength(2);
  });
});
