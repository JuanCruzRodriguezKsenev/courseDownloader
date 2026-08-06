# Multi-sitio: una extensión, varios portales — diseño de ejecución

**Estado (2026-08-06)**: cortes 1 a 6d y 8 hechos — o sea **todos menos el 7**, que está
bloqueado porque no existe el segundo portal. **Verificados en navegador el 2026-08-06**, en una
sola pasada sobre la punta del stack; la excepción es el **6c, que no se puede verificar** hasta
que haya un segundo portal. **Falta mergear**: el stack sigue entero fuera de `main`. → **Empezá por §Cómo retomar esto en una sesión
nueva, al final del doc**: ahí está el stack de ramas, qué probar en Chrome y las dos trampas
vivas (la migración del 6b y que ADR-0011 está aceptada pero **sin construir**).
**Decisión de base**: [ADR-0009](adr/0009-registro-de-sitios-en-runtime.md) eligió *registro en
runtime* sobre *una build por portal*, [ADR-0010](adr/0010-el-sitio-es-del-item.md) resuelve
el punto que la 0009 no vio, y [ADR-0011](adr/0011-el-orden-de-la-cola-lo-decide-el-popup.md)
decide quién manda sobre el orden de la cola. Este doc es el **cómo**, igual que
`rearquitectura-diseno.md` es el cómo de ADR-0008.

> **Objetivo**: que la MISMA extensión instalada maneje N portales. La UI no cambia — está
> pulida y es genérica; lo que se suma por portal es el adaptador de Capa 2 (scraper, parser,
> resolución del manifiesto, descriptor).

---

## Lo que ya está resuelto, y conviene saber antes de empezar

Esto no arranca de cero: la re-arquitectura (fases 0–8a, cerrada el 2026-08-04) dejó el trabajo
pesado hecho. **Medido, no supuesto**:

| Capa | ¿Hay que tocarla para multi-sitio? |
|---|---|
| UI (features + las 6 islas Preact) | **No.** Los únicos miembros del sitio que lee son `faceta`, `nombre` y `urlListado`, todos del descriptor |
| `core/` | **Casi no**: sólo `procesadorCola` y el daemon de conexión, por lo de abajo |
| `plataforma/` | **No** |
| `sitio/<portal>/` | Es lo que se escribe por portal — el trabajo esperado |

`PuertoSitio` (`core/puertos/sitio.ts`) ya es un contrato de 12 miembros que `tsc` hace cumplir:
un adaptador incompleto **no compila**. Esa es la red de este proyecto.

## El problema real: el sitio es un singleton, y tiene que ser un dato

Hoy `SitioActivo` se inyecta **una vez, en la composición**, y todos lo tratan como "el sitio".
Con N portales el sitio deja de ser una propiedad de la *build* y pasa a ser una propiedad de
**cada clase y cada descarga**.

Y hay una asimetría que decide casi todo el diseño:

- **La lista de "Disponibles" es de un solo portal**: se reemplaza en cada escaneo.
- **La cola NO.** Está desacoplada a propósito (`docs/data-model.md`: sobrevive a cambios de
  materia y de pestaña) — o sea que **puede contener clases de dos portales a la vez**.

De ahí salen los puntos de acoplamiento reales. **Son cinco, y el quinto llegó tarde**: los
cuatro primeros son los de la medición original (2026-08-04); el §5 apareció el 2026-08-05
revisando la deuda, porque aquel barrido cubrió el bucle de descarga y la UI pero **no los
listeners sueltos del service worker**. Vale como advertencia sobre el alcance de la medición,
no sólo como ítem.

### 1. `procesadorCola` recibe un sitio fijo

`core/cola/procesadorCola.ts` recibe `sitio` como colaborador y lo usa para
`resolverManifiesto()` y para el copy de la pausa (`sitio.nombre`). Con la cola mezclada eso
resuelve el manifiesto **con el adaptador del portal equivocado**, y el fallo se ve como "no
encontré el video", que es indistinguible de un cambio de markup del portal.

**Cambio**: el colaborador pasa de un sitio a un **resolvedor**:

```ts
// antes
sitio: { resolverManifiesto(...), nombre: string }
// después
sitios: { obtener(sitioId: string): PuertoSitio }
```

