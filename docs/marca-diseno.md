# Marca: Resaltador

**Estado (2026-10-05): 🟢 aplicada en el popup (identidad), faltan las decisiones de UI de §6.2 (plan 27).** Este doc es el
**hogar canónico de la identidad visual**: qué colores, qué logo, qué wordmark y cómo se mapean a
`styles/variables.css`. Lo que falta para completarlo está en §7.

- **Referencia visual**: `docs/marca/referencia.html` (abrir en el navegador). Es la página con la
  que se diseñó: paleta, ícono en 96/48/16 px sobre tres fondos, los dos temas y un mock del popup
  real con la marca aplicada. Si este doc y esa página discrepan, **manda este doc**.
- **Maestro del logo**: `docs/marca/logo.svg`.

---

## 1. Por qué hacía falta una marca propia

La extensión se llamó *RamonNet Video Downloader* hasta la fusión, y el rename a Course
Downloader (`ee32c0c`, ver `docs/copy-generico-diseno.md` §5.2) cambió el **nombre** pero no la
**imagen**. Hoy sirve a tres portales y sigue vistiendo la ropa del primero:

- el ícono (`public/icons/*.png`, también en el header del popup) es la "R" de Ramón Net;
- el acento de toda la UI es el naranja de Ramón Net, y la variable lleva el color en el nombre
  (`--accent-orange`), así que cambiarlo obliga a renombrar;
- la carpeta por defecto del backend es `Downloads/RamonNet_Turbo`.

## 2. El concepto

**Una flecha de descarga en tinta sobre un trazo de marcador amarillo**: la clase que se baja del
aula y queda marcada en tu carpeta. Es vocabulario de estudiante (apuntes, resaltador), no de
herramienta de red.

Se eligió entre cuatro direcciones (fragmentos HLS que se ensamblan, tres hilos que se juntan en
una cola, resaltador, turbo). Resaltador ganó por una razón que no es de gusto: **es la única
paleta que no choca con nada que la UI ya usa**. Ni con el naranja de Ramón Net (la marca que se
deja), ni con los tres colores de portal de §5.

## 3. Paleta

| Rol | Tema claro | Tema oscuro |
|---|---|---|
| Resaltador (marca) | `#FFD60A` | `#FFD60A` (no cambia) |
| Fondo | Hoja `#FBFAF4` | Pizarra `#141416` |
| Superficie | `#FFFFFF` | Hoja noche `#1B1B1F` |
| Texto | Tinta `#1C1C1E` | Tiza `#F2F0E6` |
| Texto secundario | Lápiz `#6B6B70` | Lápiz `#9A988F` |
| Bordes | `#ECE9DF` | `#2A2A2F` |
| Error | Corrección `#E5484D` | `#FF6369` |

**El amarillo es el mismo en los dos temas; lo que se invierte es el papel.**

Contrastes medidos (WCAG): tiza sobre pizarra 16,1:1 · lápiz oscuro sobre hoja noche 5,9:1 · tinta
sobre resaltador 13:1.

**Regla que no es de gusto: el texto sobre el amarillo es siempre tinta, en los dos temas.**
Blanco sobre `#FFD60A` da 1,4:1 y no se lee. Hoy `--text-on-orange` es blanco en claro: al
aplicar la marca, `--text-on-brand` tiene que ser `#1C1C1E` / `#141416`.

**Y su corolario: texto amarillo sobre fondo claro tampoco se lee.** Donde hoy la UI pinta texto
con el acento (el badge "En fila"/"Bajando", el chip `→ materia`, el badge de faceta), en claro va
un **ocre** (`#8A6D00`; `#6B5600` en el badge de proceso) y el amarillo puro sólo en oscuro.

## 4. Logo

Geometría en `docs/marca/logo.svg` (viewBox 64×64): cuadrado de papel `#FBFAF4` con radio 14,
trazo biselado `#FFD60A` y flecha de tinta `#1C1C1E` con trazo de 6.

- **Trazo biselado**: bordes largos apenas curvos y las puntas cortadas en diagonal, como un
  marcador de punta biselada. Reemplazó al paralelogramo recto, que se leía como una cinta. Se
  eligió entre cuatro variantes (biselado, dos pasadas translúcidas, punta seca, flecha al
  frente) porque es el cambio más chico y el que mejor aguanta a 16 px.
