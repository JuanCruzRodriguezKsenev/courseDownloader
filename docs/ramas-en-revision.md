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

- **Verificar en el navegador encontró seis defectos que la compuerta no vio**, todos en el
  mismo corte y ninguno alcanzable por un test: el bloqueo que no se aplicaba, la tarjeta que
  perdía la región al conmutar de pestaña, el botón que no aparecía, la toolbar viva sobre una
  cola vacía, y dos de scroll. Es el argumento de ADR-0005 en vivo: lo que cae en el núcleo de
  `popup.js` y en el CSS **sólo lo ve un humano abriendo el popup**.
- **Tres de esos seis los introdujo el arreglo anterior.** Un corte sobre el popup no se da por
  cerrado hasta verlo; "la compuerta está en verde" no es una señal sobre esta parte del código.
- **El patrón que se repitió tres veces**: un estado pintado UNA VEZ (la tarjeta, el botón) en
  vez de derivado en cada repintado. Si se puede desincronizar de su bandera, se desincroniza.
  Todo lo que ocupa `#ui-list` o el footer se deriva en `renderizarListadoInterfaz` /
  `calcularContadoresBoton`; no se pinta suelto.

### El banco de pruebas ya no es una rama

**Vive en el código**, en `verificacion/modoVerificacion.js`, y se enciende con **una línea**:
`BANCO_DE_PRUEBAS = true` al final de `entrypoints/popup/main.js` + `npm run build`.

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
