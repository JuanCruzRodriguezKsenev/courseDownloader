/**
 * CLON DOWNLOADHELPER - UTILERÍAS CRIPTOGRÁFICAS Y PERSISTENCIA (V5.7.0)
 * ARCHIVO COMPLETO — FIX CRÍTICO: ERRADICACIÓN REAL DE FILEREADER/BASE64 EN VOLCADO A DISCO
 * ==============================================================================================
 * CHANGELOG v5.7.0:
 * - [SEGURIDAD] Nuevo helper escaparHtml() para neutralizar markup de títulos scrapeados
 *   antes de interpolarlos en strings asignados vía innerHTML. Cierra el XSS de popup.js
 *   (ver docs/TECHNICAL_DEBT.md, sección Seguridad).
 * CHANGELOG v5.6.0:
 * - [FIX CRÍTICO] inyectarArchivoEnDiscoChrome: reemplazado FileReader+readAsDataURL por
 *   URL.createObjectURL(blob). Elimina la serialización Base64 que causaba OOM en videos >100MB.
 *   El blob ya no se copia en memoria como string; Chrome lo consume directamente desde el buffer.
 * - [FIX DOC] Docstring actualizado para reflejar la implementación real.
 * ==============================================================================================
 */

// Constantes Estáticas para Optimización de Performance de Nomenclatura
const ACCENT_MAP = {
  'á': 'a', 'ä': 'a', 'â': 'a', 'à': 'a',
  'é': 'e', 'ë': 'e', 'ê': 'e', 'è': 'e',
  'í': 'i', 'ï': 'i', 'î': 'i', 'ì': 'i',
  'ó': 'o', 'ö': 'o', 'ô': 'o', 'ò': 'o',
  'ú': 'u', 'ü': 'u', 'û': 'u', 'ù': 'u',
  'Á': 'A', 'Ä': 'A', 'Â': 'A', 'À': 'A',
  'É': 'E', 'Ë': 'E', 'Ê': 'E', 'È': 'E',
  'Í': 'I', 'Ï': 'I', 'Î': 'I', 'Ì': 'I',
  'Ó': 'O', 'Ö': 'O', 'Ô': 'O', 'Ò': 'O',
  'Ú': 'U', 'Ü': 'U', 'Û': 'U', 'Ù': 'U'
};
const REGEX_ACCENTS = /[áäâàéëêèíïîìóöôòúüûùÁÄÂÀÉËÊÈÍÏÎÌÓÖÔÒÚÜÛÙ]/g;

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

