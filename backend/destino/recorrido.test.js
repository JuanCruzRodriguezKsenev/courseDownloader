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

  it("varias copias con distinto mtime: gana la más reciente (AC-5, RN-4)", async () => {
    const dir1 = path.join(raiz, "Ingenieria", "Fisica 1", "Practicas");
    const dir2 = path.join(raiz, "Ingenieria", "Fisica 2", "Parciales");
    await fs.mkdir(dir1, { recursive: true });
    await fs.mkdir(dir2, { recursive: true });

    const contenido = "Mismo contenido en dos lugares";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    const rutaVieja = path.join(dir1, "a.pdf");
    const rutaNueva = path.join(dir2, "a.pdf");

    await fs.writeFile(rutaVieja, contenido, "utf8");
    await fs.writeFile(rutaNueva, contenido, "utf8");

    // Modificar mtime explícitamente: rutaVieja = 1000s, rutaNueva = 2000s
    await fs.utimes(rutaVieja, 1000, 1000);
    await fs.utimes(rutaNueva, 2000, 2000);

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBe("Ingenieria/Fisica 2/Parciales/a.pdf");
  });

  it("varias copias con igual mtime: desempata por ruta alfabética menor (RN-4 determinista)", async () => {
    const dirZ = path.join(raiz, "Z_Carpeta");
    const dirA = path.join(raiz, "A_Carpeta");
    await fs.mkdir(dirZ, { recursive: true });
    await fs.mkdir(dirA, { recursive: true });

    const contenido = "Contenido idéntico para empate de mtime";
    const hash = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();

    const rutaZ = path.join(dirZ, "copia.pdf");
    const rutaA = path.join(dirA, "copia.pdf");

    await fs.writeFile(rutaZ, contenido, "utf8");
    await fs.writeFile(rutaA, contenido, "utf8");

    await fs.utimes(rutaZ, 1500, 1500);
    await fs.utimes(rutaA, 1500, 1500);

    const encontrado = await buscarPorMd5(raiz, hash);
    expect(encontrado).toBe("A_Carpeta/copia.pdf");
  });

  it("opciones.tamano: no hashea archivos cuyo tamaño difiere", async () => {
    const dir = path.join(raiz, "Materia");
    await fs.mkdir(dir, { recursive: true });

    const contenidoBuscado = "12345"; // 5 bytes
    const hash = crypto.createHash("md5").update(contenidoBuscado).digest("hex").toLowerCase();

    await fs.writeFile(path.join(dir, "distinto_tamano.pdf"), "12345678901234567890", "utf8"); // 20 bytes
    await fs.writeFile(path.join(dir, "mismo_tamano.pdf"), contenidoBuscado, "utf8"); // 5 bytes

    let llamadasHasher = 0;
    const hasherSpy = async (r) => {
      llamadasHasher++;
      const buf = await fs.readFile(r);
      return crypto.createHash("md5").update(buf).digest("hex").toLowerCase();
    };

    const encontrado = await buscarPorMd5(raiz, hash, { tamano: 5, hasher: hasherSpy });
    expect(encontrado).toBe("Materia/mismo_tamano.pdf");
    // Solo debe haber hasheado el archivo de tamaño 5
    expect(llamadasHasher).toBe(1);
  });
});
