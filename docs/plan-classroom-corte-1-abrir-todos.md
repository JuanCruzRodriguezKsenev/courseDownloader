# Plan — Classroom corte 1: abrir todos los ítems de una

Rama: `classroom-corte-1`. **Se ejecuta después de** `docs/plan-classroom-corte-1-lista-guardada-y-explorar.md`
(con ése ya commiteado y el árbol limpio). Decidido por el dueño el 2026-09-13: entra antes del merge.

## 0. Lo medido que este plan da por hecho

- **Hoy el escaneo abre los ítems de a uno** (`sitio/google-classroom/scraper.js:281-298`, paso 7):
  por cada `li[data-expandable-row-id]` sin `[data-attachment-id]` hace `click()` y **espera** a
  que aparezca un adjunto, o a que el ítem lleve `tiempos.sinAdjuntos` (1500 ms) mostrando
  `[expanded-item-id]`, con techo `tiempos.abrir` (8000 ms) por ítem. M1 midió ~555 ms por ítem
  con adjuntos (`docs/portal-google-classroom-diseno.md` §8). Con los 49 ítems de Física II G22,
  sólo esta fase son 30 a 70 s.
- **M5 (2026-09-13, consola de Brave del dueño, Física II G22, "Trabajo en clase")**: con la página
  recién cargada y los "Ver más" agotados, `click()` a los 49 botones con `aria-expanded="false"`
  **en el mismo tick** y esperar 3 s de quietud en la cuenta de `[data-attachment-id]`:
  **5529 ms, 57 adjuntos, 49 de 49 ítems abiertos.** La corrida de a uno (800 ms entre clics)
  había contado 56. Classroom no cierra un ítem al abrir otro.
- Al abrir cada ítem, Classroom pide su detalle por `batchexecute` `t51ITc` (medición C3); abrir
  todos dispara esos ~49 pedidos a la vez y no perdió ninguno.
- **La función se inyecta serializada** (`popup.js`, `executeScript({ func: portal.escanearListado })`,
  sin `args`): todo lo nuevo va **dentro** de `escanearListado`, sin constantes de módulo. Lo
  vigila `sitio/inyeccion.test.js`, que sólo ve la forma, no los closures (`AGENTS.md`, bullet de
  `Scraper.escanearAulaVirtual`).

## 1. Radio de impacto

| Qué cambia | Quién más lo construye o lo lee |
|---|---|
| El paso 7 de `escanearListado` y la tabla `tiempos` | Lo inyecta `popup.js` sin argumentos (usa los defaults de `tiempos`). Lo entrega `sitio/google-classroom/config.ts` (`get escanearListado`, sin cambios). Lo prueban `sitio/google-classroom/scraper.test.js` (usa `TIEMPOS_TEST`, `:11-18`, y el test 4 "abre el ítem plegado", `:130`) y `sitio/inyeccion.test.js`. |
| `TIEMPOS_TEST` gana `abrirTodos` | Lo usan los 10 tests de `scraper.test.js`, incluido el 8 con `{ ...TIEMPOS_TEST, pintado: 5000 }` (`:200`). |

El fixture (`sitio/google-classroom/__fixtures__/curso.html`) tiene **un solo** ítem plegado sin
adjunto (`item-plegado`, `aria-expanded="false"`, `:68-69`); todos los demás ya traen
`[data-attachment-id]` y el paso 7 los saltea. No se toca el fixture.

## 2. Paso a paso

### Paso 1 — El paso 7 abre todo y espera una vez

`sitio/google-classroom/scraper.js`:

1. Banner `V1.0.0` → `V1.1.0`, con CHANGELOG: `[CLASSROOM CORTE 1 — ABRIR TODOS] El paso 7 abre
   todos los ítems plegados en el mismo tick y espera una sola vez a que resuelvan todos. Medido
   (M5): 49 ítems en ~5,5 s con 57 adjuntos, contra 30–70 s de a uno.`
2. En la tabla `tiempos` (`:20-28`), agregar **`abrirTodos: 30000`** debajo de `abrir`. `abrir`
   queda en la tabla sin lectores: **no** se borra, para no cambiar la forma de `opciones.tiempos`.
3. Reemplazar el bloque `// 7. Abrir los ítems` (desde `const itemsExpandibles = …` hasta el `}`
   que cierra el `for`, hoy `:281-298`) por:

```js
      // 7. Abrir los ítems — TODOS en el mismo tick, y una sola espera (M5, 2026-09-13).
      // Classroom no cierra un ítem al abrir otro y resuelve los ~N pedidos de detalle a la vez.
      // Sólo se hace click en los plegados: un click sobre uno ya abierto lo cerraría.
      const pendientes = Array.from(
        vistaTrabajo.querySelectorAll("li[data-expandable-row-id]")
      ).filter((li) => !li.querySelector("[data-attachment-id]"));
      for (const li of pendientes) {
        const btn = li.querySelector('div[role="button"][aria-expanded="false"]');
        if (btn) btn.click();
      }
      const expandidoDesde = new Map();
      await esperarCondicion(() => {
        const ahora = Date.now();
        return pendientes.every((li) => {
          if (li.querySelector("[data-attachment-id]")) return true;
          if (!li.querySelector("[expanded-item-id]")) return false;
          if (!expandidoDesde.has(li)) expandidoDesde.set(li, ahora);
          return ahora - expandidoDesde.get(li) >= tiempos.sinAdjuntos;
        });
      }, tiempos.abrirTodos);
```

