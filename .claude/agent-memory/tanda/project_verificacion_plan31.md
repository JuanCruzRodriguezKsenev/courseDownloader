---
name: verificacion-plan31
description: Plan 31 verificado (todo ✅ menos M-4); plan 34 de corrección escrito 2026-10-10, rama correccion-plan31, falta obra y V-1..V-8
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
