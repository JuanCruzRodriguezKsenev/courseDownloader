# Testing

**Estado actual: suite real y en crecimiento** (los números exactos, en la tabla de baseline de abajo). Existe `package.json` con Vitest + jsdom como devDependencies. Cubierto hoy: la lógica pura (`core/util/texto.ts` y `core/util/reintentos.ts`, repartidos desde `shared/utils.js` en la Fase 6a — los tests de texto sobrevivieron sin tocar una aserción, que es para lo que estaban, y los de reintentos dejaron de stubear el global `Conexion` para inyectarle una sonda), el daemon de conexión (`core/conexion/conexion.ts` — desde la Fase 5b sin mocks de `chrome.*`: dos instancias reales sobre `AlmacenamientoEnMemoria` ejercitan el espejado popup↔SW de verdad; desde su mudanza a `core/` el 2026-08-03 tampoco nombra el portal real, porque la URL de sondeo se le inyecta), el cliente del backend (`core/backend/bunClient.ts`, primer test en TypeScript), el historial de fallos (`core/historial/historialFallos.ts`, ya sin mocks de `chrome.*`: usa el adaptador en memoria del puerto), la maquinaria de estado del popup (`core/estado/appState.ts` — **estrenó cobertura en la Fase 5b**: antes tenía cero, porque los tests del popup mockean `globalThis.AppState` entero y nunca la ejercitaban; hoy corre contra `AlmacenamientoEnMemoria` y, desde el 2026-08-03, también su IPC contra `MensajeriaEnMemoria` — sin un solo mock de `chrome.*`. Ojo con un detalle que este archivo dejó documentado: el adaptador en memoria vence a los 0ms por defecto, así que el test del **timeout de rescate** construye uno con plazo largo; si no, el puerto rechazaría primero y el test verificaría el otro camino sin que se note), las features/islas del popup ya extraídas (`popup/features/serverConnection.js`, `queue.js`, `filters.js`, `faceta.js`, y las islas Preact `conexionHeader`/`onboarding`/`rutaDisco`/`bannerConexion`/`listaClases`/`campanita`), y de `core/hls/hlsEngine.ts` tanto las funciones puras (parseo/resolución M3U8) como el **pool de 6 workers** `compilarTranscodificacionStream` (concurrencia, AES, streaming turbo/blob, aborts en cascada, y el path de reintento 4xx del bug 400), más los handlers IPC de `background.js` y **la cola entera** (`core/cola/`: el bucle, el estado de sesión y el espejo de progreso). **El bucle de descarga y el auto-heal ya NO están sin cubrir** (2026-08-03): `background.test.js` los caracteriza —y desde la Fase 6b construye el procesador real en vez de stubearlo— — camino feliz, orden FIFO por `fechaEncolado`, progreso con telemetría, el salto de clase por rechazo 4xx (bug 400), la pausa por sesión (sin alarma) vs. la pausa por servidor caído (con alarma), la cancelación del usuario, el frenado suave y las cuatro ramas de la alarma de auto-heal. Lo único que queda a verificación manual/e2e es el núcleo de `popup.js` aún sin extraer (init + wiring + orquestación de scraping/render), que ADR-0005 define como no-extraíble (ver `docs/contributing.md`).

