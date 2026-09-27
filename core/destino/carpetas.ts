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
  { regex: /video|simulaci/i, destino: "Teorias" },
  { regex: /gu[ií]a|\btp\b|pr[aá]ctic|ejercici|problema/i, destino: "Practicas" },
];

export function sugerirDestino(tema?: string | null): { destino: Destino; regla: boolean } {
  const t = (tema || "").trim();
  for (const { regex, destino } of REGLAS_DESTINO) {
    if (regex.test(t)) {
      return { destino, regla: true };
    }
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
