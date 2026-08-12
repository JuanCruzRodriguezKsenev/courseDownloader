// @vitest-environment jsdom
/**
 * Test de la isla Preact #4 Etapa 1 (ListaClases). Verifica que la vista pura
 * refleje el view-model empujado por puente.render(vm):
 *  - modo 'card' pinta la .info-card (con HTML intencional vía dangerouslySetInnerHTML)
 *  - modo 'lista' pinta N .video-item; badges/checkboxes según pestaña y estado
 *  - la rama cola muestra "Bajando" (activo) o botón "Remover ❌"
 *  - los callbacks onCheckChange / onRemoverClick se disparan desde la fila
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// FASE 8: el puente dejó de ser `puente` y se importa. La API que este archivo
// afirma es la misma; lo que cambió es de dónde sale.
import puente from './listaClases.preact.js';
import { montar, __resetStore } from './listaClases.preact.js';
// [ALERTA EN EL CONTENEDOR] La alerta de conexión se pinta DENTRO de esta región, no en un root
// hermano: su store se importa acá para poder afirmarlo.
import bannerStore from './bannerConexion.preact.js';

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16));
}

function ctxBase(over = {}) {
  return {
    pestaña: 'disponibles',
    sincronizado: true,
    enCurso: false,
    videoActivo: null,
    selectionMode: true,
    onCheckChange: vi.fn(),
    onRemoverClick: vi.fn(),
    ...over,
  };
}

describe('Isla Preact: ListaClases', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    document.body.innerHTML = '<main id="root"></main>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  const items = () => root.querySelectorAll('.video-item');
  const card = () => root.querySelector('.info-card');

  it('expone el store global puente con su API', () => {
    expect(typeof puente.render).toBe('function');
    expect(typeof puente.get).toBe('function');
  });

  it('modo card pinta la .info-card con icono/titulo y HTML de la descripcion', async () => {
    puente.render({ modo: 'card', card: {
      tipo: 'error', titulo: 'Servidor Desconectado',
      descripcion: 'Ejecutá <strong>iniciar.bat</strong>', icono: '🔌',
    }});
    await flush();
    expect(card()).not.toBeNull();
    expect(card().classList.contains('error')).toBe(true);
    expect(card().querySelector('.info-card-icon').textContent).toBe('🔌');
    expect(card().querySelector('h5').textContent).toBe('Servidor Desconectado');
    expect(card().querySelector('p strong')).not.toBeNull(); // dangerouslySetInnerHTML
  });

  it('modo lista pinta una fila por item con su badge (Disponibles)', async () => {
    puente.render({ modo: 'lista', ctx: ctxBase(), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: false },
      { id: 2, titulo: 'B', estado: 'downloaded', seleccionado: false },
    ]});
    await flush();
    expect(items().length).toBe(2);
    // pending → checkbox + badge "Pendiente"; downloaded → placeholder (sin checkbox) + "Descargado"
    expect(root.querySelector('#chk-1')).not.toBeNull();
    expect(root.querySelector('#chk-2')).toBeNull();
    const badges = [...root.querySelectorAll('.badge')].map((b) => b.textContent);
    expect(badges).toContain('Pendiente');
    expect(badges).toContain('Descargado');
  });

  // [ESCANEO-API CORTE 2 + ajuste de UI del 2026-08-07] El icono de tipo y la pastilla de
  // materia. La pastilla lleva DOS datos --la materia y, en su color, el portal-- porque en la
  // Cola, que mezcla portales, la fila no tenia como decir ninguna de las dos cosas.
  describe('el icono de tipo y la pastilla de materia', () => {
    const RAMONNET = { id: 'ramonnet', nombre: 'Ramon Net', color: '#005AD7' };
    const ANATOMY = { id: 'anatomy-by-chris', nombre: 'Anatomy by Chris', color: '#8E44FF' };
    const registro = (m) => (clase) => m[clase && clase.sitioId];

    const chips = () => [...root.querySelectorAll('.chip-materia')].map((c) => c.textContent);
    const iconos = () => [...root.querySelectorAll('.chip-tipo')].map((c) => c.textContent);

    it('un video lleva el icono de video y un adjunto el de PDF, en Disponibles', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Osteologia', estado: 'pending', tipo: 'video' },
        { id: 2, titulo: 'Atlas.pdf', estado: 'pending', tipo: 'adjunto' },
      ]});
      await flush();
      expect(iconos()).toEqual(['\u{1F3AC}', '\u{1F4C4}']);
    });

    it('tambien en la Cola: es donde no se sabia que se estaba bajando', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({ 'pesta\u00f1a': 'cola' }), items: [
        { id: 1, titulo: 'Osteologia', carpeta: 'ms', tipo: 'video' },
        { id: 2, titulo: 'Atlas.pdf', carpeta: 'ms', tipo: 'adjunto' },
      ]});
      await flush();
      expect(iconos()).toEqual(['\u{1F3AC}', '\u{1F4C4}']);
    });

    it('un item SIN tipo cuenta como video: es todo lo persistido de antes', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Vieja', estado: 'pending' },
      ]});
      await flush();
      expect(iconos()).toEqual(['\u{1F3AC}']);
    });

    it('NO se muestra el peso de un adjunto', async () => {
      // Se saco a pedido del dueno: no cambia ninguna decision y suma ruido a la fila.
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Atlas.pdf', estado: 'pending', tipo: 'adjunto', bytes: 83952102 },
      ]});
      await flush();
      expect(root.querySelector('.chip-peso')).toBeNull();
      expect(root.textContent).not.toContain('MB');
    });

    it('la pastilla muestra el modulo en Disponibles', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_superior' },
      ]});
      await flush();
      expect(chips()).toEqual(['miembro_superior']);
    });

    it('y la carpeta ya estampada en la Cola', async () => {
      // Es el dato que faltaba: en la Cola la clase ya tiene destino decidido.
      puente.render({ modo: 'lista', ctx: ctxBase({ 'pesta\u00f1a': 'cola' }), items: [
        { id: 1, titulo: 'Miologia 1', carpeta: 'miembro_superior', modulo: 'miembro_superior' },
      ]});
      await flush();
      expect(chips()).toEqual(['miembro_superior']);
    });

    it('se pinta con el color del portal DEL ITEM, no del portal activo', async () => {
      // La Cola mezcla portales a proposito: es el caso que hace falta que ande.
      puente.render({ modo: 'lista', ctx: ctxBase({
        'pesta\u00f1a': 'cola',
        portalDe: registro({ ramonnet: RAMONNET, 'anatomy-by-chris': ANATOMY }),
      }), items: [
        { id: 1, titulo: 'Clase', carpeta: 'bio', sitioId: 'ramonnet' },
        { id: 2, titulo: 'Miologia 1', carpeta: 'ms', sitioId: 'anatomy-by-chris' },
      ]});
      await flush();

      const pastillas = [...root.querySelectorAll('.chip-materia')];
      expect(pastillas[0].style.getPropertyValue('--color-portal')).toBe('#005AD7');
      expect(pastillas[1].style.getPropertyValue('--color-portal')).toBe('#8E44FF');
    });

    it('el nombre del portal viaja en el tooltip, que es donde no ocupa lugar', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({
        'pesta\u00f1a': 'cola',
        portalDe: registro({ 'anatomy-by-chris': ANATOMY }),
      }), items: [
        { id: 1, titulo: 'Miologia 1', carpeta: 'ms', sitioId: 'anatomy-by-chris' },
      ]});
      await flush();
      expect(root.querySelector('.chip-materia').title).toContain('Anatomy by Chris');
    });

    it('un huerfano no rompe la pastilla: queda sin color de portal', async () => {
      // Sin el fallback del CSS, border-color quedaria invalido y la pastilla se veria rota.
      puente.render({ modo: 'lista', ctx: ctxBase({
        'pesta\u00f1a': 'cola',
        portalDe: registro({ ramonnet: RAMONNET }),
      }), items: [
        { id: 1, titulo: 'Huerfana', carpeta: 'bio', sitioId: 'portal-borrado' },
      ]});
      await flush();
      const pastilla = root.querySelector('.chip-materia');
      expect(pastilla).not.toBeNull();
      expect(pastilla.style.getPropertyValue('--color-portal')).toBe('');
    });

    it('con override, TODAS las filas cambian a la vez y se marcan como override', async () => {
      // Que cambien todas juntas es el mecanismo: es lo que hace imposible tocar el input sin
      // darse cuenta de lo que hace.
      puente.render({ modo: 'lista', ctx: ctxBase({ overrideCarpeta: 'repaso_final' }), items: [
        { id: 1, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_superior' },
        { id: 2, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_inferior' },
      ]});
      await flush();
      expect(chips()).toEqual(['\u2192 repaso_final', '\u2192 repaso_final']);
      expect(root.querySelectorAll('.chip-materia.override').length).toBe(2);
    });

    it('el override no marca a una clase sin modulo (no tiene destino propio que pisar)', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({ overrideCarpeta: 'repaso_final' }), items: [
        { id: 1, titulo: 'Anatomia TP 1', estado: 'pending', carpeta: 'biologia' },
      ]});
      await flush();
      expect(root.querySelectorAll('.chip-materia.override').length).toBe(0);
    });

    it('el override NO llega a la Cola: ahi la carpeta ya esta estampada', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({ 'pesta\u00f1a': 'cola', overrideCarpeta: 'repaso_final' }), items: [
        { id: 1, titulo: 'Miologia 1', carpeta: 'miembro_superior', modulo: 'miembro_superior' },
      ]});
      await flush();
      expect(chips()).toEqual(['miembro_superior']);
    });

    it('sin materia no hay pastilla', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Suelta', estado: 'pending' },
      ]});
      await flush();
      expect(chips()).toEqual([]);
    });
  });

  it('sin sincronizar: filas atenuadas y sin checkbox', async () => {
    puente.render({ modo: 'lista', ctx: ctxBase({ sincronizado: false }), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: false },
    ]});
    await flush();
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();
    expect(root.querySelector('.video-item').style.opacity).toBe('0.65');
    expect(root.querySelector('.badge').textContent).toBe('Sin verificar');
  });

  it('el checkbox dispara onCheckChange(clase, checked)', async () => {
    const ctx = ctxBase();
    const clase = { id: 5, titulo: 'X', estado: 'pending', seleccionado: false };
    puente.render({ modo: 'lista', ctx, items: [clase] });
    await flush();
    const chk = root.querySelector('#chk-5');
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
    expect(ctx.onCheckChange).toHaveBeenCalledWith(clase, true);
  });

  it('rama cola: item activo muestra "Bajando" sin boton; item normal tiene "Remover ❌"', async () => {
    const ctx = ctxBase({ pestaña: 'cola', enCurso: true, videoActivo: 'A' });
    puente.render({ modo: 'lista', ctx, items: [
      { id: 1, titulo: 'A', seleccionado: false },
      { id: 2, titulo: 'B', seleccionado: false },
    ]});
    await flush();
    const filas = items();
    // A es el activo: badge "Bajando", sin botón remover, sin checkbox.
    expect(filas[0].querySelector('.badge').textContent).toBe('Bajando');
    expect(filas[0].querySelector('button')).toBeNull();
    expect(root.querySelector('#chk-cola-1')).toBeNull();
    // B normal: botón remover.
    const btnRemover = filas[1].querySelector('button.remove-action');
    expect(btnRemover).not.toBeNull();
    btnRemover.click();
    expect(ctx.onRemoverClick).toHaveBeenCalledWith({ id: 2, titulo: 'B', seleccionado: false });
  });

  it('la clase selected refleja clase.seleccionado', async () => {
    puente.render({ modo: 'lista', ctx: ctxBase(), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: true },
    ]});
    await flush();
    expect(root.querySelector('.video-item').classList.contains('selected')).toBe(true);
  });

  // Etapa 2: la isla es dueña de los atributos del host #ui-list.
  it('setSelectionMode togglea la clase .selection-mode en el host', async () => {
    puente.setSelectionMode(true);
    await flush();
    expect(root.classList.contains('selection-mode')).toBe(true);
    puente.setSelectionMode(false);
    await flush();
    expect(root.classList.contains('selection-mode')).toBe(false);
  });

  it('setAtenuada aplica y quita la opacidad 0.5 del host', async () => {
    puente.setAtenuada(true);
    await flush();
    expect(root.style.opacity).toBe('0.5');
    puente.setAtenuada(false);
    await flush();
    expect(root.style.opacity).toBe('');
  });

  it('setOculta esconde el host y quita los hijos (la isla devuelve null)', async () => {
    puente.render({ modo: 'lista', ctx: ctxBase(), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: false },
    ]});
    await flush();
    expect(items().length).toBe(1);

    puente.setOculta(true);
    await flush();
    expect(root.style.display).toBe('none');
    expect(items().length).toBe(0); // Preact quitó los hijos, no un innerHTML="" externo

    puente.setOculta(false);
    await flush();
    expect(root.style.display).toBe('');
    expect(items().length).toBe(1); // el vm seguía en el store → re-render
  });
});

// [MULTISITIO CORTE 6A] La fila anclada + su divisoria.
//
// Lo que se afirma acá es SÓLO lo que es de la isla: que pinte el divisor detrás de la primera
// fila y la nota cuando el resto quedó vacío. Que la clase que baja venga primera lo decide
// popup.js al armar el vm — la isla no reordena, y estos tests lo dan por hecho a propósito.
describe('Isla Preact: ListaClases — ancla de la descarga en curso', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    document.body.innerHTML = '<main id="root"></main>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  const items = () => root.querySelectorAll('.video-item');
  const divisores = () => root.querySelectorAll('.cola-divisor');

  const ctxCola = (over = {}) => ctxBase({
    pestaña: 'cola',
    enCurso: true,
    videoActivo: 'Semana 02',
    anclaActiva: true,
    sinResultados: false,
    ...over,
  });

  const colaCon = (ctx, lista) => puente.render({ modo: 'lista', ctx, items: lista });

  const TRES = [
    { id: 1, titulo: 'Semana 02', estado: 'process', seleccionado: false },
    { id: 2, titulo: 'Semana 03', estado: 'pending', seleccionado: false },
    { id: 3, titulo: 'Semana 04', estado: 'pending', seleccionado: false },
  ];

  it('pinta una divisoria detrás de la primera fila', async () => {
    colaCon(ctxCola(), TRES);
    await flush();

    expect(items().length).toBe(3);
    expect(divisores().length).toBe(1);
  });

  it('la divisoria va DESPUÉS de la fila anclada, no antes', async () => {
    colaCon(ctxCola(), TRES);
    await flush();

    const hijos = Array.from(root.children);
    expect(hijos[0].classList.contains('video-item')).toBe(true);
    expect(hijos[0].querySelector('.video-label').textContent).toBe('Semana 02');
    expect(hijos[1].classList.contains('cola-divisor')).toBe(true);
  });

  it('la fila anclada lleva .bajando y su badge, el resto no', async () => {
    colaCon(ctxCola(), TRES);
    await flush();

    const filas = items();
    expect(filas[0].classList.contains('bajando')).toBe(true);
    expect(filas[0].querySelector('.badge').textContent).toBe('Bajando');
    expect(filas[1].classList.contains('bajando')).toBe(false);
    expect(filas[2].classList.contains('bajando')).toBe(false);
  });

  it('sin ancla (nada bajando) no hay divisoria: la cola se pinta plana', async () => {
    colaCon(ctxCola({ enCurso: false, videoActivo: null, anclaActiva: false }), TRES);
    await flush();

    expect(items().length).toBe(3);
    expect(divisores().length).toBe(0);
  });

  it('si el filtro dejó el resto vacío, queda el ancla + la nota, NO la tarjeta de vacío', async () => {
    // Es el caso que hacía falta separar: "no hay resultados" no es "la lista está vacía"
    // cuando hay una descarga en curso.
    colaCon(ctxCola({ sinResultados: true }), [TRES[0]]);
    await flush();

    expect(items().length).toBe(1);
    expect(items()[0].querySelector('.video-label').textContent).toBe('Semana 02');
    expect(divisores().length).toBe(1);
    expect(root.querySelector('.cola-sin-resultados')).not.toBeNull();
    expect(root.querySelector('.info-card')).toBeNull();
  });

  it('con resultados NO aparece la nota de vacío', async () => {
    colaCon(ctxCola(), TRES);
    await flush();

    expect(root.querySelector('.cola-sin-resultados')).toBeNull();
  });

  it('la tarjeta de estado sigue ganando: modo card no pinta filas ni divisoria', async () => {
    puente.render({ modo: 'card', card: { tipo: 'info', titulo: 'Fila vacía', descripcion: 'x', icono: '📥' } });
    await flush();

    expect(items().length).toBe(0);
    expect(divisores().length).toBe(0);
    expect(root.querySelector('.info-card')).not.toBeNull();
  });
});

// [ALERTA EN EL CONTENEDOR] Lo que estos tres fijan es la razón de ser del cambio: la alerta de
// conexión y las listas COMPARTEN contenedor, así que no puede volver a pasar que se vean las
// dos. Antes la alerta vivía en un root hermano (#preact-banner) y la lista se apagaba con
// `setOculta` desde el vanilla: dos dueños de la misma región coordinados a mano, y alcanzaba
// con que algo tocara el host para que la lista reapareciera abajo del banner.
describe('Isla Preact: ListaClases — la alerta comparte contenedor', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    bannerStore.ocultar();
    document.body.innerHTML = '<main id="root"></main>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  it('con alerta visible pinta la alerta ADENTRO del contenedor', async () => {
    bannerStore.mostrar('servidor');
    await flush();
    expect(root.querySelector('.server-error-card')).not.toBeNull();
  });

  it('la alerta gana sobre la lista y sobre la card de estado', async () => {
    puente.render({ modo: 'lista', items: [{ id: 1, titulo: 'A', estado: 'pending', seleccionado: false }], ctx: ctxBase() });
    await flush();
    expect(root.querySelectorAll('.video-item').length).toBe(1);

    bannerStore.mostrar('internet');
    await flush();
    expect(root.querySelectorAll('.video-item').length).toBe(0);
    expect(root.querySelector('.server-error-card')).not.toBeNull();

    // Y también sobre una card de estado, que es la otra cosa que ocupa esta región.
    puente.render({ modo: 'card', card: { tipo: 'error', titulo: 'Pausada', descripcion: 'x', icono: '⚠️' } });
    await flush();
    expect(root.querySelector('.info-card')).toBeNull();
    expect(root.querySelector('.server-error-card')).not.toBeNull();
  });

  // [MARCOS ANIDADOS] Una card trae su propia superficie: si el wrapper conserva la suya, la
  // card queda metida hacia adentro por su padding+borde y sus laterales dejan de alinear con
  // las barras de arriba, que cuelgan del padding del contenedor.
  it('con una card llenando la región, el host suelta su marco', async () => {
    puente.render({ modo: 'lista', items: [{ id: 1, titulo: 'A', estado: 'pending' }], ctx: ctxBase() });
    await flush();
    expect(root.classList.contains('sin-marco')).toBe(false);

    bannerStore.mostrar('servidor');
    await flush();
    expect(root.classList.contains('sin-marco')).toBe(true);

    bannerStore.ocultar();
    await flush();
    expect(root.classList.contains('sin-marco')).toBe(false);
  });

  it('lo mismo con una tarjeta de estado, que es la otra card que llena la región', async () => {
    puente.render({ modo: 'card', card: { tipo: 'info', titulo: 'Fila vacía', descripcion: 'x', icono: '📥' } });
    await flush();
    expect(root.classList.contains('sin-marco')).toBe(true);
  });

  it('al ocultarla vuelve la lista sola, sin que nadie la restaure', async () => {
    puente.render({ modo: 'lista', items: [{ id: 1, titulo: 'A', estado: 'pending', seleccionado: false }], ctx: ctxBase() });
    bannerStore.mostrar('servidor');
    await flush();
    expect(root.querySelectorAll('.video-item').length).toBe(0);

    bannerStore.ocultar();
    await flush();
    expect(root.querySelector('.server-error-card')).toBeNull();
    expect(root.querySelectorAll('.video-item').length).toBe(1);
  });
});
