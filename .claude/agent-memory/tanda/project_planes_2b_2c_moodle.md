---
name: planes-2b-2c-moodle
description: Planes 00-08 (cierre 2a, corte 2b y 2c) escritos el 2026-09-30 en la bóveda; hallazgos que los moldearon; Moodle espera spec
metadata:
  type: project
---

**Planes en `~/Boveda/Proyectos/courseDownloader/Planes/` (bóveda `df8aa31`)**, norma nueva: los planes viven en la bóveda
(`tipo: plan`), `Estado.md` lo escribe sólo obra (lo crea el plan 00), la tarjeta la hice yo. Orden y ramas en la tarjeta
`courseDownloader.md`. 00 cierre 2a → [dueño mergea, crea `classroom-destino-2b`] → 01-06 (2b; el 06 deja checklist de Brave
para dueño+tanda) → [dueño verifica y mergea, crea `classroom-destino-2c`] → 07-08 (2c) → spec de Moodle (ronda aparte).

**Why / decisiones del dueño (2026-09-30):** alcance = cierre + 2b + 2c; Moodle = spec en la ronda siguiente; pantalla de
asociar = reusar el editor web del 3001 en modo `?modo=indice`, no pantalla del popup.

**Hallazgos que cambiaron los planes (contraste hecho contra código):**
- El escaneo de Classroom NO trae id de curso (`modulo: "<curso> › <tema>"`, scraper.js:968) → plan 04 agrega `cursoId`/`cursoNombre`/`tema`.
- `alimentarSlidingWindow` hace `unlink(rutaArchivo)` al abrir sesión: en el árbol del dueño borraría un archivo propio → plan 02 lo evita.
- `backend/config.js` usa `import.meta.dir` (vitest no lo define): los módulos nuevos del backend sólo `node:` y raíz por parámetro.
- `handleSeleccionarCarpeta` reescribe `config_usuario.json` con sólo `{rutaRaiz}` → borraría `raices` (fusionar).
- La adopción omitió 9 archivos (8 cronogramas + 1 por tema `-`) y el índice no guarda omisiones → `omitidos`/tema `-` (RN-31 nueva) + migración en plan 06. RN-10 no es derivable de nombres → PA-5 abierta.
- El índice real tiene md5 de 32 hex (la spec ejemplifica 16) y accesos de la adopción SIN frontmatter; los nuevos llevan `tipo: acceso` + `revisado`.
- Nombre editado antes de bajar → `cursos.<c>.nombres` (una entrada de `archivos` exige md5/ruta).

**How to apply:** al retomar, mirar qué planes ejecutó obra (`Estado.md` de la bóveda) y re-verificar cada informe pegando
la salida; los controles negativos de obra fallaron antes ("probado" sin salida): exigir la salida roja. Estado de los
puntos de parada: ninguno cruzado al 2026-09-30.

Moodle LINTI medido (portal barato, 8 resource/3 folder/5 url…): [[Proyectos/courseDownloader/Diseños/Moodle del LINTI - medición del portal]] en la bóveda.
