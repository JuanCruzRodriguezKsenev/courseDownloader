# Plan — Classroom corte 1: la identidad de los cursos archivados

**Estado**: listo para ejecutar. **Rama**: `classroom-corte-1`. **Fecha**: 2026-09-22.
**Antecedente**: `docs/plan-classroom-corte-1-identidad-del-curso.md`, ejecutado en `d61edc0`.
**Baseline al arrancar**: 43 archivos / **723** tests (compuerta verde, verificada el 2026-09-22).
**Baseline al terminar**: 43 archivos / **724** tests.

---

## 1. El defecto

El plan de identidad dejó **los dos cursos archivados sin poder escanearse**. En `G25` y `MB5` el
escaneo espera 8 s (`tiempos.identidadCurso`) y devuelve el aviso de la rama que aborta:

> No pudimos confirmar de qué curso es esta lista, así que no se muestra nada (el riesgo es bajar
> los archivos a la carpeta de otro curso). Dejá Classroom al frente, esperá a que el curso termine
> de cargar y re-escaneá.

Esos dos cursos son **2 de los 8** y son justo los únicos cuyos totales de la checklist siguen
firmes (G25 = 71, MB5 = 24). El paso 2 de la Verificación B habría fallado en ellos.

### Por qué pasa

`scraper.js:153-163` (rama (b), la de archivados) descarta el candidato del `<title>` cuando su
texto normalizado coincide con el de **el ancla que devuelve `buscarLinkNav(regexNovedadesVista)`**.
Y `buscarLinkNav` (`:113`) recorre `nav a[href]` en orden de documento y devuelve **la primera**
coincidencia — que en el DOM real **no es la pestaña "Novedades"**, sino el **encabezado del curso**
(el `<a>` dentro del `<h1>`), cuyo texto **es el nombre del curso**. O sea: la única fuente que
podía confirmar el título es exactamente la que el filtro elimina.

Medido sobre una muestra de G25 (`docs/muestras/google-classroom/recorrido-3/07-Fisica_II_G25_2026-trabajo.html`),
anclas con href `/u/2/c/Nzk0MDIyNDkyNDUx`, en orden de documento:

| # | ancestros | `aria-label` | texto |
|---|---|---|---|
| 2 | `… nav div div div h1` | — | `Fisica_II_G25_2026` ← **la devuelve `buscarLinkNav`** |
| 18 | `nav div div div div div` | — | `Novedades` |
| 19 | `nav div div div div div` | `Trabajo en clase (seleccionada)` | `Trabajo en clase` |

El curso activo tiene la misma forma, con el ancla del sidebar en medio (`#10`, `aria-current="page"`,
`role="menuitem"`, `aria-label` con el nombre completo) — por eso los activos no se ven afectados:
resuelven por la rama (a) y nunca llegan a la (b).

### Barrido propio sobre las 62 muestras (2026-09-22)

`idCurso` atribuido por el id más frecuente en los hrefs `/c/<id>/m/`, con `/w/<id>/t/all` como
respaldo. De las 62 muestras, **41** son de un curso.

| Medición | Resultado |
|---|---|
| Muestras donde la rama (a) tiene ancla de sidebar con `aria-label` | 31 / 41 |
| `aria-label` de sidebar que **no** es el nombre del curso (envenenamiento por pestaña) | **0** |
| Muestras con un ancla al curso dentro de un `<h1>` | **40** / 41 (falta sólo en `recorrido-1/00-partida.html`, que es la portada, no un curso) |
| Muestras con **más de un** ancla al curso dentro de un `<h1>` | **0** |
| Muestras donde el texto del ancla del `<h1>`, normalizado, **confirma** el candidato del title | **40 / 40** |
| Muestras donde lo **contradice** | **0** |
| Muestras de curso archivado que hoy abortan | **7 / 7** (G25 ×5, MB5 ×2) |

La consecuencia es que el ancla del `<h1>` es un confirmante mejor que "cualquier ancla al curso":
existe siempre que hay curso, es única, y **excluye a las dos pestañas de vista sin mirarles el
texto** (ninguna vive en un `<h1>`), que era todo lo que el filtro de `buscarLinkNav` intentaba
lograr.

### Diferencia con el número del doc de diseño

`docs/portal-google-classroom-diseno.md` §Identidad del curso dice "37 validan / 0 contradicen / 15
sin fuente, sobre las 45 muestras de curso". No se contradice con lo de arriba: cambia el criterio
con que se atribuye el `idCurso` a la muestra (45 vs 41) y el universo de anclas (cualquiera vs la
del `<h1>`). Lo que **sí** hay que corregir de ese doc es la "Nota de nav", que es la regla que
produjo el defecto.

---

## 2. Radio de impacto

- **`buscarLinkNav` se sigue usando en `:289` (ir a Trabajo en clase), `:496` (ir a Novedades) y
  `:576` (volver a Trabajo en clase). Esos tres usos NO se tocan.** Este plan sólo le quita el uso
  que hace la resolución de identidad. Que `:496` devuelva el ancla del `<h1>` en vez de la pestaña
  es el comportamiento **de hoy y de siempre**, y navega igual porque el href es el mismo
  (`/u/N/c/<id>`): la Verificación B del 2026-09-16 escaneó Novedades en los 8 cursos con ese
  camino. No es parte de este plan.
