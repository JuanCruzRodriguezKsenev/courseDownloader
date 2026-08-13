# Alertas, bloqueo y estado del footer

**Estado (2026-08-12): 🟡 CONSTRUIDO EN RAMAS, SIN VERIFICAR EN NAVEGADOR.** Tres ramas —
`banner-ocupa-lista-y-toolbar`, `banner-en-el-contenedor` y `seleccion-sigue-a-los-filtros` —
con la compuerta en verde. El estado del backlog vive en `TECHNICAL_DEBT.md` §🔴 Abierto
(ADR-0007); esto es el **cómo** y el **por qué**.

Este doc nace de una sesión de auditoría de los loaders, los estados de carga y los banners. La
mitad de abajo (§6) es **el informe de esa auditoría**, con lo que quedó sin arreglar: es lo
único que existe de esos hallazgos, así que no se borra hasta que estén cerrados.

---

## 1. La regla que ordena todo: una región, un dueño

La región de `#ui-list` puede mostrar tres cosas, y **son excluyentes**:

| Prioridad | Qué | Quién lo empuja |
|---|---|---|
| 1 | **La alerta de conexión** (servidor / internet caídos) | `bannerConexion.preact.js` (store) |
| 2 | Una **tarjeta de estado** (cola pausada ×5, "sin clases", "fila vacía") | `popup.js` → `ListaClases.render({modo:'card'})` |
| 3 | La **lista** (Clases Disponibles o Fila de Descarga) | ídem, `{modo:'lista'}` |

Lo decide un `if` en el render de la isla #4 (`listaClases.preact.js`), y esa es toda la
coordinación que hay.

**Antes no era así, y de ahí salieron casi todos los defectos.** La alerta vivía en un root
hermano (`#preact-banner`) y la lista se apagaba desde el vanilla con `setOculta(true)` para
hacerle lugar: **dos dueños de la misma región puestos de acuerdo a mano**. Alcanzaba con que
algo tocara el host —una sincronización de disco (`setAtenuada`), un cambio de pestaña
(`setSelectionMode`), la reconexión— para que la lista reapareciera **debajo** del banner.

> **La regla, que sobrevive a este caso**: si dos cosas ocupan la misma región de pantalla, no
> se reparten el DOM — **comparten contenedor y un `if` decide**. Coordinar dos dueños a mano
> funciona hasta que aparece el tercer efecto que toca al host.

De la isla #2 sobreviven **su store y su vista**; lo que murió es su lugar en el DOM. La
historia y la reversión están registradas en `docs/preact-migration.md` §Estado de las islas.

### 1.1 El marco lo pone quien llena la región

Una card trae su propia superficie (fondo, borde punteado, radio). Si además la enmarca
`.list-wrapper` (que tiene `padding` + `border` + fondo propios), quedan **dos marcos anidados**
y la card se mete 9px hacia adentro de cada lado — con lo cual sus laterales dejan de alinear
con la path-bar, las pestañas y la barra de filtros, que cuelgan del `padding` del `.container`.

No pasaba mientras la alerta vivía afuera con `display: contents`. Al mudarla adentro se heredó
el marco. Se resuelve con `.list-wrapper.sin-marco` (sin padding, sin borde, sin fondo), que
pone **la isla** —la única que sabe qué está pintando— cuando una card llena la región.

---

## 2. El contrato del bloqueo

Mientras una alerta ocupa la región, **nada se esconde**: las dos barras que quedan a la vista
—la path-bar (`📁 PC` / `📚 Materia` / faceta) y la toolbar— se **bloquean**. Más la caja de
cancelar, si hay una descarga a medias.

**Por qué bloquear y no esconder**: esconder mueve todo de lugar en cada caída y en cada
reconexión del auto-heal, que pasa seguido. Atenuado e inerte se lee como "ahora no".

**El bloqueo tiene dos formas, según lo que el elemento admita** — y esto es lo que hay que
respetar al agregar un control:

| Qué es | Cómo se bloquea | Por qué |
|---|---|---|
| Control de formulario (`input`, `button`) | **`disabled`** | Bloquea mouse **y teclado**, y lo comunica a accesibilidad |
| Cualquier otra cosa (`span`, `label`) | **`aria-disabled="true"`** | No admiten `disabled`; `.bloqueada` los apaga con `pointer-events` a partir del atributo, y ahí sí alcanza porque no se los alcanza con teclado |

**`pointer-events: none` sobre el contenedor no es un bloqueo**, y fue el primer intento: frena
el mouse y deja pasar el teclado (se podía tabular al input de materia y escribir, o marcar
"Todos" con Espacio). Hoy sólo se usa sobre los elementos marcados con `aria-disabled`.

Un solo lugar lo aplica: **`bloquearRegionesDeAlerta(bool)`** en `popup.js`, que entra por `ctx`
a `serverConnection.js` como `bloquearRegiones` (mismo patrón que `configurarBotonesUX`). Existe
porque los dos estados de alerta tenían **distinto alcance**: el de conexión deshabilitaba seis
controles y el de cola pausada ninguno, así que el mismo bloque bloqueado se comportaba distinto
según qué hubiera fallado.

**Liberar no es "habilitar todo"**: cada control tiene su condición (el buscador sin lista,
"Todos" sin sincronizar), así que se delega en `desbanearFiltros()` y se restauran a mano sólo
los que dependen de la conexión o de la ráfaga.

### 2.0 Cómo se aplica hoy: `popup/features/bloqueo.js`

La tabla de arriba **es código**, no una convención a respetar de memoria. Estaba copiada en las
tres funciones de `popup.js` (`bloquearToolbar`, `bloquearFilaDePortal`,
`bloquearRegionesDeAlerta`), que repetían las mismas decisiones con distinta letra y obligaban a
acordarse de las tres cada vez que entraba un control.

```js
Bloqueo.aplicar(bloquear, { regiones, elementos, restaurar })
```

Tres cosas que conviene saber antes de usarlo:

- **La forma la elige él**, con `'disabled' in elemento`: la propiedad del DOM, no una lista de
  tags que haya que mantener. Un control nuevo entra sin tocar el módulo.
- **`aplicar()` nunca escribe `disabled = false`.** La asimetría de arriba dejó de ser una
  advertencia en prosa y pasó a ser estructural: al liberar llama al `restaurar` que le pasás, y
  si no le pasás ninguno, no re-habilita nada. Un call-site nuevo **no puede** habilitar de más
  por olvido; a lo sumo se olvida de habilitar, que se ve enseguida.
