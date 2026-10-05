# Plan — Loader con detalle en tarjetas (maqueta del dueño)

**Rama**: `loader-tarjetas` (desde `main` = `0442598`) · **Fecha**: 2026-09-27
**Spec**: [`docs/specs/loader-con-progreso/spec.md`](specs/loader-con-progreso/spec.md), §Enmienda
2026-09-27 (RN-24 a RN-27, AC-12). **Maqueta**: [`docs/specs/loader-con-progreso/maqueta-loader.png`](specs/loader-con-progreso/maqueta-loader.png) — abrila antes de empezar.
**Compuerta de partida** (`docs/testing.md`): 46 archivos / 801 tests. **Esperado al cerrar**: 46 / 802.

## Qué se hace

Cambia **sólo la presentación** del loader cuando tiene detalle (escaneo de un curso y recorrido).
El contenido (qué textos, cuándo, cada cuánto) no cambia: lo sigue calculando `core/estado/progresoEscaneo.ts`.
Hoy el núcleo entrega el detalle como `lineas: string[]` ya armadas, y con eso la isla no puede
poner cada dato en su tarjeta. Por eso la vista pasa a ser **estructurada** (Paso 2), la isla
dibuja las tarjetas (Paso 3) y el CSS las dispone (Paso 4).

## Cómo está hoy (leído, no supuesto)

- `entrypoints/popup/index.html:10-21` — `#ui-loader.loader-overlay` con tres hijos directos: `.spinner`,
  `.loader-text#ui-loader-txt` (el **título**, lo escribe `mostrarLoader` en `popup.js:484-490` con el
  piso de 500 ms — RN-3) y `#ui-loader-detalle.loader-detalle-host` (donde se monta la isla).
- `popup/features/loaderDetalle.preact.js` — isla #6. Store con `{ lineas, cursos, pie, desde }`;
  `mostrar(vista)` normaliza los campos que falten; dibuja `.loader-detalle-linea` por línea, el
  reloj (`RelojLoader`, tick de 1 s con `formatoReloj`), la `ul.loader-detalle-cursos` con
  `ItemCurso` (hace `scrollIntoView({block:'nearest'})` sobre el actual) y `.loader-detalle-pie`.
- `core/estado/progresoEscaneo.ts` — `vistaLoaderRecorrido(r, portal)` arma `lineas` =
  [`Curso i de N: nombre`, `textoFase(r.actual)` si hay, `Listos: a · Vacíos: b · Fallidos: c`,
  `textoRestante(r)` si no es null]; antes de enumerar, `lineas = ["Buscando tus cursos…"]`.
  `vistaLoaderCurso(progreso, portal)` arma `lineas = [textoFase(progreso)]`. `marca` de cada curso
  es uno de `✓ ○ ✗ ▸ ·`.
- `styles/components/loader.css` — todo anidado bajo `.loader-overlay`. Con detalle
  (`&:has(.loader-detalle)`) sólo cambia el fondo a opaco.
- Popup: 390×600 (`styles/base.css:15-16`). Tema: `styles/variables.css`, claro en `:root` y oscuro
  en `@media (prefers-color-scheme: dark)` (línea 108). **Regla de esa hoja (línea 20-26): ninguna
  hoja de componente escribe un color literal; si falta uno, se agrega en `variables.css`.**

## Radio de impacto (quién construye o lee la vista del loader)

`grep -rn "LoaderDetalle\|vistaLoader\|loader-detalle"` fuera de `docs/`, `.output/`, `.wxt/`, `node_modules/` da exactamente esto; nada más la toca:

| Archivo:línea | Qué hace | Qué cambia |
|---|---|---|
| `core/estado/progresoEscaneo.ts` | arma la vista | Paso 2 |
| `core/estado/progresoEscaneo.test.ts:118-205` | 3 tests sobre `lineas` | Paso 2 |
| `popup/features/loaderDetalle.preact.js` | dibuja | Paso 3 |
| `popup/features/loaderDetalle.preact.test.js` | 5 tests sobre clases viejas | Paso 3 |
| `popup.js:570` | `LoaderDetalle.mostrar(vistaLoaderRecorrido(...))` | **nada** (pasa la vista entera) |
| `popup.js:606-609` | `mostrar({ ...vistaLoaderCurso(req, ...), desde })` | **nada** |
| `popup.js:1588` | `mostrar({ lineas: [], cursos: [], pie: [], desde })` | Paso 3, una línea |
| `styles/components/loader.css` | estilo | Paso 4 |
| `styles/variables.css` | tokens | Paso 1 |
| `verificacion/modoVerificacion.js` (banco) | **no** toca la isla (verificado con grep) | nada |

`mostrarLoader`/`ocultarLoader`, el piso, `sincronizarLoaderRecorrido` y el oyente de
`escaneo_progreso` **no se tocan**.

---

## Paso 1 — Token de acento azul (RN-27)

`styles/variables.css`:

- En `:root`, debajo de `--accent-green: #30D158;` (línea 15), agregar:
  `--accent-blue: #0060DF; /* acento del loader con detalle: curso actual y reloj */`
- En el bloque de canales RGB, debajo de `--accent-green-rgb` (línea 30), agregar:
  `--accent-blue-rgb: 0, 96, 223;     /* = --accent-blue #0060DF */`
- En el bloque oscuro (`@media (prefers-color-scheme: dark)`), debajo de `--accent-cyan-disco-hover`
  (línea 120), agregar las dos redefiniciones:
  `--accent-blue: #4F8EF7;` y `--accent-blue-rgb: 79, 142, 247;`
  (los otros `-rgb` no se redefinen en oscuro; éste sí, porque el tinte de la fila actual tiene que
  seguir al azul de cada tema).

## Paso 2 — Vista estructurada en el núcleo (RN-11, RN-12, RN-13, RN-24)

`core/estado/progresoEscaneo.ts`. `formatoReloj`, `textoFase`, `textoRestante` y `ElementoCursoLoader`
**no cambian**. Cambian `VistaLoader` y las dos funciones que la arman:

```ts
export interface TarjetaActualLoader {
  /** "Curso 6 de 7" — sólo en el recorrido, una vez enumerados los cursos. */
  posicion: string | null;
  /** Nombre del curso actual — sólo en el recorrido. En un curso el nombre ya es el título. */
  nombre: string | null;
  /** Fase e ítems (`textoFase`), o "Buscando tus cursos…" antes de enumerar. */
  detalle: string | null;
}

export interface ContadoresLoader {
  listos: number;
  vacios: number;
  fallidos: number;
}

export interface VistaLoader {
  titulo?: string;
  actual: TarjetaActualLoader | null;
  contadores: ContadoresLoader | null;
  restante: string | null;
  cursos: ElementoCursoLoader[];
  pie: string[];
  desde?: number;
}
```

`vistaLoaderRecorrido(r, nombrePortal)`:
- sin cursos → `{ titulo, actual: { posicion: null, nombre: null, detalle: "Buscando tus cursos…" }, contadores: null, restante: null, cursos: [], pie, desde }`;
- con cursos → `actual = { posicion: \`Curso ${r.indice + 1} de ${r.cursos.length}\`, nombre: cursoActual.nombre, detalle: r.actual ? (textoFase(r.actual) || null) : null }`;
  `contadores = { listos: res.ok, vacios: res.vacios, fallidos: res.fallidos.length }`;
  `restante = textoRestante(r)`; `cursos` se arma **igual que hoy** (mismas marcas, mismo `actual`).
- `titulo`, `pie` y `desde` igual que hoy.

`vistaLoaderCurso(progreso, nombrePortal)` →
`{ actual: { posicion: null, nombre: null, detalle: textoFase(progreso) || null }, contadores: null, restante: null, cursos: [], pie: [\`Dejá ${nombrePortal} al frente.\`] }`.

