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
 * Los tres imports por efecto secundario que quedan son de Capa 2: publican los globals que
 * consumen los módulos hermanos del adaptador de sitio, que siguen en `.js` (Fase 8).
 */
import { defineBackground } from 'wxt/utils/define-background';

import '../sitio/ramonnet/config.ts';
import '../sitio/ramonnet/parserTitulos.js';
import '../sitio/ramonnet/resolverManifiesto.js';

import BunClient from '../core/backend/bunClient.ts';
import { SitioActivo } from '../sitio/ramonnet/config.ts';
import {
  almacenamiento,
  mensajeria,
  programador,
  SessionState,
  EstadosProgreso,
  Cola,
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
  sitio: SitioActivo,
});

// WXT requiere esta forma como entrypoint. Los listeners ya quedaron registrados por la
// llamada de arriba, que es lo que exige MV3; acá no hay nada que hacer.
export default defineBackground(() => {});
