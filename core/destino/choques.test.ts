import { describe, it, expect } from "vitest";
import {
  buscarChoques,
  renombrarChoquesNovedades,
  type FilaChoque,
  type FilaNovedad,
} from "./choques";

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

  describe("renombrarChoquesNovedades (RN-16a)", () => {
    const ruta = "Ingenieria/Matematica C";
    const tema = "Novedades";
    const docente = "Rey Grange";

    it("C1. MC2: 5 filas con anuncios distintos se renombran con su frase", () => {
      const anuncios = [
        "Hola, les comparto las notas del Primer Parcial MOD I.\nLos que estan con verde y tienen nota es porque el mod1 ya lo aprobaron.",
        "Hola, les compartimos las notas del recuperatorio del Primer módulo.\nComo les comente hoy en clase, varies tienen dudoso.",
        "Hola, les compartimos las notas del parcial y lo que les queda del módulo 1 aún",
        "Hola, les compartimos las notas del recuperatorio y para les que ya aprobaron la materia las notas finales.\nIMPORTANTE:",
        "Buenos días,\nles dejamos las notas finales de la materia. Cualquier cosa me escriben.",
      ];
      const originales = [
        "MC2- 2025- 2do cuatrimestre - MC2.pdf",
        "MC2- 2025- 2do cuatrimestre - MC2 (1).pdf",
        "MC2- 2025- 2do cuatrimestre - MC2 (2).pdf",
        "MC2- 2025- 2do cuatrimestre - MC2 (3).pdf",
        "MC2- 2025- 2do cuatrimestre - MC2 (4).pdf",
      ];
      const filas: FilaNovedad[] = originales.map((orig, i) => ({
        clave: `mc2:${i}`,
        ruta,
        nombre: "mc2_2025_2do_cuatrimestre_mc2.pdf",
        md5: `md5_${i}`,
        renombrable: true,
        original: orig,
        anuncio: anuncios[i],
        tema,
        docente,
      }));

      const res = renombrarChoquesNovedades(filas);
      expect(res.size).toBe(5);
      expect(res.get("mc2:0")).toBe("notas_del_primer_parcial_mod_i.pdf");
      expect(res.get("mc2:1")).toBe("notas_del_recuperatorio_del_primer_modulo.pdf");
      expect(res.get("mc2:2")).toBe("notas_del_parcial_y_lo_que_les_queda.pdf");
      expect(res.get("mc2:3")).toBe("notas_del_recuperatorio_y_para_les_que_ya.pdf");
      expect(res.get("mc2:4")).toBe("notas_finales_de_la_materia.pdf");
    });

    it("C2. MC3, mismo anuncio: la fila con (N) lleva _N", () => {
      const filas: FilaNovedad[] = [
        {
          clave: "mc3:1",
          ruta,
          nombre: "mc3.pdf",
          md5: "md5_a",
          renombrable: true,
          original: "MC3_2023 (1).pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
        {
          clave: "mc3:0",
          ruta,
          nombre: "mc3.pdf",
          md5: "md5_b",
          renombrable: true,
          original: "MC3_2023.pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
      ];

      const res = renombrarChoquesNovedades(filas);
      expect(res.size).toBe(2);
      expect(res.get("mc3:1")).toBe("multiple_choice_para_practicar_1.pdf");
      expect(res.get("mc3:0")).toBe("multiple_choice_para_practicar.pdf");
    });

    it("C3. ya-esta no se toca", () => {
      const filas: FilaNovedad[] = [
        {
          clave: "f:ya-esta",
          ruta,
          nombre: "resumen.pdf",
          md5: "md5_1",
          renombrable: false,
          original: "Resumen.pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
        {
          clave: "f:copiar",
          ruta,
          nombre: "resumen.pdf",
          md5: "md5_2",
          renombrable: true,
          original: "Resumen.pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
      ];

      const res = renombrarChoquesNovedades(filas);
      expect(res.size).toBe(1);
      expect(res.get("f:copiar")).toBe("multiple_choice_para_practicar.pdf");
      expect(res.has("f:ya-esta")).toBe(false);
    });

    it("C4. Frase vacía: si no hay frase para renombrar, el Map está vacío", () => {
      const filas: FilaNovedad[] = [
        {
          clave: "f:1",
          ruta,
          nombre: "aviso.pdf",
          md5: "md5_1",
          renombrable: true,
          original: "Aviso.pdf",
          anuncio: "Buenos días,",
          tema,
          docente,
        },
        {
          clave: "f:2",
          ruta,
          nombre: "aviso.pdf",
          md5: "md5_2",
          renombrable: true,
          original: "Aviso.pdf",
          tema,
          docente,
        },
      ];

      const res = renombrarChoquesNovedades(filas);
      expect(res.size).toBe(0);
    });

    it("C5. Sin choque no se renombra", () => {
      const filas: FilaNovedad[] = [
        {
          clave: "f:1",
          ruta,
          nombre: "archivo_a.pdf",
          md5: "md5_1",
          renombrable: true,
          original: "Archivo A.pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
        {
          clave: "f:2",
          ruta,
          nombre: "archivo_b.pdf",
          md5: "md5_2",
          renombrable: true,
          original: "Archivo B.pdf",
          anuncio: "Múltiple choice para practicar",
          tema,
          docente,
        },
      ];

      const res = renombrarChoquesNovedades(filas);
      expect(res.size).toBe(0);
    });
  });
});
