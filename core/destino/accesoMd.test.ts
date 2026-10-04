import { describe, it, expect } from "vitest";
import { accesoADataUri } from "./accesoMd.ts";

function decodificarBase64Utf8(b64: string): string {
  const binario = atob(b64);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

describe("core/destino/accesoMd.ts", () => {
  it("maneja una URL con : y %3A", () => {
    const url = "https://ejemplo.com:8080/buscar?q=clave%3Avalor";
    const titulo = "Búsqueda avanzada";
    const idArchivo = `acceso:${encodeURIComponent(url)}:${encodeURIComponent(titulo)}`;

    const dataUri = accesoADataUri(idArchivo, "2026-10-02");
    expect(dataUri.startsWith("data:text/markdown;charset=utf-8;base64,")).toBe(true);

    const b64 = dataUri.split(",")[1] ?? "";
    const decoded = decodificarBase64Utf8(b64);
    expect(decoded).toBe(
      `---\ntipo: acceso\nrevisado: 2026-10-02\n---\n\n# ${titulo}\n\n${url}`
    );
  });

  it("maneja un título con : reuniendo los segmentos posteriores", () => {
    const url = "https://ejemplo.com/recurso";
    const titulo = "Módulo 1: Conceptos básicos: Parte 2";
    const idArchivo = `acceso:${encodeURIComponent(url)}:${encodeURIComponent(titulo)}`;

    const dataUri = accesoADataUri(idArchivo, "2026-10-02");
    const b64 = dataUri.split(",")[1] ?? "";
    const decoded = decodificarBase64Utf8(b64);
    expect(decoded).toContain(`# ${titulo}\n\n${url}`);
  });

  it("maneja caracteres multiocteto y tildes en UTF-8", () => {
    const url = "https://ejemplo.com/teoría?sección=1";
    const titulo = "Teoría de Óptica — Año 2026 — Fisiología";
    const idArchivo = `acceso:${encodeURIComponent(url)}:${encodeURIComponent(titulo)}`;

    const dataUri = accesoADataUri(idArchivo, "2026-10-02");
    const b64 = dataUri.split(",")[1] ?? "";
    const decoded = decodificarBase64Utf8(b64);
    expect(decoded).toBe(
      `---\ntipo: acceso\nrevisado: 2026-10-02\n---\n\n# ${titulo}\n\n${url}`
    );
  });

  it("igualdad byte a byte con la salida esperada del código original", () => {
    const urlOriginal = "https://ejemplo.com";
    const tituloOriginal = "Clase";
    const idAcceso = `acceso:${encodeURIComponent(urlOriginal)}:${encodeURIComponent(tituloOriginal)}`;
    const fecha = "2026-10-15";

    const dataUri = accesoADataUri(idAcceso, fecha);

    const b64Esperado = "LS0tCnRpcG86IGFjY2VzbwpyZXZpc2FkbzogMjAyNi0xMC0xNQotLS0KCiMgQ2xhc2UKCmh0dHBzOi8vZWplbXBsby5jb20=";
    const uriEsperado = `data:text/markdown;charset=utf-8;base64,${b64Esperado}`;

    expect(dataUri).toBe(uriEsperado);
  });
});