y el bucle hace `sitios.obtener(item.sitioId)` por ítem. Es un cambio de contrato de Capa 1, con
sus 12 tests de caracterización de red.

### 2. `Clase` y `ColaItem` no dicen de dónde vienen

Hay que sumarles `sitioId: string`. Es cambio de esquema de storage → `docs/data-model.md` en el
mismo PR, y **necesita migración**: una instalación existente tiene ítems sin el campo.

**Migración**: `sitioId` ausente ⇒ `"ramonnet"`. Es correcto por construcción (hasta hoy no
había otro portal) y evita tocar los datos del usuario. Mismo criterio que la migración
`catedraElegida` → `facetaElegida` de la Fase 5c.

### 3. `faceta.leerDeCola` re-deriva con el parser del sitio equivocado

Este es el más silencioso de los cinco. `ColaItem` **no lleva** el valor de la faceta: el
descriptor lo re-deriva con `clasificarCarpeta(titulo, carpeta)`, que es **específica del
portal**. Con la cola mezclada, la fila de un portal se clasifica con el parser del otro — y
como el parser devuelve algo (no tira), el filtro simplemente muestra mal sin avisar.

**Cambio** (hecho en el corte 4): `leerDeCola` se resuelve contra
`sitios.obtener(item.sitioId)?.faceta`, no contra "la" faceta. El bug desaparece **sin** decidir
nada de UX.

Un detalle que apareció al implementarlo: el resolvedor-con-migración dejó de armarse en el
sitio de uso y pasó a ser un **export compartido** de `plataforma/composicion.ts`, que consumen
el service worker *y* el popup. Si cada uno resolviera por su cuenta, podrían divergir — y la
forma que tomaría esa divergencia es fea: un ítem descargado con un portal y mostrado
clasificado con otro.

### 4. El daemon de conexión sondea un solo origen

`Conexion` recibe `urlSondeoInternet` en la composición. La sonda es a propósito el portal
objetivo y no un genérico ("lo que importa no es tener red, sino llegar A ESTE portal" — ver el
puerto). Con N portales, "hay internet" pasa a ser "llego a *cuál*".

**Recomendación**: no sobre-diseñar. El daemon sigue con **una** sonda —la del portal del ítem
en descarga, y en el popup la de la pestaña activa—; si a futuro hace falta estado por portal,
eso es un rediseño del daemon y merece su propio corte.

### 5. El click en la notificación de fallo enfoca la pestaña del portal asumido

Hallado el 2026-08-05, revisando la deuda tras el corte 4 — **no estaba en la medición
original**, que barrió el bucle de descarga y la UI pero no los listeners sueltos del SW.

`background.js:474-490` (listener de `chrome.notifications.onClicked`) resuelve qué pestaña
enfocar con el `sitio` que le inyecta el entrypoint, y ese `sitio` es `sitioAsumido`
(`entrypoints/background.js:48`) — el andamio del corte 2:

```js
const [tab] = await chrome.tabs.query({ url: sitio.patronPestañas });
...
await chrome.tabs.create({ url: sitio.urlSondeoInternet });
```

**Es el mismo defecto que el corte 4**, con dos diferencias que lo hacen peor: está en el
service worker (que por diseño no tiene pestaña de la cual deducir nada) y **le llega al
usuario**. Con la cola mezclada, la notificación de una clase del portal B enfoca —o peor,
*abre*— la pestaña del portal A. El follow-up accionable que la notificación promete lleva
al lugar equivocado.

**El dato para arreglarlo ya existe**: el fallo que dispara la notificación sale de un ítem, y
desde el corte 1 el ítem lleva `sitioId`. Es resolver con `sitios.obtener(id)` igual que el
bucle, usando el mismo export compartido de la composición que el corte 4 dejó — si el bucle y
la notificación resolvieran distinto, volvemos a la divergencia del punto 3. Va como **corte 8**.

**✅ Resuelto el 2026-08-05, y el cómo tiene una decisión que no era obvia.** El `sitioId` viaja
**adentro del `notificationId`** (`fallo|<sitioId>|<único>`), no en un `Map` en memoria del SW.
La razón es el ciclo de vida de MV3: el worker se suspende y se lleva el `Map`, **pero la
notificación sigue en pantalla**; cuando el click llega, el worker revive sin el dato y no tiene
a quién preguntarle. El id lo custodia Chrome, así que es el único canal que sobrevive. Sin
storage nuevo, y sin tocar la forma del historial (`docs/data-model.md` no cambia).

