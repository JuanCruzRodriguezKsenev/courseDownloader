/**
 * COMPOSICIÓN (RAÍZ DE INYECCIÓN)
 * ==========================================================================
 * Único lugar donde se eligen los adaptadores concretos y se los enchufa al núcleo.
 * Es lo que hace que `core/` pueda no saber que existe `chrome.*`: los módulos del
 * núcleo reciben sus puertos acá, y no los importan ellos mismos.
 *
 * Lo importan los dos entrypoints (popup y service worker), así que corre una vez por
 * contexto. Vive acá y no en `entrypoints/` porque WXT trata como entrypoint a todo
 * archivo suelto de esa carpeta.
 *
 * **Casi todo lo de acá es sólo un export nombrado.** De los once globals que llegó a
 * publicar queda **uno**: `Utils`, porque lo leen los dos módulos `.js` del adaptador de
 * sitio (ver su bloque más abajo). Los otros diez se fueron entre las Fases 7a, 7b y 7c, a
 * medida que sus lectores pasaron a recibirlos inyectados.
 * Convención del patrón dual → docs/coding-standards.md §Módulos ES + global.
 */
import AlmacenamientoChrome from "./chrome/almacenamiento";
import MensajeriaChrome from "./chrome/mensajeria";
import ProgramadorChrome from "./chrome/programador";
import * as texto from "../core/util/texto";
import * as media from "../core/util/media";
import * as progreso from "../core/util/progreso";
import * as descargas from "./chrome/descargas";
import { crearFetchConReintentos } from "../core/util/reintentos";
import { crearHlsEngine } from "../core/hls/hlsEngine";
import { crearEstadoSesion } from "../core/cola/estadoSesion";
import { crearEstadosProgreso } from "../core/cola/estadosProgreso";
import { crearIdentidadClase } from "../core/cola/identidadClase";
import { crearProcesadorCola } from "../core/cola/procesadorCola";
import { notificarFallo, sitioIdDeNotificacion } from "./chrome/notificaciones";
import { crearVolcadoLegacy } from "./chrome/volcadoLegacy";
import BunClient from "../core/backend/bunClient";
import { crearHistorialFallos } from "../core/historial/historialFallos";
import { crearAppState, SITIO_LEGADO } from "../core/estado/appState";
import { crearConexion } from "../core/conexion/conexion";
// Capa 2, vía el REGISTRO (multi-sitio, corte 2) y ya no importando el portal directo: quién
// está activo lo decide `sitio/registro.ts`, no `sitio/ramonnet/`.
//
// [MULTIPORTAL C] Acá se importaba además `sitioAsumido`, el andamio del corte 2, para la sonda
// del daemon de conexión. Era su ÚLTIMO lector: la sonda ahora sigue al portal (del ítem en el
// SW, de la pestaña en el popup) y el piso sale de `sitios.obtener(undefined)`, que aplica la
// misma regla de migración que todo el resto. **El andamio quedó sin lectores.**
import { Sitios } from "../sitio/registro";

/**
 * Adaptadores de plataforma activos en esta build.
 *
 * **Desde la Fase 7c este archivo no publica un solo global.** Todo sale como export
 * nombrado y lo inyectan los dos entrypoints: el service worker por `iniciarServiceWorker`
 * (7a) y el popup por `iniciarPopup` + el montaje de las islas (7b/7c). Lo que todavía viaja
 * por `globalThis` no son servicios sino MÓDULOS —los puentes de las islas, las factories de
 * las features, el adaptador de sitio— y eso es materia de la Fase 8.
 */
export const almacenamiento = AlmacenamientoChrome;

// Ya no se publica como global: desde la Fase 7b su único lector, `popup.js`, lo recibe por
// parámetro y se lo pasa por `ctx` a las features. Fue el primer global que la 7b pudo
// borrar, y por ahora el único — los otros cuatro los leen también las islas y las features.
export const mensajeria = MensajeriaChrome;

export const programador = ProgramadorChrome;

export const HistorialFallos = crearHistorialFallos(almacenamiento);

/**
 * OJO: `AppState` es estado del POPUP. Este archivo lo importan los dos entrypoints, así que el
 * service worker también construye una instancia — inerte: el constructor no hace I/O y el SW
 * nunca la lee (su estado es `SessionState`, en `storage.session`). Se acepta esa instancia de
 * más para no partir la raíz de composición en dos por un solo módulo. Si aparece un segundo
 * módulo popup-only, ahí sí conviene una raíz por contexto.
 */
export const AppState = crearAppState(almacenamiento, mensajeria);

