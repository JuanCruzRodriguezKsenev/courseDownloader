# Plan — Classroom corte 1: no listar adjuntos a medio hidratar

Rama: `classroom-corte-1` (ya creada, con `docs/plan-classroom-corte-1-abrir-todos.md` ejecutado y
commiteado). Cierra el hallazgo 🔴 de `docs/ramas-en-revision.md` §En revisión, **el último que queda
abierto antes del merge**. No hay spec asociada: esto es un defecto del corte 1, no funcionalidad
nueva — la spec de `docs/specs/classroom-destino/` es del corte 2 y no se toca acá.

El otro hallazgo de la Verificación B (Novedades, 🟡) **no entra**: tres diagnósticos escritos, los
tres falsos, y M-6 lo dejó sin causa identificada. Espera a M-6c.

---

## 0. Lo medido que este plan da por hecho

**El defecto** (`docs/ramas-en-revision.md`, hallazgo 🔴): el paso 7 del escaneo
(`sitio/google-classroom/scraper.js:297-305`) se da por satisfecho en cuanto el `li` tiene un
`[data-attachment-id]`. Ese contenedor existe **antes** de que Classroom resuelva el material, y en
esa ventana el `<a>` de adentro lleva `href="https://drive.google.com/open?id=<id>"` y
`aria-label="Archivo adjunto: Desconocido: Archivo de Drive"`. `clasificarAdjunto` no matchea
`/file/d/` → cae al fallback de `:181` → el adjunto se guarda como **acceso `.md`** y el PDF no se
baja nunca. Evidencia: G22, "Pautas … Laboratorio obligatorio N° 1", Drive id
`1in-jsGjewUb4130B4A9NW1aLembqJWml` → `Archivo adjunto_ Desconocido_ Archivo de Drive.md`.
**Intermitente**: el mismo ítem, re-escaneado sin tocar código, salió bien.

**Los dos textos del placeholder son los defaults de la propia Classroom, no una lectura nuestra.**
En el bundle capturado en `docs/muestras/google-classroom/c3/g22.har` está literal:

```js
_.Zi(a,5) ? (h=_.Zi(a,5), this.description=_.wkd(h)) : (vkd(), this.description="Desconocido");
this.name || (this.name = "Archivo de Drive");
```

O sea: `description` y `name` caen a esos literales **cuando el material todavía no resolvió**, y el
`aria-label` se arma como `Archivo adjunto: <description>: <name>`. Son cadenas **localizadas**, así
que no sirven de señal. La señal estable es el **href**: resuelto = `/file/d/<id>/view`, sin resolver
= `open?id=<id>`.

**El predicado del href no da falsos positivos sobre nada de lo medido.** Barrido de las 62 muestras
HTML de `docs/muestras/google-classroom/**` (8 cursos × Trabajo en clase + Novedades + recorridos,
excluida `sonda-sw/`), agrupando por `data-attachment-id`:

| | |
|---|---|
| adjuntos (ids distintos) | **1004** |
| sin ningún `a[aria-label][href]` adentro | **0** |
| con todas sus anclas en `open?id=` | **0** |

**Un mismo `data-attachment-id` aparece en varios `div` anidados** (muestra C1: 21 `div` para 15
ids), y las anclas de un mismo id coinciden en `aria-label` y `href` (verificado id por id en C1).
Por eso el predicado va **por id de adjunto**, no por `div`: alcanza con que una de sus anclas esté
resuelta.

**El fallback de `:181` produjo exactamente un archivo en toda la Verificación B, y fue este
defecto.** De los 55 `.md` que quedaron en `~/Descargas/verificacion-b`, 54 salen de las ramas
específicas (video de Drive, YouTube, `Vínculo a`, docs.google) y el que sobra es
`Archivo adjunto_ Desconocido_ Archivo de Drive.md`.

**Decisiones del dueño (2026-09-16 y 2026-09-21)**: la espera exige adjuntos **resueltos**, no
presentes; lo que siga sin resolver al vencer el tope **se descarta** (nunca se lista un placeholder)
y la lista se muestra igual, **con un aviso no bloqueante arriba**. Sin reintento: se espera al tope
y se descarta.

