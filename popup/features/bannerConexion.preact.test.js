// @vitest-environment jsdom
/**
 * Test de la isla Preact #2 (banner de conexión caída). Verifica:
 *  - oculta por defecto; mostrar(tipo) pinta la .server-error-card correcta
 *  - el contenido cambia según el tipo (servidor / internet)
 *  - ocultar() la saca; cambiar de tipo re-renderiza
 *  - el store global window.BannerConexion expone la API que empuja serverConnection
 * Los useEffect de Preact se agendan vía rAF → se flushean esperando varios ciclos.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { montar, __resetStore } from './bannerConexion.preact.js';

async function flush() {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 16));
}

describe('Isla Preact: BannerConexion', () => {
  let root;

  beforeEach(async () => {
    __resetStore();
    document.body.innerHTML = '<div id="root"></div>';
    root = document.getElementById('root');
    montar(root);
    await flush();
  });

  function card() { return root.querySelector('.server-error-card'); }

  it('expone el store global window.BannerConexion con su API', () => {
    expect(typeof window.BannerConexion.mostrar).toBe('function');
    expect(typeof window.BannerConexion.ocultar).toBe('function');
    expect(typeof window.BannerConexion.get).toBe('function');
  });

  it('arranca oculto (sin card)', () => {
    expect(card()).toBeNull();
    expect(window.BannerConexion.get()).toEqual({ visible: false, tipo: null });
  });

  it('mostrar("servidor") pinta la card de servidor con su contenido', async () => {
    window.BannerConexion.mostrar('servidor');
    await flush();
    expect(card()).not.toBeNull();
    expect(card().dataset.tipo).toBe('servidor');
    expect(card().querySelector('.server-error-icon').textContent).toBe('🔌');
    expect(card().querySelector('h5').textContent).toBe('Servidor Desconectado');
    // El cuerpo lleva HTML intencional (<strong>iniciar.bat</strong>) vía dangerouslySetInnerHTML.
    expect(card().querySelector('p strong')).not.toBeNull();
  });

  it('mostrar("internet") pinta la card de internet', async () => {
    window.BannerConexion.mostrar('internet');
    await flush();
    expect(card().dataset.tipo).toBe('internet');
    expect(card().querySelector('.server-error-icon').textContent).toBe('🌐');
    expect(card().querySelector('h5').textContent).toBe('Sin conexión a internet');
  });

  it('ocultar() saca la card', async () => {
    window.BannerConexion.mostrar('servidor');
    await flush();
    expect(card()).not.toBeNull();
    window.BannerConexion.ocultar();
    await flush();
    expect(card()).toBeNull();
  });

  it('cambiar de tipo re-renderiza la card (servidor -> internet)', async () => {
    window.BannerConexion.mostrar('servidor');
    await flush();
    window.BannerConexion.mostrar('internet');
    await flush();
    expect(root.querySelectorAll('.server-error-card').length).toBe(1);
    expect(card().dataset.tipo).toBe('internet');
  });
});
