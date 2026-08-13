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

## 🟡 `tanda-toolbar-capa-y-pnpm` — construida, compuerta verde, **SIN VERIFICAR EN CHROME**

**Estado al 2026-08-13.** Tres commits sobre `main` (`66a50c6`). La compuerta pasa entera —
**37 archivos / 658 tests**, lint 0, `tsc` limpio, build 0 — y eso **no dice nada** sobre esta
zona: casi todo cae en el núcleo de `popup.js` y en el CSS, que es exactamente donde la suite no
ve (la lección de la tanda anterior, más abajo).

**El build cargado en `.output/chrome-mv3/` es el de esta rama, con el banco de pruebas
ENCENDIDO** (`BANCO_DE_PRUEBAS = true` en `entrypoints/popup/main.js`). Si algo falla y querés
descartar todo: `git checkout main && pnpm install && pnpm run build`.

### Qué trae, por commit

| Commit | Qué |
|---|---|
| `5a3a57b` **build** | Migración de npm a **pnpm** |
| `841441b` **style(css)** | Micro-movimientos de hover/clic + restyle de la path-bar + foco |
| `1221643` **feat(popup)** | Bloqueo reutilizable, controles que siguen al resultado, carteles de lista vacía, capa flotante compartida, foco atrapado, banco |

#### `5a3a57b` — pnpm

`pnpm-lock.yaml` + `pnpm-workspace.yaml` entran, `package-lock.json` se va, la versión queda
fijada con `"packageManager": "pnpm@11.1.1"`. **La migración estaba empezada y rota**: el
`install` salía con código 1 y, como pnpm lo re-corre antes de cada script, tumbaba los cuatro
comandos de la compuerta a la vez. Las dos causas (la peer dep `vite` de WXT y el `allowBuilds`
de esbuild) están en `docs/contributing.md` §Las dos trampas de pnpm — **no son evitables y no se
arreglan solas**, así que se leen antes de tocar dependencias.

#### `841441b` — lo visual

- **El parpadeo del hover era `transform: translateY(-0.5px)`**, en cinco lugares. Medio píxel no
  se puede apoyar en la pantalla: el navegador re-rasteriza y le cambia el suavizado al texto, y
  eso se lee como cambio de tamaño. Se fueron también los tres `:active { scale() }`.
- **La ruta del disco** dejó de parecer un input, recorta por la izquierda (la cola de la ruta es
  la que informa) y arranca pegada a su rótulo. Su `text-overflow: ellipsis` **no funcionaba**:
  el elemento era `display: flex`.
- **Un solo tratamiento de foco** en los dos campos de texto: se veían tres encimados.

#### `1221643` — el grueso

Cinco partes, todas atadas a `popup.js` (por eso van juntas). El detalle de cada una está en el
mensaje del commit y, con su porqué, en `docs/alertas-y-bloqueo-diseno.md` §2.0, §6.8, §6.9 y
§6.10, y en `docs/preact-migration.md` §La capa flotante compartida.

- **`popup/features/bloqueo.js`** — el contrato del §2 dejó de estar copiado en tres funciones de
  `popup.js`, o sea en el único archivo que la suite no ve.
- **Los controles siguen al resultado** — "Todos", "Ordenar" y "Seleccionar" se apagan cuando no
  hay sobre qué actuar; el buscador y los filtros **no**, nunca, porque son la salida.
- **Los carteles de lista vacía dicen cuál de las tres causas fue**, usando el mismo predicado
  que decide el bloqueo, así el cartel y el bloqueo no pueden contradecirse.
- **`popup/features/capa.preact.js`** — la superficie flotante compartida, con sus **4
  consumidores migrados** y foco atrapado en la variante modal.
- **El banco** estrena el switch "sin lista previa", y su cabecera lleva ahora el inventario de
  las 12 tarjetas y cómo se fuerza cada una.

### Qué mirar en Chrome, en este orden

Son cinco cambios visuales encadenados; si algo se ve mal, **el orden importa para aislar**.
Encendé el banco con **F9**.

1. **Hover y clic** (`841441b`, se revierte solo). Pasá el mouse por la lista larga: sin temblor
   ni cambio de grosor de letra. Apretá los botones: sin hundido.
