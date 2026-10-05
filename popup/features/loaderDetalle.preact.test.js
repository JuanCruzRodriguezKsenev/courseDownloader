// @vitest-environment jsdom
/**
 * Test de la isla Preact #6 (detalle del loader con progreso en tarjetas). Verifica:
 *  - Arranca vacío
 *  - Tarjeta actual, pie y fila Escaneando…
 *  - Lista de cursos con marcas SVG, clase actual y scrollIntoView
 *  - Contadores con etiquetas y valores
 *  - Reloj con fake timers y restante condicional
 *  - limpiar() deja el root vacío
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import puente, { montar, __resetStore } from './loaderDetalle.preact.js';

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16));
}

describe('Isla Preact: LoaderDetalle', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arranca vacío sin pintar nada', () => {
    expect(root.innerHTML).toBe('');
    expect(puente.get()).toEqual({
      actual: null,
      contadores: null,
      restante: null,
      cursos: [],
      pie: [],
      desde: null,
    });
  });

  it('tarjeta actual y pie', async () => {
    puente.mostrar({
      actual: {
        posicion: 'Curso 1 de 3',
        nombre: 'Física II',
        detalle: 'Trabajo en clase · 5 publicaciones',
      },
      pie: ['Dejá Classroom al frente.', 'Podés cerrar este popup.'],
    });
    await flush();

    const titulo = root.querySelector('.loader-actual-titulo');
    expect(titulo.textContent.trim()).toBe('Curso 1 de 3 · Física II');

    const detalle = root.querySelector('.loader-actual-detalle');
    expect(detalle.textContent.trim()).toBe('Trabajo en clase · 5 publicaciones');

    const pie = root.querySelectorAll('.loader-detalle-pie');
    expect(pie).toHaveLength(2);
    expect(pie[0].textContent).toBe('Dejá Classroom al frente.');
    expect(pie[1].textContent).toBe('Podés cerrar este popup.');

    expect(root.querySelector('.loader-cursos')).toBeNull();
    expect(root.querySelector('.loader-contadores')).toBeNull();

    const escaneando = root.querySelector('.loader-escaneando');
    expect(escaneando).not.toBeNull();
    expect(escaneando.textContent.trim()).toBe('Escaneando…');
  });

  it('lista con íconos', async () => {
    const scrollMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollMock;

    puente.mostrar({
      cursos: [
        { nombre: 'Física II', marca: '✓', actual: false },
        { nombre: 'Química I', marca: '▸', actual: true },
        { nombre: 'Álgebra', marca: '·', actual: false },
      ],
    });
    await flush();

    const lis = root.querySelectorAll('li.loader-curso');
    expect(lis).toHaveLength(3);

    expect(lis[0].querySelector('.loader-marca-listo')).not.toBeNull();
    expect(lis[0].classList.contains('actual')).toBe(false);
    expect(lis[0].querySelector('svg')).not.toBeNull();
    expect(lis[0].querySelector('.loader-curso-nombre').textContent).toBe('Física II');

    expect(lis[1].querySelector('.loader-marca-actual')).not.toBeNull();
    expect(lis[1].classList.contains('actual')).toBe(true);
    expect(lis[1].querySelector('svg')).not.toBeNull();
    expect(lis[1].querySelector('.loader-curso-nombre').textContent).toBe('Química I');

    expect(lis[2].querySelector('.loader-marca-pendiente')).not.toBeNull();
    expect(lis[2].classList.contains('actual')).toBe(false);
    expect(lis[2].querySelector('svg')).not.toBeNull();
    expect(lis[2].querySelector('.loader-curso-nombre').textContent).toBe('Álgebra');

    expect(scrollMock).toHaveBeenCalled();
  });

  it('contadores', async () => {
    puente.mostrar({
      contadores: { listos: 3, vacios: 2, fallidos: 0 },
    });
    await flush();

    const contadores = root.querySelectorAll('.loader-contador');
    expect(contadores).toHaveLength(3);

    const etiquetas = root.querySelectorAll('.loader-contador-etiqueta');
    expect(etiquetas[0].textContent).toBe('Listos');
    expect(etiquetas[1].textContent).toBe('Vacíos');
    expect(etiquetas[2].textContent).toBe('Fallidos');

    const valores = root.querySelectorAll('.loader-contador-valor');
    expect(valores[0].textContent.trim()).toBe('3');
    expect(valores[1].textContent.trim()).toBe('2');
    expect(valores[2].textContent.trim()).toBe('0');
  });

  it('reloj y restante', async () => {
    vi.useFakeTimers();
    const t0 = 1000000;
    vi.setSystemTime(t0);

    puente.mostrar({
      desde: t0,
      restante: '≈ 1 min restante',
    });
    await vi.advanceTimersByTimeAsync(100);

    const reloj = () => root.querySelector('.loader-detalle-reloj');
    expect(reloj()).not.toBeNull();
    expect(reloj().textContent).toBe('0:00');

    const restante = root.querySelector('.loader-tiempo-restante');
    expect(restante).not.toBeNull();
    expect(restante.textContent.trim()).toBe('≈ 1 min restante');

    await vi.advanceTimersByTimeAsync(2000);
    expect(reloj().textContent).toBe('0:02');

    // Sin restante no debe haber .loader-tiempo-restante
    puente.mostrar({ desde: t0 });
    await vi.advanceTimersByTimeAsync(100);
    expect(root.querySelector('.loader-tiempo-restante')).toBeNull();
  });

  it('limpiar', async () => {
    puente.mostrar({
      actual: { posicion: 'Curso 1', nombre: 'Curso 1', detalle: 'Fase' },
      cursos: [{ nombre: 'Curso 1', marca: '▸', actual: true }],
      pie: ['Pie activo'],
      desde: Date.now(),
    });
    await flush();

    expect(root.querySelector('.loader-detalle')).not.toBeNull();

    puente.limpiar();
    await flush();

    expect(root.querySelector('.loader-detalle')).toBeNull();
    expect(root.innerHTML).toBe('');
  });

  it('L1: mostrar con habilitarCancelar pinta botón Cancelar y click invoca la función', async () => {
    const fn = vi.fn();
    puente.mostrar({ desde: 1 });
    puente.habilitarCancelar(fn);
    await flush();

    const btn = root.querySelector('.loader-escaneando button.loader-cancelar');
    expect(btn).not.toBeNull();
    expect(btn.textContent.trim()).toBe('Cancelar');
    expect(btn.disabled).toBe(false);

    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('L2: marcarCancelando deshabilita el botón, cambia texto y previene clicks posteriores', async () => {
    const fn = vi.fn();
    puente.mostrar({ desde: 1 });
    puente.habilitarCancelar(fn);
    await flush();

    const btn = root.querySelector('.loader-escaneando button.loader-cancelar');
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);

    puente.marcarCancelando();
    await flush();

    expect(btn.textContent.trim()).toBe('Cancelando…');
    expect(btn.disabled).toBe(true);

    btn.click();
    btn.click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('L3: sin habilitarCancelar no hay botón, mostrar(...) lo conserva y limpiar() lo quita', async () => {
    puente.mostrar({ desde: 1 });
    await flush();
    expect(root.querySelector('button.loader-cancelar')).toBeNull();

    const fn = vi.fn();
    puente.habilitarCancelar(fn);
    await flush();
    expect(root.querySelector('button.loader-cancelar')).not.toBeNull();

    puente.mostrar({ desde: 2 });
    await flush();
    expect(root.querySelector('button.loader-cancelar')).not.toBeNull();

    puente.limpiar();
    await flush();
    expect(root.querySelector('button.loader-cancelar')).toBeNull();
    expect(puente.getCancelar().onCancelar).toBeNull();
  });
});
