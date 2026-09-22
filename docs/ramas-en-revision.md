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

## 🚧 En revisión: `classroom-corte-1` (desde el 2026-09-12)

- **Qué trae**: el tercer portal, Google Classroom. Escanea un curso entero y baja sus archivos
  de Drive a `raíz/google-classroom/<curso>/`; los videos, YouTube y los vínculos quedan como
  `.md` con el link.
  - Plan: `docs/plan-classroom-corte-1.md`.
  - Diseño y mediciones: `docs/portal-google-classroom-diseno.md`.
- **Estado**: código completo (Pasos 1 a 8). Verificación A en verde **desde el 2026-09-12 a la
  noche**: el informe de ejecución la daba en verde con 33 tests en rojo, preexistentes en `main`.
  **Verificación B frenada** en el paso 2: el escaneo termina y guarda, pero la lista no se ve.
  - Arreglado ya (correcciones puntuales, sin plan):
    - `sitio/anatomy-by-chris/scraper.test.js`: Node >= 25 tapaba el `localStorage` de jsdom.
    - `sitio/google-classroom/scraper.js:19`: método abreviado → `async function`. `executeScript`
      no lo podía inyectar (`SyntaxError`); los tests no lo ven.
  - **Hecho** (`docs/plan-classroom-corte-1-verificacion-b.md`):
    - Paso 1: sonda de Classroom a `/favicon.ico` (`sitio/google-classroom/config.ts`).
    - Paso 2: notificación de fallo abre `urlListado` (`background.js:539`, `core/puertos/sitio.ts`).
    - Paso 3: test de serialización de escaneos inyectados (`sitio/inyeccion.test.js`, +4 tests).
    - Paso 4: docs actualizados; Verificación A en verde con 42 archivos, 706 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-lista-guardada-y-explorar.md`):
    - Paso 1: decisión pura al abrir (`core/estado/origenListado.ts`, +7 tests).
    - Paso 2: puerto y descriptor con `claveDeListado` (`core/puertos/sitio.ts`, `sitio/google-classroom/config.ts`, +1 test en `sitio/registro.test.ts`).
    - Paso 3: `AppState.origenListado` persistido y reseteado en sesión (`core/estado/appState.ts`, +1 test en `appState.test.ts`).
    - Paso 4: compuerta `escanearOUsarGuardada()` en 4 disparadores automáticos y guardado de origen en `popup.js`.
    - Paso 5: botón 🔄 en la toolbar de Disponibles (`entrypoints/popup/index.html`, `popup.js`, `popup/features/filters.js`).
    - Paso 6: selector nativo de carpetas en Linux vía `xdg-desktop-portal` (`backend/elegirCarpetaLinux.py`, `backend/handlers.js`).
    - Paso 7: docs actualizados; Verificación A en verde con 43 archivos, 715 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-abrir-todos.md`):
    - Paso 1: el paso 7 de `sitio/google-classroom/scraper.js` abre todos los ítems plegados en el mismo tick y espera una sola vez (`abrirTodos`).
    - Paso 2: test 11 en `sitio/google-classroom/scraper.test.js` con apertura paralela y contraste con código secuencial anterior (+1 test).
    - Paso 3: docs actualizados; Verificación A en verde con 43 archivos, 716 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`):
    - Paso 1: el escaneo espera adjuntos resueltos (`open?id=` vs `/file/d/`) en Trabajo en clase y Novedades, descarta los no resueltos y expone el conteo (`sitio/google-classroom/scraper.js`).
    - Paso 2: `ResultadoEscaneo.adjuntosSinResolver?` declarado en el puerto (`core/puertos/sitio.ts`).
    - Paso 3: `popup.js` captura `adjuntosSinResolverUltimoEscaneo` y alimenta `ctx.nota` en el view-model.
    - Paso 4: `listaClases.preact.js` renderiza `p.lista-nota` arriba de las filas dentro de `modo:'lista'`.
    - Paso 5: regla `.lista-nota` en `styles/list.css` con variables de acento naranja.
    - Paso 6: tests nuevos (+2 en `scraper.test.js`, +1 en `listaClases.preact.test.js`).
    - Paso 7: docs actualizados; Verificación A en verde con 43 archivos, 719 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-identidad-del-curso.md`):
    - Paso 1: `sitio/google-classroom/scraper.js` resuelve identidad por sidebar (`aria-label`) validado por idCurso en activos y por `<title>` confirmado por el DOM en archivados; cinturones de URL e ítems contra cambio de curso a mitad de escaneo.
    - Paso 2: fixture `sitio/google-classroom/__fixtures__/curso.html` incorpora el ancla del sidebar del curso activo.
    - Paso 3: tests 14–17 en `sitio/google-classroom/scraper.test.js` (+4 tests; control negativo del test 14 verificado contra `29d7919`).
    - Paso 4: docs actualizados; Verificación A en verde con 43 archivos, 723 tests.
  - **Hecho** (`docs/plan-classroom-corte-1-identidad-en-archivados.md`):
    - Paso 1: `sitio/google-classroom/scraper.js` confirma identidad en archivados con el ancla al curso dentro del `<h1>` (v1.3.1), descartando el filtro por links de vista que eliminaba al propio encabezado.
    - Paso 2: fixture `sitio/google-classroom/__fixtures__/curso.html` refleja el DOM real con encabezado en `<h1>`.
    - Paso 3: test 15 prueba el mecanismo real y test 18 (+1 test) verifica que un ancla fuera del `<h1>` no confirma el title en `sitio/google-classroom/scraper.test.js`.
    - Paso 4: docs actualizados; Verificación A en verde con 43 archivos, 724 tests.
