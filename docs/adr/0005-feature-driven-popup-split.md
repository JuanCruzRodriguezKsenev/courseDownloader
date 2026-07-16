# 0005 — Reorganización de `popup.js` como feature-driven

**Fecha**: 2026-07-16
**Estado**: Aceptada (pendiente de implementación — ver `docs/ROADMAP.md`, Fase 2)

## Contexto

`popup.js` (1910 líneas) concentra toda la lógica de UI en un único closure `DOMContentLoaded` con ~50 funciones anidadas. Había que definir el criterio de división para el refactor de mantenibilidad documentado en `docs/TECHNICAL_DEBT.md`.

## Decisión

Dividir por dominio funcional (feature), no por tipo técnico. Es decir: `popup/features/queue.js`, `popup/features/onboarding.js`, `popup/features/serverConnection.js`, `popup/features/filters.js` — cada uno con su propia lógica de estado, renderizado y listeners relacionados — en vez de, por ejemplo, `popup/renderers.js` + `popup/handlers.js` + `popup/state.js` separados por capa técnica.

## Por qué

Minimiza el acoplamiento entre features no relacionadas (cambiar el onboarding no debería poder romper la lógica de filtros) y hace que cada archivo sea testeable de forma más aislada. Es el mismo principio de "Feature-Driven Architecture" evaluado en la comparación con FinanzIA, adaptado a un proyecto sin bundler: cada feature-module se suma como `<script>` adicional en `popup.html`, en vez de como carpeta con imports ES.

## Consecuencias

- `popup.js` queda reducido a: inicialización de `nodos`, wiring de listeners de alto nivel, y orquestación entre features.
- Cada archivo nuevo debe sumarse en `popup/popup.html` respetando el orden de dependencia (después de `shared/*.js`, antes de lo que orquesta — ver `docs/coding-standards.md`).

## Nota de secuencia

Este refactor está bloqueado hasta tener tests de `shared/utils.js` (dependencia transitiva de la mayoría de las features), para poder validar que la extracción no cambió comportamiento — ver `docs/ROADMAP.md`, Fase 1 antes que Fase 2.