**Lo que sumó el corte 7** (el segundo portal, 2026-08-07): las credenciales por portal (`core/estado/credencialesPortal.ts`, sobre el adaptador en memoria) y el adaptador entero de `sitio/anatomy-by-chris/` — el parser, el `resolverManifiesto` con sus tres `fetch` stubeados, y **el scraper contra el HTML REAL del portal** (`__fixtures__/listado-modulo.html`, 11 KB recortados de las páginas guardadas: se conservaron el markup de las filas tal cual y se vaciaron los `d=` de los `<path>` de los íconos). Ese fixture no es un lujo: las cuatro trampas de ese portal —el `innerText` envenenado por los `<title>` de los íconos, las flechas de navegación que parecen clases, las filas de texto sin video y el `<aside>` de Perfil que gana un `querySelector('aside')`— son exactamente lo que un doble escrito por quien escribió el scraper **no** reproduciría, así que un DOM inventado pasaría los tests con un scraper roto. Y el corte estrenó de paso lo que hasta ahora sólo tenía dobles: que los dos `esPaginaDelSitio` sean **disjuntos** (`sitio/registro.test.ts`) ya se afirma con dos portales de verdad. **Lo que ese fixture sigue sin poder ver es que `escanearListado` sea serializable y autocontenida** — acá corre importada, con su módulo entero disponible; en producción la serializa `chrome.scripting.executeScript`. Eso sólo lo detecta el navegador.

**Lo que cambió con el escaneo por API (cortes 1 a 5, 2026-08-07)**, y lo primero es una **pérdida
que conviene tener presente**: `sitio/anatomy-by-chris/scraper.test.js` **dejó de correr contra el
HTML real**. No es un descuido — el escaneo ya no lee el DOM, así que un fixture de HTML no
probaría nada—, pero con eso se fue la única observación real de ese portal que existía sin abrir
el navegador. El fixture queda versionado porque sigue documentando el DOM, y ya no lo lee nadie.
En su lugar el test corre contra un doble de `/v1/navigation` recortado del crudo medido.

Lo que se ganó a cambio: las 7 colisiones reales de títulos entre módulos están fijadas una por una
(`core/cola/identidadClase.test.ts`), el override de carpeta y su saneo tienen su bloque
(`popup/features/queue.test.js`), la escalera de calidad real de cinco escalones prueba que la
elección es **por rango y no por igualdad** —incluido el caso de que el CDN saque el escalón del
tope—, y la rama del adjunto en el bucle afirma lo que más importa de ella: que **no toca el motor
HLS**. El módulo nuevo `descargarAdjunto.js` tiene sus propios tests, casi todos sobre **cómo viene
tipado cada error**, que es lo que decide entre saltear una clase y pausar la cola.

**Y hay dos cosas que estos tests no pudieron ver, y por eso el navegador sigue siendo
obligatorio**: que una función `async` inyectada por `executeScript` resuelva (riesgo R2), y **cómo
nombra el backend Bun un archivo que no viene fragmentado** (riesgo R9) — es otro repo, y si le
agrega `.mp4` a un PDF el archivo queda `… .pdf.mp4`.

## Baseline de las verificaciones

**Este doc es el hogar canónico de estos números** (convención DRY, ver `docs/adr/0007-dry-docs-canonical-homes.md`): `AGENTS.md` y el resto apuntan acá en vez de repetirlos. Si agregás tests o un archivo nuevo, el número se actualiza **acá**, en el mismo cambio.

| Verificación | Baseline esperado |
|---|---|
| `npm test` | 34 archivos, 578 tests, todo en verde |
| `npm run lint` | **0 errores, 0 warnings** |
| `npx tsc --noEmit` | sin salida (limpio) |
| `npm run build` | compila a `.output/chrome-mv3/` |

**El alcance del lint creció el 2026-08-12** sin que los números cambien: la fusión del backend
(ADR-0015) metió `backend/` en el repo, y `npm run lint` corre `eslint .`, así que **el servidor Bun
entró bajo la misma red que la extensión** — tiene su bloque en `eslint.config.js` con globals de
Node + `Bun`, y no se le aflojó ninguna regla. Al entrar destapó 16 errores (`process`/`Bun` sin
declarar) y 7 warnings, todos de higiene y todos limpiados en el mismo corte con el criterio de
abajo. La suite y `tsc` **no** lo alcanzan: el backend no tiene tests y no está en el `include`.

Desde el 2026-08-03 el lint está **limpio del todo**: un error *y también* un warning nuevo son
una regresión. Los 6 warnings que había (4 `catch (e)` con el binding sin usar, 2 argumentos sin
usar) se limpiaron con `catch {}` y prefijo `_`, sin tocar comportamiento.

