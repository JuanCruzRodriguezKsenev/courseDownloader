# Spec — Loader con progreso, vuelta a la portada y Estado primero en filtros

**Estado**: `aprobada` (sin leer, ver aviso) · **Plan**: [`docs/plan-loader-con-progreso.md`](../../plan-loader-con-progreso.md) · **Fecha**: 2026-09-27 · **Rama**: `classroom-escanear-todas`

> ⚠️ **El dueño aprobó los 22 supuestos del listado sin leerlos** (2026-09-27). Los derivados
> RN-20 a RN-22 (vuelta a la portada) los agregó la tanda sobre un pedido suyo y **no los vio**.
> Las decisiones con más filo están al final, en §Para leer con atención.

**Relacionado**: spec del recorrido [`../classroom-escanear-todas/spec.md`](../classroom-escanear-todas/spec.md)
(RN-15 sobrevivir al popup, RN-19 el escaneo de un curso queda igual) · canal de eventos
[`ADR-0016`](../../adr/0016-escaneo-inyectado-avisa-al-sw.md) · deuda 🔴 "El loader del popup no
tiene dueño" y ⚪ "Cerrar el popup a mitad del escaneo descarta el resultado"
(`docs/TECHNICAL_DEBT.md`) · piso visible (`popup/features/pisoVisible.js`).

## Historia

**Como** dueño, **quiero** ver dentro del loader qué está haciendo el escaneo (en qué curso, en qué
parte, cuánto encontró y cuánto lleva), tanto al escanear un curso como al recorrer todos,
**para** saber que avanza y cuánto falta, en vez de mirar un spinner con un texto fijo durante un
minuto o varios.

Y además: que al terminar el recorrido la pestaña vuelva a la portada de los cursos, y que en el
popover de filtros la sección **Estado** vaya siempre primera.

## Contexto y problema

- El escaneo de un curso muestra el loader con "Escaneando la pestaña..." (`popup.js:1515`) y
  nada más. En Classroom dura hasta ~45 s por curso (tope 180 s, `sitio/google-classroom/config.ts:88`)
  y el scraper no emite nada hasta el final: es una sola inyección que devuelve el resultado.
- El recorrido muestra su progreso en una **tarjeta de la lista** (`popup.js:2053-2078`: curso i de
  N, listos/vacíos/fallidos). El dueño quiere que sea el **loader**, como en el escaneo de un curso.
- El recorrido termina parado en el último curso escaneado. Reabrir el popup ahí, una vez
  materializado el recorrido, no coincide con la lista guardada (clave `"todos"`, que es la de la
  portada: `config.ts:72`) y cae en "escanear" ese curso (`core/estado/origenListado.ts:63-80`).
- En el popover de filtros de Disponibles la sección **Materia** va antes que **Estado** cuando hay
  dos o más materias (`popup/features/filters.js:371-434`), que es justo el caso tras un recorrido.

## Alcance

**Incluye**
- Loader con detalle para el escaneo de un curso, en los tres portales (detalle fino sólo en Classroom).
- Loader con detalle para el recorrido, reemplazando la tarjeta de progreso.
- Vuelta a la portada de activos al terminar el recorrido.
- Estado primero en el popover de filtros de Disponibles.
- El loader pasa a tener un dueño único (componente propio).

**No incluye**
- Botón para cancelar el escaneo o el recorrido.
- Que el escaneo de **un** curso sobreviva a cerrar el popup (sigue la deuda ⚪).
- Cambios al resumen final del recorrido (nota sobre la lista, tarjeta "El recorrido no trajo material").
- El texto "unos 45 s por curso" de la tarjeta de oferta (espera M-1 del recorrido).
- La pestaña Cola (no tiene sección Estado).

## Actores

| Actor | Qué puede |
|---|---|
| Dueño (único usuario) | Lanzar un escaneo o un recorrido, mirar el progreso, cerrar y reabrir el popup |

## Reglas de negocio

**Loader — común**
- **RN-1** — Mientras hay un escaneo (de un curso o recorrido) de la pestaña activa, el loader tapa
  la lista y muestra: spinner, **título**, **líneas de detalle** y **tiempo transcurrido** en formato
  `m:ss` (`0:07`, `1:23`, `12:05`).
- **RN-2** — El detalle se refresca como mucho cada 500 ms, aunque el escaneo encuentre ítems más rápido.
- **RN-3** — El piso de 500 ms por texto (`pisoVisible`) sigue valiendo para el **título** y para
  apagar el loader. Las líneas de detalle y el reloj se actualizan sin esperarlo.
