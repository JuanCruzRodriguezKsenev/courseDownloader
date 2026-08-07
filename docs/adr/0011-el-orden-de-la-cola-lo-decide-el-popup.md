# 0011 — El orden de la cola lo decide el popup: el array **es** el orden

**Fecha**: 2026-08-05
**Estado**: Aceptada
**Contexto previo**: [ADR-0005](0005-feature-driven-popup-split.md) (el popup se parte en
features), [ADR-0010](0010-el-sitio-es-del-item.md) (la cola puede mezclar portales, que es lo
que hizo falta ordenar por portal).
**Diseño de ejecución**: `docs/multisitio-diseno.md` §Corte 6.

## Contexto

La pestaña Cola gana un control de orden real: cuatro criterios —llegada, nombre, faceta y
portal— más un botón que invierte el sentido. Al diseñarlo apareció una pregunta que el control
no puede esquivar: **si el usuario ordena la cola, ¿cambia lo que se baja después?**

Hoy la respuesta es que no, y no por decisión sino por construcción. Son dos órdenes distintos
que nunca se cruzaron:

- El popup ordena **para mostrar**. Arma una lista `filtrados` y la pinta.
- El service worker ordena **para bajar**, y lo hace por su cuenta: en cada vuelta del bucle
  ejecuta `colaDescargas.sort((a, b) => (a.fechaEncolado || 0) - (b.fechaEncolado || 0))` y toma
  el primero (`core/cola/procesadorCola.ts`). FIFO puro, mire lo que mire el popup.

Con el control nuevo esa separación deja de ser invisible. Invertir el orden pasa a estar a un
click, y la lectura natural de "poné la última primero" es que **esa** se baje después. Si la
lista dice una cosa y la descarga hace otra, el control miente — y miente en la dirección más
cara de descubrir, porque el usuario se entera recién cuando termina de bajar la clase
equivocada.

Las dos salidas honestas eran: declarar el orden como pura vista y **decirlo en la UI**, o hacer
que el orden mande de verdad. La primera es gratis; la segunda cuesta y es la que el dueño eligió.

## Decisión

**El orden de `colaDescargas` en storage ES el orden de descarga.** El popup lo escribe, el
service worker lo obedece.

- El popup, cuando cambia el criterio o el sentido, **reescribe `colaDescargas` completa** en el
  orden nuevo.
- El service worker **deja de ordenar**: toma `[0]` y baja eso. Se va el `sort` por
  `fechaEncolado` del bucle.
- `fechaEncolado` **no se elimina**: sigue siendo el dato del criterio "de llegada" y el que
  normaliza la cola de instalaciones viejas. Lo que deja de ser es *la* fuente del orden.
- Encolar sigue agregando **al final**, así que con el criterio por defecto (llegada ascendente)
  el comportamiento observable es idéntico al de hoy.

### Dos trampas que esta decisión crea, y que el diseño de ejecución detalla

**Ordenar no es filtrar.** El popup ya calcula `filtrados`, que es un *subconjunto* de la cola.
Persistir eso borraría todo lo filtrado. Lo que se persiste es la **cola entera reordenada**; el
filtro sigue siendo sólo vista. Del mismo control salen dos caminos que no se pueden confundir.

**Los datos viejos no tienen criterio.** Una cola guardada antes de este cambio está en el orden
en que quedó el array, que nadie garantizó nunca porque el SW lo re-ordenaba. Al cargarla por
primera vez hay que normalizarla una vez por `fechaEncolado`.

## Alternativas consideradas

**Dejar el orden como pura vista y avisarlo en la UI.** Gratis, no toca el bucle ni el contrato
con el SW, y es defendible: la cola es una cola, se baja en el orden en que se pidió. Se descartó
porque el aviso sería permanente y explicaría una limitación en vez de resolverla — y porque con
el botón de invertir a un click, "esto no hace lo que parece" es un costo que se paga en cada uso.

**Persistir un índice de orden por ítem** (`ordenCola: number`). Evita reescribir el array, pero
agrega un campo redundante con la posición y hay que mantenerlo consistente en cada alta, baja y
reordenamiento. El array ya expresa el orden; duplicarlo en un campo es una fuente de
divergencia sin beneficio.

**Que el SW aplique el mismo comparador que el popup**, leyendo el criterio persistido. Evita
reescribir la cola, pero obliga a que el comparador viva en un lugar compartido y a que el SW sepa
derivar la faceta de cada ítem para el criterio "faceta" — vocabulario de sitio metiéndose en la
decisión de qué bajar. Peor: dos implementaciones del mismo orden pueden divergir, que es
exactamente el problema que el corte 4 acaba de cerrar en el filtro.

## Consecuencias

- **El service worker se simplifica**: deja de tener una política de orden propia. Una decisión
  menos en la capa que menos se puede observar.
- **Cambia una invariante de `docs/data-model.md`**: `colaDescargas` pasa de "conjunto que el SW
  ordena por `fechaEncolado`" a "secuencia ordenada". Se actualiza en el mismo cambio.
- **Los tests de caracterización del bucle que afirman FIFO deben seguir en verde** sin tocarlos:
  el criterio por defecto es llegada ascendente y encolar agrega al final. Si alguno se pone rojo,
  es señal de que el cambio hace más de lo que dice, no de que el test sobre.
- **Verificación en navegador obligatoria**: toca el bucle de descarga, que es donde los tres
  únicos defectos que llegaron a `main` en toda la re-arquitectura se le escaparon a la suite.
- El riesgo real y aceptado: si el popup escribiera un orden inconsistente, el SW ya no tiene una
  red que lo corrija. La normalización al cargar cubre el caso de los datos viejos; el resto queda
  en manos de que el popup sea el único escritor, que es lo que esta ADR declara.
