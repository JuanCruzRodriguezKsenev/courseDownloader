# Spec — Cancelar el escaneo

- **Estado:** aprobada — 2026-09-27. El dueño aceptó los 18 supuestos **sin leerlos** ("aprobado
  sin leer"): las tres decisiones de [Para leer con atención](#para-leer-con-atención) son las que
  conviene que mire antes de la verificación en Brave.
- **Enmienda a:** [`../loader-con-progreso/spec.md`](../loader-con-progreso/spec.md), que listaba
  "Botón para cancelar el escaneo o el recorrido" en **No incluye**. Las reglas de esa spec (RN-1 a
  RN-27) siguen valiendo; ésta sólo agrega.
- **Traza:** [`assumptions.md`](./assumptions.md).

## Historia

Como dueño que lanza un escaneo en Classroom, quiero un botón para cancelarlo, para no tener que
esperar varios minutos (o cambiar de pestaña para forzar un corte) cuando me equivoqué de curso o
ya no lo necesito.

## Contexto y problema

El loader con detalle tapa la lista mientras dura el escaneo (RN-10 de la spec del loader). Un
recorrido de todos los cursos dura varios minutos (~20 s por curso) y hoy la única forma de frenarlo
es provocar un corte: sacar Classroom del frente (`visibilidad`) o navegar (`navegacion`). Eso
funciona por accidente, y el resumen culpa al dueño ("Classroom quedó en segundo plano").

Lo que ya existe y esta spec aprovecha:
- El recorrido tiene un estado terminal `cortado` con motivo (`core/estado/recorridoTodos.ts:24,46`)
  y un resumen parcial que conserva lo terminado (`textoResumen`, `recorridoTodos.ts:240-262`).
- El scraper de Classroom ya sabe abandonar un curso a mitad (`idCancelacion`,
  `sitio/google-classroom/scraper.js:89-93`), hoy sólo cuando un curso supera su tope (`:1154`).

## Alcance

**Incluye**
- Botón **Cancelar** en el loader con detalle del recorrido de todos los cursos.
- Botón **Cancelar** en el loader con detalle del escaneo de un curso de Classroom.
- Motivo de corte nuevo, "cancelado por el dueño", con su texto propio en el resumen parcial.

**No incluye**
- Cancelar en Ramón Net y Anatomy (su escaneo dura segundos).
- Cancelar en el loader sin detalle (conectando con el servidor, sincronizando).
- Cancelar con el teclado (Esc).
- Confirmación antes de cancelar.
- Recuperar lo encontrado a medias en el curso cancelado.

## Actores

| Actor | Qué puede hacer |
|---|---|
| Dueño (usuario de la extensión) | Cancelar un escaneo que lanzó, desde el popup abierto o reabierto |
| Pestaña de Classroom (content script) | Frenar el escaneo al recibir la orden y avisar que frenó |

## Reglas de negocio

**Dónde aparece**
- **RN-1** — El loader con detalle muestra un botón **Cancelar** durante el recorrido de todos los
  cursos y durante el escaneo de un curso de **Classroom**.
- **RN-2** — En Ramón Net y Anatomy, y en el loader sin detalle (RN-26 de la spec del loader), no
  hay botón.
- **RN-3** — En el recorrido, el botón está también al reabrir el popup a mitad (RN-16 de la spec
  del loader): cancelar funciona igual se haya lanzado desde este popup o desde uno anterior.

**Qué hace**
- **RN-4** — Cancelar no pide confirmación.
- **RN-5** — Al tocarlo, el botón pasa a **"Cancelando…"** y queda deshabilitado hasta que el
  escaneo se frena. Un segundo clic no hace nada.
- **RN-6** — La pestaña frena el escaneo en **1 s o menos** desde el clic (M-1).
- **RN-7** — Si la pestaña no confirma que frenó en **3 s**, el popup apaga el loader igual y da el
  escaneo por cancelado. Un resultado que llegue después se descarta.
- **RN-8** — Cancelar deja la pestaña donde está: no vuelve a la portada (como RN-21 de la spec del
  loader; RN-20 sólo vale para `terminado`).
- **RN-9** — La tecla Esc no cancela.

**Recorrido cancelado**
- **RN-10** — Termina en estado `cortado` con motivo propio. Los cursos ya terminados (listos,
  vacíos, fallidos) se conservan y su material se ve en la lista, igual que en un corte (RN-17 de la
  spec del loader).
- **RN-11** — El curso que se estaba escaneando al cancelar se **descarta**: no cuenta como listo,
  vacío ni fallido, y suma a "sin recorrer".
- **RN-12** — El resumen parcial cierra con
  `Cancelaste el recorrido en el curso i de N. Quedaron k sin recorrer.`
  (en lugar de `Se cortó en el curso i de N: <motivo>. …`), donde `i` es el curso descartado y `k`
  incluye ese curso.
- **RN-13** — Después de cancelar, el recorrido se puede volver a lanzar igual que después de un
  corte.

**Un curso cancelado**
- **RN-14** — Se descarta todo lo encontrado: la lista queda exactamente como estaba antes de
  lanzar el escaneo (vacía si no había nada guardado de ese curso).
- **RN-15** — No sale tarjeta de aviso ni resumen: cancelar no es un error. Si la lista queda
  **vacía**, la región muestra una tarjeta informativa neutra: **"Escaneo cancelado"** / "Tocá
  Re-escanear para volver a buscar." *(Enmienda 2026-09-28, decidida por el dueño al planificar: la
  tarjeta de lista vacía de siempre dice "No encontramos clases en esta pestaña", y eso es falso
  cuando no se terminó de buscar.)*

