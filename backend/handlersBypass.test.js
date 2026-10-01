import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { handleBypassStream, handleCancelarDescarga } from "./handlers.js";
import { establecerRutaRaiz, establecerRaizDePortal, CARPETA_RAIZ_VIDEOS } from "./config.js";
import { acumuladorChunks } from "./accumulator.js";
import { NOMBRE_INDICE } from "../core/destino/indice.ts";
import { limpiarCacheMd5 } from "./destino/md5.js";

describe("backend/handlers.js - handleBypassStream en modo destino y tradicional", () => {
  let tempRaiz = "";
  let tempRaizClassroom = "";
  const raizOriginal = CARPETA_RAIZ_VIDEOS;

  beforeEach(async () => {
    limpiarCacheMd5();
    acumuladorChunks.clear();
    tempRaiz = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-handlers-raiz-"));
    tempRaizClassroom = await fs.mkdtemp(path.join(os.tmpdir(), "cd-test-handlers-classroom-"));
    establecerRutaRaiz(tempRaiz);
    establecerRaizDePortal("google-classroom", tempRaizClassroom);
  });

  afterEach(async () => {
    acumuladorChunks.clear();
    establecerRutaRaiz(raizOriginal);
    establecerRaizDePortal("google-classroom", undefined);
    vi.restoreAllMocks();
    if (tempRaiz) await fs.rm(tempRaiz, { recursive: true, force: true }).catch(() => {});
    if (tempRaizClassroom) await fs.rm(tempRaizClassroom, { recursive: true, force: true }).catch(() => {});
  });

  it("sin headers nuevos, un portal normal (ramonnet) escribe en raíz/<portal>/<carpeta>/", async () => {
    const chunk = Buffer.from("video_datos");
    const req = new Request("http://127.0.0.1:3001/api/bypass-stream", {
      method: "POST",
      headers: {
        "content-length": String(chunk.length),
        "x-video-title": encodeURIComponent("Clase 01"),
        "x-chunk-index": "0",
        "x-total-chunks": "1",
        "x-target-folder": "Fisica",
        "x-site-folder": "ramonnet",
        "x-session-id": "sesion-rn-1",
      },
      body: chunk,
    });

    const res = await handleBypassStream(req, {});
    expect(res.status).toBe(200);

    const esperadoPath = path.join(tempRaiz, "ramonnet", "fisica", "Clase 01.mp4");
    expect(fsSync.existsSync(esperadoPath)).toBe(true);
  });

  it("sin headers nuevos, google-classroom recibe 400 DESTINO_REQUERIDO sin crear carpetas (D-9)", async () => {
    const chunk = Buffer.from("datos_pdf");
    const req = new Request("http://127.0.0.1:3001/api/bypass-stream", {
      method: "POST",
      headers: {
        "content-length": String(chunk.length),
        "x-video-title": encodeURIComponent("Documento"),
        "x-chunk-index": "0",
        "x-total-chunks": "1",
        "x-target-folder": "Fisica 2",
        "x-site-folder": "google-classroom",
        "x-session-id": "sesion-gc-req",
      },
      body: chunk,
    });

    const res = await handleBypassStream(req, {});
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.codigo).toBe("DESTINO_REQUERIDO");

    // No debe haber creado ninguna subcarpeta dentro de tempRaizClassroom
    const entradas = await fs.readdir(tempRaizClassroom);
    expect(entradas.length).toBe(0);
  });

  it("con headers de destino, escribe en la ruta del índice con mayúsculas y espacios y devuelve resultado", async () => {
    // 1. Preparar materia en disco
    await fs.mkdir(path.join(tempRaizClassroom, "Ingenieria", "Fisica 2"), { recursive: true });

    // 2. Preparar índice con el curso asociado
    const indiceInicial = {
      version: 1,
      cursos: {
        "google-classroom:C1": {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "Palacio",
          temas: { "Teoria 1": "Teorias/Palacio" },
        },
      },
      archivos: {},
    };
    await fs.writeFile(path.join(tempRaizClassroom, NOMBRE_INDICE), JSON.stringify(indiceInicial), "utf8");

    // 3. Enviar chunk
    const chunk = Buffer.from("contenido_capacitores_pdf");
    const req = new Request("http://127.0.0.1:3001/api/bypass-stream", {
      method: "POST",
      headers: {
        "content-length": String(chunk.length),
        "x-video-title": encodeURIComponent("Original Capacitores.pdf"),
        "x-file-name": encodeURIComponent("05_capacitores.pdf"),
        "x-chunk-index": "0",
        "x-total-chunks": "1",
        "x-site-folder": "google-classroom",
        "x-destino-portal": "google-classroom",
        "x-destino-ruta": encodeURIComponent("Ingenieria/Fisica 2/Teorias/Palacio"),
        "x-clave-archivo": "google-classroom:A1",
        "x-clave-curso": "google-classroom:C1",
        "x-original": encodeURIComponent("Original Capacitores.pdf"),
        "x-session-id": "sesion-gc-ok",
      },
      body: chunk,
    });

    const res = await handleBypassStream(req, {});
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.resultado).toBe("escrito");

    const archivoFinal = path.join(tempRaizClassroom, "Ingenieria", "Fisica 2", "Teorias", "Palacio", "05_capacitores.pdf");
    expect(fsSync.existsSync(archivoFinal)).toBe(true);
    expect(fsSync.existsSync(archivoFinal + ".part")).toBe(false);

    // Revisar índice
    const indiceActualizado = JSON.parse(await fs.readFile(path.join(tempRaizClassroom, NOMBRE_INDICE), "utf8"));
    expect(indiceActualizado.archivos["google-classroom:A1"]).toBeDefined();
    expect(indiceActualizado.archivos["google-classroom:A1"].nombre).toBe("05_capacitores.pdf");
    expect(indiceActualizado.archivos["google-classroom:A1"].ruta).toBe("Ingenieria/Fisica 2/Teorias/Palacio");
  });

  it("índice ilegible -> 409 INDICE_ILEGIBLE y ningún archivo ni .part creado", async () => {
    // Escribir índice corrupto
    await fs.writeFile(path.join(tempRaizClassroom, NOMBRE_INDICE), "{ version: 1, corrupto: true", "utf8");

    const chunk = Buffer.from("datos");
    const req = new Request("http://127.0.0.1:3001/api/bypass-stream", {
      method: "POST",
      headers: {
        "content-length": String(chunk.length),
        "x-video-title": encodeURIComponent("Test"),
        "x-chunk-index": "0",
        "x-total-chunks": "1",
        "x-site-folder": "google-classroom",
        "x-destino-portal": "google-classroom",
        "x-destino-ruta": encodeURIComponent("Ingenieria/Fisica 2/Teorias"),
        "x-clave-archivo": "google-classroom:A_corrupt",
        "x-clave-curso": "google-classroom:C1",
        "x-session-id": "sesion-ilegible",
      },
      body: chunk,
    });

    const res = await handleBypassStream(req, {});
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.codigo).toBe("INDICE_ILEGIBLE");

    // Verificar que no se creó ningún archivo ni .part en toda la raíz
    const entradas = await fs.readdir(tempRaizClassroom);
    expect(entradas).toEqual([NOMBRE_INDICE]);
  });

  it("E-5: handleCancelarDescarga borra el .part de descarga en modo destino y NO el archivo final", async () => {
    await fs.mkdir(path.join(tempRaizClassroom, "Ingenieria", "Fisica 2", "Teorias"), { recursive: true });

    const archivoFinal = path.join(tempRaizClassroom, "Ingenieria", "Fisica 2", "Teorias", "documento.pdf");
    await fs.writeFile(archivoFinal, "archivo_final_previo", "utf8");

    const indice = {
      version: 1,
      cursos: {
        "google-classroom:C1": {
          nombre: "Física II",
          materia: "Ingenieria/Fisica 2",
          docente: "",
          temas: {},
        },
      },
      archivos: {},
    };
    await fs.writeFile(path.join(tempRaizClassroom, NOMBRE_INDICE), JSON.stringify(indice), "utf8");

    // Enviar chunk 0 de 2 (descarga a medias)
    const chunk = Buffer.from("parte_1_");
    const req = new Request("http://127.0.0.1:3001/api/bypass-stream", {
      method: "POST",
      headers: {
        "content-length": String(chunk.length),
        "x-video-title": encodeURIComponent("Documento"),
        "x-file-name": encodeURIComponent("documento.pdf"),
        "x-chunk-index": "0",
        "x-total-chunks": "2",
        "x-site-folder": "google-classroom",
        "x-destino-portal": "google-classroom",
        "x-destino-ruta": encodeURIComponent("Ingenieria/Fisica 2/Teorias"),
        "x-clave-archivo": "google-classroom:A_cancel",
        "x-clave-curso": "google-classroom:C1",
        "x-session-id": "sesion-cancel-123",
      },
      body: chunk,
    });

    const res = await handleBypassStream(req, {});
    expect(res.status).toBe(200);

    // Comprobar que existe el .part y que el archivoFinal sigue intacto
    expect(fsSync.existsSync(archivoFinal + ".part")).toBe(true);
    expect(fsSync.existsSync(archivoFinal)).toBe(true);

    // Cancelar la descarga
    const cancelUrl = new URL("http://127.0.0.1:3001/api/cancelar-descarga?titulo=Documento&sitio=google-classroom&sessionId=sesion-cancel-123");
    const resCancel = await handleCancelarDescarga(cancelUrl, {});
    expect(resCancel.status).toBe(200);

    // El .part debe haberse borrado
    expect(fsSync.existsSync(archivoFinal + ".part")).toBe(false);
    // El archivo final debe permanecer intacto con su contenido original
    expect(fsSync.existsSync(archivoFinal)).toBe(true);
    expect(await fs.readFile(archivoFinal, "utf8")).toBe("archivo_final_previo");
  });
});
