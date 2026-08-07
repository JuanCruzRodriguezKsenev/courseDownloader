/**
 * CLON DOWNLOADHELPER - BACKEND DE PERSISTENCIA ULTRA-RÁPIDA EN BUN (V1.7.0-PRODUCTION)
 * MODULO PRINCIPAL - ENTRADA DE SERVIDOR HTTP BUN
 * ==========================================================================
 */

import { PORT, HOST, VERSION, CARPETA_RAIZ_VIDEOS, EXTENSION_ID_ORIGEN } from "./config.js";
import { acumuladorChunks, abortarDescargaYLimpiar } from "./accumulator.js";
import { handleHealth, handleEscanearDisco, handleActualizarConsola, handleBypassStream, handleSeleccionarCarpeta, handleCancelarDescarga } from "./handlers.js";

// Limpiar terminal en el inicio
console.log(`\x1Bc`);
console.log(`🚀 [BUN-CORE] Servidor V${VERSION} levantado en http://${HOST}:${PORT}`);
console.log(`📁 [BUN-CORE] Ruta base: ${CARPETA_RAIZ_VIDEOS}`);
console.log(`🔒 [BUN-CORE] Escuchando solo en loopback (127.0.0.1)`);
console.log(`🛑 [ATENCIÓN] Para apagar el servidor presiona Ctrl+C o cierra esta ventana.`);
console.log(`--------------------------------------------------------------------------------\n`);
process.stdout.write(`⏳ Esperando conexión de la extensión...`);

// Manejo de cierre limpio
async function cerrarServidor(señal) {
  console.log(`\n⚠️  [BUN-CORE] Señal ${señal} recibida. Cerrando servidor limpiamente...`);
  for (const titulo of acumuladorChunks.keys()) {
    try {
      await abortarDescargaYLimpiar(titulo);
    } catch (e) {}
  }
  acumuladorChunks.clear();
  console.log(`🔴 [BUN-CORE] Servidor detenido.\n`);
  process.exit(0);
}
process.on('SIGINT',  () => cerrarServidor('SIGINT'));
process.on('SIGTERM', () => cerrarServidor('SIGTERM'));

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  idleTimeout: 255, // Evita warnings de timeout si se tarda en elegir carpeta

  async fetch(request) {
    const url = new URL(request.url);

    const origin = request.headers.get("origin");
    // Permitir dinámicamente cualquier origen de extensión Chrome local para evitar bloqueos de CORS
    const originPermitido = (origin && origin.startsWith("chrome-extension://")) ? origin : EXTENSION_ID_ORIGEN;

    const corsHeaders = {
      "Access-Control-Allow-Origin": originPermitido,
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-video-title, x-chunk-index, x-target-folder, x-total-chunks, x-session-id",
    };

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Router de Endpoints HTTP
    if (url.pathname === "/api/health" && request.method === "GET") {
      return handleHealth(request, corsHeaders);
    }
    if (url.pathname === "/api/escanear-disco" && request.method === "GET") {
      return handleEscanearDisco(url, corsHeaders);
    }
    if (url.pathname === "/api/actualizar-consola" && request.method === "POST") {
      return handleActualizarConsola(request, corsHeaders);
    }
    if (url.pathname === "/api/bypass-stream" && request.method === "POST") {
      return handleBypassStream(request, corsHeaders);
    }
    if (url.pathname === "/api/seleccionar-carpeta" && request.method === "GET") {
      return handleSeleccionarCarpeta(request, corsHeaders);
    }
    if (url.pathname === "/api/cancelar-descarga" && request.method === "GET") {
      return handleCancelarDescarga(url, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

// Limpiador automático por inactividad (TTL de 5 minutos, corre cada 2 minutos)
setInterval(() => {
  const ahora = Date.now();
  const limiteInactividad = 5 * 60 * 1000; // 5 minutos
  for (const [titulo, sesion] of acumuladorChunks.entries()) {
    if (sesion.lastActivity && (ahora - sesion.lastActivity > limiteInactividad)) {
      console.log(`\n⏳ [CLEANUP] Detectada inactividad prolongada en: "${titulo}". Limpiando recursos...`);
      abortarDescargaYLimpiar(titulo).catch(() => {});
    }
  }
}, 2 * 60 * 1000);