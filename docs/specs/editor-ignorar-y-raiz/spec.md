# Spec: ignorar videollamadas y confirmar carpetas a la raíz en el editor de adopción

- **Estado**: aprobada (el dueño aceptó los 17 supuestos sin cambios, 2026-10-04).
- **Fecha**: 2026-10-04.
- **Traza**: [`assumptions.md`](assumptions.md).
- **Spec madre**: [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (RN-31 omisión, RN-32 videollamadas, tabla de `cursos.<clave>.temas` donde `"."` es la raíz de la materia).
- **Se cruza con**: [`../disco-manda/spec.md`](../disco-manda/spec.md) (toca `editor.html`, `vistas.ts` y `propuesta.ts`).

## Historia

Como dueño que adopta cursos desde el editor web, quiero **omitir todas las videollamadas de un curso de una vez** y **dar por buena una carpeta que va a la raíz de la materia**, para que el editor deje de pedirme revisar cosas que ya decidí.

## Contexto y problema

1. **Videollamadas.** RN-32 manda listarlas en el editor y dejar omitirlas. Hoy sólo se omiten **una por una** con la casilla de cada fila (`editor.html` ~L1830) o un tema entero (~L1983). Un curso con muchas salas de Meet obliga a tildar cada una.
2. **Carpeta a la raíz.** `core/destino/vistas.ts` L246-251 ya devuelve `regla: "si"` para un tema guardado con `"."` en el índice. Pero `editor.html` pisa esa decisión en **cuatro** lugares que equiparan `"."` con «sin asignar», sin mirar `regla`:
   - L1493: badge «N a revisar» de la lista de cursos.
   - L1692: filtro por tema (`isUnassigned`).
   - L1727: badge «Sin destino» y borde de aviso de la tarjeta del tema.
   - L1640-1645: contador «Sin regla» por archivo (`!dest || dest === "."`).

   Resultado: un tema que el dueño mandó a la raíz a propósito (o que una regla manda a `.`, como Novedades y Cronograma, `core/destino/carpetas.ts` L16-17) sigue marcado «Sin destino» para siempre y no se puede sacar de revisión.

## Alcance

**Incluye**
- Acción masiva por curso «Omitir N videollamadas» y su inversa, en el editor web.
- Definición única de «tema sin destino» y su uso en los cuatro lugares citados.
- Elegir `.` en el selector de un tema cuenta como decisión.

**No incluye**
- Controles nuevos en el popup (sigue mostrando «omitido» como hoy, RN-31).
- Una regla persistente que omita videollamadas de cursos futuros o de re-escaneos.
- Cambios al formato de `.course-downloader.json` ni migración.
- Cambiar qué sugiere `sugerirDestino` ni cuándo devuelve `regla: false`.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Omitir y re-ofrecer las videollamadas de un curso; elegir `.` como destino de un tema. |
| Editor web | Reconocer videollamadas, contarlas, y mostrar el estado de cada tema. |

## Reglas de negocio

- **RN-1** — Una fila es **videollamada** si su clave es `<portal>:acceso:<url>:<título>` y el host de `<url>` es uno de los de RN-32 de la spec madre (`meet.google.com`, `zoom.us` y subdominios, `teams.microsoft.com`, `teams.live.com`, `webex.com` y subdominios, `meet.jit.si`, `*.jitsi.net`). El editor no recibe ninguna bandera nueva. *(A7)*
- **RN-2** — Cada curso con al menos una videollamada muestra el botón «Omitir N videollamadas», con N = filas de videollamada cuya acción no es `omitir`. Sin videollamadas, el botón no aparece. *(A3, A6)*
- **RN-3** — «Omitir N videollamadas» pone `accion = "omitir"` en cada fila de videollamada del curso **salvo** las `ya-esta`, que no cambian nunca (RN-31, RN-5 de disco-manda). *(A3, A8)*
- **RN-4** — Si el curso tiene alguna videollamada omitida, aparece «Volver a ofrecerlas», que pasa a `copiar` todas las videollamadas con `accion = "omitir"` del curso. *(A5)*
- **RN-5** — La omisión masiva es una **acción puntual**, no una regla: no se guarda nada más que `cursos.<clave>.omitidos` (RN-31). Una videollamada que aparezca en un re-escaneo posterior llega sin omitir. *(A2, A4)*
- **RN-6** — Las filas de videollamada llevan en el editor la misma chip que el popup (`listaClases.preact.js` ~L194). *(A9)*
- **RN-7** — **Tema sin destino** = el tema no está omitido (`-`) y (`regla === "no"` o `destino` vacío). `destino === "."` **no** alcanza para ser «sin destino». Esta definición vive en **una** función y la usan los cuatro lugares de «Contexto». *(A10, A11, A14)*
- **RN-8** — Un tema con `destino === "."` y `regla === "si"` se muestra «✓ Asignado» y con la etiqueta de destino «Raíz de la materia». Incluye los temas guardados en el índice y los que una regla manda a `.` (Novedades, Cronograma). *(A11)*
- **RN-9** — Un tema nuevo con `destino === "."` y `regla === "no"` sigue «Sin destino» hasta que el dueño elija un destino en su selector, **incluido** `.`. *(A12)*
- **RN-10** — Al elegir cualquier destino en el selector de un tema, el editor pone `regla = "si"` de inmediato, sin necesidad de guardar. *(A13)*
- **RN-11** — El selector rotula la opción `.` como «Raíz de la materia» (hoy dice «. (raíz del curso)»; el destino `.` es la raíz de la **materia**, no del curso). La opción por archivo (L1861) pasa a decir lo mismo. *(A15)*
- **RN-12** — El filtro «Solo problemas», el filtro `unassigned`, el filtro `review` y el contador «Sin regla» cuentan sólo temas y archivos **sin destino** según RN-7. *(A14, A16)*

## Flujos

**Camino feliz: omitir videollamadas.** El dueño abre el curso Fisica II G25 2026 → ve «Omitir 3 videollamadas» → lo toca → las 3 filas quedan en `omitir` y con la chip → el botón pasa a «Volver a ofrecerlas» → guarda → el índice trae las 3 claves en `omitidos`.

**Camino feliz: carpeta a raíz.** El dueño abre un tema «Novedades» (regla `si`, destino `.`) → ve «✓ Asignado · Raíz de la materia» → no aparece en «a revisar» ni en «Solo problemas».

| Alt. | Situación | Resultado |
|---|---|---|
| A1 | El curso no tiene videollamadas | No hay botón. |
| A2 | Hay videollamadas `ya-esta` y otras no | N cuenta sólo las no `ya-esta`; las `ya-esta` no cambian. |
| A3 | Todas las videollamadas ya están omitidas | No hay «Omitir…»; sólo «Volver a ofrecerlas». |
| A4 | Un re-escaneo trae una videollamada nueva | Llega sin omitir; el botón vuelve a mostrar «Omitir 1 videollamada» (la anterior sigue omitida). |
| A5 | Tema nuevo, sin regla, destino `.` | «Sin destino» hasta que el dueño elija; elegir `.` lo da por decidido. |
| A6 | El dueño elige `.` y no guarda | El badge pasa a «Asignado» en el acto; el índice sólo cambia al guardar. |
| A7 | URL de acceso con host fuera de la lista (p. ej. `youtube.com`) | No es videollamada: ni chip ni cuenta en el botón. |
| A8 | URL de acceso no parseable | No es videollamada. |

## Tabla de decisión: estado de un tema

Se evalúa en este orden; gana la primera fila que coincide.

| # | `destino` | `regla` | Elegido por el dueño en esta sesión | Estado mostrado |
|---|---|---|---|---|
| 1 | `-` | cualquiera | — | Omitido |
| 2 | vacío | cualquiera | no | Sin destino |
| 3 | cualquiera | `no` | no | Sin destino |
| 4 | cualquiera | `no` | sí (RN-10 ya puso `si`) | Asignado |
| 5 | `.` | `si` | — | Asignado · Raíz de la materia |
| 6 | otro | `si` | — | Asignado |

La fila 3 es la que hoy atrapa a todo `.`: RN-7 la limita a `regla = "no"`.

## Wireframes

Estado base del encabezado de un curso en el editor (sólo la región que cambia):

```
┌─ MC2 2025 ───────────────────────────────────────────────┐
│ Ingenieria/Matematica C · Rey Grange                      │
│ [ Omitir 3 videollamadas ]                                │
└───────────────────────────────────────────────────────────┘
```

Después de tocarlo:

```
│ [ Volver a ofrecerlas ]            3 videollamadas omitidas │
```

Fila de videollamada en una tarjeta de tema:

```
│ ☐ 📹 Consulta Meet        consulta_meet.md   (omitido)      │
```

Tarjeta de tema a raíz decidida:

```
┌─ Novedades ─────────────────  ✓ Asignado ─┐
│ Destino: [ Raíz de la materia ▾ ]          │
└────────────────────────────────────────────┘
```

## Criterios de aceptación

```gherkin
AC-1 — Omitir todas las videollamadas de un curso (RN-1, RN-2, RN-3)
  Dado el curso "Fisica II G25 2026" con 3 filas cuya clave es acceso:https%3A%2F%2Fmeet.google.com%2F…
    y 2 filas de archivo normales
  Cuando el dueño toca "Omitir 3 videollamadas"
  Entonces las 3 filas de videollamada quedan con acción omitir
    y las 2 de archivo no cambian
    y al guardar, cursos.<clave>.omitidos contiene las 3 claves

AC-2 — No hay botón sin videollamadas (RN-2)
  Dado un curso sin ninguna fila de videollamada
  Entonces el encabezado del curso no muestra "Omitir … videollamadas"

AC-3 — Lo ya descargado no se toca (RN-3)
  Dado una videollamada con acción ya-esta y otra con copiar
  Cuando el dueño toca "Omitir 1 videollamada"
  Entonces sólo la de copiar pasa a omitir
    y la ya-esta conserva su acción y su ruta

AC-4 — Volver a ofrecerlas (RN-4)
  Dado un curso con 3 videollamadas omitidas
  Cuando el dueño toca "Volver a ofrecerlas"
  Entonces las 3 vuelven a copiar
    y el botón vuelve a decir "Omitir 3 videollamadas"

AC-5 — No es una regla (RN-5)
  Dado un curso con sus 3 videollamadas omitidas y guardadas
  Cuando un re-escaneo trae una videollamada nueva
  Entonces la nueva llega con acción copiar
    y las 3 anteriores siguen omitidas

AC-6 — Reconocer sólo videollamadas (RN-1, A7, A8)
  Esquema del escenario
    Dado una fila de acceso con URL <url>
    Entonces <es_videollamada>
  Ejemplos
    | url                                  | es_videollamada |
    | https://meet.google.com/abc-defg-hij | sí              |
    | https://us04web.zoom.us/j/7301675    | sí              |
    | https://teams.live.com/meet/123      | sí              |
    | https://www.youtube.com/watch?v=x    | no              |
    | meet.google.com.falso.com/x          | no              |
    | no es una url                        | no              |

AC-7 — Chip en el editor (RN-6)
  Dado una fila de videollamada en el editor
  Entonces la fila muestra la chip de videollamada

AC-8 — Tema guardado a raíz no se marca (RN-7, RN-8)
  Dado un curso con temas: { "Novedades": "." } guardado en el índice
  Cuando el dueño abre el curso
  Entonces la tarjeta de "Novedades" muestra "Asignado" y "Raíz de la materia"
    y el curso no cuenta a Novedades en "a revisar"

AC-9 — Un tema nuevo sin regla sigue pidiendo decisión (RN-9)
  Dado un tema nuevo "Anuncios varios" sin regla (destino ".", regla "no")
  Entonces la tarjeta muestra "Sin destino"
    y el curso cuenta 1 "a revisar"

AC-10 — Elegir "." es decidir (RN-10, A6)
  Dado el tema "Anuncios varios" con "Sin destino"
  Cuando el dueño elige "Raíz de la materia" en su selector, sin guardar
  Entonces la tarjeta pasa a "Asignado"
    y el curso ya no cuenta a ese tema en "a revisar"

AC-11 — Una sola definición en todos los lugares (RN-7, RN-12)
  Dado un tema a raíz decidido (regla "si", destino ".")
  Entonces no aparece con el filtro "Solo problemas"
    ni con el filtro "unassigned" ni con "review"
    y sus archivos no suman al contador "Sin regla"

AC-12 — Rótulo (RN-11)
  Dado el selector de un tema
  Entonces la opción "." se llama "Raíz de la materia"
```

## Datos

Sin campos nuevos. Usa `cursos.<clave>.omitidos` (RN-31, ya existente) y `cursos.<clave>.temas.<tema>` con `"."`. El estado `regla` es sólo de sesión y sale de `vistas.ts` L246-261; RN-10 lo cambia en memoria del editor, no en el índice.

## Requisitos no funcionales

- **NFR-1** — La condición «sin destino» existe en **un** lugar de `editor.html`; ninguno de los cuatro sitios la reimplementa.
- **NFR-2** — Reconocer videollamadas no agrega un tercer listado de dominios: se reutiliza el de RN-32 o se extrae a un módulo común (decisión del plan; hoy vive dentro de `esEnlaceVideollamada` en `sitio/google-classroom/scraper.js` ~L520, que va inyectado y no se puede importar).
- **NFR-3** — El humo `backend/adopcion/humo-editor-indice.js` cubre AC-1, AC-3, AC-4, AC-8, AC-9 y AC-10.

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
|---|---|---|
| Acción masiva vs regla persistente | Puntual (A4) | Evita estado nuevo en el índice; una videollamada nueva rara vez hace falta ocultarla otra vez. |
| Marca por bandera vs por dominio | Por dominio de la URL en la clave (A7) | El editor recibe `vistos` sin `esVideollamada`; no hay que tocar el contrato. |
| `.` como faltante vs destino válido | Válido si `regla = "si"` (A10, A11) | `vistas.ts` ya lo trata así; el defecto es del editor. |
| Elegir `.` es decisión | Sí, en el acto (A13) | Si no, el dueño no tiene cómo cerrar un tema nuevo a raíz. |

## Preguntas abiertas

- **PA-1** — Si el curso tiene un tema ya omitido por completo (`-`) con videollamadas adentro, ¿cuenta para N? **Propuesta**: no (están omitidas por el tema); se decide al plan, no cambia el comportamiento visible salvo el conteo.

## Dependencias

- **Plan 22 (disco manda)** modifica `editor.html`, `vistas.ts` y `propuesta.ts`. Esta spec toca `editor.html` y no `vistas.ts`. El plan decide el orden de construcción; no hay choque lógico, sólo de archivos.

## Secciones condicionales

- **Incluidas**: tabla de decisión (el estado de un tema cruza `destino`, `regla`, decisión del dueño y omisión, y el orden importa), wireframes (toca interfaz), dependencias.
- **Descartadas**: contrato de interfaz (no hay API nueva), diagrama de estados (no hay máquina de estados), glosario (menos de cinco términos), mediciones pendientes (no quedó ningún `M-n`).
