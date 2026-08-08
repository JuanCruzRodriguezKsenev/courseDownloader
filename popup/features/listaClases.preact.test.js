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
import { montar, __resetStore, formatearPeso } from './listaClases.preact.js';

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

  // [ESCANEO-API CORTE 2] El chip de destino. No es decoración: si el input de carpeta puede
  // pisar el destino de 103 clases, el efecto tiene que verse ANTES de encolar.
  describe('el chip de destino', () => {
    const chips = () => [...root.querySelectorAll('.chip-destino')].map((c) => c.textContent);

    it('una clase con módulo muestra su módulo', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_superior' },
      ]});
      await flush();
      expect(chips()).toEqual(['miembro_superior']);
    });

    it('una clase SIN módulo no muestra chip: en un portal de un nivel sería ruido', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Anatomía TP 1', estado: 'pending' },
      ]});
      await flush();
      expect(chips()).toEqual([]);
    });

    it('con override, TODAS las filas cambian a la vez y se marcan como override', async () => {
      // Que cambien todas juntas es el mecanismo: es lo que hace imposible tocar el input sin
      // darse cuenta de lo que hace.
      puente.render({ modo: 'lista', ctx: ctxBase({ overrideCarpeta: 'repaso_final' }), items: [
        { id: 1, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_superior' },
        { id: 2, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_inferior' },
      ]});
      await flush();
      expect(chips()).toEqual(['→ repaso_final', '→ repaso_final']);
      expect(root.querySelectorAll('.chip-destino.override').length).toBe(2);
    });

    it('el override no le inventa chip a una clase sin módulo', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({ overrideCarpeta: 'repaso_final' }), items: [
        { id: 1, titulo: 'Anatomía TP 1', estado: 'pending' },
      ]});
      await flush();
      expect(chips()).toEqual([]);
    });

    it('sin override el chip no lleva la clase override', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase({ overrideCarpeta: '' }), items: [
        { id: 1, titulo: 'Miologia 1', estado: 'pending', modulo: 'miembro_superior' },
      ]});
      await flush();
      expect(root.querySelectorAll('.chip-destino.override').length).toBe(0);
    });
  });

  // [ESCANEO-API CORTE 5] La insignia de tipo y el peso. Sólo en adjuntos: la lista de un
  // portal sin materiales tiene que verse exactamente como antes.
  describe('la insignia de tipo y el peso', () => {
    it('un adjunto lleva 📄 y su peso', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Atlas.pdf', estado: 'pending', tipo: 'adjunto', bytes: 656307 },
      ]});
      await flush();
      expect(root.querySelector('.chip-tipo').textContent).toBe('📄');
      expect(root.querySelector('.chip-peso').textContent).toBe('641 KB');
    });

    it('un video no lleva ninguna de las dos', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Osteologia', estado: 'pending', tipo: 'video' },
      ]});
      await flush();
      expect(root.querySelector('.chip-tipo')).toBeNull();
      expect(root.querySelector('.chip-peso')).toBeNull();
    });

    it('un ítem sin tipo tampoco: es todo lo persistido de antes del corte', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Vieja', estado: 'pending' },
      ]});
      await flush();
      expect(root.querySelector('.chip-tipo')).toBeNull();
    });

    it('un adjunto sin peso muestra el ícono pero no un "0 KB"', async () => {
      puente.render({ modo: 'lista', ctx: ctxBase(), items: [
        { id: 1, titulo: 'Guia.pdf', estado: 'pending', tipo: 'adjunto' },
      ]});
      await flush();
      expect(root.querySelector('.chip-tipo')).not.toBeNull();
      expect(root.querySelector('.chip-peso')).toBeNull();
    });

    it('formatearPeso cambia de unidad y de precisión con el tamaño', () => {
      // El rango real del curso: guías de 90 KB conviviendo con un PDF de 83,9 MB.
      expect(formatearPeso(92160)).toBe('90 KB');
      expect(formatearPeso(83952102)).toBe('80.1 MB');
      expect(formatearPeso(200 * 1024 * 1024)).toBe('200 MB'); // sin decimal, ya no aporta
      expect(formatearPeso(0)).toBe('');
      expect(formatearPeso(undefined)).toBe('');
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
