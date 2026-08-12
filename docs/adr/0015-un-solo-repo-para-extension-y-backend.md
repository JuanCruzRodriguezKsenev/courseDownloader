# 0015 — La extensión y su backend viven en un solo repo

**Fecha**: 2026-08-12
**Estado**: Aceptada
**Contexto previo**: [ADR-0008](0008-arquitectura-nucleo-adaptadores.md) (núcleo y adaptadores; el
backend Bun es el otro lado del puerto de escritura a disco).
**Diseño de ejecución**: `docs/fusion-monorepo-diseno.md`.

## Contexto

La extensión y el backend Bun **son un solo producto partido en dos procesos**: sin el servidor
corriendo, ninguna descarga real funciona (Turbo Mode está forzado a `true` desde siempre — ver
`docs/tech-stack.md`). Se comunican por un contrato HTTP en loopback, documentado en
`docs/deployment.md` §Contrato de endpoints.

Hasta hoy vivían en **dos repos separados**, y ese contrato no tenía nada que lo mantuviera
sincronizado más que la memoria de quien lo tocara.

El caso que lo demostró es del 2026-08-07, con los PDF adjuntos: el nombre del archivo pasó a
mandarlo la extensión por el header `x-file-name`, y eso se implementó con **dos commits en dos
repos, sin ningún vínculo entre ellos** — `a91ffe7` del lado de la extensión, `8797ec6` + `79726a9`
del lado del backend.

**El modo de fallar de esa desincronización es el peor que tiene este proyecto: silencioso.** Una
extensión nueva contra un backend viejo no tira ningún error — descarga el PDF y lo guarda como
`Atlas.pdf.mp4`. Lo único que protegía contra eso era una advertencia en prosa, en el banner de
`CLAUDE.md` y en el `README`, que cada sesión futura tenía que acordarse de leer.

Dos hechos secundarios pesaron en el momento de decidirlo:

- **El backend no tenía remoto**: `git remote -v` salía vacío. Sus 4 commits existían sólo en el
  disco de una PC, sin ninguna copia.
- Levantar el proyecto en otra máquina pedía clonar un repo **y copiar una carpeta a mano**, con el
  riesgo de copiar una versión vieja y volver a caer en el `Atlas.pdf.mp4`.

## Decisión

**El backend Bun pasa a vivir en `backend/`, dentro del repo de la extensión**, con su historia
completa (`git subtree add`, no una copia).

Consecuencia buscada, y es la única que justifica el cambio: **un cambio de contrato es ahora un
solo commit atómico**. La regla "backend y extensión se actualizan juntos" deja de ser una
advertencia que hay que leer y pasa a ser una propiedad estructural del repo.

Tres cosas que la decisión **no** hace:

1. **No mezcla los runtimes.** El backend sigue siendo un proceso aparte, corriendo en Bun, que se
   arranca con su propio `iniciar.bat` y escucha en `127.0.0.1:3001`. No comparte una línea de
   código con la extensión: el único acoplamiento sigue siendo el contrato HTTP. Se aísla con su
   propio `backend/package.json` (`"type": "module"`), porque el `package.json` raíz no declara
   `type` y el backend es ESM.
2. **No mueve la extensión.** Se evaluó `extension/` + `backend/` como hermanas y se descartó:
   obligaba a tocar `srcDir`, el `tsconfig`, el `eslint.config.js` y todas las rutas de todos los
   docs, sin ninguna ganancia sobre meter una carpeta hermana.
3. **No toca los datos.** El id `"ramonnet"` del portal, `SITIO_LEGADO` y `sitio/ramonnet/` siguen
   igual: son el nombre de una carpeta en disco y la mitad de la identidad de cada clase, no marca.

## Consecuencias

- **A favor**: el contrato se mueve atómicamente; el backend gana un remoto y con él una copia
  fuera de esa PC; la puesta en marcha en otra máquina es una sola clonada; y el backend entra
  **bajo el lint del repo**, que es cobertura que nunca tuvo (destapó 16 errores y 7 warnings el
  primer día, todos de higiene, ninguno de comportamiento).
- **En contra**: la raíz del repo suma una carpeta, y `srcDir: '.'` hace que la raíz *sea* el
  directorio de fuentes de WXT — o sea que **hay que verificar que el bundler no empaquete
  `backend/`**. Se verificó: el build emite exactamente los mismos 13 archivos y los mismos
  222.51 kB que antes de la fusión.
- **Deja de tener sentido**: la advertencia del banner de `CLAUDE.md` sobre "el otro repo que va
  con éste" y su equivalente en el `README`. Se borran en el mismo cambio; ése era el punto.

## Alternativas descartadas

- **Dejarlos separados y crearle un repo propio al backend.** Resolvía la falta de copia, pero no
  el problema real: el contrato seguía pudiendo desincronizarse, que es lo que ya rompió una vez.
- **Un submódulo de git.** Ata las versiones, sí, pero paga con un flujo que hay que recordar
  (`--recurse-submodules`, el puntero que queda desactualizado) para un backend de 8 archivos que
  nunca se va a consumir desde otro proyecto. Toda la complejidad, poco del beneficio.
- **Publicar el backend como paquete versionado.** Overkill absoluto para un consumidor único que
  además es personal (`CLAUDE.md`: esta extensión no se publica nunca).

## La lección, que se repite

Es la misma forma que ADR-0014 y que el relevamiento de `copy-generico-diseno.md`: **un supuesto
que era verdad cuando había uno solo**. Acá el supuesto era "el backend y la extensión los toca la
misma persona, en la misma sesión, y se va a acordar". Aguantó hasta que un cambio de contrato se
partió en dos repos y el fallo salió mudo.

Cuando dos piezas tienen que moverse juntas y nada estructural las obliga, **lo que las mantiene
sincronizadas es la memoria — y la memoria es exactamente lo que este proyecto ya aprendió a no
usar como mecanismo.**
