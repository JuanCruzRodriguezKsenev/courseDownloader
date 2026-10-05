# Plan — Cancelar el escaneo (recorrido y un curso de Classroom)

**Rama**: `loader-tarjetas` (sigue sobre el loader en tarjetas, que todavía espera T-1..T-5) · **Fecha**: 2026-09-28
**Spec**: [`docs/specs/cancelar-escaneo/spec.md`](specs/cancelar-escaneo/spec.md) — aprobada; RN-15 y AC-2
enmendados el 2026-09-28 (tarjeta neutra con lista vacía) y PA-1 resuelta acá (Paso 1).
**Compuerta de partida** (`docs/testing.md`): 46 archivos / 802 tests. **Esperado al cerrar**: 46 / 813.

## Qué se hace

Un botón **Cancelar** en la fila "Escaneando…" del loader con detalle, en el recorrido y en el escaneo
de un curso de Classroom. El popup le pide a la pestaña que frene (`chrome.tabs.sendMessage`); el
scraper, que ya sabe abortar sus esperas por token (`idCancelacion`), frena y avisa. Si la pestaña no
confirma en 3 s, el popup cierra igual.

## Cómo está hoy (leído, no supuesto)

- **Scraper** `sitio/google-classroom/scraper.js` (V1.5.1). Una sola función inyectada,
  `escanearListado(opciones)`, autocontenida (regla de `AGENTS.md` §Execution contexts: nada de afuera,
  todo por `args`).
  - `:89-99` `idCancelacion` + `dormir(ms, token = idCancelacion)`: el token se captura **al llamar**;
    si cambió **cuando vence el timer**, rechaza con `Error("cancelado")`. O sea: hoy un `dormir(1500)`
    (`tiempos.vuelta`, `:384`, `:612`) tarda hasta 1,5 s en enterarse. **Todas** las esperas del archivo
    pasan por `dormir` (`grep -n "new Promise\|setTimeout"` da sólo `:91`, `:234` —progreso— y `:1148` —tope—).
  - `:101-108` `esperarCondicion` sondea con `dormir(50)`.
  - `:151-172` `avisar(evento)` manda `recorrido_evento` al SW con `idRecorrido, tabId, sitioId` + el evento.
  - `:964-966` modo un curso: `return escanearCursoActual()`.
  - `:968-1234` modo todos: visibilidad → enumerar (espera a la portada y a archivados con
    `esperarCondicion`) → `fin sin-cursos` **antes** de `inicio` (`:1060`) → `inicio` → bucle por curso
    (`latido`, navegación con `esperarCondicion`, carrera `escanearCursoActual()` vs tope `:1140-1176`,
    que en el vencimiento hace `idCancelacion++`, `:1154`) → vuelta a `/h` (`:1216-1225`) → `fin terminado`.
  - El `catch` de la carrera (`:1167-1176`) convierte **cualquier** rechazo en curso `fallido "error inesperado"`.
  - Las esperas del bucle y de la enumeración **no** están en ningún `try`: un rechazo ahí rechaza la
    función entera.
- **Reductor** `core/estado/recorridoTodos.ts` (V1.1.0).
  - `motivoCorte` es `"visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta"` en **dos** lugares:
    la interfaz (`:46`) y el evento `fin` (`:95`).
  - `aplicarEvento`: `inicio` siempre crea (`:106-118`); sin `prev` devuelve `null` y con otro id devuelve
    `prev` (`:120-121`). **Consecuencia (defecto latente, no está en la deuda):** un `fin` que llega antes
    que `inicio` —`sin-cursos` (`scraper.js:1060`) o `visibilidad` (`:968-971`)— **se pierde**: el storage
    no se entera y el popup se queda con su `recorrido` local en `escaneando` hasta que `esVigente` vence
    (tope 180 s + 30 s). Cancelar en "Buscando tus cursos…" (A4) cae en el mismo agujero; el Paso 1 lo cierra.
  - `textoResumen` (`:240-262`): con `cortado` agrega `Se cortó en el curso ${indice+1} de ${total}: …`.
- **SW** `background.js:272-283` `recorrido_evento`: pasa `request` **entero** al reductor (trae `action`,
  `tabId`, `sitioId` además del evento). No cambia.
