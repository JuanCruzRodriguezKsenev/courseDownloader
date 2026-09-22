# Plan — Classroom corte 1: el listado se etiqueta con el curso equivocado

Rama: `classroom-corte-1`. Defecto 🔴 **nuevo**, encontrado el 2026-09-21 al revisar el disco de la
Verificación B. Entra al corte 1 **antes del merge**: manda archivos a la carpeta de otro curso.

No hay spec: es un defecto. La spec de `docs/specs/classroom-destino/` es del corte 2 y no se toca.

---

## 0. Lo medido que este plan da por hecho

### 0.1 El síntoma, en disco y en el storage

`~/Descargas/verificacion-b/google-classroom/2026_2c_mc6_mate_c/` tenía **81 archivos**, y los 81
eran **md5-idénticos** a 81 de los 82 de
`fisica_ii_g22_2026_2do_cuatrimestre_facultad_de_ingenieria_unlp/` (0 archivos propios). Ninguna de
las otras 4 carpetas está contaminada (cruce de md5 de las 6 carpetas: el único par con duplicados
era MC6↔G22). La carpeta se borró el 2026-09-21 tras confirmar los 81 duplicados; quedan 336
archivos en 5 carpetas.

En `chrome.storage.local` esos ítems quedaron con:

```
modulo = "2026 - 2C - MC6 :: Mate C › Guía de TP Nº 1 - Ejercicio…"   (y › Laboratorios,
         › Clases Teóricas Módulo I, › Cronogramas y planificación, › Bibliografía de la Cátedra)
```

que son los **temas de G22**, con los **archivos de G22** (`G22-cronograma…`, `Palacio - Clase N…`,
`F2-G22-Año 2026…`). Y `origenListado.clave = "ODc0ODk1NDcwNTMw"`, que es el **idCurso de G22**:
ese id aparece 46 veces como `href=".../c/ODc0ODk1NDcwNTMw/m/<idItem>"` en la muestra de G22
(`docs/muestras/google-classroom/recorrido-1/01-…-trabajo.html`).

**Conclusión**: la URL era de G22, el DOM era de G22 y los adjuntos eran de G22. Lo único que
apuntaba a MC6 era **`document.title`**.

### 0.2 La causa, en el código

- `sitio/google-classroom/scraper.js:67` ya saca el `idCurso` **de la URL**, con la misma regex que
  `claveDeListado` (`config.ts:58-62`): `/\/(?:c|w)\/([^/]+)/`. Sólo lo usa para decidir si hay
  curso abierto.
- `:80-87` saca el nombre **del `document.title`**, una vez, al arrancar, sin relación con ese id.
- `:571` lo estampa en **todos** los ítems: ``modulo: `${nombreCurso} › ${item.tema}` ``.
- `popup.js:789` dispara el escaneo en `chrome.tabs.onUpdated` con `changeInfo.status === 'complete'`.
  En una SPA como Classroom eso llega **antes** de que el `<title>` se sincronice con la URL.

Entre `:80` y `:571` hoy pueden pasar ~50 s (paso 7 `abrirTodos` 30 s + 7b `hidratacion` 10 s +
Novedades 10 s), así que la ventana para navegar a otro curso a mitad del escaneo también es real.

**La cola no tiene nada que ver, y por eso los otros 18 archivos salieron bien.** `ItemCola.carpeta`
viaja con el ítem (`core/cola/procesadorCola.ts:172`, y `:808` la usa como `subcarpetaFinal`), y el
comentario de `:182-185` ya dice que el `modulo` es identidad y la `carpeta` es destino. El destino
se calcula **al escanear** (`popup.js:1466` → `parserTitulos.js:17-24`, que toma lo que está antes
de `" › "`). La cola cargó fielmente un destino mal calculado: los 18 ítems que ya estaban bajando
cuando el dueño cambió de curso fueron a la carpeta correcta (mtimes 23:10 en la carpeta de G22).

### 0.3 Las cuatro fuentes posibles del nombre, medidas en las 62 muestras

