# Plan — Corte 2a: sugerir el destino con el título de la publicación

**Rama**: `classroom-destino-adopcion` (sobre `69a55e4` + el commit de este plan). **Fecha**: 2026-09-27.
**Spec**: `docs/specs/classroom-destino/spec.md`, **RN-6**, **RN-7**, **RN-7a** y **RN-7b** (RN-7a/7b nuevos, del
dueño, 2026-09-27). Ningún `AC-n` cubre esto; la verificación está abajo.

## Por qué

En A-2 el dueño vio que los 9 temas de MC2 que no son Novedades quedaron en la raíz de la materia (`.`,
`regla=no`), aunque son de práctica. `sugerirDestino` sólo mira el **nombre del tema**, y en MC2 los temas se
llaman "Complejos", "Sistemas lineales", etc. La señal está en el **título de la publicación**, que el scraper
ya lee y descarta. Medido en `docs/muestras/google-classroom/recorrido-4-vermas/04-MC2 2025-trabajo.html`: las
14 publicaciones de Trabajo son "Ejercicios para practicar: …" (12), "Ejercicios para que practiquen: Espacios
vectoriales" y "Ejercicios resueltos". Las 14 caen en la regla de `Practicas` por `ejercici`.

Los temas "Links-Módulo I/II" de Física I no se resuelven así: sus publicaciones se llaman "Hidrodinámica-Tubo
de Pitot", "Clase IV", etc. Por eso llevan una regla por nombre de tema (RN-7b).

Línea de base medida por tanda hoy, con el `generar.js` actual y el storage actual de Brave: los TSV salen
**byte-idénticos** a `~/Descargas/adopcion-classroom` (366 ítems, 55/4/8/299, **12 temas con regla=no**,
2 choques).

## Qué hacen hoy las piezas que se tocan

- `core/destino/carpetas.ts:13-33`: `REGLAS_DESTINO` es una lista ordenada de `{ regex, destino }`.
  `sugerirDestino(tema)` devuelve `{ destino, regla: true }` con la **primera** regex que matchea el tema, o
  `{ destino: ".", regla: false }`. Las dos primeras reglas (`novedades|sin tema` y `cronograma`) mandan a `.`
  **con** `regla: true`.
- `sitio/google-classroom/scraper.js`:
  - Trabajo, `:697-698`: `material` es el `aria-label` del `div[role="button"][aria-expanded]` de la
    publicación, o `""` si no hay botón. Cada adjunto se empuja con `{ ...clasif, tema, material, vista }`
    (`:714-721`).
  - Novedades, `:790-791`: `material` es el texto del `h2`/`[role="heading"]` del post, o `"Novedad"`.
  - `:926-935` arma `enlaces` con `texto`, `href`, `modulo`, `tipo` e `idArchivo`. **Ahí se pierde
    `material`.**
- `core/puertos/sitio.ts:73-111`: `EnlaceListado`, el tipo de cada enlace. Los campos opcionales por portal
  (`idArchivo`, `bytes`) llevan un comentario que explica para qué están.
- `popup.js:1266-1310`, `aplicarEnlacesEscaneados`: arma cada ítem de la lista con una **lista fija de campos**
  (`titulo`, `modulo`, `tipo`, `idArchivo`, `bytes`, `sitioId`, `carpeta`…). Un campo nuevo del enlace **no
  llega** a `listaPersistente` si no se agrega acá. `appState.respaldar()` (`core/estado/appState.ts:374`)
  guarda `listadoClasesGlobal` tal cual, sin filtrar.
- `core/estado/recorridoTodos.ts` guarda los `enlaces` crudos de cada curso (`unknown[]`): el campo llega solo,
  sin cambios.
- `backend/adopcion/generar.js`:
  - `:210-218` cuenta los ítems por par `(clave_curso, tema)` en `paresTemaCurso`.
  - `:221-226` llama `sugerirDestino(tema)` por par y escribe `temas.tsv` (`regla` = `si`/`no`).
  - `:251` **vuelve a llamar** `sugerirDestino(tema)` por ítem para la columna informativa `carpeta` de
    `archivos.tsv`.
  - `:314-326` imprime el resumen.

## Paso 1 — `core/destino/carpetas.ts` (RN-7a, RN-7b)

1. En la regla de videos (`/video|simulaci/i` → `Teorias`) sumá `\blinks?\b`:
   `/video|simulaci|\blinks?\b/i`. No cambies el orden de las reglas.
2. Cambiá la firma a `sugerirDestino(tema?: string | null, publicaciones: readonly string[] = [])`:
   - Si alguna regla matchea el **tema**, devolvé lo mismo que hoy. El tema manda siempre: "Novedades" sigue
     yendo a `.` aunque sus publicaciones digan "Parcial".
   - Si no, recorré `publicaciones`. Hay **una entrada por adjunto**, así que un título se repite si su
     publicación tiene varios adjuntos. A cada una aplicale las mismas `REGLAS_DESTINO`, la primera que
     matchee, y contá por destino **sólo** los matches cuyo destino no es `"."`.
   - Si el destino más contado suma **estrictamente más de la mitad** de `publicaciones.length`
     (`cuenta * 2 > publicaciones.length`), devolvé `{ destino: ese, regla: true }`.
   - Si no, `{ destino: ".", regla: false }`, igual que hoy.
