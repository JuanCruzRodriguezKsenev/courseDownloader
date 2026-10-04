import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { leerIndice, modificarIndice, ErrorIndiceIlegible } from "./indiceServicio.js";
import { NOMBRE_INDICE } from "../../core/destino/indice.ts";

describe("backend/destino/indiceServicio.js", () => {
  let raiz = "";

  beforeEach(async () => {
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-indice-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (raiz) await fs.rm(raiz, { recursive: true, force: true }).catch(() => {});
  });

  it("inexistente -> devuelve estructura vacía y no crea el archivo en disco (D-5)", async () => {
    const indice = await leerIndice(raiz);
    expect(indice).toEqual({
      version: 1,
      cursos: {},
      archivos: {},
    });
    const existe = fsSync.existsSync(path.join(raiz, NOMBRE_INDICE));
    expect(existe).toBe(false);
  });

  it("JSON inválido -> lanza ErrorIndiceIlegible y el archivo queda byte-idéntico (RN-25, AC-7)", async () => {
    const rutaArchivo = path.join(raiz, NOMBRE_INDICE);
    const contenidoCorrupto = "{ version: 1, cursos: [CORRUPTO!!";
    await fs.writeFile(rutaArchivo, contenidoCorrupto, "utf8");

    await expect(leerIndice(raiz)).rejects.toThrow(ErrorIndiceIlegible);
    await expect(leerIndice(raiz)).rejects.toHaveProperty("mensaje");

    await expect(
      modificarIndice(raiz, (ind) => {
        ind.cursos["nuevo"] = { nombre: "X", materia: "M", docente: "D", temas: {} };
      })
    ).rejects.toThrow(ErrorIndiceIlegible);

    const enDisco = await fs.readFile(rutaArchivo, "utf8");
    expect(enDisco).toBe(contenidoCorrupto);
  });

  it("dos modificarIndice concurrentes se aplican ambos bajo el candado por raíz (D-6)", async () => {
    const prom1 = modificarIndice(raiz, (ind) => {
      ind.cursos["curso:1"] = {
        nombre: "Curso 1",
        materia: "Materia 1",
        docente: "Docente 1",
        temas: { Tema1: "Teorias" },
      };
    });

    const prom2 = modificarIndice(raiz, (ind) => {
      ind.cursos["curso:2"] = {
        nombre: "Curso 2",
        materia: "Materia 2",
        docente: "Docente 2",
        temas: { Tema2: "Practicas" },
      };
    });

    await Promise.all([prom1, prom2]);

    const final = await leerIndice(raiz);
    expect(final.cursos["curso:1"]).toBeDefined();
    expect(final.cursos["curso:2"]).toBeDefined();
    expect(final.cursos["curso:1"].nombre).toBe("Curso 1");
    expect(final.cursos["curso:2"].nombre).toBe("Curso 2");
  });

  it("si el archivo cambió a mano entre dos modificaciones, la segunda ve el cambio (RN-26)", async () => {
    await modificarIndice(raiz, (ind) => {
      ind.cursos["curso:1"] = {
        nombre: "Curso 1",
        materia: "Materia 1",
        docente: "Docente 1",
        temas: {},
      };
    });

    // Edición a mano simulada directamente sobre el archivo en disco
    const rutaArchivo = path.join(raiz, NOMBRE_INDICE);
    const contenidoEnDisco = JSON.parse(await fs.readFile(rutaArchivo, "utf8"));
    contenidoEnDisco.cursos["curso:manual"] = {
      nombre: "Curso Editado a Mano",
      materia: "Materia Manual",
      docente: "Docente Manual",
      temas: {},
    };
    await fs.writeFile(rutaArchivo, JSON.stringify(contenidoEnDisco, null, 2) + "\n", "utf8");

    // Segunda modificación
    await modificarIndice(raiz, (ind) => {
      ind.cursos["curso:2"] = {
        nombre: "Curso 2",
        materia: "Materia 2",
        docente: "Docente 2",
        temas: {},
      };
    });

    const final = await leerIndice(raiz);
    expect(final.cursos["curso:1"]).toBeDefined();
    expect(final.cursos["curso:manual"]).toBeDefined();
    expect(final.cursos["curso:2"]).toBeDefined();
  });

  it("el temporal no queda si falla el rename", async () => {
    const spyRename = vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("Fallo simulado de rename"));

    await expect(
      modificarIndice(raiz, (ind) => {
        ind.cursos["c"] = { nombre: "C", materia: "M", docente: "D", temas: {} };
      })
    ).rejects.toThrow("Fallo simulado de rename");

    spyRename.mockRestore();

    const archivosEnRaiz = await fs.readdir(raiz);
    const temporales = archivosEnRaiz.filter((f) => f.includes(".tmp."));
    expect(temporales.length).toBe(0);
  });

  it("nunca existe un .gitignore nuevo (RN-24, NFR-2)", async () => {
    await modificarIndice(raiz, (ind) => {
      ind.cursos["curso:1"] = {
        nombre: "Curso 1",
        materia: "Materia 1",
        docente: "Docente 1",
        temas: {},
      };
    });

    const existeGitignore = fsSync.existsSync(path.join(raiz, ".gitignore"));
    expect(existeGitignore).toBe(false);
  });
});
