# Ramas en revisión

**Hogar canónico del estado del trabajo en curso que todavía no está en `main`.**

Este doc existe para que ese estado deje de vivir en las reglas de agente (`AGENTS.md`). Es
información con fecha de vencimiento: cambia con cada merge, y mientras vivió en el banner de
`CLAUDE.md` lo hizo cambiar en 85 de 187 commits.

**Lo que este doc NO es:**

- No es el backlog. Los ítems abiertos viven en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- No es la baseline de la compuerta. Los números viven en `docs/testing.md` §Baseline.
- No es el diseño de nada. Cada corte apunta al doc que explica lo que construye.

---

## ✅ `tanda-toolbar-capa-y-pnpm` — construida, compuerta verde, **VERIFICADA EN CHROME**

**Estado al 2026-08-13.** **Seis commits de código** sobre `main` (`66a50c6`), más los de docs. La
compuerta pasa entera — **38 archivos / 674 tests**, lint 0, `tsc` limpio, build 0 — y eso **no
dice nada** sobre esta zona: casi todo cae en el núcleo de `popup.js` y en el CSS, que es
exactamente donde la suite no ve (la lección de la tanda anterior, más abajo). Por eso la
verificación en navegador es la que cuenta acá, y está hecha.

> **Qué quedó registrado de esa verificación, y qué no.** El dueño recorrió los 9 puntos de abajo
> y confirmó que **anda todo**. No se anotó un desglose punto por punto, así que **esto es un
> resultado global, no una medición** — del mismo tipo que la casilla 4 del corte 7 y que la
> verificación del escaneo por API (`docs/escaneo-api-anatomy-diseno.md`). Se escribe así a
> propósito: es exactamente lo que lo distingue de un ✅ inventado, y si mañana aparece un defecto
> en esta zona, lo primero que hay que saber es que no hubo desglose que lo hubiera atrapado.
>
> **La lista de los 9 se conserva entera** aunque ya esté verificada, porque es la lista de qué
> mirar cuando algo de esta zona se rompa — no un formulario que se tacha y se tira.

**La rama creció después de la primera anotación**, y los tres commits nuevos son de otra
naturaleza que los tres primeros: los primeros fueron el toolbar y la capa, los nuevos salieron de
**medir el arranque con el banco**. Esa medición es el hilo que los une y conviene saberlo antes
de mirar: dos de los cuatro carteles del arranque duraban menos de lo que tardan en leerse, y el
peor de los dos no estaba donde el diseño suponía.

**El build cargado en `.output/chrome-mv3/` es el de esta rama, con el banco de pruebas
APAGADO** — se apagó al terminar de verificar (`BANCO_DE_PRUEBAS = false` en
`entrypoints/popup/main.js`). Volver a encenderlo es esa línea y `pnpm run build`. Si algo falla
y querés descartar todo: `git checkout main && pnpm install && pnpm run build`.

### Qué trae, por commit

| Commit | Qué |
|---|---|
| `5a3a57b` **build** | Migración de npm a **pnpm** |
| `841441b` **style(css)** | Micro-movimientos de hover/clic + restyle de la path-bar + foco |
| `1221643` **feat(popup)** | Bloqueo reutilizable, controles que siguen al resultado, carteles de lista vacía, capa flotante compartida, foco atrapado, banco |
| `77a8ed5` **build** | Sacar la clave `pnpm.onlyBuiltDependencies` de `package.json`, que pnpm 11 ignora |
| `ffc8baa` **feat(popup)** | **Piso visible**: ningún cartel de "estoy trabajando" dura menos de 500 ms. Y el footer de descarga vuelve entero al reanudar |
| `45bc529` **feat(popup)** | El filtro por **materia** vuelve a Disponibles, y el popover se re-ancla solo con CSS Anchor Positioning |

#### `5a3a57b` — pnpm

`pnpm-lock.yaml` + `pnpm-workspace.yaml` entran, `package-lock.json` se va, la versión queda
fijada con `"packageManager": "pnpm@11.1.1"`. **La migración estaba empezada y rota**: el
`install` salía con código 1 y, como pnpm lo re-corre antes de cada script, tumbaba los cuatro
comandos de la compuerta a la vez. Las dos causas (la peer dep `vite` de WXT y el `allowBuilds`
de esbuild) están en `docs/contributing.md` §Las dos trampas de pnpm — **no son evitables y no se
arreglan solas**, así que se leen antes de tocar dependencias.

