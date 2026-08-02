// @vitest-environment jsdom
/**
 * Test de la isla Preact #5 (features/campanita.preact.js): la campanita de fallos.
 * Verifica el badge de no-leídos, el toggle del panel, el render como TEXTO (anti-XSS)
 * de título/motivo, las acciones marcar-leídas/limpiar, y el re-render ante un cambio
 * externo (un fallo llegado del SW con el popup abierto).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, html } from '../vendor/htm-preact-standalone.module.js';
import { Campanita } from './campanita.preact.js';

// HistorialFallos falso: lista mutable + suscripción con _emit; los mutadores espejan
// el comportamiento real (mutan y avisan, para que el hook vuelva a pedir obtener()).
function mockHistorial(inicial = []) {
  let lista = inicial;
  let cb = null;
  return {
    get _lista() { return lista; },
    obtener: async () => lista,
    suscribir(fn) { cb = fn; return () => { cb = null; }; },
    async marcarTodosLeidos() { lista = lista.map((f) => ({ ...f, leido: true })); if (cb) cb(); },
    async limpiar() { lista = []; if (cb) cb(); },
    // Simula un fallo nuevo empujado por el SW (o cualquier cambio de storage).
    _push(entrada) { lista = [entrada, ...lista]; if (cb) cb(); },
  };
}

// Preact agenda los useEffect vía rAF; flush espera varios ciclos para que corran.
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16)); };

function entrada(over = {}) {
  return { id: `id-${Math.random()}`, tipo: 'rechazo', titulo: 'Clase 1', motivo: 'motivo x', ts: Date.now(), leido: false, ...over };
}

describe('Isla Preact: Campanita', () => {
  let cont;
  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    cont = document.getElementById('c');
  });

  it('el badge muestra la cantidad de no-leídos', async () => {
    window.HistorialFallos = mockHistorial([entrada(), entrada({ leido: true }), entrada()]);
    render(html`<${Campanita} />`, cont);
    await flush();
    expect(cont.querySelector('.campanita-badge').textContent).toBe('2');
  });

  it('el badge está oculto cuando no hay no-leídos', async () => {
    window.HistorialFallos = mockHistorial([entrada({ leido: true })]);
    render(html`<${Campanita} />`, cont);
    await flush();
    expect(cont.querySelector('.campanita-badge')).toBeNull();
  });

  it('el panel está cerrado hasta clickear la campanita, y el click lo togglea', async () => {
    window.HistorialFallos = mockHistorial([entrada()]);
    render(html`<${Campanita} />`, cont);
    await flush();
    expect(cont.querySelector('.campanita-panel')).toBeNull();

    cont.querySelector('.campanita-btn').click();
    await flush();
    expect(cont.querySelector('.campanita-panel')).not.toBeNull();

    cont.querySelector('.campanita-btn').click();
    await flush();
    expect(cont.querySelector('.campanita-panel')).toBeNull();
  });

  it('el panel lista las entradas en el orden recibido', async () => {
    window.HistorialFallos = mockHistorial([
      entrada({ titulo: 'Primera' }),
      entrada({ titulo: 'Segunda' }),
    ]);
    render(html`<${Campanita} />`, cont);
    await flush();
    cont.querySelector('.campanita-btn').click();
    await flush();
    const titulos = [...cont.querySelectorAll('.campanita-titulo')].map((n) => n.textContent);
    expect(titulos).toEqual(['Primera', 'Segunda']);
  });

  it('título/motivo se renderizan como TEXTO, no como HTML (anti-XSS)', async () => {
    window.HistorialFallos = mockHistorial([
      entrada({ titulo: '<img src=x onerror=alert(1)>', motivo: '<b>hola</b>' }),
    ]);
    render(html`<${Campanita} />`, cont);
    await flush();
    cont.querySelector('.campanita-btn').click();
    await flush();

    const tit = cont.querySelector('.campanita-titulo');
    const mot = cont.querySelector('.campanita-motivo');
    // El markup aparece literal en el texto, sin crear nodos hijos (ni <img> ni <b>).
    expect(tit.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(tit.querySelector('img')).toBeNull();
    expect(mot.textContent).toBe('<b>hola</b>');
    expect(mot.querySelector('b')).toBeNull();
  });

  it('"Marcar leídas" baja el badge a 0', async () => {
    window.HistorialFallos = mockHistorial([entrada(), entrada()]);
    render(html`<${Campanita} />`, cont);
    await flush();
    cont.querySelector('.campanita-btn').click();
    await flush();

    [...cont.querySelectorAll('.campanita-accion')].find((b) => b.textContent === 'Marcar leídas').click();
    await flush();
    expect(cont.querySelector('.campanita-badge')).toBeNull();
  });

  it('"Limpiar" deja el panel en estado vacío', async () => {
    window.HistorialFallos = mockHistorial([entrada()]);
    render(html`<${Campanita} />`, cont);
    await flush();
    cont.querySelector('.campanita-btn').click();
    await flush();

    [...cont.querySelectorAll('.campanita-accion')].find((b) => b.textContent === 'Limpiar').click();
    await flush();
    expect(cont.querySelector('.campanita-vacio')).not.toBeNull();
    expect(cont.querySelector('.campanita-fila')).toBeNull();
  });

  it('se re-renderiza ante un fallo nuevo empujado externamente (SW, popup abierto)', async () => {
    const hist = mockHistorial([]);
    window.HistorialFallos = hist;
    render(html`<${Campanita} />`, cont);
    await flush();
    expect(cont.querySelector('.campanita-badge')).toBeNull();

    hist._push(entrada({ titulo: 'Nueva' }));
    await flush();
    expect(cont.querySelector('.campanita-badge').textContent).toBe('1');
  });
});
