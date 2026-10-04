import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ejecutarMigracion } from "./migrar-omitidos.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";

describe("backend/adopcion/migrar-omitidos.js", () => {
  let tmpDir = "";
  let dirTsv = "";
  let rutaIndice = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-migrar-omitidos-"));
    dirTsv = path.join(tmpDir, "tsv");
    await fs.mkdir(dirTsv, { recursive: true });
    rutaIndice = path.join(tmpDir, NOMBRE_INDICE);
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  async function sembrarIndice(obj) {
    const indiceBase = {
      version: 1,
      cursos: {},
      archivos: {},
      ...obj,
    };
    await fs.writeFile(rutaIndice, serializarIndice(indiceBase), "utf8");
    return indiceBase;
  }

  async function sembrarTsvs({ temas = [], archivos = [] }) {
    const lineasTemas = ["clave_curso\ttema\tdestino\tregla\titems", ...temas];
    const lineasArchivos = [
      "clave\tclave_curso\ttema\taccion\tcarpeta\tnombre\toriginal\torigen\tmd5",
      ...archivos,
    ];
    await fs.writeFile(path.join(dirTsv, "temas.tsv"), lineasTemas.join("\n") + "\n", "utf8");
    await fs.writeFile(path.join(dirTsv, "archivos.tsv"), lineasArchivos.join("\n") + "\n", "utf8");
  }

  it("agrega el tema '-' y los omitidos", async () => {
    await sembrarIndice({
      cursos: {
        "curso:1": {
          nombre: "Curso 1",
          materia: "Materia 1",
          docente: "Docente 1",
          temas: {
            "Tema Normal": "Teorias",
          },
        },
      },
      archivos: {
        "arch:existente": {
          curso: "curso:1",
          nombre: "existente.pdf",
          ruta: "Materia 1/Teorias/existente.pdf",
          md5: "0123456789abcdef0123456789abcdef",
          original: "existente.pdf",
        },
      },
    });

    await sembrarTsvs({
      temas: [
        "curso:1\tCuestiones administrativas\t-\tno\t1",
        "curso:1\tTema Normal\tTeorias\tsi\t1",
      ],
      archivos: [
        // Archivo bajo tema '-', no debe agregarse a omitidos
        "arch:de_tema_guion\tcurso:1\tCuestiones administrativas\tomitir\t.\tguion.pdf\tguion.pdf\t/tmp/g.pdf\tmd5_1",
        // Archivo bajo tema normal con accion 'omitir', debe agregarse a omitidos
        "arch:omitido_1\tcurso:1\tTema Normal\tomitir\t.\tomitido1.pdf\tomitido1.pdf\t/tmp/o1.pdf\tmd5_2",
      ],
    });

    const plan = await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: true,
    });

    expect(plan.totales.temasAgrega).toBe(1);
    expect(plan.totales.omitidosAgrega).toBe(1);

    const enDisco = JSON.parse(await fs.readFile(rutaIndice, "utf8"));
    expect(enDisco.cursos["curso:1"].temas["Cuestiones administrativas"]).toBe("-");
    expect(enDisco.cursos["curso:1"].omitidos).toEqual(["arch:omitido_1"]);
    // El archivo del tema '-' no fue duplicado en omitidos
    expect(enDisco.cursos["curso:1"].omitidos).not.toContain("arch:de_tema_guion");
  });

  it("idempotente (segunda corrida: 0 cambios y el archivo byte-idéntico)", async () => {
    await sembrarIndice({
      cursos: {
        "curso:1": {
          nombre: "Curso 1",
          materia: "Materia 1",
          docente: "Docente 1",
          temas: { "Tema Normal": "Teorias" },
        },
      },
      archivos: {},
    });

    await sembrarTsvs({
      temas: ["curso:1\tTema Guion\t-\tno\t1"],
      archivos: ["arch:1\tcurso:1\tTema Normal\tomitir\t.\to.pdf\to.pdf\t/tmp/o.pdf\tmd5"],
    });

    // 1ra corrida
    await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: true,
    });

    const contenido1 = await fs.readFile(rutaIndice, "utf8");

    // 2da corrida
    const plan2 = await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: true,
    });

    expect(plan2.totales.totalCambios).toBe(0);
    expect(plan2.totales.temasAgrega).toBe(0);
    expect(plan2.totales.omitidosAgrega).toBe(0);
    expect(plan2.totales.temasYaEstaba).toBe(1);
    expect(plan2.totales.omitidosYaEstaba).toBe(1);

    const contenido2 = await fs.readFile(rutaIndice, "utf8");
    expect(contenido2).toBe(contenido1);
  });

  it("un clave_curso desconocido aborta sin escribir", async () => {
    await sembrarIndice({
      cursos: {
        "curso:valido": {
          nombre: "Curso Valido",
          materia: "Materia",
          docente: "Docente",
          temas: {},
        },
      },
      archivos: {},
    });

    const contenidoOriginal = await fs.readFile(rutaIndice, "utf8");

    await sembrarTsvs({
      temas: ["curso:desconocido\tTema X\t-\tno\t1"],
      archivos: [],
    });

    await expect(
      ejecutarMigracion({
        tsv: dirTsv,
        indice: rutaIndice,
        escribir: true,
      })
    ).rejects.toThrow("El curso 'curso:desconocido' referenciado en los TSV no existe");

    const contenidoPosterior = await fs.readFile(rutaIndice, "utf8");
    expect(contenidoPosterior).toBe(contenidoOriginal);
  });

  it("un tema que ya tiene carpeta no se pisa", async () => {
    await sembrarIndice({
      cursos: {
        "curso:1": {
          nombre: "Curso 1",
          materia: "Materia 1",
          docente: "Docente 1",
          temas: {
            "Tema Con Carpeta": "Teorias/Lucila",
          },
        },
      },
      archivos: {},
    });

    await sembrarTsvs({
      temas: ["curso:1\tTema Con Carpeta\t-\tno\t1"],
      archivos: [],
    });

    const plan = await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: true,
    });

    expect(plan.totales.temasAgrega).toBe(0);
    expect(plan.totales.temasYaEstaba).toBe(1);

    const enDisco = JSON.parse(await fs.readFile(rutaIndice, "utf8"));
    expect(enDisco.cursos["curso:1"].temas["Tema Con Carpeta"]).toBe("Teorias/Lucila");
  });

  it("--ensayo no escribe", async () => {
    await sembrarIndice({
      cursos: {
        "curso:1": {
          nombre: "Curso 1",
          materia: "Materia 1",
          docente: "Docente 1",
          temas: {},
        },
      },
      archivos: {},
    });

    const contenidoOriginal = await fs.readFile(rutaIndice, "utf8");

    await sembrarTsvs({
      temas: ["curso:1\tTema Nuevo\t-\tno\t1"],
      archivos: ["arch:1\tcurso:1\tTema Otro\tomitir\t.\to.pdf\to.pdf\t/tmp/o.pdf\tmd5"],
    });

    const plan = await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: false,
    });

    expect(plan.totales.totalCambios).toBe(2);

    const contenidoPosterior = await fs.readFile(rutaIndice, "utf8");
    expect(contenidoPosterior).toBe(contenidoOriginal);
  });

  it("los campos y las entradas existentes quedan intactos", async () => {
    await sembrarIndice({
      cursos: {
        "curso:1": {
          nombre: "Curso 1",
          materia: "Materia 1",
          docente: "Docente 1",
          temas: { "Tema Existente": "Practicas" },
          omitidos: ["arch:ya_omitido"],
        },
        "curso:2": {
          nombre: "Curso 2",
          materia: "Materia 2",
          docente: "Docente 2",
          temas: { "Otro": "Teorias" },
        },
      },
      archivos: {
        "arch:1": {
          curso: "curso:1",
          nombre: "n.pdf",
          ruta: "Materia 1/Practicas/n.pdf",
          md5: "0123456789abcdef0123456789abcdef",
          original: "n.pdf",
        },
      },
    });

    await sembrarTsvs({
      temas: [
        "curso:1\tTema Existente\tPracticas\tsi\t1",
        "curso:1\tTema Menos\t-\tno\t1",
        "curso:2\tOtro\tTeorias\tsi\t1",
      ],
      archivos: [
        "arch:ya_omitido\tcurso:1\tTema Existente\tomitir\t.\tya.pdf\tya.pdf\t/tmp/y.pdf\tmd5",
        "arch:nuevo_omitido\tcurso:1\tTema Existente\tomitir\t.\tn.pdf\tn.pdf\t/tmp/n.pdf\tmd5",
      ],
    });

    await ejecutarMigracion({
      tsv: dirTsv,
      indice: rutaIndice,
      escribir: true,
    });

    const enDisco = JSON.parse(await fs.readFile(rutaIndice, "utf8"));

    // curso:1
    expect(enDisco.cursos["curso:1"].nombre).toBe("Curso 1");
    expect(enDisco.cursos["curso:1"].materia).toBe("Materia 1");
    expect(enDisco.cursos["curso:1"].docente).toBe("Docente 1");
    expect(enDisco.cursos["curso:1"].temas["Tema Existente"]).toBe("Practicas");
    expect(enDisco.cursos["curso:1"].temas["Tema Menos"]).toBe("-");
    expect(enDisco.cursos["curso:1"].omitidos).toEqual(["arch:ya_omitido", "arch:nuevo_omitido"]);

    // curso:2
    expect(enDisco.cursos["curso:2"]).toEqual({
      nombre: "Curso 2",
      materia: "Materia 2",
      docente: "Docente 2",
      temas: { "Otro": "Teorias" },
    });

    // archivos
    expect(enDisco.archivos["arch:1"]).toEqual({
      curso: "curso:1",
      nombre: "n.pdf",
      ruta: "Materia 1/Practicas/n.pdf",
      md5: "0123456789abcdef0123456789abcdef",
      original: "n.pdf",
    });
  });
});
