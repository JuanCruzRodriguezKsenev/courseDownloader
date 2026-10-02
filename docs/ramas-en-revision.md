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

Corte Moodle 1 en curso en la rama `moodle-linti`:
- **Plan**: `~/Boveda/Proyectos/courseDownloader/Planes/09 - Moodle-1 Lo genérico del destino que hoy dice Classroom.md`.
- **Qué entrega**: generalización del destino por índice para soportar Moodle sin tocar Classroom: módulo puro node-free `backend/destino/portales.js` (`PORTALES_VALIDOS`, `PORTALES_CON_DESTINO_INDICE`, `resolverRaizDeDestino`), extracción isomórfica de accesos Markdown a `core/destino/accesoMd.ts`, tolerancia del núcleo a formas de ítems de Moodle (temas vacíos a la raíz con `sinAsignar: false`, `idArchivo` con slashes y espacios, sufijos en choques RN-16 y claves con prefijo estricto).
- **Spec**: `docs/specs/moodle-linti/spec.md`. Implementa RN-1, RN-5, RN-7, RN-9, RN-13, NFR-1.
- **Compuerta**: 66 archivos / 1049 tests (ver `docs/testing.md` §Baseline).
- **Estado**: Plan 09 ejecutado por `obra`.

Corte 2c en curso en la rama `classroom-destino-2c`:
- **Planes**: `~/Boveda/Proyectos/courseDownloader/Planes/07 - 2c-1 Editor web sobre el índice real.md`, `08 - 2c-2 Asociar desde el popup y cierre del 2c.md`, `08b - 2c-3 Resaltado, orden y filtro de temas sin asignar.md`, `08c - 2c-4 Nuevo editor web monocromo de alta densidad.md`, `08d - 2c-5 Ajustes ergonomicos del editor web (layout, carpetas y sticky).md`, `08f - 2c-6 Deteccion estricta de carpetas por materia y creacion en ambos selectores.md`, `08g - 2c-7 Desactivacion limpia de carpetas y eliminacion de opcion redundante en selector.md` y `08h - 2c-8 Atenuacion e indicador inmutable para archivos en disco.md`.
- **Qué entrega**: editor web de adopción monocromo con ajustes ergonómicos: tabla de archivos con `table-layout: fixed` y nombres editables legibles, eliminación de duplicación de rutas en vivo, encabezados sticky escalonados (toolbar fija + tarjetas de tema fijas durante el recorrido de sus clases), soporte para creación y persistencia de carpetas personalizadas, detección estricta de subcarpetas por materia activa (sin mezcla global), creación interactiva en ambos selectores (`#selectMateria` y destinos), tilde verde circular para archivos ya descargados y eliminación de pill redundante `"ya está en disco"`, checkboxes de acento verde contrastado, desactivación limpia de carpetas vía checkbox maestro (`tema.destino = "-"` y archivos omitidos), eliminación de la opción redundante `-` en el selector con estado disabled, y atenuación visual neta con badge `🔒 en disco` para archivos descargados inmutables.
- **Spec**: `docs/specs/classroom-destino/spec.md`. Implementa RN-3, RN-6, RN-7, RN-9, RN-10, RN-13, RN-31, AC-9.
- **Compuerta**: 64 archivos / 1034 tests (ver `docs/testing.md` §Baseline).
- **Humo jsdom**: `humo-editor.js` y `humo-editor-indice.js` en verde (errores: 0).
- **Estado**: Plan 08h ejecutado por `obra`. Pendiente verificación en navegador (W-0..W-7).

### Checklist de verificación W del corte 2c (dueño + tanda)
- ⬜ **W-0** — Tanda: copia limpia de `~/Boveda/Areas/Facultad` y respaldo del índice. Para simular un curso **nuevo**, **quita del índice de la copia** un curso con pocos archivos (anotar cuál y sus entradas para restaurarlo). `pnpm run build`, recarga de la extensión, servidor reiniciado, y `raices.google-classroom` apuntando a la copia.
- ⬜ **W-1** — Dueño: escanea el curso quitado (o «todos»). Debe ver la nota «N curso(s) sin asociar … Abrí 🗂️», sus filas con la pastilla `sin asociar` y los checkboxes deshabilitados.
- ⬜ **W-2** — Dueño: toca 🗂️. Debe abrirse una pestaña con el editor **en ese curso**, con la materia vacía y las carpetas de los temas ya sugeridas. Tanda anota qué sugirió para cada tema y lo contrasta con RN-7a/7b (`Links` → `Teorias`; un tema conceptual con publicaciones «Ejercicios…» → `Practicas`).
- ⬜ **W-3** — Dueño: elige materia y docente, corrige una carpeta y un nombre, marca un archivo `omitir`, guarda. Tanda: el índice de la copia tiene el curso con `materia`, `docente`, los `temas` resueltos (con `Teorias/<docente>` si hay docente), `nombres` sólo del archivo editado y `omitidos` con el marcado; `archivos` **sin cambios**.
- ⬜ **W-4** — Dueño: reabre el popup en ese curso. Debe verlo asociado, **sin tocar nada más**: filas con su pastilla de carpeta, el nombre editado en la etiqueta, el omitido marcado `omitido`. Baja **un** archivo. Tanda: está en `<materia>/<carpeta>/<nombre editado>` y su `md5sum` es el del original.
- ⬜ **W-5** — AC-8: Dueño cambia el docente de un curso **ya asociado** desde el editor. Tanda: ninguna entrada de `archivos` cambió y ningún archivo se movió; el siguiente que se baje va a `Teorias/<docente nuevo>/`.
- ⬜ **W-6** — AC-9: Tanda agrega un tema nuevo al curso (borra uno del índice de la copia). Dueño: ve `⚠ sin asignar`; abre 🗂️, asigna carpeta, guarda; al reabrir el popup la marca desapareció.
- ⬜ **W-7** — Servidor reiniciado con el editor abierto: Dueño toca Guardar. Debe ver un error claro (no un guardado a medias); reabriendo 🗂️ desde el popup vuelve a funcionar. Y en un portal **sin** `destinoPorIndice` (Ramón Net o Anatomy), 🗂️ abre el editor de TSV como antes.

Al terminar W-0..W-7: se borra la copia y se restaura el curso que se quitó **en la copia** (la bóveda real nunca se tocó).

---

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