- **RN-4** — Reportar progreso no agrega esperas al escaneo: ninguna fase espera a que el aviso llegue.
- **RN-5** — El loader tiene un único dueño: ningún flujo escribe su nodo directamente
  (cierra la parte "sin dueño" de la deuda 🔴; los tokens y la demora de aparición de esa deuda
  **no** entran salvo que el plan los necesite).

**Escaneo de un curso**
- **RN-6** — En **Classroom**: título = nombre del curso (o "Escaneando la pestaña..." hasta que se
  conozca); detalle = fase actual y ítems encontrados hasta ahora; pie = "Dejá Classroom al frente."
  Fases, en orden: `Trabajo en clase` → `Cargando más publicaciones (n)` (n = cantidad de "Ver más"
  abiertos) → `Novedades`.
- **RN-7** — En **Ramón Net y Anatomy**: el texto de hoy más el tiempo transcurrido. Sin fase ni conteo.
- **RN-8** — El progreso de un curso vive sólo con el popup abierto. Si se cierra y se reabre a
  mitad, se ve como hoy (el resultado se descarta — deuda ⚪). **No** se dice "Podés cerrar este popup".
- **RN-9** — Si el escaneo termina en aviso (visibilidad, curso cambiado, sin material, tope), el
  loader se apaga y el aviso sale en su tarjeta como hoy.

**Recorrido**
- **RN-10** — La tarjeta de progreso de la lista (`popup.js:2053-2078`) desaparece: el progreso va
  entero al loader. El botón de acción sigue oculto durante el recorrido.
- **RN-11** — Título "Escaneando todos los cursos"; detalle:
  - antes de enumerar: "Buscando tus cursos…";
  - después: `Curso i de N: <nombre>`, la fase y los ítems del curso actual (mismas fases que RN-6),
    y `Listos: a · Vacíos: b · Fallidos: c`.
- **RN-12** — Desde que terminó el **segundo** curso, se muestra `≈ N min restantes` = promedio de
  duración de los cursos terminados × cursos pendientes (incluido el actual), redondeado hacia
  arriba al minuto. Con menos de un minuto: `≈ 1 min restante`.
- **RN-13** — Debajo, la lista de todos los cursos con su estado: `✓` listo, `○` vacío, `✗` fallido,
  `▸` actual, `·` pendiente. Si no entra, tiene scroll propio y el curso actual queda a la vista.
- **RN-14** — El motivo de un fallido no se muestra durante el recorrido: sale en el resumen final.
- **RN-15** — Pie: "Dejá Classroom al frente. Podés cerrar este popup."
- **RN-16** — El progreso sobrevive a cerrar y reabrir el popup: al reabrir en la pestaña del
  recorrido aparece el loader con el estado actual, incluidos fase, ítems del curso actual, reloj
  total y lista de cursos (RN-15 de la spec del recorrido).
- **RN-17** — Si el recorrido se corta (visibilidad o navegación), el loader se apaga y se ve el
  resumen parcial como hoy.
- **RN-18** — El reloj del recorrido cuenta desde que se lanzó, no desde que se abrió el popup.
- **RN-19** — Con el popup abierto en **otra** pestaña, no hay loader del recorrido (como hoy con la tarjeta).

**Vuelta a la portada (derivados, no vistos por el dueño)**
- **RN-20** — Cuando el recorrido termina (`terminado`), la pestaña vuelve a la portada de cursos
  **activos** (`/h`) navegando dentro de Classroom, sin recargar la página.
- **RN-21** — Si el recorrido se **corta** (visibilidad o navegación), la pestaña queda donde está:
  el dueño está en otra pestaña o navegó a propósito.
- **RN-22** — Si la vuelta no llega a la portada (no aparece el link o la URL no cambia), el
  recorrido igual termina `terminado` con su resultado: la vuelta no puede convertir un recorrido
  exitoso en fallido.

**Filtros**
- **RN-23** — En el popover de Disponibles, la sección **Estado** va primera siempre, antes de
  Materia, Tipo y la faceta del portal. El orden del resto no cambia. La Cola no cambia.

## Flujos

**Camino feliz — recorrido**
1. En la portada, el dueño aprieta "Escanear todos los cursos".
2. El loader aparece con "Buscando tus cursos…" y el reloj en `0:00`.
3. Al enumerar, aparece la lista de cursos con todos en `·` y el primero en `▸`.
4. Por cada curso, el detalle muestra la fase y los ítems; al terminarlo, su marca cambia y los contadores suben.
5. Desde el segundo curso terminado aparece `≈ N min restantes`.
6. Al terminar, la pestaña vuelve a la portada, el loader se apaga y se ve la lista agrupada con su resumen.

**Camino feliz — un curso de Classroom**
1. El dueño abre el popup en un curso sin lista guardada.
2. El loader muestra "Escaneando la pestaña..." y en cuanto sabe el nombre del curso, lo pone de título.
3. El detalle pasa por las fases con los ítems contados; el reloj corre.
4. Al terminar, el loader se apaga y se ve la lista.

