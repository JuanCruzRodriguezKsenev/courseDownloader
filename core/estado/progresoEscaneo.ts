/**
 * NÚCLEO — PROGRESO Y TEXTOS DEL LOADER (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - Funciones puras para formateo de tiempos, textos de fases y vistas del
 *   loader con progreso para el escaneo de un curso y el recorrido completo.
 * ==========================================================================
 */
import type { RecorridoTodos, FaseEscaneo } from "./recorridoTodos";
import { resumen } from "./recorridoTodos";

export interface ElementoCursoLoader {
  nombre: string;
  marca: "✓" | "○" | "✗" | "▸" | "·";
  actual: boolean;
}

export interface VistaLoader {
  titulo?: string;
  lineas: string[];
  cursos: ElementoCursoLoader[];
  pie: string[];
  desde?: number;
}

export interface ProgresoCurso {
  fase: FaseEscaneo;
  verMas?: number;
  publicaciones?: number;
  archivos?: number;
  nombre?: string;
}

/**
 * Formatea milisegundos en formato reloj `m:ss`.
 * Negativos o NaN devuelven `0:00`.
 */
export function formatoReloj(ms: number): string {
  if (ms <= 0 || isNaN(ms)) return "0:00";
  const totalSegundos = Math.floor(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;
  return `${minutos}:${segundos.toString().padStart(2, "0")}`;
}

/**
 * Genera el texto legible de la fase y avance actual.
 */
export function textoFase(datos: {
  fase: FaseEscaneo;
  verMas?: number;
  publicaciones?: number;
  archivos?: number;
}): string {
  const pub = datos.publicaciones ?? 0;
  const pubStr = pub === 1 ? "1 publicación" : `${pub} publicaciones`;

  if (datos.fase === "trabajo") {
    return `Trabajo en clase · ${pubStr}`;
  }
  if (datos.fase === "ver-mas") {
    const vm = datos.verMas ?? 0;
    return `Cargando más publicaciones (${vm}) · ${pubStr}`;
  }
  if (datos.fase === "novedades") {
    const arc = datos.archivos ?? 0;
    const arcStr = arc === 1 ? "1 archivo" : `${arc} archivos`;
    return `Novedades · ${arcStr} hasta ahora`;
  }
  return "";
}

/**
 * Estima el tiempo restante para el recorrido si hay al menos 2 cursos con duración.
 */
export function textoRestante(r: RecorridoTodos): string | null {
  const terminadosConDuracion = r.cursos.filter(
    (c) => c.resultado !== undefined && typeof c.duracionMs === "number"
  );
  if (terminadosConDuracion.length < 2) return null;

  const totalDuracion = terminadosConDuracion.reduce((sum, c) => sum + (c.duracionMs || 0), 0);
  const promedio = totalDuracion / terminadosConDuracion.length;

  const cursosConResultado = r.cursos.filter((c) => c.resultado !== undefined).length;
  const pendientes = r.cursos.length - cursosConResultado;

  const msEstimados = promedio * pendientes;
  const minutos = Math.ceil(msEstimados / 60000);

  if (minutos <= 1) {
    return "≈ 1 min restante";
  }
  return `≈ ${minutos} min restantes`;
}

/**
 * Genera la vista completa del loader para un recorrido multi-curso.
 */
export function vistaLoaderRecorrido(r: RecorridoTodos, nombrePortal: string): VistaLoader {
  const titulo = "Escaneando todos los cursos";
  const pie = [`Dejá ${nombrePortal} al frente.`, "Podés cerrar este popup."];
  const desde = r.lanzadoEn ?? r.idRecorrido;

  if (!r.cursos || r.cursos.length === 0) {
    return {
      titulo,
      lineas: ["Buscando tus cursos…"],
      cursos: [],
      pie,
      desde,
    };
  }

  const res = resumen(r);
  const cursoActual = r.cursos[r.indice] || { nombre: "" };
  const lineas: string[] = [`Curso ${r.indice + 1} de ${r.cursos.length}: ${cursoActual.nombre}`];

  if (r.actual) {
    lineas.push(textoFase(r.actual));
  }

  lineas.push(`Listos: ${res.ok} · Vacíos: ${res.vacios} · Fallidos: ${res.fallidos.length}`);

  const restante = textoRestante(r);
  if (restante !== null) {
    lineas.push(restante);
  }

  const cursos: ElementoCursoLoader[] = r.cursos.map((c, idx) => {
    let marca: ElementoCursoLoader["marca"] = "·";
    if (c.resultado === "ok") {
      marca = "✓";
    } else if (c.resultado === "vacio") {
      marca = "○";
    } else if (c.resultado === "fallido") {
      marca = "✗";
    } else if (idx === r.indice) {
      marca = "▸";
    }
    return {
      nombre: c.nombre,
      marca,
      actual: idx === r.indice,
    };
  });

  return {
    titulo,
    lineas,
    cursos,
    pie,
    desde,
  };
}

/**
 * Genera la vista del loader para el escaneo de un solo curso.
 */
export function vistaLoaderCurso(progreso: ProgresoCurso, nombrePortal: string): VistaLoader {
  return {
    lineas: [textoFase(progreso)],
    cursos: [],
    pie: [`Dejá ${nombrePortal} al frente.`],
  };
}
