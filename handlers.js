import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { VERSION, CARPETA_RAIZ_VIDEOS, MAX_CHUNK_BYTES, CONFIG_USER_FILE, establecerRutaRaiz } from "./config.js";
import { log } from "./logger.js";
import { sanitizarNombreArchivo, esRutaSegura } from "./utils.js";
import { acumuladorChunks, alimentarSlidingWindow, abortarDescargaYLimpiar, sessionesCanceladas } from "./accumulator.js";

let extensionConectada = false;

/**
 * Health check handler
 */
export async function handleHealth(request, corsHeaders) {
  if (!extensionConectada) {
    extensionConectada = true;
    process.stdout.write(`\r📡 [CONEXIÓN]  Extensión conectada con éxito.\n`);
  }
  return new Response(
    JSON.stringify({ status: "ok", version: VERSION, ruta: CARPETA_RAIZ_VIDEOS }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

/**
 * Disk scanner handler
 */
export async function handleEscanearDisco(url, corsHeaders) {
  try {
    const subCarpeta = sanitizarNombreArchivo(url.searchParams.get("carpeta") || "descargas");
    
    if (!extensionConectada) {
      extensionConectada = true;
      process.stdout.write(`\r📡 [CONEXIÓN]  Extensión conectada con éxito.\n`);
    }

    const carpetaDestino = path.join(CARPETA_RAIZ_VIDEOS, subCarpeta.toLowerCase());

    if (!esRutaSegura(carpetaDestino)) {
      return new Response(JSON.stringify({ error: "Ruta inválida." }), { status: 400, headers: corsHeaders });
    }

    if (!existsSync(carpetaDestino)) {
      process.stdout.write(`\r📂 [DISCO]     Carpeta "${subCarpeta}" sincronizada con la extensión (0 videos detectados).\n`);
      return new Response(JSON.stringify({ archivos: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { readdir } = await import("node:fs/promises");
    const items = await readdir(carpetaDestino, { withFileTypes: true });
    const nombresLimpios = items
      .filter(item => item.isFile() && item.name.toLowerCase().endsWith(".mp4"))
      .map(item => item.name.replace(/\.[^/.]+$/, "").toLowerCase().trim());

    process.stdout.write(`\r📂 [DISCO]     Carpeta "${subCarpeta}" sincronizada con la extensión (${nombresLimpios.length} videos detectados).\n`);

    return new Response(JSON.stringify({ archivos: nombresLimpios }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Console update handler
 */
export async function handleActualizarConsola(request, corsHeaders) {
  try {
    const { titulo, porcentaje, terminados, totales, velocidad } = await request.json();
    
    // GUARDIA: Si el video ya no está en el acumulador, significa que ya se guardó a disco,
    // por lo tanto ignoramos cualquier mensaje de consola rezagado de la extensión.
    const tituloSani = sanitizarNombreArchivo(titulo);
    if (!acumuladorChunks.has(tituloSani)) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const tituloCorto = tituloSani.length > 18 ? tituloSani.slice(0, 15) + "..." : tituloSani;

    if (porcentaje >= 100) {
      process.stdout.write(`\x1b[2K\r💾 [ESCRIBIENDO] ${tituloCorto.padEnd(18)} | Guardando en disco...\r`);
    } else {
      const numBloques = Math.min(Math.floor((porcentaje / 100) * 8), 8);
      const visualBar  = "█".repeat(numBloques) + "░".repeat(8 - numBloques);
      const velocidadTexto = `${(velocidad || 0).toFixed(1)}MB/s`;

      process.stdout.write(`\x1b[2K\r🎬 [BAJANDO] ${tituloCorto.padEnd(18)} | ${visualBar} ${String(porcentaje).padStart(3, ' ')}% | ${terminados}/${totales} | ${velocidadTexto.padStart(8)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * HLS Chunk receiver handler (Bypass-stream)
 */
export async function handleBypassStream(request, corsHeaders) {
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_CHUNK_BYTES) {
      log("ERROR", "CHUNK", `Chunk rechazado por tamaño excesivo: ${(contentLength/1024/1024).toFixed(1)} MB`);
      return new Response(
        JSON.stringify({ error: `Chunk excede el límite de ${MAX_CHUNK_BYTES / 1024 / 1024} MB.` }),
        { status: 413, headers: corsHeaders }
      );
    }

    const tituloRaw   = decodeURIComponent(request.headers.get("x-video-title") || "video_sin_nombre");
    const tituloVideo = sanitizarNombreArchivo(tituloRaw);
    const indiceChunk = parseInt(request.headers.get("x-chunk-index") || "0", 10);
    const totalChunks = parseInt(request.headers.get("x-total-chunks") || "0", 10);
    const subCarpeta  = sanitizarNombreArchivo(request.headers.get("x-target-folder") || "descargas");
    const sessionId   = request.headers.get("x-session-id") || "";

    log("CHUNK", "IPC", `Chunk recibido`, { titulo: tituloVideo, indice: indiceChunk, sessionId });

    // Control contra sesiones canceladas tardías
    if (sessionId && sessionesCanceladas.has(sessionId)) {
      log("WARN", "ACUMULADOR", `⚠️ Chunk huérfano [${indiceChunk}] recibido para sesión cancelada "${sessionId}" de "${tituloVideo}" — ignorando.`);
      return new Response(JSON.stringify({ error: "Sesión cancelada." }), { status: 400, headers: corsHeaders });
    }

    let subCarpetaFinal = subCarpeta.toLowerCase();

    if (indiceChunk === 0) {
      // Chequeo de protección contra incompatibilidad de cátedras
      try {
        const carpetaDestinoBase = path.join(CARPETA_RAIZ_VIDEOS, subCarpetaFinal);
        if (existsSync(carpetaDestinoBase)) {
          const { readdir } = await import("node:fs/promises");
          const items = await readdir(carpetaDestinoBase, { withFileTypes: true });
          const archivosMp4 = items
            .filter(item => item.isFile() && item.name.toLowerCase().endsWith(".mp4"))
            .map(item => item.name.toUpperCase());
          
          // Identificar la cátedra de la nueva clase
          const matchCatedraNuevo = tituloVideo.toUpperCase().match(/\b(ANATO|ANATOMIA|BIOLOGIA|BIO|QUIMICA|QUIM)\s+([A-Z])\b/);
          if (matchCatedraNuevo) {
            const materiaNuevo = matchCatedraNuevo[1];
            const letraNuevo = matchCatedraNuevo[2];
            
            // Buscar si en el disco hay archivos de OTRA cátedra de la misma materia
            let tieneConflictos = false;
            for (const nom of archivosMp4) {
              const matchCatedraDisco = nom.match(/\b(ANATO|ANATOMIA|BIOLOGIA|BIO|QUIMICA|QUIM)\s+([A-Z])\b/);
              if (matchCatedraDisco) {
                const letraDisco = matchCatedraDisco[2];
                if (letraDisco !== letraNuevo) {
                  tieneConflictos = true;
                  break;
                }
              }
            }

            if (tieneConflictos) {
              const materiaNombre = materiaNuevo.toLowerCase().substring(0, 5); // ej: "anato"
              subCarpetaFinal = `${materiaNombre} ${letraNuevo.toLowerCase()}`;
              log("WARN", "CATEDRA-CONFLICT", `⚠️ Conflicto detectado en "${subCarpeta}". Redirigiendo "${tituloVideo}" a la carpeta protectora: "${subCarpetaFinal}"`);
            }
          }
        }
      } catch (e) {
        log("ERROR", "CATEDRA-CONFLICT", `Error al verificar incompatibilidad de cátedras: ${e.message}`);
      }
    }

    // Si la sesión ya existe en el acumulador deslizable, respetamos la ruta resuelta previamente y validamos ID
    let rutaArchivoFinal;
    if (acumuladorChunks.has(tituloVideo)) {
      const sesionExistente = acumuladorChunks.get(tituloVideo);
      if (sessionId && sesionExistente.sessionId && sesionExistente.sessionId !== sessionId) {
        if (indiceChunk === 0) {
          log("WARN", "ACUMULADOR", `⚠️ Nueva sesión detectada para "${tituloVideo}". Abortando sesión anterior "${sesionExistente.sessionId}"`);
          await abortarDescargaYLimpiar(tituloVideo, sesionExistente.sessionId);
        } else {
          log("WARN", "ACUMULADOR", `⚠️ Chunk [${indiceChunk}] con Session ID "${sessionId}" no coincide con la sesión activa "${sesionExistente.sessionId}" — ignorando.`);
          return new Response(JSON.stringify({ error: "Session ID no coincide." }), { status: 400, headers: corsHeaders });
        }
      }
    }

    if (acumuladorChunks.has(tituloVideo)) {
      rutaArchivoFinal = acumuladorChunks.get(tituloVideo).targetFile;
    } else {
      // Control defensivo contra fragmentos huérfanos/tardíos de descargas ya canceladas
      if (!sessionId && indiceChunk > 0) {
        log("WARN", "ACUMULADOR", `⚠️ Chunk huérfano [${indiceChunk}] recibido para "${tituloVideo}" sin sesión activa ni ID de sesión — ignorando.`);
        return new Response(JSON.stringify({ error: "Descarga cancelada o inexistente." }), { status: 400, headers: corsHeaders });
      }

      const carpetaDestino = path.join(CARPETA_RAIZ_VIDEOS, subCarpetaFinal);
      rutaArchivoFinal = path.join(carpetaDestino, `${tituloVideo}.mp4`);

      if (!esRutaSegura(carpetaDestino) || !esRutaSegura(rutaArchivoFinal)) {
        log("ERROR", "SEGURIDAD", `Path traversal detectado`, { tituloVideo, rutaArchivoFinal });
        return new Response(JSON.stringify({ error: "Ruta de archivo no segura." }), { status: 400, headers: corsHeaders });
      }

      await mkdir(carpetaDestino, { recursive: true });
    }

    if (indiceChunk === 0) {
      if (acumuladorChunks.has(tituloVideo)) {
        const sesionExistente = acumuladorChunks.get(tituloVideo);
        if (sesionExistente.sessionId !== sessionId) {
          log("WARN", "ACUMULADOR", `⚠️ CHUNK 0 recibido con nueva sesión — reiniciando acumulador`, { titulo: tituloVideo });
          await abortarDescargaYLimpiar(tituloVideo, sesionExistente.sessionId);
        }
      }
    }

    const arrayBuffer = await request.arrayBuffer();
    const bufferChunk = new Uint8Array(arrayBuffer);

    if (bufferChunk.length === 0) {
      return new Response(JSON.stringify({ error: `Chunk [${indiceChunk}] vacío.` }), { status: 400, headers: corsHeaders });
    }

    // Alimentar la Ventana Deslizable progresiva
    const sesion = await alimentarSlidingWindow(tituloVideo, indiceChunk, totalChunks, bufferChunk, rutaArchivoFinal, sessionId);

    return new Response(
      JSON.stringify({ success: true, chunk: indiceChunk, recibidos: sesion.nextExpectedIndex, total: totalChunks }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    log("ERROR", "CHUNK", `Error procesando chunk: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Abre un selector nativo de carpetas de Windows y actualiza la ruta raiz de guardado
 */
export async function handleSeleccionarCarpeta(request, corsHeaders) {
  try {
    const comandoPowerShell = "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Selecciona la carpeta de destino para RamonNet Turbo'; $f.ShowNewFolderButton = $true; $c = $f.ShowDialog(); if ($c -eq 'OK') { $f.SelectedPath }";
    
    const proc = Bun.spawn(["powershell", "-Sta", "-Command", comandoPowerShell]);
    const output = await new Response(proc.stdout).text();
    const rutaSeleccionada = output.trim();

    if (rutaSeleccionada) {
      establecerRutaRaiz(rutaSeleccionada);
      const fs = await import("node:fs/promises");
      await fs.writeFile(CONFIG_USER_FILE, JSON.stringify({ rutaRaiz: rutaSeleccionada }, null, 2), "utf8");
      
      process.stdout.write(`\r📂 [DISCO]     Nueva carpeta raiz establecida: "${rutaSeleccionada}"\n`);
      
      return new Response(JSON.stringify({ success: true, ruta: rutaSeleccionada }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: "Cancelado por el usuario." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    log("ERROR", "DISCO", `Error al abrir selector de carpeta: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Endpoint para notificar la cancelación de una descarga y borrar archivos temporales
 */
export async function handleCancelarDescarga(url, corsHeaders) {
  try {
    const titulo = decodeURIComponent(url.searchParams.get("titulo") || "");
    const sessionId = url.searchParams.get("sessionId") || "";
    if (!titulo) {
      return new Response(JSON.stringify({ error: "Falta el parámetro título." }), { status: 400, headers: corsHeaders });
    }

    await abortarDescargaYLimpiar(titulo, sessionId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
