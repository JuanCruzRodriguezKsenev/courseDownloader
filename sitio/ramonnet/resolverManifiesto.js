/**
 * ADAPTADOR DE SITIO — RAMÓN NET: RESOLUCIÓN DEL MANIFIESTO M3U8 (V1.0.0)
 * ==========================================================================
 * CHANGELOG v1.0.0:
 * - [CAPA 2] Movido tal cual desde `HlsEngine.extraerEnlaceMaestroM3u8Clasico`
 *   (background/hlsEngine.js v1.0.6). Era lo ÚNICO específico de Ramón Net/Bunny que
 *   quedaba en el motor de descarga; con esto `HlsEngine` pasa a ser genérico y sólo
 *   recibe una URL .m3u8 ya resuelta. Misma lógica, mismos fallbacks, mismos errores
 *   tipados; los hosts/plantilla del CDN y la marca de ruta salen ahora del config
 *   del sitio. Ver ADR-0008 y docs/rearquitectura-diseno.md.
 * ==========================================================================
 * QUÉ HACE
 * --------
 * Del HTML de la página de una clase saca la URL del manifiesto `.m3u8`. La ruta feliz
 * es el `<iframe>` del reproductor: de ahí sale el UUID del video y con la plantilla del
 * CDN se arma la URL final. Los 3 fallbacks son barridos progresivamente más laxos del
 * HTML crudo, y existen porque el markup del portal cambió más de una vez.
 *
 * FRAGILIDAD (leer antes de tocar): esto es lo primero que se rompe si el portal cambia
 * de maquetado o de CDN. Si las descargas empiezan a resolver el video equivocado, mirar
 * acá — y en particular el orden de los fallbacks, que va de más específico a más laxo.
 *
 * Depende de: Utils.fetchConReintentos (genérico) y SitioRamonNet (config del sitio).
 */
const ResolverManifiesto = {
  /**
   * @param {string} urlClase URL de la página de la clase en el portal.
   * @param {AbortSignal} [signal]
   * @returns {Promise<string>} URL del manifiesto .m3u8.
   */
  async resolver(urlClase, signal) {
    const sitio = SitioRamonNet;
    console.log(`📡 [SITIO:${sitio.id}] Resolviendo manifiesto para: ${urlClase}`);

    const conectorUrl = urlClase.includes("?") ? "&" : "?";
    const urlInmuneACache = `${urlClase}${conectorUrl}turboBuster=${Date.now()}`;

    const res = await Utils.fetchConReintentos(urlInmuneACache, {
      signal,
      credentials: "include",
      headers: {
        "Pragma": "no-cache",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Expires": "0"
      }
    });

    console.log(`📡 [SITIO:${sitio.id}] Respuesta recibida. URL Final: ${res.url}, Status: ${res.status}`);

    const html = await res.text();
    console.log(`📡 [SITIO:${sitio.id}] HTML recibido. Longitud: ${html.length} caracteres.`);

    // Sin sesión iniciada, la plataforma redirige la página de la clase a la raíz/login:
    // la URL final pierde el segmento de la clase. NO es un fallo de red (la conectividad
    // está OK) — es un problema de sesión, accionable por el usuario. Se lanza un error
    // tipado para que background.js lo clasifique como "sesion" en vez de caer en la
    // heurística por defecto ("internet"). Ver docs/patterns.md.
    const marcaRuta = new RegExp(sitio.marcaRutaClase, "i");
    if (marcaRuta.test(urlClase) && !marcaRuta.test(res.url)) {
      console.warn(`🔑 [SITIO:${sitio.id}] La clase redirigió fuera de /${sitio.marcaRutaClase}/ (URL final: ${res.url}). No hay sesión activa.`);
      const errSesion = new Error("SESION_NO_INICIADA: la clase redirigió al inicio/login; iniciá sesión en Ramón Net.");
      errSesion.tipoConexion = "sesion";
      throw errSesion;
    }

    // 1. Buscar la etiqueta <iframe> que apunte a alguno de los hosts del CDN.
    const hosts = sitio.cdn.hostsIframe.map(h => h.replace(/\./g, "\\.")).join("|");
    const regexIframe = new RegExp(`<iframe[^>]+src=\\\\?["'](https?://[^\\\\"']*(?:${hosts})[^\\\\"']+)`, "i");
    const matchIframe = html.match(regexIframe);
    console.log(`📡 [SITIO:${sitio.id}] ¿Match de etiqueta iframe?: ${matchIframe ? 'sí' : 'no'}`);

    if (matchIframe && matchIframe[1]) {
      const iframeUrl = matchIframe[1].replace(/\\/g, ''); // Limpiar escapes
      console.log(`📡 [SITIO:${sitio.id}] URL del iframe activo: ${iframeUrl}`);

      const hashMatch = iframeUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (hashMatch) {
        const activeHash = hashMatch[0];
        const finalUrl = sitio.cdn.plantillaM3u8(activeHash);
        console.log(`📡 [SITIO:${sitio.id}] Hash iframe: ${activeHash}. URL: ${finalUrl}`);
        return finalUrl;
      }
    }

    console.log(`📡 [SITIO:${sitio.id}] No se detectó iframe activo. Aplicando fallbacks...`);

    // Fallback 1: Coincidencia directa de m3u8.
    const matchesDirectos = html.match(/https:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi);
    if (matchesDirectos && matchesDirectos.length > 0) {
      const finalUrl = matchesDirectos[matchesDirectos.length - 1].replace(/["']/g, '').trim();
      console.log(`📡 [SITIO:${sitio.id}] Fallback directo: ${finalUrl}`);
      return finalUrl;
    }

    // Fallback 2: Coincidencia de hashes de Bunny (primer match como fallback)
    const regexBunnyHash = /(https:\/\/vz-[^\s"'<>\\\/]+\.b-cdn\.net\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
    const matchesHash = html.match(regexBunnyHash);
    if (matchesHash && matchesHash.length > 0) {
      const urlBaseConHash = matchesHash[0];
      const finalUrl = `${urlBaseConHash}/${sitio.cdn.calidad}/video.m3u8`;
      console.log(`📡 [SITIO:${sitio.id}] Fallback Bunny Hash: ${finalUrl}`);
      return finalUrl;
    }

    // Fallback 3: Coincidencia de m3u8 en scripts ocultos
    const regexScriptOculto = /https?:\\\/\\\/[^\s"'<>\\#]+\.m3u8[^\s"'<>\\#]*/gi;
    const matchesScript = html.match(regexScriptOculto);
    if (matchesScript && matchesScript.length > 0) {
      const finalUrl = matchesScript[matchesScript.length - 1].replace(/\\\//g, '/').replace(/["']/g, '').trim();
      console.log(`📡 [SITIO:${sitio.id}] Fallback script oculto: ${finalUrl}`);
      return finalUrl;
    }

    throw new Error("No se localizaron firmas de streaming válidas en Ramón Net.");
  }
};

// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.ResolverManifiesto = ResolverManifiesto;
export default ResolverManifiesto;