#### `841441b` — lo visual

- **El parpadeo del hover era `transform: translateY(-0.5px)`**, en cinco lugares. Medio píxel no
  se puede apoyar en la pantalla: el navegador re-rasteriza y le cambia el suavizado al texto, y
  eso se lee como cambio de tamaño. Se fueron también los tres `:active { scale() }`.
- **La ruta del disco** dejó de parecer un input, recorta por la izquierda (la cola de la ruta es
  la que informa) y arranca pegada a su rótulo. Su `text-overflow: ellipsis` **no funcionaba**:
  el elemento era `display: flex`.
- **Un solo tratamiento de foco** en los dos campos de texto: se veían tres encimados.

#### `1221643` — el grueso

Cinco partes, todas atadas a `popup.js` (por eso van juntas). El detalle de cada una está en el
mensaje del commit y, con su porqué, en `docs/alertas-y-bloqueo-diseno.md` §2.0, §6.8, §6.9 y
§6.10, y en `docs/preact-migration.md` §La capa flotante compartida.

- **`popup/features/bloqueo.js`** — el contrato del §2 dejó de estar copiado en tres funciones de
  `popup.js`, o sea en el único archivo que la suite no ve.
- **Los controles siguen al resultado** — "Todos", "Ordenar" y "Seleccionar" se apagan cuando no
  hay sobre qué actuar; el buscador y los filtros **no**, nunca, porque son la salida.
- **Los carteles de lista vacía dicen cuál de las tres causas fue**, usando el mismo predicado
  que decide el bloqueo, así el cartel y el bloqueo no pueden contradecirse.
- **`popup/features/capa.preact.js`** — la superficie flotante compartida, con sus **4
  consumidores migrados** y foco atrapado en la variante modal.
- **El banco** estrena el switch "sin lista previa", y su cabecera lleva ahora el inventario de
  las 12 tarjetas y cómo se fuerza cada una.

#### `ffc8baa` — el piso visible (y el footer que volvía a medias)

**Salió de medir, no de mirar.** Con el banco encendido, los cuatro carteles del arranque no
tienen término medio: dos duran ~3 s y **dos son destellos** — 248 ms el del loader, 117 ms el del
botón. Los tiempos, con sus dos advertencias, viven en `docs/TECHNICAL_DEBT.md` §El loader del
popup no tiene dueño; no se copian acá.

- **`popup/features/pisoVisible.js`** (+ 10 tests) garantiza que un cartel transitorio se quede
  500 ms. **Dos entradas y no una**: `transitorio()` para los avisos de trabajo, `libre()` para
  los rótulos de estado — ponerle piso al contador del botón lo volvería pegajoso al tildar
  casillas.
- **El peor destello estaba en el botón**, que el diseño del corte ni tocaba. Por eso hay dos
  instancias del piso y no una compartida: el piso es del cartel, no de la pantalla.
- **`serverConnection.js` recibe `ocultarLoader` por `ctx`**. Escribía `nodos.loader` directo, que
  es el único camino por el que el piso se saltea sin que nada avise.
- **El texto inicial del loader** dice ahora "Conectando con el servidor Bun…" — ver el §Lo que
  falta, que explica por qué ese texto es del markup y no de un flujo.
- **El footer de descarga**, que cae en el mismo archivo: reanudar tras una pausa escribía tres
  propiedades a mano y **se olvidaba de la clase `downloading`**. La barra volvía sin su línea
  divisoria y con el footer en tamaño normal — "casi bien", y sólo por ese camino.

#### `45bc529` — el filtro de materia, y un popover que ya no es de ancho fijo

- **Disponibles se había quedado sin eje de materia** en un portal de dos niveles, mientras la
  Cola sí lo tenía. La historia completa —y por qué un `true` fijo puesto como guarda fue en
  realidad una decisión de producto— está en `docs/escaneo-api-anatomy-diseno.md`.
