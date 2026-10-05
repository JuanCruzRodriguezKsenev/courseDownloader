/**
 * DETECCIÓN DE ENLACES DE VIDEOLLAMADA
 * =====================================
 * Módulo canónico para clasificar URLs y claves de acceso de videollamadas
 * (Google Meet, Zoom, Microsoft Teams, Webex, Jitsi).
 *
 * RN-1, RN-32, NFR-2.
 */

export const DOMINIOS_VIDEOLLAMADA = [
  "meet.google.com",
  "zoom.us",
  "teams.microsoft.com",
  "teams.live.com",
  "webex.com",
  "meet.jit.si",
  "jitsi.net",
] as const;

export function esEnlaceVideollamada(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const h = new URL(url).host.toLowerCase();
    return DOMINIOS_VIDEOLLAMADA.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return /(?:^|\/\/|\.)(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|webex\.com|meet\.jit\.si|jitsi\.net)(?:\/|:|$)/i.test(
      url
    );
  }
}

export function claveEsVideollamada(clave: string): boolean {
  if (!clave) return false;
  const match = /^[^:]+:acceso:([^:]+):/.exec(clave);
  if (!match || !match[1]) return false;
  try {
    const url = decodeURIComponent(match[1]);
    return esEnlaceVideollamada(url);
  } catch {
    return false;
  }
}
