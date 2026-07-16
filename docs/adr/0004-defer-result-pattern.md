# 0004 — No adoptar Result Pattern sin TypeScript

**Fecha**: 2026-07-16
**Estado**: Diferida (depende de 0001)

## Contexto

Se evaluó reemplazar el uso de excepciones (`throw`) por retornos estructurados `{ok, value, error}` en servicios como `BunClient` y `HlsEngine`, inspirado en el uso de `Result<T,E>` en otro proyecto (FinanzIA, en TypeScript).

## Decisión

No adoptar todavía. El valor principal del Result Pattern es que el compilador *obliga* a manejar explícitamente los casos de éxito/error — eso depende de un sistema de tipos que verifique exhaustividad (TypeScript). En JS plano, un objeto `{ok, value, error}` no tiene ninguna garantía de que el caller lo chequee; sería sintácticamente distinto al `try/catch` actual pero sin ganancia real de seguridad.

## Consecuencias

El manejo de errores sigue el patrón actual (`try/catch` + `throw new Error(...)`) descrito en `docs/coding-standards.md`.

## Revisar cuando

Se resuelva `0001-no-bundler-or-typescript-yet.md` y el proyecto adopte al menos `// @ts-check`.