- **Popup** `popup.js` (V5.29.0).
  - `:492-498` `ocultarLoader()` → `LoaderDetalle.limpiar()`.
  - `:555-576` `sincronizarLoaderRecorrido()`: con `debe` hace `LoaderDetalle.mostrar(vistaLoaderRecorrido(...))`
    en **cada** evento; sin `debe` oculta. `renderizarListadoInterfaz` la llama primero (`:2072`).
  - `:578-593` suscripción a `recorridoTodos`: terminal y no materializado → `materializarRecorrido()`
    (sólo si la pestaña activa es la del recorrido). Es el camino por el que hoy un corte apaga el loader y
    pinta la lista o la tarjeta "El recorrido no trajo material" (`:2144-2157`). **Cancelar reusa ese camino.**
  - `:1385-1462` `lanzarRecorridoTodos()`: arma un `recorrido` **local** (no en storage) antes de inyectar.
  - `:1497-1503` ya manda un `fin cortado` desde el popup (`sin-respuesta`): mismo molde que el del Paso 5.
  - `:1555-1850` `ejecutarPaso1EscaneoRamonAutomatico()`: `miGeneracion`/`fueAbandonado()` (`:1577-1579`),
    `LoaderDetalle.mostrar({ desde })` (`:1588`), `nodos.facetaBadge.style.display = "none"` (`:1590`),
    portal recién en el callback de `tabs.query` (`:1601`), watchdog `safetyTimeout` (`:1655-1686`),
    `executeScript` con `args: [{ idEscaneo: miGeneracion }]` (`:1692-1696`), y el callback que primero
    mira `fueAbandonado()` (`:1697-1709`). **La lista en memoria no se toca hasta ese callback.**
  - `:1338-1351` `mostrarListaGuardada()`: pinta la lista que hay, badge, sincroniza disco y apaga el loader.
  - `:542` `escaneoMuerto` + `:2175-2203` sus tarjetas: `ListaClases.render({ card: { tipo: 'error', ...cards[motivo] } })`
    — **el spread va después**, así que una tarjeta que declare `tipo: 'info'` lo pisa. `:2777-2782` el
    pie se deriva de él ("Re-escanear 🔄"). `:797-798` / `:2969-2971` bloqueos.
- **Isla** `popup/features/loaderDetalle.preact.js` (V1.1.0). `_store.estado` = vista; `mostrar(vista)`
  **reemplaza** `estado` entero; `limpiar()` lo vacía. La fila `.loader-escaneando` (`:220-223`) tiene
  spinner + "Escaneando…". El test `'arranca vacío sin pintar nada'` hace `toEqual` sobre `get()`:
  **no agregues campos a `estado`**.
- **CSS** `styles/components/loader.css:231-239` `.loader-escaneando` flex centrado. `.btn-cancel`
  (`styles/components/actions.css:101-125`) tiene `flex: 1` y `text-transform: uppercase`.
- **Puerto** `core/puertos/sitio.ts` (V1.7.0). Classroom: `sitio/google-classroom/config.ts` (V1.3.0).
- Esc: el único `keydown` de Escape del popup es el de `capa.preact.js` (modales). Nada que tocar (RN-9).

## Decisiones (tomadas; no reabrir)

1. **Canal popup → pestaña**: `chrome.tabs.sendMessage(tabId, { action: "cancelar_escaneo", idRecorrido | idEscaneo })`.
   El scraper registra un `chrome.runtime.onMessage` **dentro** de la función inyectada y lo quita al salir.
   `tabs` ya se usa directo en `popup.js` (sin puerto, a propósito: `AGENTS.md` §Execution contexts).
2. **Confirmación**: recorrido → el storage pasa a `estado !== "escaneando"`; un curso → llega el callback
   de `executeScript`. Timeout de 3 s en ambos (RN-7).
3. **Qué portal tiene botón** → miembro opcional nuevo `PuertoSitio.escaneoCancelable?: boolean`, `true` sólo
   en Classroom. **No** `portal.id === "google-classroom"` en el popup (ADR-0010: sin vocabulario de portal en la UI).
