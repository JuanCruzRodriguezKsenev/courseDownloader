/**
 * BLOQUEO — el contrato de "esto ahora no se puede tocar", en un solo lugar (V1.0.0)
 * ==========================================================================
 * Hogar canónico del §2 de `docs/alertas-y-bloqueo-diseno.md`. Ahí está el POR QUÉ; acá está
 * el cómo, y existe porque el cómo estaba copiado en tres funciones de `popup.js`
 * (`bloquearToolbar`, `bloquearFilaDePortal`, `bloquearRegionesDeAlerta`) que repetían las
 * mismas tres decisiones con distinta letra — y cada control nuevo obligaba a acordarse de las
 * tres.
 *
 * NO es una feature con `crear(ctx)`: no tiene estado, no guarda nodos y no depende de nada.
 * Recibe los elementos por parámetro en cada llamada, que es lo que lo hace reusable desde
 * cualquier región. Por eso exporta un objeto plano.
 *
 * ── LAS DOS FORMAS DEL BLOQUEO, Y POR QUÉ SE ELIGEN SOLAS ────────────────────────────────
 *
 * | Qué es                          | Cómo se bloquea      | Por qué                        |
 * |---------------------------------|----------------------|--------------------------------|
 * | Control de formulario           | `disabled`           | Frena mouse Y TECLADO, y lo    |
 * | (`input`, `button`, `select`)   |                      | comunica a accesibilidad       |
 * | Cualquier otra cosa             | `aria-disabled`      | No admiten `disabled`; el CSS  |
 * | (`span`, `label`)               |                      | de `.bloqueada` los apaga con  |
 * |                                 |                      | `pointer-events` desde ese     |
 * |                                 |                      | atributo                       |
 *
 * La discriminación es `'disabled' in elemento`, o sea la propiedad del DOM, no una lista de
 * tags que haya que mantener. Un control nuevo entra sin tocar este archivo.
 *
 * **`pointer-events: none` sobre el contenedor NO es un bloqueo**, y fue el primer intento del
 * proyecto: frena el mouse y deja pasar el teclado (se podía tabular al input de materia y
 * escribir, o marcar "Todos" con Espacio). Por eso `marcarRegion` no alcanza nunca sola.
 *
 * ── LA ASIMETRÍA, QUE ES LO QUE MÁS IMPORTA ──────────────────────────────────────────────
 *
 * **Bloquear es uniforme; liberar NO es "habilitar todo".** Cada control tiene su propia
 * condición (el buscador sin lista, "Todos" sin sincronizar el disco), así que ponerlos todos
 * en `disabled = false` habilita cosas que no correspondían y el bug aparece lejos.
 *
 * Eso acá es ESTRUCTURAL, no una advertencia en un comentario que alguien va a saltear:
 * `aplicar()` **nunca escribe `disabled = false`**. Al liberar llama al `restaurar` que le
 * pasó quien la usa, que es el único que sabe qué condición tiene cada uno. Si no le pasás
 * `restaurar`, liberar no re-habilita nada — y eso es correcto, no un olvido.
 *
 * `aria-disabled`, en cambio, sí es simétrico: es un marcador, no una capacidad.
 * ==========================================================================
 */
const Bloqueo = {
  /**
   * Marca las regiones con `.bloqueada` (la utilitaria de `styles/base.css`: tinte parejo,
   * `pointer-events` sobre lo marcado con `aria-disabled`, y cursor normalizado).
   *
   * Va aparte de `aplicar` porque hay regiones que se marcan sin que todos sus controles se
   * bloqueen, y al revés.
   */
  marcarRegion(contenedores, bloquear) {
    (contenedores || []).forEach((n) => n && n.classList.toggle('bloqueada', bloquear));
  },

  /**
   * Aplica a cada elemento la forma de bloqueo que admite.
   *
   * @param {boolean} bloquear
   * @param {object}  opciones
   * @param {Array}   [opciones.regiones]   Contenedores que llevan `.bloqueada`.
   * @param {Array}   [opciones.elementos]  Lo que se bloquea. Puede mezclar controles de
   *                                        formulario y no-controles: cada uno recibe lo suyo.
   * @param {Function}[opciones.restaurar]  Se llama SÓLO al liberar. Es el único camino por el
   *                                        que un `disabled` vuelve a `false` (ver la
   *                                        asimetría, arriba).
   *
   * Los `null`/`undefined` de las listas se ignoran a propósito: los call-sites arman arrays
   * con `nodos.*` que pueden no existir según la pestaña, y obligarlos a filtrar antes
   * devolvería el `if (x)` repetido que este módulo vino a sacar.
   */
  aplicar(bloquear, { regiones = [], elementos = [], restaurar } = {}) {
    this.marcarRegion(regiones, bloquear);

    elementos.forEach((el) => {
      if (!el) return;
      if ('disabled' in el) {
        // Sólo al bloquear. Liberar es cosa de `restaurar` — ver la asimetría.
        if (bloquear) el.disabled = true;
      } else {
        el.setAttribute('aria-disabled', String(bloquear));
      }
    });

    if (!bloquear && typeof restaurar === 'function') restaurar();
  },
};

// Exportación (ver docs/coding-standards.md). Como los demás módulos hermanos desde la Fase
// 8a: viaja por `import` y no publica global — no es un adaptador intercambiable.
export default Bloqueo;