2. **Path-bar** (`841441b`). Ruta larga → tiene que leerse `…\OneDrive\Escritorio\descargas`, no
   al revés. Foco en MATERIA y en Buscar: **un** borde naranja con su halo, sin recuadro extra.
3. **Bloqueo** (`1221643`). Filtro en "descargados" → "Todos" apagado, con el mismo tinte y el
   mismo cursor en la casilla **y** en la palabra; "Ordenar" **encendido** (hay clases que
   ordenar). Buscá algo inexistente → se apagan Ordenar y Seleccionar, pero el buscador y
   Filtros **siguen vivos**. Con el servidor caído (banco), las dos filas de la path-bar tienen
   que quedar con **el mismo** tinte.
4. **Carteles** (`1221643`). Parado en una página cualquiera → Re-escanear → card 🧭 con los dos
   portales nombrados. Banco: "sin lista previa" + resultado `vacío` → "Sin clases detectadas".
   Y el que antes fallaba: quedate en esa card, andá a Fila y volvé — **no** tiene que
   reemplazarse por la del filtro.
5. **Capa flotante** (`1221643`), los cuatro:
   - **Campanita**: Escape, clic afuera, y clic en el 🔔 estando abierta (ése es el que antes no
     cerraba). Título largo en dos líneas.
   - **Faceta**: el badge abre el modal; elegir aplica y cierra; Escape también (antes no).
   - **Advertencia** (📂 Explorar): Entendido / Cancelar / Escape. **Escape ahora equivale a
     Cancelar** — es un cambio de conducta. Y el check "no volver a mostrar" tiene que seguir
     persistiendo.
   - **Onboarding** (F9 → forzar): el clic al fondo **no** lo cierra, "Saltar" sí, el carrusel no
     se desborda, y tabulando dentro de una slide **no** se llega al link ni al botón de otra.
6. **Foco atrapado**: con la advertencia abierta, dando la vuelta con Tab no se puede llegar al
   buscador ni a los filtros de atrás. Al cerrar, el foco vuelve al botón Explorar.

---

## Lo que falta, para una próxima sesión

### 1. 🔴 El loader no tiene dueño — es el corte que estaba por arrancar

**Es la deuda más concreta y ya está diseñada.** El `<div id="ui-loader">` se prende y apaga
escribiendo `style.display` **a mano desde 9 lugares**, en dos archivos, con tres textos escritos
a mano. No tiene componente, ni store, ni isla — a diferencia de la ruta (`RutaDisco`), el banner
(`BannerConexion`) y la lista (`ListaClases`).

**Ya se pagó un bug por eso** (§6.2 del doc de alertas): el loader del escaneo inicial no se veía
nunca, porque `conectarYArrancar` lo apagaba en su `finally` **en el mismo tick** — el escaneo no
es `async`, vuelve apenas encola su `chrome.tabs.query`. Se cerró con una **bandera**,
`elEscaneoTomoElLoader` (`popup.js:750` y `:803`): dos dueños del mismo recurso puestos de acuerdo
a mano, que es el antipatrón que el §1 de ese mismo doc prohíbe para la región de la lista.

**Y hay un síntoma vivo**: el escaneo rápido hace que el loader viva 100-200 ms. Es menos de lo
que el ojo registra, así que se ve un destello y parece que no funcionó.

El corte, tal como quedó diseñado:

- **`popup/features/loader.js`, dueño único.** `mostrar(texto)` / `ocultar(token)`. Nadie más
  escribe `style.display` sobre ese nodo.
- **Tokens, no un booleano.** `mostrar()` devuelve un comprobante y se apaga cuando **todos** lo
  devolvieron. La diferencia con la bandera no es de estilo: nadie puede apagar el loader de otro
  **porque no tiene cómo**, en vez de porque se acordó de preguntar. Con eso desaparece
  `elEscaneoTomoElLoader`.
- **Dos tiempos, y no una `transition`.** Una transición controla *cómo* se ve el cambio, no
  *cuándo* empieza: el fade arranca igual en el instante cero y se lee como "se está cerrando".
  Las reglas son: **~150 ms de demora para aparecer** (si el trabajo termina antes, el loader no
  aparece nunca — el destello se elimina en vez de alargarse) y **500 ms de mínimo visible** si
  llegó a pintarse.
