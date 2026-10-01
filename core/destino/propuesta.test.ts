import { describe, it, expect } from "vitest";
import { proponerParaCurso } from "./propuesta";
import type { CursoIndice, ArchivoIndice } from "./indice";

describe("core/destino/propuesta.ts", () => {
  const cursoBase: CursoIndice = {
    nombre: "Física II G22 2026",
    materia: "Ingenieria/Fisica 2",
    docente: "Palacio",
    temas: {
      "Clases Teóricas": "Teorias/Palacio",
      "Guías de TP": "Practicas",
      "Cronogramas": "-",
    },
    omitidos: ["google-classroom:archivo-omitido-1"],
  };

  it("tema conocido asigna la carpeta del mapeo y sinAsignar = false", () => {
    const items = [
      { idArchivo: "a1", original: "05_capacitores.pdf", tema: "Clases Teóricas" },
      { idArchivo: "a2", original: "guia1.pdf", tema: "Guías de TP" },
    ];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.carpeta).toBe("Teorias/Palacio");
    expect(props[0]!.sinAsignar).toBe(false);
    expect(props[0]!.omitido).toBe(false);
    expect(props[0]!.nombre).toMatch(/\.pdf$/);

    expect(props[1]!.carpeta).toBe("Practicas");
    expect(props[1]!.sinAsignar).toBe(false);
    expect(props[1]!.omitido).toBe(false);
  });

  it("tema '-' y clave en omitidos -> omitido: true sin carpeta ni nombre (D-7)", () => {
    const items = [
      { idArchivo: "crono1", original: "cronograma_semana1.pdf", tema: "Cronogramas" },
      { idArchivo: "archivo-omitido-1", original: "formulario.md", tema: "Guías de TP" },
    ];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.omitido).toBe(true);
    expect(props[0]!.carpeta).toBeNull();
    expect(props[0]!.nombre).toBeNull();

    expect(props[1]!.omitido).toBe(true);
    expect(props[1]!.carpeta).toBeNull();
    expect(props[1]!.nombre).toBeNull();
  });

  it("tema nuevo va a la raíz de la materia y sinAsignar = true (AC-9)", () => {
    const items = [{ idArchivo: "tn1", original: "guia13.pdf", tema: "Guía de TP Nº 13" }];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.carpeta).toBe(".");
    expect(props[0]!.sinAsignar).toBe(true);
    expect(props[0]!.omitido).toBe(false);
  });

  it("Novedades y Sin tema van a la raíz de la materia sin marca de sinAsignar (RN-8)", () => {
    const items = [
      { idArchivo: "nov1", original: "aviso.pdf", tema: "Novedades" },
      { idArchivo: "st1", original: "general.pdf", tema: "Sin tema" },
    ];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.carpeta).toBe(".");
    expect(props[0]!.sinAsignar).toBe(false);

    expect(props[1]!.carpeta).toBe(".");
    expect(props[1]!.sinAsignar).toBe(false);
  });

  it("nombre del índice gana sobre la propuesta (RN-14, AC-4)", () => {
    const archivos: Record<string, ArchivoIndice> = {
      "google-classroom:a1": {
        curso: "google-classroom:c1",
        nombre: "10_circuitos_transitorios.pdf",
        ruta: "Teorias/Palacio/10_circuitos_transitorios.pdf",
        md5: "abc",
        original: "P10.- Circuitos.pdf",
      },
    };

    const items = [{ idArchivo: "a1", original: "P10.- Circuitos.pdf", tema: "Clases Teóricas" }];
    const props = proponerParaCurso({ curso: cursoBase, items, archivos });

    expect(props[0]!.nombre).toBe("10_circuitos_transitorios.pdf");
  });

  it("choque entre dos ítems nuevos en la misma carpeta lleva sufijo de material (RN-16)", () => {
    const items = [
      {
        idArchivo: "doc1",
        original: "plantilla.docx",
        tema: "Guías de TP",
        publicacion: "Laboratorio 1",
      },
      {
        idArchivo: "doc2",
        original: "plantilla.docx",
        tema: "Guías de TP",
        publicacion: "Laboratorio 2",
      },
    ];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.nombre).toBe("plantilla_laboratorio_1.docx");
    expect(props[1]!.nombre).toBe("plantilla_laboratorio_2.docx");
  });

  it("choque de Novedades se resuelve con la primera frase del anuncio (RN-16a)", () => {
    const items = [
      {
        idArchivo: "n1",
        original: "parcial.pdf",
        tema: "Novedades",
        anuncio: "Hola a todos, les dejamos las notas del primer parcial con recuperatorio.",
      },
      {
        idArchivo: "n2",
        original: "parcial.pdf",
        tema: "Novedades",
        anuncio: "Buenas tardes, adjunto la distribución de aulas para rendir mañana.",
      },
    ];
    const props = proponerParaCurso({ curso: cursoBase, items });

    expect(props[0]!.nombre).not.toBe(props[1]!.nombre);
    expect(props[0]!.nombre).toContain("notas_del_primer_parcial");
    expect(props[1]!.nombre).toContain("distribucion_de_aulas");
  });

  it("nombre del dueño en curso.nombres gana sobre la propuesta (D-3, RN-14)", () => {
    const cursoConNombres: CursoIndice = {
      ...cursoBase,
      nombres: {
        "google-classroom:a1": "05_capacitores_editado_por_duenio.pdf",
      },
    };
    const items = [
      { idArchivo: "a1", original: "05_capacitores.pdf", tema: "Clases Teóricas" },
    ];
    const props = proponerParaCurso({ curso: cursoConNombres, items });

    expect(props[0]!.nombre).toBe("05_capacitores_editado_por_duenio.pdf");
  });

  it("archivo ya bajado gana sobre curso.nombres y sobre la propuesta (D-3)", () => {
    const cursoConNombres: CursoIndice = {
      ...cursoBase,
      nombres: {
        "google-classroom:a1": "nombre_en_nombres.pdf",
      },
    };
    const archivos: Record<string, ArchivoIndice> = {
      "google-classroom:a1": {
        curso: "google-classroom:c1",
        nombre: "nombre_ya_bajado.pdf",
        ruta: "Teorias/Palacio/nombre_ya_bajado.pdf",
        md5: "abc",
        original: "05_capacitores.pdf",
      },
    };
    const items = [
      { idArchivo: "a1", original: "05_capacitores.pdf", tema: "Clases Teóricas" },
    ];
    const props = proponerParaCurso({ curso: cursoConNombres, items, archivos });

    expect(props[0]!.nombre).toBe("nombre_ya_bajado.pdf");
  });

  it("nombre del dueño no se renombra ante choques (el nombre es final)", () => {
    const cursoConNombres: CursoIndice = {
      ...cursoBase,
      nombres: {
        "google-classroom:doc1": "plantilla.docx",
      },
    };
    const items = [
      {
        idArchivo: "doc1",
        original: "plantilla.docx",
        tema: "Guías de TP",
        publicacion: "Laboratorio 1",
      },
      {
        idArchivo: "doc2",
        original: "plantilla.docx",
        tema: "Guías de TP",
        publicacion: "Laboratorio 2",
      },
    ];
    const props = proponerParaCurso({ curso: cursoConNombres, items });

    expect(props[0]!.nombre).toBe("plantilla.docx");
    expect(props[1]!.nombre).toBe("plantilla_laboratorio_2.docx");
  });

  it("curso sin asociar devuelve carpeta: null (RN-2)", () => {
    const items = [{ idArchivo: "x1", original: "clase.pdf", tema: "Tema 1" }];
    const props = proponerParaCurso({ curso: null, items });

    expect(props[0]!.carpeta).toBeNull();
    expect(props[0]!.sinAsignar).toBe(false);
    expect(props[0]!.omitido).toBe(false);
    expect(props[0]!.nombre).toMatch(/\.pdf$/);
  });
});