- **Un solo ícono para los dos temas.** Lleva su propio papel, como una etiqueta pegada, y no se
  invierte. Se probaron dos versiones oscuras y las dos se descartaron:
  - flecha clara que se oscurece donde cruza el amarillo → la punta parecía un agujero;
  - amarillo cubriendo todo el cuadrado → se pierde el efecto de resaltado.

  Además, el manifest no cambia de ícono según el tema del navegador, así que el de la barra
  tiene que funcionar sobre las dos barras de todos modos.
- **Tamaños**: los que declara `wxt.config.ts` (16, 48, 128). El de 16 px se revisa a ojo, no se
  confía al reescalado.
- **Pendiente conocido**: sobre blanco puro (la barra clara de Chrome) el papel `#FBFAF4` casi no
  se despega del fondo. Un borde fino `#E3DFCF` de 1,5 lo resuelve; está probado en la referencia
  pero no incorporado al maestro.

## 5. Wordmark

"Course **Downloader**", en **Bricolage Grotesque ExtraBold** (800), sin mayúsculas forzadas.
**Sólo "Downloader" lleva el resaltado**, y a media altura: una franja `#FFD60A` que va del 48% al
92% del alto de la línea, detrás del texto.

```css
/* claro */
.wordmark span { background: linear-gradient(transparent 48%, #FFD60A 48% 92%, transparent 92%);
                 color: #1C1C1E; padding-inline: 1px; }
/* oscuro: mismo resaltado, texto en tiza con un borde del color del fondo */
.wordmark span { color: #F2F0E6; -webkit-text-stroke: 1px #141416; paint-order: stroke fill; }
```

**El borde en oscuro es lo que lo hace legible, no un adorno.** La mitad de abajo de las letras
cae sobre el amarillo, y tiza sobre amarillo no contrasta. `paint-order: stroke fill` dibuja el
borde **detrás** de la letra, así no la afina; sobre la pizarra el borde se funde con el fondo y
sólo se ve donde la letra pisa el amarillo. Requiere Chrome/Brave ≥ 123 (sobra: la extensión es
de uso personal, ver `AGENTS.md`).

Lo que se probó en oscuro y **no** va: bloque amarillo sobre la palabra entera (pierde la media
altura), amarillo translúcido (queda oliva), letras partidas en dos colores (parecen tachadas),
y el trazo bajado a subrayado (se lee, pero ya no es el mismo resaltado que en claro).

**Colores de portal**: `#005AD7` (Ramón Net), `#8E44FF` (Anatomy by Chris), `#1E8E3E`
(Classroom), en `sitio/*/config.ts`. La marca no puede usar ninguno de los tres ni el naranja.

## 6. Cómo se aplica al popup

### 6.1 Tokens de `styles/variables.css`

| Token | Claro | Oscuro | Hoy (claro / oscuro) |
|---|---|---|---|
| `--bg-main` | `#FBFAF4` | `#141416` | `#FAF8F5` / `#090A0C` |
| `--bg-surface` | `#FFFFFF` | `#1B1B1F` | `#FFFFFF` / `#111318` |
| `--text-main` | `#1C1C1E` | `#F2F0E6` | `#1C1C1E` / `#F1F3F5` |
| `--text-muted` | `#6B6B70` | `#9A988F` | `#8E8E93` / `#7E8590` |
| `--border-color` | `#ECE9DF` | `#2A2A2F` | `#E5E5EA` / `#1E222A` |
| `--accent-brand` (renombra `--accent-orange`) | `#FFD60A` | `#FFD60A` | `#FF5E00` / `#FF751F` |
| `--accent-brand-hover` | `#E6BE00` | `#FFE14D` | `#E04D00` / `#FF8C42` |
| `--accent-brand-text` | `#8A6D00` | `#FFD60A` | — |
| `--accent-brand-line` | `#E6BE00` | `#FFD60A` | — |
| `--accent-disco` (renombra `--accent-cyan-disco`) | `#1C1C1E` | `#F2F0E6` | `#005AD7` / `#33EBFF` |
| `--accent-disco-hover` | `#3A3A3F` | `#FFFFFF` | `#0045B5` / `#80F3FF` |
| `--text-on-brand` (renombra `--text-on-orange`) | `#1C1C1E` | `#141416` | `#FFFFFF` / `#090A0C` |
| `--text-on-disco` (renombra `--text-on-cyan`) | `#FBFAF4` | `#141416` | `#FFFFFF` / `#090A0C` |
| `--accent-error` | `#E5484D` | `#FF6369` | `#FF3B30` / `#FF453A` |
| `--bg-btn-secondary` | `#F3F1E8` | `#2A2A2F` | `#F2F2F7` / `#1E222A` |
| `--glow-brand` (renombra `--glow-orange`) | `rgba(255,214,10,0.25)` | `rgba(255,214,10,0.18)` | `rgba(255,94,0,0.12)` / `0.25` |
| `--glow-disco` (renombra `--glow-cyan`) | `rgba(var(--shadow-rgb),0.18)` | `rgba(var(--shadow-rgb),0.18)` | `rgba(10,132,255,0.12)` / `0.25` |