**Restricción que condiciona todo el paso 1**: `escanearListado` se inyecta **serializada**
(`popup.js`, `executeScript({ func: portal.escanearListado })`, sin `args`). Todo lo nuevo va
**adentro** de la función, sin constantes de módulo ni closures. Lo vigila `sitio/inyeccion.test.js`.

---

## 1. Radio de impacto

| Qué cambia | Quién más lo construye o lo lee |
|---|---|
| El paso 7 y los lectores (pasos 8 y 9) de `escanearListado` | Lo inyecta `popup.js` sin argumentos (usa los defaults de `tiempos`). Lo entrega `sitio/google-classroom/config.ts` (`get escanearListado`, **sin cambios**). Lo prueban `sitio/google-classroom/scraper.test.js` (11 tests, `TIEMPOS_TEST` en `:11-18`) y `sitio/inyeccion.test.js` (forma serializable). |
| `tiempos` gana `hidratacion` | `TIEMPOS_TEST` lo tiene que ganar también, o la espera nueva corre con el default de 10 s dentro de los tests. Lo usan los 11 tests, incluido el 8 con `{ ...TIEMPOS_TEST, pintado: 5000 }` (`:200`). |
| `ResultadoEscaneo` gana `adjuntosSinResolver?` | `core/puertos/sitio.ts:105-128`. Lo implementan los **tres** portales (`sitio/ramonnet/`, `sitio/anatomy-by-chris/`, `sitio/google-classroom/`); los otros dos no lo devuelven y `undefined` tiene que leerse como 0. Lo consume sólo `popup.js`. |
| `popup.js`: estado nuevo + `ctx.nota` en el view-model | El view-model lo consume `popup/features/listaClases.preact.js` (`ListaClases.render`), probado en `popup/features/listaClases.preact.test.js`. `renderizarListadoInterfaz` se llama desde ~12 lugares (`:710`, `:736`, `:753`, `:1074`, `:1186`, `:1304`, `:1361`, `:1393`, `:1511`, `:1745`, y los callbacks del propio vm): la nota tiene que sobrevivir a **cualquiera** de esos repintados, así que vive en una variable del closure y se deriva en cada render, igual que `escaneoMuerto`. |
| La región `#ui-list` muestra algo nuevo | `docs/alertas-y-bloqueo-diseno.md` §1 declara **tres** contenidos excluyentes para esa región. La nota **no es un cuarto dueño**: la pinta la misma isla, dentro de `modo:'lista'`, igual que `.cola-divisor` y `.cola-sin-resultados` (`listaClases.preact.js:258-265`). Ese §1 se actualiza en este mismo cambio. |
| `styles/list.css` | Sólo suma una regla junto a `.cola-sin-resultados` (`:152-159`). Ningún otro CSS toca `#ui-list`. |

**Lo que este plan NO puede usar**: `ResultadoEscaneo.aviso` (`core/puertos/sitio.ts:127`) **reemplaza
el listado** — `popup.js:1381-1396` corta, pinta la tarjeta `motivo:'portal'` y restaura la lista
anterior. Un adjunto roto de 57 dejaría los otros 56 sin mostrarse. Y el otro canal no bloqueante,
`#ui-msg-status`, está con `display:none` (`entrypoints/popup/index.html:134`) y destaparlo es deuda
🔴 aparte (`docs/TECHNICAL_DEBT.md` §La línea de estado del footer es invisible): **no se toca acá**,
porque lo escriben ~15 call-sites de progreso y errores que nadie revisó desde que está oculto.

---

## 2. Paso a paso

### Paso 1 — El escaneo espera adjuntos resueltos y descarta los que no lo estén

`sitio/google-classroom/scraper.js`. Todo **dentro** de `escanearListado`.

**1.a** En la tabla `tiempos` (`:25-34`), agregar `hidratacion: 10000`.

**1.b** Junto a `clasificarAdjunto` (antes de ella), dos funciones nuevas:

