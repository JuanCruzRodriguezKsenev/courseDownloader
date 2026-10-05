# Plan — Corte 2a: la raíz pasa a la bóveda (`~/Boveda/Areas/Facultad`)

**Rama**: `classroom-destino-adopcion` (la misma del corte 2a; se mergea después de esto).
**Spec**: `docs/specs/classroom-destino/spec.md`. **ADR nuevo**: 0018.
**Quién**: obra ejecuta. Tanda re-verifica.

## Por qué

- El 2026-09-26, `~/U.N.L.P` se incorporó por `git subtree` a `~/Boveda/Areas/Facultad` (commit
  `e55edae` de la bóveda). Desde entonces la bóveda es el único hogar de la facultad y
  `~/U.N.L.P` quedó retirado, aunque **no se borra**: queda como respaldo. La decisión es del dueño y
  está en `~/Boveda/Sistema/Informe - una o varias bóvedas y agentes para la bóveda.md` §7.
- La adopción del corte 2a ya está aplicada en la bóveda, en el commit `32136ca` de `~/Boveda`: 295
  archivos más el índice `Areas/Facultad/.course-downloader.json`, que está **versionado**. Tanda la
  hizo con un mapa aparte, no con `aplicar.js`.
- Hoy el código y los docs de la rama siguen apuntando a `~/U.N.L.P`, y dicen que el índice va en
  `.gitignore` porque ese repo es público. La bóveda es un repo **privado**. Si alguien corriera
  `aplicar.js --escribir` contra la bóveda, agregaría el índice a `Areas/Facultad/.gitignore` y
  contradiría la decisión del dueño.

## Decisiones (ya tomadas; no hay nada abierto)

| # | Decisión | De quién |
|---|---|---|
| D-1 | La raíz es `~/Boveda/Areas/Facultad`. | Dueño, 2026-09-26 (fusión) |
| D-2 | El índice se **versiona**. Ningún código lo agrega a `.gitignore`. | Dueño, 2026-09-28 |
| D-3 | Hay un destino nuevo, `Notas/`, a nivel de la materia, para las planillas de notas. **No** va dentro de `Parciales/`, porque la operación Repasar de la skill `apuntes` saca las preguntas de `Parciales/`. | Dueño, 2026-09-28 |
| D-4 | Los accesos `.md` nacen con frontmatter `tipo: acceso` y `revisado: AAAA-MM-DD`. | Dueño, 2026-09-28 (el tipo); formato de la bóveda |
| D-5 | PA-4: un acceso `.md` cuyo id ya está en el índice **no se recrea nunca**, esté donde esté, aunque se haya editado, movido o borrado. | Dueño, 2026-09-28 |
| D-6 | La búsqueda por md5 de RN-19/22 recorre toda la raíz salvo `Wiki/`, `Mis notas/` y `Clases/`, en cualquier nivel: son carpetas de notas que no guardan adjuntos. | Tanda, contra `~/.claude/skills/apuntes/SKILL.md` §Estructura |

D-3 a D-6 se **escriben** en la spec en este plan. En código, D-4 a D-6 los construye el corte 2b.

## Radio de impacto

Quién construye o lee lo que se toca:

- **La raíz por defecto** (`path.join(os.homedir(), "U.N.L.P")`) está en tres lugares:
  - `backend/adopcion/aplicar.js:13`
  - `backend/adopcion/generar.js:52`
  - `backend/adopcion/editor.js:9`, dentro de `opcionesPorDefecto()`. **La usa también el servidor
    del 3001**: `backend/server.js:12` llama a `crearManejadorEditor(opcionesPorDefecto(), "/adopcion")`.
    Al cambiar el valor por defecto, cambia también la raíz del editor montado en `/adopcion/`.
- **`.gitignore` sólo lo toca `aplicar.js`**, en dos lugares:
  - `:98-111`: el chequeo de UTF-16. Lo único que protege es el append que sigue, así que sale con él.
  - `:489-500`: el append del índice a `.gitignore`.
  - No hay test que cubra ninguno de los dos (`git grep -n gitignore -- '*.test.*'` da 0).
