import { describe, it, expect } from "vitest";
import {
  formatoReloj,
  textoFase,
  textoRestante,
  vistaLoaderRecorrido,
  vistaLoaderCurso,
} from "./progresoEscaneo";
import type { RecorridoTodos } from "./recorridoTodos";

describe("progresoEscaneo — formatoReloj", () => {
  it("formatea 7000 ms a 0:07", () => {
    expect(formatoReloj(7000)).toBe("0:07");
  });

  it("formatea 83000 ms a 1:23", () => {
    expect(formatoReloj(83000)).toBe("1:23");
  });

  it("formatea 725000 ms a 12:05", () => {
    expect(formatoReloj(725000)).toBe("12:05");
  });

  it("negativos y cero devuelven 0:00", () => {
    expect(formatoReloj(0)).toBe("0:00");
    expect(formatoReloj(-5000)).toBe("0:00");
    expect(formatoReloj(NaN)).toBe("0:00");
  });
});

describe("progresoEscaneo — textoFase", () => {
  it("fase trabajo en plural y singular", () => {
    expect(textoFase({ fase: "trabajo", publicaciones: 5 })).toBe(
      "Trabajo en clase · 5 publicaciones"
    );
    expect(textoFase({ fase: "trabajo", publicaciones: 1 })).toBe(
      "Trabajo en clase · 1 publicación"
    );
    expect(textoFase({ fase: "trabajo" })).toBe(
      "Trabajo en clase · 0 publicaciones"
    );
  });

  it("fase ver-mas con conteo de verMas y publicaciones", () => {
    expect(textoFase({ fase: "ver-mas", verMas: 3, publicaciones: 12 })).toBe(
      "Cargando más publicaciones (3) · 12 publicaciones"
    );
    expect(textoFase({ fase: "ver-mas", verMas: 1, publicaciones: 1 })).toBe(
      "Cargando más publicaciones (1) · 1 publicación"
    );
  });

  it("fase novedades en plural y singular", () => {
    expect(textoFase({ fase: "novedades", archivos: 8 })).toBe(
      "Novedades · 8 archivos hasta ahora"
    );
    expect(textoFase({ fase: "novedades", archivos: 1 })).toBe(
      "Novedades · 1 archivo hasta ahora"
    );
    expect(textoFase({ fase: "novedades" })).toBe(
      "Novedades · 0 archivos hasta ahora"
    );
  });
});

describe("progresoEscaneo — textoRestante (AC-3)", () => {
  const armarRecorrido = (
    terminados: number,
    duracionMsPromedio: number,
    totalCursos = 7
  ): RecorridoTodos => {
    const cursos: RecorridoTodos["cursos"] = [];
    for (let i = 0; i < totalCursos; i++) {
      if (i < terminados) {
        cursos.push({
          id: `c${i}`,
          nombre: `Curso ${i}`,
          resultado: "ok",
          duracionMs: duracionMsPromedio,
        });
      } else {
        cursos.push({
          id: `c${i}`,
          nombre: `Curso ${i}`,
        });
      }
    }
    return {
      idRecorrido: 10,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos,
      indice: terminados,
      ultimaSenal: 1000,
      materializado: false,
    };
  };

  it("1 terminado (40 s): sin estimación (null)", () => {
    const r = armarRecorrido(1, 40000);
    expect(textoRestante(r)).toBeNull();
  });

  it("2 terminados (40 s en 7 cursos): ≈ 4 min restantes", () => {
    // 5 pendientes * 40.000 ms = 200.000 ms -> 3.33 min -> redondeo arriba = 4 min
    const r = armarRecorrido(2, 40000);
    expect(textoRestante(r)).toBe("≈ 4 min restantes");
  });

  it("6 terminados (30 s en 7 cursos): ≈ 1 min restante", () => {
    // 1 pendiente * 30.000 ms = 30.000 ms -> 0.5 min -> redondeo arriba = 1 min
    const r = armarRecorrido(6, 30000);
    expect(textoRestante(r)).toBe("≈ 1 min restante");
  });
});

