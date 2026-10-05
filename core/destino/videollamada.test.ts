import { describe, it, expect } from "vitest";
// @ts-expect-error Entorno de test en Node sin @types/node en la extensión
import { readFileSync } from "node:fs";
import {
  DOMINIOS_VIDEOLLAMADA,
  esEnlaceVideollamada,
  claveEsVideollamada,
} from "./videollamada.ts";

describe("core/destino/videollamada.ts", () => {
  it("test de deriva contra scraper.js de Classroom", () => {
    const contenido = readFileSync(
      new URL("../../sitio/google-classroom/scraper.js", import.meta.url),
      "utf8"
    );

    const match = /const dominios = \[([\s\S]*?)\];/.exec(contenido);
    expect(match).not.toBeNull();

    const dominiosScraper = (match![1] || "")
      .split("\n")
      .map((l) => l.trim().replace(/[",]/g, ""))
      .filter(Boolean);

    expect(dominiosScraper.length).toBe(7);
    expect(dominiosScraper.length).toBe(DOMINIOS_VIDEOLLAMADA.length);
    expect(new Set(dominiosScraper)).toEqual(new Set(DOMINIOS_VIDEOLLAMADA));
  });

  describe("AC-6 — Reconocer sólo videollamadas (RN-1, A7, A8)", () => {
    const casosUrl: Array<[string, boolean]> = [
      ["https://meet.google.com/abc-defg-hij", true],
      ["https://us04web.zoom.us/j/7301675", true],
      ["https://teams.live.com/meet/123", true],
      ["https://www.youtube.com/watch?v=x", false],
      ["meet.google.com.falso.com/x", false],
      ["no es una url", false],
    ];

    it.each(casosUrl)("URL %s -> %s", (url, esperado) => {
      expect(esEnlaceVideollamada(url)).toBe(esperado);
    });

    const casosClaves: Array<[string, boolean]> = [
      [
        "google-classroom:acceso:https%3A%2F%2Fmeet.google.com%2Fabc-defg-hij:Consulta%20Meet",
        true,
      ],
      ["google-classroom:1gV54mtQL7q", false],
      [
        "google-classroom:acceso:https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dx:Video",
        false,
      ],
    ];

    it.each(casosClaves)("Clave %s -> %s", (clave, esperado) => {
      expect(claveEsVideollamada(clave)).toBe(esperado);
    });

    it("maneja casos de borde en claveEsVideollamada", () => {
      expect(claveEsVideollamada("")).toBe(false);
      expect(claveEsVideollamada("acceso:incompleto")).toBe(false);
      expect(claveEsVideollamada("google-classroom:acceso:%E0%A4%A:titulo")).toBe(false);
    });
  });
});
