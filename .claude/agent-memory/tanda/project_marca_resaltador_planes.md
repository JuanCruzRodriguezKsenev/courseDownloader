---
name: project-marca-resaltador-planes
description: Planes 26 (identidad) y 27 (interfaz) de la marca Resaltador, escritos 2026-10-05; decisiones del dueño y por qué se partió en dos
metadata:
  type: project
---

Diseño canónico: `docs/marca-diseno.md` (rama `marca-resaltador`, ahora con `main` mergeado y sin worktree; checkout en `~/Dev/courseDownloader`). Planes en la Bóveda: `26 - Marca Resaltador, identidad...` y `27 - Marca Resaltador, interfaz...`. 27 va **después** de 26 en la misma rama.

**Decisiones del dueño:** fuente por `@fontsource/bricolage-grotesque`; carpeta `RamonNet_Turbo` → `CourseDownloader` sólo en instalaciones nuevas; «omitido» va en la columna del estado (donde dice Pendiente); «videollamada» sólo ícono 📹 en la columna de tipo. **Decisión mía, reversible:** «movido» pasa a ícono `↪` al final del título.

**Why:** el token `--accent-orange` se usaba para texto, borde, relleno y translúcido; amarillo sirve distinto para cada uno (texto en claro = ocre), por eso el plan 26 clasifica línea por línea. Hueco del diseño: la grilla de 5 columnas no contemplaba los chips Videollamada y movido. El diseño tampoco traía color de hover (decidí `#E6BE00` / `#FFE14D`).

**How to apply:** trampa del plan 27: `sincronizarFooterVacio()` mira hijos directos del footer, no meter contenedor para los dos botones. El editor de adopción tiene paleta propia y quedó fuera.

**Estado 2026-10-05 (tarde):** plan 26 ejecutado (`f400da5`), batería verificada 82/1242, dueño lo miró "por arriba" en Chrome. Plan 27 contrastado contra el código y listo para `obra` (Paso 4 corregido). `docs/ramas-en-revision.md` ya trae M-1..M-7 del 26; el 27 agrega los suyos al ejecutarse.
