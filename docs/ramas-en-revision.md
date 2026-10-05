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

- `videollamadas-omitidas-defecto`: Plan 25 (`~/Boveda/Proyectos/courseDownloader/Planes/25 - Videollamadas omitidas por defecto y popup al dia con el editor.md`).
  Specs: `docs/specs/editor-ignorar-y-raiz/spec.md`, `docs/specs/classroom-destino/spec.md`.
  Compuerta: 81 archivos / 1220 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js` (errores: 0).
  - ⬜ **M-1** — Dueño: re-escanear un curso con Meet, abrir el editor sin tocar nada: todas las videollamadas nacen en «omitir». «Volver a ofrecerlas» → guardar → `jq '.cursos[].videollamadasPermitidas' <índice>` las lista.
  - ⬜ **M-2** — Dueño: con el popup abierto, abrir el editor (🗂️), re-ofrecer una videollamada, guardar, volver al popup **sin re-escanear**: pasa de «omitido» a seleccionable en pocos segundos. Lo tildado a mano **antes** de abrir el editor puede perderse (esperado, ver Paso 3); lo tildado en el popup sin haber abierto el editor no se toca al cambiar de pestaña.
  - ⬜ **M-3** — Dueño: re-escanear después: las re-ofrecidas siguen ofrecidas; una videollamada nueva llega omitida.
- `editor-filtros-orden`: Plan 24 (`~/Boveda/Proyectos/courseDownloader/Planes/24 - Filtros y orden en el editor de adopcion.md`).
  Spec: `docs/specs/editor-filtros-orden/spec.md`.
  Compuerta: 80 archivos / 1203 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js` (errores: 0).
  - ⬜ **M-1** — Dueño: en «Mostrar» elegí «📹 Videollamadas»: sólo se ven las videollamadas, los temas sin ninguna desaparecen y los otros quedan expandidos. «Limpiar filtros» lo deshace.
  - ⬜ **M-2** — Dueño: probá «Tipo» (pdf), luego combinalo con «A copiar» y con el chip «Revisar». Los seis contadores de arriba no se mueven.
  - ⬜ **M-3** — Dueño: ordená temas por «A→Z» y «Problemas primero»; ordená archivos por «Nombre original». Editá el nombre de una fila: **no** salta de lugar. Resolvé un tema sin destino con «Problemas primero» activo: baja de lugar (esperado, D-3).
  - ⬜ **M-4** — Dueño: en la barra lateral, «Más para revisar primero» sube el curso con más pendientes; al cambiar de curso el orden de la barra se mantiene y los filtros del curso se reinician. F5 lo reinicia todo.
  - ⬜ **M-5** — Tanda: tras usar todos los controles, «Cambios sin guardar» no aparece por eso; guardar y comprobar con `jq` que el índice es igual que sin tocar filtros.
- `editor-videollamadas-raiz`: Plan 23 (`~/Boveda/Proyectos/courseDownloader/Planes/23 - Omitir videollamadas en bloque y raiz decidida en el editor.md`).
  Spec: `docs/specs/editor-ignorar-y-raiz/spec.md`.
  Compuerta: 80 archivos / 1203 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js` (errores: 0).
  - ⬜ **M-1** — Dueño: re-escanear **Fisica_II_G25_2026** (clave `google-classroom:Nzk0MDIyNDkyNDUx`). Abrir el editor (🗂️). Tiene que verse en la cabecera `Omitir N videollamadas` con N igual a los enlaces de Meet de ese curso, y cada fila de videollamada con la etiqueta `📹 Videollamada`.
  - ⬜ **M-2** — Dueño: tocar el botón. Las filas quedan tachadas/omitidas, el botón pasa a `Volver a ofrecerlas` con `N omitidas`, y aparece `Cambios sin guardar`. Guardar. **Tanda:** `jq '.cursos["google-classroom:Nzk0MDIyNDkyNDUx"].omitidos' ~/Descargas/facultad-prueba/.course-downloader.json` lista las N claves `google-classroom:acceso:https%3A%2F%2Fmeet...`.
  - ⬜ **M-3** — Dueño: `Volver a ofrecerlas` las deja destildadas→tildadas otra vez; **no guardar** (descartar con F5).
  - ⬜ **M-4** — Dueño, mismo curso: los temas **Novedades**, **Sin tema** y **Cronograma tentativo primer cuatrimestre 2026** (los tres guardados en `.` en el índice) se ven `✓ Asignado · Raíz de la materia` y **no** cuentan en «a revisar» de la lista de cursos ni en «Solo problemas». *(Antes del plan: los tres decían «Sin destino».)*
  - ⬜ **M-5** — Tanda: sacar de la copia el tema «Cronograma tentativo primer cuatrimestre 2026» del índice (`jq 'del(.cursos["google-classroom:Nzk0MDIyNDkyNDUx"].temas["Cronograma tentativo primer cuatrimestre 2026"])'`, con respaldo) y reiniciar el servidor. Dueño: en el editor, ese tema aparece como tema nuevo (regla `si` por `carpetas.ts` L17) → «Asignado». Para ver un tema **sin regla**, tanda agrega al curso un tema inventado (ver Preparación del plan 20) con un nombre que no matchee ninguna regla, por ejemplo `Anuncios varios`: sale «Sin destino» con el selector en «— elegir carpeta —»; el dueño elige «Raíz de la materia» y pasa a «Asignado» **sin guardar**.
- `marca-resaltador`: identidad visual «Resaltador», diseño cerrado y sin aplicar.

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
