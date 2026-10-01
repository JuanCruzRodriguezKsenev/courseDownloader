import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { calcularEstado } from "./estado.js";
import { limpiarCacheMd5 } from "./md5.js";
import { NOMBRE_INDICE, serializarIndice } from "../../core/destino/indice.ts";

describe("backend/destino/estado.js", () => {
  let raiz = "";

  beforeEach(async () => {
    limpiarCacheMd5();
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-estado-"));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (raiz) await fs.rm(raiz, { recursive: true, force: true }).catch(() => {});
  });

  it("curso sin asociar (RN-2) -> asociado: false, todos pendiente, rutaDestino: null, no escribe nada", async () => {
    const curso = { id: "c_sin_asociar", nombre: "Curso Desconocido" };
    const items = [
      { idArchivo: "item1", tema: "Tema 1", original: "archivo1.pdf" },
      { idArchivo: "item2", tema: "Tema 2", original: "archivo2.pdf" },
    ];

    const res = await calcularEstado({ raiz, sitio: "google-classroom", curso, items });

    expect(res.ok).toBe(true);
    expect(res.curso.asociado).toBe(false);
    expect(res.items.length).toBe(2);
    expect(res.items[0].estado).toBe("pendiente");
    expect(res.items[0].rutaDestino).toBeNull();
    expect(res.items[0].sinAsignar).toBe(false);
    expect(res.items[1].estado).toBe("pendiente");
    expect(res.items[1].rutaDestino).toBeNull();

    // No se crea índice si no existía
    const existe = await fs.stat(path.join(raiz, NOMBRE_INDICE)).catch(() => false);
    expect(existe).toBe(false);
  });

  it("id en el índice y archivo en su ruta anotada (fila 1: sin hashear)", async () => {
    const claveC = "google-classroom:c1";
    const claveA = "google-classroom:a1";
    const indiceInicial = {
      version: 1,
      cursos: {
        [claveC]: {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: { "Clases Teóricas": "Teorias/Palacio" },
        },
      },
      archivos: {
        [claveA]: {
          curso: claveC,
          nombre: "05_capacitores.pdf",
          ruta: "Ingenieria/Fisica 2/Teorias/Palacio",
          md5: "md5falso1234567890abcdef12345678",
          original: "05_capacitores.pdf",
        },
      },
    };
    await fs.writeFile(path.join(raiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

    // Crear el archivo en su ruta anotada
    const dirArchivo = path.join(raiz, "Ingenieria", "Fisica 2", "Teorias", "Palacio");
    await fs.mkdir(dirArchivo, { recursive: true });
    await fs.writeFile(path.join(dirArchivo, "05_capacitores.pdf"), "Contenido simulado", "utf8");

    const hasherSpy = vi.fn();
    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Física II" },
      items: [{ idArchivo: "a1", tema: "Clases Teóricas", original: "05_capacitores.pdf" }],
      opciones: { hasher: hasherSpy },
    });

    expect(res.ok).toBe(true);
    expect(res.items[0].estado).toBe("descargado");
    expect(res.items[0].fila).toBe("1");
    expect(res.items[0].rutaDestino).toBe("Ingenieria/Fisica 2/Teorias/Palacio");
    expect(res.items[0].nombre).toBe("05_capacitores.pdf");
    expect(hasherSpy).not.toHaveBeenCalled();
  });

  it("AC-5: archivo movido dentro de la materia -> corrige índice y 0 escrituras en disco", async () => {
    const claveC = "google-classroom:c1";
    const claveA = "google-classroom:a1";
    const contenido = "Contenido de TP movido a mano";
    const md5Real = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    const indiceInicial = {
      version: 1,
      cursos: {
        [claveC]: {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: { "Guías de TP": "Practicas" },
        },
      },
      archivos: {
        [claveA]: {
          curso: claveC,
          nombre: "05_capacitores.pdf",
          ruta: "Ingenieria/Fisica 2/Practicas",
          md5: md5Real,
          original: "05_capacitores.pdf",
        },
      },
    };
    await fs.writeFile(path.join(raiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

    // El archivo NO está en Practicas; el dueño lo movió a Teorias/Palacio
    const dirNuevo = path.join(raiz, "Ingenieria", "Fisica 2", "Teorias", "Palacio");
    await fs.mkdir(dirNuevo, { recursive: true });
    const rutaEnDisco = path.join(dirNuevo, "05_capacitores.pdf");
    await fs.writeFile(rutaEnDisco, contenido, "utf8");
    const mtimeAntes = (await fs.stat(rutaEnDisco)).mtimeMs;

    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Física II" },
      items: [{ idArchivo: "a1", tema: "Guías de TP", original: "05_capacitores.pdf" }],
    });

    expect(res.ok).toBe(true);
    expect(res.items[0].estado).toBe("descargado");
    expect(res.items[0].fila).toBe("2");
    expect(res.items[0].rutaDestino).toBe("Ingenieria/Fisica 2/Teorias/Palacio");

    // Verificar que el índice se corrigió en disco
    const indiceActualizado = JSON.parse(await fs.readFile(path.join(raiz, NOMBRE_INDICE), "utf8"));
    expect(indiceActualizado.archivos[claveA].ruta).toBe("Ingenieria/Fisica 2/Teorias/Palacio");

    // 0 escrituras en disco: el archivo conserva su mtime exacto y no se movió
    const mtimeDespues = (await fs.stat(rutaEnDisco)).mtimeMs;
    expect(mtimeDespues).toBe(mtimeAntes);
  });

  it("AC-5b: archivo movido a otra materia y renombrado -> corrige ruta y nombre en índice", async () => {
    const claveC = "google-classroom:c1";
    const claveA = "google-classroom:a1";
    const contenido = "Contenido movido a otra materia";
    const md5Real = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    const indiceInicial = {
      version: 1,
      cursos: {
        [claveC]: {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: { "Guías de TP": "Practicas" },
        },
      },
      archivos: {
        [claveA]: {
          curso: claveC,
          nombre: "guia_tp.pdf",
          ruta: "Ingenieria/Fisica 2/Practicas",
          md5: md5Real,
          original: "guia_tp.pdf",
        },
      },
    };
    await fs.writeFile(path.join(raiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

    // Movido y renombrado a Fisica 1/Practicas/otro_nombre.pdf
    const dirOtraMateria = path.join(raiz, "Ingenieria", "Fisica 1", "Practicas");
    await fs.mkdir(dirOtraMateria, { recursive: true });
    await fs.writeFile(path.join(dirOtraMateria, "otro_nombre.pdf"), contenido, "utf8");

    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Física II" },
      items: [{ idArchivo: "a1", tema: "Guías de TP", original: "guia_tp.pdf" }],
    });

    expect(res.ok).toBe(true);
    expect(res.items[0].estado).toBe("descargado");
    expect(res.items[0].fila).toBe("2");
    expect(res.items[0].rutaDestino).toBe("Ingenieria/Fisica 1/Practicas");
    expect(res.items[0].nombre).toBe("otro_nombre.pdf");

    const indiceActualizado = JSON.parse(await fs.readFile(path.join(raiz, NOMBRE_INDICE), "utf8"));
    expect(indiceActualizado.archivos[claveA].ruta).toBe("Ingenieria/Fisica 1/Practicas");
    expect(indiceActualizado.archivos[claveA].nombre).toBe("otro_nombre.pdf");
  });

  it("AC-7: índice inválido -> { ok: false, indiceIlegible: true } y archivo intacto", async () => {
    const rutaIndice = path.join(raiz, NOMBRE_INDICE);
    const contenidoCorrupto = "{ json_invalido: true, ";
    await fs.writeFile(rutaIndice, contenidoCorrupto, "utf8");

    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Curso" },
      items: [{ idArchivo: "a1", original: "archivo.pdf" }],
    });

    expect(res.ok).toBe(false);
    expect(res.indiceIlegible).toBe(true);
    expect(res.error).toBeDefined();

    const enDisco = await fs.readFile(rutaIndice, "utf8");
    expect(enDisco).toBe(contenidoCorrupto);
  });

  it("AC-10: un curso del índice que no aparece en el pedido queda intacto byte a byte", async () => {
    const claveC1 = "google-classroom:c1";
    const claveC2 = "google-classroom:c2";
    const claveA1 = "google-classroom:a1";
    const claveA2 = "google-classroom:a2";

    const indiceInicial = {
      version: 1,
      cursos: {
        [claveC1]: {
          nombre: "Curso 1",
          materia: "Ingenieria/Materia 1",
          docente: "Docente 1",
          temas: { Tema1: "Teorias" },
        },
        [claveC2]: {
          nombre: "MC4 1S 2026",
          materia: "Ingenieria/Matematica C",
          docente: "Docente 2",
          temas: { Tema2: "Practicas" },
        },
      },
      archivos: {
        [claveA1]: {
          curso: claveC1,
          nombre: "archivo1.pdf",
          ruta: "Ingenieria/Materia 1/Teorias",
          md5: "11111111111111111111111111111111",
          original: "archivo1.pdf",
        },
        [claveA2]: {
          curso: claveC2,
          nombre: "archivo2.pdf",
          ruta: "Ingenieria/Matematica C/Practicas",
          md5: "22222222222222222222222222222222",
          original: "archivo2.pdf",
        },
      },
    };
    await fs.writeFile(path.join(raiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

    // Guardar representación de curso 2 y archivo 2
    const c2JsonAntes = JSON.stringify(indiceInicial.cursos[claveC2]);
    const a2JsonAntes = JSON.stringify(indiceInicial.archivos[claveA2]);

    // Consultamos únicamente curso C1
    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Curso 1" },
      items: [{ idArchivo: "a1", tema: "Tema1", original: "archivo1.pdf" }],
    });
    expect(res.ok).toBe(true);

    const indiceFinal = JSON.parse(await fs.readFile(path.join(raiz, NOMBRE_INDICE), "utf8"));
    expect(JSON.stringify(indiceFinal.cursos[claveC2])).toBe(c2JsonAntes);
    expect(JSON.stringify(indiceFinal.archivos[claveA2])).toBe(a2JsonAntes);
  });

  it(".md editado (fila 0, RN-30): no se sobreescribe y se anota si falta", async () => {
    const claveC = "google-classroom:c1";
    const indiceInicial = {
      version: 1,
      cursos: {
        [claveC]: {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: { Videos: "Teorias/Palacio" },
        },
      },
      archivos: {}, // a1 no está en el índice todavía
    };
    await fs.writeFile(path.join(raiz, NOMBRE_INDICE), serializarIndice(indiceInicial), "utf8");

    // El dueño creó o editó un apunte .md en destino
    const dirDestino = path.join(raiz, "Ingenieria", "Fisica 2", "Teorias", "Palacio");
    await fs.mkdir(dirDestino, { recursive: true });
    const rutaMd = path.join(dirDestino, "06_video_capacidad_a.md");
    const contenidoConNotas = "# Mis notas personales sobre capacidad\nTexto del dueño";
    await fs.writeFile(rutaMd, contenidoConNotas, "utf8");

    const res = await calcularEstado({
      raiz,
      sitio: "google-classroom",
      curso: { id: "c1", nombre: "Física II" },
      items: [{ idArchivo: "a1", tema: "Videos", original: "06_video_capacidad_a.md" }],
    });

    expect(res.ok).toBe(true);
    expect(res.items[0].estado).toBe("descargado");
    expect(res.items[0].fila).toBe("0");

    // Archivo intacto
    const enDisco = await fs.readFile(rutaMd, "utf8");
    expect(enDisco).toBe(contenidoConNotas);

    // Se anotó en el índice con el md5 del archivo existente
    const indiceActualizado = JSON.parse(await fs.readFile(path.join(raiz, NOMBRE_INDICE), "utf8"));
    const entrada = indiceActualizado.archivos["google-classroom:a1"];
    expect(entrada).toBeDefined();
    expect(entrada.nombre).toBe("06_video_capacidad_a.md");
    expect(entrada.ruta).toBe("Ingenieria/Fisica 2/Teorias/Palacio");
  });
});
