export const DESTINOS = [
  ".",
  "Teorias",
  "Practicas",
  "Laboratorios",
  "Parciales",
  "Finales",
  "Bibliografia",
] as const;

export type Destino = (typeof DESTINOS)[number];

const REGLAS_DESTINO: { regex: RegExp; destino: Destino }[] = [
  { regex: /^(novedades|sin tema)$/i, destino: "." },
  { regex: /cronograma/i, destino: "." },
  { regex: /bibliograf|libro/i, destino: "Bibliografia" },
  { regex: /laborator/i, destino: "Laboratorios" },
  { regex: /^(parcial|notas de evaluaci|examen|recuperatorio)/i, destino: "Parciales" },
  { regex: /^final/i, destino: "Finales" },
  { regex: /te[oó]ric|teor[ií]a/i, destino: "Teorias" },
  { regex: /video|simulaci|\blinks?\b/i, destino: "Teorias" },
  { regex: /gu[ií]a|\btp\b|pr[aá]ctic|ejercici|problema/i, destino: "Practicas" },
];

/**
 * Sugiere el destino de un tema por su nombre o por mayoría de sus publicaciones (RN-7a).
 * Caso MC2: temas con nombres conceptuales ("Complejos") cuyas publicaciones dicen "Ejercicios para practicar: ...".
 */
export function sugerirDestino(
  tema?: string | null,
  publicaciones: readonly string[] = []
): { destino: Destino; regla: boolean } {
  const t = (tema || "").trim();
  for (const { regex, destino } of REGLAS_DESTINO) {
    if (regex.test(t)) {
      return { destino, regla: true };
    }
  }

  if (publicaciones.length === 0) {
    return { destino: ".", regla: false };
  }

  const conteo = new Map<Destino, number>();
  for (const pub of publicaciones) {
    const p = (pub || "").trim();
    for (const { regex, destino } of REGLAS_DESTINO) {
      if (regex.test(p)) {
        if (destino !== ".") {
          conteo.set(destino, (conteo.get(destino) || 0) + 1);
        }
        break;
      }
    }
  }

  let destinoGanador: Destino = ".";
  let maxCuenta = 0;
  for (const [dest, cuenta] of conteo.entries()) {
    if (cuenta > maxCuenta) {
      maxCuenta = cuenta;
      destinoGanador = dest;
    }
  }

  if (maxCuenta * 2 > publicaciones.length) {
    return { destino: destinoGanador, regla: true };
  }

  return { destino: ".", regla: false };
}

export function resolverCarpeta(destino: string, docente?: string | null): string {
  const d = (docente || "").trim();
  if (destino === "Teorias" && d.length > 0) {
    return `Teorias/${d}`;
  }
  return destino;
}
