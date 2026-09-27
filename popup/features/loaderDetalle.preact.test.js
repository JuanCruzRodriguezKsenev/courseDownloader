// @vitest-environment jsdom
/**
 * Test de la isla Preact #6 (detalle del loader con progreso). Verifica:
 *  - Pinta líneas informativas y pie
 *  - Lista con marcas y clase actual
 *  - Reloj avanza con fake timers
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
    expect(puente.get()).toEqual({ lineas: [], cursos: [], pie: [], desde: null });
  });

  it('pinta líneas y pie correctamente', async () => {
    puente.mostrar({
      lineas: ['Curso 1 de 3: Física II', 'Trabajo en clase · 5 publicaciones'],
      pie: ['Dejá Classroom al frente.', 'Podés cerrar este popup.'],
    });
    await flush();

    const lineas = root.querySelectorAll('.loader-detalle-linea');
    expect(lineas).toHaveLength(2);
    expect(lineas[0].textContent).toBe('Curso 1 de 3: Física II');
    expect(lineas[1].textContent).toBe('Trabajo en clase · 5 publicaciones');

    const pie = root.querySelectorAll('.loader-detalle-pie');
    expect(pie).toHaveLength(2);
    expect(pie[0].textContent).toBe('Dejá Classroom al frente.');
    expect(pie[1].textContent).toBe('Podés cerrar este popup.');
  });

  it('pinta lista de cursos con marcas y resalta el actual con scrollIntoView', async () => {
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

    const lis = root.querySelectorAll('.loader-detalle-curso');
    expect(lis).toHaveLength(3);

    expect(lis[0].textContent).toContain('✓');
    expect(lis[0].textContent).toContain('Física II');
    expect(lis[0].classList.contains('actual')).toBe(false);

    expect(lis[1].textContent).toContain('▸');
    expect(lis[1].textContent).toContain('Química I');
    expect(lis[1].classList.contains('actual')).toBe(true);

    expect(lis[2].textContent).toContain('·');
    expect(lis[2].textContent).toContain('Álgebra');
    expect(lis[2].classList.contains('actual')).toBe(false);

    expect(scrollMock).toHaveBeenCalled();
  });

  it('reloj avanza de 0:00 a 0:02 con fake timers', async () => {
    vi.useFakeTimers();
    const t0 = 1000000;
    vi.setSystemTime(t0);

    puente.mostrar({
      desde: t0,
      lineas: ['Iniciando…'],
    });
    // Forzar montaje del efecto del reloj
    await vi.advanceTimersByTimeAsync(100);

    const reloj = () => root.querySelector('.loader-detalle-reloj');
    expect(reloj()).not.toBeNull();
    expect(reloj().textContent).toBe('0:00');

    // Avanzar 2 segundos más
    await vi.advanceTimersByTimeAsync(2000);

    expect(reloj().textContent).toBe('0:02');
  });

  it('limpiar deja el root completamente vacío', async () => {
    puente.mostrar({
      lineas: ['Línea activa'],
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
});