4. **Motivo nuevo**: `motivoCorte: "cancelado"`.
5. **`fin` sin recorrido previo crea uno cortado** (cierra A4 y el defecto latente de `sin-cursos`), y un
   `inicio` del mismo id sobre un recorrido terminal se ignora (si no, una pestaña muda que siga enumerando
   revive el recorrido después del cierre por 3 s).
6. **PA-1**: con 0 cursos, `Cancelaste el recorrido antes de encontrar los cursos.`; otro motivo con 0 cursos,
   `Se cortó antes de encontrar los cursos: <motivo>.`
7. **Un curso cancelado con lista vacía** → tarjeta `info` "Escaneo cancelado" vía `escaneoMuerto = { motivo: 'cancelado' }`
   (RN-15 enmendado). Con lista → `mostrarListaGuardada()`.
8. **Botón**: `.btn-cancel` tal cual (NFR-3); se ve en mayúsculas ("CANCELAR"/"CANCELANDO…") porque la clase
   lo impone. No se pisa el `text-transform`.

## Radio de impacto

`git grep -n "motivoCorte\|recorrido_evento\|LoaderDetalle\|escaneoCancelable\|escanearListado"` fuera de
`docs/` y `.claude/`:

| Archivo | Qué hace hoy | Paso |
|---|---|---|
| `core/estado/recorridoTodos.ts` | tipo, reductor, resumen | 1 |
| `core/estado/recorridoTodos.test.ts` | 23 tests; ninguno asume que `fin` sin `prev` da `null` (el de `:95` es un `latido` de id menor: sigue valiendo) | 1 |
| `background.js:272` | pasa el evento entero | **nada** |
| `sitio/google-classroom/scraper.js` | escaneo | 2 |
| `sitio/google-classroom/scraper.test.js` | 39 tests; los mocks de `chrome.runtime` **no** traen `onMessage` (`:410-416`, `:806-809`, `:1036-1039`) | 2 |
| `core/puertos/sitio.ts` | contrato | 3 |
| `sitio/google-classroom/config.ts` | descriptor | 3 |
| `sitio/ramonnet/config.ts`, `sitio/anatomy-by-chris/config.ts` | descriptores | **nada** (miembro opcional) |
| `popup/features/loaderDetalle.preact.js` + su test | isla | 4 |
| `styles/components/loader.css` | fila Escaneando… | 4 |
| `popup.js` | orquesta | 5 |
| `verificacion/modoVerificacion.js` | banco; **no** toca la isla ni `recorridoTodos` (verificalo con el grep de arriba) | nada |
| docs con conteo de miembros del puerto: `AGENTS.md:197`, `docs/multisitio-diseno.md:44,408,612`, `core/puertos/sitio.ts` cabecera | conteo | 3 |
| `docs/data-model.md:155-190`, `docs/patterns.md:9`, `docs/testing.md`, `docs/portal-google-classroom-diseno.md` | docs | 6 |

---

## Paso 1 — Núcleo: motivo "cancelado", `fin` sin previo, resumen (RN-10, RN-11, RN-12, RN-13, A4, PA-1)

`core/estado/recorridoTodos.ts` → V1.2.0 con CHANGELOG.

1. Sacá el union a un tipo exportado y usalo en **los dos** lugares (`:46` y `:95`):
   `export type MotivoCorte = "visibilidad" | "navegacion" | "sin-cursos" | "sin-respuesta" | "cancelado";`
2. Evento `fin`: agregá `tabId?: number; sitioId?: string;` (el scraper ya los manda en `avisar`; el popup los
   manda en el Paso 5).
3. En `aplicarEvento`, **antes** de `if (!prev) return null;`:
   - `inicio` con `prev && prev.idRecorrido === ev.idRecorrido && prev.estado !== "escaneando"` → `return prev`.
     (Ponelo como primera línea de la rama `inicio`.)
   - `fin` con `typeof ev.tabId === "number" && typeof ev.sitioId === "string"` y
     `(!prev || ev.idRecorrido > prev.idRecorrido)` → devolvé un recorrido nuevo:
     `{ idRecorrido: ev.idRecorrido, tabId: ev.tabId, sitioId: ev.sitioId, estado: ev.estado, cursos: [], indice: 0, ultimaSenal: ahora, materializado: false, ...(ev.motivoCorte ? { motivoCorte: ev.motivoCorte } : {}) }`.
     Un `fin` con id **menor** sigue devolviendo `prev` (un rezagado no pisa un recorrido nuevo).
