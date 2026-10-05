# Subcarpeta por tema dentro de la carpeta destino

**Estado:** aprobada · **Fecha:** 2026-10-04 · **Firma:** tanda agy 3.8 flash high

## Historia

Como dueño, quiero que cada tema del curso (p. ej. «Series» dentro de Teorías) proponga crear su propia
subcarpeta bajo la carpeta de destino, para que la ruta sea `Materia/Teorias/<docente>/Series/archivo` y no
cientos de archivos sueltos en la raíz de `Teorias/`.

## Contexto y problema

- Hoy el destino es **uno por tema**, de un conjunto fijo (`docs/specs/classroom-destino/spec.md` RN-3, RN-6), y
  la ruta es `Materia/<destino>[/<docente>]/archivo`. Todos los temas con destino `Teorias` caen en la misma carpeta.
- En materias con muchos temas (Mate C: 9 temas sólo en Sites) la carpeta se llena y los nombres chocan (RN-16).
- Se desbloquea: carpetas navegables por tema sin mover nada de lo ya descargado.

## Alcance

**Incluye**
- Una subcarpeta con el nombre del tema, entre la carpeta de destino (y docente) y el archivo.
- Una casilla por tema en el editor, un interruptor masivo por curso, y la ruta en vivo con la subcarpeta.
- Los cuatro portales (Classroom, Moodle LINTI, Moodle Asignaturas, Sites Mate C), porque comparten el índice.
- La vía CLI de adopción (`generar.js` / `aplicar.js`), con paridad de ruta.

**No incluye**
- Mover archivos ya descargados (RN-12).
- Subcarpetas de más de un nivel (un tema = un segmento).
- Reconocer una carpeta existente que sólo difiere en mayúsculas (PA-1).
- Cambios en el descargador en tiempo de ejecución: lee la carpeta ya resuelta del índice (`core/destino/propuesta.ts:133`).

## Actores

| Actor | Puede |
|---|---|
| Dueño | Encender/apagar la subcarpeta por tema o por curso, ver la ruta en vivo, guardar |
| Extensión | Proponer encendida en temas nuevos; calcular la ruta; escribir la carpeta resuelta en el índice |

## Reglas de negocio

- **RN-1** — La subcarpeta aplica a todo destino con carpeta (`Teorias`, `Practicas`, `Laboratorios`, `Parciales`, `Finales`, `Bibliografia`, `Notas`).
- **RN-2** — Un tema con destino raíz (`.`) o `-` no lleva subcarpeta.
- **RN-3** — «Novedades» y «Sin tema» nunca llevan subcarpeta.
- **RN-4** — La regla es una sola función para los cuatro portales y las dos vías (editor y CLI).
- **RN-5** — Ruta: `Materia/<destino>/<docente>/<tema>/archivo`. El docente sólo existe en `Teorias` (RN-4 de `classroom-destino`) y va **antes** del tema.
- **RN-6** — El nombre de la carpeta es el tema con la primera letra en mayúscula, sin acentos, con `\ / : * ? " < > |` y caracteres de control reemplazados por `-`, y sin `..`. «Series» → `Series`.
- **RN-7** — Los espacios se conservan (se colapsan y se recortan los de los extremos): «Clases teóricas - Módulo I» → `Clases teoricas - Modulo I`.
- **RN-8** — Si el nombre queda vacío tras sanear (o es `.`), no hay subcarpeta.
- **RN-9** — Dos temas que dan el mismo nombre en el mismo destino comparten carpeta; los choques de archivo siguen resueltos por RN-16 de `classroom-destino`.
- **RN-10** — No hay umbral de archivos: un tema con un solo archivo también lleva su subcarpeta.
- **RN-11** — El `modN_` del nombre del archivo (RN-12 de `classroom-destino`) se conserva dentro de la subcarpeta.
- **RN-12** — Los archivos `ya-esta` y `🔒 en disco` no se mueven. Sólo el material nuevo va a la subcarpeta.
- **RN-13** — Un archivo con carpeta propia (`destinoPropio`) va a esa carpeta tal cual, sin subcarpeta de tema.
- **RN-14** — «↺ Que hereden» (plan 17) hace que el archivo herede la carpeta **con** la subcarpeta del tema.
- **RN-15** — El estado de la subcarpeta de un tema **se deriva de la carpeta guardada** en `cursos.<clave>.temas.<tema>`: si es `destino[/docente]/<tema>` está encendida; si es `destino[/docente]` está apagada. El índice no gana ningún campo (`version: 1`).
- **RN-16** — Las subcarpetas se crean al usarlas, sin confirmar, como los destinos de RN-3 de `classroom-destino`.
- **RN-17** — Un tema cuya carpeta guardada no es de la forma `destino[/docente]/<tema>` (nuevo, o guardado en `.` o `-`) y cuyo nombre admite subcarpeta (RN-3, RN-8) se propone **encendido**; el efecto real sólo existe si su destino tiene carpeta (RN-2). Un tema guardado con carpeta de destino sin tema (`Teorias/Gomez`) se muestra **apagado**.
- **RN-18** — El editor ofrece un interruptor por curso que enciende o apaga la subcarpeta en todos los temas elegibles del curso a la vez.
- **RN-19** — La ruta calculada en vivo y la detección de choques usan la ruta completa con la subcarpeta.
- **RN-20** — Mientras el editor está abierto, cambiar el destino de un tema a `.` o `-` deja la subcarpeta sin efecto (casilla deshabilitada) y al volver a un destino con carpeta recupera su estado. Al guardar con `.` o `-` ese estado no se conserva.