- **Lo que no trae**: el mapeo a la carpeta del dueño (`U.N.L.P/`). Es el corte 2.

### Checklist de Verificación B (en navegador)

**Antes de empezar:**
- Levantar el backend: `cd backend && bun run server.js`
  - Si ya había uno corriendo, **reiniciarlo**: Bun no recarga `backend/`, y uno arrancado antes de `4623593` sigue lanzando `powershell` en Linux (Explorar no abre nada).
- `pnpm run build` y recargar la extensión desde `.output/chrome-mv3/`
- Usar la cuenta del curso de Google (`/u/2/`)
- Dejar la pestaña al frente durante cada escaneo

1. [ ] **Arranque**: el service worker arranca sin excepciones y el popup renderiza completo (`docs/rearquitectura-diseno.md` §Verificación en navegador, puntos 5 y 6).
   - **Si el primer escaneo de G22 tarda ~30 s, no es un cuelgue**: el paso 7 nuevo (`abrirTodos`, `38ddd5b`) espera también los `li` sin botón, que el paso 7 viejo salteaba. Anotá el tiempo igual: el plan de abrir-todos pide cronometrarlo.
2. [ ] **Escaneo curso por curso** (contrastar enlaces con los esperados del §8 del diseño):
   - [ ] Física II G22 (Palacio): 57 enlaces esperados
   - [ ] Física I 2024: 130 enlaces (129 Trabajo en clase + 1 sólo en Novedades)
   - [ ] Fisica_II_G25_2026 (Bianchi, archivado): 71 Trabajo en clase + hasta 28 en Novedades (si aparece la tarjeta «No pudimos confirmar de qué curso es esta lista», es el defecto del 2026-09-22 y el arreglo no está en el build)
   - [ ] MB5 2024: 24 enlaces (si aparece la tarjeta «No pudimos confirmar de qué curso es esta lista», es el defecto del 2026-09-22 y el arreglo no está en el build)
   - [ ] MC4 1S 2026: 13 enlaces
   - [ ] MC2 2025: 25 enlaces
   - [ ] MC6 y Q5: tarjeta "El escaneo no trajo clases" en segundos, sin esperar tope de 20 s
