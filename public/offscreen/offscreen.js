/**
 * CLON DOWNLOADHELPER - RESUELTO PARA OBJECTURL EN HILO OFFSCREEN (V1.0.0)
 * ==========================================================================
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "crear_blob_url") {
    try {
      // message.blob es un objeto Blob reconstruido por Structured Clone
      const blobUrl = URL.createObjectURL(message.blob);
      sendResponse({ blobUrl });
    } catch (err) {
      console.error("❌ [OFFSCREEN] Error al generar Object URL:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }

  if (message.action === "revocar_blob_url") {
    try {
      URL.revokeObjectURL(message.blobUrl);
      sendResponse({ success: true });
    } catch (err) {
      console.error("❌ [OFFSCREEN] Error al revocar Object URL:", err);
      sendResponse({ error: err.message });
    }
    return true;
  }
});
