# Ramas en revisión

**Hogar canónico del estado del trabajo en curso que todavía no está en `main`.**

Este doc existe para que ese estado deje de vivir en las reglas de agente (`AGENTS.md`). Es
información con fecha de vencimiento: cambia con cada merge, y mientras vivió en el banner de
`CLAUDE.md` lo hizo cambiar en 85 de 187 commits.

**Lo que este doc NO es:**

- No es el backlog. Los ítems abiertos viven en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- No es la baseline de la compuerta. Los números viven en `docs/testing.md` §Baseline.
- No es el diseño de nada. Cada corte apunta al doc que explica lo que construye.

---

## 🚧 En revisión

### `moodle-ingenieria` (Plan 31) — **ya está en `main` (2026-10-06), mergeada SIN verificar en Chrome**

Compuerta del merge: 87 archivos / 1313 tests, lint 0, tsc 0, build ok. Las casillas de abajo siguen sin hacer: no tratarlas como superadas.

Sexto portal: Moodle de Ingeniería (`www.asignaturas.ing.unlp.edu.ar` y sin `www`).
Escaneo de curso individual y recorrido completo desde `/my/` (modo `todos`).
Destino por índice a `~/Boveda/Areas/Facultad/Ingenieria/` con H-1 resuelto en backend.

#### Verificación en Chrome (dueño con sesión real en Moodle Ingeniería):

- [ ] **M-A (Curso individual con adjuntos)**: abrir un curso (ej: `course/view.php?id=3104`), abrir el popup, verificar que detecta el portal y lista los recursos/carpetas.
- [ ] **M-B (Sección 0 con nombre propio - RN-4)**: verificar que los temas respetan su nombre real y la sección 0 conserva su título propio (o «Sin tema» si no tiene o dice «General»).
- [ ] **M-C (Descarga de adjuntos directos y carpetas)**: descargar un recurso y verificar que el backend lo guarda sin duplicar extensión (`.pdf` no `.pdf.mp4`).
- [ ] **M-D (Enlaces URL a accesos .md)**: verificar que los recursos de tipo `url` generan su correspondiente archivo de acceso `.md`.
- [ ] **M-E (Recorrido multicurso desde `/my/` - M-1 y NFR-4)**: abrir `/my/`, abrir el popup, presionar «Escanear todos los cursos», verificar que recorre los 9 cursos secuencialmente y sin errores.
- [ ] **M-F (Segundo plano - M-3)**: verificar que el escaneo progresa incluso si la pestaña de `/my/` queda en segundo plano.
- [ ] **M-G (Destino por índice - H-1)**: verificar que los archivos descargados caen en `~/Boveda/Areas/Facultad/Ingenieria/` según el índice del curso.

## Mergeado el 2026-10-06

Verificado por el dueño en Chrome («todo ok»): `marca-resaltador` (planes 26, 27 y 28), `moodle-multicurso`
(plan 29), y el arrastre de los planes 22, 23, 24 y 25, que ya estaban en `main`. Plan de verificación:
`~/Boveda/Proyectos/courseDownloader/Planes/30 - Verificacion conjunta y merge de marca-resaltador y moodle-multicurso.md`.
Specs: `docs/marca-diseno.md`, `docs/specs/moodle-linti-multicurso/spec.md`, `docs/specs/moodle-asignaturas-multicurso/spec.md`.
**No quedó registro casilla por casilla**; si alguna importa, rehacerla contra el código.
Hallazgo del plan 29 (RN-8): la sesión vencida **corta** el recorrido (no pausa).
Portal sin implementar, sólo con spec `draft` y mediciones parciales: IDEAS (`docs/specs/ideas-info/`). Moodle de Ingeniería (`docs/specs/moodle-ingenieria/`) implementado en rama `moodle-ingenieria`.

## Mergeado el 2026-10-04

- **Classroom 2b y 2c** (planes 01 a 08h): entraron a `main` con `535fa40`. La rama `classroom-destino-2c`
  ya no existe. Diseño: `docs/specs/classroom-destino/spec.md` y `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md`.
- **Moodle LINTI, Google Sites Mate C, Moodle Asignaturas, botón «Que hereden» y borrador local del editor**
  (planes 09 a 19): `c1f8a57`. Specs: `docs/specs/moodle-linti/`, `docs/specs/google-sites-matec/`,
  `docs/specs/moodle-asignaturas/`.
