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

- `disco-manda`: Plan 22 (`~/Boveda/Proyectos/courseDownloader/Planes/22 - Lo que esta en disco manda.md`).
  Specs: `docs/specs/disco-manda/spec.md`, `docs/specs/classroom-destino/spec.md`.
  Compuerta: 81 archivos / 1239 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js` (errores: 0).
  - ⬜ **M-1** — Escanear **Física I** en el popup: `mod1_01_variables_cinematicas.pdf` aparece como «ya está» con el nombre `Cinematica (clase 1).pdf`, la ruta `Ingenieria/Fisica 1/Practicas` y el chip «movido»; no se baja nada. Los otros archivos de Física I no cambian.
  - ⬜ **M-2** — Escanear **Física I** de nuevo: el mismo archivo sin el chip. Abrir 🗂️: la fila del archivo muestra la ruta y el nombre nuevos, con el candado «en disco» y sin campos editables.
  - ⬜ **M-3 (RN-5)** — Con MC2 ya descargado en la copia: sacar del índice **sólo** la entrada de `mc_2025_series_1.pdf` (`jq` por `.nombre`, dejando el archivo en disco) y moverlo a `Ingenieria/Fisica 2/Notas/`. Bajar ese adjunto desde el popup: no aparece ningún archivo nuevo en `Matematica C/`, el popup dice «Ya lo tenías», y el índice tiene esa clave con ruta `Ingenieria/Fisica 2/Notas`.
  - ⬜ **M-4 (RN-12)** — Renombrar `~/Descargas/facultad-prueba` a `facultad-prueba-off` y escanear cualquier curso: el popup muestra el aviso de raíz inaccesible y no marca nada como pendiente ni sin asociar. Volver a poner el nombre. El índice no cambió (`diff` contra `../indice-facultad-prueba-pre-22.json` más las correcciones esperadas de M-1).
  - ⬜ **M-5 (tiempo)** — Reiniciar el servidor y escanear con varios cursos a la vez: ninguna llamada de estado supera los 15 s del popup y no aparece el mensaje de servidor sin respuesta.
- `videollamadas-omitidas-defecto`: Plan 25 (`~/Boveda/Proyectos/courseDownloader/Planes/25 - Videollamadas omitidas por defecto y popup al dia con el editor.md`).
  Specs: `docs/specs/editor-ignorar-y-raiz/spec.md`, `docs/specs/classroom-destino/spec.md`.
  Compuerta: 81 archivos / 1220 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js` (errores: 0).
  - ⬜ **M-1** — Dueño: re-escanear un curso con Meet, abrir el editor sin tocar nada: todas las videollamadas nacen en «omitir». «Volver a ofrecerlas» → guardar → `jq '.cursos[].videollamadasPermitidas' <índice>` las lista.
  - ⬜ **M-2** — Dueño: con el popup abierto, abrir el editor (🗂️), re-ofrecer una videollamada, guardar, volver al popup **sin re-escanear**: pasa de «omitido» a seleccionable en pocos segundos. Lo tildado a mano **antes** de abrir el editor puede perderse (esperado, ver Paso 3); lo tildado en el popup sin haber abierto el editor no se toca al cambiar de pestaña.
  - ⬜ **M-3** — Dueño: re-escanear después: las re-ofrecidas siguen ofrecidas; una videollamada nueva llega omitida.
