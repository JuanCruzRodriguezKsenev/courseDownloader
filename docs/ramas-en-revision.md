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

### `correccion-plan31` (Plan 34) — en revisión (2026-10-10); V-1 a V-8 verificadas por tanda con Playwright el 2026-10-13

Compuerta: 87 archivos / 1330 tests, lint 0, tsc 0, build ok.

Correcciones de la verificación del Plan 31 (M-4 y hallazgos menores):
- M-4: Serialización de `recorrido_evento` en SW y silenciamiento de scrapers Moodle tras `pagehide`.
- Nombres de curso en `/my/`: extracción de texto visible limpiando `.sr-only`/`.accesshide`/`.visually-hidden`.
- Extensión real en recursos de Moodle (Ingeniería e Informática): resolución por 302 o HTML del visor.
- Extensiones en Mate C: `.md` para accesos externos y `.pdf` para Drive no video.
- Aviso en raíz de Moodle: sugerencia de ir a Área personal.
- Textos de oferta de escaneo multi-curso específicos de Moodle y limpieza de bienvenida.

Checklist en navegador (Playwright, perfil `~/.local/share/courseDownloader/perfil-playwright`):
- [x] V-1 (M-4 otra vez) — Ingeniería `/my/`, lanzar «Escanear todos», navegar a otra página del portal en el curso 2-3: en ≤ 5 s `recorridoTodos.estado === "cortado"`, `motivoCorte === "navegacion"`, los cursos completos con su resultado y **ningún** `fallido` por «error de red». Repetir una vez en Informática o LINTI. ✅ 2026-10-13: Ingeniería cortó en 0,9 s (`navegacion`, curso 4 de 8, 0 fallidos); LINTI en 0,55 s (curso 3 de 3, 0 fallidos).
- [x] V-2 (nombres) — Evento `inicio` de Ingeniería: los 9 con nombre, ninguno `Curso <id>` ni con «Nombre del curso». Lo mismo en Informática y LINTI. ✅ 2026-10-13: Ingeniería 8 cursos con nombre (el 2777 «MatePi» ya no existe en el portal: no figura en el perfil y su `view.php` da «Error»); Informática 2 y LINTI 3, ninguno `Curso <id>`.
- [x] V-3 (PDF) — Con `HOME` de prueba (`~/.local/share/courseDownloader/home-prueba`, servidor levantado con ese `HOME`): bajar un PDF de Ingeniería (`205818`) y uno de Informática (`4763`): en disco terminan en `.pdf` y el `original` del índice es «<título>.pdf». ✅ 2026-10-13: `teorema_de_las_4_equivalencias.pdf` y `mod1_notas_tp_imperativo.pdf` (`file`: PDF), `original` «Teorema de las 4 equivalencias.pdf» y «Notas TP Imperativo.pdf».
- [x] V-4 (Mate C) — Mismo `HOME`: un acceso de YouTube cae como `.md`. ✅ 2026-10-13: `video_series_mew_bo5a3vo.md`, `original` «Video Series (meW-bo5A3vo).md».
- [x] V-5 (raíz) — `/` de los tres Moodle: card «Esta página no se escanea» con el nombre del portal y el texto de su `config.ts`. ✅ 2026-10-13: card en Ingeniería y LINTI con `/`; Informática redirige `/` a `/my/` con sesión iniciada (lo hace el portal), con `/?redirect=0` la card aparece con su texto.
- [x] V-6 (oferta) — `/my/` de los tres: la tarjeta dice el texto de RN-29; en Classroom `/h`, el de siempre. ✅ 2026-10-13: texto de RN-29 en los tres Moodle. Classroom verificado **por código** (ningún `config.ts` de Classroom define `textoOfertaTodos`; `popup.js:2370` conserva el texto anterior): el perfil de Playwright no tiene sesión de Google.
- [x] V-7 (tiempo) — `duracionMs` sumado del recorrido de Informática y LINTI. Si alguno pasa 60 s, va como hallazgo (el texto dice «menos de un minuto»). ✅ 2026-10-13: LINTI 14,3 s (3 cursos), Informática 8,1 s (2 cursos).
- [x] V-8 (bienvenida) — Abrir el tutorial: sin «videos» en las slides 2 y 3. ✅ 2026-10-13: slide 2 «para detectar las clases y el material», slide 3 «Qué escanear» con la `instruccionEscaneo` nueva; sin «videos».

