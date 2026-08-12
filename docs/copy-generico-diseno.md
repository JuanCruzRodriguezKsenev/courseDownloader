# Copy genérica: sacar el vocabulario de Ramón Net de las capas genéricas

**Estado (2026-08-12): 🟡 LOS TRES CORTES ESTÁN HECHOS; FALTA LA VERIFICACIÓN EN NAVEGADOR DE DOS.**

> - **Corte 3 (§5.2, la marca)** — ✅ cerrado y verificado, pero **no por este frente**: se lo
>   llevó puesto `ee32c0c`, el rename a Course Downloader de la Fase 3 de la fusión.
> - **Corte 1 (§5.1, los swaps)** — construido en la rama `copy-generico-corte-1`. Compuerta
>   verde, **navegador pendiente**.
> - **Corte 2 (§5.3, la instrucción de escaneo)** — construido en `copy-generico-corte-2`,
>   **apilado sobre el corte 1** porque los dos tocan `onboarding.preact.js`. Compuerta verde
>   + 2 tests nuevos, **navegador pendiente**. Se mergean en orden: 1 y después 2.
>
> **Las cuatro decisiones se tomaron el 2026-08-12** y están en cada sección: §3 se acordó tal
> cual estaba; §4 salió por la **salida 1** (texto genérico); §5.3 va con **miembro nuevo en
> `PuertoSitio`** —y se ejecutó **requerido**, no opcional, ver ahí por qué—; el tono de la copy
> genérica es **pelado** ("Re-escanear 🔄", "Analizando…"), con el criterio de que no pueda
> mentir en ningún portal.
>
> **La verificación en navegador es la única que ve algo acá** (casi todo cae en `popup.js`,
> ADR-0005). Los puntos a mirar están en §7.

Esto nació como el **inventario medido** de dónde la UI genérica nombra a Ramón Net, más una
propuesta de cómo arreglarlo, escrita para poder discutirse en otra sesión sin volver a medir.
Hoy es además el registro de cómo se ejecutó. Si venís a retomarlo, lo que importa es §7 (qué
falta verificar) y §8 (qué erró la medición).

**Dónde vive el estado del backlog**: en `TECHNICAL_DEBT.md` §🔴 Abierto, y ahí sigue —ese doc es
el hogar canónico de *qué está abierto y por qué* (ADR-0007). Este doc es el **cómo**, igual que
`multisitio-diseno.md` es el cómo de ADR-0010. El ítem del backlog está **postergado por decisión
de prioridad del dueño**, no bloqueado, desde el 2026-08-07.

**Decisiones de base que lo condicionan**: [ADR-0010](adr/0010-el-sitio-es-del-item.md) (el sitio
es del ítem, no de la build — de acá sale que cierta copy **no debe** nombrar portal),
[ADR-0008](adr/0008-arquitectura-nucleo-adaptadores.md) (la UI no habla el vocabulario de un
portal) y [ADR-0005](adr/0005-feature-driven-popup-split.md) (`popup.js` no se extrae, por eso
casi todo esto se verifica sólo en navegador).

---

## 1. Por qué el conteo viejo quedaba corto

`TECHNICAL_DEBT.md` registraba **"6 strings en `popup.js`"**, medido el 2026-08-06. Re-medido el
**2026-08-11** con ripgrep y filtrando comentarios —el método que el propio ítem exige—, son más.
No aparecieron: la medición original buscó **una sola palabra** ("Ramón") en **un solo archivo**
(`popup.js`), y se le escaparon tres familias enteras:

| Familia | Sitios | Por qué no la vio la medición vieja |
|---|---|---|
| `"aula virtual"` | **7** | Es vocabulario de Ramón Net que **no contiene la palabra "Ramón"**. Anatomy es un club de Hotmart; no tiene aulas. |
| `entrypoints/popup/index.html` | **4** | El barrido fue sobre `popup.js`. El HTML nunca se miró. |
| `popup/features/onboarding.preact.js` | **2** | La isla está parametrizada casi entera y se dio por genérica. Le quedan dos textos. |

