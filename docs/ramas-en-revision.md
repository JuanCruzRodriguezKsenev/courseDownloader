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

## 🚧 En revisión: `classroom-escanear-todas` (desde el 2026-09-25)

- **Qué trae**: escanear todos los cursos de Classroom desde la portada, en un solo recorrido
  que sobrevive a cerrar el popup.
  - Spec: `docs/specs/classroom-escanear-todas/spec.md`.
  - Plan: `docs/plan-classroom-escanear-todas.md`.
- **Hecho por paso**:
  - Paso 1: `ScraperClassroom` con `modo: "todos"`, cancelación entre cursos/latidos y emisión de eventos `recorrido_evento` vía `chrome.runtime.sendMessage`. 24 tests (el control negativo de 20 y 23 NO detecta: ver Revisión de tanda).
  - Paso 2: Contrato `PuertoSitio` v1.7.0 con `esPortada?`, config Classroom v1.3.0 (`claveDeListado: "todos"` en portada, instruccionEscaneo).
  - Paso 3: Módulo puro `core/estado/recorridoTodos.ts` (reductor, vigencia, resumen, enlacesDe) y lector `RecorridoTodos` exportado en `plataforma/composicion.ts`. 14 tests.
  - Paso 4: Manejador IPC `recorrido_evento` en `background.js` persistiendo en `storage.local.recorridoTodos`. 30 tests.
  - Paso 5: `decidirAlAbrir` v1.1.0 en `core/estado/origenListado.ts` con 5 filas y `"recorridoTodos"` en `CLAVES_DE_SESION`. 15 tests.
  - Paso 6: Orquestador `popup.js` v5.28.0 (lanzar, mirar, materializar recorrido multi-curso, cards de progreso/oferta/terminado-sin-material).
  - Paso 7: Lista agrupada por curso (`ctx.grupos`), estilos `.grupo-curso` y `.lista-nota: white-space: pre-line` en `styles/list.css`, isla `listaClases.preact.js` v1.4.0. 39 tests.
  - Paso 8: Revisión de copy en onboarding (slide 3).
  - Paso 9: Documentación (ADR-0016, README ADRs, `AGENTS.md`, `data-model.md`, `patterns.md`, `architecture.md`, `multisitio-diseno.md`, `portal-google-classroom-diseno.md`, `TECHNICAL_DEBT.md`, `testing.md`).
  - **Correcciones pendientes**: `docs/plan-classroom-escanear-todas-correcciones.md` (7 pasos, 2026-09-27), por los hallazgos de la Revisión de tanda y de B-2/B-3.
- **Verificación B — en Brave, la hace el dueño**:
  - [ ] 1. **M-1**: con el escaneo de un curso (como en `main`), cronometrar cada curso por separado. Si el promedio se aleja de 45 s, corregir texto en Paso 6f y NFR-1.
  - [ ] 2. **AC-1**: Portada `/u/2/h`, abrir el popup: tarjeta "Todas mis clases", botón "Escanear todos los cursos", y la pestaña **no** se mueve.
  - [ ] 3. **AC-2 / AC-8**: Apretar el botón con la pestaña al frente, esperar sin tocar. Al final: resumen con los cursos de hoy (5 activos + 2 archivados = 7), G25 con 71 de Trabajo en clase y MB5 con 24, un encabezado por curso con material, y MC6 y Q5 sin grupo, contados como vacíos. Cronometrar el total (NFR-1: menos de 6 min).
  - [ ] 4. **AC-4**: Relanzar con 🔄. En el curso 2, cerrar el popup. A los 60 s, reabrirlo: progreso en un curso posterior. Al terminar, la lista está completa.
  - [ ] 5. **AC-5**: A mitad del recorrido, abrir el popup (la pestaña está dentro de un curso): se ve el progreso y **no** aparece "Escaneando la pestaña…".
  - [ ] 6. **AC-3**: Terminado el recorrido, entrar a MC2 y escanearla sola: mismos ítems y nombres que en su grupo.
  - [ ] 7. **AC-6**: Relanzar y, en el curso 4, cambiar de pestaña. Volver y abrir el popup: resumen "Se cortó en el curso 4 de 7: Classroom quedó en segundo plano", con los 3 completos en la lista. Repetir haciendo click en otro curso del sidebar: "navegaste fuera del recorrido".
  - [ ] 8. **AC-9**: Si algún archivo de Drive está en dos cursos, aparece en los dos grupos, y bajarlo desde uno no lo marca en el otro.
  - [ ] 9. **AC-10**: Bajar un PDF de G22 y uno de MC2: cada uno en `raíz/google-classroom/<curso>/`.
  - [ ] 10. **AC-11**: Con la lista de todos, entrar a MC2 y abrir el popup: escanea MC2. Volver a la portada y abrir el popup: tarjeta "Todas mis clases", no la lista de todos.
  - [ ] 11. **AC-12**: En la portada con lista de todos, 🔄 arranca un recorrido nuevo desde el curso 1.
  - [ ] 12. **AC-13**: Dentro de G22, sin recorrido: el popup se comporta igual que en `main`.
  - [ ] 13. **Consola del SW**: llegan los `recorrido_evento`, sin errores.