- **El popover pasó a `width: max-content` con tope**, y de ahí sale todo el resto: al crecer se
  salía por la izquierda del popup, y con once módulos se iba abajo arrastrando el scroll de la
  página entera.
- **Se re-ancla solo, con CSS Anchor Positioning**: se declara la posición preferida y una
  alternativa, y el navegador mide antes de pintar. Los dos menús de la barra son ahora el mismo
  mecanismo y lo único propio de cada uno es su `--ancla`. **La trampa a no repetir**: dos anclas
  con el mismo nombre no conviven — el menú se ata a la última del documento, así que los dos
  saldrían del mismo botón.

### Qué mirar en Chrome, en este orden

Son ocho cambios visuales encadenados; si algo se ve mal, **el orden importa para aislar**.
Encendé el banco con **F9**.

**Los tres últimos (7, 8, 9) hay que mirarlos con el banco APAGADO también**, y es la única parte
de esta lista donde eso cambia el resultado: el banco demora el escaneo a propósito para poder
leer los carteles, que es exactamente lo que el piso viene a arreglar. Con el banco encendido, un
piso que no funcione se ve igual de bien.

1. **Hover y clic** (`841441b`, se revierte solo). Pasá el mouse por la lista larga: sin temblor
   ni cambio de grosor de letra. Apretá los botones: sin hundido.
2. **Path-bar** (`841441b`). Ruta larga → tiene que leerse `…\OneDrive\Escritorio\descargas`, no
   al revés. Foco en MATERIA y en Buscar: **un** borde naranja con su halo, sin recuadro extra.
3. **Bloqueo** (`1221643`). Filtro en "descargados" → "Todos" apagado, con el mismo tinte y el
   mismo cursor en la casilla **y** en la palabra; "Ordenar" **encendido** (hay clases que
   ordenar). Buscá algo inexistente → se apagan Ordenar y Seleccionar, pero el buscador y
   Filtros **siguen vivos**. Con el servidor caído (banco), las dos filas de la path-bar tienen
   que quedar con **el mismo** tinte.
4. **Carteles** (`1221643`). Parado en una página cualquiera → Re-escanear → card 🧭 con los dos
   portales nombrados. Banco: "sin lista previa" + resultado `vacío` → "Sin clases detectadas".
   Y el que antes fallaba: quedate en esa card, andá a Fila y volvé — **no** tiene que
   reemplazarse por la del filtro.
5. **Capa flotante** (`1221643`), los cuatro:
   - **Campanita**: Escape, clic afuera, y clic en el 🔔 estando abierta (ése es el que antes no
     cerraba). Título largo en dos líneas.
   - **Faceta**: el badge abre el modal; elegir aplica y cierra; Escape también (antes no).
   - **Advertencia** (📂 Explorar): Entendido / Cancelar / Escape. **Escape ahora equivale a
     Cancelar** — es un cambio de conducta. Y el check "no volver a mostrar" tiene que seguir
     persistiendo.
   - **Onboarding** (F9 → forzar): el clic al fondo **no** lo cierra, "Saltar" sí, el carrusel no
     se desborda, y tabulando dentro de una slide **no** se llega al link ni al botón de otra.
6. **Foco atrapado**: con la advertencia abierta, dando la vuelta con Tab no se puede llegar al
   buscador ni a los filtros de atrás. Al cerrar, el foco vuelve al botón Explorar.
