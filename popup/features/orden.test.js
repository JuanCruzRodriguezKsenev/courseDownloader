// @vitest-environment jsdom
/**
 * Tests de OrdenFeature (corte 6b del multi-sitio).
 *
 * Estas tres piezas —listener, comparador y etiqueta— vivían sueltas en el núcleo de `popup.js`,
 * que ADR-0005 declara no-extraíble y que por eso no tiene tests. Extraerlas es lo que permite
 * escribir este archivo: la cobertura es el motivo del corte, no un extra.
 *
 * Lo que más se afirma acá es la resolución POR ÍTEM: `faceta` y `portal` se derivan del
 * descriptor de cada clase, no de un sitio fijo. Con la cola mezclada, resolver con el portal
 * equivocado devuelve un valor plausible y falso — es el bug que arregló el corte 4.
 */
import { describe, it, expect, vi } from 'vitest';
import OrdenFeature from './orden.js';

// Los descriptores reales exponen los DOS accesores y no son intercambiables: `leer` toma el
// campo ya parseado de una clase del listado, `leerDeCola` re-deriva del título porque un
// ColaItem no persiste el valor. Los dobles los traen ambos para no mentir sobre el contrato.
const PORTAL_A = {
  id: 'ramonnet',
  nombre: 'RamonNet',
  faceta: { etiqueta: 'Cátedra', leer: (c) => c.catedra, leerDeCola: (c) => c.catedra },
};

const PORTAL_B = {
  id: 'otro',
  nombre: 'Otro Portal',
  faceta: { etiqueta: 'Comisión', leer: (c) => c.comision, leerDeCola: (c) => c.comision },
};

/** Imita al resolvedor compartido de la composición, migración incluida. */
const sitios = {
  obtener: (id) => (id === undefined || id === 'ramonnet' ? PORTAL_A : id === 'otro' ? PORTAL_B : undefined),
};

const item = (over) => ({ titulo: 'X', fechaEncolado: 0, sitioId: 'ramonnet', ...over });

function montar(over = {}) {
  document.body.innerHTML = `
    <button id="btn"></button>
    <div id="menu" style="display:none"></div>`;

  const appState = {
    pestañaActiva: 'cola',
    colaDescargas: [],
    criterioOrdenCola: 'llegada',
    ordenColaAscendente: true,
    ordenAscendente: true,
    respaldar: vi.fn(),
    ...over,
  };

  const renderizar = vi.fn();
  const cerrarOtrosPaneles = vi.fn();
  const nodos = { btnSort: document.getElementById('btn'), sortMenu: document.getElementById('menu') };
  const feature = OrdenFeature.crear({ nodos, appState, sitios, renderizar, cerrarOtrosPaneles });
  return { feature, appState, nodos, renderizar, cerrarOtrosPaneles };
}

const ordenar = (feature, lista) => [...lista].sort(feature.comparador()).map((c) => c.titulo);

