# Moodle de Asignaturas: escanear todos los cursos desde `/my/`

**Estado**: `draft` — dependen de **M-1** y **M-3** (§Mediciones pendientes) RN-8 y RN-12.
**Fecha**: 2026-10-05
**Autor**: tanda (Claude Sonnet 5.5)
**Firmado**: tanda claude sonnet 5.5
**Traza de decisiones**: [`assumptions.md`](./assumptions.md)
**Hereda de**: [`../moodle-asignaturas/spec.md`](../moodle-asignaturas/spec.md) (`asig:RN-n`), [`../moodle-ingenieria/spec.md`](../moodle-ingenieria/spec.md) (`ing:RN-n`), [`../classroom-escanear-todas/spec.md`](../classroom-escanear-todas/spec.md) (`todas:RN-n`) y [`../classroom-destino/spec.md`](../classroom-destino/spec.md) (`destino:RN-n`).

> ⚠️ **Los 14 supuestos se aprobaron en bloque y sin leerlos** (el dueño, 2026-10-05: *"aprobado sin leer"*).
> Ninguna regla fue discutida. Las de más filo están en §Las decisiones con más filo.

---

## Historia

> Como estudiante de Informática, quiero que la extensión escanee **todos mis cursos** del Moodle de
> Asignaturas (`asignaturas.info.unlp.edu.ar`) desde `/my/` de una vez, en vez de abrir cada curso,
> para tener la lista completa sin entrar uno por uno.

## Contexto y problema

`moodle-asignaturas` escanea hoy **un curso por vez**, el de la pestaña (`asig:RN-3`), y su Alcance
excluye «escaneo de todos los cursos desde la portada». Esta spec levanta esa exclusión.

Medido el 2026-10-05 (cuenta del dueño):
- `/my/` y `/my/courses.php` con filtro «Todos» muestran **un solo curso**: `id=82`, «2024_CURSADA REGULAR_Programación II».
- El HTML de `course/view.php?id=82` pedido con `fetch` trae las **158 actividades** (80 `resource`, 28 `url`,
  38 `label`, 6 `assign`, 3 `quiz`, 1 `forum`, 1 `choicegroup`, 1 `folder`) y **sin duplicados**
  (`actividades` = `unicas` = 158), en 385–508 ms.
- Eso contrasta con la medición del 2026-10-01, que vio secciones espejadas en el **DOM de la pestaña**: las
  duplicaciones salen del editor reactivo, no del HTML del servidor. `asig:RN-4a` se mantiene por si acaso.

Con un solo curso hoy el recorrido es trivial; la regla se escribe para cuando haya más (decisión del dueño: se hace igual, porque van a ir apareciendo).

## Alcance

**Incluye**
- «Escanear todos los cursos» desde `/my/` de `asignaturas.info.unlp.edu.ar`.
- El recorrido reusa el escaneo de un curso (`asig:RN-1..13`) sin cambiarlo.

**No incluye**
- Descargar solo: el recorrido termina en la lista.
- `moodle-linti` y `moodle-ingenieria` (cada portal con su propio corte).
- Agregar a la lista los `label` (Kaltura) ni otros tipos que `asig:RN-2` ya excluye.
- Cambiar el escaneo de un curso suelto.

## Actores

| Actor | Puede |
|---|---|
| Dueño | Abrir `/my/`, escanear todos, ver el resumen y la lista, bajar como hoy |
| Extensión | Recorrer los cursos de `/my/` con la sesión del navegador, en serie |
| Backend | Sin cambios; escanear no lo usa |

---

## Reglas de negocio

