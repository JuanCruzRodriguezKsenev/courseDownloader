---
name: project_classroom_descarte_meet
description: Descarte de enlaces efímeros de Google Meet en el scraper de Classroom
metadata:
  type: project
---

# Descarte de enlaces efímeros de Google Meet en el scraper de Classroom

- **Problema**: Enlaces de Google Meet (`meet.google.com`) compartidos en Novedades o Trabajo en clase se clasificaban como notas de acceso (`tipo: "acceso"`). Como son reuniones efímeras y expiran, no deben descargarse ni listarse.
- **Solución**: En `sitio/google-classroom/scraper.js`, helper `esEnlaceMeet` en `clasificarAdjunto` que detecta host `meet.google.com` tanto en `href` como en `Vínculo a ...` y retorna `null`.
- **Efecto**: El bucle de escaneo ignora el ítem; no se lista en el popup, no se encola y no crea archivos `.md`. Los videos de Drive y YouTube permanecen intactos.
- **Tests**: `sitio/google-classroom/scraper.test.js` suma test `5e`, elevando la suite a 62 archivos / 988 tests.
