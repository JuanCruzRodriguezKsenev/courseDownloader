# Multi-sitio: una extensión, varios portales — diseño de ejecución

**Estado**: diseño redactado (2026-08-04). Sin implementar.
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

De ahí salen los cuatro puntos de acoplamiento reales.

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

Este es el más silencioso de los cuatro. `ColaItem` **no lleva** el valor de la faceta: el
descriptor lo re-deriva con `clasificarCarpeta(titulo, carpeta)`, que es **específica del
portal**. Con la cola mezclada, la fila de un portal se clasifica con el parser del otro — y
como el parser devuelve algo (no tira), el filtro simplemente muestra mal sin avisar.

**Cambio**: `leerDeCola` se resuelve contra `sitios.obtener(item.sitioId).faceta`, no contra "la"
faceta. Con eso el bug desaparece **sin** decidir nada de UX.

### 4. El daemon de conexión sondea un solo origen

`Conexion` recibe `urlSondeoInternet` en la composición. La sonda es a propósito el portal
objetivo y no un genérico ("lo que importa no es tener red, sino llegar A ESTE portal" — ver el
puerto). Con N portales, "hay internet" pasa a ser "llego a *cuál*".

**Recomendación**: no sobre-diseñar. El daemon sigue con **una** sonda —la del portal del ítem
en descarga, y en el popup la de la pestaña activa—; si a futuro hace falta estado por portal,
eso es un rediseño del daemon y merece su propio corte.

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

## Orden de cortes propuesto

Cada uno en su rama, con los 4 chequeos en verde y verificación en navegador antes del merge —
la regla que en toda la re-arquitectura atajó los únicos 3 defectos que llegaron a `main`.

| # | Corte | Riesgo |
|---|---|---|
| 1 | `sitioId` en `Clase`/`ColaItem` + migración por defecto + `data-model.md` | Bajo. No cambia comportamiento: nadie lo lee todavía |
| 2 | `sitio/registro.ts` con un solo portal adentro | Bajo. Con N=1 el comportamiento es idéntico al de hoy — se puede mergear y verificar sin tener un segundo adaptador |
| 3 | `procesadorCola`: de `sitio` fijo a `sitios.obtener(id)` | **Medio-alto**. Contrato de Capa 1; tiene los 12 tests de caracterización de red |
| 4 | `leerDeCola` contra el sitio del ítem (bug de corrección) | Bajo |
| 5 | El popup estampa `sitioId` al escanear + resuelve por pestaña | Medio. Sin tests sobre el núcleo de `popup.js` (ADR-0005) |
| 6 | Filtro de faceta con cola mezclada (decisión de UX) | Bajo |
| 7 | Manifest + el primer adaptador real del segundo portal | Verificación en navegador, no hay otra red |

**Los cortes 1 y 2 son seguros y se pueden hacer ya**, antes de tener el segundo portal: dejan el
andamiaje listo sin cambiar una sola conducta.

**Antes de ejecutar cada uno: medir.** En la re-arquitectura el corte resultó de otro tamaño las
cuatro veces que se saltó ese paso — y una de esas veces el error fue medir `popup/` y no
`sitio/`. Medir el árbol entero, no el subconjunto que uno tiene en la cabeza.