3. [ ] **Nombres repetidos**: en Física I, los 5 `informe de laboratorio fisica i 2024 (template)` aparecen con su material agregado; en Bianchi, los dos `interferencia2025` también.
4. [ ] **Pestaña oculta**: a mitad del escaneo de Física I, cambiar de pestaña. Aparece la tarjeta con aviso de visibilidad y la lista anterior se conserva en pantalla.
5. [ ] **Descarga** de 6 ítems y posterior re-sincronización de disco:
   - [ ] Un PDF en `raíz/google-classroom/<curso>/` con su nombre
   - [ ] Un video de Drive, uno de YouTube y un vínculo como `.md` funcionales
   - [ ] Imagen `27 abr 2026 a la(s) 5:36 p.m..jpg` de Bianchi
   - [ ] `MC4 2026  - Copia de P2F2.pdf` (conservando doble espacio)
   - [ ] Los 6 quedan marcados como descargados tras re-sincronizar
6. [ ] **Anatomy sigue igual**: bajar un PDF (funciona sin cookies) y comprobar que lo ya descargado sigue marcado como descargado.
7. [ ] **Aviso de fallo**: la notificación de un ítem de Classroom que falla enfoca la pestaña de Classroom, o si no hay ninguna abre `urlListado` (`background.js:539`, tras el plan de la verificación B).
8. [ ] **Primera apertura en Física II G22**: escanea (sin origen previo) y trae 57. Cerrar y reabrir el popup en la misma pestaña: la lista aparece al instante sin "Escaneando la pestaña…", y la pestaña de Classroom no se mueve a Novedades.
9. [ ] **Otro curso** (MC4 1S 2026): abrir el popup ahí escanea solo y trae 13. Volver a G22 y abrir: escanea de nuevo (se guarda una sola lista).
10. [ ] **🔄**: visible en "Clases Disponibles" y oculto en "Fila de descarga"; en G22 con lista guardada fuerza el escaneo. Con backend caído queda deshabilitado. En Anatomy, abrir el popup sigue escaneando como antes.
11. [ ] **Explorar en Linux**: 📂 → diálogo nativo "Elegí la carpeta raíz de descargas". Cancelar conserva la ruta; elegir cambia la ruta y la consola del server loguea `📂 [DISCO] Nueva carpeta raiz establecida`. (Restaurar la ruta real al terminar).
12. [ ] **Adjuntos hidratados** (plan de adjuntos sin resolver, 2026-09-21): G22 con la pestaña al frente, Re-escanear 🔄 → 57 adjuntos y **ningún** archivo cuyo nombre empiece con `Archivo adjunto`; la nota `⚠️ … quedó afuera` **no** aparece arriba de la lista.
13. [ ] **Consola de la pestaña de Classroom** (no la del popup): con todo bien no hay ninguna línea `[CLASSROOM] Adjuntos sin resolver`. Si aparece, anotar los ids: son los que se descartaron.
14. [ ] **G25** (el curso con Novedades larga): la cuenta no bajó respecto de la Verificación B del 2026-09-16 (71 Trabajo en clase + hasta 28 en Novedades).
15. [ ] **Cambio de curso a mitad de escaneo**: arrancar el escaneo en un curso y navegar a otro antes de que termine. Esperado: card de aviso de cambio de curso y no se lista nada del curso anterior.

### Hallazgos de la Verificación B (2026-09-16 y 2026-09-21)

Entran al corte 1 **antes del merge** (decisión del dueño). El 🔴 de los adjuntos a medio hidratar quedó resuelto (`docs/plan-classroom-corte-1-adjuntos-sin-resolver.md`, en la lista de Hecho arriba), el 🔴 de identidad del curso quedó resuelto (`docs/plan-classroom-corte-1-identidad-del-curso.md`, en la lista de Hecho arriba), el 🔴 de identidad en **cursos archivados** quedó resuelto (`docs/plan-classroom-corte-1-identidad-en-archivados.md`, en la lista de Hecho arriba) y el 🟡 no entra a ninguno hasta que M-6c lo reproduzca.

