# Ramas en revisión

**Hogar canónico del estado del trabajo en curso que todavía no está en `main`.**

Este doc existe para que ese estado deje de vivir en `CLAUDE.md`. Es información con fecha de
vencimiento: cambia con cada merge, y mientras vivió en el banner de `CLAUDE.md` lo hizo cambiar
en 85 de los últimos 187 commits. Acá se edita sin tocar el archivo que se carga en cada sesión.

**Lo que este doc NO es:**

- No es el backlog. Los ítems abiertos viven en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- No es la baseline de la compuerta. Los números viven en `docs/testing.md` §Baseline.
- No es el diseño de nada. Cada rama apunta al doc que explica lo que construye.

Cuando la última rama se mergee o se descarte, este doc queda con la sección «Nada en revisión»
y nada más. No hace falta borrarlo.

---

## Estado al 2026-08-12

`main` está al día y verificado. El **segundo portal** (Anatomy by Chris) y el **escaneo por
API** cerraron el 2026-08-07; la **fusión del backend** (ADR-0015) el 2026-08-12.

### Las cinco ramas que se mergean, en orden

| # | Rama | Sale de | Qué trae |
|---|---|---|---|
| 1 | `copy-generico-corte-1` | `main` | La UI genérica deja de hablar el vocabulario de Ramón Net (6 textos, 11 sitios + 2 `console.log`) |
| 2 | `copy-generico-corte-2` | la 1 | `instruccionEscaneo` en `PuertoSitio` (11 → **12 miembros**) |
| 3 | `banner-ocupa-lista-y-toolbar` | `main` | El banner deja de reescribirse en el botón y en el footer; la toolbar se bloquea en vez de esconderse |
| 4 | `banner-en-el-contenedor` | la 3 | **La alerta comparte contenedor con las listas** + el bloqueo real (`disabled`) + 4 arreglos de layout |
| 5 | `seleccion-sigue-a-los-filtros` | `main` | Lo que se filtra, se deselecciona |

- Las cinco tienen **la compuerta en verde**; el desglose de la cuenta combinada está en
  `docs/testing.md` §Baseline.
- **Ninguna está verificada en Chrome**, que acá es la única verificación que ve algo: casi todo
  cae en `popup.js` y en el CSS, sin tests por ADR-0005.
- Las 1↔2 y 3↔4 están apiladas. Las tres cabeceras se van a pisar en `popup.js` y en
  `serverConnection.js` — son **conflictos de contexto, no de lógica**.

### La sexta rama, que NO se mergea

`copy-generico-verificacion` junta las cinco **más un banco de pruebas** (🧪 en la cabecera del
popup, o **F9**) que fuerza las caídas de servidor e internet, la cola pausada en sus 5 tipos, el
escaneo vacío/colgado, y **graba los carteles que duran milisegundos**.

- El build de `.output/chrome-mv3/` es el de esa rama: **recargar, no rebuildear**.
- Después de la pasada, la rama se descarta entera.

### Las checklists ya están escritas

No hay que reconstruirlas:

- `docs/copy-generico-diseno.md` §7 «EN REVISIÓN» — 6 puntos, con qué se espera y qué sería un bug.
- `docs/alertas-y-bloqueo-diseno.md` §5 — qué mirar del frente de alertas, y el banco de pruebas.

### Lo que el frente de alertas dejó abierto

La auditoría de los loaders y los estados de carga dejó **cinco ítems sin arreglar**. El estado
está en `docs/TECHNICAL_DEBT.md` §🔴 Abierto y el detalle técnico en
`docs/alertas-y-bloqueo-diseno.md` §6.

El que se ve todos los días: **el timeout del escaneo salta siempre en Anatomy** —6 s de tope
contra ~11 s de escaneo— y muestra un error falso que después se borra solo.