- **El riesgo, y hay que mirarlo**: los tiempos hacen que el loader viva **más allá** del
  `finally` que lo pidió, así que hay que revisar que ninguna de las 4 salidas del escaneo asuma
  que apagar es inmediato. Los dos tiempos y el conteo se testean con temporizadores falsos.

### 2. 🔴 `#ui-msg-status` está oculto y nadie se lo destapa

El `<p>` de la línea de estado del footer nace con `style="display:none"` inline
(`entrypoints/popup/index.html`) y **no hay en todo el repo** un `txtEstado.style`, un
`removeAttribute` ni una regla con `!important` que lo pise. Todo lo que se escribe ahí es
invisible: ~20 sitios, incluido **el texto de progreso de la descarga**.

**El arreglo es de una línea** (sacar el inline; el `.status-text:empty` de `footer.css` ya lo
colapsa vacío). Lo que falta es la pasada por navegador: destapa los ~20 mensajes de golpe y hay
que mirar el footer **descargando**, que es donde cambia de alto.

Detalle completo en `docs/alertas-y-bloqueo-diseno.md` §6.8b. **Ojo con "arreglarlo" mandando
mensajes ahí**: ese destino ya se descartó para el watchdog *aunque estuviera visible*, porque
comparte el footer con el diagnóstico de conexión y queda pisado.

### 3. 🟠 Lo que el banco todavía no puede forzar

Con el switch nuevo, **9 de las 12 tarjetas** se fuerzan desde el panel y las otras 3 se alcanzan
a mano en dos clics. Lo que queda afuera es de otra naturaleza:

- **Una descarga en curso** — la barra de progreso, la telemetría, el frenado suave y la caja de
  cancelar sólo existen con el service worker bajando de verdad, y el banco **sólo envuelve APIs
  del popup**. Cubrirlo es otro mecanismo (contestar IPC de progreso falsos), no un switch más.
- **El historial de fallos** (la campanita) no se puede sembrar.

### 4. ⚪ Coherencia visual pendiente

- **`scale(1.15)` en el hover** de la campanita (`campanita.css:24`) y del `?`
  (`help-button.css:17`). No parpadean —un 15% es un efecto deliberado, no sub-píxel— pero
  **cambian de tamaño en hover**, que es lo que se sacó en todos los demás. Los dos ya avisan por
  color, así que sacarlo no los deja mudos.
- **`transition: all` en 8 reglas** (`actions.css`, `advertencia.css`, `faceta.css`,
  `filters.css`, `header.css`, `onboarding.css`). `all` anima *cualquier* propiedad que cambie,
  incluidas las que mueven layout: es el origen latente del próximo parpadeo, porque nadie
  declaró qué quería animar.

---

## Lo que dejó la tanda anterior, y conviene no volver a aprender

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

Apagado no cuesta nada, y **se re-mide en cada versión del banco** (si no, el número envejece y
el argumento deja de valer). Al 2026-08-13, en v3.1.0: `false` → **227,87 kB** y **cero**
ocurrencias de `mv-panel` en el bundle; `true` → **246,17 kB**.

---

## Cómo usar este doc la próxima vez

Cuando haya trabajo fuera de `main`, acá va: qué rama, qué trae, qué mirar en Chrome y cómo
aislar si algo falla. Cuando se mergea, esta sección vuelve a decir «nada en revisión».

Lo que las tandas enseñaron sobre el proceso:

- **Una rama de integración deja `main` intacta** mientras se verifica, y si algo falla se
  descarta entera. Salió barato y conviene repetirlo.
- **Un commit por corte**, para que un `git revert` aísle. Los seis defectos de la tanda anterior
  se ubicaron por commit sin buscar.
  - **Y cuándo NO se puede**, que pasó en `1221643`: si un archivo participa de varios cortes
    —ahí, `popup.js`— separarlos deja commits intermedios que no compilan. Ahí conviene un commit
    grande y honesto antes que un historial lindo y roto. Se paga en granularidad del `revert`.
- **Anotá también qué hace falta para poder MIRAR el resultado.** El loader invisible era
  precondición de la verificación del copy genérico, y eso no aparecía en ninguna lista de
  dependencias: las dos entradas se veían independientes.
