import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { VERSION, CARPETA_RAIZ_VIDEOS, MAX_CHUNK_BYTES, CONFIG_USER_FILE, establecerRutaRaiz } from "./config.js";
import { log } from "./logger.js";
import { sanitizarNombreArchivo, esRutaSegura } from "./utils.js";
import { acumuladorChunks, alimentarSlidingWindow, abortarDescargaYLimpiar, sessionesCanceladas } from "./accumulator.js";

let extensionConectada = false;

/**
 * [MULTIPORTAL] La carpeta del portal, un nivel por encima de la materia.
 *
 * El layout pasó de `raíz/<materia>/` a `raíz/<portal>/<materia>/` porque con N portales dos
 * clases homónimas de la misma materia escribían el mismo archivo y se pisaban.
 *
 * **Se sanitiza por separado y no junto con la subcarpeta**: `sanitizarNombreArchivo` hace
 * `path.basename()`, así que sanitizar `"ramonnet/biologia"` de una sola vez devolvería
 * `"biologia"` y la carpeta de portal desaparecería en silencio.
 *
 * Devuelve `""` cuando el pedido no lo trae, y ahí el layout es el de antes (un solo nivel).
 * Eso es deliberado: una extensión anterior a este cambio sigue funcionando contra este backend.
 */
function carpetaDeSitio(crudo) {
  if (!crudo) return "";
  return sanitizarNombreArchivo(crudo).toLowerCase();
}

/** La ruta de destino, con la carpeta de portal adelante si vino. */
function rutaDeDestino(carpetaSitio, subCarpeta) {
  return carpetaSitio
    ? path.join(CARPETA_RAIZ_VIDEOS, carpetaSitio, subCarpeta)
    : path.join(CARPETA_RAIZ_VIDEOS, subCarpeta);
}

/**
 * La clave del acumulador en memoria.
 *
 * También lleva el portal: sin él, dos descargas de clases homónimas de portales distintos
 * compartirían sesión, stream y archivo temporal `.part`. Es el mismo motivo por el que la
 * extensión pasó a identificar por (portal, título).
 */