Tests — `core/estado/progresoEscaneo.test.ts`, **se editan los 3 existentes, no se agregan**:
- "recorrido sin cursos": reemplazar `expect(vista.lineas)...` por
  `expect(vista.actual).toEqual({ posicion: null, nombre: null, detalle: "Buscando tus cursos…" })`,
  `expect(vista.contadores).toBeNull()`, `expect(vista.restante).toBeNull()`. El resto igual.
- "AC-2": reemplazar las 4 aserciones sobre `vista.lineas[0..3]` por
  `expect(vista.actual).toEqual({ posicion: "Curso 3 de 7", nombre: "Análisis II", detalle: "Cargando más publicaciones (2) · 8 publicaciones" })`,
  `expect(vista.contadores).toEqual({ listos: 1, vacios: 1, fallidos: 0 })`,
  `expect(vista.restante).toBe("≈ 2 min restantes")`. Marcas, `titulo`, `pie`, `desde` igual.
- "vistaLoaderCurso": reemplazar `expect(vista.lineas)` por
  `expect(vista.actual).toEqual({ posicion: null, nombre: null, detalle: "Trabajo en clase · 15 publicaciones" })`
  y agregar `expect(vista.contadores).toBeNull()`.

## Paso 3 — La isla dibuja las tarjetas (RN-24, RN-25, AC-12)

### 3a. Store

`popup/features/loaderDetalle.preact.js`. El estado vacío pasa a ser
`{ actual: null, contadores: null, restante: null, cursos: [], pie: [], desde: null }` — en **los tres**
lugares donde hoy está escrito el literal (`estado:` inicial, `limpiar()`, `__resetStore()`).
Conviene una función `vacio()` que lo devuelva y usarla en los tres.

`mostrar(vista)` normaliza así (mismo criterio defensivo que hoy):
- `actual`: el objeto si `vista.actual` es objeto no nulo, si no `null`;
- `contadores`: ídem;
- `restante`: el string si es string no vacío, si no `null`;
- `cursos`, `pie`: el array si es array, si no `[]`;
- `desde`: el número si es número, si no `null`.

`limpiar()` sale temprano si el estado ya es vacío (los seis campos en su valor vacío) — igual que hoy.

`popup.js:1588` pasa a `LoaderDetalle.mostrar({ desde: desdeEscaneoActual });` (la normalización
completa lo demás). **Es la única línea de `popup.js` que se toca.**

### 3b. Íconos

Constante `ICONOS` en el mismo archivo, SVG en línea (no hay SVG en el popup hoy; son estáticos, no
llevan texto de terceros, así que no entran en la regla de `security.md`). Todos con
`viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`, y la clase `loader-icono`. Los de
línea llevan `fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`:

| Clave | Contenido |
|---|---|
| `lista` | `<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/>` |
| `documento` | `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8M16 17H8M10 9H8"/>` |
| `reloj` | `<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>` |

Los de estado **no** son de línea; la forma exterior toma `currentColor` y el trazo interior tiene
la clase `loader-icono-trazo` (su color lo pone el CSS, Paso 4):

| Marca (`ElementoCursoLoader.marca`) | Clave | Contenido |
|---|---|---|
| `✓` | `listo` | `<circle cx="12" cy="12" r="10" fill="currentColor"/><path class="loader-icono-trazo" d="m7.5 12.5 3 3 6-6.5" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` |
| `○` | `vacio` | `<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/>` |
| `✗` | `fallido` | `<circle cx="12" cy="12" r="10" fill="currentColor"/><path class="loader-icono-trazo" d="M9 9l6 6M15 9l-6 6" fill="none" stroke-width="2.4" stroke-linecap="round"/>` |
| `▸` | `actual` | `<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>` |
| `·` | `pendiente` | `<circle cx="12" cy="12" r="3" fill="currentColor"/>` |