## Flujos

**Camino feliz — cancelar el recorrido**
1. El dueño lanza "Escanear todos". El loader muestra el recorrido con el botón Cancelar (RN-1).
2. En el curso 4 de 7 toca **Cancelar**. El botón pasa a "Cancelando…" (RN-5).
3. La pestaña frena en ≤ 1 s (RN-6) y el recorrido queda `cortado` por el dueño.
4. El loader se apaga; la lista muestra el material de los cursos 1 a 3 y el resumen termina con
   "Cancelaste el recorrido en el curso 4 de 7. Quedaron 4 sin recorrer." (RN-10 a RN-12).
5. La pestaña queda en el curso 4 (RN-8).

| # | Caso | Resultado |
|---|---|---|
| A1 | Cancela el escaneo de un curso | Loader se apaga, la lista vuelve a como estaba, sin aviso (RN-14, RN-15) |
| A2 | Cancela desde el popup reabierto a mitad del recorrido | Igual que el camino feliz (RN-3) |
| A3 | La pestaña no responde en 3 s | El popup apaga el loader y da por cancelado; lo que llegue tarde se descarta (RN-7) |
| A4 | Cancela antes de que se enumeren los cursos ("Buscando tus cursos…") | Recorrido `cortado` por el dueño, 0 cursos terminados; el resumen cierra con "Cancelaste el recorrido antes de encontrar los cursos." (PA-1, resuelta) |
| A5 | El curso actual termina justo mientras se procesa la cancelación | Gana la cancelación: el curso se descarta aunque haya terminado (RN-11) |
| A6 | Doble clic en Cancelar | El segundo clic no hace nada (RN-5) |
| A7 | Cancela en el escaneo del arranque del popup (tras "Conectando…") | Mismo que A1 si ya se ve el loader con detalle; durante "Conectando…" no hay botón (RN-2) |

## Datos

- `RecorridoTodos.motivoCorte` suma un valor que significa "cancelado por el dueño"
  (`core/estado/recorridoTodos.ts:46` y el evento `fin` en `:95`). El nombre del valor lo fija el
  plan.
- El curso descartado (RN-11) queda sin `resultado`, como los pendientes.
- Nada nuevo se persiste para el escaneo de un curso (RN-14).

