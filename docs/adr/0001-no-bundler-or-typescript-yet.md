# 0001 — No introducir bundler ni TypeScript por ahora

**Fecha**: 2026-07-16
**Estado**: Superseded by [0008](0008-arquitectura-nucleo-adaptadores.md)

## Contexto

Se evaluó migrar el proyecto a TypeScript para obtener chequeo de tipos, dado que el codebase tiene ~3800 líneas de JS y una superficie de API de `chrome.*` no trivial.

## Opciones consideradas

1. Migración completa a TypeScript con bundler (Vite + CRXJS, o frameworks dedicados como WXT/Plasmo).
2. `// @ts-check` + JSDoc sobre los archivos `.js` existentes, sin bundler ni cambio de extensión.
3. No hacer nada por ahora.

## Decisión

No se adopta ninguna de las dos opciones de tipado todavía. Se prioriza primero cerrar la deuda técnica existente (ver `docs/TECHNICAL_DEBT.md`) y agregar tests, porque:

- El proyecto hoy carga scripts sueltos vía `<script>` tags (`popup.html`) e `importScripts()` (`background.js`), sin ningún paso de build. Migrar a TS completo (opción 1) requiere: agregar un bundler, reescribir `manifest.json` para apuntar a archivos compilados, y convertir el patrón de variables globales (`window.AppState`, `self.HlsEngine`) a módulos ES — un refactor transversal a los 10 archivos del proyecto.
- TypeScript no habría prevenido el hallazgo de seguridad más importante de la auditoría (XSS por interpolación sin escapar en `popup.js:1012`/`:1019`) — es un problema de sanitización en runtime, no de tipos.
- La opción 2 (`// @ts-check` + JSDoc) es de bajo costo y no requiere bundler, pero se difiere hasta después de tener tests, para que el chequeo de tipos no compita en tiempo con las correcciones de mayor impacto.

## Consecuencias

- El proyecto sigue sin ningún chequeo de tipos automatizado hasta que se revise esta decisión.
- Bugs de tipo "typo en propiedad de `chrome.*`" o "accedí a una propiedad que no existe en este objeto" solo se detectan en runtime o por revisión manual.

## Revisar cuando

Haya cobertura de tests sobre `shared/utils.js` y el split de `popup.js` esté hecho (ver `docs/ROADMAP.md`, fases 1-3). En ese punto, adoptar `// @ts-check` + `@types/chrome` es la opción de menor fricción; una migración completa con bundler solo se justificaría ante crecimiento significativo del proyecto (más código, más de un contribuyente activo).

---

> **Superado por [ADR-0008](0008-arquitectura-nucleo-adaptadores.md)** (2026-07-19). Cumplidas las Fases 1-4 del roadmap y con la re-arquitectura de puertos-y-adaptadores obligando de todos modos a la conversión transversal de globales a módulos ES, se decidió fusionar la migración a TypeScript + bundler dentro de esa re-arquitectura, en lugar de mantenerla diferida por separado. Este ADR queda como registro histórico del razonamiento previo.