**Total: 9 textos distintos en 17 sitios** que el usuario lee. Los 2 `console.log` que sí contaba
la medición vieja siguen ahí y son los únicos que no ve nadie.

> **Al 2026-08-12 ese total ya no es lo que falta**: `ee32c0c` cerró los 4 sitios de §5.2 (los 3 de
> la marca + el `alt`), así que **quedan 7 textos en 12 sitios**. El número de arriba se conserva
> porque es el que documenta *por qué la medición vieja quedaba corta*, que es de lo que trata esta
> sección. Ojo: los dos totales no reconcilian por exactamente un sitio, según se cuente
> `popup.js:671` como uno o como dos (tiene dos frases en la misma línea) — ver §8.

> **Lección para la próxima vez que se re-mida** (van tres): buscar el **nombre** del portal no
> alcanza. Hay que buscar también **su jerga** — "aula virtual", "cátedra", "clases grabadas",
> "comisión". Un portal se filtra por su vocabulario mucho más que por su nombre.

## 2. Lo que ya está bien, y por eso no aparece abajo

Vale registrarlo porque es la evidencia de que la re-arquitectura sirvió, y porque evita que una
sesión futura "arregle" algo que ya está resuelto:

- **`core/` está limpio.** `motivosPausa(nombreSitio)` (`core/cola/procesadorCola.ts:94`) recibe el
  nombre como colaborador y cae a `"el portal"` si no llega (`:587`). Las tres fugas que registraba
  el backlog se cerraron de verdad el 2026-08-04.
- **`plataforma/` está limpia.**
- **El onboarding ya resuelve bien el caso difícil**: `onboarding.preact.js:116` dice
  *"subcarpetas por materia y `${(sitio.faceta?.etiqueta || 'categoría').toLowerCase()}`"*. Es
  exactamente la frase que `popup.js:671` tiene hardcodeada — **el patrón ya existe y funciona, no
  hay que diseñarlo** (ver ítem 5).
- **`sitio/ramonnet/*` habla de Ramón Net y está perfecto**, incluido el copy de `config.ts:164`
  ("Esta aula virtual tiene videos de varias cátedras…"). Ese es **el modelo**, no el defecto: el
  portal hablando de sí mismo, en su propio archivo.

## 3. La regla de decisión — son tres casos, no dos

**Esta es la parte a acordar antes de tocar nada.** El código ya tiene dos precedentes escritos y
razonados; el relevamiento destapó un tercero que nadie había nombrado y que es donde está el
riesgo real.

| Caso | Cuándo aplica | Qué hace la copy | Precedente |
|---|---|---|---|
| **A** | Habla de **la pestaña activa** | **Nombra al portal** desde el descriptor (`portal.nombre`) | `popup.js:965` |
| **B** | Habla de **un ítem de la cola** | **No nombra ningún portal** | `popup.js:1241` |
| **C** | Se muestra **antes de resolver el portal** | **Genérica obligatoria** — no hay descriptor que consultar | *(nuevo, §4)* |

El **caso B** no es cosmético y conviene entender por qué existe: el portal que pausó la cola sale
del **ítem** (ADR-0010), no de la pestaña abierta. El comentario de `popup.js:1241` lo dice con
todas las letras — nombrar ahí el portal de la pestaña es *"una afirmación falsa la mitad de las
veces"*. El nombre correcto sí viaja por otro camino: la notificación del SO y la campanita lo
reciben del bucle de descarga.

El **caso C** es nuevo y sale de medir *cuándo* corre cada cartel, no *qué* dice. Ver §4.

## 4. ⚠️ La trampa: el arreglo obvio reproduce el bug de siempre

`popup.js:853` muestra *"Escaneando entorno de Ramón Net…"* y parece pedir a gritos un
`${sitioActivo.nombre}`. **Eso estaría mal**, y falla justo en el peor momento:

```
852  function ejecutarPaso1EscaneoRamonAutomatico() {
853    nodos.loaderTxt.textContent = "Escaneando entorno de Ramón Net...";   ← sitioActivo = el ANTERIOR
...
870    const portal = tab && adoptarPortalDePestaña(tab.url);               ← recién acá se sabe
```

