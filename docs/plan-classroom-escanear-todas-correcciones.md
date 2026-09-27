# Plan — Classroom: correcciones del recorrido de todos los cursos

**Spec**: [`docs/specs/classroom-escanear-todas/spec.md`](./specs/classroom-escanear-todas/spec.md).
**Plan original (ya ejecutado)**: [`docs/plan-classroom-escanear-todas.md`](./plan-classroom-escanear-todas.md).
**Hallazgos que corrige**: `docs/ramas-en-revision.md` §Revisión de tanda (2026-09-27).
**Rama**: `classroom-escanear-todas`. Árbol limpio al empezar. **Fecha**: 2026-09-27.

## Lo que hay que saber antes de tocar nada

La Verificación B (tres recorridos del dueño en Brave, leídos del storage de la extensión) dio:
los archivados no entran, el primer curso falla siempre, y los cursos con material vuelven
incompletos (Física I: 1 y 7 enlaces; solo, el mismo curso trae 130). Las tres causas están
**medidas en Brave** con Claude in Chrome el 2026-09-27, con la pestaña visible:

| Medición | Resultado |
|---|---|
| M-A. Portada → click en `nav a[href$="/h/archived"]` | La URL cambia a los ~120 ms; las tarjetas de los archivados aparecen a los **~520 ms**. La vista de la portada queda montada **oculta** (`body > c-wiz[aria-hidden="true"]`) con sus 24 links `/c/`. |
| M-B. Archivadas → click en el link del curso (G22) | La URL pasa a `/c/<id>` a los ~100 ms; el link `nav` a `/w/<id>/t/all` aparece a los **~620 ms**. Antes de eso `buscarLinkNav` no lo encuentra, y el escaneo sale por la rama `!linkTrabajo` ("Classroom no terminó de abrir Trabajo en clase"). |
| M-C. Trabajo en clase, **primera visita** (Física I, pestaña recién recargada) | `[data-no-topic-items]` aparece a los 843 ms con **0** `li[data-stream-item-id]`; a los 1598 ms aparecen 11 `button[aria-label="Ver más publicaciones"]` y 11 `[role="progressbar"]`; los `li` llegan entre 2548 y 3172 ms (80). MC2: marcador solo durante ~150 ms, después 9 "Ver más" + 9 progressbar, después 14 `li`. |
| M-D. Trabajo en clase de un curso **vacío** (MC6, Q5, primera visita) | Marcador solo, **sin** "Ver más" y **sin** progressbar, y así se queda. |
| M-E. Segunda visita (vista cacheada) | Pinta de una: los `li` ya están. Por eso el escaneo de un curso suelto casi nunca lo sufre. |

**La causa de los cursos incompletos (M-C)**: `pintadoOk` (`scraper.js:339-344`) acepta
`[data-no-topic-items]` solo, y `trabajoVacio` (`:357-359`) da `true` con el marcador y 0 `li`.
El escaneo saltea Trabajo en clase entero y trae sólo Novedades. **Es un defecto latente del
corte 1**, no del recorrido: el recorrido lo dispara siempre porque entra a cada curso por
primera vez. Arreglarlo cambia el escaneo de un curso **sólo** en esa carrera, que hoy da un
resultado equivocado. RN-19 ("el escaneo de un curso queda igual") no protege un resultado
equivocado: se corrige para los dos caminos, y la entrada de CHANGELOG lo dice.