/**
 * El daemon de conexión SÍ corre en los dos contextos, y a propósito: popup y SW mantienen
 * cada uno su instancia y convergen espejando por el ámbito de sesión del puerto. Quién
 * llama a `iniciar()` no se decide acá — el popup arranca su poller y el SW verifica desde
 * `chrome.alarms` (setInterval no sobrevive la suspensión del service worker).
 *
 * La URL de sondeo entra por acá y no la lee el daemon: es el único dato de sitio que
 * necesita, y es lo que le permitió mudarse a `core/` (Capa 1 no nombra portales).
 *
 * [MULTIPORTAL C] Y entra como **función**, porque con N portales "hay internet" pasa a ser
 * "llego a *cuál*". La sonda sigue siendo una sola (§4 del diseño: estado de conexión por
 * portal sería un rediseño del daemon), pero apunta al portal que corresponde:
 *
 *   - En el **service worker**, al del ítem que está primero en la cola — el que se está
 *     bajando o está por bajarse. Con la cola vacía cae al legado, que es el único momento en
 *     que no hay un portal "correcto" y tampoco importa: no hay descarga que pausar.
 *   - En el **popup**, al de la pestaña activa. Eso la composición no lo puede saber, así que
 *     lo fija `popup.js` al escanear vía `Conexion.fijarSondeo(...)`.
 *
 * Se lee de storage en cada sondeo en vez de mantener un espejo en memoria porque el service
 * worker se suspende y se lo llevaría; storage es el único estado que sobrevive.
 */
export const Conexion = crearConexion(almacenamiento, {
  urlSondeoInternet: async () => {
    // El legado como piso: `sitios.obtener(undefined)` aplica la misma regla de migración que
    // el resto (ausente ⇒ portal legado), así que no hace falta nombrar ningún portal acá.
    const piso = sitios.obtener(undefined)!.urlSondeoInternet;
    try {
      const { colaDescargas } = await almacenamiento.obtenerLocal<{
        colaDescargas?: { sitioId?: string }[];
      }>(["colaDescargas"]);
      const primero = (colaDescargas || [])[0];
      // Si el primero es huérfano, `obtener` devuelve undefined y se cae al piso: no sabemos a
      // qué portal llegar, pero el daemon necesita SIEMPRE una respuesta.
      return sitios.obtener(primero?.sitioId)?.urlSondeoInternet ?? piso;
    } catch {
      // Si storage falla, sondear el legado es mejor que no sondear: quedarse sin URL dejaría
      // al daemon reportando "sin internet" para siempre.
      return piso;
    }
  },
});

/**
 * `Utils` dejó de ser un archivo y pasó a ser **un ensamblado** (Fase 6a): sus funciones se
 * repartieron entre `core/util/` (genéricas) y `plataforma/chrome/descargas.ts` (que usaba
 * `chrome.downloads`, o sea Capa 3). Acá se vuelven a juntar bajo el mismo nombre porque
 * ~200 call-sites del código vanilla lo consumen como `Utils.loQueSea(...)`; reescribirlos
 * era un corte aparte, y mucho más grande que el que resolvía el problema de capas.
 *
 * El que cambió de forma es `fetchConReintentos`: ahora se **construye** con el daemon en vez
 * de sniffearlo del global. Ése era el acoplamiento que impedía que el motor HLS —su mayor
 * consumidor— pudiera vivir en `core/`.
 *
 * **Ojo con el orden de carga**: este global lo publicaba `shared/utils.js` al evaluarse, y
 * ahora aparece más tarde en la cadena (acá). Es seguro porque ningún consumidor llama a
 * `Utils.*` en tiempo de evaluación, sólo dentro de funciones — se verificó archivo por
 * archivo antes de mover la publicación. Si algún día alguien lo llama en el top-level de un
 * módulo que carga antes que la composición, va a explotar sin que el bundler avise.
 */
/**
 * Estado de la ráfaga activa (ámbito de sesión). Sólo lo usa el service worker; el popup
 * construye una instancia inerte —el constructor no hace I/O— por la misma razón que con
 * `AppState`: no partir la raíz de composición en dos por un módulo.
 */
export const SessionState = crearEstadoSesion(almacenamiento);

export const HlsEngine = crearHlsEngine({
  fetchConReintentos: crearFetchConReintentos(Conexion),
  descifrarFragmento: media.descifrarFragmento,
  generarVideoFinalBlob: media.generarVideoFinalBlob,
  backend: BunClient,
});

/**
 * `Utils` es el ÚNICO global que sobrevive a la Fase 7c, y no por olvido: lo leen
 * `sitio/ramonnet/parserTitulos.js` y `resolverManifiesto.js`, que siguen en `.js` y entran
 * como globals a propósito (para que las puertas del sitio no dependan del orden de carga).
 * Lo destapó `no-undef` al sacar la declaración del ESLint: la medición del corte había
 * mirado `popup/` y no `sitio/`. Se va con la Fase 8, junto con esos dos módulos.
 */
export const Utils = {
  ...texto,
  ...media,
  ...progreso,
  ...descargas,
  fetchConReintentos: crearFetchConReintentos(Conexion),
};

(globalThis as Record<string, unknown>).Utils = Utils;

