/**
 * CLON DOWNLOADHELPER - UTILERÍAS CRIPTOGRÁFICAS Y PERSISTENCIA (V6.0.0)
 * ARCHIVO COMPLETO — FIX CRÍTICO: ERRADICACIÓN REAL DE FILEREADER/BASE64 EN VOLCADO A DISCO
 * ==============================================================================================
 * CHANGELOG v6.0.0:
 * - [CAPA 2] Se fueron a `sitio/ramonnet/parserTitulos.js` las 3 funciones del parser de
 *   títulos (parseSmartDate, clasificarCatedraYCarpeta, formatTitleStructured) con sus
 *   constantes de regex: eran lo específico de Ramón Net (materias del plan, formato
 *   "SEM mes-día", cátedras A-D) dentro de un módulo "compartido". Los 14 tests de
 *   caracterización se mudaron con ellas. Este archivo queda GENÉRICO: sanitizado de
 *   nombres, escapado HTML, acentos, AES, blob, fetch con reintentos y telemetría.
 *   Los call-sites pasan por `SitioActivo.parsearTitulo` / `.clasificarCarpeta`.
 *   Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * CHANGELOG v5.9.1:
 * - [FIX] El timeout por-intento ya no lanza AbortError sino un Error normal ("Timeout de Nms...").
 *   Un AbortError aguas arriba se trata como abort externo (hlsEngine.js:261 NO frena a los workers
 *   hermanos) y se confunde con cancelación del usuario. Con el Error normal el fallo se clasifica
 *   como real y corta en cascada. Mismo criterio que bunClient.enviarFragmentoStream (v1.2.0).
 * CHANGELOG v5.9.0:
 * - [FIX] fetchConReintentos consulta al daemon Conexion (HEAD real ~4s) en cada fallo: si
 *   confirma internet caída, corta los reintentos de inmediato en vez de quemar ~15s de backoff
 *   (1+2+4+8s). Cubre el corte AGUAS ARRIBA (WAN caída con la NIC local "conectada" → navigator.onLine
 *   sigue en true, común en Windows) que el guard v5.8.0 (sólo onLine===false) no detectaba: la
 *   caída pasaba de ~16s a ~4-5s. Micro-cortes se toleran igual (si el HEAD pasa, se reintenta).
 * - [FIX] Timeout por-intento (AbortController, 10s > TIMEOUT_HEAD_MS) para acotar el primer fallo
 *   ante un socket colgado que no rechaza. Compone con opciones.signal (AbortSignal.any) sin romper
 *   el abort del usuario: un timeout es reintentable, un abort real del usuario sigue cortando.
 * CHANGELOG v5.8.0:
 * - [FIX] fetchConReintentos ahora aborta los reintentos si navigator.onLine === false.
 *   Al desconectar el wifi durante una descarga, la caída se detectaba lento (~15s+): el
 *   fetch del fragmento fallaba y se quemaban 4 reintentos con backoff exponencial antes
 *   de propagar el error y pausar la cola. Como navigator.onLine baja al instante ante
 *   una interfaz caída, se corta el retry de una y la caída se detecta rápido. Sólo se
 *   usa la forma negativa de onLine (un `true` dudoso no altera el comportamiento).
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
    // Backstop por intento: un socket colgado (que nunca rechaza) mantendría este fetch
    // esperando para siempre y el bail vía daemon (más abajo) nunca correría. > TIMEOUT_HEAD_MS
    // (4s) para no matar un fetch lento-pero-vivo antes de que el daemon vote "up".
    const TIMEOUT_INTENTO_MS = 10000;
    let reintento = 0;
    while (true) {
      const acIntento = new AbortController();
      let porTimeout = false;
      const tIntento = setTimeout(() => { porTimeout = true; acIntento.abort(); }, TIMEOUT_INTENTO_MS);
      // Combinamos el signal del caller (abort de usuario) con el de timeout, sin perder ninguno.
      const signalCombinado = opciones.signal
        ? AbortSignal.any([acIntento.signal, opciones.signal])
        : acIntento.signal;
      try {
        const res = await fetch(url, { ...opciones, signal: signalCombinado });
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res;
      } catch (errFetch) {
        if (opciones.signal && opciones.signal.aborted) {
          throw errFetch; // Abortado por el usuario/hermano: propagar el AbortError original tal cual
        }
        // Nuestro timeout aborta con AbortError, que aguas arriba se trata como abort externo
        // (hlsEngine.js:261 no frena a los hermanos) y se confunde con cancelación. Lo reescribimos
        // a un Error normal —igual que bunClient.enviarFragmentoStream (v1.2.0)— para que se
        // clasifique como fallo real y corte en cascada.
        const err = porTimeout
          ? new Error(`Timeout de ${TIMEOUT_INTENTO_MS}ms al descargar fragmento: ${url}`)
          : errFetch;
        // Sin red según el browser (ej. wifi desconectado): navigator.onLine baja casi
        // al instante. No tiene sentido quemar los reintentos con backoff (~15s) contra
        // una interfaz caída: se falla YA para que la caída se detecte rápido (el catch
        // de background.js pausa la cola y consulta al daemon Conexion). Sólo se usa la
        // forma NEGATIVA de onLine (confiable): un `true` dudoso NO corta reintentos.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          console.warn(`📴 [FETCH-REINTENTOS] Sin red (navigator.onLine=false); no se reintenta: ${url}`);
          throw err;
        }
        // navigator.onLine positivo NO es de fiar (en Windows queda en true ante un corte
        // AGUAS ARRIBA: WAN caída con la NIC local "conectada"). Antes de quemar la escalera
        // de backoff (~15s), le preguntamos al daemon Conexion —fuente única de verdad, HEAD
        // real (~4s)— si internet realmente se cayó. Micro-corte real se tolera igual: si la
        // red vuelve antes de que el HEAD falle, reporta internet=true y seguimos reintentando.
        if (typeof Conexion !== "undefined") {
          try {
            const snap = await Conexion.verificarAhora();
            if (!snap.internet) {
              console.warn(`📴 [FETCH-REINTENTOS] Daemon confirma internet caída; no se reintenta: ${url}`);
              throw err; // relanza el error ORIGINAL del fetch
            }
          } catch (e) {
            if (e === err) throw err; // nuestro relanzamiento → propagar
            // el propio sondeo del daemon falló por otra causa: seguir con el backoff normal
          }
        }
        reintento++;
        if (reintento > maxReintentos) {
          console.error(`❌ [FETCH-REINTENTOS] Superado el límite de reintentos para: ${url}. Error: ${err.message}`);
          throw err;
        }
        const delay = delayInicial * Math.pow(2, reintento - 1);
        console.warn(`⚠️ [FETCH-REINTENTOS] Intento ${reintento} fallido para ${url}. Reintentando en ${delay}ms... Error: ${err.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        clearTimeout(tIntento);
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