describe('OrdenFeature — el comparador', () => {
  const A = item({ titulo: 'Semana 03', fechaEncolado: 3, catedra: 'B' });
  const B = item({ titulo: 'Semana 01', fechaEncolado: 1, catedra: 'A' });
  const C = item({ titulo: 'Semana 02', fechaEncolado: 2, catedra: 'A' });

  it('llegada ascendente es FIFO', () => {
    const { feature } = montar({ criterioOrdenCola: 'llegada', ordenColaAscendente: true });

    expect(ordenar(feature, [A, B, C])).toEqual(['Semana 01', 'Semana 02', 'Semana 03']);
  });

  it('llegada descendente es LIFO — sin ser un criterio propio', () => {
    // El punto del botón de invertir: LIFO deja de necesitar su propia fila en el panel.
    const { feature } = montar({ criterioOrdenCola: 'llegada', ordenColaAscendente: false });

    expect(ordenar(feature, [A, B, C])).toEqual(['Semana 03', 'Semana 02', 'Semana 01']);
  });

  it('nombre usa orden natural (10 después de 9, no antes)', () => {
    const n9 = item({ titulo: 'Semana 9', fechaEncolado: 1 });
    const n10 = item({ titulo: 'Semana 10', fechaEncolado: 2 });
    const { feature } = montar({ criterioOrdenCola: 'nombre' });

    expect(ordenar(feature, [n10, n9])).toEqual(['Semana 9', 'Semana 10']);
  });

  it('faceta agrupa por su valor y desempata por llegada', () => {
    // El desempate no es decorativo: sin él, dos ítems de la misma cátedra quedan en un orden
    // que depende del sort del motor y la lista se reacomoda sola entre renders.
    const { feature } = montar({ criterioOrdenCola: 'faceta' });

    expect(ordenar(feature, [A, C, B])).toEqual(['Semana 01', 'Semana 02', 'Semana 03']);
  });

  it('faceta lee con el descriptor DE CADA ÍTEM, no con uno fijo', () => {
    // Si resolviera todo con el portal A, el ítem de B daría `undefined` (su valor vive en
    // `comision`, no en `catedra`) y quedaría mal ubicado sin que nada falle.
    const deA = item({ titulo: 'De A', fechaEncolado: 1, catedra: 'Z' });
    const deB = item({ titulo: 'De B', fechaEncolado: 2, sitioId: 'otro', comision: 'A' });
    const { feature } = montar({ criterioOrdenCola: 'faceta' });

    expect(ordenar(feature, [deA, deB])).toEqual(['De B', 'De A']);
  });

  it('portal agrupa por portal y, dentro, por llegada', () => {
    const a2 = item({ titulo: 'A2', fechaEncolado: 4 });
    const a1 = item({ titulo: 'A1', fechaEncolado: 2 });
    const b1 = item({ titulo: 'B1', fechaEncolado: 1, sitioId: 'otro' });
    const { feature } = montar({ criterioOrdenCola: 'portal' });

    // "Otro Portal" < "RamonNet" alfabéticamente; dentro de cada uno manda la llegada.
    expect(ordenar(feature, [a2, b1, a1])).toEqual(['B1', 'A1', 'A2']);
  });

  it('un ítem huérfano no rompe el orden', () => {
    const huerfano = item({ titulo: 'Huérfana', fechaEncolado: 1, sitioId: 'borrado' });
    const sano = item({ titulo: 'Sana', fechaEncolado: 2 });
    const { feature } = montar({ criterioOrdenCola: 'portal' });

    expect(() => ordenar(feature, [huerfano, sano])).not.toThrow();
  });

  it('un criterio desconocido cae a llegada en vez de dejar la lista sin ordenar', () => {
    const { feature } = montar({ criterioOrdenCola: 'inventado' });

    expect(ordenar(feature, [A, B, C])).toEqual(['Semana 01', 'Semana 02', 'Semana 03']);
  });
});

describe('OrdenFeature — los criterios ofrecidos', () => {
  it('con un solo portal NO ofrece "portal": no ordenaría nada', () => {
    const { feature } = montar({ colaDescargas: [item({}), item({})] });

    expect(feature.criteriosDisponibles().map((c) => c.id)).toEqual(['llegada', 'nombre', 'faceta']);
  });

  it('con la cola mezclada sí lo ofrece', () => {
    const { feature } = montar({ colaDescargas: [item({}), item({ sitioId: 'otro' })] });

    expect(feature.criteriosDisponibles().map((c) => c.id)).toContain('portal');
  });

  it('con un portal, la etiqueta de la faceta sale de SU descriptor', () => {
    const { feature } = montar({ colaDescargas: [item({})] });

    expect(feature.criteriosDisponibles().find((c) => c.id === 'faceta').etiqueta).toBe('Cátedra');
  });

  it('con mezcla la etiqueta es genérica: el eje no tiene un nombre único', () => {
    // ADR-0008: la UI no puede hardcodear el vocabulario de un portal, y con dos no hay uno solo.
    const { feature } = montar({ colaDescargas: [item({}), item({ sitioId: 'otro' })] });

    expect(feature.criteriosDisponibles().find((c) => c.id === 'faceta').etiqueta).toBe('Faceta');
  });
});

