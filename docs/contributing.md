# Contribuir

Configuración de entorno local y flujo de trabajo para desarrollar sobre esta extensión.

## Requisitos

- Chrome o Brave con "Modo de desarrollador" habilitable en `chrome://extensions/`.
- El backend local en Bun (`ramonnet-bun-backend`, repo separado) corriendo en `http://localhost:3001` para poder probar descargas de punta a punta — ver `docs/deployment.md`.
- **Node.js es obligatorio**: desde la Fase 3 de la re-arquitectura la extensión se **compila** (WXT). Ya no se carga la raíz del repo — el navegador lee `.output/chrome-mv3/`, que produce `npm run build`. Node también corre la suite (`npm test`, Vitest + jsdom) y el linter (`npm run lint`).

## Cargar la extensión en modo desarrollo

1. `npm install` (la primera vez; el `postinstall` corre `wxt prepare` y genera `.wxt/`).
2. `npm run build` → genera `.output/chrome-mv3/`.
3. `chrome://extensions/` → activar "Modo de desarrollador" (esquina superior derecha).
4. "Cargar descomprimida" → seleccionar **`.output/chrome-mv3/`**, NO la raíz del repo.
5. Después de cada cambio: `npm run build` + clic en el ícono de recarga de la tarjeta.

Alternativa con recarga automática: `npm run dev` levanta WXT en modo desarrollo (HMR del
popup y recarga del service worker). Los comandos vienen de `wxt.config.ts`; el `manifest.json`
ya no se escribe a mano — lo genera el build.

## Debuggear

- **Popup**: clic derecho sobre el ícono de la extensión → "Inspeccionar popup" (o abrirlo y F12) para DevTools de `popup.js`/`sitio/ramonnet/scraper.js`.
- **Service worker**: en `chrome://extensions/`, clic en "service worker" bajo la tarjeta de la extensión, para DevTools de `background.js`/`background/hlsEngine.js`.

## Flujo de git

- Rama principal: `main`.
- No hay checks de CI configurados todavía. Hasta que existan, la responsabilidad de no romper nada recae en probar manualmente el flujo afectado antes de mergear (ver "probar el golden path" más abajo).

### Regla DRY: cada dato vive en un solo doc

La documentación sigue el mismo principio de *single source of truth* que el código: **cada concepto tiene un doc canónico** que lo explica completo (con su por qué), y cualquier otra mención lo **cita con link** en vez de re-explicarlo. Duplicar una explicación garantiza que tarde o temprano las copias se desincronicen. La decisión y su rationale están en `docs/adr/0007-dry-docs-canonical-homes.md`; esta sección es la guía accionable. Hogares canónicos:

- Schema de `chrome.storage` e invariantes de estado → `docs/data-model.md`.
- Patrones (IPC, split de ownership, daemon `Conexion`, circuit breaker, worker pool, parsing de títulos) → `docs/patterns.md`.
- Elección de tecnologías y Turbo Mode → `docs/tech-stack.md`.
- Política de seguridad (regla XSS, permisos) → `docs/security.md`.
- Estado de la migración a islas Preact → `docs/preact-migration.md`.
- Qué contiene cada archivo/módulo y qué regla respeta al tocarlo → `docs/architecture.md` §Qué hace cada archivo. `CLAUDE.md` guarda **sólo** el resumen de reglas que se pueden violar sin leer los docs, y apunta acá.
- Baseline de las 4 verificaciones (cantidad de tests, warnings tolerados) y narrativa de cobertura → `docs/testing.md` §Baseline de las verificaciones. Ningún otro doc repite esos números.
- Estado de la re-arquitectura por fases, qué sigue y con qué riesgo → `docs/rearquitectura-diseno.md`. Es también el hogar de la *historia* de cada corte: qué se migró cuándo y por qué un archivo sigue donde está.

Un overview que orienta y apunta (una frase + link) **no** es duplicación; re-especificar el mismo mecanismo/valores/rationale en dos lugares **sí** lo es. Si al escribir un doc te encontrás re-explicando algo que ya vive en otro, dejá el resumen y linkéalo.

### Checklist antes de abrir un PR

Este proyecto trata la documentación con la misma disciplina que el código — **un doc que miente es peor que no tener doc**. Si tu cambio afecta el modelo de storage, la arquitectura de mensajería IPC, o la lógica de negocio (parsing de títulos, clasificación de cátedra, flujo de descarga), la documentación correspondiente se actualiza **en la misma rama y el mismo PR** — no se abren tareas de seguimiento para eso.

- [ ] Si cambiaste una clave de `chrome.storage` o la forma de un objeto persistido → actualizaste `docs/data-model.md`.
- [ ] Si cambiaste cómo se comunican popup/SW/offscreen, o agregaste una acción IPC nueva → actualizaste `docs/architecture.md` y/o `docs/patterns.md`.
- [ ] Si tomaste una decisión de arquitectura significativa (nueva dependencia, nuevo patrón, reemplazo de uno existente) → agregaste un ADR nuevo en `docs/adr/` (nunca edites uno existente — ver `docs/adr/README.md`).
- [ ] Si tu cambio toca código de manejo de contenido scrapeado o de terceros → revisaste `docs/security.md`.
- [ ] Si agregaste o cambiaste una isla Preact del popup → actualizaste la tabla de estado en `docs/preact-migration.md`.
- [ ] Si agregaste un módulo, una feature o un puerto (o le cambiaste la responsabilidad a uno) → lo reflejaste en `docs/architecture.md` §Qué hace cada archivo.
- [ ] Si resolviste un ítem de `docs/TECHNICAL_DEBT.md` → lo marcaste como resuelto ahí.
- [ ] Corriste `npm test` (sin regresiones) y `npm run lint` (0 errores) sobre el cambio.
- [ ] Probaste el flujo afectado end-to-end en el navegador (con el backend Bun corriendo si tocaste algo de descarga) — ver `docs/testing.md`.

## Probar el "golden path" antes de dar por terminado un cambio

1. Levantar el backend Bun (`iniciar.bat`, ver `docs/deployment.md`).
2. Cargar/recargar la extensión.
3. Entrar a `plataforma.ramonnet.com.ar/usuario/clases-grabadas`, revelar algunas clases.
4. Abrir el popup, confirmar que aparecen en "Clases Disponibles".
5. Seleccionar 1-2 clases, agregarlas a la fila, iniciar la descarga.
6. Confirmar que el progreso se refleja en el popup y que el archivo aparece en disco al terminar.

Si el cambio no toca el flujo de descarga (ej. solo onboarding o filtros), alcanza con probar esa feature puntual — no hace falta correr el golden path completo.