```js
    // Un adjunto está RESUELTO cuando su ancla ya apunta al archivo. Classroom pinta el
    // contenedor [data-attachment-id] ANTES de resolver el material: en esa ventana el ancla
    // lleva href .../open?id=<id> y un aria-label con los defaults del propio Classroom
    // ("Desconocido" / "Archivo de Drive", literales en su bundle — ver el plan). Los textos
    // están localizados; el href no, así que la señal es el href.
    function anclaSinResolver(a) {
      const href = a.getAttribute("href") || "";
      return /drive\.google\.com\/open\?id=/.test(href);
    }

    // Por ID de adjunto y no por div: un mismo data-attachment-id aparece en varios div
    // anidados (medido: 21 div para 15 ids) y alcanza con que UNA de sus anclas resuelva.
    // Devuelve los ids que siguen sin resolver.
    function adjuntosSinResolver(raiz) {
      const estado = new Map();
      for (const div of raiz.querySelectorAll("div[data-attachment-id]")) {
        const id = div.getAttribute("data-attachment-id") || "";
        if (!id) continue;
        const a = div.querySelector("a[aria-label][href]");
        const resuelto = Boolean(a) && !anclaSinResolver(a);
        estado.set(id, Boolean(estado.get(id)) || resuelto);
      }
      const sinResolver = [];
      for (const [id, resuelto] of estado) {
        if (!resuelto) sinResolver.push(id);
      }
      return sinResolver;
    }
```

Un `div[data-attachment-id]` **sin ninguna ancla** cuenta como sin resolver. Medido: 0 casos en las
62 muestras. Hoy el lector los ignora en silencio; con este cambio se los cuenta, que es lo honesto.

**1.c** Declarar `const idsSinResolver = new Set();` junto a `const itemsLeidosTrabajo = [];`
(`:238`). Esa línea ya está **fuera** del `if (!trabajoVacio)` que abre en `:240`, que es lo que hace
falta: al `Set` lo alimentan las dos vistas y lo lee el resultado.

**1.d** Paso 7 (`:297-305`): en el predicado de `esperarCondicion`, la primera rama deja de ser
`return true`:

```js
        return pendientes.every((li) => {
          if (li.querySelector("[data-attachment-id]")) {
            return adjuntosSinResolver(li).length === 0;
          }
          if (!li.querySelector("[expanded-item-id]")) return false;
          if (!expandidoDesde.has(li)) expandidoDesde.set(li, ahora);
          return ahora - expandidoDesde.get(li) >= tiempos.sinAdjuntos;
        });
```

**1.e** Paso 7b, **nuevo**, inmediatamente después de esa espera y antes del `if (!visible())` que la
sigue: una espera sobre la vista entera, porque `pendientes` sólo tiene los ítems que estaban
plegados — un ítem que ya venía abierto con un adjunto a medio hidratar no lo mira nadie.

```js
      // 7b. Los ítems que YA estaban abiertos no pasaron por `pendientes`. Esta espera es
      // sobre la vista entera y en el camino feliz cuesta 0 ms: `esperarCondicion` evalúa el
      // predicado antes de dormir.
      await esperarCondicion(
        () => adjuntosSinResolver(vistaTrabajo).length === 0,
        tiempos.hidratacion
      );
      for (const id of adjuntosSinResolver(vistaTrabajo)) idsSinResolver.add(id);
```

**1.f** Paso 9 (Novedades): **las mismas dos líneas**, con `vistaNovedades` en lugar de
`vistaTrabajo`, justo después de `await esperarQuietud(vistaNovedades)` y del `if (!visible())` que
le sigue, y antes de leer `todosStream`:

```js
      await esperarCondicion(
        () => adjuntosSinResolver(vistaNovedades).length === 0,
        tiempos.hidratacion
      );
      for (const id of adjuntosSinResolver(vistaNovedades)) idsSinResolver.add(id);
```

Novedades no tiene paso de apertura, así que ésta es su única defensa. El `Set` es el mismo, así que
un adjunto que aparezca sin resolver en las dos vistas se cuenta **una vez**.

