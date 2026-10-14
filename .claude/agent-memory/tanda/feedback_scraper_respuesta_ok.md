---
name: feedback-scraper-respuesta-ok
description: En planes de scrapers de portal, nombrar explícito el chequeo de response.ok por cada fetch y el orden por sección; obra no lo pone solo
metadata:
  type: feedback
---

Un plan de scraper tiene que nombrar, **por cada `fetch`**, qué pasa con una respuesta que no es ok y con un error de red. Tiene que decir que un error del portal deja el curso «fallido», nunca «vacío» ni «ok» con la lista incompleta, y que el orden de la lista es el de las secciones, no el de llegada.

**Why:** el plan 35 (IDEAS) no lo nombró y `obra` no revisó `.ok` en ningún pedido. Un 403 o 5xx salía como «curso vacío», y una sección caída daba un «ok» con ítems de menos que reemplaza la lista guardada. Lo encontró revisor-codigo el 2026-10-13, y lo corrige el plan 36. Ingeniería sí lo tenía (`moodle-ingenieria/scraper.js:659`).

**How to apply:** en cada plan de portal nuevo, sumá una fila «error del portal» por pedido (listado, sección, header, EnterCourse) y un test por fila. Ver [[project-sitios-pendientes]].