| Fuente | Exactitud | Cobertura |
|---|---|---|
| `document.title` | **se desfasa** (es el defecto) y a veces es genérico: `"Trabajo en clase"` / `"Novedades"` en 15 muestras | siempre presente |
| `a[aria-current="page"][href*="/c/<id>"]` → `aria-label` | **exacta**: en 12/12 muestras con ancla, idéntica carácter por carácter al nombre que hoy sale del title | falta en los 2 cursos **archivados** (G25, MB5) y con la pestaña oculta (3/18 en `recorrido-2`) |
| texto de un `a[href$="/c/<id>"]` (header) | el nombre viene **partido en varios nodos**, así que `textContent` lo devuelve **sin espacios** (`"Física II G22 2026 2do cuatrimestreFacultad…"`) | presente también en archivados |
| `span#UGb2Qe` | **abreviado** (`"Q5"` en vez de `"Q5 Primer Cuatrimestre 2023"`) | falta en 19 muestras |

### 0.4 Las dos mediciones que hacen ejecutable el arreglo

**(1) Cambiar la fuente no renombra ninguna carpeta ya bajada.** En las 12 muestras que tienen ancla
de sidebar, `aria-label` == el nombre derivado del title, **exacto**. Eso importa porque el `modulo`
es media identidad del ítem (`core/cola/identidadClase.ts`): si el nombre cambiara aunque sea un
espacio, los 336 archivos ya bajados se re-bajarían.

**(2) El title se puede validar contra el DOM, y el resultado es limpio.** Comparando el
title-derivado con el texto de las anclas a `/c/<idCurso>` **normalizado** (NFKD, sin espacios,
minúsculas), sobre las 45 muestras de curso:

| | |
|---|---|
| validan | **37** |
| **contradicen** | **0** |
| sin ninguna fuente para validar | 15 — y son **exactamente** las de title genérico (`"Trabajo en clase"`, `"Novedades"`), o sea los casos en los que no hay que confiar en el title |

**Trampa que este plan evita**: las 37 anclas validadoras están **todas dentro de un `<nav>`**
(0 fuera), así que **no** se puede filtrar por `closest("nav")` — eso mataría la validación. El
riesgo que quedaba —un title genérico `"Novedades"` validado por el link de vista "Novedades", que
también apunta a `/c/<id>`— se ataja rechazando los candidatos cuyo texto coincida con el de los dos
links de vista, que el scraper ya sabe localizar por href con `buscarLinkNav` (`scraper.js:97-106`).

### 0.5 Decisiones del dueño (2026-09-21)

- El nombre sale del **sidebar validado por id**; el title es último recurso y **sólo** si el DOM lo
  confirma.
- Si no se puede confirmar a qué curso pertenece lo leído: **esperar y reintentar**, y al vencer el
  tope **abortar con aviso**, sin listar nada.
- La carpeta contaminada se borró (ya hecho).

### 0.6 Restricción que condiciona todo el paso 1

`escanearListado` se inyecta **serializada** (`popup.js`, `executeScript({ func: portal.escanearListado })`,
sin `args`). Todo lo nuevo va **adentro** de la función: sin constantes de módulo ni closures. Lo
vigila `sitio/inyeccion.test.js`.

---

## 1. Radio de impacto

| Qué cambia | Quién más lo construye o lo lee |
|---|---|
| De dónde sale `nombreCurso` en `escanearListado` | Sólo se usa en `:571` para armar `modulo`. El `modulo` lo consume `popup.js:1466` (`materiaBase`), que lo pasa a `parserTitulos.clasificarCarpeta` (**sin cambios**: sigue tomando lo de antes de `" › "`), y es **media identidad** del ítem en `core/cola/identidadClase.ts`. Por eso vale la medición 0.4(1): el nombre resultante tiene que ser **idéntico** al de hoy en los cursos activos, o se re-baja todo. |
| El escaneo puede terminar en aviso por identidad no confirmada | `ResultadoEscaneo.aviso` ya existe (`core/puertos/sitio.ts:127`) y `popup.js:1381-1396` lo pinta como card `motivo:'portal'` **conservando la lista anterior**. Es el canal correcto acá: no hay listado válido que mostrar. **No** se usa `adjuntosSinResolver`/`ctx.nota`, que es para "la lista sirve pero algo quedó afuera". |
| `tiempos` gana `identidadCurso` | `TIEMPOS_TEST` (`sitio/google-classroom/scraper.test.js:11-19`) lo tiene que ganar también, o la espera nueva corre con el default dentro de los 13 tests. |
| El fixture `sitio/google-classroom/__fixtures__/curso.html` | **Lo comparten los 13 tests**. Hoy tiene `<title>Trabajo en clase de Física II - Classroom</title>` y un `nav` con `<a href="/u/2/c/CURSO123">Novedades</a>` — o sea, con la regla nueva el fixture **no valida** y todos los tests darían aviso. Hay que agregarle el ancla de sidebar del curso activo, y el nombre esperado sigue siendo `"Física II"` para que los 13 tests no cambien sus expectativas. |
| `popup.js:789` (`tabs.onUpdated`) | **No se toca.** El disparador prematuro es el detonante, pero la defensa va en el scraper: cualquier otro disparador (los 4 de `escanearOUsarGuardada`, el 🔄) tiene el mismo problema y una sola defensa los cubre a todos. |
| `docs/portal-google-classroom-diseno.md` §8 | Hogar canónico de las mediciones del portal: entra la tabla 0.3 y los números de 0.4. |