En la 853 el portal de **este** escaneo todavía no se resolvió: `sitioActivo` conserva el de la
pestaña previa, o el legado por defecto (`popup.js:295`, `sitios.obtener(undefined)`). Interpolarlo
ahí **anuncia el portal equivocado exactamente cuando el usuario cambia de portal**, que es el
único momento en que ese cartel importa. Es la misma familia del bug del corte 4 y del corte 8 del
multi-sitio: *resolver con el portal equivocado devuelve un valor plausible y falso.*

Dos salidas, y hay que elegir una explícitamente:

1. **Texto genérico** ("Escaneando la pestaña…") — una línea, cero riesgo. Es lo que propone §5.
2. **Mover el cartel adentro del callback**, después de la 870, y ahí sí nombrar el portal. Da
   mejor copy y toca el flujo; hay que mirar que el loader no quede sin texto en el intervalo.

Lo mismo aplica, por el mismo motivo, a `index.html:12` (el loader inicial: corre antes de que
exista JS que resuelva nada) y a `popup.js:874`, que vive **dentro de la rama `if (!portal)`** —
donde por definición no hay portal que nombrar.

## 5. Inventario y propuesta

### 5.1 Copy que hoy miente en Anatomy — el grupo que vale

| # | Dónde | Qué dice hoy | Propuesta | Caso |
|---|---|---|---|---|
| 1 | `entrypoints/popup/index.html:12` | "Leyendo pestaña **Ramón Net**…" | "Leyendo la pestaña…" | **C** |
| 2 | `popup.js:853` | "Escaneando entorno de **Ramón Net**…" | "Escaneando la pestaña…" | **C** ⚠️ §4 |
| 3 | `popup.js:573` + `popup/features/serverConnection.js:233` | "Analizando **aula virtual**…" | "Analizando la pestaña…" | C |
| 4 | `popup.js:861, 874, 896, 972, 1037` | "Re-escanear **aula virtual** 🔄" | "Re-escanear 🔄" | B/C |
| 5 | `popup.js:671` | carpeta "(ej: **'RamonNet'**)" + "por materia y **cátedra**" | "(ej: 'Clases')" + `${sitio.faceta.etiqueta}` | A |
| 6 | `popup/features/onboarding.preact.js:101` | "Ir a **Clases Grabadas** 🌐" | "Ir al listado de clases 🌐" | A |
| 7 | `popup/features/onboarding.preact.js:106` | "…que elijas en el **selector** y presiones **👁️ mostrar**" | miembro nuevo en el descriptor → §5.3 | A |

Detalles que cambian el arreglo:

- **El #3 está duplicado en dos archivos** con el texto idéntico. Se arreglan los dos o queda
  incoherente según por dónde entre el usuario (`serverConnection.js:233` es el camino de
  *recuperación tras caída del server*).
- **El #4 aparece 5 veces** y una (`:874`) es la rama sin portal — ver §4.
- **El #5 SÍ necesitaba diseño, y la propuesta de la tabla estaba mal.** Decía copiar el patrón de
  `onboarding.preact.js:116` (`${(sitio.faceta?.etiqueta || 'categoría').toLowerCase()}`). Medido
  al ejecutarlo: **en Anatomy eso imprime "por materia y sin clasificación"**, porque su faceta es
  inerte pero **no está vacía** — `etiqueta: "Sin clasificación"`
  (`sitio/anatomy-by-chris/config.ts:176`). El fallback `|| 'categoría'` nunca se dispara, así que
  el modal pasaría de nombrar un eje ajeno a nombrar uno inexistente. Y no hay predicado genérico
  para "faceta inerte" que se pueda consultar acá: la UI **no** detecta ese caso con una bandera,
  emerge de que `valoresPresentes()` filtre todo lo igual a `valorComun`, que es una propiedad de
  la lista escaneada y no del descriptor. **Se resolvió por el tono elegido**: la frase dejó de
  enumerar niveles ("creará y organizará automáticamente las subcarpetas dentro de ella"), que es
  cierto en los dos portales y no consulta nada. El árbol real difiere entre portales — Ramón Net
  abre un nivel por cátedra, Anatomy no— y ésa es justamente la razón por la que la copy genérica
  no puede describirlo.
