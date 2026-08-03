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
import '../../sitio/ramonnet/config.js';
import '../../sitio/ramonnet/parserTitulos.js';
import '../../sitio/ramonnet/scraper.js';

// Núcleo compartido.
import '../../shared/utils.js';
import '../../core/backend/bunClient.ts';
import '../../shared/conexion.js';
// Composición: acá se instancian y se publican los globals de los módulos ya desacoplados
// de chrome.* (HistorialFallos, y desde la Fase 5b también AppState — antes lo publicaba
// shared/state.js al evaluarse). Tiene que ir ANTES de renderers/features/popup.js, que son
// los que consumen esos globals.
import '../../plataforma/composicion.ts';

// Render vanilla + features del popup.
import '../../renderers.js';
import '../../popup/features/serverConnection.js';
import '../../popup/features/queue.js';
import '../../popup/features/filters.js';
import '../../popup/features/faceta.js';

// Orquestador: va después de sus dependencias, como en popup.html.
import '../../popup.js';

// Islas Preact. Antes eran <script type="module"> sueltos al final del HTML; acá
// siguen yendo al final por el mismo motivo: cuando montan, las globals que
// consumen (Conexion, AppState, OnboardingFeature...) ya existen.
import '../../popup/features/conexionHeader.preact.js';
import '../../popup/features/onboarding.preact.js';
import '../../popup/features/rutaDisco.preact.js';
import '../../popup/features/bannerConexion.preact.js';
import '../../popup/features/listaClases.preact.js';
import '../../popup/features/campanita.preact.js';
