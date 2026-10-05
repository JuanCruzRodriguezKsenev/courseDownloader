import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { ejecutarAplicar } from "./aplicar.js";
import { NOMBRE_INDICE } from "../../core/destino/indice.ts";

describe("backend/adopcion/aplicar.js (CLI adopción)", () => {
  let tmpDir = "";
  let dirRaiz = "";
  let dirTsv = "";
  let rutaOrigen = "";
  let md5Origen = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-aplicar-"));
    dirRaiz = path.join(tmpDir, "raiz");
    dirTsv = path.join(tmpDir, "tsv");
    await fs.mkdir(dirTsv, { recursive: true });
    // Crear la carpeta de la materia en la raíz para cumplir RN-1
    await fs.mkdir(path.join(dirRaiz, "Ingenieria/Fisica 2"), { recursive: true });

    // Crear archivo origen para copiar
    const contenido = "contenido de prueba para aplicar CLI";
    md5Origen = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();
    rutaOrigen = path.join(tmpDir, "origen.pdf");
    await fs.writeFile(rutaOrigen, contenido, "utf8");
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  async function sembrarCursosYArchivos() {
    const lineasCursos = [
      "clave_curso\tnombre\tcarpeta\tmateria\tdocente\tcant",
      "curso:1\tFisica II\tfisica_2\tIngenieria/Fisica 2\tGomez\t1",
    ];
    const lineasArchivos = [
      "clave\tclave_curso\ttema\taccion\tcarpeta\tnombre\toriginal\torigen\tmd5",
      `arch:1\tcurso:1\tSeries\tcopiar\tTeorias/Gomez\tarchivo.pdf\tarchivo.pdf\t${rutaOrigen}\t${md5Origen}`,
    ];
    await fs.writeFile(path.join(dirTsv, "cursos.tsv"), lineasCursos.join("\n") + "\n", "utf8");
    await fs.writeFile(path.join(dirTsv, "archivos.tsv"), lineasArchivos.join("\n") + "\n", "utf8");
  }

  it("AC-16: temas.tsv sin columna subcarpeta resuelve carpetas planas de hoy", async () => {
    await sembrarCursosYArchivos();
    const lineasTemas = [
      "clave_curso\ttema\tdestino\tregla\titems",
      "curso:1\tSeries\tTeorias\tsi\t1",
    ];
    await fs.writeFile(path.join(dirTsv, "temas.tsv"), lineasTemas.join("\n") + "\n", "utf8");

    ejecutarAplicar({
      raiz: dirRaiz,
      salida: dirTsv,
      escribir: true,
    });

    const rutaIndice = path.join(dirRaiz, NOMBRE_INDICE);
    const contenidoIndice = JSON.parse(await fs.readFile(rutaIndice, "utf8"));

    expect(contenidoIndice.cursos["curso:1"].temas["Series"]).toBe("Teorias/Gomez");
    expect(contenidoIndice.archivos["arch:1"].ruta).toBe("Ingenieria/Fisica 2/Teorias/Gomez");

    // Verificar que el archivo realmente se copió en la carpeta sin subcarpeta
    const existeEnDisco = await fs
      .stat(path.join(dirRaiz, "Ingenieria/Fisica 2/Teorias/Gomez/archivo.pdf"))
      .then(() => true)
      .catch(() => false);
    expect(existeEnDisco).toBe(true);
  });

  it("AC-16: temas.tsv con columna subcarpeta = 'si' resuelve Teorias/<docente>/<Tema>", async () => {
    await sembrarCursosYArchivos();
    const lineasTemas = [
      "clave_curso\ttema\tdestino\tregla\titems\tsubcarpeta",
      "curso:1\tSeries\tTeorias\tsi\t1\tsi",
    ];
    await fs.writeFile(path.join(dirTsv, "temas.tsv"), lineasTemas.join("\n") + "\n", "utf8");

    ejecutarAplicar({
      raiz: dirRaiz,
      salida: dirTsv,
      escribir: true,
    });

    const rutaIndice = path.join(dirRaiz, NOMBRE_INDICE);
    const contenidoIndice = JSON.parse(await fs.readFile(rutaIndice, "utf8"));

    expect(contenidoIndice.cursos["curso:1"].temas["Series"]).toBe("Teorias/Gomez/Series");
    expect(contenidoIndice.archivos["arch:1"].ruta).toBe("Ingenieria/Fisica 2/Teorias/Gomez/Series");

    // Verificar que el archivo se copió en la subcarpeta del tema
    const existeEnDisco = await fs
      .stat(path.join(dirRaiz, "Ingenieria/Fisica 2/Teorias/Gomez/Series/archivo.pdf"))
      .then(() => true)
      .catch(() => false);
    expect(existeEnDisco).toBe(true);
  });

  it("AC-16: temas.tsv con columna subcarpeta = 'no' resuelve plano sin subcarpeta", async () => {
    await sembrarCursosYArchivos();
    const lineasTemas = [
      "clave_curso\ttema\tdestino\tregla\titems\tsubcarpeta",
      "curso:1\tSeries\tTeorias\tsi\t1\tno",
    ];
    await fs.writeFile(path.join(dirTsv, "temas.tsv"), lineasTemas.join("\n") + "\n", "utf8");

    ejecutarAplicar({
      raiz: dirRaiz,
      salida: dirTsv,
      escribir: true,
    });

    const rutaIndice = path.join(dirRaiz, NOMBRE_INDICE);
    const contenidoIndice = JSON.parse(await fs.readFile(rutaIndice, "utf8"));

    expect(contenidoIndice.cursos["curso:1"].temas["Series"]).toBe("Teorias/Gomez");
    expect(contenidoIndice.archivos["arch:1"].ruta).toBe("Ingenieria/Fisica 2/Teorias/Gomez");
  });
});