| # | Alternativo | Qué pasa |
|---|---|---|
| A1 | Se cierra el popup a mitad del recorrido y se reabre | Loader con el estado actual (RN-16) |
| A2 | Se cierra el popup a mitad de un curso y se reabre | Como hoy: re-escanea desde cero (RN-8) |
| A3 | Un curso del recorrido falla | `✗` en la lista, Fallidos +1, sin motivo hasta el final (RN-14) |
| A4 | El recorrido se corta por visibilidad | Loader se apaga, resumen parcial, la pestaña no se mueve (RN-17, RN-21) |
| A5 | La vuelta a la portada no llega | Recorrido `terminado` igual; la pestaña queda donde quedó (RN-22) |
| A6 | Escaneo de Ramón Net | Texto de hoy + reloj (RN-7) |
| A7 | El escaneo de un curso vence el tope | Loader se apaga, tarjeta de tope como hoy (RN-9) |
| A8 | Popup abierto en otra pestaña durante el recorrido | Sin loader del recorrido (RN-19) |

## Datos

- **Progreso de un curso** (efímero): fase (`trabajo` · `ver-mas` · `novedades`), n de "Ver más"
  abiertos, ítems encontrados, nombre del curso si ya se conoce, instante de inicio.
- **Estado del recorrido** (persistido hoy en `recorridoTodos`): suma, por curso, la **duración**
  (para RN-12) y, para el curso actual, fase e ítems (para RN-16). El instante de lanzamiento ya
  existe o se agrega (RN-18). Retención: la misma del estado del recorrido hoy.

## Criterios de aceptación

```gherkin
AC-1 — El recorrido se ve en el loader
  Dado el popup abierto en la portada de Classroom
  Cuando el dueño aprieta "Escanear todos los cursos"
  Entonces el loader tapa la lista con el título "Escaneando todos los cursos"
    y un reloj que avanza
    y no aparece la tarjeta de progreso en la lista

AC-2 — Lista de cursos con estado
  Dado un recorrido de 7 cursos escaneando el tercero, con el primero listo y el segundo vacío
  Entonces el loader muestra "Curso 3 de 7: <nombre del tercero>"
    y "Listos: 1 · Vacíos: 1 · Fallidos: 0"
    y la lista marca ✓, ○, ▸, ·, ·, ·, ·

AC-3 — Tiempo restante
  Esquema del escenario: estimación del recorrido
    Dado un recorrido de 7 cursos con <terminados> terminados que duraron en promedio <promedio>
    Entonces el loader muestra <texto>
    Ejemplos:
      | terminados | promedio | texto                  |
      | 1          | 40 s     | (sin estimación)       |
      | 2          | 40 s     | ≈ 4 min restantes      |
      | 6          | 30 s     | ≈ 1 min restante       |

AC-4 — Fase e ítems en un curso de Classroom
  Dado el popup abierto en Física I sin lista guardada
  Cuando el escaneo abre el tercer "Ver más"
  Entonces el loader muestra "Física I-Grupo G-Ing 2024" como título
    y "Cargando más publicaciones (3)" con los ítems encontrados hasta ahora
    y "Dejá Classroom al frente."
    y no dice "Podés cerrar este popup"

AC-5 — Reabrir el popup durante el recorrido
  Dado un recorrido en el curso 4 de 7 lanzado hace 3 minutos
  Cuando el dueño cierra el popup y lo vuelve a abrir en esa pestaña
  Entonces el loader muestra el curso 4 de 7, la lista con sus marcas y el reloj en 3:xx

AC-6 — Vuelta a la portada
  Dado un recorrido que termina con 7 cursos
  Cuando termina el último
  Entonces la pestaña queda en la portada de cursos activos
    y al abrir el popup ahí se ve la lista completa del recorrido, sin re-escanear

AC-7 — Recorrido cortado no mueve la pestaña
  Dado un recorrido en el curso 3
  Cuando el dueño cambia de pestaña y el recorrido se corta por visibilidad
  Entonces la pestaña de Classroom sigue en el curso 3
    y el popup muestra el resumen parcial sin loader

AC-8 — Portales sin detalle fino
  Dado el popup abierto en Ramón Net sin lista guardada
  Cuando escanea
  Entonces el loader muestra "Escaneando la pestaña..." y un reloj, sin fase ni conteo

AC-9 — Aviso de un curso apaga el loader
  Dado un escaneo de Classroom en curso
  Cuando el dueño cambia de pestaña y el escaneo termina con aviso de visibilidad
  Entonces el loader se apaga y se ve la tarjeta del aviso como hoy

AC-10 — Estado primero
  Esquema del escenario: orden del popover
    Dado Disponibles con <listado>
    Cuando el dueño abre los filtros
    Entonces la primera sección es "Estado"
    Ejemplos:
      | listado                                  |
      | un curso de Classroom con adjuntos       |
      | el recorrido con 5 materias              |
      | Ramón Net con dos cátedras               |

AC-11 — El reporte no frena el escaneo
  Dado el recorrido completo de los 7 cursos
  Entonces su duración no supera en más de 5 % la del mismo recorrido sin loader con detalle (M-1)
```

