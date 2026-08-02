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
    name: 'Ramonnet Video Downloader',
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
      'https://plataforma.ramonnet.com.ar/*',
      'http://plataforma.ramonnet.com.ar/*',
      'https://*.bunnyinfra.net/*',
      'https://*.b-cdn.net/*',
      'http://localhost:3001/*',
    ],
    // El ruleset es específico del sitio (ADR-0009). El .json se sirve desde public/
    // para que WXT lo copie tal cual al output conservando esta ruta.
    declarative_net_request: {
      rule_resources: [
        {
          id: 'ruleset_1',
          enabled: true,
          path: 'sitio/ramonnet/rules.json',
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