- **Nada fuera de `sitio/google-classroom/scraper.js` cambia de forma.** `ResultadoEscaneo` no
  cambia (`core/puertos/sitio.ts` intacto), el aviso ya existe y ya lo pinta el popup como tarjeta,
  y `identidad.fuente` sólo se usa en el `console.log` de `:585`.
- **El fixture es compartido por los 18 tests** de `sitio/google-classroom/scraper.test.js`: el
  cambio de la sección `<nav>` los afecta a todos. Ya está medido: con el fixture nuevo y el código
  de hoy fallan **exactamente** los tests 15 y 18, y los otros 16 quedan en verde.
- El arnés del test (`prepararDom`, `:69-80`) cablea el click de **todas** las `nav a[href]`: el
  ancla nueva del `<h1>` queda cableada como las demás, con la misma rama `href.includes("/c/")`.

---

## 3. Los pasos

### Paso 1 — `sitio/google-classroom/scraper.js`: confirmar con el encabezado del curso

Reemplazar el bloque **`:153-170`** (desde el comentario `// Los textos de los dos links de vista
NO sirven…` hasta el `}` que cierra el `for (const a of document.querySelectorAll("a[href]"))`,
dejando el `return null;` final de la función) por:

```js
      // El único confirmante aceptable es el ancla al curso actual dentro del `<h1>`: el
      // encabezado del curso. Medido sobre las 62 muestras (2026-09-22): existe en 40 de las 41
      // muestras de curso, es única en todas, y su texto normalizado confirma el title en 40/40,
      // sin ninguna contradicción. Las dos pestañas de vista quedan afuera por no vivir en un
      // `<h1>`, sin mirarles el texto: filtrarlas por `buscarLinkNav` era el defecto del
      // 2026-09-21, porque `buscarLinkNav` devuelve la PRIMERA `nav a[href]` que coincide y en el
      // DOM real ésa es justamente el encabezado (el único que puede confirmar).
      for (const a of document.querySelectorAll("h1 a[href]")) {
        if (!hrefDelCurso(a)) continue;
        if (normalizarNombre(a.textContent || "") === objetivo) {
          return { nombre: candidato, fuente: "titulo-validado" };
        }
      }
```

Quedan sin usar y **se borran** `regexTrabajoVista`, `regexNovedadesVista`, `vistas` y
`textosDeVista`. El comentario de `:144-147` sigue valiendo tal cual: ajustar sólo la última
oración para que diga que la confirmación es el ancla del `<h1>`.

Subir el encabezado del archivo a **v1.3.1** con una línea de CHANGELOG:

```
 * CHANGELOG v1.3.1:
 * - [CLASSROOM CORTE 1 — IDENTIDAD EN ARCHIVADOS] En cursos archivados el title lo confirma el
 *   ancla del `<h1>` (el encabezado del curso), no "cualquier ancla al curso menos los links de
 *   vista": ese filtro descartaba al propio encabezado y dejaba G25 y MB5 sin poder escanearse.
```

### Paso 2 — `sitio/google-classroom/__fixtures__/curso.html`: el `<nav>` como es en el DOM real

Reemplazar el bloque `<nav>` (`:8-12`) por:

```html
  <!-- Orden medido en las 62 muestras: encabezado del curso (dentro de un <h1>), después el
       ancla del sidebar del curso activo, y al final las dos pestañas de vista. El encabezado va
       PRIMERO porque es el que `buscarLinkNav` devuelve en el DOM real, y el nombre viene partido
       en nodos (`textContent` lo da sin espacios). -->
  <nav>
    <h1><a href="/u/2/c/CURSO123">Física<span> II</span></a></h1>
    <a aria-current="page" href="/u/2/c/CURSO123" aria-label="Física II">Física II</a>
    <a href="/u/2/c/CURSO123">Novedades</a>
    <a href="/u/2/w/CURSO123/t/all">Trabajo en clase</a>
  </nav>
```

### Paso 3 — `sitio/google-classroom/scraper.test.js`: el test 15 prueba el mecanismo real

En el **test 15** (`:352-369`) borrar las cinco líneas que agregan `anclaArchivado` al `<nav>`:
con el fixture del paso 2 el confirmante es el `<h1>`, que es lo que hay en el DOM real, y el ancla
inventada tapaba el defecto. El cuerpo queda:

```js
  it("15. curso archivado: sin sidebar, el title vale si el DOM lo confirma", async () => {
    const anclaSidebar = document.querySelector('a[aria-current="page"]');
    if (anclaSidebar) anclaSidebar.removeAttribute("aria-current");

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.aviso).toBeUndefined();
    expect(res.enlaces.length).toBeGreaterThan(0);
    for (const e of res.enlaces) {
      expect(e.modulo.startsWith("Física II › ")).toBe(true);
    }
  });
```