## Requisitos no funcionales

- **NFR-1** — Refresco del detalle ≤ 1 cada 500 ms (RN-2).
- **NFR-2** — Sin esperas agregadas al escaneo por reportar (RN-4, AC-11).
- **NFR-3** — El loader sigue siendo legible en el ancho del popup: la lista de cursos no rompe el
  layout con 8 cursos de nombres largos (el de G22 tiene 62 caracteres).

## Wireframes

Estado base — recorrido en curso:

```
┌──────────────────────────────────────────┐
│                   ◠                      │
│       Escaneando todos los cursos        │
│                                          │
│  Curso 3 de 7: MC4 1S 2026               │
│  Cargando más publicaciones (2) · 9 ítems│
│  Listos: 1 · Vacíos: 1 · Fallidos: 0     │
│  4:12 · ≈ 3 min restantes                │
│ ┌──────────────────────────────────────┐ │
│ │ ✓ Física II G22 2026 2do cuatrimes…  │ │
│ │ ○ 2026 - 2C - MC6 :: Mate C          │ │
│ │ ▸ MC4 1S 2026                        │ │
│ │ · MC2 2025                           │ │
│ │ · Física I-Grupo G-Ing 2024          │ │
│ │ · Q5 Primer Cuatrimestre 2023        │ │
│ │ · Fisica_II_G25_2026           ⇅     │ │
│ └──────────────────────────────────────┘ │
│  Dejá Classroom al frente.               │
│  Podés cerrar este popup.                │
└──────────────────────────────────────────┘
```

Recorrido — antes de enumerar (sólo cambia el centro):

```
│       Escaneando todos los cursos        │
│  Buscando tus cursos…                    │
│  0:03                                    │
```

Un curso de Classroom:

```
│       Física I-Grupo G-Ing 2024          │
│  Trabajo en clase · 34 ítems             │
│  0:18                                    │
│  Dejá Classroom al frente.               │
```

Ramón Net / Anatomy:

```
│       Escaneando la pestaña...           │
│  0:04                                    │
```

## Supuestos resueltos

| # | Supuesto | Decisión | Por qué |
|---|---|---|---|
| 1–22 | Ver `assumptions.md` | Aprobados tal cual | El dueño los aprobó sin leerlos |
| 23 | Al terminar, a qué vista vuelve | Portada de activos `/h` | Es donde se lanzó y donde la clave de lista es `"todos"` (`config.ts:72`): reabrir muestra la lista |
| 24 | Vuelve también si se cortó | No | Corte por visibilidad = el dueño está en otra pestaña; por navegación = navegó a propósito |
| 25 | Si la vuelta falla | El recorrido sigue `terminado` | La vuelta es cortesía; no puede tirar un resultado bueno |

## Preguntas abiertas

- **PA-1** — Si el loader con detalle se muestra también en el escaneo del **arranque** del popup
  (el de "Conectando con el servidor Bun…" encadenado al escaneo). Se asume que sí: es el mismo
  escaneo de un curso. Confirmar en la Verificación B.

## Mediciones pendientes

- **M-1** — Duración del recorrido completo con el loader con detalle, cronometrada por el dueño en
  Brave. Decide AC-11: si supera en más de 5 % la medición de B-3 del recorrido, se baja la
  frecuencia de aviso antes de mergear. **No bloquea el plan.**

## Para leer con atención

1. **RN-10** saca la tarjeta de progreso del recorrido y lo tapa todo con el loader: mientras dura
   (varios minutos) no se ve la lista ni la toolbar. Es lo pedido; si al usarlo molesta, la vuelta
   atrás es cara porque RN-5 cambia el dueño del loader.
2. **RN-8** deja el escaneo de un curso con progreso que se pierde al cerrar el popup, mientras el
   recorrido lo conserva (RN-16). Es a propósito: arreglar el de un curso es la deuda ⚪ y otro corte.
3. **RN-20** mueve la pestaña del dueño sin que lo pida en ese momento. Si estaba mirando otra cosa
   en esa pestaña al final del recorrido… no puede: el recorrido exige la pestaña al frente y se
   corta si navega (RN-21).