**Ojo con el alcance de `tsc`, que no es automático**: `allowJs` está en `false` y los dos
entrypoints son `.js`, así que `tsc` los saltea junto con todo su grafo de imports. Lo que
realmente typechequea es el `include` de `tsconfig.json` — hoy `core/`, `plataforma/` y
`sitio/`: **47 archivos** (35 + 8 + 4, tests `.ts` incluidos, medidos con `--listFiles` el
2026-08-07, después del corte 7). *(Y van dos veces que el número se quedó corto solo: decía
39 desde el 2026-08-04 —el corte 2 del multi-sitio sumó `sitio/registro.ts` y su test sin que
nadie re-midiera— y decía 42 desde el 2026-08-05, cuando el segundo tramo del multiportal sumó
`core/cola/identidadClase.ts` y su test. Es el recordatorio de que este número no se
mantiene solo.)* **Ojo con lo que el corte 7 NO sumó**: los tres hermanos `.js` del adaptador
nuevo (`scraper`, `parserTitulos`, `resolverManifiesto`) **no** los ve `tsc`, igual que los de
Ramón Net — `allowJs` está en `false`. De la carpeta del portal nuevo sólo entra `config.ts`.
**`shared/` salió del `include` en la Fase 6a: la carpeta dejó de existir.** `entrypoints/`
figura en la lista pero **aporta cero archivos** — los dos son `.js`, y ahí está la trampa, no
la salida. Una carpeta con `.ts` que no esté listada pasa la compuerta en
verde sin que nadie la mire; fue el caso de `shared/` y `plataforma/` entre la Fase 5b y el
2026-08-03 (ver `docs/TECHNICAL_DEBT.md` §Testing). Al migrar `.ts` a una raíz nueva,
agregala al `include` y confirmá con `npx tsc --noEmit --listFiles`.

## Cómo correr los tests

```
npm install      # una sola vez (instala las devDependencies en node_modules/, gitignorado)
npm test         # corre todo una vez (vitest run)
npm run test:watch  # modo watch durante desarrollo
```

La extensión **sí** se empaqueta desde la Fase 3 de la re-arquitectura (WXT + Vite → `.output/chrome-mv3/`) y el núcleo se está migrando a TypeScript: ADR-0008 reemplazó a `docs/adr/0001-no-bundler-or-typescript-yet.md`. Lo que sigue siendo cierto es que la extensión no tiene dependencias de **runtime** — todo `package.json` es tooling (Vitest, ESLint, `tsc`, WXT).

## Stack elegido

**Vitest + jsdom.** Ver justificación en `docs/tech-stack.md`. No usar Jest — Vitest no requiere configuración de Babel/TS aparte y arranca más rápido, y no hay ninguna razón específica del proyecto para preferir Jest.

Nota histórica sobre el import: `shared/utils.js` no era un módulo ESM/CJS y hubo que agregarle un guard de exportación para poder testearlo. Ya no aplica —ese archivo se repartió en la Fase 6a y todo el núcleo es ESM/TypeScript—, pero explica por qué `package.json` **no** declara `"type": "module"`.

## Qué testear primero, y por qué

### 1. Lógica pura (lo que hoy es `core/util/`) — prioridad máxima ✅ cubierto (inicial)

Fue lo primero porque era la única capa de negocio ya desacoplada del DOM y de `chrome.*`: se testea sin ningún mock. Vivía en `shared/utils.js` (cubierto en `shared/utils.test.js`, más `escaparHtml`, agregado con el fix de XSS); desde la Fase 6a son `core/util/texto.test.ts` y `core/util/reintentos.test.ts`. El *mecanismo* de parsing/clasificación vive en `docs/patterns.md` §Sanitización; acá sólo el *por qué* de la prioridad de test. En orden de criticidad:

