# Estándar de código

Convenciones observadas y a mantener en este repositorio. No hay linter configurado todavía que las haga cumplir automáticamente (ver `docs/ROADMAP.md`, Fase 4) — por ahora dependen de revisión manual.

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

## Sin framework, sin bundler — module pattern por objeto global

No hay `import`/`export` de ES modules. Cada archivo define un objeto (`AppState`, `Utils`, `BunClient`, `HlsEngine`, `Renderers`, `Scraper`) y lo expone condicionalmente según el contexto:

```js
if (typeof window !== "undefined") {
  window.NombreDelModulo = NombreDelModulo;
} else {
  self.NombreDelModulo = NombreDelModulo;
}
```

Esto es necesario porque el mismo archivo (`shared/*.js`) se carga tanto en el popup (contexto `window`) como en el service worker (contexto `self`, sin `window`). **Regla**: todo módulo nuevo en `shared/` debe seguir este mismo patrón de exportación dual si va a usarse desde ambos contextos.

## Orden de carga de scripts

`popup.html` carga los `<script>` en un orden de dependencia explícito (shared → renderers/scraper → popup.js). `background.js` usa `importScripts('shared/utils.js', 'shared/bunClient.js', 'background/hlsEngine.js')` al inicio del archivo. **Regla**: cualquier archivo nuevo debe agregarse en el punto correcto de esa cadena — si depende de `Utils`, va después de `shared/utils.js`; si `Utils` va a depender de él, va antes.

## Manejo de errores

- Los errores esperables de red usan `Utils.fetchConReintentos` (retry con backoff) en vez de un `fetch` directo — ver `docs/patterns.md`.
- Los errores de `chrome.storage`/`chrome.runtime` se chequean explícitamente vía `chrome.runtime.lastError` dentro del callback, no vía try/catch (es el patrón que exige la API de callbacks de `chrome.*`) — ver `shared/state.js:66-68` como referencia.
- `catch (e) {}` completamente silenciosos deben evitarse — como mínimo, un `console.warn` con el mensaje del error. Ver el ítem correspondiente en `docs/TECHNICAL_DEBT.md` para los casos existentes que todavía no siguen esta regla.

## Seguridad al pintar contenido de terceros en el DOM

Los títulos de clase y cualquier otro texto scrapeado de Ramón Net **no son confiables** — deben pintarse con `.textContent`/`.innerText`, nunca interpolados en un string que se asigna a `.innerHTML`. Ver `docs/security.md` para el detalle y el caso conocido donde esto se violó (`docs/TECHNICAL_DEBT.md`).

## Nomenclatura de commits

No hay convención formal de commits configurada (sin `commitlint`). Revisar el historial de git (`git log`) antes de escribir un mensaje nuevo, para mantener consistencia con el tono existente.