### `moodle-ingenieria` (Plan 31) — en `main` (2026-10-06); verificada en navegador el 2026-10-10 con **un fallo (M-4)**

Compuerta del merge: 87 archivos / 1313 tests, lint 0, tsc 0, build ok.

Sexto portal: Moodle de Ingeniería (`www.asignaturas.ing.unlp.edu.ar` y sin `www`).
Escaneo de curso individual y recorrido completo desde `/my/` (modo `todos`).
Destino por índice a `~/Boveda/Areas/Facultad/Ingenieria/` con H-1 resuelto en backend.

Verificó tanda con Playwright (Chromium aparte, sesión real del dueño) contra el checklist **del plan**
(`~/Boveda/Proyectos/courseDownloader/Planes/31 - …`, §Checklist manual), que es la fuente: la lista que
estaba acá tenía otras letras y había perdido casillas. Resultado casilla por casilla en el plan.

- ✅ M-A, M-1, M-3, M-B, M-C, M-D, M-E, M-F, M-G.
- ❌ **M-4 (navegar a mitad del recorrido):** el curso a medias queda «fallido: error de red» en vez de
  descartarse (RN-19) y el recorrido sigue «escaneando» hasta que el popup lo corta por vigencia con
  «dejó de responder». Pendiente: plan de corrección.
- Hallazgos menores: tarjetas «Curso 5935/5797/4768» sin nombre; textos de `/my/` heredados de Classroom;
  los PDF de Moodle se guardan sin `.pdf`; el acceso de Mate C se guarda sin `.md`.

## Mergeado el 2026-10-06

Verificado por el dueño en Chrome («todo ok»): `marca-resaltador` (planes 26, 27 y 28), `moodle-multicurso`
(plan 29), y el arrastre de los planes 22, 23, 24 y 25, que ya estaban en `main`. Plan de verificación:
`~/Boveda/Proyectos/courseDownloader/Planes/30 - Verificacion conjunta y merge de marca-resaltador y moodle-multicurso.md`.
Specs: `docs/marca-diseno.md`, `docs/specs/moodle-linti-multicurso/spec.md`, `docs/specs/moodle-asignaturas-multicurso/spec.md`.
**No quedó registro casilla por casilla**; si alguna importa, rehacerla contra el código.
Hallazgo del plan 29 (RN-8): la sesión vencida **corta** el recorrido (no pausa).
Portal sin implementar, sólo con spec `draft` y mediciones parciales: IDEAS (`docs/specs/ideas-info/`). Moodle de Ingeniería (`docs/specs/moodle-ingenieria/`) implementado en rama `moodle-ingenieria`.

## Mergeado el 2026-10-04

- **Classroom 2b y 2c** (planes 01 a 08h): entraron a `main` con `535fa40`. La rama `classroom-destino-2c`
  ya no existe. Diseño: `docs/specs/classroom-destino/spec.md` y `docs/adr/0019-raiz-por-portal-y-backend-decide-lo-descargado.md`.
- **Moodle LINTI, Google Sites Mate C, Moodle Asignaturas, botón «Que hereden» y borrador local del editor**
  (planes 09 a 19): `c1f8a57`. Specs: `docs/specs/moodle-linti/`, `docs/specs/google-sites-matec/`,
  `docs/specs/moodle-asignaturas/`.
- **Subcarpeta por tema** (plan 20): `565b7ee`.
- **Loader en tarjetas y cancelar escaneo** (planes `loader-tarjetas` y `cancelar-escaneo`): verificado por el dueño en Brave, T-1..T-5 y C-1..C-10 dados por buenos. Registro de diseño: `docs/portal-google-classroom-diseno.md` §11.
- **Videollamadas con chip y al tope** (plan 12): verificado por el dueño en Brave con el curso Fisica II G25 2026. Hallazgo menor: el mapeo de `esVideollamada` en `popup.js` no tiene test directo (ADR-0005).
- **Nombres que chocan** (plan 21): `37a1e96`. M-1 a M-4 verificados con el dueño en la copia de prueba.

Los checklists V-0..V-9 (2b), W-0..W-7 (2c) y H/B (planes 17 y 19) estuvieron en este doc con las casillas
sin marcar. El merge los dio por superados, pero **no quedó registro de cada casilla**; si alguna importa,
rehacerla contra el código actual antes de confiar en ella.

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
