# Distribución / "deployment"

Esta extensión no tiene un pipeline de CI/CD ni un entorno de "producción" en el sentido tradicional — se distribuye como carga manual sin empaquetar (modo desarrollador), y depende de un proceso local (el backend Bun) corriendo en la máquina del usuario final. Este documento cubre ambas piezas.

## La extensión (Chrome/Brave)

**Estado actual**: distribución manual vía "Cargar descomprimida" (`chrome://extensions/`) — ver el paso a paso en el `README.md` raíz (esa sección sí sigue siendo la guía correcta para usuarios finales no técnicos).

No hay:
- Publicación en Chrome Web Store (no evaluado todavía).
- Empaquetado `.crx`/`.zip` versionado automáticamente.
- Firma de extensión.

**Si en el futuro se evalúa publicar en Chrome Web Store**: revisar `manifest.json` contra los requisitos de la Chrome Web Store (política de permisos, descripción, iconos en los tamaños requeridos — ya están presentes en `icons/`), y considerar en ese momento si conviene introducir un bundler (ver `docs/adr/0001-no-bundler-or-typescript-yet.md`) para minificar antes de subir el paquete. No es parte del roadmap actual (`docs/ROADMAP.md`).

## El backend Bun (`ramonnet-bun-backend`)

Repositorio separado, no incluido en este monorepo. Requisitos documentados en el `README.md` raíz:

- Tener la carpeta del backend en la máquina del usuario.
- Tener [Bun](https://bun.sh/) instalado, o usar el ejecutable empaquetado.
- Arrancar con `iniciar.bat`, que expone el servidor en `http://localhost:3001`.

La extensión depende de que este servidor esté corriendo para cualquier operación de descarga real (Turbo Mode, ver `docs/tech-stack.md`) — sin él, `BunClient` falla en el primer `fetch` y la cola se pausa automáticamente vía el circuit breaker ad-hoc (`docs/patterns.md`).

**Fuera de alcance de este documento**: el deployment/build del backend Bun en sí vive en su propio repo — este documento solo cubre el contrato de integración desde el lado de la extensión (puerto, endpoints esperados, ver `shared/bunClient.js` y `docs/architecture.md`).

## Versionado

`manifest.json` tiene un campo `version` (actualmente `5.1.0`) que no está atado a ningún proceso automático de release — se bumpea manualmente. No hay changelog centralizado a nivel de release; el historial de cambios vive disperso en los banners de versión por archivo (ver `docs/coding-standards.md`) y en `git log`.