Y una sola línea de diagnóstico, justo antes del paso 12 (la deduplicación entre vistas), cuando ya
están las dos vistas leídas:

```js
    if (idsSinResolver.size > 0) {
      console.warn("[CLASSROOM] Adjuntos sin resolver, descartados:", [...idsSinResolver]);
    }
```

Sale por la consola **de la pestaña de Classroom**, no la del popup: la función corre inyectada. Es
la única forma de saber *cuáles* se descartaron.

**1.g** En los **dos** lectores (paso 8, `:326-341`; paso 9, `:387-403`), el salteo va **entre** las
dos líneas del guard de deduplicación, y el orden no es negociable:

```js
            if (attId && vistosAtt.has(attId)) continue;
            // Ya contado en la espera; acá sólo se lo saltea para no listar un placeholder.
            // VA ANTES de marcar el id como visto: un ancla sin resolver no puede "gastar" el
            // adjunto, porque otra ancla del mismo id puede estar resuelta (un mismo
            // data-attachment-id tiene 2 o 3 anclas). Al revés, el adjunto se perdería en
            // silencio y `adjuntosSinResolver` —que mira por id— tampoco lo contaría.
            if (anclaSinResolver(a)) continue;
            if (attId) vistosAtt.add(attId);
```

**1.h** Resultado (paso 14, `:497-521`):

- La rama `enlaces.length === 0` deja de mentir cuando el curso sí tenía adjuntos:

```js
    if (enlaces.length === 0) {
      return {
        materia: "",
        enlaces: [],
        aviso:
          idsSinResolver.size > 0
            ? `Classroom no terminó de cargar los ${idsSinResolver.size} adjuntos de este curso. Dejá la pestaña al frente y re-escaneá.`
            : "Este curso no tiene archivos en Trabajo en clase ni en Novedades.",
      };
    }
```

- El retorno feliz suma el campo, y **sólo** cuando hay algo que contar:

```js
    return {
      materia: "",
      enlaces,
      credenciales: { authuser: cuenta },
      ...(idsSinResolver.size > 0 ? { adjuntosSinResolver: idsSinResolver.size } : {}),
    };
```

**1.i** Cabecera del archivo: `V1.2.0` y entrada de CHANGELOG describiendo el cambio, con la forma
que ya tienen las dos entradas de arriba (`docs/coding-standards.md`, convención de version header).

### Paso 2 — El puerto declara el campo, y en qué se diferencia de `aviso`

`core/puertos/sitio.ts`, en `ResultadoEscaneo`, **debajo** de `aviso` (para que se lean juntos):

```ts
  /**
   * [CLASSROOM CORTE 1] Cuántos adjuntos se descartaron por no haber terminado de
   * hidratarse. **No es un `aviso`**: el escaneo salió bien y la lista se muestra entera;
   * esto se pinta como una nota arriba de las filas. Un portal que no lo devuelve deja
   * `undefined`, y el consumidor lo lee como 0.
   */
  adjuntosSinResolver?: number;
```

Los otros dos portales no se tocan.

### Paso 3 — El popup guarda el número y lo pasa al view-model

`popup.js`:

**3.a** Junto a `let escaneoMuerto = null;` (`:498`), agregar
`let adjuntosSinResolverUltimoEscaneo = 0;` con un comentario de una línea: es de la corrida, no del
listado persistido, y por eso no va a `appState`.

**3.b** En `ejecutarPaso1EscaneoRamonAutomatico`, pegado al `escaneoMuerto = null;` de `:1207`:

```js
      adjuntosSinResolverUltimoEscaneo = 0;
```

Es el único reseteo. **No** se resetea en `mostrarListaGuardada` (`:1178`, que sí pone
`escaneoMuerto = null`): esa rama muestra **la misma lista** a la que el número pertenece, y al abrir
el popup la variable ya vale 0 de todas formas.

**3.c** En el callback del escaneo, después del `return` de `resultado.aviso` (`:1396`) y antes de
`const enlaces = resultado.enlaces;`:

