# Plan — CSS del detalle del loader

**Rama**: `classroom-escanear-todas`. **Fecha**: 2026-09-27. Árbol limpio al empezar.
**Origen**: el dueño probó L-1 en Brave (captura, 2026-09-27): "completamente roto el css".
**Contexto**: plan `docs/plan-loader-con-progreso.md`, Paso 4. Spec
`docs/specs/loader-con-progreso/spec.md` (RN-1, NFR-3; AC-1, AC-2).

## Diagnóstico (reproducido)

Reproducido fuera de la extensión con el CSS compilado (`.output/chrome-mv3/assets/popup-*.css`)
y el markup que pinta `loaderDetalle.preact.js`, en un body de 400 × 560: queda idéntico a la
captura del dueño. Son tres defectos, todos en `styles/components/loader.css`:

1. **Fondo translúcido.** `.loader-overlay` usa `--bg-overlay` (`alpha 0.82`) + `blur(8px)`
   (`loader.css:5-6`). Estaba pensado para un cartel corto de una línea. Con dos minutos de detalle,
   la lista del popup se ve por detrás del texto.
2. **El detalle queda pegado al borde izquierdo.** `#ui-loader-detalle` no tiene reglas: es un
   hijo flex de un contenedor con `align-items: center`, así que mide lo que mide su contenido.
   Adentro, `.loader-detalle` tiene `max-width: 90%; width: 100%` (`loader.css:29-30`) y ningún
   margen, así que el texto arranca en x ≈ 3 px.
3. **Alineación mezclada.** El spinner y el título van centrados, pero el detalle va con
   `text-align: left` (`loader.css:32`).

## Paso único — `styles/components/loader.css` + `entrypoints/popup/index.html`

Lo que sigue fue probado sobre la reproducción. En Chrome el resultado queda centrado, con un
margen de 16 px, fondo opaco y la lista con su caja, alineada a la izquierda.

1. `entrypoints/popup/index.html:20`: `<div id="ui-loader-detalle">` pasa a
   `<div id="ui-loader-detalle" class="loader-detalle-host">`. **No** se toca el `id`, porque
   `popup.js` lo monta por `getElementById`.
2. En `loader.css`, dentro de `.loader-overlay { … }` (usa anidamiento CSS: seguir el estilo del
   archivo):
   - Agregar:
     ```css
     /* Con detalle el loader dura minutos: fondo opaco, sin ver la lista por detrás. */
     &:has(.loader-detalle) {
       background-color: var(--bg-main);
       backdrop-filter: none;
     }

     .loader-detalle-host {
       align-self: stretch;
       padding: 0 var(--space-lg);
       box-sizing: border-box;
     }
     ```
   - En `.loader-detalle`: **sacar** `max-width: 90%`, y cambiar `text-align: left` por
     `text-align: center`.
   - En `.loader-detalle-cursos`: agregar `text-align: left`.
3. No se renombra ninguna clase `.loader-detalle-*`. `loaderDetalle.preact.test.js` las usa como
   selectores (`:43, :48, :67, :97, :116, :121`).

Cuando no hay detalle ("Conectando con el servidor…"), `:has` no aplica y el loader queda como
hoy. Con el escaneo de un curso sí aplica, porque el detalle lleva al menos el reloj: el fondo
también queda opaco, y es a propósito.

## Radio de impacto

- `verificacion/modoVerificacion.js:746` observa `#ui-loader-txt`, que no cambia.
- `pisoVisible.js`, `mostrarLoader` y `ocultarLoader` no se tocan: el apagado sigue siendo por
  `display: none` sobre `#ui-loader`.
- Tokens: sólo `--bg-main` y `--space-lg`, que ya existen en `styles/variables.css`
  (`:3, :71`; oscuro en `:111`). Nada de colores sueltos.

## Verificación A (pegar la salida)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
git grep -n "loader-detalle-host" -- entrypoints/popup/index.html styles/components/loader.css
git grep -n "max-width: 90%" -- styles/components/loader.css   # sin salida
```

Baseline: 46 archivos / 796 tests (no cambia; no hay tests nuevos).

## Verificación B (dueño, en Brave)

`pnpm run build`, recargar la extensión y repetir **L-1/L-2** de `docs/ramas-en-revision.md`:
el loader tiene fondo opaco, el detalle va centrado y con margen, y la lista de cursos queda en
su caja, alineada a la izquierda. Probar también en tema claro, si el sistema lo permite.

## Doc

En `docs/ramas-en-revision.md`, bajo "Revisión de tanda del loader con progreso", agregar un ✅
"CSS del detalle roto (L-1 del dueño)" con una línea que resuma el Paso único.