## Criterios de aceptación

```gherkin
AC-1 — Cancelar el recorrido conserva lo terminado
  Dado un recorrido de 7 cursos escaneando el curso 4, con los cursos 1 a 3 listos
  Cuando el dueño toca "Cancelar"
  Entonces en 1 s o menos el loader se apaga
    y la lista muestra el material de los cursos 1 a 3
    y el resumen termina con "Cancelaste el recorrido en el curso 4 de 7. Quedaron 4 sin recorrer."
    y la pestaña de Classroom sigue en el curso 4

AC-2 — Cancelar un curso deja la lista como estaba
  Dado el escaneo de un curso de Classroom en la fase "Novedades" con 12 ítems encontrados
    y la lista de ese curso vacía antes de escanear
  Cuando el dueño toca "Cancelar"
  Entonces el loader se apaga
    y la lista queda vacía
    y la región muestra la tarjeta informativa "Escaneo cancelado" (no la de error ni "Sin clases detectadas")

AC-3 — Estado "Cancelando…"
  Dado un escaneo con el botón "Cancelar" visible
  Cuando el dueño lo toca
  Entonces el botón dice "Cancelando…" y está deshabilitado hasta que el loader se apaga

AC-4 — La pestaña no responde
  Dado un recorrido cuya pestaña no confirma la cancelación
  Cuando pasan 3 s desde el clic en "Cancelar"
  Entonces el loader se apaga y el recorrido se muestra cancelado
    y un resultado que llegue después no cambia la lista

AC-5 — Cancelar desde el popup reabierto
  Dado un recorrido lanzado, el popup cerrado y vuelto a abrir en la pestaña del recorrido
  Cuando el dueño toca "Cancelar"
  Entonces pasa lo mismo que en AC-1

Esquema del escenario: AC-6 — Dónde hay botón
  Dado el loader visible en <situación>
  Entonces el botón "Cancelar" <se ve>

  Ejemplos:
    | situación                                  | se ve    |
    | recorrido de todos los cursos              | se ve    |
    | escaneo de un curso de Classroom           | se ve    |
    | escaneo de un curso de Ramón Net           | no se ve |
    | escaneo de un curso de Anatomy             | no se ve |
    | "Conectando con el servidor Bun…"          | no se ve |
    | sincronizando                              | no se ve |

AC-7 — Se puede relanzar
  Dado un recorrido cancelado
  Cuando el dueño vuelve a la portada y lanza "Escanear todos"
  Entonces el recorrido arranca desde el curso 1 como uno nuevo

AC-8 — Esc no cancela
  Dado un escaneo en curso
  Cuando el dueño aprieta Esc
  Entonces el escaneo sigue
```

## Requisitos no funcionales

- **NFR-1** — Frenar en ≤ 1 s (RN-6). Se apoya en el corte por `idCancelacion` que ya existe; M-1
  lo confirma.
- **NFR-2** — El botón no agrega esperas al escaneo mientras no se toca (RN-4 de la spec del loader).
- **NFR-3** — Colores y estilo salen de lo existente: `.btn-cancel`
  (`styles/components/actions.css:102`) y los tokens de `styles/variables.css`. Ningún color nuevo.

## Wireframes

Estado base — recorrido, fila del spinner (lo demás del loader no cambia, RN-24 de la spec del
loader):

```
┌──────────────────────────────────────┐
│  ◌  Escaneando…          [ Cancelar ] │
└──────────────────────────────────────┘
  Dejá Classroom al frente. Podés cerrar este popup.
```

Tras el clic (RN-5):

```
┌──────────────────────────────────────┐
│  ◌  Escaneando…        [Cancelando…] │   ← deshabilitado
└──────────────────────────────────────┘
```

Escaneo de un curso: la misma fila, con el mismo botón.

Tras cancelar un recorrido — cierre del resumen (RN-12):

```
7 cursos: 2 con material · 1 vacíos · 0 fallidos
Cancelaste el recorrido en el curso 4 de 7. Quedaron 4 sin recorrer.
```