- **`DESTINOS`** (`core/destino/carpetas.ts:1-9`). Lo leen:
  - `backend/adopcion/aplicar.js:142`: valida `temas.tsv`. Acepta `Notas` sin cambios.
  - `backend/adopcion/editor.js:172`: lo manda a la página, que arma el desplegable con lo que
    recibe. `editor.html` no tiene la lista escrita: `git grep -n Bibliografia backend/adopcion/editor.html`
    da 0.
  - `backend/adopcion/editor.js:291`: valida al guardar.
  - `core/destino/carpetas.test.ts:5-15`: compara la lista entera con `toEqual`.
  - `backend/adopcion/generar.js:206`: escribe la lista **a mano** en un comentario de `temas.tsv`.
  - El tipo `Destino` no se usa fuera de `carpetas.ts`. Tanda lo comprobó con `git grep -n "\bDestino\b" -- core backend sitio popup`.
- **`REGLAS_DESTINO`** (`core/destino/carpetas.ts:13-23`). Hoy `notas de evaluaci` está dentro de la
  regla de `Parciales` (`:18`). La regla la usa `sugerirDestino`, que sólo llama `generar.js:231`.
- **Docs que dicen `~/U.N.L.P` o "índice gitignoreado"**, y que este plan toca:
  - `docs/specs/classroom-destino/spec.md`
  - `docs/adr/0017-indice-de-destino-en-la-raiz.md` (sólo el `Estado`)
  - `docs/adr/README.md`
  - `docs/deployment.md:42`
  - `docs/ramas-en-revision.md`
  - **No se tocan**: los relevamientos y mediciones históricas (`spec.md:537-604`, `assumptions.md`,
    `portal-google-classroom-diseno.md`, los planes viejos). Describen lo que pasó en `~/U.N.L.P` y
    siguen siendo ciertos.

---

## Paso 1 — `Notas/` como destino (D-3)

`core/destino/carpetas.ts`:

1. En `DESTINOS` (`:1-9`), agregar `"Notas"` **al final**, después de `"Bibliografia"`. El orden
   importa: el desplegable del editor sale de este array.
2. En `REGLAS_DESTINO`:
   - agregar como **primera** línea del array
     `{ regex: /^(notas|resultados?)\b/i, destino: "Notas" },`;
   - en la regla de `Parciales` (`:18`), sacar `|notas de evaluaci`. Queda
     `/^(parcial|examen|recuperatorio)/i`.
   - Por qué va primera: `sugerirDestino` usa la primera regla que matchea (`:34-38`). Hoy
     "Notas de evaluaciones" (tema real de G25) matchea `Parciales`.

`core/destino/carpetas.test.ts`:

3. El test de `:5-15` cambia de nombre a `"DESTINOS contiene los 8 destinos canónicos"`, y su array
   esperado suma `"Notas"` al final.
4. Agregar dos tests dentro de `describe("sugerirDestino con temas reales")`:
   - `sugerirDestino("Notas de evaluaciones")` → `{ destino: "Notas", regla: true }`
   - `sugerirDestino("Resultados")` → `{ destino: "Notas", regla: true }`
   - y el de `Parciales-Módulo II` (`:53-58`) **se queda igual**: sigue dando `Parciales`.
5. Agregar un test en `describe("sugerirDestino con títulos de publicación (RN-7a)")`:
   - `sugerirDestino("Unidad 3", ["Notas del parcial", "Resultados finales"])` →
     `{ destino: "Notas", regla: true }`.

`backend/adopcion/generar.js:206`: en el comentario, la lista pasa a
`(uno de DESTINOS: ., Teorias, Practicas, Laboratorios, Parciales, Finales, Bibliografia, Notas)`.

