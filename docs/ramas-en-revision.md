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

Corte 2c en curso en la rama `classroom-destino-2c`:
- **Plan 07 completado** (`07 - 2c-1 Editor web sobre el índice real.md`): editor web de adopción reutilizado con `?modo=indice`, `POST /api/destino/curso-visto` en memoria, `cursos.<clave>.nombres` en índice, preservación de materias/carpetas no editables, e inversión simétrica con `invertirCarpeta`.
- **Compuerta**: 64 archivos / 1010 tests (ver `docs/testing.md` §Baseline).
- **Humo jsdom**: `humo-editor.js` y `humo-editor-indice.js` en verde (errores: 0).
- Pendiente: planes restantes del corte 2c (08 y 09).

Corte 2b en curso en la rama `classroom-destino-2b`: construcción finalizada (planes 01 a 06). Pendiente verificación en navegador (V-0..V-9).

`classroom-destino-2b`: Corte 2b del destino de Google Classroom.
- **Planes**: `~/Boveda/Proyectos/courseDownloader/Planes/01 - 2b-1 Backend raíz por portal y servicio del índice.md`, `02 - 2b-2 Backend escritura a destino y decisión al guardar.md`, `03 - 2b-3 Cola de la extensión baja a destino.md`, `04 - 2b-4 El curso viaja con cada adjunto y el popup pide el estado al backend.md`, `05 - 2b-5 Lo que ve el dueño en la lista.md`, `06 - 2b-6 Cierre del corte 2b.md`.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md`.
- **Compuerta**: 62 archivos / 988 tests (ver `docs/testing.md` §Baseline).
- **Medición M-1**: Recorrido en frío de 1615 archivos en `~/Boveda/Areas/Facultad` en 4,29 s (tope 10 s).
- **Smoke test**: GET `/api/destino/indice`, POST `/api/destino/estado` y POST `/api/bypass-stream` en modo destino responden con el contrato de `deployment.md` sin escrituras colaterales en la bóveda.

### Checklist de verificación B del corte 2b (dueño + tanda)
- ⬜ **V-0** — Tanda: `cp -r ~/Boveda/Areas/Facultad ~/Descargas/facultad-prueba` (la raíz **sin** `.git`, que está en `~/Boveda`) y respaldo del índice migrado. `md5sum` del índice de la copia anotado.
- ⬜ **V-1** — Dueño: `pnpm run build`, recargar la extensión en Brave y **reiniciar el servidor Bun** (`ps -o lstart= -p <pid>` contra `git log -1 --format=%ci -- backend/`: Bun no recarga y el popup se traga el error).
- ⬜ **V-2** — Dueño: en una pestaña de Classroom, 📂 → elegir `~/Descargas/facultad-prueba`. Tanda: `cat backend/config_usuario.json` muestra `raices.google-classroom` y **`rutaRaiz` intacta**; el 📂 de Ramón Net/Anatomy sigue mostrando la suya (D-7 del plan 05).
- ⬜ **V-3** — Dueño: portada de Classroom al frente → «Escanear todos los cursos» (≈3 min). Tanda: `descargados + omitidos + pendientes = total escaneado`; **pendientes esperados: 0** (si hay, listarlos con su tema: puede ser material publicado después del 2026-09-27, y no es un defecto); los 9 omitidos aparecen como `omitido`; **0 archivos escritos** en la copia (`find ~/Descargas/facultad-prueba -newer <marca-de-V-0> -type f` vacío, salvo el índice si la corrección de ruta corrió).
- ⬜ **V-4** — AC-5/AC-5b. Tanda mueve **dentro de la copia** un archivo a otra materia y lo renombra. Dueño: re-escanea. Tanda: el índice de la copia anota la ruta nueva, el archivo **no** se volvió a bajar y nada se movió en disco.
- ⬜ **V-5** — AC-6/AC-1. Tanda borra un archivo de la copia. Dueño: re-escanea, lo selecciona y baja. Tanda: reaparece con el **nombre del índice** y su `md5sum` es igual al del archivo original de la bóveda real.
- ⬜ **V-6** — AC-2/AC-3. Tanda copia en la carpeta destino de un curso un archivo existente con **otro nombre** y quita la entrada de ese id del índice **de la copia**. Dueño: baja ese ítem. Tanda: **no** hay archivo nuevo, el índice apunta al existente, y el popup dice «Ya lo tenías».
- ⬜ **V-7** — AC-13/AC-12. Tanda agrega notas al final de un acceso `.md` de la copia. Dueño: re-escanea. Tanda: el `.md` quedó **intacto con sus notas**. Un acceso **nuevo** (borrar una entrada de acceso del índice y el archivo): el `.md` que se crea **empieza con el frontmatter** `tipo: acceso` y `revisado: <hoy>`.
- ⬜ **V-8** — AC-7/AC-9/RN-2. Tanda (en la copia): (a) agrega una coma de más al índice → el popup muestra la card «No se pudo leer .course-downloader.json» y no deja bajar nada; se arregla y **Reintentar** vuelve a la lista sin re-escanear el portal; (b) quita un tema del índice → ese tema sale `⚠ sin asignar`; (c) quita un curso del índice → nota «sin asociar» y sus checkboxes deshabilitados (no se pueden tildar ni con teclado).
- ⬜ **V-9** — No regresión. Dueño baja **un** video o adjunto de Ramón Net y **uno** de Anatomy. Tanda: siguen cayendo en `raíz/<portal>/<materia>/` de la `rutaRaiz` de siempre, con los mismos nombres. Si el dueño no tiene acceso activo a alguno, ese ítem queda **⚪ sin mirar** y se registra en la deuda (como el corte 1).

Al terminar V-0..V-9: el dueño borra `~/Descargas/facultad-prueba` y vuelve `raices.google-classroom` a su raíz real (o al default).

---

## Corte 2a (adopción) — mergeado

`classroom-destino-adopcion`: Corte 2a del destino de Google Classroom. Mergeado. La raíz es `~/Boveda/Areas/Facultad` (ADR-0018); la adopción se aplicó ahí (`32136ca` de la bóveda) con todos los ítems A-1..A-4 ✅ verificados.
- **Plan**: `docs/plan-classroom-destino-2a-adopcion.md`.
- **Plan de la bóveda**: `docs/plan-classroom-destino-2a-boveda.md`.
- **Spec**: `docs/specs/classroom-destino/spec.md`.
- **ADR**: `docs/adr/0017-indice-de-destino-en-la-raiz.md`, `docs/adr/0018-raiz-en-la-boveda-indice-versionado.md`.

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
