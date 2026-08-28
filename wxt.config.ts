import { defineConfig } from 'wxt';

// Configuración de empaquetado (Fase 3 de docs/rearquitectura-diseno.md).
//
// El manifest deja de escribirse a mano: WXT lo GENERA desde este bloque + los
// entrypoints detectados en `entrypoints/`. El `manifest.json` de la raíz queda como
// referencia histórica hasta que esta rama se verifique en el navegador; lo de acá es
// una transcripción fiel de aquel (permisos, hosts, dNR, iconos y acción).
//
// Cambio de flujo diario: la carpeta que se carga en chrome://extensions/ pasa a ser
// `.output/chrome-mv3/`, no la raíz del repo.
export default defineConfig({
  // Los fuentes viven en la raíz (shared/, sitio/, popup/, styles/...), no en src/.
  // Sólo los entrypoints siguen la convención de WXT.
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',

  manifest: {
    name: 'Course Downloader',
    version: '5.2.0',
    description:
      'Extractor masivo, transcodificación nativa en paralelo y persistencia de estado por interceptación de red. [MODO TURBO BUN HABILITADO]',
    permissions: [
      'declarativeNetRequest',
      'downloads',
      'storage',
      'scripting',
      'tabs',
      'offscreen',
      'alarms',
      'notifications',
      'unlimitedStorage',
    ],
    host_permissions: [
      // --- Portal 1: Ramón Net + su CDN de video (Bunny) ---
      // [2026-08-27] Migrado de `plataforma.ramonnet.com.ar` (dado de baja, no resuelve en
      // DNS) a este dominio — ver sitio/ramonnet/config.ts.
      'https://ramonnet.com.ar/*',
      'http://ramonnet.com.ar/*',
      'https://*.bunnyinfra.net/*',
      'https://*.b-cdn.net/*',
      // --- Portal 2: Anatomy by Chris (Hotmart Club) ---
      // Los cinco orígenes salen de medir la cadena entera (ver
      // docs/portal-anatomy-by-chris-diseno.md §La cadena de video). Olvidar el del CDN se ve
      // como descargas que fallan en el primer fragmento, no como un error de permisos.
      'https://hotmart.com/*',                                             // el club
      'https://api-club-course-consumption-gateway-ga.cb.hotmart.com/*',   // API de lecciones
      'https://cf-embed.play.hotmart.com/*',                               // el embed del player
      'https://vod-akm.play.hotmart.com/*',                                // master/variante/fragmentos (Akamai)
      'https://contentplayer.hotmart.com/*',                               // la clave AES
      // [CORTE 5] Los dos de la cadena de ADJUNTOS. Ojo: el primero es OTRO host que el de las
      // lecciones (`hot-club-api`, no el gateway), y es fácil darlo por cubierto de un vistazo.
      'https://api-club-hot-club-api.cb.hotmart.com/*',                    // firma del adjunto
      'https://hotmart-club-files.cb.hotmart.com/*',                       // el archivo (CloudFront)
      // --- Backend local ---
      'http://localhost:3001/*',
    ],
    // Los rulesets son específicos de cada sitio (ADR-0009), uno por portal y con `id`
    // propio. Los .json se sirven desde public/ para que WXT los copie tal cual conservando
    // esta ruta.
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'sitio/ramonnet/rules.json',
        },
        {
          // El embed de Hotmart contesta 401 sin `Referer`, y `Referer` es un header
          // prohibido para `fetch`: la única forma de ponerlo desde el service worker es
          // esta regla. Si no está cargada, el síntoma es ese 401 en el paso 2 de
          // `resolverManifiesto`.
          id: 'ruleset_anatomy',
          enabled: true,
          path: 'sitio/anatomy-by-chris/rules.json',
        },
      ],
    },
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
  },
});
