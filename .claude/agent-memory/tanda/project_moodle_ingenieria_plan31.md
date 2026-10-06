---
name: moodle-ingenieria-plan31
description: Plan 31 (Moodle Ingeniería, sexto portal) escrito 2026-10-06; hallazgo H-1 del backend y decisiones del dueño
metadata:
  type: project
---

Plan 31 en la Bóveda (`Planes/31 - Moodle Ingenieria, el sexto portal…`), rama `moodle-ingenieria` (desde `main` 73aadcb, spec aprobada fc52335, pusheada). Va a `obra`.

**Decidido por el dueño:** Ingeniería antes que IDEAS; RN-15 «mis cursos son solo 9» (entran los 9, sin filtro); M-1/M-3 se miden dentro del plan, con la extensión armada.

**Medido en vivo (2026-10-06):** 9 cursos en `/my/` (En progreso 6, Pasados 3; la barra lateral sólo los 6); `/my/courses.php` da 404 (Moodle viejo); DOM sin `data-for`; sección 0 con nombre propio («Anuncios Parroquiales») → RN-4 difiere de Informática, que la manda a «Sin tema».

**Hallazgo H-1 (bug existente):** `backend/destino/portales.js` no lista `moodle-asignaturas` ni `sites-matec` aunque declaran `destinoPorIndice: true`; el plan 31 Paso 1 lo arregla para los tres. Why: el test decía «exactamente» dos portales y nunca lo vio. How to apply: al sumar un portal con destino por índice, sumarlo ahí y en el test.

**Riesgo abierto:** que «Pasados» no esté en el DOM al abrir `/my/` (M-A del plan). Si da 6, plan chico aparte; el bloque `<recorrido-moodle>` no se toca (paridad de 3 scrapers).

**IDEAS:** spec con M-3/M-4/M-2 parcial medidos (2026-10-06); quedan M-1 y M-5; su plan va después del 31.
