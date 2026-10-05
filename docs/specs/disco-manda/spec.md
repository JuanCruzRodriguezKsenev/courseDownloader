# Lo que está en disco manda: nombre y ruta de un archivo movido o renombrado

**Estado:** `aprobada` por el dueño el 2026-10-04. M-1 y M-2 medidos (abajo). **Fecha:** 2026-10-04.
**Origen:** pedido del dueño, 2026-10-04, tras verificar el plan 20.
**Traza:** `docs/specs/disco-manda/assumptions.md`.
**Extiende, no reemplaza:** `docs/specs/classroom-destino/spec.md` (RN-18 a RN-22, RN-30, tabla de decisión «Qué ya está descargado»). Cuando esta spec dice «classroom-destino RN-19» se refiere a esa. Si hay contradicción, **gana ésta, y sólo en lo que dice expresamente que cambia** (marcado con **Cambia** abajo).

---

## Historia

Como dueño que reordena a mano el árbol de la facultad, quiero que la extensión, **antes de proponer un nombre o una carpeta**, mire si ese archivo ya está en mi árbol —movido o renombrado— y use lo que hay escrito en disco, para no ver una propuesta que contradice lo que ya decidí ni bajar de nuevo lo que ya tengo.

## Contexto y problema

**Ya existe, y esta spec lo generaliza:** para un archivo cuyo id figura en el índice y que no está en la ruta anotada, el backend busca su md5 en toda la raíz y, si lo encuentra, devuelve el **nombre y la ruta del disco** y corrige el índice (fila 2 de la tabla de decisión; `backend/destino/estado.js`, llamado desde `backend/handlers.js:544`). El nombre que calcularía `proponerNombre` no interviene en ese caso.

**Qué falta** (leído en el código, 2026-10-04):

1. El **editor de adopción** arma las filas «ya está» con lo anotado en el índice, sin mirar el disco (`core/destino/vistas.ts:288-293`). Si moviste algo desde el último escaneo, el editor muestra la ruta vieja.
2. Un archivo cuyo id **no** figura en el índice pero que ya pusiste en el árbol: su md5 no se conoce hasta bajarlo, y hoy sólo se reconoce si hay uno idéntico en la **carpeta destino** (`backend/destino/escritura.js:97-155`, fila 5). Si lo pusiste en otra materia o carpeta, se escribe un duplicado.
3. Cuando el md5 aparece en **varios** lugares, `buscarPorMd5` devuelve el primero que encuentra al recorrer el árbol (`backend/destino/recorrido.js:48`), sin criterio.
4. El CLI `generar` es la adopción de una sola vez (classroom-destino PA-3). **Sí mira el disco por md5**, pero con su propio código y un alcance menor: arma un índice de md5 sólo de las materias de su semilla (`backend/adopcion/generar.js:153-172`), no de la raíz entera. Es una de las dos implementaciones separadas de la propuesta (deuda `docs/TECHNICAL_DEBT.md` §23).
5. Cuando el sistema corrige la ruta de un archivo movido, **no avisa**: el archivo cambia de lugar en la lista y el dueño no sabe por qué.

## Alcance

**Incluye**
- Que popup, editor y descarga usen **una sola** lectura del disco para decidir nombre y ruta de lo que ya está en el índice.
- Ampliar el reconocimiento de lo descargado por md5 de la carpeta destino a **toda la raíz** (RN-5).
- Un criterio para elegir entre varias copias (RN-4).
- Una marca «movido» que avise cuando se detecta un cambio (RN-10).

**No incluye**
- Aprendizaje de reglas, descarga en bruto a una carpeta aparte y verificación nueva de archivos (descartados por el dueño).
- Un índice de disco persistente ni campos nuevos en `.course-downloader.json` (`version: 1` se mantiene). Ver NFR-1.
- Mover, renombrar o borrar archivos del dueño (classroom-destino NFR-4).
- Cambiar qué pasa con lo borrado (classroom-destino RN-22) ni con lo movido a `Wiki/`, `Mis notas/` o `Clases/`.

## Actores

| Quién | Qué puede hacer |
| :-- | :-- |
| Dueño | Mueve y renombra archivos a mano, en el árbol o en Obsidian. Nunca edita el índice. |
| Backend | Lee el disco y el índice, corrige el índice, calcula md5. Es el único que toca disco. |
| Popup | Muestra el resultado; no calcula nada. |
| Editor de adopción | Muestra y edita filas; las de archivos reubicados no se editan (RN-11). |
| CLI `generar` | Adopción de una sola vez; fuera del alcance de las reglas (PA-2). |