7. **El piso de los carteles** (`ffc8baa`), **con el banco apagado y el servidor prendido**. Abrí
   el popup en Anatomy y mirá la secuencia entera: "Conectando con el servidor Bun…" (es el
   primero, no "Leyendo la pestaña…") → el botón "Conectando con el servidor… ⏳" →
   "Escaneando la pestaña…" → "Sincronizando disco local…". **Los cuatro se tienen que poder
   leer**; ninguno puede aparecer y desaparecer de golpe. Antes, el primero y el último no se
   veían.
   - **Y lo que NO puede pasar, que es donde este corte se rompe**: que el arranque se sienta más
     lento. El piso del primer cartel descuenta lo que el usuario ya esperó, así que el total
     hasta ver la lista tiene que quedar parecido a lo de antes (~3,5 s), no ~4,5 s.
   - **El contador del botón no lleva piso**, a propósito: tildá tres casillas rápido y el número
     ("Agregar N clases…") tiene que ir al día, sin quedarse atrás medio segundo.
   - **El onboarding es la excepción escrita**: con el tutorial pendiente, la cortina se apaga al
     instante. Si aparece el tour con una cortina encima medio segundo, se rompió esa vía.
   - **Y la línea divisoria del footer** (arriba del botón) tiene que estar mientras hay algo que
     hacer. Si parpadea o desaparece al tildar casillas, es la medición que lee el DOM antes de
     que la escritura aterrice — el `hayPendiente()` del módulo.
8. **El footer al reanudar** (`ffc8baa`). Es el que sólo falla por un camino: arrancá una descarga,
   **pausala** (frenado suave o caída de servidor con el banco), y reanudá. El footer tiene que
   quedar **idéntico** al de una descarga arrancada limpia: línea divisoria arriba, footer
   compacto, barra de 5 px, telemetría chica y caja de cancelar. Antes volvía sin la línea y con
   el footer en tamaño normal.
9. **El popover de filtros** (`45bc529`), en Anatomy, que es donde hay once módulos. Abrí Filtros
   en **Disponibles**: tiene que estar la sección **Materia** con los módulos, cada opción en
   **una fila** (checkbox a la izquierda, texto al lado — no envuelto abajo), y el menú **no se
   puede salir** por la izquierda ni por abajo. Scrolleá adentro del menú: se mueve **el menú**,
   no la página.
   - **Que filtre de verdad**: tildá un módulo → quedan sólo sus clases. Con el input MATERIA
     vacío y sin nada tildado, **la lista tiene que verse entera** (ése era el bug original).
   - **En Ramón Net no tiene que aparecer** la sección Materia (un solo nivel), y en un portal con
     un único módulo tampoco.
   - **Y el menú de Orden**: abrilo y confirmá que sale de **su** botón y no del de Filtros. Los
     dos comparten mecanismo ahora; si las anclas se pisaran, saldrían del mismo lugar.

---

## Lo que falta, para una próxima sesión

### 1. 🔴 El loader no tiene dueño — **construida la mitad del tiempo, falta la del dueño**

> **Ojo con este ítem: cambió el 2026-08-13 y ya no es "el corte que estaba por arrancar".** El
> commit `ffc8baa` construyó **el piso visible** (`popup/features/pisoVisible.js`) y con eso los
> 12 call-sites crudos dejaron de existir: la cortina se toca por `mostrarLoader`/`ocultarLoader`
> y el botón por `configurarBotonesUX`, que ahora es un embudo. **Lo que sigue abierto son tres
> cosas, y ninguna es cosmética**:
>
> 1. **Los tokens.** `elEscaneoTomoElLoader` sigue vivo (`popup.js`): dos dueños del mismo nodo
>    puestos de acuerdo a mano. El piso ordena *cuándo* se pinta, no *quién* puede apagar.
> 2. **La demora de ~150 ms para aparecer**, que es la otra mitad del par — el piso evita el
>    destello de lo que ya salió; la demora evita que salga lo que no hacía falta.
> 3. **El dueño del nodo.** `pisoVisible.js` no es dueño de nada: nada impide escribir
>    `nodos.loader` por atrás y saltearlo en silencio, que es exactamente lo que este ítem se
>    llama.
>
> Lo que sigue abajo es el diseño completo del corte, que se conserva entero porque **las tres
> partes que faltan se leen contra él**. Las decisiones de tiempo (piso por texto, el label del
> botón, el nodo que nace visible) ya están construidas y quedan como el registro de por qué.