describe("progresoEscaneo — vistaLoaderRecorrido (AC-2)", () => {
  it("recorrido sin cursos devuelve mensaje inicial de búsqueda", () => {
    const r: RecorridoTodos = {
      idRecorrido: 50,
      tabId: 1,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [],
      indice: 0,
      ultimaSenal: 1000,
      materializado: false,
      lanzadoEn: 500,
    };
    const vista = vistaLoaderRecorrido(r, "Google Classroom");
    expect(vista.titulo).toBe("Escaneando todos los cursos");
    expect(vista.actual).toEqual({ posicion: null, nombre: null, detalle: "Buscando tus cursos…" });
    expect(vista.contadores).toBeNull();
    expect(vista.restante).toBeNull();
    expect(vista.cursos).toEqual([]);
    expect(vista.pie).toEqual([
      "Dejá Google Classroom al frente.",
      "Podés cerrar este popup.",
    ]);
    expect(vista.desde).toBe(500);
  });

  it("AC-2: 7 cursos, 1 ok, 1 vacío, en el 3º -> líneas y marcas ✓ ○ ▸ · · · ·", () => {
    const r: RecorridoTodos = {
      idRecorrido: 777,
      tabId: 2,
      sitioId: "google-classroom",
      estado: "escaneando",
      cursos: [
        { id: "c1", nombre: "Física I", resultado: "ok", duracionMs: 20000 },
        { id: "c2", nombre: "Química", resultado: "vacio", duracionMs: 15000 },
        { id: "c3", nombre: "Análisis II" },
        { id: "c4", nombre: "Álgebra" },
        { id: "c5", nombre: "Sistemas" },
        { id: "c6", nombre: "Probabilidad" },
        { id: "c7", nombre: "Termodinámica" },
      ],
      indice: 2,
      ultimaSenal: 5000,
      materializado: false,
      lanzadoEn: 1000,
      actual: {
        indice: 2,
        fase: "ver-mas",
        verMas: 2,
        publicaciones: 8,
        archivos: 0,
      },
    };

    const vista = vistaLoaderRecorrido(r, "Google Classroom");
    expect(vista.titulo).toBe("Escaneando todos los cursos");
    expect(vista.actual).toEqual({
      posicion: "Curso 3 de 7",
      nombre: "Análisis II",
      detalle: "Cargando más publicaciones (2) · 8 publicaciones",
    });
    expect(vista.contadores).toEqual({ listos: 1, vacios: 1, fallidos: 0 });
    // 2 cursos con duración promedian (20+15)/2 = 17.5 s. Pendientes = 7 - 2 = 5. 5 * 17.5 = 87.5 s -> 2 min
    expect(vista.restante).toBe("≈ 2 min restantes");

    const marcas = vista.cursos.map((c) => c.marca);
    expect(marcas).toEqual(["✓", "○", "▸", "·", "·", "·", "·"]);
    expect(vista.cursos[2]?.actual).toBe(true);
    expect(vista.cursos[0]?.actual).toBe(false);

    expect(vista.pie).toEqual([
      "Dejá Google Classroom al frente.",
      "Podés cerrar este popup.",
    ]);
    expect(vista.desde).toBe(1000);
  });
});

describe("progresoEscaneo — vistaLoaderCurso", () => {
  it("genera vista con texto de fase y pie sin cerrar popup (RN-8)", () => {
    const vista = vistaLoaderCurso(
      {
        fase: "trabajo",
        publicaciones: 15,
      },
      "Google Classroom"
    );
    expect(vista.actual).toEqual({
      posicion: null,
      nombre: null,
      detalle: "Trabajo en clase · 15 publicaciones",
    });
    expect(vista.contadores).toBeNull();
    expect(vista.cursos).toEqual([]);
    expect(vista.pie).toEqual(["Dejá Google Classroom al frente."]);
  });
});
