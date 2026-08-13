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

## ✅ Nada en revisión

**Al 2026-08-13.** `main` está al día: la tanda `tanda-toolbar-capa-y-pnpm` se verificó en Chrome
y se mergeó. No hay trabajo construido fuera de `main`.

Dónde quedó lo que traía, por si venís buscándolo:

- **El registro de la verificación en navegador** → `docs/alertas-y-bloqueo-diseno.md` §5.2, que
  es su hogar canónico. Ahí está también de qué **tipo** fue (resultado global, no medición) y
  por qué esa distinción importa cuando aparezca el próximo defecto en esa zona.
- **Lo que quedó abierto** → `docs/TECHNICAL_DEBT.md` §🔴 Abierto. Son cuatro: el loader sin
  dueño (con la mitad del tiempo ya construida), la línea de estado invisible del footer, lo que
  el banco todavía no puede forzar, y los dos restos de la limpieza de micro-movimientos.
- **El porqué de cada pieza** → `docs/alertas-y-bloqueo-diseno.md` (bloqueo, alertas, carteles),
  `docs/preact-migration.md` §La capa flotante compartida, `docs/contributing.md` §Las dos
  trampas de pnpm, y `docs/escaneo-api-anatomy-diseno.md` (el eje de materia).

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
