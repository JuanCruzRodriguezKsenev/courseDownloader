// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import Bloqueo from './bloqueo.js';

/**
 * Lo que fija este archivo es el CONTRATO del §2 de alertas-y-bloqueo-diseno.md, que hasta
 * ahora vivía copiado en tres funciones de popup.js —o sea, en el único archivo que la suite
 * no puede ver—. Cada caso de acá corresponde a un defecto real que el proyecto ya pagó.
 */
describe('Bloqueo: las dos formas del contrato', () => {
  let boton, input, span, region;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="region">
        <button id="b">x</button>
        <input id="i" type="text">
        <span id="s">badge</span>
      </div>`;
    region = document.getElementById('region');
    boton = document.getElementById('b');
    input = document.getElementById('i');
    span = document.getElementById('s');
  });

  it('a un control de formulario le pone `disabled`, no `aria-disabled`', () => {
    Bloqueo.aplicar(true, { elementos: [boton, input] });
    expect(boton.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    // `aria-disabled` sobre algo que admite `disabled` sería ruido: el atributo nativo ya lo
    // comunica a accesibilidad.
    expect(boton.hasAttribute('aria-disabled')).toBe(false);
  });

  it('a lo que NO es control le pone `aria-disabled` (no admite `disabled`)', () => {
    Bloqueo.aplicar(true, { elementos: [span] });
    expect(span.getAttribute('aria-disabled')).toBe('true');
    expect(span.disabled).toBeUndefined();
  });

  it('elige la forma por elemento, mezclados en la misma llamada', () => {
    Bloqueo.aplicar(true, { elementos: [boton, span, input] });
    expect(boton.disabled).toBe(true);
    expect(input.disabled).toBe(true);
    expect(span.getAttribute('aria-disabled')).toBe('true');
  });

  it('marca las regiones con `.bloqueada` y las desmarca al liberar', () => {
    Bloqueo.aplicar(true, { regiones: [region] });
    expect(region.classList.contains('bloqueada')).toBe(true);
    Bloqueo.aplicar(false, { regiones: [region] });
    expect(region.classList.contains('bloqueada')).toBe(false);
  });

  it('ignora los nulos de la lista sin romperse', () => {
    // Los call-sites arman arrays con `nodos.*` que pueden no existir según la pestaña.
    expect(() => Bloqueo.aplicar(true, { regiones: [null], elementos: [null, undefined, boton] }))
      .not.toThrow();
    expect(boton.disabled).toBe(true);
  });
});

describe('Bloqueo: la asimetría (liberar NO es habilitar todo)', () => {
  let boton, span;

  beforeEach(() => {
    document.body.innerHTML = '<button id="b">x</button><span id="s">y</span>';
    boton = document.getElementById('b');
    span = document.getElementById('s');
  });

  it('liberar NUNCA escribe `disabled = false` por su cuenta', () => {
    // Éste es el corazón del módulo. Si liberar habilitara a ciegas, se encendería el buscador
    // sin lista o "Todos" sin sincronizar el disco — y el bug aparece lejos de acá.
    boton.disabled = true;
    Bloqueo.aplicar(false, { elementos: [boton] });
    expect(boton.disabled).toBe(true);
  });

  it('sólo el `restaurar` de quien llama puede volver a habilitar', () => {
    boton.disabled = true;
    Bloqueo.aplicar(false, {
      elementos: [boton],
      restaurar: () => { boton.disabled = false; },
    });
    expect(boton.disabled).toBe(false);
  });

  it('el `restaurar` NO corre al bloquear', () => {
    let corrio = false;
    Bloqueo.aplicar(true, { elementos: [boton], restaurar: () => { corrio = true; } });
    expect(corrio).toBe(false);
  });

  it('`aria-disabled` sí es simétrico: es un marcador, no una capacidad', () => {
    Bloqueo.aplicar(true, { elementos: [span] });
    expect(span.getAttribute('aria-disabled')).toBe('true');
    Bloqueo.aplicar(false, { elementos: [span] });
    expect(span.getAttribute('aria-disabled')).toBe('false');
  });

  it('sin `restaurar`, liberar deja los controles como estaban (y es correcto)', () => {
    boton.disabled = true;
    expect(() => Bloqueo.aplicar(false, { elementos: [boton] })).not.toThrow();
    expect(boton.disabled).toBe(true);
  });
});
