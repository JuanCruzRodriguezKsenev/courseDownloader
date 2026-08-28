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

**Al 2026-08-27.** `main` está al día: la tanda `tanda-host-ramonnet-y-conexion` se verificó en
Chrome y se mergeó. No hay trabajo construido fuera de `main`.

Dónde quedó lo que traía, por si venís buscándolo:

- **La migración de host** (`plataforma.ramonnet.com.ar` → `ramonnet.com.ar`, dado de baja el
  primero) → el changelog de `sitio/ramonnet/config.ts` (v2.2.0) y `host_permissions` en
  `wxt.config.ts`. Verificado con clases reales escaneadas sobre el host nuevo.
- **El copy de conexión caída** ("Sin conexión a internet" → "No se pudo contactar el sitio",
  porque el daemon sondea el host del portal, no internet en general) → el changelog de
  `bannerConexion.preact.js` (v1.2.0), replicado en `conexionHeader.preact.js` y
  `notificaciones.ts`. Verificado en Chrome.
- **El badge de cátedra que se salía del popup** → el comentario sobre `min-width: 0` en
  `.input-path`, `styles/components/path-bar.css`. Verificado en Chrome.

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
