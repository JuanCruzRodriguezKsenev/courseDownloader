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

## Nada en revisión (al 2026-08-12)

**`main` está al día y verificado en navegador.** No hay ramas en vuelo.

La tanda del 2026-08-12 —copy genérico, frente de alertas, la selección que sigue al filtro y
los cinco ítems de la auditoría de loaders— se verificó en Chrome y se mergeó. Qué trae, en
`docs/ROADMAP.md` §Fase 7; el estado del backlog, en `docs/TECHNICAL_DEBT.md`.

### Lo que dejó esa tanda, y conviene no volver a aprender

- **Verificar en el navegador encontró OCHO defectos que la compuerta no vio**, y **cuatro los
  introdujo el arreglo del anterior**. La tabla completa y las lecciones están en
  `docs/alertas-y-bloqueo-diseno.md` §5.1 — es el hogar canónico de ese registro y vale leerlo
  antes de la próxima tanda sobre el popup.
- El resumen en una línea: lo que cae en el núcleo de `popup.js` y en el CSS **sólo lo ve un
  humano abriendo el popup**, y "la compuerta está en verde" no dice nada sobre esa zona.

### El banco de pruebas ya no es una rama

**Vive en el código**, en `verificacion/modoVerificacion.js`, y se enciende con **una línea**:
`BANCO_DE_PRUEBAS = true` al final de `entrypoints/popup/main.js` + `pnpm run build`.

Vivió en una rama descartable y **se perdió dos veces**: primero quedó con un build viejo
mientras el trabajo avanzaba —cargarla verificaba una versión anterior sin que nada avisara— y
después hubo que rearmarla con siete cherry-picks. Una herramienta que hay que reconstruir cada
vez que se usa es una herramienta que no se usa.

Apagado no cuesta nada, y está medido: la bandera es una `const` literal, así que Vite se lleva
el módulo entero en el tree-shaking (`false` → 225,71 kB y **cero** ocurrencias de `mv-panel` en
el bundle; `true` → 243,21 kB).

---

## Cómo usar este doc la próxima vez

Cuando haya trabajo fuera de `main`, acá va: qué rama, qué trae, qué mirar en Chrome y cómo
aislar si algo falla. Cuando se mergea, esta sección vuelve a decir «nada en revisión».

Lo que la última tanda enseñó sobre el proceso:

- **Una rama de integración deja `main` intacta** mientras se verifica, y si algo falla se
  descarta entera. Salió barato y conviene repetirlo.
- **Un commit por corte**, para que un `git revert` aísle. Los seis defectos encontrados se
  ubicaron por commit sin buscar.
- **Anotá también qué hace falta para poder MIRAR el resultado.** El loader invisible era
  precondición de la verificación del copy genérico, y eso no aparecía en ninguna lista de
  dependencias: las dos entradas se veían independientes.