Tras cancelar un curso: la vista que había antes de escanear (RN-14). Si no había nada, la tarjeta
neutra de RN-15:

```
┌────────────────────────────┐
│ ⏹  Escaneo cancelado        │
│ Tocá Re-escanear para      │
│ volver a buscar.           │
└────────────────────────────┘
        [ Re-escanear 🔄 ]
```

## Supuestos resueltos

Los 18 los aceptó el dueño sin leerlos, así que el porqué es el de la tanda.

| # | Supuesto | Decisión | Por qué |
|---|---|---|---|
| 1-2 | Dónde hay botón | Recorrido y un curso de Classroom | Son los escaneos largos; ambos ya tienen loader con detalle |
| 3 | Ramón Net, Anatomy | Sin botón | Duran segundos; no hay qué cancelar |
| 4 | Loader sin detalle | Sin botón | No es un escaneo |
| 5 | Qué se conserva del recorrido | Lo terminado | Es lo que ya hace un corte; tirar minutos de trabajo por cancelar sería castigo |
| 6 | El curso a mitad | Se descarta | Una lista a medias parece completa y engaña |
| 7 | Un curso cancelado | Se descarta todo | Misma razón que 6 |
| 8 | Confirmación | No | Cancelar es barato de deshacer: se relanza |
| 9 | Pestaña | Queda donde está | Coherente con RN-21 de la spec del loader |
| 10 | Texto | "Cancelaste el recorrido…" | El texto de corte culpa a un accidente; esto fue a propósito |
| 11 | Relanzar | Igual que tras un corte | Sin estado nuevo que manejar |
| 12 | Popup reabierto | Se puede cancelar | El recorrido sobrevive al popup; si no, habría un loader sin salida |
| 13-14 | Botón | "Cancelar", en la fila del spinner, estilo `.btn-cancel` | Está al lado de lo que frena; estilo ya existente |
| 15 | Feedback | "Cancelando…" deshabilitado | Evita dobles clics mientras la pestaña frena |
| 16 | Esc | No cancela | Un Esc accidental no debería tirar un recorrido |
| 17 | Tiempo de freno | ≤ 1 s | El corte por token ya existe; a medir (M-1) |
| 18 | Pestaña muda | El popup cancela a los 3 s | Nunca un loader sin salida |

## Preguntas abiertas

- ~~**PA-1**~~ — **Resuelta en el plan (2026-09-28)**: con 0 cursos el resumen cierra con
  `Cancelaste el recorrido antes de encontrar los cursos.` Por el mismo camino, un corte de otro
  motivo con 0 cursos dice `Se cortó antes de encontrar los cursos: <motivo>.` Plan:
  [`../../plan-cancelar-escaneo.md`](../../plan-cancelar-escaneo.md).

## Mediciones pendientes

- **M-1** — Tiempo entre el clic en Cancelar y el loader apagado, en Brave con un recorrido real,
  cancelando en fase `Cargando más publicaciones`. ≤ 1 s → RN-6 se cumple. Entre 1 y 3 s → se
  acepta y se corrige RN-6 al valor medido. > 3 s → siempre salta RN-7: el plan tiene que cortar
  las esperas largas (`dormir`) antes de mergear. **No bloquea el plan.**

## Para leer con atención

1. **RN-11 / RN-14** — Lo encontrado a medias se tira. Si cancelás en el minuto 3 de un curso
   enorme, no queda nada de ese curso. Si preferís quedarte con lo parcial, es otra spec: habría
   que marcar la lista como incompleta.
2. **RN-4** — Sin confirmación. Un clic en falso durante un recorrido de 7 minutos se pierde el
   curso actual y hay que relanzar (los terminados se conservan).
3. **RN-7** — A los 3 s el popup da por cancelado aunque la pestaña siga trabajando. En la pestaña
   el escaneo puede seguir un rato sin que se vea; su resultado se ignora.