- **`aria-disabled` sí es simétrico**: es un marcador, no una capacidad.

Tiene tests propios (`popup/features/bloqueo.test.js`), y ése es medio punto del refactor: el
contrato vivía en `popup.js`, que la suite no ve.

### 2.1 `.bloqueada` normaliza tres cosas, y ninguna es cosmética

La utilitaria vive en `styles/base.css` (no en la hoja de un componente: la usan tres regiones,
y una hoja nueva necesitaría su `@import` en `popup/globals.css`, que si se olvida no da error —
simplemente no se empaqueta).

1. **Opacidad**: un solo tinte (`0.35`) y **se neutraliza el `:disabled` de los hijos**. Cada
   control trae su propio `opacity: .5` cuando está deshabilitado, así que con el tinte del
   contenedor los deshabilitados quedaban en **0,25** y el resto en **0,5**: el mismo bloque con
   dos densidades. Eso se veía como "unos bloqueados y otros no".
2. **Puntero**: nada clickeable (ver la tabla de arriba).
3. **Cursor**: `default` para todo, con `!important`.

Lo del `!important` merece la explicación, porque es la pregunta que se hace solo el que lee
esto: **no hay componentes genéricos en esta hoja de estilos**. Cada control declara su propio
`:disabled`, y no se pusieron de acuerdo — `.pill-filter-btn` y `.btn-sort` (`filters.css`),
`.input-path` (`path-bar.css`) y la casilla (`base.css`) declaran `cursor: not-allowed`;
`.btn-explore` no declara nada y se queda con la flecha. Con media docena de definiciones
sueltas, la mitad de los controles bloqueados mostraba el ícono de prohibido y la otra mitad no.
Las de los componentes son reglas anidadas (0-3-0) contra la utilitaria (0-2-0), así que ganan
por especificidad. **Adentro de una región bloqueada el aspecto lo fija la región**; hacerlo
componente por componente lo vuelve a desparejar con el próximo control que se agregue.

### 2.2 No hay UNA condición de bloqueo: hay TRES granularidades

Es lo que más costó de la verificación en navegador, y salió de que el arreglo de una la rompía
en otra. Todo call-site pasa por un solo embudo, `sincronizarBloqueosDeAlerta()` en `popup.js`:

| Región | Sigue a | Por qué |
|---|---|---|
| **La toolbar** (buscar, filtros, orden, «Todos», «Seleccionar») | La **pestaña** que estás mirando, más «¿hay algo que filtrar?» | Opera sobre la lista de esa pestaña. Si el escaneo murió pero estás en Fila, la cola es real y operable. Y con la colección vacía no hay nada que buscar ni ordenar. |
| **La fila de `📚 Materia` + el badge de faceta** (`.row-aula`) | El **portal activo**, en las DOS pestañas | La materia es el destino en disco del próximo encolado y la faceta sale del listado escaneado. Con el escaneo muerto no describen nada, mires donde mires. |
| **La path-bar entera + la caja de cancelar** | Sólo las alertas de **conexión** | Ahí el servidor no está. Un escaneo lento no le hace nada al backend: 📂 Explorar sigue sirviendo. |

**Dos trampas que ya se cobraron:**

- **La tarjeta y el bloqueo se acotan IGUAL, o no se acotan.** Acotar la tarjeta a una pestaña y
  el bloqueo no dejaba la cola visible con la toolbar muerta: el mismo síntoma, mudado de lugar.
- **El bloqueo por «colección vacía» mira la COLECCIÓN, jamás el resultado filtrado.** La tarjeta
  de «Fila de descarga vacía» se pinta con `filtrados.length === 0`, que también es cierto cuando
  hay ítems y el filtro los escondió. Bloquear por eso **encierra al usuario**: no puede sacar el
  filtro que lo dejó sin resultados, porque el control para sacarlo estaría deshabilitado.

### 2.3 Qué NO se bloquea

- **Las pestañas.** Con el servidor caído sigue siendo legítimo mirar la cola, y la alerta se
  pinta igual en las dos. Bloquearlas dejaba al usuario sin poder ni consultar su fila.
- **El progreso de descarga**, si hay una en curso: **queda en pantalla y bloqueado**. Taparlo
  borraría la única referencia de cuánto se hizo; lo que no puede quedar vivo son sus botones de
  cancelar.
- **El botón de acción del footer**, cuando la alerta ofrece una salida. Con el escaneo muerto
  dice «Re-escanear 🔄» y tiene que poder tocarse: es lo que la propia tarjeta le pide al usuario.

---

## 3. El footer: quién dice qué

> **El botón dice lo que hace. La alerta dice qué pasa. `disabled` dice "ahora no".**

