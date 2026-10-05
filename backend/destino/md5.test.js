import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { md5Archivo, limpiarCacheMd5 } from "./md5.js";

describe("backend/destino/md5.js", () => {
  let dirTemp = "";

  beforeEach(async () => {
    limpiarCacheMd5();
    dirTemp = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-md5-"));
  });

  afterEach(async () => {
    if (dirTemp) {
      await fs.rm(dirTemp, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("calcula hash MD5 de 32 hex minúsculas por stream", async () => {
    const rutaArchivo = path.join(dirTemp, "archivo.txt");
    const contenido = "Contenido de prueba para MD5";
    await fs.writeFile(rutaArchivo, contenido, "utf8");

    const hashEsperado = crypto.createHash("md5").update(contenido).digest("hex").toLowerCase();
    const hash = await md5Archivo(rutaArchivo);

    expect(hash).toBe(hashEsperado);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("cachea por ruta|tamaño|mtime: no vuelve a leer en el segundo pedido (D-4)", async () => {
    const rutaArchivo = path.join(dirTemp, "archivo_cache.txt");
    await fs.writeFile(rutaArchivo, "Datos para cache", "utf8");

    let lecturasHasher = 0;
    const hasherSpy = async (_ruta) => {
      lecturasHasher++;
      return "0123456789abcdef0123456789abcdef";
    };

    const res1 = await md5Archivo(rutaArchivo, { hasher: hasherSpy });
    expect(res1).toBe("0123456789abcdef0123456789abcdef");
    expect(lecturasHasher).toBe(1);

    const res2 = await md5Archivo(rutaArchivo, { hasher: hasherSpy });
    expect(res2).toBe("0123456789abcdef0123456789abcdef");
    expect(lecturasHasher).toBe(1); // No incrementó: vino del cache
  });

  it("concurrencia (Trampa 3): dos búsquedas simultáneas llaman una sola vez a hasher", async () => {
    const rutaArchivo = path.join(dirTemp, "concurrente.txt");
    await fs.writeFile(rutaArchivo, "Contenido concurrente", "utf8");

    let lecturasHasher = 0;
    const hasherSpy = vi.fn(async () => {
      lecturasHasher++;
      await new Promise((r) => setTimeout(r, 15));
      return "0123456789abcdef0123456789abcdef";
    });

    const [res1, res2] = await Promise.all([
      md5Archivo(rutaArchivo, { hasher: hasherSpy }),
      md5Archivo(rutaArchivo, { hasher: hasherSpy }),
    ]);

    expect(res1).toBe("0123456789abcdef0123456789abcdef");
    expect(res2).toBe("0123456789abcdef0123456789abcdef");
    expect(lecturasHasher).toBe(1);
  });

  it("si el cálculo falla, se borra de la caché y permite reintentar", async () => {
    const rutaArchivo = path.join(dirTemp, "fallo.txt");
    await fs.writeFile(rutaArchivo, "Contenido para fallo", "utf8");

    let intentos = 0;
    const hasherSpy = vi.fn(async () => {
      intentos++;
      if (intentos === 1) throw new Error("Fallo transitorio");
      return "0123456789abcdef0123456789abcdef";
    });

    await expect(md5Archivo(rutaArchivo, { hasher: hasherSpy })).rejects.toThrow("Fallo transitorio");
    const res = await md5Archivo(rutaArchivo, { hasher: hasherSpy });
    expect(res).toBe("0123456789abcdef0123456789abcdef");
    expect(intentos).toBe(2);
  });
});