**Lo que este plan NO puede hacer**: derivar el nombre de `span#UGb2Qe` (abreviado) ni del
`textContent` del header (sin espacios) — medido en 0.3. Y no puede filtrar candidatos por `nav`
(medido en 0.4).

---

## 2. Paso a paso

### Paso 1 — El escaneo resuelve la identidad del curso y la valida

`sitio/google-classroom/scraper.js`, todo **dentro** de `escanearListado`.

**1.a** En la tabla `tiempos` (`:31-42`, donde hoy termina en `hidratacion: 10000`), agregar `identidadCurso: 8000`.

**1.b** Borrar el bloque `:80-87` (el `let nombreCurso = document.title …`) y poner, en su lugar,
sólo la derivación del título como **función**, sin usarla todavía:

```js
    // El título de la SPA se sincroniza DESPUÉS de la URL y del contenido: por eso no se puede
    // usar como fuente del nombre (defecto del 2026-09-21: 81 archivos de G22 en la carpeta de
    // MC6). Se conserva sólo como candidato A VALIDAR contra el DOM.
    function nombreSegunTitulo() {
      let t = document.title || "";
      if (t.startsWith("Trabajo en clase de ")) t = t.slice("Trabajo en clase de ".length);
      if (t.startsWith("Novedades de ")) t = t.slice("Novedades de ".length);
      if (t.endsWith(" - Classroom")) t = t.slice(0, -" - Classroom".length);
      return t.trim();
    }
```

Ojo: hoy el código sólo recorta `"Trabajo en clase de "`. El prefijo `"Novedades de "` se suma
porque el escaneo también pasa por esa vista y el title cambia con ella (medido en las muestras
`*-novedades.html`).

**1.c** Junto a las otras auxiliares, tres funciones nuevas:

```js
    function normalizarNombre(s) {
      return (s || "").normalize("NFKD").replace(/\s+/g, "").toLowerCase();
    }

    function hrefDelCurso(a) {
      const href = (a.getAttribute("href") || "").split(/[?#]/)[0];
      return href.endsWith("/c/" + idCurso);
    }

    // Devuelve { nombre, fuente } o null. NUNCA devuelve un nombre que el DOM no confirme.
    function resolverIdentidadCurso() {
      // (a) Cursos activos: el ancla del curso actual en la barra lateral. Su `aria-label` trae
      // el nombre completo en UN atributo, así que no se parte en nodos (medido: 12/12 idéntico
      // al nombre que hoy sale del title).
      for (const a of document.querySelectorAll('a[aria-current="page"][href*="/c/"]')) {
        const etiqueta = (a.getAttribute("aria-label") || "").trim();
        if (etiqueta && hrefDelCurso(a)) return { nombre: etiqueta, fuente: "sidebar" };
      }

      // (b) Cursos ARCHIVADOS: no están en la barra lateral (medido: G25 y MB5 no tienen ningún
      // `aria-current="page"`). Ahí el nombre sale del title, pero SÓLO si alguna ancla al curso
      // actual lo confirma. La comparación es normalizada porque el header parte el nombre en
      // varios nodos y `textContent` lo devuelve sin espacios.
      const candidato = nombreSegunTitulo();
      if (!candidato) return null;
      const objetivo = normalizarNombre(candidato);
      if (!objetivo) return null;

      // Los textos de los dos links de vista NO sirven de confirmación: apuntan al mismo
      // `/c/<id>` y un title genérico ("Novedades") coincidiría con ellos. Se los excluye por
      // href, con `buscarLinkNav` y los MISMOS patrones que ya arma el archivo en `:223`
      // (Trabajo en clase) y `:402` (Novedades) — anclados y con el `idCurso` interpolado:
      const regexTrabajoVista = new RegExp(`^(?:/u/\\d+)?/w/${idCurso}/t/all(?:$|\\?)`);
      const regexNovedadesVista = new RegExp(`^(?:/u/\\d+)?/c/${idCurso}(?:$|\\?)`);
      const vistas = [buscarLinkNav(regexNovedadesVista), buscarLinkNav(regexTrabajoVista)];
      const textosDeVista = vistas
        .filter(Boolean)
        .map((a) => normalizarNombre(a.textContent || ""));
      if (textosDeVista.includes(objetivo)) return null;

      for (const a of document.querySelectorAll("a[href]")) {
        if (!hrefDelCurso(a)) continue;
        if (normalizarNombre(a.textContent || "") === objetivo) {
          return { nombre: candidato, fuente: "titulo-validado" };
        }
      }
      return null;
    }
```

