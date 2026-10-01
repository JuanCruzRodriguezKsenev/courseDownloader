import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { recorrerRaiz, buscarPorMd5 } from "./recorrido.js";
import { limpiarCacheMd5 } from "./md5.js";

describe("backend/destino/recorrido.js", () => {
  let raiz = "";
  let dirFuera = "";

  beforeEach(async () => {
    limpiarCacheMd5();
    raiz = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-raiz-"));
    dirFuera = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-fuera-"));
  });

  afterEach(async () => {
    if (raiz) await fs.rm(raiz, { recursive: true, force: true }).catch(() => {});
    if (dirFuera) await fs.rm(dirFuera, { recursive: true, force: true }).catch(() => {});
  });

  it("encuentra un archivo movido a otra materia (AC-5b)", async () => {
    const dirMateria1 = path.join(raiz, "Ingenieria", "Fisica 2", "Practicas");
    const dirMateria2 = path.join(raiz, "Ingenieria", "Fisica 1", "Practicas");
    await fs.mkdir(dirMateria1, { recursive: true });
    await fs.mkdir(dirMateria2, { recursive: true });

    const contenido = "Contenido unico de guia de fisica";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    // Archivo movido a Fisica 1 con otro nombre
    const rutaEnMateria2 = path.join(dirMateria2, "otro_nombre.pdf");
    await fs.writeFile(rutaEnMateria2, contenido, "utf8");

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBe("Ingenieria/Fisica 1/Practicas/otro_nombre.pdf");
  });

  it("ignora copias en Wiki/, Mis notas/ y Clases/ a cualquier profundidad", async () => {
    const dirNormal = path.join(raiz, "Ingenieria", "Fisica 1", "Practicas");
    const dirWiki = path.join(raiz, "Ingenieria", "Fisica 1", "Wiki");
    const dirMisNotas = path.join(raiz, "Mis notas", "Resumenes");
    const dirClases = path.join(raiz, "Ingenieria", "Clases");

    await fs.mkdir(dirNormal, { recursive: true });
    await fs.mkdir(dirWiki, { recursive: true });
    await fs.mkdir(dirMisNotas, { recursive: true });
    await fs.mkdir(dirClases, { recursive: true });

    const contenidoExcluido = "Contenido en carpeta de notas";
    const hashExcluido = crypto.createHash("md5").update(contenidoExcluido).digest("hex").toLowerCase();

    await fs.writeFile(path.join(dirWiki, "nota_wiki.md"), contenidoExcluido, "utf8");
    await fs.writeFile(path.join(dirMisNotas, "apunte.md"), contenidoExcluido, "utf8");
    await fs.writeFile(path.join(dirClases, "clase.md"), contenidoExcluido, "utf8");

    const encontrado = await buscarPorMd5(raiz, hashExcluido);
    expect(encontrado).toBeNull();

    const todos = await recorrerRaiz(raiz);
    expect(todos.some((r) => r.includes("Wiki"))).toBe(false);
    expect(todos.some((r) => r.includes("Mis notas"))).toBe(false);
    expect(todos.some((r) => r.includes("Clases"))).toBe(false);
  });

  it("ignora una copia fuera de la raíz", async () => {
    const contenido = "Contenido fuera de la raiz";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    await fs.writeFile(path.join(dirFuera, "archivo_externo.pdf"), contenido, "utf8");

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBeNull();
  });

  it("no entra a carpetas ni archivos que comienzan con punto", async () => {
    const dirPunto = path.join(raiz, ".obsidian");
    const dirMateria = path.join(raiz, "Ingenieria", ".oculta");
    await fs.mkdir(dirPunto, { recursive: true });
    await fs.mkdir(dirMateria, { recursive: true });

    const contenido = "Archivo oculto";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    await fs.writeFile(path.join(dirPunto, "config.json"), contenido, "utf8");
    await fs.writeFile(path.join(dirMateria, "secreto.pdf"), contenido, "utf8");
    await fs.writeFile(path.join(raiz, ".course-downloader.json"), contenido, "utf8");

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBeNull();

    const todos = await recorrerRaiz(raiz);
    expect(todos.length).toBe(0);
  });

  it("no sigue symlinks", async () => {
    const dirReal = path.join(dirFuera, "subreal");
    await fs.mkdir(dirReal, { recursive: true });
    const archivoReal = path.join(dirReal, "real.pdf");
    const contenido = "Contenido de archivo real";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();
    await fs.writeFile(archivoReal, contenido, "utf8");

    // Crear un symlink dentro de la raíz que apunta al directorio externo
    const linkDir = path.join(raiz, "link_hacia_afuera");
    try {
      await fs.symlink(dirReal, linkDir);
    } catch {
      // Si el SO no soporta symlinks en modo no admin, se omite
      return;
    }

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBeNull();

    const todos = await recorrerRaiz(raiz);
    expect(todos.length).toBe(0);
  });
});
