/**
 * ENTRYPOINT DEL SERVICE WORKER (WXT)
 * ==========================================================================
 * Punto de composición del SW (Fase 7a): resuelve los adaptadores concretos y se los
 * **pasa** al orquestador, en vez de dejarle globals sembrados para que él los busque.
 *
 * Lo que cambió respecto de la Fase 3: `background.js` ya no se importaba por su efecto
 * secundario (evaluarse y engancharse a lo que hubiera en `globalThis`), sino que exporta
 * `iniciarServiceWorker(deps)` y lo llamamos acá con las piezas nombradas. El orden de los
 * imports deja de ser load-bearing para el SW — si falta una dependencia ahora es un
 * `undefined` en la llamada, no un `ReferenceError` a mitad de una descarga.
 *
 * **La llamada va en el top-level a propósito, no dentro de `defineBackground`.** MV3 exige
 * que `onInstalled`, `notifications.onClicked` y el receptor IPC queden registrados durante
 * el arranque sincrónico del worker; moverlos a un callback (o detrás de un `await`) los
 * perdería en el primer arranque en frío. Este es exactamente el momento en que se
 * registraban antes, cuando el `import '../background.js'` los ejecutaba al evaluarse.
 *
 * Los imports por efecto secundario que quedan son de Capa 2: publican los globals que
 * consumen los módulos hermanos de cada adaptador de sitio, que siguen en `.js` (Fase 8).
 *
 * **Van primero, antes de la composición**, porque el descriptor de cada portal los lee
 * perezosamente al usarse y el bundler no avisa si faltan. Son tres por portal — y desde el
 * corte 7 hay dos portales, con globals de nombre PROPIO cada uno: compartirlos haría que el
 * último evaluado le pise los suyos al otro, y el síntoma sería un portal resolviendo con el
 * adaptador ajeno.
 *
 * El SW no importa los `scraper.js`: el scraper se inyecta en la pestaña y eso es cosa del
 * popup. (De ahí que las dos listas de imports no sean iguales.)
 */
import { defineBackground } from 'wxt/utils/define-background';

import '../sitio/ramonnet/config.ts';
import '../sitio/ramonnet/parserTitulos.js';
import '../sitio/ramonnet/resolverManifiesto.js';

import '../sitio/anatomy-by-chris/config.ts';
import '../sitio/anatomy-by-chris/parserTitulos.js';
import '../sitio/anatomy-by-chris/resolverManifiesto.js';
// [CORTE 5] El cuarto hermano. Va SÓLO acá y no en el popup: resolver la firma de un adjunto es
// del que baja, y su URL vive 1 hora — pedirla desde el popup al escanear la vencería.
import '../sitio/anatomy-by-chris/descargarAdjunto.js';

import BunClient from '../core/backend/bunClient.ts';
// [MULTISITIO CORTE 8] Acá se importaba `sitioAsumido`: el SW era el último lector del andamio
// del corte 2. Ya no hay UN sitio del lado del service worker — el bucle resuelve por ítem
// (corte 3) y la notificación por su id (corte 8).
import {
  almacenamiento,
  mensajeria,
  programador,
  SessionState,
  EstadosProgreso,
  Cola,
  sitioDeNotificacionDeFallo,
  identidadClase,
} from '../plataforma/composicion.ts';
import { iniciarServiceWorker } from '../background.js';

iniciarServiceWorker({
  almacenamiento,
  mensajeria,
  programador,
  sesion: SessionState,
  estadosProgreso: EstadosProgreso,
  cola: Cola,
  backend: BunClient,
  resolverSitioDeNotificacion: sitioDeNotificacionDeFallo,
  // [MULTIPORTAL D] El MISMO que recibe el bucle: la regla de identidad vive en un solo lugar.
  identidad: identidadClase,
});

// WXT requiere esta forma como entrypoint. Los listeners ya quedaron registrados por la
// llamada de arriba, que es lo que exige MV3; acá no hay nada que hacer.
export default defineBackground(() => {});
