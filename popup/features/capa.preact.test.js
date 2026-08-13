// @vitest-environment jsdom
/**
 * Test del componente compartido `Capa` (features/capa.preact.js).
 *
 * Fija el CONTRATO que hasta ahora no existía en ningún lado: los cuatro flotantes del popup
 * (advertencia, faceta, onboarding, campanita) se escribieron cuatro veces y **ninguno** se
 * cerraba con Escape ni con clic afuera. Cada caso de acá es una de esas ausencias.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, html } from '../vendor/htm-preact-standalone.module.js';
import { Capa, abrirCapa } from './capa.preact.js';

const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16)); };

function montar(props = {}) {
  document.body.innerHTML = '<div id="c"></div>';
  const cont = document.getElementById('c');
  const onCerrar = vi.fn();
  render(
    html`<${Capa} abierto=${true} onCerrar=${onCerrar} etiqueta="Prueba" ...${props}>
      <button id="dentro">adentro</button>
    <//>`,
    cont
  );
  return { cont, onCerrar };
}

describe('Capa: qué se pinta', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('cerrada no pinta nada', () => {
    const { cont } = montar({ abierto: false });
    expect(cont.querySelector('.capa-card')).toBeNull();
    expect(cont.querySelector('.capa-overlay')).toBeNull();
  });

  it('la variante modal trae overlay y se anuncia como diálogo modal', () => {
    const { cont } = montar({ variante: 'modal' });
    expect(cont.querySelector('.capa-overlay')).not.toBeNull();
    const card = cont.querySelector('.capa-card');
    expect(card.classList.contains('es-modal')).toBe(true);
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    expect(card.getAttribute('aria-label')).toBe('Prueba');
  });

  it('la variante anclada NO trae overlay, y por eso no es modal para accesibilidad', () => {
    const { cont } = montar({ variante: 'anclado' });
    expect(cont.querySelector('.capa-overlay')).toBeNull();
    const card = cont.querySelector('.capa-card');
    expect(card.classList.contains('es-anclada')).toBe(true);
    // Anunciarla como `aria-modal="true"` sin tapar nada le mentiría a un lector de pantalla.
    expect(card.getAttribute('aria-modal')).toBe('false');
  });

  it('la clase del consumidor viaja junto a las del componente (medidas y posición)', () => {
    const { cont } = montar({ variante: 'anclado', clase: 'campanita-panel' });
    const card = cont.querySelector('.capa-card');
    expect(card.classList.contains('campanita-panel')).toBe(true);
    expect(card.classList.contains('es-anclada')).toBe(true);
  });
});

describe('Capa: cómo se cierra (lo que ninguno de los cuatro tenía)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('Escape cierra', async () => {
    const { onCerrar } = montar({ variante: 'modal' });
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('otra tecla no cierra', async () => {
    const { onCerrar } = montar({ variante: 'modal' });
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('cerrada, no escucha el teclado (el efecto se desmonta)', async () => {
    const { onCerrar } = montar({ variante: 'modal', abierto: false });
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('modal: el clic en el FONDO cierra', () => {
    const { cont, onCerrar } = montar({ variante: 'modal' });
    cont.querySelector('.capa-overlay').click();
    expect(onCerrar).toHaveBeenCalled();
  });

  it('modal: el clic ADENTRO no cierra (si no, se cierra mientras lo usás)', () => {
    const { cont, onCerrar } = montar({ variante: 'modal' });
    cont.querySelector('#dentro').click();
    expect(onCerrar).not.toHaveBeenCalled();
  });

  it('anclada: el clic afuera cierra', async () => {
    const { onCerrar } = montar({ variante: 'anclado' });
    await flush();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('anclada: el clic adentro de la card no cierra', async () => {
    const { cont, onCerrar } = montar({ variante: 'anclado' });
    await flush();
    cont.querySelector('#dentro').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCerrar).not.toHaveBeenCalled();
  });

  /**
   * El caso que obliga a que exista `contenedorRef`: el disparador (el 🔔) vive FUERA de la
   * card. Sin el ref, tocarlo cuenta como "afuera", así que se cierra por acá y el `onClick`
   * del botón lo vuelve a abrir — el panel no se cierra nunca y parece que el botón no anda.
   */
  it('anclada: con contenedorRef, el clic en el disparador NO cuenta como afuera', async () => {
    document.body.innerHTML = '<div id="wrap"><button id="trigger">🔔</button><div id="c"></div></div>';
    const wrap = document.getElementById('wrap');
    const onCerrar = vi.fn();
    render(
      html`<${Capa} variante="anclado" abierto=${true} onCerrar=${onCerrar}
                    etiqueta="P" contenedorRef=${{ current: wrap }}>
        <span>x</span>
      <//>`,
      document.getElementById('c')
    );
    await flush();

    document.getElementById('trigger').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCerrar).not.toHaveBeenCalled();

    // Y fuera del contenedor sí cierra, para que el ref no lo deje abierto para siempre.
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCerrar).toHaveBeenCalled();
  });

  it('anclada: el listener de clic se saca al cerrar', async () => {
    document.body.innerHTML = '<div id="c"></div>';
    const cont = document.getElementById('c');
    const onCerrar = vi.fn();
    render(html`<${Capa} variante="anclado" abierto=${true} onCerrar=${onCerrar} etiqueta="P"><i/><//>`, cont);
    await flush();
    render(html`<${Capa} variante="anclado" abierto=${false} onCerrar=${onCerrar} etiqueta="P"><i/><//>`, cont);
    await flush();

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onCerrar).not.toHaveBeenCalled();
  });
});