**Control negativo (obligatorio, con la salida pegada en el informe):** con el test nuevo de
"Notas de evaluaciones" ya escrito y `carpetas.ts` **sin** el cambio (`git stash push core/destino/carpetas.ts`),
correr `./node_modules/.bin/vitest run core/destino/carpetas.test.ts`. Tiene que **fallar** en ese
test y en el de `DESTINOS`. Después, `git stash pop`.

## Paso 2 — La raíz por defecto (D-1)

1. Crear `backend/adopcion/raiz.js`:

   ```js
   import path from "node:path";
   import os from "node:os";

   /**
    * Raíz de la facultad (ADR-0018). Desde el 2026-09-26 es la bóveda; ~/U.N.L.P quedó retirado
    * (se conserva como respaldo). El índice .course-downloader.json vive acá y se versiona.
    */
   export const RAIZ_FACULTAD = path.join(os.homedir(), "Boveda", "Areas", "Facultad");
   ```

2. En `aplicar.js:13`, `generar.js:52` y `editor.js:9`, reemplazar
   `path.join(os.homedir(), "U.N.L.P")` por `RAIZ_FACULTAD`, e importarlo desde `./raiz.js`.
   **No** saques el `import os` de ninguno: los tres lo usan para expandir `~` en los argumentos
   (`aplicar.js:20`, `generar.js:62`, `editor.js:21`).
3. Nada más cambia en `editor.js` ni en `server.js`.

## Paso 3 — `aplicar.js` deja de tocar `.gitignore` (D-2)

1. Borrar el bloque `// - Chequeo de UTF-16 en .gitignore` completo (`:98-111`), incluida la
   declaración de `rutaGitignore`.
2. Borrar el bloque `// Actualizar .gitignore si no tiene .course-downloader.json` completo
   (`:489-500`, hasta el `}` que cierra el `else`).
3. Comprobar que `rutaGitignore` no quede usado en ningún lado: `grep -n gitignore backend/adopcion/aplicar.js`
   tiene que dar vacío.

## Paso 4 — La spec (D-1 a D-6)

`docs/specs/classroom-destino/spec.md`. Cada cambio viene con la línea contra la que se contrasta.