```js
            adjuntosSinResolverUltimoEscaneo = resultado.adjuntosSinResolver || 0;
```

**3.d** En `renderizarListadoInterfaz`, dentro del `ctx` de `ListaClases.render({ modo: 'lista', … })`
(`:1969`), un campo más:

```js
          // [CLASSROOM CORTE 1] La nota de adjuntos descartados. Sólo en Disponibles: es del
          // escaneo, y la Fila no tiene nada que ver con él — el mismo recorte que hace
          // `escaneoMuertoDominaLaPestaña`. Texto fijo con un número: no lleva nada scrapeado,
          // así que no hay nada que escapar.
          nota:
            appState.pestañaActiva === "disponibles" && adjuntosSinResolverUltimoEscaneo > 0
              ? `⚠️ ${adjuntosSinResolverUltimoEscaneo} ${adjuntosSinResolverUltimoEscaneo === 1 ? "adjunto no terminó" : "adjuntos no terminaron"} de cargar y ${adjuntosSinResolverUltimoEscaneo === 1 ? "quedó" : "quedaron"} afuera. Probá Re-escanear 🔄.`
              : null,
```

La nota **no trae botón propio**: la acción ya existe y es `#ui-btn-rescan` en la toolbar
(`entrypoints/popup/index.html:96`). Es la regla de `docs/alertas-y-bloqueo-diseno.md` §3 — la alerta
dice qué pasa, el botón dice lo que hace.

**3.e** Entrada nueva en el CHANGELOG de la cabecera de `popup.js`, con la forma de las que ya están.

### Paso 4 — La isla pinta la nota arriba de las filas

`popup/features/listaClases.preact.js`, en el render de `modo:'lista'` (`:250-265`). La nota es **un
hijo más de la lista**, no una card: entra en las **dos** salidas del render.

```js
  const { items, ctx } = vm;
  const filas = items.map((clase) => html`<${FilaClase} key=${clase.id} clase=${clase} ctx=${ctx} />`);
  // [CLASSROOM CORTE 1] La nota del escaneo va DENTRO de la lista, como `.cola-divisor`: la
  // región sigue teniendo un solo dueño (esta isla) y un solo `if`, que es la regla de
  // `docs/alertas-y-bloqueo-diseno.md` §1. Texto plano: no usa dangerouslySetInnerHTML.
  const nota = ctx.nota ? html`<p class="lista-nota" key="nota">${ctx.nota}</p>` : null;

  if (!ctx.anclaActiva || filas.length === 0) return nota ? [nota, ...filas] : filas;

  const divisor = …;
  const resto = …;
  return nota ? [nota, filas[0], divisor, ...resto] : [filas[0], divisor, ...resto];
```

Actualizar también el bloque de cabecera que enumera las formas del view-model (`:31-32`) y su
version header.

### Paso 5 — El estilo

`styles/list.css`, junto a `.cola-sin-resultados` (`:152-159`), con las variables que ya usa el
archivo — sin colores nuevos:

```css
/* [CLASSROOM CORTE 1] Nota del escaneo arriba de las filas: algo quedó afuera, pero la lista
   sirve. No es una .info-card (ésa ocupa la región entera y taparía el listado). */
.lista-nota {
  margin: 0 0 var(--space-xs);
  padding: var(--space-sm);
  border-left: 3px solid var(--accent-orange);
  background-color: rgba(var(--accent-orange-rgb), 0.06);
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  color: var(--text-muted);
  flex-shrink: 0;
}
```

Las siete variables están verificadas en `styles/variables.css`: `--accent-orange` (`:11`),
`--accent-orange-rgb` (`:28`), `--radius-xs` (`:49`), `--text-sm` (`:57`), `--space-xs` (`:68`),
`--space-sm` (`:69`) y `--text-muted` (`:6`); las dos que cambian por tema se redefinen en `:114` y
`:117`. **No** se inventa ningún literal de color: el precedente del naranja de acento sobre un fondo
al 3-6 % es `.video-item.bajando` (`styles/list.css:122-125`).