- 🔴 **El listado se etiqueta con el curso equivocado y los archivos van a la carpeta de otro curso.**
  CONFIRMADO en disco el 2026-09-21. RESUELTO con `docs/plan-classroom-corte-1-identidad-del-curso.md`. `sitio/google-classroom/scraper.js:80-87` leía el nombre del curso de
  `document.title` una vez al arrancar y `:571` lo estampaba en el `modulo` de todos los ítems; en una SPA el
  título se sincroniza **después** de la URL y del contenido, y `popup.js:789` dispara el escaneo en
  `tabs.onUpdated` con `status === 'complete'`, que llega antes.
  - **Evidencia**: `~/Descargas/verificacion-b/google-classroom/2026_2c_mc6_mate_c/` (carpeta de MC6) tenía
    **81 archivos md5-idénticos** a 81 de los 82 de la carpeta de G22, y 0 propios. En el storage esos ítems
    quedaron con `modulo = "2026 - 2C - MC6 :: Mate C › <tema de G22>"`, mientras `origenListado.clave` era
    `ODc0ODk1NDcwNTMw`, el **idCurso de G22** (46 hrefs `/c/ODc0…/m/` en su muestra). O sea: URL, DOM y
    adjuntos de G22; sólo el título decía MC6. La carpeta se borró tras confirmar los 81 duplicados.
  - **La cola no tiene la culpa**: `ItemCola.carpeta` viaja con el ítem (`core/cola/procesadorCola.ts:172`,
    `:808`) y el destino se calcula al escanear (`popup.js:1466` → `parserTitulos.js:17-24`). Los 18 ítems
    que ya estaban bajando cuando el dueño cambió de curso fueron a la carpeta correcta.
  - **No lo introdujo** el plan de adjuntos sin resolver: el título se lee así desde `v1.0.0` del scraper.
    Lo que sí hizo ese plan es agrandar la ventana del escaneo (hasta ~50 s), que es el otro camino al
    mismo defecto (cambiar de curso a mitad de escaneo).
  - **Decisiones del dueño (2026-09-21)**: el nombre sale del sidebar validado por idCurso, el title sólo
    si el DOM lo confirma; si no se puede confirmar, esperar y reintentar y después **abortar con aviso**
    sin listar nada.
  - **Plan ejecutado**: `docs/plan-classroom-corte-1-identidad-del-curso.md` (2026-09-21), con
    las cuatro fuentes medidas y la validación contra las 62 muestras (37 validan, **0 contradicen**, 15 sin
    fuente y son justo las de title genérico). Verificación A en verde con 43 archivos, 723 tests.

- 🔴 **Los dos cursos archivados (G25 y MB5) no se pueden escanear: la identidad del curso nunca se
  confirma.** RESUELTO con `docs/plan-classroom-corte-1-identidad-en-archivados.md`. Rompía el escaneo
  en G25 y MB5 devolviendo tarjeta de aviso sin listar nada. Detectado el 2026-09-22 por barrido de las
  62 muestras simulando `resolverIdentidadCurso` (7/7 archivados abortaban porque `buscarLinkNav`
  descartaba el encabezado del curso) antes de tocar el navegador. Arreglado confirmando el title
  exclusivamente contra el ancla al curso dentro del `<h1>` (40/41 presencia, 40/40 valida, 0 contradice).
  - **Qué se ve**: en G25 y MB5 el escaneo espera 8 s (`tiempos.identidadCurso`) y devuelve la tarjeta
    "No pudimos confirmar de qué curso es esta lista, así que no se muestra nada". No lista nada. Son
    2 de los 8 cursos, y los únicos cuyos totales de la checklist siguen firmes (G25 = 71, MB5 = 24),
    así que el **paso 2 de la Verificación B** habría fallado en ellos.
  - **Causa**: `sitio/google-classroom/scraper.js:153-163` descarta el candidato del `<title>` si su
    texto coincide con el del ancla que devuelve `buscarLinkNav(regexNovedadesVista)`, y `buscarLinkNav`
    (`:113`) devuelve **la primera** `nav a[href]` que coincide — que en el DOM real **no** es la
    pestaña "Novedades" sino el **encabezado del curso** (el `<a>` dentro del `<h1>`), cuyo texto es el
    nombre del curso. El filtro eliminaba justo a la única fuente que podía confirmar.
  - **Evidencia** (barrido propio de las 62 muestras, simulando `resolverIdentidadCurso` con un
    `HTMLParser` con pila de ancestros): **7/7** muestras de curso archivado abortan (G25 ×5, MB5 ×2);
    en `recorrido-3/07-Fisica_II_G25_2026-trabajo.html` las anclas a `/u/2/c/Nzk0MDIyNDkyNDUx` son, en
    orden, la del `<h1>` con texto `Fisica_II_G25_2026`, la pestaña `Novedades` y la de Trabajo en clase.
  - **Los activos no se ven afectados**: resuelven por la rama (a), el sidebar (31/41 muestras lo
    tienen, con **0** `aria-label` que no sea el nombre del curso), y nunca llegan a la rama (b).
  - **Arreglo con evidencia**: el confirmante pasa a ser el ancla del curso dentro del `<h1>` — existe
    en 40 de las 41 muestras de curso, es **única** en todas, confirma el title en **40/40** y
    contradice en **0**; y excluye a las dos pestañas de vista sin mirarles el texto, que era todo lo
    que el filtro viejo buscaba. Medido: con el fixture fiel y **sin** el arreglo fallan exactamente
    los tests 15 y 18 (`Tests 2 failed | 16 passed (18)`); con el arreglo, `18 passed (18)`.

