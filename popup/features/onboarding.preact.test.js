// @vitest-environment jsdom
/**
 * Test de la isla Preact #3 (onboarding). Verifica:
 *  - render según estado del store (visible/carrusel/dots/nav)
 *  - el estado del servidor del slide 5 DERIVA del daemon Conexion (reactivo)
 *  - el puente crear(ctx): mostrarOnboarding, botón de ayuda, onExplore, onComplete
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// FASE 8: el puente dejó de ser `OnboardingFeature` y se importa.
import OnboardingFeature from './onboarding.preact.js';
import { montar, __resetStore } from './onboarding.preact.js';
import { SitioActivo } from '../../sitio/ramonnet/config.ts';

// Daemon Conexion falso: get() devuelve el estado actual; emit() lo cambia y notifica.
function fakeConexion(inicial = { servidor: false, internet: true }) {
  let estado = { ...inicial, completa: inicial.servidor && inicial.internet };
  const subs = new Set();
  return {
    get: () => estado,
    suscribir: (cb) => { subs.add(cb); return () => subs.delete(cb); },
    emit(nuevo) {
      estado = { ...nuevo, completa: nuevo.servidor && nuevo.internet };
      subs.forEach((cb) => cb());
    },
  };
}

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16));
}

describe('Isla Preact: Onboarding', () => {
  let root, conexion;

  beforeEach(async () => {
    __resetStore(); // limpia estado + suscriptores fugados del test anterior.
    document.body.innerHTML = '<div id="root"></div><button id="help"></button>';
    root = document.getElementById('root');
    conexion = fakeConexion({ servidor: false, internet: true });
    globalThis.window.Conexion = conexion;
    globalThis.window.AppState = { tutorialCompletado: false, respaldar: vi.fn() };
    // El slide "Página Correcta" linkea a la URL que declara el adaptador de sitio.
    globalThis.window.SitioActivo = SitioActivo;
    // FASE 7C: las dependencias entran por el montaje, no por window.* (que el harness
    // sigue sembrando arriba para no cambiar la forma de los dobles).
    montar(root, { conexion, appState: window.AppState, sitio: window.SitioActivo });
    await flush(); // deja correr el useEffect que suscribe al store ANTES de operar.
  });

  function crear(over = {}) {
    return OnboardingFeature.crear({
      btnHelp: document.getElementById('help'),
      onExplore: over.onExplore || vi.fn(),
      onComplete: over.onComplete || vi.fn(),
    });
  }

  // Fase 6c: el onboarding era la ÚNICA parte de la UI que nombraba a Ramón Net. Ahora el
  // copy sale de `PuertoSitio`, así que sumar un portal es cambiar el descriptor y no tocar
  // el componente. Lo que afirma este test —que el copy es del descriptor y no está
  // hardcodeado— no cambió; sí cambió CÓMO se le entrega: desde la Fase 7c el descriptor
  // entra al montar la isla, no se lee de `window.SitioActivo` en cada render. Por eso acá
  // se re-monta con el portal falso en vez de reasignar el global.
  it('el copy nombra al portal y a su faceta desde el descriptor, no hardcodeados', async () => {
    montar(root, {
      conexion,
      appState: window.AppState,
      sitio: {
        nombre: 'Portal Falso',
        urlListado: 'https://falso.test/listado',
        faceta: { etiqueta: 'Comisión' },
      },
    });
    const api = crear();
    api.mostrarOnboarding();
    await flush();

    const texto = root.textContent;
    expect(texto).toContain('Portal Falso');
    expect(texto).not.toContain('Ramón Net');
    expect(texto).toContain('comisión'); // la etiqueta de la faceta, en minúscula
    expect(root.querySelector('.onboarding-link').getAttribute('href')).toBe('https://falso.test/listado');
  });

  it('el puente expone mostrarOnboarding y arranca oculto', async () => {
    const api = crear();
    await flush();
    expect(typeof api.mostrarOnboarding).toBe('function');
    expect(root.querySelector('.onboarding-overlay')).toBeNull();
  });

  it('mostrarOnboarding muestra el overlay, primer dot activo y "Atrás" deshabilitado', async () => {
    const api = crear();
    api.mostrarOnboarding();
    await flush();
    expect(root.querySelector('.onboarding-overlay')).not.toBeNull();
    const dots = root.querySelectorAll('.onboarding-dot');
    expect(dots.length).toBe(6);
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(root.querySelector('.btn-onboarding-nav').disabled).toBe(true); // "Atrás"
  });

  it('avanzar hasta el último slide cambia el botón a "Comenzar" y cerrar persiste + oculta', async () => {
    const api = crear();
    api.mostrarOnboarding();
    await flush();
    const next = () => root.querySelectorAll('.btn-onboarding-nav')[1];
    for (let i = 0; i < 5; i++) { next().click(); await flush(); }
    expect(next().textContent).toBe('Comenzar');
    next().click(); // cierra
    await flush();
    expect(window.AppState.tutorialCompletado).toBe(true);
    expect(window.AppState.respaldar).toHaveBeenCalled();
    expect(root.querySelector('.onboarding-overlay')).toBeNull();
  });

  it('el estado del servidor del slide se DERIVA del daemon (offline → error + botón disabled)', async () => {
    const api = crear();
    api.mostrarOnboarding();
    await flush();
    const msg = root.querySelector('.onboarding-server-msg');
    expect(msg.classList.contains('error')).toBe(true);
    expect(root.querySelector('.btn-adv-primary').disabled).toBe(true);
  });

  it('al reportar el daemon el server OK, el slide reacciona (success + botón habilitado)', async () => {
    const api = crear();
    api.mostrarOnboarding();
    await flush();
    conexion.emit({ servidor: true, internet: true });
    await flush();
    const msg = root.querySelector('.onboarding-server-msg');
    expect(msg.classList.contains('success')).toBe(true);
    expect(root.querySelector('.btn-adv-primary').disabled).toBe(false);
  });

  it('el botón "Seleccionar Carpeta" (habilitado) dispara onExplore', async () => {
    const onExplore = vi.fn();
    const api = crear({ onExplore });
    api.mostrarOnboarding();
    conexion.emit({ servidor: true, internet: true }); // habilita el botón
    await flush();
    root.querySelector('.btn-adv-primary').click();
    expect(onExplore).toHaveBeenCalledTimes(1);
  });

  it('cerrar el tour de la primera vez dispara onComplete', async () => {
    const onComplete = vi.fn();
    const api = crear({ onComplete });
    api.mostrarOnboarding(); // no forzado
    await flush();
    root.querySelector('.onboarding-skip-btn').click(); // cierra (Saltar)
    await flush();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('el botón de ayuda reabre el tour (forzado) y cerrar NO dispara onComplete', async () => {
    const onComplete = vi.fn();
    crear({ onComplete });
    document.getElementById('help').click(); // mostrarOnboarding(true)
    await flush();
    expect(root.querySelector('.onboarding-overlay')).not.toBeNull();
    root.querySelector('.onboarding-skip-btn').click(); // cierra
    await flush();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