**Reuso explicado**: `buscarLinkNav(patron)` ya existe en `:97-106` y devuelve el primer
`nav a[href]` cuyo href matchea el patrón — es lo que el paso 3 usa para navegar a Novedades. Acá se
lo usa para lo contrario: saber **qué textos NO son el nombre del curso**. **Verificado al escribir
este plan**: `buscarLinkNav` devuelve el **elemento** (`return a`, `:103`), no el href, así que
`.textContent` es correcto. Los dos patrones se declaran hoy dentro de sus bloques (`:223`, `:402`)
y no como constantes reutilizables, así que acá se construyen con la misma forma.

**1.d** Resolver la identidad **después** de que la vista de Trabajo en clase esté lista y **antes**
de leerla — no al arrancar, que es el error de hoy. Va inmediatamente después del paso 7b
(`hidratacion`, la espera de adjuntos resueltos) y antes del lector del paso 8:

```js
      // Identidad del curso: recién acá el DOM ya está pintado. En el camino feliz esta espera
      // cuesta 0 ms (`esperarCondicion` evalúa el predicado antes de dormir).
      let identidad = resolverIdentidadCurso();
      if (!identidad) {
        await esperarCondicion(() => Boolean(resolverIdentidadCurso()), tiempos.identidadCurso);
        identidad = resolverIdentidadCurso();
      }
      if (!identidad) {
        return {
          materia: "",
          enlaces: [],
          aviso:
            "No pudimos confirmar de qué curso es esta lista, así que no se muestra nada " +
            "(el riesgo es bajar los archivos a la carpeta de otro curso). Dejá Classroom al " +
            "frente, esperá a que el curso termine de cargar y re-escaneá.",
        };
      }
      const nombreCurso = identidad.nombre;
```

`nombreCurso` pasa a ser `const` local de ese bloque; hay que declararlo donde alcance a `:571`
(junto a `const itemsLeidosTrabajo = []`, `:275`), y asignarlo acá.

**1.e** Cinturón 1 — **los ítems leídos tienen que ser de este curso**. En los dos lectores
(paso 8 y paso 9), al recorrer los `li`, si el ítem trae un href `/c/<otroId>/m/` se aborta: es DOM
de otro curso montado en la misma vista. Medido: en la muestra de G22 hay 46 anclas
`/c/ODc0…/m/<idItem>`, todas del mismo curso.

```js
        // Un `/c/<otroId>/m/` en la vista significa DOM de otro curso todavía montado.
        const anclaItem = li.querySelector('a[href*="/m/"]');
        if (anclaItem) {
          const m = /\/c\/([^/?#]+)\/m\//.exec(anclaItem.getAttribute("href") || "");
          if (m && m[1] !== idCurso) return avisoCursoCambiado;
        }
```

con, junto a `avisoVisibilidad` (`:57`):

