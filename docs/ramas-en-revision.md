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

## 🔍 En revisión

**Desde 2026-08-27.** Rama `tanda-host-ramonnet-y-conexion`, fuera de `main`, con tres cortes:

1. **El host de Ramón Net migró**, de `plataforma.ramonnet.com.ar` (dado de baja: no resuelve en
   DNS ni contra resolvers públicos como 8.8.8.8/1.1.1.1) a `ramonnet.com.ar` —
   `sitio/ramonnet/config.ts`, `host_permissions` en `wxt.config.ts`, y las docs que citaban el
   host viejo. **Verificado en Chrome**: el popup ya escaneó clases reales sobre el host nuevo
   (capturado por el usuario, 51 clases bajo `ramonnet.com.ar/usuario/clases-grabadas`).
2. **El mensaje de conexión caída** deja de decir "Sin conexión a internet" — mentía: el daemon
   (`core/conexion/conexion.ts`) sondea el host del PORTAL, no internet en general, así que un
   portal caído con internet sano mostraba el cartel equivocado (fue justo el síntoma que
   destapó el corte 1). Pasa a "No se pudo contactar el sitio" en las tres copias: banner
   (`bannerConexion.preact.js`), tooltip del puntito (`conexionHeader.preact.js`) y notificación
   nativa (`notificaciones.ts`). **No verificado en Chrome todavía.**
3. **El badge de cátedra se salía del popup** por el borde derecho (capturado en pantalla por el
   usuario) — `.input-path` no tenía `min-width: 0`, así que no podía ceder ancho y el
   `.faceta-badge` (sin límite, `white-space: nowrap`) quedaba empujado afuera.
   `styles/components/path-bar.css`. **No verificado en Chrome todavía.**

Qué mirar en Chrome antes de mergear:
- Popup sobre `ramonnet.com.ar/usuario/clases-grabadas` con una materia que dispare cátedra (ej.
  "anatomia") → el badge "CÁTEDRA C" tiene que entrar completo, sin recortarse contra el borde.
- Backend Bun apagado o `ramonnet.com.ar` inalcanzable (ej. bloqueado en `/etc/hosts`) → la
  tarjeta tiene que decir "No se pudo contactar el sitio", no "Sin conexión a internet".

Si algo falla, aislar por corte: son tres commits, uno por punto de arriba.

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
