/**
 * MOTOR HLS CRYPTO-TRANSCODER (V2.1.0)
 * DESCARGA CONCURRENTE Y DESCIFRADO AES-128 A PARTIR DE UN .m3u8 YA RESUELTO
 * ==========================================================================
 * CHANGELOG v2.1.0:
 * - [FIX] Los fragmentos y la llave relativos se resuelven con `new URL(ref, base)` en vez de
 *   cortar la base por el último `/`. Ese corte caía **adentro del query** cuando la URL de la
 *   playlist lleva una barra ahí, que es lo que hace Akamai al firmar (`~acl=/*`): las URLs
 *   salían con dos `?` y el CDN las rechazaba con 403. Es un bug del MOTOR, no del portal que
 *   lo destapó — cualquier CDN que firme así lo dispara.
 *
 * CHANGELOG v2.0.0:
 * - [FASE 6 / CAPA 1] Mudado de `background/hlsEngine.js` a `core/hls/hlsEngine.ts`. De objeto
 *   suelto a factory `crearHlsEngine(deps)`: `fetchConReintentos`, `descifrarFragmento`,
 *   `generarVideoFinalBlob` y el cliente del backend entran por inyección en vez de leerse de
 *   los globals `Utils`/`BunClient`.
 * - [FASE 6] **Se cortaron dos dependencias con el estado del service worker que la medición
 *   inicial no había visto** (no eran `X.metodo()` sino identificadores pelados):
 *     · `SessionState.get([...])` para modo turbo / título / sessionId → ahora entra como
 *       parámetro `contexto`. El motor no puede leer el estado de la cola: no es suyo.
 *     · `controladorGraficoActivo.abort()` para frenar a los workers hermanos ante un fallo
 *       real → ahora es `contexto.abortarHermanos()`. El motor sabe *cuándo* hay que frenar
 *       la ráfaga; **quién** es el dueño del controlador es del caller.
 * - [FASE 6] Se fue la rama polimórfica de `tituloInmutable` (aceptaba string *o* el objeto de
 *   callbacks, resto de una firma vieja). Ningún call-site la usaba —ni el SW ni los tests—,
 *   así que era código muerto que el tipado obligaba a modelar. Verificado antes de sacarla.
 * CHANGELOG v1.1.0:
 * - [CAPA 2] Se fue `extraerEnlaceMaestroM3u8Clasico` a `sitio/ramonnet/resolverManifiesto.js`
 *   (era lo único de Ramón Net/Bunny que quedaba acá). El motor recibe una URL `.m3u8` ya
 *   resuelta y es GENÉRICO: sirve para cualquier portal con HLS + AES-128 estándar.
 * CHANGELOG v1.0.6:
 * - [FIX bug 400] El worker envuelve el envío al backend en un reintento acotado (N=3, backoff
 *   300ms·n) SÓLO para el rechazo 4xx tipado (`err.tipoBackend === "rechazo"`). Un 4xx es
 *   determinístico: se da un margen por si fue transitorio y, agotado, se propaga el error
 *   tipado intacto → el caller saltea SOLO esa clase en vez de pausar la cola y entrar en loop
 *   pausa/autoheal. Los demás errores (red, 5xx, AbortError) se propagan en el primer intento.
 * CHANGELOG v1.0.3:
 * - [LOG] El worker no loguea ❌ ante un `AbortError`: no es un fallo del fragmento sino la
 *   consecuencia esperada de que la descarga se detenga (usuario canceló, u otro worker falló
 *   y frenó a los hermanos). Se propaga callado; sólo los fallos REALES logean y frenan.
 * ==========================================================================
 */
import type { FetchConReintentos } from "../util/reintentos";

/** Lo que el motor necesita del cliente del backend. Ver `core/backend/bunClient.ts`. */
export interface BackendDeFragmentos {
  enviarFragmentoStream(
    bloque: ArrayBuffer,
    meta: {
      videoTitle: string;
      chunkIndex: number;
      totalChunks: number;
      targetFolder: string;
      siteFolder?: string;
      sessionId: string;
    },
    signal: AbortSignal
  ): Promise<unknown>;
}

export interface DependenciasHls {
  fetchConReintentos: FetchConReintentos;
  descifrarFragmento(
    buffer: BufferSource,
    clave: CryptoKey,
    indice: number,
    lineaLlave?: string
  ): Promise<ArrayBuffer>;
  generarVideoFinalBlob(bloques: (BlobPart | null | undefined)[]): Blob;
  backend: BackendDeFragmentos;
}

/** Resultado de parsear el manifiesto. */
export interface MetadataHls {
  urls: string[];
  lineaLlave: string;
  urlLlave: string;
}

/**
 * Lo que el motor necesita saber de la ráfaga en curso y **no puede averiguar solo**: vive en
 * el estado de sesión del service worker, que es de la cola, no del motor.
 */
