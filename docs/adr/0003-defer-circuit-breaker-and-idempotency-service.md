# 0003 — Formalizar Circuit Breaker e Idempotency Service

**Fecha**: 2026-07-16
**Estado**: Diferida

## Contexto

Al comparar con patrones usados en otro proyecto (FinanzIA), surgió la pregunta de si convenía formalizar un Circuit Breaker explícito y un servicio de idempotencia centralizado.

## Decisión

Diferida para ambos patrones — ya existen versiones ad-hoc funcionales que cubren el caso de uso real del proyecto:

- **Circuit Breaker**: `pausarColaPorErrorDeConexion()` + la alarma `alarma_autoheal` en `background.js:594-663` cumplen el mismo rol (dejar de intentar tras un fallo, reintentar periódicamente, reanudar cuando el servicio vuelve) con dos estados en vez de tres (CLOSED/OPEN/HALF_OPEN). Formalizarlo con una clase `CircuitBreaker` explícita agregaría abstracción sin resolver ningún bug actual, dado que solo hay un "servicio externo" real que monitorear (backend Bun + conectividad a Ramón Net).
- **Idempotency Service**: el mecanismo de `sessionId` (visible en `shared/bunClient.js` como header `x-session-id`, y en `background.js` como `videoActualSessionId`) ya cubre el caso de uso real (evitar fragmentos huérfanos ante cancelaciones/reintentos). Extraerlo a un servicio centralizado solo se justifica si aparecen más endpoints con riesgo de duplicación de escritura.

Ver el detalle de cada implementación ad-hoc en `docs/patterns.md`.

## Consecuencias

- La lógica de reintento de conexión y de idempotencia queda dispersa en `background.js`/`shared/bunClient.js` en vez de encapsulada en un módulo dedicado — aceptable mientras solo haya un servicio externo real que monitorear.

## Revisar cuando

Se agreguen más integraciones externas (más de un backend/servicio a monitorear) o más operaciones con riesgo de duplicación además de la descarga de video.