```js
    const avisoCursoCambiado = {
      materia: "",
      enlaces: [],
      aviso:
        "Cambiaste de curso mientras escaneábamos, así que descartamos lo leído para no " +
        "mezclar los archivos. Re-escaneá en el curso que quieras bajar.",
    };
```

**1.f** Cinturón 2 — **la URL no cambió durante el escaneo**. Antes de armar el retorno feliz
(`:591-595`, el que lleva `credenciales: { authuser: cuenta }` en `:593`), re-leer el id de la URL con la misma regex de `:67` y comparar con `idCurso`; si cambió,
`return avisoCursoCambiado`. Con las esperas de hoy el escaneo puede durar ~50 s, así que este caso
es el que el dueño vivió: escaneó, encoló y cambió de curso.

**1.g** Una línea de diagnóstico, junto a la del paso 12 (`console.warn` de adjuntos sin resolver):

```js
    console.log("[CLASSROOM] Curso:", idCurso, "→", nombreCurso, `(${identidad.fuente})`);
```

Sale por la consola **de la pestaña de Classroom**. Es la única forma de ver, en la Verificación B,
de dónde salió el nombre.

**1.h** Cabecera del archivo: `V1.3.0` y entrada de CHANGELOG, con la forma de las de arriba.

### Paso 2 — El fixture de tests gana la identidad

`sitio/google-classroom/__fixtures__/curso.html`. **Lo comparten los 13 tests**, y con la regla
nueva, tal como está, ninguno validaría: su `nav` sólo tiene `<a href="/u/2/c/CURSO123">Novedades</a>`,
cuyo texto no es el nombre del curso. Se le agrega, dentro del `nav` (que es donde están en el DOM
real, medido en 0.4), el ancla del curso activo:

```html
    <a aria-current="page" href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>
```

El nombre queda `"Física II"`, que es **el mismo** que hoy deriva del `<title>`, así que los 13
tests existentes no cambian ni una expectativa.

### Paso 3 — Tests

`sitio/google-classroom/scraper.test.js`. `TIEMPOS_TEST` gana `identidadCurso: 200`. Cuatro tests
nuevos, mutando el DOM **después** de `prepararDom()` (como ya hacen los tests 12 y 13):

- **Test 14 — "el title desfasado no manda: el nombre sale del sidebar"**. Poner
  `document.title = "Trabajo en clase de OTRO CURSO - Classroom"` y dejar el ancla
  `aria-current="page"` como está. Afirmar que **todos** los `modulo` empiezan con `"Física II › "`
  y que ninguno menciona `"OTRO CURSO"`. **Este test falla con el código de hoy** — hay que
  comprobarlo contra el scraper de `29d7919`, no darlo por hecho (en esta rama ya pasó que un test
  declarado así no fijaba nada).
- **Test 15 — "curso archivado: sin sidebar, el title vale si el DOM lo confirma"**. Quitar el
  `aria-current="page"` del ancla y agregar en el `nav` un `<a href="/u/2/c/CURSO123">Física<span> II</span></a>`
  (nombre partido en nodos, como en el DOM real). Afirmar que los `modulo` siguen empezando con
  `"Física II › "`.
- **Test 16 — "title genérico y sin sidebar: no lista nada y avisa"**. Quitar el `aria-current` y
  poner `document.title = "Trabajo en clase"`. Afirmar `enlaces.length === 0` y que `aviso`
  menciona el curso. Con `identidadCurso: 200` cuesta ~200 ms; con el default de 8 s colgaría la
  suite, así que si `TIEMPOS_TEST` no llegó a tener la clave, se ve acá.
- **Test 17 — "un ítem de otro curso en la vista aborta el escaneo"**. Agregar a la región un `li`
  con un `<a href="/u/2/c/OTRO999/m/item-1/details">`. Afirmar `enlaces.length === 0` y que el
  `aviso` habla de cambio de curso.

**Total +4: 719 → 723**, 43 archivos (ninguno nuevo).

### Paso 4 — Docs

- `docs/portal-google-classroom-diseno.md` §8: entrada nueva con la tabla 0.3 (las cuatro fuentes) y
  los números de 0.4 (12/12 idénticos; 37 validan / 0 contradicen / 15 sin fuente), más la nota de
  que las anclas validadoras están todas dentro del `nav`.
