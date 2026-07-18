# 0007 — Documentación DRY: un hogar canónico por concepto

**Fecha**: 2026-07-17
**Estado**: Aceptada

## Contexto

`docs/` creció hasta tener el mismo concepto **explicado completo en varios archivos**: el split de estado `AppState`/`SessionState` estaba en `architecture.md`, `patterns.md` y `data-model.md`; el daemon `Conexion`, el circuit breaker / auto-heal, la regla XSS, el Turbo Mode y el parsing de títulos, cada uno en 3–4 lugares (y también repetidos dentro de `CLAUDE.md`).

Eso rompe el mismo principio que ya se exige en el código: un dato que cambia obliga a editar N copias, y tarde o temprano se desincronizan. No es hipotético — una auditoría de los docs (commits previos de esta sesión) encontró varias copias ya desfasadas entre sí (cobertura de tests, estado de `queue.js`, baseline de ESLint, islas Preact).

## Decisión

Aplicar **single source of truth** a la documentación, igual que al código:

- Cada concepto tiene **un doc canónico** que lo explica completo, con su *qué* y su *por qué*.
- Cualquier otra mención queda como **resumen de 1–2 líneas + link** al canónico — nunca re-explica.
- Si al escribir un doc se re-explica algo que ya vive en otro, se deja el resumen y se linkea.

El mapa vigente de hogares canónicos (schema→`data-model.md`, patrones→`patterns.md`, tecnologías/Turbo→`tech-stack.md`, seguridad→`security.md`, islas→`preact-migration.md`) vive en `docs/contributing.md` §"Regla DRY", que es el documento accionable para quien abre un PR.

## Por qué

Es el mismo argumento de DRY / *single source of truth* que sostiene el resto de la arquitectura: minimiza la superficie de desincronización. En documentación el costo de la duplicación es peor que en código, porque no hay tests que detecten cuándo dos copias divergen — sólo se descubre cuando alguien las lee y se contradicen (y para entonces ya no se sabe cuál es la verdadera).

## Consecuencias

- Los docs de *overview* (sobre todo `architecture.md`) delegan el detalle: dan el panorama y linkean al canónico. Siguen siendo legibles de corrido, pero dejan de ser la fuente del detalle.
- `CLAUDE.md` conserva **sólo** lo específico de operar el repo (comandos, workflow, reglas operativas) y resúmenes + punteros; ya no re-explica lo que vive en `docs/`.
- El checklist de PR (`contributing.md`) y esta convención hacen que el principio se preserve en cambios futuros, no que se re-degrade.

## Qué NO cuenta como duplicación (excepciones deliberadas)

- Un **overview** que orienta y apunta ("el estado está partido, ver `data-model.md`").
- Citar **ejemplos** (2–3 acciones IPC de muestra, no la lista completa).
- Una regla de seguridad **accionable** replicada en forma de una línea donde se necesita verla al codear (`coding-standards.md` → `security.md`), siempre que el detalle/rationale viva sólo en el canónico.
- El `README.md` (audiencia usuario final) y los **ADR** (registros de decisión inmutables, fechados) no son fuente canónica viva y quedan fuera del alcance de recorte.
