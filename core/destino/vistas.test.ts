import { describe, it, expect } from "vitest";
import {
  invertirCarpeta,
  indiceAFilasEditor,
  filasEditorAIndice,
} from "./vistas";
import type { VistoCurso } from "./vistas";
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
    });
    expect(invertirCarpeta("Teorias/Rey Grange", "Rey Grange")).toEqual({
      destino: "Teorias",
      editable: true,
    });
    expect(invertirCarpeta("Teorias", "")).toEqual({
      destino: "Teorias",
      editable: true,
    });
    expect(invertirCarpeta("Practicas", "Palacio")).toEqual({
      destino: "Practicas",
      editable: true,
    });
    expect(invertirCarpeta("-", "Palacio")).toEqual({
      destino: "-",
      editable: true,
    });
    // Carpeta editada a mano:
    expect(invertirCarpeta("Parciales/Viejos", "Palacio")).toEqual({
      destino: "Parciales/Viejos",
      editable: false,
    });
    expect(invertirCarpeta("Teorias", "Palacio")).toEqual({
      destino: "Teorias",
      editable: false,
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

  it("V-4: un ítem de videollamada (acceso:<url>:<título>) en vistos aparece en indiceAFilasEditor y con accion 'omitir' se persiste en cursos.<clave>.omitidos (RN-31, RN-32)", () => {
    const idVideollamada = "acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Consulta%20Meet";
    const claveCurso = "google-classroom:c1";
    const claveArchivo = `google-classroom:${idVideollamada}`;

    const vistosConVideollamada: VistoCurso[] = [
      {
        sitio: "google-classroom",
        idCurso: "c1",
        nombre: "Física II G22 2026",
        items: [
          {
            idArchivo: idVideollamada,
            original: "Consulta Meet",
            tema: "Clases Teóricas",
          },
        ],
      },
    ];

    const filas = indiceAFilasEditor({
      indice: indiceEjemplo,
      vistos: vistosConVideollamada,
    });

    const filaVideo = filas.archivos.find((a) => a.clave === claveArchivo);
    expect(filaVideo).toBeDefined();
    expect(filaVideo!.original).toBe("Consulta Meet");

    // Marcar para omitir
    filaVideo!.accion = "omitir";

    const res = filasEditorAIndice({
      indice: indiceEjemplo,
      filas,
      vistos: vistosConVideollamada,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const curso = res.indice.cursos[claveCurso];
    expect(curso).toBeDefined();
    expect(curso!.omitidos).toContain(claveArchivo);
  });
});