Mapa `ESTADO_POR_MARCA = { '✓': 'listo', '○': 'vacio', '✗': 'fallido', '▸': 'actual', '·': 'pendiente' }`;
marca desconocida → `'pendiente'`. Cada ícono de estado va envuelto en
`<span class="loader-marca loader-marca-<estado>" title=<texto>>` con `texto` =
`listo`/`vacío`/`fallido`/`actual`/`pendiente` (reemplaza al carácter visible de hoy).

### 3c. Render

`LoaderDetalle` devuelve `null` si el estado es vacío (igual que hoy). Si no, este árbol; **cada
bloque se dibuja sólo si su dato existe**:

```
div.loader-detalle
  section.loader-tarjeta.loader-cursos                       ← si cursos.length > 0
    div.loader-cursos-cabecera   [ICONOS.lista] span "Cursos"
    ul.loader-cursos-lista
      li.loader-curso(.actual)   span.loader-marca… + span.loader-curso-nombre (title = nombre)
  section.loader-tarjeta.loader-actual                       ← si actual
    [ICONOS.documento]
    div
      div.loader-actual-titulo    ← si posicion o nombre: posicion, " · " (sólo si hay los dos), nombre
      div.loader-actual-detalle   ← si detalle
  section.loader-tarjeta.loader-contadores                   ← si contadores
    div.loader-contador × 3: div.loader-contador-etiqueta ("Listos"/"Vacíos"/"Fallidos")
                             div.loader-contador-valor: span.loader-marca.loader-marca-<listo|vacio|fallido> + span número
  div.loader-tiempo                                          ← si restante o desde
    div.loader-tiempo-restante  [ICONOS.reloj] span restante ← si restante
    <RelojLoader desde=…/>      → div.loader-detalle-reloj   ← si desde (clase SE CONSERVA)
  div.loader-escaneando          div.spinner + span "Escaneando…"   ← siempre
  div.loader-pie                                             ← si pie.length > 0
    div.loader-detalle-pie × n  (clase SE CONSERVA)
```

`ItemCurso` conserva el `scrollIntoView({ block: 'nearest' })` sobre el actual. Keys como hoy.
`RelojLoader` no cambia.

### 3d. Tests — `popup/features/loaderDetalle.preact.test.js` (5 → 6 tests)

Actualizar el docblock de cabecera y dejar exactamente estos seis:

1. **arranca vacío**: `root.innerHTML === ''` y `puente.get()` igual al estado vacío de 3a.
2. **tarjeta actual y pie**: `mostrar({ actual: { posicion: 'Curso 1 de 3', nombre: 'Física II', detalle: 'Trabajo en clase · 5 publicaciones' }, pie: ['Dejá Classroom al frente.', 'Podés cerrar este popup.'] })` →
   `.loader-actual-titulo` textContent `'Curso 1 de 3 · Física II'`; `.loader-actual-detalle` `'Trabajo en clase · 5 publicaciones'`;
   dos `.loader-detalle-pie` con esos textos; **no** hay `.loader-cursos` ni `.loader-contadores`;
   hay un `.loader-escaneando` con texto `'Escaneando…'`.
3. **lista con íconos**: con los tres cursos de hoy (`✓`, `▸`, `·`) → 3 `li.loader-curso`; el 1º tiene
   `.loader-marca-listo`, el 2º `.loader-marca-actual` y clase `actual`, el 3º `.loader-marca-pendiente`;
   cada `li` contiene un `svg`; el texto de `.loader-curso-nombre` es el nombre; `scrollIntoView` llamado.
4. **contadores**: `mostrar({ contadores: { listos: 3, vacios: 2, fallidos: 0 } })` → 3 `.loader-contador`,
   etiquetas `Listos`/`Vacíos`/`Fallidos` y valores `3`/`2`/`0` en ese orden (textContent de
   `.loader-contador-valor` recortado).