El `<div id="ui-loader">` se prendía y apagaba escribiendo `style.display` **a mano desde 12
lugares** —once en `popup.js`, uno en `popup/features/serverConnection.js`—, con tres textos
escritos a mano. No tiene componente, ni store, ni isla — a diferencia de la ruta (`RutaDisco`),
el banner (`BannerConexion`) y la lista (`ListaClases`). **Antes de arrancar lo que falta,
re-contá con `grep -rn "loader.style.display" popup.js popup/features/*.js`**: acá decía 9 y
siempre fueron 12 (mal contados, no crecidos — ver `docs/TECHNICAL_DEBT.md` §El loader del popup
no tiene dueño). Hoy ese grep da **cuatro líneas, que son tres escrituras**: dos adentro del
embudo (`mostrarLoader`/`ocultarLoader`) y la vía de escape del onboarding (`pisoLoader.inmediato`,
`popup.js:871`); la cuarta es **un comentario** en `serverConnection.js` que nombra lo que ese
archivo dejó de hacer. Contá después de filtrar comentarios — el mismo cuidado que pide
`docs/architecture.md` §Las capas para el residuo de `chrome.*`, y por el mismo motivo: contar
crudo infla el trabajo que falta.

**Ya se pagó un bug por eso** (§6.2 del doc de alertas): el loader del escaneo inicial no se veía
nunca, porque `conectarYArrancar` lo apagaba en su `finally` **en el mismo tick** — el escaneo no
es `async`, vuelve apenas encola su `chrome.tabs.query`. Se cerró con una **bandera**,
`elEscaneoTomoElLoader` (`popup.js:750` y `:803`): dos dueños del mismo recurso puestos de acuerdo
a mano, que es el antipatrón que el §1 de ese mismo doc prohíbe para la región de la lista.

**El síntoma que era vivo hasta el `ffc8baa`**: el escaneo rápido hacía vivir al loader 100-200 ms.
Es menos de lo que el ojo registra, así que se veía un destello y parecía que no funcionó. **Eso
es lo que cerró el piso** — pero cerrarlo con el nodo todavía sin dueño es lo que deja el ítem
abierto y no resuelto.

El corte, tal como quedó diseñado (⬜ = falta, ✅ = construido el 2026-08-13):

- ⬜ **`popup/features/loader.js`, dueño único.** `mostrar(texto)` / `ocultar(token)`. Nadie más
  escribe `style.display` sobre ese nodo. **Sigue siendo el corazón del ítem**: hoy hay embudo,
  que no es lo mismo que dueño — un embudo se puede esquivar.
- ⬜ **Tokens, no un booleano.** `mostrar()` devuelve un comprobante y se apaga cuando **todos** lo
  devolvieron. La diferencia con la bandera no es de estilo: nadie puede apagar el loader de otro
  **porque no tiene cómo**, en vez de porque se acordó de preguntar. Con eso desaparece
  `elEscaneoTomoElLoader`.
- **Dos tiempos, y no una `transition`** — ✅ el mínimo visible, ⬜ la demora. Una transición
  controla *cómo* se ve el cambio, no *cuándo* empieza: el fade arranca igual en el instante cero
  y se lee como "se está cerrando". Las reglas son: **~150 ms de demora para aparecer** (si el
  trabajo termina antes, el loader no aparece nunca — el destello se elimina en vez de alargarse)
  y **500 ms de mínimo visible** si llegó a pintarse.
- ✅ **El mínimo visible es POR TEXTO, no por encendido** (decidido el 2026-08-13). El loader es uno
  solo pero los textos son varios, y un texto que se pinta 80 ms es igual de inútil que un loader
  que parpadea: el usuario tiene que poder leerlo y sacar de ahí que algo está pasando **ahora** y
  que lo que ve no es viejo. Así que cada cambio de texto arranca su propio piso de 500 ms; el
  siguiente espera. Sin esto, el corte arregla el parpadeo del loader y deja intacto el de los
  carteles que van adentro.
- ✅ **Y el piso alcanza al LABEL DEL BOTÓN, no sólo al loader.** Esto lo decidió la medición, no el
  diseño: el peor destello del arranque **no está en el loader** — "Sincronizando disco local…"
  dura **117 ms** contra los 248 ms de "Conectando con el servidor Bun…". Los cuatro tiempos
  medidos, con sus dos advertencias (los 248 son un piso, y son con el servidor prendido) →
  `docs/TECHNICAL_DEBT.md` §El loader del popup no tiene dueño, que es su hogar canónico; no los
  copies acá. **La interacción a respetar**: `configurarBotonesUX` decide *si* el botón se ve
  (§3 de `alertas-y-bloqueo-diseno.md`), así que el piso va sobre el **texto** y jamás sobre la
  visibilidad — retrasar el ocultado deja un botón ofreciendo una acción que ya no existe.
