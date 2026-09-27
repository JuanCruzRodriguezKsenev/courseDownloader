import { sanearNombreCarpeta } from "../util/texto";

const MAPA_ROMANOS: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

function extraerNumeroModulo(romanoODigitos: string): number | null {
  const norm = romanoODigitos.toUpperCase();
  if (MAPA_ROMANOS[norm] !== undefined) {
    return MAPA_ROMANOS[norm];
  }
  const n = parseInt(norm, 10);
  return Number.isNaN(n) ? null : n;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface OpcionesProponerNombre {
  original: string;
  tema?: string | null;
  docente?: string | null;
}

/**
 * Extrae la primera frase representativa de un anuncio de Novedades (RN-16a).
 * Quita saludos, muletillas y artículos iniciales, corta en el primer salto
 * de línea o fin de oración y toma hasta 8 palabras.
 */
export function primeraFrase(texto?: string | null): string {
  let t = (texto || "").trim();

  // 1. Saludos al principio (pueden repetirse)
  const regSaludos =
    /^(?:(?:hola+|buen(?:os|as)?\s+(?:d[ií]as?|tardes|noches)|buenas|buen\s+d[ií]a|estimad[oa]s?(?:\/[oa]s)?|querid[oa]s?(?:\/[oa]s)?)(?:\s+a\s+todos(?:\/as)?)?[\s,;:!¡.]*)+/iu;
  t = t.replace(regSaludos, "");

  // 2. Una muletilla al principio
  const regMuletilla =
    /^(?:les\s+(?:dejamos|dejo|compartimos|comparto|adjunto|adjuntamos)\s+|adjunto\s+(?:a\s+este\s+mensaje\s+)?|en\s+el\s+archivo\s+adjunto,?\s+(?:encontrar[aá]n\s+)?)/iu;
  t = t.replace(regMuletilla, "");

  // 3. Un artículo al principio
  const regArticulo = /^(?:las|los|la|el|un|una|unos|unas)\s+/iu;
  t = t.replace(regArticulo, "");

  // 4. Cortar en el primer \n o en el primer ., ! o ? seguido de espacio o fin de cadena
  const corte = t.search(/\n|[.!?](?=\s|$)/);
  if (corte !== -1) {
    t = t.slice(0, corte);
  }

  // 5. Primeras 8 palabras
  return t
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
}

export function proponerNombre({ original, tema, docente }: OpcionesProponerNombre): string {
  const orig = original || "";

  // 1. Extensión
  const matchExt = orig.match(/\.([A-Za-z0-9]{1,5})$/);
  const ext = matchExt && matchExt[1] ? "." + matchExt[1].toLowerCase() : "";
  let base = matchExt ? orig.slice(0, matchExt.index) : orig;
  const originalSinExt = base;

  // 2. Extensiones internas
  base = base.replace(/\.(pdf|docx?|pptx?|xlsx?|mp4|mov|jpe?g|png)(?=$|[^a-z0-9])/gi, "");

  // 3. Docente
  const doc = (docente || "").trim();
  if (doc.length > 0) {
    const regDocente = new RegExp(`^\\s*${escaparRegex(doc)}\\s*[-–:]\\s*`, "i");
    base = base.replace(regDocente, "");
  }

  // 4. Copia al final
  base = base.replace(/\s*\(\d+\)\s*$/, "");

  // 5. Año al final
  base = base.replace(/[\s_\-.]*(19|20)\d{2}\s*$/, "");

  // 6. Número de orden
  let nn = "";
  let resto = base;
  const matchNum = base.match(/^\s*(?:clase|pr[aá]ctica|tp|p|c)?\s*(\d{1,2})(?!\d)[\s.\-–:)]*/i);
  if (matchNum && matchNum[1] && matchNum[0]) {
    nn = matchNum[1].padStart(2, "0");
    resto = base.slice(matchNum[0].length);
  }

  // 7. Slug
  let slug = sanearNombreCarpeta(resto);
  if (!slug) {
    const slugOrig = sanearNombreCarpeta(originalSinExt);
    if (slugOrig !== nn) {
      slug = slugOrig;
    }
  }

  // 8. Módulo, sólo desde el tema (RN-12)
  let modN = "";
  if (tema) {
    const matchMod = tema.match(/m[oó]dulo\s+([IVX]+|\d+)\b/i);
    if (matchMod && matchMod[1]) {
      const num = extraerNumeroModulo(matchMod[1]);
      if (num !== null) {
        modN = `mod${num}`;
      }
    }
  }

  // 9. Resultado: [modN, NN, slug], sin los vacíos, unidos con _, más .ext si había
  const partes = [modN, nn, slug].filter(Boolean);
  const nombreBase = partes.join("_") || "archivo";
  return nombreBase + ext;
}
