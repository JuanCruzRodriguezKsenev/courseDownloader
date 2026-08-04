/**
 * ENTRYPOINT DEL SERVICE WORKER (WXT)
 * ==========================================================================
 * Punto de composición del SW: carga las dependencias en el orden correcto y
 * después el orquestador. Reemplaza al `importScripts(...)` del SW clásico — el
 * bundler arma un único archivo a partir de este grafo de imports.
 *
 * El orden IMPORTA y es el mismo que tenía importScripts: cada módulo se publica
 * como global (`globalThis.X = X`) al importarse, y los que vienen después lo
 * consumen sin importarlo. El adaptador de sitio va primero porque el daemon de
 * conexión y el loop de descarga leen de él (ADR-0008 / ADR-0009).
 *
 * `background.js` va ÚLTIMO: registra los listeners de chrome.* al evaluarse, y
 * necesita que todas las globals existan para entonces.
 */
import { defineBackground } from 'wxt/utils/define-background';

import '../sitio/ramonnet/config.ts';
import '../sitio/ramonnet/parserTitulos.js';
import '../sitio/ramonnet/resolverManifiesto.js';
import '../core/backend/bunClient.ts';
// Composición: instancia y publica TODOS los globals ya desacoplados de chrome.* — los
// puertos, el daemon de conexión, el estado, `Utils` (ensamblado desde la Fase 6a) y el
// motor HLS (Fase 6). Va ANTES de background.js, que es quien los consume.
import '../plataforma/composicion.ts';
import '../background.js';

// Los listeners ya quedaron registrados por los imports de arriba (top-level del SW,
// que es lo que exige MV3). Este callback existe porque WXT lo requiere como forma
// del entrypoint; no hay nada que hacer acá.
export default defineBackground(() => {});