Detalles que el corte dejó fijados, y que conviene no re-descubrir:
- El id **dejó de ser `""`**, que era como Chrome lo autogeneraba. La unicidad —lo que hace que
  los fallos se **apilen** en vez de reemplazarse— ahora la pone un sufijo `timestamp-random`.
  Perderla sería una regresión silenciosa: se vería *una* notificación en vez de N.
- El `sitioId` va **URL-encodeado**: hoy los ids de portal son slugs, pero `PuertoSitio` no lo
  exige y un `|` partiría el parseo.
- La distinción del corte 3 se sostiene punta a punta: un id **ausente** (o un `notificationId`
  viejo, anterior a este corte, que puede seguir en pantalla tras recargar la extensión) migra
  al portal legado; uno **presente pero desconocido** sale tal cual y el resolvedor lo rechaza,
  y entonces **el click no abre ninguna pestaña**. Eso último es deliberado: no sabemos a dónde
  llevar al usuario, y adivinar es exactamente el bug.
- **`sitioAsumido` ya no se lee en el service worker.** Era su último lector; el andamio del
  corte 2 sobrevive sólo del lado del popup, hasta el corte 5.

---

## Las decisiones de UX, y cuál es la única de verdad

La única pregunta que la medición no contesta: **¿qué muestra el filtro por faceta en la pestaña
Cola cuando hay dos portales mezclados y sus ejes son distintos** (cátedra vs. comisión)?

Tres caminos, en orden de costo:

1. **Agrupar la cola por portal** (encabezado por sitio) y que el filtro de faceta aplique
   dentro del grupo. Es lo más honesto visualmente y lo más caro en UI.
2. **Mostrar el filtro de faceta sólo cuando la cola es de un solo portal**, y esconderlo
   cuando hay mezcla. Barato, sin mentiras, degrada bien.
3. **Filtro compuesto sitio + faceta**. Lo más potente y lo que más complica el popover.

**Recomendación (2026-08-04): la 2**, y postergar el resto. Mezclar portales en la cola va a ser
el caso raro (uno baja de un aula por vez); pagar UI compleja por adelantado para eso es
exactamente el error que la Fase 6c documentó — diseñar contra un uso imaginado.

**Nota**: arreglar el punto 3 de arriba (el `leerDeCola` cruzado) **no** depende de esta
decisión. Es un bug de corrección y va igual.

### Resuelto el 2026-08-05: ninguna de las tres, una cuarta

El dueño propuso una forma que no estaba en la lista, y midiendo el código resultó mejor que las
tres: **el portal es una casilla maestra, y debajo van sus facetas con su propio vocabulario.**
Se elige portal y el filtro de faceta pasa a ser *exactamente el de hoy*. Con un solo portal en
la cola la sección Portal no aparece y la pantalla queda idéntica a la actual — que era la mejor
virtud de la opción 2, conservada sin quedarse sin filtro.

Por qué no es la opción 3, que se le parece: la 3 es **cruzada** (todas las facetas de todos los
portales a la vez, se puede marcar Cátedra A junto con Comisión 1) y ésta es **en cascada**. La
diferencia se paga en el popover, y **el popover ya está hecho de secciones** —
`renderizarFiltrosMenuPopover` arma "Estado" y la faceta con el mismo mecanismo — así que "Portal"
es una sección más, no una estructura nueva.

**Lo que la medición corrigió de la recomendación anterior**: la 2 se eligió sin haber mirado el
popover. No estaba mal razonada, estaba razonada sin ese dato.

**Lo que la medición corrigió del entusiasmo propio**: se argumentó primero que esta forma no
tocaba `filtrosActivos`. Con selección de varios portales a la vez eso es falso — `valoresFaceta`
es un `Set` de strings planos y dos portales pueden tener una faceta con la misma etiqueta, así
que el valor hay que **calificarlo por portal**. Sigue siendo más barato que la 3, pero no es
gratis. Lo que sí es gratis: `filtrosActivos` **no se persiste** (se arma en `popup.js` y viaja
por referencia), así que ese cambio no lleva migración.

