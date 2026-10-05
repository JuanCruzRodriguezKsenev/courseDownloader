import { describe, it, expect } from "vitest";
import {
  invertirCarpeta,
  indiceAFilasEditor,
  filasEditorAIndice,
  esMateriaSintacticamenteSegura,
  normalizarCarpetaOcupacion,
} from "./vistas";
import type { VistoCurso, FilasEditor } from "./vistas";
import { serializarIndice } from "./indice";
import type { Indice } from "./indice";

describe("core/destino/vistas.ts", () => {
  const indiceEjemplo: Indice = {
    version: 1,
    cursos: {
      "google-classroom:c1": {
        nombre: "Física II G22 2026",
        materia: "Ingenieria/Fisica 2",
        docente: "Palacio",
        temas: {
          "Clases Teóricas": "Teorias/Palacio",
          "Guías de TP": "Practicas",
          "Cronogramas": "-",
          "Parciales Viejos": "Parciales/Viejos", // Carpeta editada a mano
        },
        omitidos: ["google-classroom:a_omitido"],
        nombres: {
          "google-classroom:a2": "02_editado_por_duenio.pdf",
        },
      },
    },
    archivos: {
      "google-classroom:a_bajado": {
        curso: "google-classroom:c1",
        nombre: "00_ya_descargado.pdf",
        ruta: "Teorias/Palacio/00_ya_descargado.pdf",
        md5: "d41d8cd98f00b204e9800998ecf8427e",
        original: "Clase 0.pdf",
      },
    },
  };

  const vistosEjemplo: VistoCurso[] = [
    {
      sitio: "google-classroom",
      idCurso: "c1",
      nombre: "Física II G22 2026",
      items: [
        {
          idArchivo: "a_bajado",
          original: "Clase 0.pdf",
          tema: "Clases Teóricas",
        },
        {
          idArchivo: "a2",
          original: "02_capacitores.pdf",
          tema: "Clases Teóricas",
        },
        {
          idArchivo: "a_omitido",
          original: "cronograma.pdf",
          tema: "Cronogramas",
        },
        {
          idArchivo: "a3",
          original: "guia1.pdf",
          tema: "Guías de TP",
        },
        {
          idArchivo: "a4",
          original: "parcial2019.pdf",
          tema: "Parciales Viejos",
        },
      ],
    },
  ];

  it("invertirCarpeta es simétrica con resolverCarpeta", () => {
    expect(invertirCarpeta("Teorias/Palacio", "Palacio")).toEqual({
      destino: "Teorias",
      editable: true,
      subcarpeta: false,
    });
    expect(invertirCarpeta("Teorias/Rey Grange", "Rey Grange")).toEqual({
      destino: "Teorias",
      editable: true,
      subcarpeta: false,
    });
    expect(invertirCarpeta("Teorias", "")).toEqual({
      destino: "Teorias",
      editable: true,
      subcarpeta: false,
    });
    expect(invertirCarpeta("Practicas", "Palacio")).toEqual({
      destino: "Practicas",
      editable: true,
      subcarpeta: false,
    });
    expect(invertirCarpeta("-", "Palacio")).toEqual({
      destino: "-",
      editable: true,
      subcarpeta: false,
    });
    // Carpeta editada a mano:
    expect(invertirCarpeta("Parciales/Viejos", "Palacio")).toEqual({
      destino: "Parciales/Viejos",
      editable: false,
      subcarpeta: false,
    });
    expect(invertirCarpeta("Teorias", "Palacio")).toEqual({
      destino: "Teorias",
      editable: false,
      subcarpeta: false,
    });
  });


  it("ida y vuelta sin cambios deja el índice byte-idéntico", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    const resultado = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(serializarIndice(resultado.indice)).toBe(
      serializarIndice(indiceEjemplo)
    );
  });

  it("asociar un curso nuevo escribe su entrada con los temas resueltos y docente (RN-4)", () => {
    const indiceVacio: Indice = {
      version: 1,
      cursos: {},
      archivos: {},
    };

    const vistosNuevo: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "curso_nuevo",
        nombre: "Química General 2026",
        items: [
          {
            idArchivo: "q1",
            original: "tabla_periodica.pdf",
            tema: "Teoría",
          },
        ],
      },
    ];

    const filas = indiceAFilasEditor({
      indice: indiceVacio,
      vistos: vistosNuevo,
    });

    // Simular que el usuario elige materia y docente en el editor
    filas.cursos[0]!.materia = "Ingenieria/Quimica";
    filas.cursos[0]!.docente = "Gonzalez";
    filas.temas[0]!.destino = "Teorias";
    filas.temas[0]!.subcarpeta = "no";

    const res = filasEditorAIndice({
      indice: indiceVacio,
      filas,
      vistos: vistosNuevo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:curso_nuevo"];
    expect(curso).toBeDefined();
    expect(curso!.materia).toBe("Ingenieria/Quimica");
    expect(curso!.docente).toBe("Gonzalez");
    expect(curso!.temas["Teoría"]).toBe("Teorias/Gonzalez");
  });

  it("con docente vacío las teorías van a Teorias plana", () => {
    const indiceVacio: Indice = {
      version: 1,
      cursos: {},
      archivos: {},
    };

    const vistosNuevo: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "curso_sin_docente",
        nombre: "Álgebra 2026",
        items: [
          {
            idArchivo: "alg1",
            original: "espacios_vectoriales.pdf",
            tema: "Clases Teóricas",
          },
        ],
      },
    ];

    const filas = indiceAFilasEditor({
      indice: indiceVacio,
      vistos: vistosNuevo,
    });

    filas.cursos[0]!.materia = "Ingenieria/Algebra";
    filas.cursos[0]!.docente = "";
    filas.temas[0]!.destino = "Teorias";
    filas.temas[0]!.subcarpeta = "no";


    const res = filasEditorAIndice({
      indice: indiceVacio,
      filas,
      vistos: vistosNuevo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:curso_sin_docente"];
    expect(curso!.temas["Clases Teóricas"]).toBe("Teorias");
  });

  it("AC-8: cambiar el docente de un curso asociado deja todas las entradas de archivos intactas y sólo cambia el destino de los temas", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    // Cambiamos el docente de "Palacio" a "Alonso"
    filas.cursos[0]!.docente = "Alonso";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Los archivos no se tocan en absoluto (AC-8)
    expect(res.indice.archivos).toEqual(indiceEjemplo.archivos);

    // Los temas editables se adaptan al nuevo docente
    const c = res.indice.cursos["google-classroom:c1"]!;
    expect(c.docente).toBe("Alonso");
    expect(c.temas["Clases Teóricas"]).toBe("Teorias/Alonso");
    expect(c.temas["Guías de TP"]).toBe("Practicas");
    expect(c.temas["Cronogramas"]).toBe("-");
    // La carpeta editada a mano se conserva
    expect(c.temas["Parciales Viejos"]).toBe("Parciales/Viejos");
  });

  it("Teorias/Rey Grange (docente con espacio) hace ida y vuelta", () => {
    const indiceConEspacio: Indice = {
      version: 1,
      cursos: {
        "google-classroom:rey": {
          nombre: "Física I 2026",
          materia: "Ingenieria/Fisica 1",
          docente: "Rey Grange",
          temas: {
            "Teoría": "Teorias/Rey Grange",
          },
        },
      },
      archivos: {},
    };

    const vistosRey: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "rey",
        nombre: "Física I 2026",
        items: [{ idArchivo: "f1", original: "cinematica.pdf", tema: "Teoría" }],
      },
    ];

    const filas = indiceAFilasEditor({
      indice: indiceConEspacio,
      vistos: vistosRey,
    });

    expect(filas.temas[0]!.destino).toBe("Teorias");
    expect(filas.temas[0]!.editable).toBe(true);

    const res = filasEditorAIndice({
      indice: indiceConEspacio,
      filas,
      vistos: vistosRey,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.indice.cursos["google-classroom:rey"]!.temas["Teoría"]).toBe(
      "Teorias/Rey Grange"
    );
  });

  it("carpeta editada a mano → no editable y se conserva", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    const temaManual = filas.temas.find((t) => t.tema === "Parciales Viejos");
    expect(temaManual).toBeDefined();
    expect(temaManual!.editable).toBe(false);
    expect(temaManual!.destino).toBe("Parciales/Viejos");

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.indice.cursos["google-classroom:c1"]!.temas["Parciales Viejos"]).toBe(
      "Parciales/Viejos"
    );
  });

  it("cambio de materia de un curso asociado → error (D-4)", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    // Intentar cambiar la materia de un curso ya asociado
    filas.cursos[0]!.materia = "Ingenieria/Matematica D";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errores.some((e) => e.includes("no se puede cambiar la materia"))).toBe(
      true
    );
  });

  it("accion: omitir agrega a omitidos y copiar lo saca (RN-31)", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    // a3 pasa a omitir
    const filaA3 = filas.archivos.find((a) => a.clave === "google-classroom:a3");
    filaA3!.accion = "omitir";

    // a_omitido pasa a copiar
    const filaOmitido = filas.archivos.find(
      (a) => a.clave === "google-classroom:a_omitido"
    );
    filaOmitido!.accion = "copiar";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:c1"]!;
    expect(curso.omitidos).toContain("google-classroom:a3");
    expect(curso.omitidos).not.toContain("google-classroom:a_omitido");
  });

  it("nombre igual a la propuesta no se guarda en nombres", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    // a2 tenía un nombre editado en indiceEjemplo ("02_editado_por_duenio.pdf").
    // Si el usuario lo restaura al propuesto automático ("02_capacitores.pdf"):
    const filaA2 = filas.archivos.find((a) => a.clave === "google-classroom:a2");
    filaA2!.nombre = "02_capacitores.pdf";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:c1"]!;
    expect(curso.nombres).toBeUndefined();
  });

  it("un tema '-' sobrevive", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    const temaCrono = filas.temas.find((t) => t.tema === "Cronogramas");
    expect(temaCrono).toBeDefined();
    expect(temaCrono!.destino).toBe("-");

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.indice.cursos["google-classroom:c1"]!.temas["Cronogramas"]).toBe(
      "-"
    );
  });

  it("carpeta personalizada por archivo se persiste en nuevoCurso.carpetas (D-5)", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    const filaA3 = filas.archivos.find((a) => a.clave === "google-classroom:a3");
    expect(filaA3).toBeDefined();
    filaA3!.destinoPropio = "Talleres";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:c1"]!;
    expect(curso.carpetas).toBeDefined();
    expect(curso.carpetas!["google-classroom:a3"]).toBe("Talleres");
  });

  it("destinoPropio vacío (hereda) no se persiste en nuevoCurso.carpetas (Plan 17)", () => {
    const indiceConCarpetas: Indice = {
      ...indiceEjemplo,
      cursos: {
        ...indiceEjemplo.cursos,
        "google-classroom:c1": {
          ...indiceEjemplo.cursos["google-classroom:c1"]!,
          carpetas: {
            "google-classroom:a3": "Talleres",
          },
        },
      },
    };

    const filas = indiceAFilasEditor({
      indice: indiceConCarpetas,
      vistos: vistosEjemplo,
    });

    const filaA3 = filas.archivos.find((a) => a.clave === "google-classroom:a3");
    expect(filaA3).toBeDefined();
    expect(filaA3!.destinoPropio).toBe("Talleres");

    filaA3!.destinoPropio = "";

    const res = filasEditorAIndice({
      indice: indiceConCarpetas,
      filas,
      vistos: vistosEjemplo,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos["google-classroom:c1"]!;
    expect(curso.carpetas).toBeUndefined();
  });

  it("destino de tema personalizado seguro se acepta y con .. o / se rechaza", () => {
    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosEjemplo,
    });

    // Destino seguro nuevo
    filas.temas[1]!.destino = "Talleres";
    const resOk = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });
    expect(resOk.ok).toBe(true);

    // Destino con ..
    filas.temas[1]!.destino = "../inseguro";
    const resInseguro = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosEjemplo,
    });
    expect(resInseguro.ok).toBe(false);
  });

  it("indiceAFilasEditor propaga cursoIndice.carpetas a arch.carpeta y arch.destinoPropio", () => {
    const indiceConCarpetas: Indice = {
      ...indiceEjemplo,
      cursos: {
        ...indiceEjemplo.cursos,
        "google-classroom:c1": {
          ...indiceEjemplo.cursos["google-classroom:c1"]!,
          carpetas: {
            "google-classroom:a3": "Talleres",
          },
        },
      },
    };

    const filas = indiceAFilasEditor({
      indice: indiceConCarpetas,
      vistos: vistosEjemplo,
    });

    const filaA3 = filas.archivos.find((a) => a.clave === "google-classroom:a3");
    expect(filaA3).toBeDefined();
    expect(filaA3!.carpeta).toBe("Talleres");
    expect(filaA3!.destinoPropio).toBe("Talleres");
  });

  it("esMateriaSintacticamenteSegura valida dos niveles seguros y rechaza inválidos (D-5)", () => {
    expect(esMateriaSintacticamenteSegura("Informatica/Algoritmos")).toBe(true);
    expect(esMateriaSintacticamenteSegura("Ingenieria/Matematica C")).toBe(true);

    expect(esMateriaSintacticamenteSegura("Algoritmos")).toBe(false); // un nivel
    expect(esMateriaSintacticamenteSegura("A/B/C")).toBe(false); // tres niveles
    expect(esMateriaSintacticamenteSegura("A/../B")).toBe(false); // ..
    expect(esMateriaSintacticamenteSegura("/A/B")).toBe(false); // empieza con /
    expect(esMateriaSintacticamenteSegura("A//B")).toBe(false); // parte vacía
    expect(esMateriaSintacticamenteSegura("\t")).toBe(false); // tabulación
    expect(esMateriaSintacticamenteSegura("")).toBe(false);
  });

  it("filasEditorAIndice acepta materia nueva sintácticamente segura aunque no exista en disco (D-5)", () => {
    const indiceVacio: Indice = {
      version: 1,
      cursos: {},
      archivos: {},
    };

    const vistos: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "nuevo",
        nombre: "Algoritmos 2026",
        items: [{ idArchivo: "a1", original: "doc.pdf", tema: "Teoria" }],
      },
    ];

    const filas = indiceAFilasEditor({
      indice: indiceVacio,
      vistos,
    });

    filas.cursos[0]!.materia = "Informatica/Algoritmos";
    filas.cursos[0]!.docente = "Docente";
    filas.temas[0]!.destino = "Teorias";

    const res = filasEditorAIndice({
      indice: indiceVacio,
      filas,
      vistos,
      materiasValidas: new Set(["Ingenieria/Quimica", "Ingenieria/Fisica 1"]),
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.indice.cursos["google-classroom:nuevo"]!.materia).toBe("Informatica/Algoritmos");
  });

  it("filasEditorAIndice rechaza materias inválidas que no existen en disco (D-5)", () => {
    const indiceVacio: Indice = {
      version: 1,
      cursos: {},
      archivos: {},
    };

    const vistos: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "c_invalido",
        nombre: "Curso Prueba",
        items: [],
      },
    ];

    const materiasInvalidas = [
      "Algoritmos",
      "A/B/C",
      "A/../B",
      "/A/B",
      "A//B",
      "   \t  ",
    ];

    for (const mat of materiasInvalidas) {
      const filas = indiceAFilasEditor({
        indice: indiceVacio,
        vistos,
      });
      filas.cursos[0]!.materia = mat;

      const res = filasEditorAIndice({
        indice: indiceVacio,
        filas,
        vistos,
        materiasValidas: new Set(["Ingenieria/Quimica"]),
      });

      expect(res.ok).toBe(false);
      if (res.ok) continue;
      expect(
        res.errores.some((e) => e.includes("inválida") || e.includes("tabulaciones")),
        `debería rechazar materia '${mat}'`
      ).toBe(true);
    }
  });

  describe("Subcarpeta por tema (AC-6..10, RN-12, 13, 15, 17)", () => {
    it("AC-6 — Estado derivado de la carpeta guardada (ambas direcciones)", () => {
      const indiceConSubcarpeta: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Física",
            materia: "Ingenieria/Fisica",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez/Series" },
          },
        },
        archivos: {},
      };
      const vistos1: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Física",
          items: [{ idArchivo: "a1", original: "doc.pdf", tema: "Series" }],
        },
      ];

      const filas1 = indiceAFilasEditor({ indice: indiceConSubcarpeta, vistos: vistos1 });
      const tema1 = filas1.temas.find((t) => t.tema === "Series");
      expect(tema1?.destino).toBe("Teorias");
      expect(tema1?.subcarpeta).toBe("si");

      const indiceSinSubcarpeta: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Física",
            materia: "Ingenieria/Fisica",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez" },
          },
        },
        archivos: {},
      };

      const filas2 = indiceAFilasEditor({ indice: indiceSinSubcarpeta, vistos: vistos1 });
      const tema2 = filas2.temas.find((t) => t.tema === "Series");
      expect(tema2?.destino).toBe("Teorias");
      expect(tema2?.subcarpeta).toBe("no");
    });

    it("AC-7 — Ida y vuelta byte-idéntica con tema guardado como Teorias/Gomez/Series", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Física",
            materia: "Ingenieria/Fisica",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez/Series" },
          },
        },
        archivos: {},
      };
      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Física",
          items: [{ idArchivo: "a1", original: "doc.pdf", tema: "Series" }],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      const res = filasEditorAIndice({ indice, filas, vistos });

      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(serializarIndice(res.indice)).toBe(serializarIndice(indice));
    });

    it("AC-8 — Tema nuevo encendido por defecto", () => {
      const indiceVacio: Indice = { version: 1, cursos: {}, archivos: {} };
      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c_nuevo",
          nombre: "Física",
          items: [{ idArchivo: "a1", original: "doc.pdf", tema: "Series", publicacion: "Clase teórica" }],
        },
      ];

      const filas = indiceAFilasEditor({ indice: indiceVacio, vistos });
      const tema = filas.temas.find((t) => t.tema === "Series");
      expect(tema?.subcarpeta).toBe("si");
    });

    it("AC-9 — Lo descargado no se mueve al encender subcarpeta", () => {
      const claveBajado = "google-classroom:a_bajado";
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Física",
            materia: "Ingenieria/Fisica",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez" },
          },
        },
        archivos: {
          [claveBajado]: {
            curso: "google-classroom:c1",
            nombre: "01_clase.pdf",
            ruta: "Teorias/Gomez/01_clase.pdf",
            md5: "d41d8cd98f00b204e9800998ecf8427e",
            original: "clase.pdf",
          },
        },
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Física",
          items: [
            { idArchivo: "a_bajado", original: "clase.pdf", tema: "Series" },
            { idArchivo: "a_nuevo", original: "nuevo.pdf", tema: "Series" },
          ],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      // El dueño enciende la subcarpeta
      const temaFila = filas.temas.find((t) => t.tema === "Series");
      expect(temaFila).toBeDefined();
      temaFila!.subcarpeta = "si";

      const res = filasEditorAIndice({ indice, filas, vistos });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      // El archivo ya descargado no cambia de ruta ni se altera
      expect(res.indice.archivos[claveBajado]?.ruta).toBe("Teorias/Gomez/01_clase.pdf");
      // El tema ahora apunta a la subcarpeta
      expect(res.indice.cursos["google-classroom:c1"]?.temas["Series"]).toBe("Teorias/Gomez/Series");
      // El archivo nuevo 'copiar' hereda el tema y NO deja override en carpetas
      expect(res.indice.cursos["google-classroom:c1"]?.carpetas).toBeUndefined();
    });

    it("AC-10 — Carpeta propia del archivo no lleva la subcarpeta del tema", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Física",
            materia: "Ingenieria/Fisica",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez/Series" },
          },
        },
        archivos: {},
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Física",
          items: [{ idArchivo: "a1", original: "guia.pdf", tema: "Series" }],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      // Asignar destinoPropio al archivo
      const arch = filas.archivos.find((a) => a.original === "guia.pdf");
      expect(arch).toBeDefined();
      arch!.destinoPropio = "Practicas";

      const res = filasEditorAIndice({ indice, filas, vistos });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"];
      expect(curso?.temas["Series"]).toBe("Teorias/Gomez/Series");
      expect(curso?.carpetas?.["google-classroom:a1"]).toBe("Practicas");
    });

    it("Sonda defecto previo: cambiar destino de tema no deja override sin destinoPropio", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "C",
            materia: "M",
            docente: "Gomez",
            temas: { Series: "Teorias/Gomez" },
          },
        },
        archivos: {},
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "C",
          items: [{ idArchivo: "a", original: "a.pdf", tema: "Series" }],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      // Cambiar destino del tema a Practicas sin subcarpeta
      const tema = filas.temas.find((t) => t.tema === "Series")!;
      tema.destino = "Practicas";
      tema.subcarpeta = "no";
      // El archivo tiene carpeta vieja 'Teorias/Gomez' pero destinoPropio undefined/vacio
      const arch = filas.archivos.find((a) => a.original === "a.pdf")!;
      expect(arch.destinoPropio).toBeUndefined();

      const res = filasEditorAIndice({ indice, filas, vistos, materiasValidas: new Set(["M"]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"]!;
      expect(curso.temas["Series"]).toBe("Practicas");
      expect(curso.carpetas).toBeUndefined();
    });

    it("A7: tema guardado como carpeta a mano no invertible se conserva", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "C",
            materia: "M",
            docente: "Gomez",
            temas: { Series: "Carpetas/Manuales" },
          },
        },
        archivos: {},
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "C",
          items: [{ idArchivo: "a", original: "a.pdf", tema: "Series" }],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      const tema = filas.temas.find((t) => t.tema === "Series")!;
      expect(tema.editable).toBe(false);
      expect(tema.destino).toBe("Carpetas/Manuales");

      const res = filasEditorAIndice({ indice, filas, vistos, materiasValidas: new Set(["M"]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.indice.cursos["google-classroom:c1"]?.temas["Series"]).toBe("Carpetas/Manuales");
    });
  });

  describe("no congelar nombres que chocan al guardar (Plan 21, RN-14)", () => {
    it("(a) guardar un curso cuyas filas traen nombres repetidos en la misma carpeta deja nombres vacío e indice.archivos intacto", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Curso 1",
            materia: "Ingenieria/Matematica C",
            docente: "Rey Grange",
            temas: { Novedades: "." },
          },
        },
        archivos: {
          "google-classroom:ya1": {
            curso: "google-classroom:c1",
            nombre: "ya.pdf",
            ruta: "ya.pdf",
            md5: "abc12345",
            original: "ya.pdf",
          },
        },
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Curso 1",
          items: [
            { idArchivo: "f1", original: "archivo1.pdf", tema: "Novedades" },
            { idArchivo: "f2", original: "archivo2.pdf", tema: "Novedades" },
          ],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      const a1 = filas.archivos.find((a) => a.clave === "google-classroom:f1")!;
      const a2 = filas.archivos.find((a) => a.clave === "google-classroom:f2")!;
      a1.nombre = "repetido.pdf";
      a2.nombre = "repetido.pdf";

      const res = filasEditorAIndice({ indice, filas, vistos, materiasValidas: new Set(["Ingenieria/Matematica C"]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"]!;
      expect(curso.nombres).toBeUndefined();
      expect(res.indice.archivos).toEqual(indice.archivos);
    });

    it("(b) una edición legítima de un nombre que no choca se persiste", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Curso 1",
            materia: "Ingenieria/Matematica C",
            docente: "Rey Grange",
            temas: { Novedades: "." },
          },
        },
        archivos: {},
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Curso 1",
          items: [
            { idArchivo: "f1", original: "archivo1.pdf", tema: "Novedades" },
          ],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      const a1 = filas.archivos.find((a) => a.clave === "google-classroom:f1")!;
      a1.nombre = "edicion_legitima.pdf";

      const res = filasEditorAIndice({ indice, filas, vistos, materiasValidas: new Set(["Ingenieria/Matematica C"]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"]!;
      expect(curso.nombres).toEqual({
        "google-classroom:f1": "edicion_legitima.pdf",
      });
    });

    it("(c) una fila ya-esta con el mismo nombre que una copiar hace que copiar no persista y ya-esta quede intacta", () => {
      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Curso 1",
            materia: "Ingenieria/Matematica C",
            docente: "Rey Grange",
            temas: { Novedades: "." },
          },
        },
        archivos: {
          "google-classroom:ya_descargado": {
            curso: "google-classroom:c1",
            nombre: "ocupado.pdf",
            ruta: "Ingenieria/Matematica C",
            md5: "abc12345",
            original: "ocupado.pdf",
          },
        },
      };

      const vistos: VistoCurso[] = [
        {
          sitio: "google-classroom",
          idCurso: "c1",
          nombre: "Curso 1",
          items: [
            { idArchivo: "ya_descargado", original: "ocupado.pdf", tema: "Novedades" },
            { idArchivo: "nuevo", original: "otro.pdf", tema: "Novedades" },
          ],
        },
      ];

      const filas = indiceAFilasEditor({ indice, vistos });
      const fNuevo = filas.archivos.find((a) => a.clave === "google-classroom:nuevo")!;
      fNuevo.nombre = "ocupado.pdf";

      const res = filasEditorAIndice({ indice, filas, vistos, materiasValidas: new Set(["Ingenieria/Matematica C"]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"]!;
      expect(curso.nombres).toBeUndefined();
      expect(res.indice.archivos).toEqual(indice.archivos);
      expect(res.indice.archivos["google-classroom:ya_descargado"]!.nombre).toBe("ocupado.pdf");
    });

    it("(d) carpeta con prefijo de materia vs sin prefijo se compara bien", () => {
      const materia = "Ingenieria/Matematica C";
      expect(normalizarCarpetaOcupacion("Ingenieria/Matematica C/Novedades", materia)).toBe("Novedades");
      expect(normalizarCarpetaOcupacion("Novedades", materia)).toBe("Novedades");
      expect(normalizarCarpetaOcupacion("Ingenieria/Matematica C", materia)).toBe(".");
      expect(normalizarCarpetaOcupacion(".", materia)).toBe(".");
      expect(normalizarCarpetaOcupacion("", materia)).toBe(".");
      expect(normalizarCarpetaOcupacion("Teorias/Rey Grange/", materia)).toBe("Teorias/Rey Grange");
      expect(normalizarCarpetaOcupacion("Ingenieria/Matematica C/Teorias/Rey Grange/", materia)).toBe("Teorias/Rey Grange");

      const indice: Indice = {
        version: 1,
        cursos: {
          "google-classroom:c1": {
            nombre: "Curso 1",
            materia,
            docente: "Rey Grange",
            temas: { Teoria: "Teorias" },
          },
        },
        archivos: {
          "google-classroom:arch_ya": {
            curso: "google-classroom:c1",
            nombre: "colision.pdf",
            ruta: "Teorias/colision.pdf",
            md5: "abc12345",
            original: "colision.pdf",
          },
        },
      };

      const filas: FilasEditor = {
        cursos: [
          {
            clave_curso: "google-classroom:c1",
            nombre: "Curso 1",
            carpeta: materia,
            materia,
            docente: "Rey Grange",
            items: "2",
          },
        ],
        temas: [
          {
            clave_curso: "google-classroom:c1",
            tema: "Teoria",
            destino: "Teorias",
            regla: "no",
            items: "2",
            editable: true,
          },
        ],
        archivos: [
          {
            clave: "google-classroom:arch_ya",
            clave_curso: "google-classroom:c1",
            tema: "Teoria",
            original: "colision.pdf",
            nombre: "colision.pdf",
            carpeta: "Ingenieria/Matematica C/Teorias",
            accion: "ya-esta" as const,
            origen: "",
            md5: "abc12345",
          },
          {
            clave: "google-classroom:arch_copiar",
            clave_curso: "google-classroom:c1",
            tema: "Teoria",
            original: "otro.pdf",
            nombre: "colision.pdf",
            carpeta: "Teorias",
            accion: "copiar" as const,
            origen: "",
            md5: "",
          },
        ],
      };

      const res = filasEditorAIndice({ indice, filas, vistos: [], materiasValidas: new Set([materia]) });
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const curso = res.indice.cursos["google-classroom:c1"]!;
      expect(curso.nombres).toBeUndefined();
    });
  });
});

