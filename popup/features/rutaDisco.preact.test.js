// @vitest-environment jsdom
/**
 * Test de la isla Preact #1b (texto de la ruta del disco, 📁 PC:). Verifica:
 *  - render del valor inicial y de una ruta resuelta (texto + title)
 *  - el estado transitorio "cargando" (clase .loading-text, conserva el título)
 *  - reactividad: empujar al store puente re-renderiza la isla
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
// FASE 8: el puente dejó de ser `puente` y se importa. La API que este archivo
// afirma es la misma; lo que cambió es de dónde sale.
import puente from './rutaDisco.preact.js';
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

  it('expone el store global puente con su API', () => {
    expect(typeof puente.mostrar).toBe('function');
    expect(typeof puente.cargando).toBe('function');
    expect(typeof puente.get).toBe('function');
  });

  it('renderiza el valor inicial "Buscando servidor..."', () => {
    expect(span().textContent).toBe('Buscando servidor...');
    expect(span().getAttribute('title')).toBe('Buscando servidor...');
    expect(span().classList.contains('loading-text')).toBe(false);
  });

  it('mostrar(ruta) actualiza texto y title y apaga el spinner', async () => {
    puente.mostrar('C:/RamonNet/Clases');
    await flush();
    expect(span().textContent).toBe('C:/RamonNet/Clases');
    expect(span().getAttribute('title')).toBe('C:/RamonNet/Clases');
    expect(span().classList.contains('loading-text')).toBe(false);
  });

  it('mostrar(texto, titulo) permite un título distinto del texto', async () => {
    puente.mostrar('Desconectado', 'Servidor desconectado');
    await flush();
    expect(span().textContent).toBe('Desconectado');
    expect(span().getAttribute('title')).toBe('Servidor desconectado');
  });

  it('cargando(texto) muestra el spinner (.loading-text) y conserva el título previo', async () => {
    puente.mostrar('C:/RamonNet', 'C:/RamonNet');
    await flush();
    puente.cargando('Abriendo explorador...');
    await flush();
    expect(span().textContent).toBe('Abriendo explorador...');
    expect(span().classList.contains('loading-text')).toBe(true);
    expect(span().getAttribute('title')).toBe('C:/RamonNet'); // título previo conservado
  });

  it('get() devuelve el estado actual (para restaurar tras cancelar el explorador)', async () => {
    puente.mostrar('C:/Previa', 'C:/Previa');
    const previa = puente.get();
    puente.cargando('Abriendo explorador...');
    // El usuario cancela: se restaura lo guardado.
    puente.mostrar(previa.texto, previa.titulo);
    await flush();
    expect(span().textContent).toBe('C:/Previa');
    expect(span().classList.contains('loading-text')).toBe(false);
  });
});
