# Multi-sitio: una extensión, varios portales — diseño de ejecución

**Estado**: diseño redactado (2026-08-04). **Corte 1 hecho**; del 2 al 7, pendientes.
**Decisión de base**: [ADR-0009](adr/0009-registro-de-sitios-en-runtime.md) eligió *registro en
runtime* sobre *una build por portal*, y [ADR-0010](adr/0010-el-sitio-es-del-item.md) resuelve
el punto que la 0009 no vio. Este doc es el **cómo**, igual que `rearquitectura-diseno.md` es el
cómo de ADR-0008.

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

**Recomendación: la 2**, y postergar el resto. Mezclar portales en la cola va a ser el caso raro
(uno baja de un aula por vez); pagar UI compleja por adelantado para eso es exactamente el error
que la Fase 6c documentó — diseñar contra un uso imaginado.

**Nota**: arreglar el punto 3 de arriba (el `leerDeCola` cruzado) **no** depende de esta
decisión. Es un bug de corrección y va igual.

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
| 5 | El popup estampa `sitioId` al escanear + resuelve por pestaña | Medio. Sin tests sobre el núcleo de `popup.js` (ADR-0005) |
| 6 | Filtro de faceta con cola mezclada (decisión de UX) | Bajo |
| 7 | Manifest + el primer adaptador real del segundo portal | Verificación en navegador, no hay otra red |
| 8 | El click de la notificación resuelve la pestaña con el sitio del ítem, no con `sitioAsumido` (bug de corrección — ver §5) | ✅ **Hecho** (2026-08-05), **pendiente de verificación en navegador**. Se hizo antes del 7, como preveía esta fila. +19 tests, con un segundo portal en los dobles: con uno solo el bug es invisible. **Y con esto `sitioAsumido` salió del service worker**: el SW ya no tiene UN portal. El dato viaja adentro del `notificationId` (§5) porque el worker se suspende y se lleva cualquier mapa en memoria |

**Los cortes 1 y 2 son seguros y se pueden hacer ya**, antes de tener el segundo portal: dejan el
andamiaje listo sin cambiar una sola conducta.

**Antes de ejecutar cada uno: medir.** En la re-arquitectura el corte resultó de otro tamaño las
cuatro veces que se saltó ese paso — y una de esas veces el error fue medir `popup/` y no
`sitio/`. Medir el árbol entero, no el subconjunto que uno tiene en la cabeza.
