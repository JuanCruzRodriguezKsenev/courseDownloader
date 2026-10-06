import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extraerBloque(contenido, ruta) {
  const inicio = contenido.indexOf("// <recorrido-moodle>");
  const fin = contenido.indexOf("// </recorrido-moodle>");
  if (inicio === -1 || fin === -1 || fin <= inicio) {
    throw new Error(
      `los tres recorridos Moodle deben ser idénticos (falta marcador en ${ruta})`
    );
  }
  return contenido
    .slice(inicio + "// <recorrido-moodle>".length, fin)
    .trim();
}

describe("Paridad del bloque de recorrido Moodle", () => {
  it("el bloque <recorrido-moodle> es idéntico byte a byte entre los tres scrapers", () => {
    const rutaLinti = path.join(__dirname, "moodle-linti/scraper.js");
    const rutaAsignaturas = path.join(__dirname, "moodle-asignaturas/scraper.js");
    const rutaIngenieria = path.join(__dirname, "moodle-ingenieria/scraper.js");

    const contenidoLinti = fs.readFileSync(rutaLinti, "utf-8");
    const contenidoAsignaturas = fs.readFileSync(rutaAsignaturas, "utf-8");
    const contenidoIngenieria = fs.readFileSync(rutaIngenieria, "utf-8");

    const bloqueLinti = extraerBloque(contenidoLinti, rutaLinti);
    const bloqueAsignaturas = extraerBloque(contenidoAsignaturas, rutaAsignaturas);
    const bloqueIngenieria = extraerBloque(contenidoIngenieria, rutaIngenieria);

    expect(
      bloqueLinti,
      "los tres recorridos Moodle deben ser idénticos (LINTI vs Asignaturas)"
    ).toBe(bloqueAsignaturas);
    expect(
      bloqueAsignaturas,
      "los tres recorridos Moodle deben ser idénticos (Asignaturas vs Ingeniería)"
    ).toBe(bloqueIngenieria);
  });
});
