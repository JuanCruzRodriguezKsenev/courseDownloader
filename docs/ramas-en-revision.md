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

`loader-tarjetas` (desde `main` `0442598`): el loader con detalle (un curso y recorrido) se dibuja en
tarjetas según la maqueta del dueño. Sólo presentación: el contenido sigue la spec.

- **Plan**: `docs/plan-loader-tarjetas.md` (5 pasos). Compuerta esperada 46 archivos / 802 tests.
- **Spec**: `docs/specs/loader-con-progreso/spec.md` §Enmienda 2026-09-27 (RN-24..27, AC-12);
  maqueta en `docs/specs/loader-con-progreso/maqueta-loader.png`.
- **Checklist B (dueño, Brave)**: T-1..T-5 al final del plan. Antes, la tanda lo reproduce en
  Claude in Chrome (oscuro y claro).
- **Acento** (2026-09-28): el curso actual y el reloj usan `--accent-orange`, el de la app; el azul de la
  maqueta se descartó (`--accent-blue` ya no existe). El Paso 1 del plan quedó superado por esto.
- **Siguiente en la misma rama — cancelar el escaneo**: plan `docs/plan-cancelar-escaneo.md` (6 pasos),
  spec `docs/specs/cancelar-escaneo/spec.md`. Compuerta esperada 46 / 813. Cierra de paso un defecto
  latente: un `fin` anterior a `inicio` (`sin-cursos`) no llegaba al storage. Checklist C-1..C-10 al
  final del plan; C-1 mide M-1.
  - **Ejecutado y revisado por tanda (2026-09-28)**: compuerta 46 / 813, lint 0/0, tsc limpio, build OK.
    Control negativo del Paso 2 corrido en un worktree aparte: sin el `if (cancelado) throw` del `catch`
    de la carrera, S1 falla (`expected … length of 1 but got 2`); restaurado, 43/43. C-10 reproducido con el
    CSS compilado (oscuro y claro, 390 px): botón a la derecha, `CANCELANDO…` atenuado, sin colores nuevos.
    **Falta el dueño en Brave: T-1..T-5 del loader y C-1..C-9.**
  - **Hueco conocido, no bloquea**: el respaldo de 3 s del recorrido vive en el popup. Si la pestaña está
    muda y el popup se cierra antes de los 3 s, no se manda el `fin` y el recorrido queda `escaneando`
    hasta que vence `esVigente` (~210 s). C-4 no lo cubre porque ahí el popup queda abierto.

`classroom-destino-adopcion` (corte 2a, adopción en `~/U.N.L.P`) sigue en su rama, esperando A-2;
su estado vive en el `ramas-en-revision.md` de esa rama.

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