- 🟡 **Novedades: los adjuntos faltan en el disco, pero el escaneo NO falla. NO REPRODUCIDO — tercer
  diagnóstico, y los dos anteriores eran falsos.** No entra al plan hasta reproducirlo (M-6c).
  - **Lo que se creyó y es falso**: (1) "no pagina ni expande" — en Novedades no hay botón "Ver más
    publicaciones", la carga es por scroll; (2) "el stream no crece porque `buscarContenedorScroll()`
    elige mal el scroller" — M-6 lo niega.
  - **M-6 (2026-09-17, consola de Brave, G25 → Novedades)**: `buscarContenedorScroll()` (`scraper.js:102`)
    devuelve el `<html>`, que es exactamente `document.scrollingElement` y el **único** elemento que
    dispara `scroll`. Replicando el bucle de `esperarQuietud` tal cual (40 vueltas, 1500 ms, corte a 3
    estables): **40 → 237 posts en 6 vueltas, corta en la 9**, y con el scroller "real" da lo mismo.
    Reproduce clavada la sonda del 2026-09-12, cuyo registro es `76→237 en 6 vueltas` y cuyo HTML
    guardado tiene **237 `data-stream-item-id` y 28 `data-attachment-id`** — los mismos números.
  - **M-6b**: los 14 contenedores candidatos a "vista activa" (`[role="main"]`, `c-wiz`, `[jsname]`)
    ven **todos** el mismo stream que `document`. No hay vista vacía que corte el bucle antes.
  - **Los 26 adjuntos faltantes SÍ estaban en el DOM**: `Resumen_guia4.pdf` tiene
    `data-attachment-id="37014713914"` y su `<a aria-label="Archivo adjunto: PDF: …">`, que es
    literalmente lo que busca el selector de `scraper.js:387`.
  - **Tampoco se pierden en los filtros**: parseando el HTML de la sonda, los 28 adjuntos cuelgan de un
    `[data-stream-item-id]` externo (66 externos / 171 anidados), así que `itemsExternos` (línea 379) no
    descarta ninguno; y cruzando ids de Drive, Novedades y Trabajo en clase de G25 tienen **0 en común**,
    así que el dedup de la línea 418 tampoco.
  - **Evidencia del síntoma** (sigue siendo real): `Fisica_II_G25_2026` — 23 archivos del tema "Próximas"
    no están en el disco de la Verificación B: `Resumen_guia4/5/7/12.pdf`, `1parcial_2..6.jpg`,
    `Guia11_P4b/c/d.jpeg`, `Guia12_P4a/b.jpeg`, `Guia12_P9a/b/c.jpeg`, `P8a_guia5.jpeg`, `P9_guia4.pdf`,
    `P11_guia4.pdf`, `resultados-repaso-conceptual.pdf`, `Guia7_P6b/c.jpeg`. Son exactamente los 26 ids
    que sólo viven en Novedades, menos los 3 que sí bajaron.
  - **Ojo con la afirmación vieja "no llegan ni al storage"**: se escribió sin pegar la salida del storage.
    El storage actual (2026-09-17) no tiene esos nombres, pero corresponde a otro escaneo, así que **no
    prueba nada**. Tratarla como no verificada.
  - **M-6c — qué falta, y es lo único que decide**: re-escanear G25 con el build actual, con la pestaña al
    frente, y mirar el storage **inmediatamente después**. Si los 26 aparecen, el escaneo está bien y el
    defecto está aguas abajo (cola o descarga) o fue puntual de aquella corrida; si no aparecen, recién
    ahí hay un defecto de escaneo que perseguir, y habrá que instrumentar el paso 9 con logs.

