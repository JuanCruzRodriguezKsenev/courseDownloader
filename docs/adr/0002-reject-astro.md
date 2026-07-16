# 0002 — No adoptar Astro

**Fecha**: 2026-07-16
**Estado**: Rechazada

## Contexto

Se consultó si Astro sería una tecnología adecuada para el popup de la extensión.

## Decisión

Rechazada. Astro está diseñado para sitios mayormente estáticos con generación en build/server-time e "islands architecture" para hidratar componentes puntuales. El popup de esta extensión no tiene contenido que prerenderizar (todos los datos — lista de clases, progreso de descarga — existen solo en runtime, en `chrome.storage`) y es interfaz 100% interactiva de punta a punta, por lo que no hay "zonas estáticas" que se beneficien de hidratación parcial. Además, el service worker (el componente con más lógica de negocio del proyecto) no tiene ningún modelo de encaje en Astro, que asume que todo gira en torno a páginas/rutas.

## Alternativa correcta si en algún momento se necesita bundler

Vite + CRXJS, WXT o Plasmo — frameworks diseñados específicamente para extensiones MV3, que entienden que hay múltiples entry points sin relación de "ruta" entre sí (service worker, popup, offscreen doc, content scripts). Ver `docs/adr/0001-no-bundler-or-typescript-yet.md`.

## Consecuencias

Ninguna — el proyecto continúa sin bundler ni framework de UI, sin cambios respecto al estado antes de esta evaluación.
