// @vitest-environment jsdom
/**
 * Tests del scraper de Anatomy by Chris — **contra el HTML REAL del portal**.
 *
 * El fixture (`__fixtures__/listado-modulo.html`, 11 KB) se recortó de las tres páginas que el
 * dueño guardó del club: se conservaron la cabecera del módulo activo, su sección, las filas
 * tal cual vinieron (una de VIDEO y dos de TEXTO), la flecha de navegación y el `<aside>` de
 * Perfil; se vaciaron los `d=` de los `<path>` de los íconos, que eran casi todo el peso.
 *
 * **Por qué contra el HTML real y no contra un DOM escrito a mano**: las cuatro trampas de este
 * portal —el `innerText` envenenado, las flechas que parecen clases, las filas de texto sin
 * video y el `<aside>` de Perfil que gana un `querySelector('aside')`— son exactamente lo que
 * un doble escrito por quien escribió el scraper NO reproduciría. Un fixture inventado
 * pasaría estos tests con un scraper roto.
 *
 * Lo que estos tests NO pueden ver, y por eso el navegador sigue siendo obligatorio: que la
 * función sea **serializable y autocontenida**. Acá corre importada, con su módulo entero
 * disponible; en producción la serializa `chrome.scripting.executeScript` y cualquier
 * referencia a algo de afuera revienta recién ahí.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ScraperAnatomy from './scraper.js';

const aquí = dirname(fileURLToPath(import.meta.url));
const htmlCompleto = readFileSync(join(aquí, '__fixtures__', 'listado-modulo.html'), 'utf8');
const cuerpo = /<body[^>]*>([\s\S]*)<\/body>/i.exec(htmlCompleto)[1];

function escanear() {
  return ScraperAnatomy.escanearListadoDelModulo();
}

beforeEach(() => {
  document.body.innerHTML = cuerpo;
  window.localStorage.clear();
});

describe('escanearListadoDelModulo — la materia', () => {
  it('sale del módulo EXPANDIDO del sidebar, no del <h1>', () => {
    // El <h1> del fixture dice "Generalidades de Anatomia" igual que el módulo, pero en el
    // portal real es el título de la CLASE: leerlo mandaría cada clase a su propia carpeta.
    // Lo que se afirma acá es de dónde sale, y eso se ve en el test de abajo.
    expect(escanear().materia).toBe('generalidades_de_anatomia');
  });

  it('viene saneada para usarse como nombre de carpeta', () => {
    const { materia } = escanear();
    expect(materia).toMatch(/^[a-z0-9_]+$/);
    expect(materia).not.toContain(' ');
  });

  it('ignora los módulos COLAPSADOS aunque estén en el mismo contenedor', () => {
    // El fixture trae la cabecera de "Miembro Superior" con aria-expanded="false".
    expect(escanear().materia).not.toContain('miembro');
  });

  it('sin módulo expandido devuelve vacío en vez de inventar una carpeta', () => {
    document.querySelector('button[aria-expanded="true"]').setAttribute('aria-expanded', 'false');
    expect(escanear()).toEqual({ materia: '', enlaces: [], credenciales: undefined });
  });

  it('saca los acentos en vez de convertirlos en guiones bajos', () => {
    document
      .querySelector('button[aria-expanded="true"] [data-test="module-item-name"]')
      .setAttribute('title', 'Intensivo Tórax, Cabeza y Cuello');
    expect(escanear().materia).toBe('intensivo_torax_cabeza_y_cuello');
  });
});

describe('escanearListadoDelModulo — las clases', () => {
  it('devuelve SÓLO las de video: las de texto no se encolan', () => {
    // El fixture tiene 3 filas: 1 con thumbnail (video) y 2 sin (texto).
    expect(document.querySelectorAll('div[data-hash]')).toHaveLength(3);
    expect(escanear().enlaces).toHaveLength(1);
  });

  it('⚠️ TRAMPA 1: el título sale del atributo title, no de innerText', () => {
    const { enlaces } = escanear();
    expect(enlaces[0].texto).toBe('Generalidades de Anatomia');

    // Lo que innerText habría traído, y por qué no se usa: los <title> accesibles de los
    // íconos FontAwesome y el overlay "Tocando ahora" de la clase que se reproduce.
    const textoCrudo = document.querySelector('div[data-hash] a').textContent;
    expect(textoCrudo).toContain('Tocando ahora');
    expect(enlaces[0].texto).not.toContain('Tocando ahora');
    expect(enlaces[0].texto).not.toContain('Ícono de un curso');
  });

  it('colapsa espacios y recorta: el title real viene con uno al final', () => {
    // Medido: title="Generalidades de Anatomia " (con espacio final).
    const crudo = document.querySelector('div[data-hash] span[title]').getAttribute('title');
    expect(crudo).not.toBe(crudo.trim());
    expect(escanear().enlaces[0].texto).toBe(crudo.trim());
  });

  it('⚠️ TRAMPA 2: la flecha de navegación NO entra como clase', () => {
    // El fixture trae un <a href*="/content/"> con ?source=CLASS_TOP_ARROW fuera de las filas.
    expect(document.querySelectorAll('a[href*="CLASS_TOP_ARROW"]').length).toBeGreaterThan(0);
    const { enlaces } = escanear();
    expect(enlaces.every((e) => !e.href.includes('CLASS_TOP_ARROW'))).toBe(true);
  });

  it('descarta una flecha aunque quede DENTRO de una fila', () => {
    // Defensa del filtro explícito por `source`, que no depende de dónde esté el <a>.
    const fila = document.querySelector('div[data-hash]');
    fila.querySelector('a[href*="/content/"]').setAttribute(
      'href',
      'https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/XX?source=CLASS_TOP_ARROW'
    );
    expect(escanear().enlaces).toHaveLength(0);
  });

  it('el href es ABSOLUTO y lleva el hash de la lección', () => {
    // En el markup real el atributo es relativo (`/es/club/…`); lo que lo vuelve absoluto es
    // leer la propiedad `.href` y no `getAttribute('href')`. Importa: ese string termina en
    // `urlInterna` del ítem de la cola, y el service worker le hace `fetch` sin ninguna
    // pestaña contra la cual resolver una URL relativa.
    const relativo = document.querySelector('div[data-hash] a').getAttribute('href');
    expect(relativo.startsWith('/')).toBe(true);

    const { enlaces } = escanear();
    // El origen acá es el de jsdom; en el portal es https://hotmart.com. Lo que se afirma es
    // que quedó absoluto, no cuál es el host del entorno de test.
    expect(enlaces[0].href.startsWith(window.location.origin)).toBe(true);
    expect(enlaces[0].href).toContain('/content/1469AANAOd');
    expect(enlaces[0].href).toContain('/products/6083220');
  });

  it('una fila sin título no se cuela con nombre vacío', () => {
    document.querySelector('div[data-hash] span[title]').setAttribute('title', '   ');
    expect(escanear().enlaces).toHaveLength(0);
  });

  it('no se lleva filas de OTRA sección del mismo contenedor', () => {
    // Se agrega una sección hermana con una fila de video: no está declarada por el
    // `aria-controls` de la cabecera activa, así que no debe aparecer.
    const seccionAjena = document.createElement('section');
    seccionAjena.id = 'sectionId_3';
    seccionAjena.innerHTML = `
      <div data-hash="AJENA1">
        <a href="https://hotmart.com/es/club/anatomy-by-chris/products/6083220/content/AJENA1?source=CLASS_MODULES_LIST">
          <div data-test="content-background-thumbnail"></div>
          <span title="Clase de otro modulo">Clase de otro modulo</span>
        </a>
      </div>`;
    document.querySelector('[data-test="lesson-module-list"]').appendChild(seccionAjena);

    const { enlaces } = escanear();
    expect(enlaces).toHaveLength(1);
    expect(enlaces[0].texto).not.toContain('otro modulo');
  });
});

describe('escanearListadoDelModulo — las credenciales', () => {
  it('cosecha el id_token de localStorage, que es lo único que sólo existe en la pestaña', () => {
    window.localStorage.setItem('token', 'jwt-largo-de-12-dias');
    expect(escanear().credenciales).toEqual({ idToken: 'jwt-largo-de-12-dias' });
  });

  it('sin token devuelve undefined y NO rompe el escaneo', () => {
    // Que el escaneo siga sirviendo importa: el usuario ve sus clases y el fallo aparece
    // después, al resolver, con un mensaje que dice qué hacer.
    const { enlaces, credenciales } = escanear();
    expect(credenciales).toBeUndefined();
    expect(enlaces).toHaveLength(1);
  });

  it('no lee el access_token opaco de OIDC, que para esta API no sirve', () => {
    window.localStorage.setItem('oidc.user:algo', '{"access_token":"opaco"}');
    expect(escanear().credenciales).toBeUndefined();
  });
});