- ⚠️ **`MC4 1S 2026` desapareció de la portada del dueño** entre el 2026-09-12 y el 2026-09-16, así que no
  se bajó (esperaba 13). **No es un defecto de la extensión**: en `recorrido-3/00-partida.json` (2026-09-12)
  figura como curso activo, y en `00-archivadas.json` de ese día sólo estaban G25 y MB5. Candidato principal:
  el docente lo archivó al cerrar el 1er semestre → estaría en `/u/2/h/archived`. Si no está ahí, es baja o
  eliminación del curso.
  - **Toca el punto 9 de la checklist**, que usa MC4 como "otro curso" para probar que la lista guardada se
    invalida al cambiar de curso: si quedó archivado sirve igual, si no, reemplazarlo por MC2 o MB5.
  - **Toca la spec del corte 2**: no hay supuesto sobre qué hacer cuando un curso ya asociado deja de aparecer.
    El material bajado no debe tratarse como huérfano — es cuando la copia local pasa a ser la única.

- ⚪ **Los números esperados de la checklist vencieron para los cursos activos.** G22 ya no trae 57 sino ~63:
  entre el 2026-09-12 y el 2026-09-16 la cátedra publicó Clase 7, Clase 8 (×2), `Pract.6-Prob.P9`,
  `CC-Modelización de pilas y baterias` y el cronograma de la semana 14-9. Verificado contra `recorrido-3`.
  Los únicos totales que siguen firmes son los de los cursos **archivados**: G25 (71) y MB5 (24).

- ⚪ **D12 hace lo que dice, y por eso deja copias idénticas** (hallazgo para el corte 2, no defecto del 1).
  De 263 binarios hay 258 contenidos únicos: `Informe de laboratorio FISICA I 2024 (Template).docx` está
  **5 veces con md5 idéntico** (`cb5dc8da…`, el docente lo adjuntó en 5 ítems) e `interferencia2025.pdf`
  **2 veces** (`2653281d…`). El supuesto 20 de `docs/specs/classroom-destino/assumptions.md` cubre el choque
  entre dos cursos, pero no éste: mismo curso, mismo archivo, distinto material. Decidir en la spec si el
  desempate de D12 debe mirar el contenido antes de copiar.

- ✅ **Integridad de lo descargado** (verificada en disco, no por reporte): 53 PDF que son PDF de verdad,
  1 pptx real, 0 de tamaño nulo, ningún HTML de error disfrazado; el saneo `Nº`→`N_`, `#`→`_`, `,`→`_`
  se aplicó bien y los `.md` de acceso llevan el link correcto.

## Lo último que se mergeó (2026-08-27)

La tanda `tanda-host-ramonnet-y-conexion` se verificó en Chrome y se mergeó.

Dónde quedó lo que traía, por si venís buscándolo:

- **La migración de host** (`plataforma.ramonnet.com.ar` → `ramonnet.com.ar`, dado de baja el
  primero) → el changelog de `sitio/ramonnet/config.ts` (v2.2.0) y `host_permissions` en
  `wxt.config.ts`. Verificado con clases reales escaneadas sobre el host nuevo.
- **El copy de conexión caída** ("Sin conexión a internet" → "No se pudo contactar el sitio",
  porque el daemon sondea el host del portal, no internet en general) → el changelog de
  `bannerConexion.preact.js` (v1.2.0), replicado en `conexionHeader.preact.js` y
  `notificaciones.ts`. Verificado en Chrome.
- **El badge de cátedra que se salía del popup** → el comentario sobre `min-width: 0` en
  `.input-path`, `styles/components/path-bar.css`. Verificado en Chrome.

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