### Y dos cosas más que el mismo corte se lleva puestas

**El orden pasa a ser criterio + sentido.** Hoy `btnSort` cicla a ciegas entre tres estados
(fila, semana ↑, semana ↓). Se separa en cuatro criterios —llegada, nombre, faceta, portal— más
un botón que invierte el activo. Con eso **LIFO deja de ser un criterio**: es "de llegada"
invertido, y cada criterio que se sume después trae sus dos sentidos gratis.

- El criterio **"portal" ordena por portal y, dentro de cada uno, por llegada**. Elegirlo es
  *agrupar*, no reordenar: si además saltara a alfabético, un click estaría cambiando dos cosas.
  Para alfabético ya está "nombre", y así los criterios quedan ortogonales.
- La etiqueta del criterio de faceta **sale del descriptor** cuando hay un solo portal
  ("Cátedra"), y es genérica cuando hay mezcla ("Faceta"): con dos portales el eje no tiene un
  nombre único, y la UI no puede hardcodear el vocabulario de uno (ADR-0008).
- **Esto sí lleva migración**: `ordenAscendente` se persiste y hoy es tri-estado (`null` = FIFO,
  `true`/`false` = nombre ↑/↓), o sea que ya mezcla criterio y sentido. Pasa a dos campos, 1 a 1 y
  sin pérdida.

**La clase que se está bajando queda clavada arriba**, separada por una línea divisoria, y ni el
filtro ni el orden la tocan. Es la fila que más se mira y la única que no se puede permitir que
desaparezca por haber filtrado otra cátedra.

**Y la decisión de fondo que esto destapó**: si el orden manda de verdad sobre qué se baja. Se
resolvió que **sí** — el array pasa a ser el orden y el SW deja de ordenar. Tiene ADR propio
([ADR-0011](adr/0011-el-orden-de-la-cola-lo-decide-el-popup.md)) porque cambia de dueño una
invariante, y es lo que convierte al corte 6 en cuatro sub-cortes.

---

## El registro

```ts
// sitio/registro.ts  (Capa 2, genérico — no es de ningún portal)
const SITIOS: PuertoSitio[] = [SitioRamonNet, /* … */];

export const Sitios = {
  obtener(id: string): PuertoSitio,          // por id, para la cola
  resolverPorUrl(url: string): PuertoSitio | undefined,  // para la pestaña activa
  todos(): PuertoSitio[],                    // para el onboarding / diagnósticos
};
```

`resolverPorUrl` se apoya en `esPaginaDelSitio(url)`, que **ya existe en el puerto** — no hay que
inventar el mecanismo de detección, sólo iterar el registro.

Quién lo consume:

- **El popup**, al escanear: resuelve el sitio de la pestaña activa y **estampa `sitioId`** en
  cada clase scrapeada.
- **El service worker**, por ítem de la cola: `Sitios.obtener(item.sitioId)`.
- **La composición**, que deja de importar `sitio/ramonnet/config` y pasa a importar el registro.

## El manifest

`wxt.config.ts` es estático y se edita a mano al sumar un portal. **No bloquea nada**:

- `host_permissions`: sumar el origen del portal nuevo y el de su CDN.
- `declarative_net_request.rule_resources` **acepta varios rulesets** — uno por portal, cada uno
  apuntando a `public/sitio/<portal>/rules.json`.

La extensión es personal y se carga descomprimida, así que pedir permisos de N portales no tiene
el costo que tendría en la Web Store (ver ADR-0009 y `docs/deployment.md`).

## Lo que NO se toca, y es la prueba de que la re-arquitectura sirvió

La UI entera, `plataforma/` completa, y de `core/` sólo los dos módulos citados. Un portal nuevo
es: `sitio/<portal>/config.ts` (12 miembros, con el compilador de árbitro), sus tres hermanos y
su `rules.json`.

**La regla que más fácil se rompe al escribir un adaptador nuevo**: `escanearListado` se inyecta
**serializada** en la pestaña del portal — no puede referenciar ninguna global de la extensión ni
una constante de su propio archivo. Nada lo detecta: ni el bundler, ni el lint, ni `tsc`, ni la
suite. Se verifica en el navegador. Ver `docs/architecture.md` §Capa 2.

