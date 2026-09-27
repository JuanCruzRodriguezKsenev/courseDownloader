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

`classroom-destino-adopcion`: Corte 2a del destino de Google Classroom en `~/U.N.L.P`. Adopción de lo ya descargado mediante TSV editable, cálculo de md5, detección de choques y generación del índice `.course-downloader.json`.

- **Plan**: `docs/plan-classroom-destino-2a-adopcion.md`. Compuerta 50 archivos / 837 tests.
- **Pendiente de obra**: `docs/plan-classroom-destino-2a-editor-popup.md` — el editor pasa al servidor del 3001 (`/adopcion/`) y se abre con 🗂️ desde el popup.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0017-indice-de-destino-en-la-raiz.md`.

### Checklist de verificación B (dueño + tanda)
- **A-1** — Dueño: `pnpm run build`, recargar, portada de Classroom al frente → "Escanear todos los cursos", sin escanear nada después. Tanda corre `generar.js` y compara los números: 366 ítems en 5 carpetas; `ya-esta` 55; `duplicado` 4; `omitir` 8; `copiar` 299; 7 cursos; 2 choques (MC2, Novedades: 7 filas con copias "(N)" de distinto md5).
- **A-2** — Editor web de los TSV:
  - Tanda levanta `bun backend/adopcion/editor.js` y el dueño abre `http://127.0.0.1:3002`.
  - En la página decide lo mismo que dice hoy la lista (docente de Física I, destinos `regla=no`, nombres, cronogramas, los 7 choques), hasta que Probar dé `codigo` 0.
  - No correr `generar.js` después de editar: pisa los TSV.
- **A-3** — Tanda: `aplicar.js` sin `--escribir` y revisa la salida con el dueño. Después, `--escribir`.
- **A-4** — Tanda verifica en disco:
  - `git -C ~/U.N.L.P status --porcelain`: sólo ` M .gitignore` y `?? Ingenieria/…`. **Ninguna** ` M` ni ` D` dentro de `Ingenieria/` (NFR-4). El índice **no** aparece (RN-24, NFR-2).
  - Cada fila `copiar`: md5 en destino igual al de origen.
  - `getfattr -d -R` sobre lo copiado: vacío (RN-28, NFR-1).
  - `.course-downloader.json` parsea con `parsearIndice`. Las entradas de `archivos` son las filas menos las `omitir`.

## Lo último que se mergeó (2026-09-27)

`classroom-novedades-scroll`: `buscarContenedorScroll` (`sitio/google-classroom/scraper.js`) exige
que el contenedor scrollee de verdad (`scrollHeight > clientHeight + 1`). La `<nav>` lateral de
Classroom tiene `overflow-y: auto` pero no scrollea; al elegirla, Novedades leía sólo la primera
página. Cierra la deuda 🟠 de Novedades, de la que dependía el corte 2.

- **Plan**: `docs/plan-classroom-novedades-scroll.md`. Compuerta 46 archivos / 801 tests; el control
  negativo del test 39 falla sin el arreglo (lo corrió tanda en un worktree aparte).
- **Verificado en Brave (2026-09-27, contado por tanda en el storage, escrituras de las 17:34-17:38)**:
  - **N-2** (recorrido de todos): 7 cursos, 0 fallidos. Novedades de G25 trae **28** adjuntos (antes
    4), el mismo número que dio el scroll a mano en el diagnóstico. Tiempo total **~175 s** contra los
    ~124 s de B-3; el curso más lento tarda 45,6 s, lejos del tope de 180 s.
  - **N-1** (G25 solo): los mismos **28** adjuntos de Novedades, los 28 marcados como descargados. No se
    bajó ningún archivo nuevo a `~/Descargas/verificacion-b`.

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