## Reglas de negocio

- **RN-1 — El disco manda.** Para un archivo cuyo id figura en el índice y cuyo contenido (md5) está en la raíz, el nombre y la ruta que se **muestran**, se **anotan en el índice** y se **usan para descargar** son los del disco. Nunca los que calcularía `proponerNombre`, y nunca los del índice si difieren. *(Es classroom-destino RN-19 declarada como principio general.)*
- **RN-2 — Una sola lectura.** Popup, editor y descarga obtienen ese resultado de **la misma función** (`calcularEstado`). No hay una copia en el editor. El CLI `generar` no entra en esta regla (PA-2).
- **RN-3 — Dónde se busca.** En toda la raíz, salvo las carpetas `Wiki/`, `Mis notas/` y `Clases/` en cualquier nivel (classroom-destino RN-19). Sin cambios.
- **RN-4 — Varias copias. Cambia.** Si el md5 aparece en más de un lugar de la raíz, gana la copia **modificada más recientemente**. *(Hoy gana la primera que se encuentra al recorrer el árbol.)* Una copia en la ruta anotada nunca llega acá: ya decidió la fila 1.
- **RN-5 — Id desconocido, md5 ya en la raíz. Cambia.** Un archivo cuyo id **no** figura en el índice se baja igual (su md5 no se conoce antes). Al terminar, si su md5 ya existe **en cualquier lugar de la raíz** —con las exclusiones de RN-3—, se **descarta sin escribir** y se anota en el índice con el nombre y la ruta del disco. *(Hoy sólo se mira la carpeta destino: classroom-destino RN-20, fila 5.)* Los destinos `.md` siguen como en classroom-destino RN-30.
- **RN-6 — El nombre del disco es tal cual.** Se usa sin saneo ni normalización —con espacios, tildes y mayúsculas— y **no pasa** por RN-16 ni RN-16a de classroom-destino (choques de nombre): si el dueño lo eligió, es suyo.
- **RN-7 — Renombrar es mover.** Un archivo renombrado dentro de su misma carpeta se trata igual que uno movido a otra.
- **RN-8 — No encontrado.** Si el id figura y su md5 no está en ningún lado, sigue como hoy: se baja con el nombre del índice (classroom-destino RN-22). Lo movido a `Wiki/`, `Mis notas/` o `Clases/` cuenta como no encontrado.
- **RN-9 — Curso sin asociar.** Se aplica RN-1 a los archivos cuyo id **figure** en el índice, aunque el curso no esté asociado (por ejemplo, uno desasociado después). Los demás no tienen nada que mirar: su md5 se desconoce y siguen sin carpeta propuesta (classroom-destino RN-2).
- **RN-10 — Marca «movido».** El resultado de un archivo cuya ruta o nombre se corrigió en este escaneo lleva `movido: true`, y el popup y el editor lo muestran con la marca «movido». La marca **no se guarda**: como el índice queda corregido, en el escaneo siguiente el archivo se ve como cualquier otro «ya está».
- **RN-11 — Inmutable en el editor.** La fila de un archivo reubicado se muestra como las descargadas: sin editar nombre ni carpeta (plan 08h de classroom-destino).
- **RN-12 — Raíz inaccesible.** Si la raíz no se puede leer, no se corrige nada, se avisa, y **nunca** se asume que los archivos se borraron.
- **RN-13 — Mismo contenido, dos ids.** Dos ids distintos con el mismo md5 resuelven al mismo archivo del disco y se muestran con la misma ruta (classroom-destino RN-20, A7).

## Flujos

**Camino feliz — moviste un archivo y escaneás**
1. Moviste `05_capacitores.pdf` de `Fisica 2/Teorias/Palacio` a `Fisica 2/Practicas` y lo renombraste `cap_5.pdf`.
2. Escaneás el curso en el popup.
3. El backend ve que el id figura pero el archivo no está en la ruta anotada, encuentra su md5 en `Fisica 2/Practicas/cap_5.pdf`, corrige el índice y responde nombre `cap_5.pdf`, ruta `Ingenieria/Fisica 2/Practicas`, `movido: true`.
4. El popup lo lista como «ya está», con esa ruta y la marca «movido». No se baja nada.
5. Abrís el editor: la misma fila aparece con la misma ruta, inmutable.