- **RN-1** — En `/my/` el popup ofrece **«Escanear todos los cursos»**, también cuando hay un solo curso; abrir el popup ahí no escanea solo (`ing:RN-14`). Dentro de un curso, abrir el popup escanea ese curso como hoy (`asig:RN-3`).
- **RN-2** — Entran los cursos de «Mis cursos»: los ids de `course/view.php?id=` de `/my/`, **desduplicados** y en el orden en que aparecen, incluidos los de años anteriores (`ing:RN-15`).
- **RN-3** — Los cursos se recorren **en serie** desde la pestaña `/my/` con `fetch` same-origin con credenciales. Nunca en paralelo ni en pestañas de fondo (`ing:RN-16`).
- **RN-4** — De cada curso se hace **lo mismo que el escaneo de un curso** (`asig:RN-1` a `asig:RN-13`): `resource`/`folder` como adjuntos, `url` como acceso `.md`, desduplicación por `cmid` (`asig:RN-4a`), `resource` incrustado resuelto con la regex de `asig:RN-10`. Ese escaneo no cambia.
- **RN-5** — Los `label` (Kaltura) y los demás tipos excluidos por `asig:RN-2` no se listan ni generan aviso.
- **RN-6** — Cada curso conserva su tope de 60 s (`topeEscaneoMs`). Un curso que lo supera se saltea, con el motivo en el resumen.
- **RN-7** — Un curso que falla por una causa **distinta de sesión** (HTML sin actividades donde se esperan, tope, error de red) se saltea y el recorrido sigue, con el motivo en el resumen (`todas:RN-8`).
- **RN-8** — **Sesión vencida** (la URL final va a `/login/`): el recorrido **se corta con aviso de sesión (sin reanudación: se conservan los cursos completos y el curso en el que venció no figura como fallido ni como vacío)** (`ing:RN-11`). El aviso de duración antes de arrancar sale de **M-1**.
- **RN-9** — Si el dueño navega fuera de `/my/`, o cierra la pestaña, el recorrido se corta: se conservan los cursos completos y se descarta el que estaba a medias (`todas:RN-9`).
- **RN-10** — Un curso sin material no aparece en la lista; cuenta como vacío en el resumen (`todas:RN-14`).
- **RN-11** — El progreso y el resultado se guardan a medida que avanza: cerrar el popup no corta el recorrido y al reabrirlo se ve el progreso o el resultado (`todas:RN-15`, `todas:RN-16`).
- **RN-12** — El recorrido termina en la lista: no encola ni descarga nada. La lista agrupa por curso y **reemplaza** a la guardada (`todas:RN-18`). Que el `fetch` avance con `/my/` en segundo plano es **M-3**.
- **RN-13** — Al terminar o cortarse hay un resumen: cursos con material, vacíos y fallidos con su motivo (`todas:RN-17`).
- **RN-14** — La clave de cada ítem lleva su curso, así dos cursos nunca comparten clave (ADR-0014): un mismo PDF subido a dos cursos aparece dos veces (`ing:RN-24`).
- **RN-15** — `moodle-asignaturas` declara `esPortada(url)` verdadera para `https://asignaturas.info.unlp.edu.ar/my/` y sus subrutas (`core/puertos/sitio.ts:300`; modelo: `sitio/google-classroom/config.ts:71`).
- **RN-16** — Valen sin cambio `destino:RN-1` a `destino:RN-30`, la asociación del curso a una materia en el editor y el nombre y color del portal.

## Flujos

**Camino feliz**
1. El dueño abre `/my/` y el popup ofrece «Escanear todos los cursos» con el aviso de duración.
2. Lo aprieta; la tarjeta muestra «Curso 1 de 1: Programación II».
3. Termina: resumen (1 con material) y lista agrupada por curso; baja como hoy.

**Alternativos**

| # | Cuándo | Qué pasa |
|---|---|---|
| A1 | Un curso falla o supera 60 s | Se saltea; fallido con su motivo (RN-6, RN-7) |
| A2 | Un curso sin material | No aparece en la lista; vacío en el resumen (RN-10) |
| A3 | Navega fuera de `/my/` a mitad | Se corta, se conservan los completos (RN-9) |
| A4 | Cierra el popup a mitad | El recorrido sigue (RN-11) |
| A5 | Sesión vencida | Se corta con aviso de sesión (RN-8) |
| A6 | Un solo curso en `/my/` | Se ofrece y corre igual (RN-1) |
| A7 | Todos fallan o están vacíos | No hay lista; sólo el resumen |

## Datos

- **Entidades nuevas:** ninguna. Reusa `Clase`/`ColaItem` con `sitioId: "moodle-asignaturas"` y `recorridoTodos`.
- **Retención:** la lista guardada y `recorridoTodos` son una sola y se reemplazan (RN-12).

## Criterios de aceptación

