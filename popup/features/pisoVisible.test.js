import { describe, it, expect, vi } from 'vitest';
import { crearPisoVisible, PISO_MS } from './pisoVisible.js';

/**
 * El reloj y el temporizador se inyectan en vez de usar `vi.useFakeTimers()` porque lo que se
 * está probando es una decisión de TIEMPO: qué se pinta y cuándo. Con un reloj propio, cada
 * test dice el instante exacto que quiere y las aserciones son sobre el orden de las
 * escrituras, no sobre cuántos ticks pasaron.
 */
function banco({ pisoMs = PISO_MS } = {}) {
  let t = 0;
  const pintado = [];
  const pendientes = [];

  const piso = crearPisoVisible({
    pisoMs,
    ahora: () => t,
    programar: (fn, ms) => {
      const tarea = { fn, corre: t + ms, viva: true };
      pendientes.push(tarea);
      return tarea;
    },
    cancelar: (tarea) => { if (tarea) tarea.viva = false; },
  });

  return {
    piso,
    pintado,
    escribir: (etiqueta) => () => pintado.push(etiqueta),
    /** Avanza el reloj y dispara lo que haya vencido, como haría el navegador. */
    avanzar(ms) {
      t += ms;
      pendientes
        .filter((tarea) => tarea.viva && tarea.corre <= t)
        .forEach((tarea) => { tarea.viva = false; tarea.fn(); });
    },
  };
}

describe('Piso visible — un cartel dura lo que tarda en leerse', () => {
  it('pinta el cartel transitorio en el acto: el piso es un mínimo, no una demora', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('trabajando'));
    expect(b.pintado).toEqual(['trabajando']);
  });

  it('retiene el estado que llega antes del mínimo, y lo suelta al cumplirse', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('sincronizando'));

    b.avanzar(117); // los 117 ms medidos del botón, que es el caso que motivó esto
    b.piso.libre(b.escribir('listo'));
    expect(b.pintado).toEqual(['sincronizando']); // todavía no: no se leyó

    b.avanzar(PISO_MS - 117);
    expect(b.pintado).toEqual(['sincronizando', 'listo']);
  });

  it('no demora nada si el piso ya venció', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('sincronizando'));
    b.avanzar(PISO_MS);

    b.piso.libre(b.escribir('listo'));
    expect(b.pintado).toEqual(['sincronizando', 'listo']);
  });

  it('un rótulo de estado sin piso vigente se pinta ya — el contador no se vuelve pegajoso', () => {
    const b = banco();
    b.piso.libre(b.escribir('20 clases'));
    b.piso.libre(b.escribir('21 clases'));
    b.piso.libre(b.escribir('22 clases'));
    expect(b.pintado).toEqual(['20 clases', '21 clases', '22 clases']);
  });

  it('coalesce: de tres cambios durante el piso sale sólo el último', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('escaneando'));

    b.piso.libre(b.escribir('viejo 1'));
    b.avanzar(100);
    b.piso.libre(b.escribir('viejo 2'));
    b.avanzar(100);
    b.piso.libre(b.escribir('el bueno'));

    b.avanzar(PISO_MS);
    expect(b.pintado).toEqual(['escaneando', 'el bueno']);
  });

  it('encadena dos transitorios: el segundo espera al primero y abre su propio piso', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('conectando'));

    b.avanzar(248); // los 248 ms medidos del loader
    b.piso.transitorio(b.escribir('escaneando'));
    expect(b.pintado).toEqual(['conectando']);

    b.avanzar(PISO_MS - 248);
    expect(b.pintado).toEqual(['conectando', 'escaneando']);

    // Y el segundo protege su propio mínimo, contado desde que salió él.
    b.piso.libre(b.escribir('listo'));
    expect(b.pintado).toEqual(['conectando', 'escaneando']);
    b.avanzar(PISO_MS);
    expect(b.pintado).toEqual(['conectando', 'escaneando', 'listo']);
  });

  it('`inmediato` atropella el piso y lo pendiente — la salida del onboarding', () => {
    const b = banco();
    b.piso.transitorio(b.escribir('conectando'));
    b.piso.libre(b.escribir('nunca'));

    b.piso.inmediato(b.escribir('apagado'));
    expect(b.pintado).toEqual(['conectando', 'apagado']);

    // Y no queda un temporizador vivo que repinte lo descartado más tarde.
    b.avanzar(PISO_MS * 2);
    expect(b.pintado).toEqual(['conectando', 'apagado']);
  });

  it('`sembrar` descuenta lo que el cartel del markup ya lleva en pantalla', () => {
    const b = banco();
    b.piso.sembrar(400); // el popup tardó 400 ms en cablearse

    b.piso.libre(b.escribir('listo'));
    expect(b.pintado).toEqual([]); // quedan 100, no 500

    b.avanzar(100);
    expect(b.pintado).toEqual(['listo']);
  });

  it('`sembrar` con el mínimo ya cumplido no demora nada', () => {
    const b = banco();
    b.piso.sembrar(PISO_MS + 1);

    b.piso.libre(b.escribir('listo'));
    expect(b.pintado).toEqual(['listo']);
  });

  // El caso real: `sincronizarFooterVacio()` medía el footer justo después de pedir la
  // escritura del botón. Con la escritura en cola medía el estado VIEJO, le ponía `.vacia` al
  // footer —que lo esconde entero— y la línea divisoria se iba hasta que la escritura aterrizaba.
  it('avisa si hay una escritura en cola, para el que lee el DOM justo después', () => {
    const b = banco();
    expect(b.piso.hayPendiente()).toBe(false);

    b.piso.transitorio(b.escribir('trabajando'));
    expect(b.piso.hayPendiente()).toBe(false); // se pintó ya: no hay nada esperando

    b.piso.libre(b.escribir('listo'));
    expect(b.piso.hayPendiente()).toBe(true);

    b.avanzar(PISO_MS);
    expect(b.piso.hayPendiente()).toBe(false);
  });

  it('no programa un segundo temporizador por cada escritura que llega durante el piso', () => {
    const programar = vi.fn(() => ({}));
    const piso = crearPisoVisible({ ahora: () => 0, programar, cancelar: () => {} });

    piso.transitorio(() => {});
    piso.libre(() => {});
    piso.libre(() => {});
    piso.libre(() => {});

    expect(programar).toHaveBeenCalledTimes(1);
  });
});