- **Los 2 `console.log`** (`popup.js:531` y `:546`, "Pestaña Ramón Net actualizada/enfocada") no los
  ve el usuario. Van de arrastre en el mismo corte o no van; da igual.

### 5.2 Marca de la extensión — ✅ HECHA el 2026-08-12 (`ee32c0c`)

**Se renombró a `Course Downloader`, y los cuatro sitios entraron en el mismo cambio**, que es lo
que este doc pedía. No lo ejecutó este frente: vino de arrastre con la Fase 3 de
`fusion-monorepo-diseno.md`, porque el rename de la extensión y el del backend tocaban los mismos
archivos.

| Dónde | Decía | Dice hoy |
|---|---|---|
| `entrypoints/popup/index.html:26` | `<h4>RamonNet Downloader</h4>` | `<h4>Course Downloader</h4>` |
| `entrypoints/popup/index.html:5` | `<title>Ramonnet Video Downloader</title>` | `<title>Course Downloader</title>` |
| `wxt.config.ts:20` | `name: 'Ramonnet Video Downloader'` | `name: 'Course Downloader'` |
| `entrypoints/popup/index.html:25` | `alt="Logo de Ramón Net"` | `alt="Logo de la extensión"` |

Lo que sigue valiendo del análisis original, por si el nombre se vuelve a tocar: los tres primeros
son **el nombre del producto**, no el del portal —es legítimo que una extensión se llame así aunque
sirva a dos portales—, y **van los tres juntos o quedan discordantes entre sí**. El cuarto era otra
cosa: un **defecto claro**, porque esa imagen es `icons/icon48.png`, el logo de la extensión y no el
del portal.

**Que esto se cerrara solo es el dato útil de esta sección**: era el único grupo del doc
independiente de §5.1, y por eso pudo entrar por otra puerta sin romper nada.

### 5.3 El único que no es un swap de string — ✅ CONSTRUIDO el 2026-08-12 (corte 2)

**Hecho como decía el plan, con un cambio deliberado: el miembro va REQUERIDO, no opcional.**
El plan de abajo decía "opcional", y eso contradecía su propio motivo — si el objetivo era que
`tsc` obligue a los dos portales a implementarlo, un `?` deja compilar al portal que lo olvide y
lo manda a heredar un texto ajeno o vacío, que es el defecto original. Requerido, el compilador
lo caza. Lo demás salió como estaba escrito:

- `core/puertos/sitio.ts` — `instruccionEscaneo: string`, **el puerto pasa de 11 a 12 miembros**.
  Los seis lugares que citaban "11 miembros" se actualizaron en el mismo cambio.
- `sitio/ramonnet/config.ts` y `sitio/anatomy-by-chris/config.ts` — cada uno su frase.
- `popup/features/onboarding.preact.js` — la slide consume el descriptor.
- `docs/architecture.md` — su párrafo, con por qué un miembro del puerto puede ser copy.
- **Dos tests nuevos**: que la frase salga del descriptor y no vuelva a hardcodearse, y que los
  dos portales reales declaren instrucciones distintas.

**Lo que se perdió, y es a propósito**: el `<strong>` del "👁️ mostrar". El descriptor trae texto
plano porque la isla Preact escapa lo que recibe; meter markup ahí lo mostraría literal. Cambiar
eso significaría abrir un camino a `innerHTML` en la isla, que es justo lo que `docs/security.md`
no quiere.

**Falta la verificación en navegador** (slide 3 del tour, en los dos portales).

---

*Lo que sigue es el análisis original, y se conserva porque explica por qué este ítem no era un
swap de string:*