function claveSesion(carpetaSitio, tituloVideo) {
  return carpetaSitio ? `${carpetaSitio}|${tituloVideo}` : tituloVideo;
}

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
    // [MULTIPORTAL] Sin `sitio` se mira el layout viejo, de un solo nivel.
    const carpetaSitio = carpetaDeSitio(url.searchParams.get("sitio"));
    
    if (!extensionConectada) {
      extensionConectada = true;
      process.stdout.write(`\r📡 [CONEXIÓN]  Extensión conectada con éxito.\n`);
    }

    const carpetaDestino = rutaDeDestino(carpetaSitio, subCarpeta.toLowerCase());

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
    // [ADJUNTOS] Antes esto filtraba SÓLO `.mp4`, y con los materiales adentro era un fallo
    // silencioso: un PDF ya bajado nunca se reportaba, así que la extensión lo mostraba
    // pendiente para siempre y lo volvía a bajar en cada ráfaga.
    //
    // ⚠️ La asimetría de abajo es DELIBERADA, no un descuido: al video se le saca la extensión y
    // al adjunto NO. La extensión compara estos nombres contra el título de la clase, y el
    // título de un video no lleva extensión (`Clase 1`) mientras que el de un adjunto SÍ
    // (`Atlas.pdf`) — es su nombre de archivo. Devolver `atlas` no matchearía nunca.
    const nombresLimpios = items
      .filter(item => item.isFile())
      .map(item =>
        item.name.toLowerCase().endsWith(".mp4")
          ? item.name.replace(/\.[^/.]+$/, "").toLowerCase().trim()
          : item.name.toLowerCase().trim()
      );

    process.stdout.write(`\r📂 [DISCO]     Carpeta "${subCarpeta}" sincronizada con la extensión (${nombresLimpios.length} archivos detectados).\n`);

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
    const { titulo, porcentaje, terminados, totales, velocidad, sitioId } = await request.json();

    // GUARDIA: Si el video ya no está en el acumulador, significa que ya se guardó a disco,
    // por lo tanto ignoramos cualquier mensaje de consola rezagado de la extensión.
    // [MULTIPORTAL] La guarda consulta por la MISMA clave compuesta con la que se acumula; con
    // el título pelado, el progreso de una clase silenciaba el de su homónima de otro portal.
    const tituloSani = sanitizarNombreArchivo(titulo);
    const claveVideo = claveSesion(carpetaDeSitio(sitioId), tituloSani);
    if (!acumuladorChunks.has(claveVideo)) {
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
    // [MULTIPORTAL] De qué portal es la clase. Va en su propio header y no pegado a
    // `x-target-folder` justamente por el `path.basename()` de la sanitización.
    const carpetaSitio = carpetaDeSitio(request.headers.get("x-site-folder"));
    const sessionId   = request.headers.get("x-session-id") || "";
    // [ADJUNTOS] Nombre de archivo COMPLETO, con su extensión, para lo que no es un `.mp4`.
    // Vacío = el camino de siempre. Ver el comentario donde se arma `rutaArchivoFinal`.
    const nombrePedido = decodeURIComponent(request.headers.get("x-file-name") || "");
    // La clave del acumulador lleva el portal; el título pelado se conserva para los logs y
    // para el nombre del archivo, que no cambian.
    const claveVideo  = claveSesion(carpetaSitio, tituloVideo);

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
        const carpetaDestinoBase = rutaDeDestino(carpetaSitio, subCarpetaFinal);
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
    if (acumuladorChunks.has(claveVideo)) {
      const sesionExistente = acumuladorChunks.get(claveVideo);
      if (sessionId && sesionExistente.sessionId && sesionExistente.sessionId !== sessionId) {
        if (indiceChunk === 0) {
          log("WARN", "ACUMULADOR", `⚠️ Nueva sesión detectada para "${tituloVideo}". Abortando sesión anterior "${sesionExistente.sessionId}"`);
          await abortarDescargaYLimpiar(claveVideo, sesionExistente.sessionId);
        } else {
          log("WARN", "ACUMULADOR", `⚠️ Chunk [${indiceChunk}] con Session ID "${sessionId}" no coincide con la sesión activa "${sesionExistente.sessionId}" — ignorando.`);
          return new Response(JSON.stringify({ error: "Session ID no coincide." }), { status: 400, headers: corsHeaders });
        }
      }
    }

    if (acumuladorChunks.has(claveVideo)) {
      rutaArchivoFinal = acumuladorChunks.get(claveVideo).targetFile;
    } else {
      // Control defensivo contra fragmentos huérfanos/tardíos de descargas ya canceladas
      if (!sessionId && indiceChunk > 0) {
        log("WARN", "ACUMULADOR", `⚠️ Chunk huérfano [${indiceChunk}] recibido para "${tituloVideo}" sin sesión activa ni ID de sesión — ignorando.`);
        return new Response(JSON.stringify({ error: "Descarga cancelada o inexistente." }), { status: 400, headers: corsHeaders });
      }

      const carpetaDestino = rutaDeDestino(carpetaSitio, subCarpetaFinal);
      // [ADJUNTOS] El `.mp4` era correcto mientras lo único que llegaba acá eran videos. Con los
      // materiales de Hotmart adentro producía `Atlas.pdf.mp4`: un PDF válido con un nombre que
      // ningún visor abre.
      //
      // El contrato es "si viene `x-file-name`, mandá; si no, hacé lo de siempre" — un `if`, y
      // los videos no cambian en nada. Se sanitiza igual que todo lo demás: `path.basename()` +
      // lista blanca, que **incluye el punto**, así que la extensión sobrevive.
      rutaArchivoFinal = path.join(
        carpetaDestino,
        nombrePedido ? sanitizarNombreArchivo(nombrePedido) : `${tituloVideo}.mp4`
      );

      if (!esRutaSegura(carpetaDestino) || !esRutaSegura(rutaArchivoFinal)) {
        log("ERROR", "SEGURIDAD", `Path traversal detectado`, { tituloVideo, rutaArchivoFinal });
        return new Response(JSON.stringify({ error: "Ruta de archivo no segura." }), { status: 400, headers: corsHeaders });
      }

      await mkdir(carpetaDestino, { recursive: true });
    }

    if (indiceChunk === 0) {
      if (acumuladorChunks.has(claveVideo)) {
        const sesionExistente = acumuladorChunks.get(claveVideo);
        if (sesionExistente.sessionId !== sessionId) {
          log("WARN", "ACUMULADOR", `⚠️ CHUNK 0 recibido con nueva sesión — reiniciando acumulador`, { titulo: tituloVideo });
          await abortarDescargaYLimpiar(claveVideo, sesionExistente.sessionId);
        }
      }
    }

    const arrayBuffer = await request.arrayBuffer();
    const bufferChunk = new Uint8Array(arrayBuffer);

    if (bufferChunk.length === 0) {
      return new Response(JSON.stringify({ error: `Chunk [${indiceChunk}] vacío.` }), { status: 400, headers: corsHeaders });
    }

    // Alimentar la Ventana Deslizable progresiva
    const sesion = await alimentarSlidingWindow(claveVideo, indiceChunk, totalChunks, bufferChunk, rutaArchivoFinal, sessionId, tituloVideo);

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

    // [MULTIPORTAL] Con el título pelado, cancelar una descarga podía borrar el `.part` de la
    // clase homónima del otro portal — que además estaría a medio bajar.
    // El título va SANITIZADO, como se guardó: el acumulador se llena con
    // `sanitizarNombreArchivo(tituloRaw)`. Comparar contra el crudo no matcheaba nunca cuando
    // el título traía caracteres que la sanitización reemplaza — bug previo, arreglado acá
    // porque esta línea igual cambiaba.
    const claveVideo = claveSesion(
      carpetaDeSitio(url.searchParams.get("sitio")),
      sanitizarNombreArchivo(titulo)
    );
    await abortarDescargaYLimpiar(claveVideo, sessionId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
}