## Flujos

**Camino feliz.** El dueño abre el editor de un curso con temas nuevos → cada tema con destino ve su casilla «📁 Subcarpeta del tema» encendida → la ruta en vivo muestra `Teorias/Gomez/Series/mod1_series.pdf` → guarda → el índice guarda `temas["Series"] = "Teorias/Gomez/Series"` → el descargador baja a esa carpeta.

| # | Alternativo | Resultado |
|---|---|---|
| A1 | Tema con destino `.` | Casilla deshabilitada y apagada |
| A2 | Tema «Novedades» / «Sin tema» | Casilla deshabilitada y apagada |
| A3 | Tema omitido (`-`) | Casilla deshabilitada; el estado previo se recuerda y vuelve al des-omitir |
| A4 | Tema ya guardado sin subcarpeta | Se muestra apagada; encenderla no mueve lo ya descargado |
| A5 | Nombre de tema vacío tras sanear | Casilla deshabilitada |
| A6 | Archivo con carpeta propia | Ruta sin subcarpeta; «↺ Que hereden» lo devuelve a la del tema |
| A7 | Carpeta de tema editada a mano en el índice (no invertible) | Se conserva tal cual, como hoy (D-6) |

## Datos

- Índice sin cambios de esquema. `cursos.<clave>.temas.<tema>` pasa a poder valer `Teorias/Gomez/Series` (carpeta resuelta, relativa a la materia).
- Fila de tema del editor: campo nuevo `subcarpeta: "si" | "no"` (sólo en el editor y en `temas.tsv`; **no** se guarda en el índice).
- `temas.tsv`: columna opcional `subcarpeta`; si falta se lee como `no` (retrocompatible).
- Validación: el nombre de subcarpeta nunca contiene separadores de ruta ni `..`.

## Criterios de aceptación

```gherkin
AC-1 — Ruta con docente
  Dado un curso con docente «Gomez» y el tema «Series» con destino Teorias y subcarpeta encendida
  Cuando se calcula la carpeta del tema
  Entonces es «Teorias/Gomez/Series»

AC-2 — Ruta sin docente
  Dado un curso sin docente y el tema «Series» con destino Teorias y subcarpeta encendida
  Cuando se calcula la carpeta del tema
  Entonces es «Teorias/Series»

AC-3 — Destinos sin docente
  Dado el tema «Guía 1» con destino Practicas y subcarpeta encendida
  Cuando se calcula la carpeta del tema
  Entonces es «Practicas/Guia 1»

Esquema del escenario AC-4 — Sin subcarpeta
  Dado el tema "<tema>" con destino "<destino>" y subcarpeta encendida
  Cuando se calcula la carpeta del tema
  Entonces es "<carpeta>"
  Ejemplos:
    | tema      | destino | carpeta |
    | Series    | .       | .       |
    | Series    | -       | -       |
    | Novedades | Teorias | Teorias |
    | Sin tema  | Teorias | Teorias |
    | ???       | Teorias | Teorias |

Esquema del escenario AC-5 — Nombre de la subcarpeta
  Dado un tema llamado "<tema>"
  Cuando se calcula su nombre de subcarpeta
  Entonces es "<nombre>"
  Ejemplos:
    | tema                          | nombre                       |
    | series                        | Series                       |
    | Clases teóricas - Módulo I    | Clases teoricas - Modulo I   |
    | TP 1: Límites / Derivadas     | TP 1- Limites - Derivadas    |
    | ..                            |                              |

AC-6 — Estado derivado de la carpeta guardada
  Dado un índice con temas["Series"] = «Teorias/Gomez/Series» y docente «Gomez»
  Cuando se abre el editor
  Entonces el tema «Series» muestra destino Teorias y la casilla encendida
  Y con temas["Series"] = «Teorias/Gomez» muestra la casilla apagada

AC-7 — Ida y vuelta byte-idéntica
  Dado un índice cualquiera y ningún cambio en el editor
  Cuando se guarda
  Entonces el índice resultante es byte-idéntico al original

AC-8 — Tema nuevo encendido
  Dado un curso nuevo con el tema «Series» sugerido como Teorias
  Cuando se abre el editor
  Entonces la casilla del tema está encendida y la ruta en vivo incluye «Series/»

AC-9 — Lo descargado no se mueve
  Dado un archivo ya descargado en «Teorias/Gomez/» del tema «Series»
  Cuando el dueño enciende la subcarpeta del tema y guarda
  Entonces el archivo sigue en «Teorias/Gomez/» y el índice de archivos no cambia
  Y un archivo nuevo del mismo tema va a «Teorias/Gomez/Series/»

AC-10 — Carpeta propia del archivo
  Dado un archivo con carpeta propia «Practicas» en un tema con subcarpeta encendida
  Cuando se calcula su ruta
  Entonces es «Practicas/<archivo>», sin la subcarpeta del tema

AC-11 — Heredar incluye la subcarpeta
  Dado un archivo con carpeta propia en el tema «Series» con destino Teorias, docente «Gomez» y subcarpeta encendida
  Cuando el dueño toca «↺ Que hereden»
  Entonces el archivo pasa a «Teorias/Gomez/Series»

AC-12 — Interruptor masivo
  Dado un curso con tres temas elegibles, uno con destino «.»
  Cuando el dueño apaga el interruptor del curso
  Entonces los tres quedan apagados y el de destino «.» sigue deshabilitado
  Y al encenderlo, los dos con destino con carpeta quedan encendidos

AC-13 — Omitir y des-omitir
  Dado un tema con destino Teorias y subcarpeta encendida
  Cuando el dueño lo omite y lo vuelve a marcar
  Entonces recupera destino Teorias y la subcarpeta encendida

AC-14 — Paridad editor/núcleo
  Dado la misma lista de casos de AC-1 a AC-5
  Cuando se calcula la carpeta con el editor y con el núcleo
  Entonces ambos devuelven lo mismo

AC-15 — Choques con la ruta completa
  Dado dos temas distintos con el mismo nombre de archivo, uno con subcarpeta y otro sin ella, en Teorias
  Cuando el editor recalcula choques
  Entonces no se marcan como choque, porque las rutas completas difieren

AC-16 — CLI retrocompatible
  Dado un temas.tsv sin columna «subcarpeta»
  Cuando se aplica la adopción
  Entonces la carpeta de cada tema es la de hoy, sin subcarpeta
```

