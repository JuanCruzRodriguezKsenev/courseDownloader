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

### 2.2 Qué NO se bloquea

- **Las pestañas.** Con el servidor caído sigue siendo legítimo mirar la cola, y la alerta se
  pinta igual en las dos. Bloquearlas dejaba al usuario sin poder ni consultar su fila.
- **El progreso de descarga**, si hay una en curso: **queda en pantalla y bloqueado**. Taparlo
  borraría la única referencia de cuánto se hizo; lo que no puede quedar vivo son sus botones de
  cancelar.

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

Todo esto cae en `popup.js` y en el CSS, o sea **fuera del alcance de la suite** (ADR-0005). La
rama `copy-generico-verificacion` junta las cinco ramas **más un banco de pruebas**
(`verificacion/modoVerificacion.js`, 🧪 en la cabecera, o **F9**) que existe para esto:

- **fuerza las caídas** de servidor e internet envolviendo `fetch` por origen, así el banner
  entra por el camino real y destildar reproduce la reconexión entera;
- **fuerza la cola pausada** en sus **5 tipos**, contestando el sync del arranque con
  `colaPausadaPorError` (necesita recargar: ese sync corre una sola vez);
- **demora el escaneo** 0/1/3/6 s y fuerza escaneo vacío / colgado / error de inyección;
- **graba** todo texto que pasa por el loader, el estado y el botón, con hora — que es lo que
  permite leer carteles que duran milisegundos.

**El banco es un andamio y NO se mergea.** Su rama se descarta entera después de la pasada.

**Qué mirar**: que no se vean la lista y la alerta juntas; los laterales de la card contra las
barras de arriba; el footer sin línea fantasma; el bloqueo parejo (mismo tinte, sin cursor de
prohibido, sin hover en el badge ni en "Todos"); los botones al cambiar de pestaña con el
servidor caído; y que al reconectar vuelva todo.

---

## 6. El informe de la auditoría — lo que sigue ABIERTO

Lo de abajo salió de auditar los loaders y los estados de carga, y **no se arregló**. El estado
formal de cada uno vive en `TECHNICAL_DEBT.md` §🔴 Abierto; acá está el detalle técnico.

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

### 6.2 🟠 El loader del escaneo inicial no se ve nunca

`conectarYArrancar` llama al escaneo y **apaga el loader en su `finally`, en el mismo tick**: el
escaneo no es `async` (registra el callback de `chrome.tabs.query` y vuelve), así que el
navegador nunca pinta entre las dos. En el arranque automático, "Escaneando la pestaña…" es
código muerto en pantalla. Sólo se ve por el botón "Re-escanear" o tras reconectar.

**Consecuencia para verificar copy**: el cartel del cambio de portal **no se puede observar
abriendo el popup**; hay que forzarlo con "Re-escanear".

### 6.3 🟠 La lista puede quedar atenuada al 50% indefinidamente

`ListaClases.setAtenuada(true)` se pone al empezar a sincronizar y se apaga **en un solo lugar**:
el `finally` de `resolverMapeoEnUI`. Si `escanearDisco` falla por red, el `catch` externo llama a
`activarEstadoOfflineUI()` y esa función nunca corrió. `atenuada` y `oculta` son flags
independientes, así que al reconectar vuelve la lista **al 50%**. Se auto-cura sólo si el
re-escaneo posterior termina en una sincronización exitosa; si vuelve vacío o sin portal, queda
atenuada hasta cerrar el popup, sin ningún mensaje.

### 6.4 🟠 Dos llamadas al backend sin timeout

El cliente es asimétrico: `obtenerRutaServidor` tiene **4 s** duro y `enviarFragmentoStream`
**30 s**, pero **`escanearDisco` y `seleccionarCarpeta` no tienen ninguno**. El de
`seleccionarCarpeta` es defendible —del otro lado hay un diálogo nativo esperando a una
persona—, pero el loader que lo acompaña hereda esa espera sin techo. El de `escanearDisco` no:
cuelga el botón en "Sincronizando disco local..." con la lista atenuada por §6.3, sin salida y
sin mensaje. En Windows `localhost:3001` **cuelga** en vez de rechazar, que es justo el motivo
por el que los otros dos tienen timeout.

### 6.5 ⚪ El onboarding recibe siempre el portal legado

`entrypoints/popup/main.js` monta la isla con `sitios.obtener(undefined)`, sin mirar la pestaña.
Con eso la slide 3 muestra **la frase de Ramón Net también en Anatomy** — o sea que el corte 2
del copy genérico movió el texto al descriptor (correcto y necesario) pero el defecto que venía a
cerrar sigue en pantalla. El comentario de ese archivo dice "ofrecer elegir entre N portales es
del corte 7, cuando exista un segundo", y el segundo existe desde el 2026-08-07. Es un tercer
corte chico: resolver el portal por pestaña y pasárselo.

### 6.6 Detalles menores, con archivo

- **`iniciar.bat` quedó sin ruta** tras la fusión: `bannerConexion.preact.js` y `popup.js` dicen
  "ejecutá **iniciar.bat**" y hoy el archivo es `backend/iniciar.bat`.
- **Rama muerta y silenciosa**: el `if (ruta)` de `conectarYArrancar` no tiene `else` — un backend
  que conteste 200 sin `ruta` deja el popup en blanco, sin banner ni estado. Hoy es inalcanzable
  (`backend/handlers.js` siempre manda `ruta`), pero es latente.
- **`aria-live="polite"` en el overlay del loader** anuncia los cambios de texto aunque esté
  oculto por `display:none`.

### 6.7 Lo que se revisó y está bien

- Las **cuatro salidas** del loader del escaneo están todas cubiertas (timeout, sin portal, error
  de inyección, y el `finally` del procesamiento): no hay fuga.
- El banner **no se re-renderiza de más**: se compara el tipo antes de re-mostrar.
- La **campanita** y el historial están acotados (50) y con su propio estado; no comparten canal
  con la línea de estado, que es lo correcto.
- Las **cinco tarjetas de pausa** cubren los cinco tipos con copy distinta y **ninguna nombra un
  portal** — respetan ADR-0010.