3. Comentario de dos líneas arriba de la función que cite RN-7a y el caso de MC2.

**Radio de impacto**: `sugerirDestino` la llaman **sólo** `backend/adopcion/generar.js:224` y `:251`, y
`core/destino/carpetas.test.ts`. Confirmalo con
`grep -rn 'sugerirDestino' --include='*.js' --include='*.ts' . | grep -v node_modules | grep -v '^./.output'`.
El segundo parámetro tiene default, así que una llamada vieja sigue igual.

## Paso 2 — Tests de `core/destino/carpetas.test.ts`

- **Cambiá** el test de `:89` (`"Links-Módulo I"`): ahora espera `{ destino: "Teorias", regla: true }`.
- El de `:82` ("Series de fourier…" sin publicaciones → `.`/`false`) **no cambia**: prueba el default.
- **Agregá** cinco tests en un `describe("sugerirDestino con títulos de publicación (RN-7a)")`, con títulos
  reales de MC2 copiados de la muestra:
  - **T1.** `("Complejos", ["Ejercicios para practicar: Complejos"])` → `Practicas`, `true`.
  - **T2.** `("Transformaciones lineales y proyecciones", ["Ejercicios para practicar: Proyecciones",
    "Ejercicios resueltos", "Ejercicios para practicar: Transformaciones lineales"])` → `Practicas`, `true`.
  - **T3.** Minoría: `("Cuestiones administrativas", ["Formulario de inscripción interna", "Clase I",
    "Guía 1"])` → `.`, `false`. Matchea 1 de 3.
  - **T4.** El tema manda: `("Novedades", ["Parcial 1", "Parcial 2"])` → `.`, `true`.
  - **T5.** La mitad justa no alcanza: `("Unidad 3", ["Guía 1", "Clase I"])` → `.`, `false`.

## Paso 3 — Scraper: el enlace lleva `publicacion`

1. `sitio/google-classroom/scraper.js:926-935`: agregá `publicacion: item.material,` al objeto de cada enlace,
   después de `modulo`. Vale igual para Trabajo y para Novedades: los dos ya traen `material`.
2. `core/puertos/sitio.ts`, en `EnlaceListado`, después de `bytes`: `publicacion?: string;` con un comentario
   que diga que es el título de la publicación de donde sale el adjunto (Classroom), y que lo usa la sugerencia
   de destino (RN-7a).
3. `sitio/google-classroom/scraper.test.js`: agregá un test junto al 5 (`:145`). Sobre el fixture `curso.html`,
   el enlace de `TP1.pdf` trae `publicacion === "TP 1"` y el de `Grabacion Teoria.mp4.md` trae
   `publicacion === "Clase 1"`. Los dos títulos salen del `aria-label` del botón de su publicación en el
   fixture. Ya los midió tanda.

**Radio de impacto**: `enlaces` de Classroom lo leen `core/estado/recorridoTodos.ts` (que lo guarda crudo) y
`popup.js:aplicarEnlacesEscaneados`. Ningún test compara un enlace entero con `toEqual`: los dos `toEqual` de
`scraper.test.js` (`:212`, `:222`) son contra `[]`. La identidad del ítem (`core/cola/identidadClase.ts`)
no usa este campo.

## Paso 4 — `popup.js`: el ítem de la lista conserva `publicacion`

En `aplicarEnlacesEscaneados` (`popup.js:1268-1306`), agregá `publicacion: item.publicacion,` después de
`bytes: item.bytes,`, con un comentario de una línea: `// [CORTE 2a] Título de la publicación (Classroom): lo
usa la sugerencia de destino, RN-7a.` En Ramón Net y Anatomy queda `undefined`, igual que `bytes` en Ramón
Net.

## Paso 5 — `backend/adopcion/generar.js`: sugerir con las publicaciones

1. En `:210-218`, `paresTemaCurso` pasa a guardar `{ cant, publicaciones: [] }` por par, y cada ítem empuja
   `item.publicacion ?? ""`. Un `""` cuenta en el denominador y no matchea nada: una lista vieja sin el campo
   da el mismo resultado que hoy.
2. Calculá **una vez por par** `sugerirDestino(tema, publicaciones)` y guardalo en un `Map` por `parKey`.
   Usalo en `temas.tsv` (`:224`) y en la columna `carpeta` de `archivos.tsv` (`:251`, buscando por el mismo
   `parKey` que ya arma esa vuelta). **No** vuelvas a llamar `sugerirDestino(tema)` por ítem: si el tema y el
   archivo no coinciden, `carpeta` miente.
