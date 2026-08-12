import { createWriteStream } from "node:fs";
import { unlink, rename, stat } from "node:fs/promises";
import { log } from "./logger.js";

// Map<claveVideo, { nextExpectedIndex, pendingChunks, writeStream, lastActivity, targetFile,
//                    yaEscribiendo, totalEsperado, sessionId, tituloMostrado }>
//
// [MULTIPORTAL] La clave es `<portal>|<titulo>` y no el título solo: dos clases homónimas de
// portales distintos compartían sesión, stream y archivo `.part`. `tituloMostrado` existe para
// que los logs sigan diciendo el título limpio y no la clave.
export const acumuladorChunks = new Map();

// Registro rotativo de sesiones canceladas para evitar resurrección por chunks huérfanos
export const sessionesCanceladas = new Set();

export function registrarSesionCancelada(sessionId) {
  if (!sessionId) return;
  sessionesCanceladas.add(sessionId);
  if (sessionesCanceladas.size > 100) {
    const primerElemento = sessionesCanceladas.values().next().value;
    sessionesCanceladas.delete(primerElemento);
  }
}

/**
 * Recibe fragmentos, los almacena si están fuera de orden, y escribe progresivamente
 * al disco los fragmentos contiguos en cuanto se completan.
 */
export async function alimentarSlidingWindow(claveVideo, index, totalChunks, chunkBuffer, rutaArchivo, sessionId, tituloMostrado) {
  if (!acumuladorChunks.has(claveVideo)) {
    // Borrar el archivo mp4 final si existía uno previo completo
    await unlink(rutaArchivo).catch(() => {});

    const stream = createWriteStream(rutaArchivo + ".part");
    acumuladorChunks.set(claveVideo, {
      nextExpectedIndex: 0,
      pendingChunks: new Map(),
      writeStream: stream,
      lastActivity: Date.now(),
      targetFile: rutaArchivo,
      yaEscribiendo: false,
      totalEsperado: totalChunks,
      sessionId: sessionId,
      tituloMostrado: tituloMostrado || claveVideo
    });
  }

  const sesion = acumuladorChunks.get(claveVideo);
  sesion.lastActivity = Date.now();
  sesion.totalEsperado = totalChunks;

  // Ignorar reintentos duplicados de red de fragmentos que ya se escribieron
  if (index < sesion.nextExpectedIndex) {
    return sesion;
  }

  // Almacenar el fragmento en la cola de pendientes
  sesion.pendingChunks.set(index, chunkBuffer);

  // Escribir al stream en orden secuencial estricto todos los fragmentos contiguos
  while (sesion.pendingChunks.has(sesion.nextExpectedIndex)) {
    const bloque = sesion.pendingChunks.get(sesion.nextExpectedIndex);
    sesion.pendingChunks.delete(sesion.nextExpectedIndex);

    await new Promise((resolve, reject) => {
      sesion.writeStream.write(bloque, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    sesion.nextExpectedIndex++;
  }

  // Verificar si la descarga ha concluido completamente
  if (sesion.totalEsperado && sesion.nextExpectedIndex >= sesion.totalEsperado) {
    if (!sesion.yaEscribiendo) {
      sesion.yaEscribiendo = true;
      await flushVideoADisco(claveVideo, sesion);
    }
  }

  return sesion;
}

/**
 * Cierra el stream de escritura y renombra el archivo temporal .part al definitivo
 */
export async function flushVideoADisco(claveVideo, sesion) {
  const { writeStream, targetFile } = sesion;
  // Los mensajes muestran el título, no la clave: la clave es un detalle interno.
  const tituloVideo = sesion.tituloMostrado || claveVideo;

  log("FLUSH", "DISCO", `Finalizando descarga y cerrando stream para: "${tituloVideo}"`, {
    ruta: targetFile
  });

  // Cerrar el stream de escritura
  await new Promise((resolve) => {
    writeStream.end(resolve);
  });

  // Renombrar archivo temporal .part al definitivo .mp4
  await rename(targetFile + ".part", targetFile);

  // Obtener tamaño final para telemetría del backend
  let finalSize = 0;
  try {
    const s = await stat(targetFile);
    finalSize = s.size;
  } catch {}

  acumuladorChunks.delete(claveVideo);

  const tamañoMB = (finalSize / 1024 / 1024).toFixed(1);
  const tituloCorto = tituloVideo.length > 25 ? tituloVideo.slice(0, 22) + "..." : tituloVideo;
  process.stdout.write(`\r✅ [GUARDADO]    ${tituloCorto.padEnd(25)} | ${tamañoMB.padStart(6)} MB guardados exitosamente.\n`);
}

/**
 * Aborta la descarga activa, cierra el stream y elimina el archivo parcial .part del disco
 */
export async function abortarDescargaYLimpiar(claveVideo, sessionId) {
  if (sessionId) {
    registrarSesionCancelada(sessionId);
  }

  if (!acumuladorChunks.has(claveVideo)) return;

  const sesion = acumuladorChunks.get(claveVideo);
  if (sessionId && sesion.sessionId && sesion.sessionId !== sessionId) {
    // Si el sessionId a cancelar es diferente del activo, no borrar (ya es una sesión más nueva)
    return;
  }

  acumuladorChunks.delete(claveVideo);

  log("ABORT", "DISCO", `Cancelando y limpiando recursos de: "${sesion.tituloMostrado || claveVideo}"`);

  // Cerrar y destruir el stream de escritura
  if (sesion.writeStream) {
    try {
      sesion.writeStream.end();
      sesion.writeStream.destroy();
    } catch {}
  }

  // Borrar el archivo temporal .part de disco
  const pathPart = sesion.targetFile + ".part";
  try {
    await unlink(pathPart);
    log("DEBUG", "DISCO", `Archivo temporal eliminado: ${pathPart}`);
  } catch (err) {
    if (err.code !== "ENOENT") {
      log("ERROR", "DISCO", `No se pudo borrar el archivo temporal: ${err.message}`);
    }
  }
}
