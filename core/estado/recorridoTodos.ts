/**
 * NÚCLEO — ESTADO DEL RECORRIDO DE TODOS LOS CURSOS (V1.1.0)
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [LOADER CON PROGRESO] Evento "progreso", FaseEscaneo, duracionMs por curso,
 *   lanzadoEn e indicador "actual" en RecorridoTodos.
 * - [ESTADO TERMINAL] "progreso" se ignora en estado terminal.
 * - [LATIDO Y CURSO] "latido" y "curso" limpian "actual".
 *
 * CHANGELOG v1.0.1:
 * - [ESTADO TERMINAL] Si el recorrido no está en estado "escaneando", ignora
 *   eventos "latido", "curso" y "fin" para no revivir un recorrido ya cerrado
 *   (terminado o cortado). "materializado" sigue aplicándose tras "fin".
 *
 * CHANGELOG v1.0.0:
 * - Estado puro del escaneo multi-curso (Google Classroom portada).
 * - No contiene dependencias de `chrome.*` ni realiza mutaciones directas.
 * - Permite reducir eventos en un estado inmutable y persistible,
 *   inspeccionar vigencia, calcular resúmenes y materializar enlaces.
 * ==========================================================================
 */
import type { PuertoAlmacenamiento } from "../puertos/almacenamiento";

export type EstadoRecorrido = "escaneando" | "terminado" | "cortado";

export type FaseEscaneo = "trabajo" | "ver-mas" | "novedades";

export interface CursoRecorrido {
  id: string;
  nombre: string;
  resultado?: "ok" | "vacio" | "fallido";
  motivo?: string;
  enlaces?: unknown[];
  adjuntosSinResolver?: number;
  duracionMs?: number;
}

export interface RecorridoTodos {
  idRecorrido: number;
  tabId: number;
  sitioId: string;
  estado: EstadoRecorrido;
  cursos: CursoRecorrido[];
  indice: number;
  ultimaSenal: number; // ms epoch del último evento
  motivoCorte?: "visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta";
  materializado: boolean;
  lanzadoEn?: number;
  actual?: {
    indice: number;
    fase: FaseEscaneo;
    verMas: number;
    publicaciones: number;
    archivos: number;
  };
}

export type EventoRecorrido =
  | {
      tipo: "inicio";
      idRecorrido: number;
      tabId: number;
      sitioId: string;
      cursos: { id: string; nombre: string }[];
      lanzadoEn?: number;
    }
  | {
      tipo: "latido";
      idRecorrido: number;
      indice: number;
    }
  | {
      tipo: "progreso";
      idRecorrido: number;
      indice: number;
      fase: FaseEscaneo;
      verMas: number;
      publicaciones: number;
      archivos: number;
    }
  | {
      tipo: "curso";
      idRecorrido: number;
      indice: number;
      resultado: "ok" | "vacio" | "fallido";
      motivo?: string;
      enlaces?: unknown[];
      adjuntosSinResolver?: number;
      duracionMs?: number;
    }
  | {
      tipo: "fin";
      idRecorrido: number;
      estado: "terminado" | "cortado";
      motivoCorte?: "visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta";
    }
  | {
      tipo: "materializado";
      idRecorrido: number;
    };

export const CLAVE_STORAGE = "recorridoTodos";

export function aplicarEvento(
  prev: RecorridoTodos | null,
  ev: EventoRecorrido,
  ahora: number
): RecorridoTodos | null {
  if (ev.tipo === "inicio") {
    return {
      idRecorrido: ev.idRecorrido,
      tabId: ev.tabId,
      sitioId: ev.sitioId,
      estado: "escaneando",
      cursos: ev.cursos.map((c) => ({ id: c.id, nombre: c.nombre })),
      indice: 0,
      ultimaSenal: ahora,
      materializado: false,
      ...(ev.lanzadoEn !== undefined ? { lanzadoEn: ev.lanzadoEn } : {}),
    };
  }

  if (!prev) return null;
  if (ev.idRecorrido !== prev.idRecorrido) return prev;

  if (
    prev.estado !== "escaneando" &&
    (ev.tipo === "latido" || ev.tipo === "curso" || ev.tipo === "fin" || ev.tipo === "progreso")
  ) {
    return prev;
  }

  if (ev.tipo === "progreso") {
    if (ev.indice !== prev.indice) return prev;
    return {
      ...prev,
      actual: {
        indice: ev.indice,
        fase: ev.fase,
        verMas: ev.verMas,
        publicaciones: ev.publicaciones,
        archivos: ev.archivos,
      },
      ultimaSenal: ahora,
    };
  }

  if (ev.tipo === "latido") {
    const copia = {
      ...prev,
      indice: ev.indice,
      ultimaSenal: ahora,
    };
    delete copia.actual;
    return copia;
  }

  if (ev.tipo === "curso") {
    const cursos = [...prev.cursos];
    const cursoExistente = cursos[ev.indice];
    if (cursoExistente) {
      cursos[ev.indice] = {
        ...cursoExistente,
        resultado: ev.resultado,
        ...(ev.motivo !== undefined ? { motivo: ev.motivo } : {}),
        ...(ev.enlaces !== undefined ? { enlaces: ev.enlaces } : {}),
        ...(ev.adjuntosSinResolver !== undefined
          ? { adjuntosSinResolver: ev.adjuntosSinResolver }
          : {}),
        ...(ev.duracionMs !== undefined ? { duracionMs: ev.duracionMs } : {}),
      };
    }
    const copia = {
      ...prev,
      cursos,
      ultimaSenal: ahora,
    };
    delete copia.actual;
    return copia;
  }

  if (ev.tipo === "fin") {
    return {
      ...prev,
      estado: ev.estado,
      ...(ev.motivoCorte ? { motivoCorte: ev.motivoCorte } : {}),
      ultimaSenal: ahora,
    };
  }

  if (ev.tipo === "materializado") {
    return {
      ...prev,
      materializado: true,
      cursos: prev.cursos.map((c) => {
        const copia = { ...c };
        delete copia.enlaces;
        return copia;
      }),
      ultimaSenal: ahora,
    };
  }

  return prev;
}

