/**
 * CAPA FLOTANTE COMPARTIDA — la superficie que se abre encima de todo (V1.0.0)
 * ==========================================================================
 * Componente único para lo que hoy está escrito cuatro veces: el modal de advertencia
 * (`popup.js`), el asistente de faceta (`popup/features/faceta.js`), el tour de onboarding
 * (`onboarding.preact.js`) y el panel de la campanita (`campanita.preact.js`).
 *
 * LO QUE ESTABA DUPLICADO, MEDIDO
 * -------------------------------
 * `.adv-overlay` (advertencia.css) y `.faceta-overlay` (faceta.css) son **idénticos línea por
 * línea**: inset 0, `--bg-overlay`, `blur(8px)`, flex centrado, `z-index: 9999999` y
 * `fadeIn-modal 0.25s`. `.onboarding-overlay` es el mismo con otro blur y otro z-index. Las
 * cards sólo se diferencian en padding, `max-width` y el tamaño del `h4`. Y en JS,
 * `mostrarModalAdvertencia` y `mostrarModal` repiten la misma secuencia con distinto nombre.
 *
 * DOS VARIANTES, PORQUE SON DOS COSAS DISTINTAS
 * ---------------------------------------------
 *   - `modal`   → tapa la pantalla y centra. Para lo que **pide algo**: elegí una cátedra,
 *                 Entendido/Cancelar, el tour.
 *   - `anclado` → la misma superficie, junto a quien la abrió, sin tapar nada. Para lo que
 *                 **sólo informa**, como el historial de fallos: lo que hacés después de leer
 *                 un fallo es buscar esa clase en la lista, y un modal te la esconde.
 *
 * Lo compartido es la SUPERFICIE (fondo, borde, radio, sombra) y el CIERRE. Dónde se apoya y
 * cuánto mide lo pone cada consumidor en su hoja: eso es de cada uno, no del componente.
 *
 * LO QUE GANAN LOS CUATRO, Y NINGUNO TENÍA
 * ----------------------------------------
 * **Cierre con Escape y con clic afuera.** No había un solo `keydown` para esto en el proyecto:
 * el asistente de faceta sólo se cerraba eligiendo una opción, y el panel de la campanita sólo
 * re-tocando la campanita. Más `role="dialog"` y `aria-modal`, que tampoco había.
 *
 * SEGURIDAD
 * ---------
 * No expone ninguna vía tipo `innerHTML`: el contenido entra como `children` y lo escapa htm.
 * Es deliberado — sus consumidores muestran títulos scrapeados (la campanita) y copy que sale
 * del descriptor del portal (la faceta), y `docs/security.md` prohíbe interpolar eso sin
 * escapar. Un `dangerouslySetInnerHTML` acá lo reabriría para los cuatro de una.
 * ==========================================================================
 */
import { html, render, useEffect, useRef } from '../vendor/htm-preact-standalone.module.js';

/**
 * @param {object}   props
 * @param {'modal'|'anclado'} [props.variante='modal']
 * @param {boolean}  props.abierto
 * @param {Function} props.onCerrar      Escape, clic afuera, o clic en el fondo del overlay.
 * @param {string}   props.etiqueta      Nombre accesible (`aria-label`).
 * @param {string}   [props.clase]       Clase extra del consumidor, para medidas y posición.
 * @param {object}   [props.contenedorRef] Sólo `anclado`: ref al elemento que envuelve AL
 *                   DISPARADOR Y AL PANEL. Un clic ahí adentro no cuenta como "afuera" — sin
 *                   esto, tocar el botón para cerrar dispara las dos cosas (el cierre por
 *                   afuera y el toggle del botón) y el panel no se cierra nunca.
 * @param {boolean}  [props.cerrarPorFondo=true]  Clic en el fondo (modal) o afuera (anclado).
 * @param {boolean}  [props.cerrarConEscape=true] Tecla Escape.
 *
 * Las dos últimas existen porque **no todo lo que flota se puede descartar al pasar**: el tour
 * de onboarding se sale por su botón "Saltar" y nada más, porque un clic al fondo mientras lo
 * leés lo cerraría para siempre (sólo se muestra la primera vez). Los defaults son `true`
 * porque descartable es lo normal; apagarlo es la excepción y se declara.
 */