- `docs/ramas-en-revision.md`: el 🔴 nuevo con su evidencia (81 archivos md5-idénticos, el `modulo`
  del storage, `origenListado.clave` = id de G22), y al ejecutarse pasa a **Hecho**. Y a la checklist
  de Verificación B, un paso nuevo: cambiar de curso a mitad de escaneo y comprobar que **no** se
  lista nada del curso anterior.
- `docs/testing.md` §Baseline: 719 → **723**, con su párrafo "De dónde sale el 723".
- `docs/TECHNICAL_DEBT.md`: anotar como ⚪ que `popup.js:789` escanea en `status === 'complete'`, que
  en una SPA no significa "la vista está lista". Este plan lo tapa en el scraper; el disparador sigue
  siendo prematuro para los otros portales.
- Version headers y CHANGELOG de cada archivo tocado (`docs/coding-standards.md`).

---

## 3. Lo que no se toca

- **`popup.js:789`** y los otros 3 disparadores: la defensa va en el scraper, que los cubre a todos.
- **`parserTitulos.js`**: sigue tomando lo de antes de `" › "`. Recibe un `modulo` correcto y nada más.
- **`core/cola/procesadorCola.ts`**: la cola ya lleva `carpeta` con cada ítem y funciona (0.2).
- **`ResultadoEscaneo.adjuntosSinResolver` y `ctx.nota`**: son para "la lista sirve, algo quedó
  afuera". Acá la lista **no** sirve, y el canal es `aviso`.
- **Los ítems ya guardados con el nombre equivocado**: los reescribe el próximo escaneo del curso.
  No se escribe código de migración para 81 ítems de una rama sin mergear.

---

## 4. Verificación

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Esperado: **43 archivos, 723 tests** en verde; lint sin errores ni warnings; `tsc` sin salida; build
a `.output/chrome-mv3/`.

Y estas tres, que los tests no dan:

```bash
# 1. Nada quedó fuera de la función inyectada (constante de módulo = SyntaxError en la pestaña).
pnpm exec vitest run sitio/inyeccion.test.js

# 2. El control negativo: el test 14 tiene que FALLAR contra el scraper de 29d7919.
git show 29d7919:sitio/google-classroom/scraper.js > sitio/google-classroom/scraperViejo.tmp.js
#    (copiar scraper.test.js a un .tmp.test.js que importe ese archivo, correr sólo el test 14,
#     pegar la salida y BORRAR los dos .tmp)

# 3. El diff es el plan y nada más.
git diff --stat
```

**En Brave, con la extensión recargada** (checklist manual, la hace el dueño):

1. G22 al frente, 🔄 → 57 adjuntos, y en la consola **de la pestaña** una línea
   `[CLASSROOM] Curso: ODc0ODk1NDcwNTMw → Física II G22 … (sidebar)`.
2. **El caso del defecto**: estando en MC6 (vacío), navegar a G22 y dejar que el escaneo salga solo.
   Esperado: el nombre es el de G22, o bien la card de aviso — **nunca** una lista de G22 con nombre
   de MC6.
3. **Cambio a mitad de escaneo**: arrancar el escaneo en G22 y navegar a MC4 antes de que termine.
   Esperado: card de aviso de cambio de curso y la lista anterior intacta.
4. **Archivado**: G25 (`Fisica_II_G25_2026`) escanea y la consola dice `(titulo-validado)`.
5. Bajar 3 archivos de G22 y confirmar que caen en
   `google-classroom/fisica_ii_g22_2026_2do_cuatrimestre_facultad_de_ingenieria_unlp/` y que los ya
   bajados **siguen** marcados como descargados (si se re-bajan, el nombre cambió y hay que parar).

---

## 5. Qué tiene que traer el reporte

- La salida cruda de los cuatro comandos de la compuerta y de los tres de arriba, incluido el
  control negativo del test 14 (la salida del test fallando contra el scraper viejo).
- El `git diff --stat` completo.
- Qué fuente (`sidebar` / `titulo-validado`) resolvió cada curso, si se probó algo en el navegador.
- Cualquier cosa vista y **no** hecha porque el plan no la nombraba, como hallazgo aparte.
- Si algún paso no se pudo hacer como está escrito, **qué** se hizo en su lugar y por qué.
