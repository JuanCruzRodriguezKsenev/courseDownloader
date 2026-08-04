# Stack tecnológico y justificación

Qué se usa, por qué, y qué alternativas se consideraron y se descartaron. Para el razonamiento completo y formal de cada decisión de arquitectura, ver `docs/adr/`.

## Resumen

| Capa | Tecnología | Alternativas descartadas |
|---|---|---|
| Extensión (popup + SW) | JS + TypeScript (migración incremental), islas Preact en el popup | React/Vue/Svelte, Astro |
| Empaquetado | **WXT** (Vite) → `.output/chrome-mv3/`; el manifest lo genera `wxt.config.ts` | Vite + CRXJS, Plasmo, ninguno |
| Descarga/streaming | `fetch` + WebCrypto (`crypto.subtle`) nativos del navegador | librería HLS.js (descartada — no la necesitás para descargar+desencriptar, solo para reproducir) |
| Persistencia local (extensión) | `chrome.storage.local` + `chrome.storage.session` | IndexedDB (más potente pero innecesario para el volumen de datos que maneja esta extensión) |
| Escritura de video a disco | Backend local en Bun (`ramonnet-bun-backend`, repo separado) vía streaming HTTP | `chrome.downloads` + blob en memoria (ver Turbo Mode más abajo) |
| Testing (ver `docs/testing.md`) | Vitest + jsdom (el tamaño de la suite vive en la tabla de baseline de `docs/testing.md`, hogar canónico — acá no se copia) | Jest (Vitest es más rápido y no requiere config de Babel/TS aparte) |

> **Actualizado el 2026-08-02**: las dos primeras filas cambiaron. La sección de abajo
> ("Por qué JS vanilla sin bundler") se conserva como **registro histórico** del
> razonamiento que valió hasta la Fase 3 — no describe el estado actual. Lo que cambió el
> balance no fue que aquellos argumentos fueran malos, sino la re-arquitectura: la
> conversión de globales a módulos ES había que hacerla igual para los puertos, así que el
> bundler dejó de ser costo puro. Ver ADR-0008 (supersede a ADR-0001) y
> `docs/rearquitectura-diseno.md`.

## Por qué JS vanilla sin bundler (histórico — vigente hasta la Fase 3)

La extensión son ~6000 líneas repartidas en ~40 archivos de producción (sin contar tests ni el vendor de Preact). **Este párrafo describía el mundo pre-build y quedó obsoleto en la Fase 3**: ya no hay `<script>` en orden ni `importScripts`, el manifest se genera desde `wxt.config.ts` y los dos entrypoints (`entrypoints/popup/main.js`, `entrypoints/background.js`) declaran el grafo con imports ES que el bundler resuelve. Lo que sigue valiendo del argumento original: no hay JSX, no hay CSS-in-JS, y a este tamaño el tree-shaking no mueve la aguja.

Agregar un framework de UI (React/Vue/Svelte) o un bundler (Vite) tendría costo real — reescribir el manifest, convertir el patrón de variables globales (`window.AppState`, `self.HlsEngine`) a módulos ES, mantener un `node_modules` — sin resolver ningún problema actual del proyecto. Ver `docs/adr/0001-no-bundler-or-typescript-yet.md` y `docs/adr/0002-reject-astro.md`.

**Cuándo reconsiderar**: si el proyecto crece a un tamaño donde el acoplamiento entre archivos vía variables globales se vuelve inmanejable, o si se suma más de un desarrollador activo.

**Actualización (Preact sin build, ADR-0006)**: cuando se escribió, el párrafo de arriba seguía vigente para el *bundler* — no lo había. Pero sí se adoptó **Preact + htm** para la UI del popup, vendorizado como un único ES module local (`popup/vendor/htm-preact-standalone.module.js`) cargado con `<script type="module">`. `htm` da sintaxis tipo-JSX que se parsea en runtime, así que **no hay paso de build ni transpilación** — se respeta el "cargá la carpeta y andá". Es la única dependencia de runtime, acotada al popup (el SW sigue vanilla), y se migra por islas incrementales. Ver `docs/adr/0006-adopt-preact-islands-in-popup.md`.

## Por qué Bun como backend, y no todo en el navegador (Turbo Mode)

El código tiene dos paths de escritura a disco:

1. **Turbo Mode** (activo siempre — `modoTurboBun` está hardcodeado a `true`): cada fragmento descifrado se envía en streaming al backend Bun (`BunClient.enviarFragmentoStream`), que lo escribe directo al filesystem. La extensión nunca retiene el video completo en memoria — el consumo de RAM se mantiene bajo (según el README, <15 MB) sin importar el tamaño del archivo final.
2. **Legacy non-Turbo** (código muerto en la práctica — `establecerModoTurbo` fuerza `true` siempre): ensambla todos los fragmentos en un `Blob` en memoria y usa `chrome.downloads.download()` con un Object URL generado vía un documento offscreen (porque los service workers no tienen `URL.createObjectURL`). Este path existe en `plataforma/chrome/descargas.ts` (donde quedó al repartirse `shared/utils.js` en la Fase 6a) y en `background.js`, pero no se ejecuta.

La razón de fondo para depender de un backend local: `chrome.downloads` por sí solo no permite streaming incremental a disco sin acumular el archivo completo en memoria del navegador primero — para videos largos eso es un riesgo de OOM que Turbo Mode evita por diseño.

## Por qué WebCrypto nativo para AES-128-CBC

Los fragmentos `.ts` de HLS vienen cifrados con AES-128 (estándar del protocolo). `crypto.subtle.decrypt` (WebCrypto API, disponible tanto en `window` como en el contexto del service worker) resuelve esto sin ninguna dependencia externa — no hay necesidad de una librería de criptografía en JS puro.

## Qué se evaluó y se descartó explícitamente

Ver `docs/adr/` para el razonamiento completo de cada uno:

- **TypeScript + bundler** — ~~diferido~~ **adoptado** (ADR-0008 + Fases 3-4): WXT empaqueta y el núcleo se migra a TS de a un módulo por vez.
- **Astro** — rechazado, mismatch de propósito (`0002`).
- **Circuit Breaker formal / Idempotency Service centralizado** — diferido, ya hay una versión ad-hoc suficiente (`0003`).
- **Result Pattern (`Result<T,E>`)** — diferido hasta tener TypeScript, pierde su valor en JS plano (`0004`).
