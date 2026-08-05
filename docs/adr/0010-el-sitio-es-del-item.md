# 0010 — El sitio es una propiedad del ítem, no de la build

**Fecha**: 2026-08-04
**Estado**: Aceptada
**Contexto previo**: [ADR-0008](0008-arquitectura-nucleo-adaptadores.md) (define las capas),
[ADR-0009](0009-registro-de-sitios-en-runtime.md) (elige registro en runtime sobre una build por
portal). Esta ADR resuelve un punto que la 0009 no vio.
**Diseño de ejecución**: `docs/multisitio-diseno.md`.

## Contexto

ADR-0009 decidió que una sola extensión maneje N portales resolviendo el adaptador **por URL**.
Su enunciado de consecuencias dice: *"Agregar un portal = escribir `sitio/<portal>/` + sumarlo al
registro + agregar su origen y sus reglas al manifest"*.

Al medir el código para implementarlo (2026-08-04, tras cerrar la re-arquitectura en la Fase 8a)
apareció algo que ese enunciado da por resuelto y no lo está: **"resolver por URL" alcanza para
el popup, pero no para el service worker.**

El popup siempre tiene una pestaña activa de la que deducir el portal. El service worker no: las
descargas ocurren sobre una **cola persistente y desacoplada de la pestaña** — está diseñada así
a propósito, para sobrevivir a que el usuario cambie de materia, navegue a otro lado o cierre la
pestaña del portal (`docs/data-model.md`). Cuando el SW toma un ítem, **no hay ninguna URL de
pestaña que consultar**, y la cola puede contener clases de dos portales a la vez.

Hay además un caso silencioso: `ColaItem` no persiste el valor de la faceta, y el descriptor lo
**re-deriva** con `clasificarCarpeta()`, que es específica del portal. Con la cola mezclada, la
fila de un portal se clasificaría con el parser del otro. Como ese parser devuelve un valor en
vez de fallar, el resultado es una clasificación equivocada **sin ningún error**.

## Decisión

**El sitio se persiste como un dato de cada ítem** (`sitioId` en `Clase` y en `ColaItem`), y el
registro se consulta por ese id, no sólo por URL.

- La resolución **por URL** se conserva, pero acotada a su caso legítimo: el popup, al escanear,
  deduce el portal de la pestaña activa y **estampa** `sitioId` en cada clase que produce.
- Todo consumidor posterior —el service worker, el filtro de la cola, el copy de una pausa—
  resuelve **por id**: `Sitios.obtener(item.sitioId)`.
- Los ítems sin `sitioId` (instalaciones previas) se leen como `"ramonnet"`. Es correcto por
  construcción: hasta esta decisión no existía otro portal.

## Alternativas consideradas

**Resolver siempre por URL, también en el SW** — usando `urlInterna` del ítem, que sí se
persiste. Es tentador porque no cambia el esquema de storage. Se descartó: obliga a correr N
`esPaginaDelSitio()` por ítem para recuperar un dato que ya se conocía con certeza al momento del
scraping, y hace que la clasificación dependa de que la URL del portal no cambie de forma. Es
derivar lo que se puede guardar.

**Prohibir mezclar portales en la cola** (vaciarla al cambiar de portal, o rechazar el encolado).
Evitaría el problema entero. Se descartó porque contradice la razón de ser de la cola —ser
independiente de la pestaña— y le impone al usuario una regla que sólo existe por una limitación
interna.

**Una instancia del núcleo por portal** (una composición por sitio). Aísla perfecto, pero
duplica el daemon de conexión, el estado de sesión y el procesador de cola, y deja sin respuesta
quién procesa una cola mezclada. Desproporcionado.

## Consecuencias

- **Cambia el esquema de storage** (`Clase`, `ColaItem`) → `docs/data-model.md` se actualiza en el
  mismo PR, con la regla de migración.
- **Cambia un contrato de Capa 1**: `procesadorCola` deja de recibir un `sitio` y pasa a recibir
  un resolvedor. Está cubierto por los 12 tests de caracterización del bucle.
- **Corrige un bug latente** que hoy no se puede disparar (no hay segundo portal) pero que se
  activaría el día uno del multi-sitio: la faceta re-derivada con el parser equivocado.
- **La UI no se entera.** Sigue leyendo `faceta`/`nombre`/`urlListado` del descriptor que le
  toque; el cambio es de dónde sale ese descriptor.
- El enunciado de consecuencias de ADR-0009 queda **incompleto, no incorrecto**: su lista de
  pasos sigue valiendo, y hay que sumarle "estampar el sitio en el ítem". Las ADR no se editan
  (ver `docs/adr/README.md`); esta la complementa.