---

## La trampa del corte 3: "sin sitio" y "sitio desconocido" no son lo mismo

Vale dejarlo escrito porque casi se cuela como bug y no lo habría visto ningún test existente.

El registro devuelve `undefined` para un id que no conoce, y el bucle trata eso como **huérfano**:
saltea la clase y sigue. Correcto. Pero el service worker **lee `colaDescargas` de storage por su
cuenta** —no pasa por la normalización de `AppState`, que es del popup—, así que un ítem encolado
antes del multi-sitio llega con `sitioId: undefined`… y se habría salteado también. **La cola
entera de cualquier instalación existente, saltada en silencio.**

Son dos casos que se parecen y significan lo contrario:

| Caso | Qué sabemos | Qué corresponde |
|---|---|---|
| `sitioId` **ausente** | Es un dato de antes del multi-sitio: sí sabemos de dónde vino | Resolver al portal legado |
| `sitioId` **presente pero desconocido** | NO sabemos de dónde vino | Saltear como huérfano |

**Dónde vive la distinción**: en el envoltorio que arma `plataforma/composicion.ts`
(`obtener: (id) => Sitios.obtener(id ?? SITIO_LEGADO)`), y no en el registro ni en el núcleo. Si
la hiciera el registro, un id desconocido se descargaría en silencio con el adaptador equivocado
—el bug que ADR-0010 previene—; si la hiciera el núcleo, Capa 1 volvería a nombrar un portal.
La composición es el único lugar donde una regla de migración no ensucia a nadie.

---

## Orden de cortes propuesto

Cada uno en su rama, con los 4 chequeos en verde y verificación en navegador antes del merge —
la regla que en toda la re-arquitectura atajó los únicos 3 defectos que llegaron a `main`.