1. **Encabezado**: después de la línea `**Fecha**` (`:5`), agregar:
   `**Raíz**: desde el 2026-09-28 es \`~/Boveda/Areas/Facultad\` (ADR-0018). \`~/U.N.L.P\` quedó retirado el 2026-09-26 y se conserva como respaldo. Las menciones a \`~/U.N.L.P\` en §Medición de respaldo y en las preguntas son históricas.`
   - *Contraste*: `~/Boveda/AGENTS.md` §Decisiones de clasificación ("La facultad es un área:
     `Areas/Facultad/<carrera>/<materia>/`").
2. **§Alcance**:
   - `:40` pasa a ``- El índice `~/Boveda/Areas/Facultad/.course-downloader.json` y su ciclo de vida.``
   - `:44` cambia `~/U.N.L.P` por `la raíz`.
   - `:46` pasa a ``- Las notas de la bóveda (las conversiones `.md`, `Wiki/`, `Mis notas/`, `Clases/`): la extensión no las toca.``
   - *Contraste*: `~/.claude/skills/apuntes/SKILL.md` §Estructura, que dice qué carpetas escribe
     cada uno.
3. **RN-1** (`:63`): `La raíz es \`~/U.N.L.P\`` pasa a `La raíz es \`~/Boveda/Areas/Facultad\``.
4. **RN-3** (`:65-67`): la lista de destinos suma `` `Notas/` `` al final. Después de RN-3, agregar:
   - **RN-3a** — Las planillas de notas van a `Notas/`, en la materia y **fuera de `Parciales/`**,
     porque la skill `apuntes` saca de `Parciales/` las preguntas para repasar. El tema que empieza
     con "Notas" o "Resultados" sugiere `Notas/`. Una planilla que llega por Novedades cae en la
     raíz (RN-8) y la mueve el dueño. *(Dueño, 2026-09-28)*.
   - *Contraste*: `~/.claude/skills/apuntes/SKILL.md` §Repasar, paso 2 ("la carpeta la fija
     `AGENTS.md`, hoy `Parciales/`").
5. **RN-17** (en §Nombres): al final, agregar:
   `El \`.md\` nace con el frontmatter de la bóveda: \`tipo: acceso\` y \`revisado: <fecha de descarga>\`. *(Dueño, 2026-09-28)*.`
   - *Contraste*: `~/Boveda/AGENTS.md` §Frontmatter (`tipo` y `revisado`; `proyecto` sólo en notas de
     proyecto). Si para cuando se ejecute bibliotecario ya agregó `acceso` a la lista de tipos,
     citalo; si no, dejalo igual.
6. **RN-19** (`:116`): el paréntesis pasa a
   `(la raíz entera, salvo las carpetas \`Wiki/\`, \`Mis notas/\` y \`Clases/\` en cualquier nivel)`.
   Y la frase final `Las tres carpetas excluidas no guardan adjuntos: el repo, la config del vault y el espejo \`.md\` de los PDF.`
   pasa a `Las carpetas excluidas son de notas, no guardan adjuntos (D-6 de \`docs/plan-classroom-destino-2a-boveda.md\`).`
7. **RN-23** (`:131`) cambia `~/U.N.L.P/.course-downloader.json` por
   `~/Boveda/Areas/Facultad/.course-downloader.json`.
8. **RN-24** (`:133`) se reemplaza entero por:
   `- **RN-24** — El índice **se versiona** con la bóveda, que es un repo privado. Ningún código lo agrega a \`.gitignore\`. *(Dueño, 2026-09-28; ADR-0018 supera el punto 2 de ADR-0017.)*`
9. **§Los accesos `.md`**: después de RN-30, agregar:
   - **RN-29a** — Un acceso cuyo id ya figura en el índice está descargado **siempre**: no se
     vuelve a crear aunque no esté en la ruta anotada ni su md5 aparezca en la raíz. Editarlo,
     moverlo o borrarlo es decisión del dueño. Para que vuelva a crearse, se borra su entrada del
     índice. *(Dueño, 2026-09-28; cierra PA-4.)*
10. **Tabla de decisión** (`:160-168`): agregar una fila entre la `0` y la `1`:
    `| 0b | sí, y es un acceso (\`acceso:…\`) | — | — | **No escribir** (RN-29a). |`
    Después del párrafo "La fila 0 va **antes**…", agregar:
    `La fila 0b va antes que la 2 y la 3 porque un acceso editado tiene otro md5: sin ella, un acceso movido caería en la 3 y se crearía de nuevo.`
11. **§Datos**:
    - el título `:210` pasa a ``### `~/Boveda/Areas/Facultad/.course-downloader.json` ``;
    - en `:252` y `:256`, `Ruta relativa a \`~/U.N.L.P\`` pasa a `Ruta relativa a la raíz`.
12. **AC-5b** (`:404`): la línea `y una copia idéntica que sólo esté en "ObsidianUNLP_Vault/" no cuenta como encontrada`
    pasa a `y una copia idéntica que sólo esté fuera de la raíz (por ejemplo en "~/Boveda/Archivo/") no cuenta como encontrada`.
13. **NFR-2** (`:492-493`) se reemplaza por:
    `- **NFR-2 — El índice viaja con la bóveda.** Se versiona en el repo privado de \`~/Boveda\` (RN-24). La extensión nunca escribe \`.gitignore\`.`
14. **§Dependencias**: la fila de `:509` (`~/U.N.L.P/.gitignore` editable) se reemplaza por:
    `| Raíz en la bóveda | ✅ Adopción aplicada en \`~/Boveda\` \`32136ca\` (295 archivos + índice, 354 entradas) |`
15. **§Supuestos resueltos**, fila 22 (`:521`):
    - la decisión pasa a `Índice único en la raíz, versionado`;
    - el porqué pasa a `El storage muere al reinstalar; los xattr no sobreviven a \`git clone\` ni a \`cp\`. Era gitignoreado mientras la raíz fue \`~/U.N.L.P\` (público); en la bóveda privada se versiona (ADR-0018).`
16. **PA-4** (`:593-597`): al principio, agregar `**✅ DECIDIDO (dueño, 2026-09-28): RN-29a.**`. El
    resto del texto queda como traza.
17. **§Cortes de construcción** (`:563-567`):
    - fila **2a**: `lleva \`verificacion-b\` a \`~/U.N.L.P\`` pasa a
      `lleva \`verificacion-b\` a la raíz (se aplicó en la bóveda, \`32136ca\`)`;
    - fila **2b**: la columna Reglas suma `3a, 17, 29a`.

## Paso 5 — ADR-0018 y los índices de docs

1. Crear `docs/adr/0018-raiz-en-la-boveda-indice-versionado.md` con el formato de 0017
   (encabezado con Fecha, Estado, Contexto previo):
   - **Título**: `# 0018 — La raíz es la bóveda y el índice se versiona`
   - **Fecha**: 2026-09-28. **Estado**: Aceptada. **Supera a**: ADR-0017, puntos 1 (sólo la
     ubicación `~/U.N.L.P`) y 2 (no se versiona).
   - **Contexto**: la fusión de `~/U.N.L.P` en `~/Boveda/Areas/Facultad` (2026-09-26); la bóveda es
     privada; la adopción ya se aplicó ahí (`32136ca`).
   - **Decisión**: (1) la raíz es `~/Boveda/Areas/Facultad`, constante `RAIZ_FACULTAD` en
     `backend/adopcion/raiz.js`; (2) el índice se versiona y nada lo agrega a `.gitignore`; (3)
     el resto de ADR-0017 sigue vigente: claves `<portal>:<id>`, md5, nunca sobrescribir.
   - **Consecuencias**: a favor, el índice queda respaldado con el historial de la bóveda y la
     deduplicación es reproducible en otra máquina. En contra: un `obsidian move` deja
     desactualizada la `ruta` del índice hasta que el corte 2b la corrija por md5 (RN-19); mientras
     tanto, quien mueve actualiza el índice a mano.
2. `docs/adr/0017-indice-de-destino-en-la-raiz.md`: **sólo** la línea `**Estado**` pasa a
   `**Estado**: Aceptada — puntos 1 (ubicación) y 2 superados por [0018](0018-raiz-en-la-boveda-indice-versionado.md)`.
   Nada más de ese archivo se edita. La regla está en `docs/adr/README.md` ("Superación, no edición").
3. `docs/adr/README.md`:
   - la fila de 0017 pasa a estado `Aceptada (1 y 2 superados por 0018)`;
   - se agrega la fila `| [0018](0018-raiz-en-la-boveda-indice-versionado.md) | La raíz es la bóveda y el índice se versiona | Aceptada |`.
4. `docs/deployment.md:42`: el fragmento ``lee `~/Descargas/adopcion-classroom` y `~/U.N.L.P` fijos``
   pasa a ``lee `~/Descargas/adopcion-classroom` y `~/Boveda/Areas/Facultad` (`RAIZ_FACULTAD`, `backend/adopcion/raiz.js`) fijos``.
5. `docs/testing.md` §Baseline: `pnpm test` pasa al número que dé la compuerta. Tanda espera
   **50 archivos / 862 tests**: 859 más 3 tests nuevos (Paso 1: dos en temas reales y uno en publicaciones). Agregá el párrafo "De dónde sale"
   con el mismo formato que el de 837.
6. `docs/ramas-en-revision.md`, en el bloque de `classroom-destino-adopcion`:
   - la primera línea (`:19`) pasa a
     ``Corte 2a del destino de Google Classroom. La raíz es `~/Boveda/Areas/Facultad` (ADR-0018); la adopción se aplicó ahí (`32136ca` de la bóveda).``;
   - suma `- **Plan de la bóveda**: \`docs/plan-classroom-destino-2a-boveda.md\`.` y el ADR 0018.
   - La checklist A-1..A-4 no se toca: es historia de `~/U.N.L.P`.

---

## Qué NO hace este plan

- No corre `aplicar.js --escribir` ni `generar.js`. `generar.js` pisa los TSV reales de
  `~/Descargas/adopcion-classroom`.
- No escribe nada en `~/Boveda` ni en `~/U.N.L.P`.
- No construye nada del corte 2b (la extensión que baja a la bóveda). Eso es el próximo plan.
- No toca `editor.html` ni `server.js`.

## Verificación literal

Pegá la salida de cada bloque en el informe, no la describas. **Corré el bloque entero con `bash`** (`bash -c '…'` o un heredoc): usa `$!` y `$(…)`, y el shell interactivo del equipo no es bash.

```bash
cd ~/Dev/courseDownloader
T=$(mktemp -d)
# (a) compuerta
pnpm test 2>&1 | tail -4            # 50 archivos, 862 tests (ver Paso 5.5)
pnpm run lint 2>&1 | tail -3        # 0 errores, 0 warnings
pnpm exec tsc --noEmit; echo tsc=$? # tsc=0
pnpm run build 2>&1 | tail -2

# (b) no queda ~/U.N.L.P en código ni gitignore en aplicar
git grep -n "U\.N\.L\.P" -- backend core; echo "unlp_codigo=$?"          # unlp_codigo=1 (sin coincidencias)
grep -n gitignore backend/adopcion/aplicar.js; echo "gitignore=$?"      # gitignore=1
git grep -n "RAIZ_FACULTAD" -- backend | wc -l                          # 7 (1 export + 3 imports + 3 usos)

# (c) la raíz por defecto es la bóveda, y aplicar no escribe nada en ella
S0=$(git -C ~/Boveda status --porcelain | sha256sum)
bun backend/adopcion/aplicar.js > $T/aplicar.txt 2>&1; echo "rc=$?"
grep -E "^Raíz:|El índice .* ya existe" $T/aplicar.txt
#   rc=1
#   Raíz: /home/jcrod/Boveda/Areas/Facultad
#     - El índice /home/jcrod/Boveda/Areas/Facultad/.course-downloader.json ya existe. …
#   (tanda lo corrió con --raiz explícita antes de entregar: rc=1, esas dos líneas, bóveda intacta.
#    Además salen 13 líneas "Información: … pasa a 'ya-esta'": son esperables, el patrón las excluye.)
S1=$(git -C ~/Boveda status --porcelain | sha256sum); [ "$S0" = "$S1" ] && echo "boveda intacta"
test ! -e ~/Boveda/Areas/Facultad/.course-downloader.json.tmp && echo "sin tmp"

# (d) el editor sirve Notas en el desplegable (modo suelto 3002, sólo lectura)
bun backend/adopcion/editor.js --puerto 3002 & P=$!; sleep 1
curl -s 127.0.0.1:3002/api/datos | python3 -c "import json,sys; print(json.load(sys.stdin)['destinos'])"
kill $P
#   ['.', 'Teorias', 'Practicas', 'Laboratorios', 'Parciales', 'Finales', 'Bibliografia', 'Notas']

# (e) la spec ya no dice gitignore ni ObsidianUNLP en reglas vivas
grep -n "RN-24\|NFR-2\|RN-29a\|RN-3a\|0b |" docs/specs/classroom-destino/spec.md
grep -c "ObsidianUNLP_Vault" docs/specs/classroom-destino/spec.md       # 0
```

Notas para (d): si la ruta de la API del editor no es `/api/datos`, tomala de `editor.js` (la que
arma `destinos: DESTINOS` en `:172`) y decilo en el informe. Si el puerto 3002 está ocupado, usá
otro y decilo.

## Informe

- La salida literal de (a) a (e) y del control negativo del Paso 1.
- **Hallazgos**: todo lo que viste y no hiciste porque el plan no lo nombraba.