3. En el resumen, después de `Temas con regla=no:`, agregá
   `console.log("Ítems sin título de publicación:", n)`, con `n` = ítems con `publicacion` vacío o ausente.
   Si `n === itemsConMd5.length`, agregá una línea más:
   `console.log("  ! La lista es anterior al campo 'publicacion': re-escaneá todos los cursos.")`.
   No aborta.

**Radio de impacto**: `aplicar.js` **no** llama `sugerirDestino`: lee el `destino` de `temas.tsv`. El editor
tampoco. `regla` sigue valiendo `si`/`no`, así que el filtro "Sólo sin regla" del editor
(`editor.html:763`, `tema.regla === "no"`) no cambia.

## Paso 6 — Docs

- `docs/ramas-en-revision.md`, antes de **A-2**: agregá **A-1b**. Dice que el dueño hace build, recarga la
  extensión y corre "Escanear todos los cursos" desde la portada, sin escanear nada después. Después, tanda
  regenera los TSV con `generar.js` y **re-aplica los docentes que el dueño ya había guardado** (Física I =
  `Lucila`, MB5 = `benevetano`). Los números esperados están en la Verificación B de este plan: citalo por
  ruta.
- **No** toques la spec: RN-7a/7b ya están escritos.

## Verificación A (obra; pegá la salida literal)

```bash
pnpm test && pnpm run lint && pnpm exec tsc --noEmit && pnpm run build   # 50 archivos / 843 tests (837 + 6), lint 0/0
grep -rn 'sugerirDestino' --include='*.js' --include='*.ts' . | grep -v node_modules | grep -v '^./.output' | grep -v '\.test\.'   # (a) sólo carpetas.ts y generar.js:224 y :251 o su reemplazo
grep -c 'publicacion' sitio/google-classroom/scraper.js popup.js core/puertos/sitio.ts backend/adopcion/generar.js   # (b) ≥1 en cada uno
T=~/Descargas/adopcion-sim/publicacion; rm -rf $T; mkdir -p $T
bun backend/adopcion/generar.js --salida $T 2>&1 | tail -12                # (c) 366; 55/4/8/299; regla=no 10; sin publicación 366 + la línea "!"; 2 choques
awk -F'\t' '$2 ~ /^Links-Módulo/{print $2, $3, $4}' $T/temas.tsv          # (d) las dos en Teorias si
awk -F'\t' '$3 ~ /^Links-Módulo/{print $5}' $T/archivos.tsv | sort | uniq -c   # (e) 18 Teorias
diff <(grep -v '^Links' <(cut -f2- $T/temas.tsv)) <(grep -v '^Links' <(cut -f2- ~/Descargas/adopcion-classroom/temas.tsv))   # (f) vacío: nada más cambió
```

(c) corre sobre el storage **actual**, que todavía no tiene el campo: prueba que una lista vieja da lo mismo
que hoy salvo por RN-7b. **No** escribas en `~/Descargas/adopcion-classroom`: tiene docentes que guardó el
dueño.

**Controles negativos obligatorios** (pegá la salida del test que cae, y revertí):
1. En `scraper.js`, sacá `publicacion: item.material,`. El test nuevo del Paso 3 **tiene que** caer.
2. En `carpetas.ts`, cambiá `cuenta * 2 > publicaciones.length` por `>=`. **T5 tiene que** caer.
3. En `carpetas.ts`, invertí el orden: primero publicaciones y después tema. **T4 tiene que** caer.

Si alguno pasa igual, reportalo y no sigas.

## Verificación B (dueño + tanda)

- **B-1.** Dueño: `pnpm run build` → recargar la extensión en Brave → portada de Classroom al frente →
  "Escanear todos los cursos" (≈3 min) → no escanear nada más.
- **B-2.** Tanda, primero en scratch: `bun backend/adopcion/generar.js --salida <scratch>`. Esperado:
  - 366 ítems (o el número nuevo, si Classroom cambió: se pega y se contrasta).
  - `Ítems sin título de publicación` cerca de 0. Sólo quedan vacíos los ítems sin botón de publicación.
  - `Temas con regla=no: 1` (`Cuestiones administrativas`).
  - Los 9 temas de MC2 que no son Novedades, en `Practicas si`; los 14 ítems en `archivos.tsv`, con
    `carpeta = Practicas`.
  - 2 choques, iguales a los de hoy.
- **B-3.** Tanda: copia de respaldo de los tres TSV reales → `generar.js` sobre `~/Descargas/adopcion-classroom`
  → re-aplicar `docente` de `cursos.tsv` desde el respaldo, por `clave_curso` → `diff` del respaldo contra el
  nuevo `cursos.tsv`, que sólo puede diferir en la columna `items`.
- **B-4.** Dueño: recargar el editor (🗂️). MC2 muestra `Practicas` y los Links muestran `Teorias`; el
  contador de sin regla, 1. Sigue A-2.

## Hallazgos

Anotá lo que veas y no esté nombrado arriba. No lo arregles.
