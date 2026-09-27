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

Nada. `main` tiene todo lo construido.

## Lo último que se mergeó (2026-09-27)

`classroom-escanear-todas` (desde el 2026-09-25): escanear todos los cursos de Classroom desde la
portada en un solo recorrido que sobrevive a cerrar el popup, con el loader mostrando el progreso
por curso, la vuelta a la portada al terminar y la lista conservada al terminar la descarga.

- **Verificado en Brave por el dueño (2026-09-27)**: la sesión única de cierre S-1..S-9 entera
  ("todo ok"), que cubre L-1..L-10 y los ítems 2..13 de la primera Verificación B. Comprobado por
  tanda en el disco y el storage: los 3 PDF de S-2 cayeron en la carpeta de su curso con md5
  idéntico al respaldo; la lista guardada tiene 337 ítems en 5 carpetas.
- **NO verificado**: AC-9 (el mismo archivo de Drive en dos cursos), porque hoy ningún archivo está
  en dos cursos → entrada ⚪ en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- **Dónde quedó**:
  - El registro completo de la rama (planes, checklists, hallazgos con su evidencia) →
    `docs/portal-google-classroom-diseno.md` §10.
  - Lo abierto (dos 🟡 NO REPRODUCIDOS, el riesgo de navegación, la segunda bandera del loader y
    AC-9) → `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
  - La baseline → `docs/testing.md` §Baseline (46 archivos / 799 tests).

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