- **Revisión de tanda (2026-09-27)** — compuerta re-corrida por el verificador: 44 archivos / 758
  tests, lint, `tsc` y build en verde, árbol limpio. Hallazgos:
  - 🔴 **El nombre del curso sale como id base64 en 7 de 8 cursos.** `leerCursosDePagina`
    (`scraper.js`, recorrido) se queda con la PRIMERA ancla fuera de `nav` de cada id, y en el DOM
    real cada tarjeta tiene tres y la primera (la imagen) no tiene texto ni `aria-label`. Simulado
    sobre `recorrido-3/00-partida.html` y `00-archivadas.html`: sólo G22 sale con nombre. Pega en la
    tarjeta de progreso y en el `⚠ <nombre>: <motivo>` del resumen (AC-7); los encabezados de grupo
    no, porque salen del `modulo`. El fixture `portada.html` miente: una sola ancla con texto por
    curso. Los nombres buenos están en el `aria-label` del sidebar (activos) y en el texto de la
    segunda ancla de la tarjeta (archivados).
  - 🟡 **El test 23 no tiene poder de detección**: con `dormir` sin rechazar por `cancelado`, pasa
    igual (control negativo corrido por la tanda). La cancelación está bien por lectura (ningún
    `catch` del escaneo se traga el error), pero el fixture no tiene un curso "zombi" que haga
    daño al seguir corriendo. El test 20 también pasa sin el chequeo de `visible()` entre cursos,
    y ahí es legítimo: el chequeo dentro del curso lo cubre (el control estaba mal elegido en el
    plan). **Lo que dice arriba, "control negativo probado", no era cierto.**
  - 🟡 **AC-14 no se ve**: `lanzarRecorridoTodos` no cambia el modo del botón, y en
    `renderizarListadoInterfaz` la tarjeta de oferta (`data-modo === 'escanear-todos'`) se evalúa
    antes que la de "El recorrido no trajo material". Mismo origen: durante el progreso el botón
    sigue diciendo "Escanear todos los cursos", habilitado.
  - 🟡 **`lanzarRecorridoTodos` no tiene la guarda de la fila 1.** Entre curso y curso la pestaña
    pasa por `/h/archived`, que es portada: popup reabierto ahí + 🔄 → segundo recorrido en la
    misma pestaña.
  - ⚪ **El reductor no tiene estado terminal**: `latido`/`curso`/`fin` se aplican después de un
    `fin` o de `materializado`. Si el popup corta por vigencia (`sin-respuesta`) mientras el
    script sigue vivo, el script vuelve a escribir enlaces y un `fin terminado`. El peor caso
    latido→curso es 15 + 15 + 180 s = 210 s, justo el umbral de `esVigente`.
  - ✅ **Loader "Conectando con el servidor…" infinito en la portada** (lo vio el dueño en B-2,
    2026-09-27). `escanearOUsarGuardada()` devuelve `true` ("el loader es mío") y las tres
    decisiones nuevas (`mostrar-recorrido`, `materializar-recorrido`, `ofrecer-todos`) volvían sin
    `ocultarLoader()`; `usar-guardada` sí lo apaga vía `mostrarListaGuardada`. Corregido por la
    tanda (3 líneas en `popup.js`). Sin test: el mecanismo de loader de `popup.js` no tiene
    cobertura (🔴 "El loader del popup no tiene dueño", `TECHNICAL_DEBT.md`).
  - **B-2/B-3 en Brave (dueño, 2026-09-27 12:24–12:26)**, tres recorridos leídos del storage de la
    extensión (`Local Extension Settings/<id>/000026.log`), no de capturas:
    - 🔴 **Los archivados no entran**: los tres enumeran 5 cursos (los activos); G25 y MB5 faltan.
      El script lee `/h/archived` apenas cambia la URL, antes de que pinten las tarjetas.
    - 🔴 **El primer curso (G22) falla siempre** con "Classroom no terminó de abrir Trabajo en
      clase" en menos de 1 s: es la rama `!linkTrabajo`, el escaneo arranca con la URL ya en
      `/c/<id>` pero sin el `nav` del curso pintado. En el primer recorrido fallaron los 5 igual.
    - 🔴 **Lo escaneado está incompleto**: Física I-Grupo G trajo 1 enlace en un recorrido y 7 en
      el otro (la muestra `recorrido-3/05-…-trabajo.html` tiene 80 ítems). Cada curso tardó 7–8 s.
      Causa sin medir.
    - Nombres: además del id base64, cuando salen del texto traen la inicial del avatar pegada
      ("FFísica II G22", "MMC2 2025", "QQ5Primer…"). El `aria-label` es el limpio.
    - El dueño pide que el botón no quede usable durante el recorrido. Decidido por la tanda:
      **se oculta** (no hay acción que ofrecer; la tarjeta de progreso ya dice qué pasa) y **no**
      se usa el loader del escaneo de un curso, que taparía la tarjeta de progreso y el resumen.
      El resumen (cursos, con material, vacíos, fallidos) al dueño le sirve: se queda.
  - ⚠️ **NO REPRODUCIDO — mirar en B-3**: (a) si al llegar a un curso queda montada la vista de
    Trabajo en clase del anterior, el chequeo `/c/<otroId>/m/` devuelve `avisoCursoCambiado` y el
    recorrido entero se corta como "navegaste fuera del recorrido"; las muestras guardan una sola
    `c-wiz`, así que no lo pueden confirmar ni descartar. (b) Para los activos, el script hace
    click en `/h/archived` y, sin esperar, en el link del sidebar: carrera entre dos navegaciones.

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