export function esVigente(r: RecorridoTodos, ahora: number, topeCursoMs: number): boolean {
  if (r.estado !== "escaneando") return true;
  return ahora - r.ultimaSenal <= topeCursoMs + 30000;
}

export function resumen(r: RecorridoTodos): {
  total: number;
  ok: number;
  vacios: number;
  fallidos: { nombre: string; motivo: string }[];
  sinRecorrer: number;
} {
  const total = r.cursos.length;
  let ok = 0;
  let vacios = 0;
  const fallidos: { nombre: string; motivo: string }[] = [];
  let sinRecorrer = 0;

  for (const c of r.cursos) {
    if (c.resultado === "ok") {
      ok++;
    } else if (c.resultado === "vacio") {
      vacios++;
    } else if (c.resultado === "fallido") {
      fallidos.push({ nombre: c.nombre, motivo: c.motivo || "" });
    } else {
      sinRecorrer++;
    }
  }

  return { total, ok, vacios, fallidos, sinRecorrer };
}

export function textoResumen(r: RecorridoTodos): string {
  const res = resumen(r);
  const lineas: string[] = [
    `${res.total} cursos: ${res.ok} con material · ${res.vacios} vacíos · ${res.fallidos.length} fallidos`,
  ];
  for (const f of res.fallidos) {
    lineas.push(`⚠ ${f.nombre}: ${f.motivo}`);
  }
  if (r.estado === "cortado") {
    const mapaMotivos: Record<string, string> = {
      visibilidad: "Classroom quedó en segundo plano",
      navegacion: "navegaste fuera del recorrido",
      "sin-respuesta": "el recorrido dejó de responder",
      "sin-cursos": "no encontramos cursos en la portada",
    };
    const motivoLegible =
      (r.motivoCorte && mapaMotivos[r.motivoCorte]) || r.motivoCorte || "motivo desconocido";
    lineas.push(
      `Se cortó en el curso ${r.indice + 1} de ${res.total}: ${motivoLegible}. Quedaron ${res.sinRecorrer} sin recorrer.`
    );
  }
  return lineas.join("\n");
}

export function enlacesDe(r: RecorridoTodos): { enlaces: unknown[]; adjuntosSinResolver: number } {
  let enlaces: unknown[] = [];
  let adjuntosSinResolver = 0;
  for (const c of r.cursos) {
    if (c.resultado === "ok" && Array.isArray(c.enlaces)) {
      enlaces = enlaces.concat(c.enlaces);
    }
    if (typeof c.adjuntosSinResolver === "number") {
      adjuntosSinResolver += c.adjuntosSinResolver;
    }
  }
  return { enlaces, adjuntosSinResolver };
}

export function esRecorridoTodos(v: unknown): v is RecorridoTodos {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Partial<RecorridoTodos>;
  return (
    typeof r.idRecorrido === "number" &&
    typeof r.tabId === "number" &&
    typeof r.sitioId === "string" &&
    (r.estado === "escaneando" || r.estado === "terminado" || r.estado === "cortado") &&
    Array.isArray(r.cursos) &&
    typeof r.indice === "number" &&
    typeof r.ultimaSenal === "number" &&
    typeof r.materializado === "boolean"
  );
}

export function crearLectorRecorrido(almacenamiento: PuertoAlmacenamiento) {
  const subs = new Set<(r: RecorridoTodos | null) => void>();
  let desengancharOyente: (() => void) | null = null;

  async function leer(): Promise<RecorridoTodos | null> {
    const data = await almacenamiento.obtenerLocal<Record<string, unknown>>([CLAVE_STORAGE]);
    const v = data[CLAVE_STORAGE];
    return esRecorridoTodos(v) ? v : null;
  }

  function engancharOyente(): void {
    if (desengancharOyente) return;
    desengancharOyente = almacenamiento.onCambio((cambios, ambito) => {
      if (ambito !== "local") return;
      if (!cambios[CLAVE_STORAGE]) return;
      const nuevo = cambios[CLAVE_STORAGE]?.newValue;
      const actual = esRecorridoTodos(nuevo) ? nuevo : null;
      subs.forEach((cb) => {
        try {
          cb(actual);
        } catch (e) {
          console.warn("[RecorridoTodos] Error en suscriptor:", e);
        }
      });
    });
  }

  return {
    CLAVE_STORAGE,
    leer,
    suscribir(cb: (r: RecorridoTodos | null) => void): () => void {
      engancharOyente();
      subs.add(cb);
      return () => {
        subs.delete(cb);
        if (subs.size === 0 && desengancharOyente) {
          desengancharOyente();
          desengancharOyente = null;
        }
      };
    },
  };
}

export type LectorRecorrido = ReturnType<typeof crearLectorRecorrido>;