Nombres (medido sobre `docs/muestras/google-classroom/recorrido-3/00-partida.html` y
`00-archivadas.html` con un `HTMLParser` con pila de ancestros): cada tarjeta trae **tres** `a`
al curso fuera de `nav`. El primero (la imagen) no tiene texto ni `aria-label`. Los activos
tienen además un `a` en el `nav` con `aria-label` limpio ("MC2 2025", "Q5 Primer Cuatrimestre
2023"); cuando el nombre sale del texto de ése, viene con la inicial del avatar pegada
("MMC2 2025"). Los archivados no están en el `nav`; su segunda ancla trae el texto limpio
("Fisica_II_G25_2026", "MB5 2024").

## Radio de impacto

| Archivo | Qué cambia | Paso |
|---|---|---|
| `sitio/google-classroom/scraper.js` | Asentado de Trabajo en clase, espera del curso, enumeración, nombres | 1, 2, 3 |
| `sitio/google-classroom/scraper.test.js` | Tests nuevos y test 23 con poder de detección | 1, 2, 3, 4 |
| `sitio/google-classroom/__fixtures__/portada.html`, `archivadas.html` | Forma real: tres anclas por tarjeta, vista oculta | 3 |
| `core/estado/recorridoTodos.ts` (+ test) | Estado terminal en el reductor | 5 |
| `popup.js` | Botón oculto durante el recorrido, guarda de lanzamiento, tarjeta de oferta por variable | 6 |
| Docs | `ramas-en-revision.md`, `testing.md` | 7 |

**Quién más lee lo que se toca**:
- `tiempos` del scraper: los tests lo pisan con `TIEMPOS_TEST` (`scraper.test.js:13-23`). La
  clave nueva del Paso 1 **tiene que** entrar ahí con un valor chico, o el test 8 y el 22 pasan a
  tardar el valor real.
- `trabajoVacio` alimenta la rama de Novedades del mismo escaneo (`:366` en adelante): no se
  toca, sólo cambia cuándo se calcula.
- `data-modo` del botón: lo leen `popup.js:1094` (input de carpeta), `:2050` (tarjeta de
  oferta) y `:2753` (actualizador del botón). Los tres se revisan en el Paso 6.
- `sitio/inyeccion.test.js` serializa `escanearListado`: todo lo nuevo va **dentro** de la
  función, nada a nivel de módulo (`AGENTS.md`, regla de funciones inyectadas).

---

## Paso 1 — Trabajo en clase se da por pintado sólo cuando se asentó (M-C, M-D; AC-2, AC-3, AC-8)

`scraper.js`, versión **v1.4.1**, entrada de CHANGELOG que diga que corrige también el escaneo
de un curso en primera visita.

- `tiempos` gana `asentadoVacio: 2000` (ms que el marcador tiene que sostenerse solo, sin
  "Ver más" ni progressbar, para creer que el curso está vacío). Justificación: M-C midió
  ~150 ms (MC2) y ~750 ms (Física I) entre el marcador y la primera señal de carga.
- Dentro de `escanearCursoActual`, una función `trabajoAsentado(va)` que devuelve:
  - `"con-items"` si hay algún `li[data-stream-item-id]` **y** ningún `[role="progressbar"]`
    en `va`;
  - `"vacio"` si hay `[data-no-topic-items]`, 0 `li`, 0 `button[aria-label="Ver más
    publicaciones"]`, 0 `[role="progressbar"]` **y** ese estado se sostuvo `asentadoVacio` ms
    (guardar en una variable del cierre desde cuándo se ve así; cualquier cambio la resetea);
  - `null` en cualquier otro caso (sigue cargando).
- `pintadoOk` (`:339`) pasa a esperar `trabajoAsentado(obtenerVistaActiva()) !== null`, con el
  mismo `tiempos.pintado` de tope.
- `trabajoVacio` (`:359`) pasa a ser `trabajoAsentado(vistaTrabajo) === "vacio"` evaluado con
  el resultado que cortó la espera (guardarlo, no recalcular: recalcular resetea el reloj).
- La condición de `navOk` (`:321-327`) **no** cambia: sólo detecta que la vista cambió.
- `TIEMPOS_TEST` gana `asentadoVacio: 30`.

Tests (`scraper.test.js`, a partir del 25):
- 25: con `asentadoVacio: 200` en este test, una vista de Trabajo que arranca con el marcador
  solo y a los 60 ms recibe 11 `li` por un `setTimeout` que los inyecta. El escaneo trae los enlaces de esos `li` (no sale como
  "sin material"). **Control negativo**: correrlo con `pintadoOk` y `trabajoVacio` de hoy
  (`git stash` del cambio de 1) y confirmar que falla. Pegar las dos salidas.
- 26: marcador + un `[role="progressbar"]` que se quita a los 80 ms junto con la llegada de los
  `li` → trae los enlaces.
- 8 y 22 siguen pasando sin tocarlos (el marcador solo se sostiene 30 ms y sale "vacío").

## Paso 2 — Antes de escanear un curso, esperar a que esté (M-B; AC-2, AC-7)

En el recorrido, después de `llego` (`scraper.js:834-841`) y **antes** de
`escanearCursoActual()`:
- esperar con `esperarCondicion(…, tiempos.navegacion)` a que exista un `nav a[href]` cuyo
  `href` matchee `/w/<id>/t/all` (la misma regex que usa `escanearCursoActual` en `:310`).
- Si no aparece → `curso` `fallido`, `motivo: "no abrió"`, y seguir (RN-8).
- Nada de esto va dentro de `escanearCursoActual`: el escaneo de un curso arranca con el popup
  abierto sobre una página ya pintada y no lo necesita.

Test 27: el simulador de navegación (`simularNavegacionClassroom`, `:408`) gana una opción
`demoraNavMs` que monta el `nav` del curso recién a los N ms de cambiar la URL. Con
`demoraNavMs: 50` el primer curso sale `ok`. **Control negativo**: sin la espera, el primer
curso sale `fallido` con "no terminó de abrir Trabajo en clase". Pegar las dos salidas.

## Paso 3 — Enumeración: archivados completos y nombres limpios (M-A; AC-2, AC-7)

`leerCursosDePagina` (`scraper.js:760`) y su uso:
- **Leer sólo la vista activa**: la raíz de la búsqueda es la primera `body > c-wiz` sin
  `aria-hidden="true"` (el mismo criterio que `obtenerVistaActiva`, que vive dentro de
  `escanearCursoActual`: duplicar las 4 líneas afuera, en el cuerpo de `escanearListado`, antes
  del `if` de modo, o moverla ahí arriba si no cambia nada en el camino de un curso).
- **Archivadas**: después del click en `/h/archived` (`:787-793`), además de esperar la URL,
  esperar hasta **5000 ms** a que la vista activa tenga al menos un `a[href*="/c/"]` fuera de
  `nav` cuyo id **no** esté en `idsVistos`. Si no aparece ninguno, seguir con 0 archivados (un
  usuario sin cursos archivados no es un error). Constante local `esperaArchivadosMs = 5000`
  dentro del cuerpo, no en `tiempos` salvo que los tests la necesiten (entonces sí, en los dos).
- **Nombre por id**, en este orden:
  1. el `aria-label` (trim, no vacío) de **cualquier** `a` del documento cuyo href termine en
     `/c/<id>`, incluidos los del `nav` y los de vistas ocultas;
  2. si no hay, el primer `textContent` trim no vacío de un `a` fuera de `nav` **sin**
     `aria-label`;
  3. si no, el id.
  Resolverlo **después** de juntar los ids, no en el primer ancla que se ve.

Fixtures, con la forma **real** (contrastar contra `recorrido-3/00-partida.html` y
`00-archivadas.html` antes de escribirlos):
- `portada.html`: una `c-wiz` activa con, por curso, tres `a` fuera de `nav`: el primero vacío
  sin `aria-label`, el segundo con el nombre como texto, el tercero con `aria-label` y el texto
  con la inicial pegada ("FFísica II"). En el `nav`, el `a` con `aria-label` limpio y texto con
  inicial.
- `archivadas.html`: una `c-wiz` **oculta** con las tarjetas de la portada, y una `c-wiz`
  activa con las tarjetas archivadas (primer `a` vacío, segundo con texto limpio, sin
  `aria-label`). El simulador monta la activa **a los 50 ms** del click, no en el acto.

Tests:
- 19 (existente) pasa a afirmar también los nombres del `inicio`: "Física II", "Química I" y el
  del archivado, **sin** inicial pegada y sin ids.
- 28: con la demora de 50 ms en archivadas, el `inicio` trae los 3 cursos. **Control
  negativo**: sin la espera del Paso 3, trae 2. Pegar las dos salidas.

## Paso 4 — El test 23 tiene que poder fallar (hallazgo 🟡)

Hoy el curso "que nunca pinta" termina solo por el tope de pintado y no hace nada después, así
que un escaneo no cancelado no molesta. Reescribirlo para que el curso colgado **sí** haga daño
si sigue vivo:
- el hook de `CURSO123` pinta los `li` a los `topeCursoMs + 100` ms (tarde, pero pinta);
- sin cancelación, el escaneo zombi sigue hasta Novedades y hace `click()` en el `nav` de
  `CURSO123`, y el simulador reemplaza el DOM por el de `CURSO123` en medio del curso 2.
- Afirmar: el `curso` 2 sale `ok` con todos sus `modulo` empezando por el nombre del curso 2, y
  el simulador registró **cero** navegaciones a `CURSO123` después del `latido` del curso 2
  (que el simulador anote cada navegación con un sello de orden).
- **Control negativo obligatorio**: con `dormir` sin rechazar por `cancelado`, el test tiene que
  fallar. Pegar la salida. Si no falla, el test no sirve: ajustarlo hasta que falle, no dejarlo.

## Paso 5 — El reductor no revive un recorrido cerrado (hallazgo ⚪)

`core/estado/recorridoTodos.ts`, versión y CHANGELOG. En `aplicarEvento`, después del chequeo de
`idRecorrido`: si `prev.estado !== "escaneando"` y el evento es `latido`, `curso` o `fin` →
devolver `prev` sin cambios. `materializado` sigue aplicándose (es justo el que llega después
del `fin`). Tests: un `curso` y un `fin terminado` después de un `fin cortado sin-respuesta` no
cambian nada; `materializado` después de `fin` sí.

## Paso 6 — El popup durante el recorrido (pedido del dueño + hallazgos 🟡)

`popup.js`, versión y CHANGELOG.

**Decisión (tomada por la tanda, el dueño la delegó)**: durante el recorrido el botón de acción
**se oculta**. No se usa el loader del escaneo de un curso: taparía la tarjeta de progreso y el
resumen, que al dueño le sirven. La regla del botón ya existe: label vacío = sin acción =
oculto (`aplicarBotonesUX`, `popup.js:2806-2820`).

- Modo nuevo del botón, `"recorriendo"`, siempre con label `""`.
  - En `lanzarRecorridoTodos` (`:1305`), justo antes del `executeScript`:
    `configurarBotonesUX("recorriendo", "", true)`.
  - En `escanearOUsarGuardada`, rama `mostrar-recorrido` (`:1429`): lo mismo.
  - `:1094` y `:2753`: sumar `'recorriendo'` a las dos condiciones de corte temprano (las dos
    protegen al botón de que otro repintado le cambie el modo mientras dura el estado).
- **La tarjeta de oferta deja de depender del modo del botón.** Variable del cierre
  `ofreciendoTodos`, `true` en la rama `ofrecer-todos` (`:1440`), `false` en
  `lanzarRecorridoTodos` y en `aplicarEnlacesEscaneados`. `:2050` pasa a mirar
  `ofreciendoTodos`. Con eso la tarjeta "El recorrido no trajo material" (`:2064`) deja de
  quedar tapada (AC-14).
- **Al terminar sin enlaces** (rama `else` de `materializarRecorrido`): 
  `configurarBotonesUX("re-escanear", "Re-escanear 🔄", false)`. En la portada ese modo ya
  relanza el recorrido (`reescanearSegunPestaña`).
- **Guarda de la fila 1 en `lanzarRecorridoTodos`**: después de resolver la pestaña, si hay
  `recorrido` `escaneando`, vigente (`esVigente`, con el mismo tope que usa
  `escanearOUsarGuardada`) y `recorrido.tabId === tab.id` → soltar `escaneoEnCurso`,
  `renderizarListadoInterfaz()` y no inyectar. Cubre el 🔄 con la pestaña de paso por
  `/h/archived`.

Sin tests nuevos en `popup.js` (no tiene banco para esto; deuda 🔴 de popovers y loader). Lo
cubre la checklist B.

## Paso 7 — Documentación

- `docs/ramas-en-revision.md`: en §Revisión de tanda, marcar ✅ cada hallazgo que este plan
  cierra, con el paso; sumar al "Hecho por paso" una línea "Correcciones (plan
  `plan-classroom-escanear-todas-correcciones.md`)". Desmarcar B-2 y B-3 (hay que repetirlas).
