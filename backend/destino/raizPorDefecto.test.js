import { describe, it, expect } from "vitest";
import path from "node:path";
import { elegirRaizPorDefecto } from "./raizPorDefecto.js";

describe("backend/destino/raizPorDefecto.js", () => {
  it("carpeta heredada existe -> devuelve la heredada", () => {
    const home = "/home/usuario";
    const rutaHeredada = path.join(home, "Downloads", "RamonNet_Turbo");
    const existe = (ruta) => ruta === rutaHeredada;

    const resultado = elegirRaizPorDefecto({ home, existe });
    expect(resultado).toBe(rutaHeredada);
  });

  it("carpeta heredada no existe -> devuelve CourseDownloader", () => {
    const home = "/home/usuario";
    const existe = () => false;

    const resultado = elegirRaizPorDefecto({ home, existe });
    expect(resultado).toBe(path.join(home, "Downloads", "CourseDownloader"));
  });

  it("home vacío no revienta y devuelve ruta relativa", () => {
    const existe = () => false;

    const resultado = elegirRaizPorDefecto({ home: "", existe });
    expect(resultado).toBe(path.join("Downloads", "CourseDownloader"));
  });
});