export function Capa({
  variante = 'modal', abierto, onCerrar, etiqueta, clase = '', contenedorRef,
  cerrarPorFondo = true, cerrarConEscape = true, children,
}) {
  const cardRef = useRef(null);

  // Escape. Va en `document` y no en la card porque la card no tiene el foco: se abre por un
  // click y el foco se queda donde estaba.
  useEffect(() => {
    if (!abierto || !cerrarConEscape) return undefined;
    const porTecla = (e) => { if (e.key === 'Escape') onCerrar && onCerrar(); };
    document.addEventListener('keydown', porTecla);
    return () => document.removeEventListener('keydown', porTecla);
  }, [abierto, onCerrar, cerrarConEscape]);

  // Clic afuera, sólo para la variante anclada: la modal ya lo resuelve con su overlay, que
  // ocupa toda la pantalla y es quien recibe el clic.
  //
  // `mousedown` y no `click` a propósito: el click que ABRE el panel todavía no terminó cuando
  // este efecto se registra, así que con `click` el mismo gesto lo abriría y lo cerraría.
  useEffect(() => {
    if (!abierto || variante !== 'anclado' || !cerrarPorFondo) return undefined;
    const porClic = (e) => {
      const contenedor = (contenedorRef && contenedorRef.current) || cardRef.current;
      if (contenedor && !contenedor.contains(e.target)) onCerrar && onCerrar();
    };
    document.addEventListener('mousedown', porClic);
    return () => document.removeEventListener('mousedown', porClic);
  }, [abierto, variante, onCerrar, contenedorRef, cerrarPorFondo]);

  // ── FOCO ATRAPADO, sólo en la variante `modal` ──────────────────────────────────────────
  //
  // Un modal tapa la pantalla, así que el Tab NO puede seguir recorriendo lo que quedó debajo:
  // se llega con el teclado a un buscador y a unos filtros invisibles y muertos, y el foco
  // desaparece de la vista sin que nada lo indique.
  //
  // La variante `anclado` NO atrapa, y es deliberado: no tapa nada, así que salir de ella con
  // Tab es legítimo. Atrapar el foco en algo que no bloquea es encerrar al usuario sin motivo.
  useEffect(() => {
    if (!abierto || variante !== 'modal') return undefined;

    const previo = document.activeElement;
    const enfocables = () => {
      const card = cardRef.current;
      if (!card) return [];
      return [...card.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
        ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((el) => !el.closest('[inert]'));
    };

    // Entrar al modal: al primero que se pueda enfocar, o a la card misma si no hay ninguno
    // (lleva `tabindex="-1"` justamente para poder recibirlo).
    const primeros = enfocables();
    (primeros[0] || cardRef.current)?.focus?.();

    const porTab = (e) => {
      if (e.key !== 'Tab') return;
      const lista = enfocables();
      if (lista.length === 0) { e.preventDefault(); return; }
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      const activo = document.activeElement;

      // El ciclo se cierra a mano en los dos extremos. Y el `!card.contains(activo)` cubre el
      // caso de que el foco haya quedado afuera antes de abrir: lo trae de vuelta en vez de
      // dejar que el Tab siga por la página de abajo.
      if (e.shiftKey && (activo === primero || !cardRef.current?.contains(activo))) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && (activo === ultimo || !cardRef.current?.contains(activo))) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', porTab);
    return () => {
      document.removeEventListener('keydown', porTab);
      // Devolver el foco a quien lo tenía: si no, al cerrar queda en el `<body>` y el próximo
      // Tab arranca desde el principio del popup, lejos de donde estabas.
      if (previo && typeof previo.focus === 'function') previo.focus();
    };
  }, [abierto, variante]);

  if (!abierto) return null;

  const card = html`
    <div ref=${cardRef}
         class="capa-card ${variante === 'modal' ? 'es-modal' : 'es-anclada'} ${clase}"
         role="dialog"
         aria-modal=${variante === 'modal' ? 'true' : 'false'}
         aria-label=${etiqueta}
         tabindex=${variante === 'modal' ? '-1' : undefined}>
      ${children}
    </div>`;

  if (variante !== 'modal') return card;

  // El clic cierra SÓLO si cayó en el fondo. Sin el `target === currentTarget`, un clic sobre
  // cualquier cosa de adentro burbujea hasta acá y cierra el modal mientras lo estás usando.
  return html`
    <div class="capa-overlay"
         onClick=${(e) => {
           if (cerrarPorFondo && e.target === e.currentTarget && onCerrar) onCerrar();
         }}>
      ${card}
    </div>`;
}

/**
 * PUENTE IMPERATIVO, para los consumidores que todavía son vanilla.
 *
 * `popup.js` (modal de advertencia) y `popup/features/faceta.js` (asistente de faceta) no son
 * componentes: son funciones que arman DOM y lo cuelgan del `<body>`. Sin este puente, usar
 * `Capa` desde ahí obligaría a migrarlos enteros a Preact en el mismo corte — y migrar el
 * mundo de un módulo es un cambio mucho más grande que compartirle la superficie.
 *
 * Monta su propio root y lo saca al cerrar, así no deja nodos huérfanos en el `<body>` ni
 * necesita un contenedor reservado en el HTML.
 *
 * @param {object}   opciones
 * @param {Function} opciones.contenido  Recibe `cerrar` y devuelve el markup (`html\`…\``). Es
 *                   una FUNCIÓN y no un valor para que los botones de adentro puedan cerrar sin
 *                   que el consumidor tenga que guardarse la referencia por su cuenta.
 * @param {Function} [opciones.alCerrar] Efecto del consumidor al cerrarse, por cualquier vía.
 * @returns {Function} `cerrar`, para los consumidores que cierran desde afuera.
 *
 * Lo demás se le pasa tal cual a `Capa`. **No hay una vía `innerHTML` acá tampoco**: el markup
 * lo arma htm y escapa las interpolaciones, que es lo que mantiene en pie la regla de
 * `docs/security.md` para el copy del portal y para los títulos scrapeados.
 */
export function abrirCapa({ contenido, alCerrar, ...props }) {
  const root = document.createElement('div');
  document.body.appendChild(root);

  let cerrada = false;
  const cerrar = () => {
    // Guarda de reentrada: "Entendido" cierra y su `alCerrar` puede disparar algo que vuelva a
    // pasar por acá. Sin esto, el segundo `render(null)` corre sobre un root ya desmontado.
    if (cerrada) return;
    cerrada = true;
    render(null, root);
    root.remove();
    if (alCerrar) alCerrar();
  };

  render(
    html`<${Capa} abierto=${true} onCerrar=${cerrar} ...${props}>${contenido(cerrar)}<//>`,
    root
  );
  return cerrar;
}

export default Capa;