| # | Caso alternativo | Resultado |
| :-- | :-- | :-- |
| A1 | El md5 está en dos lugares | Gana la copia más reciente (RN-4) |
| A2 | El id no figura y el md5 está en otra materia | Se baja, se descarta sin escribir, se anota con la ruta del disco (RN-5) |
| A3 | El id figura y el md5 no está en ningún lado | Se baja con el nombre del índice (RN-8) |
| A4 | Lo moviste a `Mis notas/` | Cuenta como no encontrado: se baja de nuevo (RN-8) |
| A5 | Renombraste dentro de la misma carpeta | Igual que moverlo (RN-7) |
| A6 | El nombre del disco tiene espacios y tildes | Se muestra tal cual (RN-6) |
| A7 | La raíz está en un disco desmontado | No se corrige nada y se avisa (RN-12) |
| A8 | Escaneás dos veces seguidas | La marca «movido» sólo aparece en el primero (RN-10) |
| A9 | Editaste a mano un `.md` | Sin cambios: classroom-destino RN-30 va antes que todo |
| A10 | El id no figura, el nombre de destino ya está ocupado por **otro** contenido, y el md5 del archivo bajado ya existe en otra parte de la raíz | Se descarta sin escribir y **sin error**: el contenido ya está en el árbol, así que no hay nada que escribir y por lo tanto no hay conflicto (RN-5 va antes del rechazo `DESTINO_OCUPADO`) |

## Tabla de decisión

Se evalúa en orden; la primera fila que coincide, decide. Extiende la de classroom-destino §«Qué ya está descargado»: las filas 0, 0b, 1, 2, 3, 4 y 6 **no cambian**; la **5 se parte en 5a y 5b**.

| # | ¿id en el índice? | ¿en la ruta anotada? | ¿md5 en la raíz? | Acción |
| :-- | :-- | :-- | :-- | :-- |
| 0, 0b | — / sí (acceso) | — | — | Sin cambios (RN-30, RN-29a) |
| 1 | sí | sí | — | No bajar. Usar lo del índice. |
| 2 | sí | no | sí, en 1 lugar | No bajar. **Usar nombre y ruta del disco, corregir el índice, marcar `movido`** (RN-1, RN-10). |
| **2b** | sí | no | sí, en 2 o más lugares | Igual que la 2, con la copia **más reciente** (RN-4). |
| 3 | sí | no | no | Bajar con el nombre del índice (RN-8). |
| 4 | no | — | — | Bajar, calcular md5 → fila 5a, 5b o 6. |
| 5a | no | — | sí, en la carpeta destino | Descartar sin escribir. Anotar. *(Sin cambios.)* |
| **5b** | no | — | sí, **fuera** de la carpeta destino pero dentro de la raíz | **Descartar sin escribir. Anotar con la ruta y el nombre del disco** (RN-5). |
| 6 | no | — | no | Escribir con el nombre propuesto. Anotar. |

**Lo que expone esta tabla:** la 2b y la 5b no existían, y la 5b contradice a propósito el texto de classroom-destino RN-20 («carpeta destino»). Con 5a antes que 5b, el caso viejo no cambia: sólo cambia lo que antes caía en la 6 y escribía un duplicado.

## Wireframes

Sólo cambia la fila del archivo reubicado. Estado base del popup, con la marca:

```
┌──────────────────────────────────────────────────────────────────┐
│ ✓ cap_5.pdf                                          [movido]   │
│   Ingenieria/Fisica 2/Practicas                                  │
└──────────────────────────────────────────────────────────────────┘
```

En el escaneo siguiente, la misma fila sin la marca:

```
┌──────────────────────────────────────────────────────────────────┐
│ ✓ cap_5.pdf                                                      │
│   Ingenieria/Fisica 2/Practicas                                  │
└──────────────────────────────────────────────────────────────────┘
```

En el editor, la fila usa el estilo de las descargadas (candado «en disco», sin campos editables) más la misma marca.

## Contrato de interfaz

Respuesta de `POST /api/destino/estado` (`backend/handlers.js:538-544`, ruta en `backend/server.js:89`): cada elemento de `items` suma **un campo**. Los demás no cambian.

```json
{
  "idArchivo": "1a2b3c4d5e6f",
  "estado": "descargado",
  "fila": "2",
  "rutaDestino": "Ingenieria/Fisica 2/Practicas",
  "nombre": "cap_5.pdf",
  "sinAsignar": false,
  "omitido": false,
  "movido": true
}
```

`movido` es `true` sólo si en esta llamada se corrigió la ruta o el nombre del índice (filas 2 y 2b), y `false` o ausente en cualquier otro caso. Un cliente viejo que no lo conozca lo ignora. Error de raíz inaccesible (RN-12): la misma forma de error que hoy devuelve el índice ilegible (`ok: false`, `error`), y ningún item corregido.