La línea siguiente (`if (!visible()) return avisoVisibilidad;`) y el paso 8 **quedan igual**.

### Paso 2 — Tests

`sitio/google-classroom/scraper.test.js`:

1. `TIEMPOS_TEST` (`:11-18`): agregar `abrirTodos: 1000,`.
2. **+1 test**, al final del `describe`: `it("11. abre todos los ítems plegados antes de que cargue el primero", …)`.
   - Después del `prepararDom()` del `beforeEach`, clonar `li[data-stream-item-id="item-plegado"]`
     dos veces con ids `item-plegado-2` / `item-plegado-3` (y `data-expandable-row-id`
     `row-plegado-2` / `row-plegado-3`), su botón con `aria-expanded="false"` y `aria-label`
     `Material Plegado 2` / `Material Plegado 3`, y agregarlos a la misma región que el original.
   - A cada clon, un listener de `click` que empuje `Date.now()` a un array `clics` y, a los
     **60 ms** (`setTimeout`), ponga `aria-expanded="true"`, agregue
     `<div data-attachment-id="att-plegado-N"><a aria-label="Archivo adjunto: PDF: PlegadoN.pdf" href="https://drive.google.com/file/d/drive-plegado-N/view"></a></div>`
     y empuje `Date.now()` a un array `cargas`.
   - Correr `ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST })`.
   - Esperar: `clics.length === 2`; `Math.max(...clics) < Math.min(...cargas)` (con el código
     viejo, el segundo clic llega **después** de la primera carga y esto falla); y en `res.enlaces`
     están `drive-plegado`, `drive-plegado-2` y `drive-plegado-3`.

**Contraste obligatorio antes de dar el test por bueno**: correrlo una vez contra el paso 7
**viejo** (`git stash` sólo de `scraper.js`, o comentando el bloque nuevo) y confirmar que **falla**
por la aserción de tiempos. Pegar esa salida en el reporte. Después volver al código nuevo.

### Paso 3 — Docs

1. `docs/portal-google-classroom-diseno.md` §8, al final: `### M5 (2026-09-13) — abrir todos los
   ítems de una`, con los números del §0 (5529 ms, 57 adjuntos, 49/49, contra 56 de a uno) y la
   consecuencia: el paso 7 del scraper abre todo y espera una vez. Va **después** de la última
   sección que hay hoy, `### Verificación B (2026-09-13) — re-escaneo al abrir y Explorar`.
2. `docs/testing.md` §Baseline: **43 archivos, 716 tests** (los 715 que dejó el plan anterior
   +1), con su párrafo "De dónde sale el 716" arriba del del 715, nombrando `scraper.test.js` (+1).
3. `docs/ramas-en-revision.md`: en `classroom-corte-1`, bullet **Hecho** con este plan.

## 3. Lo que no se toca

- El resto de `escanearListado`: pasos 1 a 6 (incluido el bucle de "Ver más"), 8 a 12, y Novedades.
- `sitio/google-classroom/config.ts` (ni `topeEscaneoMs` ni `instruccionEscaneo`: la duración del
  escaneo entero todavía no está medida con este cambio).
- El fixture `curso.html`, `prepararDom` y los tests 1 a 10.
- `popup.js` y todo lo que el plan anterior tocó.

## 4. Verificación

**A. Automática.** Pegar la salida, no describirla.

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm exec vitest run sitio/google-classroom/scraper.test.js sitio/inyeccion.test.js
git grep -n 'abrirTodos' -- sitio/google-classroom
git grep -n 'tiempos.abrir\b' -- sitio/google-classroom/scraper.js
```

Resultado esperado:

- `pnpm test`: **43 archivos, 716 tests**, todo en verde. lint 0/0, `tsc` sin salida, build compila.
- `scraper.test.js`: **11** en verde; `inyeccion.test.js`: 4 en verde.
- `abrirTodos`: la tabla de `tiempos`, la espera del paso 7 y `TIEMPOS_TEST`.
- `tiempos.abrir\b`: **sin salida** (nadie lee ya `abrir`).
- Además, la salida del contraste del Paso 2 (el test 11 fallando contra el paso 7 viejo).

**B. En el navegador (la corre el dueño).** Build nuevo, ↻ en la extensión, backend arriba.

1. Física II G22 con 🔄: cronometrar desde el click hasta la lista. Anotar el tiempo; trae **57**.
2. Física I 2024: **130**. Fisica_II_G25_2026 (Bianchi): 71 de Trabajo en clase + hasta 28 de Novedades.
3. Seguir la checklist de `docs/ramas-en-revision.md` desde su paso 2.

## 5. Qué tiene que traer el reporte

- La salida literal de la verificación A, incluido el contraste del test 11.
- Archivos tocados, por paso.
- **Hallazgos**: lo que viste y no hiciste porque este plan no lo nombraba.
