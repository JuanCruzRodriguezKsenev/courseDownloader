/**
 * ENTRYPOINT DEL POPUP (WXT)
 * ==========================================================================
 * Reemplaza a la lista de <script src> de popup.html. El orden es el mismo que
 * tenía ahí y sigue importando: cada módulo publica su global al evaluarse y el
 * siguiente lo consume (ver docs/coding-standards.md §Orden de carga).
 *
 * Los imports ES se evalúan en orden de aparición, así que esto es equivalente a
 * los <script> clásicos secuenciales — con la diferencia de que ahora el bundler
 * verifica que los archivos existan.
 */

// Adaptadores de sitio (Capa 2): antes que todo lo que los consume.
//
// Desde el corte 7 son DOS portales, y cada uno publica sus globals con nombre propio
// (`Scraper` vs `ScraperAnatomy`, etc.). Compartir un nombre haría que el último evaluado le
// pise el suyo al otro, y el síntoma sería un portal escaneando con el adaptador ajeno.
//
// El popup importa el `scraper.js` de cada uno (lo inyecta en la pestaña) y NO los
// `resolverManifiesto.js`, que son del service worker. De ahí que las dos listas difieran.
import '../../sitio/ramonnet/config.ts';
import '../../sitio/ramonnet/parserTitulos.js';
import '../../sitio/ramonnet/scraper.js';

import '../../sitio/anatomy-by-chris/config.ts';
import '../../sitio/anatomy-by-chris/parserTitulos.js';
import '../../sitio/anatomy-by-chris/scraper.js';

// Núcleo compartido.
import '../../core/backend/bunClient.ts';
// Composición: acá se instancian y se publican los globals de los módulos ya desacoplados
// de chrome.* (HistorialFallos, y desde la Fase 5b también AppState y Conexion — antes los
// publicaban shared/state.js y shared/conexion.js al evaluarse). Tiene que ir ANTES de
// renderers/features/popup.js, que son los que consumen esos globals.
import '../../plataforma/composicion.ts';

// Orquestador. Desde la Fase 7b no se importa por su efecto secundario: exporta
// `iniciarPopup(deps)` y lo llamamos abajo con sus servicios por nombre. El listener de
// `DOMContentLoaded` se registra en el mismo momento que antes — los módulos ES son
// diferidos, así que todo esto corre antes de que el evento dispare.
import { iniciarPopup } from '../../popup.js';
import { AppState, Conexion, credencialesPortal, HistorialFallos, identidadClase, mensajeria, sitios, Utils } from '../../plataforma/composicion.ts';
import BunClient from '../../core/backend/bunClient.ts';
import crearRenderers from '../../renderers.js';

// [MULTISITIO CORTE 5] Acá se importaba `sitioAsumido`. Ya no hay un portal inyectado en el
// popup: lo resuelve por URL de la pestaña activa, que es la mitad de ADR-0010 que le toca.
//
// Ojo con lo que NO cambió: al andamio le queda un lector, en `plataforma/composicion.ts`,
// para el `urlSondeoInternet` del daemon de conexión. Es deliberado — la sonda sigue siendo
// una sola (ver `docs/multisitio-diseno.md` §4), y hacerla por portal es un rediseño del
// daemon con su propio corte. O sea: el andamio no murió acá, sólo se quedó sin la UI.
iniciarPopup({
  appState: AppState,
  conexion: Conexion,
  mensajeria,
  utils: Utils,
  backend: BunClient,
  // Registro de portales: por id para lo que mezcla portales (la cola) y por URL para la
  // pestaña activa. El MISMO que usa el service worker, con la misma migración.
  sitios,
  // [MULTIPORTAL D] El MISMO criterio de identidad que el service worker.
  identidadClase,
  // [CORTE 7] Donde el escaneo deja las credenciales del portal para que las lea el SW.
  credencialesPortal,
  renderers: crearRenderers(Utils),
});

// Islas Preact.
//
// Las tres que dependen de un servicio (el daemon, el estado, el historial) **ya no se
// auto-montan**: las monta este entrypoint pasándoles la dependencia (Fase 7c). Eso es lo
// que las desató del orden de imports y de que el global existiera al evaluarse.
//
// Las otras tres (`rutaDisco`, `bannerConexion`, `listaClases`) no leen ningún servicio y
// siguen auto-montándose al evaluarse. Desde la Fase 8 **ya no se importan acá**: las importa
// `popup.js`, que es quien usa sus puentes, así que su evaluación —y con ella el
// auto-montaje— la arrastra el grafo del bundler.
import { montar as montarStatusDot } from '../../popup/features/conexionHeader.preact.js';
import { montar as montarOnboarding } from '../../popup/features/onboarding.preact.js';
import { montar as montarCampanita } from '../../popup/features/campanita.preact.js';

montarStatusDot(document.getElementById('preact-status-dot'), { conexion: Conexion });
montarOnboarding(document.getElementById('preact-onboarding'), {
  conexion: Conexion,
  appState: AppState,
  // [CORTE 5] El onboarding corre ANTES de que haya una pestaña escaneada, así que no hay
  // portal "de la pestaña" que pasarle: se le da el legado, que es a donde el tour manda al
  // usuario y lo que mostraba hasta ahora. Ofrecer elegir entre N portales es del corte 7,
  // cuando exista un segundo.
  sitio: sitios.obtener(undefined),
});
montarCampanita(document.getElementById('preact-campanita'), { historial: HistorialFallos });