### Paso 6 — Tests

**Qué prueba qué, y qué no.** 7b (1.e/1.f) es la red que atrapa **todos** los casos: corre sobre la
vista entera, después del paso 7. El cambio del predicado del paso 7 (1.d) **no agrega un caso
nuevo** — agrega presupuesto: en la fase de apertura la espera vale `abrirTodos` (30 s) contra los
`hidratacion` (10 s) de 7b, así que un adjunto que tarde 12 s en resolver lo salva 1.d y no 7b. Por
eso **ningún test aísla 1.d**: cualquier caso que lo ejercite lo salvaría igual 7b. Lo que sí lo
cubre es el **test 4 existente** ("abre el ítem plegado y trae su adjunto"), que pasa por ese
predicado y tiene que seguir en verde.

**6.a** `sitio/google-classroom/scraper.test.js`. `TIEMPOS_TEST` gana `hidratacion: 200`. Dos tests
nuevos, **sin tocar el fixture** (lo comparten los 11 tests existentes): el DOM se muta después de
`prepararDom()`, igual que `prepararDom` ya hace con el ítem plegado y el "Ver más". El `li` que
agregan va **ya abierto** (`aria-expanded="true"`), que es justo el caso que `pendientes` no mira.

- **Test 12 — "espera a que el adjunto se hidrate y lo lista como archivo, no como acceso .md"**:
  después de `prepararDom()`, agregar a la región "Tema Trabajos Practicos" un `li` nuevo
  (`data-stream-item-id="tp-lento"`, con su `div[role="button"][aria-expanded="true"]` y
  `aria-label`) cuyo `div[data-attachment-id="att-lento"]` arranque con
  `<a aria-label="Archivo adjunto: Desconocido: Archivo de Drive" href="https://drive.google.com/open?id=drive-lento">`,
  y un `setTimeout(…, 50)` que le reescriba `aria-label` a `Archivo adjunto: PDF: Lento.pdf` y `href`
  a `https://drive.google.com/file/d/drive-lento/view`. Afirmar: sale **un** enlace con
  `texto === "Lento.pdf"` e `idArchivo === "drive-lento"`, **no** hay ningún enlace cuyo texto
  empiece con `"Archivo adjunto"`, y `resultado.adjuntosSinResolver` es `undefined`.
  **Este test falla con el código de hoy**, que lista el placeholder: es el que fija el defecto.
- **Test 13 — "el adjunto que nunca resuelve se descarta y se cuenta"**: el mismo `li`, sin el
  `setTimeout`. Afirmar: `resultado.adjuntosSinResolver === 1`, ningún enlace con texto que empiece
  con `"Archivo adjunto"`, y que los enlaces del resto del fixture **siguen estando** (comparar
  contra la cuenta del test 1, que es el mismo escaneo sin el `li` agregado). Con `hidratacion: 200`
  este test cuesta ~200 ms; con el default de 10 s colgaría la suite, así que si `TIEMPOS_TEST` no
  llegó a tener la clave, se ve acá.

**6.b** `popup/features/listaClases.preact.test.js`: **un** test — con `ctx.nota` en el view-model de
`modo:'lista'`, aparece un `.lista-nota` con ese texto **antes** de la primera `.video-item`
(`root.firstElementChild`), y sin `nota` no hay ningún `.lista-nota`. Usar `ctxBase({ nota: … })`.

**6.c** Total **+3 tests**: 716 → **719**, 43 archivos (ninguno nuevo).

### Paso 7 — Docs

- `docs/testing.md` §Baseline: 716 → **719**, con su párrafo "De dónde sale el 719" en el mismo
  formato que los de arriba (+2 en `sitio/google-classroom/scraper.test.js`, +1 en
  `popup/features/listaClases.preact.test.js`).
- `docs/portal-google-classroom-diseno.md`: en su §8 (resultados), una entrada con el predicado del
  href, la cita del bundle (`this.description="Desconocido"` / `this.name || "Archivo de Drive"`) y
  la tabla del barrido (1004 adjuntos, 0 sin ancla, 0 con `open?id=`). Es la medición que justifica
  el arreglo; el hogar canónico de las mediciones de este portal es ese doc.
