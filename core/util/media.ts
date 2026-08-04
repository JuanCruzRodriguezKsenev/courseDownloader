/**
 * DESCIFRADO Y ENSAMBLADO DE FRAGMENTOS (V1.0.0)
 * ==========================================================================
 * Capa 1. Salieron de `shared/utils.js` en la Fase 6a, sin cambios de lógica.
 *
 * Nada de esto es `chrome.*`: `crypto.subtle` y `Blob` son APIs web estándar, disponibles
 * tanto en el service worker como en el popup. Por eso son Capa 1 y no Capa 3.
 */

/**
 * Descifra un fragmento `.ts` con AES-128-CBC nativo (WebCrypto).
 *
 * El IV sale de la línea `#EXT-X-KEY` del manifiesto si viene declarado (`IV=0x...`); si no,
 * HLS manda usar **el número de secuencia del fragmento** como IV, que es lo que arma la rama
 * del `else`: un buffer de 16 bytes con el índice (base 1) escrito en los últimos 4. Cambiar
 * ese `+ 1` desalinea el descifrado de todo el video sin que falle nada de forma visible.
 */
export async function descifrarFragmento(
  arrayBufferCifrado: BufferSource,
  cryptoKey: CryptoKey,
  miIndice: number,
  lineaLlave = ""
): Promise<ArrayBuffer> {
  try {
    const iv = new Uint8Array(16);
    const ivMatch = lineaLlave ? lineaLlave.match(/IV=0x([0-9a-fA-F]+)/) : null;

    if (ivMatch) {
      const hex = ivMatch[1]!.padStart(32, "0");
      for (let j = 0; j < 16; j++) {
        iv[j] = parseInt(hex.slice(j * 2, j * 2 + 2), 16);
      }
    } else {
      const view = new DataView(iv.buffer);
      view.setUint32(12, miIndice + 1);
    }

    return await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cryptoKey, arrayBufferCifrado);
  } catch (err) {
    console.error(`❌ [CRYPTO-ERROR] Falló descifrado del fragmento index [${miIndice}]:`, err);
    throw err;
  }
}

/**
 * Ensambla los fragmentos descifrados en un único video, sin duplicar la RAM: el `Blob` toma
 * referencias a los buffers, no copias. Sólo lo usa el camino legacy no-Turbo — en Turbo los
 * fragmentos se streamean al backend Bun y nunca se juntan en memoria.
 */
export function generarVideoFinalBlob(bloquesDescifrados: (BlobPart | null | undefined)[]): Blob {
  console.log("📦 [ENGINE] Ensamblando fragmentos descifrados de forma nativa...");
  const bloquesValidos = bloquesDescifrados.filter(Boolean) as BlobPart[];

  if (bloquesValidos.length === 0) {
    throw new Error("El arreglo de bloques descifrados está completamente vacío.");
  }

  return new Blob(bloquesValidos, { type: "video/mp4" });
}
