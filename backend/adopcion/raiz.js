import path from "node:path";
import os from "node:os";

/**
 * Raíz de la facultad (ADR-0018). Desde el 2026-09-26 es la bóveda; ~/U.N.L.P quedó retirado
 * (se conserva como respaldo). El índice .course-downloader.json vive acá y se versiona.
 */
export const RAIZ_FACULTAD = path.join(os.homedir(), "Boveda", "Areas", "Facultad");
