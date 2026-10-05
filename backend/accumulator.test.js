import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  acumuladorChunks,
  alimentarSlidingWindow,
  abortarDescargaYLimpiar,
} from "./accumulator.js";

describe("backend/accumulator.js", () => {
  let tempDir = "";

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-acc-"));
    acumuladorChunks.clear();
  });

  afterEach(async () => {
    acumuladorChunks.clear();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("sin opciones, un archivo preexistente con el mismo nombre sí se borra (comportamiento actual)", async () => {
    const targetFile = path.join(tempDir, "video.mp4");
    await fs.writeFile(targetFile, "contenido_anterior", "utf8");
    expect(fsSync.existsSync(targetFile)).toBe(true);

    const chunk = Buffer.from("fragmento_1");
    // Al alimentar el primer fragmento sin opciones, borra el archivo final preexistente
    await alimentarSlidingWindow("sitio|video", 0, 2, chunk, targetFile, "sesion-1", "video");

    expect(fsSync.existsSync(targetFile)).toBe(false);
    expect(fsSync.existsSync(targetFile + ".part")).toBe(true);

    await abortarDescargaYLimpiar("sitio|video", "sesion-1");
  });

  it("con preservarDestino, el archivo preexistente NO se borra y su contenido sigue idéntico (NFR-4)", async () => {
    const targetFile = path.join(tempDir, "existente.pdf");
    const contenidoOriginal = "contenido_protegido_del_usuario";
    await fs.writeFile(targetFile, contenidoOriginal, "utf8");

    const chunk = Buffer.from("nuevo_chunk");
    await alimentarSlidingWindow("sitio|doc", 0, 2, chunk, targetFile, "sesion-2", "doc", {
      preservarDestino: true,
    });

    // El archivo preexistente sigue intacto y el .part se abrió en paralelo
    expect(fsSync.existsSync(targetFile)).toBe(true);
    expect(await fs.readFile(targetFile, "utf8")).toBe(contenidoOriginal);
    expect(fsSync.existsSync(targetFile + ".part")).toBe(true);

    await abortarDescargaYLimpiar("sitio|doc", "sesion-2");
  });

  it("el gancho alFinalizar recibe la sesión con el .part cerrado y completo", async () => {
    const targetFile = path.join(tempDir, "documento.pdf");
    const chunk1 = Buffer.from("parte1_");
    const chunk2 = Buffer.from("parte2");

    let ganchoLlamado = false;
    let contenidoVistoPorGancho = "";

    const alFinalizar = async (sesion) => {
      ganchoLlamado = true;
      const partPath = sesion.targetFile + ".part";
      // El stream debe estar cerrado y el contenido legible
      contenidoVistoPorGancho = await fs.readFile(partPath, "utf8");
      // Simular que el gancho renombra o procesa el archivo
      await fs.rename(partPath, sesion.targetFile);
      return "procesado_ok";
    };

    await alimentarSlidingWindow("sitio|doc", 0, 2, chunk1, targetFile, "sesion-3", "doc", {
      preservarDestino: true,
      alFinalizar,
    });

    const sesionFinal = await alimentarSlidingWindow("sitio|doc", 1, 2, chunk2, targetFile, "sesion-3", "doc", {
      preservarDestino: true,
      alFinalizar,
    });

    expect(ganchoLlamado).toBe(true);
    expect(contenidoVistoPorGancho).toBe("parte1_parte2");
    expect(sesionFinal.resultado).toBe("procesado_ok");
    expect(acumuladorChunks.has("sitio|doc")).toBe(false);
    expect(await fs.readFile(targetFile, "utf8")).toBe("parte1_parte2");
  });

  it("si el gancho alFinalizar lanza, no quedan sesiones colgadas en memoria", async () => {
    const targetFile = path.join(tempDir, "fallo.pdf");
    const chunk = Buffer.from("datos");

    const alFinalizarError = async () => {
      throw new Error("Fallo intencional en alFinalizar");
    };

    await expect(
      alimentarSlidingWindow("sitio|fallo", 0, 1, chunk, targetFile, "sesion-4", "fallo", {
        preservarDestino: true,
        alFinalizar: alFinalizarError,
      })
    ).rejects.toThrow("Fallo intencional en alFinalizar");

    // La sesión debe haberse eliminado del acumulador a pesar del error
    expect(acumuladorChunks.has("sitio|fallo")).toBe(false);

    // Limpieza manual del .part remanente
    await fs.unlink(targetFile + ".part").catch(() => {});
  });

  it("abortarDescargaYLimpiar borra el .part pero NUNCA el targetFile final", async () => {
    const targetFile = path.join(tempDir, "original.pdf");
    await fs.writeFile(targetFile, "contenido_sagrado", "utf8");

    const chunk = Buffer.from("fragmento_incompleto");
    await alimentarSlidingWindow("sitio|cancelar", 0, 5, chunk, targetFile, "sesion-cancel", "cancelar", {
      preservarDestino: true,
    });

    expect(fsSync.existsSync(targetFile + ".part")).toBe(true);
    expect(fsSync.existsSync(targetFile)).toBe(true);

    await abortarDescargaYLimpiar("sitio|cancelar", "sesion-cancel");

    // .part eliminado
    expect(fsSync.existsSync(targetFile + ".part")).toBe(false);
    // targetFile debe conservarse intacto
    expect(fsSync.existsSync(targetFile)).toBe(true);
    expect(await fs.readFile(targetFile, "utf8")).toBe("contenido_sagrado");
    expect(acumuladorChunks.has("sitio|cancelar")).toBe(false);
  });
});