- `docs/alertas-y-bloqueo-diseno.md` §1: bajo la tabla de los tres contenidos excluyentes, una
  aclaración de dos líneas — la lista puede llevar adentro elementos que no son filas
  (`.cola-divisor`, `.cola-sin-resultados`, `.lista-nota`), y eso **no** rompe la regla porque los
  pinta la misma isla en el mismo `if`. Sin esto, el próximo que lea §1 va a leer la nota como una
  violación.
- `docs/ramas-en-revision.md`: el hallazgo 🔴 pasa a la lista de **Hecho** de la sección de la rama,
  nombrando este plan. El 🟡 de Novedades queda donde está.
- Version headers y CHANGELOG de cada archivo tocado (`docs/coding-standards.md`).

---

## 3. Lo que no se toca

- **`#ui-msg-status`** y su `display:none`. Es deuda 🔴 propia, con ~15 call-sites sin revisar.
- **El mecanismo `aviso`/`escaneoMuerto`** y la tarjeta `motivo:'portal'`: siguen igual, para las
  cinco salidas de corte que ya los usan.
- **`sitio/ramonnet/` y `sitio/anatomy-by-chris/`**: no devuelven el campo nuevo y no lo necesitan.
- **`verificacion/modoVerificacion.js`** (banco de pruebas): no se le agrega un forzado para la nota.
  Queda anotado como hallazgo si a quien ejecuta le resulta barato; no es parte de este plan.
- **El hallazgo 🟡 de Novedades**: ni código ni doc, más allá de dejarlo donde está.
- **`clasificarAdjunto` y su fallback de `:181`**: el fallback sigue existiendo para los tipos de
  vínculo que sí resuelven y no matchean ninguna rama específica. Lo que cambia es que ya no le
  llegan placeholders.

---

## 4. Verificación

La compuerta entera, con la salida **pegada** en el reporte (no descrita):

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Esperado: **43 archivos, 719 tests** en verde; lint sin errores **ni warnings**; `tsc` sin salida;
build a `.output/chrome-mv3/`.

Y estas tres, que los tests no pueden dar:

```bash
# 1. El campo nuevo viaja al bundle que se carga en el navegador.
grep -c "adjuntosSinResolver" .output/chrome-mv3/chunks/popup-*.js

# 2. Nada del scraper quedó fuera de la función inyectada (constante de módulo = SyntaxError
#    en la pestaña, que es el defecto de scraper.js:19 de la Verificación B).
pnpm exec vitest run sitio/inyeccion.test.js

# 3. El diff es el plan y nada más.
git diff --stat
```

**En Brave, con la extensión recargada** (checklist manual, la hace el dueño):

1. G22 → Trabajo en clase, pestaña **al frente**, Re-escanear 🔄. Esperado: 57 adjuntos, **ningún**
   archivo cuyo nombre empiece con `Archivo adjunto`, y la nota **no** aparece.
2. Consola **de la pestaña de Classroom** (no la del popup): con todo bien no hay ninguna línea
   `[CLASSROOM] Adjuntos sin resolver`. Si aparece, anotar los ids: son los que se descartaron.
3. Repetir en G25 (el curso con Novedades larga) y confirmar que la cuenta no bajó respecto de la
   Verificación B del 2026-09-16.

La rama del descarte **no es forzable a mano** (depende de que Classroom no resuelva): la cubren los
tests 13 y el de la isla. No inventar una verificación de navegador para ella.

---

## 5. Qué tiene que traer el reporte

- La salida cruda de los cuatro comandos de la compuerta y de los tres de arriba.
- El `git diff --stat` completo.
- Cualquier cosa que se haya visto y **no** hecho porque el plan no la nombraba, como hallazgo
  aparte — sobre todo si al tocar `scraper.js` aparece algo del hallazgo 🟡 de Novedades.
- Si algún paso no se pudo hacer como está escrito, **qué** se hizo en su lugar y por qué.
