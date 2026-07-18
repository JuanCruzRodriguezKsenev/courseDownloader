// @vitest-environment jsdom
/**
 * Test de la isla Preact #4 Etapa 1 (ListaClases). Verifica que la vista pura
 * refleje el view-model empujado por window.ListaClases.render(vm):
 *  - modo 'card' pinta la .info-card (con HTML intencional vía dangerouslySetInnerHTML)
 *  - modo 'lista' pinta N .video-item; badges/checkboxes según pestaña y estado
 *  - la rama cola muestra "Bajando" (activo) o botón "Remover ❌"
 *  - los callbacks onCheckChange / onRemoverClick se disparan desde la fila
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { montar, __resetStore } from './listaClases.preact.js';

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

  it('expone el store global window.ListaClases con su API', () => {
    expect(typeof window.ListaClases.render).toBe('function');
    expect(typeof window.ListaClases.get).toBe('function');
  });

  it('modo card pinta la .info-card con icono/titulo y HTML de la descripcion', async () => {
    window.ListaClases.render({ modo: 'card', card: {
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
    window.ListaClases.render({ modo: 'lista', ctx: ctxBase(), items: [
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

  it('sin sincronizar: filas atenuadas y sin checkbox', async () => {
    window.ListaClases.render({ modo: 'lista', ctx: ctxBase({ sincronizado: false }), items: [
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
    window.ListaClases.render({ modo: 'lista', ctx, items: [clase] });
    await flush();
    const chk = root.querySelector('#chk-5');
    chk.checked = true;
    chk.dispatchEvent(new Event('change'));
    expect(ctx.onCheckChange).toHaveBeenCalledWith(clase, true);
  });

  it('rama cola: item activo muestra "Bajando" sin boton; item normal tiene "Remover ❌"', async () => {
    const ctx = ctxBase({ pestaña: 'cola', enCurso: true, videoActivo: 'A' });
    window.ListaClases.render({ modo: 'lista', ctx, items: [
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
    window.ListaClases.render({ modo: 'lista', ctx: ctxBase(), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: true },
    ]});
    await flush();
    expect(root.querySelector('.video-item').classList.contains('selected')).toBe(true);
  });

  // Etapa 2: la isla es dueña de los atributos del host #ui-list.
  it('setSelectionMode togglea la clase .selection-mode en el host', async () => {
    window.ListaClases.setSelectionMode(true);
    await flush();
    expect(root.classList.contains('selection-mode')).toBe(true);
    window.ListaClases.setSelectionMode(false);
    await flush();
    expect(root.classList.contains('selection-mode')).toBe(false);
  });

  it('setAtenuada aplica y quita la opacidad 0.5 del host', async () => {
    window.ListaClases.setAtenuada(true);
    await flush();
    expect(root.style.opacity).toBe('0.5');
    window.ListaClases.setAtenuada(false);
    await flush();
    expect(root.style.opacity).toBe('');
  });

  it('setOculta esconde el host y quita los hijos (la isla devuelve null)', async () => {
    window.ListaClases.render({ modo: 'lista', ctx: ctxBase(), items: [
      { id: 1, titulo: 'A', estado: 'pending', seleccionado: false },
    ]});
    await flush();
    expect(items().length).toBe(1);

    window.ListaClases.setOculta(true);
    await flush();
    expect(root.style.display).toBe('none');
    expect(items().length).toBe(0); // Preact quitó los hijos, no un innerHTML="" externo

    window.ListaClases.setOculta(false);
    await flush();
    expect(root.style.display).toBe('');
    expect(items().length).toBe(1); // el vm seguía en el store → re-render
  });
});
