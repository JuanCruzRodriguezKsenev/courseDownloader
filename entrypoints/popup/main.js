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

// Adaptador de sitio (Capa 2): antes que todo lo que lo consume.
import '../../sitio/ramonnet/config.ts';
import '../../sitio/ramonnet/parserTitulos.js';
import '../../sitio/ramonnet/scraper.js';

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
import { AppState, Conexion, HistorialFallos, mensajeria, sitios, Utils } from '../../plataforma/composicion.ts';
import BunClient from '../../core/backend/bunClient.ts';
import { sitioAsumido as SitioActivo } from '../../sitio/registro.ts';
import crearRenderers from '../../renderers.js';

iniciarPopup({
  appState: AppState,
  conexion: Conexion,
  mensajeria,
  utils: Utils,
  backend: BunClient,
  sitio: SitioActivo,
  // Resolvedor por id, con la migración aplicada: el MISMO que usa el service worker.
  sitios,
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
  sitio: SitioActivo,
});
montarCampanita(document.getElementById('preact-campanita'), { historial: HistorialFallos });
