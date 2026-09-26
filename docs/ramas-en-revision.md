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

## 📝 En preparación: `classroom-escanear-todas` (desde el 2026-09-25)

- **Qué va a traer**: escanear todos los cursos de Classroom desde la portada, en un solo recorrido
  que sobrevive a cerrar el popup.
  - Spec: `docs/specs/classroom-escanear-todas/spec.md` (`draft`; supuestos aprobados sin leer).
  - Plan: `docs/plan-classroom-escanear-todas.md`.
- **Estado**: En ejecución. Pasos 1 a 4 completados (ScraperClassroom todos, config Classroom portada, recorridoTodos puro, manejador recorrido_evento en SW con tests pasando).

## Lo último que se mergeó (2026-09-25)

`classroom-corte-1` (41 commits, desde el 2026-09-12): el tercer portal, Google Classroom. Escanea
un curso entero y baja sus archivos de Drive a `raíz/google-classroom/<curso>/`; videos, YouTube y
vínculos quedan como `.md` con el link.

- **Verificado en Brave por el dueño (2026-09-25)**: escaneo curso por curso y descarga. Los
  tres 🔴 de la Verificación B quedaron resueltos antes del merge.
- **NO verificado en navegador**: los pasos 4, 6, 7, 10, 11, 13 y 15 de la checklist → entrada ⚪
  en `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
- **Dónde quedó**:
  - El registro completo de la rama (planes ejecutados, checklist, hallazgos con su evidencia) →
    `docs/portal-google-classroom-diseno.md` §9.
  - Lo abierto (el 🟡 de Novedades con M-6c pendiente, y los dos insumos de la spec del corte 2)
    → `docs/TECHNICAL_DEBT.md` §🔴 Abierto.
  - La baseline → `docs/testing.md` §Baseline.

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