| # | Corte | Riesgo |
|---|---|---|
| 1 | `sitioId` en `Clase`/`ColaItem` + migración por defecto + `data-model.md` | ✅ **Hecho y verificado en navegador** (2026-08-04). Se estampa al escanear y se hereda al encolar; la normalización va al cargar. +3 tests de la migración. Nadie lo lee todavía: no cambia ninguna conducta |
| 2 | `sitio/registro.ts` con un solo portal adentro | ✅ **Hecho y verificado en navegador** (2026-08-04). Con N=1 el comportamiento es idéntico. Además **se fue el alias `SitioActivo` de `sitio/ramonnet/config.ts`**: un portal ya no se declara a sí mismo el activo — eso lo decide el registro. Queda `sitioAsumido` como andamio explícito, que borran los cortes 3 y 5. +8 tests |
| 3 | `procesadorCola`: de `sitio` fijo a `sitios.obtener(id)` | ✅ **Hecho y verificado en navegador** (2026-08-04): descarga real de punta a punta. Los 12 tests de caracterización agarraron el cambio de contrato, que es para lo que existen. +2 tests del caso nuevo. **Ojo con la distinción que destapó**: `sitioId` ausente (dato viejo) y `sitioId` desconocido (huérfano) NO son lo mismo — ver §La trampa del corte 3 |
| 4 | `leerDeCola` contra el sitio del ítem (bug de corrección) | ✅ **Hecho** (2026-08-04). +2 tests, uno con la cola mezclada de verdad. El resolvedor con migración pasó a ser **un export compartido** de la composición: si el bucle y el filtro resolvieran distinto, un ítem se descargaría con un portal y se mostraría clasificado con otro |
| 5 | El popup estampa `sitioId` al escanear + resuelve por pestaña | ✅ **Hecho** (2026-08-06), **verificado en navegador** (2026-08-06). Se fue `sitioAsumido` del popup, que era su último lector. El escaneo resuelve el portal de la pestaña **una vez** y usa ese local en todo el recorrido: leer el mutable más abajo dejaría la puerta abierta a que un listener lo cambie a mitad de escaneo. **Lo que la medición no había visto**: `filters.js` y `faceta.js` *capturaban* `ctx.sitio.faceta` al crearse, así que `ctx.sitio` tuvo que pasar a ser una FUNCIÓN — con un portal fijo daba igual, con portal por pestaña habrían clasificado con el vocabulario del anterior. Se resolvió re-leyendo el descriptor por función (una línea cada una) en vez de tocar los ~30 call-sites. +2 tests |
| 6a | La clase que se está bajando, clavada arriba + divisor | ✅ **Hecho** (2026-08-05), **verificado en navegador** (2026-08-06). `popup.js` saca la fila activa ANTES de filtrar y la pone primera; la isla sólo pinta el divisor (sigue siendo vista pura). +7 tests. El CSS extendió `styles/list.css` en vez de crear hoja nueva —así no hay `@import` que olvidar— y se comprobó que salió en el bundle, que es la falla silenciosa que esa regla previene. Apareció un caso que no estaba en el diseño: con el filtro vacío **y** descarga en curso, la lista NO está vacía, así que no corresponde la tarjeta de estado — va el ancla + una nota |
| 6b | El orden como criterio + sentido | ✅ **Hecho** (2026-08-05), **verificado en navegador** (2026-08-06). Nace `popup/features/orden.js` con las tres piezas que estaban sueltas en `popup.js`. +28 tests sobre código que no tenía ninguno, que era el motivo del corte. **La migración salió distinta de lo planeado**: el tri-estado `ordenAscendente` servía a las DOS pestañas con reglas distintas —Disponibles sólo mira su verdad/falsedad, así que `null` era *descendente*— y partirlo habría dado vuelta esa pestaña en toda instalación existente. La Cola estrenó un par propio (`criterioOrdenCola` + `ordenColaAscendente`) y `ordenAscendente` quedó intacto. **Y un segundo ajuste, tras probarlo en el navegador**: la primera versión dejó a Disponibles con el toggle viejo, así que el mismo botón hacía dos cosas según la pestaña — se notaba al primer uso. Ahora las dos abren el mismo panel, con los criterios que a cada una le corresponden (Disponibles: nombre, faceta, estado; sin `llegada` ni `portal`, que ahí no significan nada). De paso, el popover dejó de ser vidrio esmerilado: era `--bg-overlay` al 82% + blur y se leía la lista por detrás. **No se tocó el token**, que lo comparten cuatro fondos de modal donde la transparencia sí corresponde |
| 6c | La sección Portal con casilla maestra y estado parcial; `valoresFaceta` calificado por portal. **Sin migración** (`filtrosActivos` es de memoria) | ✅ **Hecho** (2026-08-06). **No verificable en navegador hasta el corte 7**: la sección sólo aparece con la cola mezclada y hay un solo portal registrado, así que sus 9 tests son toda su observación. Dos cosas que el diseño no decía: el id del grupo sale del **descriptor** y no del campo crudo (un ítem sin `sitioId` migra al legado, y leer el campo pelado lo habría puesto en un grupo propio haciendo parecer mezclada una cola que no lo está), y los **huérfanos quedan fuera** de la sección — sin descriptor no hay nombre ni faceta, y adivinar es el bug que ADR-0010 previene |
| 6d | El SW deja de ordenar y confía en el array; el popup persiste la cola reordenada — **ADR-0011** | ✅ **Hecho** (2026-08-06), **verificado en navegador** (2026-08-06), que es el que más la necesitaba. Los 14 de caracterización del bucle quedaron verdes sin tocarlos, que era la condición. **Pero uno sí se puso rojo y la ADR no lo previó**: `background.test.js` afirmaba *"respeta el orden FIFO por `fechaEncolado`, NO el del array"* — la caracterización exacta del `sort` que este corte elimina. Se invirtió la afirmación, que es lo honesto: el contrato cambió por decisión. Un tercer punto de llamada que el diseño no tenía: **encolar re-aplica el orden**, porque agrega al final y con un criterio que no sea "llegada" el ítem nuevo contradiría la pantalla. +13 tests |
| 7 | Manifest + el primer adaptador real del segundo portal | Verificación en navegador, no hay otra red |
| 8 | El click de la notificación resuelve la pestaña con el sitio del ítem, no con `sitioAsumido` (bug de corrección — ver §5) | ✅ **Hecho** (2026-08-05), **verificado en navegador** (2026-08-06). Se hizo antes del 7, como preveía esta fila. +19 tests, con un segundo portal en los dobles: con uno solo el bug es invisible. **Y con esto `sitioAsumido` salió del service worker**: el SW ya no tiene UN portal. El dato viaja adentro del `notificationId` (§5) porque el worker se suspende y se lleva cualquier mapa en memoria |