- `editor-filtros-orden`: Plan 24 (`~/Boveda/Proyectos/courseDownloader/Planes/24 - Filtros y orden en el editor de adopcion.md`).
  Spec: `docs/specs/editor-filtros-orden/spec.md`.
  Compuerta: 80 archivos / 1203 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js`, `humo-editor-filtros-orden.js` (errores: 0).
  - ⬜ **M-1** — Dueño: en «Mostrar» elegí «📹 Videollamadas»: sólo se ven las videollamadas, los temas sin ninguna desaparecen y los otros quedan expandidos. «Limpiar filtros» lo deshace.
  - ⬜ **M-2** — Dueño: probá «Tipo» (pdf), luego combinalo con «A copiar» y con el chip «Revisar». Los seis contadores de arriba no se mueven.
  - ⬜ **M-3** — Dueño: ordená temas por «A→Z» y «Problemas primero»; ordená archivos por «Nombre original». Editá el nombre de una fila: **no** salta de lugar. Resolvé un tema sin destino con «Problemas primero» activo: baja de lugar (esperado, D-3).
  - ⬜ **M-4** — Dueño: en la barra lateral, «Más para revisar primero» sube el curso con más pendientes; al cambiar de curso el orden de la barra se mantiene y los filtros del curso se reinician. F5 lo reinicia todo.
  - ⬜ **M-5** — Tanda: tras usar todos los controles, «Cambios sin guardar» no aparece por eso; guardar y comprobar con `jq` que el índice es igual que sin tocar filtros.
- `editor-videollamadas-raiz`: Plan 23 (`~/Boveda/Proyectos/courseDownloader/Planes/23 - Omitir videollamadas en bloque y raiz decidida en el editor.md`).
  Spec: `docs/specs/editor-ignorar-y-raiz/spec.md`.
  Compuerta: 80 archivos / 1203 tests; humos: `humo-editor.js`, `humo-editor-indice.js`, `humo-editor-videollamadas-raiz.js` (errores: 0).
  - ⬜ **M-1** — Dueño: re-escanear **Fisica_II_G25_2026** (clave `google-classroom:Nzk0MDIyNDkyNDUx`). Abrir el editor (🗂️). Tiene que verse en la cabecera `Omitir N videollamadas` con N igual a los enlaces de Meet de ese curso, y cada fila de videollamada con la etiqueta `📹 Videollamada`.
  - ⬜ **M-2** — Dueño: tocar el botón. Las filas quedan tachadas/omitidas, el botón pasa a `Volver a ofrecerlas` con `N omitidas`, y aparece `Cambios sin guardar`. Guardar. **Tanda:** `jq '.cursos["google-classroom:Nzk0MDIyNDkyNDUx"].omitidos' ~/Descargas/facultad-prueba/.course-downloader.json` lista las N claves `google-classroom:acceso:https%3A%2F%2Fmeet...`.
  - ⬜ **M-3** — Dueño: `Volver a ofrecerlas` las deja destildadas→tildadas otra vez; **no guardar** (descartar con F5).
  - ⬜ **M-4** — Dueño, mismo curso: los temas **Novedades**, **Sin tema** y **Cronograma tentativo primer cuatrimestre 2026** (los tres guardados en `.` en el índice) se ven `✓ Asignado · Raíz de la materia` y **no** cuentan en «a revisar» de la lista de cursos ni en «Solo problemas». *(Antes del plan: los tres decían «Sin destino».)*
- `marca-resaltador`: identidad visual «Resaltador». Planes 26 (identidad), 27 (UI: resaltado de filas, botón Re-escanear, grilla, chips) y 28 (correcciones de la revisión: anchos de columna y falso descargando) aplicados; sin verificar en Chrome. Compuerta: 82 archivos / 1250 tests.
  - ⬜ **M-1 Íconos** — el de la barra de extensiones y el del header muestran la flecha sobre el trazo amarillo, **no** la «R». Mirar el de 16 px con la barra clara y con la oscura.
  - ⬜ **M-2 Wordmark claro** — «Course **Downloader**» en Bricolage Grotesque, el trazo amarillo detrás sólo de «Downloader», a media altura. Sin pedir nada a Google Fonts (pestaña Network del popup: ninguna petición a `fonts.googleapis.com`).
  - ⬜ **M-3 Wordmark oscuro** (poner el SO en tema oscuro) — letras en tiza con el borde que las hace legibles sobre el amarillo.
  - ⬜ **M-4 Contraste en claro** — el badge «En fila»/«Bajando», el chip `→ materia`, el badge de faceta y los textos de acento se leen en **ocre**, no en amarillo; **ningún texto amarillo** sobre fondo claro.
  - ⬜ **M-5 Botones** — «Descargar», «Iniciar descarga masiva», «Reintentar» y los de la advertencia: fondo amarillo con **texto tinta** legible. El botón de sincronizar disco es **tinta en claro / tiza en oscuro** (ya no azul ni cian).
  - ⬜ **M-6 Foco y checkboxes** — aro de foco y checkbox tildado en amarillo con el tilde en tinta.
  - ⬜ **M-7 Carpeta** — con un `HOME` falso sin `Downloads/RamonNet_Turbo`, arrancar el backend y confirmar que dice `Downloads/CourseDownloader`; con la carpeta vieja creada, que dice `RamonNet_Turbo`.
  - ⬜ **M-27.1 Filas resaltadas** — tildar una clase: fondo amarillo translúcido y borde izquierdo amarillo; en oscuro el mismo resaltado, más suave. La clase que se está bajando (pestaña «Fila de descarga») va resaltada igual.
  - ⬜ **M-27.2 Columnas** — con una lista de varias materias y estados mezclados, el chip de materia y el de estado caen **en la misma columna en todas las filas**, sin importar el largo del título.
  - ⬜ **M-27.3 Videollamada** — una clase de videollamada muestra **📹 en la columna del ícono** (no la pastilla); pasar el mouse muestra «enlace de videollamada sincrónica, posiblemente inactivo».
  - ⬜ **M-27.4 Omitido** — una clase omitida muestra **«Omitido» en la columna del estado** (donde diría «Pendiente»), con la materia en su columna, y su checkbox deshabilitado.
  - ⬜ **M-27.5 Movido** — un archivo movido en disco (ver M-1 del plan 22) muestra `↪` al final del título, con el aviso al pasar el mouse.
  - ⬜ **M-27.6 Re-escanear** — en «Disponibles» aparece **«🔄 Re-escanear»** a la izquierda de «Agregar N clases a la fila 📥», los dos en **una sola línea**; la barra de filtros ya no tiene el 🔄. Con modo «Re-escanear» como botón principal, **no** hay un segundo botón igual.
  - ⬜ **M-27.7 Pestaña cola** — en «Fila de descarga» no aparece «Re-escanear». `Remover ❌` y `Bajando` caben en su columna.
  - ⬜ **M-27.8 Footer vacío** — provocar el banner de conexión caída (apagar el servidor): sin acción que ofrecer, el footer **desaparece** (no queda una línea sola ni un «Re-escanear» suelto).
  - ⬜ **M-27.9 Bloqueo** — con el banner de conexión, «Re-escanear» no se puede tabular ni activar (`disabled`).
  - ⬜ **M-28.1 Falso descargando** — con la fila armada (17 clases) y **ninguna descarga corriendo**, abrir el popup: el pie **no** muestra «Frenar al terminar / Detener descargas»; no hay barra de progreso ni línea divisoria; en «Fila de descarga» se ve el botón para **iniciar** la cola. (Cierra el reporte original.)
  - ⬜ **M-28.2 Descarga real** — iniciar la cola: aparecen «Bajando» en la fila activa, la barra y los dos botones de cancelar. Cerrar y reabrir el popup **a mitad de descarga**: sigue mostrando todo eso.
  - ⬜ **M-28.3 Separación** — en las dos pestañas, entre el chip de materia y la columna de estado (y el botón `Remover ❌`) hay **aire**; el chip ya no toca al vecino.
  - ⬜ **M-28.4 Remover** — en «Fila de descarga» `Remover ❌` queda en **una línea**; «EN FILA», «DESCARGADO», «OMITIDO» y «BAJANDO» están centrados y del mismo ancho en todas las filas.
  - ⬜ **M-28.5 Título** — el título de las filas se corta más o menos donde se cortaba antes (~103 px); la materia muestra más texto que antes («Ingeniería/Física…» en vez de «Ingeniería/Fi…»).


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
