# Deuda técnica — Course Downloader

Inventario vivo de problemas conocidos en el código actual, ordenados por severidad. Cada ítem indica ubicación exacta, impacto y la solución propuesta. Este documento se actualiza a medida que se resuelven o aparecen nuevos hallazgos — no es un snapshot histórico (para eso está el changelog de cada archivo y el historial de git).

Última auditoría: 2026-08-12.

**Lo que está abierto vive en la sección de abajo, y nada más.** Todo lo que sigue después
(Seguridad, Mantenibilidad, Testing, Robustez, Menores) está ✅ resuelto y se conserva como
registro fechado: sirve para entender por qué el código está como está, no como lista de
pendientes. Un ítem con fecha describe el estado **de esa fecha** — si nombra un archivo o una
ruta que desde entonces se movió, no se corrige hacia atrás.

---

## 🔴 Abierto

> ## Estado al 2026-08-13: **CUATRO** entradas abiertas
>
> Re-contadas, no sumadas al número anterior — que es lo que pide el párrafo del error de
> conteo, unas líneas más abajo. Son:
>
> 1. **El mecanismo de popovers sin tests** (última entrada de esta sección). Venía de antes.
> 2. **El loader no tiene dueño**: se prende y apaga con `style.display` desde **12 lugares**, y
>    los dos que se pisan están coordinados por una bandera (`elEscaneoTomoElLoader`) en vez de
>    por construcción. Medido el 2026-08-13: dos de los cuatro carteles del arranque son
>    destellos —**248 ms** el del loader y **117 ms** el del botón—, y los otros dos duran ~3 s.
>    **El corte ya está diseñado** (dueño único + tokens + demora para aparecer y mínimo visible
>    **por texto**, botón incluido) → `docs/ramas-en-revision.md` §Lo que falta.
> 3. **`#ui-msg-status` está oculto y nadie se lo destapa**, así que ~20 mensajes son invisibles
>    —incluido el texto de progreso de la descarga—. Arreglo de una línea, lo que falta es la
>    pasada por navegador → `docs/alertas-y-bloqueo-diseno.md` §6.8b.
> 4. **El banco no puede forzar una descarga en curso** ni sembrar el historial de fallos: sólo
>    envuelve APIs del popup, y eso vive en el service worker.
>
> **Y hay una tanda construida y sin verificar en Chrome**, en `tanda-toolbar-capa-y-pnpm`: pnpm,
> el bloqueo y la capa flotante reutilizables, los controles que siguen al resultado y los
> carteles de lista vacía. Qué mirar y en qué orden → `docs/ramas-en-revision.md`. Hasta que se
> verifique, **eso no está cerrado**: la compuerta en verde no dice nada sobre esta zona.
>
> La verificación encontró **ocho defectos más**, ninguno alcanzable por la compuerta y cuatro
> introducidos por el arreglo del anterior; se cerraron en la misma pasada. Tabla y lecciones →
> `docs/alertas-y-bloqueo-diseno.md` §5.1.
>
> **Y acá hubo un error de conteo que conviene dejar escrito, porque duró cinco días.** Este
> mismo encabezado decía, desde el 2026-08-07, que «lo único abierto es el copy genérico», y
> después «se suman CINCO»: total, seis. Eran **siete**. La entrada de los popovers —hallada el
> 2026-08-05, marcada `🔴 abierto`, tres secciones más abajo— **no estaba contada**: el resumen
> ya la omitía el día que se escribió. `AGENTS.md` (entonces `CLAUDE.md`) heredó el número y lo
> repitió hasta hoy.
>
> El error entró **por el resumen, no por el inventario**: las siete entradas siempre estuvieron
> completas y correctas. Es exactamente el modo de falla contra el que existe la convención DRY
> del proyecto (ADR-0007), aparecido adentro del propio doc canónico. **Al agregar una entrada
> acá, re-contá la sección en vez de sumarle uno al número que ya estaba.**
>
> ### Lo que se cerró el 2026-08-12
>
> - **Los CINCO de la auditoría de loaders** (`✅` cada uno, abajo): el timeout que saltaba
>   siempre en Anatomy, el loader del escaneo inicial que no se veía nunca, la lista que
>   quedaba atenuada al 50%, los dos `fetch` sin techo, y el onboarding que recibía siempre el
>   portal legado. El detalle técnico está en `docs/alertas-y-bloqueo-diseno.md` §6; acá, sólo
>   el estado.
> - **El copy genérico que nombraba a Ramón Net**: construido en dos cortes y mergeado. Decía
>   "6 strings de `popup.js`" hasta que el re-relevamiento del 2026-08-11 lo midió bien —eran
>   **9 textos en 17 sitios**, y **7 en 12** desde que el rename a Course Downloader cerró de
>   arrastre los 4 de la marca—. Inventario → `docs/copy-generico-diseno.md`.
>   Su historia vale como recordatorio: pasó de **bloqueado** ("recién cuando exista un segundo
>   portal real") a **postergado** el 2026-08-07, que no es lo mismo; y de ahí a hecho.
>
> La entrada de la identidad (ADR-0014) sigue **resuelta y conservada acá**, y no en el registro
> fechado de abajo, porque lo que enseñó vale cada vez que se toca la cola o el escaneo.

### ✅ El timeout del escaneo salta SIEMPRE en Anatomy, y el mensaje miente

- **Estado**: ✅ **RESUELTO el 2026-08-12** (hallado ese mismo día, auditando los loaders), en
  `integracion-alertas`. **Falta verificarlo en navegador** — el watchdog vive en el núcleo de
  `popup.js`, que ADR-0005 declara no-extraíble, así que ningún test lo alcanza.
- **Cómo se cerró**, los cuatro puntos del fix propuesto:
  - el tope salió del descriptor: `PuertoSitio.topeEscaneoMs`, **requerido** por el mismo motivo
    que `instruccionEscaneo` — un portal nuevo que lo olvide tiene que no compilar, no heredar
    un número ajeno. 6 s Ramón Net, **30 s Anatomy** (margen deliberado sobre los ~11 s medidos:
    el pool sale a la red 114 veces y una conexión lenta lo estira sin que eso sea una falla);
  - el watchdog **se arma después de resolver el portal**, porque antes el portal no se sabe —
    la misma trampa que el cartel genérico de `ejecutarPaso1...` (`copy-generico-diseno.md` §4);
  - **abandono explícito por generación**: al vencerse, el watchdog invalida la corrida, así que
    el callback que llega tarde se descarta en vez de pintar. Es el arreglo del síntoma visible,
    no sólo del número;
  - **guarda de reentrada** y el mensaje en la **tarjeta de la lista**, no en el footer.
- **Tests**: +5 en `sitio/registro.test.ts`, sobre el **valor** y no sobre la existencia del
  campo — que exista ya lo obliga `tsc`, y el bug fue un tope que existía y estaba mal. Fijan un
  piso de 5 s, el margen de Anatomy sobre sus 11 s medidos, que Ramón Net conserve los suyos, y
  que el orden entre los dos no se invierta por un copy-paste entre configs.

<details><summary>El diagnóstico original, como se registró</summary>
- **Qué pasa**: el `safetyTimeout` de `popup.js` es de **6 s** y el escaneo de Anatomy mide
  **~11 s** (`/v1/navigation` ~4,0 s + el pool de 114 materiales 7,1 s, los dos medidos en
  `escaneo-api-anatomy-diseno.md`). A los 6 s escribe *"⚠️ Timeout de carga del DOM."* —que
  además nombra un mecanismo que ese portal no usa, es vocabulario de la era del scraper— y
  ~5 s después llega el escaneo real y pinta la lista encima. El error se borra solo, sin que
  nadie lo haya resuelto.
- **Lo que agrava**: durante esa ventana el botón vuelve a "Re-escanear 🔄" y **no hay guarda de
  reentrada**, así que un click lanza un segundo escaneo concurrente sobre el primero.
- **Lo que NO es**: no es una detección de fallo, es un temporizador ciego. No cancela el
  escaneo, no registra en la campanita (eso es `historialFallos` y **sólo lo escribe el SW**), no
  notifica y no bloquea el reintento.
- **Fix propuesto** (4 puntos, en `alertas-y-bloqueo-diseno.md` §6.1): el tope sale del
  descriptor del portal —requerido, como `instruccionEscaneo`—, abandono explícito para que un
  callback tardío no pinte sobre un estado ya dado por muerto, el mensaje en la tarjeta de la
  lista y no en el footer, y guarda de reentrada.
</details>

### ✅ El loader del escaneo inicial no se ve nunca

- **Estado**: ✅ **RESUELTO el 2026-08-12** en `integracion-alertas`, sin verificar en navegador.
- **Qué pasaba**: `conectarYArrancar` llamaba al escaneo y apagaba el loader en su `finally`, **en
  el mismo tick** — el escaneo no es `async`—, así que el navegador nunca pintaba entre las dos.
  En el arranque automático "Escaneando la pestaña…" era código muerto en pantalla.
- **Cómo se cerró**: `ejecutarPaso1...` **devuelve si tomó posesión del loader** y el `finally` lo
  respeta. La guarda de reentrada devuelve `false` justamente para no dejarlo girando.
- **Por qué importaba más de lo que parece, y por qué se hizo antes que verificar el copy**: el
  cartel del cambio de portal —lo que hay que mirar al verificar la copy genérica— **no se podía
  observar abriendo el popup**, había que forzarlo con "Re-escanear". Era un bug abierto
  funcionando como **precondición para verificar otra cosa**, y el orden de trabajo no lo
  reflejaba.

### ✅ La lista puede quedar atenuada al 50% indefinidamente

- **Estado**: ✅ **RESUELTO el 2026-08-12** en `integracion-alertas`, sin verificar en navegador.
- **Qué pasaba**: `setAtenuada(true)` se ponía al sincronizar y se apagaba en un solo lugar (el
  `finally` de `resolverMapeoEnUI`). Si `escanearDisco` fallaba por red, el `catch` externo iba a
  `activarEstadoOfflineUI()` y ese `finally` nunca corría; `atenuada` y `oculta` son flags
  independientes, así que al reconectar la lista volvía **al 50%**. Se auto-curaba sólo si el
  re-escaneo posterior terminaba en una sincronización exitosa.
- **Cómo se cerró**: la apaga quien la prendió — el `finally` pasó a
  `ejecutarPaso2SincronizarDiscoVeloz`, que cubre los dos caminos. Es la regla **una región, un
  dueño** de `alertas-y-bloqueo-diseno.md` aplicada al indicador en vez de al DOM.

### ✅ `escanearDisco` y `seleccionarCarpeta` no tienen timeout

- **Estado**: ✅ **RESUELTO el 2026-08-12** en `integracion-alertas`. **Éste sí tiene tests** (+6
  en `core/backend/bunClient.test.ts`): el cliente es núcleo, no popup.
- **Qué pasaba**: el cliente era asimétrico — `obtenerRutaServidor` tiene 4 s y
  `enviarFragmentoStream` 30 s, con el comentario que explica por qué (en Windows
  `localhost:3001` **cuelga** en vez de rechazar). Esos dos no tenían ninguno. El de
  `escanearDisco` colgaba el botón en "Sincronizando disco local..." con la lista atenuada por el
  ítem de arriba, sin salida ni mensaje.
- **Cómo se cerró, y lo que no hay que "unificar" después**: los dos techos son **deliberadamente
  distintos**. `escanearDisco` 15 s (el server lee disco de verdad, y una carpeta grande tarda);
  `seleccionarCarpeta` **3 minutos**, porque del otro lado de ese fetch no hay un servidor
  calculando sino **una persona mirando un explorador de archivos** — un techo de segundos le
  cancelaría el diálogo a alguien que está eligiendo, que es peor que el cuelgue que viene a
  evitar. Hay un test que fija esa desproporción contra el otro valor, para que nadie los empareje.

### ✅ El onboarding recibe siempre el portal legado

- **Estado**: ✅ **RESUELTO el 2026-08-12** en `integracion-alertas`, sin verificar en navegador.
- **Qué pasaba**: `entrypoints/popup/main.js` montaba la isla con `sitios.obtener(undefined)` sin
  mirar la pestaña, así que la slide 3 mostraba **la frase de Ramón Net también en Anatomy**. El
  corte 2 del copy genérico movió ese texto al descriptor (correcto y necesario), pero el defecto
  que venía a cerrar **seguía en pantalla**. El comentario de ese archivo decía "cuando exista un
  segundo" portal, y existe desde el 2026-08-07.
- **Cómo se cerró**: resuelve por pestaña (`sitios.resolverPorUrl(tab.url)`) con fallback al
  legado si no es un portal reconocido — el tour se abre desde cualquier lado y ahí no hay portal
  correcto que mostrar. El montaje se movió adentro del callback de `chrome.tabs.query`: montar
  con el legado y "corregir" después haría parpadear la copy.
- **De paso destapó un agujero de cobertura**: el wrapper `sitios` de `plataforma/composicion.ts`
  —el export compartido entre SW y popup, que existe **para que la regla de resolución no pueda
  divergir**— no tenía ni un test propio. Ahora sí: `plataforma/composicion.test.ts`, con los tres
  casos del `sitioId` (ausente → legado; presente-no-registrado → huérfano; por URL → sin
  migración). Ese archivo es la parte más reutilizable de este ítem.
- **Fix**: resolver el portal por pestaña y pasárselo a la isla. Corte chico y aislado.

### ✅ La identidad (portal, título) colisiona dentro de un portal de dos niveles

- **Estado**: ✅ **RESUELTO el 2026-08-07**, el mismo día que se encontró, en el corte 1 del
  escaneo por API. La identidad pasó a **(portal, módulo, tipo, título)** y la decisión quedó en
  **ADR-0014**. Falta la verificación en navegador del frente entero (rama
  `escaneo-api-anatomy`), pero el defecto que rompía datos ya no está en el código.
- **Lo que enseñó de más, y por eso vale releer esta entrada**: arreglar la clave **no alcanzaba**.
  Construirlo destapó **cinco lugares que armaban un objeto-identidad a mano con dos campos** — el
  propio bucle de descarga (`esteItem`, que hacía que la clave saliera sin módulo y anulaba el
  arreglo entero), los dos senders de `remover_item_de_cola` (con la clave incompleta, "Remover"
  no removía nada y no avisaba) y los dos `clase_con_error`. Ninguno lo detecta el compilador: son
  objetos literales estructuralmente válidos. La regla que quedó está en `docs/patterns.md` §IPC.
- **Estado original**: 🔴 abierto (hallado el 2026-08-07, midiendo el árbol de clases de Anatomy by
  Chris para rediseñar su escaneo). **Rompía datos ese día, sin ningún cambio previo.**
- **Qué pasa**: `core/cola/identidadClase.ts` define la identidad de una clase como el par
  **(portal, título)**. El corte D del multi-sitio lo estableció así porque dos portales pueden
  tener clases homónimas; el supuesto tácito era que **dentro** de un portal el título es único.
  Con un portal de dos niveles no lo es: en Anatomy by Chris hay **7 títulos que existen en dos
  módulos a la vez** — `Miologia 1`, `2`, `3`, `4`, `5`, `6` e `Irrigación`, todos en *Miembro
  Superior* **y** *Miembro Inferior*. Son clases distintas, con distinto video y distinta carpeta.
- **Cómo se manifiesta** (el mismo modo de fallar que el corte D cerró para dos portales):
  - `core/cola/procesadorCola.ts:352` y `:519` — al completar una descarga, la homónima **sale de
    la cola**: nunca se baja y desaparece sin error.
  - `popup.js:938` — al de-duplicar contra la cola, la segunda se descarta en silencio.
  - El espejo de progreso (`estados[identidad.clave(item)]`) pinta el avance de una en la fila de
    la otra.
- **Cómo reproducirlo**: escanear *Miembro Superior*, encolar `Miologia 1`; escanear *Miembro
  Inferior*, encolar `Miologia 1`. **No hace falta ningún cambio en el código.**
- **Solución propuesta**: la identidad pasa a **(portal, módulo, tipo, título)**, con el módulo como
  **origen** de la clase y no como carpeta de destino (si usara el destino, editar la carpeta
  rompería el match contra la cola). Un portal de un solo nivel no manda módulo ni tipo y su clave
  queda igual: **sin migración de datos**, porque la clave se calcula y no se persiste — salvo el
  espejo de progreso, que vive en `storage.session` y muere con la sesión.
- **Por qué también `tipo`** (agregado el 2026-08-07, más tarde el mismo día): desde que los
  materiales entraron en alcance, un PDF y el video del que cuelga comparten portal, módulo y
  título. El campo va **ahora, con `"video"` por omisión**, aunque el primer corte sólo traiga
  videos: agregarlo después obliga a volver a tocar `identidadClase` y sus tests con la cola en
  uso. Es exactamente el error que esta deuda documenta —una clave que alcanzaba hasta que apareció
  un caso más— y no tiene sentido repetirlo sabiendo que el caso ya existe.
- **Dónde está el detalle**: `docs/escaneo-api-anatomy-diseno.md` §El bloqueante (medición y plan)
  y `docs/multisitio-diseno.md` §La trampa que el corte D no vio (la regla general). Es el corte 1
  de ese frente, pero **la deuda es independiente**: se puede arreglar sin construir el escaneo por
  API, y conviene, porque hoy pierde descargas.

### ✅ Soporte para un segundo portal: la selección de sitio no existe, y hay vocabulario filtrado

- **Estado (2026-08-12, el que vale)**: ✅ **RESUELTO**, en `integracion-alertas` y sin verificar
  en navegador. El multi-sitio cerró el 2026-08-06 y lo último que quedaba era el **vocabulario
  filtrado** — la mitad de esta entrada que sobrevivió a la otra. Se construyó en dos cortes:
  la UI genérica dejó de hablar como Ramón Net (7 textos en 12 sitios) y `instruccionEscaneo`
  entró a `PuertoSitio`. Inventario y regla de decisión → `docs/copy-generico-diseno.md`.
- **Lo que enseñó la medición, y es lo que sobrevive de esta entrada**: la primera cuenta decía
  "6 strings de `popup.js`" y el re-relevamiento del 2026-08-11 encontró **9 textos en 17
  sitios**. La vieja había buscado el **nombre** del portal y no **su jerga**: la familia
  `"aula virtual"`, 7 sitios, nunca se había contado. Después bajó a 7 en 12 porque el rename a
  Course Downloader cerró de arrastre los 4 de la marca, desde otro frente — que es por qué el
  *estado* vive acá y no en el doc del cómo.
- **Y la distinción que costó nombrar**: pasó de **bloqueado** ("recién cuando exista un segundo
  portal real") a **postergado** el 2026-08-07, cuando el corte 7 hizo existir ese portal. No es
  lo mismo: bloqueado es que algo espera; postergado es una decisión de prioridad. Confundirlos
  deja ítems durmiendo con una condición que ya se cumplió.
- **Estado (2026-08-04)**: 🔴 abierto (hallado auditando la arquitectura tras la Fase 8a).
- **Estado (2026-08-04, tarde)**: **en construcción, no ya sólo registrado.** El dueño confirmó
  que el objetivo es multi-sitio; hay diseño (`docs/multisitio-diseno.md`), ADR-0010 y **los
  cortes 1 a 4 hechos**: el registro existe (`sitio/registro.ts`), los ítems llevan `sitioId`
  con su migración, el bucle de descarga resuelve el portal por ítem y el filtro de la cola
  deriva la faceta con el descriptor correcto. **Cuáles están hechos y cuáles faltan se lee en
  `docs/multisitio-diseno.md` §Orden de cortes, que es la fuente viva** — duplicar acá esa
  cuenta ya produjo deriva dos veces. Lo único que vale repetir es dónde está el riesgo: el
  corte 5 (el popup resolviendo por pestaña) es el peligroso, porque no hay tests sobre el
  núcleo de `popup.js`.
- **Estado (2026-08-05)**: la revisión de esta deuda encontró **un quinto punto de acoplamiento
  que la medición original no había visto** — el click en la notificación de fallo. Ver el
  sub-ítem al final de esta entrada; es el corte 8 del diseño.
- **Qué pasaba (el hallazgo original)**: ADR-0009 decidió **registro de sitios en runtime** y esa
  decisión **nunca se había construido**: `sitio/ramonnet/config.ts` tenía
  `const SitioActivo: PuertoSitio = SitioRamonNet`, un alias fijo — un portal declarándose a sí
  mismo el activo. Sin registro ni resolución por pestaña.
- **Qué habría que tocar fuera de `sitio/` para sumar un portal** (medido, no estimado):
  - 6 imports con la ruta del portal hardcodeada en los dos entrypoints
    (`entrypoints/background.js:24-26`, `entrypoints/popup/main.js:14-16` — 3 y 3; los rangos
    que decía esta línea hasta el 2026-08-05 eran más anchos que el hallazgo e incluían
    imports que no son del portal).
  - `plataforma/composicion.ts`, que importaba el portal directo (✅ resuelto en el corte 2:
    ahora importa el registro).
  - `wxt.config.ts`: 4 `host_permissions` del portal + su CDN, y la ruta única del ruleset dNR
    (`rule_resources` acepta varios; hoy hay uno).
- **Vocabulario del portal filtrado a capas genéricas** (código, no comentarios):
  - ✅ **Las 3 de `core/` se cerraron el 2026-08-04.** El copy de pausa pasó de la constante
    `MOTIVOS_PAUSA` a `motivosPausa(nombreSitio)`, y el procesador recibe `sitio.nombre` como
    colaborador — era la única de las tres que **llegaba a los ojos del usuario** (viaja al
    historial de fallos y a la notificación del SO). La perilla `RAMONNET_BUN_BASE_URL` pasó a
    llamarse `BUN_BASE_URL`, **conservando el alias viejo**: está documentada desde 2026-07-17
    y puede estar seteada en el repo del backend, que es aparte y no se versiona con éste.
    `tsc` cazó los dos dobles de test que faltaban actualizar, que es exactamente para lo que
    el colaborador está tipado.
  - 🔴 **Sigue abierto en la UI**: `popup.js` tiene **6** strings que nombran al portal (líneas
    493, 508, 633, 800, 873, 1082 — las dos primeras son `console.log`, las otras cuatro son
    copy que el usuario ve) y `catedra:` como nombre de campo en la 893. *(Re-medido el
    2026-08-06, tras mergear el multi-sitio. **Eran 7 y ahora son 6**: el corte 5 se llevó uno
    al generalizar "⚠️ No estás en Ramón Net" a "⚠️ No estás en un portal reconocido", que dejó
    de ser copy de un portal porque el popup ahora resuelve por pestaña. Y **`background.js`
    salió de la lista**: lo que lo ponía ahí era resolver la pestaña con el portal asumido, y
    eso lo cerró el corte 8 — lo que queda ahí son comentarios, no código. Ojo al re-medir: un
    `grep -E "Ram[oó]n"` no matchea los acentuados en algunas builds — usar ripgrep, o se
    cuenta de menos; y hay que filtrar comentarios, o se cuenta de más.)* **No se tocaron a
    propósito**: son copy de usuario, no una violación
    de capa —`popup.js` no es Capa 1—, y parametrizarlos sin un segundo portal real que
    valide el resultado es trabajo contra código imaginado.
- **Impacto**: la regla de dependencia de la arquitectura **sí se cumple** (`core/` no importa
  nada de `sitio/` ni de `plataforma/`, y `PuertoSitio` es un contrato que `tsc` hace cumplir).
  Lo que no se cumple es la promesa práctica de ADR-0008: *"sumar un portal = escribir un
  adaptador de Capa 2"*. Eran ~5 lugares fuera de `sitio/` más el registro; **el registro ya no
  falta** (existe desde el corte 2, `sitio/registro.ts`), así que lo que queda son esos lugares.
- **Qué NO haría falta tocar**, y vale registrarlo porque es la evidencia de que la
  re-arquitectura sirvió: toda la UI (features + las 6 islas son genéricas), `core/` entero
  salvo las 3 líneas de arriba, y `plataforma/` completa.
- **Diseño (2026-08-04)**: ya no es sólo un hallazgo — el cómo está en
  `docs/multisitio-diseno.md` y la decisión de fondo en ADR-0010. Los cortes 1 y 2 de ese doc
  (`sitioId` en los ítems + el registro con un solo portal) eran los seguros y ya se hicieron:
  no cambiaron ninguna conducta.
- **Fix propuesto (revisado el 2026-08-05)**: el dueño confirmó que el objetivo ES multi-sitio,
  así que se construye, y el andamiaje ya está — el registro existe y los ítems llevan su
  portal. Lo que sigue vigente del criterio original es **el freno**: los strings de `popup.js`
  recién cuando exista un segundo portal real, porque planificar copy contra código imaginado es
  el error que esta re-arquitectura cometió cuatro veces (ver los §Registro de las Fases 6, 6b,
  6c y 7c). Las 3 fugas de `core/` ya se cerraron (arriba). *(Hasta el 2026-08-05 esta línea
  también frenaba "el registro", que para entonces llevaba un día construido — contradecía al
  Estado de esta misma entrada.)*

- **Estado (2026-08-07): el freno se cumplió, y el ítem queda POSTERGADO por decisión del dueño.**
  El segundo portal existe, está en `main` y se usa a diario, así que la condición
  —*"recién cuando exista un segundo portal real"*— ya no sostiene nada. **Lo que lo mantiene
  abierto ahora es prioridad, no dependencia**, y esa distinción es el motivo de esta línea: sin
  ella, la próxima sesión lee el freno de arriba, lo da por vigente y no vuelve a mirar el ítem.

  **Lo que cambió a favor de hacerlo**: con dos portales usándose en serio, cuatro de esos seis
  strings son copy que el usuario ve, y la mitad de las veces nombra al portal equivocado. Ya no
  es una violación teórica de capas — es un cartel que miente.

  **Lo que sigue costando**: es `popup.js`, el único archivo del proyecto **sin tests** (ADR-0005
  lo define como no-extraíble), así que el cambio se verifica sólo en el navegador. Y el séptimo
  caso —`catedra:` como **nombre de campo**, no como string— es de otra naturaleza: toca el
  esquema de `Clase` (`docs/data-model.md`), no un texto, y ahí hay migración de datos. **No los
  mezcles en el mismo corte**: los 6 strings son cosméticos y reversibles, el campo no.

  **Cómo re-medir cuando se retome** (el conteo envejece solo, ya pasó dos veces): con ripgrep,
  no `grep` — `grep -E "Ram[oó]n"` no matchea los acentuados en algunas builds y cuenta de
  menos—, y **filtrando comentarios**, o cuenta de más. El nombre correcto sale del descriptor
  (`sitio.nombre`), que el popup ya recibe: es el mismo camino que ya usan el cartel de "sin
  clases detectadas" y la tarjeta de error.

- **Re-medido el 2026-08-11, y el "6" era corto: son 9 textos en 17 sitios.** El inventario
  completo, la regla de decisión y el corte propuesto viven ahora en su propio doc →
  **`docs/copy-generico-diseno.md`** (el *cómo*: inventario, regla de decisión y corte propuesto).
  No se copian acá: este ítem es el hogar del *estado*, ese doc el del *cómo* (ADR-0007) — y por
  eso el estado de este ítem se lee **abajo**, en las entradas fechadas, no en esa línea.
  Lo que sí corresponde corregir acá es el conteo y su causa, porque es la tercera vez que
  envejece **y siempre a la baja por el mismo motivo**: se buscó el *nombre* del portal y no
  *su jerga*. La familia `"aula virtual"` —7 sitios, entre ellos el label del botón
  "Re-escanear aula virtual 🔄" que aparece 5 veces— estaba desde el principio y no la vio
  ninguna de las tres mediciones. **Al re-medir, buscar también "cátedra", "aula",
  "clases grabadas", "comisión".** Y el barrido va sobre toda la capa genérica, no sólo
  `popup.js`: se le habían escapado `entrypoints/popup/index.html` (4) y
  `popup/features/onboarding.preact.js` (2).

- **🔎 EN REVISIÓN desde el 2026-08-12**: los cortes 1 y 2 están **construidos, con la compuerta
  en verde, en dos ramas apiladas** (`copy-generico-corte-1` y `copy-generico-corte-2`, que se
  mergean en ese orden porque las dos tocan `onboarding.preact.js`). **Falta la verificación en
  navegador**, que es la única que ve algo acá, y hasta que pase el ítem **no se marca resuelto**.
  La checklist para correrla tal cual está en `copy-generico-diseno.md` §7.

- **Al 2026-08-12 quedan 7 textos en 12 sitios**, no 9 en 17: el rename de la extensión a
  **Course Downloader** (`ee32c0c`, Fase 3 de la fusión) cerró de arrastre los 4 sitios de la
  marca —`index.html:5` y `:26`, `wxt.config.ts:20`, y el `alt="Logo de Ramón Net"` del logo, que
  era el único defecto real del grupo—. **El ítem sigue abierto**: lo que se cerró era la parte
  independiente. Con eso, de los tres cortes propuestos **quedan dos**
  (`copy-generico-diseno.md` §7). Lo demás está intacto y re-verificado línea por línea ese día.

- **🔎 EN REVISIÓN desde el 2026-08-12 — el ítem dejó de estar postergado.** Los dos cortes que
  quedaban están **construidos y con la compuerta en verde**, en dos ramas apiladas
  (`copy-generico-corte-1` y `copy-generico-corte-2`, que se mergean en ese orden porque las dos
  tocan `onboarding.preact.js`). **Falta la verificación en navegador**, que es la única que ve
  algo acá —casi todo cae en `popup.js`, sin tests por ADR-0005—, y hasta que pase el ítem **no se
  marca resuelto**. La checklist para correrla está escrita en `copy-generico-diseno.md` §7.

#### Sub-ítem: el click en la notificación de fallo enfoca el portal equivocado

- **Estado**: ✅ **resuelto el 2026-08-05** (hallado ese mismo día, revisando esta deuda tras el
  corte 4) y **verificado en navegador el 2026-08-06**, en la pasada única que cubrió el stack
  entero. Fue el **corte 8** de `docs/multisitio-diseno.md`, y su §5 tiene el detalle del cómo.
  **Mergeado a `main` el 2026-08-06** (`148feda`).
- **Dónde**: `background.js:474-490`, el listener de `chrome.notifications.onClicked`. Resuelve
  la pestaña a enfocar con `sitio.patronPestañas` / `sitio.urlSondeoInternet`, y ese `sitio` es
  el `sitioAsumido` que le inyecta `entrypoints/background.js:48` — el andamio del corte 2.
- **Impacto**: es el mismo defecto que arregló el corte 4 (resolver con el portal equivocado),
  pero en el SW y **llegando al usuario**: con la cola mezclada, la notificación de una clase
  del portal B enfoca —o abre— la pestaña del portal A. El follow-up accionable que la
  notificación promete lleva al lugar equivocado.
- **Por qué no lo vio la medición original**: barrió el bucle de descarga y la UI, no los
  listeners sueltos del service worker. Vale como corrección del alcance de aquella medición,
  no sólo como ítem suelto.
- **Fix aplicado**: el `sitioId` del ítem viaja **adentro del `notificationId`** y el SW lo
  resuelve con `sitioDeNotificacionDeFallo`, un export nuevo de `plataforma/composicion.ts`
  construido sobre el MISMO `sitios.obtener` que usa el bucle — si resolvieran distinto se
  reintroduce la divergencia del punto 3. Va en el id y no en un `Map` porque el SW se suspende
  y se lo lleva, mientras la notificación sobrevive en pantalla. +19 tests. **De paso,
  `sitioAsumido` salió del service worker**: era su último lector.

### 🔴 El mecanismo de popovers de `popup.js` no tiene tests

> **LA ÚNICA ENTRADA ABIERTA DE ESTA SECCIÓN** (al 2026-08-12). Y la que el resumen del
> encabezado **omitió durante cinco días**, contando seis abiertos donde había siete: se
> escribió el 2026-08-07 diciendo "lo único abierto es el copy genérico" con esta entrada ya
> presente, dos años-luz más abajo en el mismo archivo. Si venís a agregar una entrada nueva,
> **re-contá la sección**; no le sumes uno al número que estaba.

- **Estado**: 🔴 abierto (hallado el 2026-08-05, al sumar el segundo popover en el corte 6b).
  Revisado el 2026-08-12: **se decide dejarlo abierto**, no cerrarlo ni arreglarlo.
- **Por qué no entró en la tanda del 2026-08-12**, que cerró las otras seis: cubrirlo no es
  escribir un test, es **extraer una feature** (`popup/features/popovers.js`) — un corte propio,
  sobre código que hoy anda y que ningún test cubre, o sea con el riesgo entero adelante y el
  retorno atrás. Las otras seis eran defectos con síntoma visible; ésta es cobertura ausente
  sobre algo que funciona.
- **Dónde**: `popup.js` — el listener global de `document` que cierra los popovers, y el handler
  de `btnFilterPills`. `OrdenFeature` sí quedó cubierta; esta mitad no.
- **Qué pasa**: el mecanismo es "un listener global cierra todo, y cada botón hace
  `stopPropagation()` para no cerrarse a sí mismo". Con **un** popover funcionaba y nadie lo
  miraba. Al sumar el segundo aparecieron dos defectos que ningún test podía ver: los dos
  quedaban abiertos a la vez (el botón que frena la propagación tampoco dispara el cierre del
  otro) y el nuevo no cerraba con el click afuera.
- **Por qué sigue abierto**: está en el núcleo de `popup.js`, que ADR-0005 declara no-extraíble.
  Cubrirlo implica o bien extraer el manejo de popovers a una feature —que es un corte propio— o
  bien un test de integración del popup, que hoy no existe como categoría.
- **Mientras tanto**: si se agrega un tercer popover, **probarlo a mano contra los otros dos**.
  Es la única red.

---

**El resto: nada abierto (última revisión: 2026-08-03).** Los dos ítems que hubo —el sondeo ad-hoc de
`queue.js` y la deuda de verificación de las Fases 1-5a— se cerraron el 2026-08-02; están en la
sección Resuelto. Lo que sigue **no es deuda**: es la re-arquitectura en curso, y su estado por
fase vive en `docs/rearquitectura-diseno.md` (tabla de avance + §Cómo retomar). No dupliques
acá el avance de las fases.

Cuando aparezca un hallazgo nuevo, va acá arriba con su `**Estado**` explícito.

---

### 🔴 El loader del popup no tiene dueño

- **Dónde**: **12 call-sites** de `nodos.loader.style.display` — **once** en `popup.js` y uno en
  `popup/features/serverConnection.js`. El inventario es
  `grep -rn "loader.style.display" popup.js popup/features/*.js`, no una lista acá: son los nodos
  que el corte tiene que dejar en cero, y una lista de líneas envejece con el primer commit que
  toque `popup.js`. **Decían 9 y siempre fueron 12** — mal contados de entrada el 2026-08-12, no
  crecidos después (`git show main:popup.js | grep -c` ya daba once). El error subdimensionaba
  justo lo que este ítem existe para dimensionar.
- **Qué pasa**: no hay componente, ni store, ni isla — a diferencia de la ruta (`RutaDisco`), el
  banner (`BannerConexion`) y la lista (`ListaClases`). Tres flujos lo usan con tres textos
  escritos a mano, y **dos se pisan**: `conectarYArrancar` lo apagaba en su `finally` en el mismo
  tick que el escaneo lo prendía (el escaneo no es `async`). Ese bug ya se pagó (§6.2) y se cerró
  con una **bandera**, `elEscaneoTomoElLoader` — dos dueños del mismo recurso puestos de acuerdo a
  mano, el antipatrón que el §1 de `alertas-y-bloqueo-diseno.md` prohíbe para la lista.
- **Síntoma vivo**: el escaneo rápido deja el loader 100-200 ms en pantalla. Es menos de lo que el
  ojo registra: se ve un destello y parece que no funcionó.
- **Medido el 2026-08-13** con el banco de pruebas (Anatomy, 20 clases, servidor prendido). Los
  cuatro carteles del arranque **no tienen término medio: dos duran ~3 s y dos son destellos**:

  | Cartel | Dónde | Duró |
  |---|---|---|
  | "Conectando con el servidor Bun…" | loader | **248 ms** ⚠️ |
  | "Conectando con el servidor… ⏳" | botón | 3,20 s |
  | "Escaneando la pestaña…" | loader | ≥3,09 s |
  | "Sincronizando disco local…" | botón | **117 ms** ⚠️ |

  Popup abierto → usable: **3,46 s**. Dos advertencias sobre estos números: (1) los 248 ms son un
  **piso**, no la duración — el banco anota el texto del loader recién cuando arranca él
  (`verificacion/modoVerificacion.js:276`, y va último por diseño), y el CSS ya lo había pintado
  antes; (2) son con el **servidor prendido**. Apagado, en Windows `localhost` cuelga en vez de
  rechazar y lo único que corta es el timeout de 4000 ms de `obtenerRutaServidor`
  (`core/backend/bunClient.ts:277`): el mismo cartel pasa de ~250 ms a **4 s**. Es el texto con
  más rango dinámico del popup, y el piso de 500 ms sólo toca el extremo corto.
- **El piso vale también para el LABEL DEL BOTÓN, no sólo para el loader.** Lo destapó esa misma
  medición y da vuelta una suposición del ítem: **el peor parpadeo no está en el loader**
  —"Sincronizando disco local…" dura 117 ms, menos de la mitad que el del loader— y está en un
  elemento que el corte, tal como estaba diseñado, **no toca**. La regla es del cartel, no del
  nodo: si un texto le informa al usuario que algo está pasando ahora, tiene que durar lo
  suficiente para leerse. Ojo con la interacción: `configurarBotonesUX` decide *si* el botón se
  muestra (`docs/alertas-y-bloqueo-diseno.md` §3), así que el piso va sobre el texto, nunca sobre
  la visibilidad — retrasar el ocultado dejaría un botón ofreciendo una acción que ya no existe.
- **El corte está diseñado**: dueño único (`popup/features/loader.js`), **tokens** en vez de
  bandera —nadie puede apagar el loader de otro porque no tiene cómo— y **dos tiempos**: ~150 ms
  de demora para aparecer (si termina antes, no aparece nunca) y 500 ms de mínimo visible. Una
  `transition` NO sirve: controla cómo se ve el cambio, no cuándo empieza.
- **El mínimo visible es por TEXTO, no por encendido** (2026-08-13). El nodo es uno y los textos
  varios; un cartel que dura 80 ms no se lee, y leerlo es todo el punto —el usuario deduce de ahí
  que algo pasa ahora y que lo que ve no es viejo—. El piso del primer texto **cuenta desde que
  el CSS lo pintó**, no desde que un flujo lo reclama, o el arranque paga la espera dos veces.
- **Lo que NO se toca: que el nodo nazca visible por CSS.** Es deliberado (evita ver la UI a medio
  estilar), y a cambio el diseño absorbe tres cosas — la demora de 150 ms no aplica al loader del
  arranque, el texto del markup tiene que ser el de la primera fase real, y el apagado inmediato
  para el onboarding (`popup.js:820`) no puede esperar el piso. Las tres, con su regla, en
  `docs/ramas-en-revision.md` §Lo que falta.
- **Ya se cerró la mitad de copy** (2026-08-13): `entrypoints/popup/index.html:12` decía "Leyendo
  la pestaña…" siendo que la primera fase es la conexión al servidor, así que la secuencia era
  **pestaña → servidor → pestaña**. Hoy dice "Conectando con el servidor Bun…". Es un cambio de
  texto, no del mecanismo: el ítem sigue abierto.
- **El riesgo a mirar**: los tiempos hacen que el loader viva más allá del `finally` que lo pidió,
  así que ninguna de las 4 salidas del escaneo puede asumir que apagar es inmediato.
- **CONSTRUIDO el 2026-08-13 — la mitad del tiempo, no la del dueño.** Entró
  `popup/features/pisoVisible.js` (+ 10 tests) y **los 12 call-sites crudos ya no existen**: la
  cortina se toca por `mostrarLoader`/`ocultarLoader` y el botón por `configurarBotonesUX`, que
  ahora es un embudo sobre `aplicarBotonesUX`. `serverConnection.js` recibe `ocultarLoader` por
  `ctx` en vez de escribir `nodos.loader` — era el único camino por el que el piso se salteaba
  sin querer. Los dos carteles del markup se siembran con `performance.now()`, así que el piso
  del arranque descuenta lo que el usuario ya esperó.
- **Lo que sigue abierto, y por eso el ítem no se cierra**: (1) **los tokens** — el piso ordena
  *cuándo* se pinta, pero `elEscaneoTomoElLoader` sigue vivo, así que dos dueños del mismo nodo
  se siguen coordinando a mano; (2) **la demora de ~150 ms para aparecer**, que es la otra mitad
  del par (el piso evita el destello de lo que ya salió; la demora evita que salga lo que no hace
  falta); (3) el módulo **no es dueño de ningún nodo** — nada impide escribir `nodos.loader` por
  atrás y saltearlo, que es exactamente lo que este ítem se llama.
- **Estado**: 🔴 abierto (la mitad del tiempo, construida y **sin verificar en Chrome**). Detalle
  completo → `docs/ramas-en-revision.md` §Lo que falta.

### 🔴 La línea de estado del footer es invisible

- **Dónde**: `entrypoints/popup/index.html` (el `<p id="ui-msg-status">`).
- **Qué pasa**: nace con `style="display:none"` inline y **nada en el repo se lo saca** — no hay un
  solo `txtEstado.style`, ni un `removeAttribute`, ni CSS con `!important` que lo pise (el único
  `!important` es `.status-text:empty`, que lo esconde *más*). Viene así desde la migración a WXT
  (`fd81f9a`, 2026-08-02), heredado del `popup.html` viejo.
- **Consecuencia**: ~20 mensajes son invisibles, entre ellos "no estás en un portal reconocido",
  "el escaneo no devolvió clases", "servidor Bun apagado" y **el texto de progreso de la
  descarga**. Fue lo que hizo que el error de inyección pareciera no avisar.
- **Observado en vivo el 2026-08-13**, de arrastre con la medición del loader: en el registro del
  banco aparece `estado  Analizando...` a las `11:06:37.321`, entre dos carteles del loader que sí
  se ven. El banco lee el DOM, no la pantalla — o sea que el mensaje se escribió, en el arranque
  normal, y nadie lo vio. Es la primera evidencia directa de este ítem y no hizo falta buscarla.
- **El arreglo es de una línea**; lo que falta es la pasada por navegador, porque destapa los ~20
  de golpe y hay que mirar el footer **descargando**, que es donde cambia de alto.
- **Ojo**: destaparlo no lo convierte en buen destino para un error. Ese lugar ya se descartó para
  el watchdog *aunque estuviera visible*, porque comparte el footer con el diagnóstico de conexión
  y queda pisado.
- **Estado**: 🔴 abierto. Detalle → `docs/alertas-y-bloqueo-diseno.md` §6.8b.

### 🟠 El banco de pruebas no alcanza al service worker

- **Dónde**: `verificacion/modoVerificacion.js`.
- **Qué pasa**: envuelve `fetch`, `chrome.tabs.query` y `chrome.runtime.sendMessage` **del
  popup**, así que puede forzar 9 de las 12 tarjetas (las otras 3 se alcanzan a mano). Lo que no
  puede es **una descarga en curso** —barra de progreso, telemetría, frenado suave, caja de
  cancelar—, porque eso lo produce el service worker bajando de verdad. Tampoco puede sembrar el
  historial de fallos de la campanita.
- **Qué haría falta**: contestar IPC de progreso falsos, que es otro mecanismo y no un switch más.
- **Estado**: 🟠 abierto. El inventario de qué se fuerza y cómo vive en la cabecera del módulo.

## 🔴 Seguridad

### XSS por interpolación sin escapar de título scrapeado

- **Dónde**: `popup.js:1012` y `popup.js:1019`, dentro de `renderizarListadoInterfaz()`.
- **Qué pasa**: `AppState.videoFalladoParaReintento` (que proviene de `SW_ESTADOS_PROGRESO.videoActual` en el service worker, que a su vez proviene del scraping del DOM de Ramón Net vía `sitio/ramonnet/scraper.js`) se interpola sin escapar dentro de un template string HTML:
  ```js
  descripcion: `...<strong>Pausado en:</strong> ${titulo}`
  ```
  Ese string se pasa a `Renderers.renderizarTarjetaEstado`, que lo asigna con `card.innerHTML = ...`.
- **Impacto**: si el título de una clase (contenido de un tercero, no controlado por esta extensión) contuviera markup malicioso (ej. `<img src=x onerror=...>`), se ejecutaría en el contexto del popup, que tiene permisos `downloads`, `scripting` y `storage`.
- **Por qué es inconsistente**: el resto del código ya resuelve esto correctamente — `renderers.js:74` y `renderers.js:124` usan `.innerText` para pintar `clase.titulo`. Este es el único punto donde se rompió el patrón.
- **Fix propuesto**: reemplazar la interpolación directa por nodos DOM con `.textContent`, o por una función de escape HTML aplicada al título antes de interpolarlo.
- **Estado**: ✅ resuelto (2026-07-16). Se agregó `Utils.escaparHtml` (`shared/utils.js`) y se aplica al título en `popup.js:renderizarListadoInterfaz` antes de interpolarlo. La descripción mantiene su HTML intencional (`<br>`/`<strong>`); solo el título de terceros va escapado. Ver sección Resuelto.

---

## 🟠 Mantenibilidad

### `popup.js` como "god file" (1710 líneas, un solo closure)

- **Dónde**: `popup.js`, completo.
- **Qué pasa**: prácticamente toda la lógica de UI vive dentro de un único listener `DOMContentLoaded`, con ~50 funciones anidadas que comparten variables de clausura (`nodos`, `filtrosActivos`, y flags sueltos como `verificandoConexionBoton` (`popup.js:171`) y `reintentandoColaActivo` (`popup.js:172`)).
- **Impacto concreto**:
  - No se puede testear ninguna función de forma aislada sin montar el DOM completo y disparar `DOMContentLoaded`.
  - Acoplamiento oculto: una variable de clausura mutada en una función puede afectar el comportamiento de otra función a 800+ líneas de distancia, sin que quede evidencia en el diff de un cambio puntual.
- **Fix propuesto**: ver `docs/ROADMAP.md` — reorganización feature-driven en módulos (`popup/features/*`), cargados como `<script>` adicionales en `popup.html`.
- **Estado**: ✅ resuelto al estado final (2026-07-19). Extraídos `popup/features/serverConnection.js` (apoyado en el daemon `shared/conexion.js`, que absorbió los flags de monitoreo `intervalReconexion`/`comprobacionEnProgreso` que antes vivían sueltos acá), `popup/features/queue.js` (ciclo de vida completo de la cola: mutaciones `encolarItemsEnCaliente`/`quitarItemsDeColaEnLote`, cancelación `solicitarFrenadoSuave`/`abortarRafagaInmediata`, arranque `iniciarDescargaCola` y reintento `ejecutarReintentoDeCola`, con tests), `popup/features/filters.js` (búsqueda + filtros por estado/materia/cátedra + popover; `filtrosActivos` se pasa POR REFERENCIA en `ctx`; unificó el predicado de filtrado de la Cola —antes triplicado— en `coincideConFiltrosCola`; con tests) y `popup/features/catedra.js` (badge + asistente/modal multicátedra + listener del badge; unificó el `detectarCatedras()` antes triplicado; con tests). Además, varias regiones de UI pasaron a **islas Preact** (onboarding, header de conexión, banner de caída, ruta de disco y la lista de clases — ver `docs/preact-migration.md`). Con `catedra.js` (el último cluster de bajo acoplamiento) cierra la **Fase 2**: lo que queda en `popup.js` (init + wiring + orquestación de render/worker IPC/scraping) es el estado final que ADR-0005 define como núcleo no-extraíble — `scraping` NO se extrae por decisión (alimenta ADR-0008). Ver sección Resuelto.

### `background.js` — listener IPC monolítico

- **Dónde**: `background.js:143-356`, `chrome.runtime.onMessage.addListener`.
- **Qué pasa**: mismo patrón que `popup.js` pero a menor escala — un único listener con un bloque `if (request.action === "...")` por cada una de las 8 acciones soportadas.
- **Impacto**: menor que en `popup.js` porque cada bloque es relativamente autocontenido, pero sigue siendo difícil de testear sin mockear `chrome.runtime.onMessage`.
- **Fix propuesto**: si se toca este archivo para otra tarea, extraer cada acción a una función nombrada en un dict `{accion: handler}` y despachar por lookup en vez de cadena de `if`.
- **Estado**: ✅ resuelto (2026-07-17). Las 8 acciones pasaron a métodos `async accion(request, sendResponse)` del objeto `manejadoresIPC`; el listener despacha por lookup (`manejadoresIPC[request.action]`), conservando el IIFE async + try/catch global + `return true`. Comportamiento idéntico. `background.js` → v5.7.0. Ver `docs/patterns.md` §IPC y sección Resuelto.

### Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`

- **Dónde**: `popup.js:1372-1374`.
- **Qué pasa**: define una función local que solo llama a `Utils.clasificarCatedraYCarpeta`. Los 5 call-sites reales (`popup.js:561`, `:831`, `:932`, `:1250`, `:1630`) llaman directo a `Utils.clasificarCatedraYCarpeta`, ignorando el wrapper.
- **Fix propuesto**: borrar `popup.js:1372-1374`.
- **Estado**: ✅ resuelto (2026-07-16). Wrapper eliminado; los 5 call-sites ya llamaban directo a `Utils.clasificarCatedraYCarpeta`. `popup.js` → v5.5.4. Ver sección Resuelto.

### Función muerta (¿o call-site faltante?): `marcarClaseComoPendiente`

- **Dónde**: `background.js:606`, `async function marcarClaseComoPendiente(listaCompleta, elementoActual)`.
- **Qué pasa**: la detectó el `no-unused-vars` de ESLint (2026-07-17). La función marca una clase como `'pending'` (en `listaPersistente`, `SW_ESTADOS_PROGRESO`) y la saca de `colaDescargas`, pero **no la llama nadie** — el único otro match textual es un comentario de changelog.
- **Impacto / ambigüedad**: hay que decidir cuál de dos es el caso real antes de tocar:
  - (a) **Código muerto** → borrarla.
  - (b) **Call-site faltante (bug latente)** → por el nombre y la firma (`elementoActual`), parece pensada para cuando una descarga falla a mitad de ráfaga y la clase debería volver a `'pending'` en vez de quedar en `'process'`. Si ese caso hoy no resetea la clase, hay un hueco funcional, no sólo código muerto.
- **Nota**: la consolidación de escritura atómica de v5.6.3 tocó esta función; el cambio sigue siendo correcto, pero resultó estar sobre código sin uso.
- **Estado**: ✅ resuelto (2026-07-17) — confirmado caso (a): la lógica de "remover de la cola + volver a 'pending'" ya vive inline en el handler `remover_item_de_cola` (`background.js`), y `git log -S` mostró que la función no tenía call-sites desde el commit inicial del repo (importado en v13, ya desconectada). Función eliminada. `background.js` → v5.6.4. Ver sección Resuelto.

### `styles/components.css` (1261 líneas en un solo archivo)

- **Dónde**: `styles/components.css`.
- **Impacto**: bajo — no es un problema funcional, solo dificulta ubicar reglas específicas a medida que crece.
- **Fix propuesto**: dividir por componente (`components/onboarding.css`, `components/queue.css`, etc.) si el archivo sigue creciendo. No urgente.
- **Estado**: ✅ resuelto (2026-07-17). `styles/components.css` se partió en 13 archivos `styles/components/*.css` (header, path-bar, tabs, filters, turbo-switch, footer, actions, loader, multicatedra, downloads-active, advertencia, onboarding, help-button). El `@import` de `popup/globals.css` replica el orden original para no alterar la cascada; `popup.html` no cambió. Verificado con paridad de bloques `{` (165 = 165). Ver sección Resuelto.

---

## 🟡 Testing

### Cobertura de tests: parcial

- **Qué pasa**: ya hay `package.json` + Vitest/jsdom, con una suite real (el conteo exacto y la narrativa de cobertura, en `docs/testing.md` — hogar canónico; acá no se repiten). Cubiertos: `shared/utils.js` (funciones puras), `shared/conexion.js` (daemon de conexión), `core/backend/bunClient.ts` (cliente del backend), `core/puertos/almacenamientoEnMemoria.ts` y `core/historial/historialFallos.ts` (ya sin mocks de `chrome.*`: usan el adaptador en memoria del puerto), el adaptador de sitio (`sitio/ramonnet/parserTitulos.js`, `resolverManifiesto.js`), las features/islas del popup extraídas — `popup/features/serverConnection.js`, `queue.js`, `filters.js`, `faceta.js`, y las islas Preact `conexionHeader`/`onboarding`/`rutaDisco`/`bannerConexion`/`listaClases`/`campanita` —, `background/hlsEngine.js` tanto sus funciones puras (parseo/resolución M3U8) como el **pool de 6 workers** `compilarTranscodificacionStream` (concurrencia/AES/turbo-blob/aborts en cascada + el path 4xx del bug 400) y los handlers IPC de `background.js` (harness con `chrome.*` mockeado). Sigue sin cobertura unitaria: el núcleo de `popup.js` que por diseño queda en el closure y el bucle `procesarSiguienteElementoDeLaCola` + auto-heal del SW.
- **Impacto**: la lógica pura, el daemon, el cliente del backend, las features/islas, el parseo M3U8, el pool de descarga y los handlers IPC tienen red de regresión; sólo la orquestación restante de UI y el bucle/auto-heal del SW dependen de pruebas manuales.
- **Fix propuesto**: ver `docs/ROADMAP.md`. El núcleo de `popup.js` (init + wiring + scraping/render) queda como orquestación no-extraíble por ADR-0005 → verificación manual/e2e; el bucle del SW se cubriría al re-arquitecturar el motor sobre puertos (ADR-0008/Fase 6).
- **Estado**: 🟢 cubierto lo abordable en JS (2026-07-19) — utils, conexión, bunClient, serverConnection, queue, filters, catedra, las 5 islas Preact, hlsEngine (funciones puras + pool `compilarTranscodificacionStream`) y los handlers IPC de background. Lo pendiente (núcleo de `popup.js`, bucle/auto-heal del SW) es manual/e2e por diseño hasta la re-arquitectura de Fase 6.

### `tsc --noEmit` typechequeaba sólo `core/` (agujero silencioso en una de las 4 compuertas)

- **Dónde**: `tsconfig.json`, el campo `include`.
- **Qué pasaba**: la lista era `[".wxt/**/*", "wxt.config.ts", "entrypoints/**/*", "core/**/*"]`. Como `allowJs` está en `false` y los dos entrypoints son `.js`, `tsc` los salteaba y con ellos todo el grafo de imports, así que `shared/` y `plataforma/` **nunca entraban**. `npx tsc --noEmit --listFiles` lo confirmó: 11 archivos del repo, todos de `core/`.
- **Impacto**: desde la Fase 5b, `shared/state.ts`, `shared/conexion.ts`, `plataforma/chrome/almacenamiento.ts`, `plataforma/chrome/mensajeria.ts` y `plataforma/composicion.ts` —justo lo recién migrado— pasaban la compuerta sin que nadie los mirara. La compuerta daba verde igual, que es lo peor de este tipo de agujero: no se nota. Lint sí los cubría (ESLint no depende de `include`), así que el hueco era el typecheck, no el análisis estático entero.
- **Fix aplicado**: sumar `"shared/**/*"` y `"plataforma/**/*"` al `include`, más un comentario en el archivo explicando que la cobertura **no** es automática y que cada carpeta nueva con `.ts` hay que listarla. Salió limpio sin tocar una línea de código de producción: 11 → 18 archivos typechequeados, 0 errores.
- **Estado**: ✅ resuelto (2026-08-03). Al agregar `.ts` bajo una raíz nueva (ej. `core/hls/` si cuelga de otro lado en la Fase 6), verificar con `pnpm exec tsc --noEmit --listFiles` que efectivamente entró.

---

## 🔴 Robustez del flujo de datos

### Loop infinito pausa/autoheal ante rechazo 4xx del backend

- **Dónde**: cadena entre el cliente del backend (entonces `shared/bunClient.js:117-119`, hoy `core/backend/bunClient.ts`), `background/hlsEngine.js:225`/`:255` y `background.js:632-642`.
- **Qué pasa** (detectado en logs reales, 2026-07-18): cuando el backend Bun responde HTTP **4xx** a un fragmento (`POST /api/bypass-stream` → 400, rechazo aplicativo con el server **vivo**), el sistema lo confunde con una caída de servidor y entra en loop. Cadena causal:
  1. `bunClient.js:117-119` lanza un `Error` cuyo status **solo vive en el string del mensaje** (`El backend de Bun rechazó el fragmento con código: ${res.status}`) — nadie aguas arriba puede distinguir un 400 determinístico de un 503 transitorio sin parsear texto.
  2. El worker (`hlsEngine.js:255`) lo trata como fallo de fragmento y aborta el `controladorGraficoActivo` → la clase entera falla.
  3. El catch de `background.js:632-642` clasifica con el daemon: `Conexion.verificarAhora()` sondea `/api/health` → **200** (server vivo) → `tipoFalla=null` → cae a la heurística por mensaje, que como el string contiene "Bun" clasifica **"servidor"** → `pausarColaPorErrorDeConexion` crea `alarma_autoheal`.
  4. El autoheal despierta, ve `/api/health` 200, reanuda la cola → el mismo fragmento vuelve a dar 400 → **loop infinito**. El usuario no puede avanzar salvo cancelar a mano.
- **Impacto**: una sola clase con un fragmento que el backend rechaza congela **toda** la cola indefinidamente. Rompe el caso de uso principal (descarga masiva).
- **Fix propuesto** (acordado): un 4xx es determinístico — reintentar el mismo fragmento no lo cura y no es una caída de conexión. Reintentar N=3 con backoff corto y, si persiste, **saltar solo esa clase avisando cuál falló**, siguiendo con la próxima (sin pausar, sin autoheal). El 5xx mantiene el comportamiento actual (pausa+autoheal: puede ser hipo transitorio del server). Implementación:
  - `bunClient.js`: tipar el error 4xx (`err.tipoBackend="rechazo"` + `err.httpStatus`), como ya se hace con `err.tipoConexion="sesion"`.
  - Reintento N en el worker (`hlsEngine.js:225`, envolviendo `enviarFragmentoStream`); agotado, propagar el error tipado.
  - `background.js` (catch `:598-644`): rama **antes** del daemon (como el caso `"sesion"` en `:623`) → marcar la clase `'error'`, sacarla de la cola con un `.set()` atómico (patrón del path de éxito `:584-588`), emitir `clase_con_error` con `titulo`+motivo, y `procesarSiguienteElementoDeLaCola()`.
  - Popup: el handler `clase_con_error` (`popup.js:1170-1178`) **ya existe pero nadie lo emite** y muestra texto genérico sin nombrar la clase — mejorarlo para nombrar `req.titulo`+motivo y limpiar la cola local (espejando `clase_guardada_ok` `:1156-1167`).
- **Estado**: ✅ resuelto (2026-07-19). Implementado el fix acordado en 4 puntos: (1) `bunClient.js` v1.4.0 tipa el rechazo 4xx (`err.tipoBackend="rechazo"` + `err.httpStatus`; el 5xx NO se tipa → conserva pausa+autoheal); (2) `hlsEngine.js` v1.0.6 envuelve el envío del fragmento en un reintento N=3 con backoff corto SÓLO para ese error tipado y, agotado, propaga el error intacto; (3) `background.js` v5.9.0 clasifica el rechazo ANTES del daemon (igual que `"sesion"`): marca la clase `'error'`, la saca de la cola con un `.set()` atómico de las 3 claves, emite `clase_con_error` {titulo, motivo} y sigue con la próxima (sin pausa, sin alarma); (4) `popup.js` v5.13.0 mejora el handler `clase_con_error` (antes muerto y genérico) para nombrar la clase saltada + motivo (título vía `textContent`, regla anti-XSS) y limpiar la cola local, espejando `clase_guardada_ok`. Cobertura nueva: `shared/bunClient.test.js` (4xx tipa / 5xx no) y `background/hlsEngine.test.js` (worker reintenta 3× ante 4xx y propaga tipado; un no-rechazo no se reintenta). **Refinamiento posterior** (`background.js` v5.10.1 / `popup.js` v5.15.0): la clase saltada vuelve a `'pending'` en vez de a un estado `'error'` — ese estado no lo reconocía el resto del popup (rompía el render del badge y bloqueaba el re-encolado), y el fallo ahora se comunica por la campanita + notificación nativa (ver `docs/notificaciones-fallos-diseno.md`). Ver sección Resuelto y `docs/patterns.md` §Circuit breaker.

---

## 🟡 Robustez del flujo de datos

### Optimistic update sin rollback en `encolarItemsEnCaliente`

- **Dónde**: `encolarItemsEnCaliente` en `popup.js:785` (el `sendMessage` sin verificar, en `popup.js:815`).
- **Qué pasa**: la función actualiza `AppState.colaDescargas` y el DOM de inmediato (patrón optimistic update), y recién después dispara `chrome.runtime.sendMessage({ action: "inyectar_items_en_cola_activa", ... })` sin `.then`/`.catch` ni verificar la respuesta.
- **Impacto**: si el mensaje falla (SW dormido, error de storage), la UI queda mostrando ítems como "en cola" que en realidad nunca se persistieron en `background.js`, generando un estado inconsistente entre popup y service worker hasta el próximo `sincronizarConBackground()`.
- **Fix propuesto**: verificar la respuesta de `sendMessage` (usar el patrón callback/promise con manejo de `chrome.runtime.lastError` que ya usan en otras partes del código, ej. `state.js:66-68`) y revertir `AppState.colaDescargas` + re-render si falla.
- **Estado**: ✅ resuelto (2026-07-17). `encolarItemsEnCaliente` ahora pasa un callback al `sendMessage`; ante `chrome.runtime.lastError` o `status != "encolados_ok"` revierte la cola (filtrando por `id`, robusto ante encolados intermedios), restaura `estado`/`seleccionado` de los ítems y re-renderiza. El handler del SW ya respondía `{ status: "encolados_ok" }` en éxito y su `catch` global solo loguea (cierra el canal → `lastError`), por lo que ambos modos de fallo caen en el rollback. `popup.js` → v5.7.1. Ver sección Resuelto.

### Escrituras no-atómicas a `chrome.storage.local`

- **Dónde**: varios puntos de `background.js` que leen y escriben `listaPersistente`, `colaDescargas` y `SW_ESTADOS_PROGRESO` como operaciones `.get()`/`.set()` separadas para el mismo cambio lógico.
- **Qué pasa**: `chrome.storage.local` no ofrece transacciones — si el service worker se suspende o falla entre un `.set()` y el siguiente, esas claves relacionadas pueden quedar desincronizadas entre sí.
- **Impacto**: riesgo de estado inconsistente (ej. un ítem marcado `process` en `SW_ESTADOS_PROGRESO` pero ya removido de `colaDescargas`). Bajo en la práctica porque el SW suele completar estas operaciones síncronamente dentro del mismo tick, pero no está garantizado.
- **Fix propuesto**: auditar y consolidar en un único `.set({...})` por operación lógica cuando se tocan varias claves relacionadas. El patrón correcto ya existe en `background.js:216-239` (`inyectar_items_en_cola_activa`: un `.get()` de las tres claves seguido de un único `.set({...})`) — usarlo como referencia para homogeneizar el resto.
- **Estado**: ✅ resuelto (2026-07-17). Auditados los 13 `.get()/.set()` de `background.js`; los 3 puntos que escribían las tres claves relacionadas en dos `.set()` separados (`persistirEstadoFondo()` + un `.set()` de `listaPersistente`/`colaDescargas`) se consolidaron en un único `.set({...})` de las tres: fin de descarga exitosa (`clase_guardada_ok`), `marcarClaseComoPendiente`, y `abortar_rafaga_inmediata`. Los `persistirEstadoFondo()` que escriben SÓLO `SW_ESTADOS_PROGRESO` (marcar 'process' al arrancar, reset a `{}` en cola vacía) se dejaron como están — no son multi-clave. `background.js` → v5.6.3. Ver sección Resuelto.

---

## 🟢 Menores / de proceso

| Ítem | Ubicación | Impacto | Estado |
|---|---|---|---|
| Sin linter (ESLint) configurado | proyecto completo | No se detectan variables no usadas, `==` vs `===`, código muerto adicional | ✅ resuelto (2026-07-17) — `eslint.config.js` + `npm run lint`; 0 errores, 11 warnings iniciales |
| `catch (e) {}` silenciosos (3 casos) | `background.js:147`, `background.js:325` y `background/hlsEngine.js:219` (los dos últimos, `abort()` del controlador de gráfico activo) | Dificulta debug si falla el abort/limpieza de recursos | ✅ resuelto (2026-07-17) — ahora `console.warn` con contexto |
| URL de backend hardcodeada | entonces `shared/bunClient.js` (`baseUrl`), hoy `core/backend/bunClient.ts` | No se puede apuntar a otro host/puerto sin editar código; relevante si se agregan tests de integración contra el backend real | ✅ resuelto (2026-07-17) — hook liviano: `configurarBaseUrl(url)` + global `RAMONNET_BUN_BASE_URL`; default intacto. `bunClient.js` → v1.3.0 |

---

## Resuelto

- **Los 6 warnings de lint, y el puntero colgado que los daba por anotados** (2026-08-03). `docs/testing.md` decía que los 6 warnings eran "deuda conocida (ver `docs/TECHNICAL_DEBT.md`)", pero acá nunca hubo un ítem abierto para ellos: la única mención vivía adentro de una fila ✅ resuelta que hablaba de "11 warnings iniciales". El link no llevaba a ningún lado, y de paso el contenido resultó trivial — 4 `catch (e)` con el binding sin usar (`background.js` ×2, `shared/conexion.ts` ×2) y 2 argumentos sin usar (`background.js` `details`, `popup.js` `filtDisp`). Fix: `catch {}` (optional catch binding) en los cuatro y prefijo `_` en los dos, que es lo que ya permitía `eslint.config.js`. Sin cambio de comportamiento y sin bump de versión de archivo por eso mismo. **El baseline de lint pasa a 0 errores / 0 warnings**: desde ahora un warning nuevo también es una regresión (`docs/testing.md` §Baseline).
- **Deuda de verificación: las Fases 1-5a nunca se habían abierto en Chrome** (2026-08-02). La re-arquitectura (puertos y adaptadores + TypeScript + WXT) se había mergeado a `main` con la suite, el lint, el `tsc` y el `build` en verde en cada corte, pero sin haber cargado nunca la extensión compilada en el navegador — decisión explícita del dueño del repo, tomada con la recomendación contraria sobre la mesa. El riesgo concreto era que las cuatro verificaciones automáticas no cubren nada del empaquetado: orden de carga de los globals en los entrypoints, rutas del `public/` copiado, generación del manifest, carga del ruleset dNR. Corrido el checklist de `docs/rearquitectura-diseno.md` §Verificación pendiente en navegador sobre `.output/chrome-mv3/`, **el dueño del repo reportó que funciona**. Con eso la Fase 5b arranca sobre una base verificada, que era la condición que faltaba.
- **Sondeo de red ad-hoc en `queue.js` (duplicaba al daemon `Conexion`)** (2026-08-02). `verificarRedAntesDeDescargar()` hacía su propio `fetch(HEAD)` + `AbortController` de 4s contra el portal antes de arrancar/reanudar la cola — exactamente lo que ya hace `Conexion._chequearInternet()` cada 3s, violando la regla operativa de `docs/patterns.md` §Daemon de estado de conexión. Costo real: dos fuentes de verdad sobre "hay internet" que pueden discrepar, y 4s de latencia extra al arrancar cada ráfaga sobre información que el daemon ya tiene fresca. Fix (`queue.js` v1.3.0): el cuerpo pasa a `await Conexion.verificarAhora()` + leer `.internet`. Se eligió `verificarAhora()` sobre `get()` para conservar la semántica de sondeo fresco al arrancar (con `get()` se leería estado de hasta 3s de antigüedad, que es otro cambio distinto); y el gate sigue mirando **sólo** `.internet` aunque el snapshot ahora traiga también el servidor, para no convertir un fix de acoplamiento en un cambio de producto — la caída de servidor ya tiene su propio camino (banner + daemon). Tests: `queue.test.js` stubea el daemon en vez de `fetch` y deja `fetch` armado para explotar, de modo que un futuro sondeo propio falle el test en vez de pegarle a la red; se sumó el caso "servidor caído + internet OK ⇒ arranca igual" que fija el gate. Suite 187 → 188, lint 9 → 8 warnings. Verificado en navegador antes de mergear. **Nota**: una versión anterior de esta entrada afirmaba además que el `if (!navigator.onLine)` de la función era un bug que dejaba arrancar durante un corte de WAN. Era falso y se corrigió antes de implementar: `onLine === false` es confiable (lo dudoso es el `true`), la guarda sólo cortaba ese caso, y un corte de WAN lo detectaba igual el `fetch` de abajo — el daemon hace lo mismo en `conexion.js:97`. El motivo del cambio fue sólo la duplicación.
- **Loop infinito pausa/autoheal ante rechazo 4xx del backend** (2026-07-19). Un HTTP 4xx del backend Bun a un fragmento (`POST /api/bypass-stream` → 400) se confundía con una caída de servidor: el status vivía sólo en el string del mensaje, el daemon veía `/api/health` 200 (server vivo) → la heurística por mensaje clasificaba `"servidor"` → pausa+autoheal → el autoheal reanudaba → mismo 400 → loop que congelaba toda la cola. Fix en 4 puntos: `bunClient.js` v1.4.0 tipa el 4xx (`err.tipoBackend="rechazo"`+`httpStatus`; el 5xx no, conserva pausa+autoheal); el worker de `hlsEngine.js` v1.0.6 reintenta el envío N=3 sólo ante ese tipo y propaga el error intacto al agotarse; `background.js` v5.9.0 lo clasifica ANTES del daemon (como `"sesion"`) → marca la clase `'error'`, la saca de la cola con `.set()` atómico de las 3 claves, emite `clase_con_error` y sigue con la próxima (sin alarma); `popup.js` v5.13.0 mejora el handler `clase_con_error` (antes muerto/genérico) para nombrar la clase saltada + motivo (`textContent`, anti-XSS) y limpiar la cola local. Un 4xx es determinístico: saltar la clase avisando es lo correcto; el 5xx/red mantiene pausa+autoheal. Tests nuevos en `bunClient.test.js` y `hlsEngine.test.js` (135 → 139). Ver `docs/patterns.md` §Circuit breaker.
- **Listener IPC monolítico en `background.js`** (2026-07-17). La cadena de 8 `if (request.action === …)` pasó a un diccionario `manejadoresIPC {accion: async handler(request, sendResponse)}` despachado por lookup; el listener conserva el IIFE async + try/catch global + `return true` síncrono. Sin cambio de comportamiento (los handlers siguen mutando `loopActivo`/`controladorGraficoActivo` por closure). `background.js` → v5.7.0.
- **`styles/components.css` monolítico (1261 líneas)** (2026-07-17). Partido en 13 archivos por componente en `styles/components/*.css`; `popup/globals.css` los reimporta en el orden original (cascada intacta) y `popup.html` no se tocó (sólo linkea `globals.css`). Verificado: paridad de bloques `{` 165 = 165.
- **Función muerta `marcarClaseComoPendiente`** (2026-07-17). La destapó `no-unused-vars` de ESLint. Confirmado código muerto: su lógica ("sacar de la cola + volver la clase a 'pending'") ya está inline en el handler `remover_item_de_cola`, y `git log -S "marcarClaseComoPendiente("` mostró que no tenía call-sites desde el commit inicial del repo (importado en v13, ya desconectada de fábrica). Eliminada. `background.js` → v5.6.4. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance actual — ver Testing.)
- **Escrituras no-atómicas a `chrome.storage.local`** (2026-07-17). Los 3 puntos de `background.js` que tocaban `listaPersistente` + `colaDescargas` + `SW_ESTADOS_PROGRESO` para un mismo cambio lógico usaban dos `.set()` separados (uno vía `persistirEstadoFondo()`), dejando una ventana donde una suspensión del SW podía desincronizarlas. Consolidados en un único `.set({...})` de las tres claves (fin de descarga, `marcarClaseComoPendiente`, `abortar_rafaga_inmediata`), siguiendo el patrón de `inyectar_items_en_cola_activa`. `background.js` → v5.6.3. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance actual — ver Testing.)
- **Optimistic update sin rollback en `encolarItemsEnCaliente`** (2026-07-17). La función actualizaba `AppState.colaDescargas` + DOM + estado `'process'` y disparaba `inyectar_items_en_cola_activa` sin verificar la respuesta; si el SW no confirmaba (dormido, error de storage), la UI quedaba mostrando ítems "en cola" nunca persistidos en `background.js`. Fix: el `sendMessage` ahora tiene callback que, ante `chrome.runtime.lastError` o `status != "encolados_ok"`, revierte la cola (por `id`), restaura `estado`/`seleccionado` de los ítems y re-renderiza. `popup.js` → v5.7.1. (Sin test unitario: `popup.js` sigue bloqueado por el split de Fase 2 — ver Testing.)
- **`catch (e) {}` silenciosos (3 casos)** (2026-07-17). Los tres catch vacíos ahora dejan rastro con `console.warn` + contexto: el cierre del documento offscreen (`background.js`, puede fallar de forma esperada si no había documento abierto) y los dos `abort()` de limpieza del controlador de gráfico activo (`background.js` en el fin de ráfaga, `hlsEngine.js` ante fallo de fragmento — un fallo del abort acá es inesperado y ahora es visible). `background.js` → v5.6.2, `hlsEngine.js` → v1.0.1. (Sin test unitario: ambos dependen de `chrome.*`/estado del SW, fuera del alcance de testing actual — ver Testing.)
- **El banner de "descarga interrumpida" no se iba al reconectar el servidor (hasta refrescar el popup)** (2026-07-16). Al volver el server, `reaccionarAConexion` → `onReintentarCola` → `ejecutarReintentoDeCola` ponía `AppState.fallaConexionActiva = null` sin re-renderizar. La única limpieza real del banner vive en el handler `update_progress_bar`, pero (a) su rama de limpieza está gateada a `if (AppState.fallaConexionActiva)` — ya en null — y (b) su re-render está gateado a que cambie el título, que no cambia porque se reanuda el mismo video. La descarga avanzaba en el SW pero el popup quedaba pegado en el banner. Fix: `ejecutarReintentoDeCola` restaura el panel de descarga (`cancelBox`/`progressCont`) y llama `renderizarListadoInterfaz()` al reanudar. `popup.js` → v5.5.6. Nota relacionada: `reanudarColaDesdeBackground` (autoheal del SW) reanuda sin avisar al popup — la limpieza del banner depende de la ruta del popup o del primer `update_progress_bar`.
- **El banner de "descarga interrumpida" no se disparaba al caer el servidor durante una descarga** (2026-07-16). La clasificación de fin de descarga en `background.js` (~línea 534) tomaba `controladorGraficoActivo.signal.aborted` y `errDescarga.name==='AbortError'` como señales de cancelación del usuario. Pero el motor HLS aborta ese controlador A PROPÓSITO para frenar a los otros workers cuando un fragmento falla (server caído), y ese abort hace que los fetches hermanos rechacen con `AbortError`. Resultado: la caída se confundía con cancelación, el SW retornaba sin pausar la cola, y nunca enviaba `cola_pausada_por_error` → el popup no mostraba el banner. Fix: la clasificación usa SÓLO el flag explícito `state.abortadoPorUsuario`. `background.js` → v5.6.1. (Sin test unitario: `background.js` depende de `chrome.*`, fuera del alcance de testing actual — ver Testing.)
- **Indicador verde para siempre si el servidor cae durante una descarga** (2026-07-16). Dos capas: (1) `enviarFragmentoStream` (`bunClient.js`) no tenía timeout, así que al morir el Bun a mitad de descarga el POST a `/api/bypass-stream` se colgaba, el loop del SW nunca fallaba y nunca pausaba la cola ni marcaba la caída; (2) aun detectándola, el popup ignora al daemon durante una ráfaga (`reaccionarAConexion` abortaba en la guarda `ráfagaEnCurso`), dejando el puntito verde. Fix: timeout de 30s en `enviarFragmentoStream` que lanza un Error de "backend" (NO `AbortError` — el SW lo trata como cancelación de usuario) para que la cola se pause; y `pintarStatusDot` se movió ANTES de la guarda para que el indicador refleje la conexión SIEMPRE (level-triggered), sin tocar el banner/lista durante la descarga. `bunClient.js` → v1.2.0, `serverConnection.js` → v1.5.0. Tests nuevos en `bunClient.test.js` (timeout ≠ AbortError; abort de usuario se propaga) y `serverConnection.test.js` (puntito refleja la caída durante ráfaga).
- **Falso positivo del daemon de conexión: "dice conectado estando apagado"** (2026-07-16). Con el servidor Bun apagado, `localhost:3001` no rechaza al instante (Windows deja la conexión colgada). `BunClient.obtenerRutaServidor` hacía un `fetch` a `/api/health` **sin timeout**, así que `Conexion.verificarAhora()` (que lo espera en un `Promise.all`) nunca resolvía y el estado quedaba congelado en el último valor conocido ("conectado"). Fix: `AbortController`+timeout + `cache:"no-store"` en `obtenerRutaServidor` (mismo patrón que el chequeo de internet), y el daemon lo llama con timeout 2500ms < intervalo de sondeo (3000ms) para que los polls no se apilen. Se agregó `module.exports` a `bunClient.js` y `shared/bunClient.test.js` (regresión: un fetch colgado aborta). `bunClient.js` → v1.1.0, `conexion.js` → v1.0.1.
- **Código muerto: wrapper `clasificarCatedraYCarpeta` en `popup.js`** (2026-07-16). Borrado el wrapper local que solo reenviaba a `Utils.clasificarCatedraYCarpeta`; los 5 call-sites reales ya usaban `Utils.*` directo. Sin cambios de comportamiento (62/62 tests en verde). `popup.js` → v5.5.4.
- **XSS por interpolación sin escapar de título scrapeado** (2026-07-16). Nuevo helper `Utils.escaparHtml` en `shared/utils.js`; aplicado en `popup.js:renderizarListadoInterfaz` a `videoFalladoParaReintento` antes de interpolarlo en la tarjeta de error. `utils.js` → v5.7.0, `popup.js` → v5.4.2.