Hacen falta tokens nuevos que no existían, por la regla de §3:

- `--accent-brand-text`: el acento usado **como color de texto**. `#8A6D00` en claro, `#FFD60A`
  en oscuro.
- `--accent-brand-line`: el acento usado **como borde o raya** (borde izquierdo de la fila
  seleccionada, borde del checkbox tildado). `#E6BE00` en claro, `#FFD60A` en oscuro. En claro
  el amarillo puro sobre blanco se pierde.
- `--accent-brand-hover`: `#E6BE00` en claro, `#FFE14D` en oscuro.
- `--accent-disco*`: tinta/tiza para el botón de sincronizar con disco.

El renombre de `--accent-orange` es el motivo de §1: el nombre de una variable no puede llevar el
color, o cambiar el color obliga a tocar todas las hojas.

### 6.2 Decisiones de UI que salieron del mock

- **Filas seleccionadas y la que se está bajando van resaltadas**: fondo amarillo translúcido
  (`rgba(255,214,10,.2)` en claro, `.08` en oscuro) y borde izquierdo `--accent-brand-line`. Hoy
  llevan un tinte naranja al 3% que casi no se ve (`styles/list.css`, `.video-item.selected` y
  `.bajando`).
- **"Re-escanear" pasa a la botonera de abajo.** Hoy es un 🔄 suelto en la barra de filtros
  (`#ui-btn-rescan`). Va como botón **secundario con su nombre** ("🔄 Re-escanear"), a la
  izquierda de "Agregar N clases a la fila 📥", y el amarillo queda sólo para la acción
  principal. Los dos botones bajan a 12 px para entrar en una sola línea. En "Fila de descarga"
  no aparece: ahí la botonera la ocupan los controles de la descarga.
- **Los chips de la fila van en columnas fijas.** La fila pasa de `flex` a grilla
  (`14px 14px minmax(0,1fr) 68px 80px`): checkbox, tipo, título, materia, estado. Así el chip de
  materia (Anatomía, Biología…) y el de estado (Descargado, Pendiente…) caen en la misma columna
  en todas las filas, sin importar el largo del título o del estado. **Costo**: el título tiene
  menos lugar y se corta antes; el nombre completo sigue en el `title` de la fila.
- **El botón de "sincronizar disco" deja el azul.** `--accent-cyan-disco: #005AD7` es
  exactamente el color de Ramón Net como portal. Pasa a tinta en claro y a tiza en oscuro.
- El verde de "Descargado" (`--accent-green`) no se tocó: es semántico, no de marca.

## 7. Qué falta para aplicarlo

Orden ejecutado en el plan 26 (identidad) y plan 27 (UI):

1. [x] `styles/variables.css`: los tokens de §6.1, con el renombre `--accent-orange` →
   `--accent-brand` en todas las hojas (`grep -rn "accent-orange\|text-on-orange" styles popup`).
   Recordar las variantes `-rgb` (`--accent-orange-rgb`) y los `--glow-*`.
2. [x] `public/icons/icon{16,48,128}.png`: exportarlos desde `docs/marca/logo.svg`; revisar el de 16
   a ojo.
3. [x] `entrypoints/popup/index.html`: el `<h4>` del header pasa al wordmark de §5 (y cargar
   Bricolage Grotesque **empaquetada**, no desde Google Fonts: el popup no debería depender de
   la red para dibujar su nombre).
4. [ ] Las decisiones de §6.2, cada una en su hoja (`list.css`, `filters.css`, `footer.css`,
   `actions.css`) y el footer en `popup.js`. Van a verificación en navegador: casi todo cae en
   `popup.js`, que la suite no ve (ADR-0005). *(Plan 27)*
5. [x] `backend/config.js`: la carpeta por defecto `Downloads/RamonNet_Turbo`, **sin romper** a quien
   ya la tenga (ver el aviso de `AGENTS.md` sobre `config_usuario.json`).