## Criterios de aceptación

```gherkin
AC-1 — Un archivo movido se muestra con la ruta del disco
  Dado un archivo con id en el índice, anotado en "Ingenieria/Fisica 2/Teorias/Palacio/05_capacitores.pdf"
    y movido por el dueño a "Ingenieria/Fisica 2/Practicas/05_capacitores.pdf"
  Cuando el dueño escanea el curso en el popup
  Entonces la lista muestra el archivo como "ya está" en "Ingenieria/Fisica 2/Practicas"
    y lleva la marca "movido"
    y no se baja nada
    y el índice anota la ruta nueva

AC-2 — Un archivo renombrado en la misma carpeta
  Dado un archivo anotado como "05_capacitores.pdf"
    y renombrado por el dueño a "Capacitores (clase 5).pdf" en la misma carpeta
  Cuando el dueño escanea el curso
  Entonces la lista muestra el nombre "Capacitores (clase 5).pdf", con tildes, espacios y paréntesis tal cual
    y no pasa por ninguna regla de choques

AC-3 — El editor muestra lo que hay en disco
  Dado un archivo con id en el índice que el dueño movió desde el último escaneo
  Cuando el dueño abre el editor de adopción
  Entonces la fila del archivo muestra la ruta y el nombre del disco
    y la fila no se puede editar

AC-4 — Un archivo desconocido que ya está en otra materia
  Dado un adjunto cuyo id no figura en el índice
    y cuyo contenido ya existe en "Ingenieria/Fisica 1/Teorias/Lucila/mod1_01.pdf"
  Cuando el dueño lo descarga hacia "Ingenieria/Fisica 2/Teorias/Palacio"
  Entonces no se escribe ningún archivo en "Fisica 2"
    y el índice anota el id con la ruta "Ingenieria/Fisica 1/Teorias/Lucila" y el nombre "mod1_01.pdf"

AC-5 — Varias copias: gana la más reciente
  Dado un archivo con id en el índice, ausente de su ruta anotada
    y su contenido en "Practicas/a.pdf" modificado el 2026-09-01
    y el mismo contenido en "Parciales/a.pdf" modificado el 2026-10-02
  Cuando el dueño escanea el curso
  Entonces la ruta resultante es "Parciales"

AC-6 — No encontrado se vuelve a bajar
  Dado un archivo con id en el índice cuyo contenido no está en ningún lugar de la raíz
  Cuando el dueño escanea el curso
  Entonces el archivo figura como pendiente con el nombre del índice

AC-7 — Lo movido a una carpeta excluida no cuenta
  Dado un archivo con id en el índice que el dueño movió a "Mis notas/"
  Cuando el dueño escanea el curso
  Entonces el archivo figura como pendiente

AC-8 — La marca «movido» no persiste
  Dado un archivo que el dueño movió y que el primer escaneo corrigió
  Cuando el dueño escanea el mismo curso otra vez
  Entonces el archivo figura como "ya está" sin la marca "movido"

AC-9 — La raíz inaccesible no corrige nada
  Dado que la raíz configurada no se puede leer
  Cuando el dueño escanea el curso
  Entonces la respuesta es un error de raíz
    y el índice no cambia
    y ningún archivo figura como pendiente por "no encontrado"

AC-10 — Destino ocupado, pero el contenido ya está en otra parte
  Dado un adjunto cuyo id no figura en el índice
    y cuyo contenido ya existe en "Ingenieria/Fisica 1/Teorias/Lucila/mod1_01.pdf"
    y un archivo distinto llamado igual que su destino en "Ingenieria/Fisica 2/Teorias/Palacio"
  Cuando el dueño lo descarga hacia "Ingenieria/Fisica 2/Teorias/Palacio"
  Entonces no se produce ningún error de destino ocupado
    y no se escribe nada
    y el índice anota la ruta "Ingenieria/Fisica 1/Teorias/Lucila"

AC-11 — Un .md editado a mano sigue como hoy
  Dado un destino ".md" que el dueño editó
  Cuando el dueño escanea el curso
  Entonces no se escribe, se anota si faltaba y no se compara por contenido
AC-12 — Un curso desasociado mira el disco para los ids que figuran
  Dado un curso que ya no está asociado en el índice
    y un archivo suyo con id en el índice que el dueño movió
  Cuando el dueño escanea el curso
  Entonces el archivo muestra la ruta y el nombre del disco
    y los archivos sin id en el índice siguen sin carpeta propuesta
```

## Requisitos no funcionales