describe('abrirCapa: el puente imperativo (lo que usan popup.js y faceta.js)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('monta su propio root y lo saca del body al cerrar', () => {
    const cerrar = abrirCapa({ variante: 'modal', etiqueta: 'X', contenido: () => html`<p>hola</p>` });
    expect(document.querySelector('.capa-overlay')).not.toBeNull();
    expect(document.body.textContent).toContain('hola');

    cerrar();
    // No alcanza con que no se vea: el root no puede quedar colgando del body.
    expect(document.querySelector('.capa-overlay')).toBeNull();
    expect(document.body.children.length).toBe(0);
  });

  it('`contenido` recibe `cerrar`, para que un botón de adentro se cierre solo', () => {
    abrirCapa({
      variante: 'modal',
      etiqueta: 'X',
      contenido: (cerrar) => html`<button id="ok" onClick=${cerrar}>ok</button>`,
    });
    document.getElementById('ok').click();
    expect(document.querySelector('.capa-overlay')).toBeNull();
  });

  it('`alCerrar` corre una sola vez, cierre cómo cierre', () => {
    const alCerrar = vi.fn();
    const cerrar = abrirCapa({ variante: 'modal', etiqueta: 'X', alCerrar, contenido: () => html`<i/>` });
    cerrar();
    // La guarda de reentrada importa: "Entendido" cierra y su efecto puede volver a llamar acá.
    cerrar();
    expect(alCerrar).toHaveBeenCalledTimes(1);
  });

  it('el clic al fondo cierra y avisa por `alCerrar` (es el camino de "descartar")', () => {
    const alCerrar = vi.fn();
    abrirCapa({ variante: 'modal', etiqueta: 'X', alCerrar, contenido: () => html`<i/>` });
    document.querySelector('.capa-overlay').click();
    expect(alCerrar).toHaveBeenCalledTimes(1);
    expect(document.body.children.length).toBe(0);
  });

  it('las interpolaciones se escapan: no hay vía innerHTML (regla de security.md)', () => {
    const veneno = '<img src=x onerror="window.__xss=1">';
    abrirCapa({ variante: 'modal', etiqueta: 'X', contenido: () => html`<p>${veneno}</p>` });
    // Entra como TEXTO, no como markup: ni una etiqueta creada.
    expect(document.querySelector('.capa-card img')).toBeNull();
    expect(document.querySelector('.capa-card p').textContent).toBe(veneno);
  });
});

describe('Capa: el foco atrapado (sólo en la variante modal)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  function conTresBotones(props = {}) {
    document.body.innerHTML = '<button id="afuera">afuera</button><div id="c"></div>';
    const cont = document.getElementById('c');
    document.getElementById('afuera').focus();
    render(
      html`<${Capa} abierto=${true} onCerrar=${() => {}} etiqueta="P" ...${props}>
        <button id="a">a</button><button id="b">b</button><button id="c3">c</button>
      <//>`,
      cont
    );
    return cont;
  }

  const tab = (shift = false) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }));

  it('al abrir, el foco entra al primer enfocable del modal', async () => {
    conTresBotones({ variante: 'modal' });
    await flush();
    expect(document.activeElement.id).toBe('a');
  });

  it('Tab desde el ÚLTIMO vuelve al primero, en vez de irse a lo de abajo', async () => {
    conTresBotones({ variante: 'modal' });
    await flush();
    document.getElementById('c3').focus();
    tab();
    expect(document.activeElement.id).toBe('a');
  });

  it('Shift+Tab desde el PRIMERO va al último', async () => {
    conTresBotones({ variante: 'modal' });
    await flush();
    document.getElementById('a').focus();
    tab(true);
    expect(document.activeElement.id).toBe('c3');
  });

  it('si el foco se escapó afuera, el próximo Tab lo trae de vuelta', async () => {
    conTresBotones({ variante: 'modal' });
    await flush();
    document.getElementById('afuera').focus();
    tab();
    expect(document.activeElement.id).toBe('a');
  });

  it('ignora lo que esté dentro de un [inert] (las slides ocultas del tour)', async () => {
    document.body.innerHTML = '<div id="c"></div>';
    render(
      html`<${Capa} variante="modal" abierto=${true} onCerrar=${() => {}} etiqueta="P">
        <div inert><button id="oculto">no</button></div>
        <button id="visible">sí</button>
      <//>`,
      document.getElementById('c')
    );
    await flush();
    expect(document.activeElement.id).toBe('visible');
  });

  it('al cerrar devuelve el foco a quien lo tenía', async () => {
    const cont = conTresBotones({ variante: 'modal' });
    await flush();
    expect(document.activeElement.id).toBe('a');

    render(html`<${Capa} variante="modal" abierto=${false} onCerrar=${() => {}} etiqueta="P"><i/><//>`, cont);
    await flush();
    expect(document.activeElement.id).toBe('afuera');
  });

  it('la variante ANCLADA no atrapa: no tapa nada, salir con Tab es legítimo', async () => {
    conTresBotones({ variante: 'anclado' });
    await flush();
    // Ni siquiera se roba el foco al abrir.
    expect(document.activeElement.id).toBe('afuera');
    tab();
    expect(document.activeElement.id).toBe('afuera');
  });
});