- **El nodo nace visible por CSS, y eso se conserva a propósito** — `.loader-overlay` trae
  `display: flex` (`styles/components/loader.css:8`) para que no se vea la UI a medio estilar en
  los primeros frames. Tres consecuencias que el diseño tiene que absorber, y ninguna es teórica:
  - **La demora de ~150 ms para aparecer NO aplica al loader del arranque**, que ya está en
    pantalla antes de que exista JS. Aplica a los que un flujo pide después (el 📂, por ejemplo).
  - **El texto del markup es el de la primera fase real.** Desde el 2026-08-13 dice "Conectando
    con el servidor Bun…" y no "Leyendo la pestaña…", porque lo primero que corre es la conexión
    y la secuencia quedaba **pestaña → servidor → pestaña**. Sigue siendo caso C de
    `docs/copy-generico-diseno.md` (genérica, sin nombrar portal).
  - **El piso de 500 ms del primer texto cuenta desde que se pintó, no desde que un flujo lo
    reclama.** Si la lectura de storage tardó 400 ms, quedan 120, no 500. Sin esta regla el piso
    se cobra dos veces en el arranque (≥1 s antes de ver la lista) por una espera que el usuario
    **ya hizo**.
- ✅ **Y el arranque con onboarding es la excepción que hay que dejar escrita**: el apagado
  inmediato para que la cortina no tape el tour (tiene `z-index` mayor) **no puede esperar
  500 ms**. Construido como `pisoLoader.inmediato(...)` y es el **único** del archivo, con el
  porqué al lado. La regla que lo resuelve sin caso especial: el piso protege al texto que un
  **flujo** puso; el que trae el markup no es una reclamación de nadie, así que se puede apagar
  sin deuda.
- **El riesgo, y hay que mirarlo**: los tiempos hacen que el loader viva **más allá** del
  `finally` que lo pidió, así que hay que revisar que ninguna de las 4 salidas del escaneo asuma
  que apagar es inmediato. Los tiempos y el conteo se testean con temporizadores falsos.
- **Y el riesgo que la construcción destapó y el diseño no preveía**: el código que **lee el DOM
  justo después de pedir una escritura**. Con el piso, esa escritura puede estar en cola y la
  medición lee el estado viejo. Costó la línea divisoria del footer; se cerró con
  `hayPendiente()`, y es el primer lugar donde buscar si aparece otro. Quien agregue un consumidor
  nuevo del piso se lo va a encontrar.

### 2. 🔴 `#ui-msg-status` está oculto y nadie se lo destapa

El `<p>` de la línea de estado del footer nace con `style="display:none"` inline
(`entrypoints/popup/index.html`) y **no hay en todo el repo** un `txtEstado.style`, un
`removeAttribute` ni una regla con `!important` que lo pise. Todo lo que se escribe ahí es
invisible: ~20 sitios, incluido **el texto de progreso de la descarga**.

**El arreglo es de una línea** (sacar el inline; el `.status-text:empty` de `footer.css` ya lo
colapsa vacío). Lo que falta es la pasada por navegador: destapa los ~20 mensajes de golpe y hay
que mirar el footer **descargando**, que es donde cambia de alto.

Detalle completo en `docs/alertas-y-bloqueo-diseno.md` §6.8b. **Ojo con "arreglarlo" mandando
mensajes ahí**: ese destino ya se descartó para el watchdog *aunque estuviera visible*, porque
comparte el footer con el diagnóstico de conexión y queda pisado.

### 3. 🟠 Lo que el banco todavía no puede forzar

Con el switch nuevo, **9 de las 12 tarjetas** se fuerzan desde el panel y las otras 3 se alcanzan
a mano en dos clics. Lo que queda afuera es de otra naturaleza:

- **Una descarga en curso** — la barra de progreso, la telemetría, el frenado suave y la caja de
  cancelar sólo existen con el service worker bajando de verdad, y el banco **sólo envuelve APIs
  del popup**. Cubrirlo es otro mecanismo (contestar IPC de progreso falsos), no un switch más.
- **El historial de fallos** (la campanita) no se puede sembrar.

### 4. ⚪ Coherencia visual pendiente

- **`scale(1.15)` en el hover** de la campanita (`campanita.css:24`) y del `?`
  (`help-button.css:17`). No parpadean —un 15% es un efecto deliberado, no sub-píxel— pero
  **cambian de tamaño en hover**, que es lo que se sacó en todos los demás. Los dos ya avisan por
  color, así que sacarlo no los deja mudos.
- **`transition: all` en 8 reglas** (`actions.css`, `advertencia.css`, `faceta.css`,
  `filters.css`, `header.css`, `onboarding.css`). `all` anima *cualquier* propiedad que cambie,
  incluidas las que mueven layout: es el origen latente del próximo parpadeo, porque nadie
  declaró qué quería animar.

---

## Lo que dejó la tanda anterior, y conviene no volver a aprender

- **Verificar en el navegador encontró OCHO defectos que la compuerta no vio**, y **cuatro los
  introdujo el arreglo del anterior**. La tabla completa y las lecciones están en
  `docs/alertas-y-bloqueo-diseno.md` §5.1 — es el hogar canónico de ese registro y vale leerlo
  antes de la próxima tanda sobre el popup.
- El resumen en una línea: lo que cae en el núcleo de `popup.js` y en el CSS **sólo lo ve un
  humano abriendo el popup**, y "la compuerta está en verde" no dice nada sobre esa zona.

### El banco de pruebas ya no es una rama

**Vive en el código**, en `verificacion/modoVerificacion.js`, y se enciende con **una línea**:
`BANCO_DE_PRUEBAS = true` al final de `entrypoints/popup/main.js` + `pnpm run build`.

Vivió en una rama descartable y **se perdió dos veces**: primero quedó con un build viejo
mientras el trabajo avanzaba —cargarla verificaba una versión anterior sin que nada avisara— y
después hubo que rearmarla con siete cherry-picks. Una herramienta que hay que reconstruir cada
vez que se usa es una herramienta que no se usa.

Apagado no cuesta nada, y **se re-mide** (si no, el número envejece y el argumento deja de
valer). Los kB no se copian acá: viven en la cabecera de `verificacion/modoVerificacion.js`, que
es su hogar canónico.

**Y la regla de cuándo re-medir cambió el 2026-08-13**, al cerrar esta tanda: decía "en cada
versión del banco", y eso alcanza sólo si el banco es lo único que se mueve. Los dos builds
subieron ~3,3 kB con el banco intacto en v3.1.0 — lo que creció fue el popup. **Lo que hay que
mirar es la resta entre los dos**, que es el costo real del banco y se quedó donde estaba
(18,31 kB); leer sólo la columna de `true` haría parecer que engordó el banco cada vez que crece
la extensión.

---

## Cómo usar este doc la próxima vez

Cuando haya trabajo fuera de `main`, acá va: qué rama, qué trae, qué mirar en Chrome y cómo
aislar si algo falla. Cuando se mergea, esta sección vuelve a decir «nada en revisión».

Lo que las tandas enseñaron sobre el proceso:

- **Una rama de integración deja `main` intacta** mientras se verifica, y si algo falla se
  descarta entera. Salió barato y conviene repetirlo.
- **Un commit por corte**, para que un `git revert` aísle. Los seis defectos de la tanda anterior
  se ubicaron por commit sin buscar.
  - **Y cuándo NO se puede**, que pasó en `1221643`: si un archivo participa de varios cortes
    —ahí, `popup.js`— separarlos deja commits intermedios que no compilan. Ahí conviene un commit
    grande y honesto antes que un historial lindo y roto. Se paga en granularidad del `revert`.
- **Anotá también qué hace falta para poder MIRAR el resultado.** El loader invisible era
  precondición de la verificación del copy genérico, y eso no aparecía en ninguna lista de
  dependencias: las dos entradas se veían independientes.