## Requisitos no funcionales

- **NFR-1** — Un solo cálculo de ruta: `core/destino/carpetas.ts` es la fuente y `editor.html` lo replica con un test de paridad (AC-14).
- **NFR-2** — Sin cambios de esquema ni de contrato HTTP; el descargador en ejecución no se toca.

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
|---|---|---|
| 1-4 alcance | Todos los destinos con carpeta y los cuatro portales | Pedido del dueño: «cada subcarpeta de teorías y eso» |
| 5 orden | docente antes que tema | Patrón de `Teorias/<Apellido>/` ya en el árbol (RN-4) |
| 6-8 nombre | Mayúscula inicial, sin acentos, espacios conservados | `Teorias/` y `Practicas/` ya van sin acento y capitalizadas; `sanearNombreCarpeta` (`core/util/texto.ts:97`) daría `series` y `clases_teoricas_modulo_i`, que no se parecen al árbol del dueño |
| 9-11 | Comparten carpeta; sin umbral; `modN_` queda | Regla pareja y predecible |
| 12-14 | `ya-esta` y propios no se mueven; heredar incluye la subcarpeta | RN-5 y plan 17 |
| **15 (cambia)** | **El estado se deriva de la carpeta guardada, sin campo nuevo en el índice** | `propuesta.ts:133` lee `curso.temas[tema]` como carpeta ya resuelta; un campo `subcarpeta` en el índice obligaría a tocar el descargador, y `invertirCarpeta` (D-6) ya es el patrón para derivar el estado |
| 16 | La carpeta existente se reusa sólo si el nombre es exacto | Reconocer por mayúsculas exige disco y el editor corre en navegador (PA-1) |
| 17-18 | Casilla por tema + interruptor por curso, encendida por defecto en temas nuevos | Resuelve «millones de archivos en la raíz» sin pedir trabajo al dueño |
| 19-20 | Ruta en vivo con subcarpeta; se crean al usarlas | Igual que RN-3 |
| 21 | Un test de paridad editor/núcleo | `editor.html:1249` ya declara «idéntica a carpetas.ts» sin que nada lo verifique |

## Preguntas abiertas

- **PA-1** — Si ya existe `series/` (minúscula) y la subcarpeta calculada es `Series/`, se crean dos carpetas. Se acepta por ahora; se resuelve si aparece en el árbol real.

## Secciones condicionales descartadas

- **Tabla de decisión:** las condiciones (destino, nombre válido, omitido, estado previo) no se cruzan con orden relevante; las cubre RN-1..3 y RN-20.
- **Wireframes:** el cambio de interfaz es una casilla y un interruptor dentro de tarjetas existentes; el plan los ubica por línea.
- **Contrato de interfaz, diagrama de estados, glosario, dependencias:** sin API nueva, sin máquina de estados, menos de cinco términos nuevos, sin precondiciones.
