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
  - Paso 1: `ScraperClassroom` con `modo: "todos"`, cancelación entre cursos/latidos y emisión de eventos `recorrido_evento` vía `chrome.runtime.sendMessage`. 24 tests con control negativo probado.
  - Paso 2: Contrato `PuertoSitio` v1.7.0 con `esPortada?`, config Classroom v1.3.0 (`claveDeListado: "todos"` en portada, instruccionEscaneo).
  - Paso 3: Módulo puro `core/estado/recorridoTodos.ts` (reductor, vigencia, resumen, enlacesDe) y lector `RecorridoTodos` exportado en `plataforma/composicion.ts`. 14 tests.
  - Paso 4: Manejador IPC `recorrido_evento` en `background.js` persistiendo en `storage.local.recorridoTodos`. 30 tests.
  - Paso 5: `decidirAlAbrir` v1.1.0 en `core/estado/origenListado.ts` con 5 filas y `"recorridoTodos"` en `CLAVES_DE_SESION`. 15 tests.
  - Paso 6: Orquestador `popup.js` v5.28.0 (lanzar, mirar, materializar recorrido multi-curso, cards de progreso/oferta/terminado-sin-material).
  - Paso 7: Lista agrupada por curso (`ctx.grupos`), estilos `.grupo-curso` y `.lista-nota: white-space: pre-line` en `styles/list.css`, isla `listaClases.preact.js` v1.4.0. 39 tests.
  - Paso 8: Revisión de copy en onboarding (slide 3).
  - Paso 9: Documentación (ADR-0016, README ADRs, `AGENTS.md`, `data-model.md`, `patterns.md`, `architecture.md`, `multisitio-diseno.md`, `portal-google-classroom-diseno.md`, `TECHNICAL_DEBT.md`, `testing.md`).
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
