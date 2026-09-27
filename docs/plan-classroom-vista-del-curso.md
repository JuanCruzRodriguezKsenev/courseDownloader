# Plan — La vista que se lee tiene que ser la del curso

**Rama**: `classroom-escanear-todas`. **Fecha**: 2026-09-27. Árbol limpio al empezar.
**Origen**: L-2 del dueño en Brave (2026-09-27): *"lee un solo curso y termina y no vuelve al menú"*.
**Spec**: `docs/specs/classroom-escanear-todas/spec.md` (el recorrido tiene que pasar por todos los
cursos) y `docs/specs/loader-con-progreso/spec.md` RN-21 (si el recorrido se **corta**, la pestaña queda
donde está: que no vuelva a `/h` es correcto **dado** el corte; el defecto es el corte).

## Diagnóstico (reproducido y medido)

Storage de Brave tras la corrida del dueño: `recorridoTodos.estado = "cortado"`,
`motivoCorte = "navegacion"`, `indice = 1` (MC6, 2º curso), G22 `ok` en 21 s, y el progreso del curso 2
decía `publicaciones: 65`. MC6 no tiene publicaciones: esas 65 son las de G22.

`motivoCorte: "navegacion"` sale de un solo lugar (`scraper.js:1139-1141`): el curso devolvió
`avisoCursoCambiado` porque encontró un `/c/<otroId>/m/` en la vista que estaba leyendo (`:655` en
Trabajo, `:742` en Novedades). **La vista que leyó era la del curso anterior.**

Causa, medida con Claude in Chrome en el Brave del dueño (pestaña al frente, sin escanear, sólo
navegando como el recorrido y leyendo el DOM cada 20-50 ms):

1. `obtenerVistaActiva()` (`:123-129`) devuelve el primer `body > c-wiz` sin `aria-hidden="true"` y,
   **si no hay ninguno, `document.body`**.
2. Al hacer clic en una pestaña de vista, Classroom pasa por dos estados intermedios de ~100-200 ms:
   - **ningún `c-wiz` visible** → la función devuelve `body`, que contiene **todas** las vistas ocultas
     (las 65 publicaciones de G22 incluidas);
   - **un `c-wiz` visible con el contenido del curso anterior** (a los 75-90 ms: 65 publicaciones yendo a
     MC6; al revés, la vista vacía de MC6 yendo a G22).
3. La espera del paso 3 (`:458-464`) sólo pide "distinta de la previa y con ítems o marcador de vacío".
   Cualquiera de los dos estados intermedios la cumple **en el primer sondeo**, y `trabajoAsentado`
   (`:477-499`) los da por `con-items` en el acto. Lo mismo la espera de Novedades (`:705-709`).

Frecuencia: G22 → MC6 dio vista equivocada en **4 de 4** intentos seguidos, y en otra tanda en 0 de 3:
depende del momento. La caída a `body` apareció también yendo a **Novedades dentro del mismo curso**
(G22 → G22). Por eso la B-3 del 2026-09-27 pasó limpia con 7 cursos y esta no: el defecto es del corte 1
y afecta también al escaneo de **un** curso ("Cambiaste de curso mientras escaneábamos…" sin haber
tocado nada).

### El criterio, medido

Cada vista de un curso nombra a su curso en sus enlaces, y **a ningún otro**:

- Trabajo: "Ver tus trabajos" → `/u/N/c/<id>/sp/<x>/all/default`.
- Novedades: "Ver todos los trabajos" → `/u/N/a/<x>/<id>`; en algunas, también `/c/<id>/…`.

Extrayendo ids de curso de los `a[href]` de la vista con tres patrones —`/c/<id>`, `/w/<id>` y
`/a/<x>/<id>` al final del path— el conjunto da **exactamente `{id propio}` en 39 de 39** vistas
visibles de las muestras (`docs/muestras/google-classroom/`, sin `recorrido-2-pestana-oculta`; Trabajo
y Novedades, activos, archivados y vacíos). En vivo, 12 transiciones: los dos estados intermedios
traen ids de **otro** curso (`body` trae los de la barra lateral; la vista vieja, el suyo), y con el
filtro la espera eligió **siempre** la vista correcta, en 100-320 ms.

**El filtro es negativo** —"la vista no nombra a otro curso"— y no positivo, porque **los fixtures de
los tests no tienen ningún `href` con el id del curso dentro de las vistas** (`__fixtures__/curso.html`
y los inline de `scraper.test.js:193, 825, 870, 1161`): uno positivo rompería casi toda la suite. El
negativo alcanza para los dos estados medidos.

## Paso 1 — `sitio/google-classroom/scraper.js`

