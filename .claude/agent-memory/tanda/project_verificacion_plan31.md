---
name: verificacion-plan31
description: Plan 34 ejecutado y V-1..V-8 verdes con Playwright (2026-10-13); rama correccion-plan31 lista para merge
metadata:
  type: project
---

Plan 34 (`~/Boveda/Proyectos/courseDownloader/Planes/34 - Correcciones de la verificacion del plan 31.md`), rama
`correccion-plan31` desde main 171dd1b, specs en 698e455. Va a `obra`; después el dueño se loguea en Ingeniería
(sesión cerrada por M-E) y yo corro V-1..V-8 con Playwright.

**Causas confirmadas (no supuestas):**
- M-4 = lost update en `recorrido_evento` (`background.js:272`): reproducido con test de dos `enviar()` sin await.
- «Curso N»: DOM real de /my/ (Info y LINTI): imagen sin texto visible, `a.coursename` con sr-only «El curso es destacado Nombre del curso X», y enlaces de calendario «Consulta». Regla: `a.coursename` visible primero.
- PDF sin ext: `original` sin ext → el editor no la agrega. Info: view.php devuelve HTML con pluginfile (`…docx.pdf`); Ingeniería: 302.
**Decidido por el dueño:** nombre = título + extensión (RN-6 reescrita; LINTI no cambia); aviso raíz en los 3 Moodle; texto de oferta por portal.
**Why:** sesiones de Playwright siguen abiertas en `playwright-cli -s=verif` (Info y LINTI logueados).
**How to apply:** al retomar, leer el informe de obra en `Informes/34 - …` y correr las V del plan.

**Ronda 2026-10-10 (post-obra):** 8 commits 9fd0416..5e60639, batería verde (87/1330, lint 0, tsc 0, build ok).
Diff fiel al plan; desvío aceptado: `detectarLogin: true` también en modo un-curso (Ing :802, Info :810).
El informe de obra nombra archivos/identificadores inexistentes (descargarAdjunto.js, textosUI…): auditar por diff, no por informe.
Trampa: `package.json` test = `vitest run` pelado; sin `--exclude '.worktrees/**'` fallan 110 archivos de worktrees.
Antes de V-*: recargar la extensión en `-s=verif` (build nuevo); Ingeniería pide login.

**Ronda 2026-10-13:** V-1..V-8 ✅ (detalle en `docs/ramas-en-revision.md`). Ingeniería tiene **8** cursos, no 9: el 2777 desapareció del portal.
Classroom de V-6 sólo por código (el perfil no tiene sesión de Google). V-3/V-4: borré del índice de `home-prueba` las 3 entradas viejas
(copia en `home-prueba/Boveda/indice-antes-v3-20261013.json`) para que se rebajen. Tres textos menores → TECHNICAL_DEBT ⚪.
Próximo: merge a main (compuerta antes), después plan 32.