Esa frase reemplaza a cuatro copias del mismo hecho. En el estado offline había **card + pulso +
texto de estado ("⚠️ Servidor Bun desconectado.") + label del botón ("Buscando servidor... ⏳")**
diciendo lo mismo; y con la cola pausada, cuatro variantes de label ("Reintentar conexión con
servidor", "Iniciar sesión y reintentar", …) que repetían el título de la card. Hoy el
diagnóstico y el qué-hacer viven en la card, y el botón sólo ofrece la acción —una sola,
"Reintentar 🔄"—.

**El botón se muestra si hay algo que hacer**, y lo decide `configurarBotonesUX`: **sin label no
se muestra**. Con la alerta de conexión no hay ninguna acción (la reconexión la maneja el daemon
solo) → se va. Con la cola pausada sí la hay → aparece. La regla vive en el helper y no en los
~12 call-sites: si la visibilidad se decidiera afuera, basta que uno se olvide para dejar el
botón escondido con una acción real adentro. **Excepción única y comentada**: la sincronización
de disco, que escribe su label con `innerHTML` por el spinner y restaura el display ahí mismo.

**La alerta manda sobre la pestaña.** `actualizarContadoresBoton` la mira **antes** que cualquier
rama de pestaña. Sin eso, quien decidía el footer era la pestaña: con el servidor caído, pasar a
Fila mostraba "Iniciar descarga masiva 🚀" y volver a Clases mostraba "Seleccioná clases", las
dos ofreciendo una acción imposible. Los dos botones se apagan juntos, porque `btnStartQueue` lo
enciende `conmutarPestañaA` sin consultar nada.

**El footer vacío sale del flujo** (`.footer-panel.vacia`). Sin ningún hijo visible quedaban dos
defectos: su `border-top` se leía como una línea divisoria que no divide nada —o como un botón
roto—, y seguía consumiendo un `gap` del `.container`, dejando ~24px abajo de la card contra los
12px de los laterales. No se puede resolver con `:empty` en CSS: los hijos existen, están
ocultos. Lo marca `sincronizarFooterVacio()`, que corre en los **dos embudos** por los que pasa
cualquier cambio del footer (`configurarBotonesUX` y `actualizarContadoresBoton`) — por eso este
último pasó a ser un envoltorio: cualquiera de las ~8 salidas del cálculo puede mover
`btnStartQueue`, que `configurarBotonesUX` no ve.

> **Y desde el 2026-08-13 esa medición ya no es incondicional, por el piso visible**
> (`popup/features/pisoVisible.js`; ver `docs/TECHNICAL_DEBT.md` §El loader del popup no tiene
> dueño). `configurarBotonesUX` pasó a ser el embudo que **pide** la escritura y
> `aplicarBotonesUX` el que la hace, porque el piso puede diferirla medio segundo. Eso rompe una
> suposición que este §3 daba por obvia: **que medir el footer justo después de escribir el botón
> mide el estado nuevo.** Con la escritura en cola, `sincronizarFooterVacio()` medía el botón
> anterior, concluía "no hay nada visible" y le ponía `.vacia` al footer — que lo esconde entero,
> línea divisoria incluida— hasta que la escritura aterrizaba.
>
> La regla, que vale para cualquier medición futura sobre el footer: **si lo que medís depende de
> una escritura que pediste, no la hagas en paralelo.** O preguntás por `hayPendiente()`, o la
> medición viaja adentro de la escritura misma — que es lo que hace hoy `aplicarBotonesUX` al
> final, o sea exactamente el orden que todo esto tenía antes del piso.

---

## 4. La selección sigue al filtro

**Lo que se filtra, se deselecciona.** Antes la selección sobrevivía al filtro sin verse:
marcabas "Todos" sin filtro (103 clases), filtrabas a 12 en pantalla, y el botón seguía diciendo
"Agregar 103 clases" **y encolaba las 103** — porque el conteo y el encolado leen `seleccionado`
y no `visible`.

Se arregla en `aplicarFiltrosCruzados` (`popup/features/filters.js`), **el único lugar que decide
qué se ve**, y no en los cuatro que cuentan: si se arreglara allá, cada consumidor nuevo tendría
que acordarse del `&& visible` y el estado seguiría mintiendo.

La pestaña **Cola** tenía el mismo agujero con otro predicado ("Quitar N clases de la fila"
contaba ítems fuera de pantalla). Ahí el filtrado no deja marca en el ítem —no hay `visible` en
la cola—, así que se resuelve contra el conjunto recién filtrado, en el render. La que se está
bajando queda fuera y corresponde: no se la puede quitar igual.

**Costo aceptado, y fue decisión del dueño**: no se puede seleccionar en varias tandas (buscar
"Miologia", marcar 3, borrar la búsqueda). La contrapartida es que **lo que ves es lo que está
marcado**.

---

## 5. Cómo verificarlo, y con qué

> **✅ Verificado en navegador el 2026-08-12 y mergeado a `main`.** Lo que la pasada encontró
> está en §5.1, y es la parte de esta sección que conviene leer: **ocho defectos, ninguno
> alcanzable por un test, y cuatro de ellos introducidos por el arreglo del defecto anterior.**

Todo esto cae en `popup.js` y en el CSS, o sea **fuera del alcance de la suite** (ADR-0005). El
**banco de pruebas** (`verificacion/modoVerificacion.js`, 🧪 en la cabecera o **F9**, encendido
con `BANCO_DE_PRUEBAS = true` en `entrypoints/popup/main.js`) existe para esto:

- **fuerza las caídas** de servidor e internet envolviendo `fetch` por origen, así el banner
  entra por el camino real y destildar reproduce la reconexión entera;
- **fuerza la cola pausada** en sus **5 tipos**, contestando el sync del arranque con
  `colaPausadaPorError` (necesita recargar: ese sync corre una sola vez);
- **demora el escaneo** 0/1/3/6 s y fuerza escaneo vacío / colgado / error de inyección;
- **graba** todo texto que pasa por el loader, el estado y el botón, con hora — que es lo que
  permite leer carteles que duran milisegundos.

**El banco vive en el código desde el 2026-08-12**, apagado por bandera. Antes vivía en una rama
descartable y **se perdió dos veces** — una quedó con un build viejo mientras `main` avanzaba, y
otra hubo que rearmarla con siete cherry-picks. Apagado no cuesta nada: la bandera es una `const`
literal y Vite se lleva el módulo en el tree-shaking.

**Qué mirar**: que no se vean la lista y la alerta juntas; los laterales de la card contra las
barras de arriba; el footer sin línea fantasma; el bloqueo parejo (mismo tinte, sin cursor de
prohibido, sin hover en el badge ni en "Todos"); los botones al cambiar de pestaña con el
servidor caído; y que al reconectar vuelva todo.

### 5.1 Lo que encontró la pasada, y por qué vale más que la lista de arriba

**Ocho defectos, cero detectables por la compuerta, y cuatro introducidos por el arreglo del
anterior.** Ése es el dato: no es que la verificación en navegador *complemente* a los tests en
esta zona — es que acá es lo único que ve.

| # | Qué se veía | Qué era |
|---|---|---|
| 1 | El timeout del escaneo no bloqueaba la toolbar ni la path-bar | El bloqueo se derivaba del estado de CONEXIÓN, no de quién ocupa la región |
| 2 | Ir a Fila y volver dejaba **la lista visible y bloqueada** | La tarjeta se pintaba una vez; cualquier repintado le ganaba la región y la bandera del bloqueo quedaba puesta |
| 3 | «Re-escanear» no aparecía | Mismo error: botón seteado a mano en vez de derivado en `calcularContadoresBoton` |
| 4 | La toolbar viva con la Fila vacía | Faltaba la tercera granularidad de bloqueo (§2.2) |
| 5 | El banco: dos scrollbars, registro arriba, scroll horizontal | Un `grid-row` mío reordenó el panel; y tres causas distintas de ancho mínimo |
| 6 | La barra de scroll «tardaba en desaparecer» | Al estilarla le agregué `scrollbar-color`, que en Chrome **desactiva** `::-webkit-scrollbar` y cambia de renderizador |
| 7 | La barra achicaba el contenedor | `scrollbar-gutter: stable` reservando canal donde no hay barra |
| 8 | **Y la de verdad**: el banner parpadeaba | `animation: fadeIn 0.25s` sobre `.info-card` y `.server-error-card`, declarada en `list.css` |

**Las tres lecciones, en orden de lo que costaron:**

1. **Lo declarado, antes que la teoría.** El 8 se persiguió cinco commits por el CSS del scroll
   porque el síntoma se manifestaba sobre la barra. Era una animación de 250 ms escrita en la
   misma hoja. **Si algo dura, `grep animation\|transition` va primero**; un frame no se percibe
   como demora.
2. **Estado derivado, nunca pintado una vez.** Los defectos 2 y 3 son el mismo: algo que ocupa
   `#ui-list` o el footer se calcula en `renderizarListadoInterfaz` / `calcularContadoresBoton`
   en **cada** repintado. Si una tarjeta y su bandera de bloqueo se pueden desincronizar, se
   desincronizan — pasó tres veces en la misma tanda.
3. **Arreglar en la capa equivocada mueve el síntoma, no lo saca.** Los defectos 6 y 7 son
   parches míos al 8: cada cambio de `scrollbar-gutter` mudaba el parpadeo de la aparición del
   banner a la del listado y de vuelta. Cuando un arreglo cambia el síntoma de lugar en vez de
   cerrarlo, la causa está en otra capa.

**Y una cuarta, de proceso**: la barra de scroll nativa de Chrome **ya trae las flechitas y ya
sigue el tema**; personalizarla es lo que se las lleva. Toda la saga arrancó por adoptar una
barra fina en una región nueva sin preguntarse por qué la otra región tenía una fina. Lo que
quedó (`base.css`, selector universal) es deliberado y tiene escrito lo que cuesta.

### 5.2 La tanda del toolbar, la capa y el piso visible — 2026-08-13

**Mergeada a `main` el 2026-08-13.** Nueve commits: pnpm, los micro-movimientos de hover/clic, el
bloqueo reutilizable + la capa flotante, el piso visible de los carteles, el filtro por materia en
Disponibles y el popover que se re-ancla. La compuerta quedó en **38 archivos / 674 tests**, lint
0, `tsc` limpio.

**Cómo se verificó, que es el dato que hay que conservar: el dueño recorrió los 9 puntos de la
lista y confirmó que anda todo, SIN desglose punto por punto.** O sea **resultado global, no
medición** — del mismo tipo que la casilla 4 del corte 7 y que la verificación del escaneo por
API, y **distinto** de la pasada del §5.1, que sí produjo una tabla de ocho defectos.

Se anota así a propósito. **Si mañana aparece un defecto en esta zona, lo primero que hay que
saber es que no hubo desglose que lo hubiera atrapado** — y que por lo tanto no hay contradicción
entre "estaba verificado" y "estaba roto". La diferencia entre los dos registros no es de
prolijidad: es cuánto se puede concluir de cada uno.

**Lo que esta tanda agrega al §5.1, sin repetirlo**: dos de los cuatro carteles del arranque
duraban menos de lo que tardan en leerse (248 ms y 117 ms), y **eso no se descubrió mirando —se
descubrió midiendo, con el banco**. Es la primera vez que un defecto de esta zona lo encuentra un
instrumento y no el ojo. La lección práctica: **para lo que dura milisegundos, mirar no alcanza**,
y el banco tiene que estar apagado al verificar el arreglo, porque demora el escaneo a propósito y
haría pasar un piso que no funciona.

---

## 6. El informe de la auditoría — **los cinco, ya cerrados**

Lo de abajo salió de auditar los loaders y los estados de carga. **Los cinco se arreglaron el
2026-08-12**, en `integracion-alertas`, y **ninguno está verificado en navegador**. El estado
formal vive en `TECHNICAL_DEBT.md`; acá está el detalle técnico —el diagnóstico se conserva tal
como se escribió, porque es lo que explica por qué el código quedó como quedó— y, en cada uno,
**cómo se cerró**.

> **Lo que enseñó la tanda, y no estaba en ninguno de los cinco ítems.**
>
> 1. **Cuatro de los cinco eran el mismo corte.** Comparten camino (`conectarYArrancar` →
>    `escanearDisco` → `resolverMapeoEnUI`) y dos comparten causa raíz literal: *nadie apaga el
>    indicador cuando la rama de error se lleva el control*. Listados como cinco entradas
>    independientes se habrían priorizado de a uno, tocando cuatro veces el mismo archivo. **Al
>    auditar, agrupá por camino de ejecución, no por síntoma.**
> 2. **Uno era precondición de otra cosa.** El 6.2 (el loader invisible) es lo que hace
>    observable el cartel del cambio de portal, o sea la verificación del copy genérico. Un bug
>    abierto bloqueando la verificación de otro frente no aparece en ninguna lista de
>    dependencias, porque las dos entradas se ven independientes.
> 3. **El 6.1 quería tocar `PuertoSitio`, y otra rama ya lo estaba tocando** para meter
>    `instruccionEscaneo`. Hacerlo después habría sido volver al mismo puerto dos veces en dos
>    semanas por el mismo motivo. Entró junto: el puerto pasó de 11 a **13** de una vez.

### 6.1 🔴 El timeout del escaneo salta siempre en Anatomy, y miente

`popup.js` arma un `safetyTimeout` de **6 s** que apaga el loader, escribe **"⚠️ Timeout de carga
del DOM."** y deja el botón en "Re-escanear 🔄". Pero el escaneo de Anatomy ya no es DOM ni es
corto: `/v1/navigation` mide **~4,0 s** y el pool de los 114 materiales **7,1 s**
(`escaneo-api-anatomy-diseno.md`). O sea **~11 s contra un tope de 6**.

En cada escaneo de ese portal pasa esto: a los 6 s aparece un error falso; ~5 s después llega el
callback real, `clearTimeout` no cancela nada (ya disparó) y la lista se pinta encima; el mensaje
desaparece sin que nadie lo haya resuelto. Además, **no hay guarda de reentrada**: durante esa
ventana el botón invita a re-escanear y un click lanza **un segundo escaneo concurrente**.

Y no es "un error" en ningún sentido útil: es un **temporizador ciego**. No detecta un fallo,
deja de esperar. No cancela el escaneo, no registra nada en la campanita (eso es
`historialFallos`, y **sólo lo escribe el service worker**), no notifica y no bloquea el
reintento.

**Qué debería pasar**, en orden:

1. **El tope sale del portal**, no del orquestador: un miembro más de `PuertoSitio` (como
   `instruccionEscaneo`), requerido, para que `tsc` obligue a cada portal nuevo a pensarlo.
   Ramón Net 6 s, Anatomy ~20 s.
2. **El abandono es explícito**: un contador de escaneo vigente, para que un callback tardío no
   pinte encima de un estado que ya lo dio por muerto. Hoy gana el que llega último.
3. **El mensaje va donde el usuario mira, y no dice "DOM"**: la forma correcta ya existe en este
   código — la tarjeta de "Sin clases detectadas" en la lista. Una línea en el footer que se pisa
   sola no comunica.
4. **Guarda de reentrada**, o el botón deshabilitado mientras hay un escaneo vivo.

> **✅ Cerrado (2026-08-12)**, los cuatro puntos. Con una corrección al plan que apareció al
> ejecutarlo:
>
> **El punto 1 no se podía hacer donde decía.** El `safetyTimeout` se armaba **antes** de
> resolver el portal, así que ahí no existe un `topeEscaneoMs` que leer — es exactamente la
> trampa del §4 de `copy-generico-diseno.md`, la misma familia que ya se cobró los cortes 4 y 8
> del multi-sitio, apareciendo por tercera vez en el mismo archivo. El watchdog **se arma después
> de resolver el portal**. Lo que queda descubierto entre los dos puntos es `chrome.tabs.query`,
> que no sale a la red; lo que el watchdog vigila es el escaneo, que sí.
>
> - **Tope**: `PuertoSitio.topeEscaneoMs`, **requerido** —mismo criterio que `instruccionEscaneo`:
>   un portal nuevo que lo olvide tiene que no compilar, no heredar un número ajeno—. Ramón Net
>   **6 s** (escanea el DOM), Anatomy **30 s** (margen deliberado sobre los ~11 s: el pool sale a
>   la red 114 veces y una conexión lenta lo estira sin que eso sea una falla).
> - **Abandono explícito**: por **generación**, no por booleano. Cada corrida lleva su número y el
>   watchdog lo incrementa al vencerse; el callback tardío compara y se descarta. Un booleano no
>   alcanza — con dos corridas en vuelo no distingue cuál llegó.
> - **Mensaje** en la tarjeta de la lista, con el nombre del portal (a esa altura ya está
>   resuelto) y sin la palabra "DOM".
> - **Guarda de reentrada** que además devuelve si tomó el loader, que es lo que cierra el §6.2.
>
> **Tests**: +5 en `sitio/registro.test.ts`, y apuntan al **valor**, no a la existencia del campo
> — que exista ya lo obliga `tsc`, y el defecto fue un tope que existía y estaba mal. Fijan un
> piso de 5 s, el margen de Anatomy sobre sus 11 s medidos, que Ramón Net conserve los suyos, y
> que el orden entre los dos no se invierta por un copy-paste entre configs, que es literalmente
> cómo se escribe un portal nuevo acá.
>
> **Lo que ningún test ve, y por eso va a navegador**: el watchdog vive en el núcleo de
> `popup.js` (ADR-0005).

### 6.2 🟠 El loader del escaneo inicial no se ve nunca

`conectarYArrancar` llama al escaneo y **apaga el loader en su `finally`, en el mismo tick**: el
escaneo no es `async` (registra el callback de `chrome.tabs.query` y vuelve), así que el
navegador nunca pinta entre las dos. En el arranque automático, "Escaneando la pestaña…" es
código muerto en pantalla. Sólo se ve por el botón "Re-escanear" o tras reconectar.

**Consecuencia para verificar copy**: el cartel del cambio de portal **no se puede observar
abriendo el popup**; hay que forzarlo con "Re-escanear".

> **✅ Cerrado (2026-08-12).** `ejecutarPaso1EscaneoRamonAutomatico` **devuelve si tomó posesión
> del loader** y el `finally` de `conectarYArrancar` lo respeta. La guarda de reentrada del §6.1
> devuelve `false` por eso mismo: si devolviera `true`, el loader quedaría girando sin nadie que
> lo apague.
>
> **Lo que hace que sea seguro**: las cuatro salidas del escaneo apagan el loader (portal no
> reconocido, watchdog, error de inyección, y el `finally` del payload), lo cual ya estaba
> verificado en §6.7. Devolver `true` es un compromiso que el escaneo puede cumplir; si alguien
> le agrega una quinta salida, tiene que apagarlo ahí también.

### 6.3 🟠 La lista puede quedar atenuada al 50% indefinidamente

`ListaClases.setAtenuada(true)` se pone al empezar a sincronizar y se apaga **en un solo lugar**:
el `finally` de `resolverMapeoEnUI`. Si `escanearDisco` falla por red, el `catch` externo llama a
`activarEstadoOfflineUI()` y esa función nunca corrió. `atenuada` y `oculta` son flags
independientes, así que al reconectar vuelve la lista **al 50%**. Se auto-cura sólo si el
re-escaneo posterior termina en una sincronización exitosa; si vuelve vacío o sin portal, queda
atenuada hasta cerrar el popup, sin ningún mensaje.

> **✅ Cerrado (2026-08-12).** El `finally` que la apaga se movió de `resolverMapeoEnUI` —que es
> **un** camino— a `ejecutarPaso2SincronizarDiscoVeloz`, que es **la función que la prendió** y
> cubre los dos. Es la regla **una región, un dueño** del §1, aplicada al indicador en vez de al
> DOM: el mismo error, en otra dimensión.
>
> **La generalización que vale para el próximo indicador**: si lo prendés antes de un `await`,
> apagalo en el `finally` de **esa misma función**. Delegarlo a la que procesa el resultado
> funciona hasta el primer camino de error, y ese camino siempre termina existiendo.

### 6.4 🟠 Dos llamadas al backend sin timeout

El cliente es asimétrico: `obtenerRutaServidor` tiene **4 s** duro y `enviarFragmentoStream`
**30 s**, pero **`escanearDisco` y `seleccionarCarpeta` no tienen ninguno**. El de
`seleccionarCarpeta` es defendible —del otro lado hay un diálogo nativo esperando a una
persona—, pero el loader que lo acompaña hereda esa espera sin techo. El de `escanearDisco` no:
cuelga el botón en "Sincronizando disco local..." con la lista atenuada por §6.3, sin salida y
sin mensaje. En Windows `localhost:3001` **cuelga** en vez de rechazar, que es justo el motivo
por el que los otros dos tienen timeout.

> **✅ Cerrado (2026-08-12), y es el único de los cinco con tests de verdad** — el cliente es
> núcleo (`core/backend/bunClient.ts`), no popup. +6 en su test: que los dos aborten en vez de
> colgarse, que el `signal` llegue al `fetch` (sin eso el timeout no aborta nada), que el camino
> feliz no cambie, y la desproporción entre los dos techos.
>
> **Los dos techos son distintos a propósito y no hay que emparejarlos**: `escanearDisco` **15 s**
> (el server lee disco de verdad y una carpeta grande tarda; el techo existe para el cuelgue, no
> para apurarlo) y `seleccionarCarpeta` **3 minutos**, porque del otro lado de ese fetch no hay un
> servidor calculando sino **una persona mirando un explorador de archivos**. Un techo de segundos
> ahí le cancelaría el diálogo a alguien que está eligiendo — peor que el cuelgue que evita.
>
> Hay un test que fija esa desproporción **contra el otro valor**, no contra una constante, para
> que un "unifiquemos los timeouts" lo rompa en vez de pasar.

### 6.5 ⚪ El onboarding recibe siempre el portal legado

`entrypoints/popup/main.js` monta la isla con `sitios.obtener(undefined)`, sin mirar la pestaña.
Con eso la slide 3 muestra **la frase de Ramón Net también en Anatomy** — o sea que el corte 2
del copy genérico movió el texto al descriptor (correcto y necesario) pero el defecto que venía a
cerrar sigue en pantalla. El comentario de ese archivo dice "ofrecer elegir entre N portales es
del corte 7, cuando exista un segundo", y el segundo existe desde el 2026-08-07. Es un tercer
corte chico: resolver el portal por pestaña y pasárselo.

> **✅ Cerrado (2026-08-12).** Monta con `sitios.resolverPorUrl(tab.url)`, con **fallback al
> legado** si la pestaña no es de ningún portal reconocido: el tour se abre desde cualquier lado
> y ahí no hay portal correcto que mostrar. El montaje se movió adentro del callback de
> `chrome.tabs.query` — montar con el legado y corregir después haría **parpadear la copy**.
>
> **Y destapó un agujero que valía más que el ítem**: el wrapper `sitios` de
> `plataforma/composicion.ts` —el export que comparten el SW y el popup **precisamente para que
> la regla de resolución no pueda divergir**— no tenía ni un test propio. Lo cubierto era
> `sitio/registro.ts`, que es la capa de abajo y **no** implementa la migración del `sitioId`
> ausente. Ahora existe `plataforma/composicion.test.ts` con los tres casos (ausente → legado;
> presente-no-registrado → huérfano; por URL → sin migración).
>
> Es el patrón de siempre en este repo: **el ítem chico estaba apoyado en algo grande que nadie
> miraba.**

### 6.6 Detalles menores, con archivo

- ~~**`iniciar.bat` quedó sin ruta** tras la fusión~~ → **✅ arreglado el 2026-08-12.** Eran
  **cuatro** sitios, no dos: `popup.js:1455`, `bannerConexion.preact.js:37` y **dos** en
  `onboarding.preact.js` (:124 y el `title` de :137, que la auditoría no había contado). Ahora
  dicen `backend/iniciar.bat`. Es el residuo más típico de una mudanza: el código anda, la
  **instrucción al usuario** manda a un archivo que ya no está ahí, y ninguna de las cuatro
  verificaciones puede verlo.
- **Rama muerta y silenciosa**: el `if (ruta)` de `conectarYArrancar` no tiene `else` — un backend
  que conteste 200 sin `ruta` deja el popup en blanco, sin banner ni estado. Hoy es inalcanzable
  (`backend/handlers.js` siempre manda `ruta`), pero es latente.
- **`aria-live="polite"` en el overlay del loader** anuncia los cambios de texto aunque esté
  oculto por `display:none`.

### 6.7 Lo que se revisó y está bien

- Las **cuatro salidas** del loader del escaneo están todas cubiertas (timeout, sin portal, error
  de inyección, y el `finally` del procesamiento): no hay fuga.
  > **Ojo con cómo se leyó esto.** Se verificó que las cuatro **apagan el loader**, y de ahí no
  > se sigue que las cuatro **avisen**. La del error de inyección apagaba el loader y no decía
  > nada — ver §6.8. Cubrir una salida es apagar el loader *y* dejar algo en pantalla.
- El banner **no se re-renderiza de más**: se compara el tipo antes de re-mostrar.
- La **campanita** y el historial están acotados (50) y con su propio estado; no comparten canal
  con la línea de estado, que es lo correcto.
- Las **cinco tarjetas de pausa** cubren los cinco tipos con copy distinta y **ninguna nombra un
  portal** — respetan ADR-0010.

### 6.8 🔴 El error de inyección no avisaba, y la línea de estado del footer está muerta

**Encontrado el 2026-08-12, con el banco de pruebas** (`error de inyección` + demora 0). Son
**dos** defectos, y se tapaban entre sí: el primero está arreglado, el segundo **sigue abierto**.

#### a) La rama no tenía tarjeta — ✅ cerrado

`popup.js` era la única de las salidas del escaneo que **no** llamaba a `ListaClases.render`:
mandaba el texto a `nodos.txtEstado` y **restauraba la lista anterior desde storage**. El
resultado en pantalla era indistinguible de un escaneo exitoso — lista completa, botón
"Re-escanear", cero explicación. Su hermana la del watchdog (§6.1) sí tenía tarjeta.

Lo delator, y por qué el banco valió: la rama **sí corría** —el botón pasaba a "Re-escanear",
línea que sólo existe ahí— y aun así no se veía nada.

**Cómo se cerró**: entra por el mismo estado que el watchdog. `escaneoMuertoPorTimeout` pasó a
llamarse `escaneoMuerto` y lleva `motivo: 'timeout' | 'inyeccion'`.

> **Por qué UN estado y no dos banderas.** El bloqueo se deriva de él en cuatro lugares
> (`sincronizarBloqueosDeAlerta`, el `bloquearRegiones` que le pasa `serverConnection`,
> `calcularContadoresBoton` y el render). Con dos banderas hay que acordarse de las dos en los
> cuatro, y eso es exactamente lo que el §1 dice que se desincroniza. **La tarjeta y el bloqueo
> son el mismo estado.**

Y **no se pinta en la rama**: se registra y se pide el repintado, que es el contrato que el §6.1
ya había pagado. La copy es distinta según el motivo porque la acción del usuario es distinta —
ante un timeout se reintenta; ante una inyección rechazada, reintentar en la misma pestaña
vuelve a fallar, así que la tarjeta dice que se pare en una pestaña del portal.

#### b) 🔴 `#ui-msg-status` está oculto y nadie se lo destapa — ABIERTO

El `<p>` de la línea de estado del footer nace con **`style="display:none"` inline**
(`entrypoints/popup/index.html`), y en todo el repo **no hay** un solo `txtEstado.style`, ni un
`removeAttribute`, ni una regla con `!important` que lo pise — el único `!important` es
`.status-text:empty` (`styles/components/footer.css`), que lo esconde *más*. El inline le gana a
`display: flex`. Viene así desde la migración a WXT (`fd81f9a`, 2026-08-02), heredado del
`popup.html` viejo.

**Consecuencia**: todo lo que se escribe ahí es invisible. Hay ~20 sitios — `popup.js`
("no estás en un portal reconocido", "el escaneo no devolvió clases", **el texto de progreso de
la descarga**), `popup/features/queue.js` ("verificando conexión", "frenando al terminar") y
`popup/features/serverConnection.js` ("servidor Bun apagado").

**Por qué no se arregló en el mismo corte**: sacar el inline destapa los ~20 de una vez,
incluido el progreso durante la descarga, que cambia el alto del footer mientras baja. Es un
cambio visual ancho y hay que mirarlo descargando, no leyendo. **El arreglo es de una línea**;
lo que falta es la pasada por navegador.

**Y ojo con "arreglarlo" mandando mensajes ahí**: el §6.1 ya había descartado ese destino para
el watchdog *aunque estuviera visible*, porque comparte el footer con el diagnóstico de conexión
—que tiene otro dueño— y queda pisado. Destaparlo no lo convierte en un buen lugar para un
error; lo convierte en un lugar donde el copy que hoy vive ahí, por fin, se lee.

#### c) 🟠 Un repintado le gana la región a la card del escaneo vacío — ✅ cerrado

Forzando escaneo vacío **sin lista previa**, lo que queda en pantalla es la card genérica del
filtro (`No hay clases / No se encontraron clases que coincidan con la búsqueda o el filtro`,
`aplicarFiltrosCruzados`) en vez de la del escaneo (`Sin clases detectadas`, con el nombre del
portal y la instrucción). O sea: **la card correcta se pinta y un repintado posterior la
reemplaza** — el mismo patrón del defecto nº2 del §5.1, que se dio por cerrado, reentrando por
la rama del escaneo vacío, que sigue pintando de una sola vez en vez de derivar del estado.

No es cosmético: la card del filtro le dice al usuario que **afloje un filtro** cuando lo que
pasó es que el portal no devolvió nada.

> **✅ Cerrado (2026-08-13), y con él un defecto más viejo.** La card se **deriva** ahora en
> `renderizarListadoInterfaz` en vez de pintarse una vez al terminar el escaneo, así que ningún
> repintado se la come. Tercera vez que este archivo paga el mismo error (watchdog §6.1, error
> de inyección §6.8a, y ésta): **estado pintado una vez en vez de derivado**.
>
> Y de paso se arregló lo que la card decía. `filtrados.length === 0` es cierto por dos causas
> —colección vacía vs. filtro que escondió todo— y las dos recibían el mismo texto. Ahora
> ramifica por `coleccionDeLaPestañaVacia()`, **el mismo predicado que decide el bloqueo de la
> toolbar**, con lo cual el cartel y el bloqueo no pueden contradecirse: con la colección vacía
> la toolbar está bloqueada y el texto no ofrece tocarla ("Sin clases detectadas … Asegurate de
> estar dentro de \<portal\>"); con el filtro, está viva y el texto manda justo ahí.
>
> Eso cierra también el defecto que el comentario de `coleccionDeLaPestañaVacia()` tenía anotado
> desde su propia auditoría: en la **Fila**, "No tenés clases agregadas en esta lista" aparecía
> también cuando sí las tenías y las habías filtrado. Ahora ese caso dice "Ninguna coincide".
>
> Se fueron con el cambio **tres `disabled` puestos a mano** en la rama del escaneo vacío: los
> decide el mismo predicado en `bloquearToolbar`.

### 6.9 🟠 "Todos" encendido sobre un filtro sin nada seleccionable — ✅ cerrado

**Encontrado el 2026-08-12, usando la extensión.** Con "Todos" marcado y el filtro puesto en
**descargados**, el control quedaba encendido, aceptaba el clic y **no hacía nada**.

La cadena, que son tres piezas y ninguna estaba mal sola:

1. `actualizarMasterCheckState()` calcula el `checked` sobre `visible && estado === 'pending'`.
   Filtrando por descargados ese conjunto queda vacío y la condición es `visibles.length > 0 &&
   …`, así que se **desmarca solo**.
2. El handler le pasa **todos** los visibles a `conmutarSeleccionMasiva`, que sólo toca las
   `pending` (`core/estado/appState.ts`). Cero pendientes → el bucle no toca nada.
3. El repintado vuelve a pasar por (1) y lo devuelve a desmarcado. El control **rebota**.

**Es la misma regla que ya justificaba bloquear la toolbar con la colección vacía** (§2.2):
dejar los controles vivos ofrece una acción que no existe. Un control que se deja clickear y no
hace nada es peor que uno apagado — mueve la duda al usuario, que no sabe si el que falló es él.

> **Y no contradice la trampa del §2.2**, aunque lo parezca: ahí se dice que el bloqueo mira la
> COLECCIÓN y jamás el resultado filtrado. Esa regla protege **la salida** —el buscador y las
> pastillas—, porque apagarlos con un filtro que dejó cero **encierra al usuario**: ya no puede
> sacar el filtro que lo dejó así. **"Todos" no es salida**, es una acción *sobre* el resultado;
> apagarlo deja intacto el camino de vuelta. La distinción no es "colección vs. filtrado", es
> **"con qué se sale vs. qué se hace con lo que quedó"**.

**Dónde se arregló, que fue la parte que costó decidir**: en `desbanearFiltros()`
(`popup/features/filters.js`), no en `actualizarMasterCheckState()`. `masterCheck.disabled` lo
escriben hoy seis lugares, y el que tiene la **última palabra** es `desbanearFiltros`, porque
corre desde el `restaurar` de `bloquearToolbar`, que `sincronizarBloqueosDeAlerta()` llama al
final de todo. Puesto en `actualizarMasterCheckState()` —que corre antes— quedaba pisado, y el
síntoma habría sido "a veces funciona".

Lleva `title` porque las dos causas de apagado son distintas y sin decirlo el bloqueo mueve la
duda en vez de sacarla: *"Esperando la sincronización con el disco"* vs. *"No hay clases
seleccionables con este filtro"*.

#### La regla que queda, y es la que hay que aplicar al próximo control

**¿Este control puede sacarme de la situación?**

| | Sigue al resultado filtrado | Por qué |
|---|---|---|
| Buscador, Filtros | **NO, nunca** | Son **la salida**. Apagarlos con cero resultados encierra al usuario (§2.2). Sólo los apaga la COLECCIÓN vacía, que decide `bloquearToolbar`. |
| "Todos" | Sí — `haySeleccionablesVisibles()` | Actúa sobre el resultado. Sin nada marcable es un no-op. |
| Ordenar, "Seleccionar" | Sí — `hayVisibles()` | Ídem, pero con **otro** predicado. |

**Los dos predicados no coinciden, y ahí está la trampa de reusar el de al lado**: filtrando por
"descargados" hay clases en pantalla y ninguna marcable. "Todos" se apaga porque no tiene qué
marcar; **ordenar tiene que quedar encendido**, porque ordenar dos clases descargadas es
legítimo. En la Cola pasa lo mismo con la que se está bajando: no cuenta para "Todos" (no se la
puede desmarcar) y sí para ordenar (ocupa un renglón).

Umbral de `hayVisibles`: **cero**, no "menos de dos". Ordenar una sola clase tampoco hace nada,
pero apagarlo ahí titila con cada filtro y se lee como un bug.

Y una que se pagó al construirlo: **`btnToggleSelect` se re-habilitaba dos veces**. Estaba en el
`restaurar` de `bloquearToolbar` con un `disabled = false` incondicional que corría DESPUÉS de
`desbanearFiltros`, así que le pisaba la condición nueva. Se sacó de ahí: el dueño es
`desbanearFiltros`, como el resto de la toolbar.

#### Y el cursor, que quedó partido al medio

El "Todos" es un `<label>` con dos hijos, así que al deshabilitarlo **individualmente** (no por
región) la casilla tomaba su `:disabled` de `base.css` —apagada, `cursor: not-allowed`— y el
texto se quedaba con el `cursor: pointer` y el color plenos de `.master-select`. La mitad
derecha del control decía "clickeame" y la izquierda decía lo contrario.

Es el defecto de las **dos densidades** del §2.1, reentrando por el bloqueo individual en vez de
por el de región — `.bloqueada` sólo cubría el segundo. Se cierra con
`.master-select[aria-disabled="true"]` (`filters.css`), que toma el tinte y el cursor para todo
el control, **neutralizando el `opacity` propio de la casilla**: dos `0.5` anidados dan 0,25 y
volvían las dos densidades adentro del mismo control.

`not-allowed` y no `default` a propósito: acá no hay una región apagada que se lea como "ahora
no", hay **un** control que no se puede usar. Adentro de `.bloqueada` sigue mandando la región
—su regla lleva `!important` y ésta no—, así que los dos estados quedan distinguibles.

### 6.10 🔴 En una página no soportada, "Re-escanear" contestaba cualquier cosa — ✅ cerrado

**Encontrado el 2026-08-13, usando la extensión**: parado en una página cualquiera y tocando
Re-escanear, aparecía *"No hay clases — No se encontraron clases que coincidan con la búsqueda o
el filtro"*, con el buscador vacío y sin ningún filtro puesto.

**No era el cartel de lista vacía fallando: era una tercera causa que ningún cartel cubría.** El
escaneo ni siquiera corre — `adoptarPortalDePestaña(tab.url)` no resuelve y la rama sale con
`return`. Lo único que hacía era:

- escribir `"⚠️ No estás en un portal reconocido."` en `nodos.txtEstado`, el `<p>` oculto (§6.8b)
  — **tercer** mensaje perdido ahí; y
- repintar **sólo si ya había clases** (`if (appState.listadoClasesGlobal.length > 0)`). Con la
  lista vacía no repintaba nada, así que quedaba en pantalla lo que hubiera de antes.

De ahí el síntoma: la card vieja sobrevivía a una acción del usuario que debería haberla
reemplazado. **No mentía el copy nuevo; mentía la ausencia de repintado.**

**Cerrado** sumando `motivo: 'sin-portal'` al `escaneoMuerto` que ya usaban el watchdog (§6.1) y
el error de inyección (§6.8a) — tercera entrada al mismo estado, con lo cual vienen gratis el
bloqueo derivado de la toolbar y que ningún render posterior le gane la región. Y se fue el
`if (length > 0)`: el repintado corre siempre.

**La card nombra los portales** (*"Abrí una de Ramón Net o Anatomy by Chris"*) y la lista sale de
`sitios.todos()`, un passthrough nuevo del wrapper de composición. Escribirla en el copy la
dejaría envejecer en el próximo portal que se registre — que es lo que ADR-0010 evita en los
datos, entrando por el texto.

> **El patrón, que ya lleva tres**: el escaneo tiene ahora tres salidas por error y las tres
> pasan por el mismo estado. **Si aparece una cuarta, va ahí también.** Lo que hace falta para
> que una salida esté "cubierta" son tres cosas, no una: apagar el loader, **dejar algo en
> pantalla** y **pedir el repintado**. El §6.7 daba las cuatro salidas por buenas mirando sólo
> la primera.