4. `textoResumen`, rama `cortado`:
   - `res.total === 0` y `motivoCorte === "cancelado"` → `Cancelaste el recorrido antes de encontrar los cursos.`
   - `res.total === 0` y otro motivo → `Se cortó antes de encontrar los cursos: ${motivoLegible}.`
   - `motivoCorte === "cancelado"` → `Cancelaste el recorrido en el curso ${r.indice + 1} de ${res.total}. Quedaron ${res.sinRecorrer} sin recorrer.`
   - el resto, como hoy. No agregues `cancelado` a `mapaMotivos`.
   RN-11 sale solo: el curso cancelado no recibe evento `curso`, así que `resumen()` lo cuenta en `sinRecorrer`.

**Tests** (`core/estado/recorridoTodos.test.ts`, +4):
- R1 `textoResumen` de un recorrido de 7 cursos, 3 con `resultado`, `indice: 3`, `cortado`/`cancelado` → la
  última línea es exactamente `Cancelaste el recorrido en el curso 4 de 7. Quedaron 4 sin recorrer.` (AC-1).
- R2 0 cursos: `cancelado` → `…antes de encontrar los cursos.`; `sin-cursos` → `Se cortó antes de encontrar los cursos: no encontramos cursos en la portada.`
- R3 `fin` con `tabId`/`sitioId`: con `prev = null` crea `cortado` con `cursos: []`; con `prev` de id menor
  crea el nuevo; con `prev` de id **mayor** devuelve `prev` (`toBe`).
- R4 `inicio` del mismo id sobre un `prev` `cortado` → `toBe(prev)`; `inicio` de otro id sobre un terminal
  sigue creando (el test de `:118` ya lo cubre: que siga verde).

## Paso 2 — Scraper: escuchar la orden y frenar (RN-6, RN-8, RN-11, A5)

`sitio/google-classroom/scraper.js` → V1.6.0 con CHANGELOG. **Todo dentro de `escanearListado`**, nada a nivel
módulo (regla del scraper autocontenido; romperla no la detecta nada, sólo el navegador).

1. Junto a `idCancelacion` (`:89`): `let cancelado = false;` y un `Set` de esperas pendientes.
   Reescribí `dormir` para que:
   - si `cancelado` ya es `true`, rechace **enseguida** con `Error("cancelado")`;
   - registre `{ timer, reject }` en el set y lo quite al resolver/rechazar;
   - conserve la semántica actual del token (rechaza al vencer si el token cambió).
   Agregá `function abortarEsperas() { idCancelacion++; for (const e of pendientes) { clearTimeout(e.timer); e.reject(new Error("cancelado")); } pendientes.clear(); }`.
   El tope (`:1154`) pasa de `idCancelacion++` a `abortarEsperas()` — misma semántica, ahora sin esperar
   al timer. El test 23 tiene que seguir verde.
2. Oyente, registrado al entrar a la función (después de leer `opciones`, `:135`), **con guarda** porque los
   mocks de los tests no traen `onMessage`:
   ```js
   const oyenteCancelar = (msg, _sender, responder) => {
     if (!msg || msg.action !== "cancelar_escaneo") return;
     const esMio = modoTodos ? msg.idRecorrido === idRecorrido
                             : msg.idEscaneo !== undefined && msg.idEscaneo === (opciones && opciones.idEscaneo);
     if (!esMio) return;
     cancelado = true;
     abortarEsperas();
     try { responder({ ok: true }); } catch {}
   };
   ```
   Registralo sólo si `chrome?.runtime?.onMessage?.addListener` es función, y quitalo con `removeListener`
   en un `finally` que envuelva **las dos** ramas (un curso y todos). Un mensaje que no es mío no llama a `responder`.
3. Modo un curso (`:964-966`): `try { return await escanearCursoActual(); } catch (e) { if (cancelado) return { materia: "", enlaces: [], cancelado: true }; throw e; }`.
   El `throw e` conserva lo de hoy para cualquier otro error.