Agregar el **test 18** antes del test 17 (queda junto a los otros de identidad):

```js
  it("18. un ancla del curso fuera del <h1> no confirma el title", async () => {
    document.querySelector('a[aria-current="page"]').remove();
    document.querySelector("nav h1").remove();
    const suelta = document.createElement("a");
    suelta.setAttribute("href", "/u/2/c/CURSO123");
    suelta.textContent = "Física II";
    document.querySelector("nav").appendChild(suelta);

    const res = await ScraperClassroom.escanearListado({ tiempos: TIEMPOS_TEST });

    expect(res.enlaces.length).toBe(0);
    expect(res.aviso).toBeDefined();
    expect(res.aviso).toContain("curso");
  });
```

**Poder de detección, ya medido (no hace falta re-medirlo).** Con los pasos 2 y 3 aplicados y el
paso 1 **sin** aplicar: `Tests 2 failed | 16 passed (18)`, y los dos que fallan son el 15 (recibe
el aviso "No pudimos confirmar de qué curso…" donde esperaba `undefined`) y el 18 (hoy el ancla
suelta confirma y el escaneo lista). Con el paso 1 aplicado: `Tests 18 passed (18)`.

### Paso 4 — Docs

1. **`docs/portal-google-classroom-diseno.md`**, §"Identidad del curso y fuentes del nombre
   (2026-09-21)". Contrastar contra el bloque de **§1 de este plan** antes de escribir:
   - La **"Nota de nav"** dice hoy: *"se descartan los textos que coincidan con los links de vista
     («Novedades», «Trabajo en clase»)"*. **Esa regla es el defecto**: reemplazarla por el ancla
     del `<h1>`, con los números del barrido del 2026-09-22 (40/41 tienen ancla en `<h1>`, única en
     todas, confirma en 40/40, contradice en 0) y la razón por la que el filtro viejo fallaba
     (`buscarLinkNav` devuelve la primera `nav a[href]`, que en el DOM real es el encabezado).
   - La fila de la tabla *"texto de un `a[href$="/c/<id>"]` (header)"*: aclarar que el confirmante
     es el ancla **dentro del `<h1>`**, y que el nombre sin espacios sólo sirve normalizado.
   - Dejar la frase *"37 validan, 0 contradicen, 15 sin fuente"* como está y agregar la nota de por
     qué los números del barrido nuevo no son los mismos (criterio de atribución del `idCurso`).
2. **`docs/testing.md`**: baseline `723` → **`724`** en la tabla, y un bloque nuevo **"De dónde sale
   el 724"** arriba del de 723: `+1` test en `sitio/google-classroom/scraper.test.js` (test 18: un
   ancla del curso fuera del `<h1>` no confirma el title). El test 15 no suma, cambia.
3. **`docs/ramas-en-revision.md`**:
   - En la lista de **Hecho**, una entrada nueva con este plan y sus tres pasos de código.
   - En **Hallazgos de la Verificación B**, una entrada 🔴 **cerrada en la misma línea** con lo del
     §1: qué rompía (G25 y MB5 sin poder escanearse), cómo se detectó (barrido de las 62 muestras
     simulando `resolverIdentidadCurso`, antes de tocar el navegador) y con qué se arregló.
   - En la **checklist**, en el paso 2, agregar al lado de los dos archivados: *"si aparece la
     tarjeta «No pudimos confirmar de qué curso es esta lista», es el defecto del 2026-09-22 y el
     arreglo no está en el build"*.
4. **`docs/TECHNICAL_DEBT.md`**: **no se toca.** Este plan no abre ni cierra deuda; la entrada 12
   (`popup.js:789` dispara en `status === 'complete'`) sigue igual de abierta y sigue siendo la
   causa de fondo.

---

## 4. Verificación

Batería literal, con la salida pegada en el informe:

```bash
cd /home/jcrod/Dev/courseDownloader
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
```

Esperado: **43 archivos / 724 tests**, lint 0/0, `tsc` sin salida, build a `.output/chrome-mv3/`.

Y estos tres, también con la salida pegada:

```bash
# 1. el confirmante nuevo viajó al bundle
grep -c 'h1 a\[href\]' .output/chrome-mv3/chunks/popup-*.js
# 2. el filtro viejo NO quedó en el bundle
grep -c 'textosDeVista\|regexNovedadesVista' .output/chrome-mv3/chunks/popup-*.js
# 3. los cuatro tests de identidad, nombrados
pnpm vitest run sitio/google-classroom/scraper.test.js 2>&1 | grep -E '1[4-8]\.'
```

Esperado: (1) ≥ 1; (2) **0** — el bundle está minificado, pero esos dos identificadores son locales
y no deberían sobrevivir; si aparecen, pegar el contexto y no darlo por bueno; (3) los cinco tests
14, 15, 16, 17 y 18 en verde.

**En navegador** (Verificación B, cuando se corra): los pasos 2 (G25 = 71 y MB5 = 24, sin tarjeta de
"No pudimos confirmar de qué curso") y 15 de la checklist de `docs/ramas-en-revision.md`.