- **NFR-1 — Costo de la búsqueda.** Medido el 2026-10-04 en `~/Boveda/Areas/Facultad` (1651 archivos, 1,0 GB sin `Wiki`, `Mis notas` ni `Clases`): recorrer el árbol 34 ms; calcular el md5 de todos la **primera** vez después de levantar el servidor 4955 ms; con la caché en memoria 42 ms. Por eso no se agrega índice de disco ni campo de tamaño. **M-1 (2026-10-04):** con los archivos sacados de la caché del sistema (`posix_fadvise DONTNEED` sobre los 1661) tardó **4890 ms**, igual que antes: el costo es de CPU, no de disco. Si el árbol creciera mucho, los caminos conocidos son filtrar por tamaño y persistir la caché; quedan fuera de esta spec.
- **NFR-2 — El árbol del dueño es inmutable** (classroom-destino NFR-4): ninguna regla de esta spec escribe, mueve o renombra un archivo suyo. Lo único que se escribe es el índice.
- **NFR-3 — Sin migración.** El índice sigue en `version: 1` con los mismos campos.

## Supuestos resueltos

| Supuesto | Decisión | Por qué |
| :-- | :-- | :-- |
| Sin aprendizaje, sin carpeta bruta | Se descartan | El dueño los quitó de la idea; el índice ya identifica por id y md5. |
| Comparar índice contra disco | Ya existe (RN-19) | Lo corrige la fila 2; falta hacerlo en todas las superficies. |
| Elegir entre copias | La más reciente | Medido: de 354 entradas del índice real sólo **1** tiene una copia repetida, así que el criterio casi no se ejerce; la más reciente es la que el dueño tocó último. |
| Marca «movido» sin campo nuevo | Efímera, sólo en la respuesta | El dueño pidió no tocar el esquema; la consecuencia (AC-8) está dicha. |
| Índice por id más rápido | No hace falta | El índice por id ya existe; lo lento es hallar el md5, y mide 5 s la primera vez. |
| Raíz inaccesible | Sin correcciones, con aviso | Un disco desmontado no es lo mismo que un archivo borrado. |

## Preguntas abiertas

- **PA-1 — ¿Alcanza una marca que se pierde al escanear de nuevo?** Es la consecuencia directa de no guardar campos nuevos. Si el dueño quiere que «movido» persista hasta que lo revise, hace falta un campo en el índice, y eso rompe NFR-3.
- **PA-2 — ¿Se alinea el CLI `generar`?** Hoy compara por md5 sólo dentro de las materias de su semilla y con código propio. Alinearlo con esta spec (buscar en toda la raíz, con las mismas exclusiones y el desempate de RN-4) cambiaría una herramienta de adopción que ya se usó. **Recomendación:** dejarlo como está; es una corrida única y su resultado lo revisa el dueño a mano en las tablas.
- **PA-3 — RN-9 casi no se ejerce.** Un curso sin asociar casi nunca tiene ids en el índice. Se deja escrito porque un curso desasociado después sí puede tenerlos.

## Mediciones

| # | Qué medir | Cómo | Qué decide |
| :-- | :-- | :-- | :-- |
| M-1 ✅ | Arranque en frío real de la búsqueda por md5 | `posix_fadvise DONTNEED` sobre cada archivo de la Bóveda y repetir `recorrerRaiz` + `md5Archivo` | **4890 ms** en frío (límite de la spec: 15 s). NFR-1 vale. |
| M-2 ✅ | Si el escaneo de Classroom entrega `md5` o `bytes` antes de bajar | Buscar en `sitio/google-classroom` y mirar los items en vivo de `/adopcion/api/datos` | **No entrega ninguno** (el scraper no tiene esos campos; 0 de 5 filas con md5). RN-5 siempre cuesta bajar el archivo; no hay forma de evitarlo desde el escaneo. |

## Dependencias

- **Plan 21 (choques de nombre)** va antes: ambos tocan `core/destino/propuesta.ts` y `vistas.ts`, y el 21 ya cambia qué nombres se proponen. No es un bloqueo técnico, es de orden para no pisar archivos.
- `docs/specs/classroom-destino/spec.md`: esta spec modifica la tabla de decisión y RN-20; al ejecutar el plan hay que actualizar esa spec en el mismo cambio.

## Secciones condicionales

**Incluidas:** tabla de decisión (expuso las filas 2b y 5b), wireframes (la marca «movido»), contrato de interfaz (el campo `movido`), dependencias y mediciones.
**Descartadas:** diagrama de estados (no hay máquina de estados real, sólo una tabla de decisión) y glosario (los términos son los de classroom-destino).