export interface ContextoRafaga {
  /** En turbo los fragmentos se streamean al backend y no se acumulan en memoria. */
  modoTurbo: boolean;
  /** Título canónico del video; viaja con cada fragmento para que el backend lo agrupe. */
  titulo: string;
  /** Vincula los fragmentos de esta ráfaga; evita huérfanos ante una cancelación abrupta. */
  sessionId: string;
  /**
   * [MULTIPORTAL E] De qué portal es la clase. Viaja con cada fragmento porque el backend lo
   * usa como carpeta un nivel arriba de la materia y como parte de la clave de su acumulador.
   * El motor no lo interpreta: lo pasa. Opcional, para no romper a un caller que no lo mande.
   */
  sitioId?: string;
  /**
   * Frena a los workers hermanos ante un fallo REAL de fragmento. Lo provee el caller porque
   * es el dueño del `AbortController` cuyo `signal` recibe este motor.
   */
  abortarHermanos?: () => void;
}

export interface CallbacksRafaga {
  onFragmentoCompletado?: (
    pesoBytesChunk: number,
    totalUrls: number,
    bytesAcumulados: number,
    fragmentosTerminados: number
  ) => void;
}

/** Pool de descarga: 6 fragmentos en vuelo. Subirlo no acelera, satura el CDN. */
const CONCURRENCIA_MAXIMA = 6;
/** Ventana mínima entre avisos de progreso, para no inundar el IPC. */
const UMBRAL_VENTANA_MS = 150;
/** Reintentos del envío SÓLO ante rechazo 4xx tipado (ver changelog v1.0.6). */
const MAX_REINTENTOS_RECHAZO = 3;

