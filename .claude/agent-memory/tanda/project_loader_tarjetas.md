---
name: loader-tarjetas
description: Rama loader-tarjetas (desde main 0442598): loader en tarjetas (maqueta del dueño) + cancelar escaneo; ambos planes y cómo revisarlos
metadata:
  type: project
---

2026-09-27: el dueño pidió el loader "de este estilo" con una maqueta (tarjetas: lista de cursos, curso actual,
Listos/Vacíos/Fallidos, tiempo + reloj, "Escaneando…", pie). Guardada en `docs/specs/loader-con-progreso/maqueta-loader.png`.
Enmienda de spec RN-24..27 / AC-12; plan `docs/plan-loader-tarjetas.md`. Rama desde `main`, NO desde
`classroom-destino-adopcion` (esa espera A-2 y no toca el loader).

**Why:** la vista del núcleo entregaba `lineas: string[]` ya armadas → la isla no podía repartir en tarjetas;
el plan la vuelve estructurada (`actual`/`contadores`/`restante`). El título sigue en `.loader-text` (piso RN-3),
el CSS lo convierte en cabecera con `:has(.loader-detalle)`; el spinner estático se oculta con `> .spinner`.

**How to apply:** al revisar lo de obra: correr el control negativo yo mismo, y reproducir el CSS compilado en
Claude in Chrome (390×600, oscuro y claro) ANTES de mandar al dueño a T-1..T-5. Decidí sin preguntar: mismo
diseño para un curso y recorrido; ~~token `--accent-blue`~~ → el dueño lo rechazó (2026-09-27): el acento de la app es `--accent-orange`; el azul salía de la maqueta. Ya reemplazado.
Memoria de la tanda también vive en la rama de adopción: al mergear, unir los MEMORY.md a mano.

**Regla aprendida:** una maqueta dice la estructura, no la paleta. Antes de meter un color, mirá qué token de acento
usa la app (`grep var(--accent-` en styles/components) y reusalo; no crees tokens de color nuevos sin preguntar.

**2026-09-28, cancelar escaneo:** plan `docs/plan-cancelar-escaneo.md` entregado a obra (misma rama). El dueño
eligió tarjeta neutra "Escaneo cancelado" con lista vacía (RN-15 enmendado). Al revisar: control negativo del
Paso 2 (S1), contar el nuevo número de miembros de PuertoSitio (ya estaba desfasado: `claveDeListado?` nunca se sumó),
y C-1..C-10 en Claude in Chrome antes del dueño. Tropezón evitado: un obra al que le pasan la **spec** la rechaza
— el traspaso siempre lleva la ruta del `plan-*.md`.

**Trampa del scraper (vale para cualquier corte futuro):** `dormir` captura el token al llamar y sólo mira al vencer;
un `fin` previo a `inicio` lo tiraba el reductor (arreglado en este plan).
