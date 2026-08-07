# 0012 — La faceta elegida es por portal, y `claveEstado` sale del puerto

**Fecha**: 2026-08-06
**Estado**: Aceptada
**Contexto previo**: [ADR-0010](0010-el-sitio-es-del-item.md) (el sitio es una propiedad del
ítem), y la Fase 5c de la re-arquitectura, que generalizó `catedraSeleccionada` a
`facetaSeleccionada` para poder mudar el estado a `core/`.
**Diseño de ejecución**: `docs/multisitio-diseno.md`.

## Contexto

El mecanismo de "faceta" le pregunta al usuario **una vez** por cuál eje cursa (en Ramón Net, la
cátedra) y guarda esa elección. Hasta acá se guardaba en **un solo casillero**: la clave
`facetaElegida` de `chrome.storage.local`, que el descriptor del portal nombraba a través de
`PuertoSitio.faceta.claveEstado`.

Con un solo portal eso era correcto y además elegante: la indirección por `claveEstado` era
justamente lo que evitaba que la maquinaria genérica nombrara "cátedra".

**Con dos portales deja de serlo, y falla en la peor forma posible.** Elegís "Cátedra A" en un
portal, pasás al otro —cuyos valores son, digamos, comisiones 1 a 3— y el filtro compara `"A"`
contra los valores de *ese* portal. No matchea ninguno, así que
`aplicarFiltrosCruzados` esconde todas las clases: **el listado se ve vacío**. Sin error en
consola, sin aviso en pantalla y sin ningún test que lo pudiera afirmar, porque con un portal
registrado el caso no existe.

Es el mismo patrón que ADR-0010 identificó para el ítem, aplicado al estado de UI: **algo que se
trataba como propiedad global resultó ser propiedad de un portal**.

## Decisión

**La faceta elegida es un dato por portal.**

- La clave persistida pasa de `facetaElegida` (un valor) a **`facetasElegidas`**, un mapa
  `{ [sitioId]: valor }`.
- `AppState` expone `facetaElegidaDe(sitioId)` y `fijarFacetaElegida(sitioId, valor)`. **No se
  accede al mapa directo**: el método existe para que el resto del código no pueda volver a
  tratar la elección como un valor único, que es el bug que esta ADR cierra.
- **`PuertoSitio.faceta.claveEstado` se elimina.** Es un miembro de `DescriptorFaceta` —el
  objeto que cuelga de `faceta`—, así que el puerto sigue teniendo sus 11 miembros de primer
  nivel; lo que adelgaza es el descriptor de faceta, de 11 a 10. Nombraba *una* propiedad de `AppState`, y con un mapa por portal ya no hay una propiedad que
  nombrar: la clave es el `sitioId`. Mantenerlo sería sostener una indirección que apunta a un
  modelo que dejó de existir.
- **Migración de una vez**: el valor único entra como el del **portal legado**. Es correcto por
  construcción —hasta que hubo multi-sitio, no había otro portal del cual pudiera venir— y usa
  exactamente la misma forma que la migración `catedraElegida` → `facetaElegida` de la Fase 5c,
  incluido el borrado de la clave vieja. Si conviven mapa y valor único, gana el mapa.

## Alternativas consideradas

**Dejar el casillero único y limpiarlo al cambiar de portal.** Gratis y sin migración. Se
descartó porque *pierde* la elección: volver a un portal en el que ya elegiste te vuelve a
mostrar el modal, que es precisamente lo que la migración de la Fase 5c se tomó el trabajo de
evitar. Además el modal reaparecería en el uso más común —alternar entre dos aulas— en vez de
en el raro.

**Que el descriptor declare una `claveEstado` distinta por portal** (`facetaSeleccionada`,
`comisionSeleccionada`, …). Conserva el mecanismo tal cual y no necesita mapa. Se descartó
porque `AppState` tiene una forma fija y una lista explícita de claves persistidas: una clave
declarada por un adaptador nuevo **no se persistiría** sin tocar `core/` en el mismo cambio — o
sea, sumar un portal volvería a tocar Capa 1, que es justo lo que ADR-0008 vino a impedir.

**Guardar la elección dentro del descriptor del portal.** Confunde configuración con estado del
usuario: `sitio/<portal>/config.ts` describe el portal, no lo que este usuario eligió, y encima
no es persistible.

## Consecuencias

- **Cambia la forma de storage** → `docs/data-model.md` se actualiza en el mismo cambio.
- **`DescriptorFaceta` pierde un miembro**, así que un adaptador que todavía declare
  `claveEstado` deja de compilar. Eso es deseable: el compilador es el que avisa, no la lectura.
  El conteo de `PuertoSitio` que citan los docs (11) **no cambia**: `claveEstado` colgaba de
  `faceta`, no del puerto.
- La UI genérica sigue sin nombrar el concepto del sitio. Lo que cambió es *cómo* lo evita: antes
  por una indirección declarada en el descriptor, ahora porque la clave del mapa es el `sitioId`,
  que ya es el identificador genérico del portal.
- **Lo que esta ADR no arregla**: que dos portales compartan el espacio de nombres de los
  *valores* de faceta en la pestaña Cola. Eso ya lo resolvió el corte 6c calificando el valor
  (`sitioId|valor`) en `filtrosActivos`, que es un estado de memoria y no lleva migración.
- **Verificable con un solo portal sólo a medias**: que la migración conserve la elección sí se
  ve; que la elección de un portal no se filtre al otro necesita el segundo portal, y va cubierto
  por tests con dobles.
