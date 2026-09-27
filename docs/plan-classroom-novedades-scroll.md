# Plan — Novedades trae sólo la primera página: el scroll va a la barra lateral

**Rama**: `classroom-novedades-scroll` (desde `main` = `d125c52` + docs). **Fecha**: 2026-09-27.
**Origen**: deuda 🟠 #13 de `docs/TECHNICAL_DEBT.md` ("el escaneo de Novedades de G25 trae a veces 4
adjuntos y a veces ~26"), que la spec del corte 2 (`docs/specs/classroom-destino/spec.md`
§Dependencias) pide arreglado antes de construir el destino. No hay spec nueva: es un defecto de D11
(escanear también Novedades, `docs/portal-google-classroom-diseno.md` §3).

## Diagnóstico (medido en Brave el 2026-09-27, pestaña visible en toda la corrida)

- Novedades de G25 pinta **10-20 publicaciones** al entrar. Las demás las carga Classroom **sólo al
  hacer scroll del documento**: +10 por scroll, con un `[role=progressbar]` visible dentro de la vista
  ~300 ms, hasta **66 publicaciones / 28 adjuntos**. Al llegar al final, el scroll no muestra el
  progressbar y no crece nada.
- El que scrollea es el **documento** (`document.scrollingElement`: 4960 px de alto). En la página no hay
  **ningún** elemento con `overflow-y: auto|scroll` que de verdad scrollee.
- `buscarContenedorScroll()` (`sitio/google-classroom/scraper.js:352-366`) devuelve el elemento con
  `overflow-y: auto|scroll` de mayor `scrollHeight` **sin mirar si scrollea**. En el DOM real ése es la
  **barra lateral `<nav>`** (806 de alto, 806 visibles). `esperarQuietud` (`:368-393`) le hace
  `scrollTop = scrollHeight` durante sus vueltas: no pasa nada, y el escaneo lee la primera página.
- Corrida limpia en Brave: 4 vueltas de scroll sobre el elegido → 10 publicaciones / 3 adjuntos sin
  cambios; 8 vueltas sobre el documento → 66 / 28.
- Por qué parecía intermitente: el storage de las 17:03 tiene 4 adjuntos de Novedades de G25, pero el
  disco tiene 25 más que se bajaron a las 16:35-16:39. Ese escaneo encontró la página ya scrolleada, a
  mano o por una visita anterior. El defecto es determinístico; lo que varía es el estado de la
  pestaña.
- **Los tests no lo ven**: en jsdom no hay layout, así que ningún elemento tiene `scrollHeight` y
  `buscarContenedorScroll` siempre cae en el fallback, que justo es el correcto. Ningún test simula
  que Novedades pagina.

## Paso 1 — `sitio/google-classroom/scraper.js`: elegir sólo un contenedor que scrollee

En `buscarContenedorScroll()` (`:352`), un elemento es candidato sólo si **además** de tener
`overflow-y` `auto` o `scroll` cumple `el.scrollHeight > el.clientHeight + 1`. Entre los candidatos
se queda el de mayor `scrollHeight`, como hoy. Si no hay ninguno, el fallback de hoy
(`document.scrollingElement || document.documentElement || document.body`) no cambia.

- Comentario encima de la función, corto: por qué el `+ 1` y que en Classroom el que scrollea es el
  documento; la `<nav>` tiene `overflow-y: auto` y no scrollea (medido 2026-09-27).
- **No tocar** `esperarQuietud`: su criterio (3 vueltas estables de alto, cantidad y `aria-busy`) ya
  alcanza. Con el scroller correcto, cada vuelta de `tiempos.vuelta` (1500 ms) carga una página
  (~300 ms).
- Header del archivo: `V1.5.1` con un bullet
  `[CLASSROOM NOVEDADES SCROLL] buscarContenedorScroll exige que el contenedor scrollee de verdad; la <nav> lateral tapaba la paginación de Novedades.`

**Radio de impacto**: `esperarQuietud` se llama en tres lugares y los tres pasan a scrollear el
documento:
- `:565`: Trabajo en clase, tras asentarse.
- `:614`: Trabajo en clase, tras los "Ver más".
- `:760`: Novedades.

En Trabajo, el scroll puede hacer que Classroom pinte más temas si hay lazy-load, cosa que no se
midió. Si lo hace, se escanea **más**, nunca menos, y el criterio de quietud lo espera igual. El costo
es de tiempo: ~1,5 s por página extra de Novedades. En G25 son ~5 páginas, unos 8 s más por curso.
El tope del loader para Classroom es de 180 s por curso, así que sobra.
Nada más llama a `buscarContenedorScroll` (`git grep -n buscarContenedorScroll` → sólo `:352` y `:369`).

## Paso 2 — Tests en `sitio/google-classroom/scraper.test.js`

Dos tests nuevos al final del `describe("ScraperClassroom.escanearListado")`, con el mismo
`prepararDom()` y `TIEMPOS_TEST`. Primero, un helper local al archivo:

```js
// El DOM real de Classroom (medido 2026-09-27): la <nav> lateral tiene overflow-y:auto pero NO
// scrollea; el que scrollea es el documento, y Novedades carga 10 publicaciones más por scroll.
function simularNovedadesPaginadas({ paginas = 3, porPagina = 2 } = {}) {
  const nav = document.querySelector("nav");
  nav.style.overflowY = "auto";
  Object.defineProperty(nav, "scrollHeight", { configurable: true, get: () => 806 });
  Object.defineProperty(nav, "clientHeight", { configurable: true, get: () => 806 });

  const doc = document.documentElement;
  Object.defineProperty(document, "scrollingElement", { configurable: true, get: () => doc });
  let cargadas = 0;
  Object.defineProperty(doc, "scrollTop", {
    configurable: true,
    get: () => 0,
    set: () => {
      const vista = document.getElementById("vista-novedades");
      if (!vista || vista.hasAttribute("aria-hidden") || cargadas >= paginas) return;
      cargadas++;
      const n = cargadas;
      setTimeout(() => {
        for (let i = 1; i <= porPagina; i++) {
          const post = document.createElement("div");
          post.setAttribute("data-stream-item-id", `post-pag-${n}-${i}`);
          post.innerHTML = `
            <h2>Publicación ${n}.${i}</h2>
            <div data-attachment-id="att-pag-${n}-${i}">
              <a aria-label="Archivo adjunto: PDF: Pagina${n}_${i}.pdf" href="https://drive.google.com/file/d/drive-pag-${n}-${i}/view"></a>
            </div>`;
          vista.appendChild(post);
        }
      }, 1);
    },
  });
  return () => cargadas;
}
```

- **39. "Novedades: scrollea el documento aunque la <nav> tenga overflow-y:auto, y lee todas las
  páginas"**: `simularNovedadesPaginadas()` → `escanearListado({ tiempos: TIEMPOS_TEST })`. Esperar
  que los 6 `drive-pag-<n>-<i>` estén en `res.enlaces.map(e => e.idArchivo)`, además de
  `drive-cronograma` (el de la fixture), y que el contador devuelto dé `3`. (En `enlaces` el nombre
  viaja en `texto` y el id en `idArchivo`: ver el test 1.)
- **40. "un contenedor que scrollea de verdad se prefiere al documento"**: crear un
  `div#scroller` con `overflowY = "auto"`, `scrollHeight` 5000 y `clientHeight` 600 (con
  `defineProperty`), y espiar su `scrollTop` con un setter que cuente. Tras el escaneo, el contador
  del div es `> 0`. Esto guarda el caso para el que la función existía.

Si `TIEMPOS_TEST.vuelta` (5 ms) no deja ver el crecimiento antes de las 3 vueltas estables, subir la
`vuelta` **sólo en estos dos tests** (`{ ...TIEMPOS_TEST, vuelta: 20 }`), no el timeout global.

**Control negativo obligatorio, con la salida pegada**: volver temporalmente `buscarContenedorScroll`
a su versión de `main` (sin la condición `scrollHeight > clientHeight + 1`) y correr
`./node_modules/.bin/vitest run sitio/google-classroom/scraper.test.js`. **El 39 tiene que fallar**
(faltan los `Pagina*.pdf`). Revertir. Si pasa igual, no detecta nada: reportarlo y no seguir.

## Radio de impacto fuera del scraper

- `popup.js`, SW, backend, `core/`: no se tocan. No hace falta reiniciar Bun.
- La fixture `__fixtures__/curso.html` **no cambia**: la paginación la arma el helper del test.
- El recorrido de todos los cursos (`modo: "todos"`) usa el mismo `escanearListado` por curso, así
  que se arregla con esto.

## Verificación A (pegar la salida)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
git grep -n "clientHeight + 1" -- sitio/google-classroom/scraper.js
```

Baseline: 46 archivos / 799 tests → **46 / 801**. Anotarlo en `docs/testing.md` con su "De dónde sale
el 801". Más la salida del control negativo del Paso 2.

## Verificación B (dueño, en Brave)

`pnpm run build`, recargar la extensión. La pestaña de Classroom tiene que estar **al frente** y
**recién cargada** (F5 antes de escanear, para que no arranque ya scrolleada).

- **N-1**: entrar a G25 (archivado) y escanear ese curso solo. En la lista, el grupo Novedades tiene
  que traer bastante más que 4. Tanda lo cuenta en el storage y lo cruza con los 25 que ya están en
  `~/Descargas/verificacion-b/google-classroom/fisica_ii_g25_2026/` (`Guia*_P*.jpeg`,
  `1parcial_*.jpg`, `Resumen_guia*.pdf`…). Como ya están en disco, tienen que aparecer **marcados
  como descargados**.
- **N-2**: portada → "Escanear todos los cursos" y dejarlo terminar. Tanda compara las Novedades de
  G25 contra N-1 y el tiempo total contra los ~124 s de B-3.

## Doc

- `docs/TECHNICAL_DEBT.md`: la entrada 🟠 "Classroom: adjuntos de Novedades…" pasa a ✅. Con una
  línea de causa (`buscarContenedorScroll` elegía la `<nav>`) y otra de arreglo (Paso 1, tests 39/40).
  En el resumen de cabecera, sacarla de la lista y **re-contar** las abiertas (hoy dice 21).
- `docs/portal-google-classroom-diseno.md` §9, el hallazgo 🟡 "Novedades: los adjuntos faltan en el
  disco…" (`:912` aprox.): agregarle al final `→ Causa hallada el 2026-09-27: ver
  plan-classroom-novedades-scroll.md.` Nada más: el registro de §9 no se corrige hacia atrás.
- `docs/ramas-en-revision.md`: la sección "🚧 En revisión" pasa a nombrar esta rama, con qué trae,
  el plan y el checklist N-1/N-2.
- `docs/testing.md`: el baseline nuevo.