**Los cortes 1 y 2 son seguros y se pueden hacer ya**, antes de tener el segundo portal: dejan el
andamiaje listo sin cambiar una sola conducta.

**Antes de ejecutar cada uno: medir.** En la re-arquitectura el corte resultó de otro tamaño las
cuatro veces que se saltó ese paso — y una de esas veces el error fue medir `popup/` y no
`sitio/`. Medir el árbol entero, no el subconjunto que uno tiene en la cabeza.

---

## Cómo retomar esto en una sesión nueva

Escrito el 2026-08-05, al final de la sesión que hizo los cortes 8, 6a y 6b. **Leé esto antes
que el resto del doc**: dice dónde está todo y qué está a medio camino.

### 1. Nada está mergeado, y las ramas son un stack, no ramas paralelas

`main` está en el commit anterior al corte 4. Todo lo demás vive en **siete ramas encadenadas**:
cada una contiene a las anteriores.

```
main
 └─ feat/multisitio-corte4-faceta        corte 4 + 3 commits de docs
     └─ feat/multisitio-corte8-notificacion   + corte 8
         └─ feat/multisitio-corte6a-ancla         + corte 6a
             └─ feat/multisitio-corte6b-orden         + corte 6b y sus 2 fixes
                 └─ feat/multisitio-corte6c-filtro-portal   + corte 6c (y un fix de docs)
                     └─ feat/multisitio-corte6d-orden-manda     + corte 6d
                         └─ feat/multisitio-corte5-popup-por-pestana  + corte 5  ← la punta
```

La regla del repo es "una rama por corte" y esto la cumple de nombre pero no de espíritu: **no
son independientes**. Consecuencias prácticas:

- Mergear la punta (`corte5`) se lleva puestos los seis de abajo. No se puede mergear uno solo
  del medio sin rebase.
- Del lado bueno: **compilar y probar la rama de arriba ejercita todo el stack**, así que una
  sola pasada de verificación en navegador los cubre a los siete.
- Si algo falla, la rama no aísla cuál corte lo rompió. Para eso está el historial, que sí tiene
  un commit por corte.

### 2. ✅ Verificado en Chrome el 2026-08-06 — el stack entero, de una pasada

**El dueño probó la punta del stack y quedó conforme**: la extensión anda. Como las ramas son
encadenadas, esa única pasada ejercitó **los siete cortes**, incluidos los cuatro (4, 8, 6a, 6b)
que venían sin verificar desde el 2026-08-05. Con eso el stack deja de estar bloqueado para
mergear.

**Lo que esa pasada NO pudo cubrir, y no es un descuido: el corte 6c.** Su sección "Portal" sólo
se dibuja con la cola mezclada, y con un solo portal registrado eso no ocurre nunca. Sus 9 tests
son toda su observación hasta que exista el corte 7. **No lo cuentes como verificado.** Lo mismo
vale para el criterio `portal` del 6b y para la resolución por pestaña del 5 contra un portal que
no sea el legado.

Por qué esta verificación importaba tanto (y conviene no leerla como trámite): en la sesión del
2026-08-05, usar la extensión encontró **tres defectos que la suite no podía ver** —el orden de
Disponibles quedó inconsistente con el de la Cola, el popover se leía por detrás, y los dos
popovers podían quedar abiertos a la vez—. Ninguno era de lógica; los tres eran de interacción o
de aspecto, que es exactamente el punto ciego declarado del proyecto.

**El checklist que se corrió** —y el que hay que volver a correr si se rebasa o se retoca el
stack— son los 7 puntos de `rearquitectura-diseno.md` §Verificación en navegador, más estos, que
son de lo que tocaron estos cortes:

- Con una descarga en curso: que la fila quede clavada arriba de la divisoria y **no se mueva**
  al filtrar, buscar ni cambiar el orden.
- Filtrar hasta que no quede nada más: tiene que verse el ancla + la nota, **no** la tarjeta de
  "no hay clases".
