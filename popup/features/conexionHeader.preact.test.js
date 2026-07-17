// @vitest-environment jsdom
/**
 * Test de la isla Preact #1 (features/conexionHeader.preact.js): el puntito de estado.
 * Demuestra que un componente Preact se testea aislado, con un Conexion falso, y que
 * el re-render es automático ante un cambio del daemon (lo que en vanilla era el bug
 * de "cambié el estado pero no re-rendericé").
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, html } from '../vendor/htm-preact-standalone.module.js';
import { StatusDot } from './conexionHeader.preact.js';

// Conexion falso: get() devuelve el estado; suscribir() guarda el callback; _emit lo dispara.
function mockConexion(estado) {
  let cb = null;
  return {
    get: () => estado,
    suscribir(fn) { cb = fn; return () => { cb = null; }; },
    _emit(parcial) { Object.assign(estado, parcial); if (cb) cb(); },
  };
}

// Preact agenda los useEffect vía requestAnimationFrame; flush espera varios ciclos
// (rAF ~16ms) para que corran la suscripción y el re-render.
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 16)); };

describe('Isla Preact: StatusDot', () => {
  let cont;
  beforeEach(() => {
    document.body.innerHTML = '<div id="c"></div>';
    cont = document.getElementById('c');
  });

  it('renderiza OFFLINE cuando falta el servidor', () => {
    window.Conexion = mockConexion({ servidor: false, internet: true, completa: false });
    render(html`<${StatusDot} />`, cont);
    expect(cont.querySelector('.status-dot').className).toContain('offline');
  });

  it('renderiza ONLINE cuando la conexión está completa', () => {
    window.Conexion = mockConexion({ servidor: true, internet: true, completa: true });
    render(html`<${StatusDot} />`, cont);
    expect(cont.querySelector('.status-dot').className).toContain('online');
  });

  it('se re-renderiza SOLO al notificar el daemon (sin tocar el DOM a mano)', async () => {
    const cx = mockConexion({ servidor: true, internet: true, completa: true });
    window.Conexion = cx;
    render(html`<${StatusDot} />`, cont);
    await flush(); // deja que corra el useEffect (la suscripción)
    expect(cont.querySelector('.status-dot').className).toContain('online');

    cx._emit({ servidor: false, completa: false }); // el server cae
    await flush(); // deja que corra el re-render
    expect(cont.querySelector('.status-dot').className).toContain('offline');
  });
});
