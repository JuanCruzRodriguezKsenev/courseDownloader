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

**Estado 2026-10-05 (noche):** plan 27 ejecutado (`0457cd3`, memoria `9b1ad66`), batería verificada por `verificador` 82/1248, lint/tsc/build ok. Rama `marca-resaltador` limpia, sin mergear. Pendiente: revisión manual del dueño M-1..M-7 y M-27.1..M-27.9 (`docs/ramas-en-revision.md`). Posible corrección de una línea si M-27.7 falla: ancho de la columna de estado (80px, `styles/list.css:50`) por `Remover ❌`. Ojo: obra citó `list.css:211`, línea equivocada.

**Plan 28 (2026-10-05, noche):** revisión del dueño en Chrome encontró (a) chips pegados a la columna vecina: no hay `box-sizing` global, `.chip-materia` mide hasta 10px más que su columna; `Remover ❌` parte en 2 líneas (80px); (b) pie "Detener descargas" sin descarga: `appState.ts:436` deriva `ráfagaEnCurso` de cualquier estado `"process"` (= *en fila*), y `obtener_estados_en_progreso` no devuelve `rafagaCorriendo`. Plan en la Bóveda `28 - Marca Resaltador, correcciones de la revision...`. Hipótesis alternativa no descartada: `rafagaCorriendo` estancado en storage.session (Paso 5 del plan lo diagnostica). Mismo rama `marca-resaltador`.