- El panel de orden en **las dos pestañas**, con sus criterios distintos.
- Abrir filtros y después orden (y al revés): sólo uno abierto. Click afuera: se cierran los dos.
- Cambiar de pestaña con un panel abierto: se cierra.
- Que el orden elegido **sobreviva a cerrar y reabrir el popup** (se persiste).
- Y el que más importa: **que una instalación existente no cambie de orden sola** al actualizar.
  La migración es el punto delicado del 6b — ver abajo.

### 3. La trampa del 6b, que casi se ejecuta mal

El plan decía partir `ordenAscendente` en dos. **Ese campo no era de la Cola: servía a las dos
pestañas con reglas distintas.** Disponibles sólo mira su verdad/falsedad, así que `null` ahí
significaba *descendente*, mientras que en la Cola significaba FIFO. Derivar `null → ascendente`
habría dado vuelta el orden de Disponibles en toda instalación existente, sin que nada lo dijera.

Lo que se hizo: la Cola estrenó `criterioOrdenCola` + `ordenColaAscendente`, Disponibles estrenó
`criterioOrdenDisponibles` y **`ordenAscendente` quedó intacto** como su sentido. Detalle en
`data-model.md`, y hay tests que afirman que Disponibles no se movió.

### 4. ✅ ADR-0011 ya está construida (era el corte 6d, hecho el 2026-08-06)

Se deja escrito porque durante dos días esta sección decía lo contrario, y esa es la forma en
que ADR-0009 generó trabajo duplicado. **Ahora el SW sí obedece el array**: el `sort` por
`fechaEncolado` salió de `core/cola/procesadorCola.ts` y el bucle baja `[0]`.

Lo que queda de esa advertencia, y sigue valiendo: **el popup es ahora el único escritor del
orden**, y el SW ya no tiene una red que lo corrija si escribe una secuencia inconsistente. Es
el riesgo que la ADR acepta explícitamente.

### 5. Qué sigue, en orden

| Qué | Estado | Nota |
|---|---|---|
| Verificar los 7 cortes en Chrome | ✅ **Hecho** (2026-08-06) | Una sola pasada sobre la punta del stack los cubrió a todos. Ver §2 |
| Mergear el stack a `main` | ⏳ **Lo que queda** | Lo hace el dueño. Mergear la punta se lleva los siete; no se puede uno solo del medio sin rebase |
| Corte 7 — segundo portal real | Bloqueado | Necesita un portal que no tenemos. **Es lo que haría observable al 6c**, que hoy sólo tienen los tests |

Los cortes 6c, 6d y 5 se hicieron el 2026-08-06, con las cuatro verificaciones en verde
(28 archivos / 368 tests, lint y `tsc` limpios, build OK) y verificados en navegador ese mismo
día —salvo el 6c, que no se puede ver hasta el corte 7—.

**Lo que se sumó al checklist de Chrome por lo que se hizo ese día** —además de los 7 puntos de
`rearquitectura-diseno.md` y los de más arriba—, todo del corte 6d, que es el único de los tres
que se puede observar hoy:

- Con el backend Bun andando: encolar 3 clases, **invertir el orden** y confirmar que se baja la
  que quedó arriba, no la de `fechaEncolado` más viejo. Es el punto entero de ADR-0011.
- Reordenar **con una descarga en curso**: la que baja sigue anclada arriba y la ráfaga no se corta.
- Filtrar, reordenar y limpiar el filtro: **no se perdió ningún ítem** de la cola. Es la trampa de
  persistir el subconjunto filtrado, y su falla sería silenciosa y destructiva.
- Y el de siempre, que acá vale doble: **que una instalación existente no cambie de orden sola**
  al actualizar. La normalización por `fechaEncolado` cubre eso y se paga una vez.

### 6. Restos conocidos, chicos, que no son de ningún corte

- **`popup.js` no tiene tests del mecanismo de popovers** (el listener global de `document`, el
  botón de filtros). Lo que se agregó en el 6b cubre el lado de `OrdenFeature`; la otra mitad
  sigue en el núcleo sin cobertura, que es donde los tres defectos de esta sesión se escondieron.
- El popover de **Filtros** también dejó de ser translúcido, no sólo el de orden: son el mismo
  componente y separarlos parecía peor. Si el vidrio esmerilado se quiere de vuelta ahí, hay que
  separar las reglas.