4. Modo todos: envolvé desde `if (!visible())` (`:968`) hasta el `return` final en
   `try { … } catch (e) { if (cancelado) { await avisar({ tipo: "fin", estado: "cortado", motivoCorte: "cancelado" }); return { materia: "", enlaces: [], recorrido: true, cancelado: true }; } throw e; }`.
   Y adentro:
   - `catch` de la carrera (`:1167`): primera línea `if (cancelado) throw new Error("cancelado");` (si no,
     manda un `curso fallido "error inesperado"` por el curso cancelado y rompe RN-11).
   - **A5**: justo después de `resCurso = carrera.res;` (`:1166`) y antes de cualquier `avisar({ tipo: "curso" … })`:
     `if (cancelado) throw new Error("cancelado");`. Idem arriba del todo del cuerpo del `for` (`:1072`).
   - RN-8: al salir por el `catch`, **no** se hace la vuelta a `/h` (`:1216-1225`): queda donde está.
5. Los `avisar` no pasan por `dormir`, así que el `fin` sale aunque `cancelado` sea `true`.

**Tests** (`sitio/google-classroom/scraper.test.js`, +4). Helper nuevo en el `describe`: un mock de
`chrome.runtime.onMessage` con `addListener`/`removeListener` que guarda el oyente, para invocarlo a mano
`oyente({ action: "cancelar_escaneo", idRecorrido }, {}, responder)`. Reusá `simularNavegacionClassroom`.
- S1 (AC-1, RN-8, RN-11) recorrido de 3 cursos: cuando llega el `latido` de `indice: 1` (disparalo desde el
  mock de `sendMessage`), cancelá. Esperado: un `curso` con `indice: 0` `ok`; **ningún** `curso` con `indice ≥ 1`;
  el último mensaje es `fin` `cortado` `cancelado`; `location.pathname` **no** termina en `/h`; el resultado
  trae `cancelado: true`; `removeListener` se llamó con el mismo oyente.
- S2 (A4) cancelá antes de que termine la enumeración (invocá el oyente apenas `addListener` lo recibe).
  Esperado: ningún `inicio`; un solo `fin` `cortado` `cancelado`.
- S3 (AC-2) un curso con `idEscaneo: 7`: cancelá al primer `escaneo_progreso`. Esperado: resultado
  `{ enlaces: [], cancelado: true }` y que la promesa resuelva en **< 200 ms** desde la orden (mide con
  `Date.now()`; con `abortarEsperas` inmediato no depende de `tiempos.vuelta`).
- S4 un `cancelar_escaneo` con otro `idRecorrido` no hace nada: el recorrido termina con `fin terminado` y el
  `responder` no se llamó.

**Control negativo** (lo corre obra y pega la salida): comentá la línea `if (cancelado) throw …` del `catch` de
la carrera → S1 tiene que fallar (aparece el `curso fallido` del índice 1). Restaurá.

## Paso 3 — Puerto: qué portal se puede cancelar (RN-1, RN-2, AC-6)

1. `core/puertos/sitio.ts` → V1.8.0. Miembro opcional con JSDoc, junto a `esPortada?`:
   `escaneoCancelable?: boolean;` — "`true` si el escaneo inyectado atiende `cancelar_escaneo`
   (`chrome.runtime.onMessage` dentro de `escanearListado`). Lo lee el popup para mostrar el botón Cancelar."
   En el CHANGELOG, el conteo de miembros: **contá los miembros de la interfaz** (`claveDeListado?` entró
   después del último conteo y nadie lo sumó) y escribí el número medido, no "+1".