export const EstadosProgreso = crearEstadosProgreso(almacenamiento);


/**
 * Resolvedor de sitios **con la migración aplicada**, compartido por el service worker y el
 * popup. Que sea uno solo importa: si el bucle y el filtro de la cola resolvieran distinto,
 * un ítem se descargaría con un portal y se mostraría clasificado con otro.
 *
 * La regla, y por qué vive acá y no en el registro ni en el núcleo (ver
 * `docs/multisitio-diseno.md` §La trampa del corte 3):
 *   - `sitioId` ausente  → dato de antes del multi-sitio: vino de `SITIO_LEGADO`.
 *   - `sitioId` presente pero desconocido → huérfano, no se resuelve.
 */
export const sitios = {
  obtener: (id?: string) => Sitios.obtener(id ?? SITIO_LEGADO),

  /**
   * Por URL de pestaña, para el popup (corte 5). **Sin migración y a propósito**: una URL que
   * no matchea ningún portal registrado no es un "dato viejo" que haya que interpretar, es una
   * pestaña que no es de ningún portal. Caer al legado acá haría que el popup escanee
   * cualquier página con el adaptador de Ramón Net — el bug que ADR-0010 previene.
   */
  resolverPorUrl: (url?: string) => Sitios.resolverPorUrl(url),
};

/**
 * De un `notificationId` al portal cuya pestaña hay que enfocar (corte 8).
 *
 * Vive acá y no en `background.js` por la misma razón que `sitios`: es **la misma regla de
 * resolución** que usa el bucle, y dos copias pueden divergir. El SW recibe esto inyectado y
 * no sabe cómo está armado el id.
 *
 * Devuelve `undefined` cuando el portal es huérfano — y ahí el click no debe abrir nada. Que
 * "no sabemos a dónde llevarlo" se note es correcto; adivinar un portal es exactamente el bug
 * que este corte arregla.
 */
export const sitioDeNotificacionDeFallo = (notificationId: string) =>
  sitios.obtener(sitioIdDeNotificacion(notificationId));
/**
 * [MULTIPORTAL D] Cómo se decide si dos ítems son la misma clase: por el par (portal, título).
 *
 * Se arma **una vez, acá**, con el mismo resolvedor con migración que usa todo lo demás. Que
 * sea uno solo importa por el mismo motivo que el resolvedor: si el bucle de descarga, los
 * handlers del service worker y el popup compararan distinto, un ítem podría ser dos en un
 * lado y uno en otro — y esa divergencia se ve como una clase que desaparece de la cola sin
 * haberse bajado.
 */
export const identidadClase = crearIdentidadClase(sitios);

/**
 * El procesador de la cola: el bucle FIFO + la clasificación de fallos, que fue el bloque más
 * grande de `background.js` hasta la Fase 6b.
 *
 * Acá se ve para qué sirvió todo lo anterior: recibe **once colaboradores** y ninguno es
 * `chrome.*`. Los tres que sí tocan el navegador —la notificación nativa, el volcado legacy a
 * disco y el adaptador de sitio— entran ya envueltos desde Capa 3 o Capa 2, así que el bucle
 * se puede correr entero en un test sin navegador.
 */
export const Cola = crearProcesadorCola({
  almacenamiento,
  sesion: SessionState,
  mensajeria,
  programador,
  conexion: Conexion,
  motor: HlsEngine,
  /**
   * El bucle resuelve el portal POR ÍTEM (ADR-0010). Recibe el registro envuelto, no crudo,
   * y el envoltorio es donde se aplica la **migración**: un ítem sin `sitioId` es de antes del
   * multi-sitio y viene de Ramón Net (`SITIO_LEGADO`).
   *
   * Va acá y no en el registro ni en el núcleo, y es deliberado: son **dos casos distintos**
   * que no hay que confundir.
   *   - `sitioId` ausente  → dato viejo, sí sabemos de dónde vino → se resuelve.
   *   - `sitioId` presente pero desconocido → NO sabemos de dónde vino → huérfano, se saltea.
   * Si el registro hiciera el fallback, el segundo caso se descargaría en silencio con el
   * adaptador equivocado. Y si lo hiciera el núcleo, Capa 1 volvería a nombrar un portal.
   *
   * El SW lee `colaDescargas` de storage por su cuenta —no pasa por la normalización de
   * `AppState`, que es del popup—, así que sin esto una cola encolada antes del corte 1 se
   * saltearía entera como huérfana.
   */
  sitios,
  historial: HistorialFallos,
  notificarFallo,
  calcularMetricas: progreso.calcularMétricasProgreso,
  actualizarConsolaBackend: (datos) => void BunClient.actualizarConsola(datos),
  guardarBlobLegacy: crearVolcadoLegacy(mensajeria),
  persistirEstados: (estados) => EstadosProgreso.persistir(estados),
  recuperarEstados: () => EstadosProgreso.recuperar(),
  identidad: identidadClase,
});