`onboarding.preact.js:106` no dice un nombre equivocado: **describe un flujo que en Anatomy no
existe**. No hay selector de materia ni botón 👁️ mostrar — ahí un solo escaneo trae los 11 módulos
y las 114 clases. El resto de esa slide está bien.

Necesita un miembro nuevo y opcional en el descriptor (algo como `instruccionEscaneo`), con su
texto en cada `config.ts`. Eso toca **`PuertoSitio`** (`core/puertos/sitio.ts`, hoy 11 miembros) y
obliga a que **los dos portales lo implementen** — que es justamente lo que `tsc` va a exigir, y
por eso este ítem es el único del doc con red de compilador. Si se agrega, va con su fila en
`docs/architecture.md` y el conteo de miembros del puerto se actualiza donde corresponda.

## 6. Lo que NO hay que tocar

| Qué | Dónde | Por qué |
|---|---|---|
| `SITIO_LEGADO = "ramonnet"` | `core/estado/appState.ts:164`, `core/cola/estadosProgreso.ts:35` | Es **dato**, no copy: resuelve los ítems sin `sitioId` (previos al multi-sitio). Renombrarlo rompe datos guardados. |
| `catedra` como **nombre de campo** | `core/puertos/sitio.ts:92,102`, `popup.js:1009` | El "séptimo caso" histórico del backlog. Toca el esquema de `Clase` (`data-model.md`) y trae migración de datos. **No mezclarlo con los strings**: éstos son cosméticos y reversibles, el campo no. |
| `ocultarAdvAula` / `ocultarAdvertenciaAula` | `core/estado/appState.ts:97,182,219,278,362` | Es una **clave de storage**. Renombrarla le reabre a cada usuario un modal que ya había silenciado. |
| `sitio/ramonnet/*`, incluido `config.ts:164` | — | Es el portal hablando de sí mismo. El modelo, no el defecto (§2). |
| Los comentarios de `popup.js:965` y `:1241` | — | Documentan **por qué** esa copy es como es, y siguen siendo ciertos. Son los precedentes de §3. |

**Identificadores internos**: `ejecutarPaso1EscaneoRamonAutomatico` (declarado en `popup.js:852`,
llamado en `:439, :533, :548, :588, :1183, :1642`) y `onReescanearAula` (`popup.js:439`,
`serverConnection.js:92, :240`). No los ve el usuario. **No conviene meterlos en el corte de copy**:
inflan el diff de `popup.js` —el archivo sin tests— sin que nada respalde el rename. Si molestan,
son una rama propia de puro rename, y ahí el diff grande no tapa nada.

## 7. Corte sugerido, y qué cuesta verificar cada uno

Eran tres ramas, y la razón es **el costo de verificación**, no la prolijidad. **Quedan dos**: el
corte 3 se ejecutó por su cuenta el 2026-08-12 (§5.2).

| Corte | Qué entra | Cómo se verifica |
|---|---|---|
| **1 — Los baratos** 🟡 | §5.1 ítems 1–6, y de arrastre los 2 `console.log` | **Sólo navegador.** Casi todo cae en `popup.js`, el único archivo sin tests (ADR-0005). **Construido el 2026-08-12 en `copy-generico-corte-1`; compuerta verde; falta el navegador.** |
| **2 — La instrucción de escaneo** ✅🟡 | §5.3: miembro nuevo en `PuertoSitio` + los dos `config.ts` + `architecture.md` | `tsc` cubre que los dos portales lo implementen; el texto, navegador. **Construido el 2026-08-12 en `copy-generico-corte-2`, apilado sobre el corte 1; compuerta verde + 2 tests nuevos; falta el navegador.** |
| ~~**3 — La marca**~~ | ~~§5.2~~ | ✅ **hecho** en `ee32c0c`, con el rename a Course Downloader. El `alt` del logo se fue con él, así que **salió del corte 1**. |

**Verificación en navegador del corte 1** (los cuatro carteles, **en los dos portales**):

1. Abrir el popup con la pestaña en **Ramón Net** y con la pestaña en **Anatomy**: el loader
   inicial y el de escaneo no deben nombrar un portal que no es.
