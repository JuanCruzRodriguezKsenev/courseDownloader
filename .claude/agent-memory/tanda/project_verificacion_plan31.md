---
name: verificacion-plan31
description: Verificación del plan 31 con Playwright TERMINADA (2026-10-10): todo ✅ menos M-4; lo que sigue es el plan de corrección
metadata:
  type: project
---

Verificación del plan 31 (Moodle Ingeniería) terminada el 2026-10-10 por mí con playwright-cli ([[verificar-con-playwright]]).
Resultados casilla por casilla en el plan (`~/Boveda/Proyectos/courseDownloader/Planes/31 - …`, §Checklist) y resumen en
`docs/ramas-en-revision.md`.

**Resultado:** ✅ M-A, M-1, M-3, M-B, M-C, M-D, M-E, M-F, M-G. ❌ M-4.

**Lo que sigue (próxima ronda): plan de corrección**, con:
- M-4: al navegar a mitad del recorrido, el curso a medias queda «fallido: error de red» (RN-19 pide descartarlo) y el
  recorrido sigue «escaneando» hasta que el popup lo corta por vigencia (`esVigente`, `core/estado/recorridoTodos.ts:256`).
  Causa probable sin confirmar: lost update en `recorrido_evento` (`background.js:272`, leer-modificar-escribir sin lock).
  El bloque `<recorrido-moodle>` es compartido → probablemente también LINTI e Informática.
- Nombres «Curso 5935/5797/4768» (`scraper.js:431`, toma el 1.er enlace sin texto).
- Textos de `/my/` heredados de Classroom («activos y archivados», «20 s por curso»); la bienvenida dice «videos».
- M-F: los PDF de Moodle (Ingeniería e Informática) se guardan **sin `.pdf`** (el nombre sale del título del recurso);
  el acceso de Mate C se guarda **sin `.md`** (Moodle Asignaturas lo agrega en `sitio/moodle-asignaturas/scraper.js:259`, Mate C no).
  No se pudo saber si ya pasaba antes: el índice real no tiene archivos de Moodle ni de Sites.
- En Informática, «Habilitados a rendir» sale 3 veces (una por módulo); sin revisar si es correcto.
- Pedido aparte del dueño: en la raíz `/` del Moodle, el popup debe decir «andá a Área personal» (falta saber si va
  también para Informática y LINTI).

**Cómo se probó M-F sin tocar la bóveda:** servidor con `HOME=~/.local/share/courseDownloader/home-prueba` (copia reflink
de la Facultad, en el mismo disco btrfs; en `/tmp` falla porque es otro disco). Ya volví a levantar el servidor con el HOME real.
La sesión de Ingeniería quedó **cerrada** por M-E: hay que volver a iniciarla para verificar la corrección.
Scripts de cada casilla en `~/.local/share/courseDownloader/*.js` (i3.js = asociar/bajar genérico; me.js = M-E).
