/**
 * CLON DOWNLOADHELPER - MOTOR HLS CRYPTO-TRANSCODER (V1.1.0)
 * DESCARGA CONCURRENTE Y DESCIFRADO AES-128 NATIVO A PARTIR DE UN .m3u8 YA RESUELTO
 * ==========================================================================
 * CHANGELOG v1.1.0:
 * - [CAPA 2] Se fue `extraerEnlaceMaestroM3u8Clasico` a `sitio/ramonnet/resolverManifiesto.js`
 *   (era lo único de Ramón Net/Bunny que quedaba acá: el iframe del reproductor, el host
 *   del CDN, la plantilla 480p y la detección de redirect al login). El motor ahora
 *   recibe una URL .m3u8 ya resuelta y es GENÉRICO: sirve para cualquier portal con HLS
 *   + AES-128 estándar. El caller (background.js) pide la URL a `SitioActivo.resolverManifiesto`.
 *   Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * CHANGELOG v1.0.6:
 * - [FIX bug 400] El worker de compilarTranscodificacionStream envuelve el envío
 *   (BunClient.enviarFragmentoStream) en un reintento acotado (N=3, backoff 300ms·n)
 *   SÓLO para el rechazo 4xx tipado (err.tipoBackend==="rechazo", bunClient v1.4.0).
 *   Un 4xx es determinístico: reintentar da un margen por si fue transitorio y, agotado,
 *   propaga el error tipado intacto → background.js (v5.9.0) salta SOLO esa clase en vez
 *   de pausar la cola y entrar en loop pausa/autoheal. Los demás errores (red, 5xx,
 *   AbortError) se propagan en el primer intento, como antes. Ver docs/patterns.md.
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
            // Utiliza el cliente API modular BunClient para el envío de fragmentos.
            // Reintento acotado SÓLO para el rechazo 4xx tipado (err.tipoBackend==="rechazo",
            // bunClient v1.4.0): un 4xx es determinístico, pero damos un pequeño margen por si
            // fue transitorio. Agotados los N intentos, se propaga el error tipado con
            // httpStatus intacto → el catch de background.js (v5.9.0) salta SOLO esta clase
            // sin pausar la cola (fix del loop pausa/autoheal, bug 400). Cualquier otro error
            // (red, 5xx, AbortError) NO se reintenta acá: se propaga en el primer intento.
            const MAX_REINTENTOS_RECHAZO = 3;
            let intentosRechazo = 0;
            while (true) {
              try {
                await BunClient.enviarFragmentoStream(bloqueFinal, {
                  videoTitle: miTituloAislado,
                  chunkIndex: tarea.idx,
                  totalChunks: metadataHls.urls.length,
                  targetFolder: subcarpeta,
                  sessionId: sessionId
                }, signal);
                break;
              } catch (eEnvio) {
                if (eEnvio?.tipoBackend === "rechazo" && ++intentosRechazo < MAX_REINTENTOS_RECHAZO && !signal.aborted) {
                  await new Promise(r => setTimeout(r, 300 * intentosRechazo));
                  continue;
                }
                throw eEnvio; // agotado o no-rechazo → aborta la clase vía el catch del worker
              }
            }

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
// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.HlsEngine = HlsEngine;
export default HlsEngine;
