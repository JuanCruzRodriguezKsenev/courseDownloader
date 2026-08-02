/**
 * ADAPTADOR DE SITIO — RAMÓN NET: PARSER DE TÍTULOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CAPA 2] Movidas tal cual desde `shared/utils.js` v2.x: parseSmartDate,
 *   clasificarCatedraYCarpeta y formatTitleStructured, con sus constantes de regex.
 *   Era lo más específico de Ramón Net que quedaba en código "compartido": nombres de
 *   materias del plan de estudios, el formato "SEM mes-día", el concepto de cátedra A-D
 *   y el orden de limpieza del título. `Utils` queda con lo genérico (sanitizado,
 *   escapado HTML, acentos, cripto, fetch con reintentos, telemetría).
 *   Sin cambio de comportamiento: los 39 tests de caracterización se mudaron con el
 *   código. Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * ==========================================================================
 * QUÉ HACE
 * --------
 * De un título crudo scrapeado del aula virtual saca (a) el nombre canónico del archivo
 * y (b) la cátedra + carpeta de materia donde va guardado.
 *
 * ES LA LÓGICA MÁS SENSIBLE A REGRESIONES DEL PROYECTO. El orden de las regex importa:
 * se detecta y se LIMPIA por capas (fecha → cátedra → materia → clase → parte), y lo que
 * sobra es el "detalle". Cambiar el orden o una regex puede archivar o nombrar mal una
 * clase en silencio — sin error visible. Por eso los tests de `parserTitulos.test.js`
 * son de caracterización: describen el comportamiento REAL, no el deseado.
 *
 * Depende de `Utils.quitarAcentos` (genérico).
 */

// Constantes estáticas (performance: se compilan una sola vez).
const REGEX_SEM_FECHA = /\bSEM\s+(\d{1,2})[-/](\d{1,2})\b/i;
const REGEX_FECHA_COMPLETA = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
const REGEX_FECHA_SIMPLE = /\b(\d{1,2})[-/](\d{1,2})\b/;

const REGEX_MATERIA_DETECTION = /\b(ANATO|ANATOMIA|BIOLOGIA|BIO|HISTOLOGIA|HISTO|EMBRIOLOGIA|EMBR|EMBRIO|FISIOLOGIA|FISIO|QUIMICA|QUIM)\b/i;
const REGEX_CLASE = /\bCLASE\s*(\d+)\b/i;
const REGEX_PARTE = /\bPARTE\s*(\d+|[A-Z]|[IVXLCDM]+)\b/i;

const REGEX_CLEAN_SPACES = /\s+/g;
const REGEX_CLEAN_HUERFANOS_START = /^\s*[-_()\s.\|]+\s*/;
const REGEX_CLEAN_HUERFANOS_END = /\s*[-_()\s.\|]+\s*$/;
const REGEX_SANITIZAR_DETALLES = /[^a-zA-Z0-9 _\-().ñÑ]/g;

