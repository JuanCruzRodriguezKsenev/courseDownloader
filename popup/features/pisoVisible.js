/**
 * PISO VISIBLE — un cartel que aparece, se queda el tiempo de leerse (V1.0.0)
 * ==========================================================================
 * Un aviso de "estoy trabajando" que dura 117 ms no informa: parpadea. Y un parpadeo no se
 * lee como "fue rápido", se lee como **un error de funcionamiento** — algo apareció y
 * desapareció antes de que el cerebro alcanzara a registrar qué era. Este módulo garantiza que
 * todo cartel transitorio se quede en pantalla un mínimo, aunque el trabajo que lo motivó ya
 * haya terminado.
 *
 * ── DE DÓNDE SALEN LOS 500 ms ───────────────────────────────────────────────────────────
 *
 * No es un número elegido a ojo. Las dos referencias:
 *
 * - **Los tres límites de Nielsen** (NN/g, "Response Time Limits"): 0,1 s = instantáneo;
 *   1 s = el límite para que no se corte el hilo de pensamiento; 10 s = el límite de la
 *   atención. Un cartel que vive menos de 0,1 s cae del lado en que el usuario ni siquiera
 *   percibe que hubo una operación — pero SÍ percibe el destello.
 * - **La banda de 300-600 ms** de mínimo visible, que es el consenso de las guías de patrones
 *   de carga. 500 ms cae adentro y es redondo.
 *
 * Y el corolario que evita el error opuesto: si el trabajo dura menos de ~200-250 ms, lo
 * correcto **no** es estirarlo, es no mostrar nada. **Ese corolario todavía NO está
 * construido acá**: este módulo sólo garantiza el piso de lo que ya salió a pantalla. La
 * demora para aparecer es la otra mitad del par y sigue abierta como deuda
 * (`docs/TECHNICAL_DEBT.md` §El loader del popup no tiene dueño). Se dice acá porque un
 * módulo que se llama "piso visible" invita a suponer que las dos mitades están.
 *
 * ── POR QUÉ EL VALOR ES UNA FUNCIÓN Y NO UN TEXTO ───────────────────────────────────────
 *
 * Porque los carteles de este popup no viven todos en el mismo lugar ni se escriben todos
 * igual: el del loader son dos propiedades (`textContent` + `style.display`), el del botón
 * pasa por `configurarBotonesUX` (que además toca `className`, `disabled`, la visibilidad y
 * el footer) y uno de ellos se escribe con `innerHTML` porque lleva un spinner adentro. Un
 * módulo que recibiera "el texto" tendría que conocer los tres. Recibiendo **la escritura
 * entera como función**, no conoce ninguno: sólo decide CUÁNDO se ejecuta.
 *
 * ── LAS DOS ENTRADAS ────────────────────────────────────────────────────────────────────
 *
 * - `transitorio(escritura)` — "esto anuncia trabajo en curso". Se pinta y arranca su piso.
 * - `libre(escritura)` — "esto es el estado que corresponde ahora". Se pinta ya, salvo que
 *   haya un piso vigente; en ese caso espera a que venza.
 *
 * La distinción **no es cosmética, y es el error que hay que no cometer**: si el piso se
 * aplicara a toda escritura, el contador del botón ("Agregar 20 clases…") se volvería
 * pegajoso — tildar tres casillas rápido dejaría el número atrasado medio segundo cada vez.
 * El piso protege a los avisos de trabajo, no a los rótulos de estado.
 *
 * ── LO QUE SE COALESCE, Y POR QUÉ IMPORTA ───────────────────────────────────────────────
 *
 * Mientras un piso está vigente hay **una sola** escritura pendiente: la última gana. Si
 * durante esos 500 ms el estado cambió tres veces, pintar las tres en fila sería un
 * parpadeo peor que el que este módulo viene a sacar — y las dos primeras ya son mentira
 * cuando les toca salir.
 *
 * ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────────────────
 *
 * No es dueño de ningún nodo: no sabe qué escribe ni puede impedir que otro escriba el mismo
 * nodo por atrás. Eso es el corte del dueño único (`docs/TECHNICAL_DEBT.md` §El loader del
 * popup no tiene dueño), que es **otra** deuda y sigue abierta. Éste resuelve el tiempo; aquél
 * resuelve quién. Si alguien escribe el nodo salteándose este módulo, el piso no lo alcanza.
 */

export const PISO_MS = 500;