2. El botón "Re-escanear" en sus 5 estados (timeout de DOM, sin portal reconocido, sin clases
   detectadas, escaneo OK, y tras caída del server).
3. El modal de la carpeta (click en 📂) en los dos portales: en Anatomy la palabra "cátedra" no
   debe aparecer — su faceta es inerte (`sitio/anatomy-by-chris/config.ts`, `id: "ninguna"`).
4. El onboarding (botón ❓) en los dos portales, slides 2 y 5.

**Riesgo del corte 1**: bajo y reversible — son strings, ninguno cambia lógica. El único que puede
morder es el #2 si se elige la salida 2 de §4 (mover el cartel), porque ahí sí se toca el flujo.

## 8. Registro de lo que la medición erró

Para la próxima sesión, y porque este proyecto anota los errores de medición:

- **El conteo del backlog envejeció tres veces**, siempre a la baja, y siempre por el mismo motivo:
  se contó *el nombre* del portal y no *su jerga*. La familia `"aula virtual"` (7 sitios) vivía ahí
  desde el principio y nunca la vio nadie.
- **`grep -E "Ram[oó]n"` no matchea los acentuados en algunas builds** — usar ripgrep, o se cuenta
  de menos. Ya estaba anotado en `TECHNICAL_DEBT.md` y sigue valiendo.
- **Hay que filtrar comentarios**, o se cuenta de más: `popup.js` tiene **12** menciones a Ramón Net
  en comentarios (líneas 10, 28, 62, 176, 509, 512, 528, 538, 918, 965, 1234, 1241) que son
  correctas y deben quedarse — dos de ellas son los precedentes de §3.

**Lo que agregó la re-verificación del 2026-08-12** (motivada por preguntar si esto seguía
pendiente, no por ejecutarlo):

- **El grep no encuentra el ítem de §5.3, y nunca lo iba a encontrar.**
  `onboarding.preact.js:106` no contiene ni el nombre del portal ni su jerga: describe un flujo
  ("el selector", "👁️ mostrar") que en Anatomy no existe. **Es el único de los 9 que no se puede
  medir buscando palabras** — apareció leyendo la slide, no grepeando. Cualquier re-conteo futuro
  que se apoye sólo en ripgrep lo va a perder de nuevo.
- **Las líneas de este doc envejecen aunque el texto no cambie.** `onboarding.preact.js:113` pasó a
  `:116` porque `ee32c0c` insertó líneas arriba; las de `popup.js` no se movieron. Se corrigieron
  las dos citas (§2 y §5.1). Al retomar, **re-verificar cada línea antes de editar**, que cuesta un
  `rg` y evita tocar la línea equivocada de `popup.js`, que es el archivo sin tests.
- **Los dos totales no cierran por un sitio** (9 textos/17 sitios contra los 7/12 que quedan más los
  4 que cerró `ee32c0c` = 16). La diferencia está en si `popup.js:671` cuenta como un sitio o como
  dos: es **una** línea con **dos** frases a cambiar (el ejemplo `'RamonNet'` y "por materia y
  cátedra"). No se corrigió el número viejo hacia atrás —el conteo de §1 documenta la medición de
  esa fecha— pero conviene saberlo antes de citarlo como si fuera exacto.
- **Una de las 7 propuestas de §5.1 estaba mal, y sólo se vio al ejecutarla** (el #5: interpolar
  `faceta.etiqueta` imprime "sin clasificación" en Anatomy — detalle en §5.1). El relevamiento
  midió **dónde** estaba cada texto sin abrir el descriptor del otro portal para ver **qué valor
  tomaría el reemplazo**. Para la próxima: una propuesta que interpola algo del descriptor no está
  medida hasta que se leyó ese campo **en los dos portales**.
- **Un frente ajeno cerró parte de este doc sin que el doc se enterara** (§5.2, vía la fusión). Es
  el argumento a favor de que el *estado* viva en `TECHNICAL_DEBT.md` y no acá: si el número de
  pendientes viviera en este archivo, hoy estaría mintiendo en dos lugares en vez de uno.
