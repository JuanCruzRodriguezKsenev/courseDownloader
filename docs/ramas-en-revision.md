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

Corte 2b en curso en la rama `classroom-destino-2b`: sub-corte 2b-4 implementado (cada adjunto sabe de qué curso es, y el popup le pregunta al backend qué está descargado).

`classroom-destino-2b`: Corte 2b del destino de Google Classroom.
- **Planes**: `~/Boveda/Proyectos/courseDownloader/Planes/01 - 2b-1 Backend raíz por portal y servicio del índice.md`, `02 - 2b-2 Backend escritura a destino y decisión al guardar.md`, `03 - 2b-3 Cola de la extensión baja a destino.md`, `04 - 2b-4 El curso viaja con cada adjunto y el popup pide el estado al backend.md`.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md`.
- **Compuerta**: 61 archivos / 968 tests (ver `docs/testing.md` §Baseline).
- **Medición M-1**: Recorrido en frío de 1615 archivos en `~/Boveda/Areas/Facultad` en 4,29 s (tope 10 s).
- **Smoke test**: GET `/api/destino/indice`, POST `/api/destino/estado` y POST `/api/bypass-stream` en modo destino responden con el contrato de `deployment.md` sin escrituras colaterales en la bóveda.

`classroom-destino-adopcion`: Corte 2a del destino de Google Classroom. La raíz es `~/Boveda/Areas/Facultad` (ADR-0018); la adopción se aplicó ahí (`32136ca` de la bóveda).

- **Plan**: `docs/plan-classroom-destino-2a-adopcion.md`. Compuerta: ver docs/testing.md §Baseline.
- **Plan de la bóveda**: `docs/plan-classroom-destino-2a-boveda.md`.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0017-indice-de-destino-en-la-raiz.md`, `docs/adr/0018-raiz-en-la-boveda-indice-versionado.md`.

### Checklist de verificación B (dueño + tanda)
- ~~**A-1**~~ — Dueño: `pnpm run build`, recargar, portada de Classroom al frente → "Escanear todos los cursos", sin escanear nada después. Tanda corre `generar.js` y compara los números: 366 ítems en 5 carpetas; `ya-esta` 55; `duplicado` 4; `omitir` 8; `copiar` 299; 7 cursos; 2 choques (MC2, Novedades: 7 filas con copias "(N)" de distinto md5). — reemplazada por A-1b y A-1c ✅
- **A-1b** ✅ 2026-09-27 (re-escaneo 19:33; `generar.js`: 366 ítems, 0 sin publicación, regla=no 1 = `Cuestiones administrativas`, MC2 9 temas/14 ítems → `Practicas`, Links 18 → `Teorias`, 2 choques; docentes re-aplicados, `cursos.tsv` idéntico al respaldo `~/Descargas/adopcion-classroom-respaldo-20260927-rn7a`) — Dueño y tanda (sugerencia por títulos de publicación, RN-7a/7b):
  - Dueño: `pnpm run build` → recargar la extensión en Brave → portada de Classroom al frente → "Escanear todos los cursos" (≈3 min), sin escanear nada después.
  - Tanda: regenera los TSV con `generar.js` y re-aplica los docentes que el dueño ya había guardado en `cursos.tsv` (Física I = `Lucila`, MB5 = `benevetano`).
  - Números esperados detallados en la Verificación B de `docs/plan-classroom-destino-2a-publicacion.md` (366 ítems, regla=no en 1 correspondiente a `Cuestiones administrativas`, MC2 en `Practicas si`, Links en `Teorias si`).
- **A-1c** ✅ 2026-09-27 (re-escaneo 21:10; `generar.js`: 366 ítems, 55/4/8/299, 7 renombrados, 0 choques, 0 Novedades sin anuncio; `archivos.tsv` real difiere del respaldo `~/Descargas/adopcion-classroom-respaldo-20260927-rn16a` sólo en `nombre` de esas 7 filas; `cursos.tsv`/`temas.tsv` intactos) — Dueño y tanda (nombramiento de choques en Novedades por la primera frase del anuncio, RN-16a):
  - Dueño: `pnpm run build` → recargar la extensión en Brave → portada de Classroom al frente → "Escanear todos los cursos" (≈3 min), sin escanear nada después.
  - Tanda: regenera los TSV con `generar.js` y re-aplica los docentes que el dueño ya había guardado en `cursos.tsv` (Física I = `Lucila`, MB5 = `benevetano`).
  - Números esperados detallados en la Verificación B de `docs/plan-classroom-destino-2a-anuncio.md` (366 ítems, 7 renombrados por la frase del anuncio, 0 choques).
- **A-2** — Editor web de los TSV: — E-1..E-7 ✅ (ver la línea A-2 ✅ 2026-09-28)
  - El editor muestra un curso a la vez con los archivos bajo su tema (plan `docs/plan-classroom-destino-2a-editor-por-curso.md`). E-1..E-7 ✅ (tanda, 2026-09-27, Claude in Chrome sobre 3002 + copia). E-1 cazó que las insignias en 0 se veían: `.badge { display }` pisaba el atributo `hidden`, que jsdom no evalúa. Lo corrigió tanda con `[hidden] { display: none !important; }` en editor.html, y el humo sigue igual a la tabla del plan.
  - Con el servidor Bun del 3001 levantado, el dueño abre el editor con 🗂️ en el encabezado del popup (`http://127.0.0.1:3001/adopcion/`).
  - En la página decide lo mismo que dice hoy la lista (docente de Física I, destinos `regla=no`, nombres, cronogramas, los 7 choques), hasta que Probar dé `codigo` 0.
  - No correr `generar.js` después de editar: pisa los TSV.
- **A-2 → sesión de revisión (dueño, 2026-09-27)**: en otra sesión se revisa `archivos.tsv` **archivo por archivo** (que cada uno vaya a donde corresponde en `~/U.N.L.P`), se corrige el TSV y se informa lo hallado. Antes de tocar: respaldo de los tres TSV reales; editarlos directo o por el editor (guarda byte-idéntico), **nunca** regenerar con `generar.js`. Cierra cuando Probar/ensayo dé `codigo` 0 y el dueño aprobó el informe.
- **A-2** ✅ 2026-09-28 (sesión de revisión del dueño, TSV guardados 01:06): único cambio contra A-1c, el tema `Cuestiones administrativas` de Física I pasa a `-` (omite el `.md` del formulario de inscripción) → omitidos 8→9, copiar 299→298. Respaldo de los TSV antes de escribir: `~/Descargas/adopcion-classroom-respaldo-20260928-a3`.
- **A-3** ✅ 2026-09-28 (ensayo del dueño = ensayo de tanda: copiar 298 / ya-esta 55 / duplicado 4 / omitidos 9, código 0; `--escribir`: 298 copiados, 2 carpetas creadas, 0 errores con `2>&1`) — Tanda: `aplicar.js` sin `--escribir` y revisa la salida con el dueño. Después, `--escribir`.
- **A-4** ✅ 2026-09-28 (status: 298 `??` en `Ingenieria/` + ` M .gitignore` que agrega `.course-downloader.json`, 0 ` M`/` D` en `Ingenieria/`, índice ignorado; md5 298/298 iguales; `getfattr` vacío; `parsearIndice` ok, 357 entradas = 366 − 9 omitidos; el `.md` omitido no está en índice ni en disco). Nada commiteado en `~/U.N.L.P`: lo commitea el dueño. — Tanda verifica en disco:
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
