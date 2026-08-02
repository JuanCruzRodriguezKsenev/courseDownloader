# Architectural Decision Records (ADR)

Registro formal de las decisiones de arquitectura significativas del proyecto.

## Reglas

- **Son inmutables.** Una vez que un ADR está redactado, no se edita ni se borra — ni siquiera para corregir un error de razonamiento descubierto después.
- **Superación, no edición.** Si una decisión cambia, se escribe un ADR **nuevo** con el siguiente número correlativo, que marca explícitamente al anterior como `SUPERSEDED` (superado) en su propio encabezado, y explica el nuevo porqué. El ADR original queda como está, con una nota al pie indicando qué lo superó.
- **Un ADR por decisión.** No mezclar dos decisiones no relacionadas en el mismo archivo.
- **Formato de nombre**: `NNNN-titulo-corto-en-kebab-case.md`, numeración correlativa sin gaps.

## Índice

| # | Título | Estado |
|---|---|---|
| [0001](0001-no-bundler-or-typescript-yet.md) | No introducir bundler ni TypeScript por ahora | Superseded by 0008 |
| [0002](0002-reject-astro.md) | No adoptar Astro | Rechazada |
| [0003](0003-defer-circuit-breaker-and-idempotency-service.md) | Formalizar Circuit Breaker e Idempotency Service | Diferida |
| [0004](0004-defer-result-pattern.md) | No adoptar Result Pattern sin TypeScript | Diferida |
| [0005](0005-feature-driven-popup-split.md) | Reorganización de `popup.js` como feature-driven | Aceptada |
| [0006](0006-adopt-preact-islands-in-popup.md) | Adoptar Preact (islas) en el popup, sin build | Aceptada |
| [0007](0007-dry-docs-canonical-homes.md) | Documentación DRY: un hogar canónico por concepto | Aceptada |
| [0008](0008-arquitectura-nucleo-adaptadores.md) | Arquitectura núcleo genérico + adaptadores (hexagonal) + TypeScript | Aceptada (diseño) |
| [0009](0009-registro-de-sitios-en-runtime.md) | Selección del sitio en runtime (registro por URL), no una build por portal | Aceptada |

Estados posibles: `Propuesta` → `Aceptada` | `Rechazada` | `Diferida` → (eventualmente) `Superseded by NNNN`.
