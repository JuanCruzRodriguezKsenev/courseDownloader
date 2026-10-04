import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { crearManejadorEditor } from "./editor.js";
import { guardarVisto, limpiarVistos } from "../destino/vistos.js";
import { NOMBRE_INDICE } from "../../core/destino/indice.ts";

describe("backend/adopcion/editor.js (modo=indice y modo TSV)", () => {
  let dirRaiz;
  let dirSalida;
  let manejar;

  beforeEach(async () => {
    limpiarVistos();
    dirRaiz = await fs.mkdtemp(path.join(os.tmpdir(), "editor-test-raiz-"));
    dirSalida = await fs.mkdtemp(path.join(os.tmpdir(), "editor-test-salida-"));

    // Crear estructura de materias en dirRaiz
    await fs.mkdir(path.join(dirRaiz, "Ingenieria/Fisica 2/Teorias/Palacio"), {
      recursive: true,
    });
    await fs.mkdir(path.join(dirRaiz, "Ingenieria/Algebra/Teorias"), {
      recursive: true,
    });

    // Archivos TSV para modo clásico
    await fs.writeFile(
      path.join(dirSalida, "cursos.tsv"),
      "clave_curso\tnombre\tcarpeta\tmateria\tdocente\titems\n" +
        "c1\tFisica II\tFisica II\tIngenieria/Fisica 2\tPalacio\t1\n"
    );
    await fs.writeFile(
      path.join(dirSalida, "temas.tsv"),
      "clave_curso\ttema\tdestino\tregla\titems\n" +
        "c1\tTeoria\tTeorias\tsi\t1\n"
    );
    await fs.writeFile(
      path.join(dirSalida, "archivos.tsv"),
      "clave\tclave_curso\ttema\taccion\tcarpeta\tnombre\toriginal\torigen\tmd5\n" +
        "c1:a1\tc1\tTeoria\tcopiar\tTeorias/Palacio\tclase1.pdf\tclase1.pdf\t\t\n"
    );

    manejar = crearManejadorEditor(
      { raiz: dirRaiz, salida: dirSalida, puerto: 3002 },
      "/adopcion"
    );
  });

  afterEach(async () => {
    limpiarVistos();
    await fs.rm(dirRaiz, { recursive: true, force: true }).catch(() => {});
    await fs.rm(dirSalida, { recursive: true, force: true }).catch(() => {});
  });

  it("GET api/datos con ?modo=indice sin vistos → vacio: true (D-2)", async () => {
    const req = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const res = await manejar(req, new URL(req.url));
    expect(res).not.toBeNull();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.vacio).toBe(true);
    expect(json.error).toContain("popup");
  });

  it("GET api/datos con ?modo=indice y curso nuevo → filas con materia vacía", async () => {
    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "curso_quimica", nombre: "Química General" },
      items: [
        {
          idArchivo: "q1",
          original: "guia1.pdf",
          tema: "Guías de TP",
        },
      ],
    });

    const req = new Request(
      "http://127.0.0.1:3002/adopcion/api/datos?modo=indice&curso=google-classroom:curso_quimica"
    );
    const res = await manejar(req, new URL(req.url));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.cursos).toHaveLength(1);
    expect(json.cursos[0].clave_curso).toBe("google-classroom:curso_quimica");
    expect(json.cursos[0].materia).toBe("");
    expect(json.cursos[0].docente).toBe("");
    expect(json.temas).toHaveLength(1);
    expect(json.temas[0].tema).toBe("Guías de TP");
    expect(json.temas[0].destino).toBe("Practicas");
    expect(json.archivos).toHaveLength(1);
    expect(json.archivos[0].accion).toBe("copiar");
  });

  it("POST api/guardar con ?modo=indice asocia y escribe el curso en el índice", async () => {
    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "c_nuevo", nombre: "Álgebra" },
      items: [
        {
          idArchivo: "alg_1",
          original: "teoria1.pdf",
          tema: "Teorías",
        },
      ],
    });

    // Leer datos iniciales
    const reqDatos = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const resDatos = await (await manejar(reqDatos, new URL(reqDatos.url))).json();

    // Modificar datos para guardar
    resDatos.cursos[0].materia = "Ingenieria/Algebra";
    resDatos.cursos[0].docente = "Perez";
    resDatos.temas[0].destino = "Teorias";

    const reqGuardar = new Request(
      "http://127.0.0.1:3002/adopcion/api/guardar?modo=indice",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursos: resDatos.cursos,
          temas: resDatos.temas,
          archivos: resDatos.archivos,
        }),
      }
    );

    const resGuardar = await manejar(reqGuardar, new URL(reqGuardar.url));
    expect(resGuardar.status).toBe(200);
    const jsonGuardar = await resGuardar.json();
    expect(jsonGuardar.ok).toBe(true);

    // Verificar en disco
    const rawIndice = await fs.readFile(
      path.join(dirRaiz, NOMBRE_INDICE),
      "utf8"
    );
    const parsedIndice = JSON.parse(rawIndice);
    const cursoEnIndice = parsedIndice.cursos["google-classroom:c_nuevo"];
    expect(cursoEnIndice).toBeDefined();
    expect(cursoEnIndice.materia).toBe("Ingenieria/Algebra");
    expect(cursoEnIndice.docente).toBe("Perez");
    expect(cursoEnIndice.temas["Teorías"]).toBe("Teorias/Perez");
  });

  it("POST api/guardar?modo=indice con materia nueva segura responde ok: true y guarda sin crear carpeta en raíz (D-5)", async () => {
    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "c_nueva_materia", nombre: "Algoritmos" },
      items: [
        {
          idArchivo: "alg_1",
          original: "teoria1.pdf",
          tema: "Teorías",
        },
      ],
    });

    const reqDatos = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const resDatos = await (await manejar(reqDatos, new URL(reqDatos.url))).json();

    const materiaNueva = "Informatica/Algoritmos";
    resDatos.cursos[0].materia = materiaNueva;
    resDatos.cursos[0].docente = "Docente";
    resDatos.temas[0].destino = "Teorias";

    const reqGuardar = new Request(
      "http://127.0.0.1:3002/adopcion/api/guardar?modo=indice",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cursos: resDatos.cursos,
          temas: resDatos.temas,
          archivos: resDatos.archivos,
        }),
      }
    );

    const resGuardar = await manejar(reqGuardar, new URL(reqGuardar.url));
    expect(resGuardar.status).toBe(200);
    const jsonGuardar = await resGuardar.json();
    expect(jsonGuardar.ok).toBe(true);

    const rawIndice = await fs.readFile(path.join(dirRaiz, NOMBRE_INDICE), "utf8");
    const parsedIndice = JSON.parse(rawIndice);
    const cursoEnIndice = parsedIndice.cursos["google-classroom:c_nueva_materia"];
    expect(cursoEnIndice).toBeDefined();
    expect(cursoEnIndice.materia).toBe("Informatica/Algoritmos");

    const existeCarpeta = await fs
      .access(path.join(dirRaiz, "Informatica"))
      .then(() => true)
      .catch(() => false);
    expect(existeCarpeta).toBe(false);
  });

  it("guardar dos veces seguidas no cambia el archivo en disco (idempotencia)", async () => {
    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "c_nuevo", nombre: "Álgebra" },
      items: [
        {
          idArchivo: "alg_1",
          original: "teoria1.pdf",
          tema: "Teorías",
        },
      ],
    });

    const reqDatos = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const resDatos = await (await manejar(reqDatos, new URL(reqDatos.url))).json();
    resDatos.cursos[0].materia = "Ingenieria/Algebra";
    resDatos.cursos[0].docente = "Perez";
    resDatos.temas[0].destino = "Teorias";

    const body = JSON.stringify({
      cursos: resDatos.cursos,
      temas: resDatos.temas,
      archivos: resDatos.archivos,
    });

    const req1 = new Request("http://127.0.0.1:3002/adopcion/api/guardar?modo=indice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    await manejar(req1, new URL(req1.url));

    const contenido1 = await fs.readFile(path.join(dirRaiz, NOMBRE_INDICE), "utf8");

    const req2 = new Request("http://127.0.0.1:3002/adopcion/api/guardar?modo=indice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    await manejar(req2, new URL(req2.url));

    const contenido2 = await fs.readFile(path.join(dirRaiz, NOMBRE_INDICE), "utf8");

    expect(contenido2).toBe(contenido1);
  });

  it("origen ajeno responde 403", async () => {
    const req = new Request("http://127.0.0.1:3002/adopcion/api/guardar?modo=indice", {
      method: "POST",
      headers: {
        Origin: "http://malicioso.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await manejar(req, new URL(req.url));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.errores).toContain("origen no permitido");
  });

  it("índice ilegible responde 409 y archivo intacto", async () => {
    const rutaIndice = path.join(dirRaiz, NOMBRE_INDICE);
    const contenidoCorrupto = "{ version: 1, cursos: corrupto ";
    await fs.writeFile(rutaIndice, contenidoCorrupto, "utf8");

    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Fisica" },
      items: [],
    });

    const req = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const res = await manejar(req, new URL(req.url));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.indiceIlegible).toBe(true);

    // Archivo intacto
    const leido = await fs.readFile(rutaIndice, "utf8");
    expect(leido).toBe(contenidoCorrupto);
  });

  it("POST api/ensayo con ?modo=indice responde texto fijo de D-8", async () => {
    const req = new Request("http://127.0.0.1:3002/adopcion/api/ensayo?modo=indice", {
      method: "POST",
    });
    const res = await manejar(req, new URL(req.url));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.codigo).toBe(0);
    expect(json.salida).toContain("En modo índice, Guardar sólo escribe el índice");
  });

  it("sin ?modo=indice las cuatro rutas responden como antes (modo TSV)", async () => {
    // 1. GET /adopcion/
    const reqHtml = new Request("http://127.0.0.1:3002/adopcion/");
    const resHtml = await manejar(reqHtml, new URL(reqHtml.url));
    expect(resHtml.status).toBe(200);
    expect(resHtml.headers.get("content-type")).toContain("text/html");

    // 2. GET /adopcion/api/datos
    const reqDatos = new Request("http://127.0.0.1:3002/adopcion/api/datos");
    const resDatos = await manejar(reqDatos, new URL(reqDatos.url));
    expect(resDatos.status).toBe(200);
    const jsonDatos = await resDatos.json();
    expect(jsonDatos.cursos).toHaveLength(1);
    expect(jsonDatos.cursos[0].nombre).toBe("Fisica II");

    // 3. POST /adopcion/api/guardar
    jsonDatos.cursos[0].docente = "NuevoDocente";
    const reqGuardar = new Request("http://127.0.0.1:3002/adopcion/api/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cursos: jsonDatos.cursos,
        temas: jsonDatos.temas,
        archivos: jsonDatos.archivos,
      }),
    });
    const resGuardar = await manejar(reqGuardar, new URL(reqGuardar.url));
    expect(resGuardar.status).toBe(200);
    expect((await resGuardar.json()).ok).toBe(true);

    const tsvCursos = await fs.readFile(
      path.join(dirSalida, "cursos.tsv"),
      "utf8"
    );
    expect(tsvCursos).toContain("NuevoDocente");
  });

  it("GET api/datos incluye carpetasPorMateria y conserva destinos estrictos sin mezclar materias (Plan 08f, D-1)", async () => {
    // Crear una subcarpeta adicional en disco
    await fs.mkdir(path.join(dirRaiz, "Ingenieria/Fisica 2/Talleres"), { recursive: true });

    guardarVisto({
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Física II" },
      items: [{ idArchivo: "f1", original: "guia.pdf", tema: "Teoría" }],
    });

    const req = new Request("http://127.0.0.1:3002/adopcion/api/datos?modo=indice");
    const res = await manejar(req, new URL(req.url));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.carpetasPorMateria).toBeDefined();
    expect(json.carpetasPorMateria["Ingenieria/Fisica 2"]).toContain("Talleres");
    expect(json.carpetasPorMateria["Ingenieria/Fisica 2"]).toContain("Teorias");
    expect(json.destinos).not.toContain("Talleres");
  });
});
