/**
 * ADAPTADOR CHROME — ESCRITURA A DISCO (V1.0.0)
 * ==========================================================================
 * Capa 3. Salió de `shared/utils.js` en la Fase 6a: usa `chrome.downloads`, así que nunca
 * fue Capa 1 aunque viviera en la carpeta de utilidades genéricas.
 *
 * ⚠️ **Camino legacy no-Turbo, hoy inalcanzable.** Turbo está forzado a `true` en todo el
 * proyecto, así que los fragmentos se streamean al backend Bun y nunca se arma un blob local.
 * Se mantiene porque es el único camino que no depende del backend, y borrarlo es una
 * decisión aparte (ver `docs/tech-stack.md` §Por qué Bun). No tiene tests por lo mismo:
 * ejercitarlo pediría un mock de `chrome.downloads` para código que no corre.
 *
 * No se le puso un `PuertoDescargas` a propósito: un puerto con un solo implementador y cero
 * llamadores vivos es ceremonia, no arquitectura. Si el camino legacy revive, ahí sí.
 */

/**
 * Escribe el binario final usando el subsistema de descargas de Chrome.
 *
 * Acepta un `Blob` o una object-URL ya creada. Con un `Blob` usa `URL.createObjectURL` —
 * **nunca** Base64: serializar un video de 500 MB a string generaba ~667 MB extra y tiraba el
 * proceso por OOM. Chrome consume la referencia al buffer directamente. La URL se revoca
 * apenas arranca la descarga; si la creó este helper, la limpia este helper.
 */
export function inyectarArchivoEnDiscoChrome(
  blobOrUrl: Blob | string,
  subRuta: string
): Promise<number> {
  return new Promise((resolver, rechazar) => {
    console.log(`💾 [DISCO] Iniciando volcado nativo para: /${subRuta}`);

    let objectUrl: string;
    let debeRevocar = false;

    if (typeof blobOrUrl === "string") {
      objectUrl = blobOrUrl;
    } else {
      try {
        objectUrl = URL.createObjectURL(blobOrUrl);
        debeRevocar = true;
      } catch (err) {
        rechazar(new Error(`No se pudo crear la Object URL del blob: ${(err as Error).message}`));
        return;
      }
    }

    chrome.downloads.download(
      { url: objectUrl, filename: subRuta, saveAs: false, conflictAction: "overwrite" },
      (downloadId?: number) => {
        if (debeRevocar) URL.revokeObjectURL(objectUrl);

        // lastError se lee DENTRO del callback (lo exige la API de callbacks de chrome.*).
        if (chrome.runtime.lastError) {
          console.error("❌ [DISCO-ERROR] chrome.downloads tiró error:", chrome.runtime.lastError.message);
          rechazar(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!downloadId) {
          rechazar(new Error("Descarga rechazada por el sistema nativo de Chrome."));
          return;
        }

        console.log(`✨ [DISCO] Descarga iniciada con éxito. ID: ${downloadId}`);
        resolver(downloadId);
      }
    );
  });
}

export default { inyectarArchivoEnDiscoChrome };
