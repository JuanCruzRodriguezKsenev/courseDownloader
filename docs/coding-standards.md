# Estándar de código

Convenciones observadas y a mantener en este repositorio. Hay un ESLint (flat config, `eslint.config.js`) que hace cumplir automáticamente un subconjunto (`no-undef`, `no-unused-vars`, `eqeqeq`) vía `npm run lint`; el resto de las convenciones de este documento dependen de revisión manual.

## Idioma: identificadores y logs en español

Nombres de variables, funciones, comentarios y mensajes de `console.log`/`console.warn`/`console.error` están en español, siguiendo el idioma de la plataforma objetivo (Ramón Net) y de sus usuarios. Ejemplos de vocabulario ya establecido:

| Término | Significado |
|---|---|
| `ráfaga` / `rafaga` | Corrida de descarga activa (burst) |
| `cola` | Cola de descarga |
| `cátedra` | Sección/comisión de la materia (A–D) |
| `frenado suave` | Pausa que espera a que termine el ítem actual antes de detenerse |
| `sincronización` | Reconciliación de estado entre popup y service worker |

**Regla**: código nuevo debe seguir esta convención. No mezclar inglés y español dentro del mismo módulo — si un archivo ya está en español (todos lo están hoy), las funciones/variables nuevas van en español también.

## Headers de versión por archivo

La mayoría de los archivos tienen un comentario de banner al inicio con número de versión y un changelog de los últimos cambios relevantes:

```js
/**
 * CLON DOWNLOADHELPER - <NOMBRE DEL MÓDULO> (V5.6.0)
 * <descripción breve>
 * ==============================================================================================
 * CHANGELOG v5.6.0:
 * - [FIX CRÍTICO] <qué se arregló y por qué>
 * ==============================================================================================
 */
```

**Regla**: al hacer un cambio de comportamiento no trivial en un archivo que ya tiene este banner, bumpear la versión y agregar una línea de changelog describiendo el fix — no dejar el cambio sin documentar en el propio archivo. Para cambios triviales (typos, formato) no hace falta.

## Módulos ES + global publicado como side-effect

Desde la Fase 3 (empaquetado con WXT) **todo el código de la extensión son módulos ES**:
el bundler arma el grafo desde los entrypoints. Pero los consumidores siguen leyendo los
objetos como globals, así que cada módulo hace las dos cosas:

```js
// Exportación (ver docs/coding-standards.md). Sigue publicando el global porque el
// resto del código vanilla lo consume sin importar; el `export` es lo que permite que
// el bundler arme el grafo de dependencias y que Vitest importe el módulo.
globalThis.NombreDelModulo = NombreDelModulo;
export default NombreDelModulo;
```

**Por qué las dos y no sólo el import**: convertir los ~200 call-sites que hoy escriben
`Utils.x` / `BunClient.y` a imports explícitos es un refactor transversal que merece su
propio paso; publicar el global mantiene a todos esos call-sites funcionando sin tocarlos.
El `export` es lo que hace que el módulo exista para el bundler y para los tests.

**Regla**: un módulo nuevo lleva ese footer. Si el archivo es de un contexto único (una
isla Preact, un entrypoint), alcanza con el `export` — el global es sólo para lo que se
consume desde otros archivos sin importarlo.

**Orden de evaluación**: como nadie importa a nadie explícitamente, el orden lo fija el
entrypoint (`entrypoints/popup/main.js`, `entrypoints/background.js`), que importa los
módulos en la secuencia correcta. **Un módulo nuevo que otros consuman hay que agregarlo
ahí, en el punto correcto de la cadena** — si no, su global no existe cuando lo buscan.

**TypeScript**: el núcleo migrado (`core/`) ya está en `.ts` con el mismo footer
(`(globalThis as Record<string, unknown>).X = X; export default X`). La migración es
incremental — ver `docs/rearquitectura-diseno.md`.

## Orden de carga de scripts

Los dos entrypoints (`entrypoints/popup/main.js` y `entrypoints/background.js`) importan los módulos en un orden de dependencia explícito: adaptador de sitio → núcleo compartido → features → orquestador → islas Preact. **Regla**: cualquier archivo nuevo debe agregarse en el punto correcto de esa cadena — si depende de `Utils`, va después de `shared/utils.js`; si `Utils` va a depender de él, va antes.

## Manejo de errores

- Los errores esperables de red usan `Utils.fetchConReintentos` (retry con backoff) en vez de un `fetch` directo — ver `docs/patterns.md`.
- Los errores de `chrome.storage`/`chrome.runtime` se chequean explícitamente vía `chrome.runtime.lastError` dentro del callback, no vía try/catch (es el patrón que exige la API de callbacks de `chrome.*`) — ver `shared/state.js:66-68` como referencia.
- `catch (e) {}` completamente silenciosos deben evitarse — como mínimo, un `console.warn` con el mensaje del error. Los 3 casos que había se resolvieron (ver `docs/TECHNICAL_DEBT.md`, sección Resuelto); mantené la regla en código nuevo.

## CSS: los colores viven sólo en `styles/variables.css`

**Regla: ninguna hoja de componente (ni ningún `.style.color = "..."` en JS) contiene un color literal.** Si falta un color, se agrega como token en `styles/variables.css` y se consume con `var(--token)`. El objetivo es que cambiar la paleta —re-brandear la extensión para otro portal— sea editar **un** archivo, no rastrear literales por 13 hojas.

Para colores translúcidos no alcanza el token de color ya resuelto (`#FF3B30` no se puede meter dentro de `rgba()`), así que existen los **canales RGB**: `--accent-orange-rgb`, `--accent-error-rgb`, `--accent-green-rgb`, `--shadow-rgb`, `--shine-rgb`. Se usan así:

```css
border-color: rgba(var(--accent-error-rgb), 0.2);
box-shadow: 0 4px 16px rgba(var(--shadow-rgb), 0.12);
```

Cada canal está pareado con su token de color y el comentario en `variables.css` lo indica; si cambiás uno, cambiá el otro. La ausencia de esta regla es cómo se colaron un naranja (`255,107,0`) y un rojo (`220,53,69`) que **no** eran los de la marca, invisibles en revisión pero visibles al cambiar la paleta.

De la **geometría** de las sombras sólo se tokeniza la que comparten varios componentes (`--shadow-bar`, `--shadow-modal`); el resto queda en su hoja, porque es layout, no marca. Lo global es el tinte (`--shadow-rgb`).

Chequeo rápido antes de un PR que toque estilos:

```bash
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\([0-9]' styles/ --include=*.css | grep -v variables.css   # debe estar vacío
```

## Seguridad al pintar contenido de terceros en el DOM

Los títulos de clase y cualquier otro texto scrapeado de Ramón Net **no son confiables** — deben pintarse con `.textContent`/`.innerText`, nunca interpolados en un string que se asigna a `.innerHTML`. Ver `docs/security.md` para el detalle y el caso conocido donde esto se violó (`docs/TECHNICAL_DEBT.md`).

## Nomenclatura de commits

No hay convención formal de commits configurada (sin `commitlint`). Revisar el historial de git (`git log`) antes de escribir un mensaje nuevo, para mantener consistencia con el tono existente.
