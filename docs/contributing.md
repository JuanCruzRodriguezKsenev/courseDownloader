# Contribuir

Configuración de entorno local y flujo de trabajo para desarrollar sobre esta extensión.

## Requisitos

- Chrome o Brave con "Modo de desarrollador" habilitable en `chrome://extensions/`.
- El backend local en Bun (`ramonnet-bun-backend`, repo separado) corriendo en `http://localhost:3001` para poder probar descargas de punta a punta — ver `docs/deployment.md`.
- No hace falta Node.js para trabajar en este repo hoy (no hay build step). Sí va a hacer falta una vez que se implemente `docs/testing.md` (Vitest) o `docs/ROADMAP.md` Fase 5 (`// @ts-check`).

## Cargar la extensión en modo desarrollo

1. `chrome://extensions/` → activar "Modo de desarrollador" (esquina superior derecha).
2. "Cargar descomprimida" → seleccionar la carpeta raíz de este repo.
3. Después de **cualquier** cambio de código, hacer clic en el ícono de recarga de la tarjeta de la extensión — ni el popup ni el service worker tienen hot-reload.

## Debuggear

- **Popup**: clic derecho sobre el ícono de la extensión → "Inspeccionar popup" (o abrirlo y F12) para DevTools de `popup.js`/`popup/scraper.js`.
- **Service worker**: en `chrome://extensions/`, clic en "service worker" bajo la tarjeta de la extensión, para DevTools de `background.js`/`background/hlsEngine.js`.

## Flujo de git

- Rama principal: `main`.
- No hay checks de CI configurados todavía. Hasta que existan, la responsabilidad de no romper nada recae en probar manualmente el flujo afectado antes de mergear (ver "probar el golden path" más abajo).

### Checklist antes de abrir un PR

Este proyecto trata la documentación con la misma disciplina que el código — **un doc que miente es peor que no tener doc**. Si tu cambio afecta el modelo de storage, la arquitectura de mensajería IPC, o la lógica de negocio (parsing de títulos, clasificación de cátedra, flujo de descarga), la documentación correspondiente se actualiza **en la misma rama y el mismo PR** — no se abren tareas de seguimiento para eso.

- [ ] Si cambiaste una clave de `chrome.storage` o la forma de un objeto persistido → actualizaste `docs/data-model.md`.
- [ ] Si cambiaste cómo se comunican popup/SW/offscreen, o agregaste una acción IPC nueva → actualizaste `docs/architecture.md` y/o `docs/patterns.md`.
- [ ] Si tomaste una decisión de arquitectura significativa (nueva dependencia, nuevo patrón, reemplazo de uno existente) → agregaste un ADR nuevo en `docs/adr/` (nunca edites uno existente — ver `docs/adr/README.md`).
- [ ] Si tu cambio toca código de manejo de contenido scrapeado o de terceros → revisaste `docs/security.md`.
- [ ] Si resolviste un ítem de `docs/TECHNICAL_DEBT.md` → lo marcaste como resuelto ahí.
- [ ] Probaste el flujo afectado end-to-end en el navegador (con el backend Bun corriendo si tocaste algo de descarga) — ver `docs/testing.md`.

## Probar el "golden path" antes de dar por terminado un cambio

1. Levantar el backend Bun (`iniciar.bat`, ver `docs/deployment.md`).
2. Cargar/recargar la extensión.
3. Entrar a `plataforma.ramonnet.com.ar/usuario/clases-grabadas`, revelar algunas clases.
4. Abrir el popup, confirmar que aparecen en "Clases Disponibles".
5. Seleccionar 1-2 clases, agregarlas a la fila, iniciar la descarga.
6. Confirmar que el progreso se refleja en el popup y que el archivo aparece en disco al terminar.

Si el cambio no toca el flujo de descarga (ej. solo onboarding o filtros), alcanza con probar esa feature puntual — no hace falta correr el golden path completo.