1. Dentro de `escanearCursoActual`, al lado de `hrefDelCurso` (`:293`, ya en el alcance de `idCurso`),
   agregar:

   ```js
   // Classroom, al cambiar de vista, deja ver ~100-200 ms la vista del curso ANTERIOR, o ninguna
   // (y `obtenerVistaActiva` cae a `body`, que tiene todas). Medido 2026-09-27: cada vista de un
   // curso nombra en sus enlaces a su curso y a ningún otro (39/39 muestras). Una vista que nombra
   // a otro curso todavía no es la nuestra.
   const PATRONES_ID_CURSO = [
     /^(?:https:\/\/classroom\.google\.com)?(?:\/u\/\d+)?\/(?:c|w)\/([^/?#]+)/,
     /^(?:https:\/\/classroom\.google\.com)?(?:\/u\/\d+)?\/a\/[^/?#]+\/([^/?#]+)(?:[?#]|$)/,
   ];
   function nombraOtroCurso(raiz) {
     for (const a of raiz.querySelectorAll("a[href]")) {
       const href = a.getAttribute("href") || "";
       for (const patron of PATRONES_ID_CURSO) {
         const m = patron.exec(href);
         if (m && m[1] !== idCurso) return true;
       }
     }
     return false;
   }
   ```

   Ojo con el segundo patrón: tiene que estar **anclado al final del path**. Sin el anclaje,
   `/c/<id>/a/<tarea>/details` de una tarea daría `details` como id y rechazaría toda vista con tareas.

2. **Paso 3, espera de Trabajo** (`:458-464`): en el predicado, después de `if (va === vistaPrevia) return false;`,
   agregar `if (nombraOtroCurso(va)) return false;`.

3. **Paso 4, `trabajoAsentado`** (`:477`): primera línea después de `if (!va) return null;`:
   `if (nombraOtroCurso(va)) { desdeCuandoVacio = null; return null; }`. Reiniciar
   `desdeCuandoVacio` importa: la vista vacía **de otro curso** no puede empezar a contar el asentado
   del vacío.

4. **Capturar la vista que pasó el predicado** en vez de volver a pedirla:
   - `:501-505`: declarar `let vistaAsentada = null;` y, en el predicado,
     `const va = obtenerVistaActiva(); resultadoAsentado = trabajoAsentado(va); if (resultadoAsentado !== null) vistaAsentada = va; return resultadoAsentado !== null;`.
   - `:517`: `const vistaTrabajo = vistaAsentada;`.
   - Novedades, `:705-709` y `:721`: lo mismo. Agregar `if (nombraOtroCurso(va)) return false;` al
     predicado, guardar `va` en `let vistaNovedadesLista = null;` cuando da `true`, y en `:721`
     `const vistaNovedades = vistaNovedadesLista;`.

5. **No tocar**:
   - `obtenerVistaActiva()`. Los usos de la portada (`:968` `leerCursosDePagina`, `:999` espera de
     archivadas) **leen enlaces a varios cursos a propósito**, y el test 28 (archivadas con demora)
     ejercita la caída a `body`.
   - Los chequeos `avisoCursoCambiado` de `:655`, `:742` y `:909`: siguen como red de seguridad para
     cuando el usuario **sí** cambia de curso.
   - `tiempos`.

## Paso 2 — Tests nuevos en `sitio/google-classroom/scraper.test.js`

Van al final del `describe`, después del 36. Los dos usan `prepararDom()` con `htmlFixture` y
`tiempos: { ...TIEMPOS_TEST, navegacion: 1000, pintado: 1000 }`. En los dos se agrega, **antes** de
`#vista-trabajo`, esta vista de otro curso, oculta:

```html
<c-wiz id="vista-otro-curso" aria-hidden="true">
  <a href="/u/2/c/OTRO999/sp/xyz/all/default">Ver tus trabajos</a>
  <div role="region" aria-label="Tema Viejo">
    <li data-stream-item-id="viejo-1" data-expandable-row-id="row-viejo-1">
      <div role="button" aria-expanded="true" aria-label="Material Viejo"></div>
      <a href="/u/2/c/OTRO999/m/m1/details">Material Viejo</a>
      <div data-attachment-id="att-viejo">
        <a aria-label="Archivo adjunto: PDF: Viejo.pdf" href="https://drive.google.com/file/d/drive-viejo/view"></a>
      </div>
    </li>
  </div>
</c-wiz>
```

Para desviar un clic sin tocar `prepararDom`: un listener **de captura** en `document`
(`addEventListener("click", fn, true)`) que, si `e.target.closest('a[href="<href>"]')` coincide, hace
`e.preventDefault(); e.stopPropagation();` y aplica su propia secuencia. Quitarlo al terminar el test.

