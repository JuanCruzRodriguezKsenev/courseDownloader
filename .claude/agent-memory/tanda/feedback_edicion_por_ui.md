---
name: edicion-por-ui
description: El dueño no edita archivos de datos crudos (TSV, JSON); cuando algo necesita decisión suya, darle una UI o preguntarle
metadata:
  type: feedback
---

No diseñar pasos donde el dueño edita a mano archivos de datos (TSV con claves base64, md5, 9 columnas).

**Why:** 2026-09-27, A-2 del corte 2a: abrió los TSV de adopción y dijo "es inentendible como querés que edite
eso… sería mejor generar una ui". Delegó la forma ("una página o un menú desde la extensión, qcyo").

**How to apply:** si un plan necesita decisiones del dueño sobre datos, o se las pregunto con AskUserQuestion y
edito yo, o el plan incluye una pantalla (página local Bun en 127.0.0.1 si es de una sola vez; extensión si es
producto). El TSV puede seguir existiendo como formato intermedio, pero no como interfaz.
