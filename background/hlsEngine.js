/**
 * CLON DOWNLOADHELPER - MOTOR HLS CRYPTO-TRANSCODER (V1.0.5)
 * GESTIONA LA EXTRACTIBILIDAD DE M3U8, DESCARGA CONCURRENTE Y DESCIFRADO AES-128 NATIVO
 * ==========================================================================
 * CHANGELOG v1.0.5:
 * - [FIX] Sin sesión iniciada en Ramón Net, la plataforma redirige la página de la
 *   clase a la raíz/login (la URL final pierde /clases-grabadas/) y devolvía la página
 *   de login sin iframe, cayendo en el error genérico "No se localizaron firmas...".
 *   background.js lo malclasificaba como "internet" (falso "Conexión a Internet Caída").
 *   Ahora extraerEnlaceMaestroM3u8Clasico detecta ese redirect y lanza un error tipado
 *   (err.tipoConexion = "sesion") para que se clasifique como problema de sesión. Ver
 *   background.js y docs/patterns.md.
 * CHANGELOG v1.0.4:
 * - [TEST] Se agregó la rama `module.exports` (sólo Node/Vitest, no existe en el SW)
 *   para poder testear las funciones puras de parseo/resolución M3U8
 *   (extraerEnlaceMaestroM3u8Clasico, descargarYAnalizarIndexM3u8) sin cargar el SW.
 *   Nuevo background/hlsEngine.test.js. Sin cambios de comportamiento en runtime.
 * CHANGELOG v1.0.3:
 * - [LOG] El worker ya no loguea ❌ "Error crítico en fragmento" ante un AbortError.
 *   Un AbortError en un worker no es un fallo del fragmento: es la consecuencia
 *   esperada de que la descarga se detenga (usuario canceló, u otro worker falló y
 *   abortó el controlador para frenar a los hermanos). Ahora se propaga callado; sólo
 *   los fallos REALES logean crítico y re-abortan. Antes, una cancelación llenaba la
 *   consola de ❌ falsos (uno por worker en vuelo). Complementa background.js v5.6.5.
 * CHANGELOG v1.0.2:
 * - [LIMPIEZA] El log del match del iframe ya no vuelca el objeto entero del regex
 *   (array gigante en consola); ahora sólo indica sí/no. La URL resuelta ya se
 *   loguea limpia en la línea siguiente y el caso de fallo tiene su propio log.
 * CHANGELOG v1.0.1:
 * - [DEBT] El catch(e){} silencioso del abort() de limpieza del controlador de
 *   gráfico activo (ante fallo de fragmento) ahora deja rastro con console.warn.
 *   Ver docs/TECHNICAL_DEBT.md, sección Menores/de proceso.
 */

