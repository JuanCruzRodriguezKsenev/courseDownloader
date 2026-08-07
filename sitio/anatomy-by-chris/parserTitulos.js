/**
 * ADAPTADOR DE SITIO — ANATOMY BY CHRIS: PARSER DE TÍTULOS (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CORTE 7] Nace con el segundo portal.
 * ==========================================================================
 *
 * POR QUÉ ES TAN CHICO COMPARADO CON EL DE RAMÓN NET
 * ---------------------------------------------------
 * Porque los títulos de este portal son simples: **no traen semana, ni fecha, ni cátedra, ni
 * número de parte** (medido sobre los tres módulos guardados). Todo el aparato de
 * `formatTitleStructured` —el orden de regex que `docs/patterns.md` documenta como lo más
 * sensible a regresiones del proyecto— no tiene nada que hacer acá, y copiarlo sería traer
 * heurísticas que sólo pueden equivocarse.
 *
 * Lo que SÍ traen los títulos, y por eso hay algo que hacer (todo medido):
 *   - espacios al final:            `"Miologia 6 "`
 *   - espacios múltiples adentro:   `"Artrologia Movimietos MS   02:55"`
 *   - la duración pegada al final:  `… 02:55`  /  `… 01:12:32`
 *   - acentos en español y portugués
 *   - **casi homónimos que NO hay que colapsar**: `"Irrigación 1"` y `"Irrigación"` son dos
 *     clases distintas. Cualquier "normalización" que las junte hace que la identidad
 *     (portal, título) las trate como la misma y una de las dos desaparezca de la cola.
 *
 * DE DÓNDE SALE LA SANITIZACIÓN, Y POR QUÉ LOS ACENTOS NO
 * --------------------------------------------------------
 * El saneado del nombre de archivo sale de `Utils.sanitizarTexto` (global, publicado por
 * `plataforma/composicion.ts`), igual que en el parser de Ramón Net, y no es pereza: esa
 * lista de caracteres está **sincronizada con el backend Bun**, así que una copia local haría
 * que el archivo se escriba con un nombre distinto del que la extensión cree que escribió.
 * Este archivo NO se inyecta en la pestaña (eso es sólo `scraper.js`), así que leer el global
 * es legítimo.
 *
 * Los acentos, en cambio, **NO** salen de `Utils.quitarAcentos`, y eso sí es una decisión:
 * esa función es una tabla estática que cubre el español (`á é í ó ú ü`) y **no el portugués**
 * (`ã õ ç â ê`). Chris publica títulos en los dos idiomas, así que con esa tabla
 * `"Articulação"` terminaba como `"Articula__o"` — lo encontró este test, no el navegador.
 * Acá se normaliza con NFD, que cubre cualquier diacrítico.
 *
 * Consecuencia asumida: `ñ` → `n` (`"año"` → `"ano"`). Ramón Net conserva la `ñ` porque su
 * tabla no la toca y la lista blanca del backend la permite; este portal prefiere nombres
 * ASCII parejos antes que un criterio distinto por idioma. Es una decisión, no un descuido.
 */

/**
 * Cualquier diacrítico → su letra base, vía descomposición Unicode. No usa `Utils` a
 * propósito (ver el bloque de arriba).
 */
function aAscii(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Duración al final del título: `02:55` o `01:12:32`. La pone la UI del portal, no el nombre. */
const DURACION_AL_FINAL = /\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/;

const ParserTitulosAnatomy = {
  /**
   * Título crudo → nombre canónico del archivo.
   *
   * `materiaBase` se acepta para cumplir el contrato del puerto pero **no se usa**: en este
   * portal la materia es el nombre del módulo y ya es la carpeta, así que prefijarla al
   * archivo lo repetiría en cada nombre.
   */
  formatearTitulo(crudo, _materiaBase, _opciones) {
    const base = String(crudo || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(DURACION_AL_FINAL, "")
      .trim();

    if (!base) return "video_sin_nombre";

    // El orden importa: primero se quitan los diacríticos y DESPUÉS se sanea. Al revés,
    // `sanitizarTexto` conservaría los acentos de su lista blanca y `aAscii` ya no los
    // vería, que es una diferencia de nombre de archivo, no de estilo.
    return Utils.sanitizarTexto(aAscii(base));
  },

  /**
   * Título + materia → dónde se guarda.
   *
   * La faceta de este portal es inerte (Hotmart no tiene eje tipo cátedra/comisión), así que
   * `catedra` es siempre el `valorComun` del descriptor. El valor está escrito acá y no leído
   * del descriptor a propósito: importarlo cruzaría los dos archivos por un string constante.
   */
  clasificarCarpeta(crudo, materiaBase) {
    const carpeta = String(materiaBase || "")
      .trim()
      .toLowerCase();
    return { catedra: "COMUN", carpeta: carpeta || "anatomy" };
  },
};

// Exportación dual (ver docs/coding-standards.md). Global con nombre PROPIO del portal: el
// de Ramón Net se llama `ParserTitulos` y compartir el nombre le pisa el suyo al otro.
globalThis.ParserTitulosAnatomy = ParserTitulosAnatomy;
export default ParserTitulosAnatomy;
