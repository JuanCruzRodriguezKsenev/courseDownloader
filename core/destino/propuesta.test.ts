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

  it("carpeta personalizada en curso.carpetas gana sobre la del tema (Plan 08d, D-5)", () => {
    const cursoConCarpeta: CursoIndice = {
      ...cursoBase,
      carpetas: {
        "google-classroom:a2": "Talleres",
      },
    };
    const items = [
      { idArchivo: "a1", original: "05_capacitores.pdf", tema: "Clases Teóricas" },
      { idArchivo: "a2", original: "guia1.pdf", tema: "Guías de TP" },
    ];
    const props = proponerParaCurso({ curso: cursoConCarpeta, items });

    expect(props[0]!.carpeta).toBe("Teorias/Palacio");
    expect(props[1]!.carpeta).toBe("Talleres");
    expect(props[1]!.sinAsignar).toBe(false);
  });

  describe("formas de ítem de Moodle (Plan 09 G-4)", () => {
    it("(a) un tema 'Sin tema' y un ítem sin tema van a la raíz y sinAsignar: false", () => {
      const items = [
        { idArchivo: "m1", original: "programa.pdf", tema: "Sin tema" },
        { idArchivo: "m2", original: "bienvenida.pdf" },
      ];
      const props = proponerParaCurso({ curso: cursoBase, items, sitioId: "moodle-linti" });

      expect(props[0]!.carpeta).toBe(".");
      expect(props[0]!.sinAsignar).toBe(false);

      expect(props[1]!.carpeta).toBe(".");
      expect(props[1]!.sinAsignar).toBe(false);
    });

    it("(b) idArchivo con / y espacios produce clave estable moodle-linti:...", () => {
      const idArchivo = "40881/Tema 1/clase 1.pdf";
      const items = [{ idArchivo, original: "clase 1.pdf", tema: "Clases Teóricas" }];
      const props1 = proponerParaCurso({ curso: cursoBase, items, sitioId: "moodle-linti" });
      const props2 = proponerParaCurso({ curso: cursoBase, items, sitioId: "moodle-linti" });

      expect(props1[0]!.clave).toBe("moodle-linti:40881/Tema 1/clase 1.pdf");
      expect(props2[0]!.clave).toBe("moodle-linti:40881/Tema 1/clase 1.pdf");
      expect(props1[0]!.clave).toBe(props2[0]!.clave);
    });

    it("(c) dos ítems del mismo tema con el mismo original y publicacion distinta reciben sufijos distintos (RN-16)", () => {
      const items = [
        {
          idArchivo: "m1",
          original: "guia.pdf",
          tema: "Guías de TP",
          publicacion: "Semana 1",
        },
        {
          idArchivo: "m2",
          original: "guia.pdf",
          tema: "Guías de TP",
          publicacion: "Semana 2",
        },
      ];
      const props = proponerParaCurso({ curso: cursoBase, items, sitioId: "moodle-linti" });

      expect(props[0]!.nombre).not.toBe(props[1]!.nombre);
      expect(props[0]!.nombre).toBe("guia_semana_1.pdf");
      expect(props[1]!.nombre).toBe("guia_semana_2.pdf");
    });

    it("(d) sitioId: 'moodle-linti' nunca produce claves con google-classroom", () => {
      const items = [
        { idArchivo: "40881/a1", original: "archivo.pdf", tema: "Clases Teóricas" },
      ];
      const props = proponerParaCurso({ curso: cursoBase, items, sitioId: "moodle-linti" });

      expect(props[0]!.clave).not.toContain("google-classroom");
      expect(props[0]!.clave.startsWith("moodle-linti:")).toBe(true);
    });
  });

  describe("resolución de choques en cursos sin asociar (Plan 21, RN-16, RN-16a)", () => {
    it("cinco ítems de Novedades en curso sin asociar reciben nombres distintos e iguales al caso asociado", () => {
      const itemsMC2 = [
        {
          idArchivo: "mc2_0",
          original: "MC2- 2025- 2do cuatrimestre - MC2.pdf",
          tema: "Novedades",
          anuncio: "Notas finales de la materia con el acta cerrada.",
        },
        {
          idArchivo: "mc2_1",
          original: "MC2- 2025- 2do cuatrimestre - MC2 (1).pdf",
          tema: "Novedades",
          anuncio: "Notas del recuperatorio y para les que ya promocionaron.",
        },
        {
          idArchivo: "mc2_2",
          original: "MC2- 2025- 2do cuatrimestre - MC2 (2).pdf",
          tema: "Novedades",
          anuncio: "Notas del parcial y lo que les queda pendiente.",
        },
        {
          idArchivo: "mc2_3",
          original: "MC2- 2025- 2do cuatrimestre - MC2 (3).pdf",
          tema: "Novedades",
          anuncio: "Notas del recuperatorio del primer modulo que rindieron.",
        },
        {
          idArchivo: "mc2_4",
          original: "MC2- 2025- 2do cuatrimestre - MC2 (4).pdf",
          tema: "Novedades",
          anuncio: "Notas del primer parcial mod i corregidas.",
        },
      ];

      const propsSinAsociar = proponerParaCurso({ curso: null, items: itemsMC2 });
      const propsAsociado = proponerParaCurso({ curso: cursoBase, items: itemsMC2 });

      expect(propsSinAsociar).toHaveLength(5);
      const nombresSinAsociar = propsSinAsociar.map((p) => p.nombre);
      const setNombres = new Set(nombresSinAsociar);
      expect(setNombres.size).toBe(5);

      for (let i = 0; i < 5; i++) {
        expect(propsSinAsociar[i]!.carpeta).toBeNull();
        expect(propsSinAsociar[i]!.nombre).toBe(propsAsociado[i]!.nombre);
      }
    });

    it("dos ítems con el mismo anuncio donde el segundo es (1) resuelve residuo con _1", () => {
      const itemsMC3 = [
        {
          idArchivo: "mc3_0",
          original: "MC3_2023.pdf",
          tema: "Novedades",
          anuncio: "Múltiple choice para practicar.",
        },
        {
          idArchivo: "mc3_1",
          original: "MC3_2023 (1).pdf",
          tema: "Novedades",
          anuncio: "Múltiple choice para practicar.",
        },
      ];

      const props = proponerParaCurso({ curso: null, items: itemsMC3 });
      expect(props[0]!.nombre).toBe("multiple_choice_para_practicar.pdf");
      expect(props[1]!.nombre).toBe("multiple_choice_para_practicar_1.pdf");
    });

    it("dos temas distintos del curso sin asociar con el mismo nombre no se tocan", () => {
      const itemsDosTemas = [
        { idArchivo: "t1", original: "programa.pdf", tema: "Teoría" },
        { idArchivo: "t2", original: "programa.pdf", tema: "Práctica" },
      ];
      const props = proponerParaCurso({ curso: null, items: itemsDosTemas });

      expect(props[0]!.nombre).toBe("programa.pdf");
      expect(props[1]!.nombre).toBe("programa.pdf");
      expect(props[0]!.carpeta).toBeNull();
      expect(props[1]!.carpeta).toBeNull();
    });

    it("carpeta === null sólo ocurre en omitidos y en !curso", () => {
      const items = [
        { idArchivo: "norm1", original: "apunte.pdf", tema: "Clases Teóricas" },
        { idArchivo: "raiz1", original: "crono.pdf", tema: "Novedades" },
        { idArchivo: "st1", original: "intro.pdf", tema: "Sin tema" },
        { idArchivo: "omitTema", original: "crono_omit.pdf", tema: "Cronogramas" },
        { idArchivo: "archivo-omitido-1", original: "excluido.pdf", tema: "Guías de TP" },
      ];

      const propsAsociado = proponerParaCurso({ curso: cursoBase, items });
      for (const p of propsAsociado) {
        if (p.omitido) {
          expect(p.carpeta).toBeNull();
        } else {
          expect(p.carpeta).not.toBeNull();
          expect(typeof p.carpeta).toBe("string");
        }
      }

      const propsSinAsociar = proponerParaCurso({ curso: null, items });
      for (const p of propsSinAsociar) {
        expect(p.carpeta).toBeNull();
        expect(p.omitido).toBe(false);
      }
    });
  });

  describe("videollamadas omitidas por defecto (RN-A)", () => {
    const meetId =
      "acceso:" + encodeURIComponent("https://meet.google.com/abc-defg-hij") + ":Clase%20Meet";
    const meetClave = `google-classroom:${meetId}`;

    it("(a) videollamada sin permitir -> omitido: true, carpeta: null, nombre: null", () => {
      const items = [{ idArchivo: meetId, original: "Clase Meet", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: cursoBase, items });
      expect(props[0]!.omitido).toBe(true);
      expect(props[0]!.carpeta).toBeNull();
      expect(props[0]!.nombre).toBeNull();
    });

    it("(b) con su clave en videollamadasPermitidas -> omitido: false", () => {
      const cursoConPermitida: CursoIndice = {
        ...cursoBase,
        videollamadasPermitidas: [meetClave],
      };
      const items = [{ idArchivo: meetId, original: "Clase Meet", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: cursoConPermitida, items });
      expect(props[0]!.omitido).toBe(false);
      expect(props[0]!.carpeta).toBe("Teorias/Palacio");
      expect(props[0]!.nombre).not.toBeNull();
    });

    it("(c) con la clave en archivos (ya descargada) -> no omitida", () => {
      const archivos: Record<string, ArchivoIndice> = {
        [meetClave]: {
          curso: "google-classroom:c1",
          nombre: "clase_meet.md",
          ruta: "Teorias/Palacio/clase_meet.md",
          md5: "md5meet",
          original: "Clase Meet",
        },
      };
      const items = [{ idArchivo: meetId, original: "Clase Meet", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: cursoBase, items, archivos });
      expect(props[0]!.omitido).toBe(false);
      expect(props[0]!.nombre).toBe("clase_meet.md");
    });

    it("(d) un host fuera de lista (youtube.com) -> no omitida", () => {
      const ytId =
        "acceso:" + encodeURIComponent("https://youtube.com/watch?v=123") + ":Video%20YT";
      const items = [{ idArchivo: ytId, original: "Video YT", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: cursoBase, items });
      expect(props[0]!.omitido).toBe(false);
      expect(props[0]!.carpeta).toBe("Teorias/Palacio");
    });

    it("(e) curso null + videollamada -> omitido: true", () => {
      const items = [{ idArchivo: meetId, original: "Clase Meet", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: null, items });
      expect(props[0]!.omitido).toBe(true);
      expect(props[0]!.carpeta).toBeNull();
      expect(props[0]!.nombre).toBeNull();
    });

    it("(f) omitidos explícito gana aunque esté permitida", () => {
      const cursoConAmbos: CursoIndice = {
        ...cursoBase,
        omitidos: [meetClave],
        videollamadasPermitidas: [meetClave],
      };
      const items = [{ idArchivo: meetId, original: "Clase Meet", tema: "Clases Teóricas" }];
      const props = proponerParaCurso({ curso: cursoConAmbos, items });
      expect(props[0]!.omitido).toBe(true);
      expect(props[0]!.carpeta).toBeNull();
      expect(props[0]!.nombre).toBeNull();
    });
  });
});