/**
 * @param {object} opciones
 * @param {number} [opciones.pisoMs]   Mínimo que un cartel transitorio se queda en pantalla.
 * @param {() => number} [opciones.ahora]      Reloj inyectable (los tests usan uno falso).
 * @param {Function} [opciones.programar]      `setTimeout` inyectable.
 * @param {Function} [opciones.cancelar]       `clearTimeout` inyectable.
 */
export function crearPisoVisible({
  pisoMs = PISO_MS,
  ahora = () => Date.now(),
  programar = setTimeout,
  cancelar = clearTimeout,
} = {}) {
  // Instante en que el cartel transitorio actual cumple su mínimo. 0 = no hay piso vigente.
  let vence = 0;
  // La única escritura en espera (la última gana; ver "lo que se coalesce" arriba).
  let pendiente = null;
  let temporizador = null;

  function pintar(escritura, esTransitorio) {
    escritura();
    vence = esTransitorio ? ahora() + pisoMs : 0;
  }

  function vaciar() {
    temporizador = null;
    if (!pendiente) { vence = 0; return; }
    const { escritura, esTransitorio } = pendiente;
    pendiente = null;
    pintar(escritura, esTransitorio);
    // Si lo que acaba de salir es a su vez transitorio, abre su propio piso. No hace falta
    // re-armar nada acá: no quedó nadie esperando, y el próximo `encolar` verá el piso nuevo.
  }

  function encolar(escritura, esTransitorio) {
    const restante = vence - ahora();
    if (restante <= 0) { pintar(escritura, esTransitorio); return; }
    pendiente = { escritura, esTransitorio };
    if (temporizador === null) temporizador = programar(vaciar, restante);
  }

  return {
    /** Un aviso de trabajo en curso: se pinta y se queda el mínimo. */
    transitorio(escritura) { encolar(escritura, true); },

    /** El estado que corresponde ahora: se pinta salvo que le toque esperar un piso. */
    libre(escritura) { encolar(escritura, false); },

    /**
     * Escribe YA, tirando abajo el piso y lo que hubiera pendiente. Es la vía de escape para
     * cuando esperar sería peor que el parpadeo — hoy, un solo caso: el arranque con
     * onboarding, donde el loader tapa el tutorial y demorar el apagado medio segundo deja el
     * tour abajo de una cortina. Usala con un comentario que diga por qué; si aparece un
     * tercer caso, probablemente el que está mal es el llamador.
     */
    inmediato(escritura) {
      if (temporizador !== null) { cancelar(temporizador); temporizador = null; }
      pendiente = null;
      vence = 0;
      escritura();
    },

    /**
     * Arranca el piso de un cartel que **ya está en pantalla sin que nadie lo haya pedido**:
     * el que viene escrito en el markup y que el CSS muestra desde el primer frame. Se le
     * descuenta el tiempo que lleva visible, que es el punto — si el popup tardó 400 ms en
     * cablearse, al usuario le quedan 100, no 500. Sin esto el arranque cobra la espera dos
     * veces por un tiempo que el usuario ya esperó mirando ese mismo cartel.
     *
     * @param {number} visibleDesdeHaceMs
     */
    sembrar(visibleDesdeHaceMs) {
      const restante = pisoMs - Math.max(0, visibleDesdeHaceMs);
      vence = restante > 0 ? ahora() + restante : 0;
    },

    /**
     * ¿Hay una escritura esperando a que venza el piso?
     *
     * Existe por un modo de falla concreto, y quien agregue un consumidor nuevo lo va a
     * necesitar: **el código que LEE el DOM justo después de pedir una escritura**. Antes de
     * este módulo la escritura era sincrónica, así que medir a continuación medía el estado
     * nuevo; ahora puede estar en cola, y esa medición lee el viejo. El caso real fue
     * `sincronizarFooterVacio()` en `actualizarContadoresBoton`: medía el footer con el botón
     * todavía en su estado anterior y le ponía `.vacia`, que lo esconde entero — la línea
     * divisoria desaparecía hasta que la escritura pendiente aterrizaba y volvía a medir.
     *
     * La regla que sale de ahí: si la medición depende de la escritura, **no la hagas en
     * paralelo** — o preguntá por acá, o dejá que viaje adentro de la escritura misma.
     */
    hayPendiente() { return pendiente !== null; },

    /** Sólo para tests y para el banco: cuánto falta para que se libere el piso. */
    restanteMs() { return Math.max(0, vence - ahora()); },
  };
}

export default crearPisoVisible;