5. **reloj y restante**: el test de reloj de hoy (fake timers, `0:00` → `0:02`, sigue leyendo
   `.loader-detalle-reloj`) con `restante: '≈ 1 min restante'` agregado al `mostrar`, y además
   `.loader-tiempo-restante` textContent `'≈ 1 min restante'`. Sin `restante` no debe haber
   `.loader-tiempo-restante` (segunda aserción en el mismo test, tras `mostrar({ desde: t0 })`).
6. **limpiar**: como hoy, con `actual` y `cursos` cargados → `.loader-detalle` presente, `limpiar()` → `innerHTML === ''`.

## Paso 4 — CSS (RN-24, RN-25, RN-26, AC-12)

`styles/components/loader.css`. **Todo lo de afuera del modo con detalle queda igual** (RN-26):
`.loader-overlay` base, `.spinner`, `.loader-text`, `@keyframes`, `.spinner-inline`, `.pc-path-text`.
Se **borran** las reglas que la isla deja de usar: `.loader-detalle-linea`, `.loader-detalle-cursos`,
`.loader-detalle-curso`, `.loader-detalle-curso.actual`, `.loader-detalle-curso-marca`,
`.loader-detalle-curso-nombre`. Se reemplaza el bloque `&:has(.loader-detalle)` y `.loader-detalle-host`,
`.loader-detalle`, `.loader-detalle-reloj`, `.loader-detalle-pie` por esto (dentro del mismo
`.loader-overlay { … }`):

```css
  /* Con detalle el loader dura minutos: fondo opaco y disposición en tarjetas (maqueta:
     docs/specs/loader-con-progreso/maqueta-loader.png). Sin detalle, lo de arriba tal cual. */
  &:has(.loader-detalle) {
    background-color: var(--bg-main);
    backdrop-filter: none;
    justify-content: safe center;
    align-items: stretch;
    gap: var(--space-md);
    padding: var(--space-lg);
    box-sizing: border-box;
    overflow-y: auto;

    /* El spinner de arriba se muda a la fila "Escaneando…" de la isla. `>` a propósito: el de
       la isla también es `.spinner` y tiene que seguir visible. */
    > .spinner { display: none; }

    /* El título (lo sigue escribiendo mostrarLoader, con su piso) pasa a ser la cabecera. */
    > .loader-text {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1rem;
      font-weight: var(--font-bold);
      text-align: left;

      &::before {
        content: "";
        flex-shrink: 0;
        width: 26px;
        height: 26px;
        background-color: var(--accent-blue);
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z'/%3E%3Cpath d='M22 10v6'/%3E%3Cpath d='M6 12.5V16a6 3 0 0 0 12 0v-3.5'/%3E%3C/svg%3E") center / contain no-repeat;
      }
    }
  }

  .loader-detalle-host {
    align-self: stretch;
  }

  .loader-detalle {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    font-size: var(--text-md);
    color: var(--text-main);
    text-align: left;
  }

  .loader-icono {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .loader-tarjeta {
    background: var(--bg-surface);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-lg);
  }

  /* Lista de cursos (RN-13): scroll propio, el actual queda a la vista (ItemCurso). */
  .loader-cursos-cabecera {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--border-color);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .loader-cursos-lista {
    list-style: none;
    margin: 0;
    padding: var(--space-xs) var(--space-sm);
    max-height: 150px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .loader-curso {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    min-height: 26px;
    padding: 0 var(--space-sm);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--text-main);
  }

  .loader-curso.actual {
    font-weight: var(--font-bold);
    background: rgba(var(--accent-blue-rgb), var(--alpha-active));
    border-color: rgba(var(--accent-blue-rgb), var(--alpha-border));
    box-shadow: inset 3px 0 0 var(--accent-blue);
  }

  .loader-curso-nombre {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  /* Marcas (RN-25): la forma toma currentColor; el trazo interior, el fondo de la tarjeta. */
  .loader-marca {
    display: inline-flex;
    flex-shrink: 0;

    .loader-icono { width: 18px; height: 18px; }
    .loader-icono-trazo { stroke: var(--bg-surface); }
  }
  .loader-marca-listo { color: var(--accent-green); }
  .loader-marca-vacio { color: var(--text-muted); }
  .loader-marca-fallido { color: var(--accent-error-visible); }
  .loader-marca-actual { color: var(--text-main); }
  .loader-marca-pendiente { color: var(--text-muted); }

  /* Curso actual */
  .loader-actual {
    display: flex;
    align-items: flex-start;
    gap: var(--space-md);
    padding: var(--space-md);

    > .loader-icono { width: 22px; height: 22px; color: var(--text-muted); }
  }

  .loader-actual-titulo {
    font-weight: var(--font-bold);
    word-break: break-word;
  }

  .loader-actual-detalle {
    margin-top: 2px;
    font-size: var(--text-base);
    color: var(--text-muted);
  }

  /* Contadores */
  .loader-contadores {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding: var(--space-md) 0;
  }

  .loader-contador {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);

    & + & { border-left: 1px solid var(--border-color); }
  }

  .loader-contador-etiqueta {
    font-size: var(--text-base);
    color: var(--text-muted);
  }

  .loader-contador-valor {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 1.25rem;
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;

    .loader-icono { width: 20px; height: 20px; }
  }

  /* Tiempo */
  .loader-tiempo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .loader-tiempo-restante {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    color: var(--text-main);

    .loader-icono { width: 16px; height: 16px; color: var(--text-muted); }
  }

  .loader-detalle-reloj {
    font-size: 1rem;
    font-weight: var(--font-bold);
    font-variant-numeric: tabular-nums;
    color: var(--accent-blue);
  }

  .loader-escaneando {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    color: var(--text-main);

    .spinner { width: 26px; height: 26px; border-width: 3px; }
  }

  .loader-pie {
    padding-top: var(--space-md);
    border-top: 1px solid var(--border-color);
    text-align: center;
  }

  .loader-detalle-pie {
    font-size: var(--text-base);
    color: var(--text-muted);
    font-style: italic;
  }
```