- **Test 37 — "Trabajo: la vista de otro curso que queda visible un instante no se lee"**. Arranque en
  Novedades: URL `https://classroom.google.com/u/2/c/CURSO123`, `#vista-trabajo` con
  `aria-hidden="true"` y `#vista-novedades` sin él. Desvío del clic a `/u/2/w/CURSO123/t/all`:
  ocultar `#vista-novedades`, **mostrar `#vista-otro-curso`**, poner la URL en `/u/2/w/CURSO123/t/all`,
  y a los 150 ms ocultar `#vista-otro-curso` y mostrar `#vista-trabajo`.
  Espera: `res.motivoAviso` y `res.aviso` indefinidos, `res.enlaces` contiene `drive-sin-tema` y
  **ninguno** tiene `idArchivo === "drive-viejo"`.

- **Test 38 — "Novedades: con ningún c-wiz visible no se lee el body"**. Arranque normal (Trabajo,
  `/u/2/w/CURSO123/t/all`). Desvío del clic a `a[href="/u/2/c/CURSO123"]` (el scraper hace clic en la
  **primera** coincidente del `nav`, que es la del `<h1>`: el selector del listener tiene que atrapar
  cualquiera): ocultar **todos** los `body > c-wiz`, poner la URL en `/u/2/c/CURSO123`, y a los 150 ms
  mostrar `#vista-novedades`. **Sólo el primer clic**: después, el paso 10 hace clic en Trabajo y ese va
  por el manejador normal.
  Espera: `res.motivoAviso` indefinido y `res.enlaces` sin `drive-viejo`. Sin el arreglo, el scraper toma
  `body` como Novedades, recorre `[data-stream-item-id]` y devuelve `avisoCursoCambiado` por el
  `/c/OTRO999/m/`.

**Control negativo obligatorio, con la salida pegada**: con los tests nuevos y **sin** el Paso 1
(`git stash push sitio/google-classroom/scraper.js`, correr, `git stash pop`), el 37 y el 38 tienen que
**fallar**, y el mensaje de fallo tiene que mostrar el `motivoAviso: "curso-cambiado"` o el `drive-viejo`.
Si alguno pasa sin el arreglo, no detecta nada: reportarlo y **no** seguir afinándolo a ciegas.

## Radio de impacto

- Único archivo de producción: `scraper.js`, dentro de `escanearCursoActual`. Lo usan los dos modos: un
  curso (`escanearListado` sin `modo`) y el recorrido (`:1098`). Los dos quedan cubiertos.
- `trabajoAsentado` es local. Los tests 8, 25 y 26 la ejercitan con fixtures sin `href` a otro curso:
  tienen que seguir verdes sin cambios.
- Tests del recorrido (19-36): el harness (`scraper.test.js:~470-560`) arma cada curso reemplazando
  `CURSO123` por su id en el fixture, que no tiene enlaces dentro de las vistas: `nombraOtroCurso` da
  `false` y no cambia nada. **Si alguno se pone rojo, es que en su DOM la vista activa nombra a otro
  curso: pegar cuál y parar**, no ajustar el filtro.
- `sitio/google-classroom/config.ts`, SW, popup y backend: no se tocan. No hace falta reiniciar Bun.

## Verificación A (pegar la salida)

```bash
pnpm test
pnpm run lint
pnpm exec tsc --noEmit
pnpm run build
git grep -n "nombraOtroCurso" -- sitio/google-classroom/scraper.js     # definición + 3 usos
git grep -n "const vistaTrabajo = vistaAsentada\|const vistaNovedades = vistaNovedadesLista" -- sitio/google-classroom/scraper.js
```

Baseline: 46 archivos / 796 tests → **46 / 798**. Más la salida del control negativo del Paso 2.

## Verificación B (dueño, en Brave)

`pnpm run build`, recargar la extensión, pestaña de Classroom **al frente** en la portada:

- **L-2** de `docs/ramas-en-revision.md`: "Escanear todos los cursos" pasa por **los 7**, al final la
  pestaña vuelve a la portada y aparece la lista agrupada con los 7 cursos. Cronometrar.
- **Repetirlo una vez más** (la falla es intermitente: 4/4 una tanda, 0/3 otra).
- Escaneo de un curso: entrar a G22, ir a MC6, volver a G22 y escanear: lista de G22 **sin** el aviso
  "Cambiaste de curso".

## Doc

En `docs/ramas-en-revision.md`, el 🔴 "El recorrido se corta en el 2º curso" pasa a ✅ con una línea:
qué hace `nombraOtroCurso`, dónde se aplica, y el número de tests.
