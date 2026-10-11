---
name: verificacion-plan31
description: LEER AL RETOMAR — verificación del plan 31 con Playwright a medias (2026-10-10); resultados, cómo retomar y qué falta
metadata:
  type: project
---

Verificando el plan 31 (Moodle Ingeniería, ya en `main` sin probar en Chrome) **yo**, con playwright-cli ([[verificar-con-playwright]]).
Se usa el checklist **del plan** (`~/Boveda/Proyectos/courseDownloader/Planes/31 - …`, §Checklist manual), no el de
`docs/ramas-en-revision.md`: `obra` lo reescribió con otras letras y perdió casillas. Al cerrar, corregir ese doc con los resultados.

**Cómo retomar**
- Sesión `playwright-cli -s=verif`, que se abrió con `--config=~/.local/share/courseDownloader/pw.json` (Chromium visible + extensión
  `.output/chrome-mv3`, perfil `~/.local/share/courseDownloader/perfil-playwright`). Si no está viva (`playwright-cli list`), reabrirla con esa config.
- Sesiones iniciadas en ese perfil: Ingeniería, Informática y LINTI (2026-10-10).
- Scripts en `~/.local/share/courseDownloader/`: `m.js` (activa la pestaña de Ingeniería y recarga el popup), `a.js` (escanear todos),
  `b.js` (M-3), `c.js` (M-B), `d.js` (M-4), `e.js` (M-D). Correr cada uno con `run-code --filename=`.
- Trampa: un clic de Playwright activa la pestaña del popup. Hacer los clics con `pop.evaluate(... .click())` y correr `m.js` antes de cada prueba.
- El servidor en :3001 ya estaba corriendo (carpeta `/home/jcrod/Descargas/verificacion-b`).

**Resultados (2026-10-10)**
- ✅ M-A: 9 cursos (6 con material, 3 vacíos), no escanea solo.
- ✅ M-1: ~26 s en total (B3 11,8 s; Física II 11,3 s; el resto < 0,7 s).
- ✅ M-3, ✅ M-B, ✅ M-C (343 ítems), ✅ M-D (93 ítems, 85 accesos, «Anuncios Parroquiales»).
- ❌ M-4: al navegar, el curso a medias queda «fallido: error de red» (RN-19 pide descartarlo), y el recorrido sigue «escaneando» hasta
  que el popup lo corta por vigencia (`esVigente`, `core/estado/recorridoTodos.ts:256`) con «dejó de responder». Causa probable sin confirmar:
  lost update en `recorrido_evento` (`background.js:272`, leer-modificar-escribir sin lock), con el `fin` de `pagehide` y el `curso` fallido
  a la vez. El bloque es compartido → probablemente también LINTI e Informática.
- Menores: «Curso 5935/5797/4768» en tarjeta y resumen (`scraper.js:431`, toma el 1.er enlace sin texto; bloque `<recorrido-moodle>`
  compartido). Texto de `/my/` de Classroom («activos y archivados», «20 s por curso»). Bienvenida dice «videos».

**Falta:** M-G (Informática y LINTI ofrecen su propio recorrido), M-E (cerrar sesión a mitad: hacerla al final, desloguea Ingeniería),
M-F (bajar PDF y `.md` asociando un curso; el dueño todavía no dijo si va a la bóveda real o a una raíz de prueba; repetir con Informática y Mate C).
Después: plan de corrección con M-4 y los nombres. Pendiente aparte: en la raíz `/` del Moodle, el popup debe decir «andá a Área personal»
(pedido del dueño; falta saber si también para Informática y LINTI).
