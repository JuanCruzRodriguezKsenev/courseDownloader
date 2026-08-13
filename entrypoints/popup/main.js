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

// Banco de pruebas. El import es incondicional; lo que decide si corre es la bandera del final
// de este archivo. Ver el bloque de allá abajo: dice por qué es estático y qué cuesta.
import { activarModoVerificacion } from '../../verificacion/modoVerificacion.js';

montarStatusDot(document.getElementById('preact-status-dot'), { conexion: Conexion });
montarCampanita(document.getElementById('preact-campanita'), { historial: HistorialFallos });

// [LOADERS — ítem 5] El onboarding se monta con el portal DE LA PESTAÑA, no con el legado.
//
// Hasta el 2026-08-12 esta llamada era `sitios.obtener(undefined)` —el portal legado, fijo— y
// el comentario decía "cuando exista un segundo" portal. Existe desde el 2026-08-07, así que
// la slide 3 mostraba la instrucción de escaneo de Ramón Net **también en Anatomy**: el corte 2
// del copy genérico movió esa frase al descriptor (correcto y necesario) y el defecto que venía
// a cerrar seguía en pantalla, porque la isla recibía el descriptor equivocado.
//
// Es asíncrono porque `chrome.tabs.query` lo es, y por eso el montaje va adentro del callback
// en vez de arriba con los otros dos: la isla lee `sitio` como prop al montarse, no lo
// re-consulta. Montar con el legado y "corregir" después haría parpadear la copy.
//
// El fallback al legado se queda para el caso en que la pestaña no sea de ningún portal
// reconocido (el tour se abre desde cualquier lado): ahí no hay portal correcto que mostrar y
// el legado es a donde el tour manda al usuario.
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const portalDeLaPestaña = tab && tab.url ? sitios.resolverPorUrl(tab.url) : null;
  montarOnboarding(document.getElementById('preact-onboarding'), {
    conexion: Conexion,
    appState: AppState,
    sitio: portalDeLaPestaña || sitios.obtener(undefined),
  });
});

// ─── BANCO DE PRUEBAS ────────────────────────────────────────────────────────────────────
//
// ⬇⬇⬇  PONÉ `true` ACÁ PARA ACTIVARLO, Y `pnpm run build`.  ⬇⬇⬇
const BANCO_DE_PRUEBAS = false;
// ⬆⬆⬆  Es la única línea que hay que tocar.  ⬆⬆⬆
//
// Qué es: un panel (🧪 en la cabecera, o **F9**) que graba los carteles que duran
// milisegundos, demora el escaneo para poder leerlos, y fuerza los estados que a mano no se
// alcanzan — caída de servidor y de internet, la cola pausada en sus cinco tipos, el escaneo
// vacío o colgado, y el onboarding con el descriptor de cada portal. Detalle y limitaciones,
// en la cabecera de `verificacion/modoVerificacion.js`.
//
// **POR QUÉ VIVE ACÁ Y NO EN UNA RAMA.** Vivió en una rama descartable (`copy-generico-
// verificacion`) y el resultado fue que se perdió dos veces: la primera quedó con un build
// viejo mientras `main` avanzaba —cargarla verificaba una versión anterior—, y la segunda
// hubo que rearmarla a mano con siete cherry-picks. Una herramienta que hay que reconstruir
// cada vez que se usa es una herramienta que no se usa. Acá se mantiene sola con el resto.
//
// **Apagado NO cuesta nada, y está medido**: la bandera es una `const` literal, así que el
// `if` es código muerto y Vite se lleva el módulo entero en el tree-shaking (cero ocurrencias
// de `mv-panel` en el bundle). Por eso la bandera es una `const` y no una variable, un `let`,
// ni algo leído de storage: cualquiera de esas tres lo dejaría adentro para siempre.
//
// **Los kB medidos NO se copian acá.** Vivían duplicados en este comentario y quedaron viejos
// una versión entera del banco, diciendo un número que ya no era. El hogar canónico es la
// cabecera de `verificacion/modoVerificacion.js`, que además explica por qué lo que hay que
// leer es la resta entre los dos builds y no el total de ninguno.
//
// Y por eso el import es **estático** y no un `import()` dinámico, que sería el reflejo obvio:
// el banco **envuelve `fetch`, `chrome.tabs.query` y `chrome.runtime.sendMessage`**, y tiene
// que hacerlo antes de que corra el init del popup. Un import dinámico resuelve en un tick
// posterior y puede llegar después de `DOMContentLoaded`, o sea con `iniciarPopup` ya
// arrancado: los envoltorios quedarían puestos tarde y el banco mentiría en silencio. El
// estático da la misma eliminación en frío y además la garantía de orden.
//
// Va ÚLTIMO a propósito: envuelve esas APIs **después** de que el popup quedó cableado, así
// nada de lo que se está verificando cambia de orden por su culpa.
if (BANCO_DE_PRUEBAS) {
  activarModoVerificacion({
    sitios,
    montarOnboarding,
    conexion: Conexion,
    appState: AppState,
  });
}
