// @vitest-environment jsdom
/**
 * Test de la isla Preact #1b (texto de la ruta del disco, 📁 PC:). Verifica:
 *  - render del valor inicial y de una ruta resuelta (texto + title)
 *  - el estado transitorio "cargando" (clase .loading-text, conserva el título)
 *  - reactividad: empujar al store window.RutaDisco re-renderiza la isla
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { montar, __resetStore } from './rutaDisco.preact.js';

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16));
}

describe('Isla Preact: PcPath (ruta del disco)', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  function span() { return root.querySelector('.pc-path-text'); }

  it('expone el store global window.RutaDisco con su API', () => {
    expect(typeof window.RutaDisco.mostrar).toBe('function');
    expect(typeof window.RutaDisco.cargando).toBe('function');
    expect(typeof window.RutaDisco.get).toBe('function');
  });

  it('renderiza el valor inicial "Buscando servidor..."', () => {
    expect(span().textContent).toBe('Buscando servidor...');
    expect(span().getAttribute('title')).toBe('Buscando servidor...');
    expect(span().classList.contains('loading-text')).toBe(false);
  });

  it('mostrar(ruta) actualiza texto y title y apaga el spinner', async () => {
    window.RutaDisco.mostrar('C:/RamonNet/Clases');
    await flush();
    expect(span().textContent).toBe('C:/RamonNet/Clases');
    expect(span().getAttribute('title')).toBe('C:/RamonNet/Clases');
    expect(span().classList.contains('loading-text')).toBe(false);
  });

  it('mostrar(texto, titulo) permite un título distinto del texto', async () => {
    window.RutaDisco.mostrar('Desconectado', 'Servidor desconectado');
    await flush();
    expect(span().textContent).toBe('Desconectado');
    expect(span().getAttribute('title')).toBe('Servidor desconectado');
  });

  it('cargando(texto) muestra el spinner (.loading-text) y conserva el título previo', async () => {
    window.RutaDisco.mostrar('C:/RamonNet', 'C:/RamonNet');
    await flush();
    window.RutaDisco.cargando('Abriendo explorador...');
    await flush();
    expect(span().textContent).toBe('Abriendo explorador...');
    expect(span().classList.contains('loading-text')).toBe(true);
    expect(span().getAttribute('title')).toBe('C:/RamonNet'); // título previo conservado
  });

  it('get() devuelve el estado actual (para restaurar tras cancelar el explorador)', async () => {
    window.RutaDisco.mostrar('C:/Previa', 'C:/Previa');
    const previa = window.RutaDisco.get();
    window.RutaDisco.cargando('Abriendo explorador...');
    // El usuario cancela: se restaura lo guardado.
    window.RutaDisco.mostrar(previa.texto, previa.titulo);
    await flush();
    expect(span().textContent).toBe('C:/Previa');
    expect(span().classList.contains('loading-text')).toBe(false);
  });
});