const HlsEngine = {
  /**
   * Extrae la firma de video activa del reproductor <iframe> en la página
   */
  async extraerEnlaceMaestroM3u8Clasico(urlClase, signal) {
    console.log(`📡 [HLS-ENGINE] Iniciando fetch para: ${urlClase}`);
    
    const conectorUrl = urlClase.includes("?") ? "&" : "?";
    const urlInmuneACache = `${urlClase}${conectorUrl}turboBuster=${Date.now()}`;

    const res = await Utils.fetchConReintentos(urlInmuneACache, { 
      signal, 
      credentials: "include",
      headers: {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Expires": "0"
      }
    });
    
    console.log(`📡 [HLS-ENGINE] Respuesta recibida. URL Final: ${res.url}, Status: ${res.status}`);
    
    const html = await res.text();
    console.log(`📡 [HLS-ENGINE] HTML recibido. Longitud: ${html.length} caracteres.`);

    // Sin sesión iniciada, la plataforma redirige la página de la clase a la raíz/login:
    // la URL final pierde el segmento /clases-grabadas/. NO es un fallo de red (la
    // conectividad está OK) — es un problema de sesión, accionable por el usuario. Se
    // lanza un error tipado para que background.js lo clasifique como "sesion" en vez de
    // caer en la heurística por defecto ("internet"). Ver docs/patterns.md.
    if (/clases-grabadas/i.test(urlClase) && !/clases-grabadas/i.test(res.url)) {
      console.warn(`🔑 [HLS-ENGINE] La clase redirigió fuera de /clases-grabadas/ (URL final: ${res.url}). No hay sesión activa en Ramón Net.`);
      const errSesion = new Error("SESION_NO_INICIADA: la clase redirigió al inicio/login; iniciá sesión en Ramón Net.");
      errSesion.tipoConexion = "sesion";
      throw errSesion;
    }

    // 1. Buscar la etiqueta <iframe> que apunte a Bunny o Mediadelivery
    const regexIframe = /<iframe[^>]+src=\\?["'](https?:\/\/[^\\"']*(?:b-cdn\.net|mediadelivery\.net)[^\\"']+)/i;
    const matchIframe = html.match(regexIframe);
    console.log(`📡 [HLS-ENGINE] ¿Match de etiqueta iframe?: ${matchIframe ? 'sí' : 'no'}`);
    
    if (matchIframe && matchIframe[1]) {
      const iframeUrl = matchIframe[1].replace(/\\/g, ''); // Limpiar escapes
      console.log(`📡 [HLS-ENGINE] URL del iframe activo: ${iframeUrl}`);
      
      const hashMatch = iframeUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (hashMatch) {
        const activeHash = hashMatch[0];
        const finalUrl = `https://vz-c3e7bda8-f29.b-cdn.net/${activeHash}/480p/video.m3u8`;
        console.log(`📡 [HLS-ENGINE] Hash iframe: ${activeHash}. URL: ${finalUrl}`);
        return finalUrl;
      }
    }

    console.log(`📡 [HLS-ENGINE] No se detectó iframe activo. Aplicando fallbacks...`);

    // Fallback 1: Coincidencia directa de m3u8.
    const matchesDirectos = html.match(/https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
    if (matchesDirectos && matchesDirectos.length > 0) {
      const finalUrl = matchesDirectos[matchesDirectos.length - 1].replace(/["']/g, '').trim();
      console.log(`📡 [HLS-ENGINE] Fallback directo: ${finalUrl}`);
      return finalUrl;
    }
    
    // Fallback 2: Coincidencia de hashes de Bunny (primer match como fallback)
    const regexBunnyHash = /(https:\/\/vz-[^\s"'<>\\\/]+\.b-cdn\.net\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
    const matchesHash = html.match(regexBunnyHash);
    if (matchesHash && matchesHash.length > 0) {
      const urlBaseConHash = matchesHash[0];
      const finalUrl = `${urlBaseConHash}/480p/video.m3u8`;
      console.log(`📡 [HLS-ENGINE] Fallback Bunny Hash: ${finalUrl}`);
      return finalUrl;
    }

    // Fallback 3: Coincidencia de m3u8 en scripts ocultos
    const regexScriptOculto = /https?:\\\/\\\/[^\s"'<>\\#]+\.m3u8[^\s"'<>\\#]*/gi;
    const matchesScript = html.match(regexScriptOculto);
    if (matchesScript && matchesScript.length > 0) {
      const finalUrl = matchesScript[matchesScript.length - 1].replace(/\\\//g, '/').replace(/["']/g, '').trim();
      console.log(`📡 [HLS-ENGINE] Fallback script oculto: ${finalUrl}`);
      return finalUrl;
    }
    
    throw new Error("No se localizaron firmas de streaming válidas en Ramón Net.");
  },

  /**
   * Descarga y parsea el manifiesto HLS .m3u8
   */
  async descargarYAnalizarIndexM3u8(urlM3u8, signal) {
    const respuesta = await Utils.fetchConReintentos(urlM3u8, { signal });
    const cuerpoTexto = await respuesta.text();

    const lineas = cuerpoTexto.split(/\r?\n/);
    const urlsFragmentos = [];
    let lineaLlaveCripto = "";
    let urlLlaveAbsoluta = "";

    const urlBase = urlM3u8.substring(0, urlM3u8.lastIndexOf("/")) + "/";

    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i].trim();

      if (linea.startsWith("#EXT-X-KEY")) {
        lineaLlaveCripto = linea;
        const matchUri = linea.match(/URI=["']([^"']+)["']/);
        if (matchUri && matchUri[1]) {
          const uriLlave = matchUri[1];
          urlLlaveAbsoluta = uriLlave.startsWith("http") ? uriLlave : `${urlBase}${uriLlave}`;
        }
      } else if (linea.length > 0 && !linea.startsWith("#")) {
        const urlCompletaChunk = linea.startsWith("http") ? linea : `${urlBase}${linea}`;
        urlsFragmentos.push(urlCompletaChunk);
      }
    }

    if (urlsFragmentos.length === 0) {
      throw new Error("El archivo manifiesto .m3u8 no contiene fragmentos de video válidos.");
    }

    return {
      urls: urlsFragmentos,
      lineaLlave: lineaLlaveCripto,
      urlLlave: urlLlaveAbsoluta
    };
  },

  /**
   * Orquesta la descarga en paralelo y descifrado AES-128 de todos los fragmentos
   */
  async compilarTranscodificacionStream(metadataHls, signal, subcarpeta, tituloInmutable, callbacks) {
    // Obtener estado actual desde la envoltura SessionState global del SW
    const state = await SessionState.get(['modoTurboBunActivo', 'videoActualTitulo', 'videoActualSessionId']);
    const modoTurboBunActivo = state.modoTurboBunActivo;
    const sessionId = state.videoActualSessionId || "";

    let claveCryptoWeb = null;
    let miTituloAislado = (typeof tituloInmutable === "string") ? tituloInmutable : state.videoActualTitulo;
    let miCallbackMap = (typeof tituloInmutable === "object") ? tituloInmutable : callbacks;

    if (metadataHls.urlLlave) {
      const resClave = await Utils.fetchConReintentos(metadataHls.urlLlave, { signal });
      const bufferClaveRaw = await resClave.arrayBuffer();

      claveCryptoWeb = await crypto.subtle.importKey(
        "raw",
        bufferClaveRaw,
        { name: "AES-CBC" },
        false,
        ["decrypt"]
      );
    }

    const bloquesDescifrados = modoTurboBunActivo ? [] : new Array(metadataHls.urls.length);
    let bytesAcumulados = 0;
    let fragmentosTerminados = 0;

    let ultimoMensajeTiempo = 0;
    const UMBRAL_VENTANA_MS = 150;

    const CONCURRENCIA_MAXIMA = 6;
    const urlsConIndice = metadataHls.urls.map((url, idx) => ({ url, idx }));
    let nextTaskIndex = 0;

    async function ejecutarWorkerDeRed() {
      while (nextTaskIndex < urlsConIndice.length) {
        if (signal.aborted) return;
        const tarea = urlsConIndice[nextTaskIndex++];
        if (!tarea) break;

        try {
          const resChunk = await Utils.fetchConReintentos(tarea.url, { signal });
          const bufferCifradoRaw = await resChunk.arrayBuffer();
          
          let bloqueFinal = null;

          if (claveCryptoWeb) {
            bloqueFinal = await Utils.descifrarFragmento(
              bufferCifradoRaw,
              claveCryptoWeb,
              tarea.idx,
              metadataHls.lineaLlave
            );
          } else {
            bloqueFinal = bufferCifradoRaw;
          }

          if (modoTurboBunActivo) {
            // Utiliza el cliente API modular BunClient para el envío de fragmentos
            await BunClient.enviarFragmentoStream(bloqueFinal, {
              videoTitle: miTituloAislado,
              chunkIndex: tarea.idx,
              totalChunks: metadataHls.urls.length,
              targetFolder: subcarpeta,
              sessionId: sessionId
            }, signal);
            
            bytesAcumulados += bloqueFinal.byteLength;
            bloqueFinal = null;
          } else {
            bloquesDescifrados[tarea.idx] = bloqueFinal;
            bytesAcumulados += bloqueFinal.byteLength;
          }

          fragmentosTerminados++;

          if (miCallbackMap && miCallbackMap.onFragmentoCompletado) {
            const ahora = performance.now();
            if (ahora - ultimoMensajeTiempo > UMBRAL_VENTANA_MS || fragmentosTerminados === metadataHls.urls.length) {
              ultimoMensajeTiempo = ahora;
              miCallbackMap.onFragmentoCompletado(
                0, 
                metadataHls.urls.length,
                bytesAcumulados,
                fragmentosTerminados
              );
            }
          }

        } catch (errChunk) {
          // Un AbortError acá NO es un fallo del fragmento: la descarga se está
          // deteniendo (el usuario canceló, o OTRO worker falló de verdad y abortó el
          // controlador para frenar a los hermanos). No es "crítico", no hay que
          // re-abortar ni loguearlo como error crítico: sólo propagar y salir. Así, ante
          // una cancelación del usuario la consola no se llena de ❌ falsos.
          if (errChunk?.name === "AbortError") {
            throw errChunk;
          }
          console.error(`❌ Error crítico en fragmento index [${tarea.idx}]:`, errChunk.message);
          // Abortar descarga completa ante un fallo REAL de fragmento (frena a los otros workers).
          if (typeof controladorGraficoActivo !== "undefined" && controladorGraficoActivo) {
            try { controladorGraficoActivo.abort(); }
            catch (e) { console.warn("⚠️ Falló el abort del controlador de gráfico activo (fallo de fragmento):", e?.message); }
          }
          throw errChunk;
        }
      }
    }

    const promesasTrabajadores = Array.from({ length: CONCURRENCIA_MAXIMA }, ejecutarWorkerDeRed);
    await Promise.all(promesasTrabajadores);

    if (signal.aborted) {
      throw new Error("Descarga interrumpida por solicitud del usuario.");
    }

    if (modoTurboBunActivo) return null;

    return Utils.generarVideoFinalBlob(bloquesDescifrados);
  }
};

// Exportar según contexto
if (typeof window !== "undefined") {
  window.HlsEngine = HlsEngine;
} else if (typeof self !== "undefined") {
  self.HlsEngine = HlsEngine;
}
// Rama para Node/Vitest (no existe en el SW): habilita testear las funciones puras
// de parseo/resolución sin cargar todo el service worker.
if (typeof module !== "undefined" && module.exports) {
  module.exports = HlsEngine;
}