```gherkin
AC-1 — Botón en /my/
  Dado el popup abierto en asignaturas.info.unlp.edu.ar/my/ con un curso
  Cuando el popup termina de abrir
  Entonces ofrece "Escanear todos los cursos" con el aviso de duración
    y no escanea ningún curso

AC-2 — Un solo curso
  Dado /my/ con el curso 82 (158 actividades: 80 resource, 28 url, 1 folder)
  Cuando el dueño aprieta "Escanear todos los cursos"
  Entonces la tarjeta muestra "Curso 1 de 1"
    y el resumen cuenta 1 curso con material, 0 vacíos y 0 fallidos
    y la lista tiene sólo los resource, folder y url

AC-3 — Varios cursos
  Dado /my/ con 5 cursos, 2 sin material
  Cuando se escanea todo
  Entonces el resumen cuenta 5 cursos, 3 con material y 2 vacíos
    y la lista agrupa por curso sin mostrar los vacíos

AC-4 — Un curso falla
  Dado un recorrido donde el curso 3 supera los 60 s
  Cuando el recorrido continúa
  Entonces el curso 3 figura como fallido con su motivo
    y los cursos siguientes se escanean igual

AC-5 — Sesión vencida
  Dado un recorrido donde el curso 2 redirige a /login/
  Cuando se procesa
  Entonces el recorrido se corta con aviso de sesión
    y el curso 2 no figura como fallido ni como vacío

AC-6 — Cerrar el popup
  Dado un recorrido en el curso 2 de 5
  Cuando el dueño cierra y reabre el popup
  Entonces ve "Curso 3 de 5" o el resultado final
    y no se lanzó un escaneo nuevo

AC-7 — Navegar a mitad
  Dado un recorrido con 2 cursos completos y el tercero en curso
  Cuando el dueño navega fuera de /my/
  Entonces el recorrido queda cortado
    y la lista conserva los 2 completos sin el tercero

AC-8 — Mismo PDF en dos cursos
  Dado un PDF con el mismo nombre en dos cursos distintos
  Cuando se escanea todo
  Entonces aparece dos veces, una por curso, con claves distintas

AC-9 — Escaneo de un curso intacto
  Dado el popup abierto en course/view.php?id=82 sin recorrido en curso
  Cuando se abre
  Entonces escanea ese curso como hoy y reemplaza la lista guardada
    y no ofrece "Escanear todos los cursos"
```

## Requisitos no funcionales

- **NFR-1** — La incorporación no altera la baseline de tests existentes; el escaneo de un curso suelto no cambia.
- **NFR-2** — Los fixtures nuevos de `sitio/moodle-asignaturas/__fixtures__/` no contienen datos personales (sin `sesskey`, emails ni nombres).
- **NFR-3** — Concurrencia ≤ 4 dentro de un curso (`asig:NFR-3`); el recorrido entre cursos es en serie.

## Supuestos resueltos

Los 14 supuestos se aprobaron sin leer; la traza está en [`assumptions.md`](./assumptions.md).

## Preguntas abiertas

- Ninguna. **PA-1 resuelta (2026-10-05, dueño):** el multicurso se hace aunque hoy haya un solo curso, porque van a ir apareciendo más. Vale para todos los portales.

## Las decisiones con más filo

- **RN-1 / A6** — El botón se ofrece con un solo curso. Si molesta, es esconderlo cuando hay 1.
- **RN-2** — Entran los cursos de años anteriores. Hoy no pesa (1 curso); con muchos, ruido.
- **RN-8** — Sesión vencida: implementado como **corte** (decisión 3 del plan 29) en vez de pausa, porque no hay protocolo de reanudación y un Moodle con sesión vencida exige re-autenticar antes de poder seguir. Conserva los cursos ya terminados.
- **RN-4** — El recorrido hereda la resolución de 28 `url` + 80 `resource` por curso. Con Programación II el tiempo total no se midió (M-1).

## Mediciones pendientes

| M | Qué medir y cómo | Decide |
|---|---|---|
| M-1 | Con la extensión armada, lanzar el recorrido y anotar el tiempo por curso (con la resolución de `url` y `resource`) | El aviso de RN-8; si el tope de 60 s alcanza para 158 actividades |
| M-2 | **Resuelto** (2026-10-05): `/my/` = «Todos» = 1 curso (`id=82`) | RN-2 |
| M-3 | Con `/my/` en segundo plano 60 s, correr el recorrido y mirar si el `fetch` avanza | RN-12: si no, el aviso pide la pestaña al frente, como Classroom |

## Dependencias

- El recorrido de Moodle comparte `core/estado/recorridoTodos.ts` y `esPortada` con Ingeniería, que **todavía no tiene plan ni código**. El plan de este portal debe decidir si implementa primero el recorrido Moodle genérico (y Ingeniería lo reusa) o lo copia. Ver la decisión pendiente con el dueño.

**Secciones condicionales descartadas:** tabla de decisión (la del popup al abrirse es la de Classroom y no se cruza con nada nuevo); wireframes (reusa el botón y el loader de Classroom); contrato de interfaz (no hay API propia); diagrama de estados (lo cubre `recorridoTodos`); glosario (sin términos nuevos).

---

Firmado: tanda claude sonnet 5.5