const ParserTitulos = {
  /**
   * Parser inteligente de fecha que previene desajustes de orden (día/mes vs mes/día).
   * Heurística: si un número es > 12 sólo puede ser el día; si ninguno lo es, se asume
   * el orden en que vinieron (día-mes).
   */
  parseSmartDate(num1Str, num2Str) {
    const num1 = parseInt(num1Str, 10);
    const num2 = parseInt(num2Str, 10);
    let day, month;

    if (num1 > 12 && num2 <= 12) {
      day = num1;
      month = num2;
    } else if (num2 > 12 && num1 <= 12) {
      day = num2;
      month = num1;
    } else {
      day = num1;
      month = num2;
    }

    return {
      day: String(day).padStart(2, '0'),
      month: String(month).padStart(2, '0')
    };
  },

  /**
   * Identifica la cátedra (A, B, C, D) y carpeta de materia basada en el título y materia
   * de referencia. El orden de los 3 intentos va de más explícito a más inferido.
   */
  clasificarCatedraYCarpeta(tituloClase, materiaBase) {
    const tituloUpper = Utils.quitarAcentos(tituloClase.toUpperCase().trim());
    const materiaLower = materiaBase.toLowerCase().trim();

    const matchExplicit = tituloUpper.match(/\b(?:CATEDRA|CAT|COMISION|COMISIÓN|COM)\s+([A-D])\b/i);
    if (matchExplicit) {
      return { catedra: matchExplicit[1].toUpperCase(), carpeta: materiaLower };
    }

    const matchMateriaLetra = tituloUpper.match(/\b(?:ANATO|ANATOMIA|BIOLOGIA|BIO|HISTOLOGIA|HISTO|EMBRIOLOGIA|EMBRIO|EMBR|FISIOLOGIA|FISIO|QUIMICA|QUIM)\s+([A-D])\b/i);
    if (matchMateriaLetra) {
      return { catedra: matchMateriaLetra[1].toUpperCase(), carpeta: materiaLower };
    }

    const matchGeneral = tituloUpper.match(/\b([A-Z]+)\s+([A-D])\b/);
    if (matchGeneral) {
      const sigla = matchGeneral[1].toLowerCase();
      const letra = matchGeneral[2].toUpperCase();
      if (materiaLower.includes(sigla) || sigla.startsWith(materiaLower.substring(0, 3))) {
        return { catedra: letra, carpeta: materiaLower };
      }
    }

    return { catedra: "COMUN", carpeta: materiaLower };
  },

  /**
   * Formatea títulos en base a la jerarquía estructurada fiel de Ramón Net
   * Formato: SEM [mes]-[dia] - [materia] [catedra] - CLASE [n] - PARTE [m] - [detalle]
   */
  formatTitleStructured(originalText, materiaBase = "biologia", options = {}) {
    const opts = {
      abbreviate: true,
      cleanBody: true,
      forcePrefix: true,
      ...options
    };

    let text = Utils.quitarAcentos(originalText.trim());

    let datePrefix = "SEM 00-00";
    let dateFound = false;

    const matchSem = text.match(REGEX_SEM_FECHA);
    const matchFC = text.match(REGEX_FECHA_COMPLETA);
    const matchFS = text.match(REGEX_FECHA_SIMPLE);

    const match = matchSem || matchFC || matchFS;
    if (match) {
      const parsed = this.parseSmartDate(match[1], match[2]);
      datePrefix = `SEM ${parsed.month}-${parsed.day}`;
      dateFound = true;
    }

    // Limpiar todas las fechas encontradas en el texto para evitar duplicados (ej: fechas en nuevas líneas)
    if (opts.cleanBody) {
      text = text
        .replace(REGEX_SEM_FECHA, "")
        .replace(REGEX_FECHA_COMPLETA, "")
        .replace(REGEX_FECHA_SIMPLE, "");
    }

    const clasif = this.clasificarCatedraYCarpeta(originalText, materiaBase);
    let catedra = clasif.catedra !== "COMUN" ? clasif.catedra : "";
    if (catedra && opts.cleanBody) {
      // Usar lookahead negativo para evitar matchear la C de "Cátedra" al limpiar la letra de la cátedra
      const regexCat = new RegExp(`\\b(?:CATEDRA|CÁTEDRA|CAT|COMISION|COMISIÓN|COM)?\\s*\\b${catedra}(?![a-zA-ZáéíóúÁÉÍÓÚüÜñÑ])`, "i");
      text = text.replace(regexCat, "");
    }

    let materiaStr = "";
    const matchMateria = text.match(REGEX_MATERIA_DETECTION);
    if (matchMateria) {
      materiaStr = matchMateria[1].toUpperCase();
      if (opts.cleanBody) {
        const regexMat = new RegExp(`\\b${materiaStr}\\b`, "i");
        text = text.replace(regexMat, "");
      }
    } else {
      materiaStr = materiaBase.toUpperCase();
    }

    let materiaAbbrev = materiaStr;
    if (opts.abbreviate) {
      if (materiaStr.includes("ANATO") || materiaStr.includes("ANATOMIA")) materiaAbbrev = "ANATO";
      else if (materiaStr.includes("BIOL") || materiaStr.includes("BIO")) materiaAbbrev = "BIO";
      else if (materiaStr.includes("HISTO")) materiaAbbrev = "HISTO";
      else if (materiaStr.includes("EMBR")) materiaAbbrev = "EMBRIO";
      else if (materiaStr.includes("FISIO")) materiaAbbrev = "FISIO";
      else if (materiaStr.includes("QUIM")) materiaAbbrev = "QUIM";
      else materiaAbbrev = materiaStr.substring(0, 5);
    }

    let claseStr = "";
    const matchClase = text.match(REGEX_CLASE);
    if (matchClase) {
      claseStr = `CLASE ${matchClase[1]}`;
      if (opts.cleanBody) text = text.replace(REGEX_CLASE, "");
    }

    let parteStr = "";
    const matchParte = text.match(REGEX_PARTE);
    if (matchParte) {
      parteStr = `PARTE ${matchParte[1].toUpperCase()}`;
      if (opts.cleanBody) text = text.replace(REGEX_PARTE, "");
    }

    let detalles = text
      .replace(REGEX_SANITIZAR_DETALLES, "_")
      .replace(REGEX_CLEAN_SPACES, " ")
      .replace(REGEX_CLEAN_HUERFANOS_START, "")
      .replace(REGEX_CLEAN_HUERFANOS_END, "")
      .trim();

    if (detalles) {
      detalles = detalles.toUpperCase();
    }

    let partesFinales = [];

    if (dateFound || opts.forcePrefix) {
      partesFinales.push(datePrefix);
    }

    let matCat = catedra ? `${materiaAbbrev} ${catedra}` : materiaAbbrev;
    partesFinales.push(matCat);

    if (claseStr) partesFinales.push(claseStr);
    if (parteStr) partesFinales.push(parteStr);
    if (detalles) partesFinales.push(detalles);

    const resultadoFinal = partesFinales.join(" - ");
    return Utils.quitarAcentos(resultadoFinal);
  }
};

// Exportación dual (ver docs/coding-standards.md) + module.exports para tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = ParserTitulos;
} else if (typeof window !== "undefined") {
  window.ParserTitulos = ParserTitulos;
} else if (typeof self !== "undefined") {
  self.ParserTitulos = ParserTitulos;
}