const Utils = {
  /**
   * Sanitiza títulos para usarlos como nombres de archivo válidos en el OS
   */
  sanitizarTexto(texto) {
    if (!texto) return "video_sin_nombre";
    return texto
      .replace(/[^a-zA-Z0-9 _\-().áéíóúÁÉÍÓÚñÑ]/g, "_") // Sincronizado con backend Bun para evitar desvíos
      .replace(/\s+/g, " ")         // Colapsar espacios múltiples
      .trim();
  },

  /**
   * Escapa los metacaracteres de HTML de un texto no confiable (ej. títulos
   * scrapeados del DOM de Ramón Net) antes de interpolarlo dentro de un string
   * que se asigna vía innerHTML. Neutraliza inyección de markup (XSS).
   */
  escaparHtml(texto) {
    if (texto == null) return "";
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  /**
   * Elimina acentos optimizado en paso simple
   */
  quitarAcentos(str) {
    if (!str) return "";
    return str.replace(REGEX_ACCENTS, match => ACCENT_MAP[match] || match);
  },

  /**
   * Parser inteligente de fecha que previene desajustes de orden (día/mes vs mes/día)
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
   * Identifica la cátedra (A, B, C, D) y carpeta de materia basada en el título y materia de referencia
   */
  clasificarCatedraYCarpeta(tituloClase, materiaBase) {
    const tituloUpper = this.quitarAcentos(tituloClase.toUpperCase().trim());
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

    let text = this.quitarAcentos(originalText.trim());
    
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
    return this.quitarAcentos(resultadoFinal);
  },

  /**
   * Descifra un fragmento de video (.ts) usando AES-128-CBC nativo de WebCrypto
   */
  async descifrarFragmento(arrayBufferCifrado, cryptoKey, miIndice, lineaLlave = "") {
    try {
      let iv = new Uint8Array(16);

      const ivMatch = lineaLlave ? lineaLlave.match(/IV=0x([0-9a-fA-F]+)/) : null;

      if (ivMatch) {
        const hex = ivMatch[1].padStart(32, '0');
        for (let j = 0; j < 16; j++) {
          iv[j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
        }
      } else {
        const view = new DataView(iv.buffer);
        view.setUint32(12, miIndice + 1);
      }

      const datosDescifrados = await crypto.subtle.decrypt(
        { name: "AES-CBC", iv: iv },
        cryptoKey,
        arrayBufferCifrado
      );

      return datosDescifrados;
    } catch (err) {
      console.error(`❌ [CRYPTO-ERROR] Falló descifrado del fragmento index [${miIndice}]:`, err);
      throw err;
    }
  },

  /**
   * Ensambla la ráfaga de fragmentos en un único archivo de video libre de duplicación de RAM
   */
  generarVideoFinalBlob(bloquesDescifrados) {
    console.log("📦 [ENGINE] Ensamblando fragmentos descifrados de forma nativa...");
    const bloquesValidos = bloquesDescifrados.filter(Boolean);
    
    if (bloquesValidos.length === 0) {
      throw new Error("El arreglo de bloques descifrados está completamente vacío.");
    }

    return new Blob(bloquesValidos, { type: 'video/mp4' });
  },

  /**
   * Descarga el binario final escribiendo directo en el subsistema de archivos de Chrome.
   *
   * Usa URL.createObjectURL(blob) — el blob NO se serializa a Base64 ni a string.
   * Chrome consume la referencia al buffer en memoria directamente, sin duplicarlo.
   * Para un video de 500 MB esto evita generar ~667 MB de string adicional que causaba OOM.
   * La URL de objeto se revoca inmediatamente después de iniciar la descarga para liberar
   * la referencia al blob y permitir que el GC lo limpie cuando la descarga termine.
   */
  inyectarArchivoEnDiscoChrome(blobOrUrl, subRuta) {
    return new Promise((resolver, rechazar) => {
      console.log(`💾 [DISCO] Iniciando volcado nativo para: /${subRuta}`);

      let objectUrl = null;
      let shouldRevoke = false;

      if (typeof blobOrUrl === 'string') {
        objectUrl = blobOrUrl;
      } else {
        try {
          objectUrl = URL.createObjectURL(blobOrUrl);
          shouldRevoke = true;
        } catch (err) {
          return rechazar(new Error(`No se pudo crear la Object URL del blob: ${err.message}`));
        }
      }

      chrome.downloads.download({
        url: objectUrl,
        filename: subRuta,
        saveAs: false,
        conflictAction: "overwrite"
      }, (downloadId) => {
        if (shouldRevoke) {
          URL.revokeObjectURL(objectUrl);
        }

        if (chrome.runtime.lastError) {
          console.error("❌ [DISCO-ERROR] chrome.downloads tiró error:", chrome.runtime.lastError.message);
          return rechazar(new Error(chrome.runtime.lastError.message));
        }

        if (!downloadId) {
          return rechazar(new Error("Descarga rechazada por el sistema nativo de Chrome."));
        }

        console.log(`✨ [DISCO] Descarga iniciada con éxito. ID: ${downloadId}`);
        resolver(downloadId);
      });
    });
  },

  /**
   * Helper para actualizar telemetría mitigando condiciones de carrera
   */
  calcularMétricasProgreso(bytesAcumulados, fragmentosTerminados, totalFragmentos, tiempoInicio) {
    const tiempoTranscurrido = (performance.now() - tiempoInicio) / 1000; 
    const velocidadBytesPorSeg = tiempoTranscurrido > 0 ? (bytesAcumulados / tiempoTranscurrido) : 0;
    
    const velocidadMegas = (velocidadBytesPorSeg / (1024 * 1024)).toFixed(2);
    const megasDescargados = (bytesAcumulados / (1024 * 1024)).toFixed(2);
    const porcentajeCalculado = Math.floor((fragmentosTerminados / totalFragmentos) * 100);

    return {
      porcentaje: Math.min(porcentajeCalculado, 100),
      telemetry: {
        bytesTexto: `${megasDescargados} MB`,
        velocidadTexto: `${velocidadMegas} MB/s`,
        fragmentosTexto: `${fragmentosTerminados} / ${totalFragmentos}`
      }
    };
  },

  // =============================================================================
  // ─── 🛠️ PUENTES DE COMPATIBILIDAD EXCLUSIVOS PARA RENDERERS.JS (FIX V5.5.0) ──
  // =============================================================================

  /**
   * Convierte bytes crudos a formato legible MB string
   */
  formatearMB(bytes) {
    if (!bytes || isNaN(bytes)) return "0.0";
    return (bytes / (1024 * 1024)).toFixed(1);
  },

  /**
   * Calcula la proyección del tamaño final estimado basándose en el peso de los chunks actuales
   */
  calcularProyeccionMB(bytesAcumulados, fragsTerminados, totalFrags) {
    if (!bytesAcumulados || !fragsTerminados || totalFrags === 0) return "0.0";
    const pesoPromedioChunk = bytesAcumulados / fragsTerminados;
    const tamañoProyectadoBytes = pesoPromedioChunk * totalFrags;
    return (tamañoProyectadoBytes / (1024 * 1024)).toFixed(1);
  },

  /**
   * Realiza un fetch con reintentos y retroceso exponencial (exponential backoff)
   * Diseñado para tolerar micro-cortes de internet sin abortar la descarga de inmediato.
   */
  async fetchConReintentos(url, opciones = {}, maxReintentos = 4, delayInicial = 1000) {
    let reintento = 0;
    while (true) {
      try {
        const res = await fetch(url, opciones);
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
      } catch (err) {
        if (opciones.signal && opciones.signal.aborted) {
          throw err; // Abortado por el usuario, no reintentar
        }
        reintento++;
        if (reintento > maxReintentos) {
          console.error(`❌ [FETCH-REINTENTOS] Superado el límite de reintentos para: ${url}. Error: ${err.message}`);
          throw err;
        }
        const delay = delayInicial * Math.pow(2, reintento - 1);
        console.warn(`⚠️ [FETCH-REINTENTOS] Intento ${reintento} fallido para ${url}. Reintentando en ${delay}ms... Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
};

// Exportación — module-pattern del proyecto (ver docs/coding-standards.md),
// extendido con module.exports para poder testear las funciones puras en Node/Vitest.
// En el browser/SW `module` es undefined, así que ese branch no se toca ahí.
if (typeof module !== "undefined" && module.exports) {
  module.exports = Utils;
} else if (typeof window !== "undefined") {
  window.Utils = Utils;
} else if (typeof self !== "undefined") {
  self.Utils = Utils;
}