- **Subcarpeta por tema** (plan 20): `565b7ee`.
- **Loader en tarjetas y cancelar escaneo** (planes `loader-tarjetas` y `cancelar-escaneo`): verificado por el dueño en Brave, T-1..T-5 y C-1..C-10 dados por buenos. Registro de diseño: `docs/portal-google-classroom-diseno.md` §11.
- **Videollamadas con chip y al tope** (plan 12): verificado por el dueño en Brave con el curso Fisica II G25 2026. Hallazgo menor: el mapeo de `esVideollamada` en `popup.js` no tiene test directo (ADR-0005).
- **Nombres que chocan** (plan 21): `37a1e96`. M-1 a M-4 verificados con el dueño en la copia de prueba.

Los checklists V-0..V-9 (2b), W-0..W-7 (2c) y H/B (planes 17 y 19) estuvieron en este doc con las casillas
sin marcar. El merge los dio por superados, pero **no quedó registro de cada casilla**; si alguna importa,
rehacerla contra el código actual antes de confiar en ella.

---

## Corte 2a (adopción) — mergeado

`classroom-destino-adopcion`: Corte 2a del destino de Google Classroom. Mergeado. La raíz es `~/Boveda/Areas/Facultad` (ADR-0018); la adopción se aplicó ahí (`32136ca` de la bóveda) con todos los ítems A-1..A-4 ✅ verificados.
- **Plan**: `docs/plan-classroom-destino-2a-adopcion.md`.
- **Plan de la bóveda**: `docs/plan-classroom-destino-2a-boveda.md`.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0017-indice-de-destino-en-la-raiz.md`, `docs/adr/0018-raiz-en-la-boveda-indice-versionado.md`.

## Lo último que se mergeó (2026-09-27)

`classroom-novedades-scroll`: `buscarContenedorScroll` (`sitio/google-classroom/scraper.js`) exige
que el contenedor scrollee de verdad (`scrollHeight > clientHeight + 1`). La `<nav>` lateral de
Classroom tiene `overflow-y: auto` pero no scrollea; al elegirla, Novedades leía sólo la primera
página. Cierra la deuda 🟠 de Novedades, de la que dependía el corte 2.

- **Plan**: `docs/plan-classroom-novedades-scroll.md`. Compuerta 46 archivos / 801 tests; el control
  negativo del test 39 falla sin el arreglo (lo corrió tanda en un worktree aparte).
- **Verificado en Brave (2026-09-27, contado por tanda en el storage, escrituras de las 17:34-17:38)**:
  - **N-2** (recorrido de todos): 7 cursos, 0 fallidos. Novedades de G25 trae **28** adjuntos (antes
    4), el mismo número que dio el scroll a mano en el diagnóstico. Tiempo total **~175 s** contra los
    ~124 s de B-3; el curso más lento tarda 45,6 s, lejos del tope de 180 s.
  - **N-1** (G25 solo): los mismos **28** adjuntos de Novedades, los 28 marcados como descargados. No se
    bajó ningún archivo nuevo a `~/Descargas/verificacion-b`.

---

## Cómo usar este doc la próxima vez

Cuando haya trabajo fuera de `main`, acá va: qué rama, qué trae, qué mirar en Chrome y cómo
aislar si algo falla. Cuando se mergea, esta sección vuelve a decir «nada en revisión», los
ítems abiertos se mudan a `TECHNICAL_DEBT.md` y el registro de la verificación a su hogar.

Lo que las tandas enseñaron sobre el proceso:

- **Una rama de integración deja `main` intacta** mientras se verifica, y si algo falla se
  descarta entera. Salió barato y conviene repetirlo.
- **Un commit por corte**, para que un `git revert` aísle.
  - **Y cuándo NO se puede**: si un archivo participa de varios cortes —el caso repetido es
    `popup.js`— separarlos deja commits intermedios que no compilan. Ahí conviene un commit
    grande y honesto antes que un historial lindo y roto. Se paga en granularidad del `revert`.
  - **El orden de los commits se elige para que cada estado intermedio compile.** En la última
    tanda eso decidió qué corte iba primero: el que introducía un módulo nuevo tenía que entrar
    antes que el que lo consume, aunque el consumidor fuera el arreglo más urgente.
- **Anotá también qué hace falta para poder MIRAR el resultado.** El loader invisible era
  precondición de la verificación del copy genérico, y eso no aparecía en ninguna lista de
  dependencias: las dos entradas se veían independientes.
- **Para lo que dura milisegundos, mirar no alcanza: hay que medir.** Los dos peores destellos
  del arranque (248 ms y 117 ms) no los encontró el ojo, los encontró el banco. Y el banco tiene
  que estar **apagado** al verificar el arreglo, porque demora el escaneo a propósito.