1. **`formatTitleStructured`** — la función más compleja del proyecto (múltiples regex aplicados en secuencia, donde el orden importa). Un bug acá corrompe el nombre de archivo de la clase descargada.
2. **`clasificarCatedraYCarpeta`** — determina a qué carpeta/cátedra se asigna cada clase. Un bug acá mueve archivos al lugar equivocado silenciosamente.
3. **`parseSmartDate`** — heurística de desambiguación día/mes (la regla exacta, en `docs/patterns.md` §Sanitización). Fácil de romper con un cambio aparentemente inocuo.
4. **`sanitizarTexto`** — nombres de archivo inválidos rompen la escritura a disco del backend Bun.

Casos de borde a cubrir explícitamente para `formatTitleStructured`/`clasificarCatedraYCarpeta`: títulos sin fecha, títulos con cátedra explícita ("CATEDRA B") vs. implícita ("ANATO B"), títulos con acentos, títulos con múltiples números que podrían confundirse con clase/parte/fecha.

### 2. Funciones de soporte de esa misma capa (prioridad media)

- `calcularMétricasProgreso` / `formatearMB` / `calcularProyeccionMB` — cálculos de telemetría, bajo riesgo pero baratos de testear.
- `fetchConReintentos` — requiere mockear `fetch` global (`vi.stubGlobal` o similar) y un `AbortController` real para el caso de cancelación.

### 3. Service worker: `background.js`, `core/cola/` y `core/hls/` — cubierto

- **el motor HLS** (`core/hls/hlsEngine.test.ts`): cubierta la función pura `descargarYAnalizarIndexM3u8` (parseo del manifiesto + `#EXT-X-KEY` + absolutización de fragmentos). También el **pool de 6 workers** `compilarTranscodificacionStream`. **Desde la Fase 6 no se stubea ni un global**: el motor es una factory y el test le pasa sus cuatro colaboradores, más el `contexto` de la ráfaga y el callback `abortarHermanos` que antes eran `SessionState` y `controladorGraficoActivo` leídos del ambiente. Se verifica el reparto de índices sin duplicar/saltear con tope de concurrencia 6, turbo vs blob, descifrado AES por fragmento, el abort en cascada ante un fallo real (los hermanos rechazan `AbortError` callado y gana el error real), el `signal` ya abortado y el throttling del progreso — más el path del reintento 4xx (bug 400: 3 intentos → propaga el error tipado; un no-rechazo no se reintenta).
- **`background.js`** (`background.test.js`): cubiertos los handlers IPC del dict `manejadoresIPC` (encolar/remover/estados en progreso) **y, desde 2026-08-03, el bucle de descarga completo + el auto-heal**, con un **harness manual** (`crearArea` + un `chrome` mock con store en memoria) que importa el SW sin modificar código de producción: `importScripts` se neutraliza, `chrome.*` se mockea (incluido `chrome.notifications`, cuyo `onClicked` se registra al cargar el SW), y el listener de `onMessage` se captura al registrarse. **No** se usa `sinon-chrome` (añade dep de runtime, contra ADR-0001). El bucle (`procesarSiguienteElementoDeLaCola`) se ejercita arrancándolo por su camino real (IPC `iniciar_descarga_cola`) con el motor HLS stubeado, y se espera a que drene. Dos aprendizajes del harness, que valen para quien lo extienda: (1) `loopActivo` es estado de MÓDULO, así que un test que deje el bucle marcado como activo rompe al siguiente — hay un `afterEach` que lo resetea por el único camino público que lo apaga (`abortar_rafaga_inmediata`); (2) los flags de sesión hay que moverlos por IPC y no escribiéndolos a mano en el store, porque `iniciar_descarga_cola` resetea `frenadoSuaveSolicitado` y `abortar_rafaga_inmediata` es quien apaga `loopActivo` — sembrarlos directo da un test que pasa sin probar el camino real. Sigue afuera el listener `chrome.notifications.onClicked` (no alcanzable desde el harness IPC). **Desde la Fase 6b el harness construye el procesador de cola REAL** (`crearProcesadorCola` con dobles de sus once colaboradores): ya no stubea el bucle, lo ejercita. Y **desde el 2026-08-03 casi no mockea `chrome.*`**: el auto-heal va por `ProgramadorEnMemoria` y el IPC entero por `MensajeriaEnMemoria`. `chrome.storage`, `chrome.alarms`, `chrome.runtime.onMessage` y `chrome.runtime.sendMessage` son getters que **tiran** si el SW los toca, para que una regresión no pase en silencio. Dos consecuencias para quien escriba tests acá: los mensajes que emite el SW se leen en `mensajeria.notificados` —que a propósito no incluye los que mandó el propio test para invocarlo, cosa que el array único del mock viejo no distinguía—, y el harness construye el doble con timeout de 5s porque los handlers responden tras varios `await`: con el 0ms por defecto el puerto rechazaría antes de la respuesta y los tests fallarían por el reloj. Eso trajo un cambio de fidelidad que conviene conocer antes de escribir un test de alarma: el doble sólo notifica si la alarma está **programada** (como el navegador), así que sembrar "la cola quedó pausada" ahora incluye programarla; y los disparos se hacen con `dispararYEsperar()`, que aguarda al handler `async` en vez de dormir un rato y cruzar los dedos. La lógica de storage del historial en sí **sí** está cubierta, aislada, en `core/historial/historialFallos.test.ts` (con el adaptador en memoria del puerto, sin mocks de `chrome.*`).

