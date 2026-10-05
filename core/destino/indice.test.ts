import { describe, it, expect } from "vitest";
import {
  NOMBRE_INDICE,
  claveCurso,
  claveArchivo,
  parsearIndice,
  serializarIndice,
  type Indice,
} from "./indice";

describe("core/destino/indice.ts", () => {
  it("NOMBRE_INDICE es .course-downloader.json", () => {
    expect(NOMBRE_INDICE).toBe(".course-downloader.json");
  });

  it("claveCurso y claveArchivo unen con ':' sin escapar", () => {
    expect(claveCurso("google-classroom", "12345")).toBe("google-classroom:12345");
    expect(claveArchivo("google-classroom", "acceso:https://x:T")).toBe(
      "google-classroom:acceso:https://x:T"
    );
  });

  it("ida y vuelta serializar -> parsear sin cambios", () => {
    const indiceOriginal: Indice = {
      version: 1,
      cursos: {
        "google-classroom:CURSO1": {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: {
            "Clases Teóricas": "Teorias/Palacio",
          },
        },
      },
      archivos: {
        "google-classroom:FILE1": {
          curso: "google-classroom:CURSO1",
          nombre: "05_capacitores.pdf",
          ruta: "Ingenieria/Fisica 2/Teorias/Palacio",
          md5: "abc123md5",
          original: "Clase 5.pdf",
        },
      },
    };

    const texto = serializarIndice(indiceOriginal);
    const parseado = parsearIndice(texto);

    expect(parseado.ok).toBe(true);
    if (parseado.ok) {
      expect(parseado.indice).toEqual(indiceOriginal);
    }
  });

  it("ida y vuelta serializar -> parsear conserva videollamadasPermitidas", () => {
    const indiceOriginal: Indice = {
      version: 1,
      cursos: {
        "google-classroom:CURSO1": {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: {},
          videollamadasPermitidas: [
            "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Clase%20Meet",
          ],
        },
      },
      archivos: {},
    };

    const texto = serializarIndice(indiceOriginal);
    const parseado = parsearIndice(texto);

    expect(parseado.ok).toBe(true);
    if (parseado.ok) {
      expect(parseado.indice).toEqual(indiceOriginal);
      expect(parseado.indice.cursos["google-classroom:CURSO1"]?.videollamadasPermitidas).toEqual([
        "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Clase%20Meet",
      ]);
    }
  });

  it("serializarIndice emite claves ordenadas de cursos y archivos con salto de línea al final", () => {
    const indice: Indice = {
      version: 1,
      cursos: {
        "google-classroom:Z": {
          nombre: "Z",
          materia: "Mat Z",
          docente: "Prof Z",
          temas: {},
        },
        "google-classroom:A": {
          nombre: "A",
          materia: "Mat A",
          docente: "Prof A",
          temas: {},
        },
      },
      archivos: {
        "google-classroom:B": {
          curso: "google-classroom:A",
          nombre: "b.pdf",
          ruta: "Mat A",
          md5: "md5b",
          original: "b.pdf",
        },
        "google-classroom:A": {
          curso: "google-classroom:A",
          nombre: "a.pdf",
          ruta: "Mat A",
          md5: "md5a",
          original: "a.pdf",
        },
      },
    };

    const json = serializarIndice(indice);
    expect(json.endsWith("\n")).toBe(true);

    const matchCursos = json.indexOf('"google-classroom:A"');
    const matchCursosZ = json.indexOf('"google-classroom:Z"');
    expect(matchCursos).toBeLessThan(matchCursosZ);

    const parsedKeys = Object.keys(JSON.parse(json).archivos);
    expect(parsedKeys).toEqual(["google-classroom:A", "google-classroom:B"]);
  });

  it("parsearIndice devuelve error ante JSON roto", () => {
    const res = parsearIndice("{ version: 1, cursos: ");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeDefined();
      expect(res.error.length).toBeGreaterThan(0);
    }
  });

  it("parsearIndice rechaza versión distinta de 1", () => {
    const res = parsearIndice(JSON.stringify({ version: 2, cursos: {}, archivos: {} }));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("2");
    }
  });

  it("parsearIndice rechaza si cursos o archivos no son objetos", () => {
    expect(parsearIndice(JSON.stringify({ version: 1, cursos: [], archivos: {} })).ok).toBe(false);
    expect(parsearIndice(JSON.stringify({ version: 1, cursos: {}, archivos: null })).ok).toBe(false);
  });
});