export function crearHlsEngine({
  fetchConReintentos,
  descifrarFragmento,
  generarVideoFinalBlob,
  backend,
}: DependenciasHls) {
  const motor = {
    /** Descarga y parsea el manifiesto HLS `.m3u8`. */
    async descargarYAnalizarIndexM3u8(urlM3u8: string, signal?: AbortSignal): Promise<MetadataHls> {
      const respuesta = await fetchConReintentos(urlM3u8, { signal });
      const cuerpoTexto = await respuesta.text();

      const lineas = cuerpoTexto.split(/\r?\n/);
      const urlsFragmentos: string[] = [];
      let lineaLlaveCripto = "";
      let urlLlaveAbsoluta = "";

      /**
       * Referencia relativa del manifiesto → URL absoluta.
       *
       * ⚠️ Esto era `urlM3u8.substring(0, urlM3u8.lastIndexOf("/")) + "/"` y **rompía con
       * cualquier playlist cuya URL lleve una barra en el QUERY**. El caso real (2026-08-07,
       * Anatomy by Chris): Akamai firma la variante con `?hdntl=exp=…~acl=/*~data=…`, y ese
       * `/` de `acl=/*` es el último de la cadena — así que el corte caía adentro del query y
       * los fragmentos salían como `…m3u8?hdntl=exp=…~acl=/` + `…-1.ts?hdntl=…`, con dos `?`.
       * El CDN contestaba 403 a todos, y como el motor reintenta 4 veces por fragmento con
       * backoff, una clase tardaba ~15 s en fallar por algo que no era del portal.
       *
       * `new URL(ref, base)` es la resolución del estándar: descarta el query de la base, corta
       * el path donde corresponde y encima resuelve lo que el `startsWith("http")` de antes no
       * miraba — rutas absolutas (`/x/y.ts`), `../` y URLs protocol-relative (`//host/x.ts`),
       * que con la concatenación quedaban mal armadas en silencio.
       */
      const absoluta = (ref: string) => new URL(ref, urlM3u8).href;

      for (const linea of lineas.map((l) => l.trim())) {
        if (linea.startsWith("#EXT-X-KEY")) {
          lineaLlaveCripto = linea;
          const matchUri = linea.match(/URI=["']([^"']+)["']/);
          if (matchUri?.[1]) {
            urlLlaveAbsoluta = absoluta(matchUri[1]);
          }
        } else if (linea.length > 0 && !linea.startsWith("#")) {
          urlsFragmentos.push(absoluta(linea));
        }
      }

      if (urlsFragmentos.length === 0) {
        throw new Error("El archivo manifiesto .m3u8 no contiene fragmentos de video válidos.");
      }

      return { urls: urlsFragmentos, lineaLlave: lineaLlaveCripto, urlLlave: urlLlaveAbsoluta };
    },

    /**
     * Orquesta la descarga en paralelo y el descifrado AES-128 de todos los fragmentos.
     *
     * Devuelve `null` en modo turbo (los fragmentos ya se fueron al backend) o el `Blob`
     * ensamblado en el camino legacy.
     */
    async compilarTranscodificacionStream(
      metadataHls: MetadataHls,
      signal: AbortSignal,
      subcarpeta: string,
      contexto: ContextoRafaga,
      callbacks: CallbacksRafaga = {}
    ): Promise<Blob | null> {
      const { modoTurbo, titulo, sessionId, sitioId, abortarHermanos } = contexto;

      let claveCryptoWeb: CryptoKey | null = null;
      if (metadataHls.urlLlave) {
        const resClave = await fetchConReintentos(metadataHls.urlLlave, { signal });
        const bufferClaveRaw = await resClave.arrayBuffer();
        claveCryptoWeb = await crypto.subtle.importKey("raw", bufferClaveRaw, { name: "AES-CBC" }, false, [
          "decrypt",
        ]);
      }

      // En turbo no se acumula nada: el array queda vacío y el Blob nunca se arma.
      const bloquesDescifrados: (ArrayBuffer | null)[] = modoTurbo
        ? []
        : new Array(metadataHls.urls.length).fill(null);
      let bytesAcumulados = 0;
      let fragmentosTerminados = 0;
      let ultimoMensajeTiempo = 0;

      const urlsConIndice = metadataHls.urls.map((url, idx) => ({ url, idx }));
      let siguienteTarea = 0;

      async function ejecutarWorkerDeRed(): Promise<void> {
        while (siguienteTarea < urlsConIndice.length) {
          if (signal.aborted) return;
          const tarea = urlsConIndice[siguienteTarea++];
          if (!tarea) break;

          try {
            const resChunk = await fetchConReintentos(tarea.url, { signal });
            const bufferCifradoRaw = await resChunk.arrayBuffer();

            let bloqueFinal: ArrayBuffer | null = claveCryptoWeb
              ? await descifrarFragmento(bufferCifradoRaw, claveCryptoWeb, tarea.idx, metadataHls.lineaLlave)
              : bufferCifradoRaw;

            if (modoTurbo) {
              // Reintento acotado SÓLO ante el rechazo 4xx tipado (ver changelog v1.0.6).
              let intentosRechazo = 0;
              for (;;) {
                try {
                  await backend.enviarFragmentoStream(
                    bloqueFinal,
                    {
                      videoTitle: titulo,
                      chunkIndex: tarea.idx,
                      totalChunks: metadataHls.urls.length,
                      targetFolder: subcarpeta,
                      siteFolder: sitioId,
                      sessionId,
                    },
                    signal
                  );
                  break;
                } catch (eEnvio) {
                  const rechazo = (eEnvio as { tipoBackend?: string })?.tipoBackend === "rechazo";
                  if (rechazo && ++intentosRechazo < MAX_REINTENTOS_RECHAZO && !signal.aborted) {
                    await new Promise((r) => setTimeout(r, 300 * intentosRechazo));
                    continue;
                  }
                  throw eEnvio; // agotado o no-rechazo → aborta la clase vía el catch del worker
                }
              }

              bytesAcumulados += bloqueFinal.byteLength;
              bloqueFinal = null; // liberar la referencia: en turbo el fragmento ya viajó
            } else {
              bloquesDescifrados[tarea.idx] = bloqueFinal;
              bytesAcumulados += bloqueFinal.byteLength;
            }

            fragmentosTerminados++;

            if (callbacks.onFragmentoCompletado) {
              const ahora = performance.now();
              // Se avisa por ventana de tiempo, salvo el último fragmento, que siempre avisa
              // (si no, la barra podría quedarse clavada abajo del 100%).
              if (
                ahora - ultimoMensajeTiempo > UMBRAL_VENTANA_MS ||
                fragmentosTerminados === metadataHls.urls.length
              ) {
                ultimoMensajeTiempo = ahora;
                callbacks.onFragmentoCompletado(
                  0,
                  metadataHls.urls.length,
                  bytesAcumulados,
                  fragmentosTerminados
                );
              }
            }
          } catch (errChunk) {
            // Un AbortError acá NO es un fallo del fragmento: la descarga se está deteniendo
            // (el usuario canceló, u OTRO worker falló de verdad y frenó a los hermanos). No
            // hay que re-abortar ni loguearlo como crítico: sólo propagar y salir. Así una
            // cancelación no llena la consola de ❌ falsos, uno por worker en vuelo.
            if ((errChunk as Error)?.name === "AbortError") throw errChunk;

            console.error(`❌ Error crítico en fragmento index [${tarea.idx}]:`, (errChunk as Error).message);
            // Fallo REAL: frenar a los hermanos. El controlador es del caller.
            try {
              abortarHermanos?.();
            } catch (e) {
              console.warn("⚠️ Falló el aborto de los workers hermanos:", (e as Error)?.message);
            }
            throw errChunk;
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCIA_MAXIMA }, ejecutarWorkerDeRed));

      if (signal.aborted) {
        throw new Error("Descarga interrumpida por solicitud del usuario.");
      }

      if (modoTurbo) return null;

      return generarVideoFinalBlob(bloquesDescifrados);
    },
  };

  return motor;
}

export type HlsEngine = ReturnType<typeof crearHlsEngine>;