describe('OrdenFeature — el panel', () => {
  it('el botón lo abre y lo vuelve a cerrar', () => {
    const { nodos } = montar();

    nodos.btnSort.click();
    expect(nodos.sortMenu.style.display).toBe('flex');
    expect(nodos.btnSort.classList.contains('active')).toBe(true);

    nodos.btnSort.click();
    expect(nodos.sortMenu.style.display).toBe('none');
  });

  it('pinta un radio por criterio y marca el activo', () => {
    const { feature, nodos } = montar({ criterioOrdenCola: 'nombre', colaDescargas: [item({})] });
    feature.renderizarMenu();

    const radios = nodos.sortMenu.querySelectorAll('.radio-orden');
    expect(radios.length).toBe(3);
    expect(nodos.sortMenu.querySelectorAll('.radio-orden.marcado').length).toBe(1);
    expect(nodos.sortMenu.querySelector('[aria-checked="true"]').textContent).toContain('Nombre');
  });

  it('elegir un criterio lo persiste y re-renderiza', () => {
    const { feature, appState, nodos, renderizar } = montar();
    feature.renderizarMenu();

    const opciones = nodos.sortMenu.querySelectorAll('.popover-option');
    opciones[1].click(); // "Nombre"

    expect(appState.criterioOrdenCola).toBe('nombre');
    expect(appState.respaldar).toHaveBeenCalled();
    expect(renderizar).toHaveBeenCalled();
  });

  it('el ↑↓ cambia el sentido sin tocar el criterio', () => {
    const { feature, appState, nodos } = montar({ criterioOrdenCola: 'nombre' });
    feature.renderizarMenu();

    nodos.sortMenu.querySelectorAll('.dir-btn')[1].click(); // ↓

    expect(appState.ordenColaAscendente).toBe(false);
    expect(appState.criterioOrdenCola).toBe('nombre');
  });

  it('el pie de "portal" aparece sólo con ese criterio', () => {
    const cola = [item({}), item({ sitioId: 'otro' })];
    const { feature, nodos } = montar({ colaDescargas: cola, criterioOrdenCola: 'portal' });
    feature.renderizarMenu();
    expect(nodos.sortMenu.querySelector('.orden-pie')).not.toBeNull();

    const otra = montar({ colaDescargas: cola, criterioOrdenCola: 'llegada' });
    otra.feature.renderizarMenu();
    expect(otra.nodos.sortMenu.querySelector('.orden-pie')).toBeNull();
  });

  it('si la cola deja de estar mezclada, un criterio "portal" vigente cae a llegada', () => {
    // Si no, el orden apuntaría a un criterio que el panel ya no muestra: el usuario vería
    // una lista ordenada por algo que no puede ni ver ni cambiar.
    const { feature, appState } = montar({ criterioOrdenCola: 'portal', colaDescargas: [item({})] });

    feature.renderizarMenu();

    expect(appState.criterioOrdenCola).toBe('llegada');
  });
});

describe('OrdenFeature — la etiqueta del botón', () => {
  it('en Cola muestra criterio y sentido juntos', () => {
    const { feature, nodos } = montar({ criterioOrdenCola: 'llegada', ordenColaAscendente: true });
    feature.actualizarBoton();
    expect(nodos.btnSort.textContent).toBe('Fila ↑');

    const desc = montar({ criterioOrdenCola: 'nombre', ordenColaAscendente: false });
    desc.feature.actualizarBoton();
    expect(desc.nodos.btnSort.textContent).toBe('Nombre ↓');
  });

  it('en Disponibles muestra su propio criterio y sentido', () => {
    const { feature, nodos } = montar({
      pestañaActiva: 'disponibles',
      criterioOrdenDisponibles: 'estado',
      ordenAscendente: true,
    });
    feature.actualizarBoton();

    expect(nodos.btnSort.textContent).toBe('Estado ↑');
  });

  it('en Disponibles el botón ABRE el panel, igual que en Cola', () => {
    // La primera versión del corte dejó acá el toggle viejo, y el mismo botón terminaba
    // haciendo dos cosas según la pestaña. Este test fija que no vuelva a pasar.
    const { nodos } = montar({ pestañaActiva: 'disponibles' });

    nodos.btnSort.click();

    expect(nodos.sortMenu.style.display).toBe('flex');
  });
});

