import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { RAIZ_FACULTAD } from "./adopcion/raiz.js";

export const VERSION = "1.8.0-PRODUCTION";
export const PORT    = 3001;
export const HOST    = "127.0.0.1"; // Solo loopback

export const DEBUG_MODE = false;

const RUTA_BASE_HOME         = process.env.USERPROFILE || process.env.HOME || "";
const DEFAULT_RAIZ = path.join(RUTA_BASE_HOME, "Downloads", "RamonNet_Turbo");

// Cargar la ruta guardada por el usuario o usar la por defecto
export let CARPETA_RAIZ_VIDEOS = DEFAULT_RAIZ;
export const raicesPorPortal = {};
export const CONFIG_USER_FILE = path.join(import.meta.dir, "config_usuario.json");

if (existsSync(CONFIG_USER_FILE)) {
  try {
    const rawData = readFileSync(CONFIG_USER_FILE, "utf8");
    const parsed = JSON.parse(rawData);
    if (parsed.rutaRaiz) {
      CARPETA_RAIZ_VIDEOS = parsed.rutaRaiz;
    }
    if (parsed.raices && typeof parsed.raices === "object") {
      Object.assign(raicesPorPortal, parsed.raices);
    }
  } catch {
    // Si falla, se queda con la ruta por defecto
  }
}

// Función para actualizar la ruta en caliente
export function establecerRutaRaiz(nuevaRuta) {
  CARPETA_RAIZ_VIDEOS = nuevaRuta;
}

export function establecerRaizDePortal(portalId, ruta) {
  raicesPorPortal[portalId] = ruta;
}

export function raizDeDestino(portalId) {
  if (portalId && raicesPorPortal[portalId]) {
    return raicesPorPortal[portalId];
  }
  if (portalId === "google-classroom") {
    return RAIZ_FACULTAD;
  }
  return CARPETA_RAIZ_VIDEOS;
}


export const MAX_CHUNK_BYTES        = 10 * 1024 * 1024; // 10 MB
export const EXTENSION_ID_ORIGEN     = "chrome-extension://TU_EXTENSION_ID_AQUI";
