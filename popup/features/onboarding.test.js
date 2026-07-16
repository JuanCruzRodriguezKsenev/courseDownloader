// @vitest-environment jsdom
/**
 * Smoke/behavior test del módulo extraído popup/features/onboarding.js.
 * Verifica que la feature se puede instanciar y operar de forma aislada
 * (uno de los objetivos del split, ver docs/adr/0005-feature-driven-popup-split.md).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OnboardingFeature from './onboarding.js';

// AppState global que el módulo toca al cerrar el tour.
globalThis.AppState = { tutorialCompletado: false, respaldar: vi.fn() };

function montarDOM() {
  document.body.innerHTML = `
    <button id="ui-btn-help"></button>
    <div id="ui-onboarding" style="display:none">
      <div id="ui-onboarding-slides"></div>
      <button id="ui-onboarding-prev"></button>
      <button id="ui-onboarding-next"></button>
      <button id="ui-onboarding-skip"></button>
      <div id="ui-onboarding-dots">
        <span class="onboarding-dot"></span>
        <span class="onboarding-dot"></span>
        <span class="onboarding-dot"></span>
        <span class="onboarding-dot"></span>
        <span class="onboarding-dot"></span>
        <span class="onboarding-dot"></span>
      </div>
    </div>
    <div id="ui-onboarding-server-status" class="onboarding-server-msg error"></div>
    <button id="ui-onboarding-explore" disabled></button>
  `;
  return {
    btnHelp: document.getElementById('ui-btn-help'),
    onboarding: document.getElementById('ui-onboarding'),
    onboardingSlides: document.getElementById('ui-onboarding-slides'),
    onboardingPrev: document.getElementById('ui-onboarding-prev'),
    onboardingNext: document.getElementById('ui-onboarding-next'),
    onboardingSkip: document.getElementById('ui-onboarding-skip'),
    onboardingDots: document.getElementById('ui-onboarding-dots'),
  };
}

describe('OnboardingFeature.crear', () => {
  let nodos, onExplore, api;

  beforeEach(() => {
    globalThis.AppState.tutorialCompletado = false;
    globalThis.AppState.respaldar.mockClear();
    nodos = montarDOM();
    onExplore = vi.fn();
    api = OnboardingFeature.crear({ nodos, onExplore });
  });

  it('expone las dos funciones cruzadas que el orquestador necesita', () => {
    expect(typeof api.mostrarOnboarding).toBe('function');
    expect(typeof api.actualizarEstadoServidorOnboarding).toBe('function');
  });

  it('mostrarOnboarding muestra el overlay y marca el primer dot como activo', () => {
    api.mostrarOnboarding();
    expect(nodos.onboarding.style.display).toBe('flex');
    const dots = nodos.onboardingDots.querySelectorAll('.onboarding-dot');
    expect(dots[0].classList.contains('active')).toBe(true);
    expect(nodos.onboardingPrev.disabled).toBe(true);
  });

  it('avanzar hasta el último slide cambia el botón a "Comenzar" y cerrar persiste el tutorial', () => {
    api.mostrarOnboarding();
    for (let i = 0; i < 5; i++) nodos.onboardingNext.click();
    expect(nodos.onboardingNext.textContent).toBe('Comenzar');
    nodos.onboardingNext.click(); // cierra
    expect(nodos.onboarding.style.display).toBe('none');
    expect(globalThis.AppState.tutorialCompletado).toBe(true);
    expect(globalThis.AppState.respaldar).toHaveBeenCalled();
  });

  it('actualizarEstadoServidorOnboarding(true) habilita el botón de carpeta', () => {
    api.actualizarEstadoServidorOnboarding(true);
    const status = document.getElementById('ui-onboarding-server-status');
    const explore = document.getElementById('ui-onboarding-explore');
    expect(status.className).toContain('success');
    expect(explore.disabled).toBe(false);
  });

  it('actualizarEstadoServidorOnboarding(false) deshabilita el botón de carpeta', () => {
    api.actualizarEstadoServidorOnboarding(false);
    const explore = document.getElementById('ui-onboarding-explore');
    expect(explore.disabled).toBe(true);
    expect(document.getElementById('ui-onboarding-server-status').className).toContain('error');
  });

  it('el botón de ayuda reabre el tour', () => {
    nodos.btnHelp.click();
    expect(nodos.onboarding.style.display).toBe('flex');
  });

  it('el botón "Seleccionar Carpeta" del tour dispara el callback onExplore', () => {
    // El botón arranca disabled (un botón disabled no dispara click, igual que en
    // el browser); se habilita cuando el servidor está online.
    api.actualizarEstadoServidorOnboarding(true);
    document.getElementById('ui-onboarding-explore').click();
    expect(onExplore).toHaveBeenCalledTimes(1);
  });
});