Notas para no improvisar:
- `.spinner` dentro de la isla hereda el estilo de `.loader-overlay .spinner` (anidado) — por eso
  el `> .spinner` del modo con detalle usa combinador de hijo.
- `mask` con prefijo: Chrome/Brave actuales aceptan `mask` sin prefijo; **no** agregar `-webkit-mask`.
- `& + &` dentro de `.loader-contador` es CSS anidado nativo (ya se usa `&:has(...)` en esta hoja).
- No agregar `animation`/`transition` nuevas (AGENTS.md patrón 4).

## Paso 5 — Docs

- `docs/testing.md` §Baseline: `46 archivos, 801 tests` → `46 archivos, 802 tests`, y un párrafo
  **"De dónde sale el 802"** arriba del del 801, con el formato de los vecinos: "(2026-09-27, plan
  `loader-tarjetas`). Son los 801 de abajo más **+1** test en `popup/features/loaderDetalle.preact.test.js`
  (contadores; los demás se reescribieron para la presentación en tarjetas; 5 → 6 tests). Los 3 de
  `core/estado/progresoEscaneo.test.ts` cambian de aserciones, no de cantidad."
  **Contraste**: antes de escribir, leer `docs/testing.md:33-40` y copiar la forma exacta.
- Header de versión (`docs/coding-standards.md`, convención de cabecera): `loaderDetalle.preact.js`
  pasa a V1.1.0 con una línea de CHANGELOG ("presentación en tarjetas con íconos: lista, curso
  actual, contadores, tiempo, fila Escaneando…"); `progresoEscaneo.ts` a V1.1.0 ("VistaLoader
  estructurada: actual/contadores/restante en vez de lineas"). **Contraste**: mirar la cabecera
  actual de cada archivo (líneas 1-8) y respetar su forma.
- **No** tocar `docs/ramas-en-revision.md` ni la spec: ya están (los escribió la tanda).

## Paso 6 — Compuerta y commits

Un commit por paso de código (1, 2, 3, 4) y uno de docs (5), mensajes en español con el prefijo
convencional del repo (`feat(loader): …`, `docs(testing): …`). No pushear.

---

## Verificación A (obra corre y pega la salida literal)

```bash
cd /home/jcrod/Dev/courseDownloader
git branch --show-current                                        # loader-tarjetas
pnpm test 2>&1 | tail -5                                         # 46 archivos, 802 tests, verde
pnpm run lint 2>&1 | tail -3                                     # 0 errores, 0 warnings
pnpm exec tsc --noEmit && echo TSC_OK
pnpm run build 2>&1 | tail -3
# (a) nadie más arma la vista vieja
grep -rn "lineas" core/estado/progresoEscaneo.ts popup/features/loaderDetalle.preact.js popup.js | grep -iv "// " ; echo "fin (a) — esperado: sin líneas"
# (b) clases viejas borradas del CSS y de la isla
grep -rn "loader-detalle-linea\|loader-detalle-cursos\|loader-detalle-curso" styles popup popup.js ; echo "fin (b) — esperado: sin líneas"
# (c) sin colores literales en la hoja del loader
grep -nE "#[0-9A-Fa-f]{3,8}\b|rgb\(|rgba\([0-9]" styles/components/loader.css ; echo "fin (c) — esperado: sin líneas"
# (d) el token existe en los dos temas
grep -c "accent-blue" styles/variables.css                      # esperado: 4
# (e) popup.js: sólo cambió una línea
git diff main -- popup.js | grep -c "^[-+][^-+]"                 # esperado: 2
# (f) el CSS compilado lleva la cabecera y el mask
grep -o "loader-cursos-lista\|loader-contadores\|safe center" .output/chrome-mv3/assets/*.css | sort -u
```

**Control negativo** (obra lo corre y pega la salida; la tanda lo re-corre): en el test 3 de la isla,
cambiar temporalmente `ESTADO_POR_MARCA['✓']` a `'vacio'` → `pnpm exec vitest run popup/features/loaderDetalle.preact.test.js`
**debe fallar** el test 3; restaurar y confirmar verde. Pegar las dos salidas.

## Verificación visual — tanda, antes de mandar al dueño

La tanda reproduce el loader con el CSS compilado (`.output/chrome-mv3/assets/*.css`) y el markup
generado por la isla en jsdom, servido con `python3 -m http.server` desde el scratchpad y abierto
con Claude in Chrome en un iframe de 390×600, en oscuro y en claro (claro: borrar vía JS las reglas
`@media (prefers-color-scheme: dark)`). Tres estados: recorrido 6 de 7 (AC-12), un curso de
Classroom (sin lista ni contadores), y sin detalle (RN-26: centrado y translúcido como hoy).

## Verificación B — el dueño, en Brave

Antes: `pnpm run build` y recargar la extensión (no hace falta reiniciar el backend: no cambia).

- **T-1** (AC-12, RN-24, RN-25) — Portada de Classroom al frente → "Escanear todos los cursos". El
  loader se parece a la maqueta: título con birrete, tarjeta de cursos con el actual resaltado en
  azul, tarjeta del curso actual, Listos/Vacíos/Fallidos, tiempo restante (desde el 2º curso) con el
  reloj, "Escaneando…" con spinner, y el pie. Nada se corta ni aparece scroll en el popup.
- **T-2** (AC-5) — Cerrar y reabrir el popup a mitad: vuelve igual, con el reloj corriendo.
- **T-3** (RN-6, AC-4) — Abrir el popup en un curso sin lista guardada: título = nombre del curso,
  tarjeta con la fase, reloj, "Escaneando…", pie de una línea; sin lista ni contadores.
- **T-4** (RN-26) — Al abrir el popup, el cartel "Conectando con el servidor Bun…" sigue centrado
  sobre el velo, como hoy.
- **T-5** (RN-27) — Si usás el tema claro del sistema alguna vez: mirar T-1 en claro. Si no, se omite.