### 4. `popup.js` — parcial: lo ya extraído está cubierto, el núcleo sigue bloqueado

El `popup.js` original era un único closure `DOMContentLoaded` con ~50 funciones anidadas no exportables — no testeable así. La Fase 2 (cerrada) extrajo la lógica cohesiva a `popup/features/*` (y a islas Preact), y esos módulos **sí** se testean de forma aislada: hay tests para `serverConnection`, `queue`, `filters`, `faceta` (el módulo que hasta el cierre de la Fase 2 se llamó `catedra`) y las seis islas Preact. Lo que queda sin cubrir es el núcleo de `popup.js` que por diseño permanece en el closure (init + wiring + orquestación de scraping/render, que ADR-0005 define como estado final) — ver `docs/ROADMAP.md` Fase 2 y `docs/adr/0005-feature-driven-popup-split.md`.

## Qué NO testear (por ahora)

- El render de la lista de clases se migró a la isla Preact `popup/features/listaClases.preact.js`, que **sí** está cubierta con jsdom (`listaClases.preact.test.js`). Lo que queda de `renderers.js` (`pintarTelemetria`, más los ports `construirFilaClaseDOM`/`renderizarTarjetaEstado` que quedaron como referencia muerta hasta la Etapa 2 de la migración) y `sitio/ramonnet/scraper.js` (scraping de un DOM de terceros) siguen de menor prioridad que la lógica de negocio pura. Si se testean, usar jsdom para simular el DOM. **Ojo con qué significa ese hueco en el caso del scraper**: `escanearAulaVirtual` se inyecta en la pestaña del portal y tiene que ser autocontenida (ver `docs/architecture.md` §Capa 2), así que romperle esa regla —subiendo una constante suya al `config.ts`, por ejemplo— no lo detecta ninguna de las cuatro verificaciones. Es el único punto donde "no hay test" implica que sólo lo agarra abrir el popup contra el aula virtual.
- No hay necesidad de tests end-to-end automatizados (ej. Playwright) contra el backend Bun real — el golden path manual descrito en `docs/contributing.md` cumple ese rol mientras el proyecto sea de este tamaño.

## Convención de archivos de test

Co-locar el test junto al archivo que testea: `core/util/texto.test.ts` al lado de `core/util/texto.ts` (no una carpeta `__tests__/` separada) — sigue el patrón `*.test.ts` mencionado como referencia en proyectos hermanos, adaptado a `.js`.
