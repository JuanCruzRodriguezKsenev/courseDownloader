---
name: loader-tarjetas
description: Rama loader-tarjetas (desde main 0442598): rediseño visual del loader con detalle según maqueta del dueño; plan listo para obra
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
diseño para un curso y recorrido; token nuevo `--accent-blue` (la hoja prohíbe colores literales).
Memoria de la tanda también vive en la rama de adopción: al mergear, unir los MEMORY.md a mano.