describe('OrdenFeature — Disponibles tiene sus propios ejes', () => {
  const clase = (over) => ({ titulo: 'X', estado: 'pending', sitioId: 'ramonnet', ...over });

  const montarDisp = (over = {}) =>
    montar({ pestañaActiva: 'disponibles', listadoClasesGlobal: [clase({})], ...over });

  it('ofrece nombre, faceta y estado — sin llegada ni portal', () => {
    // `llegada` no existe ahí (el listado no se encoló, se escaneó) y `portal` tampoco: sale
    // del scrapeo de UNA pestaña, o sea un portal por construcción.
    const { feature } = montarDisp();

    expect(feature.criteriosDisponibles().map((c) => c.id)).toEqual(['nombre', 'faceta', 'estado']);
  });

  it('la faceta se lee con `leer`, no con `leerDeCola`', () => {
    // No son intercambiables: `leerDeCola` re-deriva del título porque un ColaItem no persiste
    // el valor; `leer` toma el campo ya parseado que sí trae una clase del listado.
    const a = clase({ titulo: 'A', catedra: 'Z' });
    const b = clase({ titulo: 'B', catedra: 'A' });
    const { feature } = montarDisp({ criterioOrdenDisponibles: 'faceta', ordenAscendente: true });

    expect(ordenar(feature, [a, b])).toEqual(['B', 'A']);
  });

  it('estado ordena pendientes → en fila → descargados, y desempata por nombre', () => {
    const baj = clase({ titulo: 'B', estado: 'downloaded' });
    const pen = clase({ titulo: 'C', estado: 'pending' });
    const pro = clase({ titulo: 'A', estado: 'process' });
    const { feature } = montarDisp({ criterioOrdenDisponibles: 'estado', ordenAscendente: true });

    expect(ordenar(feature, [baj, pen, pro])).toEqual(['C', 'A', 'B']);
  });

  it('el default reproduce el orden por título que había antes del corte', () => {
    const a = clase({ titulo: 'Semana 10' });
    const b = clase({ titulo: 'Semana 9' });
    const { feature } = montarDisp({ ordenAscendente: true });

    expect(ordenar(feature, [a, b])).toEqual(['Semana 9', 'Semana 10']);
  });

  it('ordenAscendente null sigue significando DESCENDENTE, como antes', () => {
    // El matiz de la instalación vieja: Disponibles sólo miraba la verdad/falsedad del campo.
    const a = clase({ titulo: 'A' });
    const b = clase({ titulo: 'B' });
    const { feature } = montarDisp({ ordenAscendente: null });

    expect(ordenar(feature, [a, b])).toEqual(['B', 'A']);
  });

  it('elegir criterio en Disponibles NO toca el de la Cola', () => {
    const { feature, appState, nodos } = montarDisp({ criterioOrdenCola: 'portal' });
    feature.renderizarMenu();

    nodos.sortMenu.querySelectorAll('.popover-option')[2].click(); // "Estado"

    expect(appState.criterioOrdenDisponibles).toBe('estado');
    expect(appState.criterioOrdenCola).toBe('portal');
  });

  it('el ↑↓ de Disponibles escribe ordenAscendente, no el de la Cola', () => {
    const { feature, appState, nodos } = montarDisp({ ordenAscendente: true, ordenColaAscendente: true });
    feature.renderizarMenu();

    nodos.sortMenu.querySelectorAll('.dir-btn')[1].click(); // ↓

    expect(appState.ordenAscendente).toBe(false);
    expect(appState.ordenColaAscendente).toBe(true);
  });
});

// El cierre de los popovers. El proyecto los cierra con un listener global en `document`, y
// cada botón hace `stopPropagation()` para que su propio click no cierre lo que acaba de abrir.
// La consecuencia que mordió: un botón que frena la propagación TAMPOCO dispara el cierre del
// otro panel, así que los dos quedaban abiertos y superpuestos.
describe('OrdenFeature — la exclusión mutua con el popover de filtros', () => {
  it('abrir el panel de orden pide cerrar el de filtros', () => {
    const { nodos, cerrarOtrosPaneles } = montar();

    nodos.btnSort.click();

    expect(cerrarOtrosPaneles).toHaveBeenCalled();
    expect(nodos.sortMenu.style.display).toBe('flex');
  });

  it('el click en el botón NO se propaga: si no, el cierre global lo cerraría al instante', () => {
    const { nodos } = montar();
    const enDocumento = vi.fn();
    document.addEventListener('click', enDocumento);

    nodos.btnSort.click();

    expect(enDocumento).not.toHaveBeenCalled();
    expect(nodos.sortMenu.style.display).toBe('flex');
    document.removeEventListener('click', enDocumento);
  });

  it('el click ADENTRO del panel tampoco se propaga: elegir no lo cierra', () => {
    const { feature, nodos } = montar();
    feature.renderizarMenu();
    nodos.sortMenu.style.display = 'flex';
    const enDocumento = vi.fn();
    document.addEventListener('click', enDocumento);

    nodos.sortMenu.querySelectorAll('.popover-option')[1].click();

    expect(enDocumento).not.toHaveBeenCalled();
    document.removeEventListener('click', enDocumento);
  });

  it('cerrarMenu() lo cierra y apaga el estado activo del botón', () => {
    // Es lo que llaman el cierre global, el botón de filtros y el cambio de pestaña.
    const { feature, nodos } = montar();
    nodos.btnSort.click();
    expect(nodos.sortMenu.style.display).toBe('flex');

    feature.cerrarMenu();

    expect(nodos.sortMenu.style.display).toBe('none');
    expect(nodos.btnSort.classList.contains('active')).toBe(false);
  });

  it('sin cerrarOtrosPaneles en el ctx no rompe (la dependencia es opcional)', () => {
    document.body.innerHTML = '<button id="btn"></button><div id="menu" style="display:none"></div>';
    const nodos = { btnSort: document.getElementById('btn'), sortMenu: document.getElementById('menu') };
    const feature = OrdenFeature.crear({
      nodos,
      appState: { pestañaActiva: 'cola', colaDescargas: [], criterioOrdenCola: 'llegada', respaldar: vi.fn() },
      sitios,
      renderizar: vi.fn(),
    });

    expect(() => nodos.btnSort.click()).not.toThrow();
    expect(feature).toBeTruthy();
  });
});