2. `sitio/google-classroom/config.ts` → V1.4.0: `escaneoCancelable: true,` (al lado de `topeEscaneoMs`).
3. Actualizá ese mismo número medido en `AGENTS.md:197` ("is **N** since 2026-09-28: … `escaneoCancelable` entered —
   optional, the scan answers a cancel order") y en `docs/multisitio-diseno.md:44,408,612`. Nada más de `AGENTS.md`.

## Paso 4 — Isla: el botón (RN-5, RN-9, NFR-3, AC-3)

`popup/features/loaderDetalle.preact.js` → V1.2.0.

1. En `_store`, **fuera** de `estado`: `cancelar: { onCancelar: null, cancelando: false }` y:
   - `habilitarCancelar(fn)`: si `fn` ya es el `onCancelar` actual, no emite; si no, guarda `fn`,
     `cancelando: false`, emite.
   - `marcarCancelando()`: `cancelando: true`, emite.
   - `getCancelar()`.
   - `limpiar()` también resetea `cancelar` (y emite si cambió). La guarda de "ya vacío" de `limpiar` tiene
     que contemplarlo: hoy retorna temprano si `estado` está vacío.
   - `mostrar()` **no** toca `cancelar`. `get()` sigue devolviendo sólo `estado`.
   - `__resetStore()` resetea `cancelar`.
2. En `LoaderDetalle`, dentro de `.loader-escaneando`, después del `<span>`:
   ```js
   ${onCancelar && html`<button type="button" class="btn-cancel loader-cancelar"
       disabled=${cancelando}
       onClick=${() => { if (!_store.cancelar.cancelando) onCancelar(); }}>
       ${cancelando ? 'Cancelando…' : 'Cancelar'}</button>`}
   ```
   El botón vive dentro del `return null` de `estaVacio`: sin detalle no hay botón (RN-2 / RN-26 del loader).
3. `styles/components/loader.css`, dentro de `.loader-escaneando`:
   ```css
   &:has(.loader-cancelar) { justify-content: flex-start; }
   .loader-cancelar { flex: 0 0 auto; margin-left: auto; padding: 0.35rem 0.75rem; }
   ```
   Ningún color (NFR-3; regla de `styles/variables.css:20-26`).

**Tests** (`popup/features/loaderDetalle.preact.test.js`, +3):
- L1 `mostrar({ desde: 1 })` + `habilitarCancelar(fn)` → hay `button.loader-cancelar` con texto `Cancelar`
  dentro de `.loader-escaneando`; click → `fn` llamada 1 vez.
- L2 `marcarCancelando()` → texto `Cancelando…`, `disabled`; dos clicks → `fn` sigue en 1 (AC-3, A6).
- L3 sin `habilitarCancelar` no hay botón; con botón, un `mostrar(...)` nuevo lo conserva; `limpiar()` lo saca
  y `getCancelar().onCancelar === null`.

## Paso 5 — Popup: cablear las dos cancelaciones (RN-3, RN-4, RN-7, RN-14, RN-15, AC-1..AC-7)

`popup.js` → V5.30.0 con CHANGELOG. Sin confirmación en ningún lado (RN-4).

**Recorrido**
1. Variable nueva junto a las del recorrido (`:546`): `let cancelacionRecorridoPedida = null;`
2. Función nueva `pedirCancelacionRecorrido()`:
   - sale si `!recorrido || recorrido.estado !== "escaneando" || cancelacionRecorridoPedida === recorrido.idRecorrido`;
   - toma `{ idRecorrido, tabId, sitioId }` de `recorrido`, marca `cancelacionRecorridoPedida = idRecorrido`,
     `LoaderDetalle.marcarCancelando()`;
   - `chrome.tabs.sendMessage(tabId, { action: "cancelar_escaneo", idRecorrido }, () => void chrome.runtime.lastError);`
   - `setTimeout(3000)`: si `recorrido?.idRecorrido === idRecorrido && recorrido.estado === "escaneando"`,
     `mensajeria.enviar({ action: "recorrido_evento", idRecorrido, tabId, sitioId, tipo: "fin", estado: "cortado", motivoCorte: "cancelado" })`
     (mismo molde que `:1497-1503`, **con** `tabId`/`sitioId`: sin ellos, antes de `inicio` el reductor lo tira).
3. En `sincronizarLoaderRecorrido()`, dentro de `if (debe)`, después del `mostrar`:
   `LoaderDetalle.habilitarCancelar(pedirCancelacionRecorrido);` — la referencia es estable, así que no
   reemite ni borra el "Cancelando…". Esto da RN-3 gratis: el popup reabierto pasa por acá.
4. **Nada más**: el `fin` llega al storage → la suscripción (`:578`) llama `materializarRecorrido()` →
   lista + nota del resumen, o la tarjeta "El recorrido no trajo material" → `renderizarListadoInterfaz`
   → `sincronizarLoaderRecorrido` oculta el loader. Es el camino de un corte de hoy. RN-13 también sale
   solo (relanzar tras `cortado` ya funciona).

**Un curso**
5. Dentro del callback de `tabs.query` de `ejecutarPaso1EscaneoRamonAutomatico`, **después** de armar el
   `safetyTimeout` (`:1686`) y antes del `executeScript`:
   ```js
   let cancelacionPedida = false;
   let timerCancelacion = null;
   const cerrarPorCancelacion = () => {
     if (fueAbandonado()) return;            // ya cerró el callback o el timer
     clearTimeout(safetyTimeout);
     clearTimeout(timerCancelacion);
     generacionEscaneo++;                    // abandona: progreso y callback tardíos se callan (RN-7)
     escaneoEnCurso = false;
     restaurarTrasCancelar();
   };
   if (portal.escaneoCancelable) {
     LoaderDetalle.habilitarCancelar(() => {
       if (cancelacionPedida) return;
       cancelacionPedida = true;
       clearTimeout(safetyTimeout);          // que el watchdog no pinte "tardó demasiado" en la ventana de 3 s
       LoaderDetalle.marcarCancelando();
       chrome.tabs.sendMessage(tab.id, { action: "cancelar_escaneo", idEscaneo: miGeneracion }, () => void chrome.runtime.lastError);
       timerCancelacion = setTimeout(cerrarPorCancelacion, 3000);
     });
   }
   ```
6. En el callback de `executeScript`, **inmediatamente después** del bloque `if (fueAbandonado()) { … return; }`
   (`:1705-1708`) y **antes** de `terminarEscaneo()`: `if (cancelacionPedida) { cerrarPorCancelacion(); return; }`.
   Gana la cancelación aunque el escaneo haya terminado o fallado la inyección (análogo de A5).
7. Función nueva, al lado de `mostrarListaGuardada` (`:1338`):
   ```js
   function restaurarTrasCancelar() {
     if (appState.listadoClasesGlobal.length > 0) { mostrarListaGuardada(); return; }   // RN-14
     escaneoMuerto = { motivo: 'cancelado' };                                            // RN-15
     sincronizarBloqueosDeAlerta();
     configurarBotonesUX("re-escanear", "Re-escanear 🔄", false);
     ocultarLoader();
     renderizarListadoInterfaz();
   }
   ```
   `mostrarListaGuardada` ya hace `escaneoMuerto = null`, badge, render, `ocultarLoader()` y sync de disco.
   La lista en memoria **no** se tocó (el callback nunca llegó a aplicar), así que es la de antes.
8. En el mapa `cards` de `escaneoMuerto` (`:2180-2201`) agregá:
   `cancelado: { tipo: 'info', titulo: 'Escaneo cancelado', descripcion: 'Tocá <strong>Re-escanear</strong> para volver a buscar.', icono: '⏹️' },`
   El `{ tipo: 'error', ...cards[m] }` de `:2202` ya deja que `tipo: 'info'` gane: **no** cambies esa línea.
   Actualizá el comentario de arriba ("Las tres formas de morir…") para decir que `cancelado` no es una muerte
   sino la quinta entrada, informativa.

## Paso 6 — Docs

- `docs/data-model.md` §`RecorridoTodos` (`:155-190`): `motivoCorte` con el union **real** (hoy dice
  `"desconocido"`, que no existe; poné el de `MotivoCorte`); `fin`: `{ estado, motivoCorte?, tabId?, sitioId? }`
  + una línea: "un `fin` con `tabId`/`sitioId` sin recorrido previo (o con uno más viejo) crea uno `cortado` con
  `cursos: []`; un `inicio` del mismo id sobre un terminal se ignora". En §Mensajes IPC directos, agregá
  `cancelar_escaneo` (popup → pestaña por `chrome.tabs.sendMessage`, `{ idRecorrido }` o `{ idEscaneo }`).
- `docs/patterns.md:9`: una oración al final — `cancelar_escaneo` **no** pasa por el despachador del SW: el
  popup se lo manda a la pestaña con `chrome.tabs.sendMessage` y lo atiende el scraper inyectado.
- `docs/testing.md`: baseline 802 → **813** y un párrafo "De dónde sale el 813" con los +4/+4/+3 por archivo,
  en el formato de los anteriores (`:38-42`).
- `docs/portal-google-classroom-diseno.md`: sección nueva `## 11. Registro de cancelar el escaneo (rama \`loader-tarjetas\`)`
  después de la §10, con: spec y plan por ruta, las 8 decisiones de arriba en una línea cada una, y el defecto
  latente del `fin` antes de `inicio` que el Paso 1 cierra. No copies la spec: linkeala.
- **No** toques `docs/ramas-en-revision.md` ni `TECHNICAL_DEBT.md`: los sincroniza tanda al revisar.

## Verificación literal

Pegá la salida, no la describas.

```bash
pnpm test                                   # 46 archivos, 813 tests
pnpm run lint                               # 0 errores, 0 warnings
pnpm exec tsc --noEmit                      # sin salida
pnpm run build                              # → .output/chrome-mv3/
pnpm exec vitest run core/estado/recorridoTodos.test.ts sitio/google-classroom/scraper.test.js popup/features/loaderDetalle.preact.test.js
git grep -n "escaneoCancelable" -- ':!docs' ':!.claude'      # sitio.ts, classroom/config.ts, popup.js
git grep -n "cancelar_escaneo" -- ':!docs' ':!.claude'       # scraper.js, su test, popup.js
git grep -n '"cancelado"' core/estado/recorridoTodos.ts      # MotivoCorte y textoResumen
```

Más el **control negativo** del Paso 2 (salida del test fallando y después pasando).

### Checklist en Brave (dueño; antes lo reproduce tanda en Claude in Chrome)

Cada ítem cita su criterio. Recorrido real en la portada de Classroom, popup abierto salvo que se diga otra cosa.

- [ ] **C-1 (AC-1, M-1)** Cancelá en el curso 4 (o el que toque) en fase "Cargando más publicaciones". Medí clic → loader
      apagado. Lista con el material de los terminados; nota termina en `Cancelaste el recorrido en el curso i de N. Quedaron k sin recorrer.`;
      la pestaña sigue en ese curso.
- [ ] **C-2 (AC-2)** Un curso sin nada guardado, cancelá en "Novedades" → loader apagado, lista vacía, tarjeta
      `Escaneo cancelado`, botón `Re-escanear 🔄`. Repetí con un curso que **sí** tenía lista guardada → vuelve esa lista, sin tarjeta.
- [ ] **C-3 (AC-3)** Al tocar: `CANCELANDO…` deshabilitado; un segundo clic no hace nada.
- [ ] **C-4 (AC-4)** Pestaña muda: en DevTools de la pestaña, pausá el JS (Sources → pausa) y cancelá desde el popup →
      a los 3 s el loader se apaga y el recorrido se ve cancelado; al reanudar el JS, la lista no cambia.
- [ ] **C-5 (AC-5)** Lanzá el recorrido, cerrá el popup, reabrilo → el botón está; cancelá → igual que C-1.
- [ ] **C-6 (AC-6)** Botón visible en recorrido y en un curso de Classroom; **no** en Ramón Net, Anatomy,
      "Conectando con el servidor Bun…" ni sincronizando.
- [ ] **C-7 (AC-7)** Tras cancelar, volvé a la portada y lanzá "Escanear todos" → arranca del curso 1.
- [ ] **C-8 (AC-8)** Durante un escaneo, apretá Esc (con y sin el foco en el botón) → sigue escaneando.
- [ ] **C-9 (A4)** Cancelá en "Buscando tus cursos…" → loader apagado; tarjeta "El recorrido no trajo material"
      que cierra con `Cancelaste el recorrido antes de encontrar los cursos.` (en ≤ 1 s, no a los 3 min).
- [ ] **C-10 (NFR-3)** Oscuro y claro, 390×600: el botón a la derecha de "Escaneando…", estilo de `.btn-cancel`, sin colores nuevos.

**M-1** se anota con C-1: ≤ 1 s cumple RN-6; 1-3 s → se corrige RN-6 al valor medido; > 3 s → no se mergea.