- `docs/testing.md` §Baseline: números nuevos.
- **Contrastar** con `docs/portal-google-classroom-diseno.md` §8 (trampas del portal): sumar una
  línea con M-C (el marcador de "sin tema" llega antes que los ítems en primera visita) si §8
  no la tiene ya. No repetir la tabla de este plan: link.

---

## Verificación A — compuerta (pegar la salida, no describirla)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
pnpm exec vitest run sitio/google-classroom/scraper.test.js core/estado/recorridoTodos.test.ts sitio/inyeccion.test.js
git grep -n "asentadoVacio" -- sitio/google-classroom/   # scraper.js y scraper.test.js
```

Más la salida de los **cuatro controles negativos** (tests 25, 27, 28 y 23 nuevo), cada uno
fallando contra el código sin su arreglo. Un control que no falla es un hallazgo del informe,
no un detalle.

| AC | Dónde |
|---|---|
| AC-2 | tests 19, 25, 27, 28 + B-3 |
| AC-3 | test 25 + B-6 |
| AC-7 | tests 19 (nombres), 27 + B-3 |
| AC-8 | tests 8, 22 + B-3 |
| AC-14 | Paso 6 (tarjeta), sólo por lectura |

## Verificación B — la vuelve a correr el dueño en Brave

Antes: `pnpm run build` y recargar la extensión. Los ítems son los de `ramas-en-revision.md`,
con foco en:
- **B-2**: portada → tarjeta "Todas mis clases", sin loader colgado.
- **B-3**: recorrido completo: el resumen cuenta **7** cursos (5 activos + G25 + MB5), Física I
  con ~130 ítems, G22 **no** fallido, MC6 y Q5 vacíos, nombres legibles en el progreso.
  Durante el recorrido **no se ve el botón de acción**. Cronometrar el total (M-1 / NFR-1).
- **B-6**: MC2 sola trae lo mismo que su grupo.

## Lo que no se toca

- La tabla de decisión (`core/estado/origenListado.ts`), el SW, la materialización.
- El texto "unos 45 s por curso" de la tarjeta de oferta: se corrige después de B-3 con el
  número medido.
